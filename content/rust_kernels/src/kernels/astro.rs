// kernels/astro.rs — Planetary Position Engine (TFG sphere click readings)
//
// Computes geocentric ecliptic longitudes for 10 astrological bodies using
// mean longitude + L2 correction term (Jean Meeus, Astronomical Algorithms,
// 2nd ed., Appendix II). Accuracy: ±2° for all planets, sufficient for
// zodiac sign and degree display.
//
// Body indices (internal):
//   0=Mercury  1=Venus  2=Sun(Earth+180°)  3=Mars  4=Jupiter
//   5=Saturn   6=Uranus  7=Neptune  8=Pluto  9=Moon
//
// Output: text blocks separated by "---\n", one per body.

use wasm_bindgen::prelude::*;

const DEG: f64 = std::f64::consts::PI / 180.0;

fn unix_ms_to_t(unix_ms: f64) -> f64 {
    let jde = 2440587.5 + unix_ms / 86_400_000.0;
    (jde - 2451545.0) / 36525.0
}

fn normalize(deg: f64) -> f64 {
    let d = deg % 360.0;
    if d < 0.0 { d + 360.0 } else { d }
}

// Heliocentric mean longitude (Meeus App. II)
// body: 0=Mercury 1=Venus 2=Earth 3=Mars 4=Jupiter 5=Saturn 6=Uranus 7=Neptune 8=Pluto
fn helio_lon(body: usize, t: f64) -> f64 {
    let (l0, l1, l2): (f64, f64, f64) = match body {
        0 => (252.250906, 149474.0722491,  0.00030397),
        1 => (181.979801,  58519.2130302,  0.00031014),
        2 => (100.464457,  36000.7698278,  0.00030322),
        3 => (355.433275,  19141.6964746,  0.00031097),
        4 => ( 34.351484,   3036.3027889,  0.00022374),
        5 => ( 50.077444,   1223.5110686,  0.00051908),
        6 => (314.055005,    429.8640561,  0.00030390),
        7 => (304.348665,    219.8833092,  0.00030926),
        8 => (238.958116,    144.9600329,  0.0),
        _ => (0.0, 0.0, 0.0),
    };
    normalize(l0 + l1 * t + l2 * t * t)
}

fn helio_radius(body: usize) -> f64 {
    match body {
        0 => 0.387, 1 => 0.723, 2 => 1.000, 3 => 1.524,
        4 => 5.203, 5 => 9.537, 6 => 19.19, 7 => 30.07,
        8 => 39.48, _ => 1.0,
    }
}

pub(crate) fn geocentric_lon(planet: usize, t: f64) -> f64 {
    if planet == 2 {
        return normalize(helio_lon(2, t) + 180.0); // Sun
    }
    if planet == 9 {
        return normalize(218.3164477 + 481267.88123421 * t); // Moon
    }
    let e_rad = helio_lon(2, t) * DEG;
    let p_rad = helio_lon(planet, t) * DEG;
    let re    = helio_radius(2);
    let rp    = helio_radius(planet);
    let ex    = re * e_rad.cos();
    let ey    = re * e_rad.sin();
    let px    = rp * p_rad.cos();
    let py    = rp * p_rad.sin();
    normalize((py - ey).atan2(px - ex) / DEG)
}

pub(crate) fn is_retrograde(planet: usize, t: f64) -> bool {
    if planet == 2 || planet == 9 { return false; }
    let dt   = 1.0 / 36525.0;
    let lon1 = geocentric_lon(planet, t);
    let lon2 = geocentric_lon(planet, t + dt);
    let mut diff = lon2 - lon1;
    if diff >  180.0 { diff -= 360.0; }
    if diff < -180.0 { diff += 360.0; }
    diff < 0.0
}

const ZODIAC: [&str; 12] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANET_NAMES: [&str; 10] = [
    "Mercury", "Venus", "Sun", "Mars", "Jupiter",
    "Saturn", "Uranus", "Neptune", "Pluto", "Moon",
];

const ASPECTS: [(f64, &str); 5] = [
    (0.0,   "Conjunct"),
    (60.0,  "Sextile"),
    (90.0,  "Square"),
    (120.0, "Trine"),
    (180.0, "Opposite"),
];

fn dominant_aspect(i: usize, lons: &[f64; 10]) -> String {
    let mut best: Option<(f64, &str, usize)> = None;
    for j in 0..10 {
        if j == i { continue; }
        let mut sep = (lons[i] - lons[j]).abs() % 360.0;
        if sep > 180.0 { sep = 360.0 - sep; }
        for &(angle, name) in &ASPECTS {
            let orb = (sep - angle).abs();
            if orb < 8.0 && (best.is_none() || orb < best.unwrap().0) {
                best = Some((orb, name, j));
            }
        }
    }
    match best {
        Some((orb, name, j)) => format!("{} {} (orb {:.0}°)", name, PLANET_NAMES[j], orb),
        None => String::from("\u{2014}"),
    }
}

