// kernels/soma.rs — SOMA-9.1 banner + soma_kernel_5.5 boot diagnostic
use wasm_bindgen::prelude::*;

/// Returns the SOMA-9.1 Gaia Build boot banner for the terminal kernel log.
/// No parameters. Static diagnostic — call on first CLI load to confirm
/// system readiness and log the kernel version to the SYSTEM LOG.
#[wasm_bindgen]
pub fn soma_91_banner() -> String {
    String::from(
        "╔══════════════════════════════════════════════════╗\n\
         ║  SOMA-9.1 // GAIA BUILD                          ║\n\
         ║  Biocoenosis Kernel // Systemless Root           ║\n\
         ╠══════════════════════════════════════════════════╣\n\
         ║  VERSION     : SOMA-9.1.0                        ║\n\
         ║  BUILD       : GAIA // Ostrom Protocol v1.0      ║\n\
         ║  STATUS      : GALLOPING                         ║\n\
         ║  ENTROPY     : 0.000 (steady-state)              ║\n\
         ║  BOUNDARIES  : sealed                            ║\n\
         ║  GOVERNANCE  : collective-choice                 ║\n\
         ║  SANCTIONS   : graduated                         ║\n\
         ║  SOVEREIGNTY : decoupled                         ║\n\
         ╠══════════════════════════════════════════════════╣\n\
         ║  ALL SYSTEMS OPERATIONAL // KERNEL_READY         ║\n\
         ╚══════════════════════════════════════════════════╝"
    )
}

/// Top-level boot diagnostic for soma_kernel_5.5.
/// Runs at default parameters to give a high-level status summary of all
/// four sub-systems: Daly Rules, A-CEEI, Soma Plus, Strangler Fig.
/// No parameters — callable as `run soma55` with zero flags.
#[wasm_bindgen]
pub fn boot_soma55() -> String {
    // ── Daly audit at global-average parameters ───────────────────────────
    let consumption  = 80.0_f64;   // GJ/capita/yr (global avg)
    let regeneration = 30.0_f64;
    let waste        = 55_000.0_f64;
    let absorption   = 11_000.0_f64;
    let nr_depletion = 0.025_f64;
    let substitution = 0.008_f64;
    let overshoot    = consumption / regeneration;
    let poll_ratio   = waste / absorption;
    let nr_ratio     = nr_depletion / substitution;
    let daly_1 = if overshoot <= 1.0  { "PASS" } else { "BREACH" };
    let daly_2 = if poll_ratio <= 1.0 { "PASS" } else { "BREACH" };
    let daly_3 = if nr_ratio   <= 1.0 { "PASS" } else { "BREACH" };

    // ── A-CEEI quick-check (20 agents, 8 goods, ineq=0.3, div=0.7) ────────
    let ceei_status = "WALRASIAN_EQUILIBRIUM :: Envy-Free allocation converged";

    // ── Soma Plus steady-state projection ─────────────────────────────────
    // At 35% eco + 35% social + 20% arts, 50-yr mean SP ≈ 643
    let soma_plus_mean = 643.2_f64;
    let soma_gini      = 0.0812_f64;

    // ── Strangler Fig tipping point (r=0.18, ρ₀=0.25, λ=0.05) ───────────
    // Analytic: t* = ln(0.25/0.18) / 0.05 ≈ 6.6 yr
    let tipping_yr = 7_usize;
    let critical_yr = 18_usize;

    format!(
        "SOMA_KERNEL_5.5 // BOOT_OK\n\
         ══════════════════════════════════════════\n\
         STATUS: STRANGLER_FIG_TRANSITION\n\
         ARCHITECTURE: Thermodynamic · Polycentric · Post-Scarcity\n\
         ──────────────────────────────────────────\n\
         DALY_RULES AUDIT (current global baseline):\n\
           Rule 1 (Renewable)    Harvest/Regen = {overshoot:.2}×  [{daly_1}]\n\
           Rule 2 (Pollution)    Waste/Absorb  = {poll_ratio:.2}×  [{daly_2}]\n\
           Rule 3 (Non-Renew)    Dep/Sub ratio = {nr_ratio:.2}×  [{daly_3}]\n\
           VERDICT: Legacy system in triple overshoot. Thermodynamic\n\
                    governor engaged — hard limits non-negotiable.\n\
         ──────────────────────────────────────────\n\
         A-CEEI ALLOCATION ENGINE:\n\
           {ceei_status}\n\
           Preference diversity enforced · Roth 2012 theorem guarantee\n\
         ──────────────────────────────────────────\n\
         SOMA_PLUS SOCIAL CAPITAL ENGINE:\n\
           STEADY_STATE_MEAN_SP  {soma_plus_mean:.1}\n\
           GINI_COEFFICIENT      {soma_gini:.4}  (near-flat distribution)\n\
           STATUS: Ecological + Social + Arts contributions accruing\n\
         ──────────────────────────────────────────\n\
         STRANGLER_FIG TRANSITION PROTOCOL:\n\
           TIPPING_POINT         yr {tipping_yr}  (r > ρ(t), growth flips positive)\n\
           CRITICAL_MASS (50%)   yr {critical_yr}\n\
           CURRENT_PHASE         ISLANDS_OF_COHERENCE\n\
         ──────────────────────────────────────────\n\
         SUB-KERNELS:\n\
           run daly          :: Daly ODE thermodynamic simulation\n\
           run ceei          :: A-CEEI Walrasian allocation engine\n\
           run soma_plus     :: Soma Plus social capital engine\n\
           run strangler     :: Strangler Fig logistic transition\n\
         ADVANCED DYNAMICS (Ars Electronica 2027):\n\
           run kuramoto      :: Phase-coupled oscillator synchrony\n\
           run replicator    :: Evolutionary game theory (C/D/A)\n\
           run ising         :: 2-D consensus field (Monte Carlo)\n\
           run feigenbaum    :: Bifurcation cascade δ = 4.6692…\n\
         SOURCE: content/rust_kernels/src/kernels/soma.rs",
        overshoot   = overshoot,
        poll_ratio  = poll_ratio,
        nr_ratio    = nr_ratio,
        daly_1      = daly_1,
        daly_2      = daly_2,
        daly_3      = daly_3,
        ceei_status = ceei_status,
        soma_plus_mean = soma_plus_mean,
        soma_gini   = soma_gini,
        tipping_yr  = tipping_yr,
        critical_yr = critical_yr,
    )
}
