// kernels/soma_kernel.rs — SOMA_KERNEL_5.5 LIVE — Stateful Multi-Cycle Simulator
//
// Marries the rigorous ODE/RK4/Walrasian math of the free functions with a
// persistent struct that accumulates state across terminal commands.
//
// Usage (from terminal):
//   run soma_live                                     // cycle at legacy defaults
//   run soma_live --consumption 40 --compliance 0.1  // one policy intervention
//   run soma_live reset                               // wipe state, return yr 0
use std::fmt::Write as W;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub struct SomaKernel {
    regeneration: f64,
    absorption:   f64,
    substitution: f64,
    r_stock:  f64,
    p_stock:  f64,
    nr_stock: f64,
    cumulative_entropy: f64,
    ostrom_compliance:      f64,
    soma_plus:              f64,
    strangler_fig_adoption: f64,
    year: u32,
}

#[wasm_bindgen]
impl SomaKernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SomaKernel {
        SomaKernel {
            regeneration: 30.0,
            absorption:   11_000.0,
            substitution: 0.008,
            r_stock:  1.0,
            p_stock:  0.0,
            nr_stock: 1.0,
            cumulative_entropy: 0.0,
            ostrom_compliance:      0.10,
            soma_plus:              0.0,
            strangler_fig_adoption: 0.02,
            year: 0,
        }
    }

    /// Execute one annual policy cycle.
    /// consumption    GJ/capita/yr  (legacy ~80; sustainable ~25)
    /// waste          Mt CO2eq/yr   (legacy ~55000; sustainable <11000)
    /// nr_depletion   fraction/yr   (legacy ~0.025; target <0.008)
    /// compliance_mod delta to ostrom_compliance this cycle (-0.2 to +0.2)
    pub fn execute_cycle(
        &mut self,
        consumption:    f64,
        waste:          f64,
        nr_depletion:   f64,
        compliance_mod: f64,
    ) -> String {
        self.year += 1;
        let mut out = String::new();

        self.ostrom_compliance = (self.ostrom_compliance + compliance_mod).clamp(0.0, 1.0);

        // Daly Rule 1: Renewable stock (Euler dt=1yr)
        let pollution_drag  = (1.0 - self.p_stock * 0.15).max(0.0);
        let effective_regen = self.regeneration * self.r_stock * pollution_drag;
        let delta_r         = (effective_regen - consumption) / self.regeneration;
        self.r_stock        = (self.r_stock + delta_r * 0.01).clamp(0.0, 2.0);

        // Daly Rule 2: Pollution accumulation
        let saturation     = (self.p_stock * 0.4).min(0.95);
        let eff_absorption = self.absorption * (1.0 - saturation);
        let delta_p        = (waste - eff_absorption) / self.absorption;
        self.p_stock       = (self.p_stock + delta_p * 0.005).clamp(0.0, 20.0);

        // Daly Rule 3: Non-renewable reserves
        self.nr_stock = (self.nr_stock + (self.substitution - nr_depletion)).clamp(0.0, 2.0);

        // Entropy production (Clausius-Duhem / Prigogine)
        let overshoot = consumption / self.regeneration.max(0.01);
        if overshoot > 1.0 { self.cumulative_entropy += overshoot * overshoot.ln(); }
        self.cumulative_entropy += self.p_stock * 0.002;

        let r1_ratio = consumption  / self.regeneration;
        let r2_ratio = waste        / self.absorption;
        let r3_ratio = nr_depletion / self.substitution.max(0.001);
        let r1_ok    = r1_ratio <= 1.0;
        let r2_ok    = r2_ratio <= 1.0;
        let r3_ok    = r3_ratio <= 1.0;

        // A-CEEI Allocation: Walrasian tatonnement (50 iterations)
        let eco_budget               = self.r_stock.min(1.0) * self.ostrom_compliance;
        let (envy_idx, pareto, gini) = self.walrasian_ceei(eco_budget);

        // Soma Plus: social capital (only when survival is not threatened)
        let earned_sp = if r1_ok && r2_ok {
            (self.ostrom_compliance * 18.0)
            + (self.ostrom_compliance * 14.0)
            + (self.ostrom_compliance * 22.0 * 0.20)
        } else { 0.0 };
        self.soma_plus += earned_sp;

        // Strangler Fig: single RK4 step
        let r     = 0.18_f64 + self.ostrom_compliance * 0.12;
        let rho_0 = 0.25_f64;
        let lam   = 0.05_f64;
        let t     = self.year as f64;
        let a     = self.strangler_fig_adoption;
        let k1 = (r - rho_0 * (-lam *  t       ).exp()) * a  * (1.0 - a );
        let a2 = (a + k1 * 0.5).clamp(0.0, 1.0);
        let k2 = (r - rho_0 * (-lam * (t + 0.5)).exp()) * a2 * (1.0 - a2);
        let a3 = (a + k2 * 0.5).clamp(0.0, 1.0);
        let k3 = (r - rho_0 * (-lam * (t + 0.5)).exp()) * a3 * (1.0 - a3);
        let a4 = (a + k3      ).clamp(0.0, 1.0);
        let k4 = (r - rho_0 * (-lam * (t + 1.0)).exp()) * a4 * (1.0 - a4);
        self.strangler_fig_adoption = (a + (k1 + 2.0*k2 + 2.0*k3 + k4) / 6.0).clamp(0.0, 1.0);

        let frag_idx     = 1.0 - (-self.cumulative_entropy * 0.08).exp();
        let system_state = if self.strangler_fig_adoption >= 0.9 { "POLYCENTRIC_HARMONY"
        } else if self.strangler_fig_adoption >= 0.5             { "CRITICAL_MASS_REACHED"
        } else if self.strangler_fig_adoption >= 0.2             { "ISLANDS_OF_COHERENCE"
        } else if r1_ok && r2_ok && r3_ok                        { "LEGACY_STABLE"
        } else                                                    { "LEGACY_COLLAPSE" };

        writeln!(out, "SOMA_KERNEL_5.5 // CYCLE {}", self.year).unwrap();
        writeln!(out, "==============================================").unwrap();
        writeln!(out, "DALY RULES AUDIT:").unwrap();
        writeln!(out, "  Rule 1 (Renewable)  C/G = {:.3}x  [{}]  r_stock={:.4}", r1_ratio, if r1_ok {"SAFE"} else {"BREACH"}, self.r_stock).unwrap();
        writeln!(out, "  Rule 2 (Pollution)  W/A = {:.3}x  [{}]  p_stock={:.4}", r2_ratio, if r2_ok {"SAFE"} else {"BREACH"}, self.p_stock).unwrap();
        writeln!(out, "  Rule 3 (Non-renew)  D/S = {:.3}x  [{}]  nr_res={:.4}",  r3_ratio, if r3_ok {"SAFE"} else {"BREACH"}, self.nr_stock).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "A-CEEI ALLOCATION (Walrasian):").unwrap();
        writeln!(out, "  Envy Index:         {:.4}  [{}]", envy_idx, if envy_idx < 0.01 {"ENVY-FREE"} else if envy_idx < 0.1 {"APPROX_EF"} else {"ENVY_PRESENT"}).unwrap();
        writeln!(out, "  Pareto Efficiency:  {:.4}", pareto).unwrap();
        writeln!(out, "  Utility Gini:       {:.4}", gini).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "SOMA PLUS:").unwrap();
        if earned_sp > 0.0 {
            writeln!(out, "  Care Labor Logged:  +{:.1} SP  (total {:.1})", earned_sp, self.soma_plus).unwrap();
        } else {
            writeln!(out, "  ATTENTION: Survival threat -- care labor suspended.").unwrap();
        }
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "STRANGLER FIG TRANSITION:").unwrap();
        writeln!(out, "  Adoption Fraction:  {:.4}  ({:.1}%)", self.strangler_fig_adoption, self.strangler_fig_adoption * 100.0).unwrap();
        writeln!(out, "  Growth Rate r:      {:.4}  (compliance boost +{:.4})", r, self.ostrom_compliance * 0.12).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "SYSTEM STATE:").unwrap();
        writeln!(out, "  Ostrom Compliance:  {:.3}", self.ostrom_compliance).unwrap();
        writeln!(out, "  Soma Plus (global): {:.1}", self.soma_plus).unwrap();
        writeln!(out, "  Cumul. Entropy:     {:.4} nats", self.cumulative_entropy).unwrap();
        writeln!(out, "  Fragmentation Idx:  {:.4}", frag_idx).unwrap();
        writeln!(out, "  HORIZON:            {}", system_state).unwrap();
        writeln!(out, "SOURCE: content/rust_kernels/src/kernels/soma_kernel.rs  [cycle={}]", self.year).unwrap();
        out
    }

    fn walrasian_ceei(&self, eco_budget: f64) -> (f64, f64, f64) {
        const N: usize = 8;
        const M: usize = 4;
        let base      = 1.0 / M as f64;
        let diversity = 1.0 - self.ostrom_compliance * 0.5;

        let mut rng: u64 = ((self.ostrom_compliance * 1e12) as u64)
            .wrapping_add((self.soma_plus as u64).wrapping_mul(1_000_003))
            .wrapping_add((self.year as u64).wrapping_mul(2_654_435_761))
            .wrapping_add(0xCAFE_BABE_1234_5678);

        let mut w = [[base; M]; N];
        for i in 0..N {
            let mut row_sum = 0.0;
            for j in 0..M {
                let noise = (lcg_next(&mut rng) - 0.5) * 2.0 * diversity;
                w[i][j] = (base + noise).max(0.001);
                row_sum += w[i][j];
            }
            for j in 0..M { w[i][j] /= row_sum; }
        }

        let budget     = eco_budget.max(0.05);
        let budgets    = [budget; N];
        let total: f64 = budgets.iter().sum();
        let supply     = [total / M as f64; M];
        let mut prices = [1.0_f64; M];

        for _ in 0..50 {
            let mut demand = [0.0_f64; M];
            for i in 0..N { for j in 0..M { demand[j] += w[i][j] * budgets[i] / prices[j]; } }
            let mut max_ex = 0.0_f64;
            for j in 0..M {
                let ex    = demand[j] - supply[j];
                max_ex    = max_ex.max(ex.abs());
                prices[j] = (prices[j] + 0.3 * ex / supply[j].max(0.001)).max(0.01);
            }
            if max_ex < 0.001 { break; }
        }

        let mut allocs = [[0.0_f64; M]; N];
        let mut utils  = [0.0_f64; N];
        for i in 0..N {
            for j in 0..M {
                allocs[i][j] = w[i][j] * budgets[i] / prices[j];
                utils[i]    += w[i][j] * (allocs[i][j] + 1.0).ln();
            }
        }

        let mut max_envy = 0.0_f64;
        for i in 0..N {
            for k in 0..N {
                if k == i { continue; }
                let u_ik: f64 = (0..M).map(|j| w[i][j] * (allocs[k][j] + 1.0).ln()).sum();
                max_envy = max_envy.max((u_ik - utils[i]).max(0.0));
            }
        }

        let residual: f64 = (0..M).map(|j| {
            let d: f64 = (0..N).map(|i| allocs[i][j]).sum();
            (d - supply[j]).abs() / supply[j].max(0.001)
        }).sum::<f64>() / M as f64;
        let pareto = (1.0 - residual).clamp(0.0, 1.0);

        let mut sorted_u = utils;
        sorted_u.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mean_u = sorted_u.iter().sum::<f64>() / N as f64;
        let gini = if mean_u > 0.0 {
            let mut g = 0.0_f64;
            for i in 0..N { for k in 0..N { g += (sorted_u[i] - sorted_u[k]).abs(); } }
            g / (2.0 * N as f64 * N as f64 * mean_u)
        } else { 0.0 };

        (max_envy, pareto, gini)
    }

    pub fn reset(&mut self) {
        self.r_stock = 1.0; self.p_stock = 0.0; self.nr_stock = 1.0;
        self.cumulative_entropy = 0.0; self.ostrom_compliance = 0.10;
        self.soma_plus = 0.0; self.strangler_fig_adoption = 0.02; self.year = 0;
    }

    pub fn get_year(&self)      -> u32 { self.year }
    pub fn get_adoption(&self)  -> f64 { self.strangler_fig_adoption }
    pub fn get_soma_plus(&self) -> f64 { self.soma_plus }
    pub fn get_entropy(&self)   -> f64 { self.cumulative_entropy }
}
