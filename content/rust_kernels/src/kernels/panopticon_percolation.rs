// kernels/panopticon_percolation.rs – Panopticon Percolation Engine · SURVEILLANCE Module v1.0.0
//
// Models surveillance legislation as an active contagion network using
// percolation theory. 44 indexed legislative instruments are treated as
// nodes in a graph, with edges defined by intelligence-sharing probability
// (treaty obligations, mutual legal assistance, technical interoperability).
//
// A Monte Carlo simulation models dragnet propagation – a data breach or
// surveillance request originating at any node and spreading through the
// legal lattice via probabilistic contagion. The critical question:
// does the system reach the percolation threshold p_c where isolated
// surveillance jurisdictions merge into a single inescapable global cluster?
//
// Mathematics:
//   Bond Percolation:  Each edge active with probability p
//   Percolation Threshold:  p_c = 1 / (\u{03BA} \u{2013} 1),  \u{03BA} = \u{27E8}k\u{00B2}\u{27E9}/\u{27E8}k\u{27E9}
//   Giant Component:   S(p) = fraction of nodes in largest cluster
//   Sovereignty Threat: T = S(p) \u{00D7} 100%
//
// CRITICAL DIRECTIVE: No geographical locations, city names, or country
// names appear in this kernel. All legislative instruments are referenced
// by abstract regulatory identifiers only.
//
// References:
//   Broadbent & Hammersley (1957), "Percolation processes"
//   Molloy & Reed (1995), critical condition for giant component
//   Stauffer & Aharony (1994), Introduction to Percolation Theory
//   Foucault (1975), Surveiller et punir – the panopticon as architecture
//
// SOMA-9.4 \u{00B7} FADE_DOCTRINE \u{00B7} SURVEILLANCE MODULE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// \u{2550}\u{2550} Legislative Node Registry \u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}\u{2550}
// Each node represents a legislative instrument – identified by regulatory
// code only. No sovereign entity names, no jurisdictional geography.
//
// Fields:
//   id         : unique index (0–43)
//   code       : abstract regulatory identifier
//   category   : legislative classification
//   reach      : jurisdictional reach multiplier (0.0–1.0)
//   tech_cap   : technical interception capability (0.0–1.0)
//   treaty_tier: intelligence-sharing tier (0=isolated, 1=bilateral, 2=multilateral, 3=deep fusion)

struct LegislativeNode {
    id:          usize,
    code:        &'static str,
    category:    &'static str,
    reach:       f64,
    tech_cap:    f64,
    treaty_tier: u8,
}

