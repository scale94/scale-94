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

// ── Task 1: Tensor-Directed Edge Kinematics ──────────────────────────────────
//
// Three scalar tensors derived from the 16D feature space drive visual
// kinematics on each rendered edge in the Three.js/WebGL frontend:
//
//   Temporal Tensor  (Tt) — from dimension 7 "temporal"
//     → controls dashed-line texture scroll speed along the bezier curve
//
//   Dynamical Tensor (Dd) — from dimension 0 "dynamical"
//     → controls stroke width and sine-wave amplitude of the edge
//
//   Nonlinearity Tensor (Nl) — from dimension 1 "nonlinearity"
//     → controls magnitude of randomised jitter/noise on the path
//
// Each value is the geometric mean of the two nodes' scores on that dimension,
// giving a value in [0, 1] that reflects mutual strength on the axis.

/// Per-edge tensor bundle for the Three.js visual layer.
#[wasm_bindgen]
pub struct EdgeTensors {
    /// Tt — temporal geometry mean; drives bezier texture scroll speed.
    pub temporal: f64,
    /// Dd — dynamical geometry mean; drives stroke width + sine amplitude.
    pub dynamical: f64,
    /// Nl — nonlinearity geometry mean; drives jitter/noise magnitude.
    pub nonlinearity: f64,
    /// Raw cosine similarity of the edge (0–1).
    pub similarity: f64,
    /// Source node index (matches NODE_IDS / FEATURES arrays).
    pub a: u32,
    /// Target node index.
    pub b: u32,
}

#[wasm_bindgen]
impl EdgeTensors {
    /// Serialise to a compact JSON object for direct JS consumption.
    pub fn to_json(&self) -> String {
        format!(
            "{{\"a\":{},\"b\":{},\"temporal\":{:.4},\"dynamical\":{:.4},\"nonlinearity\":{:.4},\"similarity\":{:.4}}}",
            self.a, self.b, self.temporal, self.dynamical, self.nonlinearity, self.similarity
        )
    }
}

/// Compute the three visual-kinematic tensors for a single edge (a_idx → b_idx).
/// Returns `None` (JS `null`) if either index is out of range.
#[wasm_bindgen]
pub fn get_edge_tensors(a_idx: u32, b_idx: u32) -> Option<EdgeTensors> {
    let (a, b) = (a_idx as usize, b_idx as usize);
    if a >= 25 || b >= 25 { return None; }
    let fa = &FEATURES[a];
    let fb = &FEATURES[b];
    Some(EdgeTensors {
        temporal:     (fa[7] * fb[7]).sqrt(),   // dimension 7 — temporal
        dynamical:    (fa[0] * fb[0]).sqrt(),   // dimension 0 — dynamical
        nonlinearity: (fa[1] * fb[1]).sqrt(),   // dimension 1 — nonlinearity
        similarity:   cosine_similarity(fa, fb),
        a: a_idx,
        b: b_idx,
    })
}

/// Returns a JSON array of EdgeTensor objects for **every** node pair whose
/// cosine similarity meets `threshold`.  Includes both cross- and same-cluster
/// pairs so the frontend can drive all visible edges, not just bridges.
///
/// Format: [{"a":i,"b":j,"temporal":f,"dynamical":f,"nonlinearity":f,"similarity":f}, ...]
#[wasm_bindgen]
pub fn get_all_edge_tensors(threshold: f64) -> String {
    let threshold = threshold.clamp(0.0, 1.0);
    let mut entries: Vec<String> = Vec::with_capacity(64);

    for i in 0..25_usize {
        for j in (i + 1)..25_usize {
            let fa = &FEATURES[i];
            let fb = &FEATURES[j];
            let sim = cosine_similarity(fa, fb);
            if sim < threshold { continue; }

            let tt = (fa[7] * fb[7]).sqrt();
            let dd = (fa[0] * fb[0]).sqrt();
            let nl = (fa[1] * fb[1]).sqrt();

            entries.push(format!(
                "{{\"a\":{},\"b\":{},\"temporal\":{:.4},\"dynamical\":{:.4},\"nonlinearity\":{:.4},\"similarity\":{:.4}}}",
                i, j, tt, dd, nl, sim
            ));
        }
    }

    format!("[{}]", entries.join(","))
}

// ── Task 2: Gray-Scott Reaction-Diffusion Hooks (drk cluster) ────────────────
//
// The five `drk` cluster nodes (pragmatic, soma_kernel, strangler,
// surveillance, necromantic — indices 20–24) are seeded as reaction sources
// in a 64×64 Gray-Scott grid.  After `step()` is called, the V-field buffer
// can be read directly from WASM linear memory by the WebGL shader:
//
//   const grid  = new DrkDiffusionGrid();
//   grid.step(0.035, 0.065, 200);            // feed, kill, iterations
//   const vBuf  = new Float32Array(          // zero-copy view
//       wasm.memory.buffer, grid.v_ptr(), grid.v_len()
//   );
//   // Upload vBuf to a WebGL texture and sample in the fragment shader.
//
// Spot-forming parameters (f≈0.035, k≈0.065) are recommended for Turing
// patterns on node surfaces.  Labyrinthine: f=0.060, k=0.062.

const DRK_GRID_W: usize = 64;
const DRK_GRID_H: usize = 64;

// Normalised (x, y) seed positions for the five drk nodes in [0,1]² space.
// Mapped onto the grid at construction time.
const DRK_SEED_POSITIONS: [(f32, f32); 5] = [
    (0.30, 0.50),   // pragmatic    (idx 20)
    (0.50, 0.50),   // soma_kernel  (idx 21)
    (0.70, 0.50),   // strangler    (idx 22)
    (0.50, 0.25),   // surveillance (idx 23)
    (0.50, 0.75),   // necromantic  (idx 24)
];

