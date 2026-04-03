// kernels/chrono_actuary.rs — Chrono-Actuary Kernel v2.0.0
// Deep-Time Audit Framework · Thermodynamic Landlord · River Sovereign
//
// Five modules execute in sequence:
//   01 · Dissolved Oxygen Ledger     (Garcia-Benson + Streeter-Phelps)
//   02 · Thermal Rent Calculation    (Q10 + IPCC AR6 end-of-license projection)
//   03 · Nutrient Debt Accounting    (EPI + Redfield + Nitrate)
//   04 · Hydraulic Sovereignty       (Tennant method flow audit)
//   05 · Langelier Saturation Index  (carbonate chemistry)
//
// Permit ruling derived from aggregate of all five fiscal indicators.
use wasm_bindgen::prelude::*;

/// Run the Chrono-Actuary deep-time audit engine.
///
/// temp_c:        baseline water temperature °C          (default 15.0)
/// do_conc:       current DO concentration mg/L          (default 8.5)
/// bod_load:      initial BOD at discharge point mg/L    (default 5.0)
/// delta_t:       project thermal discharge delta °C     (default 2.0)
/// epi:           Eutrophication Potential Index         (default 0.8)
/// nitrate:       Nitrate-N concentration mg/L           (default 2.0)
/// flow_ratio:    Q_project / Q_mean_annual              (default 0.4)
/// lsi:           Langelier Saturation Index             (default 0.1)
/// license_years: permit duration — IPCC projection horizon (default 30.0)
/// human_profit:  reported project profit EUR            (default 1_000_000.0)
#[wasm_bindgen]
pub fn run_chrono_actuary(
    temp_c: f64,
    do_conc: f64,
    bod_load: f64,
    delta_t: f64,
    epi: f64,
    nitrate: f64,
    flow_ratio: f64,
    lsi: f64,
    license_years: f64,
    human_profit: f64,
) -> String {
    // ── MODULE 01 · DISSOLVED OXYGEN LEDGER ───────────────────────────────────
    // Garcia-Benson DO saturation (freshwater, salinity = 0)
    let t_k = temp_c + 273.15;
    let do_sat = f64::exp(
        -139.344_11
            + (157_570.1 / t_k)
            - (66_423_080.0 / (t_k * t_k))
            + (1.243_8e10 / (t_k * t_k * t_k))
            - (8.621_949e11 / (t_k * t_k * t_k * t_k)),
    );

    // Streeter-Phelps K_d and K_r — temperature-corrected (van't Hoff base)
    let k_d = 0.23 * f64::powf(1.047, temp_c - 20.0); // deoxygenation rate day⁻¹
    let k_r = 0.40 * f64::powf(1.024, temp_c - 20.0); // reaeration rate day⁻¹
    let d_0 = f64::max(0.0, do_sat - do_conc);         // initial deficit mg/L

    // Critical time: DO minimum downstream
    let t_crit = if (k_r - k_d).abs() > 1e-9 && bod_load > 0.0 {
        let inner = (k_r / k_d) * (1.0 - d_0 * (k_r - k_d) / (k_d * bod_load));
        if inner > 0.0 {
            f64::max(0.01, (1.0 / (k_r - k_d)) * inner.ln())
        } else {
            1.0
        }
    } else {
        1.0
    };

    // DO at the critical sag point
    let do_deficit_crit = (k_d * bod_load / (k_r - k_d))
        * (f64::exp(-k_d * t_crit) - f64::exp(-k_r * t_crit))
        + d_0 * f64::exp(-k_r * t_crit);
    let do_min = f64::max(0.0, do_sat - do_deficit_crit);

    let (do_status, do_signal) = if do_min > 8.0 {
        ("RESERVE_CURRENCY", "✓ GREEN")
    } else if do_min > 6.0 {
        ("INFLATION_WARNING", "⚠ AMBER")
    } else if do_min > 4.0 {
        ("DEBT_SPIRAL", "✗ RED")
    } else if do_min > 2.0 {
        ("SYSTEMIC_BANKRUPTCY", "✗✗ VETO")
    } else {
        ("ABSOLUTE_ZERO", "ᛉ EMERGENCY")
    };

    // ── MODULE 02 · THERMAL RENT CALCULATION ──────────────────────────────────
    // van't Hoff Q10 BOD multiplier (Q10 = 2.0)
    let bod_multiplier = f64::powf(2.0_f64, delta_t / 10.0);

    // IPCC AR6 Central Europe RCP 8.5: +4.5°C by 2100 from 2025 baseline
    let ipcc_regional = 4.5_f64;
    let eol_climate_delta = ipcc_regional * (license_years / 75.0);
    let eol_total_delta = delta_t + eol_climate_delta; // total thermal rent at EOL

    let (thermal_status, thermal_signal) = if delta_t > 8.0 || eol_total_delta > 8.0 {
        ("THERMAL_ARSON_EMERGENCY", "ᛉ EMERGENCY")
    } else if delta_t > 5.0 || eol_total_delta > 5.0 {
        ("THERMAL_ARSON", "✗✗ VETO")
    } else if delta_t > 3.0 {
        ("THERMAL_OVERRUN", "✗ RED")
    } else if delta_t > 1.5 {
        ("THERMAL_STRESS", "⚠ AMBER")
    } else {
        ("THERMAL_SOLVENT", "✓ GREEN")
    };

    // ── MODULE 03 · NUTRIENT DEBT ACCOUNTING ──────────────────────────────────
    let (epi_status, epi_signal) = if epi < 1.0 {
        ("WITHIN_CAPACITY", "✓ GREEN")
    } else if epi < 2.0 {
        ("EUTROPHICATION_ONSET", "⚠ AMBER")
    } else if epi < 5.0 {
        ("ACTIVE_EUTROPHICATION", "✗ RED")
    } else {
        ("HYPERTROPHIC_COLLAPSE", "✗✗ VETO")
    };

    let (nitrate_status, nitrate_signal) = if nitrate < 1.0 {
        ("OLIGOTROPHIC", "✓ GREEN")
    } else if nitrate < 5.0 {
        ("MESOTROPHIC", "✓ GREEN")
    } else if nitrate < 11.3 {
        ("EUTROPHIC_ONSET", "⚠ AMBER")
    } else {
        ("TOXIC_ASSET", "✗✗ VETO")
    };

    // ── MODULE 04 · HYDRAULIC SOVEREIGNTY ─────────────────────────────────────
    // Tennant method: flow_ratio = Q / Q_mean_annual
    let (hydro_status, hydro_signal) = if flow_ratio < 0.10 {
        ("HYDRAULIC_BANKRUPTCY", "✗✗ VETO")
    } else if flow_ratio < 0.30 {
        ("BELOW_VIABLE_HABITAT", "✗ RED")
    } else if flow_ratio < 0.60 {
        ("VIABLE_HABITAT", "⚠ AMBER")
    } else {
        ("OPTIMAL_FLOW_REGIME", "✓ GREEN")
    };

    // ── MODULE 05 · LANGELIER SATURATION INDEX ────────────────────────────────
    let (lsi_status, lsi_signal) = if lsi > 0.5 {
        ("SCALING_PRECIPITATION", "⚠ AMBER")
    } else if lsi > -0.5 {
        ("CARBONATE_EQUILIBRIUM", "✓ GREEN")
    } else if lsi > -1.0 {
        ("CORROSIVE_DISSOLUTION", "✗ RED")
    } else {
        ("STRUCTURAL_DISSOLUTION", "✗✗ VETO")
    };

    // ── PERMIT RULING ─────────────────────────────────────────────────────────
    let signals = [
        do_signal,
        thermal_signal,
        epi_signal,
        nitrate_signal,
        hydro_signal,
        lsi_signal,
    ];
    let emergency_count = signals
        .iter()
        .filter(|s| s.contains("EMERGENCY"))
        .count();
    let veto_count = signals
        .iter()
        .filter(|s| s.contains("VETO"))
        .count();
    let red_count = signals.iter().filter(|s| s.contains("RED")).count();
    let amber_count = signals.iter().filter(|s| s.contains("AMBER")).count();

    let (permit_code, ruling) = if emergency_count > 0 {
        (
            "EMERGENCY_VETO",
            "Immediate cessation order. Emergency threshold breached. \
             The River Sovereign invokes emergency powers. No conditions apply.",
        )
    } else if veto_count > 0 {
        (
            "REJECTED",
            "Hard refusal. Veto threshold breached. No permit conditions can \
             remediate a thermodynamic debt of this magnitude.",
        )
    } else if red_count > 0 {
        (
            "DEFERRED",
            "12-month remediation required. Red indicators must be resolved \
             before resubmission. The ledger does not clear on paper commitments.",
        )
    } else if amber_count > 1 {
        (
            "CONDITIONAL",
            "Approved with binding mitigation schedule. Non-compliance triggers \
             automatic downgrade to REJECTED. The Sovereign monitors.",
        )
    } else {
        (
            "GRANTED",
            "All five modules within carrying capacity. The River Sovereign \
             acknowledges solvency. Proceed under continuous monitoring.",
        )
    };

    // ── ECOLOGICAL DEBT MONETISATION ──────────────────────────────────────────
    // Order-of-magnitude fiscal audit (EUR, indicative)
    //
    // DO debt must account for post-discharge temperature: thermal delta
    // reduces DO saturation, worsening the oxygen sag downstream.
    let post_temp = temp_c + delta_t;
    let post_t_k = post_temp + 273.15;
    let post_do_sat = f64::exp(
        -139.344_11
            + (157_570.1 / post_t_k)
            - (66_423_080.0 / (post_t_k * post_t_k))
            + (1.243_8e10 / (post_t_k * post_t_k * post_t_k))
            - (8.621_949e11 / (post_t_k * post_t_k * post_t_k * post_t_k)),
    );
    let post_k_d = 0.23 * f64::powf(1.047, post_temp - 20.0);
    let post_k_r = 0.40 * f64::powf(1.024, post_temp - 20.0);
    let post_d_0 = f64::max(0.0, post_do_sat - do_conc);
    let post_t_crit = if (post_k_r - post_k_d).abs() > 1e-9 && bod_load > 0.0 {
        let inner = (post_k_r / post_k_d) * (1.0 - post_d_0 * (post_k_r - post_k_d) / (post_k_d * bod_load));
        if inner > 0.0 {
            f64::max(0.01, (1.0 / (post_k_r - post_k_d)) * inner.ln())
        } else {
            1.0
        }
    } else {
        1.0
    };
    let post_deficit = (post_k_d * bod_load / (post_k_r - post_k_d))
        * (f64::exp(-post_k_d * post_t_crit) - f64::exp(-post_k_r * post_t_crit))
        + post_d_0 * f64::exp(-post_k_r * post_t_crit);
    let post_do_min = f64::max(0.0, post_do_sat - post_deficit);

    // Use the worse of baseline and post-discharge DO for debt calculation
    let effective_do_min = f64::min(do_min, post_do_min);
    let do_debt = if effective_do_min < 6.0 {
        (6.0 - effective_do_min) * 50_000.0
    } else {
        0.0
    };
    let thermal_debt = if delta_t > 1.5 {
        delta_t * 80_000.0
    } else {
        0.0
    };
    let nutrient_debt = if epi > 1.0 { epi * 120_000.0 } else { 0.0 };
    // Flood liability: low-flow regimes (< 0.30 Tennant) with any thermal load,
    // OR extreme flow events (> 10× Qmean) indicating flood-regime liability
    let flood_liability = if flow_ratio < 0.30 && delta_t > 0.0 {
        delta_t * 200_000.0
    } else if flow_ratio > 10.0 {
        (flow_ratio - 10.0) * 30_000.0
    } else {
        0.0
    };
    let eco_total = do_debt + thermal_debt + nutrient_debt + flood_liability;
    let npv = human_profit - eco_total;
    let npv_label = if npv >= 0.0 {
        format!("SOLVENT  +{:.0} EUR", npv)
    } else {
        format!("INSOLVENT {:.0} EUR", npv)
    };

    format!(
        "ᛟ CHRONO-ACTUARY v2.0.0 // BOOT_OK\n\
         OFFICE OF THE RIVER SOVEREIGN · DEEP-TIME AUDIT BUREAU\n\
         \n\
         ── MODULE 01 · DISSOLVED OXYGEN LEDGER ────────────────────\n\
         TEMP: {:.1}°C  DO_SAT: {:.2} mg/L  DO_MIN: {:.2} mg/L\n\
         K_d: {:.4}/day  K_r: {:.4}/day  T_CRIT: {:.2} days\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 02 · THERMAL RENT ────────────────────────────────\n\
         ΔT_PROJECT: +{:.1}°C  BOD×Q10: ×{:.3}  LICENSE: {:.0} yr\n\
         EOL_CLIMATE: +{:.2}°C (IPCC RCP8.5)  EOL_TOTAL: +{:.2}°C\n\
         STATUS: {}  [{}]\n\
         \n\
         ── MODULE 03 · NUTRIENT DEBT ───────────────────────────────\n\
         EPI: {:.3}  →  {}  [{}]\n\
         NITRATE-N: {:.2} mg/L  →  {}  [{}]\n\
         \n\
         ── MODULE 04 · HYDRAULIC SOVEREIGNTY ──────────────────────\n\
         FLOW_RATIO: {:.3} Q/Qmean  STATUS: {}  [{}]\n\
         \n\
         ── MODULE 05 · LANGELIER SATURATION INDEX ──────────────────\n\
         LSI: {:.3}  STATUS: {}  [{}]\n\
         \n\
         ── FISCAL LEDGER ───────────────────────────────────────────\n\
         HUMAN_PROFIT:    {:>14.0} EUR\n\
         DO_DEBT:         {:>14.0} EUR\n\
         THERMAL_DEBT:    {:>14.0} EUR\n\
         NUTRIENT_DEBT:   {:>14.0} EUR\n\
         FLOOD_LIABILITY: {:>14.0} EUR\n\
         ECO_TOTAL:       {:>14.0} EUR\n\
         NPV_TRUE:        {}\n\
         \n\
         ── RULING ──────────────────────────────────────────────────\n\
         {}\n\
         PERMIT: [{}]\n\
         \n\
         SOURCE: content/rust_kernels/src/kernels/chrono_actuary.rs",
        // M01
        temp_c, do_sat, do_min,
        k_d, k_r, t_crit,
        do_status, do_signal,
        // M02
        delta_t, bod_multiplier, license_years,
        eol_climate_delta, eol_total_delta,
        thermal_status, thermal_signal,
        // M03
        epi, epi_status, epi_signal,
        nitrate, nitrate_status, nitrate_signal,
        // M04
        flow_ratio, hydro_status, hydro_signal,
        // M05
        lsi, lsi_status, lsi_signal,
        // fiscal
        human_profit, do_debt, thermal_debt, nutrient_debt, flood_liability, eco_total, npv_label,
        // ruling
        ruling, permit_code,
    )
}