const NODES: [LegislativeNode; 44] = [
    // ── Tier-3: Deep Fusion Signatories (intelligence-sharing cores) ──────────
    LegislativeNode { id: 0,  code: "SIGINT-ALPHA-001",    category: "signals_intelligence",     reach: 0.95, tech_cap: 0.98, treaty_tier: 3 },
    LegislativeNode { id: 1,  code: "SIGINT-ALPHA-002",    category: "signals_intelligence",     reach: 0.92, tech_cap: 0.96, treaty_tier: 3 },
    LegislativeNode { id: 2,  code: "SIGINT-ALPHA-003",    category: "signals_intelligence",     reach: 0.88, tech_cap: 0.91, treaty_tier: 3 },
    LegislativeNode { id: 3,  code: "SIGINT-ALPHA-004",    category: "signals_intelligence",     reach: 0.85, tech_cap: 0.89, treaty_tier: 3 },
    LegislativeNode { id: 4,  code: "SIGINT-ALPHA-005",    category: "signals_intelligence",     reach: 0.83, tech_cap: 0.87, treaty_tier: 3 },

    // ── Tier-2: Multilateral Treaty Participants ─────────────────────────────
    LegislativeNode { id: 5,  code: "MLAT-BETA-006",       category: "mutual_legal_assistance",  reach: 0.78, tech_cap: 0.82, treaty_tier: 2 },
    LegislativeNode { id: 6,  code: "MLAT-BETA-007",       category: "mutual_legal_assistance",  reach: 0.75, tech_cap: 0.79, treaty_tier: 2 },
    LegislativeNode { id: 7,  code: "MLAT-BETA-008",       category: "mutual_legal_assistance",  reach: 0.72, tech_cap: 0.76, treaty_tier: 2 },
    LegislativeNode { id: 8,  code: "MLAT-BETA-009",       category: "mutual_legal_assistance",  reach: 0.70, tech_cap: 0.74, treaty_tier: 2 },
    LegislativeNode { id: 9,  code: "MLAT-BETA-010",       category: "mutual_legal_assistance",  reach: 0.68, tech_cap: 0.71, treaty_tier: 2 },
    LegislativeNode { id: 10, code: "DATA-GAMMA-011",      category: "data_retention_mandate",   reach: 0.80, tech_cap: 0.85, treaty_tier: 2 },
    LegislativeNode { id: 11, code: "DATA-GAMMA-012",      category: "data_retention_mandate",   reach: 0.77, tech_cap: 0.80, treaty_tier: 2 },
    LegislativeNode { id: 12, code: "DATA-GAMMA-013",      category: "data_retention_mandate",   reach: 0.65, tech_cap: 0.70, treaty_tier: 2 },
    LegislativeNode { id: 13, code: "CYBER-DELTA-014",     category: "cyber_surveillance",       reach: 0.82, tech_cap: 0.90, treaty_tier: 2 },
    LegislativeNode { id: 14, code: "CYBER-DELTA-015",     category: "cyber_surveillance",       reach: 0.76, tech_cap: 0.84, treaty_tier: 2 },

    // ── Tier-1: Bilateral Arrangements ───────────────────────────────────────
    LegislativeNode { id: 15, code: "BILAT-EPSILON-016",   category: "bilateral_intercept",      reach: 0.60, tech_cap: 0.65, treaty_tier: 1 },
    LegislativeNode { id: 16, code: "BILAT-EPSILON-017",   category: "bilateral_intercept",      reach: 0.58, tech_cap: 0.62, treaty_tier: 1 },
    LegislativeNode { id: 17, code: "BILAT-EPSILON-018",   category: "bilateral_intercept",      reach: 0.55, tech_cap: 0.60, treaty_tier: 1 },
    LegislativeNode { id: 18, code: "BILAT-EPSILON-019",   category: "bilateral_intercept",      reach: 0.52, tech_cap: 0.58, treaty_tier: 1 },
    LegislativeNode { id: 19, code: "BILAT-EPSILON-020",   category: "bilateral_intercept",      reach: 0.50, tech_cap: 0.55, treaty_tier: 1 },
    LegislativeNode { id: 20, code: "RETAIN-ZETA-021",     category: "metadata_retention",       reach: 0.62, tech_cap: 0.68, treaty_tier: 1 },
    LegislativeNode { id: 21, code: "RETAIN-ZETA-022",     category: "metadata_retention",       reach: 0.58, tech_cap: 0.63, treaty_tier: 1 },
    LegislativeNode { id: 22, code: "RETAIN-ZETA-023",     category: "metadata_retention",       reach: 0.54, tech_cap: 0.60, treaty_tier: 1 },
    LegislativeNode { id: 23, code: "LAWFUL-ETA-024",      category: "lawful_intercept",         reach: 0.64, tech_cap: 0.72, treaty_tier: 1 },
    LegislativeNode { id: 24, code: "LAWFUL-ETA-025",      category: "lawful_intercept",         reach: 0.61, tech_cap: 0.68, treaty_tier: 1 },
    LegislativeNode { id: 25, code: "LAWFUL-ETA-026",      category: "lawful_intercept",         reach: 0.57, tech_cap: 0.64, treaty_tier: 1 },
    LegislativeNode { id: 26, code: "FINTEL-THETA-027",    category: "financial_intelligence",   reach: 0.70, tech_cap: 0.75, treaty_tier: 1 },
    LegislativeNode { id: 27, code: "FINTEL-THETA-028",    category: "financial_intelligence",   reach: 0.66, tech_cap: 0.71, treaty_tier: 1 },
    LegislativeNode { id: 28, code: "FINTEL-THETA-029",    category: "financial_intelligence",   reach: 0.62, tech_cap: 0.67, treaty_tier: 1 },

    // ── Tier-0: Isolated / Domestic-Only Instruments ─────────────────────────
    LegislativeNode { id: 29, code: "DOM-IOTA-030",        category: "domestic_intercept",       reach: 0.40, tech_cap: 0.50, treaty_tier: 0 },
    LegislativeNode { id: 30, code: "DOM-IOTA-031",        category: "domestic_intercept",       reach: 0.38, tech_cap: 0.45, treaty_tier: 0 },
    LegislativeNode { id: 31, code: "DOM-IOTA-032",        category: "domestic_intercept",       reach: 0.35, tech_cap: 0.42, treaty_tier: 0 },
    LegislativeNode { id: 32, code: "DOM-IOTA-033",        category: "domestic_intercept",       reach: 0.42, tech_cap: 0.48, treaty_tier: 0 },
    LegislativeNode { id: 33, code: "DOM-IOTA-034",        category: "domestic_intercept",       reach: 0.30, tech_cap: 0.38, treaty_tier: 0 },
    LegislativeNode { id: 34, code: "CENSOR-KAPPA-035",    category: "content_filtering",        reach: 0.72, tech_cap: 0.80, treaty_tier: 0 },
    LegislativeNode { id: 35, code: "CENSOR-KAPPA-036",    category: "content_filtering",        reach: 0.68, tech_cap: 0.76, treaty_tier: 0 },
    LegislativeNode { id: 36, code: "CENSOR-KAPPA-037",    category: "content_filtering",        reach: 0.55, tech_cap: 0.60, treaty_tier: 0 },
    LegislativeNode { id: 37, code: "BIOMET-LAMBDA-038",   category: "biometric_collection",     reach: 0.74, tech_cap: 0.88, treaty_tier: 0 },
    LegislativeNode { id: 38, code: "BIOMET-LAMBDA-039",   category: "biometric_collection",     reach: 0.65, tech_cap: 0.78, treaty_tier: 0 },
    LegislativeNode { id: 39, code: "BIOMET-LAMBDA-040",   category: "biometric_collection",     reach: 0.58, tech_cap: 0.70, treaty_tier: 0 },
    LegislativeNode { id: 40, code: "PREDICT-MU-041",      category: "predictive_policing",      reach: 0.60, tech_cap: 0.82, treaty_tier: 0 },
    LegislativeNode { id: 41, code: "PREDICT-MU-042",      category: "predictive_policing",      reach: 0.55, tech_cap: 0.75, treaty_tier: 0 },
    LegislativeNode { id: 42, code: "OSINT-NU-043",        category: "open_source_intelligence", reach: 0.85, tech_cap: 0.60, treaty_tier: 0 },
    LegislativeNode { id: 43, code: "OSINT-NU-044",        category: "open_source_intelligence", reach: 0.80, tech_cap: 0.55, treaty_tier: 0 },
];

