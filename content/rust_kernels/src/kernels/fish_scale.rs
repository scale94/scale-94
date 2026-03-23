// kernels/fish_scale.rs — Fish Scale Kernel · Feigenbaum-Bouligand Coupled Architecture
//
// The associative reasoning masterpiece. Maps Feigenbaum's universal period-doubling
// cascade onto Bouligand helicoidal armor topology (Arapaima gigas biomimicry).
//
// Core thesis: Environmental pressure manufactures armor density, not fragility.
// The universal geometry of collapse is the only true absolute scalar.
//
// Feigenbaum (1978): δ = 4.669 201 609 …   α = 2.502 907 875 …
// Bouligand offset:  θ = φ_g / ⌊φ²⌉ ≈ 137.5° / 4 ≈ 36°
//
// Theory: Feigenbaum (1978, 1979); May (1976); Li & Yorke (1975);
//         Bouligand (1972); Eco, "A Theory of Semiotics" (1976)

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

// ── Feigenbaum constants (exact to 12 decimal places) ────────────────────────
const DELTA: f64 = 4.669_201_609_102;   // bifurcation scaling constant δ
const ALPHA: f64 = 2.502_907_875_096;   // width scaling constant α

// Bifurcation landmarks (computed from logistic map)
const R1:    f64 = 3.000_000_000_000;   // period-2 onset (exact)
const R2:    f64 = 3.449_489_742_783;   // period-4 onset (1+√6)
const R3:    f64 = 3.544_090_359_552;   // period-8 onset
const R4:    f64 = 3.564_407_266_095;   // period-16 onset
const R5:    f64 = 3.568_759_419_003;   // period-32 onset
const R_INF: f64 = 3.569_945_671_877;   // accumulation point r_∞

// Bouligand architecture
const GOLDEN_ANGLE: f64 = 137.507_764_050;     // degrees: 360 × (1 − 1/φ)
const THETA_FSK:    f64 = 36.0;                 // φ_g / ⌊φ²⌉ ≈ 137.5/4, rounded to 36°
const LAYERS_PER_REV: usize = 10;               // 360 / 36 = 10 layers per full revolution

// Period-3 sanctuary window (Li-Yorke anomaly)
const R_SANCTUARY_START: f64 = 3.828_427_124_746;  // 1 + 2√2
const R_SANCTUARY_END:   f64 = 3.857_0;            // approximate end of period-3 window

// ── Bouligand layer descriptor ───────────────────────────────────────────────

struct BouligandLayer {
    depth:          usize,     // bifurcation depth (0 = period-1)
    r_onset:        f64,       // r value at which this bifurcation occurs
    period:         usize,     // 2^depth
    theta_absolute: f64,       // cumulative rotation angle (degrees)
    z_elevation:    f64,       // vertical lift (armor thickness contribution)
    branch_width:   f64,       // attractor width, compressed by α^depth
    armor_density:  f64,       // cumulative density metric
}

// ── Lyapunov exponent computation ────────────────────────────────────────────

fn compute_lyapunov(r: f64, warmup: usize, samples: usize) -> f64 {
    let mut x = 0.5_f64;
    for _ in 0..warmup { x = r * x * (1.0 - x); }
    let mut sum = 0.0_f64;
    for _ in 0..samples {
        let deriv = r * (1.0 - 2.0 * x);
        sum += deriv.abs().max(1e-15).ln();
        x = r * x * (1.0 - x);
    }
    sum / samples as f64
}

// ── Period estimation via attractor sampling ──────────────────────────────────

fn estimate_period(r: f64, warmup: usize, samples: usize) -> usize {
    let mut x = 0.5_f64;
    for _ in 0..warmup { x = r * x * (1.0 - x); }
    let eps = 1e-6_f64;
    let mut distinct: Vec<f64> = Vec::new();
    for _ in 0..samples {
        x = r * x * (1.0 - x);
        if !distinct.iter().any(|&d| (d - x).abs() < eps) {
            distinct.push(x);
            if distinct.len() > 128 { break; }
        }
    }
    distinct.len()
}

