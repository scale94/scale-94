// kernels/transit_matrix.rs — Astrological Transit Matrix Engine
//
// Computes the complete current-sky astrological state in a single WASM call:
// Ptolemaic aspects with differential orbs, harmonic aspects (H5/H7/H9 + minor),
// midpoint trees with 8th-harmonic contact detection (Ebertin),
// declination parallels & contraparallels, antiscia & contra-antiscia,
// essential dignities scored on Lilly's scale (both traditional and modern
// rulerships), and full 8-fold lunation phase + windowing.
//
// Input:  Unix timestamp (ms, f64) and a layer bitmask (u32).
// Output: JSON string. See docs/superpowers/specs/2026-05-14-transit-matrix-kernel-design.md
//
// Astronomy: reuses geocentric_lon and is_retrograde from kernels::astro (pub(crate)).
// Moon position uses lunar::compute_lunar_position (Meeus Ch.47, ~10" accuracy).
// Planets use astro::geocentric_lon (L2 approximation, ±2° accuracy).
// Ecliptic latitude is approximated as 0 for planets (max decl error ~6° for
// Pluto, <2° for inner planets). Pluto excluded from parallel/contraparallel
// detection for this reason.
//
// Dignity score_traditional / score_modern = rulership + exaltation + term + face
// - detriment - fall.  Triplicity is emitted as metadata only (sect unknown
// without geolocation); JS adds +3 based on local time heuristic.
//
// References:
//   Lilly, W., Christian Astrology, 1647.
//   Ebertin, R., Combination of Stellar Influences, 1940.
//   Meeus, J., Astronomical Algorithms, 2nd ed., Willmann-Bell, 1998.
//   Ptolemy, Tetrabiblos, c. 150 AD.

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::astro;
use super::lunar;

// ── Layer bitmask constants ───────────────────────────────────────────────────

const LAYER_POSITIONS:    u32 = 0x01;
const LAYER_ASPECTS:      u32 = 0x02;
const LAYER_HARMONICS:    u32 = 0x04;
const LAYER_MIDPOINTS:    u32 = 0x08;
const LAYER_DECLINATIONS: u32 = 0x10;
const LAYER_ANTISCIA:     u32 = 0x20;
const LAYER_DIGNITIES:    u32 = 0x40;
const LAYER_LUNATION:     u32 = 0x80;

// ── Body indices (match astro.rs) ─────────────────────────────────────────────
// 0=Mercury 1=Venus 2=Sun 3=Mars 4=Jupiter 5=Saturn 6=Uranus 7=Neptune 8=Pluto 9=Moon

const BODY_NAMES: [&str; 10] = [
    "Mercury", "Venus", "Sun", "Mars", "Jupiter",
    "Saturn", "Uranus", "Neptune", "Pluto", "Moon",
];

const SIGN_NAMES: [&str; 12] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const DEG: f64 = std::f64::consts::PI / 180.0;

// ── Utility math ──────────────────────────────────────────────────────────────

fn normalize(deg: f64) -> f64 {
    let d = deg % 360.0;
    if d < 0.0 { d + 360.0 } else { d }
}

fn unix_ms_to_jde(ms: f64) -> f64 {
    2440587.5 + ms / 86_400_000.0
}

fn jde_to_t(jde: f64) -> f64 {
    (jde - 2451545.0) / 36525.0
}

fn angular_sep(a: f64, b: f64) -> f64 {
    let mut d = (a - b).abs() % 360.0;
    if d > 180.0 { d = 360.0 - d; }
    d
}

fn mean_obliquity(t: f64) -> f64 {
    23.0 + 26.0 / 60.0 + 21.448 / 3600.0
        - (46.8150 / 3600.0) * t
        - (0.00059 / 3600.0) * t * t
        + (0.001813 / 3600.0) * t * t * t
}

fn ecliptic_to_decl(lon: f64, lat: f64, eps: f64) -> f64 {
    let lon_r = lon * DEG;
    let lat_r = lat * DEG;
    let eps_r = eps * DEG;
    (lat_r.sin() * eps_r.cos() + lat_r.cos() * eps_r.sin() * lon_r.sin()).asin() / DEG
}

// ── Body class for differential orbs ─────────────────────────────────────────
// 0=luminary  1=personal  2=social  3=outer

fn body_class(idx: usize) -> usize {
    match idx {
        2 | 9 => 0,        // Sun, Moon
        0 | 1 | 3 => 1,    // Mercury, Venus, Mars
        4 | 5 => 2,        // Jupiter, Saturn
        _ => 3,            // Uranus, Neptune, Pluto
    }
}

// Max orb for a pair of body classes for a given aspect class.
// aspect_class: 0=conjunct/opp  1=square/trine  2=sextile
fn max_orb(ca: usize, cb: usize, aspect_class: usize) -> f64 {
    const ORBS: [[f64; 3]; 4] = [
        [10.0, 9.0, 6.0], // luminary
        [ 8.0, 7.0, 5.0], // personal
        [ 7.0, 6.0, 4.0], // social
        [ 6.0, 5.0, 3.0], // outer
    ];
    ORBS[ca][aspect_class].max(ORBS[cb][aspect_class])
}

// ── Aspect tables ─────────────────────────────────────────────────────────────

// (exact_deg, aspect_class, name)
const PTOLEMAIC: [(f64, usize, &str); 5] = [
    (0.0,   0, "Conjunct"),
    (60.0,  2, "Sextile"),
    (90.0,  1, "Square"),
    (120.0, 1, "Trine"),
    (180.0, 0, "Opposite"),
];

// (exact_deg, harmonic, name)
const HARMONIC_ASPECTS: [(f64, u32, &str); 11] = [
    ( 30.0,          12, "Semisextile"),
    ( 40.0,           9, "Novile"),
    ( 45.0,           8, "Semisquare"),
    ( 51.428_571_43,  7, "Septile"),
    ( 72.0,           5, "Quintile"),
    ( 80.0,           9, "Binovile"),
    (102.857_142_86,  7, "Biseptile"),
    (135.0,           8, "Sesquisquare"),
    (144.0,           5, "Biquintile"),
    (150.0,          12, "Quincunx"),
    (154.285_714_29,  7, "Triseptile"),
];

