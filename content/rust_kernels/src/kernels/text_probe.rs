// kernels/text_probe.rs — User Concept Injection Kernel v1.0.0
//
// Maps free-form visitor text to the 16-dimensional mathematical fingerprint
// space shared by the 25 soma kernels. Computes cosine distances to all
// nodes, enabling live projection of any concept into the orbital sphere.
//
// The scoring is heuristic — keyword frequency weighted by text length —
// but the 16D space is the same calibrated space as spectral_bridge.rs.
// Two sentences with high cosine similarity to 'biocoenosis' genuinely
// share structural mathematical properties with that kernel.
//
// Usage (terminal command):
//   probe <concept text>
//
// Output:
//   - 16D feature vector with bar chart
//   - Cosine distances to all 25 kernels, ranked
//   - DATA: JSON consumed by ArtTab to spawn a probe node on the sphere
//
// References:
//   - Salton & McGill (1983), Introduction to Modern Information Retrieval
//   - Cosine similarity for concept projection: Manning et al. (2008), IIR
//
// SOMA-9.4 · FADE_DOCTRINE · ARS ELECTRONICA 2027

use std::fmt::Write;
use wasm_bindgen::prelude::*;

const N_DIMS: usize = 16;

const DIM_NAMES: [&str; N_DIMS] = [
    "dynamical",      // 0
    "nonlinearity",   // 1
    "dimensionality", // 2
    "criticality",    // 3
    "entropy",        // 4
    "synchrony",      // 5
    "conservation",   // 6
    "temporal",       // 7
    "spatial",        // 8
    "stochastic",     // 9
    "game_theory",    // 10
    "thermodynamic",  // 11
    "information",    // 12
    "cryptographic",  // 13
    "biological",     // 14
    "economic",       // 15
];

// Keyword lists — substrings matched against lowercased input.
// Each match adds weight to that dimension's score.
const KEYWORDS: [&[&str]; N_DIMS] = [
    // 0 dynamical — time-varying state, flows, trajectories
    &["chaos","flow","dynamic","stochastic","drift","turbulen","wave","oscillat",
      "motion","evolv","trajectory","feedback","cycl","flux","differential",
      "time-vary","transient","nonequilib","stream","current"],
    // 1 nonlinearity — exponential / chaotic / bifurcating behaviour
    &["chaos","nonlinear","bifurcat","attractor","fractal","exponential",
      "cascade","tipping","sensitive","butterfly","logistic","amplif",
      "explosive","lorenz","instabi","diverge","strange","power law"],
    // 2 dimensionality — high-dimensional state spaces, embeddings
    &["dimension","tensor","matrix","manifold","embedding","abstract",
      "topolog","phase space","latent","parameter","state space","eigen",
      "spectrum","compress","project","basis","high-dim","vector space"],
    // 3 criticality — phase transitions, tipping points, regime shifts
    &["critical","phase transition","tipping","threshold","collapse","ruptur",
      "inflection","catastroph","bifurcat","percolat","singular","regime",
      "crisis","breakd","edge of chaos","precipice","irreversib change"],
    // 4 entropy — disorder, uncertainty, thermodynamic spreading
    &["entropy","disorder","thermodynamic","shannon","uncertainty",
      "randomness","dissipat","irreversib","heat death","noise","mixing",
      "second law","arrow of time","boltzmann","information","spread"],
    // 5 synchrony — collective phase-locking, coordination
    &["synchron","couple","coordinat","collective","resonance","coherence",
      "alignment","rhythm","phase lock","entrain","convergence","harmoni",
      "chorus","lock-in","consensus","emergenc","coordin"],
    // 6 conservation — conserved quantities, Hamiltonian dynamics
    &["conserv","invariant","hamiltonian","momentum","symmetry","preserved",
      "equilibrium","balanced","constant","noether","lagrangi","reversib",
      "closed system","maintain","steady state"],
    // 7 temporal — deep time, historical memory, long-horizon dynamics
    &["time","history","memory","past","future","age","epoch","legacy",
      "ancestral","generational","geological","archive","long-term",
      "deep time","durable","temporal","chronolog","timeline","era",
      "millennium","geological"],
    // 8 spatial — fields, geography, distributed patterns
    &["spatial","field","geography","territory","landscape","region",
      "coordinate","pattern","gradient","distribut","map","diffus",
      "morphogen","turing","local","global","reaction-diffusion","topograph"],
    // 9 stochastic — probabilistic and random systems
    &["random","noise","probabilistic","stochastic","uncertain","variance",
      "distribution","monte carlo","sampling","fluctuat","brownian",
      "poisson","markov","random walk","ensemble","statistical"],
    // 10 game_theory — strategic interaction between rational agents
    &["game","strategy","agent","nash","equilibrium","rational","incentive",
      "payoff","cooperat","defect","prisoner","dilemma","compet","auction",
      "bargain","decision","mechanism","tournament","arms race"],
    // 11 thermodynamic — heat, temperature, dissipation as physical models
    &["heat","temperature","boltzmann","dissipat","free energy","thermal",
      "carnot","gibbs","friction","waste","entropy produc","exergy",
      "caloric","kelvin","joule","work","thermodynam"],
    // 12 information — communication theory, Shannon, data
    &["information","shannon","bits","compress","channel","signal","encode",
      "message","transmission","bandwidth","communic","symbol","code",
      "mutual information","channel capacity","data","lossless"],
    // 13 cryptographic — encryption, post-quantum, security primitives
    &["encrypt","cipher","key","hash","secret","quantum","kem","lattice",
      "post-quantum","signature","authentic","zero-knowledge","crypto",
      "fips","secure","private","kyber","dilithium","falcon","ml-kem",
      "symmetric","asymmetric"],
    // 14 biological — ecology, living systems, evolution, organisms
    &["ecolog","life","organism","species","biolog","evolut","ecosystem",
      "populat","niche","predator","prey","diversit","biodiversity",
      "symbiosis","metabolic","cell","gene","forest","ocean","virus",
      "bacter","biom","habitat"],
    // 15 economic — markets, capital, resource allocation
    &["economy","market","price","cost","capital","gdp","financ","value",
      "profit","loss","inequalit","debt","growth","labor","wage",
      "production","allocation","resource","supply","demand","trade",
      "rent","currency","liquidity"],
];

