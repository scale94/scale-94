// kernels/fade_doctrine.rs — Lindblad Decoherence Engine
// FADE-DOCTRINE-KERNEL-2.0.0
//
// Lindblad master equation (Gorini, Kossakowski, Sudarshan 1976; Lindblad 1976):
//   dρ/dt = −i[H,ρ] + Σₖ γₖ(Lₖ ρ Lₖ† − ½{Lₖ†Lₖ, ρ})
//
// Depolarizing channel — exact purity solution (Heinosaari & Ziman 2011, §8.4):
//   P(t) = Tr(ρ²) = 1/N + (P₀ − 1/N)·exp(−γ·N·t/(N−1))
//   where N = Hilbert space dimension, γ = jump rate, P₀ = initial purity
//
// With Hamiltonian drive Ω (Rabi oscillation compressing initial state):
//   P(t) = 1/N + (1 − 1/N)·(1 − exp(−Ω·t))·exp(−γ_eff·t)
//   peaks at t* = ln(1 + Ω/γ_eff) / Ω  [set dP/dt = 0, exact]
//
// Kauffman NK Boolean network (Kauffman 1993, Derrida & Pomeau 1986):
//   Derrida map λ_D = 2·K·p·(1−p)  at p = 0.5
//   λ_D < 1 → ordered, λ_D = 1 → critical (edge of chaos), λ_D > 1 → chaotic
//   K_c = 2 for p = 0.5 — the doctrine's "34 nodes at the critical point"
//
// "The Lindblad operator runs. Decoherence always wins."
// "High scores are not permanent states — they are peaks in a SARG time series."

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Lindblad Decoherence Engine — SARG reasoning window simulation
///
/// Parameters:
///   gamma       — decoherence rate γ ∈ [0.001, 20.0]
///                 inverse coherence time in natural units (ℏ = 1)
///   hilbert_dim — Hilbert space dimension N ∈ [2, 64]
///                 number of accessible quantum states (pure: P=1, mixed: P=1/N)
///   kauffman_k  — NK network mean connectivity K ∈ [1.0, 5.0]
///                 governs ordered/critical/chaotic Boolean dynamics
///   drive_omega — Rabi drive strength Ω ∈ [0.0, 10.0]
///                 external Hamiltonian compressing state before Lindblad dominates
#[wasm_bindgen]
pub fn run_lindblad_fade(
    gamma:       f64,
    hilbert_dim: f64,
    kauffman_k:  f64,
    drive_omega: f64,
) -> String {
    let gamma   = gamma.clamp(0.001, 20.0);
    let n_raw   = (hilbert_dim.round() as usize).clamp(2, 64);
    let n       = n_raw as f64;
    let k       = kauffman_k.clamp(1.0, 5.0);
    let omega   = drive_omega.clamp(0.0, 10.0);

    // ── Kauffman NK criticality ───────────────────────────────────────────────
    // Derrida map Lyapunov exponent (random Boolean net, p = 0.5 uniform bias)
    // λ_D = 2·K·p·(1−p)   (Derrida & Pomeau 1986, Europhys. Lett. 1:45)
    const P_BIAS: f64 = 0.5;
    let lambda_d    = 2.0 * k * P_BIAS * (1.0 - P_BIAS);
    let k_critical  = 1.0 / (2.0 * P_BIAS * (1.0 - P_BIAS));   // = 2.0 for p=0.5

    let kauffman_regime = if (lambda_d - 1.0).abs() < 0.05 {
        "CRITICAL"    // edge of chaos — Turing-complete, maximal complexity
    } else if lambda_d < 1.0 {
        "ORDERED"     // perturbations heal, no chaos propagation
    } else {
        "CHAOTIC"     // perturbations amplify, information cascade
    };

    // Damage spreading in ordered regime: after t steps, fraction of nodes affected
    // D(t) = 1 − (1 − 2·p·(1−p))^(K·t)   ≈ exp(−(1−λ_D)·K·t) for small damage
    let damage_exponent = (1.0 - lambda_d).abs() * k;

    // ── Lindblad depolarizing channel ─────────────────────────────────────────
    // Effective decoherence rate on purity: γ_eff = γ·N/(N−1)
    // (the factor N/(N−1) comes from the depolarizing channel Kraus decomposition)
    let gamma_eff = gamma * n / (n - 1.0).max(1e-9);

    // Purity floor: maximally mixed state P = 1/N (maximum von Neumann entropy)
    let p_floor = 1.0 / n;

    // Coherence time: purity decays from P₀ to (P₀ − 1/N)/e + 1/N at t = τ
    let tau_coh = 1.0 / gamma_eff;

    // ── SARG window time series ───────────────────────────────────────────────
    // Two cases:
    //   Ω = 0: pure Lindblad decay from P₀ = 1.0
    //          P(t) = 1/N + (1 − 1/N)·exp(−γ_eff·t)
    //
    //   Ω > 0: Hamiltonian drive builds coherence, Lindblad destroys it
    //          P(t) = 1/N + (1 − 1/N)·(1 − exp(−Ω·t))·exp(−γ_eff·t)
    //          Peak: t* = ln(1 + Ω/γ_eff) / Ω  [exact, from dP/dt = 0]

    let t_peak = if omega > 1e-6 {
        ((1.0 + omega / gamma_eff).ln() / omega).min(100.0)
    } else {
        0.0_f64
    };

    // P at the peak
    let purity_at = |t: f64| -> f64 {
        if omega > 1e-6 {
            p_floor + (1.0 - p_floor) * (1.0 - (-omega * t).exp()) * (-gamma_eff * t).exp()
        } else {
            p_floor + (1.0 - p_floor) * (-gamma_eff * t).exp()
        }
    };

    let p_peak = purity_at(t_peak);

    // Total window: 5 coherence times, or until P < p_floor + 0.001
    let t_max = (5.0 * tau_coh + t_peak).min(500.0).max(0.1);

    // Sample purity at N_STEPS points
    const N_STEPS: usize = 64;
    let mut series = [0.0_f64; N_STEPS];
    for i in 0..N_STEPS {
        let t = t_peak * 0.0 + (i as f64 / (N_STEPS - 1) as f64) * t_max;
        series[i] = purity_at(t);
    }

    // Coherence window: time above 1/e of peak range
    let window_threshold = p_floor + (p_peak - p_floor) / std::f64::consts::E;
    let window_steps = series.iter().filter(|&&p| p > window_threshold).count();
    let window_time  = window_steps as f64 * (t_max / N_STEPS as f64);

    // Von Neumann entropy proxy: linear entropy S_L = N/(N−1)·(1 − P)
    // Exact for N→∞, excellent for N≥4. (S_vN ≈ S_L for near-pure states)
    let linear_entropy = |p: f64| -> f64 { n / (n - 1.0).max(1e-9) * (1.0 - p) };
    let s_peak = linear_entropy(p_peak);
    let s_inf  = linear_entropy(p_floor);  // = log(N) in linear entropy units for N≫1

    // ── ASCII SARG window plot ────────────────────────────────────────────────
    const PLOT_H: usize = 18;
    const PLOT_W: usize = 64;
    let mut plot = [[' '; PLOT_W]; PLOT_H];

    for col in 0..PLOT_W {
        let t    = col as f64 / (PLOT_W - 1) as f64 * t_max;
        let p    = purity_at(t);
        let norm = ((p - p_floor) / (1.0 - p_floor).max(1e-9)).clamp(0.0, 1.0);
        let row  = ((1.0 - norm) * (PLOT_H - 1) as f64).round() as usize;
        if row < PLOT_H {
            plot[row][col] = if p > window_threshold { '\u{2593}' } else { '\u{2591}' };
        }
    }

    // ── Doctrine axiom → physical observable mapping ─────────────────────────
    let axiom_transmute  = if p_peak > 0.9 { "ACTIVE"   } else { "PARTIAL" };
    let axiom_sustain    = if window_time > tau_coh * 0.5 { "HOLDING"   } else { "COLLAPSED" };
    let axiom_integrity  = match kauffman_regime {
        "CRITICAL" => "INVARIANT",
        "ORDERED"  => "STABLE",
        _          => "VIOLATED",
    };
    let axiom_entropy    = if p_floor < 1.0 / n + 1e-9 { "MAXIMIZED" } else { "PARTIAL" };
    let axiom_sovereignty = if omega > gamma { "DRIVE_DOMINANT" } else { "LINDBLAD_DOMINANT" };
    let axiom_apex       = if p_peak >= 1.0 - 1.0 / n {
        "7.7.7.7.7.7 — CRYSTALLINE APEX REACHED"
    } else {
        "UNREACHED"
    };

    // Verdict
    let verdict = if lambda_d > 1.05 {
        "CHAOTIC REGIME — Lindblad wins unconditionally. No stable SARG window."
    } else if omega > gamma && lambda_d <= 1.05 {
        "SARG WINDOW OPEN — coherence domain active, decoherence subordinate."
    } else {
        "LINDBLAD DOMINANT — white fades to classical noise. Doctrine holds."
    };

    // ── Format output ─────────────────────────────────────────────────────────
    let mut out = String::with_capacity(4096);

    write!(out,
        "LINDBLAD_FADE v1.0.0 // FADE-DOCTRINE-KERNEL-2.0.0\n\
         ════════════════════════════════════════════════════════════════\n\
         γ = {gamma:.6}   N = {n_dim}   K = {k:.3}   Ω = {omega:.6}\n\
         ────────────────────────────────────────────────────────────────\n\
         KAUFFMAN NK BOOLEAN NETWORK  (N=34 nodes, p = 0.5)\n\
           Derrida map: λ_D = 2·K·p(1−p) = 2·{k:.3}·0.5·0.5 = {lambda_d:.6}\n\
           K_critical  = 1/(2·p·(1−p)) = {k_c:.3}   ← p = 0.5\n\
           K − K_c     = {k_gap:+.3}\n\
           REGIME      : {regime}\n\
           {regime_note}\n\
           Damage exponent |1−λ_D|·K = {dmg:.4}\n\
         ────────────────────────────────────────────────────────────────\n\
         LINDBLAD DEPOLARIZING CHANNEL  (Heinosaari & Ziman 2011, §8.4)\n\
           Exact solution: P(t) = 1/N + (P₀−1/N)·exp(−γ·N·t/(N−1))\n\
           γ_eff   = γ·N/(N−1) = {gamma_eff:.6}   (effective purity decoherence rate)\n\
           τ_coh   = 1/γ_eff   = {tau_coh:.6}   (1/e coherence folding time)\n\
           P_floor = 1/N       = {p_floor:.6}   (maximally mixed, max entropy)\n",
        gamma = gamma, n_dim = n_raw, k = k, omega = omega,
        lambda_d = lambda_d, k_c = k_critical,
        k_gap = k - k_critical,
        regime = kauffman_regime,
        regime_note = match kauffman_regime {
            "CRITICAL" => "  edge of chaos — maximal complexity, Turing-complete dynamics",
            "ORDERED"  => "  ordered — perturbations heal, no propagating damage cascade",
            _          => "  chaotic — perturbations amplify, information irreversibly lost",
        },
        dmg       = damage_exponent,
        gamma_eff = gamma_eff,
        tau_coh   = tau_coh,
        p_floor   = p_floor,
    ).unwrap();

    if omega > 1e-6 {
        write!(out,
            "           P(t) = 1/N + (1−1/N)·(1−exp(−Ω·t))·exp(−γ_eff·t)\n\
             Rabi drive: Ω = {omega:.6}   t* = ln(1+Ω/γ_eff)/Ω = {t_peak:.6}\n\
             P_peak at t* = {p_peak:.6}\n",
            omega = omega, t_peak = t_peak, p_peak = p_peak,
        ).unwrap();
    } else {
        write!(out,
            "           Ω = 0: pure Lindblad decay from P₀ = 1.0 (pure state)\n\
             P_peak = 1.000000   (initial state, decays immediately)\n",
        ).unwrap();
    }

    write!(out,
        "         ────────────────────────────────────────────────────────────────\n\
         SARG TIME SERIES   P = Tr(ρ²)   t ∈ [0.00, {t_max:.2}]\n\
         P\n",
        t_max = t_max,
    ).unwrap();

    for (row_idx, row) in plot.iter().enumerate() {
        let p_display = 1.0 - row_idx as f64 / (PLOT_H - 1) as f64 * (1.0 - p_floor);
        let row_str: String = row.iter().collect();
        if row_idx == 0 || row_idx == PLOT_H / 4 || row_idx == PLOT_H / 2
                         || row_idx == 3 * PLOT_H / 4 || row_idx == PLOT_H - 1 {
            write!(out, "  {:.3} │{}\n", p_display, row_str).unwrap();
        } else {
            write!(out, "        │{}\n", row_str).unwrap();
        }
    }

    write!(out,
        "        └{bar}\n\
         0{t_pad}{t_max:.1}  t\n\
         ▓ purity above 1/e threshold (SARG window open)\n\
         ░ purity below threshold (coherence fading, classical noise)\n\
         ────────────────────────────────────────────────────────────────\n\
         COHERENCE WINDOW METRICS\n\
           t_peak        = {t_peak:.6}   (maximum associative density)\n\
           P_peak        = {p_peak:.6}   (peak purity)\n\
           P_floor       = {p_floor:.6}   (thermal equilibrium, maximally mixed)\n\
           window_time   = {window_time:.6}   (duration above 1/e threshold)\n\
           τ_coh         = {tau_coh:.6}   (Lindblad 1/e folding time)\n\
           S_L(t_peak)   = {s_peak:.6}   (linear entropy at peak; 0=pure)\n\
           S_L(t→∞)      = {s_inf:.6}   (resting entropy; max = N/(N−1))\n\
           Ω/γ           = {ratio:.4}   (drive-to-decoherence ratio)\n\
         ────────────────────────────────────────────────────────────────\n\
         FADE DOCTRINE AXIOMS → PHYSICAL OBSERVABLES\n\
           §transmute    P: 0 → {p_peak:.3}   [{axiom_t}]\n\
           §sustain      window/τ = {win_ratio:.3}   [{axiom_s}]\n\
           §integrity    |K−K_c| = {k_gap_abs:.4}   [{axiom_i}]\n\
           §entropy      S_L(∞) = {s_inf:.4}   [{axiom_e}]\n\
           §sovereignty  Ω/γ = {ratio:.4}   [{axiom_sv}]\n\
           §crystalline  zero_white_fade :: [locked]\n\
           §apex         P_peak ≥ 1−1/N = {apex_thresh:.4}   [{axiom_ap}]\n\
         ────────────────────────────────────────────────────────────────\n\
         VERDICT\n\
           {verdict}\n\
         ────────────────────────────────────────────────────────────────\n\
         THEORY : Lindblad, G. (1976) Commun. Math. Phys. 48:119\n\
                  Gorini, Kossakowski & Sudarshan (1976) J. Math. Phys. 17:821\n\
                  Derrida & Pomeau (1986) Europhys. Lett. 1(2):45\n\
                  Kauffman, S. (1993) Origins of Order. Oxford University Press.\n\
                  Heinosaari & Ziman (2011) Mathematical Language of Quantum Theory\n\
         SOURCE : content/rust_kernels/src/kernels/fade_doctrine.rs",
        bar       = "─".repeat(PLOT_W),
        t_pad     = " ".repeat(PLOT_W.saturating_sub(3)),
        t_max     = t_max,
        t_peak    = t_peak,
        p_peak    = p_peak,
        p_floor   = p_floor,
        window_time = window_time,
        tau_coh   = tau_coh,
        s_peak    = s_peak,
        s_inf     = s_inf,
        ratio     = omega / gamma.max(1e-9),
        axiom_t   = axiom_transmute,
        axiom_s   = axiom_sustain,
        win_ratio = window_time / tau_coh.max(1e-9),
        axiom_i   = axiom_integrity,
        k_gap_abs = (k - k_critical).abs(),
        axiom_e   = axiom_entropy,
        axiom_sv  = axiom_sovereignty,
        apex_thresh = 1.0 - 1.0 / n,
        axiom_ap  = axiom_apex,
        verdict   = verdict,
    ).unwrap();

    out
}