// ── Body position record ───────────────────────────────────────────────────────

struct BodyPos {
    lon:   f64,
    lat:   f64,
    decl:  f64,
    ret:   bool,
    speed: f64,
}

fn compute_all_positions(t: f64) -> [BodyPos; 10] {
    let eps = mean_obliquity(t);
    let dt  = 0.5 / 36525.0; // 0.5 days in Julian centuries

    let moon = lunar::compute_lunar_position(t);
    let moon_plus  = lunar::compute_lunar_position(t + dt);
    let moon_minus = lunar::compute_lunar_position(t - dt);

    let mut bodies: [BodyPos; 10] = std::array::from_fn(|_| BodyPos {
        lon: 0.0, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
    });

    for i in 0..10 {
        if i == 9 {
            // Moon — use high-accuracy Meeus Ch.47 position
            let lon = moon.longitude;
            let lat = moon.latitude;
            let mut spd = moon_plus.longitude - moon_minus.longitude;
            if spd >  180.0 { spd -= 360.0; }
            if spd < -180.0 { spd += 360.0; }
            bodies[i] = BodyPos {
                lon,
                lat,
                decl: ecliptic_to_decl(lon, lat, eps),
                ret: false, // Moon never retrograde geocentrically
                speed: spd,
            };
        } else {
            let lon  = astro::geocentric_lon(i, t);
            let lon2 = astro::geocentric_lon(i, t + dt);
            let lon1 = astro::geocentric_lon(i, t - dt);
            let mut spd = lon2 - lon1;
            if spd >  180.0 { spd -= 360.0; }
            if spd < -180.0 { spd += 360.0; }
            bodies[i] = BodyPos {
                lon,
                lat: 0.0, // lat=0 approximation for planets (see header)
                decl: ecliptic_to_decl(lon, 0.0, eps),
                ret: astro::is_retrograde(i, t),
                speed: spd,
            };
        }
    }
    bodies
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

fn write_opt_str(out: &mut String, v: Option<&str>) {
    match v {
        Some(s) => { let _ = write!(out, "\"{}\"", s); }
        None    => out.push_str("null"),
    }
}

// ── LAYER: POSITIONS ──────────────────────────────────────────────────────────

fn emit_positions(out: &mut String, bodies: &[BodyPos; 10]) {
    out.push_str(",\"positions\":[");
    for (i, b) in bodies.iter().enumerate() {
        if i > 0 { out.push(','); }
        let sign_idx = (b.lon / 30.0).floor() as usize % 12;
        let deg_in   = b.lon % 30.0;
        let _ = write!(out,
            "{{\"body\":\"{}\",\"lon\":{:.4},\"lat\":{:.4},\
             \"decl\":{:.4},\"sign\":\"{}\",\"deg\":{:.4},\
             \"ret\":{},\"speed\":{:.4}}}",
            BODY_NAMES[i], b.lon, b.lat, b.decl,
            SIGN_NAMES[sign_idx], deg_in,
            b.ret, b.speed,
        );
    }
    out.push(']');
}

// ── LAYER: ASPECTS ────────────────────────────────────────────────────────────

struct AspectHit {
    ai:       usize,
    bi:       usize,
    kind:     &'static str,
    exact:    f64,
    orb:      f64,
    max_orb:  f64,
    applying: bool,
}

fn compute_aspects(bodies: &[BodyPos; 10], t: f64) -> Vec<AspectHit> {
    let dt = 1.0 / 36525.0; // 1 day forward for applying/separating

    // Build future lons for applying check
    let mut future_lons = [0.0f64; 10];
    for i in 0..10 {
        future_lons[i] = if i == 9 {
            lunar::compute_lunar_position(t + dt).longitude
        } else {
            astro::geocentric_lon(i, t + dt)
        };
    }

    let mut hits: Vec<AspectHit> = Vec::new();

    for ai in 0..10 {
        for bi in (ai + 1)..10 {
            let sep  = angular_sep(bodies[ai].lon, bodies[bi].lon);
            let sep2 = angular_sep(future_lons[ai], future_lons[bi]);
            let ca = body_class(ai);
            let cb = body_class(bi);

            for &(exact, aclass, name) in &PTOLEMAIC {
                let orb = (sep - exact).abs();
                let mo  = max_orb(ca, cb, aclass);
                if orb <= mo {
                    hits.push(AspectHit {
                        ai, bi, kind: name, exact,
                        orb,
                        max_orb: mo,
                        applying: sep2 < sep,
                    });
                    break; // one aspect per pair per direction
                }
            }
        }
    }

    hits.sort_by(|a, b| a.orb.partial_cmp(&b.orb).unwrap());
    hits
}

fn emit_aspects(out: &mut String, hits: &[AspectHit]) {
    out.push_str(",\"aspects\":[");
    for (i, h) in hits.iter().enumerate() {
        if i > 0 { out.push(','); }
        let _ = write!(out,
            "{{\"a\":\"{}\",\"b\":\"{}\",\"kind\":\"{}\",\
             \"exact_deg\":{:.1},\"orb_deg\":{:.2},\
             \"max_orb\":{:.1},\"applying\":{}}}",
            BODY_NAMES[h.ai], BODY_NAMES[h.bi], h.kind,
            h.exact, h.orb, h.max_orb, h.applying,
        );
    }
    out.push(']');
}

// ── LAYER: HARMONICS ──────────────────────────────────────────────────────────

struct HarmonicHit {
    ai:    usize,
    bi:    usize,
    kind:  &'static str,
    harm:  u32,
    exact: f64,
    orb:   f64,
}

fn compute_harmonics(bodies: &[BodyPos; 10]) -> Vec<HarmonicHit> {
    let mut hits: Vec<HarmonicHit> = Vec::new();
    for ai in 0..10 {
        for bi in (ai + 1)..10 {
            let sep = angular_sep(bodies[ai].lon, bodies[bi].lon);
            for &(exact, harm, name) in &HARMONIC_ASPECTS {
                if (sep - exact).abs() <= 2.0 {
                    hits.push(HarmonicHit {
                        ai, bi, kind: name, harm, exact,
                        orb: (sep - exact).abs(),
                    });
                }
            }
        }
    }
    hits.sort_by(|a, b| a.orb.partial_cmp(&b.orb).unwrap());
    hits
}

fn emit_harmonics(out: &mut String, hits: &[HarmonicHit]) {
    out.push_str(",\"harmonics\":[");
    for (i, h) in hits.iter().enumerate() {
        if i > 0 { out.push(','); }
        let _ = write!(out,
            "{{\"a\":\"{}\",\"b\":\"{}\",\"kind\":\"{}\",\
             \"harmonic\":{},\"exact_deg\":{:.4},\"orb_deg\":{:.2}}}",
            BODY_NAMES[h.ai], BODY_NAMES[h.bi], h.kind,
            h.harm, h.exact, h.orb,
        );
    }
    out.push(']');
}

// ── LAYER: MIDPOINTS ──────────────────────────────────────────────────────────

struct Midpoint {
    ai:  usize,
    bi:  usize,
    lon: f64,
}

fn shorter_arc_midpoint(a: f64, b: f64) -> f64 {
    let diff = (a - b).abs();
    let m = (a + b) / 2.0;
    if diff <= 180.0 { normalize(m) } else { normalize(m + 180.0) }
}

fn compute_midpoints(bodies: &[BodyPos; 10]) -> Vec<Midpoint> {
    let mut mps = Vec::with_capacity(45);
    for ai in 0..10 {
        for bi in (ai + 1)..10 {
            mps.push(Midpoint {
                ai, bi,
                lon: shorter_arc_midpoint(bodies[ai].lon, bodies[bi].lon),
            });
        }
    }
    mps
}

struct MidpointContact {
    planet_idx: usize,
    ai:         usize,
    bi:         usize,
    orb:        f64,
}

fn compute_midpoint_contacts(bodies: &[BodyPos; 10], mps: &[Midpoint]) -> Vec<MidpointContact> {
    let mut contacts: Vec<MidpointContact> = Vec::new();
    for mp in mps {
        for pi in 0..10 {
            if pi == mp.ai || pi == mp.bi { continue; }
            let diff = normalize(bodies[pi].lon - mp.lon);
            let rem  = diff % 45.0;
            let min_d = rem.min(45.0 - rem);
            if min_d <= 1.5 {
                contacts.push(MidpointContact {
                    planet_idx: pi,
                    ai: mp.ai,
                    bi: mp.bi,
                    orb: min_d,
                });
            }
        }
    }
    contacts.sort_by(|a, b| a.orb.partial_cmp(&b.orb).unwrap());
    contacts.truncate(64);
    contacts
}

fn emit_midpoints(out: &mut String, mps: &[Midpoint], contacts: &[MidpointContact]) {
    out.push_str(",\"midpoints\":[");
    for (i, mp) in mps.iter().enumerate() {
        if i > 0 { out.push(','); }
        let sign_idx = (mp.lon / 30.0).floor() as usize % 12;
        let deg_in   = mp.lon % 30.0;
        let _ = write!(out,
            "{{\"a\":\"{}\",\"b\":\"{}\",\"lon\":{:.4},\"sign\":\"{}\",\"deg\":{:.4}}}",
            BODY_NAMES[mp.ai], BODY_NAMES[mp.bi], mp.lon,
            SIGN_NAMES[sign_idx], deg_in,
        );
    }
    out.push_str("],\"midpoint_contacts\":[");
    for (i, c) in contacts.iter().enumerate() {
        if i > 0 { out.push(','); }
        let _ = write!(out,
            "{{\"planet\":\"{}\",\"midpoint\":[\"{}\",\"{}\"],\"orb_deg\":{:.2},\"harmonic\":8}}",
            BODY_NAMES[c.planet_idx], BODY_NAMES[c.ai], BODY_NAMES[c.bi], c.orb,
        );
    }
    out.push(']');
}

// ── LAYER: DECLINATIONS ───────────────────────────────────────────────────────

struct ParallelHit {
    ai:   usize,
    bi:   usize,
    kind: &'static str, // "Parallel" or "Contraparallel"
    orb:  f64,
}

fn compute_parallels(bodies: &[BodyPos; 10]) -> Vec<ParallelHit> {
    let mut hits = Vec::new();
    for ai in 0..10 {
        for bi in (ai + 1)..10 {
            // Skip Pluto (idx 8) — lat=0 approx gives ~6° decl error
            if ai == 8 || bi == 8 { continue; }
            let da = bodies[ai].decl;
            let db = bodies[bi].decl;
            let parallel_orb = (da - db).abs();
            let contra_orb   = (da + db).abs();
            if parallel_orb <= 1.0 {
                hits.push(ParallelHit { ai, bi, kind: "Parallel",      orb: parallel_orb });
            } else if contra_orb <= 1.0 {
                hits.push(ParallelHit { ai, bi, kind: "Contraparallel", orb: contra_orb });
            }
        }
    }
    hits.sort_by(|a, b| a.orb.partial_cmp(&b.orb).unwrap());
    hits
}

fn emit_declinations(out: &mut String, bodies: &[BodyPos; 10], parallels: &[ParallelHit], positions_emitted: bool) {
    if !positions_emitted {
        out.push_str(",\"declinations\":[");
        for (i, b) in bodies.iter().enumerate() {
            if i > 0 { out.push(','); }
            let _ = write!(out,
                "{{\"body\":\"{}\",\"decl\":{:.4},\"out_of_bounds\":{}}}",
                BODY_NAMES[i], b.decl, b.decl.abs() > 23.44,
            );
        }
        out.push(']');
    }
    out.push_str(",\"parallels\":[");
    for (i, h) in parallels.iter().enumerate() {
        if i > 0 { out.push(','); }
        let _ = write!(out,
            "{{\"a\":\"{}\",\"b\":\"{}\",\"kind\":\"{}\",\"orb_deg\":{:.2}}}",
            BODY_NAMES[h.ai], BODY_NAMES[h.bi], h.kind, h.orb,
        );
    }
    out.push_str("],\"parallels_note\":\"pluto_excluded_lat_approx\"");
}

// ── LAYER: ANTISCIA ───────────────────────────────────────────────────────────

struct AntisciaHit {
    ai:   usize,
    bi:   usize,
    kind: &'static str, // "Antiscia" or "ContaAntiscia"
    orb:  f64,
}

fn compute_antiscia(bodies: &[BodyPos; 10]) -> Vec<AntisciaHit> {
    let mut hits = Vec::new();
    for ai in 0..10 {
        for bi in (ai + 1)..10 {
            let sum = normalize(bodies[ai].lon + bodies[bi].lon);
            let anti_orb   = (sum - 180.0).abs().min(360.0 - (sum - 180.0).abs());
            let contra_orb = sum.min(360.0 - sum);
            if anti_orb <= 1.0 {
                hits.push(AntisciaHit { ai, bi, kind: "Antiscia",      orb: anti_orb });
            } else if contra_orb <= 1.0 {
                hits.push(AntisciaHit { ai, bi, kind: "ContraAntiscia", orb: contra_orb });
            }
        }
    }
    hits.sort_by(|a, b| a.orb.partial_cmp(&b.orb).unwrap());
    hits
}

fn emit_antiscia(out: &mut String, hits: &[AntisciaHit]) {
    out.push_str(",\"antiscia\":[");
    for (i, h) in hits.iter().enumerate() {
        if i > 0 { out.push(','); }
        let _ = write!(out,
            "{{\"a\":\"{}\",\"b\":\"{}\",\"kind\":\"{}\",\"orb_deg\":{:.2}}}",
            BODY_NAMES[h.ai], BODY_NAMES[h.bi], h.kind, h.orb,
        );
    }
    out.push(']');
}

// ── LAYER: DIGNITIES ─────────────────────────────────────────────────────────

// Traditional rulerships: body_idx → sign indices
fn trad_rulerships(body: usize) -> &'static [usize] {
    match body {
        0 => &[2, 5],    // Mercury → Gemini, Virgo
        1 => &[1, 6],    // Venus → Taurus, Libra
        2 => &[4],       // Sun → Leo
        3 => &[0, 7],    // Mars → Aries, Scorpio
        4 => &[8, 11],   // Jupiter → Sagittarius, Pisces
        5 => &[9, 10],   // Saturn → Capricorn, Aquarius
        _ => &[],        // Uranus, Neptune, Pluto — no traditional rulership
    }
}

