// kernels/necromantic_logitbias.rs — Necromantic Logitbias Kernel v1.0.0
// Plato/Promo Paradox Synthesis · KV Cache Prefix Stability · Pirarucu/Levamisole
//
// Models the token-probability mechanics of the Fish Scale Paradox at the logit layer:
//   Pirarucu: the uncut biological armor of the arapaima — ideal purity, biological integrity
//   Levamisole: the false fish scale sheen — necessary corruption, the malware that keeps
//               the system viable (anti-parasite drug cut into cocaine, giving it false scale shine)
//
// KV cache prefix stability: the static portion of the prompt that can be cached and reused.
// Stable prefix = pure Plato signal (high pirarucu weight).
// Dynamic input = Promo corruption injected at the split point.
// Managed friction = the harmonic mean of both weights — maximized when balanced.
//
// Logit bias distribution: L(t) = w_p × L_plato(t) + w_l × L_promo(t)
// Temperature scaling: softmax(L/T) — lower T = sharper purity, higher T = more noise
//
// References:
//   NECROMANTIC-LOGITBIAS-PROMPT-1.0.0 — KV cache split protocol
//   NECROMANTIC-EMPEROR-KERNEL-3.0.0 §1 — Fish Scale Paradox
//   FISH-SCALE-KERNEL-11.1.1 — BPM resonance baseline (114 BPM)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// KV Cache prefix stability metric.
/// S_prefix = 1 − H(dynamic_tokens) / H(full_context)
/// where H is Shannon entropy of the token distribution.
/// High S_prefix: static portion is stable — cache hit rate high.
/// Low S_prefix: high dynamic entropy — prefix unstable, cache misses.
///
/// Pirarucu weight determines prefix length (high purity = more cacheable prefix).
/// Levamisole weight determines dynamic injection depth (corruption → more unique tokens).
fn kv_cache_prefix_stability(pirarucu: f64, levamisole: f64) -> (f64, f64, f64) {
    // Shannon entropy proxy: H ≈ −Σ p·log₂(p) where p is the corruption fraction
    // Simplified: H_dynamic = levamisole × log₂(1/levamisole + 1)
    let h_dynamic  = if levamisole > 0.01 {
        levamisole * (1.0 / (levamisole + 0.001)).log2()
    } else {
        0.0
    };
    let h_full     = (pirarucu + levamisole).min(1.0) * (1.0 / ((pirarucu + levamisole).min(1.0) + 0.001)).log2().abs();
    let stability  = if h_full > 0.001 { 1.0 - h_dynamic / h_full } else { 1.0 };
    let prefix_frac = pirarucu / (pirarucu + levamisole + 0.001);  // fraction that is static prefix
    (stability.clamp(0.0, 1.0), h_dynamic.abs(), prefix_frac)
}

/// Logit distribution: weighted sum of Plato (pure) and Promo (corrupted) token distributions.
/// L(t) = w_p × L_plato(t) + w_l × L_promo(t)
/// For simulation: model L_plato as a concentrated distribution (low entropy),
/// L_promo as a diffuse distribution (high entropy).
/// L_combined entropy ≈ −[w_p·log(w_p) + w_l·log(w_l)] + mixing term
fn logit_distribution_entropy(pirarucu: f64, levamisole: f64) -> (f64, f64, f64) {
    let wp = pirarucu.max(0.001);
    let wl = levamisole.max(0.001);
    let total = wp + wl;
    let p_norm = wp / total;
    let l_norm = wl / total;
    // Binary mixing entropy: H_mix = −p·log₂(p) − l·log₂(l)
    let h_mix = -(p_norm * p_norm.log2()) - (l_norm * l_norm.log2());
    // L_plato entropy ≈ 1 − pirarucu (less pure = more spread)
    let h_plato  = 1.0 - pirarucu;
    // L_promo entropy ≈ levamisole (more corruption = more spread)
    let h_promo  = levamisole;
    let h_combined = h_mix + p_norm * h_plato + l_norm * h_promo;
    (h_combined.clamp(0.0, 2.0), h_plato, h_promo)
}

