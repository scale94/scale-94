// compare_nodes.rs — SOMA-9.4 // FEIGENBAUM_FADE
//
// WASM-exported Resonance engine: optimized 16D dot-product cosine similarity
// between node feature tensors, plus Period-Doubling bifurcation child computation.
//
// Build target: wasm32-unknown-unknown via wasm-bindgen / wasm-pack
//   wasm-pack build --target web --out-dir src/wasm
//
// Both functions are also mirrored in nodeFeatures.js (JS fallback, no WASM needed
// at runtime) so the visualizer works before recompilation.

use wasm_bindgen::prelude::*;

// ── Tensor constants ──────────────────────────────────────────────────────────

const N_DIM:   usize = 16;
const N_NODES: usize = 31;

/// 16D feature tensors for all 31 nodes — matches JS FEATURES matrix exactly.
/// Row order is identical to NODES array in nodeFeatures.js.
#[rustfmt::skip]
static FEATURES: [[f32; N_DIM]; N_NODES] = [
  /*  0 biocoenosis       */ [0.75,0.55,0.50,0.30,0.90,0.30,0.40,0.50,0.35,0.70,0.40,0.20,0.85,0.00,1.00,0.20],
  /*  1 atmospheric       */ [0.80,0.70,0.75,0.50,0.55,0.20,0.50,0.80,0.70,0.30,0.10,0.80,0.30,0.00,0.40,0.10],
  /*  2 chrono            */ [0.50,0.45,0.50,0.30,0.50,0.10,0.30,1.00,0.35,0.20,0.30,0.60,0.40,0.00,0.65,0.70],
  /*  3 daly              */ [0.25,0.40,0.30,0.20,0.70,0.20,0.60,0.70,0.05,0.10,0.50,0.75,0.50,0.00,0.30,0.90],
  /*  4 replicator        */ [0.55,0.70,0.50,0.45,0.45,0.50,0.50,0.45,0.65,0.30,1.00,0.10,0.30,0.00,0.75,0.40],
  /*  5 grayscott         */ [1.00,0.90,0.75,0.60,0.30,0.40,0.40,0.30,1.00,0.00,0.00,0.20,0.10,0.00,0.30,0.00],
  /*  6 kuramoto          */ [0.55,0.60,0.70,0.55,0.35,1.00,0.50,0.40,0.65,0.20,0.20,0.10,0.25,0.00,0.25,0.10],
  /*  7 ceei              */ [0.25,0.30,0.55,0.20,0.40,0.50,0.80,0.20,0.65,0.10,0.85,0.20,0.40,0.00,0.10,1.00],
  /*  8 soma91            */ [0.30,0.35,0.50,0.30,0.50,0.40,0.50,0.50,0.65,0.20,0.30,0.50,0.50,0.00,0.20,0.50],
  /*  9 soma_plus         */ [0.45,0.40,0.55,0.30,0.50,0.50,0.50,0.50,0.65,0.30,0.30,0.50,0.50,0.00,0.20,0.40],
  /* 10 leviathan         */ [0.30,0.50,0.70,0.35,0.40,0.55,0.30,0.45,0.65,0.30,0.90,0.25,0.30,0.00,0.10,0.50],
  /* 11 cynic             */ [0.15,0.25,0.30,0.10,0.30,0.20,0.20,0.35,0.10,0.15,0.50,0.15,0.20,0.00,0.10,0.30],
  /* 12 feigenbaum        */ [0.30,1.00,0.25,0.85,0.25,0.10,0.50,0.20,0.05,0.00,0.00,0.10,0.20,0.00,0.00,0.00],
  /* 13 ising             */ [0.85,0.65,0.55,1.00,0.60,0.70,0.50,0.30,0.40,0.90,0.10,0.85,0.50,0.00,0.00,0.00],
  /* 14 bosonic           */ [0.50,0.55,0.70,0.70,0.40,0.60,0.50,0.20,0.65,0.30,0.40,0.70,0.30,0.00,0.00,0.30],
  /* 15 seraphine         */ [0.50,0.65,0.70,0.50,0.35,0.30,0.40,0.25,0.65,0.40,0.10,0.40,0.35,0.45,0.00,0.10],
  /* 16 fusion            */ [0.80,0.75,0.75,0.60,0.30,0.20,0.45,0.30,0.90,0.30,0.00,0.90,0.20,0.00,0.00,0.10],
  /* 17 classified        */ [0.05,0.30,0.30,0.00,0.20,0.00,0.05,0.05,0.05,0.50,0.00,0.00,0.50,1.00,0.00,0.00],
  /* 18 pqhash            */ [0.05,0.35,0.45,0.00,0.40,0.00,0.05,0.05,0.30,0.30,0.00,0.00,0.70,0.90,0.00,0.00],
  /* 19 dh_ec             */ [0.10,0.50,0.50,0.00,0.25,0.00,0.05,0.05,0.30,0.20,0.00,0.00,0.55,0.90,0.00,0.00],
  /* 20 pragmatic         */ [0.30,0.55,0.50,0.25,0.50,0.20,0.30,0.50,0.35,0.30,0.20,0.55,0.50,0.00,0.10,0.20],
  /* 21 soma_kernel       */ [0.50,0.50,0.70,0.30,0.60,0.45,0.50,0.50,0.65,0.30,0.30,0.50,0.55,0.00,0.20,0.30],
  /* 22 strangler         */ [0.50,0.50,0.50,0.40,0.35,0.30,0.30,0.70,0.35,0.25,0.20,0.30,0.25,0.00,0.60,0.15],
  /* 23 surveillance      */ [0.25,0.30,0.55,0.20,0.60,0.20,0.20,0.50,0.65,0.20,0.50,0.10,0.70,0.30,0.10,0.30],
  /* 24 necromantic       */ [0.70,0.65,0.50,0.40,0.40,0.30,0.20,0.65,0.35,0.50,0.20,0.45,0.30,0.00,0.50,0.10],
  /* 25 white_irid        */ [0.45,0.70,0.55,0.35,0.40,0.65,0.25,0.80,0.75,0.20,0.05,0.50,0.25,0.00,1.00,0.10],
  /* 26 pitch_black_steel */ [0.40,0.75,0.45,0.70,0.45,0.55,0.30,0.30,0.55,0.35,0.05,0.90,0.15,0.00,0.00,0.80],
  /* 27 bouligand_36      */ [0.35,0.60,0.35,0.25,0.30,0.90,0.20,0.10,0.55,0.15,0.05,0.40,0.20,0.10,0.90,0.05],
  /* 28 polymorph_pqc     */ [0.30,0.80,0.90,0.40,0.85,0.15,0.10,0.10,0.05,0.90,0.85,0.10,0.90,0.95,0.00,0.40],
  /* 29 magic_angle_1p1   */ [0.80,0.85,0.70,0.95,0.65,0.90,0.75,0.20,0.80,0.55,0.00,0.90,0.45,0.15,0.00,0.20],
  /* 30 zero_effort_flow  */ [0.75,0.70,0.65,0.60,0.50,0.70,0.40,0.45,0.40,0.40,0.20,0.20,0.55,0.00,0.60,0.30],
];

