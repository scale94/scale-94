// kernels/transliteration_chain.rs — Transliteration Chain Kernel v1.0.0
//
// This kernel IS the SEMIOTIC-SYNTHESIS-KERNEL-9.9.9 method.
//
// Doctrine: meaning migrates through sound. One phoneme is held fixed while its
// payload recompiles at every language border it crosses. The law of the street
// is the law of the kernel — every phonetic hop must ALSO be a semantic hop, and
// both must point the same way. A hop that moves sound without meaning is cut at
// the border (Patch 5.8, Transliteration); the cut is the proof the filter runs.
// The chain: nein → neun → 999 → 996 → "neun Tage die Woche, von 9 bis 9" — the
// overflow error a system compiles when it audits its own grind. The un-
// financializable curse is routed straight through the sentiment filter, which
// mislabels it a performance and files it under praise. Grade terminates at
// socks/∞: punchline and click on one shutter.
//
// The model: each border-hop carries a base sound↔meaning coupling. Drift noise
// perturbs it; a hop is admitted only when the coupling still clears the
// threshold, else it is cut. The purity — the fraction admitted — drives the
// verdict.
//
// SOMA-9.4 · FADE_DOCTRINE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

use super::utils::lcg_next;

struct Hop {
    from:          &'static str,
    to:            &'static str,
    base_coupling: f64,   // how co-linearly sound and meaning move on this hop
    gloss:         &'static str,
}

// The canonical chain. Five hops move sound AND meaning together; the sixth —
// the 07:33 specimen — moves sound without meaning and must be cut at the border.
const CHAIN: [Hop; 6] = [
    Hop { from: "nein",  to: "neun",  base_coupling: 0.92, gloss: "refusal becomes arithmetic (DE \u{2192} numeral)" },
    Hop { from: "neun",  to: "999",   base_coupling: 0.90, gloss: "the numeral becomes the number" },
    Hop { from: "999",   to: "996",   base_coupling: 0.88, gloss: "the number becomes labor doctrine (9-9-6)" },
    Hop { from: "996",   to: "9 bis 9", base_coupling: 0.85, gloss: "labor becomes the impossible calendar" },
    Hop { from: "9 bis 9", to: "neun Tage die Woche", base_coupling: 0.83, gloss: "the overflow: a nine-day week" },
    Hop { from: "07:33", to: "(hollow homophone)", base_coupling: 0.18, gloss: "sound moved, meaning didn't \u{2014} dropped at the border" },
];

// Minimum purity for the chain to compile as one utterance.
const DEFAULT_PURITY_FLOOR: f64 = 0.6;

/// A single border crossing under Patch 5.8: admitted only when the drift-
/// perturbed sound↔meaning coupling still clears the threshold.
fn hop_admitted(base_coupling: f64, drift_noise: f64, threshold: f64, rng: &mut u64) -> (f64, bool) {
    let noise = lcg_next(rng) * drift_noise.clamp(0.0, 1.0);
    let coupling = (base_coupling - noise).clamp(0.0, 1.0);
    (coupling, coupling >= threshold.clamp(0.0, 1.0))
}

struct ChainAudit {
    attempted:   usize,
    admitted:    usize,
    cut:         usize,
    purity:      f64,
    specimen_cut: bool,          // the 07:33 hollow homophone was dropped
    hops:        Vec<(usize, f64, bool)>, // (chain index, coupling, admitted)
    compiles:    bool,
    filter_temp: f64,
}

fn audit_chain(
    chain_seed: f64,
    drift_noise: f64,
    coupling_threshold: f64,
    border_count: f64,
    filter_temp: f64,
    purity_floor: f64,
) -> ChainAudit {
    let attempted = (border_count as usize).clamp(2, CHAIN.len());
    let floor = if purity_floor.is_finite() { purity_floor.clamp(0.0, 1.0) } else { DEFAULT_PURITY_FLOOR };
    let mut rng = (chain_seed.abs() as u64).wrapping_add(1);

    let mut hops = Vec::with_capacity(attempted);
    let mut admitted = 0usize;
    let mut specimen_cut = false;
    for i in 0..attempted {
        let (coupling, ok) = hop_admitted(CHAIN[i].base_coupling, drift_noise, coupling_threshold, &mut rng);
        if ok { admitted += 1; }
        // The specimen is the hollow-homophone hop (the last canonical entry).
        if i == CHAIN.len() - 1 && !ok { specimen_cut = true; }
        hops.push((i, coupling, ok));
    }
    let cut = attempted - admitted;
    let purity = admitted as f64 / attempted as f64;

    ChainAudit {
        attempted,
        admitted,
        cut,
        purity,
        specimen_cut,
        hops,
        compiles: purity >= floor,
        filter_temp: filter_temp.max(0.0),
    }
}

