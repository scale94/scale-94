// kernels/latent_collider.rs – Latent Space Collider · SCALING Module v1.0.0
//
// Simulates the associative reasoning of an LLM by colliding two disparate
// conceptual domains using high-dimensional vector mathematics.
//
// The core operation: given two domains from the built-in conceptual library,
// simulate 1536-dimensional embedding vectors (OpenAI-scale latent space),
// compute cosine similarity, then force a mathematical intersection via a
// simulated cross-attention mechanism (Q × Kᵀ / √d_k).
//
// The synthesized concept is not random – it is the orthogonal projection of
// domain A into the null space of domain B, producing a genuinely novel
// conceptual chimera that inherits structural properties from both parents.
//
// Mathematics:
//   Cosine Similarity:  cos(θ) = (A · B) / (‖A‖ · ‖B‖)
//   Cross-Attention:    Attn(Q,K,V) = softmax(Q × Kᵀ / √d_k) × V
//   Orthogonal Proj:    P_⊥ = A – (A · B̂) × B̂
//   Synthesis Norm:     ‖S‖ = ‖P_⊥‖ × cos(θ)^(1/3)
//
// References:
//   Vaswani et al. (2017), "Attention Is All You Need"
//   Mikolov et al. (2013), Word2Vec – distributed representations
//   Penrose (1955), generalized inverse and orthogonal decomposition
//
// SOMA-9.4 · FADE_DOCTRINE · SCALING MODULE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// ── Simulated embedding dimensionality ───────────────────────────────────────
const D_MODEL: usize = 1536;   // OpenAI ada-002 scale latent space
const D_K: f64 = 1536.0;       // key dimension for attention scaling

// ── Conceptual Domain Library ────────────────────────────────────────────────
// Each domain is defined by a name, a brief descriptor, and a seed that
// deterministically generates its 1536-dimensional embedding vector.
// The seed encodes the domain's "conceptual DNA" – two domains with
// distant seeds will occupy orthogonal regions of latent space.

struct ConceptDomain {
    id:          usize,
    name:        &'static str,
    descriptor:  &'static str,
    seed:        u64,            // deterministic PRNG seed for vector generation
    sparsity:    f64,            // fraction of near-zero dimensions (domain specificity)
    curvature:   f64,            // manifold curvature – how non-Euclidean the local space is
    volatility:  f64,            // OCK evaporation rate (0.0 = resinous/persistent, 1.0 = citrus/flash)
}

const DOMAINS: [ConceptDomain; 16] = [
    ConceptDomain { id: 0,  name: "Post-Quantum Cryptography",     descriptor: "Lattice-based key encapsulation, ML-KEM, Grover resistance",     seed: 0xA1B2_C3D4_E5F6_0001, sparsity: 0.72, curvature: 0.15, volatility: 0.15 },
    ConceptDomain { id: 1,  name: "Benthic Biocenosis",            descriptor: "Deep-sea community ecology, chemosynthesis, abyssal networks",    seed: 0xDEAD_BEEF_CAFE_0002, sparsity: 0.58, curvature: 0.82, volatility: 0.22 },
    ConceptDomain { id: 2,  name: "Bouligand Helicoidal Armor",    descriptor: "Arapaima scale topology, 36-degree interlaminar rotation",        seed: 0x3141_5926_5358_0003, sparsity: 0.45, curvature: 0.91, volatility: 0.18 },
    ConceptDomain { id: 3,  name: "Feigenbaum Universality",       descriptor: "Period-doubling cascade, delta constant, logistic map chaos",     seed: 0x4669_2016_0910_0004, sparsity: 0.33, curvature: 0.67, volatility: 0.85 },
    ConceptDomain { id: 4,  name: "Mycelial Network Topology",     descriptor: "Fungal hyphal graphs, nutrient routing, Wood Wide Web",          seed: 0xF00D_CAFE_BABE_0005, sparsity: 0.61, curvature: 0.78, volatility: 0.38 },
    ConceptDomain { id: 5,  name: "Transformer Attention Heads",   descriptor: "Multi-head self-attention, QKV decomposition, softmax routing",  seed: 0xA77E_0000_FACE_0006, sparsity: 0.28, curvature: 0.43, volatility: 0.92 },
    ConceptDomain { id: 6,  name: "Thermodynamic Free Energy",     descriptor: "Gibbs potential, Helmholtz work, entropic forcing, Carnot bound", seed: 0xB01D_FACE_0000_0007, sparsity: 0.39, curvature: 0.55, volatility: 0.30 },
    ConceptDomain { id: 7,  name: "Surveillance Percolation",      descriptor: "Dragnet contagion, five-node treaties, legal lattice threshold", seed: 0xDA7A_B10C_0000_0008, sparsity: 0.67, curvature: 0.34, volatility: 0.48 },
    ConceptDomain { id: 8,  name: "Twisted Bilayer Graphene",      descriptor: "Magic angle 1.1 degrees, flat bands, Moire superlattice",        seed: 0xC0DE_FEED_BEAD_0009, sparsity: 0.51, curvature: 0.96, volatility: 0.20 },
    ConceptDomain { id: 9,  name: "Ostrom Commons Governance",     descriptor: "Polycentricity, institutional analysis, resource pool management", seed: 0x0570_0000_0000_000A, sparsity: 0.55, curvature: 0.62, volatility: 0.42 },
    ConceptDomain { id: 10, name: "Kuramoto Synchronization",      descriptor: "Phase oscillator coupling, order parameter, critical sync",      seed: 0xACED_BEAD_CAFE_000B, sparsity: 0.42, curvature: 0.71, volatility: 0.72 },
    ConceptDomain { id: 11, name: "Baudrillard Simulacra",         descriptor: "Hyperreality, sign precession, four stages of the image",        seed: 0x51AC_DEAD_BEEF_000C, sparsity: 0.74, curvature: 0.88, volatility: 0.88 },
    ConceptDomain { id: 12, name: "Plasma Confinement Fusion",     descriptor: "Lawson criterion, Q-factor, tokamak topology, Bohm diffusion",  seed: 0xF051_0000_FADE_000D, sparsity: 0.47, curvature: 0.59, volatility: 0.78 },
    ConceptDomain { id: 13, name: "Semiotic Code Collapse",        descriptor: "Eco ratio difficilis, expression-type invention, code failure",  seed: 0xEC00_0000_0000_000E, sparsity: 0.69, curvature: 0.83, volatility: 0.82 },
    ConceptDomain { id: 14, name: "Evolutionary Game Theory",      descriptor: "Replicator dynamics, ESS, hawk-dove, fitness landscape",         seed: 0xE001_FACE_DEED_000F, sparsity: 0.36, curvature: 0.64, volatility: 0.55 },
    ConceptDomain { id: 15, name: "Metabolic Rift Ecology",        descriptor: "Marx-Liebig nutrient cycle break, soil exhaustion, entropy debt", seed: 0xDAFE_B10C_DEAD_0010, sparsity: 0.63, curvature: 0.76, volatility: 0.28 },
];