const N: usize = 44;

// ── Union-Find for cluster detection ─────────────────────────────────────────

struct UnionFind {
    parent: [usize; N],
    rank:   [u8; N],
    size:   [usize; N],
    active: [bool; N],
}

impl UnionFind {
    fn new() -> Self {
        let mut parent = [0usize; N];
        for i in 0..N { parent[i] = i; }
        Self {
            parent,
            rank:   [0; N],
            size:   [1; N],
            active: [true; N],
        }
    }

    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            self.parent[x] = self.find(self.parent[x]);
        }
        self.parent[x]
    }

    fn union(&mut self, a: usize, b: usize) {
        let ra = self.find(a);
        let rb = self.find(b);
        if ra == rb { return; }
        match self.rank[ra].cmp(&self.rank[rb]) {
            std::cmp::Ordering::Less => {
                self.parent[ra] = rb;
                self.size[rb] += self.size[ra];
            }
            std::cmp::Ordering::Greater => {
                self.parent[rb] = ra;
                self.size[ra] += self.size[rb];
            }
            std::cmp::Ordering::Equal => {
                self.parent[rb] = ra;
                self.size[ra] += self.size[rb];
                self.rank[ra] += 1;
            }
        }
    }

    /// Returns (gcc_size, gcc_root) – giant connected component
    fn gcc(&mut self) -> (usize, usize) {
        // Path-compress all nodes first
        for i in 0..N {
            if self.active[i] { self.find(i); }
        }
        let mut best_size = 0usize;
        let mut best_root = 0usize;
        for i in 0..N {
            if self.active[i] && self.parent[i] == i && self.size[i] > best_size {
                best_size = self.size[i];
                best_root = i;
            }
        }
        (best_size, best_root)
    }

    /// Returns all nodes in the GCC
    fn gcc_members(&mut self) -> Vec<usize> {
        let (_, gcc_root) = self.gcc();
        let mut members = Vec::new();
        for i in 0..N {
            if self.active[i] && self.find(i) == gcc_root {
                members.push(i);
            }
        }
        members
    }

    /// Count distinct clusters
    fn cluster_count(&mut self) -> usize {
        for i in 0..N { if self.active[i] { self.find(i); } }
        let mut count = 0;
        for i in 0..N {
            if self.active[i] && self.parent[i] == i {
                count += 1;
            }
        }
        count
    }
}