// ── 16-dimensional feature vectors (mirrors ArtTab.jsx FEATURES + spectral_bridge.rs) ──

#[rustfmt::skip]
const FEATURES: [[f64; N_DIMS]; 25] = [
    /*  0 biocoenosis */ [ 0.75,0.55,0.50,0.30,0.90,0.30,0.40,0.50,0.35,0.70,0.40,0.20,0.85,0.00,1.00,0.20 ],
    /*  1 atmospheric */ [ 0.80,0.70,0.75,0.50,0.55,0.20,0.50,0.80,0.70,0.30,0.10,0.80,0.30,0.00,0.40,0.10 ],
    /*  2 chrono      */ [ 0.50,0.45,0.50,0.30,0.50,0.10,0.30,1.00,0.35,0.20,0.30,0.60,0.40,0.00,0.65,0.70 ],
    /*  3 daly        */ [ 0.25,0.40,0.30,0.20,0.70,0.20,0.60,0.70,0.05,0.10,0.50,0.75,0.50,0.00,0.30,0.90 ],
    /*  4 replicator  */ [ 0.55,0.70,0.50,0.45,0.45,0.50,0.50,0.45,0.65,0.30,1.00,0.10,0.30,0.00,0.75,0.40 ],
    /*  5 grayscott   */ [ 1.00,0.90,0.75,0.60,0.30,0.40,0.40,0.30,1.00,0.00,0.00,0.20,0.10,0.00,0.30,0.00 ],
    /*  6 kuramoto    */ [ 0.55,0.60,0.70,0.55,0.35,1.00,0.50,0.40,0.65,0.20,0.20,0.10,0.25,0.00,0.25,0.10 ],
    /*  7 ceei        */ [ 0.25,0.30,0.55,0.20,0.40,0.50,0.80,0.20,0.65,0.10,0.85,0.20,0.40,0.00,0.10,1.00 ],
    /*  8 soma91      */ [ 0.30,0.35,0.50,0.30,0.50,0.40,0.50,0.50,0.65,0.20,0.30,0.50,0.50,0.00,0.20,0.50 ],
    /*  9 soma_plus   */ [ 0.45,0.40,0.55,0.30,0.50,0.50,0.50,0.50,0.65,0.30,0.30,0.50,0.50,0.00,0.20,0.40 ],
    /* 10 leviathan   */ [ 0.30,0.50,0.70,0.35,0.40,0.55,0.30,0.45,0.65,0.30,0.90,0.25,0.30,0.00,0.10,0.50 ],
    /* 11 cynic       */ [ 0.15,0.25,0.30,0.10,0.30,0.20,0.20,0.35,0.10,0.15,0.50,0.15,0.20,0.00,0.10,0.30 ],
    /* 12 feigenbaum  */ [ 0.30,1.00,0.25,0.85,0.25,0.10,0.50,0.20,0.05,0.00,0.00,0.10,0.20,0.00,0.00,0.00 ],
    /* 13 ising       */ [ 0.85,0.65,0.55,1.00,0.60,0.70,0.50,0.30,0.40,0.90,0.10,0.85,0.50,0.00,0.00,0.00 ],
    /* 14 bosonic     */ [ 0.50,0.55,0.70,0.70,0.40,0.60,0.50,0.20,0.65,0.30,0.40,0.70,0.30,0.00,0.00,0.30 ],
    /* 15 seraphine   */ [ 0.50,0.65,0.70,0.50,0.35,0.30,0.40,0.25,0.65,0.40,0.10,0.40,0.35,0.45,0.00,0.10 ],
    /* 16 fusion      */ [ 0.80,0.75,0.75,0.60,0.30,0.20,0.45,0.30,0.90,0.30,0.00,0.90,0.20,0.00,0.00,0.10 ],
    /* 17 classified  */ [ 0.05,0.30,0.30,0.00,0.20,0.00,0.05,0.05,0.05,0.50,0.00,0.00,0.50,1.00,0.00,0.00 ],
    /* 18 pqhash      */ [ 0.05,0.35,0.45,0.00,0.40,0.00,0.05,0.05,0.30,0.30,0.00,0.00,0.70,0.90,0.00,0.00 ],
    /* 19 dh_ec       */ [ 0.10,0.50,0.50,0.00,0.25,0.00,0.05,0.05,0.30,0.20,0.00,0.00,0.55,0.90,0.00,0.00 ],
    /* 20 pragmatic   */ [ 0.30,0.55,0.50,0.25,0.50,0.20,0.30,0.50,0.35,0.30,0.20,0.55,0.50,0.00,0.10,0.20 ],
    /* 21 soma_kernel */ [ 0.50,0.50,0.70,0.30,0.60,0.45,0.50,0.50,0.65,0.30,0.30,0.50,0.55,0.00,0.20,0.30 ],
    /* 22 strangler   */ [ 0.50,0.50,0.50,0.40,0.35,0.30,0.30,0.70,0.35,0.25,0.20,0.30,0.25,0.00,0.60,0.15 ],
    /* 23 surveillance*/ [ 0.25,0.30,0.55,0.20,0.60,0.20,0.20,0.50,0.65,0.20,0.50,0.10,0.70,0.30,0.10,0.30 ],
    /* 24 necromantic */ [ 0.70,0.65,0.50,0.40,0.40,0.30,0.20,0.65,0.35,0.50,0.20,0.45,0.30,0.00,0.50,0.10 ],
];

