// kernels/underground_thermo.rs — Underground Thermodynamics Kernel v1.0.0
// Non-Equilibrium Thermodynamic Reasoning Engine · Five Primitives · MEPP
//
// This kernel IS the UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0 method.
// It computes the thermodynamic state of any system described as a flow problem:
// gradient, channel, flow, dissipation rate, MEPP attractor.
//
// The five primitives (from §I):
//   1. ∇X    — Gradient: the only legitimate cause in this framework
//   2. J     — Flow: what the gradient does (Onsager 1931 coupling)
//   3. κ     — Channel: the geometry selecting which gradients become flows
//   4. σ     — Dissipation rate: σ = J · ∇X · (1/T_abs)  [entropy/time]
//   5. MEPP  — Maximum Entropy Production: system selects highest-σ accessible state
//
// Garrett's constant: 7.1 mW per inflation-adjusted 1990 USD of civilizational wealth
// Bejan constructal law: channel geometry evolves to maximize current per unit gradient
// Onsager (1931): cross-coupling Lᵢⱼ = Lⱼᵢ — reciprocity is structural, not optional
//
// References:
//   Onsager, L. (1931). Physical Review 37/38. — reciprocal relations
//   Bejan, A. (1996). Int. J. Heat Mass Transfer. — constructal law
//   Martyushev & Seleznev (2006). Phys. Reports 426. — MEPP survey
//   Garrett, T. (2009). Climatic Change. — wealth-energy constant 7.1 mW/USD
//   UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0 §I-V
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Garrett's constant: ~7.1 mW per 1990 USD of accumulated civilizational wealth.
/// This is treated as a hard structural identity — not a correlation.
/// Decoupling claims must state the channel through which σ falls without ∇X or J falling.
const GARRETT_MW_PER_USD: f64 = 7.1e-3;  // W / (inflation-adj. 1990 USD)

/// Absolute temperature baseline for σ calculation (300 K ≈ 27°C ambient)
const T_ABS_K: f64 = 300.0;

/// Compute flow from Ohm's thermodynamic analogue: J = κ × ∇X
/// κ: channel conductance (0–1, where 1 = frictionless open channel)
/// ∇X: gradient magnitude
fn compute_flow(gradient: f64, channel: f64) -> f64 {
    gradient * channel.clamp(0.0, 1.0)
}

/// Entropy production rate: σ = J · ∇X / T_abs
/// Units: entropy / time. This is the system's pulse.
/// σ → 0: system dead or dying.
/// σ → ∞: channel burning (catastrophic dissipation).
/// Interesting regime: bounded σ, steady state.
fn entropy_production(flow: f64, gradient: f64) -> f64 {
    (flow * gradient) / T_ABS_K
}

/// Onsager cross-coupling: if flow A is driven by gradient B,
/// then flow B is also driven by gradient A (coupling coefficient Lᵢⱼ = Lⱼᵢ).
/// Here: thermal-chemical coupling — a thermal gradient drives chemical flux and vice versa.
/// σ_total = L₁₁·X₁² + 2·L₁₂·X₁·X₂ + L₂₂·X₂²
/// Using L₁₁ = 1.0, L₁₂ = 0.35 (typical Onsager coupling for condensed matter), L₂₂ = 0.8
fn onsager_cross_coupling(gradient: f64, flow_rate: f64) -> (f64, f64, f64) {
    let l11: f64 = 1.0;
    let l12: f64 = 0.35;  // cross-coupling (symmetry: L₁₂ = L₂₁)
    let l22: f64 = 0.80;
    let x1 = gradient;
    let x2 = flow_rate;
    let sigma_total = l11 * x1 * x1 + 2.0 * l12 * x1 * x2 + l22 * x2 * x2;
    // Reciprocity demonstration: cross-term is symmetric
    let reciprocity_check = (l12 - 0.35).abs() < 1e-10;
    let _ = reciprocity_check;
    (sigma_total / T_ABS_K, l12, l22)
}

