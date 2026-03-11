// kernels/soma_plus.rs — Soma Plus Social Capital Engine (soma_kernel_5.5)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Simulates Soma Plus — the social capital / commons-contribution system
/// at the heart of soma_kernel_5.5's post-scarcity status economy.
///
/// Agents earn Soma Plus by contributing to the commons:
///   Ecological Care  (reforesting, biodiversity monitoring)
///   Social Care      (child-rearing, elderly care, education, arts)
///   Each contribution accrues SP; SP decays slowly without contribution.
///
/// Status tiers: INITIATE → CONTRIBUTOR → ARTISAN → SOVEREIGN
///
/// Parameters:
///   population    number of agents (10–10000)
///   eco_share     fraction of agents doing ecological care (0–1)
///   social_share  fraction of agents doing social care (0–1)
///   arts_share    fraction of agents doing arts/culture (0–1)
///   years         simulation cycles (1–200)
#[wasm_bindgen]
pub fn run_soma_plus_engine(
    population:   f64,
    eco_share:    f64,
    social_share: f64,
    arts_share:   f64,
    years:        f64,
) -> String {
    let pop   = (population as usize).clamp(10, 10_000);
    let years = (years as usize).clamp(1, 200);
    let eco_s   = eco_share.clamp(0.0, 1.0);
    let soc_s   = social_share.clamp(0.0, 1.0);
    let art_s   = arts_share.clamp(0.0, 1.0);

    // Contribution rates per type (SP/yr at full participation)
    const ECO_RATE:    f64 = 18.0;   // ecological care
    const SOCIAL_RATE: f64 = 14.0;   // social care
    const ARTS_RATE:   f64 = 22.0;   // arts/culture (high status multiplier)
    const DECAY:       f64 = 0.02;   // 2% SP decay per cycle (entropy of social capital)

    // Tier thresholds
    const T_CONTRIBUTOR: f64 = 100.0;
    const T_ARTISAN:     f64 = 500.0;
    const T_SOVEREIGN:   f64 = 2000.0;

    // Agent SP pool — each agent's Soma Plus balance
    let mut sp: Vec<f64> = vec![0.0; pop];
    // Seed: "SOMA55" in ASCII = 0x534F4D413535_0000
    let mut rng: u64 = ((population * 1e5) as u64)
        .wrapping_add((eco_share * 1e12) as u64)
        .wrapping_add(0x534F_4D41_3535_0000);

    // Assign contribution types to agents (stochastically, seeded)
    let mut contribution: Vec<f64> = Vec::with_capacity(pop);
    for _ in 0..pop {
        let roll = lcg_next(&mut rng);
        let rate = if roll < eco_s {
            ECO_RATE + lcg_next(&mut rng) * 4.0 - 2.0
        } else if roll < eco_s + soc_s {
            SOCIAL_RATE + lcg_next(&mut rng) * 4.0 - 2.0
        } else if roll < eco_s + soc_s + art_s {
            ARTS_RATE + lcg_next(&mut rng) * 6.0 - 3.0
        } else {
            0.0   // passive (survival guaranteed; status not sought)
        };
        contribution.push(rate.max(0.0));
    }

    // Tier snapshots over time
    let mut tier_trace: Vec<(usize, [usize; 4], f64)> = Vec::new();  // (yr, counts, mean_sp)
    let snap_yrs = [1, 5, 10, 25, 50, 100, 200];

    for yr in 1..=years {
        for i in 0..pop {
            sp[i] = sp[i] * (1.0 - DECAY) + contribution[i];
        }
        if snap_yrs.contains(&yr) || yr == years {
            let mut counts = [0usize; 4];
            let total_sp: f64 = sp.iter().sum();
            for &s in &sp {
                if s < T_CONTRIBUTOR       { counts[0] += 1; }
                else if s < T_ARTISAN      { counts[1] += 1; }
                else if s < T_SOVEREIGN    { counts[2] += 1; }
                else                       { counts[3] += 1; }
            }
            tier_trace.push((yr, counts, total_sp / pop as f64));
        }
    }

    // Final stats
    let final_sp = sp.clone();
    let mean_sp: f64 = final_sp.iter().sum::<f64>() / pop as f64;
    let variance: f64 = final_sp.iter().map(|s| (s - mean_sp).powi(2)).sum::<f64>() / pop as f64;
    let std_sp = variance.sqrt();
    let max_sp = final_sp.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let mut sorted_sp = final_sp.clone();
    sorted_sp.sort_by(|a,b| a.partial_cmp(b).unwrap());
    let gini = {
        let mut g = 0.0_f64;
        let n = pop as f64;
        if mean_sp > 0.0 {
            for (i, s) in sorted_sp.iter().enumerate() {
                g += (2.0 * (i+1) as f64 - n - 1.0) * s;
            }
            g / (n * n * mean_sp)
        } else { 0.0 }
    };
    let contributing_pct = contribution.iter().filter(|&&r| r > 0.0).count() as f64 / pop as f64 * 100.0;
    let passive_pct = 100.0 - contributing_pct;

    let mut out = String::with_capacity(400 + tier_trace.len() * 60 + 250);
    write!(out,
        "SOMA_KERNEL_5.5 // SOMA_PLUS_ENGINE\n\
         ══════════════════════════════════════════\n\
         POPULATION: {pop}  HORIZON: {years} yr\n\
         CONTRIBUTION_MIX:\n\
           ECOLOGICAL  {eco_pct:.1}%  |  SOCIAL {soc_pct:.1}%  |  ARTS {art_pct:.1}%  |  PASSIVE {passive_pct:.1}%\n\
         ──────────────────────────────────────────\n\
         TIER EVOLUTION:\n\
           YR    │ INITIATE  CONTRIBUTOR  ARTISAN  SOVEREIGN  MEAN_SP",
        pop         = pop,
        years       = years,
        eco_pct     = eco_s * 100.0,
        soc_pct     = soc_s * 100.0,
        art_pct     = art_s * 100.0,
        passive_pct = passive_pct,
    ).unwrap();
    for (yr, counts, mean) in &tier_trace {
        write!(out, "\n   {:>4}  │ {:>7}  {:>11}  {:>7}  {:>9}  {:.1}",
            yr, counts[0], counts[1], counts[2], counts[3], mean).unwrap();
    }
    write!(out,
        "\n ──────────────────────────────────────────\n\
         FINAL DISTRIBUTION:\n\
           MEAN_SP             {mean_sp:.2}\n\
           STD_DEV             {std_sp:.2}\n\
           MAX_SP (SOVEREIGN)  {max_sp:.2}\n\
           GINI_COEFFICIENT    {gini:.4}  (SP inequality index)\n\
           CONTRIBUTING_AGENTS {contributing_pct:.1}%\n\
         SOCIAL_CONTRACT: Survival guaranteed; status earned through commons.\n\
         SOURCE: content/rust_kernels/src/kernels/soma_plus.rs",
        mean_sp          = mean_sp,
        std_sp           = std_sp,
        max_sp           = max_sp,
        gini             = gini,
        contributing_pct = contributing_pct,
    ).unwrap();
    out
}
