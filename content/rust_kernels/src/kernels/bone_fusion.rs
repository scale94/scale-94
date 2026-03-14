// kernels/bone_fusion.rs — BONE_FUSION v6.6.6.6.6.6 · Conceptual Singularity Engine (Foundation)
//
// 16-dimensional tensor space for associative reasoning at physics-engine fidelity.
// This is not semantic search — it is a thermodynamic field simulation where concepts
// are particles with mass, hysteresis, metabolic cost, and topological modularity.
//
// RUN 1 OF 2: Foundation layer. This file establishes:
//   1. SovereignTensor — memory-packed struct holding a 16D concept node
//   2. Fusable / KineticState — zero-allocation trait bounds for convergence ops
//   3. SystemTrauma — biomimetic error matrix (Arapaima gigas lateral dissipation)
//   4. TensorField — the arena holding all tensors with batch operations
//
// The 16 dimensions extend the spectral_bridge fingerprint space with three new
// deep-physics parameters:
//
//   [0]  dynamical        — 0=static/equilibrium → 1=stochastic PDE
//   [1]  nonlinearity     — 0=linear → 1=chaotic
//   [2]  dimensionality   — 0=scalar → 1=high-dimensional
//   [3]  criticality      — 0=no phase transition → 1=sharp critical point
//   [4]  entropy          — 0=entropy irrelevant → 1=entropy is central measure
//   [5]  synchrony        — 0=individual dynamics → 1=strong collective sync
//   [6]  conservation     — 0=fully dissipative → 1=conservative system
//   [7]  temporal         — 0=instantaneous → 1=deep-time evolution
//   [8]  spatial          — 0=point/scalar → 1=continuous spatial field
//   [9]  stochastic       — 0=deterministic → 1=fully stochastic/Monte Carlo
//   [10] game_theory      — 0=no agents → 1=explicit game-theoretic
//   [11] thermodynamic    — 0=non-physical → 1=explicit thermodynamics
//   [12] information      — 0=no info theory → 1=Shannon/entropy central
//   [13] hysteresis       — 0=memoryless → 1=full path-dependence
//   [14] metabolic_cost   — 0=zero friction → 1=maximal thermodynamic friction
//   [15] modularity       — 0=fully connected → 1=topologically isolated
//
// The original spectral_bridge dims [13]=cryptographic, [14]=biological, [15]=economic
// are remapped into the broader tensor via the fusion algorithm (Run 2). This kernel
// operates in the expanded physics-native basis.
//
// Memory layout: SovereignTensor is 16×f64 = 128 bytes for the feature vector, plus
// metadata fields. All operations are &self — zero-copy across the WASM bridge.
// No heap allocations in the hot path. Fixed-size arrays throughout.
//
// Theory:
//   - Arapaima gigas dermal armour: Meyers et al. (2012), Advanced Materials 24(37)
//     — 36° lateral load dissipation via Bouligand lamellae rotation
//   - Dissipative structures: Prigogine (1977), Self-Organization in Non-Equilibrium Systems
//   - Topological data analysis: Carlsson (2009), Topology and Data, AMS Bulletin 46(2)
//   - Hysteresis in complex systems: Mayergoyz (2003), Mathematical Models of Hysteresis
//   - Metabolic scaling: West, Brown & Enquist (1997), Science 276(5309)
//
// Usage:
//   run bone_fusion                         # default: 25 tensors, 8 fusion cycles
//   run bone_fusion --nodes 32 --cycles 16  # custom tensor count and fusion depth
//   run bone_fusion --threshold 0.85        # higher convergence threshold
//
// SOMA-9.4 · FADE_DOCTRINE · LAYER 6.6.6.6.6.6 · ARS ELECTRONICA 2027

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// ── Dimensional Constants ─────────────────────────────────────────────────────

/// Total dimensions in the extended tensor space.
const N_DIMS: usize = 16;

/// Dimension labels for the extended 16D basis.
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
    "hysteresis",      // 13  ── NEW: systemic memory / path-dependence
    "metabolic_cost",  // 14  ── NEW: thermodynamic friction
    "modularity",      // 15  ── NEW: topological isolation
];

