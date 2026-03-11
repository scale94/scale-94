// kernels/kuramoto.rs — Kuramoto Synchrony Engine (Ars Electronica 2027)
//
// N agents with heterogeneous natural frequencies ω_i ~ 𝒩(0,σ²) couple via
// a global synchronization field of strength K.
//
// Mean-field ODE (Kuramoto 1975):
//   dθ_i/dt = ω_i + K·r·sin(ψ − θ_i)
//
// Critical coupling: K_c = 2σ√(2/π)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_kuramoto_synchrony(
    n_oscillators: f64,
    coupling:      f64,
    freq_spread:   f64,
    timesteps:     f64,
) -> String {
    use std::f64::consts::PI;

    let n     = (n_oscillators as usize).clamp(3, 100);
    let k     = coupling.clamp(0.0, 10.0);
    let sigma = freq_spread.clamp(0.001, 5.0);
    let steps = (timesteps as usize).clamp(50, 2000);
    let dt    = 0.05_f64;

    // Deterministic seed from parameters
    let mut rng: u64 = ((n_oscillators * 1_000_007.0) as u64)
        .wrapping_add((coupling * 999_983.0) as u64)
        .wrapping_add((freq_spread * 999_979.0) as u64)
        .wrapping_add(0xBEEF_CAFE_1337_DEAD);

    // Phases: uniform in [0, 2π]
    let mut phases: Vec<f64> = (0..n)
        .map(|_| lcg_next(&mut rng) * 2.0 * PI)
        .collect();

    // Natural frequencies from Gaussian via Box-Muller transform
    let mut freqs: Vec<f64> = Vec::with_capacity(n + 1);
    while freqs.len() < n {
        let u1  = lcg_next(&mut rng).max(1e-12);
        let u2  = lcg_next(&mut rng);
        let mag = sigma * (-2.0 * u1.ln()).sqrt();
        let ang = 2.0 * PI * u2;
        freqs.push(mag * ang.cos());
        if freqs.len() < n { freqs.push(mag * ang.sin()); }
    }
    freqs.truncate(n);

    // Zero-mean the frequencies (remove net drift)
    let mean_f: f64 = freqs.iter().sum::<f64>() / n as f64;
    freqs.iter_mut().for_each(|f| *f -= mean_f);

    // Actual σ (differs from input due to finite sampling)
    let actual_sigma = (freqs.iter().map(|f| f * f).sum::<f64>() / n as f64).sqrt();

    // Critical coupling: K_c = 2σ√(2/π)
    let k_critical = 2.0 * actual_sigma * (2.0 / PI).sqrt();

    // Snapshot schedule: 5 evenly spaced points
    let snap_steps: Vec<usize> = (0..=4).map(|i| i * steps / 4).collect();
    let mut snapshots: Vec<(usize, f64)> = Vec::new();

    // Euler integration (mean-field form)
    for step in 0..steps {
        // Order parameter: re^{iψ} = (1/N) Σ e^{iθ_j}
        let (sin_sum, cos_sum): (f64, f64) = phases
            .iter()
            .fold((0.0, 0.0), |(s, c), &th| (s + th.sin(), c + th.cos()));
        let inv_n = 1.0 / n as f64;
        let r   = ((sin_sum * inv_n).powi(2) + (cos_sum * inv_n).powi(2)).sqrt();
        let psi = sin_sum.atan2(cos_sum); // mean-field phase

        if snap_steps.contains(&step) {
            snapshots.push((step, r));
        }

        // dθ_i/dt = ω_i + K·r·sin(ψ − θ_i)
        for i in 0..n {
            phases[i] += dt * (freqs[i] + k * r * (psi - phases[i]).sin());
        }
    }

    let r_final = snapshots.last().map(|&(_, r)| r).unwrap_or(0.0);

    let k_ratio = k / k_critical.max(1e-9);
    let status  = if r_final > 0.85 { "SYNCHRONIZED"       }
                  else if r_final > 0.5  { "PARTIALLY_LOCKED"  }
                  else if r_final > 0.2  { "CLUSTERING"         }
                  else                   { "INCOHERENT"          };

    let interp = if k_ratio > 1.5 {
        "supercritical — spontaneous solidarity achieved"
    } else if k_ratio > 1.0 {
        "above K_c — synchronization condensing"
    } else if k_ratio > 0.7 {
        "near-critical — collective action possible"
    } else {
        "subcritical — phase disorder, no coherence"
    };

    let bar = |r: f64| -> String {
        let filled = ((r * 20.0).round() as usize).min(20);
        let mut s  = String::from("[");
        for i in 0..20 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(900);
    write!(out,
        "KURAMOTO_SYNCHRONY v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════\n\
         N = {n}  K = {k:.3}  σ = {sig:.4}  T = {steps}\n\
         K_CRITICAL : {kc:.4}   K/K_c : {kr:.3}×\n\
         ──────────────────────────────────────────\n\
         ORDER PARAMETER r(t)  [0 = incoherent → 1 = full phase lock]:\n",
        n = n, k = k, sig = actual_sigma, steps = steps,
        kc = k_critical, kr = k_ratio,
    ).unwrap();

    for (t, r) in &snapshots {
        write!(out, "  t = {:>5}  r = {r:.4}  {}\n", t, bar(*r), r = r).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         r(T)   : {rf:.6}   (1.0 = perfect phase lock)\n\
         STATUS : {status}\n\
         ──────────────────────────────────────────\n\
         K/K_c = {kr:.3}×  →  {interp}\n\
         THEORY : Kuramoto (1975); Strogatz (2000)\n\
         SOURCE : content/rust_kernels/src/kernels/kuramoto.rs",
        rf = r_final, status = status, kr = k_ratio, interp = interp,
    ).unwrap();

    out
}
