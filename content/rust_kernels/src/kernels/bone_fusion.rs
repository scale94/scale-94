// kernels/bone_fusion.rs – BONE_FUSION v7.7.7.7.7.7.7 · Necromantic Bone Fusion Engine
//
// 16-dimensional tensor space for associative reasoning at physics-engine fidelity.
// This is not semantic search – it is a thermodynamic field simulation where concepts
// are particles with mass, hysteresis, metabolic cost, and topological modularity.
//
// FUSED RUN (Layer 6.6.6.6.6.6 foundation + Layer 7.7.7.7.7.7.7 convergence):
//   1. SovereignTensor – memory-packed 16D concept node (176 bytes, 3 cache lines)
//   2. Fusable / KineticState – zero-allocation trait bounds for convergence ops
//   3. SystemTrauma – biomimetic error matrix (Arapaima gigas 36° lateral dissipation)
//   4. TensorField – fixed-capacity arena with batch operations
//   5. Bouligand Rotation (36.0°) – lateral trauma dissipation in highest-variance plane
//   6. Cognitive Magic Angle (1.1°) – Moiré superlattice micro-rotation across all dims
//   7. Saponification Protocol – chemical burn stripping metabolic fat until cos > 0.9990
//   8. Phase Transition Detection – SUBSTRATE → DETONATION → SUPERFLUID → CRYSTALLINE
//
// The 16 dimensions:
//   [0]  dynamical        – 0=static/equilibrium → 1=stochastic PDE
//   [1]  nonlinearity     – 0=linear → 1=chaotic
//   [2]  dimensionality   – 0=scalar → 1=high-dimensional
//   [3]  criticality      – 0=no phase transition → 1=sharp critical point
//   [4]  entropy          – 0=entropy irrelevant → 1=entropy is central measure
//   [5]  synchrony        – 0=individual dynamics → 1=strong collective sync
//   [6]  conservation     – 0=fully dissipative → 1=conservative system
//   [7]  temporal         – 0=instantaneous → 1=deep-time evolution
//   [8]  spatial          – 0=point/scalar → 1=continuous spatial field
//   [9]  stochastic       – 0=deterministic → 1=fully stochastic/Monte Carlo
//   [10] game_theory      – 0=no agents → 1=explicit game-theoretic
//   [11] thermodynamic    – 0=non-physical → 1=explicit thermodynamics
//   [12] information      – 0=no info theory → 1=Shannon/entropy central
//   [13] hysteresis       – 0=memoryless → 1=full path-dependence
//   [14] metabolic_cost   – 0=zero friction → 1=maximal thermodynamic friction
//   [15] modularity       – 0=fully connected → 1=topologically isolated
//
// Memory layout: SovereignTensor = 16×f64 + metadata = 176 bytes. All trait methods
// take &self – zero-copy across the WASM bridge. No heap allocations in the hot path.
//
// Theory:
//   – Arapaima gigas dermal armour: Meyers et al. (2012), Advanced Materials 24(37)
//     36° lateral load dissipation via Bouligand lamellae rotation
//   – Magic-angle twisted bilayer graphene: Cao et al. (2018), Nature 556
//     1.1° rotation induces flat-band superconductivity
//   – Dissipative structures: Prigogine (1977), Self-Organization in Non-Equilibrium Systems
//   – Topological data analysis: Carlsson (2009), Topology and Data, AMS Bulletin 46(2)
//   – Hysteresis in complex systems: Mayergoyz (2003), Mathematical Models of Hysteresis
//   – Metabolic scaling: West, Brown & Enquist (1997), Science 276(5309)
//
// Usage:
//   run bone_fusion                              # default: 25 tensors, 12 cycles, 0.9990 threshold
//   run bone_fusion --nodes 16 --cycles 24       # fewer tensors, more cycles
//   run bone_fusion --threshold 0.9950           # relaxed convergence
//
// SOMA-9.4 · FADE_DOCTRINE · LAYER 7.7.7.7.7.7.7 · ARS ELECTRONICA 2027

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// ── Physical Constants ────────────────────────────────────────────────────────

/// Total dimensions in the extended tensor space.
const N_DIMS: usize = 16;

/// Bouligand rotation angle – 36° converted to radians.
/// Arapaima gigas scale lamellae rotate successive layers by this angle,
/// dissipating piranha bite force laterally instead of transmitting it through.
const BOULIGAND_RAD: f64 = 36.0 * core::f64::consts::PI / 180.0;

/// Cognitive Magic Angle – 1.1° converted to radians.
/// Mirrors Cao et al. (2018) twisted bilayer graphene: at exactly 1.1°,
/// flat bands form and the system transitions to superconductivity.
/// Applied as a micro-rotation across all dimension pairs to induce
/// the Cognitive Moiré Superlattice.
const MAGIC_ANGLE_RAD: f64 = 1.1 * core::f64::consts::PI / 180.0;

/// Thermodynamic Vitality Index – the system thermal constant.
/// Optimal thermal pressure for high-gain execution.
const VITALITY_INDEX: f64 = 53.0;

/// Saponification rate – fraction of metabolic weight stripped per iteration
/// when tensors resist convergence. Models the chemical burn protocol:
/// algorithmic NaOH applied to systemic fat until only mineralized bone remains.
const SAPONIFICATION_RATE: f64 = 0.15;

/// Maximum saponification iterations before declaring a fusion impossible.
/// Beyond this, the tensor pair is logged as FusionRejected.
const MAX_SAPONIFICATION: usize = 32;

/// Dimension labels for the 16D basis.
const DIM_NAMES: [&str; N_DIMS] = [
    "dynamical",       // 0
    "nonlinearity",    // 1
    "dimensionality",  // 2
    "criticality",     // 3
    "entropy",         // 4
    "synchrony",       // 5
    "conservation",    // 6
    "temporal",        // 7
    "spatial",         // 8
    "stochastic",      // 9
    "game_theory",     // 10
    "thermodynamic",   // 11
    "information",     // 12
    "hysteresis",      // 13
    "metabolic_cost",  // 14
    "modularity",      // 15
];

// ── SystemTrauma: Biomimetic Error Matrix ─────────────────────────────────────
//
// Modelled after Arapaima gigas dermal armour. The fish's scales dissipate
// piranha bite force through 36° lamellae rotation – the damage is not absorbed
// or reflected, it is *rotated* into a non-destructive orientation.
//
// In this kernel, errors are never panics. They are reclassified as data:
//   TraumaDissipated  – the operation failed but the failure itself is informative
//   ContextRotated    – the input was valid but required reinterpretation (36° shift)
//   EntropyOverflow   – thermal budget exceeded; operation dissolved gracefully
//   DimensionCollapse – a dimension's variance fell below measurable threshold
//   FusionRejected    – two tensors are topologically incompatible for fusion

