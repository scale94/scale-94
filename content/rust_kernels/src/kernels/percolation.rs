// kernels/percolation.rs — Network Percolation / Resilience Kernel
//
// Models a random network (Erdős–Rényi G(N,p)) under progressive node removal.
// Uses Union-Find (path compression + union by rank) to track the giant
// connected component (GCC) after each removal step.
//
// Two attack modes:
//   0 = random failure   — nodes removed uniformly at random
//   1 = targeted attack  — highest-degree nodes removed first (hub disruption)
//
// Molloy-Reed critical threshold:
//   κ = ⟨k²⟩/⟨k⟩
//   f_c = 1 − 1/(κ − 1)
//
//   Below f_c: giant component survives.
//   Above f_c: network shatters into isolated fragments.
//
// Thematic context: surveillance pressure · habitat fragmentation · commons collapse

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// ── Union-Find with path compression + union by rank ─────────────────────────

struct UnionFind {
    parent: Vec<usize>,
    rank:   Vec<u8>,
    size:   Vec<usize>,
    active: Vec<bool>,
}

impl UnionFind {
    fn new(n: usize) -> Self {
        Self {
            parent: (0..n).collect(),
            rank:   vec![0; n],
            size:   vec![1; n],
            active: vec![true; n],
        }
    }

    fn find(&mut self, x: usize) -> usize {
        if self.parent[x] != x {
            self.parent[x] = self.find(self.parent[x]); // path compression
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

    /// Fraction of active nodes in the largest connected component.
    fn gcc_fraction(&mut self, active_count: usize) -> f64 {
        if active_count == 0 { return 0.0; }
        // Path-compress all active nodes first, then read sizes — avoids dual borrow.
        let n = self.parent.len();
        for i in 0..n {
            if self.active[i] { self.find(i); }
        }
        let mut max_size = 0usize;
        for i in 0..n {
            if self.active[i] && self.parent[i] == i && self.size[i] > max_size {
                max_size = self.size[i];
            }
        }
        max_size as f64 / active_count as f64
    }
}

// ── Kernel entry point ────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn run_percolation(
    n_nodes:       f64,
    mean_degree:   f64,
    attack_mode:   f64,
    removal_steps: f64,
) -> String {
    let n        = (n_nodes as usize).clamp(20, 1000);
    let k_mean   = mean_degree.clamp(1.0, 20.0);
    let targeted = (attack_mode as usize) >= 1;
    let steps    = (removal_steps as usize).clamp(5, 40);

    // Edge probability: p = ⟨k⟩ / (N − 1)
    let p_edge = k_mean / (n as f64 - 1.0).max(1.0);

    // Deterministic LCG seed from parameters
    let mut rng: u64 = ((n_nodes * 1_000_003.0) as u64)
        .wrapping_add((mean_degree * 999_961.0) as u64)
        .wrapping_add(0xDEAD_BEEF_C0DE_1337);

    // ── Build adjacency list (Erdős–Rényi G(N,p)) ────────────────────────────
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    let mut edge_count = 0usize;
    for i in 0..n {
        for j in (i + 1)..n {
            if lcg_next(&mut rng) < p_edge {
                adj[i].push(j);
                adj[j].push(i);
                edge_count += 1;
            }
        }
    }

    let actual_k: f64 = (2 * edge_count) as f64 / n as f64;

    // Degree sequence
    let degrees: Vec<usize> = adj.iter().map(|a| a.len()).collect();

    // Molloy-Reed κ = ⟨k²⟩ / ⟨k⟩
    let k1: f64 = degrees.iter().sum::<usize>() as f64 / n as f64;
    let k2: f64 = degrees.iter().map(|&d| d * d).sum::<usize>() as f64 / n as f64;
    let kappa    = if k1 > 1e-9 { k2 / k1 } else { 0.0 };
    let fc_theory = if kappa > 1.0 {
        (1.0 - 1.0 / (kappa - 1.0)).clamp(0.0, 1.0)
    } else {
        0.0
    };

    // ── Removal order ─────────────────────────────────────────────────────────
    let removal_order: Vec<usize> = if targeted {
        // Targeted: highest-degree nodes first (hub disruption)
        let mut idx: Vec<usize> = (0..n).collect();
        idx.sort_unstable_by(|&a, &b| degrees[b].cmp(&degrees[a]));
        idx
    } else {
        // Random failure: Fisher-Yates shuffle via LCG
        let mut idx: Vec<usize> = (0..n).collect();
        for i in (1..n).rev() {
            let j = (lcg_next(&mut rng) * (i + 1) as f64) as usize % (i + 1);
            idx.swap(i, j);
        }
        idx
    };

    // ── Snapshot schedule: evenly spaced removal fractions 0 → 1 ─────────────
    let snap_fracs: Vec<f64> = (0..=steps)
        .map(|i| i as f64 / steps as f64)
        .collect();

    // (removal_fraction, gcc_fraction, active_count)
    let mut snapshots: Vec<(f64, f64, usize)> = Vec::with_capacity(steps + 1);

    for &frac in &snap_fracs {
        let n_removed    = ((frac * n as f64).round() as usize).min(n);
        let active_count = n - n_removed;

        // Mark removed nodes in a bool array — O(n_removed) per step
        let mut is_removed = vec![false; n];
        for &node in &removal_order[..n_removed] {
            is_removed[node] = true;
        }

        // Rebuild union-find from remaining active nodes — O(n + edges)
        let mut uf = UnionFind::new(n);
        for i in 0..n {
            if is_removed[i] {
                uf.active[i] = false;
                continue;
            }
            for &j in &adj[i] {
                if !is_removed[j] {
                    uf.union(i, j);
                }
            }
        }

        let gcc = uf.gcc_fraction(active_count);
        snapshots.push((frac, gcc, active_count));
    }

    // ── Empirical critical point: first crossing where GCC < 0.5 ─────────────
    let fc_empirical = snapshots.windows(2)
        .find(|w| w[0].1 >= 0.5 && w[1].1 < 0.5)
        .map(|w| (w[0].0 + w[1].0) / 2.0)
        .unwrap_or_else(|| {
            // If never crossed 0.5, return the point of steepest drop
            snapshots.windows(2)
                .max_by(|a, b| {
                    let da = a[0].1 - a[1].1;
                    let db = b[0].1 - b[1].1;
                    da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|w| (w[0].0 + w[1].0) / 2.0)
                .unwrap_or(fc_theory)
        });

    let mode_str  = if targeted { "TARGETED ATTACK (hub-first)" } else { "RANDOM FAILURE" };
    let fc_pct    = (fc_empirical * 100.0).round() as usize;

    let verdict = if targeted {
        if fc_empirical < 0.15 {
            "HIGHLY FRAGILE under targeted attack — hub removal shatters the network early"
        } else if fc_empirical < 0.30 {
            "FRAGILE under targeted attack — remove key nodes, the commons collapses"
        } else {
            "MODERATE RESILIENCE — scale-free structure provides some hub redundancy"
        }
    } else {
        if fc_empirical > 0.55 {
            "HIGH RESILIENCE — random failures must remove majority before network shatters"
        } else if fc_empirical > 0.30 {
            "MODERATE RESILIENCE — critical threshold reachable but not easily"
        } else {
            "FRAGILE — even random failures trigger early collapse"
        }
    };

    // ── ASCII bar renderer (24 chars) ─────────────────────────────────────────
    let bar = |r: f64| -> String {
        let filled = ((r * 24.0).round() as usize).min(24);
        let mut s  = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    // ── Format output ─────────────────────────────────────────────────────────
    let mut out = String::with_capacity(1600);

    write!(out,
        "PERCOLATION_KERNEL v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════════\n\
         NETWORK  : Erdős–Rényi G({n}, p={p:.4})\n\
         NODES    : {n}   EDGES : {e}   ⟨k⟩ : {k:.3}\n\
         ATTACK   : {mode}\n\
         ──────────────────────────────────────────────\n\
         MOLLOY-REED CRITERION\n\
           κ = ⟨k²⟩/⟨k⟩     = {kap:.4}\n\
           f_c (theory)    = 1 − 1/(κ−1) = {fc_t:.4}\n\
           f_c (observed)  ≈ {fc_e:.4}  ({fc_pct}% nodes removed)\n\
         ──────────────────────────────────────────────\n\
         GIANT COMPONENT FRACTION S(f) vs REMOVAL FRACTION f\n\
         [1.0 = network intact · 0.0 = fully shattered]\n",
        n = n, p = p_edge, e = edge_count, k = actual_k,
        mode = mode_str, kap = kappa,
        fc_t = fc_theory, fc_e = fc_empirical, fc_pct = fc_pct,
    ).unwrap();

    for &(f, gcc, active) in &snapshots {
        let near_critical = (f - fc_empirical).abs() < (0.6 / steps as f64);
        let marker = if near_critical { " ◄ CRITICAL" } else { "" };
        write!(out,
            "  f={:.3}  N={:>4}  S={:.4}  {}{}\n",
            f, active, gcc, bar(gcc), marker,
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────\n\
         VERDICT  : {verdict}\n\
         f_c ≈ {fc_e:.4} — giant component collapses above this removal fraction\n\
         ──────────────────────────────────────────────\n\
         THEORY   : Erdős & Rényi (1960) · Molloy & Reed (1995)\n\
         CONTEXT  : surveillance pressure · habitat fragmentation · commons collapse\n\
         SOURCE   : content/rust_kernels/src/kernels/percolation.rs",
        verdict = verdict, fc_e = fc_empirical,
    ).unwrap();

    out
}
