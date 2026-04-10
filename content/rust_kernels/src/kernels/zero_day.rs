// kernels/zero_day.rs — Zero-Day Vulnerability Cascade
//
// CVE epidemiology: SVEP model on a directed Barabási-Albert preferential-attachment network.
//
// States per node:
//   S = Susceptible (unaware of vulnerability)
//   V = Vulnerable  (0-day discovered but not yet exploited)
//   E = Exploited   (compromised host)
//   P = Patched     (remediated)
//
// Transitions (Euler over N=200 nodes, discrete probability per step):
//   S → V : discovery_rate  (new CVE published / reaches node)
//   V → E : exploit_rate    (rapid once known; amplified ×8 after cascade trigger)
//   E → P : patch_rate      (vendor/admin response latency)
//
// Cascade trigger: when cumulative exploited fraction ≥ 0.05 ("zero-day amplification"),
//   exploit_rate is multiplied by 8× for remainder of simulation.
//
// Barabási-Albert graph: N nodes added one at a time, each connecting to m=2 existing
//   nodes with probability proportional to degree (P(k) ~ k^-3).
//   Adjacency used for directed epidemic spread: E nodes attempt to exploit neighbours.
//
// Anderson & May (1992) infectious disease modelling;
// Rescorla (2000) SVEP model for internet security epidemics.
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