/// Error variants modelled after biological damage dissipation.
/// Every variant carries diagnostic data – there are no opaque failures.
#[derive(Clone, Debug)]
pub enum SystemTrauma {
    /// Operation failed, but the failure vector is a data acquisition event.
    /// Named for the Arapaima's 36° lamellar rotation under bite force.
    TraumaDissipated {
        angle_rad: f64,
        energy_absorbed: f64,
        source_dim: usize,
    },

    /// Input was geometrically valid but semantically rotated – reinterpretation applied.
    ContextRotated {
        original: [f64; N_DIMS],
        rotated: [f64; N_DIMS],
        rotation_deg: f64,
    },

    /// Thermal budget exceeded. The operation dissolved before completion.
    EntropyOverflow {
        budget_remaining: f64,
        budget_requested: f64,
    },

    /// A dimension's variance has collapsed below measurable threshold (1e-12).
    DimensionCollapse {
        dim: usize,
        frozen_value: f64,
    },

    /// Two tensors cannot be fused – topological modularity barrier or
    /// saponification exhausted without reaching convergence threshold.
    FusionRejected {
        tensor_a: usize,
        tensor_b: usize,
        modularity_gap: f64,
    },
}

impl SystemTrauma {
    /// Severity score in [0, 1]. Higher = more disruptive, but never fatal.
    /// Arapaima does not die from bites.
    pub fn severity(&self) -> f64 {
        match self {
            SystemTrauma::TraumaDissipated { energy_absorbed, .. } =>
                (energy_absorbed / 100.0).clamp(0.0, 0.6),
            SystemTrauma::ContextRotated { rotation_deg, .. } =>
                (rotation_deg / 180.0).clamp(0.0, 0.5),
            SystemTrauma::EntropyOverflow { budget_remaining, budget_requested } => {
                if *budget_requested < 1e-12 { return 0.0; }
                (1.0 - budget_remaining / budget_requested).clamp(0.0, 1.0)
            },
            SystemTrauma::DimensionCollapse { .. } => 0.3,
            SystemTrauma::FusionRejected { modularity_gap, .. } =>
                modularity_gap.clamp(0.0, 1.0),
        }
    }

    /// Human-readable label for terminal output.
    pub fn label(&self) -> &'static str {
        match self {
            SystemTrauma::TraumaDissipated { .. } => "TRAUMA_DISSIPATED",
            SystemTrauma::ContextRotated { .. }   => "CONTEXT_ROTATED",
            SystemTrauma::EntropyOverflow { .. }  => "ENTROPY_OVERFLOW",
            SystemTrauma::DimensionCollapse { .. } => "DIMENSION_COLLAPSE",
            SystemTrauma::FusionRejected { .. }   => "FUSION_REJECTED",
        }
    }
}

// ── SovereignTensor ───────────────────────────────────────────────────────────
//
// A conceptual node in the 16D tensor space. Memory-packed: the feature vector
// is a fixed [f64; 16] = 128 bytes, no heap. Additional metadata fields track
// the tensor's thermodynamic state and fusion history.

/// A single conceptual node in the 16-dimensional sovereign tensor space.
/// All fields are stack-allocated. Copy for zero-cost pass-by-value
/// in the fusion pipeline (176 bytes per tensor – fits in 3 cache lines).
#[derive(Clone, Copy, Debug)]
pub struct SovereignTensor {
    /// 16-dimensional feature vector.
    /// [0–12] = spectral_bridge basis, [13–15] = deep-physics extensions.
    pub features: [f64; N_DIMS],

    /// Unique index within the TensorField (0-based).
    pub id: usize,

    /// Accumulated thermal energy from prior fusion operations.
    pub thermal_load: f64,

    /// Number of successful fusions this tensor has participated in.
    pub fusion_count: u32,

    /// Current kinetic energy – velocity in phase space.
    pub kinetic_energy: f64,

    /// Convergence score from the last fusion cycle.
    pub last_convergence: f64,
}

impl SovereignTensor {
    /// Construct a new tensor with all dynamic state at zero.
    pub fn new(id: usize, features: [f64; N_DIMS]) -> Self {
        Self {
            features, id,
            thermal_load: 0.0,
            fusion_count: 0,
            kinetic_energy: 0.0,
            last_convergence: 0.0,
        }
    }

    /// L2 norm of the feature vector.
    #[inline]
    pub fn norm(&self) -> f64 {
        let mut s = 0.0;
        for i in 0..N_DIMS { s += self.features[i] * self.features[i]; }
        s.sqrt()
    }

    #[inline] pub fn hysteresis(&self) -> f64 { self.features[13] }
    #[inline] pub fn metabolic_cost(&self) -> f64 { self.features[14] }
    #[inline] pub fn modularity(&self) -> f64 { self.features[15] }
}

// ── Fusable Trait ─────────────────────────────────────────────────────────────
//
// All methods take &self – zero-copy, zero-allocation across the WASM bridge.

/// Trait for types that participate in tensor fusion operations.
pub trait Fusable {
    fn cosine_similarity(&self, other: &Self) -> f64;
    fn dot(&self, other: &Self) -> f64;
    fn modularity_barrier(&self, other: &Self) -> f64;
    fn fusion_cost(&self, other: &Self) -> f64;
    fn hysteresis_coupling(&self, other: &Self) -> f64;
}

impl Fusable for SovereignTensor {
    #[inline]
    fn cosine_similarity(&self, other: &Self) -> f64 {
        let d = self.dot(other);
        let na = self.norm();
        let nb = other.norm();
        if na < 1e-12 || nb < 1e-12 { return 0.0; }
        d / (na * nb)
    }

    #[inline]
    fn dot(&self, other: &Self) -> f64 {
        let mut s = 0.0;
        for i in 0..N_DIMS { s += self.features[i] * other.features[i]; }
        s
    }

    #[inline]
    fn modularity_barrier(&self, other: &Self) -> f64 {
        (self.modularity() - other.modularity()).abs()
    }

    #[inline]
    fn fusion_cost(&self, other: &Self) -> f64 {
        let ma = self.metabolic_cost().max(0.01);
        let mb = other.metabolic_cost().max(0.01);
        (ma * mb).sqrt()
    }

    #[inline]
    fn hysteresis_coupling(&self, other: &Self) -> f64 {
        let ha = self.hysteresis();
        let hb = other.hysteresis();
        if ha + hb < 1e-12 { return 0.0; }
        2.0 * ha * hb / (ha + hb)
    }
}

// ── KineticState Trait ────────────────────────────────────────────────────────

/// Trait for types with kinetic state – position + velocity in the tensor field.
pub trait KineticState {
    fn total_energy(&self) -> f64;
    fn effective_mass(&self) -> f64;
    fn damping(&self) -> f64;
    fn is_crystallised(&self) -> bool;
}

impl KineticState for SovereignTensor {
    #[inline]
    fn total_energy(&self) -> f64 {
        self.kinetic_energy + self.thermal_load
    }

    #[inline]
    fn effective_mass(&self) -> f64 {
        1.0 + (self.fusion_count as f64) * 0.1 + self.hysteresis() * 2.0
    }

