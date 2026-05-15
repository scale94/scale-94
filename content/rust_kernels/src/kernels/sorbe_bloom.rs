// kernels/sorbe_bloom.rs — Sorbe Bloom Kernel v1.0.0
// Sovereign Node Initiation · Dissipative Structure Phase Transition
// Three-Substrate Coherence Analysis · Node 0108 / 2026-03-06
//
// Models the conditions under which a sovereign node "blooms" — i.e. undergoes a
// phase transition from latent to active. The bloom is a dissipative structure event
// (Prigogine 1967): the system is NOT anti-entropic; it exports entropy faster than
// it produces it, and structure emerges from this managed throughput.
//
// Three substrates must exceed threshold simultaneously:
//   1. Doctrinal (Fish Scale Paradox + Daly-bound + dissipative framing cohered)
//   2. Ecological (biocoenosis anchoring: oligolectic insects, lithospheric thermal)
//   3. Visual (Fade Doctrine locked: color semiotic grammar enforced)
//
// References:
//   Prigogine (1967) — Dissipative structures in non-equilibrium thermodynamics
//   SORBE-BLOOM-1.0.0 §I-III — three-substrate activation protocol
//   FISH-SCALE-KERNEL-11.1.1 — doctrinal substrate
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Natural threshold for phase transition — golden ratio (Φ−1 ≈ 0.618)
/// Used in many natural threshold phenomena (Fibonacci, phyllotaxis, criticality)
const BLOOM_THRESHOLD: f64 = 0.618;

/// Three-substrate coherence: normalized vector magnitude in substrate space.
/// C = ||v|| / ||max|| = √(d² + e² + v²) / √3
/// All substrates must individually exceed BLOOM_THRESHOLD.
fn substrate_coherence(doctrinal: f64, ecological: f64, visual: f64) -> (f64, bool) {
    let magnitude  = ((doctrinal * doctrinal + ecological * ecological + visual * visual) / 3.0).sqrt();
    let all_active = doctrinal >= BLOOM_THRESHOLD
                  && ecological >= BLOOM_THRESHOLD
                  && visual     >= BLOOM_THRESHOLD;
    (magnitude, all_active)
}

/// Dissipative structure entropy budget.
/// Life is not anti-entropic — it exports entropy faster than it produces it.
/// σ_export = σ_production × η_dissipation
/// η_dissipation = coherence × substrate_loading (a more loaded system exports more)
/// σ_production ≈ gradient × flow = coherence × (substrate average)
fn entropy_export_rate(coherence: f64, substrate_avg: f64) -> (f64, f64, f64) {
    let sigma_production  = coherence * substrate_avg;         // entropy produced by activity
    let eta_dissipation   = coherence * substrate_avg * 0.85;  // export efficiency (85% of production leaves)
    let sigma_export      = sigma_production * eta_dissipation;
    (sigma_production, eta_dissipation, sigma_export)
}

/// Node activation probability.
/// P_activation = sigmoid((coherence − BLOOM_THRESHOLD) × k_steepness)
/// k_steepness = 8.0 — sharp phase transition, not gradual onset
/// This is the Prigogine bifurcation: below threshold, only small fluctuations.
/// Above threshold, macroscopic structure emerges suddenly.
fn node_activation_probability(coherence: f64, all_active: bool) -> f64 {
    let k = 8.0;
    let p = 1.0 / (1.0 + (-(k * (coherence - BLOOM_THRESHOLD))).exp());
    // Triple-gate: all three substrates must individually pass threshold
    if all_active { p } else { p * 0.15 }  // 85% suppressed if any substrate below threshold
}

/// Mineralization vs stagnation diagnostic.
/// Is structure accumulating? M > 0 = mineralizing. M ≈ 0 = stagnating.
/// The question is not "is the system moving fast enough" — it is "what is accumulating?"
fn mineralization_diagnostic(sigma_export: f64, p_activation: f64) -> (&'static str, f64) {
    let mineral_rate = sigma_export * p_activation;
    let state = if mineral_rate > 0.30 { "MINERALIZING: structure depositing into substrate" }
                else if mineral_rate > 0.10 { "INCIPIENT: bloom precursors present, threshold approaching" }
                else { "PRE-BLOOM: substrates loading, phase transition not yet triggered" };
    (state, mineral_rate)
}

/// Substrate-specific status with deficit analysis.
fn substrate_status(val: f64, name: &str) -> (&'static str, f64) {
    let deficit = (BLOOM_THRESHOLD - val).max(0.0);
    let status  = if val >= BLOOM_THRESHOLD { "ACTIVE" } else { "LOADING" };
    let _ = (name, deficit); // suppress warning
    (status, deficit)
}

