// kernels/mutation_kernel.rs — Quasispecies Equation (Eigen 1971)
//
// Mutation-selection dynamics on sequence space.
//
// L-bit binary sequences; 2^L possible genotypes.
// For tractability, simulate the top `seq_count` (≤16) genotypes.
//
// Fitness landscape (Fujiyama / single-peak):
//   f_i = exp(-d_i * selection)
//   where d_i = Hamming distance of genotype i from master sequence (all-zeros)
//
// Quasispecies equation (Eigen 1971):
//   dx_i/dt = Σ_j Q_ji · f_j · x_j  −  φ · x_i
//   where φ = Σ_k f_k · x_k  (mean fitness, keeps Σ x_i = 1)
//
// Mutation matrix Q:
//   Q_ji = μ^(d_ji) · (1−μ)^(L−d_ji)
//   μ = per-site mutation rate, d_ji = Hamming distance between sequences i and j
//
// Error threshold (Eigen):
//   μ_c = ln(f_max / f_neutral) / L
//   Above μ_c, master sequence fraction collapses → information catastrophe.
//
// Domingo & Holland (1997): RNA virus quasispecies, error catastrophe in viroids.
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Hamming distance between integers a and b over L bits
#[inline]
fn hamming(a: usize, b: usize, l: usize) -> usize {
    let xor = a ^ b;
    (0..l).filter(|&bit| (xor >> bit) & 1 == 1).count()
}