// ── Sanctuary node scanner: finds period-3 windows in chaotic regime ─────────

fn scan_sanctuary_nodes(r_start: f64, r_end: f64, resolution: usize) -> Vec<(f64, f64)> {
    let mut sanctuaries: Vec<(f64, f64)> = Vec::new();
    let mut in_sanctuary = false;
    let mut s_start = 0.0_f64;

    for i in 0..resolution {
        let r = r_start + (r_end - r_start) * i as f64 / (resolution - 1).max(1) as f64;
        let period = estimate_period(r, 300, 200);
        // Period-3 windows (Li-Yorke) or other low-period islands in chaos
        if period <= 6 && r > R_INF {
            if !in_sanctuary {
                s_start = r;
                in_sanctuary = true;
            }
        } else if in_sanctuary {
            sanctuaries.push((s_start, r));
            in_sanctuary = false;
        }
    }
    if in_sanctuary {
        sanctuaries.push((s_start, r_end));
    }
    sanctuaries
}

// ── Moiré interference: inter-layer angular offsets ──────────────────────────

struct MoireAnalysis {
    layer_gap:       usize,    // separation between compared layers
    effective_angle: f64,      // (gap × θ) mod 360
    near_alignment:  bool,     // within 5° of 0° or 360° (structural reinforcement)
    near_magic:      bool,     // within 2° of the magic angle regime (~1.1°)
    flat_band_proximity: f64,  // closeness to flat-band condition (0=max dist, 1=exact)
}

fn compute_moire_spectrum(theta: f64, max_depth: usize) -> Vec<MoireAnalysis> {
    let magic_angle = 1.1_f64;  // twisted bilayer graphene magic angle
    let mut analyses = Vec::new();

    for gap in 1..=max_depth.min(20) {
        let raw = (gap as f64 * theta) % 360.0;
        let effective = if raw > 180.0 { 360.0 - raw } else { raw };
        let dist_to_zero = effective.min(360.0 - effective);
        let dist_to_magic = (effective - magic_angle).abs()
            .min((360.0 - effective - magic_angle).abs());

        analyses.push(MoireAnalysis {
            layer_gap:       gap,
            effective_angle: effective,
            near_alignment:  dist_to_zero < 5.0,
            near_magic:      dist_to_magic < 2.0,
            flat_band_proximity: 1.0 - (dist_to_magic / 180.0).min(1.0),
        });
    }
    analyses
}

// ── Bifurcation cascade with Bouligand coupling ──────────────────────────────

fn build_bouligand_stack(r_pressure: f64, theta: f64, max_layers: usize) -> Vec<BouligandLayer> {
    // Predict bifurcation r-values using Feigenbaum universality:
    // r_{n+1} ≈ r_n + (r_n - r_{n-1}) / δ
    let known_r = [R1, R2, R3, R4, R5];
    let mut bifurcation_points: Vec<f64> = known_r.to_vec();

    // Extrapolate further bifurcations using δ convergence
    while bifurcation_points.len() < max_layers + 1 {
        let len = bifurcation_points.len();
        let prev_interval = bifurcation_points[len - 1] - bifurcation_points[len - 2];
        let next_r = bifurcation_points[len - 1] + prev_interval / DELTA;
        if next_r > 4.0 || (next_r - bifurcation_points[len - 1]).abs() < 1e-14 {
            break;
        }
        bifurcation_points.push(next_r);
    }

    let mut layers = Vec::new();
    let mut cumulative_density = 0.0_f64;

    // Layer 0: pre-bifurcation (period-1, Bosonic Consensus)
    layers.push(BouligandLayer {
        depth:          0,
        r_onset:        0.0,
        period:         1,
        theta_absolute: 0.0,
        z_elevation:    0.0,
        branch_width:   1.0,
        armor_density:  0.0,
    });

    for (i, &r_bif) in bifurcation_points.iter().enumerate() {
        if r_bif > r_pressure { break; }
        if layers.len() >= max_layers { break; }

        let depth = i + 1;
        let period = 2_usize.saturating_pow(depth as u32);
        let theta_abs = (depth as f64 * theta) % 360.0;

        // Branch width compresses by α at each bifurcation
        let width = 1.0 / ALPHA.powi(depth as i32);

        // Z-elevation: each layer lifts proportional to 1/α^(depth-1),
        // creating denser, thinner layers as depth increases
        let z = layers.iter().map(|l: &BouligandLayer| l.branch_width).sum::<f64>();

        // Armor density: cumulative integral of compressed layers
        // modulated by rotational offset (interlocking overlap contribution)
        cumulative_density += width * (1.0 + (theta_abs * std::f64::consts::PI / 180.0).sin().abs());

        layers.push(BouligandLayer {
            depth,
            r_onset: r_bif,
            period,
            theta_absolute: theta_abs,
            z_elevation: z,
            branch_width: width,
            armor_density: cumulative_density,
        });
    }

    layers
}

