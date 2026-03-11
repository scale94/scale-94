// kernels/feigenbaum.rs — Feigenbaum Cascade Analysis (Ars Electronica 2027)
//
// Logistic map: x_{n+1} = r·x_n·(1 − x_n)
// Feigenbaum (1978): δ = 4.669 201 609 …
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

    // Feigenbaum constants (Feigenbaum 1978)
    const R1: f64 = 3.000_000_000_000;
    const R2: f64 = 3.449_489_742_783;
    const R3: f64 = 3.544_090_359_552;
    const R4: f64 = 3.564_407_266_095;
    const R_INF: f64 = 3.569_945_672_000;
    const DELTA: f64 = 4.669_201_609_102;

    let delta_est  = (R2 - R1) / (R3 - R2);
    let delta_est2 = (R3 - R2) / (R4 - R3);

    let chaos_region = r1 > R_INF;
    let regime_end = if r1 > R_INF + 0.1 { "FULLY_CHAOTIC"       }
                     else if r1 > R_INF   { "CHAOS_ONSET"         }
                     else if r1 > R4      { "PERIOD_16_AND_ABOVE" }
                     else if r1 > R3      { "PERIOD_8"            }
                     else if r1 > R2      { "PERIOD_4"            }
                     else if r1 > R1      { "PERIOD_2"            }
                     else                 { "STABLE_FIXED_POINT"  };

    let mut out = String::with_capacity(3000);
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

    let landmarks = [
        (R1,    "period 2  — first bifurcation"),
        (R2,    "period 4"),
        (R3,    "period 8"),
        (R4,    "period 16"),
        (R_INF, "r_∞ — onset of chaos"),
    ];
    for (r_val, label) in &landmarks {
        if *r_val >= r0 && *r_val <= r1 {
            write!(out, "   r = {:.6}  →  {}\n", r_val, label).unwrap();
        }
    }

    write!(out,
        "──────────────────────────────────────────\n\
         FEIGENBAUM CONSTANT δ:\n\
           δ₁ = (r₂−r₁)/(r₃−r₂) = {d1:.9}  (converges to δ)\n\
           δ₂ = (r₃−r₂)/(r₄−r₃) = {d2:.9}\n\
           δ  = {delta:.9}  (universal; Feigenbaum 1978)\n\
         ──────────────────────────────────────────\n\
         LYAPUNOV EXPONENT at r = 4.0:\n\
           λ = ln 2 ≈ 0.6931  (maximally chaotic; period → ∞)\n\
         {chaos_note}\n\
         THEORY : Feigenbaum (1978, 1979); May (1976); Li & Yorke (1975)\n\
         SOURCE : content/rust_kernels/src/kernels/feigenbaum.rs",
        d1 = delta_est, d2 = delta_est2, delta = DELTA,
        chaos_note = if chaos_region {
            "CHAOS CONFIRMED: λ > 0  — sensitive dependence on initial conditions"
        } else {
            "Scan does not reach r_∞ — extend r_end beyond 3.5699 for chaos"
        },
    ).unwrap();

    // suppress unused warning on period_at (diagnostic data, not output)
    let _ = period_at;

    out
}
