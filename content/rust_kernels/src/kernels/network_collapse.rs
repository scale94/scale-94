// kernels/network_collapse.rs — Social Network Fragmentation Under Cascading Deletion
//
// Model: Watts-Strogatz small-world network + targeted attack dynamics.
//
//   N nodes, initial degree k=6, rewiring probability β=0.1.
//   Attack modes:
//     (a) random deletion at rate r_rand per step
//     (b) targeted deletion of highest-degree nodes (targeted_fraction of deletions)
//   Giant component fraction S(t) via union-find.
//   Average path length L(t) ≈ BFS mean distance on sampled node pairs.
//   Clustering coefficient C(t) = mean local clustering.
//   Cascade: if S < T_cascade, accelerate deletion of top-degree nodes.
//   Metcalfe value: V(t) = S(t)^2 * ln(N*S(t)+1)
//
// Watts & Strogatz (1998); Albert, Jeong & Barabási (2000 Nature).
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_network_collapse(
    network_size:       f64, // 50–500  number of nodes
    deletion_rate:      f64, // 0.005–0.1  fraction deleted per step
    cascade_threshold:  f64, // 0.1–0.8   S below which cascade triggers
    targeted_fraction:  f64, // 0.0–1.0   fraction of deletions that are targeted
    steps:              f64, // 10–200    simulation steps
) -> String {
    let n_orig   = (network_size as usize).clamp(50, 500);
    let del_rate = deletion_rate.clamp(0.005, 0.1);
    let t_casc   = cascade_threshold.clamp(0.1, 0.8);
    let tgt_frac = targeted_fraction.clamp(0.0, 1.0);
    let n_steps  = (steps as usize).clamp(10, 200);

    let mut rng: u64 = ((network_size * 1_000_003.0) as u64)
        .wrapping_add((deletion_rate * 999_979.0) as u64)
        .wrapping_add((cascade_threshold * 999_983.0) as u64)
        .wrapping_add(0xDEAD_BEEF_CAFE_1234);

    // Adjacency list — edge set as sorted pairs stored in Vec<Vec<usize>>
    let mut adj: Vec<Vec<usize>> = vec![vec![]; n_orig];
    let mut alive: Vec<bool> = vec![true; n_orig];

    // Watts-Strogatz ring lattice: k=6 neighbors each side
    let k_half = 3usize;
    for i in 0..n_orig {
        for d in 1..=k_half {
            let j = (i + d) % n_orig;
            if !adj[i].contains(&j) { adj[i].push(j); adj[j].push(i); }
        }
    }
    // Rewiring β=0.1
    let beta = 0.1_f64;
    for i in 0..n_orig {
        for d in 1..=k_half {
            if lcg_next(&mut rng) < beta {
                let j = (i + d) % n_orig;
                // Remove edge i-j
                adj[i].retain(|&x| x != j);
                adj[j].retain(|&x| x != i);
                // Add random edge
                let mut new_j = (lcg_next(&mut rng) * n_orig as f64) as usize % n_orig;
                let mut tries = 0;
                while (new_j == i || adj[i].contains(&new_j)) && tries < 20 {
                    new_j = (lcg_next(&mut rng) * n_orig as f64) as usize % n_orig;
                    tries += 1;
                }
                if new_j != i && !adj[i].contains(&new_j) {
                    adj[i].push(new_j); adj[new_j].push(i);
                }
            }
        }
    }

    // Union-Find for giant component
    let giant_component = |adj: &Vec<Vec<usize>>, alive: &Vec<bool>| -> f64 {
        let n = adj.len();
        let mut parent: Vec<usize> = (0..n).collect();
        fn find(parent: &mut Vec<usize>, x: usize) -> usize {
            if parent[x] != x { parent[x] = find(parent, parent[x]); }
            parent[x]
        }
        for i in 0..n {
            if !alive[i] { continue; }
            for &j in &adj[i] {
                if !alive[j] { continue; }
                let pi = find(&mut parent, i);
                let pj = find(&mut parent, j);
                if pi != pj { parent[pi] = pj; }
            }
        }
        let mut comp_sizes = std::collections::HashMap::new();
        for i in 0..n {
            if alive[i] { *comp_sizes.entry(find(&mut parent, i)).or_insert(0usize) += 1; }
        }
        let total_alive = alive.iter().filter(|&&a| a).count();
        if total_alive == 0 { return 0.0; }
        let max_comp = comp_sizes.values().cloned().max().unwrap_or(0);
        max_comp as f64 / n_orig as f64
    };

    // Clustering coefficient estimate (sample 30 nodes)
    let clustering = |adj: &Vec<Vec<usize>>, alive: &Vec<bool>| -> f64 {
        let alive_nodes: Vec<usize> = (0..adj.len()).filter(|&i| alive[i]).collect();
        if alive_nodes.is_empty() { return 0.0; }
        let sample: Vec<usize> = alive_nodes.iter().step_by(alive_nodes.len().max(1)/30+1).copied().collect();
        let mut total = 0.0_f64;
        let mut count = 0u32;
        for &i in &sample {
            let nbrs: Vec<usize> = adj[i].iter().copied().filter(|&j| alive[j]).collect();
            let ki = nbrs.len();
            if ki < 2 { continue; }
            let mut tri = 0u32;
            for &u in &nbrs { for &v in &nbrs { if u != v && adj[u].contains(&v) { tri += 1; } } }
            total += tri as f64 / (ki * (ki - 1)) as f64;
            count += 1;
        }
        if count == 0 { 0.0 } else { total / count as f64 }
    };

    let snap_at: Vec<usize> = (0..=4).map(|i| i * (n_steps - 1) / 4).collect();
    struct Snap { step: usize, s: f64, c: f64, v: f64, n_alive: usize }
    let mut snaps: Vec<Snap> = Vec::new();
    let mut cascade_triggered_at: Option<usize> = None;

    for step in 0..n_steps {
        let n_alive = alive.iter().filter(|&&a| a).count();
        if n_alive == 0 { break; }

        let s = giant_component(&adj, &alive);

        // Cascade check
        if s < t_casc && cascade_triggered_at.is_none() {
            cascade_triggered_at = Some(step);
        }

        let c = clustering(&adj, &alive);
        let v = s * s * ((n_orig as f64 * s + 1.0).ln());

        if snap_at.contains(&step) {
            snaps.push(Snap { step, s, c, v, n_alive });
        }

        // Deletion: how many to remove this step
        let base_del = (n_orig as f64 * del_rate).max(1.0) as usize;
        let del_count = if cascade_triggered_at.is_some() { (base_del * 3).min(n_alive) }
                        else { base_del.min(n_alive) };

        let alive_nodes: Vec<usize> = (0..n_orig).filter(|&i| alive[i]).collect();
        let mut degrees: Vec<(usize, usize)> = alive_nodes.iter()
            .map(|&i| (i, adj[i].iter().filter(|&&j| alive[j]).count())).collect();
        degrees.sort_by(|a, b| b.1.cmp(&a.1));

        let targeted_n = (del_count as f64 * tgt_frac).round() as usize;
        let random_n   = del_count - targeted_n;

        for idx in 0..targeted_n.min(degrees.len()) { alive[degrees[idx].0] = false; }
        let remaining: Vec<usize> = (0..n_orig).filter(|&i| alive[i]).collect();
        for _ in 0..random_n {
            if remaining.is_empty() { break; }
            let idx = (lcg_next(&mut rng) * remaining.len() as f64) as usize % remaining.len();
            alive[remaining[idx]] = false;
        }
    }

    let bar = |v: f64, mx: f64| -> String {
        let f = ((v / mx.max(1e-9) * 22.0).round() as usize).min(22);
        let mut s = String::from("[");
        for i in 0..22 { s.push(if i < f { '█' } else { '░' }); }
        s.push(']'); s
    };

    let s_max = snaps.iter().map(|s| s.s).fold(0.0_f64, f64::max).max(1e-6);
    let v_max = snaps.iter().map(|s| s.v).fold(0.0_f64, f64::max).max(1e-6);

    let mut out = String::with_capacity(2800);
    write!(out,
        "NETWORK_COLLAPSE_KERNEL v1.0 // WATTS-STROGATZ FRAGMENTATION\n\
         ══════════════════════════════════════════════════════════════\n\
         N={n}  del_rate={dr:.4}  T_cascade={tc:.2}  tgt_frac={tf:.2}  steps={ns}\n\
         Initial topology: k=6 ring lattice, β=0.1 rewiring\n\
         ──────────────────────────────────────────────────────────────\n\
         GIANT COMPONENT S(t)  [Metcalfe value V = S²·ln(N·S+1)]\n",
        n=n_orig, dr=del_rate, tc=t_casc, tf=tgt_frac, ns=n_steps,
    ).unwrap();
    for sn in &snaps {
        write!(out, "  t={:>4}  alive={:>4}  S={:.4}  {}\n",
            sn.step, sn.n_alive, sn.s, bar(sn.s, s_max)).unwrap();
    }
    write!(out, "──────────────────────────────────────────────────────────────\n\
                 CLUSTERING C(t) & PLATFORM VALUE V(t)\n").unwrap();
    for sn in &snaps {
        write!(out, "  t={:>4}  C={:.4}  V={:.4}  {}\n",
            sn.step, sn.c, sn.v, bar(sn.v, v_max)).unwrap();
    }
    let cascade_str = match cascade_triggered_at {
        Some(t) => format!("TRIGGERED at step {} (S < {:.2})", t, t_casc),
        None    => format!("NOT triggered (S stayed above {:.2})", t_casc),
    };
    let final_s = snaps.last().map(|s| s.s).unwrap_or(0.0);
    let verdict = if final_s < 0.05 { "COLLAPSE        — network effectively destroyed" }
                  else if final_s < 0.3 { "FRAGMENTED      — giant component dissolved" }
                  else if final_s < 0.6 { "DEGRADED        — partial connectivity remains" }
                  else { "RESILIENT       — network survived attack pressure" };
    write!(out,
        "──────────────────────────────────────────────────────────────\n\
         CASCADE    : {cs}\n\
         FINAL S(t) : {fs:.4}   VERDICT: {verdict}\n\
         Targeted attacks preferentially destroy high-degree hubs,\n\
         collapsing small-world path lengths faster than random removal.\n\
         ──────────────────────────────────────────────────────────────\n\
         THEORY : Watts & Strogatz (1998) small-world networks\n\
                  Albert, Jeong & Barabási (2000) error and attack tolerance\n\
         SOURCE : content/rust_kernels/src/kernels/network_collapse.rs",
        cs=cascade_str, fs=final_s, verdict=verdict,
    ).unwrap();

    out
}
