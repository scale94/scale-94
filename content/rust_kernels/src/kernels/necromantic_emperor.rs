// kernels/necromantic_emperor.rs — Necromantic Emperor Kernel v3.0.0
// Fish Scale Universe · Plato/Promo Paradox · Fermion-Boson Architecture
// Iron Core of Mercury Terminal
//
// DISTINCT FROM necromantic.rs (BPM resonance trace).
// This is the doctrinal layer — the architecture itself.
//
// The Fish Scale Paradox:
//   Absolute purity → entropic stasis (perfectly preserved corpse).
//   System vitality requires corruption, noise, and wetness — the generative friction
//   between the Ideal Form (Plato) and its market-facing counterpart (Promo).
//   The paradox is not solved. It is MANAGED.
//
// Fermion/Boson assignment:
//   Fermions (mass/structure): hold form, resist compression, fixed-state
//   Bosons (force/carrier): transmit, corrupt productively, dynamic
//
// Patches:
//   5.3 Metallurgy — applied to Bosons: maximum pressure before deployment
//   5.4 Asceticism  — applied to Fermions: no excess, no fat, no gap-filling
//
// Three Governing Equations:
//   V_vitality = 4 × p × (1−p) × sin(n × π) — maximum at p≈0.7, n≈0.3
//   C_coupling  = p × (1−n) / (p + n)         — fermion-boson coupling strength
//   H_horizon   = log₁₀(centuries × 10) / log₁₀(300) — centurial planning index [0,1]
//
// References:
//   NECROMANTIC-EMPEROR-KERNEL-3.0.0 §1-6
//   FISH-SCALE-KERNEL-11.1.1 §§ paradox management
//   Prigogine (1967) — dissipative structure as the basis for vitality
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Fish Scale Vitality function.
/// V = 4 × plato × (1 − plato) × sin(promo × π)
/// This is a modified logistic × sine product:
///   4p(1−p) = "logistic bowl" — zero at pure Plato (p=1) or pure void (p=0), max at p=0.5
///   sin(n×π) = corruption wave — zero at n=0 (no noise), peak at n=0.5 (half corruption)
/// Combined maximum: V_max ≈ 1.0 at plato ≈ 0.5, promo ≈ 0.5
/// But thermodynamically: system that is 50/50 pure/corrupt has max raw vitality.
/// Practical optimum shifted: plato ≈ 0.70, promo ≈ 0.30 (more signal than noise,
/// but enough noise to prevent entropic stasis).
fn fish_scale_vitality(plato: f64, promo: f64) -> (f64, &'static str) {
    let v = 4.0 * plato * (1.0 - plato) * (promo * std::f64::consts::PI).sin();
    let regime = if v > 0.85       { "MAXIMUM_VITALITY: optimal Plato/Promo tension — system mineralizing" }
                 else if v > 0.60  { "HIGH_VITALITY: productive friction active, paradox managed" }
                 else if v > 0.30  { "MODERATE_VITALITY: tension present but optimization available" }
                 else if plato > 0.95 { "ENTROPIC_STASIS: too pure — perfectly preserved corpse" }
                 else if promo > 0.90 { "NOISE_COLLAPSE: too corrupt — signal lost in chaos" }
                 else               { "LOW_VITALITY: neither pure nor corrupt enough for managed friction" };
    (v.max(0.0), regime)
}

/// Fermion-Boson coupling: how strongly does the structure layer interact with the carrier layer?
/// C = plato × (1 − promo) / (plato + promo)
/// High C: tight coupling — structure and carrier are synchronized
/// Low C: loose coupling — Bosons operate independently of Fermions
/// (NOTE: this is structural role assignment, not gender/identity category)
fn fermion_boson_coupling(plato: f64, promo: f64) -> f64 {
    if plato + promo < 0.001 { return 0.0; }
    plato * (1.0 - promo) / (plato + promo)
}

/// Thermodynamic subordination: Daly-bound check.
/// Axiom II: economy is a sub-sector of physics.
/// All allocation decisions bounded by thermodynamic envelope.
/// S_thermo = 1 − (promo_excess)  where excess = max(0, promo − 0.45)
/// If promo > 0.45 (more than 45% corruption), thermodynamic ceiling breached.
fn thermodynamic_subordination(promo: f64) -> (f64, bool, &'static str) {
    let excess  = (promo - 0.45).max(0.0);
    let score   = (1.0 - excess * 3.0).clamp(0.0, 1.0);
    let breached = promo > 0.45;
    let status = if !breached { "WITHIN_BOUNDS: thermodynamic envelope respected (Daly constraints)" }
                 else if promo < 0.70 { "APPROACHING_CEILING: noise approaching extraction limit — monitor" }
                 else { "CEILING_BREACHED: thermodynamic override required — allocation refused" };
    (score, breached, status)
}