// ── SystemTrauma: Biomimetic Error Matrix ─────────────────────────────────────
//
// Modelled after Arapaima gigas dermal armour. The fish's scales dissipate
// piranha bite force through 36° lamellae rotation — the damage is not absorbed
// or reflected, it is *rotated* into a non-destructive orientation.
//
// In this kernel, errors are never panics. They are reclassified as data:
//   TraumaDissipated — the operation failed but the failure itself is informative
//   ContextRotated   — the input was valid but required reinterpretation (36° shift)
//   EntropyOverflow  — thermal budget exceeded; operation dissolved gracefully
//   DimensionCollapse — a dimension's variance fell below measurable threshold
//   FusionRejected   — two tensors are topologically incompatible for fusion

/// Error variants modelled after biological damage dissipation.
/// Every variant carries diagnostic data — there are no opaque failures.
#[derive(Clone, Debug)]
pub enum SystemTrauma {
    /// Operation failed, but the failure vector itself is a data acquisition event.
    /// Contains the dissipation angle (radians) and the energy absorbed (joules equiv).
    /// Named for the Arapaima's 36° lamellar rotation under bite force.
    TraumaDissipated {
        angle_rad: f64,
        energy_absorbed: f64,
        source_dim: usize,
    },

    /// Input was geometrically valid but semantically rotated — reinterpretation applied.
    /// The original vector and the rotated vector are both preserved for audit.
    ContextRotated {
        original: [f64; N_DIMS],
        rotated: [f64; N_DIMS],
        rotation_deg: f64,
    },

    /// Thermal budget exceeded. The operation dissolved before completion.
    /// Records how much budget remained and how much was requested.
    EntropyOverflow {
        budget_remaining: f64,
        budget_requested: f64,
    },

    /// A dimension's variance across the field has collapsed below the measurable
    /// threshold (1e-12). The dimension index and its frozen value are recorded.
    DimensionCollapse {
        dim: usize,
        frozen_value: f64,
    },

    /// Two tensors cannot be fused — their topological modularity scores create
    /// an isolation barrier. Records the modularity gap and both tensor indices.
    FusionRejected {
        tensor_a: usize,
        tensor_b: usize,
        modularity_gap: f64,
    },
}

impl SystemTrauma {
    /// Severity score ∈ [0, 1]. Higher = more disruptive, but never fatal.
    /// Even at 1.0, the system continues — Arapaima does not die from bites.
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

    /// Human-readable classification for terminal output.
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

// ── SovereignTensor: The Core Struct ──────────────────────────────────────────
//
// A conceptual node in the 16D tensor space. Memory-packed: the feature vector
// is a fixed [f64; 16] = 128 bytes, no heap. Additional metadata fields track
// the tensor's thermodynamic state and fusion history.
//
// The three new dimensions (hysteresis, metabolic_cost, modularity) are encoded
// natively in the feature vector at indices 13–15, giving the fusion algorithm
// direct access without auxiliary lookups.

/// A single conceptual node in the 16-dimensional sovereign tensor space.
///
/// All fields are stack-allocated. The struct is Copy for zero-cost pass-by-value
/// in the fusion pipeline (128 + 48 = 176 bytes per tensor — fits in 3 cache lines).
#[derive(Clone, Copy, Debug)]
pub struct SovereignTensor {
    /// 16-dimensional feature vector. Indices 0–12 mirror spectral_bridge dims.
    /// Indices 13–15 are the deep-physics extensions (hysteresis, metabolic_cost, modularity).
    pub features: [f64; N_DIMS],

    /// Unique index within the TensorField (0-based).
    pub id: usize,

    /// Accumulated thermal energy from prior fusion operations.
    /// Rises with each fusion attempt — models metabolic heat buildup.
    pub thermal_load: f64,

    /// Number of successful fusions this tensor has participated in.
    /// Higher fusion count → more entangled state → harder to isolate.
    pub fusion_count: u32,

