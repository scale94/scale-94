// kernels/deep_kernel_descent.rs — Deep-Kernel Descent Kernel v1.0.0
//
// This kernel IS the BLACK-HOLE-TAXONOMY-KERNEL-1.0.0 method.
//
// Doctrine: a three-caste taxonomy of creation. The noobs theme the surface,
// the gods extend the feature set, the black holes rewrite the bare metal and
// vanish (headless, no UI, no light escapes). Every visible feature is downstream
// of an invisible ancestor no one understood; faith in the undocumented black
// hole is the community's load-bearing protocol. Incarnate as arter97, the
// Exynos ghost — every kernel a fork of one master prompt, itself a fork of a
// ghost's headless tree. Patch 5.7 (Necromancy): dead hardware brought back to
// life, modern systems forced onto platforms their makers abandoned.
//
// The model: a Galton-Watson branching lineage descending from a single headless
// ancestor (a black hole). Each generation the ghost lineage forks at `fork_rate`
// against a base abandonment rate; necromancy revives a share of the abandoned as
// INDEPENDENT orphans (reanimated dead platforms — not the ghost's blood). The
// ancestral_load — the fraction of the live tree still forking from the one ghost
// — drives the verdict. Nodes are cast into the three castes; the black hole is
// always the rarest and always at least one: the ancestor itself.
//
// SOMA-9.4 · FADE_DOCTRINE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

use super::utils::lcg_next;

// Base abandonment per generation — hardware falls out of support.
const ABANDONMENT: f64 = 0.15;

// Ancestral-load threshold: above this, the ghost's line still owns the tree.
const LOAD_THRESHOLD: f64 = 0.5;

struct DescentAudit {
    generations:      usize,
    ghost_pop:        f64,  // expected live population still descending from the ghost
    orphan_pop:       f64,  // reanimated independent zombies (necromancy)
    total_live:       f64,
    ancestral_load:   f64,  // ghost_pop / total_live
    extinct:          bool, // the ghost line fell below one expected survivor
    noobs:            u64,
    gods:             u64,
    black_holes:      u64,
    faith_index:      f64,  // 1 − ghost_opacity — the undocumented is load-bearing
}

/// Coupled birth/death/necromancy recurrence for the ghost lineage.
/// Returns (ghost_pop, orphan_pop) after `generations`.
fn simulate_lineage(generations: usize, fork_rate: f64, revival_rate: f64, seed: u64) -> (f64, f64) {
    let mut ghost = 1.0_f64; // the headless ancestor
    let mut orphans = 0.0_f64;
    let mut s = seed | 1;
    let fork = fork_rate.max(0.0);
    let revival = revival_rate.clamp(0.0, 1.0);

    for _ in 0..generations {
        let jitter = 0.9 + 0.2 * lcg_next(&mut s); // seed-dependent birth texture
        let births = ghost * fork * jitter;
        let deaths = ghost * ABANDONMENT;
        ghost = (ghost + births - deaths).max(0.0);
        // Necromancy: a share of the dead return as independent orphans,
        // which themselves slowly decay and never rejoin the ghost's blood.
        orphans += deaths * revival;
        orphans *= 1.0 - ABANDONMENT * 0.5;
    }
    (ghost, orphans)
}

/// Cast the live population into the three castes. The black hole is the rarest
/// apex and never fewer than one — the ancestor is always present.
fn caste_census(total_live: f64, caste_bias: f64) -> (u64, u64, u64) {
    let n = total_live.max(1.0).min(1e7);
    let bias = caste_bias.clamp(0.0, 1.0);
    let p_bh = 0.03 + 0.20 * bias;
    let p_god = 0.30;
    let bh = (n * p_bh).round().max(1.0);
    let god = (n * p_god).round();
    let noob = (n - bh - god).max(0.0);
    (noob as u64, god as u64, bh as u64)
}

fn audit_descent(
    generations: f64,
    fork_rate: f64,
    revival_rate: f64,
    caste_bias: f64,
    ghost_opacity: f64,
    seed: f64,
) -> DescentAudit {
    let gens = (generations as usize).clamp(1, 64);
    let seed_u = (seed.abs() as u64).wrapping_add(1);

    let (ghost, orphans) = simulate_lineage(gens, fork_rate, revival_rate, seed_u);
    let total = ghost + orphans;
    let ancestral_load = if total > 1e-9 { ghost / total } else { 0.0 };
    let (noobs, gods, black_holes) = caste_census(total, caste_bias);

    DescentAudit {
        generations: gens,
        ghost_pop: ghost,
        orphan_pop: orphans,
        total_live: total,
        ancestral_load,
        extinct: ghost < 1.0,
        noobs,
        gods,
        black_holes,
        faith_index: 1.0 - ghost_opacity.clamp(0.0, 1.0),
    }
}

