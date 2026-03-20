// ─────────────────────────────────────────────────────────────────────────────
// ecocide.rs  —  Exergy Destruction Engine v1.0.0
//
// Gouy-Stodola Theorem:  X_destroyed = T₀ · S_gen
// Ecological Overshoot:  dX_dest/dt > dX_solar/dt
//
// Three phases:
//   3.3.3    — Homeostasis (biosphere at equilibrium)
//   4.4.4.4  — Extraction (GDP multiplier drives S_gen)
//   5.5.5.5.5 — Overshoot Singularity (thermal arson / collapse)
// ─────────────────────────────────────────────────────────────────────────────

use wasm_bindgen::prelude::*;
use std::cell::RefCell;
use crate::kernels::utils::lcg_next;

// ── Physical constants ────────────────────────────────────────────────────────

/// Earth surface reference temperature (K)
const T0: f64 = 288.15;

/// Total solar exergy influx (TW) — Carnot-corrected: 0.933 × 173.5 TW
const X_SOLAR: f64 = 161.8;

/// Dot-matrix lattice resolution
const DOT_COUNT: usize = 2048;

/// Reciprocal golden ratio — Fibonacci sphere distribution
const PHI_INV: f64 = 0.618_033_988_749_895;

/// Gold dots erupted per (GDP − 1) per second
const CAPITAL_RATE: f64 = 4.0;

/// Viable neighbors killed per capital eruption
const DEATH_RATIO: usize = 5;

/// Dead fraction that triggers Overshoot → Collapse
const COLLAPSE_THRESHOLD: f64 = 0.80;

// ── Dot states ────────────────────────────────────────────────────────────────

const ST_VIABLE:      u8 = 0; // green/blue — alive
const ST_DEAD:        u8 = 1; // matte gray — exergy destroyed
const ST_CAPITAL:     u8 = 2; // neon gold  — capital accumulation
const ST_THERMAL:     u8 = 3; // thermal red — dead+heated in overshoot
const ST_SINGULARITY: u8 = 4; // collapsed capital dot

// ── Simulation phases ─────────────────────────────────────────────────────────

const PH_HOMEOSTASIS: u8 = 0;
const PH_EXTRACTION:  u8 = 1;
const PH_OVERSHOOT:   u8 = 2;
const PH_COLLAPSE:    u8 = 3;
const PH_FINAL:       u8 = 4;

// ── Internal types ────────────────────────────────────────────────────────────

#[derive(Clone)]
struct Dot {
    theta:  f32,  // polar angle [0, π]
    phi:    f32,  // azimuthal angle [0, 2π]
    state:  u8,
    is_land: bool,
    heat:   f32,  // 0..1  thermal overlay intensity
    jitter: f32,  // 0..1  geometry distortion factor
}

struct Ecocide {
    dots:          Vec<Dot>,
    rng:           u64,
    t:             f64,
    x_destroyed:   f64,
    s_gen:         f64,
    phase:         u8,
    metabolic_fat: f64,
    collapse_t:    f64,
    initialized:   bool,
    land_dirty:    bool,  // emit land mask on next step (after reset)
}

impl Ecocide {
    fn new() -> Self {
        Ecocide {
            dots:          Vec::new(),
            rng:           0xdead_beef_cafe_f00d,
            t:             0.0,
            x_destroyed:   0.0,
            s_gen:         0.0,
            phase:         PH_HOMEOSTASIS,
            metabolic_fat: 0.0,
            collapse_t:    0.0,
            initialized:   false,
            land_dirty:    false,
        }
    }
}

thread_local! {
    static SIM: RefCell<Ecocide> = RefCell::new(Ecocide::new());
}

// ── Deterministic Earth land mask ─────────────────────────────────────────────
//
// 42 geographic rectangles (lat_min, lat_max, lon_min, lon_max) in degrees.
// Pure UV lookup — no noise, no falloff, fully deterministic.
// Viewing angle is locked at RY = 1.0 rad in the JS layer (Atlantic centered).