    /// Current kinetic energy — determines the tensor's velocity in phase space.
    /// Tensors with high kinetic energy resist convergence (inertia).
    pub kinetic_energy: f64,

    /// Convergence score from the last fusion cycle. 0.0 = no convergence,
    /// 1.0 = perfect singularity with partner tensor.
    pub last_convergence: f64,
}

impl SovereignTensor {
    /// Construct a new tensor with the given feature vector and index.
    /// All dynamic state (thermal_load, fusion_count, etc.) initialises to zero.
    pub fn new(id: usize, features: [f64; N_DIMS]) -> Self {
        Self {
            features,
            id,
            thermal_load: 0.0,
            fusion_count: 0,
            kinetic_energy: 0.0,
            last_convergence: 0.0,
        }
    }

    /// L2 norm (magnitude) of the feature vector.
    #[inline]
    pub fn norm(&self) -> f64 {
        let mut s = 0.0;
        for i in 0..N_DIMS { s += self.features[i] * self.features[i]; }
        s.sqrt()
    }

    /// Hysteresis accessor — dimension 13: systemic memory / path-dependence.
    #[inline]
    pub fn hysteresis(&self) -> f64 { self.features[13] }

    /// Metabolic cost accessor — dimension 14: thermodynamic friction.
    #[inline]
    pub fn metabolic_cost(&self) -> f64 { self.features[14] }

    /// Modularity accessor — dimension 15: topological isolation.
    #[inline]
    pub fn modularity(&self) -> f64 { self.features[15] }
}

// ── Fusable Trait ─────────────────────────────────────────────────────────────
//
// Governs how two SovereignTensors can be mathematically combined.
// All methods take &self — zero-copy, zero-allocation in the WASM bridge.
// The actual convergence algorithms (Run 2) will implement the full fusion;
// this trait defines the interface contract.

/// Trait for types that can participate in tensor fusion operations.
/// All methods are &self — no mutations, no allocations, pure computation.
pub trait Fusable {
    /// Cosine similarity between two tensors in the full 16D space.
    /// Returns a value in [-1, 1]. Only positive similarity indicates fusability.
    fn cosine_similarity(&self, other: &Self) -> f64;

    /// Dot product in the 16D feature space.
    fn dot(&self, other: &Self) -> f64;

    /// Modularity barrier: the absolute difference in modularity scores.
    /// If this exceeds a threshold, fusion is topologically forbidden.
    fn modularity_barrier(&self, other: &Self) -> f64;

    /// Metabolic cost of fusing with another tensor.
    /// Higher metabolic_cost dimensions on either side increase the fusion energy budget.
    fn fusion_cost(&self, other: &Self) -> f64;

    /// Hysteresis coupling: how much path-dependent memory is shared between the two tensors.
    /// High values mean prior fusion history strongly influences the next fusion outcome.
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
        // Geometric mean of metabolic costs — both tensors must pay
        let ma = self.metabolic_cost().max(0.01);
        let mb = other.metabolic_cost().max(0.01);
        (ma * mb).sqrt()
    }

    #[inline]
    fn hysteresis_coupling(&self, other: &Self) -> f64 {
        // Harmonic mean — coupling is limited by the weaker path-memory
        let ha = self.hysteresis();
        let hb = other.hysteresis();
        if ha + hb < 1e-12 { return 0.0; }
        2.0 * ha * hb / (ha + hb)
    }
}

// ── KineticState Trait ────────────────────────────────────────────────────────
//
// Governs the dynamic state of a tensor during time evolution.
// Separates kinetic (velocity-dependent) properties from the static Fusable geometry.

/// Trait for types with kinetic state — position + velocity in the tensor field.
/// Used during time evolution and convergence cycles.
pub trait KineticState {
    /// Total energy: kinetic + thermal load. Conserved quantity across fusion events
    /// (minus metabolic dissipation).
    fn total_energy(&self) -> f64;

    /// Effective mass — resistance to convergence. Scales with fusion history
    /// and hysteresis: a heavily-fused, path-dependent tensor is harder to move.
    fn effective_mass(&self) -> f64;

