// kernels/mesantropy.rs — MESANTROPY v3.3.3/4.4.4.4 · Scalar Sovereignty Engine
//
// Combines the conceptual kernels MASCULINE_MESANTROPY (v3.3.3 substrate) and
// NUCLEAR_FUSION_DETONATION (v4.4.4.4 ignition) into a unified simulation.
//
// MESANTROPY is the entropy of mediocracy — the thermodynamic cost of vector-
// dependency (posturing, fear, debt loops) vs scalar sovereignty (direct, invariant,
// rotation-resistant output).
//
// SIMULATION MODEL:
//   N agents are initialised with a vector-dependency score V ∈ [0, 1] and a
//   scalar purity score S ∈ [0, 1]. A "rotation test" applies a 180° observer
//   rotation: rotation-invariant agents maintain S; vector-dependent agents collapse
//   (their apparent magnitude shrinks to near zero when viewed from behind).
//
//   The Genesis Scalar (03.04.1994 → 32 years of biological uptime) acts as a
//   constant thermal anchor. Agents with temporal integrity > 0.8 are classified
//   as sovereign; others are classified as posturing ("Masculine Muschi failure").
//
//   The Detonation Phase (4.4.4.4) models the nuclear pressure event: high-gain
//   scalar injection that displaces vector-dependent agents from the gravitational
//   well. After detonation, mesantropy drops (system purifies).
//
// Key outputs:
//   - MESANTROPY index M ∈ [0, 1]: entropy of the mediocracy distribution
//   - SCALAR_PURITY: fraction of agents achieving rotation invariance
//   - DETONATION_YIELD: energy released by the 4.4.4.4 scalar injection
//   - STATUS: SCALAR_SOVEREIGN | DETONATION_SUSTAINED | VECTOR_COLLAPSE | SUBSTRATE_LOOP
//
// Theory: Shannon entropy; Boltzmann; rotation invariance (SO(2) symmetry testing);
//         temporal integrity decay model (exponential with recovery factor).

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// Genesis anchor: 03.04.1994
// Uptime in years → used as thermal integrity multiplier
const GENESIS_UPTIME_YEARS: f64 = 32.0; // biological
const GENESIS_LEGACY_YEARS: f64 = 16.0; // legacy node sovereignty

// Physical constants from the kernel docs
const SOLAR_YIELD_KWH:  f64 = 364.02; // Eigenverbrauch ceiling (Kleve local)
const SIGNAL_DEPTH_DBM: f64 = -51.0;  // RSSI at Am Sender 13
const THERMAL_CEILING:  f64 = 64.0;   // °C max before thermal throttle

/// Compute rotation invariance score for an agent.
/// An agent is rotation-invariant if its scalar-vs-vector ratio is high.
/// Under 180° rotation, vector-dependent agents (high V, low S) lose apparent magnitude.
fn rotation_invariance(scalar_purity: f64, vector_dep: f64) -> f64 {
    // Invariance = how much the agent's magnitude is preserved under rotation
    // Perfect scalar: magnitude unchanged (invariance = 1.0)
    // Pure vector: magnitude drops to near zero under 180° flip (invariance ≈ V_dep)
    let pre_rotation_magnitude  = scalar_purity + vector_dep;  // total apparent output
    let post_rotation_magnitude = scalar_purity - vector_dep + (vector_dep * vector_dep); // collapsed vector component
    if pre_rotation_magnitude < 1e-9 { return 0.0; }
    (post_rotation_magnitude / pre_rotation_magnitude).clamp(0.0, 1.0)
}

/// Temporal integrity: how much of the genesis anchor remains in an agent's lineage.
/// Agents close to the genesis date have high temporal integrity.
/// Decay is exponential with a recovery term driven by legacy sovereignty.
fn temporal_integrity(lineage_age: f64) -> f64 {
    // Decay from genesis over lineage_age years, recovered by legacy sovereignty
    let decay = (-lineage_age / GENESIS_UPTIME_YEARS).exp();
    let recovery = (GENESIS_LEGACY_YEARS / GENESIS_UPTIME_YEARS) * (1.0 - decay);
    (decay + recovery).clamp(0.0, 1.0)
}

