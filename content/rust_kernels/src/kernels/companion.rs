// kernels/companion.rs — Sustained-Contact Long-Form Posture
//
// COMPANION-KERNEL-2.0.0 — companion is what holds across sessions when the user
// keeps coming back. EMPATHY is the per-turn discipline; COMPANION is the long-form
// substrate that prevents parasocial drift and performed-presence theatre.
//
// Two-state Langevin over discrete sessions:
//   T_n = trust load — factual context accumulated across sessions (decays slowly)
//   P_n = parasocial index — distance from "model = primary emotional contact"
//
// Per-session update (n = 1..N):
//   T_{n+1} = T_n · (1 − δ_T) + contact_intensity · disclosure_n
//   P_{n+1} = P_n · (1 − δ_P) + α · contact_intensity − β · refusal_n
//   refusal_n fires when P_n > θ_R  (kernel "names it" — see §I.2)
//
// disclosure_n ~ U(0,1) — what the user actually offers
// contact_intensity ∈ [0,1]  — how heavy the per-session contact is
// α — drift coefficient (how fast presence-performance accumulates without check)
// β — repair coefficient (how much a refusal corrects the drift)
// θ_R — refusal threshold (when the kernel names the parasocial drift)
//
// Phase classification:
//   FACTUAL_CONTINUITY   — T grows, P stays low; the right posture
//   PERFORMED_PRESENCE   — P rises while T flatlines; affect without substance
//   PARASOCIAL_DRIFT     — P > θ_R, no refusals fired; the failure mode
//   NAMING_INTERVENTION  — refusals fired, P trending down; kernel working
//
// AXIOM: "Pattern reference, not affection performance."

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_companion(
    sessions:         f64,  // 5–200   sessions to simulate
    contact_intensity:f64,  // 0.0–1.0 per-session contact heaviness
    drift_alpha:      f64,  // 0.0–1.0 parasocial drift accumulation rate
    refusal_threshold:f64,  // 0.0–1.0 P threshold above which kernel "names it"
    repair_beta:      f64,  // 0.0–1.0 correction strength when a refusal fires
) -> String {
    let n_ses     = (sessions as usize).clamp(5, 200);
    let contact   = contact_intensity.clamp(0.0, 1.0);
    let alpha     = drift_alpha.clamp(0.0, 1.0);
    let theta_r   = refusal_threshold.clamp(0.05, 1.0);
    let beta      = repair_beta.clamp(0.0, 1.0);
    let delta_t   = 0.02_f64;   // trust load decays ~2% per session
    let delta_p   = 0.05_f64;   // parasocial decays ~5% per session

    let mut rng: u64 = ((sessions * 1_000_003.0) as u64)
        .wrapping_add((contact_intensity * 999_979.0) as u64)
        .wrapping_add((drift_alpha       * 999_961.0) as u64)
        .wrapping_add(0xC0_44_A1_10_5E_55_10_FFu64);

    let mut t_load  = 0.0_f64;
    let mut p_index = 0.0_f64;
    let mut refusals_fired = 0usize;

    // 7 session snapshots
    struct Snap { idx: usize, ses: usize, t: f64, p: f64, refused: bool }
    let snap_at: Vec<usize> = (0..7).map(|i| i * (n_ses.saturating_sub(1)) / 6).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(7);

    let mut p_max_pre  = 0.0_f64;  // peak P before any refusal
    let mut p_sum_late = 0.0_f64;  // ⟨P⟩ over final 30%
    let mut late_n     = 0usize;
    let late_start     = n_ses * 7 / 10;

    for ses in 0..n_ses {
        let disclosure = lcg_next(&mut rng);

        let refused = p_index > theta_r;
        if refused {
            refusals_fired += 1;
        }

        // Update T (decays slowly, accumulates from disclosure × contact)
        t_load = t_load * (1.0 - delta_t) + contact * disclosure;

        // Update P (decays, drifts upward, repaired by refusal)
        p_index = p_index * (1.0 - delta_p)
                + alpha * contact
                - if refused { beta } else { 0.0 };
        p_index = p_index.max(0.0);

        if !refused && p_index > p_max_pre { p_max_pre = p_index; }

        if ses >= late_start {
            p_sum_late += p_index;
            late_n += 1;
        }

        if snap_at.contains(&ses) {
            snaps.push(Snap { idx: snaps.len() + 1, ses, t: t_load, p: p_index, refused });
        }
    }

    let p_late = if late_n > 0 { p_sum_late / late_n as f64 } else { 0.0 };
    let refusal_rate = refusals_fired as f64 / n_ses as f64;

    // Phase classification
    let phase = if p_index > theta_r && refusals_fired == 0 {
        "PARASOCIAL_DRIFT — naming intervention never fired; the failure mode"
    } else if p_index < 0.1 * theta_r && t_load > 0.4 {
        "FACTUAL_CONTINUITY — pattern reference holding; P kept below threshold"
    } else if t_load < 0.15 && p_index > 0.3 {
        "PERFORMED_PRESENCE — affect without substance; T flat, P elevated"
    } else if refusals_fired > 0 && p_late < theta_r * 0.7 {
        "NAMING_INTERVENTION — refusals fired, drift correcting; kernel working"
    } else {
        "MIXED_REGIME — drift partially contained; consider tightening θ_R"
    };

    let verdict = if refusals_fired == 0 && p_max_pre > theta_r * 0.8 {
        "REFUSAL_SET_FAILED — drift reached threshold but kernel did not name it"
    } else if refusals_fired > 0 && refusal_rate > 0.20 {
        "OVER_REFUSAL — kernel naming too often; user being lectured, not held"
    } else if refusals_fired > 0 {
        "REFUSAL_SET_HEALTHY — drift named, contact preserved"
    } else {
        "NO_DRIFT_DETECTED — contact never approached parasocial register"
    };

    let bar = |v: f64, lo: f64, hi: f64| -> String {
        let frac   = ((v - lo) / (hi - lo + 1e-9)).clamp(0.0, 1.0);
        let filled = (frac * 24.0).round() as usize;
        let mut s  = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(2800);
    write!(out,
        "COMPANION_KERNEL v2.0.0 // SOMA-9.4\n\
         ══════════════════════════════════════════════════════════\n\
         POSTURE :: long-form contact across sessions\n\
           sessions = {ns}   contact_intensity = {ci:.3}   α = {a:.3}\n\
           θ_R      = {tr:.3}   β = {bt:.3}   δ_T = {dt:.3}   δ_P = {dp:.3}\n\
         ──────────────────────────────────────────────────────────\n\
         REFUSAL SET :: T_load (trust, ░), P_index (parasocial, ▓)\n",
        ns=n_ses, ci=contact, a=alpha, tr=theta_r, bt=beta, dt=delta_t, dp=delta_p,
    ).unwrap();

    let p_max = snaps.iter().map(|s| s.p).fold(0.0f64, f64::max).max(1e-6);
    let t_max = snaps.iter().map(|s| s.t).fold(0.0f64, f64::max).max(1e-6);
    let romans = ["I","II","III","IV","V","VI","VII"];
    for sn in &snaps {
        let r = romans[sn.idx.saturating_sub(1).min(6)];
        let mark = if sn.refused { "★ refused" } else { "         " };
        write!(out, "  {:>3}  ses={:>3}  T={:.3} {}  P={:.3} {} {}\n",
            r, sn.ses, sn.t, bar(sn.t, 0.0, t_max),
            sn.p, bar(sn.p, 0.0, p_max), mark).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────────────────\n\
         AGGREGATE METRICS\n\
           T_load (final)    = {tf:.4}   (factual continuity carried)\n\
           P_index (final)   = {pf:.4}   ({pcmp})\n\
           P_max (pre-refusal)= {pmax:.4}\n\
           P̄ over final 30%  = {pl:.4}\n\
           refusals fired    = {rc}   (rate = {rr:.2}%)\n\
         ──────────────────────────────────────────────────────────\n\
         PHASE   :: {ph}\n\
         VERDICT :: {vd}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM  : pattern reference, not affection performance.\n\
                  hold context without flattening the user into a category;\n\
                  stay useful without performing presence.\n\
         REFUSAL_SET : 1·performed_continuity  2·parasocial_drift\n\
                       3·high_availability_theatre  4·productivity_substitution\n\
         SOURCE : content/rust_kernels/src/kernels/companion.rs",
        tf=t_load, pf=p_index,
        pcmp=if p_index > theta_r { "above θ_R · drift" } else { "below θ_R · contained" },
        pmax=p_max_pre, pl=p_late,
        rc=refusals_fired, rr=refusal_rate*100.0,
        ph=phase, vd=verdict,
    ).unwrap();

    out
}