// ── Edge probability model ───────────────────────────────────────────────────
// Edge weight between two nodes depends on:
//   - Treaty tier compatibility (same tier or adjacent = higher probability)
//   - Technical capability overlap (similar tech = easier data sharing)
//   - Jurisdictional reach product (broader reach = more sharing surface)
//   - Category affinity (same category = natural sharing partners)

fn edge_probability(a: &LegislativeNode, b: &LegislativeNode) -> f64 {
    // Treaty tier affinity: same tier = 0.7 base, adjacent = 0.4, distant = 0.1
    let tier_diff = (a.treaty_tier as i32 - b.treaty_tier as i32).unsigned_abs();
    let tier_affinity = match tier_diff {
        0 => 0.70,
        1 => 0.40,
        2 => 0.15,
        _ => 0.05,
    };

    // Deep fusion bonus: tier-3 nodes share with each other at very high rates
    let fusion_bonus = if a.treaty_tier == 3 && b.treaty_tier == 3 { 0.25 }
                  else if a.treaty_tier >= 2 && b.treaty_tier >= 2 { 0.10 }
                  else { 0.0 };

    // Technical compatibility: geometric mean of tech capabilities
    let tech_compat = (a.tech_cap * b.tech_cap).sqrt();

    // Reach surface: product of jurisdictional reach values
    let reach_surface = a.reach * b.reach;

    // Category affinity: same category = 1.5x multiplier
    let cat_mult = if a.category == b.category { 1.5 } else { 1.0 };

    // Combined probability: weighted product, clamped to [0, 0.98]
    let raw = (tier_affinity + fusion_bonus) * tech_compat * reach_surface * cat_mult;
    raw.clamp(0.0, 0.98)
}

// ── Contagion step tracker ───────────────────────────────────────────────────

struct ContagionStep {
    step:       usize,
    source:     usize,       // node that transmitted
    target:     usize,       // node that was infected
    edge_prob:  f64,         // probability of this specific edge
    roll:       f64,         // random value that determined infection
    gcc_size:   usize,       // GCC size after this step
    gcc_frac:   f64,         // GCC as fraction of total nodes
}