#[wasm_bindgen]
pub fn run_mutation_kernel(
    mutation_rate: f64, // 0.0001–0.5  per-site mutation rate μ
    selection:     f64, // 0.1–5.0     fitness selection coefficient
    seq_length:    f64, // 3–8         bit-length of sequences L
    steps:         f64, // 50–2000     Euler time steps (dt = 0.1)
    sequences:     f64, // 4–16        number of genotypes to track
) -> String {
    let mu    = mutation_rate.clamp(0.0001, 0.5);
    let sel   = selection.clamp(0.1, 5.0);
    let l     = (seq_length as usize).clamp(3, 8);
    let iters = (steps as usize).clamp(50, 2000);
    let m     = (sequences as usize).clamp(4, 16).min(1 << l);  // can't exceed 2^L
    let dt    = 0.1_f64;

    let mut rng: u64 = ((mutation_rate * 1_000_003.0) as u64)
        .wrapping_add((selection   * 999_979.0) as u64)
        .wrapping_add((seq_length  * 999_961.0) as u64)
        .wrapping_add((sequences   * 999_983.0) as u64)
        .wrapping_add(0xEEEE_3EED_5EED_5AFEu64);

    // Select m genotypes: master (0) + m-1 others sorted by Hamming distance
    let mut genotypes: Vec<usize> = vec![0usize];
    for g in 1..(1usize << l) {
        if genotypes.len() >= m { break; }
        genotypes.push(g);
    }
    genotypes.sort_by_key(|&g| hamming(g, 0, l));
    genotypes.dedup();
    genotypes.truncate(m);
    let m = genotypes.len();

    // Fitness vector
    let fitness: Vec<f64> = genotypes.iter()
        .map(|&g| { let d = hamming(g, 0, l) as f64; (-d * sel).exp() })
        .collect();
    let f_max     = fitness[0];      // master sequence (d=0)
    let f_neutral = fitness[m - 1];  // most distant (highest Hamming)

    // Error threshold
    let mu_c = if f_max > f_neutral + 1e-12 {
        (f_max / f_neutral).ln() / l as f64
    } else { 1.0 };

    // Mutation matrix Q_ji = μ^d_ji · (1−μ)^(L−d_ji)
    let mut q = vec![0.0f64; m * m];
    for i in 0..m {
        for j in 0..m {
            let d = hamming(genotypes[i], genotypes[j], l) as f64;
            q[j * m + i] = mu.powf(d) * (1.0 - mu).powf(l as f64 - d);
        }
    }

    // Initial distribution: start near master sequence with small perturbation
    let mut x: Vec<f64> = (0..m).map(|k| {
        if k == 0 { 0.8 } else { 0.2 / (m - 1) as f64 }
    }).collect();
    // Normalise
    let xsum: f64 = x.iter().sum();
    x.iter_mut().for_each(|v| *v /= xsum);

    struct Snap { step: usize, master: f64, top3: [f64; 3], mean_fitness: f64, entropy: f64 }
    let snap_steps: Vec<usize> = (0..=4).map(|i| i * (iters - 1) / 4).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(5);

    let seq_entropy = |xv: &[f64]| -> f64 {
        xv.iter().filter(|&&v| v > 1e-15).map(|&v| -v * v.ln()).sum()
    };

    for step in 0..iters {
        // Mean fitness φ = Σ f_k · x_k
        let phi: f64 = fitness.iter().zip(x.iter()).map(|(f, x)| f * x).sum();

        if snap_steps.contains(&step) {
            let mut top3 = [0.0f64; 3];
            let mut sorted = x.clone();
            sorted.sort_by(|a, b| b.partial_cmp(a).unwrap());
            for i in 0..3.min(m) { top3[i] = sorted[i]; }
            snaps.push(Snap {
                step,
                master: x[0],
                top3,
                mean_fitness: phi,
                entropy: seq_entropy(&x),
            });
        }

        // Euler: dx_i/dt = Σ_j Q_ji·f_j·x_j − φ·x_i
        let mut dx = vec![0.0f64; m];
        for i in 0..m {
            let inflow: f64 = (0..m).map(|j| q[j * m + i] * fitness[j] * x[j]).sum();
            dx[i] = dt * (inflow - phi * x[i]);
            // Inject tiny noise for numerical stability
            let n_val = lcg_next(&mut rng) * 1e-7;
            dx[i] += n_val;
        }
        for i in 0..m { x[i] = (x[i] + dx[i]).max(0.0); }
        // Re-normalise
        let s: f64 = x.iter().sum();
        if s > 1e-15 { x.iter_mut().for_each(|v| *v /= s); }
    }

    let final_phi: f64 = fitness.iter().zip(x.iter()).map(|(f, x)| f * x).sum();
    let above_threshold = mu > mu_c;

    let bar = |v: f64| -> String {
        let filled = (v.clamp(0.0, 1.0) * 24.0).round() as usize;
        let mut s = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(3000);
    write!(out,
        "MUTATION_KERNEL v1.0 // SOMA-9.4\n\
         ══════════════════════════════════════════\n\
         μ={mu:.5}  sel={sel:.3}  L={l}  genotypes={m}  steps={iters}\n\
         2^L = {total_seqs}  tracked = {m}/{total_seqs}\n\
         f_max(master) = {fm:.6}  f_neutral = {fn_:.6}\n\
         ──────────────────────────────────────────\n\
         ERROR THRESHOLD\n\
         μ_c = ln(f_max/f_neutral) / L = {mc:.6}\n\
         μ / μ_c = {ratio:.4}×   →  {regime}\n\
         ──────────────────────────────────────────\n\
         MASTER SEQUENCE DOMINANCE  x[0] (master = all-zeros)\n",
        mu=mu, sel=sel, l=l, m=m, iters=iters,
        total_seqs=1usize<<l,
        fm=f_max, fn_=f_neutral,
        mc=mu_c,
        ratio=mu / mu_c.max(1e-12),
        regime=if above_threshold { "ABOVE THRESHOLD — error catastrophe" }
               else               { "BELOW THRESHOLD — quasispecies maintained" },
    ).unwrap();

    for sn in &snaps {
        write!(out, "  t={:>5}  x_master={:.5}  ⟨f⟩={:.5}  H={:.4}  {}\n",
            sn.step, sn.master, sn.mean_fitness, sn.entropy, bar(sn.master)).unwrap();
    }

    write!(out, "──────────────────────────────────────────\n\
                 QUASISPECIES DISTRIBUTION (final)\n").unwrap();

    let mut final_sorted: Vec<(usize, f64)> = genotypes.iter().cloned()
        .zip(x.iter().cloned()).collect();
    final_sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    for (g, freq) in final_sorted.iter().take(8) {
        let d = hamming(*g, 0, l);
        write!(out, "  g={:0>width$b}  d={d}  f={fi:.4}  x={freq:.6}  {bar}\n",
            g, width=l, d=d,
            fi = (-(d as f64) * sel).exp(),
            freq=freq, bar=bar(*freq)).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         FINAL ⟨fitness⟩ = {ff:.6}\n\
         FINAL x_master  = {fm:.6}\n\
         CATASTROPHE     : {cat}\n\
         ──────────────────────────────────────────\n\
         THEORY : Eigen (1971) Naturwissenschaften 58:465–523;\n\
                  Domingo & Holland (1997) Annu. Rev. Microbiol. 51:151–178\n\
         SOURCE : content/rust_kernels/src/kernels/mutation_kernel.rs",
        ff = final_phi,
        fm = x[0],
        cat = if above_threshold && x[0] < 0.1 { "YES — master sequence lost" }
              else if above_threshold           { "PARTIAL — degraded dominance" }
              else                             { "NO — information maintained" },
    ).unwrap();

    out
}
