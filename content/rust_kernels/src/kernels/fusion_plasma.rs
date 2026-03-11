// kernels/fusion_plasma.rs — Fusion Plasma Kernel v1.0.0
// Plasma Sovereignty Audit · Lawson Criterion · Q-Factor Ledger
//
// Five modules execute in sequence:
//   01 · Lawson Triple Product     (n×T×τ_E vs. ignition criterion)
//   02 · Fusion Power & Q-Factor   (P_fusion, P_alpha, Bremsstrahlung, Q)
//   03 · Plasma Stability Ledger   (β_N Troyon limit + Greenwald density)
//   04 · Confinement Audit         (IPB98(y,2) empirical scaling, H-factor)
//   05 · Fuel Purity & Wall Load   (He-4 ash dilution + neutron wall loading)
//
// Plasma sovereignty ruling derived from aggregate of all five indicators.
// Default parameters model the ITER Q=10 operating point.
use wasm_bindgen::prelude::*;

/// Maxwell-averaged D-T fusion reactivity <σv> in m³/s.
/// Bosch & Hale, Nuclear Fusion 32(4), 611–631 (1992) — Table IV, D-T, 1–1000 keV.
/// θ-parameterisation of the Gamow-peak integral.
fn dt_reactivity(t_kev: f64) -> f64 {
    if t_kev < 0.5 {
        return 0.0;
    }
    // Bosch-Hale coefficients: D-T reaction, Table IV
    let bg = 34.3827_f64;        // Gamow constant, keV^(1/2)
    let mr_c2 = 1_124_656.0_f64; // reduced mass × c² in keV
    let c1 = 1.173_02e-9_f64;    // normalisation coefficient [cm³/s · keV^(−1/2)]
    let c2 = 1.513_61e-2_f64;
    let c3 = 7.518_86e-2_f64;
    let c4 = 4.606_43e-3_f64;
    let c5 = 1.350_00e-2_f64;
    let c6 = -1.067_50e-4_f64;
    let c7 = 1.366_00e-5_f64;

    let t = t_kev;
    let numer = t * (c2 + t * (c4 + t * c6));
    let denom = 1.0 + t * (c3 + t * (c5 + t * c7));
    let theta = t / (1.0 - numer / denom);
    let xi = f64::cbrt(bg * bg / (4.0 * theta));
    let sv_cm3 = c1 * theta * f64::sqrt(xi / (mr_c2 * t * t * t)) * f64::exp(-3.0 * xi);

    sv_cm3 * 1.0e-6 // cm³/s → m³/s
}

