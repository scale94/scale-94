// kernels/chaos_routing.rs — Chaos-Directory Routing Kernel v1.0.0
//
// This kernel IS the HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0 method.
//
// Doctrine: sovereignty is not maintained by walls but by routing. The perfect
// stash is located inside the observer's own chaos directory, where the security
// sweep cannot parse what it already owns. The hardened vault ATTRACTS the scan;
// the drawer of untethered junk REPELS it. Contraband survives only where the
// observer's own entropy provides cover — protection by absorption into the
// scanner's noise, the inverse of Pirarucu mineralized armor.
//
// The model: N directories, each with a Shannon-clutter level. A security sweep
// whose per-directory detection probability falls as local clutter rises. The
// payload is placed either in a hardened low-entropy vault or in the highest-
// entropy chaos drawer; the sweep runs; survival is read from the drawer.
// The Window Smile — a zero-byte ACK — attenuates the anxious scan loop
// (the scan terminates on a visual checksum; no port is ever opened).
//
// SOMA-9.4 · FADE_DOCTRINE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

use super::utils::lcg_next;

// Hardened vault clutter: structured, encrypted, legible — the lowest entropy,
// and therefore the most conspicuous to a sweep that hunts for structure.
const VAULT_ENTROPY: f64 = 0.05;

// Survival threshold: the stash survives if drawer survival ≥ this.
const SURVIVAL_THRESHOLD: f64 = 0.5;

/// Window Smile: a zero-byte ACK attenuates the anxious scan loop. Full
/// attenuation (1.0) terminates the sweep on a visual checksum.
fn effective_aggression(sweep_aggression: f64, ack_attenuation: f64) -> f64 {
    sweep_aggression.max(0.0) * (1.0 - ack_attenuation.clamp(0.0, 1.0))
}

/// Per-directory detection probability. Detection falls as local clutter
/// (entropy) rises — the sweep cannot parse what the host already owns.
/// Payload size raises exposure.
fn p_detect(entropy: f64, eff_aggression: f64, payload: f64) -> f64 {
    let exposure = (1.0 - entropy.clamp(0.0, 1.0)) + payload.clamp(0.0, 1.0) * 0.3;
    (eff_aggression * exposure).clamp(0.0, 1.0)
}

/// N directory clutter levels, centred on the host baseline and jittered by a
/// deterministic LCG. The chaos drawer is the max of these.
fn dir_entropies(n: usize, host_entropy: f64, seed: u64) -> Vec<f64> {
    let mut s = seed | 1;
    (0..n)
        .map(|_| {
            let noise = lcg_next(&mut s);
            (host_entropy.clamp(0.0, 1.0) * 0.6 + noise * 0.4).clamp(0.0, 1.0)
        })
        .collect()
}

struct RoutingAudit {
    n_dirs:         usize,
    host_entropy:   f64,
    eff_aggression: f64,
    drawer_entropy: f64, // highest-clutter directory
    p_drawer:       f64, // detection at the chaos drawer
    p_vault:        f64, // detection at the hardened vault
    stash_survival: f64, // 1 − p_drawer
    cover_ratio:    f64, // how much more the vault is seen than the drawer
    survives:       bool,
}

fn audit_chaos_routing(
    n_dirs: f64,
    host_entropy: f64,
    sweep_aggression: f64,
    payload_size: f64,
    ack_attenuation: f64,
    seed: f64,
) -> RoutingAudit {
    let n = (n_dirs as usize).clamp(2, 512);
    let host = host_entropy.clamp(0.0, 1.0);
    let payload = payload_size.clamp(0.0, 1.0);
    let eff = effective_aggression(sweep_aggression, ack_attenuation);
    let seed_u = (seed.abs() as u64).wrapping_add(1);

    let entropies = dir_entropies(n, host, seed_u);
    let drawer_entropy = entropies.iter().cloned().fold(0.0_f64, f64::max);

    let p_drawer = p_detect(drawer_entropy, eff, payload);
    let p_vault = p_detect(VAULT_ENTROPY, eff, payload);
    let stash_survival = 1.0 - p_drawer;
    let cover_ratio = p_vault / p_drawer.max(1e-6);

    RoutingAudit {
        n_dirs: n,
        host_entropy: host,
        eff_aggression: eff,
        drawer_entropy,
        p_drawer,
        p_vault,
        stash_survival,
        cover_ratio,
        survives: stash_survival >= SURVIVAL_THRESHOLD,
    }
}