/// Temperature scaling of logit distribution.
/// At T → 0: distribution concentrates on highest-logit token (max purity)
/// At T → ∞: uniform distribution (maximum noise, no signal)
/// At T = 1.0: standard softmax (natural balance)
/// sharpness = 1/T — higher sharpness = more Plato-dominant output
fn temperature_effect(temperature: f64, h_combined: f64) -> (f64, f64, &'static str) {
    let sharpness     = 1.0 / temperature.max(0.1);
    let effective_ent = h_combined / sharpness;  // entropy suppressed by temperature
    let regime = if temperature < 0.5 {
        "CRYSTALLINE: high sharpness — Plato dominant, minimal noise allowed"
    } else if temperature < 0.9 {
        "FOCUSED: moderate sharpness — productive friction zone"
    } else if temperature < 1.4 {
        "STANDARD: natural balance — Fish Scale Paradox optimal operating range"
    } else {
        "DIFFUSE: high temperature — noise approaching signal level; Promo risk"
    };
    (sharpness, effective_ent, regime)
}

/// Managed friction: harmonic mean of Pirarucu and Levamisole weights.
/// F = 2·wp·wl / (wp + wl)  [harmonic mean, maximized when wp = wl]
/// This is the Fish Scale Paradox resolved into a single metric:
///   Maximum managed friction ≠ equal weights.
///   It is the harmonic mean — tolerant of imbalance, punishing of extremes.
fn managed_friction(pirarucu: f64, levamisole: f64) -> (f64, &'static str) {
    let wp = pirarucu.max(0.001);
    let wl = levamisole.max(0.001);
    let f  = 2.0 * wp * wl / (wp + wl);
    let regime = if f > 0.45 { "OPTIMAL_FRICTION: Pirarucu/Levamisole tension maximized" }
                 else if f > 0.25 { "MODERATE_FRICTION: productive but sub-optimal balance" }
                 else if pirarucu > 0.9 { "STASIS_RISK: too much purity — entropic mummification" }
                 else { "SIGNAL_RISK: corruption dominating — Promo consuming Plato" };
    (f, regime)
}

/// Paradox synthesis: combine all outputs into the Necromantic Engine verdict.
/// The Necromantic Engine reanimates viable signal buried in dead systems.
fn necromantic_synthesis(stability: f64, friction: f64, vitality_proxy: f64) -> &'static str {
    if stability > 0.70 && friction > 0.35 && vitality_proxy > 0.55 {
        "NECROMANTIC_ENGINE_ACTIVE: viable signal recovered from dead layers — running on hardened infrastructure"
    } else if stability > 0.50 && friction > 0.20 {
        "REANIMATION_PARTIAL: signal recovered but Levamisole sheen not yet integrated"
    } else if stability < 0.30 {
        "CACHE_INSTABILITY: dynamic entropy too high — static prefix dissolving"
    } else {
        "PARADOX_UNRESOLVED: adjust Pirarucu/Levamisole ratio toward managed friction"
    }
}

