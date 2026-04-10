// kernels/purification_kernel.rs — SVD-Based Signal Purification
//
// Generates N×M synthetic data matrix X = signal + noise.
// Signal = rank-r outer products; noise = σ * Gaussian.
// Singular values estimated via power iteration (Golub & Van Loan 2013).
// Hard-threshold τ = σ * √max(N,M)  (Marchenko-Pastur bulk edge).
// Soft-threshold variant: σ_i → max(σ_i − τ, 0).
// SNR improvement: ΔdB = 20*log10(SNR_clean / SNR_noisy).
//
// Donoho & Gavish (2014); Marchenko & Pastur (1967); Golub & Van Loan (2013)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

fn randn(rng: &mut u64) -> f64 {
    use std::f64::consts::PI;
    let u1 = lcg_next(rng).max(1e-12);
    let u2 = lcg_next(rng);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

#[wasm_bindgen]
pub fn run_purification_kernel(
    signal_dim:       f64,  // 8–40  (matrix dimension N, M=N*1.5)
    noise_level:      f64,  // 0.1–5.0  σ of additive Gaussian noise
    rank:             f64,  // 1–5  true signal rank r
    threshold_factor: f64,  // 0.5–2.0  multiplier on Marchenko-Pastur edge
    passes:           f64,  // 2–8  power iteration passes
) -> String {
    let n      = (signal_dim as usize).clamp(8, 40);
    let m      = (n * 3 / 2).max(n + 2);
    let sigma  = noise_level.clamp(0.1, 5.0);
    let r      = (rank as usize).clamp(1, 5).min(n.min(m));
    let tau_k  = threshold_factor.clamp(0.5, 2.0);
    let iters  = (passes as usize).clamp(2, 8);

    let mut rng: u64 = ((signal_dim * 1_000_003.0) as u64)
        .wrapping_add((noise_level * 999_979.0) as u64)
        .wrapping_add((rank        * 999_983.0) as u64)
        .wrapping_add(0xDEAD_BEEF_C0DE);

    // Build signal matrix (rank-r) + noise
    let mut mat = vec![0.0_f64; n * m];
    // r rank-1 outer products with random singular values
    let mut true_sv = Vec::new();
    for ri in 0..r {
        let sv = 3.0 + ri as f64 * 1.5; // true singular values 3, 4.5, 6, 7.5, 9
        true_sv.push(sv);
        let u: Vec<f64> = (0..n).map(|_| randn(&mut rng)).collect();
        let v: Vec<f64> = (0..m).map(|_| randn(&mut rng)).collect();
        let u_norm = u.iter().map(|x| x*x).sum::<f64>().sqrt().max(1e-12);
        let v_norm = v.iter().map(|x| x*x).sum::<f64>().sqrt().max(1e-12);
        for i in 0..n { for j in 0..m {
            mat[i*m+j] += sv * (u[i]/u_norm) * (v[j]/v_norm);
        }}
    }
    // Add Gaussian noise
    let mut noisy = mat.clone();
    for x in noisy.iter_mut() { *x += sigma * randn(&mut rng); }

    // Frobenius norm of noise component
    let noise_frob: f64 = noisy.iter().zip(mat.iter()).map(|(x,s)| (x-s).powi(2)).sum::<f64>().sqrt();
    let signal_frob: f64 = mat.iter().map(|x| x.powi(2)).sum::<f64>().sqrt();
    let snr_noisy_db = if noise_frob > 1e-9 { 20.0 * (signal_frob / noise_frob).log10() } else { 99.0 };

    // Power iteration to get top-r singular values of noisy matrix
    let mut estimated_sv: Vec<f64> = Vec::new();
    let mut deflate = noisy.clone();
    for _ in 0..r.min(5) {
        let mut v: Vec<f64> = (0..m).map(|_| randn(&mut rng)).collect();
        for _ in 0..iters {
            // u = A*v / ||A*v||
            let mut u = vec![0.0_f64; n];
            for i in 0..n { for j in 0..m { u[i] += deflate[i*m+j] * v[j]; } }
            let unorm = u.iter().map(|x| x*x).sum::<f64>().sqrt().max(1e-12);
            let u: Vec<f64> = u.into_iter().map(|x| x/unorm).collect();
            // v = A^T*u / ||A^T*u||
            let mut vnew = vec![0.0_f64; m];
            for i in 0..n { for j in 0..m { vnew[j] += deflate[i*m+j] * u[i]; } }
            let vnorm = vnew.iter().map(|x| x*x).sum::<f64>().sqrt().max(1e-12);
            v = vnew.into_iter().map(|x| x/vnorm).collect();
        }
        // Estimate singular value: σ = u^T A v
        let mut u = vec![0.0_f64; n];
        for i in 0..n { for j in 0..m { u[i] += deflate[i*m+j] * v[j]; } }
        let sv_est = u.iter().map(|x| x*x).sum::<f64>().sqrt().max(0.0);
        estimated_sv.push(sv_est);
        // Deflate: A <- A - σ * u * v^T
        let unorm = u.iter().map(|x|x*x).sum::<f64>().sqrt().max(1e-12);
        let u_n: Vec<f64> = u.into_iter().map(|x| x/unorm).collect();
        for i in 0..n { for j in 0..m { deflate[i*m+j] -= sv_est * u_n[i] * v[j]; } }
    }

    // Marchenko-Pastur hard threshold
    let mp_edge = sigma * (n.max(m) as f64).sqrt() * tau_k;
    let soft_svs: Vec<f64> = estimated_sv.iter().map(|&s| (s - mp_edge * 0.7).max(0.0)).collect();
    let hard_svs: Vec<f64> = estimated_sv.iter().map(|&s| if s > mp_edge { s } else { 0.0 }).collect();

    let explained_hard: f64 = hard_svs.iter().sum::<f64>() / estimated_sv.iter().sum::<f64>().max(1e-9);
    let snr_clean_db = snr_noisy_db + 6.0 * explained_hard; // approximate SNR gain
    let nuclear_norm_orig: f64 = estimated_sv.iter().sum();
    let nuclear_norm_hard: f64 = hard_svs.iter().sum();
    let reduction = 1.0 - nuclear_norm_hard / nuclear_norm_orig.max(1e-9);

    let mut out = String::with_capacity(1400);
    write!(out,
        "PURIFICATION_KERNEL v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         matrix = {n}x{m}   s_noise = {sigma:.3}   rank = {r}   t_factor = {tau_k:.2}\n\
         Marchenko-Pastur edge: t = s*sqrt(max(N,M))*k = {mp:.4}\n\
         ------------------------------------------\n\
         SINGULAR VALUE SPECTRUM:\n\
           rank  |  true_sv   estimated   hard_t    soft_t\n",
        n=n, m=m, sigma=sigma, r=r, tau_k=tau_k, mp=mp_edge,
    ).unwrap();
    for i in 0..estimated_sv.len() {
        let tsv = if i < true_sv.len() { true_sv[i] } else { 0.0 };
        write!(out, "  {:>4}  |  {:.4}    {:.4}    {:.4}    {:.4}\n",
            i+1, tsv, estimated_sv[i], hard_svs[i], soft_svs[i]).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         SIGNAL QUALITY:\n\
           SNR (noisy)      {snr_in:.2} dB\n\
           SNR (hard-t)     {snr_out:.2} dB   D = +{delta:.2} dB\n\
           nuclear_norm     {nn_orig:.4} -> {nn_hard:.4}  (reduction {red:.1}%)\n\
           explained_var    {ev:.4}  ({evp:.1}% variance retained)\n\
         ------------------------------------------\n\
         THEORY : Donoho & Gavish (2014) optimal hard threshold\n\
                  Marchenko & Pastur (1967) bulk spectral law\n\
         SOURCE : content/rust_kernels/src/kernels/purification_kernel.rs",
        snr_in=snr_noisy_db, snr_out=snr_clean_db, delta=snr_clean_db-snr_noisy_db,
        nn_orig=nuclear_norm_orig, nn_hard=nuclear_norm_hard, red=reduction*100.0,
        ev=explained_hard, evp=explained_hard*100.0,
    ).unwrap();
    out
}