#[wasm_bindgen]
pub fn run_astro(unix_ms: f64) -> String {
    let t = unix_ms_to_t(unix_ms);
    let mut lons = [0.0f64; 10];
    for i in 0..10 {
        lons[i] = geocentric_lon(i, t);
    }
    let mut out = String::with_capacity(512);
    for i in 0..10 {
        let lon      = lons[i];
        let sign_idx = (lon / 30.0).floor() as usize % 12;
        let degree   = lon % 30.0;
        let retro    = is_retrograde(i, t);
        let aspect   = dominant_aspect(i, &lons);
        if i > 0 { out.push_str("---\n"); }
        out.push_str(&format!(
            "{}\nsign:{}\ndegree:{:.0}\nretrograde:{}\naspect:{}\n",
            PLANET_NAMES[i], ZODIAC[sign_idx], degree, retro, aspect,
        ));
    }
    out
}

// ── Mercury Orbital State ────────────────────────────────────────────────────
//
// Real-time Mercury state for the Mercury Terminal alien architect.
// Reuses helio_lon (Meeus App. II) for Mercury's mean longitude.
// Solves Kepler's equation locally for true anomaly and heliocentric distance.
//
// References:
//   Meeus J., Astronomical Algorithms, 2nd ed., ch.32
//   Pettengill & Dyce (1965): Mercury 3:2 spin-orbit resonance
//   Kopp & Lean (2011): Solar constant 1361 W/m²

const MERCURY_A: f64 = 0.38709843;
const MERCURY_E: f64 = 0.20563661;
const MERCURY_VARPI_DEG: f64 = 77.45771895;
const MERCURY_PERIOD_D: f64 = 87.9691;
const MERCURY_SIDEREAL_D: f64 = 58.6462;
const EARTH_A: f64 = 1.00000018;
const EARTH_E: f64 = 0.01673163;
const EARTH_VARPI_DEG: f64 = 102.93768193;

const S0_WM2: f64 = 1361.0;
const ALBEDO: f64 = 0.142;
const EMISSIVITY: f64 = 0.95;
const SIGMA: f64 = 5.670374419e-8;

fn kepler_solve(m: f64, e: f64) -> f64 {
    let mut big_e = m;
    for _ in 0..8 {
        let f  = big_e - e * big_e.sin() - m;
        let fp = 1.0 - e * big_e.cos();
        big_e -= f / fp;
    }
    big_e
}

fn normalize_rad(x: f64) -> f64 {
    let two_pi = 2.0 * std::f64::consts::PI;
    let r = x % two_pi;
    if r < 0.0 { r + two_pi } else { r }
}

// Returns (r, x, y, true_anomaly_rad) — heliocentric AU
fn helio_state(body: usize, t: f64, varpi_deg: f64, a: f64, e: f64) -> (f64, f64, f64, f64) {
    let l_rad = helio_lon(body, t) * DEG;
    let varpi_rad = varpi_deg * DEG;
    let m = normalize_rad(l_rad - varpi_rad);
    let big_e = kepler_solve(m, e);
    let r = a * (1.0 - e * big_e.cos());
    let nu = (((1.0 - e * e).sqrt()) * big_e.sin()).atan2(big_e.cos() - e);
    let lon = normalize_rad(nu + varpi_rad);
    (r, r * lon.cos(), r * lon.sin(), nu)
}

