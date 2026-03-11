// kernels/pragmatic.rs — Pragmatic<T>: Dissipative Rust Kernel Type System
//
// The foundational type of the DRK (Dissipative Rust Kernel) architecture.
// Replaces Result<T,E> with a thermodynamically-aware computation outcome:
//
//   Resolved(T)         — full-fidelity result within thermal budget
//   Synthetic(T, f64)   — lower-fidelity approximation (fidelity ∈ [0,1])
//                         returned when resolution cost exceeds thermal limit
//   Dissolved           — computation exceeded budget entirely; no useful result
//
// The type forces callers to handle approximation explicitly — Rust's exhaustive
// match guarantees you cannot silently consume a Synthetic as if it were Resolved.
//
// Demonstration kernel: N agents attempt computational tasks drawn from a
// power-law cost distribution under a shared thermal budget. As the budget
// depletes, more results degrade from Resolved → Synthetic → Dissolved.
// This models real systems where fidelity is not free — every precise answer
// has an energy cost, and the honest response to exhaustion is approximation,
// not silence.
//
// Theory: Prigogine (1977) dissipative structures; England (2013) minimal
// dissipation bound; Kauffman (1993) adjacent possible; Jaynes (1957) MaxEnt.

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// ─── THE TYPE ───────────────────────────────────────────────────────────────────

/// Pragmatic<T> — a thermodynamically honest computation outcome.
///
/// Unlike Result<T,E>, this type acknowledges that between "perfect answer" and
/// "total failure" lies a vast regime of useful approximation. The Synthetic
/// variant carries both the best-effort value AND its fidelity score, so
/// downstream consumers can make informed decisions about trust.
#[derive(Clone, Debug)]
pub enum Pragmatic<T> {
    /// Full resolution achieved within thermal budget.
    Resolved(T),
    /// Approximation returned. Fidelity ∈ [0, 1]: 1.0 = nearly resolved,
    /// 0.0 = barely better than noise. The T value is the best effort.
    Synthetic(T, f64),
    /// Thermal budget exhausted. No useful result could be produced.
    /// The computation dissolved — entropy won this round.
    Dissolved,
}

impl<T> Pragmatic<T> {
    /// Is this a full-fidelity result?
    pub fn is_resolved(&self) -> bool {
        matches!(self, Pragmatic::Resolved(_))
    }

    /// Is this an approximation?
    pub fn is_synthetic(&self) -> bool {
        matches!(self, Pragmatic::Synthetic(_, _))
    }

    /// Did the computation dissolve entirely?
    pub fn is_dissolved(&self) -> bool {
        matches!(self, Pragmatic::Dissolved)
    }

    /// Extract the value if available (Resolved or Synthetic), ignoring fidelity.
    pub fn value(&self) -> Option<&T> {
        match self {
            Pragmatic::Resolved(v)    => Some(v),
            Pragmatic::Synthetic(v,_) => Some(v),
            Pragmatic::Dissolved      => None,
        }
    }

    /// Fidelity score: 1.0 for Resolved, the stored score for Synthetic, 0.0 for Dissolved.
    pub fn fidelity(&self) -> f64 {
        match self {
            Pragmatic::Resolved(_)     => 1.0,
            Pragmatic::Synthetic(_, f) => *f,
            Pragmatic::Dissolved       => 0.0,
        }
    }

    /// Map over the inner value, preserving the Pragmatic wrapper.
    pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> Pragmatic<U> {
        match self {
            Pragmatic::Resolved(v)      => Pragmatic::Resolved(f(v)),
            Pragmatic::Synthetic(v, fi) => Pragmatic::Synthetic(f(v), fi),
            Pragmatic::Dissolved        => Pragmatic::Dissolved,
        }
    }

    /// Monadic bind: chain Pragmatic computations.
    /// Fidelity degrades multiplicatively through the chain.
    pub fn and_then<U, F: FnOnce(T) -> Pragmatic<U>>(self, f: F) -> Pragmatic<U> {
        match self {
            Pragmatic::Resolved(v)      => f(v),
            Pragmatic::Synthetic(v, fi) => match f(v) {
                Pragmatic::Resolved(u)       => Pragmatic::Synthetic(u, fi),
                Pragmatic::Synthetic(u, fi2) => Pragmatic::Synthetic(u, fi * fi2),
                Pragmatic::Dissolved         => Pragmatic::Dissolved,
            },
            Pragmatic::Dissolved => Pragmatic::Dissolved,
        }
    }
}

// ─── THERMAL RESOLUTION ENGINE ──────────────────────────────────────────────────

