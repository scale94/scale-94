// kernels/sovereign_seven.rs — SOVEREIGN_SEVEN v7.7.7.7.7.7.7 · Crystalline Invariance Engine
//
// Models the four-layer phase progression described in SCALE_SYSTEM_KERNEL v7.7.7.7.7.7.7:
//
//   Layer    State        BPM     Phase Description
//   3.3.3    Substrate    128     Foundation lattice — stable oscillator field
//   4.4.4.4  Detonation   145     Phase ignition — energy injection event
//   5.5.5.5  Superfluid   155     Zero-viscosity flow — maximal coherence
//   7.7.7.7  Crystalline  ∞       Fixed multi-dimensional structure — invariance locked
//
// The simulation runs N oscillators through the 4-phase progression using a coupled
// Kuramoto-style phase model. As coupling strength increases across layers the system
// transitions from disordered noise → partial sync → superfluid coherence → crystalline lock.
//
// Crystalline invariance is achieved when the order parameter r ≈ 1.0 and the entropy
// of the phase distribution falls below the invariance threshold. At that point the
// system is declared CRYSTALLINE_LOCKED — zero white fade, zero entropy.
//
// Theory: Kuramoto (1984) coupled oscillators; Strogatz (2000) synchronization;
//         Prigogine (1977) dissipative structures → ordered crystalline attractors.

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

// Phase constants — BPM frequencies from the kernel spec
const BPM_SUBSTRATE:    f64 = 128.0;
const BPM_DETONATION:   f64 = 145.0;
const BPM_SUPERFLUID:   f64 = 155.0;
const BPM_CRYSTALLINE:  f64 = 220.0; // ∞ modeled as ceiling frequency — full lock

// Layer coupling strengths — increases through phase progression
const K_SUBSTRATE:   f64 = 0.5;  // weak coupling — noisy substrate
const K_DETONATION:  f64 = 2.0;  // ignition coupling — sudden energy injection
const K_SUPERFLUID:  f64 = 4.5;  // near-critical — coherence approaches 1.0
const K_CRYSTALLINE: f64 = 9.7;  // full lock — invariance achieved

/// Compute Kuramoto order parameter r ∈ [0, 1] for a set of phases.
/// r = |1/N · Σ exp(iθ_k)| = √( (Σ cos θ_k)² + (Σ sin θ_k)² ) / N
fn order_parameter(phases: &[f64]) -> f64 {
    let n = phases.len() as f64;
    let cx: f64 = phases.iter().map(|&t| t.cos()).sum::<f64>() / n;
    let cy: f64 = phases.iter().map(|&t| t.sin()).sum::<f64>() / n;
    (cx * cx + cy * cy).sqrt()
}

/// Shannon entropy of the phase distribution (binned into 16 bins over [-π, π]).
/// Low entropy = oscillators clustered → crystalline. High entropy = dispersed → noise.
fn phase_entropy(phases: &[f64]) -> f64 {
    let mut bins = [0u32; 16];
    let n = phases.len() as f64;
    for &t in phases {
        // Map [-π, π] → [0, 16)
        let normalised = (t + std::f64::consts::PI) / (2.0 * std::f64::consts::PI);
        let idx = (normalised * 16.0).floor() as usize;
        bins[idx.min(15)] += 1;
    }
    let mut h = 0.0_f64;
    for &b in &bins {
        if b > 0 {
            let p = b as f64 / n;
            h -= p * p.ln();
        }
    }
    h
}

