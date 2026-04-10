// kernels/ideological_synthesis.rs — Deffuant Bounded Confidence Model
//
// N agents with D-dimensional opinion vectors o_i in [-1,1]^D.
// Bounded confidence: interact only if L2 distance < epsilon (confidence_bound).
// Update: o_i += mu*(o_j - o_i); o_j += mu*(o_i - o_j)  (mu = convergence_rate).
// Extremism: fraction f_ext agents with double attraction strength.
// Dark empathy: extremists update interlocutor but not themselves (asymmetric).
// Cluster detection: DBSCAN-lite on 1D opinion projection sorted scan.
// Polarization: inter-cluster mean distance / mean intra-cluster spread.
//
// Deffuant et al. (2000) Adv. Complex Syst.; Hegselmann & Krause (2002)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_ideological_synthesis(
    n_agents:          f64,  // 20–200 agents
    confidence_bound:  f64,  // 0.1–1.0 epsilon
    convergence_rate:  f64,  // 0.1–0.5 mu
    extremism_fraction: f64, // 0.0–0.5 fraction of extremist agents
    dimensions:        f64,  // 1–4 opinion space dimensions
) -> String {
    let n    = (n_agents as usize).clamp(20, 200);
    let eps  = confidence_bound.clamp(0.1, 1.0);
    let mu   = convergence_rate.clamp(0.1, 0.5);
    let f_ex = extremism_fraction.clamp(0.0, 0.5);
    let d    = (dimensions as usize).clamp(1, 4);
    let iters = 200usize;

    let mut rng: u64 = ((n_agents * 1_000_003.0) as u64)
        .wrapping_add((confidence_bound * 999_979.0) as u64)
        .wrapping_add((extremism_fraction * 999_983.0) as u64)
        .wrapping_add(0xDECA_FBAD_1234);

    // Initialise opinions uniformly in [-1, 1]^D
    let mut opinions: Vec<Vec<f64>> = (0..n).map(|_|
        (0..d).map(|_| lcg_next(&mut rng) * 2.0 - 1.0).collect()
    ).collect();
    let n_extremists = (n as f64 * f_ex) as usize;
    // Extremists initialised at extremes (±1 on all dims)
    for i in 0..n_extremists {
        let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
        opinions[i] = vec![sign; d];
    }

    let dist = |a: &[f64], b: &[f64]| -> f64 {
        a.iter().zip(b.iter()).map(|(x,y)| (x-y).powi(2)).sum::<f64>().sqrt()
    };

    let snap_at: Vec<usize> = (0..=4).map(|i| i * iters / 4).collect();
    let mut snapshots: Vec<(usize, usize, f64)> = Vec::new(); // (step, clusters, polarization)

    let count_clusters = |ops: &[Vec<f64>]| -> (usize, f64) {
        // Project onto first dimension, sort, gap > eps/2 = new cluster
        let mut proj: Vec<f64> = ops.iter().map(|o| o[0]).collect();
        proj.sort_by(|a,b| a.partial_cmp(b).unwrap());
        let mut clusters = 1usize;
        let mut cluster_means: Vec<f64> = Vec::new();
        let mut current_sum   = proj[0];
        let mut current_count = 1usize;
        for i in 1..proj.len() {
            if proj[i] - proj[i-1] > eps / 2.0 {
                cluster_means.push(current_sum / current_count as f64);
                clusters += 1;
                current_sum   = proj[i];
                current_count = 1;
            } else {
                current_sum   += proj[i];
                current_count += 1;
            }
        }
        cluster_means.push(current_sum / current_count as f64);
        let polarization = if cluster_means.len() >= 2 {
            cluster_means.windows(2).map(|w| (w[1]-w[0]).abs()).sum::<f64>()
                / (cluster_means.len() - 1) as f64
        } else { 0.0 };
        (clusters, polarization)
    };

    for step in 0..iters {
        // Random pairwise interactions
        for _ in 0..n {
            let i = (lcg_next(&mut rng) * n as f64) as usize % n;
            let j = (lcg_next(&mut rng) * n as f64) as usize % n;
            if i == j { continue; }
            let d_ij = dist(&opinions[i], &opinions[j]);
            if d_ij < eps {
                let is_extremist_i = i < n_extremists;
                let is_extremist_j = j < n_extremists;
                // Dark empathy: extremists pull others but don't update themselves
                if is_extremist_i && !is_extremist_j {
                    // Pull j toward i with 2x strength
                    for k in 0..d {
                        let delta = opinions[i][k] - opinions[j][k];
                        opinions[j][k] += mu * 2.0 * delta;
                    }
                } else if is_extremist_j && !is_extremist_i {
                    for k in 0..d {
                        let delta = opinions[j][k] - opinions[i][k];
                        opinions[i][k] += mu * 2.0 * delta;
                    }
                } else {
                    // Standard bilateral update
                    let delta: Vec<f64> = opinions[i].iter().zip(opinions[j].iter()).map(|(a,b)| b-a).collect();
                    for k in 0..d {
                        opinions[i][k] += mu * delta[k];
                        opinions[j][k] -= mu * delta[k];
                    }
                }
                // Clamp to [-1,1]
                for k in 0..d {
                    opinions[i][k] = opinions[i][k].clamp(-1.0, 1.0);
                    opinions[j][k] = opinions[j][k].clamp(-1.0, 1.0);
                }
            }
        }
        if snap_at.contains(&step) {
            let (cl, pol) = count_clusters(&opinions);
            snapshots.push((step, cl, pol));
        }
    }

    let (final_clusters, final_polarization) = count_clusters(&opinions);
    let mean_opinion: Vec<f64> = (0..d).map(|k|
        opinions.iter().map(|o| o[k]).sum::<f64>() / n as f64
    ).collect();
    let opinion_spread: f64 = opinions.iter()
        .map(|o| dist(o, &mean_opinion)).sum::<f64>() / n as f64;

    let hive_status = if final_clusters == 1 { "CONSENSUS — single HIVE formation" }
                      else if final_clusters <= 3 { "POLARISED — HIVE fragmentation" }
                      else { "FRACTURED — no dominant HIVE" };

    let mut out = String::with_capacity(1400);
    write!(out,
        "IDEOLOGICAL_SYNTHESIS v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         N = {n}   eps = {eps:.3}   mu = {mu:.3}   D = {d}\n\
         extremism_fraction = {fex:.3}   extremists = {nex}\n\
         dark_empathy: extremists pull x2 but do not update\n\
         ------------------------------------------\n\
         OPINION DYNAMICS:\n\
           step   |  clusters   polarization\n",
        n=n, eps=eps, mu=mu, d=d, fex=f_ex, nex=n_extremists,
    ).unwrap();
    for (s, cl, pol) in &snapshots {
        write!(out, "  {:>5}  |    {:>3}      {:.4}\n", s, cl, pol).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         FINAL STATE:\n\
           clusters       {fc}\n\
           polarization   {fp:.4}\n\
           opinion_spread {os:.4}\n\
         HIVE STATUS: {hive}\n\
         ------------------------------------------\n\
         THEORY : Deffuant et al. (2000) Adv. Complex Syst. 3:87\n\
                  Hegselmann & Krause (2002); de Waal dark empathy model\n\
         SOURCE : content/rust_kernels/src/kernels/ideological_synthesis.rs",
        fc=final_clusters, fp=final_polarization, os=opinion_spread, hive=hive_status,
    ).unwrap();
    out
}