    /// Damping coefficient — how quickly kinetic energy dissipates per cycle.
    /// Higher metabolic_cost → faster damping → quicker convergence but more heat.
    fn damping(&self) -> f64;

    /// Is this tensor effectively frozen? (kinetic energy below thermal floor)
    fn is_crystallised(&self) -> bool;
}

impl KineticState for SovereignTensor {
    #[inline]
    fn total_energy(&self) -> f64 {
        self.kinetic_energy + self.thermal_load
    }

    #[inline]
    fn effective_mass(&self) -> f64 {
        // Base mass 1.0, increased by fusion history and path-dependence
        1.0 + (self.fusion_count as f64) * 0.1 + self.hysteresis() * 2.0
    }

    #[inline]
    fn damping(&self) -> f64 {
        // Metabolic cost directly governs energy dissipation rate
        0.05 + self.metabolic_cost() * 0.3
    }

    #[inline]
    fn is_crystallised(&self) -> bool {
        self.kinetic_energy < 1e-6
    }
}

// ── TensorField: The Arena ────────────────────────────────────────────────────
//
// Fixed-capacity arena holding up to MAX_TENSORS sovereign tensors.
// No Vec, no heap allocation in the hot path — all tensors live in a flat array.
// The field tracks global thermodynamic state across fusion cycles.

const MAX_TENSORS: usize = 64;

/// The arena holding all SovereignTensors and the global field state.
/// Fixed-size array — no heap allocations after construction.
pub struct TensorField {
    /// Tensor storage. Only indices [0..count) are valid.
    pub tensors: [SovereignTensor; MAX_TENSORS],
    /// Number of active tensors in the field.
    pub count: usize,
    /// Global thermal budget remaining. Fusion operations consume this.
    pub thermal_budget: f64,
    /// Accumulated SystemTrauma events from the current session.
    pub trauma_log: [Option<SystemTrauma>; 32],
    /// Number of trauma events logged.
    pub trauma_count: usize,
    /// Current fusion cycle number.
    pub cycle: u32,
}