fn trad_detriments(body: usize) -> &'static [usize] {
    match body {
        0 => &[8, 11],   // Mercury → Sagittarius, Pisces
        1 => &[7, 0],    // Venus → Scorpio, Aries
        2 => &[10],      // Sun → Aquarius
        3 => &[6, 1],    // Mars → Libra, Taurus
        4 => &[2, 5],    // Jupiter → Gemini, Virgo
        5 => &[3, 4],    // Saturn → Cancer, Leo
        _ => &[],
    }
}

fn mod_rulerships(body: usize) -> &'static [usize] {
    match body {
        6 => &[10], // Uranus → Aquarius
        7 => &[11], // Neptune → Pisces
        8 => &[7],  // Pluto → Scorpio
        other => trad_rulerships(other),
    }
}

fn mod_detriments(body: usize) -> &'static [usize] {
    match body {
        6 => &[4],  // Uranus → Leo
        7 => &[5],  // Neptune → Virgo
        8 => &[1],  // Pluto → Taurus
        other => trad_detriments(other),
    }
}

// Exaltation: body → Option<(sign_idx, exact_degree)>
fn exaltation_data(body: usize) -> Option<(usize, f64)> {
    match body {
        2 => Some((0,  19.0)), // Sun → Aries 19°
        9 => Some((1,   3.0)), // Moon → Taurus 3°
        0 => Some((5,  15.0)), // Mercury → Virgo 15°
        1 => Some((11, 27.0)), // Venus → Pisces 27°
        3 => Some((9,  28.0)), // Mars → Capricorn 28°
        4 => Some((3,  15.0)), // Jupiter → Cancer 15°
        5 => Some((6,  21.0)), // Saturn → Libra 21°
        _ => None,
    }
}