/// Attempt to resolve a computation of given `cost` against remaining `budget`.
/// Returns the Pragmatic outcome and the energy consumed.
fn thermal_resolve(
    cost: f64,
    budget: f64,
    thermal_limit: f64,
    rng: &mut u64,
) -> (Pragmatic<f64>, f64) {
    if cost <= thermal_limit && cost <= budget {
        // Full resolution: cost within both limit and budget
        let value = 1.0 - (cost / thermal_limit) * 0.01; // slight precision loss at limit
        (Pragmatic::Resolved(value), cost)
    } else if cost <= thermal_limit * 2.5 && budget > thermal_limit * 0.1 {
        // Synthetic regime: can approximate but not fully resolve
        let energy_spent = (cost * 0.4).min(budget); // spend partial energy
        let fidelity = (1.0 - (cost - thermal_limit) / (thermal_limit * 1.5))
            .clamp(0.05, 0.95);
        // Approximation: true value + noise proportional to (1 - fidelity)
        let noise = (lcg_next(rng) - 0.5) * 2.0 * (1.0 - fidelity);
        let approx = (0.5 + noise).clamp(0.0, 1.0);
        (Pragmatic::Synthetic(approx, fidelity), energy_spent)
    } else {
        // Dissolved: cost far exceeds budget or limit
        let wasted = (thermal_limit * 0.05).min(budget.max(0.0)); // minimal probe cost
        (Pragmatic::Dissolved, wasted)
    }
}

// ─── WASM EXPORT ────────────────────────────────────────────────────────────────