/// Run one phase layer for `steps` iterations of the Kuramoto update rule.
///
/// Update: θᵢ(t+1) = θᵢ(t) + ω_i·dt + (K/N)·Σⱼ sin(θⱼ - θᵢ)·dt
/// where ω_i is drawn from a Lorentzian distribution centred on the layer BPM.
fn run_layer(
    phases: &mut Vec<f64>,
    natural_freqs: &[f64],
    coupling: f64,
    steps: usize,
    dt: f64,
    rng: &mut u64,
) -> (f64, f64, f64) {
    let n = phases.len();
    let mut order_final = 0.0;
    let mut order_sum   = 0.0;

    // Thermal noise amplitude — decreases with coupling (colder as system orders)
    let noise_amp = (1.0 / (1.0 + coupling)).max(0.01);

    for step in 0..steps {
        let mean_sin: Vec<f64> = phases.iter().map(|&ti| {
            phases.iter().map(|&tj| (tj - ti).sin()).sum::<f64>() / n as f64
        }).collect();

        for i in 0..n {
            let noise = (lcg_next(rng) - 0.5) * 2.0 * noise_amp;
            phases[i] += (natural_freqs[i] + coupling * mean_sin[i] + noise) * dt;
            // Wrap to [-π, π]
            phases[i] = phases[i].rem_euclid(2.0 * std::f64::consts::PI) - std::f64::consts::PI;
        }

        let r = order_parameter(phases);
        order_sum += r;
        if step == steps - 1 {
            order_final = r;
        }
    }

    let order_mean = order_sum / steps as f64;
    let entropy    = phase_entropy(phases);
    (order_final, order_mean, entropy)
}