// Fall: body → Option<(sign_idx, exact_degree)>
fn fall_data(body: usize) -> Option<(usize, f64)> {
    match body {
        2 => Some((6,  19.0)), // Sun → Libra 19°
        9 => Some((7,   3.0)), // Moon → Scorpio 3°
        0 => Some((11, 15.0)), // Mercury → Pisces 15°
        1 => Some((5,  27.0)), // Venus → Virgo 27°
        3 => Some((3,  28.0)), // Mars → Cancer 28°
        4 => Some((9,  15.0)), // Jupiter → Capricorn 15°
        5 => Some((0,  21.0)), // Saturn → Aries 21°
        _ => None,
    }
}

// Triplicity: sign → (day_ruler_body_idx, night_ruler_body_idx)
fn triplicity_rulers(sign: usize) -> (usize, usize) {
    match sign {
        0 | 4 | 8  => (2, 4), // Fire: Sun(day), Jupiter(night)
        1 | 5 | 9  => (1, 9), // Earth: Venus(day), Moon(night)
        2 | 6 | 10 => (5, 0), // Air: Saturn(day), Mercury(night)
        3 | 7 | 11 => (3, 3), // Water: Mars(day), Mars(night)
        _ => (0, 0),
    }
}

// Egyptian Terms: sign → [(body_idx, end_degree)]
fn egyptian_terms(sign: usize) -> &'static [(usize, f64)] {
    match sign {
        0  => &[(4,6.0),(1,12.0),(0,20.0),(3,25.0),(5,30.0)], // Aries
        1  => &[(1,8.0),(0,14.0),(4,22.0),(5,27.0),(3,30.0)], // Taurus
        2  => &[(0,6.0),(4,12.0),(1,17.0),(3,24.0),(5,30.0)], // Gemini
        3  => &[(3,7.0),(1,13.0),(0,19.0),(4,26.0),(5,30.0)], // Cancer
        4  => &[(4,6.0),(1,11.0),(5,18.0),(0,24.0),(3,30.0)], // Leo
        5  => &[(0,7.0),(1,17.0),(4,21.0),(3,28.0),(5,30.0)], // Virgo
        6  => &[(5,6.0),(0,14.0),(4,21.0),(1,28.0),(3,30.0)], // Libra
        7  => &[(3,7.0),(1,11.0),(0,19.0),(4,24.0),(5,30.0)], // Scorpio
        8  => &[(4,12.0),(1,17.0),(0,21.0),(5,26.0),(3,30.0)],// Sagittarius
        9  => &[(0,7.0),(4,14.0),(1,22.0),(5,26.0),(3,30.0)], // Capricorn
        10 => &[(0,7.0),(1,13.0),(4,20.0),(3,25.0),(5,30.0)], // Aquarius
        11 => &[(1,12.0),(4,16.0),(0,19.0),(3,28.0),(5,30.0)],// Pisces
        _  => &[],
    }
}