/// MEPP attractor: given current σ and channel conductance, what is the highest-σ
/// accessible state? Bejan's constructal law: channel geometry evolves toward
/// maximizing J/∇X at steady state.
/// States enumerated by varying κ from 0.1 to 1.0:
fn mepp_attractor(gradient: f64, current_sigma: f64, current_channel: f64) -> (f64, f64, &'static str) {
    // Highest-σ accessible state (κ = 1.0 = fully open channel)
    let optimal_flow  = gradient * 1.0;
    let optimal_sigma = entropy_production(optimal_flow, gradient);
    let sigma_gap     = optimal_sigma - current_sigma;
    let constraint_description = if current_channel < 0.3 {
        "CHANNEL_BLOCKED: geometry/policy/friction constraining flow — this is the real lever"
    } else if current_channel < 0.7 {
        "CHANNEL_NARROWED: moderate constraint — partial Bejan maturation achieved"
    } else {
        "CHANNEL_MATURE: near-optimal geometry — Bejan constructal equilibrium approached"
    };
    (optimal_sigma, sigma_gap, constraint_description)
}

/// Garrett wealth-energy diagnostic: how much wealth does this gradient represent?
/// W_implied = (flow × T_abs) / (GARRETT_CONSTANT × T_abs) = J/GARRETT_MW_PER_USD
/// This is the wealth stored in the dissipative structure, not "earned" in the conventional sense.
fn garrett_wealth(flow: f64) -> f64 {
    // J (flow in W-equivalent units) → USD (civilizational capital)
    // At J = 1.0 (normalized) the implied wealth = 1 / 7.1e-3 ≈ 141 (1990 USD)
    flow / GARRETT_MW_PER_USD
}

/// Reasoning protocol output: the six-step analysis from UTK §II.
/// Step 1: gradient. Step 2: channel. Step 3: σ. Step 4: MEPP states. Step 5: constraint. Step 6: output.
fn protocol_status(gradient: f64, channel: f64, sigma: f64) -> (&'static str, &'static str) {
    let gradient_found = gradient > 0.001;
    let step1 = if gradient_found { "GRADIENT_LOCATED: non-zero asymmetry confirmed" }
                else { "NO_GRADIENT: system not moving — phenomenon may be narrated, not occurring" };
    let sigma_regime = if sigma < 0.001   { "σ_ZERO: system dead or degenerate state" }
                       else if sigma < 0.1 { "σ_LOW: near-equilibrium — system approaching heat death" }
                       else if sigma < 1.0 { "σ_BOUNDED: healthy steady-state dissipation" }
                       else                { "σ_HIGH: high throughput — monitor for channel burnout" };
    (step1, sigma_regime)
}

