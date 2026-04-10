// kernels/signal_legacy.rs — Long-Range Information Theory (1/f Noise · Shannon 1948)
//
// Pink (1/f) noise generated as superposition of k random telegraph processes
// (Milotti 2002): each process i has switching rate r_i = r_min * b^i
// Pink noise PSD ∝ 1/f emerges from superposition of Lorentzian spectra.
//
// Sliding-window Shannon entropy: H(w) = -Σ_s p_s * log2(p_s), window=w
// Mutual Information at lag d:    I(X;X_d) via joint 8-bin histogram
// Information horizon d*: smallest d where I(X;X_d) < 0.01 nats
// Complexity proxy (Lempel-Ziv 76): count distinct patterns in binary encoding
//
// Shannon (1948); Mandelbrot (1977); Milotti (2002)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_signal_legacy(
    context_length:    f64,  // 100–2000 sequence length
    window_ratio:      f64,  // 0.05–0.4 window as fraction of length
    ks:                f64,  // 2–12 telegraph processes (pink noise generators)
    compression_passes: f64, // 1–5 LZ complexity passes
    noise_color:       f64,  // 0.0=white .. 1.0=pink .. 2.0=brown (spectral exponent)
) -> String {
    let n       = (context_length as usize).clamp(100, 2000);
    let w       = ((window_ratio.clamp(0.05, 0.4) * n as f64) as usize).max(8);
    let k       = (ks as usize).clamp(2, 12);
    let _passes = (compression_passes as usize).clamp(1, 5);
    let beta    = noise_color.clamp(0.0, 2.0); // spectral exponent

    let mut rng: u64 = ((context_length * 1_000_003.0) as u64)
        .wrapping_add((window_ratio * 999_979.0) as u64)
        .wrapping_add((ks * 999_983.0) as u64)
        .wrapping_add(0xCAFE_1F_BABE);

    // Generate 1/f^β noise via superposition of k telegraph processes
    let r_min = 0.001_f64;
    let r_max = 0.5_f64;
    let base   = (r_max / r_min).powf(1.0 / (k as f64 - 1.0).max(1.0));

    let mut states: Vec<f64>  = (0..k).map(|_| if lcg_next(&mut rng) > 0.5 { 1.0 } else { -1.0 }).collect();
    let rates: Vec<f64>       = (0..k).map(|i| r_min * base.powi(i as i32)).collect();
    // Weight each process: w_i ∝ 1/r_i^(β/2) gives desired spectral slope
    let weights: Vec<f64>     = rates.iter().map(|&r| 1.0 / r.powf(beta / 2.0)).collect();
    let w_sum: f64            = weights.iter().sum();

    let mut seq: Vec<f64> = Vec::with_capacity(n);
    for _ in 0..n {
        for i in 0..k {
            if lcg_next(&mut rng) < rates[i] { states[i] = -states[i]; }
        }
        let sample: f64 = states.iter().zip(weights.iter()).map(|(s, w)| s * w).sum::<f64>() / w_sum;
        seq.push(sample);
    }

    // Quantize to 8 bins for entropy / MI computation
    let lo = seq.iter().cloned().fold(f64::INFINITY, f64::min);
    let hi = seq.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let range = (hi - lo).max(1e-9);
    let quantize = |v: f64| ((( v - lo) / range * 7.99) as usize).min(7);
    let qseq: Vec<usize> = seq.iter().map(|&v| quantize(v)).collect();

    // Sliding-window Shannon entropy at 5 window positions
    let shannon_h = |start: usize| -> f64 {
        let mut counts = [0u32; 8];
        for i in start..(start + w).min(n) { counts[qseq[i]] += 1; }
        let inv = 1.0 / w as f64;
        counts.iter().filter(|&&c| c > 0).map(|&c| { let p = c as f64 * inv; -p * p.log2() }).sum()
    };
    let snap_windows: Vec<usize> = (0..5).map(|i| i * (n - w) / 4).collect();
    let entropies: Vec<f64>      = snap_windows.iter().map(|&s| shannon_h(s)).collect();

    // Mutual information at lags 1, 5, 20, 80, 320
    let lags = [1usize, 5, 20, 80, 320];
    let mi_at = |lag: usize| -> f64 {
        if lag >= n { return 0.0; }
        let mut joint = [[0u32; 8]; 8];
        let mut marg_x = [0u32; 8];
        let mut marg_y = [0u32; 8];
        let count = n - lag;
        for i in 0..count {
            let x = qseq[i]; let y = qseq[i + lag];
            joint[x][y] += 1; marg_x[x] += 1; marg_y[y] += 1;
        }
        let inv = 1.0 / count as f64;
        let mut mi = 0.0_f64;
        for xi in 0..8 { for yi in 0..8 {
            if joint[xi][yi] == 0 { continue; }
            let p_xy = joint[xi][yi] as f64 * inv;
            let p_x  = marg_x[xi] as f64 * inv;
            let p_y  = marg_y[yi] as f64 * inv;
            mi += p_xy * (p_xy / (p_x * p_y + 1e-15)).ln();
        }}
        mi.max(0.0)
    };
    let mis: Vec<f64> = lags.iter().map(|&d| mi_at(d)).collect();

    // Information horizon: smallest lag where MI < 0.01 nats
    let horizon = lags.iter().zip(mis.iter())
        .find(|(_, &mi)| mi < 0.01)
        .map(|(&d, _)| d)
        .unwrap_or(*lags.last().unwrap());

    // Lempel-Ziv complexity proxy: count distinct words in binary encoding
    let binary: Vec<u8> = qseq.iter().map(|&v| if v >= 4 { 1u8 } else { 0 }).collect();
    let mut lz_words: std::collections::HashSet<Vec<u8>> = std::collections::HashSet::new();
    let mut i = 0usize;
    while i < binary.len() {
        let end = (i + 8).min(binary.len());
        lz_words.insert(binary[i..end].to_vec());
        i += 4;
    }
    let lz_complexity = lz_words.len() as f64 / (n as f64 / 4.0).max(1.0);

    let mean_h = entropies.iter().sum::<f64>() / entropies.len() as f64;
    let status = if beta < 0.5 { "WHITE_NOISE — memoryless" }
                 else if beta < 1.2 { "PINK_NOISE — long-range correlations" }
                 else { "BROWN_NOISE — random walk regime" };

    let mut out = String::with_capacity(1400);
    write!(out,
        "SIGNAL_LEGACY v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         N = {n}   window = {w}   k_telegraph = {k}   b = {beta:.2}\n\
         Spectral regime: 1/f^b   (b=0: white · b=1: pink · b=2: brown)\n\
         ------------------------------------------\n\
         SLIDING-WINDOW SHANNON ENTROPY H(w):\n\
           pos    |  H(bits)   [max = {maxh:.3}]\n",
        n=n, w=w, k=k, beta=beta, maxh=3.0_f64, // log2(8)=3
    ).unwrap();
    for (pos, h) in snap_windows.iter().zip(entropies.iter()) {
        let bar_len = ((*h / 3.0) * 20.0).round() as usize;
        let bar: String = (0..20).map(|i| if i < bar_len { '#' } else { '.' }).collect();
        write!(out, "  {:>5}  |  {:.4}  {}\n", pos, h, bar).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         MUTUAL INFORMATION I(X; X_lag):\n\
           lag    |  I (nats)\n").unwrap();
    for (&lag, &mi) in lags.iter().zip(mis.iter()) {
        write!(out, "  {:>5}  |  {:.5}\n", lag, mi).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         INFORMATION HORIZON d* = {horizon}  (I < 0.01 nats)\n\
         MEAN ENTROPY          H  = {mh:.4} bits\n\
         LZ-COMPLEXITY PROXY   C  = {lz:.4}  (0=ordered · 1=random)\n\
         ------------------------------------------\n\
         STATUS : {status}\n\
         THEORY : Shannon (1948); Mandelbrot (1977); Milotti (2002) 1/f noise\n\
         SOURCE : content/rust_kernels/src/kernels/signal_legacy.rs",
        horizon=horizon, mh=mean_h, lz=lz_complexity, status=status,
    ).unwrap();
    out
}
