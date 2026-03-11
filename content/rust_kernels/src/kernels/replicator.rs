// kernels/replicator.rs — Evolutionary Replicator Dynamics (Ars Electronica 2027)
//
// Three competing strategies on the unit simplex Δ² = {(x,y,z) : x+y+z = 1}.
//   C — Cooperators: contribute to commons, pay cost c
//   D — Defectors:   free-ride; avoid punishment when meeting A
//   A — Altruists:   cooperate AND punish defectors at personal cost
//
// Replicator equation with mutation μ (Hofbauer & Sigmund 1998):
//   ẋ_i = x_i·(f_i − f̄) + μ·(1/3 − x_i)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn run_evolutionary_replicator(
    benefit:     f64,
    cost:        f64,
    punishment:  f64,
    mutation:    f64,
    generations: f64,
) -> String {
    let b    = benefit.clamp(0.1, 5.0);
    let c    = cost.clamp(0.0, 3.0);
    let p    = punishment.clamp(0.0, 3.0);
    let mu   = mutation.clamp(0.0, 0.5);
    let gens = (generations as usize).clamp(50, 2000);
    let dt   = 0.1_f64;

    // Payoff matrix: pay[row_strategy][col_strategy]
    // 0 = Cooperator, 1 = Defector, 2 = Altruist
    let pay: [[f64; 3]; 3] = [
        [b - c,          -c,            b - c        ],  // C vs {C, D, A}
        [b,               0.0,          b - p        ],  // D vs {C, D, A}
        [b - c,         -(c + p * 0.5), b - c + p * 0.5], // A vs {C, D, A}
    ];

    // Start near equal split (slight cooperator advantage, Ostrom-adjacent)
    let mut x = [0.34_f64, 0.34_f64, 0.32_f64]; // [C, D, A]

    let snap_at: Vec<usize> = (0..=5).map(|i| i * gens / 5).collect();
    let mut snapshots: Vec<(usize, [f64; 3], [f64; 3])> = Vec::new();

    for t in 0..gens {
        // Fitness: f_i = Σ_j pay[i][j] · x[j]
        let f: [f64; 3] = [
            pay[0][0] * x[0] + pay[0][1] * x[1] + pay[0][2] * x[2],
            pay[1][0] * x[0] + pay[1][1] * x[1] + pay[1][2] * x[2],
            pay[2][0] * x[0] + pay[2][1] * x[1] + pay[2][2] * x[2],
        ];
        let f_bar: f64 = x[0] * f[0] + x[1] * f[1] + x[2] * f[2];

        if snap_at.contains(&t) {
            snapshots.push((t, x, f));
        }

        // Euler step: ẋ_i = x_i·(f_i − f̄) + μ·(1/3 − x_i)
        let mut x_new = [0.0_f64; 3];
        for i in 0..3 {
            x_new[i] = x[i] + dt * (x[i] * (f[i] - f_bar) + mu * (1.0 / 3.0 - x[i]));
        }
        // Project back to simplex (correct numerical drift)
        let total: f64 = x_new.iter().sum::<f64>().max(1e-10);
        for i in 0..3 { x[i] = (x_new[i] / total).clamp(0.0, 1.0); }
    }

    let b_over_c = if c > 1e-9 { b / c } else { 999.9 };
    let cooperating = x[0] + x[2];

    let outcome = if x[2] > 0.5 {
        "OSTROM EQUILIBRIUM — Altruist governance dominant"
    } else if x[0] > 0.5 {
        "COOPERATIVE COMMONS — Cooperators prevailing"
    } else if x[1] > 0.5 {
        "DEFECTOR DOMINANCE — Tragedy of the commons"
    } else {
        "MIXED POLYMORPHISM — Rock-paper-scissors cycle"
    };

    let bar20 = |frac: f64| -> String {
        let filled = ((frac * 20.0).round() as usize).min(20);
        let mut s  = String::new();
        for i in 0..20 { s.push(if i < filled { '█' } else { '░' }); }
        s
    };

    let mut out = String::with_capacity(1100);
    write!(out,
        "EVOLUTIONARY_REPLICATOR v1.0 // SOMA-9.1\n\
         ══════════════════════════════════════════\n\
         b = {b:.2}  c = {c:.2}  p = {p:.2}  μ = {mu:.4}  T = {gens}\n\
         b/c = {boc:.3}   (b/c > 1 favours cooperation)\n\
         PAYOFF: A[D][A] = b−p = {dpa:.3}   A[A][D] = −(c+p/2) = {adp:.3}\n\
         ──────────────────────────────────────────\n\
         SIMPLEX TRAJECTORY  (C=Cooperator D=Defector A=Altruist):\n\
           T      │   C       D       A      dominant\n",
        b = b, c = c, p = p, mu = mu, gens = gens, boc = b_over_c,
        dpa = b - p, adp = -(c + p * 0.5),
    ).unwrap();

    for (t, fracs, fits) in &snapshots {
        let dom_i = fracs.iter().enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(i, _)| i)
            .unwrap_or(0);
        let dom = ["C", "D", "A"][dom_i];
        write!(out,
            "  {:>5}  │  {:.3}   {:.3}   {:.3}    {}   \
             f=[{:.2},{:.2},{:.2}]\n",
            t, fracs[0], fracs[1], fracs[2], dom,
            fits[0], fits[1], fits[2],
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         FINAL STATE:\n\
           COOPERATORS   {xc:.4}  {bc}\n\
           DEFECTORS     {xd:.4}  {bd}\n\
           ALTRUISTS     {xa:.4}  {ba}\n\
         ──────────────────────────────────────────\n\
         COOPERATING FRACTION: {coop:.4} (C + A)\n\
         OUTCOME: {outcome}\n\
         THEORY : Fehr & Gächter (2002); Hofbauer & Sigmund (1998)\n\
         SOURCE : content/rust_kernels/src/kernels/replicator.rs",
        xc = x[0], bc = bar20(x[0]),
        xd = x[1], bd = bar20(x[1]),
        xa = x[2], ba = bar20(x[2]),
        coop = cooperating, outcome = outcome,
    ).unwrap();

    out
}
