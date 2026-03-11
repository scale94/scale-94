// kernels/strangler_fig.rs — Strangler Fig Transition Protocol (soma_kernel_5.5)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Simulates the Strangler Fig transition strategy — building the new economic
/// system around the old one until the new system dominates.
///
/// Uses a modified logistic growth ODE with legacy system resistance:
///   dA/dt = r·A·(1-A) - ρ(t)·A·(1-A)
///         = A·(1-A)·(r - ρ(t))
///
/// where ρ(t) = ρ₀·exp(-λ·t)  — resistance decays as legacy system weakens.
///
/// Tipping point: when r > ρ(t), growth flips from negative to positive.
/// Critical mass:  A ≥ 0.5 (new system is majority)
///
/// Parameters:
///   initial_adoption  starting adoption fraction (0.001–0.5)
///   growth_rate       logistic growth coefficient r (0.01–2.0)
///   resistance        initial legacy resistance ρ₀ (0–2.0)
///   years             simulation horizon (1–200)
#[wasm_bindgen]
pub fn run_strangler_fig_transition(
    initial_adoption: f64,
    growth_rate:      f64,
    resistance:       f64,
    years:            f64,
) -> String {
    let years = (years as usize).clamp(1, 200);
    let r     = growth_rate.clamp(0.001, 2.0);
    let rho_0 = resistance.clamp(0.0, 2.0);
    let lambda = 0.05_f64;   // legacy decay rate — 5% weakening per year

    let mut a = initial_adoption.clamp(0.001, 0.999);  // adoption fraction

    let mut critical_mass_yr: Option<usize> = None;
    let mut tipping_yr:       Option<usize> = None;
    let mut dominance_yr:     Option<usize> = None;

    // Tipping year: when r > ρ(t)  →  t* = ln(ρ₀/r) / λ
    let tipping_analytic = if rho_0 > r && lambda > 0.0 {
        Some(((rho_0 / r).ln() / lambda).ceil() as usize)
    } else if rho_0 <= r {
        Some(0_usize)   // immediately positive growth
    } else {
        None
    };

    let snap_yrs = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
    let mut snaps: Vec<(usize, f64, f64, f64)> = Vec::new();  // (yr, A, rho_t, dA)

    // RK4 integration (dt=1yr is coarse; RK4 avoids Euler overshoot)
    let dt = 0.25_f64;
    let steps = (years as f64 / dt) as usize;

    for step in 0..=steps {
        let t = step as f64 * dt;
        let yr = t.ceil() as usize;

        let rho_t = rho_0 * (-lambda * t).exp();
        let effective_rate = r - rho_t;
        let da = effective_rate * a * (1.0 - a);

        // RK4 on f(a,t) = (r - ρ(t))·a·(1-a)
        let k1 = (r - rho_0 * (-lambda * t           ).exp()) * a * (1.0 - a);
        let k2 = (r - rho_0 * (-lambda * (t + dt/2.0)).exp()) * (a + k1*dt/2.0).clamp(0.0,1.0) * (1.0-(a+k1*dt/2.0).clamp(0.0,1.0));
        let k3 = (r - rho_0 * (-lambda * (t + dt/2.0)).exp()) * (a + k2*dt/2.0).clamp(0.0,1.0) * (1.0-(a+k2*dt/2.0).clamp(0.0,1.0));
        let k4 = (r - rho_0 * (-lambda * (t + dt    )).exp()) * (a + k3*dt    ).clamp(0.0,1.0) * (1.0-(a+k3*dt    ).clamp(0.0,1.0));
        a = (a + (k1 + 2.0*k2 + 2.0*k3 + k4) * dt / 6.0).clamp(0.0, 1.0);

        if critical_mass_yr.is_none() && a >= 0.5  { critical_mass_yr = Some(yr); }
        if dominance_yr.is_none()     && a >= 0.9  { dominance_yr     = Some(yr); }
        if tipping_yr.is_none()       && effective_rate > 0.0 { tipping_yr = Some(yr); }

        if snap_yrs.contains(&yr) && !snaps.iter().any(|s| s.0 == yr) {
            snaps.push((yr, a, rho_t, da));
        }
    }

    let final_a     = a;
    let final_rho   = rho_0 * (-lambda * years as f64).exp();
    let outcome     = if final_a >= 0.9 {
        "TRANSITION_COMPLETE — New system dominant"
    } else if final_a >= 0.5 {
        "CRITICAL_MASS_REACHED — Legacy system in minority"
    } else if final_a >= 0.2 {
        "ISLANDS_OF_COHERENCE — Expansion underway"
    } else {
        "EMBRYONIC — Growth sub-threshold; resistance dominant"
    };

    let mut out = String::with_capacity(350 + snaps.len() * 55 + 250);
    write!(out,
        "SOMA_KERNEL_5.5 // STRANGLER_FIG_TRANSITION\n\
         ══════════════════════════════════════════\n\
         GROWTH_RATE: {r:.3}  RESISTANCE₀: {rho_0:.3}  DECAY: λ={lambda:.3}\n\
         INITIAL_ADOPTION: {init:.3}  HORIZON: {years} yr\n\
         ──────────────────────────────────────────\n\
         ADOPTION CURVE:\n\
           YR    │ ADOPTION   RESISTANCE  NET_RATE",
        r      = r,
        rho_0  = rho_0,
        lambda = lambda,
        init   = initial_adoption,
        years  = years,
    ).unwrap();
    for (yr, adopt, rho_t, _da) in &snaps {
        write!(out, "\n   {:>4}  │  {:.4}     {:.4}      {:+.4}", yr, adopt, rho_t, r - rho_t).unwrap();
    }

    let tipping_display = tipping_analytic
        .map(|y| format!("yr {y} (analytic: r > ρ(t))"))
        .unwrap_or_else(|| "NEVER (r ≤ ρ₀ always)".into());
    write!(out,
        "\n ──────────────────────────────────────────\n\
         MILESTONES:\n\
           TIPPING_POINT       {tipping}\n\
           CRITICAL_MASS (50%) {critical}\n\
           DOMINANCE     (90%) {dominance}\n\
         FINAL_STATE:\n\
           ADOPTION_FRACTION   {final_a:.6}\n\
           RESIDUAL_RESISTANCE {final_rho:.6}\n\
           OUTCOME: {outcome}\n\
         STRATEGY: Build new system around old — expand 'islands of coherence'.\n\
         SOURCE: content/rust_kernels/src/kernels/strangler_fig.rs",
        tipping   = tipping_display,
        critical  = critical_mass_yr.map(|y| format!("yr {y}")).unwrap_or_else(|| "NOT_REACHED".into()),
        dominance = dominance_yr.map(|y| format!("yr {y}")).unwrap_or_else(|| "NOT_REACHED".into()),
        final_a   = final_a,
        final_rho = final_rho,
        outcome   = outcome,
    ).unwrap();
    out
}