fn term_ruler(sign: usize, deg: f64) -> usize {
    for &(body, end) in egyptian_terms(sign) {
        if deg < end { return body; }
    }
    5 // Saturn fallback
}

// Chaldean decan order: Mars Sun Venus Mercury Moon Saturn Jupiter ...
const CHALDEAN: [usize; 7] = [3, 2, 1, 0, 9, 5, 4];

fn face_ruler(sign: usize, deg: f64) -> usize {
    let decan = (deg / 10.0).floor() as usize;
    let global = sign * 3 + decan;
    CHALDEAN[global % 7]
}

struct DignityResult {
    rulership:       Option<&'static str>,
    exaltation:      Option<&'static str>,
    detriment:       Option<&'static str>,
    fall:            Option<&'static str>,
    triplicity_day:  Option<&'static str>,
    triplicity_night: Option<&'static str>,
    term_ruler_name: &'static str,
    face_ruler_name: &'static str,
    score_trad:      i32,
    score_mod:       i32,
    peregrine:       bool,
}

fn compute_dignity(body: usize, lon: f64) -> DignityResult {
    let sign   = (lon / 30.0).floor() as usize % 12;
    let deg    = lon % 30.0;
    let sname  = SIGN_NAMES[sign];

    // Rulerships
    let in_trad_rule = trad_rulerships(body).contains(&sign);
    let in_mod_rule  = mod_rulerships(body).contains(&sign);
    // Detriments
    let in_trad_det  = trad_detriments(body).contains(&sign);
    let in_mod_det   = mod_detriments(body).contains(&sign);

    // Exaltation / Fall
    let (in_exalt, exalt_score) = match exaltation_data(body) {
        Some((esign, edeg)) if esign == sign => {
            let score = if (deg - edeg).abs() <= 5.0 { 4 } else { 3 };
            (true, score)
        }
        _ => (false, 0),
    };
    let (in_fall, fall_score) = match fall_data(body) {
        Some((fsign, fdeg)) if fsign == sign => {
            let score = if (deg - fdeg).abs() <= 5.0 { -4 } else { -3 };
            (true, score)
        }
        _ => (false, 0),
    };

    // Term and Face
    let tterm = term_ruler(sign, deg);
    let tface = face_ruler(sign, deg);
    let in_term = tterm == body;
    let in_face = tface == body;

    // Triplicity
    let (day_r, night_r) = triplicity_rulers(sign);
    let is_day_ruler   = day_r == body;
    let is_night_ruler = night_r == body;
    let in_triplicity  = is_day_ruler || is_night_ruler;

    // Scores (triplicity NOT included — sect unknown, JS handles it)
    let mut score_trad = 0i32;
    let mut score_mod  = 0i32;

    if in_trad_rule { score_trad += 5; }
    if in_mod_rule  { score_mod  += 5; }
    if in_exalt     { score_trad += exalt_score; score_mod += exalt_score; }
    if in_term      { score_trad += 2; score_mod += 2; }
    if in_face      { score_trad += 1; score_mod += 1; }
    if in_trad_det  { score_trad -= 5; }
    if in_mod_det   { score_mod  -= 5; }
    if in_fall      { score_trad += fall_score; score_mod += fall_score; }

    // Peregrine: no dignity at all (including triplicity)
    let has_dignity = in_trad_rule || in_mod_rule || in_exalt || in_term || in_face || in_triplicity;
    let peregrine   = !has_dignity;
    if peregrine {
        score_trad = -5;
        score_mod  = -5;
    }

    DignityResult {
        rulership:        if in_trad_rule { Some(sname) } else { None },
        exaltation:       if in_exalt     { Some(sname) } else { None },
        detriment:        if in_trad_det  { Some(sname) } else { None },
        fall:             if in_fall      { Some(sname) } else { None },
        triplicity_day:   if is_day_ruler   { Some(BODY_NAMES[body]) } else { None },
        triplicity_night: if is_night_ruler { Some(BODY_NAMES[body]) } else { None },
        term_ruler_name:  BODY_NAMES[tterm],
        face_ruler_name:  BODY_NAMES[tface],
        score_trad,
        score_mod,
        peregrine,
    }
}

fn emit_dignities(out: &mut String, bodies: &[BodyPos; 10]) {
    out.push_str(",\"dignities\":[");
    for (i, b) in bodies.iter().enumerate() {
        if i > 0 { out.push(','); }
        let d = compute_dignity(i, b.lon);
        let sign_idx = (b.lon / 30.0).floor() as usize % 12;
        let deg_in   = b.lon % 30.0;
        out.push('{');
        let _ = write!(out, "\"body\":\"{}\",\"sign\":\"{}\",\"deg\":{:.4},",
            BODY_NAMES[i], SIGN_NAMES[sign_idx], deg_in);
        out.push_str("\"rulership\":");    write_opt_str(out, d.rulership);
        out.push_str(",\"exaltation\":"); write_opt_str(out, d.exaltation);
        out.push_str(",\"detriment\":");  write_opt_str(out, d.detriment);
        out.push_str(",\"fall\":");       write_opt_str(out, d.fall);
        out.push_str(",\"triplicity_day\":"); write_opt_str(out, d.triplicity_day);
        out.push_str(",\"triplicity_night\":"); write_opt_str(out, d.triplicity_night);
        let _ = write!(out,
            ",\"term\":\"{}\",\"face\":\"{}\",\
             \"score_traditional\":{},\"score_modern\":{},\"peregrine\":{}}}",
            d.term_ruler_name, d.face_ruler_name,
            d.score_trad, d.score_mod, d.peregrine,
        );
    }
    out.push(']');
}

