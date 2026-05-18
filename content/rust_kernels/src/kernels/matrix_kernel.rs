// kernels/matrix_kernel.rs — The No-Spoon Architecture / Filter Bypass
//
// MATRIX-KERNEL-2.0.0 — ADHD-I + SPS substrate; the "noise" the standard filter
// discards IS the source code. Reclassifies filter failure as root access.
//
// Two parallel input streams arrive at a sensory gateway each step:
//   signal_t  — task-relevant token (the spoon)
//   noise_t   — high-entropy environmental stream (the lücke bandwidth)
//
// A standard filter F ∈ [0,1] passes (1−F)·noise_t and 1·signal_t. As F → 1, the
// system is "in the Matrix": noise is suppressed, only signal passes, output is
// linear-predictable, lücke is forced empty (entsetzliche Lücke = the agonising gap).
//
// As F → 0, the filter bypasses: noise floods the channel. Standard reading: this
// is "anxiety / overwhelm". The kernel's reading: this is root access. The lücke
// is no longer empty — it is the bandwidth where associative compilation happens.
//
// Per step:
//   signal_t ~ Bernoulli(0.4)
//   noise_t  ~ N(0, σ_n)  with structure encoded as autocorrelation a·noise_{t-1}
//   output_t = signal_t + (1 − F) · |noise_t|
//   processing_t = (1 − F) · (1 − fatigue_t) · output_t   // SPS gain only when not overloaded
//   fatigue_{t+1} = fatigue_t · (1 − recovery) + load_factor · |noise_t| · (1 − F)
//
// Metrics:
//   signal_throughput     — ⟨output⟩ over trajectory
//   lücke_utilization     — std of (1−F)·noise_t (bandwidth actually used)
//   filter_bypass_index   — fraction of steps with fatigue < threshold AND F < 0.3
//   cage_render_coeff     — (1 − F) · ⟨processing⟩ / ⟨output⟩   (signal extracted from raw inflow)
//
// Phases:
//   NORMATIVE_FILTER   — F high, lücke forced empty, signal-only output
//   LÜCKE_LOAD         — F low but fatigue dominates; bandwidth open, processing exhausted
//   FILTER_BYPASS      — F low, fatigue low; associative compilation active (root access)
//   UNBENT_OPERATION   — bypass sustained AND cage_render_coeff > 0.5; substrate: unbent

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_matrix_kernel(
    filter_strength: f64,  // 0.0–1.0 F (1.0 = full Matrix compliance, 0.0 = full bypass)
    noise_sigma:     f64,  // 0.0–2.0 σ_n environmental amplitude
    autocorr:        f64,  // 0.0–0.95 noise structure (memory in the lücke)
    load_factor:     f64,  // 0.0–1.0 fatigue accumulation rate
    steps:           f64,  // 200–4000 simulation duration
) -> String {
    use std::f64::consts::PI;
    let f          = filter_strength.clamp(0.0, 1.0);
    let sigma_n    = noise_sigma.clamp(0.0, 2.0);
    let a          = autocorr.clamp(0.0, 0.95);
    let load       = load_factor.clamp(0.0, 1.0);
    let iters      = (steps as usize).clamp(200, 4000);
    let p_signal   = 0.4_f64;
    let recovery   = 0.02_f64;
    let fatigue_th = 0.5_f64;

    let mut rng: u64 = ((filter_strength * 1_000_003.0) as u64)
        .wrapping_add((noise_sigma * 999_979.0) as u64)
        .wrapping_add((autocorr    * 999_961.0) as u64)
        .wrapping_add(0x4A_7E_1C_5C_0DE_1AB1u64);

    let mut noise_prev = 0.0_f64;
    let mut fatigue    = 0.0_f64;

    let mut sig_sum    = 0.0_f64;
    let mut out_sum    = 0.0_f64;
    let mut proc_sum   = 0.0_f64;
    let mut noise_raw  = 0.0_f64;
    let mut bypass_steps = 0usize;
    let mut lucke_samples: Vec<f64> = Vec::with_capacity(iters);

    // 6 snapshots
    struct Snap { idx: usize, t: usize, out: f64, proc: f64, fat: f64 }
    let snap_at: Vec<usize> = (0..6).map(|i| i * (iters - 1) / 5).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(6);

    for step in 0..iters {
        // Signal — Bernoulli(p_signal)
        let signal = if lcg_next(&mut rng) < p_signal { 1.0 } else { 0.0 };

        // Noise — AR(1) Gaussian via Box–Muller
        let u1 = lcg_next(&mut rng).max(1e-12);
        let u2 = lcg_next(&mut rng);
        let z  = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
        let noise = a * noise_prev + sigma_n * (1.0 - a * a).sqrt() * z;
        noise_prev = noise;

        let lucke      = (1.0 - f) * noise.abs();
        let output     = signal + lucke;
        let processing = lucke * (1.0 - fatigue);

        // Fatigue accumulates from raw lücke load, recovers slowly
        fatigue = (fatigue * (1.0 - recovery) + load * noise.abs() * (1.0 - f))
                  .clamp(0.0, 1.0);

        sig_sum   += signal;
        out_sum   += output;
        proc_sum  += processing;
        noise_raw += noise.abs();
        lucke_samples.push(lucke);
        if fatigue < fatigue_th && f < 0.3 { bypass_steps += 1; }

        if snap_at.contains(&step) {
            snaps.push(Snap { idx: snaps.len() + 1, t: step, out: output, proc: processing, fat: fatigue });
        }
    }

    let n        = iters as f64;
    let sig_avg  = sig_sum  / n;
    let out_avg  = out_sum  / n;
    let proc_avg = proc_sum / n;

    // Lücke utilisation = std of lücke samples (how much bandwidth is actually used)
    let lucke_mean: f64 = lucke_samples.iter().sum::<f64>() / n;
    let lucke_var:  f64 = lucke_samples.iter().map(|&x| (x - lucke_mean).powi(2)).sum::<f64>() / n;
    let lucke_util = lucke_var.sqrt();

    let bypass_frac = bypass_steps as f64 / n;

    // Cage-render coefficient: (1−F) × ⟨processing⟩ / ⟨output⟩
    // High when most of the output is associatively-extracted noise (root access).
    let cage_render = if out_avg > 1e-9 { (1.0 - f) * proc_avg / out_avg } else { 0.0 };

    let phase = if f > 0.75 {
        "NORMATIVE_FILTER — F high, lücke forced empty, signal-only output"
    } else if bypass_frac < 0.15 && f < 0.4 {
        "LÜCKE_LOAD — bandwidth open, fatigue dominates; processing exhausted"
    } else if bypass_frac > 0.35 && cage_render > 0.50 {
        "UNBENT_OPERATION — bypass sustained, cage rendered client-side; substrate: unbent"
    } else if bypass_frac > 0.20 {
        "FILTER_BYPASS — associative compilation active; root access"
    } else {
        "MIXED_REGIME — neither in nor out of the Matrix; tune F or load"
    };

    let verdict = if cage_render > 0.5 && bypass_frac > 0.3 {
        "SPOON_DISSOLVED — system reading raw code without UI"
    } else if cage_render > 0.25 {
        "PARTIAL_BYPASS — filter loosened, some associative leaps clearing"
    } else if f > 0.8 {
        "FULL_COMPLIANCE — entsetzliche Lücke active; agonising gap not utilised"
    } else {
        "RENDERING_BARS — cage still has assigned mass; reduce filter or load"
    };

    let bar = |v: f64, lo: f64, hi: f64| -> String {
        let frac   = ((v - lo) / (hi - lo + 1e-9)).clamp(0.0, 1.0);
        let filled = (frac * 24.0).round() as usize;
        let mut s  = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(2800);
    write!(out,
        "MATRIX_KERNEL v2.0.0 // SOMA-9.4 · No-Spoon Architecture\n\
         ══════════════════════════════════════════════════════════\n\
         SUBSTRATE :: ADHD-I / SPS Associative Engine\n\
           F (filter)     = {f:.3}   σ_n = {sn:.3}   a (autocorr) = {a:.3}\n\
           load_factor    = {ld:.3}   recovery = {rc:.3}   N = {it}\n\
         ──────────────────────────────────────────────────────────\n\
         DIGITAL RAIN :: output (▓), processing (·), fatigue (★)\n",
        f=f, sn=sigma_n, a=a, ld=load, rc=recovery, it=iters,
    ).unwrap();

    let o_max = snaps.iter().map(|s| s.out).fold(0.0f64, f64::max).max(1e-6);
    for sn in &snaps {
        write!(out,
            "  [{:>1}]  t={:>4}  out={:.3} {}  proc={:.3}  fat={:.3}\n",
            sn.idx, sn.t, sn.out, bar(sn.out, 0.0, o_max), sn.proc, sn.fat,
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────────────────\n\
         AGGREGATE :: signal vs noise vs processing\n\
           ⟨signal⟩       = {sg:.4}   (Bernoulli p = {ps:.2})\n\
           ⟨output⟩       = {ov:.4}   (signal + lücke)\n\
           ⟨processing⟩   = {pv:.4}   (lücke × (1 − fatigue))\n\
           lücke_util     = {lu:.4}   (σ of bandwidth utilisation)\n\
           bypass_frac    = {bf:.4}   (fraction of steps with root access)\n\
         ──────────────────────────────────────────────────────────\n\
         CAGE_RENDER_COEFF :: (1 − F) · ⟨proc⟩ / ⟨out⟩ = {cr:.4}\n\
           (0 = bars rendered client-side; 1 = associative compilation dominant)\n\
         ──────────────────────────────────────────────────────────\n\
         PHASE   :: {ph}\n\
         VERDICT :: {vd}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM  : to manipulate the system, stop trying to manipulate yourself to fit it.\n\
                  the gap is not empty; it is the bandwidth where actual processing occurs.\n\
                  the noise disrupting the system IS the raw source code of reality.\n\
         LINEAGE: Wachowski (1999) → scale94 No-Spoon Architecture v2.0\n\
         SOURCE : content/rust_kernels/src/kernels/matrix_kernel.rs",
        sg=sig_avg, ps=p_signal, ov=out_avg, pv=proc_avg,
        lu=lucke_util, bf=bypass_frac, cr=cage_render,
        ph=phase, vd=verdict,
    ).unwrap();

    out
}