#[wasm_bindgen]
pub fn run_deep_kernel_descent(
    generations: f64,
    fork_rate: f64,
    revival_rate: f64,
    caste_bias: f64,
    ghost_opacity: f64,
    seed: f64,
) -> String {
    let a = audit_descent(generations, fork_rate, revival_rate, caste_bias, ghost_opacity, seed);
    let load_pct = a.ancestral_load * 100.0;

    let verdict = if a.ancestral_load >= LOAD_THRESHOLD {
        format!("ANCESTOR: arter97 (headless) :: {load_pct:.0}% of the live tree forks from one ghost")
    } else {
        format!("LINEAGE DILUTED :: necromancy reanimated more orphans than the ghost sired ({load_pct:.0}% ghost)")
    };

    let mut out = String::with_capacity(1900);
    write!(out,
        "BLACK_HOLE_TAXONOMY_KERNEL v1.0.0 // DEEP-KERNEL NECROMANCY\n\
         {line}\n\
         GENERATIONS     : {gens}\n\
         GHOST LINEAGE   : {ghost:.1}   (still forking from the headless ancestor)\n\
         REVIVED ORPHANS : {orph:.1}   (necromancy \u{2014} reanimated dead platforms)\n\
         TOTAL LIVE      : {total:.1}\n\
         ANCESTRAL LOAD  : {load:.3}   (ghost / total; threshold {thr:.2})\n\
         {status}\n\
         {line}\n\
         CASTE CENSUS (Plato/Promo taxonomy)\n\
           NOOBS       : {noob:>8}   theme the surface \u{2014} patches pass through, never adhere\n\
           GODS        : {god:>8}   cherry-pick features \u{2014} the middle clergy\n\
           BLACK HOLES : {bh:>8}   rewrite the bare metal \u{2014} rarest, headless, no UI\n\
         {line}\n\
         FAITH INDEX     : {faith:.2}   (the undocumented is load-bearing \u{2014} everyone\n\
                           cherry-picks what no one understood)\n\
         {line}\n\
         VERDICT: {verdict}\n\
         SOURCE : content/rust_kernels/src/kernels/deep_kernel_descent.rs\n\
         DOCTRINE: every kernel is a fork of one master prompt, and the master\n\
                   prompt is a fork of a ghost's headless tree.",
        line = "\u{2550}".repeat(60),
        gens = a.generations, ghost = a.ghost_pop, orph = a.orphan_pop, total = a.total_live,
        load = a.ancestral_load, thr = LOAD_THRESHOLD,
        status = if a.extinct { "STATUS          : GHOST LINE EXTINCT \u{2014} the tree survives only on the revived" }
                 else { "STATUS          : GHOST LINE ALIVE \u{2014} the ancestor still sires the archive" },
        noob = a.noobs, god = a.gods, bh = a.black_holes,
        faith = a.faith_index, verdict = verdict,
    ).unwrap();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supercritical_lineage_grows_and_stays_ghost() {
        let a = audit_descent(8.0, 1.5, 0.0, 0.25, 0.1, 97.0);
        assert!(a.ghost_pop > 1.0, "supercritical fork should grow the ghost line");
        assert!(a.ancestral_load > 0.9, "with no necromancy the tree stays the ghost's: {}", a.ancestral_load);
        assert!(!a.extinct);
    }

    #[test]
    fn necromancy_dilutes_the_ghost_line() {
        let diluted = audit_descent(10.0, 0.10, 0.9, 0.25, 0.1, 97.0).ancestral_load;
        let pure = audit_descent(10.0, 1.5, 0.0, 0.25, 0.1, 97.0).ancestral_load;
        assert!(diluted < pure,
            "high revival + subcritical fork should dilute the ghost line: diluted={diluted} pure={pure}");
    }

    #[test]
    fn subcritical_lineage_goes_extinct() {
        let a = audit_descent(20.0, 0.05, 0.0, 0.25, 0.1, 97.0);
        assert!(a.extinct, "fork below abandonment should extinguish the ghost line: ghost={}", a.ghost_pop);
    }

    #[test]
    fn black_hole_is_the_rarest_caste() {
        let a = audit_descent(8.0, 1.5, 0.0, 0.25, 0.1, 97.0);
        assert!(a.black_holes <= a.gods, "black holes must be rarer than gods");
        assert!(a.black_holes <= a.noobs, "black holes must be rarer than noobs");
        assert!(a.black_holes >= 1, "the ancestor is always present");
    }

    #[test]
    fn default_verdict_names_the_ghost() {
        let out = run_deep_kernel_descent(12.0, 1.4, 0.2, 0.25, 0.1, 97.0);
        assert!(out.contains("arter97"), "a healthy lineage should name the ghost:\n{out}");
        assert!(out.contains("ANCESTOR"));
    }

    #[test]
    fn deterministic() {
        assert_eq!(
            run_deep_kernel_descent(12.0, 1.4, 0.2, 0.25, 0.1, 97.0),
            run_deep_kernel_descent(12.0, 1.4, 0.2, 0.25, 0.1, 97.0),
        );
    }
}