// ══════════════════════════════════════════════════════════════════════════════
// WASM ENTRY POINT
// ══════════════════════════════════════════════════════════════════════════════

/// Panopticon Percolation Engine – SURVEILLANCE Module v1.0.0
///
/// Monte Carlo simulation of dragnet contagion through 44 indexed
/// surveillance legislative instruments.
///
/// Parameters:
///   infection_prob : global infection probability multiplier (0.1–2.0)
///   origin_node    : patient zero – starting legislative node (0–43)
///   n_simulations  : Monte Carlo ensemble size (1–200)
///   seed           : PRNG seed for reproducibility (any positive integer)
#[wasm_bindgen]
pub fn run_panopticon_percolation(
    infection_prob: f64,
    origin_node:    f64,
    n_simulations:  f64,
    seed:           f64,
) -> String {
    let p_mult  = infection_prob.clamp(0.1, 2.0);
    let origin  = (origin_node as usize).clamp(0, N - 1);
    let n_sims  = (n_simulations as usize).clamp(1, 200);
    let mut rng = (seed as u64).wrapping_add(0xDEAD_BEEF_CAFE_DA7A);

    // ── Pre-compute edge probability matrix ──────────────────────────────────
    let mut edge_probs = [[0.0_f64; N]; N];
    let mut total_edges = 0usize;
    let mut total_edge_weight = 0.0_f64;

    for i in 0..N {
        for j in (i + 1)..N {
            let p = edge_probability(&NODES[i], &NODES[j]) * p_mult;
            let p = p.min(0.99);
            edge_probs[i][j] = p;
            edge_probs[j][i] = p;
            if p > 0.01 {
                total_edges += 1;
                total_edge_weight += p;
            }
        }
    }

    let max_possible_edges = N * (N - 1) / 2;
    let network_density = total_edges as f64 / max_possible_edges as f64;

    // ── Degree statistics for Molloy-Reed criterion ──────────────────────────
    // Expected degree: k_i = Σ_j p(i,j)
    let mut expected_degree = [0.0_f64; N];
    for i in 0..N {
        for j in 0..N {
            if i != j { expected_degree[i] += edge_probs[i][j]; }
        }
    }

    let k_mean: f64 = expected_degree.iter().sum::<f64>() / N as f64;
    let k_sq_mean: f64 = expected_degree.iter().map(|&k| k * k).sum::<f64>() / N as f64;
    let kappa = if k_mean > 1e-9 { k_sq_mean / k_mean } else { 0.0 };
    let pc_theory = if kappa > 1.0 { 1.0 / (kappa - 1.0) } else { 1.0 };

    // ── Monte Carlo ensemble ─────────────────────────────────────────────────
    let mut ensemble_gcc_sizes: Vec<usize> = Vec::with_capacity(n_sims);
    let mut ensemble_steps: Vec<usize> = Vec::with_capacity(n_sims);
    let mut percolated_count = 0usize;

    // Store the detailed trace of the first simulation for display
    let mut trace: Vec<ContagionStep> = Vec::new();
    let mut first_sim_compromised: Vec<usize> = Vec::new();

    for sim in 0..n_sims {
        let mut uf = UnionFind::new();
        let mut infected = [false; N];
        infected[origin] = true;
        let mut frontier: Vec<usize> = vec![origin];
        let mut step_count = 0usize;

        while !frontier.is_empty() {
            let mut next_frontier: Vec<usize> = Vec::new();

            for &source in &frontier {
                for target in 0..N {
                    if infected[target] || source == target { continue; }
                    let p = edge_probs[source][target];
                    if p < 0.001 { continue; }

                    let roll = lcg_next(&mut rng);
                    if roll < p {
                        infected[target] = true;
                        uf.union(source, target);
                        next_frontier.push(target);
                        step_count += 1;

                        // Record trace for first simulation only
                        if sim == 0 {
                            let (gcc_size, _) = uf.gcc();
                            trace.push(ContagionStep {
                                step: step_count,
                                source,
                                target,
                                edge_prob: p,
                                roll,
                                gcc_size,
                                gcc_frac: gcc_size as f64 / N as f64,
                            });
                        }
                    }
                }
            }

            frontier = next_frontier;
        }

        let (gcc_size, _) = uf.gcc();
        ensemble_gcc_sizes.push(gcc_size);
        ensemble_steps.push(step_count);

        if gcc_size as f64 / N as f64 > 0.5 {
            percolated_count += 1;
        }

        if sim == 0 {
            first_sim_compromised = uf.gcc_members();
        }
    }

    // ── Ensemble statistics ──────────────────────────────────────────────────
    let mean_gcc: f64 = ensemble_gcc_sizes.iter().sum::<usize>() as f64 / n_sims as f64;
    let mean_gcc_frac = mean_gcc / N as f64;
    let mean_steps: f64 = ensemble_steps.iter().sum::<usize>() as f64 / n_sims as f64;
    let percolation_rate = percolated_count as f64 / n_sims as f64;

    // Variance of GCC size
    let variance: f64 = ensemble_gcc_sizes.iter()
        .map(|&s| { let d = s as f64 - mean_gcc; d * d })
        .sum::<f64>() / n_sims as f64;
    let std_dev = variance.sqrt();

    // Sovereignty threat assessment
    let threat_pct = (mean_gcc_frac * 100.0).min(100.0);
    let threat_class = if threat_pct > 80.0 {
        "TOTAL EXPOSURE \u{2013} panoptic convergence achieved, sovereign isolation impossible"
    } else if threat_pct > 60.0 {
        "CRITICAL \u{2013} majority of legislative instruments compromised, dragnet viable"
    } else if threat_pct > 40.0 {
        "ELEVATED \u{2013} significant cluster formation, partial dragnet coverage"
    } else if threat_pct > 20.0 {
        "MODERATE \u{2013} isolated clusters persist, targeted extraction only"
    } else {
        "CONTAINED \u{2013} legislative fragmentation limits contagion spread"
    };

    let percolation_status = if percolation_rate > 0.5 {
        "ABOVE THRESHOLD \u{2013} system percolates in majority of simulations"
    } else if percolation_rate > 0.1 {
        "NEAR THRESHOLD \u{2013} system intermittently percolates"
    } else {
        "BELOW THRESHOLD \u{2013} fragmented, giant component does not form"
    };

    // ── Render output ────────────────────────────────────────────────────────
    let mut out = String::with_capacity(6000);
    let line = "\u{2500}".repeat(64);
    let dline = "\u{2550}".repeat(64);

    write!(out,
        "PANOPTICON_PERCOLATION v1.0.0 // SURVEILLANCE MODULE\n\
         {dline}\n\
         DRAGNET CONTAGION SIMULATION \u{2013} MONTE CARLO ENSEMBLE\n\
         {line}\n\n",
        dline = dline, line = line,
    ).unwrap();

    // §1 – Network Topology
    write!(out,
        "\u{00A7}1 NETWORK TOPOLOGY\n\
         {line}\n\
         LEGISLATIVE NODES     : {n}\n\
         ACTIVE EDGES (p>0.01) : {edges} / {max_edges} possible\n\
         NETWORK DENSITY       : {density:.4}\n\
         INFECTION MULTIPLIER  : {p_mult:.2}x\n\
         \u{27E8}k\u{27E9} (mean degree)      : {k_mean:.4}\n\
         \u{27E8}k\u{00B2}\u{27E9}/\u{27E8}k\u{27E9} (\u{03BA})         : {kappa:.4}\n\
         p_c (Molloy-Reed)     : {pc:.6}\n\
         ORIGIN NODE           : [{origin}] {origin_code}\n\n\
         TIER DISTRIBUTION:\n\
           TIER-3 (deep fusion)   : {t3} nodes\n\
           TIER-2 (multilateral)  : {t2} nodes\n\
           TIER-1 (bilateral)     : {t1} nodes\n\
           TIER-0 (isolated)      : {t0} nodes\n",
        line = line,
        n = N, edges = total_edges, max_edges = max_possible_edges,
        density = network_density, p_mult = p_mult,
        k_mean = k_mean, kappa = kappa, pc = pc_theory,
        origin = origin, origin_code = NODES[origin].code,
        t3 = NODES.iter().filter(|n| n.treaty_tier == 3).count(),
        t2 = NODES.iter().filter(|n| n.treaty_tier == 2).count(),
        t1 = NODES.iter().filter(|n| n.treaty_tier == 1).count(),
        t0 = NODES.iter().filter(|n| n.treaty_tier == 0).count(),
    ).unwrap();

    // §2 – Contagion Trace (first simulation)
    write!(out, "\n\
         \u{00A7}2 CONTAGION TRACE (simulation 1 of {n_sims})\n\
         {line}\n\
         STEP  SOURCE                  \u{2192}  TARGET                   p_EDGE   ROLL     GCC\n",
        n_sims = n_sims, line = line,
    ).unwrap();

    let max_trace_lines = 30;
    for (i, step) in trace.iter().enumerate() {
        if i >= max_trace_lines { break; }
        let src_code = NODES[step.source].code;
        let tgt_code = NODES[step.target].code;
        let infected_marker = if step.gcc_frac > 0.5 { " \u{25C4} PERCOLATED" } else { "" };

        write!(out,
            "  {:>3}  [{:>2}] {:<20}  \u{2192}  [{:>2}] {:<20}  {:.4}   {:.4}   {:>2}/{}{}\n",
            step.step,
            step.source, src_code,
            step.target, tgt_code,
            step.edge_prob, step.roll,
            step.gcc_size, N,
            infected_marker,
        ).unwrap();
    }

    if trace.len() > max_trace_lines {
        write!(out, "  ... ({} additional contagion steps omitted)\n",
            trace.len() - max_trace_lines,
        ).unwrap();
    }

    // §3 – Compromised Nodes (first simulation)
    write!(out, "\n\
         \u{00A7}3 COMPROMISED NODES (simulation 1)\n\
         {line}\n\
         TOTAL COMPROMISED : {comp} / {n} ({comp_pct:.1}%)\n\n\
         NODE  CODE                     CATEGORY                 TIER  REACH\n",
        line = line,
        comp = first_sim_compromised.len(), n = N,
        comp_pct = first_sim_compromised.len() as f64 / N as f64 * 100.0,
    ).unwrap();

    for &idx in &first_sim_compromised {
        let node = &NODES[idx];
        let tier_label = match node.treaty_tier {
            3 => "T3-FUSION",
            2 => "T2-MULTI ",
            1 => "T1-BILAT ",
            _ => "T0-ISOL  ",
        };
        write!(out, "  [{:>2}]  {:<24} {:<24} {}  {:.2}\n",
            node.id, node.code, node.category, tier_label, node.reach,
        ).unwrap();
    }

    // Uncompromised nodes
    let uncompromised: Vec<usize> = (0..N)
        .filter(|i| !first_sim_compromised.contains(i))
        .collect();
    if !uncompromised.is_empty() {
        write!(out, "\n  SOVEREIGN (uncompromised): {}\n",
            uncompromised.iter()
                .map(|&i| format!("[{}]", i))
                .collect::<Vec<_>>()
                .join(" "),
        ).unwrap();
    }

    // §4 – Monte Carlo Ensemble Results
    write!(out, "\n\
         \u{00A7}4 MONTE CARLO ENSEMBLE (n = {n_sims})\n\
         {line}\n\
         MEAN GCC SIZE        : {mean_gcc:.2} / {n} ({mean_pct:.1}%)\n\
         STD DEV              : {std:.2}\n\
         MEAN CONTAGION STEPS : {mean_steps:.1}\n\
         PERCOLATION RATE     : {perc_rate:.4} ({perc_count}/{n_sims} simulations)\n\
         PERCOLATION STATUS   : {perc_status}\n",
        n_sims = n_sims, line = line,
        mean_gcc = mean_gcc, n = N,
        mean_pct = mean_gcc_frac * 100.0,
        std = std_dev,
        mean_steps = mean_steps,
        perc_rate = percolation_rate,
        perc_count = percolated_count,
        perc_status = percolation_status,
    ).unwrap();

    // GCC distribution histogram
    write!(out, "\n  GCC SIZE DISTRIBUTION:\n").unwrap();
    let mut histogram = [0usize; 5]; // [0-20%, 20-40%, 40-60%, 60-80%, 80-100%]
    for &gcc in &ensemble_gcc_sizes {
        let pct = gcc as f64 / N as f64;
        let bin = ((pct * 5.0).floor() as usize).min(4);
        histogram[bin] += 1;
    }
    let bin_labels = ["  0\u{2013}20%", " 20\u{2013}40%", " 40\u{2013}60%", " 60\u{2013}80%", "80\u{2013}100%"];
    let max_bar = *histogram.iter().max().unwrap_or(&1);
    for (i, &count) in histogram.iter().enumerate() {
        let bar_len = if max_bar > 0 { (count * 30) / max_bar } else { 0 };
        write!(out, "  {}: {}{} {}\n",
            bin_labels[i],
            "\u{2588}".repeat(bar_len),
            "\u{2591}".repeat(30 - bar_len),
            count,
        ).unwrap();
    }

    // §5 – Sovereignty Threat Assessment
    write!(out, "\n\
         \u{00A7}5 SOVEREIGNTY THREAT ASSESSMENT\n\
         {dline}\n",
        dline = dline,
    ).unwrap();

    // Threat bar
    let threat_bar_width = 40;
    let threat_fill = ((threat_pct / 100.0) * threat_bar_width as f64).round() as usize;
    let threat_fill = threat_fill.min(threat_bar_width);
    write!(out,
        "  THREAT LEVEL : {pct:.1}%\n\
           [{bar}{empty}]\n\
           CLASS         : {class}\n",
        pct = threat_pct,
        bar = "\u{2588}".repeat(threat_fill),
        empty = "\u{2591}".repeat(threat_bar_width - threat_fill),
        class = threat_class,
    ).unwrap();

    // Tier-level exposure breakdown
    let tier_exposure = |tier: u8| -> f64 {
        let total = NODES.iter().filter(|n| n.treaty_tier == tier).count();
        if total == 0 { return 0.0; }
        let compromised = first_sim_compromised.iter()
            .filter(|&&i| NODES[i].treaty_tier == tier)
            .count();
        compromised as f64 / total as f64 * 100.0
    };

    write!(out, "\n\
         EXPOSURE BY TIER:\n\
           TIER-3 (deep fusion)   : {t3:.0}%\n\
           TIER-2 (multilateral)  : {t2:.0}%\n\
           TIER-1 (bilateral)     : {t1:.0}%\n\
           TIER-0 (isolated)      : {t0:.0}%\n",
        t3 = tier_exposure(3),
        t2 = tier_exposure(2),
        t1 = tier_exposure(1),
        t0 = tier_exposure(0),
    ).unwrap();

    // Footer
    write!(out,
        "\n{dline}\n\
         THEORY   : Broadbent & Hammersley (1957) \u{2013} percolation processes\n\
         CRITICAL : Molloy & Reed (1995) \u{2013} giant component criterion\n\
         CONTEXT  : Foucault (1975) \u{2013} Surveiller et punir, panoptic architecture\n\
         CONTEXT  : Stauffer & Aharony (1994) \u{2013} Introduction to Percolation Theory\n\
         SOURCE   : content/rust_kernels/src/kernels/panopticon_percolation.rs",
        dline = dline,
    ).unwrap();

    out
}
