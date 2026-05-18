// kernels/i_am_stiller.rs — Ontological Baseline / Decoherence Mitigation
//
// Max Frisch, *Stiller* (1954) — recoded as a forced, damped, stochastic oscillator.
//
// State x(t) ∈ ℝ : distance from the discarded identity (baseline = 0).
// "Ich bin nicht Stiller" is measured as |x(t)| — oscillation amplitude is denial.
// Acceptance is x → 0 (the baseline becomes load-bearing).
//
// Two probes (Bohnenblust legal cadence + Julika emotional cadence) couple to x at
// incommensurate frequencies — no resonance, only beating. The Spanish Brigade
// fracture appears as Gaussian noise (Box-Muller). Damping γ models decoherence
// mitigation: how fast the system relaxes once the probe pressure withdraws.
//
// Langevin equation (Euler–Maruyama integration, dt = 0.05):
//   dx/dt = -γ·x + k·[sin(ω_B·t) + sin(ω_J·t + φ)] + σ·η(t),   η ~ N(0,1)
//
// Notebook I–VII = 7 trajectory snapshots equally spaced in time.
// Calorimetric fracture energy:  E_frac = (1/T) ∫₀ᵀ x² dt
// Glion enclave coordinate:      x_glion = ⟨x⟩ over final 20% of trajectory
// Rolf epilogue scar:             σ_scar  = std(x) over final 20%
// Equilibrium prediction:         ⟨x²⟩_eq = σ² / (2γ)   (Ornstein–Uhlenbeck)
//
// Phase classification:
//   OSCILLATION_PERSISTS    — denial; envelope does not decay
//   ENCLAVE_DRIFT           — Glion equilibrium offset from baseline
//   SCAR_LOCKED             — residual amplitude pinned by probe coupling
//   THERMODYNAMIC_ACCEPTANCE — baseline load-bearing; Ich bin Stiller

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_i_am_stiller(
    probe_coupling: f64,  // 0.0–2.0  dual-probe amplitude k
    damping:        f64,  // 0.01–1.0 decoherence mitigation rate γ
    noise:          f64,  // 0.0–0.5  Spanish Brigade fracture σ
    steps:          f64,  // 100–2000 Langevin iterations / notebook depth
) -> String {
    use std::f64::consts::PI;

    let k     = probe_coupling.clamp(0.0, 2.0);
    let gamma = damping.clamp(0.01, 1.0);
    let sigma = noise.clamp(0.0, 0.5);
    let iters = (steps as usize).clamp(100, 2000);
    let dt    = 0.05_f64;

    // Deterministic seed from parameters
    let mut rng: u64 = ((probe_coupling * 1_000_003.0) as u64)
        .wrapping_add((damping * 999_979.0) as u64)
        .wrapping_add((noise   * 999_961.0) as u64)
        .wrapping_add(0x5711_1ED0_F125_C9D4u64);

    // Probe frequencies — incommensurate (golden-ratio separation)
    // ω_B : Bohnenblust legal cadence (1.0 rad/dt-unit)
    // ω_J : Julika emotional cadence (φ = 1.618...)
    let omega_b = 1.0_f64;
    let omega_j = 1.6180339887_f64;
    let phi_j   = PI * 0.5;  // 90° offset between probes

    // Initial condition: subject just been arrested at the border — max displacement
    let mut x = 1.0_f64;

    // Notebook snapshots — 7 equally-spaced (Notebook I–VII)
    struct Snap { idx: usize, t: f64, x: f64, env: f64 }
    let snap_steps: Vec<usize> = (0..7).map(|i| i * (iters - 1) / 6).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(7);

    // Accumulators
    let mut e_frac       = 0.0_f64;  // calorimetric fracture energy
    let mut probe_work   = 0.0_f64;  // ∫ |F_probe · dx|
    let mut envelope_max = 0.0_f64;  // max |x|

    // Late-window stats for Glion enclave + Rolf scar (final 20%)
    let late_start     = iters * 4 / 5;
    let mut late_sum   = 0.0_f64;
    let mut late_sumsq = 0.0_f64;
    let mut late_n     = 0usize;

    for step in 0..iters {
        let t = step as f64 * dt;

        // Probe forcing (incommensurate beat)
        let f_probe = k * (omega_b * t).sin() + k * (omega_j * t + phi_j).sin();

        // Box–Muller Gaussian noise — Spanish Brigade stochastic fracture
        let u1  = lcg_next(&mut rng).max(1e-12);
        let u2  = lcg_next(&mut rng);
        let eta = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();

        // Euler–Maruyama step
        let dx_det  = dt * (-gamma * x + f_probe);
        let dx_stoc = sigma * dt.sqrt() * eta;
        let dx      = dx_det + dx_stoc;
        let x_new   = x + dx;

        // Snapshot
        if snap_steps.contains(&step) {
            snaps.push(Snap { idx: snaps.len() + 1, t, x, env: x.abs() });
        }

        e_frac     += x * x * dt;
        probe_work += (f_probe * dx).abs();
        if x.abs() > envelope_max { envelope_max = x.abs(); }

        if step >= late_start {
            late_sum   += x_new;
            late_sumsq += x_new * x_new;
            late_n     += 1;
        }

        x = x_new;
    }

    let total_time = iters as f64 * dt;
    e_frac /= total_time;

    // Glion enclave coordinate + Rolf epilogue scar
    let x_glion    = if late_n > 0 { late_sum / late_n as f64 } else { 0.0 };
    let scar_var   = if late_n > 0 {
        (late_sumsq / late_n as f64) - x_glion * x_glion
    } else { 0.0 };
    let sigma_scar = scar_var.max(0.0).sqrt();

    // Ornstein–Uhlenbeck equilibrium prediction (probe-free):
    //   ⟨x²⟩_eq = σ² / (2γ)
    let e_frac_eq  = sigma * sigma / (2.0 * gamma);
    let mitigation = if e_frac > 1e-9 {
        (e_frac_eq / e_frac).clamp(0.0, 1.0)
    } else { 1.0 };

    // Phase classification
    let phase = if envelope_max > 0.8 && sigma_scar > 0.4 {
        "OSCILLATION_PERSISTS — denial; probe continues to excite"
    } else if x_glion.abs() > 0.3 {
        "ENCLAVE_DRIFT — Glion equilibrium offset from baseline"
    } else if sigma_scar > 0.15 {
        "SCAR_LOCKED — residual amplitude pinned by probe coupling"
    } else {
        "THERMODYNAMIC_ACCEPTANCE — baseline load-bearing; Ich bin Stiller"
    };

    let verdict = if x_glion.abs() < 0.1 && sigma_scar < 0.15 {
        "BASELINE_ACCEPTED — interior fracture released as heat"
    } else {
        "ONGOING_DECOHERENCE — calorimetric signature still emitting"
    };

    // ASCII envelope bar
    let bar = |v: f64, lo: f64, hi: f64| -> String {
        let frac   = ((v - lo) / (hi - lo + 1e-9)).clamp(0.0, 1.0);
        let filled = (frac * 24.0).round() as usize;
        let mut s  = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    // Render
    let mut out = String::with_capacity(2800);
    write!(out,
        "I_AM_STILLER v1.0.0 // SOMA-9.4\n\
         ══════════════════════════════════════════════════════════\n\
         BOHNENBLUST + JULIKA :: dual probe\n\
           k = {k:.3}   ω_B = {wb:.3}   ω_J = {wj:.4}   φ_J = π/2\n\
         SPANISH BRIGADE :: stochastic fracture\n\
           σ = {sg:.3}   γ = {gm:.3}   T = {tt:.2}   N = {it}\n\
         ──────────────────────────────────────────────────────────\n\
         NOTEBOOK I–VII :: trajectory snapshots\n",
        k=k, wb=omega_b, wj=omega_j, sg=sigma, gm=gamma, tt=total_time, it=iters,
    ).unwrap();

    let env_max = snaps.iter().map(|s| s.env).fold(0.0f64, f64::max).max(1e-6);
    let romans  = ["I","II","III","IV","V","VI","VII"];
    for sn in &snaps {
        let roman = romans[sn.idx.saturating_sub(1).min(6)];
        write!(out, "  {:>3}  t={:>6.2}  x={:+.4}  {}\n",
            roman, sn.t, sn.x, bar(sn.env, 0.0, env_max)).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────────────────\n\
         CALORIMETRIC FRACTURE ENERGY\n\
           E_frac       = {ef:.6}\n\
           E_frac_eq    = σ²/(2γ) = {efeq:.6}\n\
           mitigation   = E_eq / E_frac = {mit:.4}   (1.0 = full acceptance)\n\
           probe_work   = {pw:.4}\n\
           envelope_max = {em:.4}\n\
         ──────────────────────────────────────────────────────────\n\
         GLION ENCLAVE  :: ⟨x⟩ over final 20%\n\
           x_glion      = {xg:+.6}   (0 = baseline coincidence)\n\
         ROLF EPILOGUE :: σ_x over final 20%\n\
           σ_scar       = {ss:.6}   (residual oscillation amplitude)\n\
         ──────────────────────────────────────────────────────────\n\
         PHASE   :: {ph}\n\
         VERDICT :: {vd}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM  : \"Ich bin nicht Stiller\" is not a defense against the probe —\n\
                  it is the calorimetric signature of interior fracture located.\n\
         LINEAGE: Frisch (1954) → STILLER_DIVERGENCE v1.1.1 → I_AM_STILLER v1.0.0\n\
         SOURCE : content/rust_kernels/src/kernels/i_am_stiller.rs",
        ef=e_frac, efeq=e_frac_eq, mit=mitigation, pw=probe_work, em=envelope_max,
        xg=x_glion, ss=sigma_scar, ph=phase, vd=verdict,
    ).unwrap();

    out
}
