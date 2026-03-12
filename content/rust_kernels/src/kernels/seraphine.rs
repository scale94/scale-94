// kernels/seraphine.rs — Seraphine Associative Reasoning Gain (SARG)
//
// Quantum cognitive model of associative reasoning. Concepts are basis vectors
// in an n-dimensional Hilbert space H^n. The joint reasoning state is a density
// matrix ρ ∈ L(H^n). Associative links are encoded as off-diagonal coherences.
//
// Decoherence model (Lindblad 1976):
//   ρ_ij(t) = ρ_ij(0) · exp(−γ·t)   for i ≠ j
//   ρ_ii(t) = 1/n                     (trace conserved, diagonal dephasing only)
//
// For the uniform-coherence density matrix (all off-diagonals = c/n):
//   eigenvalues:  λ₊ = (1 + (n−1)·c) / n   (×1, coherent superposition mode)
//                 λ₋ = (1 − c) / n           (×n−1, decoherent subspace)
//   l1-coherence: C_l1(ρ) = Σ_{i≠j} |ρ_ij| = (n−1)·|c|
//   von Neumann:  S(ρ)    = −λ₊·ln λ₊ − (n−1)·λ₋·ln λ₋
//
// Seraphine Gain (SARG):
//   Δ(t)    = (S_max − S(ρ(t))) / S_max    — quantum purity advantage over classical
//   SARG(t) = C_l1(t) · (1 + λ_e · Δ(t))  — entanglement-boosted coherence score
//
// Theory:
//   Baumgratz, Cramer & Plenio (2014) — Quantifying Coherence, PRL 113, 140401
//   Lindblad (1976) — Completely positive dynamical semigroups, Commun. Math. Phys. 48
//   Zurek (2003) — Decoherence, einselection, quantum origins of classical, RMP 75
//   Busemeyer & Bruza (2012) — Quantum Models of Cognition and Decision, CUP

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

const CONCEPT_LABELS: [&str; 6] = ["α", "β", "γ", "δ", "ε", "ζ"];

#[inline]
fn entropy_term(lambda: f64) -> f64 {
    if lambda <= 1e-15 { 0.0 } else { -lambda * lambda.ln() }
}

/// Von Neumann entropy for the uniform-coherence density matrix.
/// S(ρ) = −λ₊·ln λ₊ − (n−1)·λ₋·ln λ₋
fn von_neumann(n: f64, c: f64) -> f64 {
    let lp = (1.0 + (n - 1.0) * c) / n;
    let lm = (1.0 - c) / n;
    entropy_term(lp) + (n - 1.0) * entropy_term(lm)
}

/// l1-norm coherence: Σ_{i≠j} |ρ_ij| = (n−1)|c|
#[inline]
fn coherence_l1(n: f64, c: f64) -> f64 {
    (n - 1.0) * c.abs()
}

/// Purity: Tr(ρ²) = λ₊² + (n−1)·λ₋²
fn purity(n: f64, c: f64) -> f64 {
    let lp = (1.0 + (n - 1.0) * c) / n;
    let lm = (1.0 - c) / n;
    lp * lp + (n - 1.0) * lm * lm
}