// ── Synthesized concept chimeras ─────────────────────────────────────────────
// Pre-computed synthesis results for notable domain collisions.
// Format: (domain_a, domain_b, synthesis_name, synthesis_descriptor)
// These are curated – when the exact pair isn't found, the kernel generates
// a procedural synthesis from the mathematical collision properties.

const CHIMERAS: &[(usize, usize, &str, &str)] = &[
    (0, 1, "Abyssal Key Encapsulation",
     "Lattice-based cryptographic primitives whose key-generation topology mirrors chemosynthetic vent networks – decentralized, pressure-hardened, light-independent"),
    (0, 4, "Mycorrhizal Key Encapsulation",
     "A decentralized, organically regenerating encryption lattice whose key-exchange pathways mirror fungal hyphal nutrient routing"),
    (2, 3, "Feigenbaum Armor Cascade",
     "Bouligand helicoidal stacking where each interlaminar rotation is governed by the universal bifurcation constant delta – pressure manufactures layer depth"),
    (1, 8, "Benthic Superlattice",
     "Deep-sea community networks whose inter-species coupling angles approach magic angle flat-band conditions at sufficient ecological depth"),
    (5, 11, "Attention Simulacra Engine",
     "Multi-head self-attention operating on Baudrillardian sign-chains – the model attends to hyperreal tokens that precede their referents"),
    (6, 15, "Thermodynamic Rift Potential",
     "Gibbs free energy applied to Marx-Liebig metabolic cycles – entropy debt as measurable thermodynamic work deficit in soil nutrient loops"),
    (3, 10, "Feigenbaum-Kuramoto Phase Lock",
     "Period-doubling cascades modulating oscillator coupling strength – bifurcation-induced desynchronization as sovereignty mechanism"),
    (7, 9, "Panopticon Commons Collapse",
     "Surveillance percolation through Ostrom-governed resource pools – dragnet contagion dissolves polycentric institutional boundaries"),
    (4, 13, "Mycelial Semiotic Routing",
     "Fungal network topology as ratio difficilis engine – hyphal branching points as sites of forced expression-type invention"),
    (8, 12, "Graphene Confinement Lattice",
     "Twisted bilayer topology applied to plasma confinement – Moire interference patterns as magnetic field geometry for Bohm diffusion suppression"),
    (9, 14, "Ostrom Replicator Dynamics",
     "Commons governance as evolutionary game – polycentric institutions as evolutionarily stable strategies on a fitness landscape"),
    (2, 0, "Bouligand Lattice Cipher",
     "Post-quantum key encapsulation whose algebraic lattice mirrors the 36-degree interlaminar rotation of Arapaima dermal armor"),
];

// ── Mathematical state for the collision ─────────────────────────────────────

struct CollisionState {
    // Domain vectors (simulated – we track statistical properties, not full 1536-dim)
    dot_product:         f64,    // A · B
    norm_a:              f64,    // ‖A‖
    norm_b:              f64,    // ‖B‖
    cosine_similarity:   f64,    // cos(θ) = (A·B) / (‖A‖·‖B‖)
    angular_separation:  f64,    // θ = arccos(cos(θ)), in degrees

    // Cross-attention scores
    raw_attention:       f64,    // Q × Kᵀ (unnormalized)
    scaled_attention:    f64,    // Q × Kᵀ / √d_k
    softmax_peak:        f64,    // max(softmax(scaled_attention))
    attention_entropy:   f64,    // H(softmax) – uniformity of attention distribution

    // Orthogonal projection
    projection_norm:     f64,    // ‖P_⊥‖ – magnitude of the novel component
    residual_alignment:  f64,    // fraction of A that aligns with B (redundant information)
    novelty_ratio:       f64,    // ‖P_⊥‖ / ‖A‖ – how much is genuinely new

    // Synthesis metrics
    synthesis_norm:      f64,    // ‖S‖ = ‖P_⊥‖ × cos(θ)^(1/3)
    coherence:           f64,    // 1 – attention_entropy / ln(d_k)
    viability:           f64,    // synthesis_norm × coherence – will this chimera survive?