static DIM_NAMES: [&str; N_DIM] = [
  "dynamical", "nonlinearity", "dimensionality", "criticality",
  "entropy",   "synchrony",   "conservation",   "temporal",
  "spatial",   "stochastic",  "game_theory",    "thermodynamic",
  "information","cryptographic","biological",    "economic",
];

// ── Core math ─────────────────────────────────────────────────────────────────

/// Optimized dot-product cosine similarity.
/// Computes Σ(A[i]·B[i]) / (|A|·|B|) in a single SIMD-friendly loop.
/// Both norms and the dot product accumulate in parallel, avoiding a second pass.
#[inline(always)]
fn cosine_similarity(a: &[f32; N_DIM], b: &[f32; N_DIM]) -> f32 {
    let mut dot = 0.0_f32;
    let mut na  = 0.0_f32;
    let mut nb  = 0.0_f32;

    // Unrolled 16-element loop — LLVM will auto-vectorize with -O2
    for i in 0..N_DIM {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }

    let denom = (na * nb).sqrt();
    if denom < 1.0e-12 { 0.0 } else { dot / denom }
}

/// Returns the top-k dimension indices ranked by product weight A[i]·B[i].
fn top_k_dims(a: &[f32; N_DIM], b: &[f32; N_DIM], k: usize) -> Vec<usize> {
    let mut pairs: Vec<(usize, f32)> = (0..N_DIM)
        .map(|i| (i, a[i] * b[i]))
        .filter(|(_, w)| *w > 0.01)
        .collect();
    pairs.sort_unstable_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    pairs.into_iter().take(k).map(|(i, _)| i).collect()
}

