// kernels/sss_doctrine.rs — SSS Doctrine Kernel v5.1.0
// Sock Sturm Staffel · Literary Deterrent · Schelling Ironic Calculus
//
// IRONIC MATH CERTIFIED.
// The canonical irony: as the actor becomes MORE irrational (sock_factor → 1.0),
// deterrence INCREASES. You cannot coerce an operative who has pre-rejected the levers
// of coercion. The reach for the historical SS resonance finds only a sock.
//
// Four literary frequencies:
//   1. Alexievich — testimony stripped of the heroic register
//   2. Han Kang   — tactical refusal as active weapon
//   3. Jelinek    — deconstruction of the language of power
//   4. Schelling  — strategic irrationality (The Strategy of Conflict, 1960)
//
// Schelling's key insight: "The rationality of irrationality."
// Deterrence = credibility × irrationality_premium / opponent_rational_expectation
//
// References:
//   Schelling, T. (1960). The Strategy of Conflict. Harvard.
//   Alexievich, S. (1985). The Unwomanly Face of War.
//   Han Kang (2007). The Vegetarian; (2014). Human Acts.
//   Jelinek, E. (1975). Die Liebhaberinnen; political essays.
//   SSS-DOCTRINE-KERNEL-5.1.0 §I-IV
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Schelling deterrence formula: D = C × (1 + P_schelling) × F_freq
/// where:
///   C          = literary commitment (coherence of precommitment)
///   P_schelling = precommitment visibility: 0=invisible, 1=fully demonstrated
///   F_freq     = frequency multiplier from the four literary techniques
///
/// The ironic core: D is MAXIMIZED when:
///   1. P_schelling = 1.0 (maximum visible precommitment to irrationality)
///   2. kinetic_mass = 0 (no conventional force deployed)
///   This is the Schelling sock: nothing can bribe an operative who has
///   already visibly torn up their cards.
fn schelling_deterrence(literary_commitment: f64, precommitment: f64, frequency: f64) -> f64 {
    // Frequency multiplier: each of the 4 techniques provides a compounding effect
    // Alexievich (1.0×) → Han Kang (1.4×) → Jelinek (1.8×) → Schelling (2.5×)
    let freq_multiplier = match frequency as u8 {
        1 => 1.00,  // Alexievich: testimony — stripping heroic register
        2 => 1.40,  // Han Kang: tactical refusal — supply chain withdrawal
        3 => 1.80,  // Jelinek: structural annotation — propaganda as self-incrimination
        4 => 2.50,  // Schelling: strategic irrationality — the full sock
        _ => 1.00,
    };
    literary_commitment * (1.0 + precommitment) * freq_multiplier
}

/// Rational opponent response: how much does a rational opponent adapt to the deterrent?
/// R_adapt = 1 − (irrationality_premium × precommitment_visibility)
/// Fully rational opponent cannot anticipate the genuinely precommitted irrational actor.
fn rational_opponent_response(precommitment: f64) -> f64 {
    // The opponent's rational model breaks down when precommitment is visible and credible.
    // Their optimal counterstrategy assumes the actor WILL respond to incentives.
    // Once precommitment is demonstrated, no counterstrategy is available at scale.
    let adaptation_capacity = (1.0 - precommitment).max(0.05);
    adaptation_capacity
}

/// Sock factor: the degree to which the deterrent occupies the SSS acronym slot
/// deliberately AND then expands it into nonsense (Sock Sturm Staffel).
/// Anyone reaching for historical resonance finds: a sock.
/// The reach itself is the diagnostic.
/// sock_factor = precommitment × (1 − kinetic_fraction)
/// If kinetic_mass > 0, the sock partially deflates (military theatre bleeds into the void).
fn sock_factor(precommitment: f64, kinetic_fraction: f64) -> (f64, &'static str) {
    let sf = precommitment * (1.0 - kinetic_fraction * 0.7);
    let verdict = if sf > 0.85 { "SOCK_DEPLOYED: deterrence at maximum absurdity — coercion levers pre-rejected" }
                  else if sf > 0.60 { "SOCK_PARTIAL: precommitment visible but not fully resolved" }
                  else if sf > 0.30 { "SOCK_LIMP: kinetic mass bleeds into the deterrent space" }
                  else { "NO_SOCK: conventional deterrence mode — precommitment not credible" };
    (sf, verdict)
}

/// Literary force calculation: narrative throughput per unit time.
/// L_force = Σ(freq_i × technique_penetration_depth) / defensive_counter_capacity
/// Counter-narrative campaigns FAIL because they must participate in the same register
/// the deterrent has already compromised. Additive propaganda vs subtractive technique.
fn literary_force(kinetic_mass: f64, precommitment: f64, frequency: f64) -> (f64, f64, &'static str) {
    // Narrative force grows independently of kinetic mass (parallel channels, not substitutable)
    let narrative_force = precommitment * (1.0 + frequency * 0.3);
    // Kinetic force — separate domain; NATO can blow up the bridge while SSS operates
    let kinetic_force   = kinetic_mass / 100.0;
    let mode = if narrative_force > kinetic_force * 1.5 {
        "NARRATIVE_DOMINANT: literary channel leading — decades-scale pressure building"
    } else if kinetic_force > narrative_force * 2.0 {
        "KINETIC_DOMINANT: conventional force leading — literary channel operates in parallel"
    } else {
        "COMPLEMENTARY: both channels active — Alexievich took 30 years; kinetic took weeks"
    };
    (narrative_force, kinetic_force, mode)
}