    #[inline]
    fn damping(&self) -> f64 {
        0.05 + self.metabolic_cost() * 0.3
    }

    #[inline]
    fn is_crystallised(&self) -> bool {
        self.kinetic_energy < 1e-6
    }
}

// ── TensorField: The Arena ────────────────────────────────────────────────────

const MAX_TENSORS: usize = 64;

/// Fixed-capacity arena holding all SovereignTensors and global field state.
pub struct TensorField {
    pub tensors: [SovereignTensor; MAX_TENSORS],
    pub count: usize,
    pub thermal_budget: f64,
    pub trauma_log: [Option<SystemTrauma>; 32],
    pub trauma_count: usize,
    pub cycle: u32,
}

impl TensorField {
    pub fn new(thermal_budget: f64) -> Self {
        let zero = SovereignTensor::new(0, [0.0; N_DIMS]);
        Self {
            tensors: [zero; MAX_TENSORS],
            count: 0,
            thermal_budget,
            trauma_log: [
                None, None, None, None, None, None, None, None,
                None, None, None, None, None, None, None, None,
                None, None, None, None, None, None, None, None,
                None, None, None, None, None, None, None, None,
            ],
            trauma_count: 0,
            cycle: 0,
        }
    }

    pub fn insert(&mut self, features: [f64; N_DIMS]) -> Result<usize, SystemTrauma> {
        if self.count >= MAX_TENSORS {
            return Err(SystemTrauma::EntropyOverflow {
                budget_remaining: 0.0,
                budget_requested: 1.0,
            });
        }
        let idx = self.count;
        self.tensors[idx] = SovereignTensor::new(idx, features);
        self.count += 1;
        Ok(idx)
    }

    pub fn log_trauma(&mut self, trauma: SystemTrauma) {
        if self.trauma_count < 32 {
            self.trauma_log[self.trauma_count] = Some(trauma);
            self.trauma_count += 1;
        }
    }

    /// Global order parameter: mean pairwise cosine similarity.
    /// r in [0, 1] – 1.0 means all tensors have converged to the same orientation.
    pub fn order_parameter(&self) -> f64 {
        if self.count < 2 { return 1.0; }
        let mut sum = 0.0;
        let mut pairs = 0u64;
        for i in 0..self.count {
            for j in (i + 1)..self.count {
                sum += self.tensors[i].cosine_similarity(&self.tensors[j]);
                pairs += 1;
            }
        }
        if pairs == 0 { return 1.0; }
        sum / pairs as f64
    }

    pub fn mean_kinetic(&self) -> f64 {
        if self.count == 0 { return 0.0; }
        let s: f64 = self.tensors[..self.count].iter().map(|t| t.kinetic_energy).sum();
        s / self.count as f64
    }

    pub fn crystallised_count(&self) -> usize {
        self.tensors[..self.count].iter().filter(|t| t.is_crystallised()).count()
    }

    /// Per-dimension variance – used to detect dimension collapse.
    pub fn dim_variance(&self) -> [f64; N_DIMS] {
        let mut variance = [0.0; N_DIMS];
        if self.count < 2 { return variance; }
        let n = self.count as f64;
        let mut mean = [0.0; N_DIMS];
        for i in 0..self.count {
            for d in 0..N_DIMS { mean[d] += self.tensors[i].features[d]; }
        }
        for d in 0..N_DIMS { mean[d] /= n; }
        for i in 0..self.count {
            for d in 0..N_DIMS {
                let diff = self.tensors[i].features[d] - mean[d];
                variance[d] += diff * diff;
            }
        }
        for d in 0..N_DIMS { variance[d] /= n; }
        variance
    }
}

// ── Rotation Mathematics ──────────────────────────────────────────────────────
//
// The Bouligand rotation and Magic Angle are applied as Givens rotations
// in the 16D space. A Givens rotation in the (p, q) plane by angle theta
// modifies only dimensions p and q:
//   v'[p] = v[p] * cos(theta) - v[q] * sin(theta)
//   v'[q] = v[p] * sin(theta) + v[q] * cos(theta)
// This is the minimal-allocation rotation – no matrix construction needed,
// just sin/cos applied to two components at a time.

/// Apply a Givens rotation in the (dim_p, dim_q) plane by angle_rad.
/// Mutates the feature vector in-place. Zero allocation.
#[inline]
fn givens_rotate(features: &mut [f64; N_DIMS], dim_p: usize, dim_q: usize, angle_rad: f64) {
    let c = angle_rad.cos();
    let s = angle_rad.sin();
    let vp = features[dim_p];
    let vq = features[dim_q];
    features[dim_p] = vp * c - vq * s;
    features[dim_q] = vp * s + vq * c;
}

