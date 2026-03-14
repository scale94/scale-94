// spectral_bridge.rs — Spectral Bridge Kernel v1.0.0
//
// Cross-cluster topology discovery via cosine similarity on 16-dimensional
// mathematical fingerprints. Each of the 25 kernel nodes is characterised by
// a feature vector encoding its fundamental mathematical properties:
//
//   [dynamical_class, nonlinearity, dimensionality, phase_criticality,
//    entropy_centrality, collective_sync, conservation, temporal_depth,
//    spatial_extent, stochastic_degree, game_theoretic, thermodynamic,
//    information_theoretic, cryptographic, biological, economic]
//
// The kernel computes pairwise cosine similarity across all cross-cluster
// pairs, ranks them, and returns the strongest bridges with explanations
// of which mathematical dimensions drive the connection.
//
// References:
//   - Salton & McGill (1983), Introduction to Modern Information Retrieval
//   - Coupled oscillator phase spaces: Strogatz (2000), Nonlinear Dynamics and Chaos
//   - Cross-domain mathematical morphisms: Mac Lane (1971), Categories for the Working Mathematician
//
// Usage:
//   run spectral_bridge                          # default: threshold 0.70, max 12 bridges
//   run spectral_bridge --threshold 0.5          # lower threshold → more bridges
//   run spectral_bridge --max 20 --threshold 0.6 # more bridges with moderate cutoff
//
// SOMA-9.4 · FADE_DOCTRINE · ARS ELECTRONICA 2027

use std::fmt::Write;
use wasm_bindgen::prelude::*;

// ── Node metadata (mirrors ArtTab.jsx NODES array, indices 0–24) ─────────────

const NODE_IDS: [&str; 25] = [
    "biocoenosis", "atmospheric", "chrono", "daly", "replicator", "grayscott",
    "kuramoto", "ceei", "soma91", "soma_plus", "leviathan", "cynic",
    "feigenbaum", "ising", "bosonic", "seraphine", "fusion",
    "classified", "pqhash", "dh_ec",
    "pragmatic", "soma_kernel", "strangler", "surveillance", "necromantic",
];

const NODE_LABELS: [&str; 25] = [
    "biocoenosis", "atmospheric", "chrono_actuary", "daly", "replicator", "grayscott",
    "kuramoto", "ceei", "soma_9.1", "soma_plus", "leviathan", "cynic_realist",
    "feigenbaum", "ising", "bosonic", "seraphine", "fusion_plasma",
    "classified", "pqhash", "dh_ec",
    "pragmatic", "soma_kernel", "strangler_fig", "surveillance", "necromantic",
];

const NODE_CLUSTERS: [u8; 25] = [
    0, 0, 0, 0, 0, 0,     // eco    (0)
    1, 1, 1, 1, 1, 1,     // sync   (1)
    2, 2, 2, 2, 2,        // phys   (2)
    3, 3, 3,              // crypto (3)
    4, 4, 4, 4, 4,        // drk    (4)
];

const CLUSTER_NAMES: [&str; 5] = ["eco", "sync", "phys", "crypto", "drk"];

// ── 16-dimensional mathematical fingerprint space ────────────────────────────

const N_DIMS: usize = 16;
const DIM_NAMES: [&str; N_DIMS] = [
    "dynamical",      // 0=static/equilibrium → 1=stochastic PDE
    "nonlinearity",   // 0=linear → 1=chaotic
    "dimensionality", // 0=scalar → 1=high-dimensional
    "criticality",    // 0=no phase transition → 1=sharp critical point
    "entropy",        // 0=entropy irrelevant → 1=entropy is central measure
    "synchrony",      // 0=individual dynamics → 1=strong collective sync
    "conservation",   // 0=fully dissipative → 1=conservative system
    "temporal",       // 0=instantaneous → 1=deep-time evolution
    "spatial",        // 0=point/scalar → 1=continuous spatial field
    "stochastic",     // 0=deterministic → 1=fully stochastic/Monte Carlo
    "game_theory",    // 0=no agents → 1=explicit game-theoretic
    "thermodynamic",  // 0=non-physical → 1=explicit thermodynamics
    "information",    // 0=no info theory → 1=Shannon/entropy central
    "cryptographic",  // 0=none → 1=explicit cryptographic primitives
    "biological",     // 0=non-biological → 1=explicit ecology/biology
    "economic",       // 0=non-economic → 1=explicit economic modelling
];

// ── Feature vectors: 25 × 16 ────────────────────────────────────────────────
// Each row is the mathematical fingerprint of one kernel, derived from rigorous
// analysis of the kernel's governing equations, state space, and output metrics.
//
// Values are on [0, 1] — calibrated by domain analysis, not fitted.
// Two kernels with high cosine similarity genuinely share mathematical structure.