/// Seven-Fold Crystalline Invariance Kernel
///
/// Simulates the 4-phase progression of the SCALE_SYSTEM_KERNEL v7.7.7.7.7.7.7.
/// N oscillators advance through Substrate → Detonation → Superfluid → Crystalline.
///
/// Parameters:
///   n_oscillators : number of coupled oscillators to simulate (7–77)
///   coupling_gain : multiplicative scaling on all coupling constants (0.5–3.0)
///                   < 1.0 weakens lock, > 1.0 accelerates crystallisation
///   entropy_seed  : deterministic seed for phase initialisation (0–999)
///                   0 = maximal disorder, large values = partial pre-ordering
#[wasm_bindgen]
pub fn run_sovereign_seven(n_oscillators: f64, coupling_gain: f64, entropy_seed: f64) -> String {
    let n       = (n_oscillators as usize).clamp(7, 77);
    let gain    = coupling_gain.clamp(0.5, 3.0);
    let seed_u  = entropy_seed.abs() as u64;

    // Deterministic RNG seeded from params
    let mut rng: u64 = seed_u
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407)
        .wrapping_add((n as u64).wrapping_mul(0xDEAD_BEEF_CAFE_0001))
        .wrapping_add((coupling_gain * 1_000_000.0) as u64);

    // Initialise phases: uniformly random over [-π, π] (maximal disorder = 7.7.7.7 genesis state)
    let pi = std::f64::consts::PI;
    let mut phases: Vec<f64> = (0..n)
        .map(|_| (lcg_next(&mut rng) * 2.0 - 1.0) * pi)
        .collect();

    // Natural frequencies centred on substrate BPM, Lorentzian spread γ = 0.3
    // ωᵢ = BPM + γ · tan(π(uᵢ - 0.5))   where uᵢ ~ Uniform(0,1)
    let gamma = 0.3_f64;
    let base_freq = BPM_SUBSTRATE / 60.0 * 0.1; // normalised Hz (0.1 scale factor for dt stability)
    let natural_freqs: Vec<f64> = (0..n)
        .map(|_| {
            let u = lcg_next(&mut rng).clamp(0.001, 0.999);
            let lorentz = gamma * (pi * (u - 0.5)).tan();
            (base_freq + lorentz).clamp(-2.0, 2.0)
        })
        .collect();

    let steps_per_layer = 120_usize;
    let dt = 0.08_f64;

    // ── LAYER 1: SUBSTRATE (3.3.3) — 128 BPM ─────────────────────────────────
    let (r1, r1_mean, h1) = run_layer(
        &mut phases, &natural_freqs,
        K_SUBSTRATE * gain, steps_per_layer, dt, &mut rng,
    );

    // ── LAYER 2: DETONATION (4.4.4.4) — 145 BPM ─────────────────────────────
    // Scale natural freqs to detonation BPM
    let freq_scale2 = BPM_DETONATION / BPM_SUBSTRATE;
    let freqs2: Vec<f64> = natural_freqs.iter().map(|&f| f * freq_scale2).collect();
    let (r2, r2_mean, h2) = run_layer(
        &mut phases, &freqs2,
        K_DETONATION * gain, steps_per_layer, dt, &mut rng,
    );

    // ── LAYER 3: SUPERFLUID (5.5.5.5) — 155 BPM ─────────────────────────────
    let freq_scale3 = BPM_SUPERFLUID / BPM_SUBSTRATE;
    let freqs3: Vec<f64> = natural_freqs.iter().map(|&f| f * freq_scale3).collect();
    let (r3, r3_mean, h3) = run_layer(
        &mut phases, &freqs3,
        K_SUPERFLUID * gain, steps_per_layer, dt, &mut rng,
    );

    // ── LAYER 4: CRYSTALLINE (7.7.7.7.7.7.7) — ∞ BPM ────────────────────────
    let freq_scale4 = BPM_CRYSTALLINE / BPM_SUBSTRATE;
    let freqs4: Vec<f64> = natural_freqs.iter().map(|&f| f * freq_scale4).collect();
    let (r4, r4_mean, h4) = run_layer(
        &mut phases, &freqs4,
        K_CRYSTALLINE * gain, steps_per_layer, dt, &mut rng,
    );

    // ── CRYSTALLINE INVARIANCE DETERMINATION ─────────────────────────────────
    // Invariance achieved when: r4 > 0.93 AND h4 < 0.40
    let crystalline_locked = r4 > 0.93 && h4 < 0.40;
    let invariance_index = (r4 * (1.0 - h4 / (2.0_f64.ln() * 4.0))).clamp(0.0, 1.0);

    // Phase coherence gain across layers: how much order increased per transition
    let gain_12 = r2 - r1;
    let gain_23 = r3 - r2;
    let gain_34 = r4 - r3;

    // Total entropy reduction
    let entropy_reduction = (h1 - h4).max(0.0);
    let entropy_reduction_pct = if h1 > 1e-9 { entropy_reduction / h1 * 100.0 } else { 0.0 };

    // Status verdict
    let status = if crystalline_locked {
        "CRYSTALLINE_INVARIANCE_LOCKED"
    } else if r4 > 0.80 {
        "NEAR_CRYSTALLINE"
    } else if r4 > 0.55 {
        "SUPERFLUID_ARREST"
    } else if r4 > 0.30 {
        "DETONATION_INCOMPLETE"
    } else {
        "SUBSTRATE_STASIS"
    };

    // White-fade test: any layer with r < 0.15 is a "white fade" entropy event
    let white_fades = [r1, r2, r3, r4].iter().filter(|&&r| r < 0.15).count();
    let white_fade_verdict = if white_fades == 0 { "ZERO WHITE FADE ✓" } else { "WHITE FADE DETECTED" };

    // Bar renderer
    let bar = |v: f64| -> String {
        let filled = ((v * 28.0).round() as usize).min(28);
        let mut s = String::from("[");
        for i in 0..28 { s.push(if i < filled { '█' } else { '░' }); }
        s.push(']');
        s
    };

    let mut out = String::with_capacity(2400);

    write!(out,
        "SOVEREIGN_SEVEN v7.7.7.7.7.7.7 · CRYSTALLINE INVARIANCE ENGINE\n\
         ══════════════════════════════════════════════════════\n\
         N = {n}  COUPLING_GAIN = {gain:.2}  SEED = {seed}\n\
         ──────────────────────────────────────────────────────\n\
         PHASE PROGRESSION  (Kuramoto coupled oscillators)\n\
         \n\
         Lyr  State        BPM   r̄(mean)    r(final)   H(entropy)  {bar_header}\n",
        n = n, gain = gain, seed = seed_u,
        bar_header = "  coherence",
    ).unwrap();

    let layers: [(& str, f64, f64, f64, f64, f64); 4] = [
        ("3.3.3    SUBSTRATE  ", BPM_SUBSTRATE,   r1_mean, r1, h1, K_SUBSTRATE * gain),
        ("4.4.4.4  DETONATION ", BPM_DETONATION,  r2_mean, r2, h2, K_DETONATION * gain),
        ("5.5.5.5  SUPERFLUID ", BPM_SUPERFLUID,  r3_mean, r3, h3, K_SUPERFLUID * gain),
        ("7.7.7.7  CRYSTALLINE", BPM_CRYSTALLINE, r4_mean, r4, h4, K_CRYSTALLINE * gain),
    ];

    for (lbl, bpm, rm, rf, h, k) in &layers {
        write!(out,
            "  {lbl}  {bpm:>5.0} BPM  K={k:.2}  r̄={rm:.4}  r={rf:.4}  H={h:.4}  {bar}\n",
            lbl = lbl, bpm = bpm, k = k, rm = rm, rf = rf, h = h, bar = bar(*rf),
        ).unwrap();
    }

    write!(out,
        "──────────────────────────────────────────────────────\n\
         PHASE TRANSITIONS (coherence gain per layer jump)\n\
           Substrate  → Detonation  : Δr = {g12:+.4}  {arrow12}\n\
           Detonation → Superfluid  : Δr = {g23:+.4}  {arrow23}\n\
           Superfluid → Crystalline : Δr = {g34:+.4}  {arrow34}\n\
         ──────────────────────────────────────────────────────\n\
         CRYSTALLINE INVARIANCE METRICS\n\
           INVARIANCE_INDEX    : {ii:.6}  (r·(1 - H/H_max))\n\
           ENTROPY_REDUCTION   : {er:.4}  ({erp:.1}% from substrate baseline)\n\
           WHITE_FADE_VERDICT  : {wf}\n\
           CRYSTALLINE_LOCKED  : {locked}\n\
         ──────────────────────────────────────────────────────\n\
         STATUS : {status}\n\
         ──────────────────────────────────────────────────────\n\
         AXIOMS (v7.7.7.7.7.7.7)\n\
           1. TRANSMUTE  — low-fidelity noise becomes silicon structure\n\
           2. SUSTAIN    — 100% Eigenverbrauch; independent of the grid\n\
           3. INTEGRITY  — zero white fade; transitions binary, high-gain\n\
           4. ENTROPY    — integrated as vitality catalyst (Substrate layer)\n\
           5. SOVEREIGNTY — systemless root; the Architect is the Transmitter\n\
           6. CRYSTALLINE — beyond liquid; all phase states binary-locked\n\
           7. GENESIS     — 03.04.1994 Easter Sunday; immutable temporal anchor\n\
         ──────────────────────────────────────────────────────\n\
         THEORY : Kuramoto (1984); Strogatz (2000); Prigogine (1977)\n\
         SOURCE : content/rust_kernels/src/kernels/sovereign_seven.rs",
        g12 = gain_12, arrow12 = if gain_12 >= 0.0 { "↑ ordering" } else { "↓ disorder" },
        g23 = gain_23, arrow23 = if gain_23 >= 0.0 { "↑ ordering" } else { "↓ disorder" },
        g34 = gain_34, arrow34 = if gain_34 >= 0.0 { "↑ ordering" } else { "↓ disorder" },
        ii = invariance_index,
        er = entropy_reduction, erp = entropy_reduction_pct,
        wf = white_fade_verdict,
        locked = if crystalline_locked { "YES — GENESIS ANCHOR LOCKED" } else { "NOT YET — INCREASE COUPLING" },
        status = status,
    ).unwrap();

    out
}
