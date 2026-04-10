// kernels/metallurgy_kernel.rs — Spectral Signal Differentiation
//
// Perceptual/conceptual metallurgy: distinguishing near-identical signals.
//
// Model:
//   Two signal populations in CIE 1976 CIELAB space:
//     Violet: λ ≈ 405 nm  →  L* ≈ 35, a* ≈ 20, b* ≈ −55
//     Lila:   λ ≈ 420 nm  →  L* ≈ 38, a* ≈ 28, b* ≈ −48
//   Each population = n_samples points drawn from Gaussian clusters.
//   ΔE*ab = sqrt((ΔL*)² + (Δa*)² + (Δb*)²)   [CIE 1976]
//   d' = |μ_1 − μ_2| / σ_pooled               [Signal Detection Theory]
//   Fisher LDA ratio = B/W = between-class / within-class variance
//   Iterative mean-shift clustering (passes) refines cluster centers.
//
// MacAdam (1942) ellipses; Green & Swets (1966) SDT.
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_metallurgy_kernel(
    n_samples:       f64, // 20–400 samples per population
    separation:      f64, // 1.0–20.0  mean ΔE*ab between populations
    noise_sigma:     f64, // 0.5–10.0  intra-cluster spread (LAB units)
    passes:          f64, // 1–10      mean-shift refinement passes
    threshold:       f64, // 0.5–5.0   ΔE*ab discriminability threshold
) -> String {
    use std::f64::consts::PI;

    let n    = (n_samples as usize).clamp(20, 400);
    let sep  = separation.clamp(1.0, 20.0);
    let sig  = noise_sigma.clamp(0.5, 10.0);
    let npas = (passes as usize).clamp(1, 10);
    let thr  = threshold.clamp(0.5, 5.0);

    let mut rng: u64 = ((n_samples * 1_000_003.0) as u64)
        .wrapping_add((separation * 999_979.0) as u64)
        .wrapping_add((noise_sigma * 999_983.0) as u64)
        .wrapping_add(0xABCD_EF01_2345_6789);

    // Box-Muller normal samples
    let mut gauss = |rng: &mut u64| -> f64 {
        let u1 = lcg_next(rng).max(1e-12);
        let u2 = lcg_next(rng);
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    };

    // Population centres in LAB space
    // Violet ~ 405 nm
    let (vl, va, vb) = (35.0_f64, 20.0_f64, -55.0_f64);
    // Lila   ~ 420 nm — offset by separation along a* axis
    let (ll, la, lb) = (38.0_f64, 20.0_f64 + sep, -48.0_f64);

    // Generate samples: [L*, a*, b*]
    let mut pop_v: Vec<[f64; 3]> = (0..n).map(|_| {
        [vl + sig * gauss(&mut rng), va + sig * gauss(&mut rng), vb + sig * gauss(&mut rng)]
    }).collect();
    let mut pop_l: Vec<[f64; 3]> = (0..n).map(|_| {
        [ll + sig * gauss(&mut rng), la + sig * gauss(&mut rng), lb + sig * gauss(&mut rng)]
    }).collect();

    let de_ab = |a: &[f64; 3], b: &[f64; 3]| -> f64 {
        ((a[0]-b[0]).powi(2) + (a[1]-b[1]).powi(2) + (a[2]-b[2]).powi(2)).sqrt()
    };

    // Compute centre
    let centre = |pop: &Vec<[f64; 3]>| -> [f64; 3] {
        let n = pop.len() as f64;
        let mut c = [0.0_f64; 3];
        for p in pop { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
        c[0] /= n; c[1] /= n; c[2] /= n; c
    };

    // Mean-shift refinement: reassign each point to its current population
    // centre, then recompute centres iteratively.
    for _ in 0..npas {
        let cv = centre(&pop_v);
        let cl = centre(&pop_l);
        let all: Vec<[f64; 3]> = pop_v.iter().chain(pop_l.iter()).copied().collect();
        pop_v.clear(); pop_l.clear();
        for p in &all {
            if de_ab(p, &cv) <= de_ab(p, &cl) { pop_v.push(*p); } else { pop_l.push(*p); }
        }
        // Prevent empty populations
        if pop_v.is_empty() { pop_v.push([vl, va, vb]); }
        if pop_l.is_empty() { pop_l.push([ll, la, lb]); }
    }

    let cv = centre(&pop_v);
    let cl = centre(&pop_l);

    // Pairwise ΔE*ab: each violet vs each lila (sample 40×40 max for speed)
    let samp = n.min(40);
    let mut de_vals: Vec<f64> = Vec::with_capacity(samp * samp);
    for i in 0..samp { for j in 0..samp { de_vals.push(de_ab(&pop_v[i], &pop_l[j])); } }
    let de_mean = de_vals.iter().sum::<f64>() / de_vals.len() as f64;
    let de_var  = de_vals.iter().map(|&x| (x - de_mean).powi(2)).sum::<f64>() / de_vals.len() as f64;
    let de_std  = de_var.sqrt();

    // Within-class spread
    let var_v = pop_v.iter().map(|p| de_ab(p, &cv).powi(2)).sum::<f64>() / pop_v.len() as f64;
    let var_l = pop_l.iter().map(|p| de_ab(p, &cl).powi(2)).sum::<f64>() / pop_l.len() as f64;
    let sigma_pooled = (0.5 * (var_v + var_l)).sqrt().max(1e-9);

    // d' = |centre separation| / pooled_sigma
    let centre_sep = de_ab(&cv, &cl);
    let d_prime    = centre_sep / sigma_pooled;

    // Fisher LDA ratio: between-class / within-class variance
    let grand_centre = {
        let all_pts: Vec<&[f64; 3]> = pop_v.iter().chain(pop_l.iter()).collect();
        let m = all_pts.len() as f64;
        let mut gc = [0.0_f64; 3];
        for p in &all_pts { gc[0] += p[0]; gc[1] += p[1]; gc[2] += p[2]; }
        gc[0] /= m; gc[1] /= m; gc[2] /= m; gc
    };
    let between = {
        let nv = pop_v.len() as f64;
        let nl = pop_l.len() as f64;
        nv * de_ab(&cv, &grand_centre).powi(2) + nl * de_ab(&cl, &grand_centre).powi(2)
    };
    let within  = pop_v.iter().map(|p| de_ab(p, &cv).powi(2)).sum::<f64>()
                + pop_l.iter().map(|p| de_ab(p, &cl).powi(2)).sum::<f64>();
    let fisher_ratio = between / within.max(1e-9);

    // Cluster purity: fraction of points closest to their original centre
    let orig_cv = [vl, va, vb];
    let orig_cl = [ll, la, lb];
    let purity_v = pop_v.iter().filter(|p| de_ab(p, &orig_cv) < de_ab(p, &orig_cl)).count();
    let purity_l = pop_l.iter().filter(|p| de_ab(p, &orig_cl) < de_ab(p, &orig_cv)).count();
    let purity   = (purity_v + purity_l) as f64 / (pop_v.len() + pop_l.len()) as f64;

    // ΔE distribution histogram (10 bins)
    let de_min = de_vals.iter().cloned().fold(f64::INFINITY, f64::min);
    let de_max = de_vals.iter().cloned().fold(0.0_f64, f64::max);
    let bin_w  = (de_max - de_min).max(1e-9) / 10.0;
    let mut hist = [0u32; 10];
    for &v in &de_vals { hist[((v - de_min) / bin_w).floor() as usize % 10] += 1; }
    let hist_max = *hist.iter().max().unwrap_or(&1) as f64;

    let verdict = if d_prime >= 2.0 { "DISCRIMINABLE   — MacAdam threshold exceeded" }
                  else if d_prime >= 1.0 { "MARGINAL        — near-threshold detection" }
                  else { "INDISCRIMINABLE — populations overlap below JND" };

    let bar = |v: f64, mx: f64| -> String {
        let f = ((v / mx.max(1e-9) * 20.0).round() as usize).min(20);
        let mut s = String::from("[");
        for i in 0..20 { s.push(if i < f { '█' } else { '░' }); }
        s.push(']'); s
    };

    let mut out = String::with_capacity(2600);
    write!(out,
        "METALLURGY_KERNEL v1.0 // SPECTRAL SIGNAL DIFFERENTIATION\n\
         ══════════════════════════════════════════════════════════\n\
         N/pop={n}  sep={sep:.2}  σ_noise={sig:.2}  passes={npas}  thr={thr:.2}\n\
         Violet (λ≈405nm): L*={vl}  a*={va}  b*={vb}\n\
         Lila   (λ≈420nm): L*={ll}  a*={la:.1}  b*={lb}\n\
         ──────────────────────────────────────────────────────────\n\
         ΔE*ab DISTRIBUTION (pairwise, {s}×{s} sample)\n\
         range: [{de_min:.2}, {de_max:.2}]  μ={de_mean:.3}  σ={de_std:.3}\n",
        n=n, sep=sep, sig=sig, npas=npas, thr=thr,
        vl=vl, va=va, vb=vb, ll=ll, la=la, lb=lb,
        s=samp, de_min=de_min, de_max=de_max, de_mean=de_mean, de_std=de_std,
    ).unwrap();
    for (i, &h) in hist.iter().enumerate() {
        let lo = de_min + i as f64 * bin_w;
        write!(out, "  [{:5.2},{:5.2})  {:>4}  {}\n",
            lo, lo + bin_w, h, bar(h as f64, hist_max)).unwrap();
    }
    write!(out,
        "──────────────────────────────────────────────────────────\n\
         DISCRIMINABILITY  (Signal Detection Theory — Green & Swets 1966)\n\
         σ_pooled : {sp:.4}   centre_sep : {cs:.4}\n\
         d'       : {dp:.4}   threshold  : {thr:.2}\n\
         above threshold? {at}\n\
         VERDICT  : {verdict}\n\
         ──────────────────────────────────────────────────────────\n\
         FISHER LDA (between/within variance ratio)\n\
         B = {b:.3}   W = {w:.3}   B/W = {fr:.4}\n\
         ──────────────────────────────────────────────────────────\n\
         MEAN-SHIFT REFINEMENT ({npas} passes)\n\
         Violet cluster: {nv} pts  centre=({cvl:.2},{cva:.2},{cvb:.2})\n\
         Lila   cluster: {nl} pts  centre=({cll:.2},{cla:.2},{clb:.2})\n\
         Cluster purity : {pur:.4} ({pur_pct:.1}%)\n\
         ──────────────────────────────────────────────────────────\n\
         THEORY : MacAdam (1942) CIE LAB ellipses\n\
                  Green & Swets (1966) Signal Detection Theory\n\
         SOURCE : content/rust_kernels/src/kernels/metallurgy_kernel.rs",
        sp=sigma_pooled, cs=centre_sep, dp=d_prime, thr=thr,
        at=if d_prime >= thr { "YES" } else { "NO" },
        verdict=verdict,
        b=between, w=within, fr=fisher_ratio,
        npas=npas,
        nv=pop_v.len(), cvl=cv[0], cva=cv[1], cvb=cv[2],
        nl=pop_l.len(), cll=cl[0], cla=cl[1], clb=cl[2],
        pur=purity, pur_pct=purity*100.0,
    ).unwrap();

    out
}
