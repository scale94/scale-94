// kernels/daly.rs — Daly Rules Thermodynamic Simulation (soma_kernel_5.5)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Run the soma_kernel_5.5 Daly Rules thermodynamic simulation.
///
/// Integrates three coupled ODEs over `years` annual timesteps:
///   1. Renewable resource stock  R(t)  — harvest vs regeneration
///   2. Pollution accumulation    P(t)  — waste vs absorption
///   3. Non-renewable reserves   NR(t)  — depletion vs substitution
///
/// Entropy production follows irreversible thermodynamics (Prigogine):
///   σ(t) = (C/G) · ln(C/G)   when C > G  (dissipation from overshoot)
///
/// Parameters (all f64 for wasm-bindgen):
///   consumption   GJ/capita/yr   (current global avg ~80; sustainable ~25–30)
///   regeneration  GJ/capita/yr   (biosphere regen capacity ~30)
///   waste         Mt CO₂eq/yr    (normalised; global ~55,000 Mt)
///   absorption    Mt CO₂eq/yr    (natural sinks ~11,000 Mt)
///   nr_depletion  fraction/yr    (fossil reserve draw-down rate; ~0.025)
///   substitution  fraction/yr    (renewable substitution rate; ~0.008)
///   years         simulation horizon (clamped 1–500)
#[wasm_bindgen]
pub fn run_daly_thermo_simulation(
    consumption:  f64,
    regeneration: f64,
    waste:        f64,
    absorption:   f64,
    nr_depletion: f64,
    substitution: f64,
    years:        f64,
) -> String {
    let years      = (years as usize).clamp(1, 500);
    let regen      = regeneration.max(0.01);
    let absorb     = absorption.max(0.01);

    // State variables (all normalised to 1.0 = current baseline)
    let mut r_stock        = 1.0_f64;   // renewable resource stock
    let mut p_stock        = 0.0_f64;   // cumulative pollution
    let mut nr_stock       = 1.0_f64;   // non-renewable reserves
    let mut entropy        = 0.0_f64;   // cumulative entropy production (nats)

    let mut collapse_yr:  Option<usize> = None;
    let mut tipping_yr:   Option<usize> = None;
    let mut phase = "STABLE";

    // Snapshots at key horizons
    let snap_yrs = [10, 25, 50, 100, 200, 500];
    let mut snaps: Vec<(usize, f64, f64, f64, f64)> = Vec::new();

    for yr in 1..=years {
        // ── Daly Rule 1: Renewable ─────────────────────────────────────────
        // Regeneration capacity degrades with pollution saturation
        let pollution_drag   = (1.0 - p_stock * 0.15).max(0.0);
        let effective_regen  = regen * r_stock * pollution_drag;
        let delta_r          = (effective_regen - consumption) / regen;
        r_stock              = (r_stock + delta_r * 0.01).max(0.0);

        // ── Daly Rule 2: Pollution ────────────────────────────────────────
        // Absorption degrades with saturation (ecosystem overload)
        let saturation       = (p_stock * 0.4).min(0.95);
        let eff_absorption   = absorb * (1.0 - saturation);
        let delta_p          = (waste - eff_absorption) / absorb;
        p_stock              = (p_stock + delta_p * 0.005).max(0.0);

        // ── Daly Rule 3: Non-renewable ────────────────────────────────────
        nr_stock = (nr_stock + (substitution - nr_depletion)).clamp(0.0, 2.0);

        // ── Entropy production (Clausius–Duhem) ───────────────────────────
        let overshoot = consumption / regen;
        if overshoot > 1.0 {
            entropy += overshoot * overshoot.ln();
        }
        entropy += p_stock * 0.002;   // pollution entropy contribution

        // ── Phase detection ───────────────────────────────────────────────
        let frag = 1.0 - (-entropy * 0.08).exp();
        if collapse_yr.is_none() && (r_stock <= 0.05 || p_stock >= 8.0) {
            collapse_yr = Some(yr);
            phase = "COLLAPSE";
        } else if tipping_yr.is_none() && frag > 0.5 && collapse_yr.is_none() {
            tipping_yr = Some(yr);
            phase = "CRITICAL";
        }

        if snap_yrs.contains(&yr) || yr == years {
            snaps.push((yr, r_stock, p_stock, nr_stock, entropy));
        }
    }

    let frag_final    = 1.0 - (-entropy * 0.08).exp();
    let eco_debt_pct  = ((1.0 - r_stock) * 100.0).max(0.0);
    let overshoot_x   = consumption / regen;
    let daly_1_status = if overshoot_x <= 1.0 { "PASS" } else { "BREACH" };
    let daly_2_status = if waste <= absorb      { "PASS" } else { "BREACH" };
    let daly_3_status = if substitution >= nr_depletion { "PASS" } else { "BREACH" };

    // Pre-size: header ~400 + snap rows ~50 each + footer ~300
    let mut out = String::with_capacity(400 + snaps.len() * 50 + 300);
    write!(out,
        "SOMA_KERNEL_5.5 // DALY_THERMO_SIMULATION\n\
         ══════════════════════════════════════════\n\
         HORIZON: {years} yr  |  STATUS: {phase}\n\
         ──────────────────────────────────────────\n\
         DALY RULES AUDIT:\n\
           Rule 1 (Renewable)     Harvest/Regen = {overshoot_x:.3}×  [{daly_1_status}]\n\
           Rule 2 (Pollution)     Waste/Absorb  = {waste_ratio:.3}×  [{daly_2_status}]\n\
           Rule 3 (Non-renew)     Dep/Sub ratio = {nr_ratio:.3}×  [{daly_3_status}]\n\
         ──────────────────────────────────────────\n\
         SIMULATION TRACE:\n\
           YR    │ R_STOCK  P_STOCK  NR_STOCK  ENTROPY",
        years         = years,
        phase         = phase,
        overshoot_x   = overshoot_x,
        daly_1_status = daly_1_status,
        waste_ratio   = waste / absorb,
        daly_2_status = daly_2_status,
        nr_ratio      = nr_depletion / substitution.max(0.001),
        daly_3_status = daly_3_status,
    ).unwrap();

    for (yr, r, p, nr, h) in &snaps {
        write!(out, "\n   {:>4}  │ {:.4}   {:.4}   {:.4}    {:.4}", yr, r, p, nr, h).unwrap();
    }

    let collapse_str = collapse_yr.map(|y| y.to_string()).unwrap_or_else(|| "NONE (within horizon)".into());
    let tipping_str  = tipping_yr.map(|y| y.to_string()).unwrap_or_else(|| "NOT_REACHED".into());
    let last         = snaps.last();
    write!(out,
        "\n ──────────────────────────────────────────\n\
         FINAL STATE:\n\
           RESOURCE_STOCK      {r_final:.6}  (1.0 = baseline)\n\
           POLLUTION_STOCK     {p_final:.6}\n\
           NR_RESERVES         {nr_final:.6}\n\
           CUMULATIVE_ENTROPY  {entropy:.6} nats\n\
           FRAGMENTATION_IDX   {frag:.6}\n\
           ECOLOGICAL_DEBT     {eco_debt:.2}%\n\
         COLLAPSE_YEAR:  {collapse}\n\
         TIPPING_POINT:  {tipping}\n\
         SOURCE: content/rust_kernels/src/kernels/daly.rs",
        r_final  = last.map(|s| s.1).unwrap_or(r_stock),
        p_final  = last.map(|s| s.2).unwrap_or(p_stock),
        nr_final = last.map(|s| s.3).unwrap_or(nr_stock),
        entropy  = entropy,
        frag     = frag_final,
        eco_debt = eco_debt_pct,
        collapse = collapse_str,
        tipping  = tipping_str,
    ).unwrap();
    out
}
