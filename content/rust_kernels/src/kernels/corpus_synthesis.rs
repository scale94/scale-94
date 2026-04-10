// kernels/corpus_synthesis.rs — Latent Dirichlet Allocation (Simplified VEM)
//
// Variational EM approximation to LDA (Blei, Ng & Jordan 2003).
// K topics, D documents, V vocabulary terms.
// Synthetic documents drawn from Dirichlet(alpha) topic prior.
// E-step: q(z_n=k) proportional to phi_{k,w_n} * theta_{d,k}  (word-topic assignment)
// M-step: update phi (topic-term) and theta (doc-topic) from expected counts.
// Perplexity: exp(-log-likelihood / total_word_count).
//
// Blei, Ng & Jordan (2003) JMLR; Griffiths & Steyvers (2004)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_corpus_synthesis(
    n_topics:   f64,  // 2–8 topics K
    n_docs:     f64,  // 10–50 documents D
    vocab_size: f64,  // 10–50 vocabulary terms V
    alpha:      f64,  // 0.01–1.0 Dirichlet prior alpha
    iterations: f64,  // 10–50 EM iterations
) -> String {
    let k     = (n_topics as usize).clamp(2, 8);
    let d     = (n_docs as usize).clamp(10, 50);
    let v     = (vocab_size as usize).clamp(10, 50);
    let alpha = alpha.clamp(0.01, 1.0);
    let iters = (iterations as usize).clamp(10, 50);
    let words_per_doc = 20usize;

    let mut rng: u64 = ((n_topics * 1_000_003.0) as u64)
        .wrapping_add((n_docs * 999_979.0) as u64)
        .wrapping_add((vocab_size * 999_983.0) as u64)
        .wrapping_add(0xAB_CD_EF_01_23_45);

    // Sample Dirichlet(alpha) via Gamma approximation (alpha small: use exponential)
    let dirichlet = |size: usize, a: f64, rng: &mut u64| -> Vec<f64> {
        let mut samples: Vec<f64> = (0..size).map(|_| {
            let u = lcg_next(rng).max(1e-12);
            -a * u.ln() // Gamma(alpha,1) approximation for small alpha
        }).collect();
        let sum: f64 = samples.iter().sum::<f64>().max(1e-12);
        samples.iter_mut().for_each(|x| *x /= sum);
        samples
    };

    // True topic-term distributions (used to generate corpus)
    let true_phi: Vec<Vec<f64>> = (0..k).map(|_| dirichlet(v, 0.1, &mut rng)).collect();

    // Generate synthetic corpus: each doc has topic mix, then words
    let doc_topics: Vec<Vec<f64>> = (0..d).map(|_| dirichlet(k, alpha, &mut rng)).collect();
    let corpus: Vec<Vec<usize>> = doc_topics.iter().map(|theta_d| {
        (0..words_per_doc).map(|_| {
            // Sample topic
            let r = lcg_next(&mut rng);
            let mut cum = 0.0;
            let mut topic = k - 1;
            for (t, &prob) in theta_d.iter().enumerate() {
                cum += prob;
                if r < cum { topic = t; break; }
            }
            // Sample word from that topic
            let r2 = lcg_next(&mut rng);
            let mut cum2 = 0.0;
            let mut word = v - 1;
            for (w, &prob) in true_phi[topic].iter().enumerate() {
                cum2 += prob;
                if r2 < cum2 { word = w; break; }
            }
            word
        }).collect()
    }).collect();

    // Initialise variational parameters
    let mut phi_est: Vec<Vec<f64>> = (0..k).map(|_| {
        let mut p = dirichlet(v, 1.0, &mut rng);
        p.iter_mut().for_each(|x| *x += 1e-6 / v as f64);
        let s: f64 = p.iter().sum();
        p.iter_mut().for_each(|x| *x /= s);
        p
    }).collect();
    let mut theta_est: Vec<Vec<f64>> = (0..d).map(|_| dirichlet(k, alpha, &mut rng)).collect();

    let snap_at: Vec<usize> = (0..=4).map(|i| i * iters / 4).collect();
    let mut perplexities: Vec<(usize, f64)> = Vec::new();

    let compute_ll = |phi: &[Vec<f64>], theta: &[Vec<f64>]| -> f64 {
        let mut ll = 0.0_f64;
        for (d_i, doc) in corpus.iter().enumerate() {
            for &w in doc {
                let prob: f64 = (0..k).map(|t| theta[d_i][t] * phi[t][w]).sum::<f64>().max(1e-12);
                ll += prob.ln();
            }
        }
        ll
    };

    for step in 0..iters {
        // E-step: update doc-topic given phi
        for d_i in 0..d {
            let mut new_theta = vec![alpha; k];
            for &w in &corpus[d_i] {
                let probs: Vec<f64> = (0..k).map(|t| phi_est[t][w] * theta_est[d_i][t]).collect();
                let sum: f64 = probs.iter().sum::<f64>().max(1e-12);
                for t in 0..k { new_theta[t] += probs[t] / sum; }
            }
            let sum: f64 = new_theta.iter().sum::<f64>().max(1e-12);
            theta_est[d_i] = new_theta.iter().map(|x| x / sum).collect();
        }
        // M-step: update topic-term given theta
        let mut new_phi = vec![vec![1e-6_f64; v]; k];
        for (d_i, doc) in corpus.iter().enumerate() {
            for &w in doc {
                let probs: Vec<f64> = (0..k).map(|t| phi_est[t][w] * theta_est[d_i][t]).collect();
                let sum: f64 = probs.iter().sum::<f64>().max(1e-12);
                for t in 0..k { new_phi[t][w] += probs[t] / sum; }
            }
        }
        for t in 0..k {
            let sum: f64 = new_phi[t].iter().sum::<f64>().max(1e-12);
            phi_est[t] = new_phi[t].iter().map(|x| x / sum).collect();
        }
        if snap_at.contains(&step) {
            let ll = compute_ll(&phi_est, &theta_est);
            let perp = (-ll / (d * words_per_doc) as f64).exp();
            perplexities.push((step, perp));
        }
    }

    // Topic coherence: mean top-3 word probability product
    let coherence: Vec<f64> = (0..k).map(|t| {
        let mut sorted = phi_est[t].clone();
        sorted.sort_by(|a,b| b.partial_cmp(a).unwrap());
        sorted[0] * sorted[1] * sorted[2]
    }).collect();
    let mean_coherence = coherence.iter().sum::<f64>() / k as f64;

    let mut out = String::with_capacity(1400);
    write!(out,
        "CORPUS_SYNTHESIS v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         K = {k}   D = {d}   V = {v}   alpha = {alpha:.4}   iters = {iters}\n\
         ------------------------------------------\n\
         PERPLEXITY (lower = better fit):\n\
           iter   |  perplexity\n",
        k=k, d=d, v=v, alpha=alpha, iters=iters,
    ).unwrap();
    for (s, perp) in &perplexities {
        write!(out, "  {:>5}  |  {:.4}\n", s, perp).unwrap();
    }
    write!(out, "------------------------------------------\nTOPIC-TERM DISTRIBUTIONS (top-3 terms):\n").unwrap();
    for t in 0..k {
        let mut term_probs: Vec<(usize, f64)> = phi_est[t].iter().cloned().enumerate().collect();
        term_probs.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap());
        write!(out, "  topic_{t}: ").unwrap();
        for (w, p) in term_probs.iter().take(3) {
            write!(out, "w{w}({p:.3}) ").unwrap();
        }
        write!(out, "  coherence={:.5}\n", coherence[t]).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         MEAN_COHERENCE = {mc:.5}\n\
         THEORY : Blei, Ng & Jordan (2003) JMLR 3:993\n\
                  Griffiths & Steyvers (2004) PNAS 101:5228\n\
         SOURCE : content/rust_kernels/src/kernels/corpus_synthesis.rs",
        mc=mean_coherence,
    ).unwrap();
    out
}