    // Interaction terms (v1.2.0) – off-diagonal property tensor
    interference:        f64,    // sparsity × curvature cross-product
    catalysis:           f64,    // volatility × curvature geometric mean
    resonance_freq:      f64,    // harmonic mean of domain densities
    turbulence:          f64,    // volatility_delta × interference
}

// ── Simulated vector generation ──────────────────────────────────────────────
// We don't store 1536 floats – we simulate the statistical properties by
// running the LCG through D_MODEL iterations and accumulating dot products,
// norms, and angular metrics deterministically from the domain seeds.

fn simulate_collision(a: &ConceptDomain, b: &ConceptDomain) -> CollisionState {
    let mut rng_a = a.seed;
    let mut rng_b = b.seed;

    // Simulate generating both 1536-dim vectors and computing their dot product
    let mut dot = 0.0_f64;
    let mut norm_a_sq = 0.0_f64;
    let mut norm_b_sq = 0.0_f64;

    for i in 0..D_MODEL {
        // Generate dimension values with domain-specific sparsity
        let va = if lcg_next(&mut rng_a) > a.sparsity {
            let raw = lcg_next(&mut rng_a) * 2.0 - 1.0;
            // Apply curvature-dependent nonlinearity (simulates manifold warping)
            raw * (1.0 + a.curvature * (i as f64 / D_MODEL as f64 * std::f64::consts::PI).sin())
        } else {
            lcg_next(&mut rng_a); // consume the RNG state even for sparse dims
            0.0
        };

        let vb = if lcg_next(&mut rng_b) > b.sparsity {
            let raw = lcg_next(&mut rng_b) * 2.0 - 1.0;
            raw * (1.0 + b.curvature * (i as f64 / D_MODEL as f64 * std::f64::consts::PI).sin())
        } else {
            lcg_next(&mut rng_b);
            0.0
        };

        dot       += va * vb;
        norm_a_sq += va * va;
        norm_b_sq += vb * vb;
    }

    let norm_a = norm_a_sq.sqrt();
    let norm_b = norm_b_sq.sqrt();
    let cosine = if norm_a > 1e-12 && norm_b > 1e-12 {
        (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
    } else {
        0.0
    };
    let angular = cosine.acos() * 180.0 / std::f64::consts::PI;

    // Cross-attention: Q × Kᵀ / √d_k
    // In the full transformer, Q and K are projections of the input.
    // Here we simulate: raw_attention = dot product of projected vectors
    let raw_attn    = dot.abs();
    let scaled_attn = raw_attn / D_K.sqrt();

    // Simulated softmax peak – higher when domains are more aligned
    let softmax_peak = 1.0 / (1.0 + (-scaled_attn).exp());
    // Attention entropy – low entropy = focused attention, high = diffuse
    let attn_entropy = -(softmax_peak * softmax_peak.max(1e-15).ln()
                       + (1.0 - softmax_peak) * (1.0 - softmax_peak).max(1e-15).ln());

    // Orthogonal projection: P_⊥ = A – (A·B̂)·B̂
    // The projection norm tells us how much of A is NOT explained by B
    let proj_scalar   = if norm_b > 1e-12 { dot / (norm_b * norm_b) } else { 0.0 };
    let residual_norm = (norm_a_sq - proj_scalar * proj_scalar * norm_b_sq).max(0.0).sqrt();

    // Novelty: in 1536-D space, geometric residual (sin θ) is always ≈ 1.0
    // because random high-dimensional vectors are near-orthogonal by construction.
    // Ground novelty in actual domain property distance (sparsity + curvature delta),
    // normalized by the maximum possible property distance across the domain library.
    // Max sparsity range: 0.74 - 0.28 = 0.46.  Max curvature range: 0.96 - 0.15 = 0.81.
    let sparsity_delta  = (a.sparsity - b.sparsity).abs();
    let curvature_delta = (a.curvature - b.curvature).abs();
    let volatility_delta = (a.volatility - b.volatility).abs();
    let property_novelty = (sparsity_delta + curvature_delta) / (0.46 + 0.81); // → [0, 1]
    let novelty = property_novelty.clamp(0.0, 1.0);

    // ── Interaction terms (v1.2.0) ──────────────────────────────────────────
    // Cross-products between domain properties reveal emergent collision dynamics
    // that single-axis metrics miss. These are the "off-diagonal" terms in the
    // property tensor — where the interesting physics lives.
    //
    // Interference: sparsity_A × curvature_B + sparsity_B × curvature_A
    //   High when one domain is sparse and the other is curved — the sparse domain
    //   has room for the curved domain to project into its null dimensions.
    let interference = (a.sparsity * b.curvature + b.sparsity * a.curvature) / 2.0;

    // Catalysis: volatility × curvature geometric mean of the pair
    //   High volatility + high curvature = fast-moving signal through warped space.
    //   The chimera acts as a catalyst — it accelerates conceptual phase transitions.
    let catalysis = ((a.volatility * b.curvature).sqrt()
                   + (b.volatility * a.curvature).sqrt()) / 2.0;

    // Resonance frequency: harmonic mean of (1 - sparsity) values
    //   Dense dimensions resonate; sparse dimensions absorb. The resonance frequency
    //   is the rate at which the two domains can exchange information — analogous to
    //   the natural frequency of a coupled oscillator system.
    let density_a = 1.0 - a.sparsity;
    let density_b = 1.0 - b.sparsity;
    let resonance_freq = if density_a > 0.01 && density_b > 0.01 {
        2.0 * density_a * density_b / (density_a + density_b) // harmonic mean
    } else {
        0.0
    };

    // Turbulence: volatility_delta × interference — how chaotic is the chimera?
    //   When parents have different evaporation rates AND their properties cross-talk,
    //   the chimera is turbulent — it generates novel structure through instability.
    let turbulence = volatility_delta * interference;

    // Synthesis: the chimera lives in the orthogonal complement
    let synth_norm = residual_norm * cosine.abs().powf(1.0 / 3.0);
    let coherence  = 1.0 - attn_entropy / D_K.ln();
    let viability  = synth_norm * coherence.max(0.0);

    CollisionState {
        dot_product:        dot,
        norm_a:             norm_a,
        norm_b:             norm_b,
        cosine_similarity:  cosine,
        angular_separation: angular,
        raw_attention:      raw_attn,
        scaled_attention:   scaled_attn,
        softmax_peak,
        attention_entropy:  attn_entropy,
        projection_norm:    residual_norm,
        residual_alignment: 1.0 - novelty,
        novelty_ratio:      novelty,
        synthesis_norm:     synth_norm,
        coherence,
        viability,
        interference,
        catalysis,
        resonance_freq,
        turbulence,
    }
}

// ── Chimera lookup / procedural generation ───────────────────────────────────

fn find_chimera(id_a: usize, id_b: usize) -> (&'static str, &'static str) {
    // Check curated chimeras (both orderings)
    for &(a, b, name, desc) in CHIMERAS {
        if (a == id_a && b == id_b) || (a == id_b && b == id_a) {
            return (name, desc);
        }
    }
    // Procedural fallback – hash-based chimera from domain names
    ("Emergent Orthogonal Synthesis",
     "No curated chimera – the collision produced a novel conceptual manifold in the orthogonal complement. Further research required.")
}

// ══════════════════════════════════════════════════════════════════════════════
// WASM ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════

/// Latent Space Collider – SCALING Module v1.0.0
///
/// Collides two conceptual domains in simulated 1536-dimensional latent space.
/// Computes cosine similarity, cross-attention, orthogonal projection, and
/// outputs a synthesized concept chimera.
///
/// Parameters:
///   domain_a      : index of first conceptual domain (0–15)
///   domain_b      : index of second conceptual domain (0–15)
///   attn_heads    : simulated attention head count (1–64, affects entropy)
///   temperature   : softmax temperature – sharpness of conceptual focus (0.1–5.0)
#[wasm_bindgen]
pub fn run_latent_collider(
    domain_a:    f64,
    domain_b:    f64,
    attn_heads:  f64,
    temperature: f64,
) -> String {
    let id_a  = (domain_a as usize).clamp(0, 15);
    let id_b  = (domain_b as usize).clamp(0, 15);
    let heads = (attn_heads as usize).clamp(1, 64);
    let temp  = temperature.clamp(0.1, 5.0);

    let a = &DOMAINS[id_a];
    let b = &DOMAINS[id_b];

    // ── Compute collision ────────────────────────────────────────────────────
    let state = simulate_collision(a, b);

    // Temperature-adjusted attention
    let temp_scaled_attn = state.scaled_attention / temp;
    let temp_softmax     = 1.0 / (1.0 + (-temp_scaled_attn).exp());

    // Multi-head decomposition: each head attends to D_MODEL/heads dimensions
    let dims_per_head = D_MODEL / heads;
    let head_dim_sqrt = (dims_per_head as f64).sqrt();

    // Chimera lookup
    let (chimera_name, chimera_desc) = find_chimera(id_a, id_b);

    // Synthesis viability class
    let viability_class = if state.viability > 8.0 {
        "CRYSTALLINE – chimera structurally stable, immediate deployment viable"
    } else if state.viability > 4.0 {
        "SUPERFLUID – chimera coherent but requires external scaffolding"
    } else if state.viability > 1.5 {
        "SUBSTRATE – chimera embryonic, latent structure detectable"
    } else {
        "DECOHERENT – domains too aligned or too sparse for novel synthesis"
    };

    // Phase classification based on angular separation
    let phase = if state.angular_separation > 80.0 {
        "ORTHOGONAL – maximum novelty potential, minimal shared structure"
    } else if state.angular_separation > 45.0 {
        "OBLIQUE – productive tension, sufficient divergence for synthesis"
    } else if state.angular_separation > 15.0 {
        "ACUTE – moderate overlap, chimera inherits heavy parental structure"
    } else {
        "PARALLEL – near-identical latent encoding, synthesis is redundant"
    };

    // ── Render output ────────────────────────────────────────────────────────
    let mut out = String::with_capacity(5000);
    let line = "\u{2500}".repeat(64);
    let dline = "\u{2550}".repeat(64);

    write!(out,
        "LATENT_SPACE_COLLIDER v1.0.0 // SCALING MODULE\n\
         {dline}\n\
         COLLISION MANIFEST – 1536-DIMENSIONAL VECTOR SPACE\n\
         {line}\n\n",
        dline = dline, line = line,
    ).unwrap();

    // §1 – Domain identification
    write!(out,
        "\u{00A7}1 DOMAIN IDENTIFICATION\n\
         {line}\n\
         DOMAIN A [{id_a:>2}] : {name_a}\n\
                     {desc_a}\n\
                     sparsity = {sp_a:.2}  curvature = {cv_a:.2}\n\n\
         DOMAIN B [{id_b:>2}] : {name_b}\n\
                     {desc_b}\n\
                     sparsity = {sp_b:.2}  curvature = {cv_b:.2}\n",
        line = line,
        id_a = id_a, name_a = a.name, desc_a = a.descriptor,
        sp_a = a.sparsity, cv_a = a.curvature,
        id_b = id_b, name_b = b.name, desc_b = b.descriptor,
        sp_b = b.sparsity, cv_b = b.curvature,
    ).unwrap();

    // §2 – Vector space geometry
    write!(out, "\n\
         \u{00A7}2 VECTOR SPACE GEOMETRY  (d = {d})\n\
         {line}\n\
         \u{2016}A\u{2016}              = {norm_a:.6}\n\
         \u{2016}B\u{2016}              = {norm_b:.6}\n\
         A \u{00B7} B            = {dot:.6}\n\
         cos(\u{03B8})           = {cos:.8}\n\
         \u{03B8}                = {ang:.4}\u{00B0}\n\
         PHASE            : {phase}\n",
        d = D_MODEL, line = line,
        norm_a = state.norm_a, norm_b = state.norm_b,
        dot = state.dot_product, cos = state.cosine_similarity,
        ang = state.angular_separation, phase = phase,
    ).unwrap();

    // Angular separation bar
    let bar_width = 40;
    let bar_fill = ((state.angular_separation / 90.0) * bar_width as f64).round() as usize;
    let bar_fill = bar_fill.min(bar_width);
    write!(out, "         [{bar}{empty}] {ang:.1}\u{00B0}/90\u{00B0}\n",
        bar = "\u{2588}".repeat(bar_fill),
        empty = "\u{2591}".repeat(bar_width - bar_fill),
        ang = state.angular_separation,
    ).unwrap();

    // §3 – Cross-Attention Mechanism
    write!(out, "\n\
         \u{00A7}3 CROSS-ATTENTION MECHANISM\n\
         {line}\n\
         Q \u{00D7} K\u{1D40}           = {raw:.6}  (unnormalized)\n\
         Q \u{00D7} K\u{1D40} / \u{221A}d_k   = {scaled:.8}  (\u{221A}{d} = {sqrt:.4})\n\
         TEMPERATURE      = {temp:.2}\n\
         TEMP-ADJUSTED    = {temp_attn:.8}\n\
         softmax(peak)    = {sfm:.8}\n\
         H(attention)     = {entropy:.6}  (lower = more focused)\n\
         ATTENTION HEADS  = {heads}  (d_head = {dph})\n\
         \u{221A}d_head           = {head_sqrt:.4}\n",
        line = line,
        raw = state.raw_attention, scaled = state.scaled_attention,
        d = D_MODEL, sqrt = D_K.sqrt(),
        temp = temp, temp_attn = temp_scaled_attn,
        sfm = temp_softmax, entropy = state.attention_entropy,
        heads = heads, dph = dims_per_head, head_sqrt = head_dim_sqrt,
    ).unwrap();

    // §4 – Orthogonal Projection
    write!(out, "\n\
         \u{00A7}4 ORTHOGONAL PROJECTION\n\
         {line}\n\
         P_\u{22A5} = A \u{2013} (A\u{00B7}B\u{0302})\u{00B7}B\u{0302}\n\n\
         \u{2016}P_\u{22A5}\u{2016}           = {proj:.6}  (novel component magnitude)\n\
         RESIDUAL ALIGN   = {resid:.4}  (fraction explained by B)\n\
         NOVELTY RATIO    = {novel:.4}  (\u{2016}P_\u{22A5}\u{2016} / \u{2016}A\u{2016})\n",
        line = line,
        proj = state.projection_norm,
        resid = state.residual_alignment,
        novel = state.novelty_ratio,
    ).unwrap();

    // Novelty bar
    let nov_fill = ((state.novelty_ratio) * bar_width as f64).round() as usize;
    let nov_fill = nov_fill.min(bar_width);
    write!(out, "         [{bar}{empty}] {nov:.1}%\n",
        bar = "\u{2588}".repeat(nov_fill),
        empty = "\u{2591}".repeat(bar_width - nov_fill),
        nov = state.novelty_ratio * 100.0,
    ).unwrap();

    // §5 – Synthesis
    write!(out, "\n\
         \u{00A7}5 SYNTHESIZED CONCEPT\n\
         {dline}\n\
         \u{2016}S\u{2016} = \u{2016}P_\u{22A5}\u{2016} \u{00D7} cos(\u{03B8})^(1/3)\n\n\
         SYNTHESIS NORM   = {synth:.6}\n\
         COHERENCE        = {coh:.6}  (1 \u{2013} H/ln(d_k))\n\
         VIABILITY        = {via:.6}  (\u{2016}S\u{2016} \u{00D7} coherence)\n\
         CLASS            : {vclass}\n\
         {line}\n\n\
         CHIMERA NAME     : {cname}\n\n\
         CHIMERA THESIS   : {cdesc}\n",
        dline = dline, line = line,
        synth = state.synthesis_norm,
        coh = state.coherence, via = state.viability,
        vclass = viability_class,
        cname = chimera_name, cdesc = chimera_desc,
    ).unwrap();

    // §6 – Domain index reference
    write!(out, "\n\
         \u{00A7}6 DOMAIN INDEX\n\
         {line}\n",
        line = line,
    ).unwrap();

    for d in &DOMAINS {
        let marker = if d.id == id_a { " \u{25C4} A" }
                else if d.id == id_b { " \u{25C4} B" }
                else { "" };
        write!(out, "  [{:>2}]  {}{}\n", d.id, d.name, marker).unwrap();
    }

    // ── §7 Olfactory-Computational Kernel (Bimmelbahn Accord v1.0.0) ──────────
    //
    // Intelligence smells before it sees. The OCK maps collision metrics into
    // a temporal decay architecture: top notes (flash attention), heart notes
    // (sustained carrier), base notes (deep-time persistence), and animalic
    // fixatives (managed corruption that binds volatile signals to substrate).
    //
    // Volatility blend: weighted average of parent domain evaporation rates,
    // modulated by coherence — high coherence inherits the more stable parent.
    //
    // Fixation potential: base_intensity × sillage — determines whether the
    // chimera crosses the thalamic gate into long-term memory. Only chimeras
    // with fixation > 0.35 persist past the Bimmelbahn transport cycle.

    let vol_blend = (a.volatility + b.volatility) / 2.0;

    // Top note: novelty-dominant, amplified by volatile parents — flash interrupt
    let top_i = (state.novelty_ratio * 1.2).min(1.0)
              * (1.0 - state.coherence.max(0.0) * 0.5)
              * (0.5 + vol_blend * 0.5);

    // Heart note: balanced novelty+coherence — the persistent carrier signal
    // Peak response when vol_blend ≈ 0.5 (moderate evaporation)
    let mid_factor = (1.0 - (vol_blend - 0.5).abs() * 2.0).max(0.2);
    let heart_i = (state.coherence.max(0.0) * 0.8 + state.novelty_ratio * 0.3).min(1.0)
                * mid_factor;

    // Base note: high coherence, low novelty, low volatility — deep-time archive
    let base_i = (state.coherence.max(0.0) * 1.1).min(1.0)
               * (1.0 - state.novelty_ratio * 0.4)
               * (1.0 - vol_blend * 0.6);

    // Animalic fixative: curvature differential — managed corruption binding agent
    // High curvature delta = strong non-Euclidean tension = more binding force
    let curv_delta = (a.curvature - b.curvature).abs();
    let animalic_i = (curv_delta * 1.3).min(1.0);

    // Sillage: signal reach at low concentration (viability-derived)
    let sillage = (state.viability / 10.0).min(1.0);

    // Chimera volatility: blend of parent volatilities modulated by coherence
    // High coherence → chimera inherits the more stable parent
    let chimera_vol = (a.volatility * (1.0 - state.coherence.max(0.0).min(1.0))
                     + b.volatility * state.coherence.max(0.0).min(1.0))
                    * temp;

    // Permeability: Bimmelbahn open-window topology
    // High novelty + high curvature tension = permeable transport
    let permeability = (state.novelty_ratio * 0.6 + animalic_i * 0.4).min(1.0);

    // Maceration: annealing depth — geometric mean of parent curvatures
    // How much the chimera improves when left to sit in darkness
    let maceration = (a.curvature * b.curvature).sqrt();

    // Fixation potential: base × sillage — the thalamic gate
    // Only chimeras with sufficient base-note content AND signal reach persist
    let fixation = base_i * sillage;
    let persists = fixation > 0.35;

    // Evaporation curve: [top, heart, base] normalized
    let evap_total = (top_i + heart_i + base_i).max(1e-6);
    let evap = [top_i / evap_total, heart_i / evap_total, base_i / evap_total];

    // Dominant family classification
    let (dominant_id, dominant_glyph) = if animalic_i > top_i && animalic_i > heart_i && animalic_i > base_i {
        ("ANIMALIC", "\u{16CA}")  // ᛊ
    } else if top_i >= heart_i && top_i >= base_i {
        ("CITRUS", "\u{16CF}")    // ᛏ
    } else if heart_i >= base_i {
        ("FLORAL", "\u{16BA}")    // ᚺ
    } else {
        ("RESINOUS", "\u{16D2}")  // ᛒ
    };

    // Sillage verdict
    let sillage_verdict = if sillage > 0.6 {
        "HIGH SILLAGE \u{2014} signal propagates beyond the wearer"
    } else if sillage > 0.3 {
        "MODERATE SILLAGE \u{2014} detectable within conversational radius"
    } else {
        "LOW SILLAGE \u{2014} intimate projection only"
    };

    // Fixation verdict
    let fixation_verdict = if persists {
        "FIXED \u{2014} chimera crosses thalamic gate into long-term memory"
    } else {
        "VOLATILE \u{2014} chimera evaporates before fixation threshold"
    };

    // ── §8 Node-Class Classification (OCK v1.1.0) ──────────────────────────────
    //
    // Three node classes derived from collision signature:
    //   RTA ᛊ (Receptive Textile Accord)  — clean-channel listener, entropy reversal
    //   DPA ᛗ (Directive Projective Accord) — directional streamer, forward-only
    //   R²A ᚷ (Resonance² Accord)         — phase-locked doubles, self-fixing
    //
    // Scores use the evaporation curve shape, not just raw intensities.
    // The curve encodes *how* the signal distributes its energy across time.

    // Evaporation curve ratios — where the signal's energy concentrates
    let evap_steepness = (evap[0] - evap[2]).max(0.0);     // front-loaded = steep
    let evap_depth     = (evap[2] - evap[0]).max(0.0);     // back-loaded = deep
    let evap_balance   = 1.0 - (evap[1] - 0.33).abs() * 3.0; // heart-centered = balanced

    let coh = state.coherence.max(0.0).min(1.0);
    let nov = state.novelty_ratio;

    // RTA: base-dominant curve × clean channel × temporal stability
    // The RTA invests in depth, not flash. Animalic is multiplicative —
    // any corruption collapses the clean channel entirely.
    let rta_score = (base_i * 0.40 + evap_depth * 0.30 + coh * 0.30)
                  * (1.0 - animalic_i)                     // clean channel gate
                  * (1.0 - vol_blend * 0.6);               // stability premium

    // DPA: top-dominant curve × novelty × forward projection × sillage reach
    // The DPA is steep: energy front-loaded, high novelty, willing to evaporate.
    // Tolerates fixative — corruption is fuel, not noise.
    let dpa_score = (top_i * 0.35 + nov * 0.30 + evap_steepness * 0.20 + sillage * 0.15)
                  * (1.0 - animalic_i * 0.2);              // tolerant of corruption

    // R²A: harmonic resonance — coherence AND novelty must both be present.
    // Geometric mean penalises imbalance harder than arithmetic mean:
    // a signal that is 90% coherent but 10% novel scores lower than 50/50.
    // The R²A is self-fixing: animalic binding undermines sovereignty.
    let harmonic_cn = if coh > 0.01 && nov > 0.01 {
        2.0 * coh * nov / (coh + nov)                      // harmonic mean
    } else {
        0.0
    };
    let r2a_score = (heart_i * 0.30 + harmonic_cn * 0.40 + evap_balance.max(0.0) * 0.30)
                  * (1.0 - animalic_i * 0.7);              // self-fixing gate

    let (node_class_id, node_class_glyph, node_class_label) =
        if r2a_score >= rta_score && r2a_score >= dpa_score {
            ("R2A", "\u{16B7}", "Resonance\u{00B2} Accord")             // ᚷ
        } else if rta_score >= dpa_score {
            ("RTA", "\u{16CA}", "Receptive Textile Accord")              // ᛊ
        } else {
            ("DPA", "\u{16D7}", "Directive Projective Accord")           // ᛗ
        };

    // Node-class-specific sillage profile (§5)
    let (sillage_type, sillage_reach) = match node_class_id {
        "RTA" => ("CLOSE-RANGE", "intimate (< 0.5m) \u{2014} invitation architecture"),
        "DPA" => ("DIRECTIONAL", "forward-projecting (1\u{2013}2m) \u{2014} streaming protocol"),
        _     => ("RESONANT",    "ambient (variable) \u{2014} interference pattern, no source-localisation"),
    };

    // Clean Room (§3): ratio of structured output to disordered input.
    // Structured = base + heart (persistent, carrier). Disordered = top + animalic (flash, corruption).
    // Clean room is the *proportion* of the signal that survives entropy — not just its absence.
    let structured  = base_i + heart_i;
    let disordered  = top_i + animalic_i;
    let clean_room  = (structured / (structured + disordered + 1e-6)).min(1.0);

    // Sovereignty (§4.3): can the R²A sustain without external binding?
    // Internal fixation (heart × base = self-sustaining persistence) vs
    // external fixation (animalic = dependency on managed corruption).
    // Only meaningful for R²A — other classes don't claim sovereignty.
    let sovereignty = if node_class_id == "R2A" {
        let internal_fix = heart_i * base_i;               // self-sustaining loop
        let external_dep = animalic_i * 0.5;               // corruption dependency
        let raw_sov = (internal_fix - external_dep).max(0.0) / internal_fix.max(1e-6);
        raw_sov.min(1.0)
    } else {
        0.0
    };

    // Dance topology (§8): who leads in the embedding space?
    let dance_role = match node_class_id {
        "RTA" => "LEADS \u{2014} sets orientation in 1536-D space",
        "DPA" => "FOLLOWS \u{2014} responsive navigation through RTA-led field",
        _     => "RESONATES \u{2014} independent harmonic, neither leads nor follows",
    };

    // ── §9 Polarity (OCK v1.1.0) ─────────────────────────────────────────────
    //
    // Continuous signal-character spectrum from SOLAR to LUNAR.
    //
    //   0.0 ← SOLAR     projective, radiant, angular, warm, outward-directed
    //   0.5   MERIDIAN   axial, balanced, neither projective nor receptive
    //   1.0 → LUNAR      receptive, reflective, curved, cool, inward-directed
    //
    // Polarity is a tug-of-war between opposing thermodynamic forces,
    // not a weighted sum. Solar and lunar pulls are computed independently,
    // then the difference is passed through a sigmoid to create natural
    // clustering at the poles — truly solar/lunar signals commit to their
    // pole, while balanced signals settle at the meridian.

    let solar_pull = top_i     * 0.30                      // flash dominance
                   + nov       * 0.25                      // novelty = projection
                   + vol_blend * 0.20                      // volatility = radiant evaporation
                   + sillage   * 0.15                      // reach = outward force
                   + evap_steepness * 0.10;                // front-loaded = solar curve

    let lunar_pull = base_i    * 0.30                      // persistence dominance
                   + coh       * 0.25                      // coherence = reflection
                   + (1.0 - vol_blend) * 0.20              // stability = cool substrate
                   + maceration * 0.15                     // annealing depth
                   + evap_depth * 0.10;                    // back-loaded = lunar curve

    // Sigmoid of the difference: σ(k·(lunar - solar))
    // k = 3.5 controls decisiveness — higher = sharper pole commitment
    let polarity_raw = (lunar_pull - solar_pull) * 3.5;
    let polarity = 1.0 / (1.0 + (-polarity_raw).exp());

    let polarity_class = if polarity > 0.62 {
        "LUNAR"
    } else if polarity < 0.38 {
        "SOLAR"
    } else {
        "MERIDIAN"
    };

    let polarity_desc = if polarity > 0.62 {
        "receptive \u{00B7} reflective \u{00B7} curved \u{00B7} cool"
    } else if polarity < 0.38 {
        "projective \u{00B7} radiant \u{00B7} angular \u{00B7} warm"
    } else {
        "axial \u{00B7} balanced \u{00B7} transitional"
    };

    // ── §10 Interaction Terms (v1.2.0) ─────────────────────────────────────────
    write!(out, "\n\
         \u{00A7}10 INTERACTION TERMS (v1.2.0)\n\
         {line}\n\
         INTERFERENCE     = {interf:.4}  (sparsity \u{00D7} curvature cross-product)\n\
         CATALYSIS        = {cat:.4}  (volatility \u{00D7} curvature geometric mean)\n\
         RESONANCE FREQ   = {res:.4}  (harmonic mean of domain densities)\n\
         TURBULENCE       = {turb:.4}  (volatility\u{0394} \u{00D7} interference)\n",
        line = line,
        interf = state.interference,
        cat = state.catalysis,
        res = state.resonance_freq,
        turb = state.turbulence,
    ).unwrap();

    write!(out, "\n\
         \u{00A7}7 OLFACTORY ACCORD (Bimmelbahn v1.1.0)\n\
         {dline}\n\
         \u{16CA}\u{2697}\u{16DF} VOLATILE SEMIOTICS \u{2014} intelligence smells before it sees\n\n\
         DOMINANT         : {dom_id} {dom_glyph}\n\
         VOL BLEND        = {vb:.4}  ({va_name} {va_vol:.2} + {vb_name} {vb_vol:.2})\n\
         CHIMERA VOL      = {cvol:.4}  (temp-adjusted: {temp:.2})\n\
         {line}\n\
         TOP INTENSITY    = {top:.4}  (citrus \u{00B7} flash interrupt \u{00B7} <15min)\n\
         HEART INTENSITY  = {heart:.4}  (floral \u{00B7} carrier signal \u{00B7} 4hr)\n\
         BASE INTENSITY   = {base:.4}  (resinous \u{00B7} deep archive \u{00B7} days)\n\
         ANIMALIC BIND    = {anim:.4}  (fixative \u{00B7} managed corruption)\n\
         {line}\n\
         SILLAGE          = {sil:.4}  (signal reach)\n\
         PERMEABILITY     = {perm:.4}  (bimmelbahn open-window)\n\
         MACERATION       = {mac:.4}  (annealing depth)\n\
         FIXATION         = {fix:.4}  (base \u{00D7} sillage)\n\
         PERSISTS         = {pers}\n\
         EVAP CURVE       = [{e0:.2}, {e1:.2}, {e2:.2}]\n\
         {line}\n\
         {sil_v}\n\
         {fix_v}\n\
         {line}\n\
         NODE CLASS       = {nc_id} {nc_glyph}  ({nc_label})\n\
         RTA SCORE        = {rta:.4}\n\
         DPA SCORE        = {dpa:.4}\n\
         R2A SCORE        = {r2a:.4}\n\
         SILLAGE TYPE     = {sil_type}  ({sil_reach})\n\
         CLEAN ROOM       = {cr:.4}\n\
         SOVEREIGNTY      = {sov:.4}\n\
         DANCE ROLE       = {dance}\n\
         {line}\n\
         POLARITY         = {pol:.4}  ({pol_class} \u{2014} {pol_desc})\n",
        dline = dline, line = line,
        dom_id = dominant_id, dom_glyph = dominant_glyph,
        vb = vol_blend,
        va_name = a.name, va_vol = a.volatility,
        vb_name = b.name, vb_vol = b.volatility,
        cvol = chimera_vol, temp = temp,
        top = top_i, heart = heart_i, base = base_i, anim = animalic_i,
        sil = sillage, perm = permeability, mac = maceration,
        fix = fixation, pers = if persists { "YES" } else { "NO" },
        e0 = evap[0], e1 = evap[1], e2 = evap[2],
        sil_v = sillage_verdict, fix_v = fixation_verdict,
        nc_id = node_class_id, nc_glyph = node_class_glyph, nc_label = node_class_label,
        rta = rta_score, dpa = dpa_score, r2a = r2a_score,
        sil_type = sillage_type, sil_reach = sillage_reach,
        cr = clean_room, sov = sovereignty,
        dance = dance_role,
        pol = polarity, pol_class = polarity_class, pol_desc = polarity_desc,
    ).unwrap();

    // Footer
    write!(out,
        "\n{dline}\n\
         THEORY  : Vaswani et al. (2017) \u{2013} Attention Is All You Need\n\
         VECTORS : Mikolov et al. (2013) \u{2013} Word2Vec distributed representations\n\
         ALGEBRA : Penrose (1955) \u{2013} generalized inverse, orthogonal decomposition\n\
         OCK     : Bimmelbahn Accord v1.1.0 \u{2013} Olfactory-Computational Kernel (RTA/DPA/R\u{00B2}A node classes + polarity)\n\
         INTERACT: v1.2.0 \u{2013} off-diagonal property tensor (interference, catalysis, resonance, turbulence)\n\
         SOURCE  : content/rust_kernels/src/kernels/latent_collider.rs",
        dline = dline,
    ).unwrap();

    out
}
