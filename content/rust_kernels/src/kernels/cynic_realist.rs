// kernels/cynic_realist.rs — Cynic Realist Dissipative Adaptation Engine
//
// Stochastic Kuramoto-England hybrid:
//   dθ_i/dt = ω_i  +  K·r·sin(ψ − θ_i)  +  √(2T·dt)·η_i(t)
//
// Order parameter: r·e^{iψ} = (1/N) Σ e^{iθ_j}
// Free energy:     F = ⟨E⟩ − T·S  where ⟨E⟩ = −K·r·⟨cos(ψ − θ)⟩
// Dissipation:     σ = K²·r²·N / T  (England 2013: organised systems dissipate MORE)
// Phase transition:
//   K_c = 2·σ_freq·√(2/π)   (Kuramoto 1975; critical coupling)
//   T_c = σ_freq²·π / (2K)  (critical temperature; below = biological regime)
//
// Greenwald density cap: N_max = ⌊0.8·√K·20⌋ — prevents associative overload;
//   if N > N_max, inject trace impurities (randomise 2 agent phases) each 50 steps.
//
// England (2013); Kuramoto (1975); Sloterdijk (1983); Roederer (2016)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_cynic_realist(
    n_agents:    f64,  // 4–64 cognitive subsystems
    temperature: f64,  // 0.05–5.0 evolutionary temperature
    coupling:    f64,  // 0.0–20.0 interaction coupling K
    steps:       f64,  // 50–1500 Euler time steps (dt = 0.05)
) -> String {
    use std::f64::consts::PI;

    let n     = (n_agents as usize).clamp(4, 64);
    let t     = temperature.clamp(0.05, 5.0);
    let k     = coupling.clamp(0.0, 20.0);
    let iters = (steps as usize).clamp(50, 1500);
    let dt    = 0.05_f64;

    // Greenwald density cap
    let n_greenwald   = ((0.8 * k.max(1.0).sqrt() * 20.0) as usize).max(4);
    let over_greenwald = n > n_greenwald;

    // Deterministic seed from parameters
    let mut rng: u64 = ((n_agents * 1_000_003.0) as u64)
        .wrapping_add((temperature * 999_979.0) as u64)
        .wrapping_add((coupling    * 999_983.0) as u64)
        .wrapping_add(0xCAFE_DEAD_1337_BEEF);

    // Initial phases: uniform in [0, 2π]
    let mut phases: Vec<f64> = (0..n).map(|_| lcg_next(&mut rng) * 2.0 * PI).collect();

    // Natural frequencies ω_i ~ N(0, 1) via Box-Muller
    let mut freqs: Vec<f64> = Vec::with_capacity(n + 1);
    while freqs.len() < n {
        let u1  = lcg_next(&mut rng).max(1e-12);
        let u2  = lcg_next(&mut rng);
        let mag = (-2.0 * u1.ln()).sqrt();
        let ang = 2.0 * PI * u2;
        freqs.push(mag * ang.cos());
        if freqs.len() < n { freqs.push(mag * ang.sin()); }
    }
    freqs.truncate(n);
    let mean_f: f64 = freqs.iter().sum::<f64>() / n as f64;
    freqs.iter_mut().for_each(|f| *f -= mean_f);

    // σ_freq: actual std-dev of natural frequencies
    let sigma_freq = (freqs.iter().map(|f| f * f).sum::<f64>() / n as f64).sqrt();
    let k_critical = 2.0 * sigma_freq * (2.0 / PI).sqrt();
    let t_critical = sigma_freq * sigma_freq * PI / (2.0 * k.max(1e-9));

    // Entropy of phase distribution via 16-bin histogram
    let phase_entropy = |ph: &[f64]| -> f64 {
        const BINS: usize = 16;
        let mut counts = [0u32; BINS];
        for &th in ph {
            let b = ((th.rem_euclid(2.0 * PI) / (2.0 * PI) * BINS as f64) as usize).min(BINS - 1);
            counts[b] += 1;
        }
        let inv_n = 1.0 / ph.len() as f64;
        counts.iter().filter(|&&c| c > 0)
            .map(|&c| { let p = c as f64 * inv_n; -p * p.ln() })
            .sum()
    };

    // Record 5 snapshots at evenly spaced steps
    struct Snap { step: usize, r: f64, s: f64, dissip: f64, free_e: f64 }
    let snap_steps: Vec<usize> = (0..=4).map(|i| i * (iters - 1) / 4).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(5);
    let mut impurity_injections: u32 = 0;

    for step in 0..iters {
        // Order parameter: re^{iψ} = (1/N) Σ e^{iθ_j}
        let (ss, cs) = phases.iter().fold((0.0f64, 0.0f64), |(s, c), &th| (s + th.sin(), c + th.cos()));
        let inv_n = 1.0 / n as f64;
        let r   = ((ss * inv_n).powi(2) + (cs * inv_n).powi(2)).sqrt();
        let psi = ss.atan2(cs);

        if snap_steps.contains(&step) {
            let s       = phase_entropy(&phases);
            let mean_e  = phases.iter().map(|&th| -k * r * (psi - th).cos()).sum::<f64>() * inv_n;
            let dissip  = k * k * r * r * n as f64 / t;
            let free_e  = mean_e - t * s;
            snaps.push(Snap { step, r, s, dissip, free_e });
        }

        // Greenwald: inject trace impurities if N exceeds cap
        if over_greenwald && step > 0 && step % 50 == 0 {
            impurity_injections += 1;
            let i1 = (lcg_next(&mut rng) * n as f64) as usize % n;
            let i2 = (lcg_next(&mut rng) * n as f64) as usize % n;
            phases[i1] = lcg_next(&mut rng) * 2.0 * PI;
            phases[i2] = lcg_next(&mut rng) * 2.0 * PI;
        }

        // Euler step: dθ_i = (ω_i + K·r·sin(ψ−θ_i))·dt + √(2T·dt)·η_i
        let noise_scale = (2.0 * t * dt).sqrt();
        for i in 0..n {
            let u1    = lcg_next(&mut rng).max(1e-12);
            let u2    = lcg_next(&mut rng);
            let noise = noise_scale * (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
            phases[i] += dt * (freqs[i] + k * r * (psi - phases[i]).sin()) + noise;
        }
    }

    let r_final      = snaps.last().map(|s| s.r).unwrap_or(0.0);
    let s_initial    = snaps.first().map(|s| s.s).unwrap_or(0.0);
    let s_final      = snaps.last().map(|s| s.s).unwrap_or(0.0);
    let diss_initial = snaps.first().map(|s| s.dissip).unwrap_or(0.0);
    let diss_final   = snaps.last().map(|s| s.dissip).unwrap_or(0.0);
    let f_final      = snaps.last().map(|s| s.free_e).unwrap_or(0.0);

    let status = if r_final > 0.85      { "DISSIPATIVELY_ADAPTED" }
                 else if r_final > 0.5  { "CONDENSING"            }
                 else if r_final > 0.2  { "PROTO-COHERENT"         }
                 else                   { "ENTROPIC"               };

    let k_ratio = k / k_critical.max(1e-9);
    let phase_regime = if t < t_critical * 0.5 {
        "BIOLOGICAL  — sharing degrees of freedom is thermodynamically favoured"
    } else if t < t_critical {
        "TRANSITIONAL — near critical temperature T_c"
    } else {
        "PHYSICAL    — subsystems remain independent; entropy dominates"
    };

    let england_verdict = if diss_final > diss_initial && r_final > 0.3 {
        "CONFIRMED  — dissipation INCREASED as order emerged (England 2013)"
    } else if r_final > 0.5 {
        "MARGINAL   — coupling insufficient to maximise dissipation at this T"
    } else {
        "SUBCRITICAL — K < K_c; order parameter failed to condense"
    };

    let bar = |v: f64, max: f64| -> String {
        let filled = ((v / max.max(1e-9) * 24.0).round() as usize).min(24);
        let mut s = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let r_max    = snaps.iter().map(|s| s.r).fold(0.0f64, f64::max).max(1e-6);
    let diss_max = snaps.iter().map(|s| s.dissip).fold(0.0f64, f64::max).max(1e-6);

    let mut out = String::with_capacity(2400);

    write!(out,
        "CYNIC_REALIST_KERNEL v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════\n\
         N = {n}  T = {t:.3}  K = {k:.3}  steps = {iters}\n\
         K_CRITICAL : {kc:.4}   K/K_c : {kr:.3}×\n\
         T_CRITICAL : {tc:.4}   T/T_c : {tr:.3}×\n\
         GREENWALD CAP : {gw}   EXCEEDED: {gw_ex}   INJECTIONS: {inj}\n\
         ──────────────────────────────────────────\n\
         ORDER PARAMETER r(t)  [England: organised systems dissipate MORE]\n",
        n = n, t = t, k = k, iters = iters,
        kc = k_critical, kr = k_ratio,
        tc = t_critical, tr = t / t_critical.max(1e-9),
        gw = n_greenwald,
        gw_ex = if over_greenwald { "YES" } else { "no" },
        inj = impurity_injections,
    ).unwrap();

    for sn in &snaps {
        write!(out, "  t = {:>5}  r = {:.4}  {}\n", sn.step, sn.r, bar(sn.r, r_max)).unwrap();
    }

    write!(out, "──────────────────────────────────────────\n\
                 ENTROPY PRODUCTION σ(t)  [σ = K²·r²·N/T]\n").unwrap();

    for sn in &snaps {
        write!(out, "  t = {:>5}  σ = {:>8.3}  {}\n", sn.step, sn.dissip, bar(sn.dissip, diss_max)).unwrap();
    }

    write!(out, "──────────────────────────────────────────\n\
                 FREE ENERGY  F = ⟨E⟩ − T·S\n").unwrap();

    for sn in &snaps {
        write!(out, "  t = {:>5}  F = {:>8.4}   S = {:.4}\n", sn.step, sn.free_e, sn.s).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         STATUS   : {status}\n\
         r(T)     : {rf:.6}   σ_final : {sf:.3}\n\
         F(T)     : {ff:.4}   ΔS : {ds:+.4}  (S_final − S_initial)\n\
         ──────────────────────────────────────────\n\
         PHASE REGIME : {pr}\n\
         ──────────────────────────────────────────\n\
         ENGLAND : {ev}\n\
         K/K_c   : {kr:.3}×  — price of coherence in this substrate\n\
         ROEDERER: data without a pattern-specific trigger is entropic noise\n\
         SLOTERDIJK: the mask is retained because the cost of removal exceeds utility\n\
         ──────────────────────────────────────────\n\
         THEORY : England (2013); Kuramoto (1975); Sloterdijk (1983); Roederer (2016)\n\
         SOURCE : content/rust_kernels/src/kernels/cynic_realist.rs",
        status = status,
        rf = r_final, sf = diss_final,
        ff = f_final, ds = s_final - s_initial,
        pr = phase_regime,
        ev = england_verdict,
        kr = k_ratio,
    ).unwrap();

    out
}