#[rustfmt::skip]
const FEATURES: [[f64; N_DIMS]; 25] = [
    //                    dyn   nlin  dim   crit  entr  sync  cons  temp  spat  stoc  game  therm info  cryp  bio   econ
    /* biocoenosis   */ [ 0.75, 0.55, 0.50, 0.30, 0.90, 0.30, 0.40, 0.50, 0.35, 0.70, 0.40, 0.20, 0.85, 0.00, 1.00, 0.20 ],
    /* atmospheric   */ [ 0.80, 0.70, 0.75, 0.50, 0.55, 0.20, 0.50, 0.80, 0.70, 0.30, 0.10, 0.80, 0.30, 0.00, 0.40, 0.10 ],
    /* chrono        */ [ 0.50, 0.45, 0.50, 0.30, 0.50, 0.10, 0.30, 1.00, 0.35, 0.20, 0.30, 0.60, 0.40, 0.00, 0.65, 0.70 ],
    /* daly          */ [ 0.25, 0.40, 0.30, 0.20, 0.70, 0.20, 0.60, 0.70, 0.05, 0.10, 0.50, 0.75, 0.50, 0.00, 0.30, 0.90 ],
    /* replicator    */ [ 0.55, 0.70, 0.50, 0.45, 0.45, 0.50, 0.50, 0.45, 0.65, 0.30, 1.00, 0.10, 0.30, 0.00, 0.75, 0.40 ],
    /* grayscott     */ [ 1.00, 0.90, 0.75, 0.60, 0.30, 0.40, 0.40, 0.30, 1.00, 0.00, 0.00, 0.20, 0.10, 0.00, 0.30, 0.00 ],
    /* kuramoto      */ [ 0.55, 0.60, 0.70, 0.55, 0.35, 1.00, 0.50, 0.40, 0.65, 0.20, 0.20, 0.10, 0.25, 0.00, 0.25, 0.10 ],
    /* ceei          */ [ 0.25, 0.30, 0.55, 0.20, 0.40, 0.50, 0.80, 0.20, 0.65, 0.10, 0.85, 0.20, 0.40, 0.00, 0.10, 1.00 ],
    /* soma91        */ [ 0.30, 0.35, 0.50, 0.30, 0.50, 0.40, 0.50, 0.50, 0.65, 0.20, 0.30, 0.50, 0.50, 0.00, 0.20, 0.50 ],
    /* soma_plus     */ [ 0.45, 0.40, 0.55, 0.30, 0.50, 0.50, 0.50, 0.50, 0.65, 0.30, 0.30, 0.50, 0.50, 0.00, 0.20, 0.40 ],
    /* leviathan     */ [ 0.30, 0.50, 0.70, 0.35, 0.40, 0.55, 0.30, 0.45, 0.65, 0.30, 0.90, 0.25, 0.30, 0.00, 0.10, 0.50 ],
    /* cynic         */ [ 0.15, 0.25, 0.30, 0.10, 0.30, 0.20, 0.20, 0.35, 0.10, 0.15, 0.50, 0.15, 0.20, 0.00, 0.10, 0.30 ],
    /* feigenbaum    */ [ 0.30, 1.00, 0.25, 0.85, 0.25, 0.10, 0.50, 0.20, 0.05, 0.00, 0.00, 0.10, 0.20, 0.00, 0.00, 0.00 ],
    /* ising         */ [ 0.85, 0.65, 0.55, 1.00, 0.60, 0.70, 0.50, 0.30, 0.40, 0.90, 0.10, 0.85, 0.50, 0.00, 0.00, 0.00 ],
    /* bosonic       */ [ 0.50, 0.55, 0.70, 0.70, 0.40, 0.60, 0.50, 0.20, 0.65, 0.30, 0.40, 0.70, 0.30, 0.00, 0.00, 0.30 ],
    /* seraphine     */ [ 0.50, 0.65, 0.70, 0.50, 0.35, 0.30, 0.40, 0.25, 0.65, 0.40, 0.10, 0.40, 0.35, 0.45, 0.00, 0.10 ],
    /* fusion        */ [ 0.80, 0.75, 0.75, 0.60, 0.30, 0.20, 0.45, 0.30, 0.90, 0.30, 0.00, 0.90, 0.20, 0.00, 0.00, 0.10 ],
    /* classified    */ [ 0.05, 0.30, 0.30, 0.00, 0.20, 0.00, 0.05, 0.05, 0.05, 0.50, 0.00, 0.00, 0.50, 1.00, 0.00, 0.00 ],
    /* pqhash        */ [ 0.05, 0.35, 0.45, 0.00, 0.40, 0.00, 0.05, 0.05, 0.30, 0.30, 0.00, 0.00, 0.70, 0.90, 0.00, 0.00 ],
    /* dh_ec         */ [ 0.10, 0.50, 0.50, 0.00, 0.25, 0.00, 0.05, 0.05, 0.30, 0.20, 0.00, 0.00, 0.55, 0.90, 0.00, 0.00 ],
    /* pragmatic     */ [ 0.30, 0.55, 0.50, 0.25, 0.50, 0.20, 0.30, 0.50, 0.35, 0.30, 0.20, 0.55, 0.50, 0.00, 0.10, 0.20 ],
    /* soma_kernel   */ [ 0.50, 0.50, 0.70, 0.30, 0.60, 0.45, 0.50, 0.50, 0.65, 0.30, 0.30, 0.50, 0.55, 0.00, 0.20, 0.30 ],
    /* strangler     */ [ 0.50, 0.50, 0.50, 0.40, 0.35, 0.30, 0.30, 0.70, 0.35, 0.25, 0.20, 0.30, 0.25, 0.00, 0.60, 0.15 ],
    /* surveillance  */ [ 0.25, 0.30, 0.55, 0.20, 0.60, 0.20, 0.20, 0.50, 0.65, 0.20, 0.50, 0.10, 0.70, 0.30, 0.10, 0.30 ],
    /* necromantic   */ [ 0.70, 0.65, 0.50, 0.40, 0.40, 0.30, 0.20, 0.65, 0.35, 0.50, 0.20, 0.45, 0.30, 0.00, 0.50, 0.10 ],
];