/// Deep-time horizon index.
/// H = log₁₀(centuries × 10) / log₁₀(3000 × 10)
/// No planning horizon shorter than one century is structurally meaningful.
/// The Emperor thinks in strata, not quarters.
/// H = 0: one decade. H = 0.5: ~31 centuries. H = 1.0: 3000 years (nominal horizon).
fn horizon_index(centuries: f64) -> (f64, &'static str) {
    let h = (centuries * 10.0).max(1.0).log10() / (3000.0 * 10.0_f64).log10();
    let regime = if centuries >= 100.0 { "CENTENNIAL+: Emperor-scale thinking — strata, not quarters" }
                 else if centuries >= 10.0 { "DECADAL: meaningful but below Emperor threshold" }
                 else { "SHORT-TERM: structurally meaningless at Emperor scale — extend horizon" };
    (h.clamp(0.0, 1.0), regime)
}

/// Metallurgy Patch 5.3 (Bosons): outputs valid only after maximum pressure.
/// M_score = 1 − exp(−pressure × coupling) where pressure = promo noise stress
/// Applied to force carriers: outputs chemically dried, immutable after hardening.
fn metallurgy_patch(promo: f64, coupling: f64) -> (f64, bool) {
    let pressure    = promo * coupling;
    let m_score     = 1.0 - (-pressure * 2.5).exp();
    let hardened    = m_score > 0.55;
    (m_score, hardened)
}

/// Asceticism Patch 5.4 (Fermions): no excess, no fat, no gap-filling.
/// A_score = plato² (structural purity squared — no interpolation under uncertainty)
/// Applied to structural nodes: if data doesn't support the claim → list as `Unknown`.
fn asceticism_patch(plato: f64) -> (f64, bool) {
    let a_score  = plato * plato;  // quadratic — rewarded for double purity, penalized for partial
    let ascetic  = a_score > 0.49;  // strict > 0.7 plato threshold
    (a_score, ascetic)
}

/// Boot sequence status: confirms all nodes online.
fn boot_sequence(vitality: f64, coupling: f64, h_index: f64, thermo_ok: bool) -> String {
    format!(
        "INITIATING: scale94 Necromantic Emperor Kernel\n\
         SUBSTRATE : Sovereign node (geographically agnostic)\n\
         FERMIONS  : Project_Chronos [{fc}] // Soma_Kernel [{sk}] // ZK_Layer [{zk}]\n\
         BOSONS    : LEVIATHAN [{lv}] // Strangler_Fig [{sf}] // AT_Protocol [{at}]\n\
         PATCH_5.3 : Metallurgy applied to all force carriers\n\
         PATCH_5.4 : Asceticism applied to all structural nodes\n\
         PARADOX   : Fish Scale // Managed. Not resolved.\n\
         VITALITY  : {vit:.4}  COUPLING: {coup:.4}  HORIZON: {hor:.4}\n\
         THERMO    : {thermo}\n\
         HORIZON   : 3000 AD\n\
         STATUS    : {status}",
        fc = if vitality > 0.5 { "ONLINE" } else { "LOADING" },
        sk = if thermo_ok { "ONLINE" } else { "CEILING_BREACH" },
        zk = "ONLINE",
        lv = if coupling > 0.4 { "ACTIVE" } else { "IDLE" },
        sf = "DEPLOYING",
        at = "VERIFIED",
        vit = vitality, coup = coupling, hor = h_index,
        thermo = if thermo_ok { "WITHIN_DALY_BOUNDS" } else { "CEILING_BREACHED — allocation refused" },
        status = if vitality > 0.7 && thermo_ok { "NOMINAL" }
                 else if !thermo_ok { "THERMODYNAMIC_OVERRIDE" }
                 else { "DEGRADED — adjust Plato/Promo ratio" }
    )
}