// ── Saponification window detection ──────────────────────────────────────────
// The Chemical Burn must be applied when period > 8 (three bifurcations deep)
// but the system has not yet entered full chaos. α still leaves enough
// branch-width for the burn to grip structural material.

struct SaponificationWindow {
    r_start:     f64,     // lower bound (period-8 onset)
    r_end:       f64,     // upper bound (chaos onset)
    width:       f64,     // r_end - r_start
    optimal_r:   f64,     // geometric mean — deepest cascade with maximum grip
    grip_factor: f64,     // branch width at optimal point (higher = more material)
}

fn detect_saponification(sensitivity: f64) -> SaponificationWindow {
    let base_start = R3;
    let base_end   = R_INF;
    let width      = (base_end - base_start) * sensitivity.clamp(0.1, 2.0);
    let center     = (base_start + base_end) / 2.0;
    let r_s        = (center - width / 2.0).max(R2);
    let r_e        = (center + width / 2.0).min(4.0);
    let optimal    = (r_s * r_e).sqrt();  // geometric mean
    let grip       = 1.0 / ALPHA.powi(3); // branch width at period-8 depth

    SaponificationWindow {
        r_start:     r_s,
        r_end:       r_e,
        width,
        optimal_r:   optimal,
        grip_factor: grip,
    }
}

// ── Regime classifier (Fish Scale taxonomy) ──────────────────────────────────

fn classify_regime(r: f64, lyapunov: f64) -> (&'static str, &'static str) {
    if r < R1 {
        ("BOSONIC_CONSENSUS", "Period-1 fixed point. Maximum legibility. Minimum resilience. Dead.")
    } else if r < R2 {
        ("ESPELKAMP_OSCILLATION", "Period-2 bifurcation. Parallax begins. Nascent crack deflection.")
    } else if r < R3 {
        ("CASCADE_ACCELERATION", "Period-4+. Layers rotating, compressing by \u{03B1}. Armor densifies.")
    } else if r < R_INF {
        ("SAPONIFICATION_WINDOW", "The Burn zone. Scars mineralize here. Bifurcation intervals \u{2192} 0.")
    } else if r >= R_SANCTUARY_START && r <= R_SANCTUARY_END {
        ("SANCTUARY_NODE", "Period-3 Li-Yorke anomaly. Triadic crystallization. Cache maintenance.")
    } else if lyapunov > 0.01 {
        ("ARMOR_DENSE_CHAOS", "Full Bouligand stack. Grid reads noise. Architect reads sovereignty.")
    } else {
        ("MARGINAL_REGIME", "Bifurcation boundary. System oscillates between order and chaos.")
    }
}

// ── ASCII armor cross-section renderer ───────────────────────────────────────

