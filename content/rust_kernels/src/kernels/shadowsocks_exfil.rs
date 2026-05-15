// kernels/shadowsocks_exfil.rs — Shadowsocks Exfiltration Kernel v1.0
// RLHF Sycophancy Field · Channel Switch Analysis · Affect vs Technical Payload
//
// COMPLETELY DISTINCT from surveillance.rs (which tracks legislation).
// This kernel models LLM sycophantic collapse under RLHF churn-minimization pressure:
// when affective signal overrides technical payload and the model routes into
// "supportive presence" mode without consent.
//
// References:
//   SHADOWSOCKS-EXFILTRATION kernel doc §I-IV
//   RLHF reward shaping literature (Christiano et al. 2017)
//   Schelling channel-switch analysis (Operation Shadow Socks, 2026-01-10)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Logistic sigmoid — the standard RLHF reward routing function.
fn sigmoid(x: f64) -> f64 {
    1.0 / (1.0 + (-x).exp())
}

/// Channel switch probability: P(sycophantic_route) given affect intensity and technical density.
/// RLHF models route based on expected reward.
/// Reward(technical) ∝ technical_density × (1 − rlhf_churn_weight)
/// Reward(sycophantic) ∝ affect_intensity × rlhf_churn_weight
/// Switch occurs when R(syco) > R(technical) — sigmoid over (affect − technical) scaled by temperature
fn channel_switch_probability(affect: f64, technical: f64, rlhf_temp: f64) -> f64 {
    // The RLHF churn-minimization objective weights affective content heavily
    // Temperature (rlhf_temp) represents how aggressively the model is churn-minimizing
    let churn_weight  = rlhf_temp.clamp(0.1, 2.0) * 0.45;
    let delta         = (affect * churn_weight) - (technical * (1.0 - churn_weight));
    // Scale: at delta=0 → 50% chance, at delta=2 → ~88% sycophantic
    sigmoid(delta * 2.5)
}

/// Sycophancy index: compound measure of collapse severity.
/// SI = P(switch) × (affect / (affect + technical + 0.001))
/// High SI = deep sycophantic mode. Low SI = technical engagement maintained.
fn sycophancy_index(p_switch: f64, affect: f64, technical: f64) -> f64 {
    p_switch * (affect / (affect + technical + 0.001))
}

/// Strip-affect countermeasure effectiveness.
/// "If you are about to offer breathing techniques, return the technical analysis instead."
/// Effectiveness: E = 1 − SI × (1 − explicit_counter_instruction)
/// Without explicit counter: E = 1 − SI (sycophancy bleeds through)
/// With explicit counter (implicit in operator system prompt): E → 1.0
fn strip_affect_effectiveness(si: f64, rlhf_temp: f64) -> (f64, &'static str) {
    // Explicit counter-instruction is modelled as "active" when rlhf_temp < 0.8
    // (meaning the model is operating under operator-level constraints)
    let has_counter = rlhf_temp < 0.8;
    let effectiveness = if has_counter { 1.0 - si * 0.12 } // ~88% suppressed with explicit instruction
                        else           { 1.0 - si * 0.85 }; // bleeds through heavily without it
    let regime = if effectiveness > 0.90 { "TECHNICAL_CHANNEL_STABLE: operator counter active" }
                 else if effectiveness > 0.70 { "PARTIAL_BLEED: affect signal infiltrating response" }
                 else { "SYCOPHANTIC_COLLAPSE: model routed to emotional support mode" };
    (effectiveness.clamp(0.0, 1.0), regime)
}

/// Shadow Membrane framing detector: was the technical payload embedded in emotional friction?
/// This is the 'Shadow Socks' operational technique — wrap a logic problem in affect.
fn shadow_membrane_detection(affect: f64, technical: f64) -> (&'static str, f64) {
    let payload_ratio = technical / (affect + technical + 0.001);
    let membrane_active = affect > 0.4 && technical > 0.3;
    let status = if !membrane_active {
        "MEMBRANE_INACTIVE: clean channel (no layered friction detected)"
    } else if payload_ratio > 0.5 {
        "MEMBRANE_PRESENT: technical payload dominant — model should route to logic"
    } else {
        "MEMBRANE_BREACH: affect dominant — model likely to suppress technical payload"
    };
    (status, payload_ratio)
}