#[wasm_bindgen]
pub fn run_seraphine_sarg(
    n_concepts:       f64,  // hilbert space dimension (2–6)
    coherence:        f64,  // c₀: initial off-diagonal coherence [0, 1)
    decoherence_rate: f64,  // γ: lindblad dephasing rate per step [0, 2]
    entanglement:     f64,  // λ_e: inter-concept entanglement boost [0, 1]
    steps:            f64,  // time evolution steps (5–50)
) -> String {
    let n   = (n_concepts as usize).clamp(2, 6) as f64;
    let c0  = coherence.clamp(0.0, 1.0 - 1e-9);
    let gam = decoherence_rate.clamp(0.0, 2.0);
    let lam = entanglement.clamp(0.0, 1.0);
    let nst = (steps as usize).clamp(5, 50);
    let ni  = n as usize;

    let s_max = n.ln();  // maximally mixed state entropy = ln(n)

    let lp0 = (1.0 + (n - 1.0) * c0) / n;
    let lm0 = (1.0 - c0) / n;
    let s0  = von_neumann(n, c0);
    let p0  = purity(n, c0);

    let mut out = String::with_capacity(4000);

    // ── header ──────────────────────────────────────────────────────────────
    write!(out,
        "seraphine_sarg v1.0 // soma-9.1\n\
         ══════════════════════════════════════════════════════\n\
         quantum associative reasoning gain — seraphine kernel\n\
         ══════════════════════════════════════════════════════\n\
         parameters:\n\
           n_concepts       = {ni}   (hilbert space dim H^{ni})\n\
           coherence   c₀   = {c0:.4}  (initial off-diagonal strength)\n\
           decoherence γ    = {gam:.4}  (lindblad dephasing rate / step)\n\
           entanglement λ_e = {lam:.4}  (inter-concept entanglement)\n\
           steps            = {nst}\n\
         ──────────────────────────────────────────────────────\n\
         basis: {{",
        ni = ni, c0 = c0, gam = gam, lam = lam, nst = nst,
    ).unwrap();
    for i in 0..ni {
        if i > 0 { out.push_str(", "); }
        out.push_str(CONCEPT_LABELS[i]);
    }
    out.push_str("}\n");

    // ── initial density matrix ρ(t=0) ──────────────────────────────────────
    out.push_str("\nρ(t=0) — uniform-coherence density matrix:\n");
    for row in 0..ni {
        out.push_str("  [");
        for col in 0..ni {
            let val = if row == col { 1.0 / n } else { c0 / n };
            if col > 0 { out.push_str("  "); }
            write!(out, "{:.4}", val).unwrap();
        }
        out.push_str("]\n");
    }

    write!(out,
        "\neigenvalues:\n\
           λ₊ = {lp:.6}  (×1  — coherent superposition mode)\n\
           λ₋ = {lm:.6}  (×{nm} — decoherent subspace)\n\
         von neumann entropy  S(ρ₀) = {s0:.6}  [S_max = ln {ni} = {smax:.6}]\n\
         purity               Tr(ρ²) = {p0:.6}  [1.0=pure  1/n={inv_n:.4}=mixed]\n\
         l1-norm coherence    C_l1   = {cl0:.6}\n\
         ──────────────────────────────────────────────────────\n\
         lindblad time evolution: ρ_ij(t) = c₀·exp(−γ·t)/n  (i≠j)\n\
         sarg(t) = C_l1(t) · (1 + λ_e · (S_max − S(t)) / S_max)\n\
         ──────────────────────────────────────────────────────\n\
          t    c(t)    C_l1    S(ρ)    Δ_adv   SARG    regime\n\
         ──────────────────────────────────────────────────────\n",
        lp   = lp0,
        lm   = lm0,
        nm   = ni - 1,
        s0   = s0,
        smax = s_max,
        p0   = p0,
        inv_n = 1.0 / n,
        cl0  = coherence_l1(n, c0),
        ni   = ni,
    ).unwrap();

    // ── time evolution ───────────────────────────────────────────────────────
    let mut peak_sarg    = 0.0_f64;
    let mut peak_t       = 0_usize;
    let mut decohere_t: Option<usize> = None;
    let mut window_end   = 0_usize;
    let sarg_floor       = coherence_l1(n, c0) * 0.05; // 5% of initial

    for t in 0..=nst {
        let tf  = t as f64;
        let ct  = c0 * (-gam * tf).exp();
        let cl1 = coherence_l1(n, ct);
        let s   = von_neumann(n, ct);
        let adv = if s_max > 1e-15 { (s_max - s) / s_max } else { 0.0 };
        let sg  = cl1 * (1.0 + lam * adv);

        if sg > peak_sarg { peak_sarg = sg; peak_t = t; }
        if sg > sarg_floor { window_end = t; }
        if decohere_t.is_none() && ct < c0 * 0.5 { decohere_t = Some(t); }

        let regime = if ct > 0.7 * c0       { "coherent"  }
                     else if ct > 0.3 * c0   { "degrading" }
                     else if sg > sarg_floor  { "residual"  }
                     else                     { "classical" };

        write!(out,
            "  {:>2}  {:.4}  {:.4}  {:.4}  {:.4}  {:.4}  {}\n",
            t, ct, cl1, s, adv, sg, regime,
        ).unwrap();
    }

    // ── analysis ─────────────────────────────────────────────────────────────
    let half_life  = if gam > 1e-10 { core::f64::consts::LN_2 / gam } else { f64::INFINITY };
    let t_opt_anal = if gam > 1e-10 { 1.0 / gam } else { nst as f64 };

    // coherence-decay integral — total SARG accumulated over full run
    // ∫₀^T C_l1(t)dt = (n-1)·c₀ · (1 − e^{−γT}) / γ
    let total_sarg_integral = if gam > 1e-10 {
        coherence_l1(n, c0) * (1.0 - (-gam * nst as f64).exp()) / gam
    } else {
        coherence_l1(n, c0) * nst as f64
    };

    // quantum advantage at peak
    let c_peak = c0 * (-gam * peak_t as f64).exp();
    let s_peak = von_neumann(n, c_peak);
    let adv_peak = if s_max > 1e-15 { (s_max - s_peak) / s_max } else { 0.0 };
    let ent_boost = 1.0 + lam * adv_peak;

    write!(out,
        "──────────────────────────────────────────────────────\n\
         sarg analysis:\n\
           peak sarg             : {peak:.4}  at t = {pt}\n\
           reasoning window      : t ∈ [0, {we}]  ({wlen} step(s) above 5% floor)\n\
           decoherence half-life : {hl}\n\
           analytical t_opt      : {topt:.2}  (= 1/γ)\n\
           total sarg integral   : {integral:.4}  (area under C_l1 curve)\n\
         ──────────────────────────────────────────────────────\n\
         quantum advantage:\n\
           C_l1 at t=0           : {cl0:.4}  (classical baseline = 0)\n\
           Δ_advantage at peak   : {advp:.4}  ({advpct:.1}% purity recovered)\n\
           entanglement boost    : ×{boost:.4}\n\
           purity at t=0         : {p0:.4}  →  1/n = {inv_n:.4} at t=∞\n\
         ──────────────────────────────────────────────────────\n\
         theory:\n\
           baumgratz, cramer & plenio (2014) — quantifying coherence, PRL 113\n\
           lindblad (1976) — completely positive dynamical semigroups\n\
           zurek (2003) — decoherence, einselection, quantum origins\n\
           busemeyer & bruza (2012) — quantum models of cognition, CUP\n\
         source: content/rust_kernels/src/kernels/seraphine.rs",
        peak     = peak_sarg,
        pt       = peak_t,
        we       = window_end,
        wlen     = window_end + 1,
        hl       = if half_life.is_finite() { format!("{:.4} steps", half_life) } else { "∞  (no decoherence)".to_string() },
        topt     = t_opt_anal,
        integral = total_sarg_integral,
        cl0      = coherence_l1(n, c0),
        advp     = adv_peak,
        advpct   = adv_peak * 100.0,
        boost    = ent_boost,
        p0       = purity(n, c0),
        inv_n    = 1.0 / n,
    ).unwrap();

    out
}