const DRK_SEED_RADIUS: usize = 3;  // patch half-size in grid cells

/// Stateful Gray-Scott grid seeded from the five `drk` cluster node positions.
/// Exports the V-field as a raw `f32` buffer for direct WebGL texture upload.
#[wasm_bindgen]
pub struct DrkDiffusionGrid {
    u: Vec<f32>,
    v: Vec<f32>,
    total_steps: u32,
}

#[wasm_bindgen]
impl DrkDiffusionGrid {
    /// Construct and seed the 64×64 grid.  Call `step()` to evolve the PDE.
    #[wasm_bindgen(constructor)]
    pub fn new() -> DrkDiffusionGrid {
        let size = DRK_GRID_W * DRK_GRID_H;
        let mut u = vec![1.0_f32; size];
        let mut v = vec![0.0_f32; size];

        for &(nx, ny) in &DRK_SEED_POSITIONS {
            let cx = ((nx * DRK_GRID_W as f32) as usize).min(DRK_GRID_W - 1);
            let cy = ((ny * DRK_GRID_H as f32) as usize).min(DRK_GRID_H - 1);
            let r  = DRK_SEED_RADIUS;

            let x0 = cx.saturating_sub(r);
            let x1 = (cx + r).min(DRK_GRID_W - 1);
            let y0 = cy.saturating_sub(r);
            let y1 = (cy + r).min(DRK_GRID_H - 1);

            for py in y0..=y1 {
                for px in x0..=x1 {
                    let idx = py * DRK_GRID_W + px;
                    u[idx] = 0.5;
                    v[idx] = 0.25;
                }
            }
        }

        DrkDiffusionGrid { u, v, total_steps: 0 }
    }

    /// Advance the simulation by `steps` PDE iterations.
    ///
    /// Recommended parameters for Turing spot patterns: feed=0.035, kill=0.065.
    /// Labyrinthine / maze patterns:                    feed=0.060, kill=0.062.
    pub fn step(&mut self, feed: f32, kill: f32, steps: u32) {
        let du: f32 = 0.2;
        let dv: f32 = 0.1;
        let dt: f32 = 1.0;
        let w = DRK_GRID_W;
        let h = DRK_GRID_H;

        let mut nu = self.u.clone();
        let mut nv = self.v.clone();

        for _ in 0..steps {
            for y in 1..(h - 1) {
                for x in 1..(w - 1) {
                    let idx = y * w + x;
                    let u   = self.u[idx];
                    let v   = self.v[idx];
                    let uvv = u * v * v;

                    let lap_u = self.u[idx - 1] + self.u[idx + 1]
                              + self.u[idx - w]  + self.u[idx + w]
                              - 4.0 * u;

                    let lap_v = self.v[idx - 1] + self.v[idx + 1]
                              + self.v[idx - w]  + self.v[idx + w]
                              - 4.0 * v;

                    nu[idx] = (u + (du * lap_u - uvv + feed * (1.0 - u)) * dt).clamp(0.0, 1.0);
                    nv[idx] = (v + (dv * lap_v + uvv - (feed + kill) *  v) * dt).clamp(0.0, 1.0);
                }
            }
            std::mem::swap(&mut self.u, &mut nu);
            std::mem::swap(&mut self.v, &mut nv);
        }

        self.total_steps += steps;
    }

    /// Pointer to the V-field `f32` buffer in WASM linear memory.
    ///
    /// JS usage (zero-copy):
    ///   const tex = new Float32Array(wasm.memory.buffer, grid.v_ptr(), grid.v_len());
    pub fn v_ptr(&self) -> *const f32 { self.v.as_ptr() }

    /// Number of `f32` elements in the V-field buffer (width × height = 4096).
    pub fn v_len(&self) -> usize { self.v.len() }

    /// Pointer to the U-field buffer (substrate concentration).
    pub fn u_ptr(&self) -> *const f32 { self.u.as_ptr() }

    pub fn width(&self)       -> usize { DRK_GRID_W }
    pub fn height(&self)      -> usize { DRK_GRID_H }
    pub fn total_steps(&self) -> u32   { self.total_steps }

    /// Re-seed all drk node patches — useful for resetting without re-allocating.
    pub fn reseed(&mut self) {
        let size = DRK_GRID_W * DRK_GRID_H;
        self.u.iter_mut().for_each(|x| *x = 1.0);
        self.v.iter_mut().for_each(|x| *x = 0.0);
        self.total_steps = 0;
        let _ = size; // silence unused warning; loop above handles it

        for &(nx, ny) in &DRK_SEED_POSITIONS {
            let cx = ((nx * DRK_GRID_W as f32) as usize).min(DRK_GRID_W - 1);
            let cy = ((ny * DRK_GRID_H as f32) as usize).min(DRK_GRID_H - 1);
            let r  = DRK_SEED_RADIUS;
            let x0 = cx.saturating_sub(r);
            let x1 = (cx + r).min(DRK_GRID_W - 1);
            let y0 = cy.saturating_sub(r);
            let y1 = (cy + r).min(DRK_GRID_H - 1);
            for py in y0..=y1 {
                for px in x0..=x1 {
                    let idx = py * DRK_GRID_W + px;
                    self.u[idx] = 0.5;
                    self.v[idx] = 0.25;
                }
            }
        }
    }
}