const RAD2DEG: f32 = 180.0 / std::f32::consts::PI;

#[rustfmt::skip]
static LAND_RECTS: [(f32, f32, f32, f32); 42] = [
    // ── North America ──────────────────────────────────────────────────────
    ( 25.0,  70.0, -140.0,  -52.0),  // Canada + USA main body
    ( 55.0,  71.0, -168.0, -140.0),  // Alaska
    ( 52.0,  56.0, -178.0, -162.0),  // Aleutian Islands
    (  8.0,  31.0, -118.0,  -77.0),  // Mexico / Central America
    ( 10.0,  26.0,  -84.0,  -59.0),  // Caribbean rough
    ( 23.0,  32.0, -117.0, -109.0),  // Baja California
    ( 60.0,  84.0,  -74.0,  -12.0),  // Greenland
    // ── South America ──────────────────────────────────────────────────────
    (-56.0,  13.0,  -82.0,  -34.0),  // entire continent
    // ── Europe ─────────────────────────────────────────────────────────────
    ( 36.0,  44.0,   -9.0,    4.0),  // Iberian Peninsula
    ( 44.0,  58.0,   -5.0,   25.0),  // France / Germany / central Europe
    ( 56.0,  72.0,    4.0,   30.0),  // Scandinavia
    ( 58.0,  70.0,   20.0,   32.0),  // Finland + Baltic states
    ( 50.0,  61.0,   -8.0,    2.0),  // UK + Ireland
    ( 36.0,  47.0,   13.0,   29.0),  // Balkans + Italy
    ( 63.0,  67.0,  -24.0,  -13.0),  // Iceland
    // ── Africa ─────────────────────────────────────────────────────────────
    (-35.0,  38.0,  -18.0,   52.0),  // continent
    (-26.0, -12.0,   43.0,   51.0),  // Madagascar
    // ── Asia — Turkey / Middle East / Arabia ──────────────────────────────
    ( 36.0,  43.0,   26.0,   48.0),  // Turkey + Caucasus
    ( 12.0,  38.0,   34.0,   62.0),  // Middle East + Arabian Peninsula
    ( 50.0,  72.0,   28.0,  110.0),  // Russia west + Western Siberia
    ( 50.0,  73.0,  100.0,  180.0),  // Eastern Siberia
    ( 23.0,  40.0,   44.0,   72.0),  // Iran / Afghanistan / Pakistan
    (  6.0,  35.0,   68.0,   88.0),  // India subcontinent
    ( 18.0,  54.0,   73.0,  136.0),  // China + Korea
    ( 30.0,  46.0,  129.0,  146.0),  // Japan
    (  2.0,  24.0,   92.0,  110.0),  // Indochina / Myanmar / Thailand
    ( -6.0,   8.0,   95.0,  119.0),  // Malay Peninsula + Sumatra + Borneo rough
    (  5.0,  20.0,  117.0,  127.0),  // Philippines
    ( -9.0,   2.0,  131.0,  151.0),  // New Guinea
    ( 50.0,  55.0,  141.0,  145.0),  // Sakhalin
    // ── Australia / Oceania ────────────────────────────────────────────────
    (-44.0, -10.0,  113.0,  154.0),  // Australia
    (-47.0, -34.0,  166.0,  178.0),  // New Zealand
    // ── Antarctica ─────────────────────────────────────────────────────────
    (-90.0, -65.0, -180.0,  180.0),
    // ── Islands ────────────────────────────────────────────────────────────
    (  6.0,  10.0,   79.0,   82.0),  // Sri Lanka
    ( 22.0,  26.0,  120.0,  122.0),  // Taiwan
    ( 20.0,  23.0,  -84.0,  -74.0),  // Cuba
    ( 18.0,  20.0,  -74.0,  -68.0),  // Hispaniola
    ( -8.0,  -5.0,  105.0,  116.0),  // Java
    ( 37.0,  42.0,   23.0,   27.0),  // Greece mainland + Aegean peninsula
    ( 15.0,  19.0,  -78.0,  -76.0),  // Jamaica rough
    ( 10.0,  12.0,  -62.0,  -60.0),  // Trinidad
    ( 60.0,  64.0, -168.0, -162.0),  // St Lawrence Island / Bering Sea islands
];

