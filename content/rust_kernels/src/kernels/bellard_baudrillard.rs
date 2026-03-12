// kernels/bellard_baudrillard.rs — Phonemic Drift · Memory Hash Collision Simulator
// Source: BELLARD-BAUDRILLARD_KERNEL-V1_0_0.md
//
// Models human memory retrieval as phonemic resonance matching.
// The *ellard / *aulard suffix cluster:
//   Bellard     → systems architecture (exact phonemic match, wrong domain)
//   Baudrillard → simulacra / hyperreality (near match, correct domain)
//   Bachelard   → poetics of space (near match, adjacent domain)
//   Abelard     → medieval logic / universals (mid match, adjacent domain)
//
// At high drift_noise, phonemic gravity overrides semantic gravity →
// the brain returns Bellard when it was seeking Baudrillard.
// This IS the Baudrillardian condition: the sign precedes the referent.
use wasm_bindgen::prelude::*;
use crate::kernels::utils::lcg_next;

// Cluster table: (name, domain, phonemic_dist, semantic_dist)
// Distances are relative to a "seeking Baudrillard" baseline query.
// phonemic_dist: 0=exact suffix, 1=near, 2=mid
// semantic_dist: 0=target domain, 1=adjacent, 2=remote, 3=orthogonal
const CLUSTER: [(&str, &str, u32, u32); 4] = [
    ("Bellard",     "systems_architecture",           0, 3),
    ("Baudrillard", "simulacra_hyperreality",          1, 0),
    ("Bachelard",   "poetics_of_space_philosophy",     1, 1),
    ("Abelard",     "medieval_logic_universals",       2, 1),
];

/// Run the Phonemic Drift analysis.
///
/// * `seed`        — PRNG seed (0 → uses internal default)
/// * `target`      — intended retrieval target: 0=Baudrillard 1=Bachelard 2=Abelard
/// * `drift_noise` — retrieval noise [0.0–1.0]; 0=clean semantic, 1=pure phonemic
#[wasm_bindgen]
pub fn run_phonemic_drift(seed: u32, target: u32, drift_noise: f64) -> String {
    let mut rng: u64 = if seed == 0 { 0xDEAD_BEEF } else { seed as u64 };
    let noise = drift_noise.clamp(0.0, 1.0);

    // Intended target index in CLUSTER (Bellard=0 is never the intended target)
    let target_idx: usize = match target % 3 {
        0 => 1, // Baudrillard
        1 => 2, // Bachelard
        _ => 3, // Abelard
    };

    // Phonemic weight: high noise → phonemic routing dominates
    let stochastic = lcg_next(&mut rng);
    let phonemic_weight = (0.20 + noise * 0.70 + stochastic * 0.10).clamp(0.0, 1.0);
    let semantic_weight = 1.0 - phonemic_weight;

    // Resonance scores: weighted sum of inverted distances
    let mut scores = [(0usize, 0.0f64); 4];
    for (i, &(_, _, pd, sd)) in CLUSTER.iter().enumerate() {
        let p_score = 1.0 / (1.0 + pd as f64);
        let s_score = 1.0 / (1.0 + sd as f64);
        scores[i] = (i, phonemic_weight * p_score + semantic_weight * s_score);
    }

    // Sort descending — insertion sort over 4 elements
    for i in 0..4 {
        for j in (i + 1)..4 {
            if scores[j].1 > scores[i].1 {
                scores.swap(i, j);
            }
        }
    }

    let top_idx  = scores[0].0;
    let top_res  = scores[0].1;
    let top_name = CLUSTER[top_idx].0;
    let top_dom  = CLUSTER[top_idx].1;

    let collision   = top_idx != target_idx;
    let target_name = CLUSTER[target_idx].0;

    // Simulacra depth: how many sign→sign hops before reaching a real referent
    let simulacra_depth = if collision {
        CLUSTER[top_idx].2 + CLUSTER[top_idx].3 + 1
    } else {
        0
    };

    // Map/territory divergence [0–1]
    let divergence = if collision {
        let pd = CLUSTER[top_idx].2 as f64;
        let sd = CLUSTER[top_idx].3 as f64;
        (phonemic_weight * pd / 2.0 + semantic_weight * sd / 3.0).min(1.0)
    } else {
        0.0
    };

    // Bachelard poetic distortion: memory poeticises toward an ideal composite type.
    // The brain constructs the Architect-Philosopher who doesn't exist but is desired.
    let bachelard_amp = 1.0 + lcg_next(&mut rng) * 0.3; // 1.000–1.300x
    let composite_resonance = (top_res * bachelard_amp).min(1.0);

    // Abelard nominalist check: suffix is not a substance
    let nominalist = if collision && CLUSTER[top_idx].2 == 0 {
        "REALIST_ERROR: *ellard suffix treated as shared essence — Abelard corrects: nomina non sunt naturae"
    } else {
        "NOMINALIST_PASS: phonemic proximity acknowledged as label, not substance"
    };

    let verdict = if collision && divergence > 0.4 {
        "SIMULACRA_CONFIRMED // map preceded territory — Baudrillard's thesis holds in vivo"
    } else if collision {
        "PHONEMIC_DRIFT // legacy retrieval hardware: resonance before definition, sound before symbol"
    } else {
        "CLEAN_RETRIEVAL // semantic gravity overrode phonemic gravity this cycle"
    };

    let status_line = if collision {
        format!("HASH_COLLISION  // sought: {}  →  returned: {} [{}]",
            target_name, top_name, top_dom)
    } else {
        format!("RETRIEVAL_HIT   // {} ← {} [{}] (target matched)",
            target_name, top_name, top_dom)
    };

    format!(
        "BELLARD_BAUDRILLARD_KERNEL v1.0.0 // PHONEMIC_DRIFT_ACTIVE\n\
         {}\n\
         PHONEMIC_WEIGHT:     {:.3}   SEMANTIC_WEIGHT:   {:.3}\n\
         DRIFT_NOISE:         {:.3}   BACHELARD_AMP:     {:.3}x\n\
         TOP_RESONANCE:       {:.4}   COMPOSITE:         {:.4}\n\
         SIMULACRA_DEPTH:     {} hop(s) from referent\n\
         MAP/TERRITORY_DIV:   {:.3}\n\
         {}\n\
         VERDICT: {}\n\
         SOURCE: content/rust_kernels/src/kernels/bellard_baudrillard.rs",
        status_line,
        phonemic_weight, semantic_weight,
        noise, bachelard_amp,
        top_res, composite_resonance,
        simulacra_depth,
        divergence,
        nominalist,
        verdict,
    )
}