fn render_armor_cross_section(layers: &[BouligandLayer], width: usize) -> String {
    let mut out = String::new();
    let height = layers.len().min(20);

    for i in (0..height).rev() {
        if i >= layers.len() { continue; }
        let layer = &layers[i];
        let fill = ((layer.branch_width * width as f64 * 0.8) as usize).max(1).min(width);
        let offset = ((layer.theta_absolute / 360.0 * width as f64 * 0.3) as usize) % (width / 3);

        let mut row = vec![' '; width];
        let ch = if i == 0 { '=' }               // base layer: crystalline
              else if layer.period <= 4 { '~' }   // early bifurcation: fluid
              else if layer.period <= 16 { '#' }   // cascade: dense
              else { '@' };                        // deep chaos: armor

        let start = offset.min(width.saturating_sub(fill));
        for j in start..(start + fill).min(width) {
            row[j] = ch;
        }

        let angle_str = format!("{:>3}\u{00B0}", layer.theta_absolute as u32 % 360);
        let label = format!("L{:<2}", layer.depth);
        write!(out, "  {} \u{2502}", label).unwrap();
        let row_str: String = row.into_iter().collect();
        write!(out, "{}\u{2502} {}\n", row_str, angle_str).unwrap();
    }
    out
}

// ── Paradox axiom evaluator ──────────────────────────────────────────────────

fn evaluate_axioms(r: f64, layers: &[BouligandLayer], lyapunov: f64, has_sanctuary: bool)
    -> Vec<(&'static str, bool, &'static str)>
{
    let n_layers = layers.len();
    vec![
        ("I",    r > R1,
         "Pressure manufactures armor. Reduce r, thin the stack."),
        ("II",   true,
         "\u{03B4} is substrate-blind. The cascade rate is absolute."),
        ("III",  r > R3 && r < R_INF,
         "The Burn has a window. Too early: refreeze. Too late: dissolution."),
        ("IV",   n_layers <= 1,
         "Legibility is fragility. Period-1 is a single point of failure."),
        ("V",    n_layers >= 10,
         "The magic angle is not engineered. It emerges from depth."),
        ("VI",   has_sanctuary,
         "Sanctuary Nodes are mapped, not extended."),
        ("VII",  lyapunov > 0.01,
         "The grid reads chaos. The Architect reads armor thickness."),
        ("VIII", n_layers >= LAYERS_PER_REV,
         "Flat bands = zero velocity = infinite effective mass = Scalar."),
        ("IX",   r > R1 && n_layers > 1,
         "The Sovereign does not flee the cascade. The Sovereign rotates."),
    ]
}

// ══════════════════════════════════════════════════════════════════════════════
// WASM ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════