// ── Math ─────────────────────────────────────────────────────────────────────

fn dot(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let mut s = 0.0;
    for i in 0..N_DIMS { s += a[i] * b[i]; }
    s
}

fn norm(a: &[f64; N_DIMS]) -> f64 {
    dot(a, a).sqrt()
}

fn cosine_similarity(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let na = norm(a);
    let nb = norm(b);
    if na < 1e-12 || nb < 1e-12 { return 0.0; }
    dot(a, b) / (na * nb)
}

/// Returns indices of the top-K dimensions driving similarity between a and b,
/// measured by the product a[i] * b[i] (contribution to dot product).
fn top_drivers(a: &[f64; N_DIMS], b: &[f64; N_DIMS], k: usize) -> Vec<usize> {
    let mut contributions: Vec<(usize, f64)> = (0..N_DIMS)
        .map(|i| (i, a[i] * b[i]))
        .collect();
    contributions.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    contributions.iter().take(k).filter(|c| c.1 > 0.01).map(|c| c.0).collect()
}

// ── Kernel entry point ───────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn run_spectral_bridge(threshold: f64, max_bridges: f64, detail: f64) -> String {
    let threshold    = threshold.clamp(0.1, 0.99);
    let max_bridges  = (max_bridges as usize).clamp(1, 50);
    let show_detail  = detail > 0.5;  // 1.0 = show per-bridge dimension drivers

    let mut out = String::with_capacity(6000);

    // ── Banner ───────────────────────────────────────────────────────────────
    writeln!(out, "SPECTRAL BRIDGE v1.0.0 // SOMA-9.4 // FADE_DOCTRINE").unwrap();
    writeln!(out, "Cross-Cluster Topology Discovery via Mathematical Fingerprints").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  FEATURE SPACE: {} dimensions", N_DIMS).unwrap();
    writeln!(out, "  NODES:         {} kernels across {} clusters", NODE_IDS.len(), CLUSTER_NAMES.len()).unwrap();
    writeln!(out, "  THRESHOLD:     cos(theta) >= {:.2}", threshold).unwrap();
    writeln!(out, "  MAX_BRIDGES:   {}", max_bridges).unwrap();
    writeln!(out, "").unwrap();

    // ── Dimension legend ─────────────────────────────────────────────────────
    writeln!(out, "  DIMENSIONS:").unwrap();
    for (i, name) in DIM_NAMES.iter().enumerate() {
        if i > 0 && i % 4 == 0 { writeln!(out).unwrap(); write!(out, "    ").unwrap(); }
        else if i == 0 { write!(out, "    ").unwrap(); }
        write!(out, "{:>13}", name).unwrap();
    }
    writeln!(out).unwrap();
    writeln!(out).unwrap();

    // ── Compute all cross-cluster similarities ───────────────────────────────
    struct Bridge {
        a: usize,
        b: usize,
        sim: f64,
        drivers: Vec<usize>,
    }

    let mut bridges: Vec<Bridge> = Vec::new();

    for i in 0..25 {
        for j in (i + 1)..25 {
            // Skip same-cluster pairs
            if NODE_CLUSTERS[i] == NODE_CLUSTERS[j] { continue; }

            let sim = cosine_similarity(&FEATURES[i], &FEATURES[j]);
            if sim >= threshold {
                let drivers = top_drivers(&FEATURES[i], &FEATURES[j], 4);
                bridges.push(Bridge { a: i, b: j, sim, drivers });
            }
        }
    }

    // Sort by similarity descending
    bridges.sort_by(|x, y| y.sim.partial_cmp(&x.sim).unwrap_or(std::cmp::Ordering::Equal));
    bridges.truncate(max_bridges);

    // ── Similarity matrix header (top 5 highest) ─────────────────────────────
    writeln!(out, "  ── SPECTRAL SIMILARITY MATRIX (top results) ──────────────").unwrap();
    writeln!(out).unwrap();

    if bridges.is_empty() {
        writeln!(out, "  No cross-cluster pairs exceed threshold {:.2}", threshold).unwrap();
        writeln!(out, "  Lower --threshold to discover weaker bridges.").unwrap();
    } else {
        writeln!(out, "  {:>3}  {:>15} {:>5}  {:>15}   {:>6}  DRIVERS", "#", "NODE A", "CLUST", "NODE B", "COS").unwrap();
        writeln!(out, "  {}",  "─".repeat(72)).unwrap();

        for (rank, br) in bridges.iter().enumerate() {
            let ca = CLUSTER_NAMES[NODE_CLUSTERS[br.a] as usize];
            let _cb = CLUSTER_NAMES[NODE_CLUSTERS[br.b] as usize];
            let driver_str: String = br.drivers.iter()
                .map(|&d| DIM_NAMES[d])
                .collect::<Vec<_>>()
                .join(", ");

            writeln!(out, "  {:>3}  {:>15} {:>5}  {:>15}   {:.4}  {}",
                rank + 1,
                NODE_LABELS[br.a], ca,
                NODE_LABELS[br.b],
                br.sim,
                driver_str,
            ).unwrap();

            // Optional per-bridge detail: show the actual dimension values
            if show_detail && !br.drivers.is_empty() {
                write!(out, "       ").unwrap();
                for &d in &br.drivers {
                    write!(out, " {}[{:.2},{:.2}]", DIM_NAMES[d], FEATURES[br.a][d], FEATURES[br.b][d]).unwrap();
                }
                writeln!(out).unwrap();
            }
        }
    }

    writeln!(out).unwrap();

    // ── Cluster bridge summary ───────────────────────────────────────────────
    writeln!(out, "  ── CLUSTER BRIDGE SUMMARY ────────────────────────────────").unwrap();
    let mut pair_counts = std::collections::HashMap::new();
    for br in &bridges {
        let ca = NODE_CLUSTERS[br.a];
        let cb = NODE_CLUSTERS[br.b];
        let key = if ca < cb { (ca, cb) } else { (cb, ca) };
        *pair_counts.entry(key).or_insert(0u32) += 1;
    }
    let mut pairs: Vec<_> = pair_counts.iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(a.1));
    for ((ca, cb), count) in &pairs {
        writeln!(out, "    {} <-> {} : {} bridge(s)",
            CLUSTER_NAMES[*ca as usize],
            CLUSTER_NAMES[*cb as usize],
            count,
        ).unwrap();
    }
    if pairs.is_empty() {
        writeln!(out, "    (none above threshold)").unwrap();
    }

    writeln!(out).unwrap();
    writeln!(out, "  {} cross-cluster bridges discovered (threshold >= {:.2})", bridges.len(), threshold).unwrap();
    writeln!(out, "  Topology is alive. Entropy is structural.").unwrap();

    // ── DATA: suffix for frontend consumption ────────────────────────────────
    // Format: { "bridges": [[a_idx, b_idx, similarity], ...], "threshold": 0.70 }
    let bridge_json: Vec<String> = bridges.iter()
        .map(|br| format!("[{},{},{:.4}]", br.a, br.b, br.sim))
        .collect();

    // Also emit driver info for each bridge
    let driver_json: Vec<String> = bridges.iter()
        .map(|br| {
            let d: Vec<String> = br.drivers.iter().map(|&i| format!("\"{}\"", DIM_NAMES[i])).collect();
            format!("[{}]", d.join(","))
        })
        .collect();

    write!(out, "\nDATA:{{\"bridges\":[{}],\"drivers\":[{}],\"threshold\":{:.2}}}",
        bridge_json.join(","),
        driver_json.join(","),
        threshold,
    ).unwrap();

    out
}