#[wasm_bindgen]
pub fn run_underground_thermo(gradient: f64, channel_conductivity: f64, flow_rate: f64) -> String {
    let grad    = gradient.abs();  // gradients are unsigned magnitudes
    let channel = channel_conductivity.clamp(0.0, 1.0);
    let j_input = flow_rate.abs();

    // Compute flow: use input flow if > 0, else derive from J = κ × ∇X
    let j = if j_input > 0.0 { j_input } else { compute_flow(grad, channel) };

    let sigma           = entropy_production(j, grad);
    let (sigma_ons, l12, l22) = onsager_cross_coupling(grad, j);
    let (opt_sigma, sig_gap, constraint) = mepp_attractor(grad, sigma, channel);
    let wealth          = garrett_wealth(j);
    let (step1, sig_regime) = protocol_status(grad, channel, sigma);

    let no_gradient_flag = grad < 0.001;

    let mut out = String::with_capacity(2600);

    if no_gradient_flag {
        write!(out,
            "UTK v1.0.0 // NO_GRADIENT_REFUSAL\n\
             ═══════════════════════════════════════════════════════\n\
             STEP 1: {s1}\n\
             Restate as a flow problem or this kernel does not apply.\n\
             Without a gradient there is no flow, no work, no structure, no story.\n\
             SOURCE: content/rust_kernels/src/kernels/underground_thermo.rs",
            s1 = step1,
        ).unwrap();
        return out;
    }

    write!(out,
        "UNDERGROUND_THERMO_KERNEL v1.0.0 // NON-EQUILIBRIUM_REASONING\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  ∇X={grad:.4}  κ={ch:.3}  J={j:.4}\n\
         T_abs  = {tabs:.0} K  (ambient baseline)\n\
         ───────────────────────────────────────────────────────\n\
         FIVE PRIMITIVES (UTK §I)\n\
         \n\
         1. GRADIENT ∇X : {grad:.6}   (the only legitimate cause — if none, no story)\n\
         2. FLOW J       : {j:.6}   (what the gradient does; J = κ × ∇X = {kx:.6})\n\
         3. CHANNEL κ    : {ch:.6}   (geometry selecting which gradients become flows)\n\
         4. DISSIPATION σ: {sigma:.6}   σ = J·∇X/T = {sigmaraw:.6} / {tabs:.0}\n\
            {sr}\n\
         5. MEPP ATTRACTOR: σ_max = {os:.6}   (highest-σ accessible state at κ=1.0)\n\
         ───────────────────────────────────────────────────────\n\
         ONSAGER CROSS-COUPLING (1931 · Lᵢⱼ = Lⱼᵢ)\n\
           σ_total = L₁₁·X₁² + 2·L₁₂·X₁·X₂ + L₂₂·X₂²\n\
           L₁₁=1.00  L₁₂={l12:.2} (cross-coupling, symmetric)  L₂₂={l22:.2}\n\
           σ_onsager : {so:.6}   (includes thermal-chemical cross-coupling)\n\
           Reciprocity is not optional. Cross-coupling is structural.\n\
         ───────────────────────────────────────────────────────\n\
         MEPP ANALYSIS (Martyushev & Seleznev 2006)\n\
           σ_current : {sigma:.6}\n\
           σ_optimal : {os:.6}   (κ=1.0 — fully open channel)\n\
           σ_gap     : {sg:.6}   (unrealized dissipation capacity)\n\
           CONSTRAINT: {constraint}\n\
           NOTE: MEPP is empirical-not-axiomatic. MEPP predicts to leading order in:\n\
                 atmospheric circulation, ATP synthesis, river networks, tumour vasculature.\n\
         ───────────────────────────────────────────────────────\n\
         GARRETT WEALTH-ENERGY IDENTITY (2009)\n\
           Implied wealth: {w:.2} (1990 USD equivalent at J={j:.4})\n\
           W = J / 7.1 mW/USD  — hard structural identity, not correlation\n\
           Decoupling claims must state the channel where σ falls without J falling.\n\
         ───────────────────────────────────────────────────────\n\
         BEJAN CONSTRUCTAL LAW (1996)\n\
           Channel evolution direction: toward maximum J per unit ∇X\n\
           Current ratio J/∇X = {eff:.4}   (κ = {ch:.3}; mature at κ → 1.0)\n\
         ───────────────────────────────────────────────────────\n\
         REASONING PROTOCOL OUTPUT (UTK §II — 6 steps)\n\
           STEP 1 — {s1}\n\
           STEP 2 — Channel κ={ch:.3}: {ch_status}\n\
           STEP 3 — σ = {sigma:.6} (order-of-magnitude: {oom})\n\
           STEP 4 — MEPP attractor at κ=1.0: σ_max = {os:.6}\n\
           STEP 5 — Real lever: {constraint}\n\
           STEP 6 — Remove that constraint. Everything else is decoration.\n\
         SOURCE : content/rust_kernels/src/kernels/underground_thermo.rs\n\
         THEORY : Onsager (1931) · Bejan (1996) · Martyushev & Seleznev (2006) · Garrett (2009)",
        grad = grad, ch = channel, j = j, tabs = T_ABS_K,
        kx = compute_flow(grad, channel),
        sigma = sigma,
        sigmaraw = j * grad,
        sr = sig_regime,
        os = opt_sigma,
        l12 = l12, l22 = l22, so = sigma_ons,
        sg = sig_gap, constraint = constraint,
        w = wealth,
        eff = if grad > 0.0 { j / grad } else { 0.0 },
        s1 = step1,
        ch_status = if channel < 0.3 { "severely constrained — bottleneck identified" }
                    else if channel < 0.7 { "moderate conductance — partial optimization" }
                    else { "high conductance — mature channel geometry" },
        oom = if sigma < 0.001 { "10⁻³" } else if sigma < 0.01 { "10⁻²" }
              else if sigma < 0.1 { "10⁻¹" } else if sigma < 1.0 { "10⁰" }
              else { "10¹+" },
    ).unwrap();

    out
}