/// Run the Fusion Plasma sovereign audit engine.
///
/// temp_kev:       ion temperature in keV                  (default 10.0)
/// density:        electron density 10²⁰/m³                (default 1.0)
/// tau_e:          energy confinement time s                (default 3.7)
/// b_field:        toroidal magnetic field T                (default 5.3)
/// major_radius:   tokamak major radius R m                 (default 6.2)
/// minor_radius:   tokamak minor radius a m                 (default 2.0)
/// plasma_current: plasma current I_p MA                    (default 15.0)
/// input_power:    external heating power MW                (default 50.0)
/// elongation:     plasma elongation κ                      (default 1.7)
/// helium_fraction: He-4 ash fraction of total ion density  (default 0.05)
#[wasm_bindgen]
pub fn run_fusion_plasma(
    temp_kev: f64,
    density: f64,
    tau_e: f64,
    b_field: f64,
    major_radius: f64,
    minor_radius: f64,
    plasma_current: f64,
    input_power: f64,
    elongation: f64,
    helium_fraction: f64,
) -> String {
    // ── PHYSICAL CONSTANTS ─────────────────────────────────────────────────────
    let e_dt_j = 2.819e-12_f64;    // D-T fusion energy per reaction: 17.6 MeV in J
    let e_alpha_frac = 3.5 / 17.6; // alpha particle energy fraction (3.5 MeV / 17.6 MeV)
    let mu0 = std::f64::consts::PI * 4.0e-7_f64; // μ₀ H/m

    // ── GEOMETRY ──────────────────────────────────────────────────────────────
    let pi = std::f64::consts::PI;
    // Toroidal plasma volume: V = 2π² × R × κ × a²
    let v_plasma = 2.0 * pi * pi * major_radius * elongation * minor_radius * minor_radius;
    // First-wall surface area (elongated torus approximation)
    let kappa_perimeter = f64::sqrt((1.0 + elongation * elongation) / 2.0);
    let a_wall = 4.0 * pi * pi * major_radius * minor_radius * kappa_perimeter;
    let epsilon = minor_radius / major_radius; // inverse aspect ratio

    // ── FUEL DILUTION FROM HELIUM ASH ─────────────────────────────────────────
    // In a D-T plasma with He-4 ash fraction f_He (fraction of n_i):
    //   n_e = n_i × (1 + f_He)    [charge neutrality, Z_He = 2]
    //   n_D = n_T = n_i × (1 - f_He) / 2
    let f_he = f64::clamp(helium_fraction, 0.0, 0.99);
    let n_e = density * 1.0e20_f64;             // m⁻³
    let n_i = n_e / (1.0 + f_he);
    let n_fuel = n_i * (1.0 - f_he) / 2.0;     // n_D = n_T in m⁻³
    let z_eff = (1.0 + 3.0 * f_he) / (1.0 + f_he); // effective charge

    // ── MODULE 01 · LAWSON TRIPLE PRODUCT ─────────────────────────────────────
    // nTτ in keV·s/m³ — ignition criterion for D-T: ≥ 5×10²¹ keV·s/m³
    let triple_product = n_e * temp_kev * tau_e; // keV·s/m³

    let (lawson_status, lawson_signal) = if triple_product >= 5.0e21 {
        ("IGNITION_THRESHOLD_EXCEEDED", "✓ GREEN")
    } else if triple_product >= 1.5e21 {
        ("IGNITION_APPROACH", "⚠ AMBER")
    } else if triple_product >= 3.0e20 {
        ("SCIENTIFIC_REGION", "✗ RED")
    } else {
        ("BELOW_BREAKEVEN", "✗✗ VETO")
    };

    // ── MODULE 02 · FUSION POWER & Q-FACTOR ───────────────────────────────────
    let sv = dt_reactivity(temp_kev); // m³/s
    // Fusion power density: p_fus = n_D × n_T × <σv> × E_DT
    let p_fus_density = n_fuel * n_fuel * sv * e_dt_j; // W/m³
    let p_fusion_w = p_fus_density * v_plasma;          // W total
    let p_fusion_mw = p_fusion_w / 1.0e6;               // MW

    // Alpha self-heating power
    let p_alpha_mw = p_fusion_mw * e_alpha_frac;

    // Bremsstrahlung radiation losses (Hutchinson approximation)
    // P_brem/vol = 5.34×10⁻³⁷ × Z_eff × n_e² × √T_keV  [W/m³]
    let p_brem_density = 5.34e-37 * z_eff * n_e * n_e * f64::sqrt(temp_kev); // W/m³
    let p_brem_mw = p_brem_density * v_plasma / 1.0e6;  // MW

    // Q-factor: fusion gain = P_fusion / P_external_heating
    let q_factor = if input_power > 0.0 { p_fusion_mw / input_power } else { f64::INFINITY };

    // Net fusion gain accounting for Bremsstrahlung loss
    let p_net_mw = p_fusion_mw - p_brem_mw;

    let (q_status, q_signal) = if q_factor >= 10.0 {
        ("IGNITION_CAPABLE", "✓ GREEN")
    } else if q_factor >= 1.0 {
        ("SCIENTIFIC_BREAKEVEN", "⚠ AMBER")
    } else if q_factor >= 0.1 {
        ("PLASMA_GAIN", "✗ RED")
    } else {
        ("PLASMA_DEFICIT", "✗✗ VETO")
    };

    // ── MODULE 03 · PLASMA STABILITY LEDGER ───────────────────────────────────
    // Normalised beta: β_N = β_t[%] × a[m] × B[T] / I_p[MA]
    // β_t = 2μ₀ × P_plasma / B²  where P_plasma = 2 × n × kT (electrons + ions)
    let kt_j = temp_kev * 1.602e-16_f64; // keV → J
    let p_thermal = 2.0 * n_e * kt_j;    // J/m³
    let beta_t = 2.0 * mu0 * p_thermal / (b_field * b_field);
    let beta_t_pct = beta_t * 100.0;
    let beta_n = beta_t_pct * minor_radius * b_field / plasma_current;

    // Troyon–Sykes–Wesson normalised beta limit: β_N ≤ 2.8 (standard), ≤ 3.5 (advanced)
    let (beta_status, beta_signal) = if beta_n > 3.5 {
        ("TROYON_DISRUPTION_RISK", "ᛉ EMERGENCY")
    } else if beta_n > 2.8 {
        ("TROYON_LIMIT_BREACHED", "✗✗ VETO")
    } else if beta_n > 2.0 {
        ("BETA_ELEVATED", "⚠ AMBER")
    } else {
        ("BETA_STABLE", "✓ GREEN")
    };

    // Greenwald density limit: n_G = I_p / (π × a²) in 10²⁰ m⁻³ (I_p in MA)
    let n_greenwald = plasma_current / (pi * minor_radius * minor_radius); // 10²⁰ m⁻³
    let greenwald_fraction = density / n_greenwald;

    let (greenwald_status, greenwald_signal) = if greenwald_fraction > 1.0 {
        ("GREENWALD_DISRUPTION", "ᛉ EMERGENCY")
    } else if greenwald_fraction > 0.85 {
        ("GREENWALD_LIMIT_WARNING", "✗✗ VETO")
    } else if greenwald_fraction > 0.70 {
        ("GREENWALD_ELEVATED", "✗ RED")
    } else if greenwald_fraction > 0.5 {
        ("GREENWALD_NOMINAL", "⚠ AMBER")
    } else {
        ("GREENWALD_CLEAR", "✓ GREEN")
    };

    // ── MODULE 04 · CONFINEMENT AUDIT ─────────────────────────────────────────
    // IPB98(y,2) energy confinement time scaling law
    // ITER Physics Basis 1999: τ_E^98y2 = 0.0562 × I_p^0.93 × B^0.15 × n19^0.41
    //                                     × P^(-0.69) × R^1.97 × ε^0.58 × κ^0.78 × M^0.19
    // n19 = density in 10¹⁹ m⁻³ = density × 10
    // P = total loss power = P_alpha + P_input (MW)
    // M = 2.5 (D-T average ion mass in amu); M^0.19 = 1.190
    let n19 = density * 10.0;
    let p_loss_mw = f64::max(0.1, p_alpha_mw + input_power); // loss power MW
    let m_factor = f64::powf(2.5, 0.19);                     // ≈ 1.190
    let tau_ipb98 = 0.0562
        * f64::powf(plasma_current, 0.93)
        * f64::powf(b_field, 0.15)
        * f64::powf(n19, 0.41)
        * f64::powf(p_loss_mw, -0.69)
        * f64::powf(major_radius, 1.97)
        * f64::powf(epsilon, 0.58)
        * f64::powf(elongation, 0.78)
        * m_factor;

    let h_factor = if tau_ipb98 > 0.0 { tau_e / tau_ipb98 } else { 0.0 };

    // H-factor target: 1.0 (baseline). ITER design requires H ≈ 1.0.
    // H < 0.7 → confinement degraded; H > 1.5 → physically implausible for standard scenarios
    let (confinement_status, confinement_signal) = if h_factor < 0.6 {
        ("CONFINEMENT_COLLAPSE", "✗✗ VETO")
    } else if h_factor < 0.8 {
        ("CONFINEMENT_DEGRADED", "✗ RED")
    } else if h_factor < 1.2 {
        ("CONFINEMENT_NOMINAL", "✓ GREEN")
    } else if h_factor < 1.5 {
        ("CONFINEMENT_ENHANCED", "⚠ AMBER") // enhanced modes (e.g., H-mode, ITB) — verify
    } else {
        ("CONFINEMENT_IMPLAUSIBLE", "✗ RED") // suspect input data
    };

    // ── MODULE 05 · FUEL PURITY & NEUTRON WALL LOADING ────────────────────────
    // Helium ash: accumulation reduces fusion power. Threshold: f_He > 0.10 → fuel crisis.
    let fuel_dilution_pct = f_he * 100.0;
    let (purity_status, purity_signal) = if f_he > 0.20 {
        ("ASH_CATASTROPHE", "✗✗ VETO")    // >20% He: fuel burnout, plasma quench
    } else if f_he > 0.10 {
        ("ASH_ACCUMULATION", "✗ RED")
    } else if f_he > 0.05 {
        ("ASH_ELEVATED", "⚠ AMBER")
    } else {
        ("FUEL_PURE", "✓ GREEN")
    };

    // Neutron wall loading: neutrons carry 14.1/17.6 = 80.1% of DT energy
    let p_neutron_w = p_fusion_w * (14.1 / 17.6);
    let wall_load = p_neutron_w / (a_wall * 1.0e6); // MW/m²
    // Material limits: < 0.5 safe, 0.5–1.0 engineering challenge, > 2.0 material failure
    let (wall_status, wall_signal) = if wall_load > 2.0 {
        ("WALL_MATERIAL_FAILURE", "ᛉ EMERGENCY")
    } else if wall_load > 1.0 {
        ("WALL_STRESS_ZONE", "✗ RED")
    } else if wall_load > 0.5 {
        ("WALL_ENGINEERING_LIMIT", "⚠ AMBER")
    } else {
        ("WALL_WITHIN_SPEC", "✓ GREEN")
    };

    // ── PLASMA SOVEREIGNTY RULING ─────────────────────────────────────────────
    let signals = [
        lawson_signal,
        q_signal,
        beta_signal,
        greenwald_signal,
        confinement_signal,
        purity_signal,
        wall_signal,
    ];
    let emergency_count = signals.iter().filter(|s| s.contains("EMERGENCY")).count();
    let veto_count = signals.iter().filter(|s| s.contains("VETO")).count();
    let red_count = signals.iter().filter(|s| s.contains("RED")).count();
    let amber_count = signals.iter().filter(|s| s.contains("AMBER")).count();

    let (ruling_code, ruling) = if emergency_count > 0 {
        (
            "PLASMA_QUENCH_ORDER",
            "Immediate shutdown order. Disruption threshold breached. \
             The plasma does not negotiate. Greenwald or Troyon limit exceeded — \
             the confinement topology has failed.",
        )
    } else if veto_count > 0 {
        (
            "IGNITION_REJECTED",
            "Hard refusal. Critical limit breached. The energy debt cannot \
             be resolved within the operating envelope. Redesign required.",
        )
    } else if red_count > 0 {
        (
            "OPERATING_POINT_DEFERRED",
            "Confinement or power balance in deficit. Identify the bottleneck \
             and revise the operating point. The Lawson criterion does not defer \
             to project timelines.",
        )
    } else if q_factor >= 10.0 && amber_count == 0 {
        (
            "IGNITION_NOMINAL",
            "All five modules within operating envelope. Q ≥ 10 achieved. \
             The plasma is sovereign. Alpha self-heating sustains the reaction.",
        )
    } else if q_factor >= 1.0 {
        (
            "SCIENTIFIC_BREAKEVEN_ACHIEVED",
            "Scientific breakeven confirmed. Q ≥ 1. \
             External heating power matched by fusion yield. \
             Engineering breakeven requires further optimisation.",
        )
    } else {
        (
            "PLASMA_GAIN_REGISTERED",
            "Fusion power exceeds 10% of input. Positive gain regime. \
             Q < 1 — the machine consumes more than it produces. \
             The audit is open.",
        )
    };

    format!(
        "ᛟ FUSION PLASMA KERNEL v1.0.0 // BOOT_OK\n\
         OFFICE OF PLASMA SOVEREIGNTY · LAWSON AUDIT BUREAU\n\
         \n\
         ── MODULE 01 · LAWSON TRIPLE PRODUCT ──────────────────────\n\
         n×T×τ_E: {:.3e} keV·s/m³   (ignition: 5.0×10²¹)\n\
         n_e: {:.3e} m⁻³  T: {:.1} keV  τ_E: {:.2} s\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 02 · FUSION POWER & Q-FACTOR ────────────────────\n\
         <σv>_DT: {:.3e} m³/s  (Bosch-Hale 1992)\n\
         V_plasma: {:.0} m³  P_fusion: {:.1} MW\n\
         P_alpha: {:.1} MW  P_brem: {:.2} MW  P_net: {:.1} MW\n\
         Q = P_fusion / P_ext = {:.1} / {:.1} = {:.2}\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 03 · PLASMA STABILITY LEDGER ────────────────────\n\
         β_t: {:.2}%  β_N: {:.2} %·m·T/MA  (Troyon limit: 2.8 / 3.5)\n\
         STATUS: {}  [{}]\n\
         n_Greenwald: {:.3} ×10²⁰ m⁻³  f_G: {:.2}  (limit: 1.0)\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 04 · CONFINEMENT AUDIT (IPB98·y·2) ──────────────\n\
         τ_E_actual: {:.2} s   τ_E_IPB98: {:.2} s\n\
         H-factor: {:.3}  (nominal: 1.0 | ITER design: ≥ 1.0)\n\
         P_loss: {:.1} MW  ε = a/R: {:.3}  κ: {:.1}\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 05 · FUEL PURITY & WALL LOADING ─────────────────\n\
         Z_eff: {:.3}  He-4 ash: {:.1}%  (crisis threshold: 10%)\n\
         FUEL STATUS: {}  [{}]\n\
         Neutron wall loading: {:.3} MW/m²  A_wall: {:.0} m²\n\
         WALL STATUS: {}  [{}]\n\
         \n\
         ── PLASMA SOVEREIGNTY RULING ───────────────────────────────\n\
         {}\n\
         OPERATING STATUS: [{}]\n\
         \n\
         SOURCE: content/rust_kernels/src/kernels/fusion_plasma.rs",
        // M01
        triple_product, n_e, temp_kev, tau_e,
        lawson_status, lawson_signal,
        // M02
        sv, v_plasma, p_fusion_mw,
        p_alpha_mw, p_brem_mw, p_net_mw,
        p_fusion_mw, input_power, q_factor,
        q_status, q_signal,
        // M03
        beta_t_pct, beta_n,
        beta_status, beta_signal,
        n_greenwald, greenwald_fraction,
        greenwald_status, greenwald_signal,
        // M04
        tau_e, tau_ipb98, h_factor,
        p_loss_mw, epsilon, elongation,
        confinement_status, confinement_signal,
        // M05
        z_eff, fuel_dilution_pct,
        purity_status, purity_signal,
        wall_load, a_wall,
        wall_status, wall_signal,
        // RULING
        ruling, ruling_code,
    )
}
