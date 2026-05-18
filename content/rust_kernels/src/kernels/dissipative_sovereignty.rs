// kernels/dissipative_sovereignty.rs — Sovereignty as Dissipation-Rate Control
//
// DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0 — Prigogine + MEPP + self-organized criticality.
// "A system that ceases to dissipate is a system that has died.
//  A system that dissipates without structure is a system that has not yet been born.
//  Sovereignty is the rate-control of dissipation between those two failure modes."
//
// Implementation: Bak–Tang–Wiesenfeld sandpile on an N×N lattice. Energy is dropped
// at random sites at rate ε (drive); when any site exceeds threshold θ, it topples,
// distributing energy to neighbours — toppling cascades become avalanches. The
// avalanche size distribution is power-law p(s) ~ s^(-τ) at criticality.
//
// Iterate T steps. Record:
//   E_total       — instantaneous lattice energy (proxy for stored complexity)
//   diss_total    — total energy that toppled off the edges (true dissipation)
//   avalanche_log — sizes of all toppling cascades
//   tau           — power-law exponent from log-log linear fit (criticality marker)
//
// Phases:
//   SUBCRITICAL_INERTIA   — energy accumulates, avalanches small; nothing propagates
//   OPERATING_CRITICALITY — τ ≈ 1.0–1.5; sovereign band
//   SUPERCRITICAL_BURN    — large avalanches dominate; structure collapses
//   SOVEREIGN_NULL_FLOW   — zero drive, zero dissipation; the system has died
//
// MEPP score: dissipation_rate / max_possible_rate

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_dissipative_sovereignty(
    lattice_size: f64,  // 8–32  N (sites per side)
    drive_rate:   f64,  // 0.0–1.0 ε (probability of grain-add per step)
    threshold:    f64,  // 3.0–6.0 θ (toppling threshold)
    steps:        f64,  // 200–5000 simulation steps
) -> String {
    let n_side = (lattice_size as usize).clamp(8, 32);
    let n      = n_side * n_side;
    let eps    = drive_rate.clamp(0.0, 1.0);
    let theta  = threshold.clamp(3.0, 6.0) as u32;
    let iters  = (steps as usize).clamp(200, 5000);

    let mut rng: u64 = ((lattice_size * 1_000_003.0) as u64)
        .wrapping_add((drive_rate * 999_979.0) as u64)
        .wrapping_add((threshold  * 999_961.0) as u64)
        .wrapping_add(0xD1_55_1F_A7_E_E0_FFu64);

    let mut grid: Vec<u32> = vec![0; n];
    let mut diss_total: u64 = 0;
    let mut avalanches: Vec<usize> = Vec::with_capacity(iters / 4);

    let mut topple_stack: Vec<usize> = Vec::with_capacity(n);

    // 6 trajectory snapshots
    struct Snap { step: usize, e_total: u64, diss: u64, last_av: usize }
    let snap_at: Vec<usize> = (0..6).map(|i| i * (iters - 1) / 5).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(6);

    for step in 0..iters {
        // Drive: with probability ε, add a grain to a random site
        if lcg_next(&mut rng) < eps {
            let site = (lcg_next(&mut rng) * n as f64) as usize;
            let site = site.min(n - 1);
            grid[site] += 1;
            topple_stack.push(site);
        }

        // Relax all unstable sites; track avalanche size
        let mut av_size = 0usize;
        while let Some(site) = topple_stack.pop() {
            if grid[site] < theta { continue; }
            grid[site] -= theta;
            av_size += 1;
            // Distribute to 4 neighbours (open boundaries — grain falls off edge)
            let x = site % n_side;
            let y = site / n_side;
            for _ in 0..theta / 4 + (theta % 4).min(1) { /* spread `theta` units */ }
            let units_per = theta / 4;
            let mut delivered = 0u32;
            // E, W, N, S
            for (nx, ny) in [(x.wrapping_sub(1), y), (x + 1, y), (x, y.wrapping_sub(1)), (x, y + 1)] {
                if nx < n_side && ny < n_side {
                    let nb = ny * n_side + nx;
                    grid[nb] += units_per;
                    delivered += units_per;
                    if grid[nb] >= theta { topple_stack.push(nb); }
                } else {
                    // Off the edge — true dissipation
                    diss_total += units_per as u64;
                    delivered += units_per;
                }
            }
            // Remainder (when theta not divisible by 4) — count as edge dissipation
            if delivered < theta {
                diss_total += (theta - delivered) as u64;
            }
        }
        if av_size > 0 { avalanches.push(av_size); }

        if snap_at.contains(&step) {
            let e: u64 = grid.iter().map(|&v| v as u64).sum();
            snaps.push(Snap {
                step,
                e_total: e,
                diss: diss_total,
                last_av: av_size,
            });
        }
    }

    // Power-law fit: bin avalanche sizes by log-2, linear regression on log-log.
    let mut tau = 0.0_f64;
    let mut r2  = 0.0_f64;
    if avalanches.len() >= 8 {
        let max_av = *avalanches.iter().max().unwrap_or(&1);
        let n_bins = ((max_av as f64).log2().ceil() as usize).max(3);
        let mut bins = vec![0u32; n_bins];
        for &a in &avalanches {
            let b = (a as f64).log2().floor() as usize;
            if b < n_bins { bins[b] += 1; }
        }
        // (log s, log freq) pairs
        let pts: Vec<(f64, f64)> = bins.iter().enumerate()
            .filter(|(_, &c)| c > 0)
            .map(|(b, &c)| ((b as f64 + 0.5).exp2().log10(), (c as f64).log10()))
            .collect();
        if pts.len() >= 3 {
            let n_p = pts.len() as f64;
            let sx: f64 = pts.iter().map(|p| p.0).sum();
            let sy: f64 = pts.iter().map(|p| p.1).sum();
            let sxy: f64 = pts.iter().map(|p| p.0 * p.1).sum();
            let sxx: f64 = pts.iter().map(|p| p.0 * p.0).sum();
            let denom = n_p * sxx - sx * sx;
            if denom.abs() > 1e-9 {
                let slope = (n_p * sxy - sx * sy) / denom;
                tau = -slope;
                let mean_y = sy / n_p;
                let ss_tot: f64 = pts.iter().map(|p| (p.1 - mean_y).powi(2)).sum();
                let intercept = (sy - slope * sx) / n_p;
                let ss_res: f64 = pts.iter().map(|p| {
                    let yhat = slope * p.0 + intercept;
                    (p.1 - yhat).powi(2)
                }).sum();
                r2 = if ss_tot > 1e-9 { 1.0 - ss_res / ss_tot } else { 0.0 };
            }
        }
    }

    let e_final: u64 = grid.iter().map(|&v| v as u64).sum();
    let mean_av  = if !avalanches.is_empty() {
        avalanches.iter().sum::<usize>() as f64 / avalanches.len() as f64
    } else { 0.0 };
    let max_av = *avalanches.iter().max().unwrap_or(&0);
    let av_count = avalanches.len();

    // MEPP score — dissipation per step over max possible (~ε·θ per step)
    let max_diss = iters as f64 * eps * theta as f64;
    let mepp = if max_diss > 1e-6 { (diss_total as f64 / max_diss).clamp(0.0, 1.5) } else { 0.0 };

    let phase = if eps < 1e-3 {
        "SOVEREIGN_NULL_FLOW — zero drive, zero dissipation; the system has died"
    } else if av_count < 5 && (e_final as f64) > 0.5 * (n as f64 * theta as f64) {
        "SUBCRITICAL_INERTIA — energy accumulates, avalanches small; nothing propagates"
    } else if max_av as f64 > 0.3 * n as f64 {
        "SUPERCRITICAL_BURN — large avalanches dominate; structure collapses"
    } else if tau > 0.8 && tau < 1.6 && r2 > 0.6 {
        "OPERATING_CRITICALITY — τ within sovereign band; rate-control achieved"
    } else {
        "MIXED_REGIME — neither dead nor sovereign; tune drive_rate or threshold"
    };

    let verdict = if (0.9..=1.5).contains(&tau) && r2 > 0.7 {
        "SOVEREIGNTY_HELD — through-flow optimized, structure persistent"
    } else if mepp < 0.05 {
        "NEAR_DEATH — dissipation rate approaches zero; reintroduce drive"
    } else if mepp > 0.9 {
        "OVERDRIVEN — dissipation saturated; lower drive_rate or raise threshold"
    } else {
        "DRIFTING — tune toward criticality (τ ≈ 1.2 is the target)"
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
        "DISSIPATIVE_SOVEREIGNTY v5.0.0 // SOMA-9.4\n\
         ══════════════════════════════════════════════════════════\n\
         BAK–TANG–WIESENFELD SANDPILE :: {n}×{n} lattice ({tot} sites)\n\
           ε (drive) = {ep:.3}   θ (threshold) = {th}   N_steps = {it}\n\
         ──────────────────────────────────────────────────────────\n\
         TRAJECTORY :: E_total = stored energy, D = cumulative edge dissipation\n",
        n=n_side, tot=n, ep=eps, th=theta, it=iters,
    ).unwrap();

    let e_max = snaps.iter().map(|s| s.e_total).max().unwrap_or(1).max(1) as f64;
    let d_max = snaps.iter().map(|s| s.diss).max().unwrap_or(1).max(1) as f64;
    for (i, sn) in snaps.iter().enumerate() {
        write!(out,
            "  [{:>1}]  t={:>4}  E={:>5}  {}  D={:>5}  {}  last_av={}\n",
            i + 1, sn.step, sn.e_total, bar(sn.e_total as f64, 0.0, e_max),
            sn.diss, bar(sn.diss as f64, 0.0, d_max), sn.last_av,
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────────────────\n\
         AVALANCHE STATISTICS  (toppling cascades)\n\
           count  = {ac}   mean_size = {ms:.3}   max_size = {mx}\n\
           τ      = {ta:.4}   (power-law exponent, criticality band ≈ 1.0–1.5)\n\
           R²     = {r:.4}   (fit quality)\n\
         ──────────────────────────────────────────────────────────\n\
         DISSIPATION ACCOUNTING\n\
           D_total      = {dt}   (units lost over open boundaries)\n\
           E_final      = {ef}   (units still stored)\n\
           MEPP_score   = D / (N·ε·θ) = {me:.4}\n\
         ──────────────────────────────────────────────────────────\n\
         PHASE   :: {ph}\n\
         VERDICT :: {vd}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM  : order is not the opposite of entropy.\n\
                  order is the mechanism by which entropy is produced faster.\n\
         LINEAGE: Prigogine (1947) · Bak–Tang–Wiesenfeld (1987) · Bejan (constructal law)\n\
         SOURCE : content/rust_kernels/src/kernels/dissipative_sovereignty.rs",
        ac=av_count, ms=mean_av, mx=max_av,
        ta=tau, r=r2,
        dt=diss_total, ef=e_final, me=mepp,
        ph=phase, vd=verdict,
    ).unwrap();

    out
}