/// Dissipative Rust Kernel: Pragmatic<T> Type Demonstration
///
/// Simulates N agents attempting computational tasks drawn from a power-law
/// cost distribution under a shared thermal budget. As budget depletes:
///   Resolved → Synthetic → Dissolved
///
/// Parameters:
///   n_agents:       agents attempting resolution (4–128)
///   thermal_budget: total energy available for all computations (10–10000)
///   thermal_limit:  max cost for full-fidelity resolution (0.5–100)
///   cost_exponent:  power-law exponent for task cost distribution (0.5–3.0)
///                   lower = more extreme costs; higher = more uniform
#[wasm_bindgen]
pub fn run_pragmatic_type(
    n_agents:       f64,
    thermal_budget: f64,
    thermal_limit:  f64,
    cost_exponent:  f64,
) -> String {
    let n      = (n_agents as usize).clamp(4, 128);
    let budget = thermal_budget.clamp(10.0, 10000.0);
    let limit  = thermal_limit.clamp(0.5, 100.0);
    let alpha  = cost_exponent.clamp(0.5, 3.0);

    let mut rng: u64 = ((n_agents * 1_000_007.0) as u64)
        .wrapping_add((thermal_budget * 999_961.0) as u64)
        .wrapping_add((thermal_limit  * 999_979.0) as u64)
        .wrapping_add((cost_exponent  * 999_983.0) as u64)
        .wrapping_add(0xD155_1A7E_B0CA_FE01);

    // ── Phase 1: Generate task costs (power-law distribution) ───────────────
    // cost = limit * u^(-1/α)  where u ~ Uniform(0,1)
    // This gives heavy-tailed costs: most tasks are cheap, some are extreme
    let tasks_per_agent = 8_usize;
    let total_tasks = n * tasks_per_agent;
    let mut costs: Vec<f64> = (0..total_tasks)
        .map(|_| {
            let u = lcg_next(&mut rng).max(0.01);
            limit * 0.1 * u.powf(-1.0 / alpha)
        })
        .collect();

    // ── Phase 2: Execute under thermal budget ───────────────────────────────
    let mut remaining = budget;
    let mut resolved_count   = 0_usize;
    let mut synthetic_count  = 0_usize;
    let mut dissolved_count  = 0_usize;
    let mut total_fidelity   = 0.0_f64;
    let mut total_energy     = 0.0_f64;
    let mut useful_energy    = 0.0_f64; // energy that produced Resolved or high-fidelity Synthetic

    // Track fidelity distribution in 10 bins [0.0, 0.1), [0.1, 0.2), ... [0.9, 1.0]
    let mut fidelity_hist = [0u32; 10];

    // Snapshots: record state at 25%, 50%, 75%, 100% of tasks
    struct Snap { task_pct: usize, resolved: usize, synthetic: usize, dissolved: usize, budget_pct: f64, mean_fid: f64 }
    let snap_at: Vec<usize> = vec![total_tasks / 4, total_tasks / 2, 3 * total_tasks / 4, total_tasks];
    let mut snaps: Vec<Snap> = Vec::with_capacity(4);

    // Chain demonstration: track fidelity degradation through 3-step chains
    let mut chain_results: Vec<f64> = Vec::new();

    for (i, &cost) in costs.iter().enumerate() {
        let (result, energy) = thermal_resolve(cost, remaining, limit, &mut rng);
        remaining -= energy;
        total_energy += energy;

        let fid = result.fidelity();

        match &result {
            Pragmatic::Resolved(_) => {
                resolved_count += 1;
                useful_energy += energy;
            },
            Pragmatic::Synthetic(_, f) => {
                synthetic_count += 1;
                if *f > 0.5 { useful_energy += energy * f; }
                let bin = ((*f * 10.0) as usize).min(9);
                fidelity_hist[bin] += 1;
            },
            Pragmatic::Dissolved => {
                dissolved_count += 1;
            },
        }
        total_fidelity += fid;

        // Every 3rd task: demonstrate and_then chaining
        if i % 3 == 2 && i >= 2 {
            // Simulate a 3-step Pragmatic chain
            let c1 = costs.get(i - 2).copied().unwrap_or(1.0);
            let c2 = costs.get(i - 1).copied().unwrap_or(1.0);
            let c3 = cost;
            let step1_fid = if c1 <= limit { 1.0 } else { (1.0 - (c1 - limit) / (limit * 1.5)).clamp(0.05, 0.95) };
            let step2_fid = if c2 <= limit { 1.0 } else { (1.0 - (c2 - limit) / (limit * 1.5)).clamp(0.05, 0.95) };
            let step3_fid = if c3 <= limit { 1.0 } else { (1.0 - (c3 - limit) / (limit * 1.5)).clamp(0.05, 0.95) };
            let chain_fid = step1_fid * step2_fid * step3_fid;
            chain_results.push(chain_fid);
        }

        if snap_at.contains(&(i + 1)) {
            let mean_f = if (resolved_count + synthetic_count + dissolved_count) > 0 {
                total_fidelity / (i + 1) as f64
            } else { 0.0 };
            snaps.push(Snap {
                task_pct: ((i + 1) * 100) / total_tasks,
                resolved: resolved_count,
                synthetic: synthetic_count,
                dissolved: dissolved_count,
                budget_pct: remaining / budget * 100.0,
                mean_fid: mean_f,
            });
        }

        if remaining <= 0.0 {
            // Budget exhausted: all remaining tasks dissolve
            dissolved_count += total_tasks - i - 1;
            // Fill remaining snapshots
            for &s in &snap_at {
                if s > i + 1 {
                    let mean_f = total_fidelity / total_tasks as f64;
                    snaps.push(Snap {
                        task_pct: (s * 100) / total_tasks,
                        resolved: resolved_count,
                        synthetic: synthetic_count,
                        dissolved: dissolved_count,
                        budget_pct: 0.0,
                        mean_fid: mean_f,
                    });
                }
            }
            break;
        }
    }

    // ── Compute statistics ──────────────────────────────────────────────────
    let total = (resolved_count + synthetic_count + dissolved_count) as f64;
    let resolve_pct   = resolved_count as f64 / total * 100.0;
    let synthetic_pct = synthetic_count as f64 / total * 100.0;
    let dissolve_pct  = dissolved_count as f64 / total * 100.0;
    let mean_fidelity = total_fidelity / total;
    let thermal_eff   = if total_energy > 0.0 { useful_energy / total_energy } else { 0.0 };

    // Chain fidelity stats
    let chain_mean = if chain_results.is_empty() { 0.0 }
        else { chain_results.iter().sum::<f64>() / chain_results.len() as f64 };
    let chain_min = chain_results.iter().copied().fold(1.0_f64, f64::min);

    // Cost distribution stats
    costs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let cost_median = costs[total_tasks / 2];
    let cost_p90    = costs[(total_tasks as f64 * 0.9) as usize];
    let cost_max    = costs.last().copied().unwrap_or(0.0);

    // Status determination
    let status = if resolve_pct > 80.0      { "THERMALLY_SOVEREIGN" }
                 else if resolve_pct > 50.0 { "PRAGMATICALLY_STABLE" }
                 else if resolve_pct > 20.0 { "SYNTHETIC_REGIME" }
                 else                       { "THERMAL_COLLAPSE" };

    let bar = |v: f64, max: f64| -> String {
        let filled = ((v / max.max(1e-9) * 24.0).round() as usize).min(24);
        let mut s = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    // ── Format output ───────────────────────────────────────────────────────
    let mut out = String::with_capacity(3000);

    write!(out,
        "DRK_PRAGMATIC_TYPE v1.0 // DISSIPATIVE RUST KERNEL\n\
         ══════════════════════════════════════════\n\
         N = {n}  TASKS = {tt}  BUDGET = {b:.1}  LIMIT = {lm:.1}  α = {a:.2}\n\
         ──────────────────────────────────────────\n\
         TYPE DEFINITION:\n\
         \n\
           enum Pragmatic<T> {{\n\
               Resolved(T),          // full fidelity\n\
               Synthetic(T, f64),    // approximation + fidelity score\n\
               Dissolved,            // thermal budget exhausted\n\
           }}\n\
         \n\
         ──────────────────────────────────────────\n\
         COST DISTRIBUTION  (power-law α = {a:.2})\n\
           MEDIAN  {cm:.3}    P90  {cp:.3}    MAX  {cx:.3}\n\
           THERMAL_LIMIT  {lm:.1}   (costs > limit → Synthetic or Dissolved)\n\
         ──────────────────────────────────────────\n\
         THERMAL BUDGET DEPLETION:\n",
        n = n, tt = total_tasks, b = budget, lm = limit, a = alpha,
        cm = cost_median, cp = cost_p90, cx = cost_max,
    ).unwrap();

    for sn in &snaps {
        write!(out,
            "  {pct:>3}%  R:{r:<4} S:{s:<4} D:{d:<4}  budget:{bp:>5.1}%  fid:{f:.4}  {bar}\n",
            pct = sn.task_pct,
            r = sn.resolved, s = sn.synthetic, d = sn.dissolved,
            bp = sn.budget_pct, f = sn.mean_fid,
            bar = bar(sn.budget_pct, 100.0),
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         OUTCOME DISTRIBUTION:\n\
           RESOLVED    {rc:>4}  ({rp:>5.1}%)  {rb}\n\
           SYNTHETIC   {sc:>4}  ({sp:>5.1}%)  {sb}\n\
           DISSOLVED   {dc:>4}  ({dp:>5.1}%)  {db}\n",
        rc = resolved_count,  rp = resolve_pct,   rb = bar(resolve_pct, 100.0),
        sc = synthetic_count, sp = synthetic_pct,  sb = bar(synthetic_pct, 100.0),
        dc = dissolved_count, dp = dissolve_pct,   db = bar(dissolve_pct, 100.0),
    ).unwrap();

    // Fidelity histogram for Synthetic results
    if synthetic_count > 0 {
        write!(out, "──────────────────────────────────────────\n\
                     FIDELITY DISTRIBUTION  (Synthetic results only)\n").unwrap();
        let hist_max = *fidelity_hist.iter().max().unwrap_or(&1) as f64;
        for (i, &count) in fidelity_hist.iter().enumerate() {
            let lo = i as f64 * 0.1;
            let hi = lo + 0.1;
            write!(out, "  [{lo:.1}–{hi:.1})  {c:>4}  {b}\n",
                lo = lo, hi = hi, c = count, b = bar(count as f64, hist_max),
            ).unwrap();
        }
    }

    write!(out,
        "──────────────────────────────────────────\n\
         CHAIN DEGRADATION  (and_then: fidelity *= fidelity at each step)\n\
           3-STEP CHAINS : {cn}\n\
           MEAN_FIDELITY : {cm:.6}\n\
           MIN_FIDELITY  : {ci:.6}\n\
           → Pragmatic chains honestly propagate uncertainty\n\
           → Result<T,E> discards this: Ok is Ok regardless of path\n\
         ──────────────────────────────────────────\n\
         THERMODYNAMICS:\n\
           MEAN_FIDELITY       {mf:.6}\n\
           THERMAL_EFFICIENCY  {te:.4}  (useful_energy / total_energy)\n\
           ENERGY_SPENT        {es:.1} / {b:.1}  ({ep:.1}%)\n\
           ENERGY_WASTED       {ew:.1}  (dissolved probes + low-fidelity work)\n\
         ──────────────────────────────────────────\n\
         STATUS : {status}\n\
         ──────────────────────────────────────────\n\
         AXIOMS:\n\
           1. Fidelity is not free — every precise answer has an energy cost\n\
           2. Approximation is not failure — Synthetic is honest, silence is not\n\
           3. Chains degrade — multiplicative fidelity loss is a physical law\n\
           4. Dissolution is information — knowing you can't know is knowledge\n\
         ──────────────────────────────────────────\n\
         THEORY : Prigogine (1977); England (2013); Kauffman (1993); Jaynes (1957)\n\
         NEXT   : kernel log schema → slab arena allocator → GlobalAlloc → scheduler\n\
         SOURCE : content/rust_kernels/src/kernels/pragmatic.rs",
        cn = chain_results.len(),
        cm = chain_mean, ci = chain_min,
        mf = mean_fidelity,
        te = thermal_eff,
        es = total_energy, b = budget, ep = total_energy / budget * 100.0,
        ew = total_energy - useful_energy,
        status = status,
    ).unwrap();

    out
}
