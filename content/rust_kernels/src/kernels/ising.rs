// kernels/ising.rs — Ising Consensus Field (Ars Electronica 2027)
//
// 2-D Ising model on an N×N square lattice with periodic boundary conditions.
// Metropolis–Hastings Monte Carlo at inverse temperature β = 1/T (J = 1).
//
// Onsager exact critical temperature: T_c = 2/ln(1+√2) ≈ 2.2692
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_ising_consensus(
    lattice_size:   f64,
    temperature:    f64,
    external_field: f64,
    mc_steps:       f64,
) -> String {
    let n     = (lattice_size as usize).clamp(4, 40);
    let temp  = temperature.clamp(0.05, 10.0);
    let h     = external_field.clamp(-3.0, 3.0);
    let steps = (mc_steps as usize).clamp(10, 500);
    let n2    = n * n;

    let mut rng: u64 = ((lattice_size * 999_983.0) as u64)
        .wrapping_add((temperature * 999_979.0) as u64)
        .wrapping_add(((external_field.abs() + 0.01) * 999_961.0) as u64)
        .wrapping_add(0xFEED_FACE_C0DE_BABE);

    // Initial lattice: random ±1 spins
    let mut lattice: Vec<i8> = (0..n2)
        .map(|_| if lcg_next(&mut rng) > 0.5 { 1i8 } else { -1i8 })
        .collect();

    let beta       = 1.0 / temp;
    let eq_sweeps  = steps / 2;           // equilibration: discard first half
    let total_flips = steps * n2;

    let mut m_sum  = 0.0_f64;
    let mut m2_sum = 0.0_f64;
    let mut m4_sum = 0.0_f64;
    let mut e_sum  = 0.0_f64;
    let mut measurements = 0_usize;

    // Metropolis sweeps
    for flip in 0..total_flips {
        let idx = (lcg_next(&mut rng) * n2 as f64) as usize % n2;
        let i   = idx / n;
        let j   = idx % n;
        let s   = lattice[idx] as f64;

        // 4-neighbour sum (periodic boundary conditions)
        let nb = lattice[((i + n - 1) % n) * n + j       ] as f64
               + lattice[((i + 1    ) % n) * n + j       ] as f64
               + lattice[ i * n           + (j + n - 1) % n] as f64
               + lattice[ i * n           + (j + 1    ) % n] as f64;

        // ΔE for flipping s → −s  (H with J=1)
        let delta_e = 2.0 * s * (nb + h);

        if delta_e <= 0.0 || lcg_next(&mut rng) < (-beta * delta_e).exp() {
            lattice[idx] = -lattice[idx];
        }

        // Measure after equilibration: once per sweep
        if flip >= eq_sweeps * n2 && flip % n2 == 0 {
            let m: f64 = lattice.iter().map(|&s| s as f64).sum::<f64>() / n2 as f64;

            // Energy per site: −J·Σ s_i·(s_right + s_down) − h·s_i
            let e: f64 = {
                let mut e_val = 0.0_f64;
                for ii in 0..n {
                    for jj in 0..n {
                        let s  = lattice[ii * n + jj                 ] as f64;
                        let sr = lattice[ii * n + (jj + 1) % n       ] as f64;
                        let sd = lattice[((ii + 1) % n) * n + jj     ] as f64;
                        e_val += -s * (sr + sd) - h * s;
                    }
                }
                e_val / n2 as f64
            };

            m_sum  += m.abs();
            m2_sum += m * m;
            m4_sum += m * m * m * m;
            e_sum  += e;
            measurements += 1;
        }
    }

    let meas  = measurements.max(1) as f64;
    let mag   = m_sum  / meas;
    let mag2  = m2_sum / meas;
    let mag4  = m4_sum / meas;
    let energy = e_sum / meas;
    // Susceptibility: χ = N²·Var(M)/T
    let chi   = n2 as f64 * (mag2 - mag * mag) / temp;
    // Binder cumulant: U₄ = 1 − ⟨M⁴⟩/(3⟨M²⟩²)
    let binder = 1.0 - mag4 / (3.0 * mag2 * mag2).max(1e-12);

    // Onsager exact: T_c = 2J/ln(1+√2)
    const T_C: f64 = 2.269_185_314_213_022;
    let t_ratio = temp / T_C;

    let phase = if t_ratio < 0.93 { "FERROMAGNETIC (ordered)" }
                else if t_ratio < 1.08 { "CRITICAL POINT" }
                else { "PARAMAGNETIC (disordered)" };

    let interp = if t_ratio < 0.6 {
        "deep order — near-total consensus, fluctuations suppressed"
    } else if t_ratio < 0.93 {
        "partial order — opinion domains, minority clusters persist"
    } else if t_ratio < 1.08 {
        "critical — sensitivity maximal, consensus maximally fragile"
    } else if t_ratio < 1.5 {
        "paramagnetic — weak correlation, fast opinion decay"
    } else {
        "high-T disorder — no collective consensus possible"
    };

    // ASCII lattice visualization (up to 20×20)
    let vis_n = n.min(20);
    let mut lattice_vis = String::with_capacity(vis_n * (vis_n + 1));
    for ii in 0..vis_n {
        for jj in 0..vis_n {
            lattice_vis.push(if lattice[ii * n + jj] > 0 { '█' } else { '░' });
        }
        lattice_vis.push('\n');
    }

    let mut out = String::with_capacity(1400);
    write!(out,
        "ISING_CONSENSUS_FIELD v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════\n\
         LATTICE : {n}×{n} = {n2} sites   J = 1\n\
         T = {temp:.4}   T_c = {tc:.6} (Onsager exact)\n\
         T/T_c = {tr:.4}   h = {h:.3}   sweeps = {steps}\n\
         ──────────────────────────────────────────\n\
         LATTICE STATE ({vis_n}×{vis_n}  █ = +1  ░ = −1):\n\
         {lattice_vis}\
         ──────────────────────────────────────────\n\
         THERMODYNAMIC OBSERVABLES:\n\
           ⟨|M|⟩          : {mag:.6}   (0=disorder → 1=ferromagnet)\n\
           ⟨E⟩/site       : {energy:.6}\n\
           χ susceptibility: {chi:.4}   (diverges at T_c)\n\
           U₄ Binder       : {binder:.4}   (2/3=ordered, 0=disordered)\n\
           PHASE           : {phase}\n\
         ──────────────────────────────────────────\n\
         T/T_c = {tr:.3}× → {interp}\n\
         THEORY : Ising (1925); Onsager (1944); Metropolis et al. (1953)\n\
         SOURCE : content/rust_kernels/src/kernels/ising.rs",
        n = n, n2 = n2, temp = temp, tc = T_C, tr = t_ratio,
        h = h, steps = steps, vis_n = vis_n, lattice_vis = lattice_vis,
        mag = mag, energy = energy, chi = chi, binder = binder,
        phase = phase, interp = interp,
    ).unwrap();

    out
}
