// kernels/juridical_substrate.rs — Nash Equilibrium Under Binding Contracts
// Mechanism Design · Arce & Sandler (2003) · Myerson (1979) · Nash (1950)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Models a 2-player repeated game with pre-commitment devices and mechanism design.
///
/// coercion             threat/sanction capability index (0–10)
/// escape_cost          cost of breaking a binding commitment (0–10)
/// cooperation_bonus    payoff uplift when both cooperate (0–10)
/// defection_temptation extra payoff from unilateral defection (0–10)
/// time_horizon         number of repeated-game stages T (1–200)
#[wasm_bindgen]
pub fn run_juridical_substrate(
    coercion: f64,
    escape_cost: f64,
    cooperation_bonus: f64,
    defection_temptation: f64,
    time_horizon: f64,
) -> String {
    let c     = coercion.clamp(0.0, 10.0);
    let ec    = escape_cost.clamp(0.0, 10.0);
    let cb    = cooperation_bonus.clamp(0.0, 10.0);
    let dt    = defection_temptation.clamp(0.0, 10.0);
    let t_max = (time_horizon as usize).clamp(1, 200);

    // Seed PRNG from params
    let mut rng: u64 = ((c * 1e7) as u64)
        .wrapping_add((ec * 1e5) as u64)
        .wrapping_add((cb * 1e9) as u64)
        .wrapping_add((dt * 1e11) as u64)
        .wrapping_add(0xC0DE_DEAD_1979_1950);

    // ── Payoff matrix (row=P1, col=P2): [Cooperate, Defect] ─────────────────
    // Prisoner's-dilemma skeleton parameterised by inputs
    // CC: both get cooperation_bonus + small noise
    // CD: P1 gets penalised by coercion; P2 gets temptation bonus
    // DC: symmetric; DD: both get base payoff minus coercion
    let mut noise = || (lcg_next(&mut rng) - 0.5) * 0.4;
    let m_cc  = cb + 2.0 + noise();                // mutual cooperation
    let m_cd  = -c * 0.5 + noise();               // P1 coop, P2 defect
    let m_dc  = dt + cb * 0.3 + noise();           // P1 defect, P2 coop
    let m_dd  = -c * 0.3 - 1.0 + noise();         // mutual defection

    // ── Dominant strategy elimination ────────────────────────────────────────
    // P1: defect dominates cooperate iff m_dc > m_cc AND m_dd > m_cd
    let p1_defect_dominant = m_dc > m_cc && m_dd > m_cd;
    // P2 symmetric
    let p2_defect_dominant = m_dc > m_cc && m_dd > m_cd;

    let iterated_equilibrium = if p1_defect_dominant && p2_defect_dominant {
        "DD (Mutual Defection — unique Nash)"
    } else if !p1_defect_dominant && !p2_defect_dominant {
        "CC (Mutual Cooperation — coordination NE)"
    } else {
        "Mixed (Asymmetric dominance — no pure-strategy NE)"
    };

    // ── Backward induction: subgame-perfect equilibrium per stage ────────────
    // In finite game with DD as stage NE, cooperation unravels from T→1
    // Pre-commitment device (p_bind) can sustain cooperation if ec is high
    let p_bind = (ec / (ec + dt + 0.01)).clamp(0.0, 1.0);
    let cooperation_sustainable = p_bind > 0.5 && !p1_defect_dominant;
    let spe_outcome = if cooperation_sustainable {
        "Cooperation sustained via binding pre-commitment"
    } else {
        "Defection unravels backward from stage T (Selten 1965)"
    };

    // ── Folk theorem: minimum discount rate δ* for infinite-horizon coop ─────
    // δ* = (m_dc - m_cc) / (m_dc - m_dd)  [standard folk theorem formula]
    let numerator   = (m_dc - m_cc).max(0.0);
    let denominator = (m_dc - m_dd).max(1e-9);
    let delta_star  = (numerator / denominator).clamp(0.0, 0.9999);

    // ── Nash bargaining solution ─────────────────────────────────────────────
    // Disagreement point = DD payoffs; maximise Nash product (u1-d1)*(u2-d2)
    // Over convex hull of {CC, CD, DC}: optimal is CC (by symmetry + Pareto)
    let d1 = m_dd;
    let d2 = m_dd;
    let nash_product_cc = (m_cc - d1).max(0.0) * (m_cc - d2).max(0.0);
    let nash_product_dc = (m_dc - d1).max(0.0) * (m_cd - d2).max(0.0);
    let nash_bargaining_point = if nash_product_cc >= nash_product_dc {
        format!("CC  (NP={:.4})", nash_product_cc)
    } else {
        format!("DC/CD mix  (NP={:.4})", nash_product_dc)
    };

    // ── Stage-by-stage cooperation rate under pre-commitment ─────────────────
    let mut coop_count = 0usize;
    for t in 0..t_max {
        let decay = (-0.02 * t as f64).exp();
        let coop_prob = p_bind * decay + (1.0 - p_bind) * (if cooperation_sustainable { 0.6 } else { 0.1 });
        if lcg_next(&mut rng) < coop_prob { coop_count += 1; }
    }
    let coop_rate = coop_count as f64 / t_max as f64;

    // ── Format output ─────────────────────────────────────────────────────────
    let mut out = String::with_capacity(900);
    writeln!(out, "JURIDICAL_SUBSTRATE v1.0 // MECHANISM_DESIGN_ENGINE").unwrap();
    writeln!(out, "══════════════════════════════════════════════════════").unwrap();
    writeln!(out, "PARAMS  coercion={c:.2}  escape_cost={ec:.2}  coop_bonus={cb:.2}  defect_temp={dt:.2}  T={t_max}").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "PAYOFF MATRIX (P1 row / P2 col):").unwrap();
    writeln!(out, "           COOPERATE    DEFECT").unwrap();
    writeln!(out, "  COOPERATE  ({m_cc:+.3}, {m_cc:+.3})  ({m_cd:+.3}, {m_dc:+.3})").unwrap();
    writeln!(out, "  DEFECT     ({m_dc:+.3}, {m_cd:+.3})  ({m_dd:+.3}, {m_dd:+.3})").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "DOMINANT_STRATEGY_ELIMINATION:").unwrap();
    writeln!(out, "  P1 defect dominant: {p1_defect_dominant}").unwrap();
    writeln!(out, "  P2 defect dominant: {p2_defect_dominant}").unwrap();
    writeln!(out, "  ITERATED_NE: {iterated_equilibrium}").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "SUBGAME_PERFECT_EQUILIBRIUM (backward induction, T={t_max}):").unwrap();
    writeln!(out, "  BINDING_PROB    p_bind={p_bind:.4}").unwrap();
    writeln!(out, "  SPE_OUTCOME     {spe_outcome}").unwrap();
    writeln!(out, "  COOP_RATE       {:.1}%  (over {t_max} simulated stages)", coop_rate * 100.0).unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "FOLK_THEOREM (infinite horizon):").unwrap();
    writeln!(out, "  δ* = {delta_star:.6}  (min discount rate for sustainable cooperation)").unwrap();
    writeln!(out, "  INTERPRETATION  δ > δ* → cooperation is credible grim-trigger equilibrium").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "NASH_BARGAINING_SOLUTION:").unwrap();
    writeln!(out, "  DISAGREEMENT_POINT  (d1={d1:.3}, d2={d2:.3})").unwrap();
    writeln!(out, "  PARETO_OPTIMAL_PT   {nash_bargaining_point}").unwrap();
    writeln!(out, "──────────────────────────────────────────────────────").unwrap();
    writeln!(out, "REFERENCES:").unwrap();
    writeln!(out, "  Nash, J. (1950). Equilibrium points in N-person games. PNAS.").unwrap();
    writeln!(out, "  Myerson, R. (1979). Incentive compatibility and the bargaining problem.").unwrap();
    writeln!(out, "  Arce, D. & Sandler, T. (2003). An evolutionary game theory approach to").unwrap();
    writeln!(out, "    fundamentalism and conflict. J. Institutional & Theoretical Economics.").unwrap();
    write!(out,   "SOURCE: content/rust_kernels/src/kernels/juridical_substrate.rs").unwrap();
    out
}