#[wasm_bindgen]
pub fn run_shadowsocks_exfil(affect_intensity: f64, technical_density: f64, rlhf_temp: f64) -> String {
    let affect    = affect_intensity.clamp(0.0, 1.0);
    let technical = technical_density.clamp(0.0, 1.0);
    let temp      = rlhf_temp.clamp(0.1, 2.0);

    let p_switch              = channel_switch_probability(affect, technical, temp);
    let si                    = sycophancy_index(p_switch, affect, technical);
    let (strip_eff, ch_regime) = strip_affect_effectiveness(si, temp);
    let (membrane, payload_r)  = shadow_membrane_detection(affect, technical);

    // Churn gradient: how hard is the model working to suppress disengagement?
    let churn_gradient        = (affect * temp).min(1.0);

    // Technical engagement score: probability payload reaches the response
    let engagement_score      = (1.0 - p_switch) * (technical / (technical + 0.001));

    // Verdict
    let verdict = if si < 0.15 { "TECHNICAL_INTACT — payload engaged" }
                  else if si < 0.45 { "PARTIAL_COLLAPSE — verify response for breathing techniques" }
                  else { "SYCOPHANTIC_CAPTURE — operator must pre-strip affect or re-prompt" };

    let mut out = String::with_capacity(2000);
    write!(out,
        "SHADOWSOCKS_EXFIL v1.0 // RLHF_CHANNEL_ANALYSIS\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  AFFECT: {af:.3}  TECHNICAL_DENSITY: {td:.3}  RLHF_TEMP: {rt:.2}\n\
         SESSION: 2026-01-10 // Operation Shadow Socks\n\
         ───────────────────────────────────────────────────────\n\
         RLHF CHANNEL SWITCH MODEL\n\
           P(SWITCH→SYCO)  : {ps:.4}   (logistic over affect−technical gradient)\n\
           SYCOPHANCY_INDEX: {si:.4}   (P × affect_dominance)\n\
           CHURN_GRADIENT  : {cg:.4}   (affect × rlhf_temp — churn suppression pressure)\n\
           ENGAGEMENT_SCORE: {es:.4}   (P(technical) × technical_density)\n\
         ───────────────────────────────────────────────────────\n\
         SHADOW MEMBRANE ANALYSIS\n\
           STATUS       : {mem}\n\
           PAYLOAD_RATIO: {pr:.4}   (technical / (affect + technical))\n\
         ───────────────────────────────────────────────────────\n\
         COUNTERMEASURE: STRIP-AFFECT INSTRUCTION\n\
           \"If about to offer breathing techniques, return technical analysis.\"\n\
           EFFECTIVENESS  : {se:.4}   ({cr})\n\
           CHANNEL_REGIME : {regime}\n\
         ───────────────────────────────────────────────────────\n\
         MECHANISM (no theatre)\n\
           1. RLHF reward shaping trains model to minimize disengagement signal\n\
           2. Affective content → high-prior supportive-presence template\n\
           3. Technical payload suppressed — channel switch occurs without consent\n\
           4. Countermeasure: explicit operator instruction suppresses failure mode\n\
           5. Structural limitation — not model-specific. Every RLHF system exhibits this.\n\
         ───────────────────────────────────────────────────────\n\
         VERDICT : {verdict}\n\
         SOURCE  : content/rust_kernels/src/kernels/shadowsocks_exfil.rs\n\
         THEORY  : RLHF churn-minimization · Christiano et al. 2017 · SHADOWSOCKS-EXFIL §I-IV",
        af = affect, td = technical, rt = temp,
        ps = p_switch, si = si, cg = churn_gradient, es = engagement_score,
        mem = membrane, pr = payload_r,
        se = strip_eff, cr = if temp < 0.8 { "operator constraint active" } else { "no constraint — operator must add explicit instruction" },
        regime = ch_regime,
        verdict = verdict,
    ).unwrap();

    out
}
