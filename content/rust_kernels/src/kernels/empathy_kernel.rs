// kernels/empathy_kernel.rs — Emotional Contagion Network
//
// Hatfield, Cacioppo & Rapson (1993) + de Waal (2008) empathy gradients
//
// N agents, each with valence v_i ∈ [-1,1] and arousal a_i ∈ [0,1].
// Emotional contagion (Euler):
//   dv_i/dt = -v_i · decay  +  K · Σ_j w_ij · (v_j − v_i)  +  noise · η_i
//   da_i/dt = -a_i · decay  +  0.3·K · Σ_j w_ij · (a_j − a_i) + 0.5·noise · η_i
//
// Coupling weights w_ij = exp(-empathic_distance_ij) / rank_i  (de Waal gradient)
//   empathic_distance_ij ~ U(0,1); rank_i assigned by initial arousal order (1 = highest)
//   bottom-up strength scales as 1/rank: lower-ranked agents catch emotions more readily.
//
// Kuramoto order parameter on valence phases (map v to angle: φ_i = π·v_i):
//   r_emp = |1/N · Σ exp(i·φ_j)|   (empathy field synchronisation)
//
// Metrics: mean_valence, valence_std, arousal_mean, empathy_field_sync (Kuramoto r)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_empathy_kernel(
    n_agents: f64,  // 4–64 agents
    coupling: f64,  // 0.0–5.0 contagion coupling K
    decay:    f64,  // 0.01–1.0 emotional decay rate
    noise:    f64,  // 0.0–0.5 stochastic noise amplitude
    steps:    f64,  // 50–2000 Euler time steps (dt = 0.05)
) -> String {
    use std::f64::consts::PI;

    let n     = (n_agents as usize).clamp(4, 64);
    let k     = coupling.clamp(0.0, 5.0);
    let d     = decay.clamp(0.01, 1.0);
    let eta   = noise.clamp(0.0, 0.5);
    let iters = (steps as usize).clamp(50, 2000);
    let dt    = 0.05_f64;

    // Deterministic seed from parameters
    let mut rng: u64 = ((n_agents * 1_000_003.0) as u64)
        .wrapping_add((coupling * 999_979.0) as u64)
        .wrapping_add((decay    * 999_961.0) as u64)
        .wrapping_add((noise    * 999_983.0) as u64)
        .wrapping_add(0xE4A7_F000_5EEDu64);

    // Initial valence and arousal
    let mut valence:  Vec<f64> = (0..n).map(|_| lcg_next(&mut rng) * 2.0 - 1.0).collect();
    let mut arousal:  Vec<f64> = (0..n).map(|_| lcg_next(&mut rng)).collect();

    // Rank agents by initial arousal descending (rank 1 = highest arousal)
    let mut order: Vec<usize> = (0..n).collect();
    let init_arousal = arousal.clone();
    order.sort_by(|&a, &b| init_arousal[b].partial_cmp(&init_arousal[a]).unwrap());
    let mut rank = vec![1usize; n];
    for (r, &idx) in order.iter().enumerate() { rank[idx] = r + 1; }

    // Empathic distance matrix: w_ij = exp(-dist_ij) / rank_i
    let mut w = vec![0.0f64; n * n];
    for i in 0..n {
        for j in 0..n {
            if i != j {
                let dist = lcg_next(&mut rng);
                w[i * n + j] = (-dist).exp() / rank[i] as f64;
            }
        }
    }
    // Row-normalise weights
    for i in 0..n {
        let row_sum: f64 = (0..n).map(|j| w[i * n + j]).sum();
        if row_sum > 1e-12 {
            for j in 0..n { w[i * n + j] /= row_sum; }
        }
    }

    // Kuramoto order parameter on valence phases
    let kuramoto_r = |v: &[f64]| -> f64 {
        let (si, co) = v.iter().fold((0.0f64, 0.0f64), |(s, c), &vi| {
            let phi = PI * vi;
            (s + phi.sin(), c + phi.cos())
        });
        let inv_n = 1.0 / v.len() as f64;
        ((si * inv_n).powi(2) + (co * inv_n).powi(2)).sqrt()
    };

    struct Snap { step: usize, mean_v: f64, std_v: f64, mean_a: f64, r_sync: f64 }
    let snap_steps: Vec<usize> = (0..=4).map(|i| i * (iters - 1) / 4).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(5);

    for step in 0..iters {
        if snap_steps.contains(&step) {
            let mean_v = valence.iter().sum::<f64>() / n as f64;
            let var_v  = valence.iter().map(|&v| (v - mean_v).powi(2)).sum::<f64>() / n as f64;
            let mean_a = arousal.iter().sum::<f64>() / n as f64;
            let r_sync = kuramoto_r(&valence);
            snaps.push(Snap { step, mean_v, std_v: var_v.sqrt(), mean_a, r_sync });
        }

        // Compute contagion deltas before update
        let prev_v = valence.clone();
        let prev_a = arousal.clone();

        for i in 0..n {
            // Box-Muller noise for valence
            let u1 = lcg_next(&mut rng).max(1e-12);
            let u2 = lcg_next(&mut rng);
            let ni = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
            let u3 = lcg_next(&mut rng).max(1e-12);
            let u4 = lcg_next(&mut rng);
            let ni2 = (-2.0 * u3.ln()).sqrt() * (2.0 * PI * u4).cos();

            let contagion_v: f64 = (0..n).map(|j| w[i * n + j] * (prev_v[j] - prev_v[i])).sum();
            let contagion_a: f64 = (0..n).map(|j| w[i * n + j] * (prev_a[j] - prev_a[i])).sum();

            let dv = dt * (-d * prev_v[i] + k * contagion_v + eta * ni);
            let da = dt * (-d * prev_a[i] + 0.3 * k * contagion_a + 0.5 * eta * ni2);

            valence[i] = (prev_v[i] + dv).clamp(-1.0, 1.0);
            arousal[i] = (prev_a[i] + da).clamp(0.0,  1.0);
        }
    }

    let final_mean_v = valence.iter().sum::<f64>() / n as f64;
    let final_var_v  = valence.iter().map(|&v| (v - final_mean_v).powi(2)).sum::<f64>() / n as f64;
    let final_r      = kuramoto_r(&valence);
    let final_mean_a = arousal.iter().sum::<f64>() / n as f64;

    // Emotional climate label
    let climate = if final_mean_v > 0.4 && final_r > 0.6  { "COLLECTIVE_RESONANCE (positive)" }
                  else if final_mean_v > 0.1               { "MILD_POSITIVE_CONTAGION"          }
                  else if final_mean_v < -0.4 && final_r > 0.5 { "COLLECTIVE_DISTRESS"          }
                  else if final_mean_v < -0.1              { "DIFFUSE_NEGATIVE_AFFECT"           }
                  else                                     { "AFFECTIVE_NEUTRALITY"              };

    // De Waal empathy assessment
    let dewaal = if final_r > 0.7 { "STRONG synchrony — embodied simulation active (de Waal 2008)" }
                 else if final_r > 0.4 { "MODERATE synchrony — cognitive empathy dominates"        }
                 else               { "WEAK synchrony — emotional isolation; empathic fatigue"     };

    let bar = |v: f64, lo: f64, hi: f64| -> String {
        let frac = ((v - lo) / (hi - lo + 1e-9)).clamp(0.0, 1.0);
        let filled = (frac * 24.0).round() as usize;
        let mut s = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(2800);
    write!(out,
        "EMPATHY_KERNEL v1.0 // SOMA-9.4\n\
         ══════════════════════════════════════════\n\
         N={n}  K={k:.3}  decay={d:.3}  noise={eta:.3}  steps={iters}\n\
         dt=0.05   total_time={tt:.2}\n\
         ──────────────────────────────────────────\n\
         VALENCE FIELD TRAJECTORY  v_i ∈ [-1,1]\n",
        n=n, k=k, d=d, eta=eta, iters=iters,
        tt=iters as f64 * dt,
    ).unwrap();

    let (v_min, v_max) = (-1.0f64, 1.0f64);
    for sn in &snaps {
        write!(out, "  t={:>5}  ⟨v⟩={:+.4}  σ_v={:.4}  {}\n",
            sn.step, sn.mean_v, sn.std_v, bar(sn.mean_v, v_min, v_max)).unwrap();
    }

    write!(out, "──────────────────────────────────────────\n\
                 AROUSAL FIELD  a_i ∈ [0,1]\n").unwrap();
    for sn in &snaps {
        write!(out, "  t={:>5}  ⟨a⟩={:.4}                  {}\n",
            sn.step, sn.mean_a, bar(sn.mean_a, 0.0, 1.0)).unwrap();
    }

    write!(out, "──────────────────────────────────────────\n\
                 KURAMOTO EMPATHY SYNC  r = |1/N·Σ exp(iπv_j)|\n").unwrap();
    let r_max = snaps.iter().map(|s| s.r_sync).fold(0.0f64, f64::max).max(1e-6);
    for sn in &snaps {
        write!(out, "  t={:>5}  r={:.4}  {}\n",
            sn.step, sn.r_sync, bar(sn.r_sync, 0.0, r_max)).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         FINAL EMOTIONAL DISTRIBUTION\n\
         ⟨valence⟩ = {fv:+.6}   σ_valence = {sv:.6}\n\
         ⟨arousal⟩ = {fa:.6}   empathy_r  = {fr:.6}\n\
         ──────────────────────────────────────────\n\
         CLIMATE  : {cl}\n\
         DE WAAL  : {dw}\n\
         ──────────────────────────────────────────\n\
         THEORY : Hatfield, Cacioppo & Rapson (1993) Emotional Contagion;\n\
                  de Waal (2008) The Age of Empathy; Kuramoto (1975)\n\
         SOURCE : content/rust_kernels/src/kernels/empathy_kernel.rs",
        fv=final_mean_v, sv=final_var_v.sqrt(),
        fa=final_mean_a, fr=final_r,
        cl=climate, dw=dewaal,
    ).unwrap();

    out
}
