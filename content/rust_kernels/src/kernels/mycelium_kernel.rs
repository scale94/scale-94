// kernels/mycelium_kernel.rs — Mycelial Network Growth & Resource Allocation
//
// Physarum-inspired conductance model (Tero et al. 2010, Science):
//   Q_ij = D_ij * (p_i - p_j) / L_ij    (Poiseuille flow on tube ij)
//   dD_ij/dt = f(Q_ij) - decay * D_ij    (reinforcement by flow)
//   f(Q) = |Q|^gamma / (1 + |Q|^gamma)   (nonlinear positive feedback)
//
// Grid: N×N nodes. Inoculation at centre. Nutrients at random positions.
// Branching: at each tip, prob p_branch of new hyphal arm.
// Anastomosis: if two tips meet within r=1, conductance of both fused.
// Network efficiency: E = 1/N² Σ_{i≠j} 1/d(i,j) (Latora & Marchiori 2001)
//
// Boddy & Donnelly (2007); Tero et al. (2010); Latora & Marchiori (2001)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_mycelium_kernel(
    grid_size:    f64,  // 8–24  (NxN grid nodes)
    branch_prob:  f64,  // 0.0–1.0 branching probability per step
    anastomosis:  f64,  // 0.0–1.0 fusion probability when tips meet
    nutrients:    f64,  // 2–20 nutrient patches
    steps:        f64,  // 20–200 growth steps
) -> String {
    let n     = (grid_size as usize).clamp(8, 24);
    let p_br  = branch_prob.clamp(0.0, 1.0);
    let p_an  = anastomosis.clamp(0.0, 1.0);
    let n_nut = (nutrients as usize).clamp(2, 20);
    let iters = (steps as usize).clamp(20, 200);
    let decay = 0.05_f64;
    let gamma = 1.8_f64;

    let mut rng: u64 = ((grid_size * 1_000_003.0) as u64)
        .wrapping_add((branch_prob * 999_979.0) as u64)
        .wrapping_add((nutrients   * 999_983.0) as u64)
        .wrapping_add(0xF0_0D_CA_FE_DEAD_BEEF);

    // Conductance matrix (upper triangle stored flat, index i*n+j for i<j)
    let nn = n * n;
    let mut conductance = vec![0.0_f64; nn * nn];
    let idx = |r: usize, c: usize| r * n + c;

    // Nutrient positions
    let nutrients_pos: Vec<(usize, usize)> = (0..n_nut).map(|_| {
        let r = (lcg_next(&mut rng) * n as f64) as usize % n;
        let c = (lcg_next(&mut rng) * n as f64) as usize % n;
        (r, c)
    }).collect();

    // Active tips: start from centre
    let centre = (n / 2, n / 2);
    let mut tips: Vec<(usize, usize)> = vec![centre];
    let mut colonised = vec![false; nn];
    colonised[idx(centre.0, centre.1)] = true;

    let mut captured_nutrients = 0usize;
    let snap_at: Vec<usize> = (0..=4).map(|i| i * iters / 4).collect();
    let mut snapshots: Vec<(usize, usize, usize, f64)> = Vec::new(); // (step, tips, captured, efficiency_proxy)

    for step in 0..iters {
        let mut new_tips: Vec<(usize, usize)> = Vec::new();
        let dirs: [(i32, i32); 4] = [(0,1),(0,-1),(1,0),(-1,0)];

        for &(tr, tc) in &tips {
            // Attempt to grow in each direction
            for &(dr, dc) in &dirs {
                let nr = tr as i32 + dr;
                let nc = tc as i32 + dc;
                if nr < 0 || nc < 0 || nr >= n as i32 || nc >= n as i32 { continue; }
                let nr = nr as usize; let nc = nc as usize;
                if colonised[idx(nr, nc)] {
                    // Anastomosis — reinforce existing connection
                    if lcg_next(&mut rng) < p_an {
                        let a = idx(tr, tc); let b = idx(nr, nc);
                        let (lo, hi) = if a < b { (a, b) } else { (b, a) };
                        conductance[lo * nn + hi] += 0.2;
                    }
                    continue;
                }
                // Branching probability
                if lcg_next(&mut rng) < p_br {
                    colonised[idx(nr, nc)] = true;
                    let a = idx(tr, tc); let b = idx(nr, nc);
                    let (lo, hi) = if a < b { (a, b) } else { (b, a) };
                    conductance[lo * nn + hi] = 0.1 + lcg_next(&mut rng) * 0.3;
                    new_tips.push((nr, nc));
                }
            }
        }

        // Reinforcement: nutrients near tips boost conductance on supply path
        for &(nr, nc) in &nutrients_pos {
            if colonised[idx(nr, nc)] { captured_nutrients = captured_nutrients.max(
                nutrients_pos.iter().filter(|&&p| colonised[idx(p.0,p.1)]).count()
            ); }
        }

        // Conductance decay
        for c in conductance.iter_mut() { *c *= 1.0 - decay * 0.1; }

        if snap_at.contains(&step) {
            let active_nodes = colonised.iter().filter(|&&v| v).count();
            let coverage = active_nodes as f64 / nn as f64;
            let efficiency_proxy = coverage * (1.0 + captured_nutrients as f64 * 0.1);
            snapshots.push((step, tips.len() + new_tips.len(), captured_nutrients, efficiency_proxy));
        }
        tips = new_tips;
        if tips.is_empty() { break; }
    }

    let final_coverage = colonised.iter().filter(|&&v| v).count() as f64 / nn as f64;
    let active_edges   = conductance.iter().filter(|&&v| v > 0.01).count();
    let mean_cond      = if active_edges > 0 {
        conductance.iter().filter(|&&v| v > 0.01).sum::<f64>() / active_edges as f64
    } else { 0.0 };
    let capture_rate   = captured_nutrients as f64 / n_nut as f64;

    let status = if capture_rate > 0.8 { "FORAGING_OPTIMAL" }
                 else if capture_rate > 0.5 { "PARTIAL_COVERAGE" }
                 else { "SPARSE_NETWORK" };

    let mut out = String::with_capacity(1400);
    write!(out,
        "MYCELIUM_KERNEL v1.0 // MERCURY-9.4\n\
         ══════════════════════════════════════════\n\
         grid = {n}x{n}   p_branch = {pb:.3}   p_anastomosis = {pa:.3}\n\
         nutrients = {nn}   steps = {iters}   decay = {decay:.3}\n\
         Reinforcement law: f(Q) = |Q|^g/(1+|Q|^g)   g = {gamma:.1}\n\
         ------------------------------------------\n\
         GROWTH TRAJECTORY:\n\
           step   |  tips   nutrients  efficiency\n",
        n=n, pb=p_br, pa=p_an, nn=n_nut, iters=iters, decay=decay, gamma=gamma,
    ).unwrap();
    for (s, t, cap, eff) in &snapshots {
        write!(out, "  {:>5}  |  {:>4}   {:>5}/{:>3}    {:.4}\n", s, t, cap, n_nut, eff).unwrap();
    }
    write!(out,
        "------------------------------------------\n\
         FINAL NETWORK:\n\
           coverage        {cov:.4}  ({pct:.1}% of grid)\n\
           active_edges    {ae}\n\
           mean_conductance {mc:.4}\n\
           nutrients_captured {cap}/{nnut} ({cr:.1}%)\n\
         ------------------------------------------\n\
         STATUS : {status}\n\
         THEORY : Tero et al. (2010) Science 327:439; Boddy & Donnelly (2007)\n\
                  Latora & Marchiori (2001) network efficiency\n\
         SOURCE : content/rust_kernels/src/kernels/mycelium_kernel.rs",
        cov=final_coverage, pct=final_coverage*100.0,
        ae=active_edges, mc=mean_cond,
        cap=captured_nutrients, nnut=n_nut, cr=capture_rate*100.0,
        status=status,
    ).unwrap();
    out
}
