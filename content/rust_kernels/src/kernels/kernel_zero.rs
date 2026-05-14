// kernel_zero.rs — KERNEL 0.0.0.0 // The Origin Vector
//
// The zero vector in 16-D feature space. Cannot be normalized (||0|| = 0).
// Cosine similarity with anything is 0/0 (NaN). Fixed under all rotations.
// All distances FROM the origin equal the magnitude of the OTHER vector — the
// origin contributes no information to any pair it participates in.
//
// The kernel's purpose is to make these degenerate properties measurable, then
// run the Genesis Operation: inject ε in one of the 16 dimensions and trace
// the trajectory by which the vector "becomes" a real position in feature
// space. Each ε-step is observable: magnitude crosses zero, normalization
// becomes defined, cosine similarity with reference vectors transitions from
// undefined to a value.
//
// Metaphorical anchors (not load-bearing):
//   - IPv4 0.0.0.0 / DHCP DHCPDISCOVER source address — the unspecified
//     address used precisely once per node, before binding.
//   - Anaximander's apeiron — the indeterminate substrate from which
//     all determinate things separate.
//
// The kernel is loaded to be left behind. It exists to make the genesis
// transition visible, not to model it as a steady state.
//
// SOMA-9.4 · FADE_DOCTRINE · KERNEL-0.0.0.0

use std::fmt::Write;
use wasm_bindgen::prelude::*;

const N_DIMS: usize = 16;

const DIM_NAMES: [&str; N_DIMS] = [
    "dynamical",      "nonlinearity",   "dimensionality", "criticality",
    "entropy",        "synchrony",      "conservation",   "temporal",
    "spatial",        "stochastic",     "game_theory",    "thermodynamic",
    "information",    "cryptographic",  "biological",     "economic",
];

// ── Reference vectors: the apex points the genesis trajectory walks toward ──
// These are real fingerprints from spectral_bridge.rs — kernels that
// represent extreme positions in the 16-D space. The genesis trajectory's
// cosine similarity with each is what becomes defined as ε accumulates.

#[rustfmt::skip]
const REFERENCES: [(&str, [f64; N_DIMS]); 4] = [
    ("fish_scale_apex (FSK-11.1.1)",
     [0.70, 0.65, 0.50, 0.40, 0.40, 0.30, 0.20, 0.65, 0.35, 0.50, 0.20, 0.45, 0.30, 0.00, 0.50, 0.10]),
    ("dissipative_sovereignty (DSK-5.0)",
     [0.80, 0.55, 0.40, 0.85, 0.95, 0.20, 0.10, 0.70, 0.30, 0.30, 0.30, 1.00, 0.40, 0.00, 0.20, 0.60]),
    ("post_quantum_crypto (ML-KEM)",
     [0.05, 0.30, 0.30, 0.00, 0.20, 0.00, 0.05, 0.05, 0.05, 0.50, 0.00, 0.00, 0.50, 1.00, 0.00, 0.00]),
    ("biocoenosis (FLORA-1.0.1)",
     [0.75, 0.55, 0.50, 0.30, 0.90, 0.30, 0.40, 0.50, 0.35, 0.70, 0.40, 0.20, 0.85, 0.00, 1.00, 0.20]),
];

// ── Math primitives ──────────────────────────────────────────────────────────

fn dot(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let mut s = 0.0;
    for i in 0..N_DIMS { s += a[i] * b[i]; }
    s
}

fn norm(a: &[f64; N_DIMS]) -> f64 {
    dot(a, a).sqrt()
}

/// Cosine similarity. Returns f64::NAN when either argument is the zero vector,
/// preserving the genuine 0/0 indeterminacy rather than masking it with 0.0.
/// This is the entire point of the kernel.
fn cosine(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let na = norm(a);
    let nb = norm(b);
    if na == 0.0 || nb == 0.0 { return f64::NAN; }
    dot(a, b) / (na * nb)
}

/// Format a similarity value, distinguishing NAN ("undefined") from numeric.
fn fmt_sim(s: f64) -> String {
    if s.is_nan() { "        UNDEF".to_string() } else { format!("{:>13.6}", s) }
}

/// Format the magnitude with explicit zero handling.
fn fmt_mag(m: f64) -> String {
    if m == 0.0 { "  0 (origin)".to_string() } else { format!("{:>12.6e}", m) }
}

