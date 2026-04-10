// kernels/bridge_kernel.rs — Structural Holes & Betweenness Centrality
//
// Random graph G(N,p) generated via Erdos-Renyi model.
// Bridge detection: edges whose removal increases connected components (DFS).
// Burt's constraint: C_i = sum_j (p_ij + sum_q p_iq*p_qj)^2
//   where p_ij = w_ij / sum_k w_ik (proportional tie strength).
// Structural hole density: H = 1 - mean(C_i).
// Betweenness approximation: BFS from s random sources; fraction of paths through v.
//
// Burt (1992) Structural Holes; Freeman (1977); Granovetter (1973)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_bridge_kernel(
    n_nodes:       f64,  // 10–80 nodes
    edge_density:  f64,  // 0.1–0.8 edge probability p
    bridge_strength: f64, // 0.5–3.0 weight multiplier for bridge edges
    samples:       f64,  // 5–30 betweenness sample paths per node
    threshold:     f64,  // 0.3–0.9 bridge detection threshold
) -> String {
    let n      = (n_nodes as usize).clamp(10, 80);
    let p      = edge_density.clamp(0.1, 0.8);
    let b_str  = bridge_strength.clamp(0.5, 3.0);
    let s_cnt  = (samples as usize).clamp(5, 30);
    let thresh = threshold.clamp(0.3, 0.9);

    let mut rng: u64 = ((n_nodes * 1_000_003.0) as u64)
        .wrapping_add((edge_density    * 999_979.0) as u64)
        .wrapping_add((bridge_strength * 999_983.0) as u64)
        .wrapping_add(0xBEEF_CAFE_1234);

    // Adjacency & weights
    let mut adj = vec![vec![false; n]; n];
    let mut w   = vec![vec![0.0_f64; n]; n];
    let mut edge_count = 0usize;
    for i in 0..n { for j in (i+1)..n {
        if lcg_next(&mut rng) < p {
            adj[i][j] = true; adj[j][i] = true;
            let wt = 0.5 + lcg_next(&mut rng) * b_str;
            w[i][j] = wt; w[j][i] = wt;
            edge_count += 1;
        }
    }}

    // BFS component counter: returns number of connected components after edge (u,v) removed
    let bfs_components = |removed_u: usize, removed_v: usize| -> usize {
        let mut visited = vec![false; n];
        let mut components = 0usize;
        for start in 0..n {
            if visited[start] { continue; }
            components += 1;
            let mut queue = std::collections::VecDeque::new();
            queue.push_back(start);
            visited[start] = true;
            while let Some(v) = queue.pop_front() {
                for u in 0..n {
                    if adj[v][u] && !visited[u]
                        && !((v==removed_u && u==removed_v) || (v==removed_v && u==removed_u))
                    {
                        visited[u] = true;
                        queue.push_back(u);
                    }
                }
            }
        }
        components
    };

    // Baseline component count (pass n as sentinel — no edge removed)
    let base_components = bfs_components(n, n);

    // Bridge detection
    let mut bridges: Vec<(usize, usize)> = Vec::new();
    for i in 0..n { for j in (i+1)..n {
        if adj[i][j] && bfs_components(i, j) > base_components {
            bridges.push((i, j));
        }
    }}

    // Burt constraint for each node
    let mut constraints = vec![0.0_f64; n];
    for i in 0..n {
        let w_sum: f64 = (0..n).map(|j| w[i][j]).sum();
        if w_sum < 1e-9 { constraints[i] = 1.0; continue; }
        let p_i: Vec<f64> = (0..n).map(|j| w[i][j] / w_sum).collect();
        let mut ci = 0.0_f64;
        for j in 0..n {
            if !adj[i][j] { continue; }
            let indirect: f64 = (0..n).filter(|&q| adj[i][q] && q != j)
                .map(|q| {
                    let wq_sum: f64 = (0..n).map(|k| w[q][k]).sum::<f64>().max(1e-9);
                    p_i[q] * if adj[q][j] { w[q][j] / wq_sum } else { 0.0 }
                })
                .sum();
            ci += (p_i[j] + indirect).powi(2);
        }
        constraints[i] = ci.min(1.0);
    }
    let hole_density = 1.0 - constraints.iter().sum::<f64>() / n as f64;

    // Betweenness approximation via BFS
    let mut betweenness = vec![0.0_f64; n];
    for _ in 0..s_cnt {
        let src = (lcg_next(&mut rng) * n as f64) as usize % n;
        let dst = (lcg_next(&mut rng) * n as f64) as usize % n;
        if src == dst { continue; }
        // BFS shortest path with predecessor tracking
        let mut dist_arr = vec![usize::MAX; n];
        let mut pred = vec![n; n];
        let mut queue = std::collections::VecDeque::new();
        dist_arr[src] = 0; queue.push_back(src);
        while let Some(v) = queue.pop_front() {
            for u in 0..n {
                if adj[v][u] && dist_arr[u] == usize::MAX {
                    dist_arr[u] = dist_arr[v] + 1;
                    pred[u] = v;
                    queue.push_back(u);
                }
            }
        }
        // Trace path and increment betweenness of interior nodes
        if dist_arr[dst] != usize::MAX {
            let mut cur = dst;
            while pred[cur] != n && pred[cur] != src {
                betweenness[pred[cur]] += 1.0;
                cur = pred[cur];
            }
        }
    }
    let max_between = betweenness.iter().cloned().fold(0.0_f64, f64::max).max(1.0);
    let norm_between: Vec<f64> = betweenness.iter().map(|&b| b / max_between).collect();

    // Top-5 bridge nodes by betweenness
    let mut ranked: Vec<(usize, f64, f64)> = (0..n)
        .map(|i| (i, norm_between[i], constraints[i]))
        .collect();
    ranked.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap());
    let bridge_premium: Vec<f64> = ranked.iter().take(5)
        .map(|(_, _, c)| (1.0 / c.max(0.01)).ln()).collect();

    let mut out = String::with_capacity(1400);
    write!(out,
        "BRIDGE_KERNEL v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         N = {n}   p_edge = {p:.3}   edges = {ec}   bridge_str = {bs:.2}\n\
         samples = {sc}   threshold = {thresh:.3}\n\
         ------------------------------------------\n\
         BRIDGE EDGES (removal increases components):\n\
           count = {bc}   base_components = {bcomp}\n",
        n=n, p=p, ec=edge_count, bs=b_str, sc=s_cnt, thresh=thresh,
        bc=bridges.len(), bcomp=base_components,
    ).unwrap();
    for (u,v) in bridges.iter().take(5) {
        write!(out, "  ({u} -- {v})\n").unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         TOP-5 BRIDGE NODES (by betweenness):\n\
           node  |  betweenness  constraint  bridge_premium\n").unwrap();
    for (i, (node, bw, cn)) in ranked.iter().take(5).enumerate() {
        write!(out, "  {:>4}  |    {:.4}      {:.4}       {:.4}\n",
            node, bw, cn, bridge_premium[i]).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         STRUCTURAL HOLE DENSITY H = {hd:.4}  (0=closed · 1=open)\n\
         MEAN CONSTRAINT          C = {mc:.4}\n\
         THEORY : Burt (1992) Structural Holes; Freeman (1977); Granovetter (1973)\n\
         SOURCE : content/rust_kernels/src/kernels/bridge_kernel.rs",
        hd=hole_density, mc=1.0-hole_density,
    ).unwrap();
    out
}
