// kernels/associative_field.rs — Hopfield Associative Field v1.0
//
// 25-node continuous Hopfield attractor network over the SOMA-9.4 kernel graph.
// Weight matrix W = adjacency matrix of the kernel co-activation graph (EDGES
// from ArtTab.jsx). Given a seed node, finds which attractor basin it belongs
// to — revealing which kernels are conceptually co-active by pure structure.
//
// Dynamics (Cohen-Grossberg 1983, continuous-time Hopfield):
//   V_i(t+1) = tanh(β · Σ_j W_ij · V_j(t))
//   Energy:  E = -½ Σ_ij W_ij V_i V_j
//
// Theory:
//   Hopfield (1982) — Neural networks and physical systems, PNAS 79
//   Cohen & Grossberg (1983) — Absolute stability of learning, IEEE TMC 13
//   Amit, Gutfreund & Sompolinsky (1985) — Spin-glass models of neural networks, PRL 55

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

const N: usize = 25;

// Node order MUST match NODES array in src/terminal/views/ArtTab.jsx exactly.
const NODE_LABELS: [&str; N] = [
    "biocoenosis",  // 0  eco
    "atmospheric",  // 1  eco
    "chrono",       // 2  eco
    "daly",         // 3  eco
    "replicator",   // 4  eco
    "grayscott",    // 5  eco
    "kuramoto",     // 6  sync
    "ceei",         // 7  sync
    "soma91",       // 8  sync
    "soma_plus",    // 9  sync
    "leviathan",    // 10 sync
    "cynic",        // 11 sync
    "feigenbaum",   // 12 phys
    "ising",        // 13 phys
    "bosonic",      // 14 phys
    "seraphine",    // 15 phys
    "fusion",       // 16 phys
    "classified",   // 17 crypto
    "pqhash",       // 18 crypto
    "dh_ec",        // 19 crypto
    "pragmatic",    // 20 drk
    "soma_kernel",  // 21 drk
    "strangler",    // 22 drk
    "surveillance", // 23 drk
    "necromantic",  // 24 drk
];

// Adjacency list — mirrors EDGES in ArtTab.jsx (both symmetric directions added below)
const EDGE_LIST: &[(usize, usize)] = &[
    // eco internal
    (0, 4), (0, 5), (3, 2), (3, 1), (2, 1),
    // sync internal
    (6, 7), (6, 8), (8, 9), (8, 10), (10, 11),
    // physics internal
    (12, 13), (12, 14), (13, 14), (14, 15), (15, 16),
    // crypto internal
    (17, 18), (17, 19),
    // drk internal
    (20, 21), (21, 22), (22, 23), (22, 24),
    // cross-cluster bridges
    (8,  20), // soma91 → pragmatic    (sync → drk)
    (6,  12), // kuramoto → feigenbaum (sync ↔ phys)
    (0,   7), // biocoenosis → ceei    (eco ↔ sync)
    (15, 18), // seraphine → pqhash    (phys ↔ crypto)
    (10, 23), // leviathan → surveillance (sync ↔ drk)
    (5,  13), // grayscott → ising     (eco ↔ phys)
    (3,   7), // daly → ceei           (eco ↔ sync)
];

fn build_weights() -> [[f64; N]; N] {
    let mut w = [[0.0f64; N]; N];
    for &(a, b) in EDGE_LIST {
        w[a][b] = 1.0;
        w[b][a] = 1.0;
    }
    w
}

// Converge a starting activation vector to its nearest attractor.
// Returns (attractor_state, energy, iterations_to_convergence).
fn converge(mut v: [f64; N], w: &[[f64; N]; N], beta: f64) -> ([f64; N], f64, usize) {
    for iter in 0..300 {
        let mut next = [0.0f64; N];
        for i in 0..N {
            let net: f64 = (0..N).map(|j| w[i][j] * v[j]).sum();
            next[i] = (beta * net).tanh();
        }
        let delta = (0..N)
            .map(|i| (next[i] - v[i]).abs())
            .fold(0.0_f64, f64::max);
        v = next;
        if delta < 1e-7 {
            let e = energy(&v, w);
            return (v, e, iter + 1);
        }
    }
    let e = energy(&v, w);
    (v, e, 300)
}

fn energy(v: &[f64; N], w: &[[f64; N]; N]) -> f64 {
    let mut e = 0.0f64;
    for i in 0..N {
        for j in 0..N {
            e += w[i][j] * v[i] * v[j];
        }
    }
    -0.5 * e
}

