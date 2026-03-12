// kernels/necromantic.rs — Fish Scale Kernel 11.1.1 — Necromantic Engine
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

/// Necromantic BPM baseline — 114 BPM is the canonical resonance frequency
/// of the Fish Scale protocol's entropic stasis field.
const NECROMANTIC_BPM_BASE: f64 = 114.0;

#[wasm_bindgen]
pub struct NecromanticEngine {
    bpm:       f64,
    resonance: f64,
    cycle:     u64,
}

#[wasm_bindgen]
impl NecromanticEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> NecromanticEngine {
        NecromanticEngine {
            bpm:       NECROMANTIC_BPM_BASE,
            resonance: 0.0,
            cycle:     0,
        }
    }

    /// Static boot diagnostic — returns HarmonicResult string for the terminal.
    pub fn boot() -> String {
        format!(
            "NECROMANTIC_ENGINE v11.1.1 // BOOT_OK\n\
             STATUS: ENTROPIC_STASIS\n\
             HARMONIC_BPM: {:.1}\n\
             RESONANCE_FIELD: uninitialized\n\
             FISH_SCALE_PROTOCOL: active\n\
             SOURCE: content/rust_kernels/src/kernels/necromantic.rs",
            NECROMANTIC_BPM_BASE
        )
    }

    pub fn get_bpm(&self) -> f64 {
        self.bpm
    }

    pub fn get_cycle(&self) -> u64 {
        self.cycle
    }

    /// Inject a resonance value. BPM is modulated by the resonance field.
    /// Δbpm = sin(r × 7) × 11 — keeps oscillation within ±11 BPM of baseline.
    pub fn set_resonance(&mut self, r: f64) {
        self.resonance = r;
        self.bpm       = NECROMANTIC_BPM_BASE + (r * 7.0).sin() * 11.0;
        self.cycle    += 1;
    }

    /// Returns a HarmonicResult string with current BPM and cycle count.
    pub fn harmonic_result(&self) -> String {
        format!(
            "HarmonicResult {{ bpm: {:.3}, resonance: {:.4}, cycle: {} }}",
            self.bpm, self.resonance, self.cycle
        )
    }
}

/// Resonance trace simulation — sweeps N injection cycles through the Fish Scale
/// entropic stasis field, modulating BPM via sin(r×7)×11 with LCG noise drift.
///
/// Parameters:
///   resonance_seed : initial resonance value, wraps mod 2π (0.0–6.28)
///   n_cycles       : resonance injection cycles to trace (1–64)
///   amplitude      : BPM modulation amplitude multiplier (0.1–3.0)
#[wasm_bindgen]
pub fn run_necromantic_simulation(resonance_seed: f64, n_cycles: f64, amplitude: f64) -> String {
    let nc  = (n_cycles as usize).clamp(1, 64);
    let amp = amplitude.clamp(0.1, 3.0);
    let pi2 = 2.0 * std::f64::consts::PI;

    let mut rng: u64 = resonance_seed.to_bits()
        .wrapping_add((amplitude * 1_000_000.0) as u64)
        .wrapping_add((nc as u64).wrapping_mul(999_983))
        ^ 0xCAFE_BABE_1337_DEAD;

    let mut resonance    = resonance_seed.rem_euclid(pi2);
    let mut bpm_sum      = 0.0_f64;
    let mut bpm_min      = f64::MAX;
    let mut bpm_max      = f64::MIN_POSITIVE;
    let mut excite_count = 0_usize;
    let mut stasis_count = 0_usize;
    let mut supp_count   = 0_usize;

    let mut out = String::with_capacity(1800);
    write!(out,
        "NECROMANTIC_ENGINE v11.1.1 // RESONANCE TRACE\n\
         ═══════════════════════════════════════════════════════\n\
         BASELINE_BPM: {base:.1}  SEED: {seed:.4}  CYCLES: {nc}  AMP: {amp:.2}\n\
         ───────────────────────────────────────────────────────\n\
         CYC  RESONANCE    BPM        Δ BPM    STATE\n",
        base = NECROMANTIC_BPM_BASE, seed = resonance_seed, nc = nc, amp = amp,
    ).unwrap();

    for i in 0..nc {
        let noise = (lcg_next(&mut rng) - 0.5) * 0.20;
        resonance = (resonance + noise).rem_euclid(pi2);
        let bpm   = NECROMANTIC_BPM_BASE + (resonance * 7.0).sin() * 11.0 * amp;
        let delta = bpm - NECROMANTIC_BPM_BASE;
        bpm_sum  += bpm;
        bpm_min   = bpm_min.min(bpm);
        bpm_max   = bpm_max.max(bpm);

        let state = if delta > 2.0 {
            excite_count += 1; "EXCITATION  ↑"
        } else if delta < -2.0 {
            supp_count   += 1; "SUPPRESSION ↓"
        } else {
            stasis_count += 1; "STASIS      ─"
        };

        write!(out, "  {:>2}  {:.4}    {:>9.3}  {:>+8.3}  {}\n",
            i + 1, resonance, bpm, delta, state
        ).unwrap();
    }

    let bpm_mean = bpm_sum / nc as f64;
    let drift    = bpm_mean - NECROMANTIC_BPM_BASE;
    let status   = if drift.abs() < 1.5 { "ENTROPIC_STASIS_CONFIRMED" }
                   else if drift > 0.0  { "RESONANCE_EXCITATION" }
                   else                 { "RESONANCE_SUPPRESSION" };

    write!(out,
        "───────────────────────────────────────────────────────\n\
         HARMONIC SUMMARY\n\
           BPM_MIN  : {bmin:.3}  BPM_MAX  : {bmax:.3}  BPM_MEAN : {bmean:.3}\n\
           DRIFT    : {drift:+.3} BPM from baseline ({base:.1})\n\
           EXCITATION : {ex}  STASIS : {st}  SUPPRESSION : {sup}\n\
         ───────────────────────────────────────────────────────\n\
         HARMONIC_STATUS : {status}\n\
         FISH_SCALE_PROTOCOL : active\n\
         THEORY : BPM modulation Δ = sin(r×7)×11; entropic stasis field\n\
         SOURCE : content/rust_kernels/src/kernels/necromantic.rs",
        bmin = bpm_min, bmax = bpm_max, bmean = bpm_mean,
        drift = drift, base = NECROMANTIC_BPM_BASE,
        ex = excite_count, st = stasis_count, sup = supp_count,
        status = status,
    ).unwrap();

    out
}