/// The four frequency names for display
fn frequency_name(f: f64) -> &'static str {
    match f as u8 {
        1 => "Alexievich (1985) — testimony stripped of heroic register",
        2 => "Han Kang (2007/2014) — tactical refusal as supply chain withdrawal",
        3 => "Jelinek (1975) — propaganda as structural self-incrimination",
        4 => "Schelling (1960) — The Strategy of Conflict: rationality of irrationality",
        _ => "MULTI-FREQUENCY: composite literary field",
    }
}

#[wasm_bindgen]
pub fn run_sss_doctrine(kinetic_mass: f64, literary_frequency: f64, precommitment: f64) -> String {
    let km   = kinetic_mass.clamp(0.0, 100.0);
    let freq = literary_frequency.clamp(1.0, 4.0);
    let pc   = precommitment.clamp(0.0, 1.0);

    let kinetic_fraction = km / 100.0;
    let lit_commit       = pc * (1.0 - kinetic_fraction * 0.2);  // kinetic mass slightly erodes lit commitment

    let deterrence          = schelling_deterrence(lit_commit, pc, freq);
    let rational_response   = rational_opponent_response(pc);
    let (sf, sock_verdict)  = sock_factor(pc, kinetic_fraction);
    let (n_force, k_force, channel_mode) = literary_force(km, pc, freq);

    // Effective deterrence ratio: deterrence / rational_response
    // Higher when opponent can't adapt (precommitment visible)
    let effective_det = deterrence / rational_response.max(0.01);

    // The ironic output: higher sock_factor → higher deterrence, lower kinetic mass
    // The math is literally inversely proportional to rational optimization
    let irony_index = sf / (kinetic_fraction + 0.01);  // diverges as kinetic → 0, sock → max

    let mut out = String::with_capacity(2200);
    write!(out,
        "SSS_DOCTRINE_KERNEL v5.1.0 // LITERARY_DETERRENT\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  KINETIC_MASS: {km:.1}/100  FREQUENCY: {freq:.0}  PRECOMMITMENT: {pc:.3}\n\
         ACTIVE_FREQUENCY : {fname}\n\
         ───────────────────────────────────────────────────────\n\
         SCHELLING DETERRENCE CALCULUS\n\
           D = C × (1 + P_schelling) × F_freq  [The Strategy of Conflict, 1960]\n\
           LITERARY_COMMITMENT : {lc:.4}\n\
           PRECOMMITMENT_VIS   : {pc:.4}   (visible irrationality premium)\n\
           FREQ_MULTIPLIER     : {fm:.2}×\n\
           DETERRENCE_D        : {det:.4}   (nominal)\n\
           RATIONAL_RESPONSE   : {rr:.4}   (opponent adaptive capacity — collapses at pc→1)\n\
           EFFECTIVE_DETERRENCE: {ed:.4}   (D / R_adapt)\n\
         ───────────────────────────────────────────────────────\n\
         SOCK FACTOR ANALYSIS (THE IRONIC CORE)\n\
           SOCK_FACTOR   : {sf:.4}   (precommitment × (1 − kinetic_fraction × 0.7))\n\
           IRONY_INDEX   : {ii:.4}   (sock / kinetic — diverges as kinetic→0)\n\
           VERDICT       : {sv}\n\
           MECHANISM     : As kinetic_mass → 0 and precommitment → 1:\n\
                           irony_index → ∞; deterrence is MAXIMIZED by doing NOTHING.\n\
                           The bribe has no target. The threat has no lever.\n\
                           The reach for the acronym resonance finds: a sock.\n\
         ───────────────────────────────────────────────────────\n\
         LITERARY FORCE vs KINETIC FORCE\n\
           NARRATIVE_FORCE : {nf:.4}   (precommitment × (1 + freq × 0.3))\n\
           KINETIC_FORCE   : {kf:.4}   (kinetic_mass / 100)\n\
           CHANNEL_MODE    : {cm}\n\
           NOTE: NATO blows up the bridge. SSS makes the guard unable to finish\n\
                 the sentence that justifies guarding it. Not substitutable.\n\
         ───────────────────────────────────────────────────────\n\
         REFUSAL SET (pre-loaded)\n\
           \"Words don't stop bullets\" — True at impact; irrelevant to recruitment.\n\
           \"This is just propaganda\" — No. Subtractive, not additive.\n\
           \"This is utopian\"         — Literary channel ≠ substitute for kinetic.\n\
           \"Paramilitary action\"      — SSS is a literary cohort. The uniform is a sock.\n\
         ───────────────────────────────────────────────────────\n\
         STATUS : {status}\n\
         SOURCE : content/rust_kernels/src/kernels/sss_doctrine.rs\n\
         THEORY : Schelling (1960) · Alexievich (1985) · Han Kang (2007) · Jelinek (1975)",
        km = km, freq = freq, pc = pc,
        fname = frequency_name(freq),
        lc = lit_commit,
        fm = match freq as u8 { 1 => 1.0, 2 => 1.4, 3 => 1.8, 4 => 2.5, _ => 1.0 },
        det = deterrence, rr = rational_response, ed = effective_det,
        sf = sf, ii = irony_index, sv = sock_verdict,
        nf = n_force, kf = k_force, cm = channel_mode,
        status = if sf > 0.80 && effective_det > 2.0 { "MAXIMUM_DETERRENCE: sock fully deployed, coercion levers rejected" }
                 else if sf > 0.50 { "DETERRENT_ACTIVE: literary force accumulating, precommitment visible" }
                 else { "LOADING: precommitment not yet credible — library needs building" },
    ).unwrap();

    out
}