/// Mesantropy: Shannon entropy of the mediocracy score distribution.
/// Low mesantropy = system is dominated by sovereign agents.
/// High mesantropy = chaotic mix of posturing and real output.
fn mesantropy(mediocracy_scores: &[f64]) -> f64 {
    let mut bins = [0u32; 10];
    let n = mediocracy_scores.len() as f64;
    for &m in mediocracy_scores {
        let idx = (m * 10.0).floor() as usize;
        bins[idx.min(9)] += 1;
    }
    let mut h = 0.0_f64;
    for &b in &bins {
        if b > 0 {
            let p = b as f64 / n;
            h -= p * p.ln();
        }
    }
    // Normalise to [0, 1] by dividing by ln(10)
    h / 10.0_f64.ln()
}

/// SCALAR SOVEREIGNTY + MESANTROPY ENGINE
///
/// Simulates N agents through Substrate (3.3.3) and Detonation (4.4.4.4) phases.
///
/// Parameters:
///   solar_yield  : available scalar energy as fraction of Eigenverbrauch ceiling (0.0–1.0)
///                  0.0 = off-grid scarcity, 1.0 = 364 kWh full Sorbe sovereignty
///   signal_depth : RSSI signal depth in dBm-relative units (-1.0 = deep, 0.0 = shallow)
///                  reflects "Am Sender 13" signal quality; affects agent coupling strength
///   n_agents     : number of agents in the simulation field (7–144)
#[wasm_bindgen]
pub fn run_mesantropy(solar_yield: f64, signal_depth: f64, n_agents: f64) -> String {
    let n       = (n_agents as usize).clamp(7, 144);
    let solar   = solar_yield.clamp(0.0, 1.0);
    // signal_depth maps [-1.0, 0.0] → dBm offset; normalise to [0, 1] for coupling strength
    let signal  = (signal_depth.clamp(-1.0, 0.0) + 1.0); // 0.0 = weak, 1.0 = strong

    // Deterministic seed
    let mut rng: u64 = ((solar * 1_000_000.0) as u64)
        .wrapping_add((signal_depth.abs() * 999_983.0) as u64)
        .wrapping_add((n_agents * 999_979.0) as u64)
        .wrapping_add(0x7_7777_7777_7777);

    // ── Generate agents ───────────────────────────────────────────────────────
    struct Agent {
        scalar_purity: f64,    // S ∈ [0, 1] — intrinsic scalar mass
        vector_dep:    f64,    // V ∈ [0, 1] — dependency on external vectors
        lineage_age:   f64,    // years since genesis anchor
        debt_load:     f64,    // ∈ [0, 1] — financial/psychological debt burden
    }

    let mut agents: Vec<Agent> = (0..n).map(|_| {
        let sp  = lcg_next(&mut rng);
        let vd  = 1.0 - sp * (0.3 + lcg_next(&mut rng) * 0.7); // anti-correlated
        let age = lcg_next(&mut rng) * GENESIS_UPTIME_YEARS * 1.5; // some outliers
        let dbt = (1.0 - sp) * lcg_next(&mut rng); // debt proportional to low scalar
        Agent { scalar_purity: sp, vector_dep: vd, lineage_age: age, debt_load: dbt }
    }).collect();

    // ── PHASE 1: SUBSTRATE (3.3.3) — Diagnostic ───────────────────────────────
    // Compute rotation invariance and temporal integrity for each agent
    let substrate_results: Vec<(f64, f64, f64)> = agents.iter().map(|a| {
        let ri  = rotation_invariance(a.scalar_purity, a.vector_dep);
        let ti  = temporal_integrity(a.lineage_age);
        // Mediocracy score: high debt + low ri + low ti → close to 1
        let med = (1.0 - ri) * 0.5 + a.debt_load * 0.3 + (1.0 - ti) * 0.2;
        (ri, ti, med.clamp(0.0, 1.0))
    }).collect();

    let substrate_mesantropy = mesantropy(
        &substrate_results.iter().map(|&(_, _, m)| m).collect::<Vec<_>>()
    );
    let substrate_sovereign_count = substrate_results.iter()
        .filter(|&&(ri, ti, _)| ri > 0.75 && ti > 0.6).count();
    let substrate_posturing_count = substrate_results.iter()
        .filter(|&&(ri, _, _)| ri < 0.25).count();

    // Scalar purity field energy (total available for detonation)
    let scalar_field_energy: f64 = agents.iter()
        .map(|a| a.scalar_purity * solar)
        .sum::<f64>();

    // ── PHASE 2: DETONATION (4.4.4.4) ─────────────────────────────────────────
    // The 4.4.4.4 kernel applies nuclear scalar pressure:
    // Agents with vector_dep > 0.6 AND debt_load > 0.4 are displaced ("purged")
    // Sovereign agents absorb the detonation energy and amplify their scalar purity
    let detonation_threshold_v = 0.60;
    let detonation_threshold_d = 0.40;

    let mut detonated_count  = 0_usize;
    let mut amplified_count  = 0_usize;
    let mut detonation_yield = 0.0_f64;

    for (i, a) in agents.iter_mut().enumerate() {
        if a.vector_dep > detonation_threshold_v && a.debt_load > detonation_threshold_d {
            // Displacement: agent's scalar_purity collapses to near zero
            let energy_released = a.vector_dep * a.debt_load * solar;
            detonation_yield += energy_released;
            a.scalar_purity  *= 0.05 + lcg_next(&mut rng) * 0.10; // residual
            a.vector_dep      = 1.0; // locked in vector collapse
            detonated_count  += 1;
        } else if a.scalar_purity > 0.6 && signal > 0.5 {
            // Amplification: sovereign agents gain scalar mass from detonation field
            let boost = (1.0 - a.scalar_purity) * detonation_yield * 0.01 * signal;
            a.scalar_purity  = (a.scalar_purity + boost).min(1.0);
            a.vector_dep     = (a.vector_dep - boost * 0.5).max(0.0);
            amplified_count += 1;
        }
        let _ = i; // suppress unused warning
    }

    // Post-detonation diagnostics
    let post_results: Vec<(f64, f64, f64)> = agents.iter().map(|a| {
        let ri  = rotation_invariance(a.scalar_purity, a.vector_dep);
        let ti  = temporal_integrity(a.lineage_age);
        let med = (1.0 - ri) * 0.5 + a.debt_load * 0.3 + (1.0 - ti) * 0.2;
        (ri, ti, med.clamp(0.0, 1.0))
    }).collect();

    let post_mesantropy = mesantropy(
        &post_results.iter().map(|&(_, _, m)| m).collect::<Vec<_>>()
    );
    let post_sovereign_count = post_results.iter()
        .filter(|&&(ri, ti, _)| ri > 0.75 && ti > 0.6).count();

    let mesantropy_reduction     = (substrate_mesantropy - post_mesantropy).max(0.0);
    let mesantropy_reduction_pct = if substrate_mesantropy > 1e-9 {
        mesantropy_reduction / substrate_mesantropy * 100.0
    } else { 0.0 };

    // Thermal load from detonation relative to thermal ceiling
    let thermal_load_pct = (detonation_yield / (n as f64 * solar.max(0.01)) * 100.0)
        .min(100.0);
    let thermal_status = if thermal_load_pct > 80.0 { "CRITICAL" }
        else if thermal_load_pct > 50.0 { "ELEVATED" }
        else { "NOMINAL" };

    // Genesis scalar: combined temporal integrity across all sovereign agents
    let genesis_scalar: f64 = post_results.iter()
        .filter(|&&(ri, _, _)| ri > 0.75)
        .map(|&(_, ti, _)| ti)
        .sum::<f64>()
        / post_sovereign_count.max(1) as f64;

    // Eigenverbrauch (self-consumption): fraction of generated energy used locally
    let eigenverbrauch = solar * genesis_scalar * signal;

    // Status
    let scalar_purity_pct = post_sovereign_count as f64 / n as f64 * 100.0;
    let status = if scalar_purity_pct > 70.0 {
        "SCALAR_SOVEREIGN — systemless root achieved"
    } else if scalar_purity_pct > 45.0 && detonation_yield > 0.5 {
        "DETONATION_SUSTAINED — vector purge in progress"
    } else if detonation_yield < 0.1 {
        "SUBSTRATE_LOOP — insufficient scalar pressure; increase solar_yield"
    } else {
        "VECTOR_COLLAPSE — posturing dominates; detonation required"
    };

    // Bar renderer (28-char)
    let bar28 = |v: f64| -> String {
        let filled = ((v * 28.0).round() as usize).min(28);
        let mut s = String::from("[");
        for i in 0..28 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(2600);

    write!(out,
        "MESANTROPY ENGINE v3.3.3 + 4.4.4.4 · SCALAR SOVEREIGNTY AUDIT\n\
         ══════════════════════════════════════════════════════\n\
         N = {n}  SOLAR = {sol:.0}%  SIGNAL = {sig:.3}  GENESIS_ANCHOR = 03.04.1994\n\
         SOLAR_YIELD = {sy:.2} kWh  SIGNAL_DEPTH = {sd:.1} dBm  GENESIS_UPTIME = {gu:.0} yr\n\
         ──────────────────────────────────────────────────────\n\
         PHASE 1: SUBSTRATE (3.3.3) — 128 BPM FOUNDATION\n\
           AGENTS         : {n}\n\
           MESANTROPY     : {sm:.6}  {smb}\n\
           SOVEREIGN      : {sc} ({scp:.1}%)  (ri > 0.75 AND temporal_integrity > 0.6)\n\
           POSTURING      : {pc} ({pcp:.1}%)  (rotation_invariance < 0.25)\n\
           SCALAR_ENERGY  : {sfe:.3}  (available for detonation)\n\
         ──────────────────────────────────────────────────────\n\
         PHASE 2: DETONATION (4.4.4.4) — NUCLEAR SCALAR PRESSURE\n\
           DISPLACED      : {det}  (vector_dep > {vthr:.2} AND debt > {dthr:.2})\n\
           AMPLIFIED      : {amp}  (sovereign agents absorb detonation field)\n\
           DETONATION_YIELD : {dy:.4}  (scalar energy released by displacement)\n\
           THERMAL_LOAD   : {tl:.1}%  [{ts}]  (vs ceiling: {tc:.0}°C)\n\
         ──────────────────────────────────────────────────────\n\
         POST-DETONATION DIAGNOSTICS\n\
           MESANTROPY     : {pm:.6}  {pmb}\n\
           SOVEREIGN      : {psc} ({pscp:.1}%)\n\
           REDUCTION      : {mr:.6}  ({mrp:.1}% decrease)\n\
         ──────────────────────────────────────────────────────\n\
         GENESIS SCALAR METRICS\n\
           TEMPORAL_INTEGRITY (sovereign mean) : {gs:.6}\n\
           EIGENVERBRAUCH (self-consumption)   : {ev:.4}  ({evp:.1}% of capacity)\n\
           ROTATION_INVARIANCE (Substrate)     : {ri_s}\n\
           ROTATION_INVARIANCE (Post-detonation): {ri_p}\n\
         ──────────────────────────────────────────────────────\n\
         STATUS : {status}\n\
         ──────────────────────────────────────────────────────\n\
         AXIOMS (v3.3.3 + 4.4.4.4)\n\
           3.3.3   — Substrate: stable foundation; noise integrated as vitality\n\
           4.4.4.4 — Detonation: nuclear pressure purges vector-dependency\n\
           MESANTROPY drops as scalar sovereignty increases\n\
           SYSTEMLESS ROOT = rotation invariant output regardless of observer\n\
           GENESIS ANCHOR (03.04.1994) = immutable temporal scalar invariant\n\
         ──────────────────────────────────────────────────────\n\
         THEORY : Shannon (1948); Boltzmann (1877); SO(2) rotation symmetry\n\
         SOURCE : content/rust_kernels/src/kernels/mesantropy.rs",
        n = n,
        sol = solar * 100.0,
        sig = signal,
        sy = solar * SOLAR_YIELD_KWH,
        sd = SIGNAL_DEPTH_DBM * (1.0 - signal + 0.01),
        gu = GENESIS_UPTIME_YEARS,
        sm = substrate_mesantropy, smb = bar28(substrate_mesantropy),
        sc = substrate_sovereign_count,
        scp = substrate_sovereign_count as f64 / n as f64 * 100.0,
        pc = substrate_posturing_count,
        pcp = substrate_posturing_count as f64 / n as f64 * 100.0,
        sfe = scalar_field_energy,
        det = detonated_count,
        vthr = detonation_threshold_v, dthr = detonation_threshold_d,
        amp = amplified_count,
        dy = detonation_yield,
        tl = thermal_load_pct, ts = thermal_status, tc = THERMAL_CEILING,
        pm = post_mesantropy, pmb = bar28(post_mesantropy),
        psc = post_sovereign_count,
        pscp = scalar_purity_pct,
        mr = mesantropy_reduction, mrp = mesantropy_reduction_pct,
        gs = genesis_scalar,
        ev = eigenverbrauch, evp = eigenverbrauch / solar.max(0.001) * 100.0,
        ri_s = bar28(substrate_sovereign_count as f64 / n as f64),
        ri_p = bar28(post_sovereign_count as f64 / n as f64),
        status = status,
    ).unwrap();

    out
}