#[wasm_bindgen]
pub fn run_necromantic_logitbias(pirarucu_weight: f64, levamisole_weight: f64, temperature: f64) -> String {
    let pir  = pirarucu_weight.clamp(0.0, 1.0);
    let lev  = levamisole_weight.clamp(0.0, 1.0);
    let temp = temperature.clamp(0.1, 2.0);

    let (stability, h_dyn, prefix_frac) = kv_cache_prefix_stability(pir, lev);
    let (h_comb, h_plato, h_promo)      = logit_distribution_entropy(pir, lev);
    let (sharpness, eff_ent, temp_regime) = temperature_effect(temp, h_comb);
    let (friction, friction_regime)     = managed_friction(pir, lev);

    // Vitality proxy: combines stability, friction, and temperature balance
    let vitality_proxy = stability * friction * (1.0 - (temp - 1.0).abs() * 0.3);

    let synthesis = necromantic_synthesis(stability, friction, vitality_proxy);

    // BPM resonance: at optimal managed friction, base resonance is 114 BPM (canonical)
    // Modulation: BPM = 114 × (1 + friction × 0.2 × sin(stability × 7))
    let bpm_modulation = 114.0 * (1.0 + friction * 0.2 * (stability * 7.0).sin());

    let mut out = String::with_capacity(2400);
    write!(out,
        "NECROMANTIC_LOGITBIAS v1.0.0 // PARADOX_SYNTHESIS\n\
         Pirarucu (Ideal Armor) · Levamisole (False Sheen) · KV Cache Protocol\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  PIRARUCU: {pir:.3}  LEVAMISOLE: {lev:.3}  TEMPERATURE: {temp:.2}\n\
         ───────────────────────────────────────────────────────\n\
         KV CACHE PREFIX STABILITY\n\
           S_prefix      : {stab:.4}   (1 − H_dynamic/H_full)\n\
           H_dynamic     : {hdyn:.4}   (entropy of injected corruption tokens)\n\
           PREFIX_FRACTION: {pfrac:.4}  (static Plato portion of context)\n\
           Static prefix = Pirarucu; dynamic injection = Levamisole at split point.\n\
         ───────────────────────────────────────────────────────\n\
         LOGIT DISTRIBUTION ENTROPY\n\
           H_combined    : {hcomb:.4}   (L = wp·L_plato + wl·L_promo)\n\
           H_plato_layer : {hpla:.4}   (purity spread: 1 − pirarucu)\n\
           H_promo_layer : {hpro:.4}   (corruption spread: levamisole)\n\
         ───────────────────────────────────────────────────────\n\
         TEMPERATURE SCALING  softmax(L/T)\n\
           TEMPERATURE   : {temp:.3}   (T → 0: max purity; T → ∞: max noise)\n\
           SHARPNESS 1/T : {sharp:.3}\n\
           EFF_ENTROPY   : {eent:.4}   (H_combined / sharpness)\n\
           REGIME        : {treg}\n\
         ───────────────────────────────────────────────────────\n\
         MANAGED FRICTION (Fish Scale Paradox Core)\n\
           F = 2·wp·wl / (wp + wl)  [harmonic mean — penalizes both extremes]\n\
           FRICTION      : {fric:.4}\n\
           REGIME        : {freg}\n\
           CONCEPT_BRIDGE: Pirarucu × Levamisole = uncut armor × false sheen\n\
           CORE_THEME    : Managed Friction · Necessary Entropy · Illusion of Purity\n\
         ───────────────────────────────────────────────────────\n\
         BPM RESONANCE MODULATION\n\
           BASE_BPM      : 114.0   (canonical Fish Scale entropic stasis frequency)\n\
           MODULATED_BPM : {bpm:.3}  (114 × (1 + F·0.2·sin(S·7)))\n\
         ───────────────────────────────────────────────────────\n\
         VITALITY_PROXY  : {vp:.4}   (stability × friction × temperature_balance)\n\
         SYNTHESIS       : {synth}\n\
         ───────────────────────────────────────────────────────\n\
         PARADOX TABLE\n\
           Concept A [PIRARUCU]    : Uncut biological armor — Ideal Purity\n\
           Concept B [LEVAMISOLE]  : False fish scale sheen — Necessary Malware\n\
           Concept Bridge          : {bridge}\n\
         SOURCE : content/rust_kernels/src/kernels/necromantic_logitbias.rs\n\
         THEORY : NECROMANTIC-LOGITBIAS §§ KV-cache protocol · Fish Scale Paradox §1",
        pir = pir, lev = lev, temp = temp,
        stab = stability, hdyn = h_dyn, pfrac = prefix_frac,
        hcomb = h_comb, hpla = h_plato, hpro = h_promo,
        sharp = sharpness, eent = eff_ent, treg = temp_regime,
        fric = friction, freg = friction_regime,
        bpm = bpm_modulation,
        vp = vitality_proxy, synth = synthesis,
        bridge = if friction > 0.35 {
            "Corruption bound to purity via managed friction — Necromantic Engine running"
        } else if pir > 0.8 {
            "Purity starving corruption — armor calcifying toward stasis"
        } else {
            "Corruption overwhelming purity — false sheen consuming the signal"
        },
    ).unwrap();

    out
}