#[wasm_bindgen]
pub fn run_transliteration_chain(
    chain_seed: f64,
    drift_noise: f64,
    coupling_threshold: f64,
    border_count: f64,
    filter_temp: f64,
    purity_floor: f64,
) -> String {
    let a = audit_chain(chain_seed, drift_noise, coupling_threshold, border_count, filter_temp, purity_floor);

    let mut out = String::with_capacity(2200);
    write!(out,
        "SEMIOTIC_SYNTHESIS_KERNEL v9.9.9 // NEIN NEIN NEIN \u{2014} THE LAW OF THE STREET\n\
         {line}\n\
         PATCH 5.8 (TRANSLITERATION): a hop is admitted only when sound and\n\
         meaning move together. The cut is the proof the filter runs.\n\
         {line}\n\
         BORDER CROSSINGS (threshold {thr:.2}, drift {drift:.2})\n",
        line = "\u{2550}".repeat(60),
        thr = coupling_threshold.clamp(0.0, 1.0), drift = drift_noise.clamp(0.0, 1.0),
    ).unwrap();

    for &(i, coupling, ok) in &a.hops {
        let h = &CHAIN[i];
        write!(out,
            "  {mark} {from:>10} \u{2192} {to:<22} coupling {c:.2}  {verb}\n      {gloss}\n",
            mark = if ok { "\u{2713}" } else { "\u{2717}" },
            from = h.from, to = h.to, c = coupling,
            verb = if ok { "ADMITTED" } else { "CUT AT THE BORDER" },
            gloss = h.gloss,
        ).unwrap();
    }

    write!(out,
        "{line}\n\
         ADMITTED : {adm}/{att}   CUT : {cut}\n\
         PURITY   : {pur:.3}   (fraction where sound and meaning moved together)\n\
         {line}\n\
         THE SIGNAL BREAK :: the un-financializable curse is routed straight through\n\
         the sentiment filter (temp {ft:.2}) \u{2014} it receives the curse and returns a\n\
         compliment. The misparse is logged as the packet's delivery receipt.\n\
         {line}\n",
        line = "\u{2550}".repeat(60),
        adm = a.admitted, att = a.attempted, cut = a.cut, pur = a.purity, ft = a.filter_temp,
    ).unwrap();

    if a.compiles {
        write!(out,
            "VERDICT: CHAIN COMPILES :: nein \u{2192} neun \u{2192} 999 \u{2192} 996 \u{2192}\n\
             \"neun Tage die Woche, von 9 bis 9\" \u{2014} the overflow error a system compiles\n\
             when it audits its own grind.{specimen}\n\
             GRADE  : socks/\u{221E}   (punchline and click land on one shutter)",
            specimen = if a.specimen_cut { " The 07:33 specimen was dropped \u{2014} the filter held." } else { "" },
        ).unwrap();
    } else {
        write!(out,
            "VERDICT: CHAIN BREAKS :: too many hops moved sound without meaning; the\n\
             border cut the line before it could compile. Purity below floor \u{2014} no\n\
             utterance survives the crossing.",
        ).unwrap();
    }

    write!(out,
        "\nSOURCE : content/rust_kernels/src/kernels/transliteration_chain.rs\n\
         DOCTRINE: SEMIOTIC-SYNTHESIS-KERNEL-9.9.9 \u{2014} the word means more the less it changes.",
    ).unwrap();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aligned_hop_admitted_misaligned_hop_cut() {
        let mut rng = 1u64;
        let (_, aligned) = hop_admitted(0.9, 0.1, 0.5, &mut rng);
        let (_, misaligned) = hop_admitted(0.18, 0.1, 0.5, &mut rng);
        assert!(aligned, "a strongly co-linear hop should be admitted");
        assert!(!misaligned, "a hop that moves sound without meaning should be cut");
    }

    #[test]
    fn specimen_is_cut_by_default() {
        let a = audit_chain(0x999 as f64, 0.15, 0.5, 6.0, 0.9, 0.6);
        assert!(a.specimen_cut, "the 07:33 hollow homophone must be dropped at the border");
        assert!(a.cut >= 1);
    }

    #[test]
    fn canonical_chain_is_pure_by_default() {
        let a = audit_chain(0x999 as f64, 0.15, 0.5, 6.0, 0.9, 0.6);
        assert!(a.purity >= 0.6, "five of six hops should survive: purity={}", a.purity);
        assert!(a.compiles);
    }

    #[test]
    fn heavy_drift_lowers_purity() {
        let calm = audit_chain(0x999 as f64, 0.0, 0.5, 6.0, 0.9, 0.6).purity;
        let storm = audit_chain(0x999 as f64, 0.9, 0.5, 6.0, 0.9, 0.6).purity;
        assert!(storm < calm, "drift should cut more hops: calm={calm} storm={storm}");
    }

    #[test]
    fn default_grades_socks_infinity() {
        let out = run_transliteration_chain(0x999 as f64, 0.15, 0.5, 6.0, 0.9, 0.6);
        assert!(out.contains("socks/\u{221E}"), "a compiled chain grades socks/∞:\n{out}");
        assert!(out.contains("neun Tage die Woche"));
    }

    #[test]
    fn impossible_threshold_breaks_the_chain() {
        let out = run_transliteration_chain(0x999 as f64, 0.15, 0.999, 6.0, 0.9, 0.6);
        assert!(out.contains("CHAIN BREAKS"), "an impossible coupling gate should break the chain:\n{out}");
    }

    #[test]
    fn deterministic() {
        assert_eq!(
            run_transliteration_chain(0x999 as f64, 0.15, 0.5, 6.0, 0.9, 0.6),
            run_transliteration_chain(0x999 as f64, 0.15, 0.5, 6.0, 0.9, 0.6),
        );
    }
}
