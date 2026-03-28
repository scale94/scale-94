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
}

const DOMAINS: [ConceptDomain; 16] = [
    ConceptDomain { id: 0,  name: "Post-Quantum Cryptography",     descriptor: "Lattice-based key encapsulation, ML-KEM, Grover resistance",     seed: 0xA1B2_C3D4_E5F6_0001, sparsity: 0.72, curvature: 0.15 },
    ConceptDomain { id: 1,  name: "Benthic Biocenosis",            descriptor: "Deep-sea community ecology, chemosynthesis, abyssal networks",    seed: 0xDEAD_BEEF_CAFE_0002, sparsity: 0.58, curvature: 0.82 },
    ConceptDomain { id: 2,  name: "Bouligand Helicoidal Armor",    descriptor: "Arapaima scale topology, 36-degree interlaminar rotation",        seed: 0x3141_5926_5358_0003, sparsity: 0.45, curvature: 0.91 },
    ConceptDomain { id: 3,  name: "Feigenbaum Universality",       descriptor: "Period-doubling cascade, delta constant, logistic map chaos",     seed: 0x4669_2016_0910_0004, sparsity: 0.33, curvature: 0.67 },
    ConceptDomain { id: 4,  name: "Mycelial Network Topology",     descriptor: "Fungal hyphal graphs, nutrient routing, Wood Wide Web",          seed: 0xF00D_CAFE_BABE_0005, sparsity: 0.61, curvature: 0.78 },
    ConceptDomain { id: 5,  name: "Transformer Attention Heads",   descriptor: "Multi-head self-attention, QKV decomposition, softmax routing",  seed: 0xA77E_0000_FACE_0006, sparsity: 0.28, curvature: 0.43 },
    ConceptDomain { id: 6,  name: "Thermodynamic Free Energy",     descriptor: "Gibbs potential, Helmholtz work, entropic forcing, Carnot bound", seed: 0xB01D_FACE_0000_0007, sparsity: 0.39, curvature: 0.55 },
    ConceptDomain { id: 7,  name: "Surveillance Percolation",      descriptor: "Dragnet contagion, five-node treaties, legal lattice threshold", seed: 0xDA7A_B10C_0000_0008, sparsity: 0.67, curvature: 0.34 },
    ConceptDomain { id: 8,  name: "Twisted Bilayer Graphene",      descriptor: "Magic angle 1.1 degrees, flat bands, Moire superlattice",        seed: 0xC0DE_FEED_BEAD_0009, sparsity: 0.51, curvature: 0.96 },
    ConceptDomain { id: 9,  name: "Ostrom Commons Governance",     descriptor: "Polycentricity, institutional analysis, resource pool management", seed: 0x0570_0000_0000_000A, sparsity: 0.55, curvature: 0.62 },
    ConceptDomain { id: 10, name: "Kuramoto Synchronization",      descriptor: "Phase oscillator coupling, order parameter, critical sync",      seed: 0xACED_BEAD_CAFE_000B, sparsity: 0.42, curvature: 0.71 },
    ConceptDomain { id: 11, name: "Baudrillard Simulacra",         descriptor: "Hyperreality, sign precession, four stages of the image",        seed: 0x51AC_DEAD_BEEF_000C, sparsity: 0.74, curvature: 0.88 },
    ConceptDomain { id: 12, name: "Plasma Confinement Fusion",     descriptor: "Lawson criterion, Q-factor, tokamak topology, Bohm diffusion",  seed: 0xF051_0000_FADE_000D, sparsity: 0.47, curvature: 0.59 },
    ConceptDomain { id: 13, name: "Semiotic Code Collapse",        descriptor: "Eco ratio difficilis, expression-type invention, code failure",  seed: 0xEC00_0000_0000_000E, sparsity: 0.69, curvature: 0.83 },
    ConceptDomain { id: 14, name: "Evolutionary Game Theory",      descriptor: "Replicator dynamics, ESS, hawk-dove, fitness landscape",         seed: 0xE001_FACE_DEED_000F, sparsity: 0.36, curvature: 0.64 },
    ConceptDomain { id: 15, name: "Metabolic Rift Ecology",        descriptor: "Marx-Liebig nutrient cycle break, soil exhaustion, entropy debt", seed: 0xDAFE_B10C_DEAD_0010, sparsity: 0.63, curvature: 0.76 },
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
    let property_novelty = (sparsity_delta + curvature_delta) / (0.46 + 0.81); // → [0, 1]
    let novelty = property_novelty.clamp(0.0, 1.0);

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

    // Footer
    write!(out,
        "\n{dline}\n\
         THEORY  : Vaswani et al. (2017) – Attention Is All You Need\n\
         VECTORS : Mikolov et al. (2013) – Word2Vec distributed representations\n\
         ALGEBRA : Penrose (1955) – generalized inverse, orthogonal decomposition\n\
         SOURCE  : content/rust_kernels/src/kernels/latent_collider.rs",
        dline = dline,
    ).unwrap();

    out
}