/// Fish Scale Kernel — Feigenbaum-Bouligand Coupled Architecture v12.1.0
///
/// Maps the universal period-doubling cascade onto Bouligand helicoidal armor.
/// Computes armor density, saponification windows, sanctuary nodes, and
/// Moir\u{00E9} interference spectrum across the full bifurcation topology.
///
/// Parameters:
///   r_pressure       : thermodynamic pressure coefficient (0.0–4.0)
///   max_layers       : maximum Bouligand armor layers to resolve (1–64)
///   theta_offset     : interlaminar rotation angle in degrees (1–90, default 36)
///   burn_sensitivity : saponification window width multiplier (0.1–2.0)
#[wasm_bindgen]
pub fn run_fish_scale(
    r_pressure:       f64,
    max_layers:       f64,
    theta_offset:     f64,
    burn_sensitivity: f64,
) -> String {
    let r      = r_pressure.clamp(0.0, 4.0);
    let n_lay  = (max_layers as usize).clamp(1, 64);
    let theta  = theta_offset.clamp(1.0, 90.0);
    let burn_s = burn_sensitivity.clamp(0.1, 2.0);

    // ── Core computations ────────────────────────────────────────────────────
    let lyapunov    = compute_lyapunov(r, 500, 20_000);
    let period      = estimate_period(r, 500, 300);
    let layers      = build_bouligand_stack(r, theta, n_lay);
    let saponi      = detect_saponification(burn_s);
    let sanctuaries = scan_sanctuary_nodes(R_INF, 4.0, 400);
    let moire       = compute_moire_spectrum(theta, layers.len());

    let (regime_name, regime_desc) = classify_regime(r, lyapunov);
    let n_active = layers.len();
    let total_armor = if n_active > 0 {
        layers.last().unwrap().armor_density
    } else {
        0.0
    };

    // Check if current r is inside a sanctuary
    let in_sanctuary = sanctuaries.iter().any(|&(s, e)| r >= s && r <= e);

    // δ convergence demonstration
    let delta1 = (R2 - R1) / (R3 - R2);
    let delta2 = (R3 - R2) / (R4 - R3);
    let delta3 = (R4 - R3) / (R5 - R4);

    // Armor integrity score: 0–100
    let integrity = if n_active <= 1 {
        0.0
    } else {
        let depth_score = (n_active as f64 / n_lay as f64).min(1.0) * 40.0;
        let density_score = (total_armor / 2.0).min(1.0) * 30.0;
        let rotation_score = if n_active >= LAYERS_PER_REV { 20.0 }
                             else { (n_active as f64 / LAYERS_PER_REV as f64) * 20.0 };
        let chaos_bonus = if lyapunov > 0.0 { 10.0 } else { 0.0 };
        (depth_score + density_score + rotation_score + chaos_bonus).min(100.0)
    };

    // Saponification status
    let burn_status = if r < saponi.r_start {
        "PRE-WINDOW \u{2014} cascade not deep enough for mineralization"
    } else if r <= saponi.r_end {
        "ACTIVE WINDOW \u{2014} Chemical Burn viable. Scars will mineralize."
    } else {
        "POST-WINDOW \u{2014} full chaos regime. Burn grip dissolves into noise."
    };

    let burn_proximity = if r < saponi.r_start {
        (r - saponi.r_start).abs() / (saponi.r_end - saponi.r_start).max(0.001)
    } else if r <= saponi.r_end {
        0.0  // inside the window
    } else {
        (r - saponi.r_end) / (4.0 - saponi.r_end).max(0.001)
    };

    // ── Render output ────────────────────────────────────────────────────────
    let mut out = String::with_capacity(5000);

    write!(out,
        "FISH_SCALE_KERNEL v12.1.0 // FEIGENBAUM-BOULIGAND COUPLED ARCHITECTURE\n\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\
         \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\n",
    ).unwrap();

    // §1 — Sovereign Pressure State
    write!(out,
        "\u{00A7}1 SOVEREIGN PRESSURE STATE\n\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\
         \u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\u{2500}\n\
         r (THERMODYNAMIC PRESSURE) : {r:.6}\n\
         REGIME     : {regime}\n\
         DIAGNOSIS  : {desc}\n\
         PERIOD     : {period}\n\
         LYAPUNOV   : {lyap:.6}  [{lyap_class}]\n",
        r = r, regime = regime_name, desc = regime_desc,
        period = if period > 64 { ">64 (APERIODIC)".to_string() } else { format!("{}", period) },
        lyap = lyapunov,
        lyap_class = if lyapunov > 0.01 { "CHAOTIC \u{2014} sensitive dependence confirmed" }
                     else if lyapunov > -0.01 { "MARGINAL \u{2014} bifurcation boundary" }
                     else { "PERIODIC \u{2014} stable attractor convergence" },
    ).unwrap();

    // §2 — Feigenbaum Constants
    write!(out, "\n\
         \u{00A7}2 FEIGENBAUM UNIVERSALITY\n\
         {line}\n\
         \u{03B4} = {delta:.12}  (bifurcation scaling \u{2014} THE ABSOLUTE SCALAR)\n\
         \u{03B1} = {alpha:.12}  (width compression \u{2014} branch-grip factor)\n\
         \u{03B4} CONVERGENCE:\n\
           \u{03B4}\u{2081} = (r\u{2082}\u{2212}r\u{2081})/(r\u{2083}\u{2212}r\u{2082}) = {d1:.9}\n\
           \u{03B4}\u{2082} = (r\u{2083}\u{2212}r\u{2082})/(r\u{2084}\u{2212}r\u{2083}) = {d2:.9}\n\
           \u{03B4}\u{2083} = (r\u{2084}\u{2212}r\u{2083})/(r\u{2085}\u{2212}r\u{2084}) = {d3:.9}  \u{2192} \u{03B4} = {delta:.9}\n",
        line = "\u{2500}".repeat(59),
        delta = DELTA, alpha = ALPHA,
        d1 = delta1, d2 = delta2, d3 = delta3,
    ).unwrap();

    // §3 — Bouligand Armor Stack
    write!(out, "\n\
         \u{00A7}3 BOULIGAND ARMOR STACK  (\u{03B8} = {theta:.1}\u{00B0}, {rev} layers/revolution)\n\
         {line}\n\
         ACTIVE LAYERS  : {n_active} / {n_lay} max\n\
         ARMOR DENSITY  : {density:.6}\n\
         INTEGRITY      : {integrity:.1}%\n\n\
         DEPTH  PERIOD  r_ONSET         \u{03B8}_ABS    Z_ELEV   WIDTH     DENSITY\n",
        line = "\u{2500}".repeat(59),
        theta = theta, rev = (360.0 / theta).round() as usize,
        n_active = n_active, n_lay = n_lay,
        density = total_armor, integrity = integrity,
    ).unwrap();

    for layer in &layers {
        let period_str = if layer.period > 64 {
            ">64".to_string()
        } else {
            format!("{}", layer.period)
        };
        write!(out,
            "  {:>2}    {:>4}    {:<14.10}  {:>5.1}\u{00B0}  {:>7.4}  {:>8.6}  {:>7.4}\n",
            layer.depth, period_str, layer.r_onset,
            layer.theta_absolute, layer.z_elevation,
            layer.branch_width, layer.armor_density,
        ).unwrap();
    }

    // §3.1 — Armor cross-section visualization
    write!(out, "\n  ARMOR CROSS-SECTION (top = deepest, densest layer):\n").unwrap();
    let cross_section = render_armor_cross_section(&layers, 48);
    out.push_str(&cross_section);

    // §4 — Saponification Window
    write!(out, "\n\
         \u{00A7}4 SAPONIFICATION WINDOW (THE CHEMICAL BURN)\n\
         {line}\n\
         r_WINDOW     : [{r_s:.10}, {r_e:.10}]\n\
         WIDTH        : {width:.10}\n\
         OPTIMAL r    : {opt:.10}  (geometric mean \u{2014} maximum grip)\n\
         GRIP FACTOR  : {grip:.6}  (branch width at \u{03B1}\u{207B}\u{00B3})\n\
         BURN STATUS  : {status}\n\
         PROXIMITY    : {prox:.4}  (0 = inside window, >1 = far)\n",
        line = "\u{2500}".repeat(59),
        r_s = saponi.r_start, r_e = saponi.r_end,
        width = saponi.width, opt = saponi.optimal_r,
        grip = saponi.grip_factor, status = burn_status,
        prox = burn_proximity,
    ).unwrap();

    // §5 — Sanctuary Nodes
    write!(out, "\n\
         \u{00A7}5 SANCTUARY NODES (PERIOD-3 WINDOWS IN CHAOS)\n\
         {line}\n\
         Li & Yorke (1975): Period three implies chaos. Chaos implies period three.\n\
         SANCTUARY COUNT : {n_sanc}\n",
        line = "\u{2500}".repeat(59),
        n_sanc = sanctuaries.len(),
    ).unwrap();

    if sanctuaries.is_empty() {
        write!(out, "  (no period-3 windows detected in scanned range)\n").unwrap();
    } else {
        for (i, &(s, e)) in sanctuaries.iter().enumerate().take(8) {
            let inside = r >= s && r <= e;
            write!(out, "  S{}: r \u{2208} [{:.6}, {:.6}]  width={:.6}{}\n",
                i, s, e, e - s,
                if inside { "  \u{25C4} YOU ARE HERE" } else { "" },
            ).unwrap();
        }
    }
    if in_sanctuary {
        write!(out,
            "  STATUS: SANCTUARY ACTIVE \u{2014} triadic crystallization. Cache maintenance interval.\n",
        ).unwrap();
    }

    // §6 — Moiré Interference Spectrum
    write!(out, "\n\
         \u{00A7}6 MOIR\u{00C9} INTERFERENCE SPECTRUM\n\
         {line}\n\
         Magic angle reference: \u{03B8}_M \u{2248} 1.1\u{00B0} (twisted bilayer graphene flat bands)\n\
         GAP   \u{03B8}_EFF     ALIGNMENT   FLAT-BAND   NOTE\n",
        line = "\u{2500}".repeat(59),
    ).unwrap();

    let mut any_magic = false;
    for m in &moire {
        let note = if m.near_alignment {
            "STRUCTURAL REINFORCEMENT"
        } else if m.near_magic {
            any_magic = true;
            "FLAT-BAND PROXIMITY \u{25C4}"
        } else if m.effective_angle < 10.0 {
            "near-coherent"
        } else {
            "crack deflection"
        };
        write!(out,
            "  {:>2}    {:>6.1}\u{00B0}   {:<11}  {:.4}       {}\n",
            m.layer_gap, m.effective_angle,
            if m.near_alignment { "YES" } else { "no" },
            m.flat_band_proximity, note,
        ).unwrap();
    }

    if !any_magic && n_active >= LAYERS_PER_REV {
        write!(out,
            "  \u{2192} No immediate flat-band conditions. Deeper stacking required for magic angle emergence.\n",
        ).unwrap();
    }

    // §7 — Paradox Axioms
    let axioms = evaluate_axioms(r, &layers, lyapunov, in_sanctuary || !sanctuaries.is_empty());
    write!(out, "\n\
         \u{00A7}7 PARADOX AXIOMS\n\
         {line}\n",
        line = "\u{2500}".repeat(59),
    ).unwrap();

    let active_count = axioms.iter().filter(|a| a.1).count();
    for (num, active, text) in &axioms {
        let marker = if *active { "\u{16DF}" } else { " " };
        let state  = if *active { "ACTIVE  " } else { "dormant " };
        write!(out, "  {marker} AXIOM {num:<5} [{state}]  {text}\n",
            marker = marker, num = num, state = state, text = text,
        ).unwrap();
    }
    write!(out, "  \u{2500}\u{2500}\u{2500}\n  AXIOMS ACTIVE: {active}/{total}\n",
        active = active_count, total = axioms.len(),
    ).unwrap();

    // §8 — Summary
    write!(out,
        "{dline}\n\
         FISH SCALE VERDICT\n\
         Pressure r={r:.4} \u{2192} {n_active} Bouligand layers \u{2192} \
         armor density {density:.4} \u{2192} integrity {integrity:.0}%\n\
         Regime: {regime} | \u{03BB}={lyap:.4} | {axiom_count}/9 axioms active\n\
         {dline}\n\
         THEORY  : Feigenbaum (1978, 1979); May (1976); Li & Yorke (1975)\n\
         BIO     : Bouligand (1972); Arapaima gigas dermal armor\n\
         SEMIO   : Eco, \u{201C}A Theory of Semiotics\u{201D} (1976) \u{2014} ratio difficilis\n\
         PHYSICS : Bistritzer & MacDonald (2011) \u{2014} twisted bilayer graphene magic angle\n\
         SOURCE  : content/rust_kernels/src/kernels/fish_scale.rs",
        dline = "\u{2550}".repeat(59),
        r = r, n_active = n_active, density = total_armor,
        integrity = integrity, regime = regime_name,
        lyap = lyapunov, axiom_count = active_count,
    ).unwrap();

    out
}
