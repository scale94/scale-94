// kernels/glyph_archive.rs — Hierarchical Information Taxonomy & Zipf-Mandelbrot
//
// Zipf-Mandelbrot frequency law: f(r) = C / (r + q)^s
//   r = rank (1..N), s = exponent (~1.0 natural language), q = Mandelbrot offset
//   C = 1 / sum_{r=1}^{N} 1/(r+q)^s  (normalisation)
// Huffman coding: optimal code length L_i = ceil(-log2(p_i)); compare to H.
// Hierarchical tiers: merge by frequency similarity (greedy Ward linkage on 1D).
// Kolmogorov proxy: H (entropy rate) + log2(3) bits to describe Zipf parameters.
//
// Zipf (1949) Human Behavior; Mandelbrot (1953); Shannon (1948)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn run_glyph_archive(
    n_glyphs:          f64,  // 10–200 glyph types
    zipf_exponent:     f64,  // 0.5–2.5 spectral exponent s
    mandelbrot_offset: f64,  // 0.0–5.0 offset q
    entropy_target:    f64,  // 0.5–8.0 target entropy in bits (for comparison)
    tiers:             f64,  // 2–8 hierarchy tiers
) -> String {
    let n     = (n_glyphs as usize).clamp(10, 200);
    let s     = zipf_exponent.clamp(0.5, 2.5);
    let q     = mandelbrot_offset.clamp(0.0, 5.0);
    let h_tgt = entropy_target.clamp(0.5, 8.0);
    let t_cnt = (tiers as usize).clamp(2, 8);

    // Zipf-Mandelbrot probabilities
    let raw: Vec<f64> = (1..=n).map(|r| 1.0 / (r as f64 + q).powf(s)).collect();
    let total: f64    = raw.iter().sum::<f64>().max(1e-12);
    let probs: Vec<f64> = raw.iter().map(|x| x / total).collect();

    // Shannon entropy
    let entropy: f64 = probs.iter().filter(|&&p| p > 1e-15)
        .map(|&p| -p * p.log2()).sum();

    // Huffman code lengths: L_i = max(1, ceil(-log2(p_i)))
    let code_lengths: Vec<u32> = probs.iter().map(|&p| {
        if p <= 1e-15 { return n as u32; }
        let l = (-p.log2()).ceil() as u32;
        l.max(1)
    }).collect();
    let avg_code_len: f64 = code_lengths.iter().zip(probs.iter())
        .map(|(&l, &p)| l as f64 * p).sum();
    let huffman_efficiency = entropy / avg_code_len.max(1e-9);

    // Hierarchy: assign each glyph to a tier by log-frequency partition
    let tier_of: Vec<usize> = (0..n).map(|i| {
        let log_p = (-probs[i].log2()).min(40.0);
        let log_max = (-probs[n-1].log2()).min(40.0);
        let log_min = (-probs[0].log2()).min(40.0);
        let frac = (log_p - log_min) / (log_max - log_min + 1e-9);
        ((frac * t_cnt as f64) as usize).min(t_cnt - 1)
    }).collect();
    let tier_sizes: Vec<usize> = (0..t_cnt).map(|t| tier_of.iter().filter(|&&x| x==t).count()).collect();
    let tier_probs: Vec<f64>  = (0..t_cnt).map(|t|
        probs.iter().zip(tier_of.iter()).filter(|(_, &ti)| ti == t).map(|(&p,_)| p).sum::<f64>()
    ).collect();

    // Redundancy
    let log2_n    = (n as f64).log2();
    let redundancy = 1.0 - entropy / log2_n.max(1.0);
    let capacity   = entropy * n as f64;
    let kolmogorov_proxy = entropy + 3.0 * 2.0_f64.log2(); // H + description of 3 Zipf params

    let mut out = String::with_capacity(1800);
    write!(out,
        "GLYPH_ARCHIVE v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         N = {n}   s = {s:.3}   q = {q:.3}   tiers = {t_cnt}\n\
         Zipf-Mandelbrot: f(r) = C/(r+q)^s\n\
         ------------------------------------------\n\
         TOP-20 GLYPH FREQUENCY TABLE:\n\
           rank  |  probability   code_len   cumulative\n",
        n=n, s=s, q=q, t_cnt=t_cnt,
    ).unwrap();
    let mut cumulative = 0.0_f64;
    for i in 0..n.min(20) {
        cumulative += probs[i];
        write!(out, "  {:>4}  |  {:.6}    {:>4}       {:.4}\n",
            i+1, probs[i], code_lengths[i], cumulative).unwrap();
    }
    if n > 20 {
        write!(out, "  ... ({} more glyphs)\n", n - 20).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         HIERARCHY TIERS ({t_cnt} levels):\n").unwrap();
    for t in 0..t_cnt {
        write!(out, "  tier {t}: {:>4} glyphs  Sp = {:.5}\n", tier_sizes[t], tier_probs[t]).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         INFORMATION METRICS:\n\
           Shannon entropy    H = {h:.4} bits  (target = {ht:.4})\n\
           Avg code length    L = {acl:.4} bits\n\
           Huffman efficiency   = {he:.4}  ({hep:.1}%)\n\
           Redundancy         R = {red:.4}  ({redp:.1}%)\n\
           Archive capacity   C = {cap:.2} bits  ({capkb:.2} kbits)\n\
           Kolmogorov proxy   K = {kol:.4} bits\n\
         ------------------------------------------\n\
         THEORY : Zipf (1949) Human Behavior; Mandelbrot (1953)\n\
                  Shannon (1948) Bell Syst. Tech. J. 27:379\n\
         SOURCE : content/rust_kernels/src/kernels/glyph_archive.rs",
        h=entropy, ht=h_tgt, acl=avg_code_len, he=huffman_efficiency, hep=huffman_efficiency*100.0,
        red=redundancy, redp=redundancy*100.0, cap=capacity, capkb=capacity/1000.0, kol=kolmogorov_proxy,
    ).unwrap();
    out
}