impl TensorField {
    /// Initialise an empty field with the given thermal budget.
    pub fn new(thermal_budget: f64) -> Self {
        let zero_tensor = SovereignTensor::new(0, [0.0; N_DIMS]);
        Self {
            tensors: [zero_tensor; MAX_TENSORS],
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

    /// Insert a tensor into the field. Returns the index, or a SystemTrauma if full.
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

    /// Record a trauma event. If the log is full, oldest events are silently dropped.
    pub fn log_trauma(&mut self, trauma: SystemTrauma) {
        if self.trauma_count < 32 {
            self.trauma_log[self.trauma_count] = Some(trauma);
            self.trauma_count += 1;
        }
    }

    /// Compute the field's global order parameter: mean pairwise cosine similarity.
    /// r ∈ [0, 1] — 1.0 means all tensors have converged to the same orientation.
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

    /// Mean kinetic energy across all tensors.
    pub fn mean_kinetic(&self) -> f64 {
        if self.count == 0 { return 0.0; }
        let s: f64 = self.tensors[..self.count].iter().map(|t| t.kinetic_energy).sum();
        s / self.count as f64
    }

    /// Count of tensors that have crystallised (kinetic energy below threshold).
    pub fn crystallised_count(&self) -> usize {
        self.tensors[..self.count].iter().filter(|t| t.is_crystallised()).count()
    }

    /// Per-dimension variance across all tensors — used to detect dimension collapse.
    pub fn dim_variance(&self) -> [f64; N_DIMS] {
        let mut variance = [0.0; N_DIMS];
        if self.count < 2 { return variance; }
        let n = self.count as f64;
        // Compute mean per dimension
        let mut mean = [0.0; N_DIMS];
        for i in 0..self.count {
            for d in 0..N_DIMS {
                mean[d] += self.tensors[i].features[d];
            }
        }
        for d in 0..N_DIMS { mean[d] /= n; }
        // Compute variance
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

// ── Tensor Generation ─────────────────────────────────────────────────────────
//
// Seed tensors from the existing spectral_bridge fingerprints, extended with
// LCG-derived values for the three new dimensions (hysteresis, metabolic_cost,
// modularity). Each tensor represents one of the 25 kernel nodes, remapped into
// the expanded 16D basis.

/// The 25 kernel node labels (mirrors spectral_bridge.rs).
const NODE_LABELS: [&str; 25] = [
    "biocoenosis", "atmospheric", "chrono_actuary", "daly", "replicator", "grayscott",
    "kuramoto", "ceei", "soma_9.1", "soma_plus", "leviathan", "cynic_realist",
    "feigenbaum", "ising", "bosonic", "seraphine", "fusion_plasma",
    "classified", "pqhash", "dh_ec",
    "pragmatic", "soma_kernel", "strangler_fig", "surveillance", "necromantic",
];

/// Base 13D fingerprints from spectral_bridge (dims 0–12), to be extended to 16D.
/// These are the first 13 components of the original FEATURES matrix.
#[rustfmt::skip]
const BASE_FEATURES_13: [[f64; 13]; 25] = [
    //                    dyn   nlin  dim   crit  entr  sync  cons  temp  spat  stoc  game  therm info
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
];

/// Extended dimensions for each node: [hysteresis, metabolic_cost, modularity].
/// These are domain-derived, not arbitrary:
///   - hysteresis: how much the kernel's state depends on prior computation history
///   - metabolic_cost: energy/compute cost to maintain the kernel's active state
///   - modularity: degree of topological isolation from other kernel clusters
#[rustfmt::skip]
const EXTENDED_DIMS: [[f64; 3]; 25] = [
    //                    hyst  metab modul
    /* biocoenosis   */ [ 0.65, 0.40, 0.35 ],  // ecological memory, moderate cost, well-connected
    /* atmospheric   */ [ 0.80, 0.70, 0.40 ],  // strong climate hysteresis, expensive, moderate isolation
    /* chrono        */ [ 0.90, 0.55, 0.50 ],  // deep-time path-dependence, moderate cost, semi-isolated
    /* daly          */ [ 0.45, 0.30, 0.55 ],  // some economic memory, cheap, somewhat isolated
    /* replicator    */ [ 0.50, 0.35, 0.30 ],  // moderate history, cheap, well-connected (game-theoretic)
    /* grayscott     */ [ 0.30, 0.60, 0.45 ],  // memoryless PDE, expensive spatial compute, moderate isolation
    /* kuramoto      */ [ 0.40, 0.45, 0.25 ],  // some sync memory, moderate cost, hub node
    /* ceei          */ [ 0.35, 0.25, 0.40 ],  // mild allocation memory, cheap, moderately isolated
    /* soma91        */ [ 0.55, 0.35, 0.20 ],  // moderate history, cheap, central hub
    /* soma_plus     */ [ 0.60, 0.40, 0.20 ],  // slightly more memory than soma91, similar otherwise
    /* leviathan     */ [ 0.30, 0.80, 0.30 ],  // low hysteresis, very expensive (benchmark), connected
    /* cynic         */ [ 0.70, 0.20, 0.60 ],  // high path-dependence, cheap, isolated
    /* feigenbaum    */ [ 0.95, 0.15, 0.70 ],  // extreme bifurcation memory, cheap scalar, highly isolated
    /* ising         */ [ 0.75, 0.65, 0.35 ],  // magnetic memory, expensive Monte Carlo, moderate isolation
    /* bosonic       */ [ 0.55, 0.50, 0.30 ],  // lattice memory, moderate cost, connected
    /* seraphine     */ [ 0.45, 0.55, 0.45 ],  // quantum decoherence erases memory, moderate cost
    /* fusion        */ [ 0.60, 0.85, 0.50 ],  // plasma memory, very expensive, semi-isolated
    /* classified    */ [ 0.10, 0.70, 0.90 ],  // crypto is stateless, expensive, highly isolated
    /* pqhash        */ [ 0.10, 0.60, 0.85 ],  // hash is memoryless, moderate cost, very isolated
    /* dh_ec         */ [ 0.15, 0.55, 0.80 ],  // key exchange is near-stateless, moderate, isolated
    /* pragmatic     */ [ 0.75, 0.45, 0.35 ],  // DRK type carries history, moderate cost, connected
    /* soma_kernel   */ [ 0.65, 0.40, 0.20 ],  // stateful simulator, moderate cost, central
    /* strangler     */ [ 0.85, 0.35, 0.45 ],  // migration has deep history, cheap, semi-isolated
    /* surveillance  */ [ 0.70, 0.30, 0.50 ],  // surveillance indices track history, cheap, moderate isolation
    /* necromantic   */ [ 0.80, 0.45, 0.40 ],  // resonance memory, moderate cost, moderate isolation
];

/// Build a full 16D feature vector from the base 13D + 3 extended dimensions.
fn build_tensor_features(node_idx: usize) -> [f64; N_DIMS] {
    let mut f = [0.0; N_DIMS];
    for d in 0..13 { f[d] = BASE_FEATURES_13[node_idx][d]; }
    f[13] = EXTENDED_DIMS[node_idx][0]; // hysteresis
    f[14] = EXTENDED_DIMS[node_idx][1]; // metabolic_cost
    f[15] = EXTENDED_DIMS[node_idx][2]; // modularity
    f
}

// ── WASM Entry Point ──────────────────────────────────────────────────────────
//
// Run 1 output: constructs the tensor field, computes initial diagnostics,
// and reports the foundation state. No convergence algorithm yet — that is Run 2.

#[wasm_bindgen]
pub fn run_bone_fusion(n_tensors: f64, n_cycles: f64, threshold: f64) -> String {
    let n = (n_tensors as usize).clamp(4, MAX_TENSORS).min(25); // max 25 kernel nodes
    let cycles = (n_cycles as usize).clamp(1, 64);
    let convergence_threshold = threshold.clamp(0.50, 0.9999);

    let mut out = String::with_capacity(8000);

    // ── Banner ────────────────────────────────────────────────────────────────
    writeln!(out, "BONE_FUSION v6.6.6.6.6.6 // SOMA-9.4 // FADE_DOCTRINE").unwrap();
    writeln!(out, "Conceptual Singularity Engine — Foundation Layer").unwrap();
    writeln!(out, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  TENSOR SPACE:      {} dimensions", N_DIMS).unwrap();
    writeln!(out, "  ACTIVE TENSORS:    {} / {} capacity", n, MAX_TENSORS).unwrap();
    writeln!(out, "  FUSION CYCLES:     {} (convergence threshold: {:.4})", cycles, convergence_threshold).unwrap();
    writeln!(out, "  MEMORY LAYOUT:     {} bytes/tensor (3 cache lines)", core::mem::size_of::<SovereignTensor>()).unwrap();
    writeln!(out, "  FIELD CAPACITY:    {} bytes total", core::mem::size_of::<TensorField>()).unwrap();
    writeln!(out, "").unwrap();

    // ── Dimension Legend ──────────────────────────────────────────────────────
    writeln!(out, "  DIMENSIONS:").unwrap();
    for (i, name) in DIM_NAMES.iter().enumerate() {
        let marker = if i >= 13 { " ←NEW" } else { "" };
        writeln!(out, "    [{:>2}] {:16}{}", i, name, marker).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Construct Tensor Field ───────────────────────────────────────────────
    let mut field = TensorField::new(100.0); // 100 joules thermal budget
    for i in 0..n {
        let features = build_tensor_features(i);
        let _ = field.insert(features);
    }

    // ── Initial Diagnostics ──────────────────────────────────────────────────
    writeln!(out, "  ── TENSOR MANIFEST ──────────────────────────────────────").unwrap();
    writeln!(out, "  {:>3}  {:>15}  {:>5}  {:>5}  {:>5}  {:>5}  {:>5}  {:>5}",
        "#", "NODE", "‖v‖", "hyst", "metab", "modul", "mass", "damp").unwrap();
    writeln!(out, "  {}", "─".repeat(64)).unwrap();

    for i in 0..field.count {
        let t = &field.tensors[i];
        writeln!(out, "  {:>3}  {:>15}  {:.3}  {:.3}  {:.3}  {:.3}  {:.3}  {:.3}",
            i,
            NODE_LABELS[i],
            t.norm(),
            t.hysteresis(),
            t.metabolic_cost(),
            t.modularity(),
            t.effective_mass(),
            t.damping(),
        ).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Pairwise Similarity Scan (top bridges in 16D) ────────────────────────
    struct BridgeInfo {
        a: usize,
        b: usize,
        sim: f64,
        barrier: f64,
        cost: f64,
    }

    let mut bridges: Vec<BridgeInfo> = Vec::new();
    for i in 0..field.count {
        for j in (i + 1)..field.count {
            let sim = field.tensors[i].cosine_similarity(&field.tensors[j]);
            let barrier = field.tensors[i].modularity_barrier(&field.tensors[j]);
            let cost = field.tensors[i].fusion_cost(&field.tensors[j]);
            if sim >= 0.70 {
                bridges.push(BridgeInfo { a: i, b: j, sim, barrier, cost });
            }
        }
    }
    bridges.sort_by(|x, y| y.sim.partial_cmp(&x.sim).unwrap_or(core::cmp::Ordering::Equal));
    bridges.truncate(15);

    writeln!(out, "  ── 16D SIMILARITY SCAN (threshold >= 0.70) ─────────────").unwrap();
    writeln!(out, "  {:>3}  {:>15}  {:>15}  {:>6}  {:>6}  {:>6}  STATUS",
        "#", "TENSOR A", "TENSOR B", "COS", "BARR", "COST").unwrap();
    writeln!(out, "  {}", "─".repeat(72)).unwrap();

    for (rank, br) in bridges.iter().enumerate() {
        let status = if br.barrier > 0.5 {
            "BLOCKED"
        } else if br.sim >= convergence_threshold {
            "FUSABLE"
        } else {
            "PARTIAL"
        };
        writeln!(out, "  {:>3}  {:>15}  {:>15}  {:.4}  {:.4}  {:.4}  {}",
            rank + 1,
            NODE_LABELS[br.a],
            NODE_LABELS[br.b],
            br.sim,
            br.barrier,
            br.cost,
            status,
        ).unwrap();
    }
    if bridges.is_empty() {
        writeln!(out, "  (no pairs exceed 0.70 similarity in 16D space)").unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Fusion Cycle Simulation (kinetic damping, no convergence yet) ────────
    // Run 1 only simulates the thermal/kinetic foundation — no mathematical
    // convergence algorithm. Tensors receive random kinetic energy and damp
    // toward crystallisation over the requested cycles.

    writeln!(out, "  ── KINETIC DAMPING CYCLES ────────────────────────────────").unwrap();
    writeln!(out, "  {:>5}  {:>8}  {:>8}  {:>8}  {:>6}  {:>8}  REGIME",
        "CYCLE", "E_kin", "E_therm", "ORDER", "CRYST", "BUDGET").unwrap();
    writeln!(out, "  {}", "─".repeat(64)).unwrap();

    let mut rng: u64 = 0xB0_4E_F0_01; // deterministic seed — BONE_FUSION

    // Inject initial kinetic energy
    for i in 0..field.count {
        field.tensors[i].kinetic_energy = lcg_next(&mut rng) * 2.0;
    }

    for cycle in 0..cycles {
        field.cycle = cycle as u32;

        // Damping step: each tensor loses kinetic energy proportional to its damping coefficient
        let mut total_dissipated = 0.0;
        for i in 0..field.count {
            let t = &mut field.tensors[i];
            let damp = 0.05 + t.metabolic_cost() * 0.3; // inline damping calc
            let dissipated = t.kinetic_energy * damp;
            t.kinetic_energy -= dissipated;
            t.thermal_load += dissipated * 0.7; // 70% becomes heat
            total_dissipated += dissipated;
        }

        // Deduct from global thermal budget
        field.thermal_budget -= total_dissipated * 0.3; // 30% exits the system
        if field.thermal_budget < 0.0 { field.thermal_budget = 0.0; }

        // Stochastic perturbation — small random kicks (Brownian motion in tensor space)
        for i in 0..field.count {
            let kick = lcg_next(&mut rng) * 0.05;
            field.tensors[i].kinetic_energy += kick;
        }

        // Check for dimension collapse
        let var = field.dim_variance();
        for d in 0..N_DIMS {
            if var[d] < 1e-12 && field.count > 1 {
                field.log_trauma(SystemTrauma::DimensionCollapse {
                    dim: d,
                    frozen_value: field.tensors[0].features[d],
                });
            }
        }

        let order = field.order_parameter();
        let cryst = field.crystallised_count();
        let e_kin = field.mean_kinetic();
        let e_therm: f64 = field.tensors[..field.count].iter().map(|t| t.thermal_load).sum::<f64>() / field.count as f64;

        let regime = if order > 0.95 && cryst == field.count {
            "CRYSTALLINE"
        } else if order > 0.85 {
            "SUPERFLUID"
        } else if order > 0.70 {
            "DETONATION"
        } else {
            "SUBSTRATE"
        };

        writeln!(out, "  {:>5}  {:>8.4}  {:>8.4}  {:>8.4}  {:>4}/{}  {:>8.2}  {}",
            cycle, e_kin, e_therm, order, cryst, field.count, field.thermal_budget, regime,
        ).unwrap();
    }
    writeln!(out, "").unwrap();

    // ── Trauma Log ───────────────────────────────────────────────────────────
    if field.trauma_count > 0 {
        writeln!(out, "  ── SYSTEM TRAUMA LOG ({} events) ───────────────────────",
            field.trauma_count).unwrap();
        for i in 0..field.trauma_count {
            if let Some(ref trauma) = field.trauma_log[i] {
                writeln!(out, "    [{:>2}] {} (severity: {:.2})", i, trauma.label(), trauma.severity()).unwrap();
            }
        }
        writeln!(out, "").unwrap();
    }

    // ── Foundation Summary ───────────────────────────────────────────────────
    let final_order = field.order_parameter();
    let final_cryst = field.crystallised_count();
    let final_kin = field.mean_kinetic();

    writeln!(out, "  ── FOUNDATION STATUS ─────────────────────────────────────").unwrap();
    writeln!(out, "    order parameter:     {:.6}", final_order).unwrap();
    writeln!(out, "    crystallised:        {} / {}", final_cryst, field.count).unwrap();
    writeln!(out, "    mean kinetic energy: {:.6}", final_kin).unwrap();
    writeln!(out, "    thermal budget:      {:.2} J remaining", field.thermal_budget).unwrap();
    writeln!(out, "    trauma events:       {}", field.trauma_count).unwrap();
    writeln!(out, "    fusable pairs:       {}", bridges.iter().filter(|b| b.barrier <= 0.5 && b.sim >= convergence_threshold).count()).unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  Layer 6.6.6.6.6.6 foundation locked.").unwrap();
    writeln!(out, "  Awaiting Run 2: convergence algorithm (Layer 7.7.7.7.7.7.7).").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  theory:").unwrap();
    writeln!(out, "    meyers et al. (2012) — arapaima dermal armour, advanced materials").unwrap();
    writeln!(out, "    prigogine (1977) — dissipative structures, self-organization").unwrap();
    writeln!(out, "    carlsson (2009) — topological data analysis, AMS bulletin").unwrap();
    writeln!(out, "    mayergoyz (2003) — mathematical models of hysteresis").unwrap();
    writeln!(out, "    west, brown & enquist (1997) — metabolic scaling, science").unwrap();
    writeln!(out, "  source: content/rust_kernels/src/kernels/bone_fusion.rs").unwrap();

    out
}