#[wasm_bindgen]
pub fn run_zero_day(
    discovery_rate: f64, // 0.001–0.05  S→V rate per step
    exploit_rate:   f64, // 0.01–0.5    V→E rate per step
    patch_rate:     f64, // 0.005–0.2   E→P rate per step
    network_size:   f64, // 50–400      number of nodes (clamped)
    steps:          f64, // 50–2000     simulation steps
) -> String {
    let n      = (network_size as usize).clamp(50, 400);
    let disc   = discovery_rate.clamp(0.001, 0.05);
    let expl   = exploit_rate.clamp(0.01, 0.5);
    let patch  = patch_rate.clamp(0.005, 0.2);
    let iters  = (steps as usize).clamp(50, 2000);

    let mut rng: u64 = ((discovery_rate * 1_000_003.0) as u64)
        .wrapping_add((exploit_rate * 999_979.0) as u64)
        .wrapping_add((patch_rate   * 999_961.0) as u64)
        .wrapping_add((network_size * 999_983.0) as u64)
        .wrapping_add(0xCAFE_C0DE_DEAD_BEEF);

    // Build Barabási-Albert graph (m=2 attachments per new node)
    const M: usize = 2;
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    // Seed with a small clique of M+1 nodes
    for i in 0..M { adj[i].push(i + 1); adj[i + 1].push(i); }
    let mut degrees = vec![0usize; n];
    for i in 0..=M { degrees[i] = if i == 0 || i == M { 1 } else { 2 }; }

    for new_node in (M + 1)..n {
        let total_deg: usize = degrees[..new_node].iter().sum();
        let mut targets: Vec<usize> = Vec::with_capacity(M);
        for _ in 0..M {
            let mut threshold = (lcg_next(&mut rng) * total_deg as f64) as usize;
            let mut chosen = 0usize;
            for (idx, &deg) in degrees[..new_node].iter().enumerate() {
                if threshold < deg { chosen = idx; break; }
                threshold = threshold.saturating_sub(deg);
                chosen = idx;
            }
            if !targets.contains(&chosen) { targets.push(chosen); }
        }
        for &t in &targets {
            adj[new_node].push(t);
            adj[t].push(new_node);
            degrees[t] += 1;
        }
        degrees[new_node] = targets.len();
    }

    // Initial state: all S except node 0 = V (patient zero vulnerability)
    #[derive(Clone, Copy, PartialEq)]
    enum State { S, V, E, P }
    let mut state: Vec<State> = vec![State::S; n];
    state[0] = State::V;

    let count = |st: &[State], which: State| -> usize {
        st.iter().filter(|&&s| s == which).count()
    };

    struct Snap { step: usize, s: usize, v: usize, e: usize, p: usize, cascade: bool }
    let snap_steps: Vec<usize> = (0..=4).map(|i| i * (iters - 1) / 4).collect();
    let mut snaps: Vec<Snap> = Vec::with_capacity(5);

    let mut cascade_triggered  = false;
    let mut cascade_step: Option<usize> = None;
    let mut peak_exploited: usize = 0;
    let mut effective_expl = expl;

    for step in 0..iters {
        // Check cascade trigger: ≥5% exploited
        let n_exploited = count(&state, State::E);
        if !cascade_triggered && n_exploited as f64 / n as f64 >= 0.05 {
            cascade_triggered = true;
            cascade_step = Some(step);
            effective_expl = (expl * 8.0).min(0.99);
        }
        if n_exploited > peak_exploited { peak_exploited = n_exploited; }

        if snap_steps.contains(&step) {
            snaps.push(Snap {
                step,
                s: count(&state, State::S),
                v: count(&state, State::V),
                e: n_exploited,
                p: count(&state, State::P),
                cascade: cascade_triggered,
            });
        }

        // Compute next state
        let prev = state.clone();
        for i in 0..n {
            state[i] = match prev[i] {
                State::S => {
                    // S→V: neighbour-driven or background discovery
                    let n_vuln_neighbours = adj[i].iter().filter(|&&j| prev[j] == State::V || prev[j] == State::E).count();
                    let prob_sv = 1.0 - (1.0 - disc).powf(1.0 + n_vuln_neighbours as f64);
                    if lcg_next(&mut rng) < prob_sv { State::V } else { State::S }
                }
                State::V => {
                    // V→E: direct exploitation from exploited neighbours
                    let n_e_neighbours = adj[i].iter().filter(|&&j| prev[j] == State::E).count();
                    let prob_ve = 1.0 - (1.0 - effective_expl).powf(1.0 + n_e_neighbours as f64);
                    if lcg_next(&mut rng) < prob_ve { State::E } else { State::V }
                }
                State::E => {
                    if lcg_next(&mut rng) < patch { State::P } else { State::E }
                }
                State::P => State::P,
            };
        }
    }

    let final_s = count(&state, State::S);
    let final_v = count(&state, State::V);
    let final_e = count(&state, State::E);
    let final_p = count(&state, State::P);
    let max_deg  = degrees[..n].iter().cloned().max().unwrap_or(0);

    let bar = |v: usize, max: usize| -> String {
        let frac = v as f64 / max.max(1) as f64;
        let filled = (frac * 24.0).round() as usize;
        let mut s = String::from("[");
        for i in 0..24 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let severity = if peak_exploited as f64 / n as f64 > 0.5 { "CRITICAL — mass exploitation (>50%)" }
                   else if peak_exploited as f64 / n as f64 > 0.25 { "HIGH — significant breach (>25%)" }
                   else if peak_exploited as f64 / n as f64 > 0.1  { "MEDIUM — contained outbreak"      }
                   else                                             { "LOW — vulnerability contained"    };

    let mut out = String::with_capacity(2800);
    write!(out,
        "ZERO_DAY_KERNEL v1.0 // SOMA-9.4\n\
         ══════════════════════════════════════════\n\
         N={n}  disc={disc:.4}  expl={expl:.4}  patch={patch:.4}  steps={iters}\n\
         BA_GRAPH: m=2, max_degree={max_deg}  (P(k)~k^-3)\n\
         ──────────────────────────────────────────\n\
         SVEP TIME SERIES\n\
         {{S:Susceptible  V:Vulnerable  E:Exploited  P:Patched}}\n",
        n=n, disc=disc, expl=expl, patch=patch, iters=iters, max_deg=max_deg,
    ).unwrap();

    for sn in &snaps {
        write!(out,
            "  t={:>5}  S={:>4}  V={:>4}  E={:>4}  P={:>4}  {}  {}\n",
            sn.step, sn.s, sn.v, sn.e, sn.p,
            bar(sn.e, n),
            if sn.cascade { "CASCADE" } else { "       " },
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────\n\
         CASCADE TRIGGER : {ct}\n\
         CASCADE STEP    : {cs}\n\
         EXPLOIT AMPLIFY : {ea:.1}× (×8 after 5% threshold)\n\
         ──────────────────────────────────────────\n\
         PEAK EXPLOITED  : {pe} / {n}  ({pp:.1}%)\n\
         FINAL STATE\n\
         S={fs}  V={fv}  E={fe}  P={fp}\n\
         PATCHED FRACTION: {pf:.3}\n\
         ──────────────────────────────────────────\n\
         SEVERITY : {sev}\n\
         ──────────────────────────────────────────\n\
         THEORY : Anderson & May (1992) Infectious Diseases of Humans;\n\
                  Rescorla (2000) Internet Security: Protocols and Standards\n\
                  Barabási & Albert (1999) Emergence of Scaling in Random Networks\n\
         SOURCE : content/rust_kernels/src/kernels/zero_day.rs",
        ct = if cascade_triggered { "YES" } else { "NO (threshold not reached)" },
        cs = cascade_step.map(|s| s.to_string()).unwrap_or_else(|| "—".into()),
        ea = if cascade_triggered { 8.0f64 } else { 1.0f64 },
        pe = peak_exploited, n = n, pp = peak_exploited as f64 / n as f64 * 100.0,
        fs = final_s, fv = final_v, fe = final_e, fp = final_p,
        pf = final_p as f64 / n as f64,
        sev = severity,
    ).unwrap();

    out
}