/// Deterministic land test — pure rectangle lookup, no noise.
#[inline]
fn is_land(theta: f32, phi: f32) -> bool {
    let lat = 90.0 - theta * RAD2DEG;
    let lon = phi  * RAD2DEG - 180.0;
    LAND_RECTS.iter().any(|&(lat_min, lat_max, lon_min, lon_max)| {
        lat >= lat_min && lat <= lat_max && lon >= lon_min && lon <= lon_max
    })
}

// ── Fibonacci sphere ──────────────────────────────────────────────────────────

fn fibonacci_sphere(n: usize) -> Vec<(f32, f32)> {
    let mut v = Vec::with_capacity(n);
    let pi2 = 2.0 * std::f64::consts::PI;
    for i in 0..n {
        let y     = 1.0 - (i as f64 * 2.0 + 1.0) / n as f64;
        let theta = y.clamp(-1.0, 1.0).acos() as f32;
        let phi   = ((i as f64 * PHI_INV) % 1.0 * pi2) as f32;
        v.push((theta, phi));
    }
    v
}

// ── Cartesian from spherical ──────────────────────────────────────────────────

#[inline(always)]
fn xyz(theta: f32, phi: f32) -> (f32, f32, f32) {
    let st = theta.sin();
    (st * phi.cos(), theta.cos(), st * phi.sin())
}

// ── Init ──────────────────────────────────────────────────────────────────────

fn init() {
    SIM.with(|cell| {
        let mut sim = cell.borrow_mut();
        let positions = fibonacci_sphere(DOT_COUNT);
        let dots: Vec<Dot> = positions.iter().map(|&(theta, phi)| {
            Dot {
                theta,
                phi,
                state:   ST_VIABLE,
                is_land: is_land(theta, phi),
                heat:    0.0,
                jitter:  0.0,
            }
        }).collect();

        sim.dots          = dots;
        sim.rng           = 0xdead_beef_cafe_f00d;
        sim.t             = 0.0;
        sim.x_destroyed   = 0.0;
        sim.s_gen         = 0.0;
        sim.phase         = PH_HOMEOSTASIS;
        sim.metabolic_fat = 0.0;
        sim.collapse_t    = 0.0;
        sim.initialized   = true;
        sim.land_dirty    = true;  // signal JS to update its land-mask on next frame
    });
}

// ── Step ──────────────────────────────────────────────────────────────────────

