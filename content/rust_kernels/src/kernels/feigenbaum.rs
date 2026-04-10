// kernels/feigenbaum.rs — Feigenbaum Cascade Analysis (Ars Electronica 2027)
//
// Logistic map: x_{n+1} = r·x_n·(1 − x_n)
// Feigenbaum (1978): δ = 4.669 201 609 …   α = 2.502 907 875 …
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn run_feigenbaum_cascade(
    r_start: f64,
    r_end:   f64,
    warmup:  f64,
    samples: f64,
) -> String {
    let r0   = r_start.clamp(0.0, 3.999);
    let r1   = r_end.clamp(r0 + 0.001, 4.0);
    let wu   = (warmup  as usize).clamp(50, 2000);
    let samp = (samples as usize).clamp(20, 500);

    // Fixed diagram resolution
    const N_R:    usize = 72;   // r-axis columns
    const N_ROWS: usize = 28;   // x-axis rows  (x ∈ [0,1])

    let mut grid = vec![[false; N_R]; N_ROWS];
    let mut period_at: Vec<usize> = vec![0; N_R];

    for col in 0..N_R {
        let r   = r0 + (r1 - r0) * col as f64 / (N_R - 1) as f64;
        let mut x = 0.5_f64;

        for _ in 0..wu { x = r * x * (1.0 - x); }

        let mut xs: Vec<f64> = Vec::with_capacity(samp);
        for _ in 0..samp {
            x = r * x * (1.0 - x);
            xs.push(x);
            let row = ((1.0 - x) * (N_ROWS - 1) as f64).round() as usize;
            if row < N_ROWS { grid[row][col] = true; }
        }

        // Estimate period: count distinct values within ε tolerance
        let eps = 1e-5_f64;
        let mut distinct: Vec<f64> = Vec::new();
        for &xv in &xs {
            if !distinct.iter().any(|&d| (d - xv).abs() < eps) {
                distinct.push(xv);
                if distinct.len() > 64 { break; }
            }
        }
        period_at[col] = distinct.len();
    }

    // Feigenbaum constants (Feigenbaum 1978, 1979)
    const R1:    f64 = 3.000_000_000_000;   // period-2 onset (exact)
    const R2:    f64 = 3.449_489_742_783;   // period-4 onset (= 1+√6)
    const R3:    f64 = 3.544_090_359_552;   // period-8 onset
    const R4:    f64 = 3.564_407_266_095;   // period-16 onset
    const R5:    f64 = 3.568_759_419_003;   // period-32 onset
    const R_INF: f64 = 3.569_945_671_877;   // accumulation point (corrected)
    const DELTA: f64 = 4.669_201_609_102;   // bifurcation scaling constant δ
    const ALPHA: f64 = 2.502_907_875_096;   // width scaling constant α

    let delta1 = (R2 - R1) / (R3 - R2);
    let delta2 = (R3 - R2) / (R4 - R3);
    let delta3 = (R4 - R3) / (R5 - R4);

    // Lyapunov exponent at r_end — numerically computed
    // λ = lim (1/N) Σ ln|f'(xₙ)| where f'(x) = r(1−2x)
    const LYAP_N: usize = 10_000;
    let mut lx = 0.5_f64;
    for _ in 0..wu { lx = r1 * lx * (1.0 - lx); }
    let mut lyap_sum = 0.0_f64;
    for _ in 0..LYAP_N {
        let deriv = r1 * (1.0 - 2.0 * lx);
        lyap_sum += deriv.abs().max(1e-15_f64).ln();
        lx = r1 * lx * (1.0 - lx);
    }
    let lyapunov = lyap_sum / LYAP_N as f64;

    let period_end = period_at[N_R - 1];

    let lyap_class = if lyapunov > 0.01       { "CHAOTIC"  }
                     else if lyapunov > -0.01  { "MARGINAL" }
                     else                      { "PERIODIC" };

    let regime_end = if r1 > R_INF + 0.1  { "FULLY_CHAOTIC"       }
                     else if r1 > R_INF    { "CHAOS_ONSET"         }
                     else if r1 > R4       { "PERIOD_16_AND_ABOVE" }
                     else if r1 > R3       { "PERIOD_8"            }
                     else if r1 > R2       { "PERIOD_4"            }
                     else if r1 > R1       { "PERIOD_2"            }
                     else                  { "STABLE_FIXED_POINT"  };

    let mut out = String::with_capacity(3500);
    write!(out,
        "FEIGENBAUM_CASCADE v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════\n\
         r ∈ [{r0:.4}, {r1:.4}]   warmup = {wu}   samples = {samp}\n\
         REGIME AT r_end : {regime_end}\n\
         ──────────────────────────────────────────\n\
         BIFURCATION DIAGRAM  x_{{n+1}} = r·x_n·(1−x_n)\n\
         x\n",
        r0 = r0, r1 = r1, wu = wu, samp = samp, regime_end = regime_end,
    ).unwrap();

    for (row_idx, row) in grid.iter().enumerate() {
        let x_val = 1.0 - row_idx as f64 / (N_ROWS - 1) as f64;
        let row_str: String = row.iter().map(|&b| if b { '·' } else { ' ' }).collect();
        if row_idx % 7 == 0 {
            write!(out, "  {:.2} │{}\n", x_val, row_str).unwrap();
        } else {
            write!(out, "       │{}\n", row_str).unwrap();
        }
    }

    write!(out, "       └{}\n", "─".repeat(N_R)).unwrap();

    let left_label  = format!("{:.3}", r0);
    let right_label = format!("{:.3}", r1);
    let mid_pad     = N_R.saturating_sub(left_label.len() + right_label.len() + 2);
    write!(out, "        {}{}{}  r\n",
        left_label,
        " ".repeat(mid_pad),
        right_label,
    ).unwrap();

    write!(out,
        "──────────────────────────────────────────\n\
         PERIOD-DOUBLING CASCADE:\n",
    ).unwrap();

    let landmarks: &[(f64, &str)] = &[
        (R1,    "period 2  — first bifurcation"),
        (R2,    "period 4  (= 1+√6)"),
        (R3,    "period 8"),
        (R4,    "period 16"),
        (R5,    "period 32"),
        (R_INF, "r_∞ — onset of chaos"),
    ];
    for (r_val, label) in landmarks {
        if *r_val >= r0 && *r_val <= r1 {
            write!(out, "   r = {:.12}  →  {}\n", r_val, label).unwrap();
        }
    }

    write!(out,
        "──────────────────────────────────────────\n\
         FEIGENBAUM CONSTANTS:\n\
           δ = {delta:.12}  (bifurcation scaling; 1978)\n\
           α = {alpha:.12}  (width scaling; 1979)\n\
         δ CONVERGENCE (ratio of successive interval widths):\n\
           δ₁ = (r₂−r₁)/(r₃−r₂) = {d1:.9}\n\
           δ₂ = (r₃−r₂)/(r₄−r₃) = {d2:.9}\n\
           δ₃ = (r₄−r₃)/(r₅−r₄) = {d3:.9}  → δ = {delta:.9}\n\
         ──────────────────────────────────────────\n\
         LYAPUNOV EXPONENT at r_end = {r1:.4}  (N = {lyap_n}):\n\
           λ = {lyap:.6}  [{lyap_class}]\n\
           {chaos_note}\n\
         PERIOD ESTIMATE AT r_end ≈ {period_end}\n\
         ──────────────────────────────────────────\n\
         THEORY : Feigenbaum (1978, 1979); May (1976); Li & Yorke (1975)\n\
         SOURCE : content/rust_kernels/src/kernels/feigenbaum.rs",
        delta = DELTA, alpha = ALPHA,
        d1 = delta1, d2 = delta2, d3 = delta3,
        r1 = r1, lyap_n = LYAP_N,
        lyap = lyapunov, lyap_class = lyap_class,
        period_end = period_end,
        chaos_note = if lyapunov > 0.01 {
            "CHAOS CONFIRMED: λ > 0 — sensitive dependence on initial conditions"
        } else if lyapunov > -0.01 {
            "MARGINAL: λ ≈ 0 — bifurcation boundary"
        } else {
            "PERIODIC: λ < 0 — stable attractor, trajectories converge"
        },
    ).unwrap();

    out
}