#[wasm_bindgen]
pub fn run_mercury_state(unix_ms: f64) -> String {
    let t = unix_ms_to_t(unix_ms);
    let (r_m, x_m, y_m, nu_m) = helio_state(0, t, MERCURY_VARPI_DEG, MERCURY_A, MERCURY_E);
    let (r_e, x_e, y_e, _)    = helio_state(2, t, EARTH_VARPI_DEG,   EARTH_A,   EARTH_E);

    let dx = x_m - x_e;
    let dy = y_m - y_e;
    let d_em = (dx * dx + dy * dy).sqrt();

    let solar_flux = S0_WM2 / (r_m * r_m);
    let t_sub = (((1.0 - ALBEDO) * solar_flux) / (EMISSIVITY * SIGMA)).powf(0.25);

    // Days to next perihelion (M reaches 2π)
    let l_rad = helio_lon(0, t) * DEG;
    let m_now = normalize_rad(l_rad - MERCURY_VARPI_DEG * DEG);
    let n_rad_per_day = 2.0 * std::f64::consts::PI / MERCURY_PERIOD_D;
    let days_to_peri = (2.0 * std::f64::consts::PI - m_now) / n_rad_per_day;

    // Subsolar longitude — 3:2 resonance, anchor at 0° at J2000
    let days_since_j2000 = (unix_ms - 946728000000.0) / 86_400_000.0;
    let solar_day_d = 1.0 / (1.0 / MERCURY_SIDEREAL_D - 1.0 / MERCURY_PERIOD_D);
    let lon_raw = (days_since_j2000 / solar_day_d) * 360.0;
    let subsolar_lon = ((lon_raw % 360.0) + 360.0) % 360.0;

    // Mercury phase angle as seen from Earth
    let cos_alpha = ((r_m * r_m + d_em * d_em - r_e * r_e) / (2.0 * r_m * d_em))
        .max(-1.0).min(1.0);
    let alpha = cos_alpha.acos();
    let phase_illum = (1.0 + alpha.cos()) / 2.0;

    format!(
        "{{\"heliocentricDistanceAU\":{},\"trueAnomalyDeg\":{},\"solarFluxWm2\":{},\"subsolarLongitudeDeg\":{},\"subsolarTempK\":{},\"nightsideTempK\":100,\"earthMercuryDistanceAU\":{},\"daysToNextPerihelion\":{},\"phaseIllumination\":{}}}",
        r_m,
        (nu_m.to_degrees() + 360.0) % 360.0,
        solar_flux,
        subsolar_lon,
        t_sub,
        d_em,
        days_to_peri,
        phase_illum,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unix_ms_to_t_near_j2000() {
        let t = unix_ms_to_t(946728000000.0);
        assert!(t.abs() < 0.01, "T at J2000 expected ~0, got {}", t);
    }

    #[test]
    fn test_normalize_wraps() {
        assert!((normalize(370.0) - 10.0).abs() < 0.001);
        assert!((normalize(-10.0) - 350.0).abs() < 0.001);
        assert!((normalize(0.0) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_sun_at_j2000_capricorn() {
        let lon = geocentric_lon(2, 0.0);
        assert!(lon > 265.0 && lon < 295.0, "Sun at J2000 expected ~280°, got {}", lon);
    }

    #[test]
    fn test_run_astro_returns_10_blocks() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("---\n").count(), 9, "expected 9 separators, got:\n{}", result);
    }

    #[test]
    fn test_run_astro_contains_all_planet_names() {
        let result = run_astro(1_700_000_000_000.0);
        for name in &["Mercury","Venus","Sun","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Moon"] {
            assert!(result.contains(&format!("{}\n", name)), "missing planet: {}", name);
        }
    }

    #[test]
    fn test_run_astro_sign_fields_present() {
        let result = run_astro(1_700_000_000_000.0);
        assert_eq!(result.matches("sign:").count(), 10);
        assert_eq!(result.matches("retrograde:").count(), 10);
        assert_eq!(result.matches("aspect:").count(), 10);
    }

    #[test]
    fn test_moon_not_retrograde() {
        let result = run_astro(1_700_000_000_000.0);
        // Find the Moon block between "Moon\n" and the next "---\n" or end
        if let Some(start) = result.find("Moon\n") {
            let rest = &result[start..];
            let block = if let Some(sep) = rest.find("---\n") { &rest[..sep] } else { rest };
            assert!(block.contains("retrograde:false"), "Moon should not be retrograde, block: {}", block);
        } else {
            panic!("Moon block not found in output");
        }
    }

    #[test]
    fn test_kepler_solve_circular() {
        let e = kepler_solve(1.5, 0.0);
        assert!((e - 1.5).abs() < 1e-9);
    }

    #[test]
    fn test_kepler_solve_mercury_eccentricity() {
        let e_anom = kepler_solve(0.5, 0.2056);
        // M = E - e·sin(E)
        let m = e_anom - 0.2056 * e_anom.sin();
        assert!((m - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_mercury_state_distance_in_bounds() {
        // Sample across two Mercury years
        for d in 0..180 {
            let ts = 1_700_000_000_000.0 + (d as f64) * 86_400_000.0;
            let json = run_mercury_state(ts);
            // crude extraction: find the "heliocentricDistanceAU":X.XXX, value
            let start = json.find("\"heliocentricDistanceAU\":").unwrap() + 25;
            let end   = json[start..].find(',').unwrap() + start;
            let r: f64 = json[start..end].parse().unwrap();
            assert!(r > 0.30 && r < 0.48, "Day {}: r={}", d, r);
        }
    }

    #[test]
    fn test_mercury_state_subsolar_temp_in_bounds() {
        let json = run_mercury_state(1_700_000_000_000.0);
        let start = json.find("\"subsolarTempK\":").unwrap() + 16;
        let end   = json[start..].find(',').unwrap() + start;
        let t: f64 = json[start..end].parse().unwrap();
        assert!(t > 540.0 && t < 740.0, "subsolarTempK={}", t);
    }

    #[test]
    fn test_mercury_state_json_keys_present() {
        let json = run_mercury_state(1_700_000_000_000.0);
        for key in &[
            "heliocentricDistanceAU", "trueAnomalyDeg", "solarFluxWm2",
            "subsolarLongitudeDeg", "subsolarTempK", "nightsideTempK",
            "earthMercuryDistanceAU", "daysToNextPerihelion", "phaseIllumination",
        ] {
            assert!(json.contains(key), "missing key {}: {}", key, json);
        }
    }
}
