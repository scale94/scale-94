// kernels/post_capitalist.rs — Leontief Input-Output + Post-Scarcity Automation
// Leontief (1941) · Dosi et al. (2010) · Post-scarcity economic transition model
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Leontief Input-Output Analysis with post-scarcity automation extension.
///
/// automation_rate    base automation rate per sector per period (0–1)
/// redistribution     redistribution coefficient for UBI feasibility (0–1)
/// demand_growth      final demand growth rate per period (0–1)
/// n_sectors          number of economic sectors, clamped to 8
/// t_horizon          number of time periods to simulate (1–100)
#[wasm_bindgen]
pub fn run_post_capitalist(
    automation_rate: f64,
    redistribution: f64,
    demand_growth: f64,
    n_sectors: f64,
    t_horizon: f64,
) -> String {
    let auto   = automation_rate.clamp(0.0, 1.0);
    let redist = redistribution.clamp(0.01, 1.0);
    let dg     = demand_growth.clamp(0.0, 0.5);
    let n      = (n_sectors as usize).clamp(2, 8);
    let t_max  = (t_horizon as usize).clamp(1, 100);

    let mut rng: u64 = ((auto * 1e9) as u64)
        .wrapping_add((redist * 1e7) as u64)
        .wrapping_add((dg * 1e11) as u64)
        .wrapping_add((n as u64).wrapping_mul(0x1941_D051_0000_0001));

    // ── Build input-output matrix A (n×n) ────────────────────────────────────
    // a_ij = fraction of sector i output used by sector j
    // Rows must sum to < 1 to guarantee Leontief inverse convergence
    let mut a = vec![vec![0.0_f64; n]; n];
    for i in 0..n {
        let mut row_sum = 0.0_f64;
        for j in 0..n {
            a[i][j] = lcg_next(&mut rng) * 0.12;
            row_sum += a[i][j];
        }
        // Rescale to keep row-sum ≤ 0.7 (ensures spectral radius < 1)
        if row_sum > 0.7 {
            for j in 0..n { a[i][j] *= 0.7 / row_sum; }
        }
    }

    // ── Neumann series Leontief inverse: L ≈ I + A + A² + ... (10 terms) ────
    // L[i][j] total output of sector i required per unit final demand of j
    let mut l = vec![vec![0.0_f64; n]; n];
    // Start with identity
    for i in 0..n { l[i][i] = 1.0; }

    let mut power = vec![vec![0.0_f64; n]; n];
    for i in 0..n { power[i][i] = 1.0; } // A^0 = I

    for _term in 1..=10 {
        // power = power * A
        let mut next = vec![vec![0.0_f64; n]; n];
        for i in 0..n {
            for j in 0..n {
                for k in 0..n {
                    next[i][j] += power[i][k] * a[k][j];
                }
            }
        }
        power = next;
        for i in 0..n {
            for j in 0..n {
                l[i][j] += power[i][j];
            }
        }
    }

    // ── Final demand vector d (seeded, with demand_growth applied at t=0) ────
    let mut d = vec![0.0_f64; n];
    for i in 0..n {
        d[i] = 1.0 + lcg_next(&mut rng) * 2.0;
    }

    // ── Output vector x = L * d ───────────────────────────────────────────────
    let mut x = vec![0.0_f64; n];
    for i in 0..n {
        for j in 0..n {
            x[i] += l[i][j] * d[j];
        }
    }

    // ── Leontief output multipliers: column sum of L gives total upstream pull
    let mut multipliers = vec![0.0_f64; n];
    for j in 0..n {
        for i in 0..n {
            multipliers[j] += l[i][j];
        }
    }

    // ── Automation timeline: labor_req(t) = (1 - automation)^t per unit output
    let mut sector_auto_rate = vec![0.0_f64; n];
    for i in 0..n {
        sector_auto_rate[i] = (auto + (lcg_next(&mut rng) - 0.5) * 0.1).clamp(0.01, 0.99);
    }

    let mut post_scarcity_year: Option<usize> = None;
    let mut ubi_feasible_year: Option<usize> = None;
    let mut cumulative_surplus = 0.0_f64;

    for t in 0..t_max {
        let d_t_scale = (1.0 + dg).powi(t as i32);
        let mut sub_threshold = 0usize;
        let mut automation_savings = 0.0_f64;

        for i in 0..n {
            let labor_req = (1.0 - sector_auto_rate[i]).powi(t as i32);
            let output_t  = x[i] * d_t_scale;
            let saved     = output_t * (1.0 - labor_req);
            automation_savings += saved;
            if labor_req < 0.15 { sub_threshold += 1; }
        }

        cumulative_surplus += automation_savings;

        if post_scarcity_year.is_none() && sub_threshold * 2 > n {
            post_scarcity_year = Some(t);
        }

        let ubi_feasibility = cumulative_surplus * redist / (x.iter().sum::<f64>().max(1.0));
        if ubi_feasible_year.is_none() && ubi_feasibility > 1.0 {
            ubi_feasible_year = Some(t);
        }
    }

    // ── Format output ─────────────────────────────────────────────────────────
    let sector_names = ["ENERGY", "MFGR", "AGRI", "TRANS", "HEALTH", "EDUC", "TECH", "SRVCS"];
    let mut out = String::with_capacity(1100);
    writeln!(out, "POST_CAPITALIST v1.0 // LEONTIEF_IO_ENGINE").unwrap();
    writeln!(out, "══════════════════════════════════════════════════════").unwrap();
    writeln!(out, "PARAMS  auto={auto:.3}  redist={redist:.3}  demand_growth={dg:.3}  N={n}  T={t_max}").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "SECTOR OUTPUT TABLE  (Leontief x = L·d):").unwrap();
    writeln!(out, "  {:<8}  {:>10}  {:>10}  {:>10}  {:>10}", "SECTOR", "DEMAND_d", "OUTPUT_x", "MULTIPLIER", "AUTO_RATE").unwrap();
    for i in 0..n {
        let name = sector_names.get(i).unwrap_or(&"SECT");
        writeln!(out, "  {:<8}  {:>10.4}  {:>10.4}  {:>10.4}  {:>9.3}",
            name, d[i], x[i], multipliers[i], sector_auto_rate[i]).unwrap();
    }
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "LEONTIEF_MULTIPLIERS (total upstream output per unit demand):").unwrap();
    let max_mult_idx = multipliers.iter().enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).map(|(i,_)| i).unwrap_or(0);
    writeln!(out, "  HIGHEST  {} = {:.4}  (most upstream-linked sector)",
        sector_names.get(max_mult_idx).unwrap_or(&"?"), multipliers[max_mult_idx]).unwrap();
    writeln!(out, "  MEAN     {:.4}", multipliers.iter().sum::<f64>() / n as f64).unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "POST_SCARCITY_TRANSITION:").unwrap();
    match post_scarcity_year {
        Some(yr) => writeln!(out, "  COMMONS_THRESHOLD    period {yr}  (>50% sectors at labor_req < 0.15)").unwrap(),
        None     => writeln!(out, "  COMMONS_THRESHOLD    NOT REACHED in T={t_max} periods").unwrap(),
    }
    match ubi_feasible_year {
        Some(yr) => writeln!(out, "  UBI_FEASIBLE_YEAR    period {yr}  (automation surplus covers redistribution)").unwrap(),
        None     => writeln!(out, "  UBI_FEASIBLE_YEAR    NOT REACHED in T={t_max} periods").unwrap(),
    }
    writeln!(out, "  CUMULATIVE_SURPLUS   {cumulative_surplus:.4}  (labour cost savings over T)").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "REFERENCES:").unwrap();
    writeln!(out, "  Leontief, W. (1941). The Structure of American Economy. Harvard UP.").unwrap();
    writeln!(out, "  Dosi, G. et al. (2010). Schumpeter meeting Keynes: A policy-friendly model").unwrap();
    writeln!(out, "    of endogenous growth and business cycles. J. Economic Dynamics & Control.").unwrap();
    write!(out,   "SOURCE: content/rust_kernels/src/kernels/post_capitalist.rs").unwrap();
    out
}
