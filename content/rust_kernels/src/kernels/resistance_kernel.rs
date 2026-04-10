// kernels/resistance_kernel.rs — Granovetter Threshold Model of Collective Resistance
//
// N agents each draw threshold from Normal(μ, σ) via Box-Muller.
// Cascade: agent i acts if fraction already acting >= threshold_i.
// V-Cache sync: every v_sync steps, state visible to all agents simultaneously
//   (simulates memory-bandwidth constraint on collective action).
// Schelling equilibria: fixed points of F(x)=x where F=CDF of threshold dist.
// Phase transition: as μ decreases, system crosses from no-cascade → full cascade.
//
// Granovetter (1978) AJS; Schelling (1960); Bikhchandani et al. (1992)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_resistance_kernel(
    n_agents:          f64,  // 50–1000 agents
    threshold_mean:    f64,  // 0.0–1.0 mean threshold
    threshold_sigma:   f64,  // 0.01–0.5 std-dev of thresholds
    v_cache_bandwidth: f64,  // 1–20 sync period (V-Cache: steps between state updates)
    rounds:            f64,  // 20–500 rounds
) -> String {
    use std::f64::consts::PI;
    let n      = (n_agents as usize).clamp(50, 1000);
    let mu     = threshold_mean.clamp(0.0, 1.0);
    let sigma  = threshold_sigma.clamp(0.01, 0.5);
    let v_sync = (v_cache_bandwidth as usize).clamp(1, 20);
    let iters  = (rounds as usize).clamp(20, 500);

    let mut rng: u64 = ((n_agents * 1_000_003.0) as u64)
        .wrapping_add((threshold_mean  * 999_979.0) as u64)
        .wrapping_add((threshold_sigma * 999_983.0) as u64)
        .wrapping_add(0xB00_DEAD_CAFE);

    // Generate thresholds via Box-Muller
    let mut thresholds: Vec<f64> = Vec::with_capacity(n + 1);
    while thresholds.len() < n {
        let u1 = lcg_next(&mut rng).max(1e-12);
        let u2 = lcg_next(&mut rng);
        let z0 = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
        let z1 = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).sin();
        thresholds.push((mu + sigma * z0).clamp(0.0, 1.0));
        if thresholds.len() < n { thresholds.push((mu + sigma * z1).clamp(0.0, 1.0)); }
    }
    thresholds.truncate(n);

    // Simulate cascade with V-Cache sync
    let mut acting = vec![false; n];
    let mut visible_fraction = 0.0_f64; // what agents see (limited by bandwidth)
    let snap_at: Vec<usize> = (0..=4).map(|i| i * iters / 4).collect();
    let mut snapshots: Vec<(usize, f64, usize)> = Vec::new();

    for round in 0..iters {
        // V-Cache: only update visible state every v_sync rounds
        if round % v_sync == 0 {
            visible_fraction = acting.iter().filter(|&&a| a).count() as f64 / n as f64;
        }
        // Each agent decides based on visible fraction
        for i in 0..n {
            if !acting[i] && visible_fraction >= thresholds[i] {
                acting[i] = true;
            }
        }
        if snap_at.contains(&round) {
            let act_count = acting.iter().filter(|&&a| a).count();
            snapshots.push((round, visible_fraction, act_count));
        }
    }

    let final_acting = acting.iter().filter(|&&a| a).count();
    let final_frac   = final_acting as f64 / n as f64;

    // Schelling fixed-point analysis: scan x in [0,1], find where F(x)=x
    // F(x) = fraction of agents with threshold <= x = CDF of normal(mu, sigma) at x
    let erf_approx = |z: f64| -> f64 {
        // Abramowitz & Stegun 7.1.26 approximation
        let a = [0.0705230784_f64, 0.0422820123, 0.0092705272, 0.0001520143, 0.0002765672, 0.0000430638];
        let t = 1.0 / (1.0 + 0.3275911 * z.abs());
        let poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * (a[4] + t * a[5])))));
        let sign = if z >= 0.0 { 1.0 } else { -1.0 };
        sign * (1.0 - poly * (-z * z).exp())
    };
    let normal_cdf = |x: f64| -> f64 {
        let z = (x - mu) / (sigma * 2.0_f64.sqrt()).max(1e-9);
        0.5 * (1.0 + erf_approx(z))
    };

    let mut fixed_points: Vec<f64> = Vec::new();
    let steps = 100usize;
    for i in 0..steps {
        let x = i as f64 / steps as f64;
        let fx = normal_cdf(x);
        if (fx - x).abs() < 0.025 { fixed_points.push(x); }
    }
    // Deduplicate nearby fixed points
    let mut deduped: Vec<f64> = Vec::new();
    for fp in &fixed_points {
        if deduped.last().map_or(true, |&last| (fp - last).abs() > 0.05) {
            deduped.push(*fp);
        }
    }

    let outcome = if final_frac > 0.9 { "FULL CASCADE — collective resistance achieved" }
                  else if final_frac > 0.5 { "PARTIAL CASCADE — critical mass forming" }
                  else if final_frac > 0.1 { "MINORITY ACTION — below tipping point" }
                  else { "SUPPRESSED — threshold barrier holds" };

    let bar = |f: f64| -> String {
        let filled = (f * 24.0).round() as usize;
        (0..24).map(|i| if i < filled { '#' } else { '.' }).collect()
    };

    let mut out = String::with_capacity(1400);
    write!(out,
        "RESISTANCE_KERNEL v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         N = {n}   mu_threshold = {mu:.3}   sigma = {sigma:.3}\n\
         V-Cache sync period = {v_sync}   rounds = {iters}\n\
         ------------------------------------------\n\
         CASCADE TRAJECTORY:\n\
           round  |  visible_f  acting   bar\n",
        n=n, mu=mu, sigma=sigma, v_sync=v_sync, iters=iters,
    ).unwrap();
    for (r, vf, act) in &snapshots {
        let f = *act as f64 / n as f64;
        write!(out, "  {:>5}  |   {:.4}   {:>5}   {}\n", r, vf, act, bar(f)).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         SCHELLING FIXED POINTS (F(x) approx x):\n").unwrap();
    if deduped.is_empty() {
        write!(out, "  none found — no stable equilibrium in [0,1]\n").unwrap();
    } else {
        for fp in &deduped {
            let stability = if *fp < mu { "UNSTABLE" } else { "STABLE  " };
            write!(out, "  x* = {:.3}  [{}]  F(x*)={:.3}\n", fp, stability, normal_cdf(*fp)).unwrap();
        }
    }
    write!(out,
        "------------------------------------------\n\
         FINAL: {ff:.4} acting ({fa}/{n})\n\
         OUTCOME: {outcome}\n\
         THEORY : Granovetter (1978) AJS; Schelling (1960); Bikhchandani et al. (1992)\n\
         SOURCE : content/rust_kernels/src/kernels/resistance_kernel.rs",
        ff=final_frac, fa=final_acting, n=n, outcome=outcome,
    ).unwrap();
    out
}