fn step(gdp: f64, dt: f64) -> String {
    SIM.with(|cell| {
        let mut sim = cell.borrow_mut();
        if !sim.initialized {
            return r#"{"error":"not_initialized"}"#.to_string();
        }

        // ── Gouy-Stodola thermodynamics ───────────────────────────────────────
        // S_gen ∝ (GDP − 1)² / T₀  — convex penalty for extraction above baseline
        let excess = (gdp - 1.0).max(0.0);
        let s_gen  = excess * excess * 0.08 / T0;
        let dx_dt  = T0 * s_gen;   // X_destroyed rate [TW]
        sim.s_gen        = s_gen;
        sim.x_destroyed += dx_dt * dt;
        sim.t            += dt;

        // ── Phase transitions ──────────────────────────────────────────────────
        let n = sim.dots.len();
        let dead_c    = sim.dots.iter()
            .filter(|d| d.state == ST_DEAD || d.state == ST_THERMAL)
            .count();
        let dead_frac = dead_c as f64 / n as f64;

        match sim.phase {
            PH_HOMEOSTASIS => {
                if gdp > 1.01 { sim.phase = PH_EXTRACTION; }
            }
            PH_EXTRACTION => {
                if dx_dt > X_SOLAR || dead_frac > 0.45 { sim.phase = PH_OVERSHOOT; }
                if gdp <= 1.01 { sim.phase = PH_HOMEOSTASIS; }
            }
            PH_OVERSHOOT => {
                if dead_frac > COLLAPSE_THRESHOLD {
                    sim.phase      = PH_COLLAPSE;
                    sim.collapse_t = 0.0;
                }
            }
            PH_COLLAPSE => {
                sim.collapse_t    += dt;
                sim.metabolic_fat  = (sim.collapse_t / 4.0).min(1.0);
                if sim.collapse_t > 8.0 { sim.phase = PH_FINAL; }
            }
            _ => {}
        }

        let phase = sim.phase;
        let mut rng = sim.rng;

        // ── Dot mutations ──────────────────────────────────────────────────────
        match phase {
            PH_EXTRACTION | PH_OVERSHOOT => {
                // Capital eruptions
                let n_erupt = ((gdp - 1.0) * CAPITAL_RATE * dt).max(0.0).round() as usize;

                for _ in 0..n_erupt {
                    // Find a viable land dot near a random starting index
                    let start = (lcg_next(&mut rng) * n as f64) as usize % n;
                    let cap_idx = (0..n)
                        .map(|k| (start + k) % n)
                        .find(|&i| sim.dots[i].is_land && sim.dots[i].state == ST_VIABLE);

                    if let Some(ci) = cap_idx {
                        sim.dots[ci].state = ST_CAPITAL;

                        // Precompute capital dot's Cartesian position
                        let (cx, cy, cz) = xyz(sim.dots[ci].theta, sim.dots[ci].phi);

                        // Collect DEATH_RATIO nearest viable neighbors
                        let mut nbrs: Vec<(usize, f32)> = (0..n)
                            .filter(|&i| i != ci && sim.dots[i].state == ST_VIABLE)
                            .map(|i| {
                                let (ox, oy, oz) = xyz(sim.dots[i].theta, sim.dots[i].phi);
                                let dot_p = (cx * ox + cy * oy + cz * oz).clamp(-1.0, 1.0);
                                (i, dot_p.acos())
                            })
                            .collect();

                        nbrs.sort_unstable_by(|a, b| {
                            a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal)
                        });

                        for (ni, _) in nbrs.iter().take(DEATH_RATIO) {
                            sim.dots[*ni].state = ST_DEAD;
                        }
                    }
                }

                // In overshoot: heat up dead dots, stochastically convert viable → thermal
                if phase == PH_OVERSHOOT {
                    for d in sim.dots.iter_mut() {
                        match d.state {
                            ST_DEAD => {
                                d.heat  = (d.heat + dt as f32 * 0.25).min(1.0);
                                d.state = ST_THERMAL;
                            }
                            ST_VIABLE => {
                                let r = lcg_next(&mut rng) as f32;
                                if r < 0.015 * dt as f32 {
                                    d.state = ST_THERMAL;
                                    d.heat  = 0.4;
                                }
                            }
                            ST_THERMAL => {
                                d.heat = (d.heat + dt as f32 * 0.08).min(1.0);
                            }
                            _ => {}
                        }
                    }
                }
            }

            PH_COLLAPSE => {
                let ct = sim.collapse_t as f32;
                for d in sim.dots.iter_mut() {
                    match d.state {
                        ST_VIABLE => {
                            let r = lcg_next(&mut rng) as f32;
                            if r < (ct * 0.05).min(0.95) {
                                d.state = ST_DEAD;
                            }
                        }
                        ST_DEAD | ST_THERMAL => {
                            d.heat   = (d.heat   + dt as f32 * 0.3).min(1.0);
                            d.jitter = (d.jitter + dt as f32 * 0.06).min(1.0);
                            d.state  = ST_THERMAL;
                        }
                        ST_CAPITAL => {
                            d.jitter = (d.jitter + dt as f32 * 0.25).min(1.0);
                            if ct > 5.0 { d.state = ST_SINGULARITY; }
                        }
                        ST_SINGULARITY => {
                            d.jitter = (d.jitter + dt as f32 * 0.5).min(1.0);
                        }
                        _ => {}
                    }
                }
            }

            PH_FINAL => {
                for d in sim.dots.iter_mut() {
                    d.state  = ST_DEAD;
                    d.heat   = 0.0;
                    d.jitter = 0.0;
                }
            }

            _ => {}
        }

        sim.rng = rng;

        // ── Statistics ─────────────────────────────────────────────────────────
        let (mut viable, mut dead, mut capital, mut sing) = (0usize, 0, 0, 0);
        for d in &sim.dots {
            match d.state {
                ST_VIABLE      => viable   += 1,
                ST_DEAD | ST_THERMAL => dead += 1,
                ST_CAPITAL     => capital  += 1,
                ST_SINGULARITY => sing     += 1,
                _ => {}
            }
        }

        // ── Serialize ──────────────────────────────────────────────────────────
        let states_str: String = sim.dots.iter()
            .map(|d| d.state.to_string())
            .collect::<Vec<_>>()
            .join(",");

        // Heats — only serialized in overshoot and beyond
        let heats_str: String = if phase >= PH_OVERSHOOT {
            sim.dots.iter()
                .map(|d| format!("{:.2}", d.heat))
                .collect::<Vec<_>>()
                .join(",")
        } else {
            String::new()
        };

        // Jitter — only serialized in collapse and beyond
        let jitter_str: String = if phase >= PH_COLLAPSE {
            sim.dots.iter()
                .map(|d| format!("{:.3}", d.jitter))
                .collect::<Vec<_>>()
                .join(",")
        } else {
            String::new()
        };

        // Land mask — 2048-char binary string, emitted once after each reset.
        // JS reads it to update its rendering land-mask from the Rust source of truth.
        let emit_land = sim.land_dirty;
        sim.land_dirty = false;
        let land_str: String = if emit_land {
            sim.dots.iter()
                .map(|d| if d.is_land { '1' } else { '0' })
                .collect()
        } else {
            String::new()
        };

        let overshoot   = dx_dt > X_SOLAR;
        let bifurcation = phase >= PH_COLLAPSE;
        let fat         = sim.metabolic_fat;
        let t           = sim.t;
        let x_dest      = sim.x_destroyed;

        format!(
            concat!(
                r#"{{"v":1,"phase":{phase},"t":{t:.3},"s_gen":{s_gen:.6},"x_dest":{x_dest:.4},"#,
                r#""dx_dest_dt":{dx_dt:.4},"x_solar":{x_solar:.4},"overshoot":{overshoot},"#,
                r#""bifurcation":{bifurcation},"metabolic_fat":{fat:.4},"viable":{viable},"#,
                r#""dead":{dead},"capital":{capital},"singularity":{sing},"#,
                r#""states":[{states}],"heats":[{heats}],"jitter":[{jitter}],"land":"{land}"}}"#
            ),
            phase       = phase,
            t           = t,
            s_gen       = s_gen,
            x_dest      = x_dest,
            dx_dt       = dx_dt,
            x_solar     = X_SOLAR,
            overshoot   = overshoot,
            bifurcation = bifurcation,
            fat         = fat,
            viable      = viable,
            dead        = dead,
            capital     = capital,
            sing        = sing,
            states      = states_str,
            heats       = heats_str,
            jitter      = jitter_str,
            land        = land_str,
        )
    })
}

// ── WASM export ───────────────────────────────────────────────────────────────

/// Advance the Ecocide simulation by one time step.
///
/// Arguments:
///   gdp_multiplier  — GDP extraction scalar (1.0 = homeostasis baseline)
///   dt              — time step in seconds
///   reset           — set to 1.0 to reinitialise the simulation from scratch
///
/// Returns a JSON string with phase, thermodynamic scalars, per-dot arrays,
/// and (on reset) the 2048-char binary land mask for JS rendering.
#[wasm_bindgen]
pub fn run_ecocide(gdp_multiplier: f64, dt: f64, reset: f64) -> String {
    if reset > 0.5 || !SIM.with(|c| c.borrow().initialized) {
        init();
    }
    step(gdp_multiplier, dt.max(1e-6))
}