const NODE_IDS: [&str; 25] = [
    "biocoenosis","atmospheric","chrono","daly","replicator","grayscott",
    "kuramoto","ceei","soma91","soma_plus","leviathan","cynic",
    "feigenbaum","ising","bosonic","seraphine","fusion",
    "classified","pqhash","dh_ec",
    "pragmatic","soma_kernel","strangler","surveillance","necromantic",
];

const NODE_LABELS: [&str; 25] = [
    "biocoenosis","atmospheric","chrono_actuary","daly","replicator","grayscott",
    "kuramoto","ceei","soma_9.1","soma_plus","leviathan","cynic_realist",
    "feigenbaum","ising","bosonic","seraphine","fusion_plasma",
    "classified","pqhash","dh_ec",
    "pragmatic","soma_kernel","strangler_fig","surveillance","necromantic",
];

const NODE_CLUSTERS: [&str; 25] = [
    "eco","eco","eco","eco","eco","eco",
    "sync","sync","sync","sync","sync","sync",
    "phys","phys","phys","phys","phys",
    "crypto","crypto","crypto",
    "drk","drk","drk","drk","drk",
];

// ── Scoring ───────────────────────────────────────────────────────────────────

fn score_text(text: &str) -> [f64; N_DIMS] {
    let t = text.to_lowercase();
    let word_count = t.split_whitespace().count().max(1) as f64;
    let mut scores = [0.0f64; N_DIMS];

    for (dim, kws) in KEYWORDS.iter().enumerate() {
        let mut matches = 0u32;
        for kw in kws.iter() {
            if t.contains(kw) {
                matches += 1;
            }
        }
        // 1 keyword match in a 4-word text → ~0.60; saturates at ~3 matches
        scores[dim] = (matches as f64 * 1.2 / word_count.sqrt()).min(1.0);
    }

    scores
}