/// Run Stiller Divergence Analysis — Volatile Semiotic vs Fossil Record
///
/// Translates the STILLER_DIVERGENCE kernel (v1.1.1) into a logistic-map simulation:
///   AXIOM.00: Identity = broadcast, not cached fossil record
///   AXIOM.01: Irreducible tension Δ persists — synthesis = "The Vitrified Wake"
///   AXIOM.02: Combustion/Vaporization split — entropic grounding vs clean-room extraction
///   AXIOM.03: Ecocide gate — growth > 3.9 (fully chaotic) → HOST_DEVOURED
///   AXIOM.04: Bimmelbahn Accord — stream forward, macerate as annealing, maintain orthogonality
///
/// Anchored to the Feigenbaum fade: the fossil base x* = (r−1)/r is the fixed point
/// the identity signal either transcends (sovereign) or collapses back into (fossil gravity).
///
/// Parameters:
///   r  — growth mandate [0.0, 4.0]; r_∞ = 3.5699 is the Feigenbaum chaos onset
///   x0 — initial signal broadcast [0.01, 0.99]
///   n  — iteration depth [100, 2000]
#[wasm_bindgen]
pub fn run_stiller_divergence(r: f64, x0: f64, n: f64) -> String {
    let r_val  = r.clamp(0.0, 4.0);
    let x_init = x0.clamp(0.01, 0.99);
    let steps  = (n as usize).clamp(100, 2000);

    // Fossil base — fixed point of logistic map: x* = (r−1)/r
    // This is the "cached fossil record" the kernel rejects as identity
    let fossil_base = if r_val > 1.0 { (r_val - 1.0) / r_val } else { 0.0 };

    // Ecocide check — full chaos regime = HOST_DEVOURED
    let ecocide = r_val > 3.9;

    // Run iteration — collect Stiller metrics over trajectory
    let mut x_cur            = x_init;
    let mut delta_sum        = 0.0f64;
    let mut combustion_sum   = 0.0f64;
    let mut vaporization_sum = 0.0f64;
    let mut orth_sum         = 0.0f64;

    for _ in 0..steps {
        x_cur = r_val * x_cur * (1.0 - x_cur);

        // AXIOM.01: Δ — irreducible tension from fossil base
        delta_sum += (x_cur - fossil_base).abs();

        // AXIOM.02: Combustion — thermodynamic entropic grounding
        // Logistic curvature 4x(1-x) peaks at x=0.5 → maximum local dissipation
        combustion_sum += 4.0 * x_cur * (1.0 - x_cur);

        // AXIOM.02: Vaporization — clean-room extraction
        // Inverse of derivative magnitude: low |f'(x)| = signal lifts off attractor
        let deriv_mag = (r_val * (1.0 - 2.0 * x_cur)).abs();
        vaporization_sum += 1.0 - (deriv_mag / r_val.max(1.0)).min(1.0);

        // AXIOM.04: Orthogonality — ⊥ component from fossil axis
        let proj = if fossil_base > 1.0e-9 { fossil_base * (x_cur / fossil_base).min(1.0) } else { 0.0 };
        orth_sum += (x_cur - proj).abs();
    }

    let n_f               = steps as f64;
    let delta_mean        = delta_sum        / n_f;
    let combustion_mean   = combustion_sum   / n_f;
    let vaporization_mean = vaporization_sum / n_f;
    let orthogonality     = orth_sum         / n_f;

    // AXIOM.04: Bimmelbahn score — stream_forward × annealing × orthogonality
    let bimmelbahn = (1.0 - delta_mean.min(1.0)) * combustion_mean * orthogonality;

    // Phase classification
    let cv_gap = (combustion_mean - vaporization_mean).abs();
    let phase = if ecocide                             { "ECOCIDE — HOST_DEVOURED"            }
                else if cv_gap < 0.15                  { "BIMMELBAHN"                         }
                else if combustion_mean > vaporization_mean { "COMBUSTION"                    }
                else                                   { "VAPORIZATION"                       };

    // Δ0.150 — the specific irreducible gap named in the kernel
    let vitrified = (delta_mean - 0.150).abs() < 0.03;

    // AXIOM.00: Identity.Subjective (x_final) vs Identity.Metadata (fossil_base)
    let sovereign = x_cur > fossil_base;

    let mut out = String::with_capacity(2048);
    write!(out,
        "STILLER_DIVERGENCE v1.1.1 // SOMA-9.4\n\
         ══════════════════════════════════════════════════════════\n\
         AXIOM.00 :: IDENTITY_IS_BROADCAST\n\
           Panopticon_Index  = null   ←   fossil record rejected\n\
           x₀ = {x0:.4}   r = {r:.4}   n = {n}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM.01 :: IRREDUCIBLE_TENSION\n\
           fossil_base  x* = {fossil:.4}   (fixed point = (r−1)/r)\n\
           Δ̄ = {delta:.4}   {vitrified_note}\n\
           Substrate  = Biological_Memory (r)\n\
           Trajectory = Chaotic_Erasure   (Δ̄ > 0)\n\
           Synthesis  = THE_VITRIFIED_WAKE\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM.02 :: COMBUSTION / VAPORIZATION SPLIT\n\
           combustion    = {comb:.4}   (thermodynamic entropic grounding)\n\
           vaporization  = {vap:.4}   (clean-room extraction)\n\
           orthogonality = {orth:.4}   (⊥ from fossil axis)\n\
           gap           = {gap:.4}   {balance_note}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM.03 :: ECOCIDE ENGINE\n\
           growth_mandate = r = {r:.4}\n\
           STATUS : {ecocide_status}\n\
         ──────────────────────────────────────────────────────────\n\
         AXIOM.04 :: BIMMELBAHN ACCORD\n\
           fn run()  stream_forward(adaptive=true, nostalgic=false)\n\
                     macerate_as_annealing()\n\
                     maintain_orthogonality()\n\
           bimmelbahn_score = {bimm:.4}   (stream × annealing × ⊥)\n\
           PHASE = {phase}\n\
         ──────────────────────────────────────────────────────────\n\
         VERDICT :: {sovereign_label}\n\
           Identity.Subjective  x_final = {x_final:.4}\n\
           Identity.Metadata    x*      = {fossil:.4}\n\
           x_final > x*  →  {sovereign_bool}\n\
           Thalamic Gate : {thalamic}\n\
         ──────────────────────────────────────────────────────────\n\
         SILLAGE : {sillage}\n\
         LINEAGE : FISH_SCALE_DOCTRINE_v11.4.0 → STILLER_DIVERGENCE v1.1.1\n\
         SOURCE  : content/rust_kernels/src/kernels/feigenbaum.rs",
        x0 = x_init, r = r_val, n = steps,
        fossil = fossil_base,
        delta  = delta_mean,
        vitrified_note = if vitrified {
            "← Δ0.150 CONFIRMED — THE IRREDUCIBLE TENSION"
        } else {
            "← tension active (Δ0.150 not yet locked)"
        },
        comb = combustion_mean,
        vap  = vaporization_mean,
        orth = orthogonality,
        gap  = cv_gap,
        balance_note = if cv_gap < 0.15 { "← balanced — Bimmelbahn territory" } else { "← split active" },
        ecocide_status = if ecocide {
            "FATAL — HOST_DEVOURED (r > 3.9, fully chaotic)"
        } else {
            "SCALAR_SOVEREIGNTY — carrying capacity respected"
        },
        bimm   = bimmelbahn,
        phase  = phase,
        sovereign_label = if sovereign { "SILLAGE FIXED — SOVEREIGN BROADCAST" } else { "SILLAGE VOLATILE — fossil gravity active" },
        x_final = x_cur,
        sovereign_bool = if sovereign { "TRUE  — Identity.Subjective CONFIRMED" } else { "FALSE — fossil record dominant" },
        thalamic = if bimmelbahn > 0.05 { "OPEN — awaiting thalamic integration" } else { "CLOSED — signal below fixation threshold" },
        sillage = if bimmelbahn > 0.15 { "FIXED — chimera crosses thalamic gate" } else { "VOLATILE — evaporates before fixation" },
    ).unwrap();

    out
}