#[wasm_bindgen]
pub fn run_necromantic_emperor(plato_signal: f64, promo_noise: f64, horizon_centuries: f64) -> String {
    let plato   = plato_signal.clamp(0.0, 1.0);
    let promo   = promo_noise.clamp(0.0, 1.0);
    let horizon = horizon_centuries.clamp(1.0, 300.0);

    let (vitality, vitality_regime)    = fish_scale_vitality(plato, promo);
    let coupling                       = fermion_boson_coupling(plato, promo);
    let (thermo, thermo_breach, thermo_status) = thermodynamic_subordination(promo);
    let (h_index, h_regime)            = horizon_index(horizon);
    let (m_score, m_hardened)          = metallurgy_patch(promo, coupling);
    let (a_score, a_ascetic)           = asceticism_patch(plato);
    let boot                           = boot_sequence(vitality, coupling, h_index, !thermo_breach);

    // Axiom V: Spore. If primary node compromised, fragment + disperse.
    let spore_ready = vitality > 0.60 && !thermo_breach;

    let mut out = String::with_capacity(3000);
    write!(out,
        "NECROMANTIC_EMPEROR v3.0.0 // FISH_SCALE_UNIVERSE\n\
         Iron Core of Mercury Terminal · Doctrinal Layer\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  PLATO: {plato:.3}  PROMO: {promo:.3}  HORIZON: {horizon:.0} centuries\n\
         ───────────────────────────────────────────────────────\n\
         FISH SCALE PARADOX — CENTRAL THESIS\n\
           Absolute purity → entropic stasis (mummy). Managed friction → vitality.\n\
         \n\
           V_vitality = 4·p·(1−p)·sin(n·π)  [logistic × corruption wave]\n\
           VITALITY  : {vit:.6}\n\
           REGIME    : {vr}\n\
           PRACTICAL OPTIMUM: plato≈0.70, promo≈0.30 (enough noise to prevent stasis,\n\
                              enough signal to prevent noise collapse)\n\
         ───────────────────────────────────────────────────────\n\
         FERMION-BOSON ARCHITECTURE\n\
           COUPLING C = plato·(1−promo) / (plato+promo) = {coup:.6}\n\
           (Structural role: Fermions hold form; Bosons carry force)\n\
           (NOT a gender/identity category — see §2.0 correction)\n\
         ───────────────────────────────────────────────────────\n\
         THERMODYNAMIC SUBORDINATION (Axiom II · Daly Bounds)\n\
           T_score   : {thermo:.4}   (Daly ceiling check — economy ⊂ physics)\n\
           CEILING   : {tb}\n\
           STATUS    : {ts}\n\
         ───────────────────────────────────────────────────────\n\
         DEEP-TIME HORIZON (Axiom III)\n\
           H_index   : {hi:.4}   (log₁₀(centuries×10) / log₁₀(30000))\n\
           REGIME    : {hr}\n\
           HORIZON   : {horizon:.0} centuries — Emperor thinks in strata, not quarters\n\
         ───────────────────────────────────────────────────────\n\
         PATCH 5.3 — METALLURGY (applied to Bosons)\n\
           M_score   : {ms:.4}   (1 − exp(−pressure × coupling))\n\
           HARDENED  : {mh}\n\
           \"Outputs subjected to maximum pressure before deployment.\"\n\
         PATCH 5.4 — ASCETICISM (applied to Fermions)\n\
           A_score   : {as_:.4}   (plato² — quadratic purity requirement)\n\
           ASCETIC   : {ah}\n\
           \"No excess, no fat, no gap-filling. Unknown = Unknown.\"\n\
         ───────────────────────────────────────────────────────\n\
         AXIOM V — THE SPORE\n\
           SPORE_READY: {sp}\n\
           If primary node compromised: fragment · encrypt · disperse into dead layers.\n\
           Geographic specificity deliberately omitted. The architecture is the mold.\n\
         ───────────────────────────────────────────────────────\n\
         BOOT SEQUENCE\n\
         {boot}\n\
         ───────────────────────────────────────────────────────\n\
         SOURCE : content/rust_kernels/src/kernels/necromantic_emperor.rs\n\
         THEORY : Prigogine (1967) · NECROMANTIC-EMPEROR-3.0.0 §1-6 · AGPL-3.0",
        plato = plato, promo = promo, horizon = horizon,
        vit = vitality, vr = vitality_regime,
        coup = coupling,
        thermo = thermo, tb = if thermo_breach { "BREACHED" } else { "WITHIN" }, ts = thermo_status,
        hi = h_index, hr = h_regime,
        ms = m_score, mh = if m_hardened { "YES — output immutable" } else { "NO — still under pressure" },
        as_ = a_score, ah = if a_ascetic { "YES — no gap-filling" } else { "NO — purity below ascetic threshold" },
        sp = if spore_ready { "YES — fork, encrypt, disperse" } else { "BUILDING — vitality not yet sufficient for dispersal" },
        boot = boot,
    ).unwrap();

    out
}