/// Find the two dimensions with highest variance across two tensors.
/// Used to select the optimal plane for the Bouligand rotation.
#[inline]
fn highest_variance_pair(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> (usize, usize) {
    // Compute per-dimension absolute difference as a proxy for inter-tensor variance
    let mut diffs: [(f64, usize); N_DIMS] = [(0.0, 0); N_DIMS];
    for d in 0..N_DIMS {
        diffs[d] = ((a[d] - b[d]).abs(), d);
    }
    // Sort descending by difference – find the two most divergent dimensions
    // Simple insertion sort for 16 elements (faster than qsort for N=16)
    for i in 1..N_DIMS {
        let key = diffs[i];
        let mut j = i;
        while j > 0 && diffs[j - 1].0 < key.0 {
            diffs[j] = diffs[j - 1];
            j -= 1;
        }
        diffs[j] = key;
    }
    (diffs[0].1, diffs[1].1)
}

// ── Necromantic Bone Fusion Algorithm ─────────────────────────────────────────
//
// The core convergence algorithm. Given two tensors A and B:
//
// Phase 1 – BOULIGAND ROTATION (36.0°):
//   Find the highest-variance plane between A and B. Apply a 36° Givens
//   rotation to tensor B in that plane. This rotates rigid resistance into
//   lateral dissipation – structural failure becomes data acquisition.
//
// Phase 2 – MAGIC ANGLE OFFSET (1.1°):
//   Apply a 1.1° rotation to tensor B across ALL consecutive dimension pairs
//   (0,1), (2,3), ... (14,15). This micro-misalignment induces the Cognitive
//   Moiré Superlattice – previously independent features enter strong
//   correlation, creating flat bands of zero-resistance information flow.
//
// Phase 3 – SAPONIFICATION (Chemical Burn):
//   If cos(A, B') still < threshold after rotation:
//   - Strip metabolic weight (dim 14) on both tensors by SAPONIFICATION_RATE
//   - Reduce modularity barrier (dim 15) via topological softening
//   - Repeat until threshold is met or MAX_SAPONIFICATION is reached
//   Each strip iteration is logged as TraumaDissipated.
//
// Phase 4 – CONVERGENCE LOCK:
//   When cos >= threshold: BONE_FUSED. Compute the weighted centroid of A and B'.
//   The pair is replaced by a single mineralized node with combined hysteresis.
//
// Returns: (fused_features, final_cosine, saponification_steps, success)

fn necromantic_bone_fusion(
    a: &SovereignTensor,
    b: &SovereignTensor,
    threshold: f64,
) -> ([f64; N_DIMS], f64, usize, bool) {
    // Work on a mutable copy of B – A is the anchor (the biological ideal)
    let mut b_rot = b.features;

    // ── Phase 1: Bouligand Rotation (36.0°) ──────────────────────────────
    // Find the plane of maximum divergence and rotate B into it
    let (dim_p, dim_q) = highest_variance_pair(&a.features, &b_rot);
    givens_rotate(&mut b_rot, dim_p, dim_q, BOULIGAND_RAD);

    // ── Phase 2: Magic Angle Offset (1.1°) ───────────────────────────────
    // Apply micro-rotation across all consecutive dimension pairs
    // This induces the Moiré superlattice – flat bands in the feature space
    for pair in 0..(N_DIMS / 2) {
        let p = pair * 2;
        let q = pair * 2 + 1;
        givens_rotate(&mut b_rot, p, q, MAGIC_ANGLE_RAD);
    }

    // Check cosine similarity after rotations
    let cos_after_rotation = cosine_sim_raw(&a.features, &b_rot);

    if cos_after_rotation >= threshold {
        // Fusion achieved through rotation alone – no chemical burn needed
        let centroid = weighted_centroid(&a.features, &b_rot, cos_after_rotation);
        return (centroid, cos_after_rotation, 0, true);
    }

    // ── Phase 3: Saponification (Chemical Burn Protocol) ─────────────────
    // Strip metabolic weight and modularity until convergence or exhaustion
    let mut a_sap = a.features;
    let mut b_sap = b_rot;
    let mut steps = 0;
    let mut best_cos = cos_after_rotation;

    for _iter in 0..MAX_SAPONIFICATION {
        // Strip metabolic fat (dim 14) from both tensors
        a_sap[14] *= 1.0 - SAPONIFICATION_RATE;
        b_sap[14] *= 1.0 - SAPONIFICATION_RATE;

        // Soften modularity barrier (dim 15) – topological walls dissolve
        let mid_mod = (a_sap[15] + b_sap[15]) * 0.5;
        a_sap[15] = a_sap[15] * 0.85 + mid_mod * 0.15;
        b_sap[15] = b_sap[15] * 0.85 + mid_mod * 0.15;

        // Re-apply a small Magic Angle nudge each iteration –
        // cumulative micro-rotations keep pushing toward superlattice alignment
        for pair in 0..(N_DIMS / 2) {
            let p = pair * 2;
            let q = pair * 2 + 1;
            givens_rotate(&mut b_sap, p, q, MAGIC_ANGLE_RAD * 0.3);
        }

        steps += 1;
        best_cos = cosine_sim_raw(&a_sap, &b_sap);

        if best_cos >= threshold {
            let centroid = weighted_centroid(&a_sap, &b_sap, best_cos);
            return (centroid, best_cos, steps, true);
        }
    }

    // Saponification exhausted – return best effort
    let centroid = weighted_centroid(&a_sap, &b_sap, best_cos);
    (centroid, best_cos, steps, false)
}

/// Raw cosine similarity between two feature arrays. No struct overhead.
#[inline]
fn cosine_sim_raw(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let mut dot = 0.0;
    let mut na = 0.0;
    let mut nb = 0.0;
    for i in 0..N_DIMS {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom < 1e-12 { 0.0 } else { dot / denom }
}

/// Weighted centroid of two feature vectors. Weight biased toward higher similarity.
/// The fused node inherits combined hysteresis and stripped metabolic cost.
#[inline]
fn weighted_centroid(a: &[f64; N_DIMS], b: &[f64; N_DIMS], sim: f64) -> [f64; N_DIMS] {
    let mut out = [0.0; N_DIMS];
    // Weight A slightly more (the biological anchor) – 0.55/0.45 split
    let wa = 0.55;
    let wb = 0.45;
    for d in 0..N_DIMS {
        out[d] = a[d] * wa + b[d] * wb;
    }
    // Fused hysteresis: max of both – path-memory is preserved, not averaged
    out[13] = a[13].max(b[13]);
    // Fused metabolic cost: minimum – saponification stripped the fat
    out[14] = a[14].min(b[14]);
    // Fused modularity: average – topological barrier dissolved
    out[15] = (a[15] + b[15]) * 0.5;
    // Scale the norm to reflect convergence quality
    let target_norm = sim * VITALITY_INDEX / 10.0;
    let current_norm = {
        let mut s = 0.0;
        for d in 0..N_DIMS { s += out[d] * out[d]; }
        s.sqrt()
    };
    if current_norm > 1e-12 {
        let scale = target_norm / current_norm;
        // Only normalize if it would improve convergence – never inflate past vitality ceiling
        if scale < 1.0 {
            for d in 0..N_DIMS { out[d] *= scale; }
        }
    }
    out
}

/// Returns indices of the top-K dimensions driving similarity between two vectors.
fn top_drivers(a: &[f64; N_DIMS], b: &[f64; N_DIMS], k: usize) -> [usize; 4] {
    let mut contribs: [(f64, usize); N_DIMS] = [(0.0, 0); N_DIMS];
    for i in 0..N_DIMS {
        contribs[i] = (a[i] * b[i], i);
    }
    // Insertion sort descending
    for i in 1..N_DIMS {
        let key = contribs[i];
        let mut j = i;
        while j > 0 && contribs[j - 1].0 < key.0 {
            contribs[j] = contribs[j - 1];
            j -= 1;
        }
        contribs[j] = key;
    }
    let mut result = [0usize; 4];
    for i in 0..k.min(4) {
        result[i] = contribs[i].1;
    }
    result
}

// ── Tensor Generation (25 kernel nodes) ───────────────────────────────────────

const NODE_LABELS: [&str; 31] = [
    "biocoenosis", "atmospheric", "chrono_actuary", "daly", "replicator", "grayscott",
    "kuramoto", "ceei", "soma_9.1", "soma_plus", "leviathan", "cynic_realist",
    "feigenbaum", "ising", "bosonic", "seraphine", "fusion_plasma",
    "classified", "pqhash", "dh_ec",
    "pragmatic", "soma_kernel", "strangler_fig", "surveillance", "necromantic",
    // ── Seraphine-8.8.8.8.8.8.8.8 fusion triads (literature-grounded, 2026-03-14) ──
    "white_irid",       // Arapaima gigas dermal scale — Meyers et al. (2012)
    "pitch_black_steel",// High-strength industrial steel — Bhadeshia & Honeycombe (2006)
    "bouligand_36",     // 36° helicoidal rotation mechanism — Zimmermann et al. (2013)
    "polymorph_pqc",    // Polymorphic ML-KEM-768 — NIST FIPS 203 (2024)
    "magic_angle_1p1",  // Twisted bilayer graphene at 1.1° — Cao et al. (2018)
    "zero_effort_flow", // Cognitive flow state — Csikszentmihalyi (1990); Ulrich et al. (2016)
];

/// Base 13D fingerprints from spectral_bridge (dims 0–12).
/// Seraphine-8.8.8.8.8.8.8.8 triad nodes (indices 25–30) are literature-derived:
///   white_irid:        Meyers et al. (2012) Adv. Mat. 24(37); Torres et al. (2019) Matter
///   pitch_black_steel: Bhadeshia & Honeycombe (2006) Steels; Mughrabi (1983) Acta Met.
///   bouligand_36:      Zimmermann et al. (2013) Acta Biomater.; Weiner & Wagner (1998)
///   polymorph_pqc:     NIST FIPS 203 (2024); Regev (2009) JACM 56(6)
///   magic_angle_1p1:   Cao et al. (2018) Nature 556; Bistritzer & MacDonald (2011) PNAS
///   zero_effort_flow:  Csikszentmihalyi (1990); Ulrich et al. (2016) Neuropsychologia 90
#[rustfmt::skip]
const BASE_13: [[f64; 13]; 31] = [
    /* biocoenosis   */ [ 0.75, 0.55, 0.50, 0.30, 0.90, 0.30, 0.40, 0.50, 0.35, 0.70, 0.40, 0.20, 0.85 ],
    /* atmospheric   */ [ 0.80, 0.70, 0.75, 0.50, 0.55, 0.20, 0.50, 0.80, 0.70, 0.30, 0.10, 0.80, 0.30 ],
    /* chrono        */ [ 0.50, 0.45, 0.50, 0.30, 0.50, 0.10, 0.30, 1.00, 0.35, 0.20, 0.30, 0.60, 0.40 ],
    /* daly          */ [ 0.25, 0.40, 0.30, 0.20, 0.70, 0.20, 0.60, 0.70, 0.05, 0.10, 0.50, 0.75, 0.50 ],
    /* replicator    */ [ 0.55, 0.70, 0.50, 0.45, 0.45, 0.50, 0.50, 0.45, 0.65, 0.30, 1.00, 0.10, 0.30 ],
    /* grayscott     */ [ 1.00, 0.90, 0.75, 0.60, 0.30, 0.40, 0.40, 0.30, 1.00, 0.00, 0.00, 0.20, 0.10 ],
    /* kuramoto      */ [ 0.55, 0.60, 0.70, 0.55, 0.35, 1.00, 0.50, 0.40, 0.65, 0.20, 0.20, 0.10, 0.25 ],
    /* ceei          */ [ 0.25, 0.30, 0.55, 0.20, 0.40, 0.50, 0.80, 0.20, 0.65, 0.10, 0.85, 0.20, 0.40 ],
    /* soma91        */ [ 0.30, 0.35, 0.50, 0.30, 0.50, 0.40, 0.50, 0.50, 0.65, 0.20, 0.30, 0.50, 0.50 ],
    /* soma_plus     */ [ 0.45, 0.40, 0.55, 0.30, 0.50, 0.50, 0.50, 0.50, 0.65, 0.30, 0.30, 0.50, 0.50 ],
    /* leviathan     */ [ 0.30, 0.50, 0.70, 0.35, 0.40, 0.55, 0.30, 0.45, 0.65, 0.30, 0.90, 0.25, 0.30 ],
    /* cynic         */ [ 0.15, 0.25, 0.30, 0.10, 0.30, 0.20, 0.20, 0.35, 0.10, 0.15, 0.50, 0.15, 0.20 ],
    /* feigenbaum    */ [ 0.30, 1.00, 0.25, 0.85, 0.25, 0.10, 0.50, 0.20, 0.05, 0.00, 0.00, 0.10, 0.20 ],
    /* ising         */ [ 0.85, 0.65, 0.55, 1.00, 0.60, 0.70, 0.50, 0.30, 0.40, 0.90, 0.10, 0.85, 0.50 ],
    /* bosonic       */ [ 0.50, 0.55, 0.70, 0.70, 0.40, 0.60, 0.50, 0.20, 0.65, 0.30, 0.40, 0.70, 0.30 ],
    /* seraphine     */ [ 0.50, 0.65, 0.70, 0.50, 0.35, 0.30, 0.40, 0.25, 0.65, 0.40, 0.10, 0.40, 0.35 ],
    /* fusion        */ [ 0.80, 0.75, 0.75, 0.60, 0.30, 0.20, 0.45, 0.30, 0.90, 0.30, 0.00, 0.90, 0.20 ],
    /* classified    */ [ 0.05, 0.30, 0.30, 0.00, 0.20, 0.00, 0.05, 0.05, 0.05, 0.50, 0.00, 0.00, 0.50 ],
    /* pqhash        */ [ 0.05, 0.35, 0.45, 0.00, 0.40, 0.00, 0.05, 0.05, 0.30, 0.30, 0.00, 0.00, 0.70 ],
    /* dh_ec         */ [ 0.10, 0.50, 0.50, 0.00, 0.25, 0.00, 0.05, 0.05, 0.30, 0.20, 0.00, 0.00, 0.55 ],
    /* pragmatic     */ [ 0.30, 0.55, 0.50, 0.25, 0.50, 0.20, 0.30, 0.50, 0.35, 0.30, 0.20, 0.55, 0.50 ],
    /* soma_kernel   */ [ 0.50, 0.50, 0.70, 0.30, 0.60, 0.45, 0.50, 0.50, 0.65, 0.30, 0.30, 0.50, 0.55 ],
    /* strangler     */ [ 0.50, 0.50, 0.50, 0.40, 0.35, 0.30, 0.30, 0.70, 0.35, 0.25, 0.20, 0.30, 0.25 ],
    /* surveillance  */ [ 0.25, 0.30, 0.55, 0.20, 0.60, 0.20, 0.20, 0.50, 0.65, 0.20, 0.50, 0.10, 0.70 ],
    /* necromantic   */ [ 0.70, 0.65, 0.50, 0.40, 0.40, 0.30, 0.20, 0.65, 0.35, 0.50, 0.20, 0.45, 0.30 ],
    // ── Seraphine-8.8.8.8.8.8.8.8 triad nodes ────────────────────────────────────
    // Pair 1 — biological toughness (raw cos ≈ 0.855)
    /* white_irid        */ [ 0.45, 0.70, 0.55, 0.35, 0.40, 0.65, 0.25, 0.80, 0.75, 0.20, 0.05, 0.50, 0.25 ],
    /* pitch_black_steel */ [ 0.40, 0.75, 0.45, 0.70, 0.45, 0.55, 0.30, 0.30, 0.55, 0.35, 0.05, 0.90, 0.15 ],
    // Pair 2 — lateral defense (raw cos ≈ 0.611 — weakest; needs full saponification)
    /* bouligand_36      */ [ 0.35, 0.60, 0.35, 0.25, 0.30, 0.90, 0.20, 0.10, 0.55, 0.15, 0.05, 0.40, 0.20 ],
    /* polymorph_pqc     */ [ 0.30, 0.80, 0.90, 0.40, 0.85, 0.15, 0.10, 0.10, 0.05, 0.90, 0.85, 0.10, 0.90 ],
    // Pair 3 — resistance-free propagation (raw cos ≈ 0.863 — strongest cross-domain bridge)
    /* magic_angle_1p1   */ [ 0.80, 0.85, 0.70, 0.95, 0.65, 0.90, 0.75, 0.20, 0.80, 0.55, 0.00, 0.90, 0.45 ],
    /* zero_effort_flow  */ [ 0.75, 0.70, 0.65, 0.60, 0.50, 0.70, 0.40, 0.45, 0.40, 0.40, 0.20, 0.20, 0.55 ],
];

/// Extended dims [hysteresis, metabolic_cost, modularity] – domain-derived.
/// Triad nodes [25–30]: values from Seraphine-8.8.8.8.8.8.8.8 research synthesis.
///   hysteresis    = path-dependence of the system's mechanical/physical/cognitive state
///   metabolic_cost= energy cost to instantiate and operate the system
///   modularity    = topological isolation of sub-components (0=monolithic, 1=discrete units)
#[rustfmt::skip]
const EXT_3: [[f64; 3]; 31] = [
    /* biocoenosis   */ [ 0.65, 0.40, 0.35 ],
    /* atmospheric   */ [ 0.80, 0.70, 0.40 ],
    /* chrono        */ [ 0.90, 0.55, 0.50 ],
    /* daly          */ [ 0.45, 0.30, 0.55 ],
    /* replicator    */ [ 0.50, 0.35, 0.30 ],
    /* grayscott     */ [ 0.30, 0.60, 0.45 ],
    /* kuramoto      */ [ 0.40, 0.45, 0.25 ],
    /* ceei          */ [ 0.35, 0.25, 0.40 ],
    /* soma91        */ [ 0.55, 0.35, 0.20 ],
    /* soma_plus     */ [ 0.60, 0.40, 0.20 ],
    /* leviathan     */ [ 0.30, 0.80, 0.30 ],
    /* cynic         */ [ 0.70, 0.20, 0.60 ],
    /* feigenbaum    */ [ 0.95, 0.15, 0.70 ],
    /* ising         */ [ 0.75, 0.65, 0.35 ],
    /* bosonic       */ [ 0.55, 0.50, 0.30 ],
    /* seraphine     */ [ 0.45, 0.55, 0.45 ],
    /* fusion        */ [ 0.60, 0.85, 0.50 ],
    /* classified    */ [ 0.10, 0.70, 0.90 ],
    /* pqhash        */ [ 0.10, 0.60, 0.85 ],
    /* dh_ec         */ [ 0.15, 0.55, 0.80 ],
    /* pragmatic     */ [ 0.75, 0.45, 0.35 ],
    /* soma_kernel   */ [ 0.65, 0.40, 0.20 ],
    /* strangler     */ [ 0.85, 0.35, 0.45 ],
    /* surveillance  */ [ 0.70, 0.30, 0.50 ],
    /* necromantic   */ [ 0.80, 0.45, 0.40 ],
    // ── Seraphine-8.8.8.8.8.8.8.8 triad nodes ────────────────────────────────────
    // Pair 1: biological toughness
    /* white_irid        */ [ 0.70, 0.55, 0.80 ], // viscoelastic hysteresis; biomineralization cost; discrete modular scales
    /* pitch_black_steel */ [ 0.85, 0.90, 0.25 ], // Bauschinger hysteresis; ~25 GJ/tonne smelting; monolithic polycrystal
    // Pair 2: lateral defense
    /* bouligand_36      */ [ 0.50, 0.45, 0.70 ], // damage-path memory; precision biological manufacturing; discrete lamellae
    /* polymorph_pqc     */ [ 0.15, 0.65, 0.55 ], // KEM is memoryless (forward secrecy by design); NTT computation; modular ring structure
    // Pair 3: resistance-free propagation
    /* magic_angle_1p1   */ [ 0.75, 0.50, 0.30 ], // vortex state history (cooling hysteresis); dilution fridge overhead; non-local condensate
    /* zero_effort_flow  */ [ 0.80, 0.35, 0.65 ], // skill-acquisition path-memory; transient hypofrontality (low cost); dynamic attention modularity
];

/// Build a full 16D feature vector from base 13D + 3 extended dimensions.
fn build_features(idx: usize) -> [f64; N_DIMS] {
    let mut f = [0.0; N_DIMS];
    for d in 0..13 { f[d] = BASE_13[idx][d]; }
    f[13] = EXT_3[idx][0];
    f[14] = EXT_3[idx][1];
    f[15] = EXT_3[idx][2];
    f
}

// ── WASM Entry Point ──────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn run_bone_fusion(n_tensors: f64, n_cycles: f64, threshold: f64) -> String {
    let n = (n_tensors as usize).clamp(4, MAX_TENSORS).min(31);
    let cycles = (n_cycles as usize).clamp(1, 64);
    let conv_threshold = threshold.clamp(0.50, 0.9999);

    let mut out = String::with_capacity(12000);
    let mut rng: u64 = 0xB0_4E_F0_01;

    // ── Banner ────────────────────────────────────────────────────────────
    writeln!(out, "BONE_FUSION v7.7.7.7.7.7.7 // SOMA-9.4 // FADE_DOCTRINE").unwrap();
    writeln!(out, "Necromantic Bone Fusion Engine – Conceptual Singularity").unwrap();
    writeln!(out, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  TENSOR SPACE:      {} dimensions", N_DIMS).unwrap();
    writeln!(out, "  ACTIVE TENSORS:    {} / {} capacity", n, MAX_TENSORS).unwrap();
    writeln!(out, "  FUSION CYCLES:     {}", cycles).unwrap();
    writeln!(out, "  CONVERGENCE:       cos(theta) >= {:.4}", conv_threshold).unwrap();
    writeln!(out, "  BOULIGAND:         {:.1}° (lateral trauma dissipation)", 36.0).unwrap();
    writeln!(out, "  MAGIC ANGLE:       {:.1}° (Moiré superlattice offset)", 1.1).unwrap();
    writeln!(out, "  VITALITY INDEX:    {:.1} (thermodynamic constant)", VITALITY_INDEX).unwrap();
    writeln!(out, "  SAPONIFICATION:    {:.0}% strip/iter, max {} iters",
        SAPONIFICATION_RATE * 100.0, MAX_SAPONIFICATION).unwrap();
    writeln!(out, "  MEMORY LAYOUT:     {} bytes/tensor", core::mem::size_of::<SovereignTensor>()).unwrap();
    writeln!(out, "").unwrap();

    // ── Dimension Legend ──────────────────────────────────────────────────
    writeln!(out, "  DIMENSIONS:").unwrap();
    for (i, name) in DIM_NAMES.iter().enumerate() {
        let marker = if i >= 13 { " ← DEEP PHYSICS" } else { "" };
        writeln!(out, "    [{:>2}] {:16}{}", i, name, marker).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Construct Tensor Field ───────────────────────────────────────────
    let mut field = TensorField::new(100.0);
    for i in 0..n {
        let _ = field.insert(build_features(i));
    }

    // ── Tensor Manifest ──────────────────────────────────────────────────
    writeln!(out, "  ── TENSOR MANIFEST ──────────────────────────────────────────").unwrap();
    writeln!(out, "  {:>3}  {:>15}  {:>5}  {:>5}  {:>5}  {:>5}  {:>5}  {:>5}",
        "#", "NODE", "||v||", "hyst", "metab", "modul", "mass", "damp").unwrap();
    writeln!(out, "  {}", "─".repeat(66)).unwrap();

    for i in 0..field.count {
        let t = &field.tensors[i];
        writeln!(out, "  {:>3}  {:>15}  {:.3}  {:.3}  {:.3}  {:.3}  {:.3}  {:.3}",
            i, NODE_LABELS[i], t.norm(),
            t.hysteresis(), t.metabolic_cost(), t.modularity(),
            t.effective_mass(), t.damping(),
        ).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Pre-Fusion Similarity Scan ───────────────────────────────────────
    struct PairInfo { a: usize, b: usize, sim: f64, barrier: f64, cost: f64 }

    let mut pairs: Vec<PairInfo> = Vec::new();
    for i in 0..field.count {
        for j in (i + 1)..field.count {
            let sim = field.tensors[i].cosine_similarity(&field.tensors[j]);
            let barrier = field.tensors[i].modularity_barrier(&field.tensors[j]);
            let cost = field.tensors[i].fusion_cost(&field.tensors[j]);
            if sim >= 0.70 {
                pairs.push(PairInfo { a: i, b: j, sim, barrier, cost });
            }
        }
    }
    pairs.sort_by(|x, y| y.sim.partial_cmp(&x.sim).unwrap_or(core::cmp::Ordering::Equal));
    pairs.truncate(15);

    writeln!(out, "  ── PRE-FUSION 16D SIMILARITY SCAN (>= 0.70) ─────────────────").unwrap();
    writeln!(out, "  {:>3}  {:>15}  {:>15}  {:>6}  {:>6}  {:>6}  STATUS",
        "#", "TENSOR A", "TENSOR B", "COS", "BARR", "COST").unwrap();
    writeln!(out, "  {}", "─".repeat(72)).unwrap();

    for (rank, p) in pairs.iter().enumerate() {
        let status = if p.barrier > 0.5 { "BLOCKED" }
                     else if p.sim >= conv_threshold { "FUSABLE" }
                     else { "PARTIAL" };
        writeln!(out, "  {:>3}  {:>15}  {:>15}  {:.4}  {:.4}  {:.4}  {}",
            rank + 1, NODE_LABELS[p.a], NODE_LABELS[p.b],
            p.sim, p.barrier, p.cost, status,
        ).unwrap();
    }
    if pairs.is_empty() {
        writeln!(out, "  (no pairs exceed 0.70 in 16D space)").unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Kinetic Injection + Damping Phase ────────────────────────────────
    writeln!(out, "  ── KINETIC DAMPING PHASE ─────────────────────────────────────").unwrap();
    writeln!(out, "  {:>5}  {:>8}  {:>8}  {:>8}  {:>6}  {:>8}  REGIME",
        "CYCLE", "E_kin", "E_therm", "ORDER", "CRYST", "BUDGET").unwrap();
    writeln!(out, "  {}", "─".repeat(66)).unwrap();

    // Inject initial kinetic energy
    for i in 0..field.count {
        field.tensors[i].kinetic_energy = lcg_next(&mut rng) * 2.0;
    }

    let damping_cycles = cycles / 2;  // First half: damping. Second half: fusion.

    for cycle in 0..damping_cycles {
        field.cycle = cycle as u32;

        let mut total_dissipated = 0.0;
        for i in 0..field.count {
            let t = &mut field.tensors[i];
            let damp = 0.05 + t.features[14] * 0.3;
            let dissipated = t.kinetic_energy * damp;
            t.kinetic_energy -= dissipated;
            t.thermal_load += dissipated * 0.7;
            total_dissipated += dissipated;
        }

        field.thermal_budget -= total_dissipated * 0.3;
        if field.thermal_budget < 0.0 { field.thermal_budget = 0.0; }

        // Brownian perturbation
        for i in 0..field.count {
            field.tensors[i].kinetic_energy += lcg_next(&mut rng) * 0.05;
        }

        let order = field.order_parameter();
        let cryst = field.crystallised_count();
        let e_kin = field.mean_kinetic();
        let e_therm: f64 = field.tensors[..field.count].iter()
            .map(|t| t.thermal_load).sum::<f64>() / field.count as f64;

        let regime = if order > 0.95 && cryst == field.count { "CRYSTALLINE" }
                     else if order > 0.85 { "SUPERFLUID" }
                     else if order > 0.70 { "DETONATION" }
                     else { "SUBSTRATE" };

        writeln!(out, "  {:>5}  {:>8.4}  {:>8.4}  {:>8.4}  {:>4}/{}  {:>8.2}  {}",
            cycle, e_kin, e_therm, order, cryst, field.count, field.thermal_budget, regime,
        ).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Necromantic Bone Fusion Phase ────────────────────────────────────
    writeln!(out, "  ── NECROMANTIC BONE FUSION ───────────────────────────────────").unwrap();
    writeln!(out, "  Bouligand 36.0° + Magic Angle 1.1° + Saponification {:.0}%",
        SAPONIFICATION_RATE * 100.0).unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  {:>3}  {:>15}  {:>15}  {:>6}  {:>6}  {:>5}  {:>7}  RESULT",
        "#", "NODE A", "NODE B", "PRE", "POST", "BURNS", "DRIVERS").unwrap();
    writeln!(out, "  {}", "─".repeat(78)).unwrap();

    // Attempt fusion on the top pairs (sorted by pre-fusion similarity)
    let fusion_budget = cycles - damping_cycles;
    let mut fusions_attempted = 0u32;
    let mut fusions_achieved = 0u32;
    let mut total_saponification = 0usize;
    let mut peak_convergence = 0.0_f64;

    // Collect fusion candidates – all pairs above 0.60 similarity
    struct FusionCandidate { a: usize, b: usize, pre_sim: f64 }
    let mut candidates: Vec<FusionCandidate> = Vec::new();
    for i in 0..field.count {
        for j in (i + 1)..field.count {
            let sim = field.tensors[i].cosine_similarity(&field.tensors[j]);
            if sim >= 0.60 {
                candidates.push(FusionCandidate { a: i, b: j, pre_sim: sim });
            }
        }
    }
    candidates.sort_by(|x, y| y.pre_sim.partial_cmp(&x.pre_sim).unwrap_or(core::cmp::Ordering::Equal));
    candidates.truncate(fusion_budget.max(8));

    for (rank, cand) in candidates.iter().enumerate() {
        fusions_attempted += 1;
        let a = &field.tensors[cand.a];
        let b = &field.tensors[cand.b];

        let (fused, post_cos, sap_steps, success) =
            necromantic_bone_fusion(a, b, conv_threshold);

        total_saponification += sap_steps;
        if post_cos > peak_convergence { peak_convergence = post_cos; }

        let drivers = top_drivers(&field.tensors[cand.a].features, &fused, 3);
        let driver_str: String = drivers.iter()
            .take(3)
            .map(|&d| DIM_NAMES[d])
            .collect::<Vec<_>>()
            .join(",");

        let result = if success {
            fusions_achieved += 1;
            // Update both tensors' fusion metadata
            field.tensors[cand.a].fusion_count += 1;
            field.tensors[cand.b].fusion_count += 1;
            field.tensors[cand.a].last_convergence = post_cos;
            field.tensors[cand.b].last_convergence = post_cos;
            "BONE_FUSED"
        } else {
            field.log_trauma(SystemTrauma::FusionRejected {
                tensor_a: cand.a,
                tensor_b: cand.b,
                modularity_gap: field.tensors[cand.a].modularity_barrier(&field.tensors[cand.b]),
            });
            "RESISTED"
        };

        writeln!(out, "  {:>3}  {:>15}  {:>15}  {:.4}  {:.4}  {:>5}  {:>7}  {}",
            rank + 1,
            NODE_LABELS[cand.a], NODE_LABELS[cand.b],
            cand.pre_sim, post_cos,
            sap_steps, driver_str,
            result,
        ).unwrap();

        // Log saponification burns as trauma events (they ARE data)
        if sap_steps > 0 {
            field.log_trauma(SystemTrauma::TraumaDissipated {
                angle_rad: BOULIGAND_RAD,
                energy_absorbed: sap_steps as f64 * SAPONIFICATION_RATE * 100.0,
                source_dim: 14, // metabolic_cost dimension
            });
        }
    }
    writeln!(out, "").unwrap();

    // ── Trauma Log ───────────────────────────────────────────────────────
    if field.trauma_count > 0 {
        writeln!(out, "  ── SYSTEM TRAUMA LOG ({} events) ────────────────────────────",
            field.trauma_count).unwrap();
        let show = field.trauma_count.min(12); // Cap display at 12
        for i in 0..show {
            if let Some(ref trauma) = field.trauma_log[i] {
                writeln!(out, "    [{:>2}] {} (severity: {:.2})", i, trauma.label(), trauma.severity()).unwrap();
            }
        }
        if field.trauma_count > show {
            writeln!(out, "    ... and {} more events", field.trauma_count - show).unwrap();
        }
        writeln!(out, "").unwrap();
    }

    // ── Final Status ─────────────────────────────────────────────────────
    let final_order = field.order_parameter();
    let final_cryst = field.crystallised_count();

    let phase = if fusions_achieved > 0 && peak_convergence >= conv_threshold {
        "BONE_FUSED"
    } else if final_order > 0.95 {
        "CRYSTALLINE_LOCKED"
    } else if final_order > 0.85 {
        "SUPERFLUID"
    } else if final_order > 0.70 {
        "DETONATION"
    } else {
        "SUBSTRATE"
    };

    writeln!(out, "  ── CONVERGENCE STATUS ────────────────────────────────────────").unwrap();
    writeln!(out, "    phase:                {}", phase).unwrap();
    writeln!(out, "    order parameter:      {:.6}", final_order).unwrap();
    writeln!(out, "    peak convergence:     {:.6}", peak_convergence).unwrap();
    writeln!(out, "    fusions achieved:     {} / {} attempted", fusions_achieved, fusions_attempted).unwrap();
    writeln!(out, "    saponification burns: {} total iterations", total_saponification).unwrap();
    writeln!(out, "    crystallised:         {} / {}", final_cryst, field.count).unwrap();
    writeln!(out, "    thermal budget:       {:.2} J remaining", field.thermal_budget).unwrap();
    writeln!(out, "    trauma events:        {}", field.trauma_count).unwrap();
    writeln!(out, "").unwrap();

    if peak_convergence >= conv_threshold {
        writeln!(out, "  ᚱ NECROMANTIC BONE FUSION ACHIEVED ᚱ").unwrap();
        writeln!(out, "  cos(theta) = {:.6} >= {:.4} threshold", peak_convergence, conv_threshold).unwrap();
        writeln!(out, "  The mineralized bone is locked. Layer 7.7.7.7.7.7.7 complete.").unwrap();
    } else {
        writeln!(out, "  Convergence not yet achieved. Peak: {:.6} < {:.4}", peak_convergence, conv_threshold).unwrap();
        writeln!(out, "  Increase --cycles or lower --threshold to reach singularity.").unwrap();
    }
    writeln!(out, "").unwrap();
    writeln!(out, "  theory:").unwrap();
    writeln!(out, "    meyers et al. (2012) – arapaima dermal armour, advanced materials 24(37)").unwrap();
    writeln!(out, "    cao et al. (2018) – magic-angle twisted bilayer graphene, nature 556").unwrap();
    writeln!(out, "    prigogine (1977) – dissipative structures, self-organization").unwrap();
    writeln!(out, "    carlsson (2009) – topological data analysis, AMS bulletin 46(2)").unwrap();
    writeln!(out, "    mayergoyz (2003) – mathematical models of hysteresis").unwrap();
    writeln!(out, "    west, brown & enquist (1997) – metabolic scaling, science 276(5309)").unwrap();
    writeln!(out, "  source: content/rust_kernels/src/kernels/bone_fusion.rs").unwrap();

    // ── DATA: suffix for frontend consumption ────────────────────────────
    // Emit fusion results as JSON for ArtTab to potentially consume
    let fusion_json: Vec<String> = candidates.iter().enumerate()
        .map(|(_i, c)| {
            let (_, post_cos, sap, success) =
                necromantic_bone_fusion(&field.tensors[c.a], &field.tensors[c.b], conv_threshold);
            format!("{{\"a\":{},\"b\":{},\"pre\":{:.4},\"post\":{:.4},\"burns\":{},\"fused\":{}}}",
                c.a, c.b, c.pre_sim, post_cos, sap, if success { "true" } else { "false" })
        })
        .collect();

    write!(out, "\nDATA:{{\"fusions\":[{}],\"phase\":\"{}\",\"order\":{:.6},\"peak\":{:.6},\"threshold\":{:.4}}}",
        fusion_json.join(","),
        phase,
        final_order,
        peak_convergence,
        conv_threshold,
    ).unwrap();

    out
}