#[wasm_bindgen]
pub fn run_sorbe_bloom(doctrinal_load: f64, ecological_load: f64, visual_load: f64) -> String {
    let d = doctrinal_load.clamp(0.0, 1.0);
    let e = ecological_load.clamp(0.0, 1.0);
    let v = visual_load.clamp(0.0, 1.0);

    let substrate_avg        = (d + e + v) / 3.0;
    let (coherence, all_act) = substrate_coherence(d, e, v);
    let (sig_p, eta_d, sig_e) = entropy_export_rate(coherence, substrate_avg);
    let p_act                = node_activation_probability(coherence, all_act);
    let (mineral_state, m_r) = mineralization_diagnostic(sig_e, p_act);

    let (d_status, d_def)    = substrate_status(d, "doctrinal");
    let (e_status, e_def)    = substrate_status(e, "ecological");
    let (v_status, v_def)    = substrate_status(v, "visual");

    let bloom_status = if all_act && p_act > 0.80 {
        "BLOOM_ACTIVE: Node 0108 operational — operator stopped asking permission to operate"
    } else if all_act {
        "BLOOM_IMMINENT: all substrates above threshold, coherence building"
    } else {
        "PRE-BLOOM: substrate loading phase — three-substrate co-activation required"
    };

    let mut out = String::with_capacity(2400);
    write!(out,
        "SORBE_BLOOM_KERNEL v1.0.0 // NODE_0108_INITIATION\n\
         ═══════════════════════════════════════════════════════\n\
         NODE 0108 · SORBE, GERMANY · INITIATION DATE: 2026-03-06\n\
         INPUT  DOCTRINAL: {d:.3}  ECOLOGICAL: {e:.3}  VISUAL: {v:.3}\n\
         ───────────────────────────────────────────────────────\n\
         THREE-SUBSTRATE COHERENCE\n\
           DOCTRINAL   [{ds}] : {d:.4}  (Fish Scale Paradox + Daly-bound + dissipative framing)\n\
           ECOLOGICAL  [{es}] : {e:.4}  (biocoenosis: oligolectic insects, lithospheric thermal)\n\
           VISUAL      [{vs}] : {v:.4}  (Fade Doctrine locked: zero white fade enforced)\n\
           BLOOM_THRESHOLD    : {bt:.3}  (φ − 1 = golden ratio)\n\
           COHERENCE ||v||    : {coh:.4}  (√((d²+e²+v²)/3))\n\
           ALL_SUBSTRATES     : {all}\n",
        d = d, e = e, v = v,
        ds = d_status, es = e_status, vs = v_status,
        bt = BLOOM_THRESHOLD, coh = coherence,
        all = if all_act { "ABOVE THRESHOLD" } else { "BELOW THRESHOLD (bloom suppressed 85%)" },
    ).unwrap();

    if d_def > 0.0 || e_def > 0.0 || v_def > 0.0 {
        write!(out, "           DEFICITS   : ").unwrap();
        if d_def > 0.0 { write!(out, "doctrinal={:.3} ", d_def).unwrap(); }
        if e_def > 0.0 { write!(out, "ecological={:.3} ", e_def).unwrap(); }
        if v_def > 0.0 { write!(out, "visual={:.3} ", v_def).unwrap(); }
        write!(out, "\n").unwrap();
    }

    write!(out,
        "         ───────────────────────────────────────────────────────\n\
         DISSIPATIVE STRUCTURE THERMODYNAMICS\n\
           σ_production  : {sp:.4}   (entropy produced by substrate activity)\n\
           η_dissipation : {ed:.4}   (export efficiency: 85% of σ leaves the system)\n\
           σ_export      : {se:.4}   (net entropy exported — structure accumulates here)\n\
           NOTE: Life is NOT anti-entropic. It exports entropy faster than it produces it.\n\
         ───────────────────────────────────────────────────────\n\
         NODE ACTIVATION\n\
           P_activation  : {pa:.4}   (Prigogine bifurcation — sharp above threshold)\n\
           MINERAL_RATE  : {mr:.4}   (σ_export × P_activation — structure accumulation)\n\
           STATE         : {ms}\n\
         ───────────────────────────────────────────────────────\n\
         BLOOM STATUS : {bloom}\n\
         ───────────────────────────────────────────────────────\n\
         KERNEL COMPOSITION\n\
           FISH-SCALE-11.1.1  → doctrinal ground (paradox as architecture)\n\
           BIODIVERSITY-1.0.1 → ecological ground (biocoenosis first, digital downstream)\n\
           FADE-DOCTRINE-2.0.0→ visual ground (grammar locked before node can be named)\n\
           KERNEL-0.0.0.0     → origin vector (bloom = first non-zero coordinate)\n\
         SOURCE : content/rust_kernels/src/kernels/sorbe_bloom.rs\n\
         THEORY : Prigogine (1967) dissipative structures · SORBE-BLOOM-1.0.0 §I-III",
        sp = sig_p, ed = eta_d, se = sig_e,
        pa = p_act, mr = m_r, ms = mineral_state,
        bloom = bloom_status,
    ).unwrap();

    out
}