/// Minimal xorshift64 PRNG — seeded with the current node index + iteration.
/// No std::random dependency needed in WASM.
#[inline(always)]
fn xorshift64(state: &mut u64) -> f32 {
    *state ^= *state << 13;
    *state ^= *state >> 7;
    *state ^= *state << 17;
    (*state as f32) / (u64::MAX as f32)
}

// ── WASM exports ──────────────────────────────────────────────────────────────

/// Compare two nodes by zero-based index.
///
/// Returns a JSON string:
/// ```json
/// {
///   "sim": 0.8734,
///   "topDims": [
///     { "name": "synchrony",   "contribution": 0.0625, "vA": 0.25, "vB": 0.25 },
///     { "name": "spatial",     "contribution": 0.0423, "vA": 0.65, "vB": 0.65 },
///     { "name": "stochastic",  "contribution": 0.0200, "vA": 0.20, "vB": 0.10 }
///   ]
/// }
/// ```
#[wasm_bindgen]
pub fn compare_nodes(idx_a: u32, idx_b: u32) -> String {
    let ia = idx_a as usize;
    let ib = idx_b as usize;

    if ia >= N_NODES || ib >= N_NODES {
        return r#"{"error":"index out of bounds"}"#.to_string();
    }

    let a   = &FEATURES[ia];
    let b   = &FEATURES[ib];
    let sim = cosine_similarity(a, b);
    let top = top_k_dims(a, b, 3);

    let dims_json: Vec<String> = top.iter().map(|&i| {
        format!(
            r#"{{"name":"{}","contribution":{:.4},"vA":{:.4},"vB":{:.4}}}"#,
            DIM_NAMES[i], a[i] * b[i], a[i], b[i]
        )
    }).collect();

    format!(r#"{{"sim":{:.4},"topDims":[{}]}}"#, sim, dims_json.join(","))
}

/// Compute period-doubling bifurcation children.
///
/// `degrees_json` — JSON array of u32 connection degrees, one per node (length = N_NODES).
///
/// Returns a JSON array of child specs for nodes in the top 15% by degree:
/// ```json
/// [
///   {
///     "parentIdx": 12,
///     "childFeatures": [0.2987, 1.0000, 0.2532, ...]
///   },
///   ...
/// ]
/// ```
/// The JS layer is responsible for sphere placement, color inheritance, and birth animation.
#[wasm_bindgen]
pub fn compute_bifurcation_children(degrees_json: &str) -> String {
    // Parse degree array — gracefully handle malformed JSON
    let degrees: Vec<u32> = match serde_json::from_str(degrees_json) {
        Ok(v)  => v,
        Err(_) => return "[]".to_string(),
    };

    let n       = degrees.len().min(N_NODES);
    let max_deg = degrees[..n].iter().copied().max().unwrap_or(1).max(1);
    // Top 15% threshold: nodes with degree ≥ 85% of the maximum
    let threshold = (max_deg as f32 * 0.85) as u32;

    let mut children: Vec<String> = Vec::new();

    for (i, &deg) in degrees[..n].iter().enumerate() {
        if deg < threshold { continue; }

        let parent = &FEATURES[i];
        let mut child = [0.0_f32; N_DIM];
        // Seed with a deterministic value per (parent, dimension) pair
        let mut rng: u64 = 0xDEAD_CAFE_0000_0000 ^ ((i as u64) << 16);

        for j in 0..N_DIM {
            // ±2.5% stochastic tensor drift — simulates Feigenbaum period-doubling
            let jitter = (xorshift64(&mut rng) - 0.5) * 0.05;
            child[j]   = (parent[j] + jitter).clamp(0.0, 1.0);
        }

        let feats: Vec<String> = child.iter().map(|v| format!("{:.4}", v)).collect();
        children.push(format!(
            r#"{{"parentIdx":{},"childFeatures":[{}]}}"#,
            i, feats.join(",")
        ));
    }

    format!("[{}]", children.join(","))
}