// ── Kernel entry point ───────────────────────────────────────────────────────

/// KERNEL-0.0.0.0 — Origin Vector & Genesis Operation
///
/// Args:
///   genesis_dim: which of the 16 dimensions receives the first ε. Clamped to
///                [0, 15]. Default 14 (biological — anchors to FSK).
///   epsilon:     the magnitude of one genesis step. Default 1e-3.
///   steps:       number of ε increments to trace. Default 16. Clamped 1..=64.
#[wasm_bindgen]
pub fn run_kernel_zero(genesis_dim: f64, epsilon: f64, steps: f64) -> String {
    let dim = (genesis_dim as usize).min(N_DIMS - 1);
    let eps = if epsilon > 0.0 && epsilon.is_finite() { epsilon } else { 1e-3 };
    let n   = (steps as usize).clamp(1, 64);

    let mut out = String::with_capacity(4096);
    let zero: [f64; N_DIMS] = [0.0; N_DIMS];

    // ── Banner ───────────────────────────────────────────────────────────────
    writeln!(out, "KERNEL 0.0.0.0 // ORIGIN VECTOR // SOMA-9.4 // FADE_DOCTRINE").unwrap();
    writeln!(out, "DHCP UNSPECIFIED ADDRESS · ANAXIMANDER APEIRON · LOADED TO BE LEFT BEHIND").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "  FEATURE SPACE: {} dimensions", N_DIMS).unwrap();
    writeln!(out, "  GENESIS DIM:   [{}] {}", dim, DIM_NAMES[dim]).unwrap();
    writeln!(out, "  EPSILON:       {:.3e}", eps).unwrap();
    writeln!(out, "  TRAJECTORY:    {} steps", n).unwrap();
    writeln!(out).unwrap();

    // ── Phase 1: The degenerate origin ───────────────────────────────────────
    writeln!(out, "  ── PHASE 1: ORIGIN STATE ─────────────────────────────────").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "    vector:        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]").unwrap();
    writeln!(out, "    magnitude:     ||0|| = {}", fmt_mag(norm(&zero))).unwrap();
    writeln!(out, "    normalize:     0/||0|| = 0/0 = UNDEF").unwrap();
    writeln!(out, "    self-cosine:   cos(0, 0) = {} (degenerate identity)", fmt_sim(cosine(&zero, &zero))).unwrap();
    writeln!(out, "    rotation:      R · 0 = 0  ∀R ∈ SO(16)  (fixed point)").unwrap();
    writeln!(out).unwrap();

    writeln!(out, "  ── REFERENCE COSINES FROM ORIGIN ─────────────────────────").unwrap();
    writeln!(out, "  (every cosine here is 0/0 — the origin has no neighbours)").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "    {:<35} {}", "REFERENCE", "cos(0, ref)").unwrap();
    writeln!(out, "    {}", "─".repeat(58)).unwrap();
    for (name, vec) in REFERENCES.iter() {
        let s = cosine(&zero, vec);
        writeln!(out, "    {:<35} {}", name, fmt_sim(s)).unwrap();
    }
    writeln!(out).unwrap();

    // ── Phase 2: Genesis trajectory ──────────────────────────────────────────
    writeln!(out, "  ── PHASE 2: GENESIS TRAJECTORY ───────────────────────────").unwrap();
    writeln!(out, "  Inject {:.3e} into dim[{}] = '{}', then accumulate.",
        eps, dim, DIM_NAMES[dim]).unwrap();
    writeln!(out, "  Watch: at step 1 the vector is born. At step ∞ it is somewhere.").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "    {:>4} {:>14} {:>13} {:>13} {:>13} {:>13}",
        "STEP", "MAGNITUDE", "cos(FSK)", "cos(DSK)", "cos(KEM)", "cos(BIO)").unwrap();
    writeln!(out, "    {}", "─".repeat(74)).unwrap();

    // Step 0: origin
    writeln!(out, "    {:>4} {:>14} {} {} {} {}",
        0,
        fmt_mag(0.0),
        fmt_sim(f64::NAN), fmt_sim(f64::NAN), fmt_sim(f64::NAN), fmt_sim(f64::NAN)).unwrap();

    // Steps 1..n: accumulate ε into the chosen dimension
    let mut v: [f64; N_DIMS] = [0.0; N_DIMS];
    for k in 1..=n {
        v[dim] = (k as f64) * eps;
        let mag = norm(&v);
        let cs: Vec<f64> = REFERENCES.iter().map(|(_, r)| cosine(&v, r)).collect();
        writeln!(out, "    {:>4} {:>14.6e} {} {} {} {}",
            k, mag,
            fmt_sim(cs[0]), fmt_sim(cs[1]), fmt_sim(cs[2]), fmt_sim(cs[3])).unwrap();
    }
    writeln!(out).unwrap();

    // ── Phase 3: The departure ───────────────────────────────────────────────
    writeln!(out, "  ── PHASE 3: DEPARTURE ────────────────────────────────────").unwrap();
    writeln!(out).unwrap();

    // After n steps, the vector has magnitude n*eps along axis `dim`.
    // Cosine similarity with each reference is exactly the unit-vector projection
    // along that single axis: cos = ref[dim] / ||ref||. It does NOT depend on n
    // or eps once we are off the origin — only on which dim we picked.
    let final_mag = (n as f64) * eps;
    writeln!(out, "    final position: e_{} · {:.3e}", dim, final_mag).unwrap();
    writeln!(out, "    final magnitude: {:.6e}", final_mag).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "    PROPERTY: once the origin is left, cosine similarity to any").unwrap();
    writeln!(out, "    reference is invariant under scaling along the chosen axis.").unwrap();
    writeln!(out, "    The DIRECTION is set by the first non-zero coordinate. Magnitude").unwrap();
    writeln!(out, "    is metabolic detail. The genesis decision is which dim, not how much.").unwrap();
    writeln!(out).unwrap();

    // Cluster the references by which dim chose them most strongly
    writeln!(out, "    REFERENCE PROJECTIONS ON THE GENESIS AXIS [{}]:", DIM_NAMES[dim]).unwrap();
    writeln!(out, "    {}", "─".repeat(58)).unwrap();
    for (name, vec) in REFERENCES.iter() {
        let projection = vec[dim];      // value of reference on this axis
        let ref_mag = norm(vec);
        let final_cos = if ref_mag > 0.0 { projection / ref_mag } else { f64::NAN };
        let alignment = if final_cos.abs() < 0.05 {
            "perpendicular — never reachable from this genesis"
        } else if final_cos > 0.5 {
            "aligned — this genesis points toward the reference"
        } else if final_cos > 0.05 {
            "weakly aligned — partial projection"
        } else {
            "anti-aligned — opposite half-space"
        };
        writeln!(out, "    {:<35} cos = {:>7.4}  ({})", name, final_cos, alignment).unwrap();
    }
    writeln!(out).unwrap();

    // ── Closing ──────────────────────────────────────────────────────────────
    writeln!(out, "  ── KERNEL DISCHARGE ──────────────────────────────────────").unwrap();
    writeln!(out, "  The origin is not a place. It is a permission to be one.").unwrap();
    writeln!(out, "  This kernel is loaded once per node, then unloaded forever.").unwrap();

    // ── DATA suffix for frontend consumption ─────────────────────────────────
    // { "dim": int, "dim_name": str, "epsilon": float, "steps": int,
    //   "final_magnitude": float,
    //   "final_cosines": [{ "ref": str, "value": float|null }, ...] }
    let cosines_json: Vec<String> = REFERENCES.iter().map(|(name, vec)| {
        let ref_mag = norm(vec);
        let cos = if ref_mag > 0.0 { vec[dim] / ref_mag } else { f64::NAN };
        let cos_str = if cos.is_nan() { "null".to_string() } else { format!("{:.6}", cos) };
        format!("{{\"ref\":\"{}\",\"value\":{}}}", name, cos_str)
    }).collect();

    write!(
        out,
        "\nDATA:{{\"dim\":{},\"dim_name\":\"{}\",\"epsilon\":{:.6e},\"steps\":{},\"final_magnitude\":{:.6e},\"final_cosines\":[{}]}}",
        dim,
        DIM_NAMES[dim],
        eps,
        n,
        final_mag,
        cosines_json.join(","),
    ).unwrap();

    out
}