// ── LAYER: LUNATION ───────────────────────────────────────────────────────────

// Meeus Ch.49 new moon JDE for integer k
fn new_moon_jde(k: i64) -> f64 {
    let kf = k as f64;
    let t  = kf / 1236.85;
    let jde0 = 2_451_550.097_66
        + 29.530_588_861 * kf
        + 0.000_154_37 * t * t
        - 0.000_000_150 * t * t * t
        + 0.000_000_000_73 * t * t * t * t;

    let e  = 1.0 - 0.002516 * t - 0.0000074 * t * t;
    let m  = (2.5534 + 29.105_356_70 * kf - 0.000_001_4 * t * t) * DEG;
    let mp = (201.564_3 + 385.816_935_28 * kf + 0.010_758_2 * t * t) * DEG;
    let f  = (160.710_8 + 390.670_502_84 * kf - 0.001_611_8 * t * t) * DEG;

    let delta = -0.407_20 * mp.sin()
        + 0.172_41 * e * m.sin()
        + 0.016_08 * (2.0 * mp).sin()
        + 0.010_39 * (2.0 * f).sin()
        + 0.007_39 * e * (mp - m).sin()
        - 0.005_14 * e * (mp + m).sin()
        + 0.002_08 * e * e * (2.0 * m).sin();

    jde0 + delta
}

fn next_new_moon_jde(current_jde: f64) -> f64 {
    let year_dec = 2000.0 + (current_jde - 2_451_545.0) / 365.25;
    let mut k = ((year_dec - 2000.0) * 12.3685).floor() as i64;
    loop {
        let jde = new_moon_jde(k);
        if jde > current_jde { return jde; }
        k += 1;
    }
}

fn phase_8fold(angle: f64) -> &'static str {
    if angle < 6.0 || angle > 354.0    { "New" }
    else if angle < 84.0               { "Waxing Crescent" }
    else if angle < 96.0               { "First Quarter" }
    else if angle < 174.0              { "Waxing Gibbous" }
    else if angle < 186.0              { "Full" }
    else if angle < 264.0              { "Waning Gibbous" }
    else if angle < 276.0              { "Last Quarter" }
    else                               { "Waning Crescent" }
}

fn lunation_window(angle: f64) -> Option<&'static str> {
    if angle < 6.0 || angle > 354.0    { Some("new") }
    else if angle >= 84.0 && angle < 96.0  { Some("first_quarter") }
    else if angle >= 174.0 && angle < 186.0 { Some("full") }
    else if angle >= 264.0 && angle < 276.0 { Some("last_quarter") }
    else { None }
}

fn emit_lunation(out: &mut String, bodies: &[BodyPos; 10], jde: f64) {
    // Synodic angle: Moon - Sun mod 360
    let syn = normalize(bodies[9].lon - bodies[2].lon);
    let illum = (1.0 - (syn * DEG).cos()) / 2.0;
    let days_since = syn / 360.0 * 29.530_588;
    let next_new   = next_new_moon_jde(jde);
    let phase      = phase_8fold(syn);
    let window     = lunation_window(syn);

    out.push_str(",\"lunation\":{");
    let _ = write!(out,
        "\"synodic_angle\":{:.4},\
         \"phase_8fold\":\"{}\",\
         \"window\":{},\
         \"illumination\":{:.4},\
         \"days_since_new\":{:.4},\
         \"next_new_jde\":{:.4}}}",
        syn, phase,
        match window { Some(w) => format!("\"{}\"", w), None => "null".into() },
        illum, days_since, next_new,
    );
}

// ── Main WASM export ──────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn run_transit_matrix(unix_ms: f64, layers: u32) -> String {
    let jde = unix_ms_to_jde(unix_ms);
    let t   = jde_to_t(jde);

    let bodies = compute_all_positions(t);

    let mut out = String::with_capacity(16384);
    let _ = write!(out, "{{\"epoch_ms\":{},\"jde\":{:.4},\"layers\":{}",
        unix_ms as i64, jde, layers);

    if layers & LAYER_POSITIONS != 0 {
        emit_positions(&mut out, &bodies);
    }

    if layers & LAYER_ASPECTS != 0 {
        let hits = compute_aspects(&bodies, t);
        emit_aspects(&mut out, &hits);
    }

    if layers & LAYER_HARMONICS != 0 {
        let hits = compute_harmonics(&bodies);
        emit_harmonics(&mut out, &hits);
    }

    if layers & LAYER_MIDPOINTS != 0 {
        let mps      = compute_midpoints(&bodies);
        let contacts = compute_midpoint_contacts(&bodies, &mps);
        emit_midpoints(&mut out, &mps, &contacts);
    }

    if layers & LAYER_DECLINATIONS != 0 {
        let parallels = compute_parallels(&bodies);
        emit_declinations(&mut out, &bodies, &parallels, layers & LAYER_POSITIONS != 0);
    }

    if layers & LAYER_ANTISCIA != 0 {
        let hits = compute_antiscia(&bodies);
        emit_antiscia(&mut out, &hits);
    }

    if layers & LAYER_DIGNITIES != 0 {
        emit_dignities(&mut out, &bodies);
    }

    if layers & LAYER_LUNATION != 0 {
        emit_lunation(&mut out, &bodies, jde);
    }

    out.push('}');
    out
}