#[wasm_bindgen]
pub fn run_associative_field(
    seed_node:   f64,  // node index to cue (0–24); -1 = random only
    temperature: f64,  // β: inverse temperature — sharpness of attractor (0.5–8.0)
    n_probes:    f64,  // random starts for landscape scan (5–80)
) -> String {
    let seed  = (seed_node as i64).clamp(-1, N as i64 - 1);
    let beta  = temperature.clamp(0.5, 8.0);
    let n_pr  = (n_probes as usize).clamp(5, 80);

    let w = build_weights();

    // Deterministic RNG seeded from params
    let mut rng: u64 = ((seed_node * 999_983.0) as u64)
        .wrapping_add((temperature * 1_000_003.0) as u64)
        .wrapping_add(0xDEAD_BEEF_CAFE_1337);

    // ── Seeded attractor run ────────────────────────────────────────────────
    let initial: [f64; N] = {
        let mut v = [0.0f64; N];
        if seed >= 0 {
            let s = seed as usize;
            v[s] = 1.0;
            // Weakly prime immediate neighbours
            for j in 0..N {
                if w[s][j] > 0.5 {
                    v[j] = 0.12;
                }
            }
        } else {
            for i in 0..N {
                v[i] = lcg_next(&mut rng) * 2.0 - 1.0;
            }
        }
        v
    };

    let (attractor, energy_seed, conv_steps) = converge(initial, &w, beta);

    let co_active: Vec<usize> = (0..N).filter(|&i| attractor[i] > 0.5).collect();
    let suppressed: Vec<usize> = (0..N).filter(|&i| attractor[i] < -0.5).collect();

    // ── Landscape scan — enumerate distinct attractors ──────────────────────
    struct Basin {
        v:     [f64; N],
        energy: f64,
        count: usize,
    }
    let mut basins: Vec<Basin> = Vec::new();

    for _ in 0..n_pr {
        let mut v0 = [0.0f64; N];
        for i in 0..N {
            v0[i] = lcg_next(&mut rng) * 2.0 - 1.0;
        }
        let (av, ae, _) = converge(v0, &w, beta);
        // Match to an existing basin (L∞ distance < 0.20)
        let hit = basins.iter_mut().find(|b| {
            (0..N)
                .map(|i| (b.v[i] - av[i]).abs())
                .fold(0.0_f64, f64::max)
                < 0.20
        });
        if let Some(b) = hit {
            b.count += 1;
        } else {
            basins.push(Basin { v: av, energy: ae, count: 1 });
        }
    }
    basins.sort_by(|a, b| b.count.cmp(&a.count));

    // ── Format terminal output ──────────────────────────────────────────────
    let mut out = String::with_capacity(3200);

    let seed_label = if seed >= 0 { NODE_LABELS[seed as usize] } else { "random" };

    write!(out,
        "ASSOCIATIVE_FIELD v1.0 // SOMA-9.4\n\
         ══════════════════════════════════════════\n\
         hopfield attractor network · 25 kernel nodes\n\
         β = {beta:.2}   seed = {sl}   convergence = {sc} steps\n\
         ──────────────────────────────────────────\n\
         activation field  (cue → attractor state):\n",
        beta = beta, sl = seed_label, sc = conv_steps,
    ).unwrap();

    for (i, &act) in attractor.iter().enumerate() {
        let filled = ((act.abs() * 12.0).round() as usize).min(12);
        let bar: String = (0..12)
            .map(|b| if b < filled { '█' } else { '░' })
            .collect();
        let sign = if act >= 0.0 { '+' } else { '-' };
        write!(out, "  {:>12}  {}{bar}  {:.3}\n",
            NODE_LABELS[i], sign, act.abs(),
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         attractor energy  : {e:.4}   (lower = deeper basin)\n\
         co-active         : {ca}\n\
         suppressed        : {ia}\n\
         ──────────────────────────────────────────\n\
         landscape ({n_pr} random probes — top attractors):\n",
        e    = energy_seed,
        ca   = co_active.iter().map(|&i| NODE_LABELS[i]).collect::<Vec<_>>().join(", "),
        ia   = suppressed.iter().map(|&i| NODE_LABELS[i]).collect::<Vec<_>>().join(", "),
        n_pr = n_pr,
    ).unwrap();

    for (ai, b) in basins.iter().take(5).enumerate() {
        let co: Vec<&str> = (0..N)
            .filter(|&i| b.v[i] > 0.5)
            .map(|i| NODE_LABELS[i])
            .collect();
        let pct = b.count * 100 / n_pr;
        write!(out, "  A{}: basin={:>2}%  E={:.3}  [{}]\n",
            ai + 1, pct, b.energy, co.join(", "),
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         theory:\n\
           hopfield (1982) — neural networks and physical systems, PNAS 79\n\
           cohen & grossberg (1983) — absolute stability, IEEE TMC 13\n\
           amit, gutfreund & sompolinsky (1985) — spin-glass models, PRL 55\n\
         source: content/rust_kernels/src/kernels/associative_field.rs\n",
    ).unwrap();

    // ── Machine-readable data suffix (parsed by ArtTab hook in JS) ───────────
    let act_json: String = attractor
        .iter()
        .map(|&v| format!("{:.4}", v))
        .collect::<Vec<_>>()
        .join(",");
    let co_json: String = co_active
        .iter()
        .map(|i| i.to_string())
        .collect::<Vec<_>>()
        .join(",");

    write!(out,
        "DATA:{{\"act\":[{act}],\"energy\":{e:.4},\"seed\":{s},\"co\":[{co}]}}",
        act = act_json,
        e   = energy_seed,
        s   = seed,
        co  = co_json,
    ).unwrap();

    out
}