fn cosine_sim(a: &[f64; N_DIMS], b: &[f64; N_DIMS]) -> f64 {
    let mut dot = 0.0f64;
    let mut na  = 0.0f64;
    let mut nb  = 0.0f64;
    for i in 0..N_DIMS {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom < 1e-12 { 0.0 } else { dot / denom }
}

fn bar(v: f64, w: usize) -> String {
    let filled = ((v * w as f64).round() as usize).min(w);
    let empty  = w - filled;
    format!("{}{}", "█".repeat(filled), "░".repeat(empty))
}

// ── WASM export ───────────────────────────────────────────────────────────────

/// Map free-form text to the 16D kernel fingerprint space.
/// Returns terminal output + DATA: JSON for the ArtTab probe node.
#[wasm_bindgen]
pub fn run_text_probe(text: &str) -> String {
    let mut out = String::with_capacity(8000);

    if text.trim().is_empty() {
        writeln!(out, "[TEXT_PROBE] Error: no text supplied.").unwrap();
        writeln!(out, "Usage: probe <concept text>").unwrap();
        return out;
    }

    let word_count = text.split_whitespace().count();

    writeln!(out, "TEXT PROBE v1.0 // 16D Concept Fingerprinting").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  QUERY  : \"{}\"", text).unwrap();
    writeln!(out, "  TOKENS : {}  →  16-dimensional feature space", word_count).unwrap();
    writeln!(out, "  METRIC : cosine distance  d = 1 - (A·B / |A||B|)").unwrap();
    writeln!(out, "").unwrap();

    let probe_vec = score_text(text);

    // Find dominant dimensions
    let mut dims_sorted: Vec<(usize, f64)> = probe_vec
        .iter().enumerate().map(|(i, &v)| (i, v)).collect();
    dims_sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let dominant: Vec<&str> = dims_sorted.iter()
        .filter(|&&(_, v)| v > 0.20)
        .take(4)
        .map(|&(i, _)| DIM_NAMES[i])
        .collect();

    // Display probe vector
    writeln!(out, "PROBE VECTOR ─────────────────────────────────────────────────").unwrap();
    for i in 0..N_DIMS {
        let v = probe_vec[i];
        let dom = if dims_sorted[0].0 == i && v > 0.15 { "  ◄ dominant" }
                  else if dims_sorted[1].0 == i && v > 0.15 { "  ◄" }
                  else { "" };
        writeln!(out, "  [{:02}] {:<14} {}  {:.2}{}", i, DIM_NAMES[i], bar(v, 14), v, dom).unwrap();
    }
    writeln!(out, "").unwrap();

    if dominant.is_empty() {
        writeln!(out, "  ► no dominant dimensions — try more specific language").unwrap();
    } else {
        writeln!(out, "  ► dominant: {}", dominant.join(", ")).unwrap();
    }
    writeln!(out, "").unwrap();

    // Cosine similarities against all 25 kernels
    let mut sims: Vec<(usize, f64)> = FEATURES.iter()
        .enumerate()
        .map(|(i, kv)| (i, cosine_sim(&probe_vec, kv)))
        .collect();
    sims.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    writeln!(out, "COSINE DISTANCES ──────────────────────────────────────────────").unwrap();
    writeln!(out, "  d = 1 - (A·B / |A||B|)   lower = nearer").unwrap();
    writeln!(out, "").unwrap();

    for &(idx, sim) in sims.iter().take(10) {
        let dist    = 1.0 - sim;
        let bw      = ((sim * 20.0).round() as usize).min(20);
        let bar_str = format!("{}{}", "█".repeat(bw), "░".repeat(20 - bw));
        let prox    = if dist < 0.10 { "VERY NEAR" }
                      else if dist < 0.20 { "NEAR" }
                      else if dist < 0.40 { "MODERATE" }
                      else { "FAR" };
        writeln!(out, "  {:<16} d={:.4}  {}  {}", NODE_LABELS[idx], dist, bar_str, prox).unwrap();
    }
    writeln!(out, "  · · · ({} more nodes)", sims.len() - 10).unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  PROBE NODE SPAWNED — switch to /art to see your injection").unwrap();
    writeln!(out, "  Your concept orbits the sphere, tethered to its nearest kernels.").unwrap();

    // ── DATA: JSON for ArtTab ──────────────────────────────────────────────────
    // Full similarity list for the sphere, sorted by similarity descending
    let mut sims_json = String::from("[");
    for (i, &(idx, sim)) in sims.iter().enumerate() {
        if i > 0 { sims_json.push(','); }
        write!(
            sims_json,
            "{{\"id\":\"{}\",\"label\":\"{}\",\"cluster\":\"{}\",\"sim\":{:.6},\"dist\":{:.6}}}",
            NODE_IDS[idx], NODE_LABELS[idx], NODE_CLUSTERS[idx], sim, 1.0 - sim,
        ).unwrap();
    }
    sims_json.push(']');

    // Escape query for JSON
    let q_esc: String = text.chars().map(|c| match c {
        '"'  => "\\\"".to_string(),
        '\\' => "\\\\".to_string(),
        '\n' => "\\n".to_string(),
        '\r' => "\\r".to_string(),
        c    => c.to_string(),
    }).collect();

    let vec_str = {
        let parts: Vec<String> = probe_vec.iter().map(|v| format!("{:.6}", v)).collect();
        format!("[{}]", parts.join(","))
    };

    write!(
        out,
        "\nDATA:{{\"query\":\"{}\",\"probe_vector\":{},\"similarities\":{}}}",
        q_esc, vec_str, sims_json,
    ).unwrap();

    out
}
