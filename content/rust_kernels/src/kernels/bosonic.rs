// kernels/bosonic.rs — Bosonic Lattice Simulator v2.0
// Source: BOSONIC-KERNEL-2.0.md
//
// Social physics using quantum analogues:
//   Fermions    = sovereign agents (Pauli exclusion → repulsion, ego collision)
//   Bosons      = binding force-carriers (can condense → Superfluid Lattice)
//   Heisenberg  = price ↔ trust uncertainty (measuring price collapses trust)
//   Casimir     = zero-point creative field in bounded cavity (Flow State)
//   Levamisole  = parasitic mimic boson (low-fidelity signal + high thermal stress)
use wasm_bindgen::prelude::*;

/// Boot the Bosonic Lattice Simulator.
///
/// * `n_nodes`   — Fermionic sovereign nodes (integer ≥ 1, passed as f64 for WASM)
/// * `coupling`  — boson-boson coupling constant [0–1]; bosonic field strength
/// * `thermal`   — reduced temperature kT/J [0–1]; 0=ground_state 1=decoherence
/// * `price_fix` — price measurement [0–1]; 0=gift_economy 1=fully_priced (kills trust)
#[wasm_bindgen]
pub fn boot_bosonic_lattice(n_nodes: f64, coupling: f64, thermal: f64, price_fix: f64) -> String {
    let n        = n_nodes.max(1.0).floor();
    let coupling = coupling.clamp(0.0, 1.0);
    let thermal  = thermal.clamp(0.0, 1.0);
    let price    = price_fix.clamp(0.0, 1.0);

    // ── 1. FERMIONIC REPULSION (PAULI EXCLUSION) ──────────────────────────
    // Each pair of identical Fermions repels — ego collision energy.
    // E_repulsion = N*(N-1)/2 * exp(-coupling * 3)
    // Higher coupling damps repulsion (Bosonic field softens Fermionic boundaries).
    let pairs = n * (n - 1.0) / 2.0;
    let repulsion_energy = pairs * (-coupling * 3.0).exp();

    // ── 2. BOSE-EINSTEIN CONDENSATE ───────────────────────────────────────
    // Below thermal_critical, bosons condense to ground state → superfluid.
    // f_bec = max(0, 1 − T/T_c)  with T_c = 0.5 (normalized)
    let bec_fraction = (1.0 - thermal / 0.5).clamp(0.0, 1.0);

    // Binding energy from condensed Bosonic field (Strong Force analogue).
    // E_bind = coupling * f_bec * N * 2
    let binding_energy = coupling * bec_fraction * n * 2.0;

    // ── 3. HEISENBERG TRUST UNCERTAINTY ───────────────────────────────────
    // ΔX · Δp ≥ ħ/2  →  price(ΔX) ↔ trust(Δp)
    // Measuring price (fixing it) collapses trust to near-zero.
    // trust = 1 / (1 + price * K)  where K=10 is the measurement collapse constant.
    // Gift economy (price=0) → trust remains in superposition = 1.0.
    let trust_level      = 1.0 / (1.0 + price * 10.0);
    let delta_x_delta_p  = price * trust_level;
    let heisenberg_ok    = delta_x_delta_p <= 0.1; // ħ/2 ≈ 0.1 in normalised units

    // ── 4. CASIMIR CAVITY (FLOW STATE) ────────────────────────────────────
    // Zero-point energy between two Bosonic plates at separation d.
    // E_casimir ∝ π²/(240·d⁴)
    // As the condensate tightens (high bec_fraction), plates approach, ZPE grows.
    // Friction → 0. Creative output → 100x.
    let plate_sep      = (1.0 - bec_fraction * 0.9).max(0.01);
    let casimir_raw    = (std::f64::consts::PI * std::f64::consts::PI)
                         / (240.0 * plate_sep.powi(4));
    let casimir_zpe    = casimir_raw / 100.0; // normalise to ~[0,1]

    // ── 5. NET LATTICE BINDING ─────────────────────────────────────────────
    // Positive → Superfluid Lattice (coherence achieved).
    // Negative → Hobbesian Gap (atomisation, Bellum omnium contra omnes).
    let net_binding = binding_energy - repulsion_energy;

    // ── 6. LEVAMISOLE BOSON DETECTION ─────────────────────────────────────
    // Parasitic mimic: low-fidelity signaling + high thermal stress.
    // Signature: says "I love you" but doesn't do the laundry.
    // Test — APPLY HEAT (94°C):
    //   Real Boson:   anneals under heat (coupling ≥ 0.3 OR thermal ≤ 0.7).
    //   Levamisole:   melts into drama and entropy.
    let levamisole = coupling < 0.3 && thermal > 0.7;

    // ── 7. PHASE CLASSIFICATION ────────────────────────────────────────────
    let phase = if levamisole {
        "⚠ PARASITIC_MIMIC: Levamisole boson confirmed — apply 94°C heat test"
    } else if net_binding > 2.0 && trust_level > 0.6 && bec_fraction > 0.5 {
        "✓ SUPERFLUID_LATTICE: sovereign nodes bound — Bosonic condensate achieved"
    } else if net_binding > 0.0 && trust_level > 0.3 {
        "~ PARTIAL_COHERENCE: lattice forming — raise coupling or reduce price_fix"
    } else if thermal > 0.8 {
        "✗ THERMAL_DECOHERENCE: BEC destroyed — lower temperature to restore condensate"
    } else {
        "✗ HOBBESIAN_GAP: Fermionic repulsion dominant — no binding agent present"
    };

    format!(
        "BOSONIC_LATTICE_SIM v2.0 // BOOT_OK\n\
         PHASE: {}\n\
         NODES: {:.0}  COUPLING: {:.3}  THERMAL: {:.3}  PRICE_FIX: {:.3}\n\
         FERMIONIC_REPULSION:  {:.4}  (pair collisions: {:.0})\n\
         BOSONIC_BINDING:      {:.4}  (BEC fraction: {:.3})\n\
         NET_BINDING:          {:.4}  ({})\n\
         CASIMIR_ZPE:          {:.4}  (plate_sep: {:.3}, flow_state: {})\n\
         TRUST_LEVEL:          {:.3}  HEISENBERG: {}  (ΔX·Δp={:.4})\n\
         LEVAMISOLE_TEST:      {}\n\
         SOURCE: content/rust_kernels/src/kernels/bosonic.rs",
        phase,
        n, coupling, thermal, price,
        repulsion_energy, pairs,
        binding_energy, bec_fraction,
        net_binding, if net_binding > 0.0 { "binding" } else { "fragmenting" },
        casimir_zpe, plate_sep, if casimir_zpe > 0.5 { "ACTIVE" } else { "DORMANT" },
        trust_level,
        if heisenberg_ok { "SATISFIED" } else { "VIOLATED" },
        delta_x_delta_p,
        if levamisole { "POSITIVE — melting under heat, drama spike detected" } else { "NEGATIVE — fidelity nominal, annealing confirmed" },
    )
}