// ── Tests (TDD) ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── §9 Dignity smoke tests ─────────────────────────────────────────────

    #[test]
    fn test_sun_in_leo_rulership_score_5() {
        // Sun (idx 2) at 120.0° = Leo 0° → rulership → score_traditional = 5
        let d = compute_dignity(2, 120.0);
        assert!(d.rulership.is_some(), "Sun in Leo should have rulership");
        assert_eq!(d.score_trad, 5, "Sun in Leo score_traditional should be 5");
        assert!(!d.peregrine, "Sun in Leo should not be peregrine");
    }

    #[test]
    fn test_mars_in_cancer_28_fall_score_neg4() {
        // Mars (idx 3) Cancer 28° = lon 90+28 = 118°
        // Fall: Mars falls in Cancer (sign 3) exact at 28° → within ±5° → -4
        let d = compute_dignity(3, 118.0);
        assert!(d.fall.is_some(), "Mars in Cancer 28° should have fall");
        assert_eq!(d.score_trad, -4, "Mars in Cancer 28° score_traditional should be -4");
    }

    #[test]
    fn test_moon_in_taurus_3_exaltation_score_4() {
        // Moon (idx 9) Taurus 3° = lon 30+3 = 33°
        // Exaltation: Moon exalted in Taurus (sign 1) exact at 3° → within ±5° → +4
        let d = compute_dignity(9, 33.0);
        assert!(d.exaltation.is_some(), "Moon in Taurus 3° should have exaltation");
        assert_eq!(d.score_trad, 4, "Moon in Taurus 3° score_traditional should be 4");
    }

    // ── Utility math ───────────────────────────────────────────────────────

    #[test]
    fn test_normalize_wraparound() {
        assert!((normalize(370.0) - 10.0).abs() < 1e-9);
        assert!((normalize(-10.0) - 350.0).abs() < 1e-9);
        assert!((normalize(360.0)).abs() < 1e-9);
    }

    #[test]
    fn test_angular_sep_basic() {
        assert!((angular_sep(10.0, 350.0) - 20.0).abs() < 1e-9);
        assert!((angular_sep(0.0, 180.0) - 180.0).abs() < 1e-9);
        assert!((angular_sep(90.0, 180.0) - 90.0).abs() < 1e-9);
    }

    #[test]
    fn test_midpoint_shorter_arc() {
        // 10° and 350°: shorter arc = 20°, midpoint = 0°
        let m = shorter_arc_midpoint(10.0, 350.0);
        assert!(m < 1.0 || m > 359.0, "Midpoint of 10° and 350° should be ~0°, got {}", m);
        // 20° and 40°: midpoint = 30°
        let m2 = shorter_arc_midpoint(20.0, 40.0);
        assert!((m2 - 30.0).abs() < 1e-9, "Midpoint of 20° and 40° should be 30°, got {}", m2);
    }

    // ── Dignity sub-tests ──────────────────────────────────────────────────

    #[test]
    fn test_term_ruler_aries_5deg() {
        // Aries (sign 0) 5°: Jupiter 0-6 → Jupiter idx 4
        assert_eq!(term_ruler(0, 5.0), 4, "Aries 5° term should be Jupiter (4)");
    }

    #[test]
    fn test_term_ruler_aries_7deg() {
        // Aries 7°: Venus 6-12 → Venus idx 1
        assert_eq!(term_ruler(0, 7.0), 1, "Aries 7° term should be Venus (1)");
    }

    #[test]
    fn test_face_ruler_aries_0deg() {
        // Aries (sign 0) 0°: global decan 0, 0%7=0, Chaldean[0]=Mars(3)
        assert_eq!(face_ruler(0, 0.0), 3, "Aries 0° face should be Mars (3)");
    }

    #[test]
    fn test_face_ruler_leo_0deg() {
        // Leo (sign 4) 0°: global decan = 4*3=12, 12%7=5, Chaldean[5]=Saturn(5)
        assert_eq!(face_ruler(4, 0.0), 5, "Leo 0° face should be Saturn (5)");
    }

    #[test]
    fn test_face_ruler_taurus_0deg() {
        // Taurus (sign 1) 0°: global decan = 1*3=3, 3%7=3, Chaldean[3]=Mercury(0)
        assert_eq!(face_ruler(1, 0.0), 0, "Taurus 0° face should be Mercury (0)");
    }

    #[test]
    fn test_sun_peregrine_in_neutral_sign() {
        // Sun in Gemini (sign 2, lon=60°): no rulership/exaltation/term/face for Sun
        // Gemini Air triplicity: day=Saturn(5), night=Mercury(0). Sun is neither → peregrine
        let d = compute_dignity(2, 60.0); // Sun at Gemini 0°
        assert!(d.peregrine, "Sun in Gemini should be peregrine");
        assert_eq!(d.score_trad, -5, "Peregrine score should be -5");
    }

    #[test]
    fn test_saturn_in_aries_fall() {
        // Saturn (idx 5) in Aries (sign 0) — fall exact at 21°
        // Fire triplicity rulers: Sun(day=2), Jupiter(night=4). Saturn(5) is neither.
        // Therefore Saturn in Aries has NO dignity → peregrine overrides to −5.
        let d = compute_dignity(5, 21.0);
        assert!(d.fall.is_some(), "Saturn in Aries 21° should have fall");
        assert!(d.peregrine, "Saturn in Aries is peregrine (no dignity in Fire triplicity)");
        assert_eq!(d.score_trad, -5, "Peregrine overrides fall: score = -5");
    }

    // ── Antiscia ───────────────────────────────────────────────────────────

    #[test]
    fn test_antiscia_detection() {
        // Two planets: lon_A=20°, lon_B=160°. Sum=180° → antiscia
        let mut bodies: [BodyPos; 10] = std::array::from_fn(|_| BodyPos {
            lon: 0.0, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
        });
        bodies[0].lon = 20.0;  // Mercury
        bodies[1].lon = 160.0; // Venus
        let hits = compute_antiscia(&bodies);
        assert!(
            hits.iter().any(|h| h.kind == "Antiscia" && ((h.ai==0&&h.bi==1)||(h.ai==1&&h.bi==0))),
            "Should detect antiscia between Mercury(20°) and Venus(160°)"
        );
    }

    #[test]
    fn test_contra_antiscia_detection() {
        // lon_A=10°, lon_B=350°. Sum=360°≡0° → contra-antiscia
        let mut bodies: [BodyPos; 10] = std::array::from_fn(|_| BodyPos {
            lon: 0.0, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
        });
        bodies[0].lon = 10.0;
        bodies[1].lon = 350.0;
        let hits = compute_antiscia(&bodies);
        assert!(
            hits.iter().any(|h| h.kind == "ContraAntiscia"),
            "Should detect contra-antiscia between 10° and 350°"
        );
    }

    // ── Midpoints ──────────────────────────────────────────────────────────

    #[test]
    fn test_midpoint_count() {
        let bodies: [BodyPos; 10] = std::array::from_fn(|i| BodyPos {
            lon: (i * 36) as f64, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
        });
        let mps = compute_midpoints(&bodies);
        assert_eq!(mps.len(), 45, "10 bodies → 45 midpoints");
    }

    // ── Parallels ─────────────────────────────────────────────────────────

    #[test]
    fn test_parallel_detection() {
        // Two bodies with equal declination → parallel
        let mut bodies: [BodyPos; 10] = std::array::from_fn(|_| BodyPos {
            lon: 0.0, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
        });
        bodies[0].decl = 15.5; // Mercury
        bodies[1].decl = 15.2; // Venus (diff = 0.3° < 1°)
        let hits = compute_parallels(&bodies);
        assert!(
            hits.iter().any(|h| h.kind == "Parallel" && ((h.ai==0&&h.bi==1)||(h.ai==1&&h.bi==0))),
            "Should detect parallel between bodies with similar declination"
        );
    }

    #[test]
    fn test_pluto_excluded_from_parallels() {
        // Pluto (idx 8) should never appear in parallel checks
        let mut bodies: [BodyPos; 10] = std::array::from_fn(|_| BodyPos {
            lon: 0.0, lat: 0.0, decl: 0.0, ret: false, speed: 0.0,
        });
        bodies[8].decl = 15.5; // Pluto
        bodies[0].decl = 15.6; // Mercury (very close to Pluto decl)
        let hits = compute_parallels(&bodies);
        assert!(
            !hits.iter().any(|h| h.ai == 8 || h.bi == 8),
            "Pluto should be excluded from parallel checks"
        );
    }

    // ── Lunation ───────────────────────────────────────────────────────────

    #[test]
    fn test_phase_8fold_new() {
        assert_eq!(phase_8fold(2.0), "New");
        assert_eq!(phase_8fold(356.0), "New");
    }

    #[test]
    fn test_phase_8fold_full() {
        assert_eq!(phase_8fold(180.0), "Full");
        assert_eq!(phase_8fold(178.0), "Full");
    }

    #[test]
    fn test_phase_8fold_crescent() {
        assert_eq!(phase_8fold(45.0), "Waxing Crescent");
    }

    #[test]
    fn test_lunation_window_new() {
        assert_eq!(lunation_window(3.0),  Some("new"));
        // 90° is exactly first quarter — inside the 6° window
        assert_eq!(lunation_window(90.0), Some("first_quarter"));
        // 45° is waxing crescent — no window
        assert_eq!(lunation_window(45.0), None);
    }

    #[test]
    fn test_illumination_formula() {
        // New moon: synodic=0 → illum=0
        let illum_new = (1.0 - (0.0f64 * DEG).cos()) / 2.0;
        assert!(illum_new.abs() < 1e-9);
        // Full moon: synodic=180 → illum=1
        let illum_full = (1.0 - (180.0f64 * DEG).cos()) / 2.0;
        assert!((illum_full - 1.0).abs() < 1e-9);
    }

    // ── Full JSON output ───────────────────────────────────────────────────

    #[test]
    fn test_json_output_all_layers_parses() {
        // Use a known timestamp: 2026-05-14 00:00 UTC ≈ 1747180800000 ms
        let json = run_transit_matrix(1_747_180_800_000.0, 0xFF);
        assert!(json.starts_with('{'), "Output should start with {{");
        assert!(json.ends_with('}'),   "Output should end with }}");
        assert!(json.contains("\"positions\""),  "Should contain positions");
        assert!(json.contains("\"aspects\""),    "Should contain aspects");
        assert!(json.contains("\"harmonics\""),  "Should contain harmonics");
        assert!(json.contains("\"midpoints\""),  "Should contain midpoints");
        assert!(json.contains("\"parallels\""),  "Should contain parallels");
        assert!(json.contains("\"antiscia\""),   "Should contain antiscia");
        assert!(json.contains("\"dignities\""),  "Should contain dignities");
        assert!(json.contains("\"lunation\""),   "Should contain lunation");
        assert!(json.contains("\"layers\":255"), "Should echo layers=255");
    }

    #[test]
    fn test_json_positions_only() {
        let json = run_transit_matrix(1_747_180_800_000.0, 0x01);
        assert!(json.contains("\"positions\""));
        assert!(!json.contains("\"aspects\""));
        assert!(!json.contains("\"dignities\""));
    }

    #[test]
    fn test_json_has_10_positions() {
        let json = run_transit_matrix(1_747_180_800_000.0, 0x01);
        // Count "body": occurrences = 10
        assert_eq!(json.matches("\"body\":").count(), 10, "Should have 10 position bodies");
    }

    #[test]
    fn test_midpoints_count_45() {
        let json = run_transit_matrix(1_747_180_800_000.0, 0x08);
        // 45 midpoints → 45 occurrences of "\"lon\":"
        assert_eq!(json.matches("\"lon\":").count(), 45, "Should have 45 midpoints");
    }

    #[test]
    fn test_next_new_moon_after_current() {
        // next_new_moon_jde must always return a JDE in the future
        let current_jde = unix_ms_to_jde(1_747_180_800_000.0);
        let next = next_new_moon_jde(current_jde);
        assert!(next > current_jde, "Next new moon should be after current JDE");
        // Should be within 30 days (one synodic period)
        assert!(next < current_jde + 30.0, "Next new moon should be within 30 days");
    }
}