#[wasm_bindgen]
pub fn run_chaos_routing(
    n_dirs: f64,
    host_entropy: f64,
    sweep_aggression: f64,
    payload_size: f64,
    ack_attenuation: f64,
    seed: f64,
) -> String {
    let a = audit_chaos_routing(
        n_dirs, host_entropy, sweep_aggression, payload_size, ack_attenuation, seed,
    );

    let verdict = if a.survives {
        "STASH SURVIVES :: routed through the observer's own blind spot"
    } else {
        "SWEEP PARSED THE VAULT :: the hardened perimeter drew the scan"
    };

    let mut out = String::with_capacity(1800);
    write!(out,
        "HUDELSCHUBLADE_ROUTING_KERNEL v1.0.0 // CHAOS-DIRECTORY EXPLOIT\n\
         {line}\n\
         DIRECTORIES     : {n}\n\
         HOST ENTROPY    : {host:.3}   (the observer's own clutter — the cover)\n\
         SWEEP           : aggression \u{00D7} (1 \u{2212} ACK) = {eff:.3}   [Window Smile attenuation]\n\
         {line}\n\
         PLACEMENT CONTEST\n\
           VAULT   \u{03BA}={ve:.3}  \u{2192}  P(detect) = {pv:.3}   (hardened, legible, conspicuous)\n\
           DRAWER  \u{03BA}={de:.3}  \u{2192}  P(detect) = {pd:.3}   (max-clutter chaos directory)\n\
           COVER RATIO      : {cr:.2}\u{00D7}   (the vault is seen {cr:.1}\u{00D7} more than the drawer)\n\
           STASH SURVIVAL   : {ss:.3}   (1 \u{2212} P(detect) at the drawer; threshold {thr:.2})\n\
         {line}\n\
         WINDOW SMILE      : zero-byte ACK \u{2014} the scan loop terminates on a visual\n\
                             checksum; no port is ever opened.\n\
         {line}\n\
         VERDICT: {verdict}\n\
         SOURCE : content/rust_kernels/src/kernels/chaos_routing.rs\n\
         DOCTRINE: HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0 \u{2014} protection by absorption\n\
                   into the scanner's noise (the inverse of Pirarucu armor).",
        line = "\u{2550}".repeat(60),
        n = a.n_dirs, host = a.host_entropy, eff = a.eff_aggression,
        ve = VAULT_ENTROPY, pv = a.p_vault,
        de = a.drawer_entropy, pd = a.p_drawer,
        cr = a.cover_ratio, ss = a.stash_survival, thr = SURVIVAL_THRESHOLD,
        verdict = verdict,
    ).unwrap();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clutter_lowers_detection() {
        let hi_clutter = p_detect(0.9, 1.0, 0.0);
        let lo_clutter = p_detect(0.1, 1.0, 0.0);
        assert!(hi_clutter < lo_clutter,
            "high clutter {hi_clutter} should be harder to detect than low clutter {lo_clutter}");
    }

    #[test]
    fn window_smile_attenuates_sweep() {
        assert!(effective_aggression(1.0, 0.8) < 1.0);
        assert_eq!(effective_aggression(1.0, 0.0), 1.0);
        assert_eq!(effective_aggression(1.0, 1.0), 0.0);
    }

    #[test]
    fn vault_is_drawn_more_than_drawer() {
        let a = audit_chaos_routing(128.0, 0.82, 1.0, 0.2, 0.6, 0x5011 as f64);
        assert!(a.p_vault > a.p_drawer, "the hardened vault must attract the scan more than the chaos drawer");
        assert!(a.cover_ratio > 1.0);
    }

    #[test]
    fn default_stash_survives_in_the_clutter() {
        let out = run_chaos_routing(128.0, 0.82, 1.0, 0.2, 0.6, 0x5011 as f64);
        assert!(out.contains("STASH SURVIVES"), "default clutter should shelter the stash:\n{out}");
    }

    #[test]
    fn aggressive_sweep_without_ack_parses_the_vault() {
        // Low host clutter, max aggression, no Window Smile ACK → detection wins.
        let out = run_chaos_routing(32.0, 0.05, 2.0, 0.9, 0.0, 7.0);
        assert!(out.contains("SWEEP PARSED"), "a full sweep with no cover should parse the stash:\n{out}");
    }

    #[test]
    fn deterministic() {
        assert_eq!(
            run_chaos_routing(64.0, 0.5, 1.2, 0.3, 0.4, 99.0),
            run_chaos_routing(64.0, 0.5, 1.2, 0.3, 0.4, 99.0),
        );
    }
}
