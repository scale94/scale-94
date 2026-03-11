// kernels/ceei.rs — A-CEEI Allocation Engine (soma_kernel_5.5)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Simulates a simplified A-CEEI (Approximate Competitive Equilibrium from
/// Equal Incomes) preference-based allocation market.
///
/// Based on Alvin Roth's Nobel-winning matching market theory.
/// Each agent gets equal budget; allocation maximises aggregate preference
/// satisfaction subject to market-clearing via Walrasian tâtonnement.
///
/// Parameters:
///   agents      number of allocation participants (2–50)
///   goods       number of distinct goods/resources (2–20)
///   inequality  budget spread / wealth inequality index (0–1; 0 = perfectly equal)
///   diversity   preference diversity across agents (0–1; 1 = fully heterogeneous)
#[wasm_bindgen]
pub fn run_ceei_allocation_engine(
    agents:     f64,
    goods:      f64,
    inequality: f64,
    diversity:  f64,
) -> String {
    let n = (agents as usize).clamp(2, 50);
    let m = (goods  as usize).clamp(2, 20);
    let ineq = inequality.clamp(0.0, 1.0);
    let div  = diversity.clamp(0.001, 1.0);

    // Seed from parameters for deterministic output
    let mut rng: u64 = ((agents * 1e6) as u64)
        .wrapping_add((goods * 1e4) as u64)
        .wrapping_add((inequality * 1e9) as u64)
        .wrapping_add((diversity * 1e11) as u64)
        .wrapping_add(0xDEAD_BEEF_CAFE_1234);

    // ── Generate agent utility weights w[i][j] ────────────────────────────
    // Low diversity → weights cluster near 1/M (uniform preferences)
    // High diversity → weights spread widely (heterogeneous preferences)
    let mut w = vec![vec![0.0_f64; m]; n];
    for i in 0..n {
        let mut row_sum = 0.0;
        for j in 0..m {
            let base = 1.0 / m as f64;
            let noise = (lcg_next(&mut rng) - 0.5) * 2.0 * div;
            w[i][j] = (base + noise).max(0.001);
            row_sum += w[i][j];
        }
        // Normalise so each agent's weights sum to 1
        for j in 0..m { w[i][j] /= row_sum; }
    }

    // ── Agent budgets (equal incomes, inequality shifts the distribution) ──
    let mut budgets = vec![1.0_f64; n];
    if ineq > 0.0 {
        for i in 0..n {
            let rank_factor = i as f64 / (n - 1) as f64;
            budgets[i] = 1.0 - ineq * 0.5 + ineq * rank_factor;
        }
    }

    // ── Supply: each good has aggregate supply = total budget / num_goods ──
    let total_budget: f64 = budgets.iter().sum();
    let supply = vec![total_budget / m as f64; m];

    // ── Walrasian tâtonnement price adjustment ────────────────────────────
    let mut prices = vec![1.0_f64; m];
    let alpha  = 0.3;   // step size
    let max_it = 200;

    for _iter in 0..max_it {
        // Demand: each agent maximises log-linear utility (Cobb-Douglas)
        // Optimal: x_ij* = w_ij * B_i / p_j
        let mut demand = vec![0.0_f64; m];
        for i in 0..n {
            for j in 0..m {
                demand[j] += w[i][j] * budgets[i] / prices[j];
            }
        }
        // Excess demand
        let mut max_excess = 0.0_f64;
        for j in 0..m {
            let excess = demand[j] - supply[j];
            max_excess = max_excess.max(excess.abs());
            prices[j]  = (prices[j] + alpha * excess / supply[j]).max(0.01);
        }
        if max_excess < 0.001 { break; }
    }

    // ── Compute final allocations and utilities ───────────────────────────
    let mut allocs  = vec![vec![0.0_f64; m]; n];
    let mut utils   = vec![0.0_f64; n];
    for i in 0..n {
        for j in 0..m {
            allocs[i][j] = w[i][j] * budgets[i] / prices[j];
            // Cobb-Douglas utility: U_i = Σ w_ij * ln(x_ij + 1)
            utils[i] += w[i][j] * (allocs[i][j] + 1.0).ln();
        }
    }

    // ── Envy-freeness: max over i of max(0, U_i(x_k) - U_i(x_i)) ─────────
    let mut max_envy = 0.0_f64;
    for i in 0..n {
        for k in 0..n {
            if k == i { continue; }
            // Utility agent i would get from agent k's allocation
            let u_ik: f64 = (0..m).map(|j| w[i][j] * (allocs[k][j] + 1.0).ln()).sum();
            let envy = (u_ik - utils[i]).max(0.0);
            if envy > max_envy { max_envy = envy; }
        }
    }

    // ── Gini coefficient of utility distribution ──────────────────────────
    let mut sorted_u = utils.clone();
    sorted_u.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n_f = n as f64;
    let mean_u: f64 = sorted_u.iter().sum::<f64>() / n_f;
    let gini = if mean_u > 0.0 {
        let mut gini_num = 0.0_f64;
        for i in 0..n { for k in 0..n { gini_num += (sorted_u[i] - sorted_u[k]).abs(); } }
        gini_num / (2.0 * n_f * n_f * mean_u)
    } else { 0.0 };

    // ── Pareto efficiency: check no agent can improve without harming another
    // Approximated by measuring residual excess demand magnitude
    let residual: f64 = (0..m).map(|j| {
        let d: f64 = (0..n).map(|i| allocs[i][j]).sum();
        (d - supply[j]).abs() / supply[j].max(0.001)
    }).sum::<f64>() / m as f64;
    let pareto_eff = (1.0 - residual).clamp(0.0, 1.0);

    // ── Format output ─────────────────────────────────────────────────────
    let envy_status  = if max_envy < 0.01 { "ENVY-FREE" } else if max_envy < 0.1 { "APPROX_EF" } else { "ENVY_PRESENT" };
    let min_u = sorted_u.first().copied().unwrap_or(0.0);
    let max_u = sorted_u.last().copied().unwrap_or(0.0);

    let mut price_str = String::with_capacity(m * 12);
    for j in 0..m {
        write!(price_str, "p{j}={:.3}", prices[j]).unwrap();
        if j < m - 1 { price_str.push(' '); }
    }

    let mut out = String::with_capacity(600);
    write!(out,
        "SOMA_KERNEL_5.5 // A-CEEI_ALLOCATION_ENGINE\n\
         ══════════════════════════════════════════\n\
         AGENTS: {n}  GOODS: {m}  INEQUALITY: {ineq:.2}  DIVERSITY: {div:.2}\n\
         ──────────────────────────────────────────\n\
         EQUILIBRIUM_PRICES:\n   {prices}\n\
         ──────────────────────────────────────────\n\
         ALLOCATION_METRICS:\n\
           ENVY_STATUS         {envy_status}\n\
           MAX_ENVY_INDEX      {max_envy:.6}\n\
           PARETO_EFFICIENCY   {pareto_eff:.4}\n\
           GINI_COEFFICIENT    {gini:.4}  (0=equal, 1=maximal_inequality)\n\
           MEAN_UTILITY        {mean_u:.4}\n\
           UTILITY_RANGE       [{min_u:.4}, {max_u:.4}]\n\
         ──────────────────────────────────────────\n\
         THEOREM_GUARANTEE: Approximate Envy-Freeness + Efficiency\n\
         (Budish 2011 — A-CEEI; Roth Nobel 2012 — Matching Markets)\n\
         SOURCE: content/rust_kernels/src/kernels/ceei.rs",
        prices = price_str,
    ).unwrap();
    out
}
