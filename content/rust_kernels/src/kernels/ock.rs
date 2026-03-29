// kernels/ock.rs — Olfactory-Computational Kernel v1.0.0 (Bimmelbahn Accord)
// Source: kernel-olfactory-computational-v1.0.0.md
//
// Intelligence smells before it sees. The OCK treats volatile organic compounds
// as signal carriers in a thermodynamic information system. Scent bypasses the
// thalamic gate — olfactory signal reaches the amygdala before the neocortex
// gets a vote. This kernel models signal propagation through three temporal
// layers: top (flash interrupt), heart (persistent daemon), base (deep-time
// archive), plus animalic fixatives (managed corruption).
//
// The Bimmelbahn topology: a permeable transport layer that allows ambient
// contamination. The best systems smell like the provinces they pass through.

use wasm_bindgen::prelude::*;
use std::fmt::Write;
use crate::kernels::utils::lcg_next;

// ── Olfactory family table ──────────────────────────────────────────────────
// (id, glyph, label, class, evap_rate, molecular_weight_factor)
// evap_rate: 0=flash, 1=persistent.  molecular_weight: 0=light, 1=heavy.

struct OlfactoryFamily {
    id:       &'static str,
    glyph:    &'static str,
    label:    &'static str,
    class:    &'static str,
    evap:     f64,   // evaporation rate: 0=immediate, 1=days
    mw:       f64,   // molecular weight factor: 0=light, 1=heavy
    vapour_p: f64,   // vapour pressure: 0=low, 1=high
}

const FAMILIES: [OlfactoryFamily; 7] = [
    OlfactoryFamily { id: "citrus",   glyph: "\u{16CF}", label: "Top Note",    class: "CITRUS-SSH",       evap: 0.05, mw: 0.15, vapour_p: 0.95 },
    OlfactoryFamily { id: "floral",   glyph: "\u{16BA}", label: "Heart Note",  class: "FLORAL-DAEMON",    evap: 0.40, mw: 0.45, vapour_p: 0.50 },
    OlfactoryFamily { id: "woody",    glyph: "\u{16D2}", label: "Base Note",   class: "RESIN-ARCHIVE",    evap: 0.80, mw: 0.80, vapour_p: 0.15 },
    OlfactoryFamily { id: "animalic", glyph: "\u{16CA}", label: "Fixative",    class: "ANIMALIC-BIND",    evap: 0.90, mw: 0.85, vapour_p: 0.10 },
    OlfactoryFamily { id: "aromatic", glyph: "\u{16B1}", label: "Adaptive",    class: "AROMATIC-ROUTE",   evap: 0.30, mw: 0.35, vapour_p: 0.60 },
    OlfactoryFamily { id: "resinous", glyph: "\u{16C7}", label: "Archival",    class: "RESIN-COLD",       evap: 0.95, mw: 0.92, vapour_p: 0.05 },
    OlfactoryFamily { id: "ozonic",   glyph: "\u{16D7}", label: "Broadcast",   class: "OZONIC-MULTICAST", evap: 0.15, mw: 0.20, vapour_p: 0.85 },
];

// ── Signal presets — canonical signal profiles ──────────────────────────────
// Each preset models a recognizable system-design archetype through its
// olfactory decomposition.

struct SignalPreset {
    id:   &'static str,
    name: &'static str,
    desc: &'static str,
    top:  f64,
    heart: f64,
    base: f64,
    corruption: f64,
}

const PRESETS: [SignalPreset; 8] = [
    SignalPreset { id: "viral",     name: "Viral Tweet",               desc: "All top note \u{2014} citrus flash that trends and vanishes",                    top: 0.95, heart: 0.10, base: 0.02, corruption: 0.00 },
    SignalPreset { id: "monolith",  name: "Legacy Monolith",           desc: "All base note \u{2014} so heavy it never volatilises",                            top: 0.05, heart: 0.15, base: 0.95, corruption: 0.05 },
    SignalPreset { id: "daemon",    name: "Background Daemon",         desc: "Heart-dominant \u{2014} persistent carrier, invisible to users",                  top: 0.10, heart: 0.85, base: 0.40, corruption: 0.15 },
    SignalPreset { id: "bimmelbahn",name: "Bimmelbahn Provincial",     desc: "Permeable transport \u{2014} open windows, ambient contamination, rich data",     top: 0.40, heart: 0.60, base: 0.55, corruption: 0.45 },
    SignalPreset { id: "ice",       name: "ICE High-Speed",            desc: "Sealed channel \u{2014} maximum velocity, zero ambient interaction",              top: 0.70, heart: 0.30, base: 0.20, corruption: 0.00 },
    SignalPreset { id: "animalic",  name: "Managed Corruption",        desc: "Civet-heavy accord \u{2014} decay molecules as binding fixative",                 top: 0.20, heart: 0.35, base: 0.60, corruption: 0.85 },
    SignalPreset { id: "balanced",  name: "Classical Accord",          desc: "Balanced pyramid \u{2014} flash \u{2192} carrier \u{2192} archive in proportion", top: 0.55, heart: 0.65, base: 0.50, corruption: 0.25 },
    SignalPreset { id: "sterile",   name: "AI-Generated Perfume",      desc: "Optimised for molecular pleasantness \u{2014} no theory of corruption-as-fixative", top: 0.80, heart: 0.60, base: 0.15, corruption: 0.00 },
];

/// Run the Olfactory-Computational Kernel.
///
/// Parameters:
///   top         : top note intensity — flash signal strength (0.0–1.0)
///   heart       : heart note intensity — persistent carrier (0.0–1.0)
///   base        : base note intensity — deep-time archive (0.0–1.0)
///   corruption  : animalic fixative level — managed corruption (0.0–1.0)
///   temperature : ambient temperature — affects evaporation rates (0.0–1.0; 0.5 = 20°C)
///   preset      : signal preset index (-1 = use manual params, 0–7 = preset)
#[wasm_bindgen]
pub fn run_ock(
    top:         f64,
    heart:       f64,
    base:        f64,
    corruption:  f64,
    temperature: f64,
    preset:      f64,
) -> String {
    let preset_idx = preset as i32;

    // Resolve inputs — use preset if selected, otherwise manual params
    let (t_i, h_i, b_i, c_i) = if preset_idx >= 0 && (preset_idx as usize) < PRESETS.len() {
        let p = &PRESETS[preset_idx as usize];
        (p.top, p.heart, p.base, p.corruption)
    } else {
        (top.clamp(0.0, 1.0), heart.clamp(0.0, 1.0), base.clamp(0.0, 1.0), corruption.clamp(0.0, 1.0))
    };
    let temp = temperature.clamp(0.0, 1.0);

    // ── Temperature modulation ──────────────────────────────────────────
    // Higher temperature accelerates evaporation: top notes amplified, base attenuated
    let temp_factor = 0.5 + temp; // range [0.5, 1.5]
    let top_adj    = (t_i * temp_factor).min(1.0);
    let heart_adj  = h_i; // heart relatively stable
    let base_adj   = (b_i * (2.0 - temp_factor)).min(1.0);
    let animal_adj = (c_i * (1.0 + temp * 0.3)).min(1.0); // heat amplifies animalic

    // ── Evaporation curve ───────────────────────────────────────────────
    let evap_total = (top_adj + heart_adj + base_adj).max(1e-6);
    let evap = [top_adj / evap_total, heart_adj / evap_total, base_adj / evap_total];

    // ── Sillage: signal reach at low concentration ──────────────────────
    // f(vapour_pressure, molecular_weight, temperature)
    // Light molecules + high vapour pressure + heat = maximum projection
    let effective_vp = evap[0] * 0.95 + evap[1] * 0.50 + evap[2] * 0.15;
    let effective_mw = evap[0] * 0.15 + evap[1] * 0.45 + evap[2] * 0.80;
    let sillage = (effective_vp * temp_factor * (1.0 - effective_mw * 0.6)).clamp(0.0, 1.0);

    // ── Longevity: signal persistence ───────────────────────────────────
    // Heavy base notes + low temperature + fixative = maximum longevity
    let longevity = (base_adj * 0.5 + animal_adj * 0.3 + (1.0 - temp) * 0.2).clamp(0.0, 1.0);

    // ── Projection: amplitude at distance ───────────────────────────────
    // Balance of sillage (reach) and longevity (sustain)
    let projection = (sillage * 0.6 + longevity * 0.4).clamp(0.0, 1.0);

    // ── Maceration depth: annealing potential ───────────────────────────
    // How much the signal improves when left to sit. Geometric mean of
    // heart and base — both must be present for productive annealing.
    let maceration = if heart_adj > 0.01 && base_adj > 0.01 {
        (heart_adj * base_adj).sqrt()
    } else {
        0.0
    };

    // ── Fixation potential: thalamic gate ────────────────────────────────
    // base × sillage — the signal must have deep-time content AND reach
    let fixation = base_adj * sillage;
    let persists = fixation > 0.35;

    // ── Permeability: Bimmelbahn open-window factor ─────────────────────
    // High when the signal allows ambient contamination (mid-range volatility
    // + some corruption = open windows on the provincial train)
    let mid_balance = 1.0 - (evap[1] - 0.33).abs() * 3.0;
    let permeability = (mid_balance.max(0.0) * 0.5 + animal_adj * 0.5).clamp(0.0, 1.0);

    // ── Dominant family classification ───────────────────────────────────
    let dominant = if animal_adj > top_adj && animal_adj > heart_adj && animal_adj > base_adj {
        &FAMILIES[3] // animalic
    } else if top_adj >= heart_adj && top_adj >= base_adj {
        &FAMILIES[0] // citrus
    } else if heart_adj >= base_adj {
        &FAMILIES[1] // floral
    } else {
        &FAMILIES[2] // woody
    };

    // ── Temporal decay simulation ────────────────────────────────────────
    // Simulate signal strength at 5 time points: 0min, 15min, 1h, 4h, 24h
    let decay_points: [(f64, &str); 5] = [
        (0.0,   "T+0"),
        (0.25,  "T+15m"),
        (1.0,   "T+1h"),
        (4.0,   "T+4h"),
        (24.0,  "T+24h"),
    ];

    let mut rng: u64 = 0xB100_E1BA_DEAD_CAFE;

    // ── Accord quality score ────────────────────────────────────────────
    // A well-formed accord has temporal depth: all three layers contribute.
    // Penalise single-note dominance (all top = tweet, all base = monolith).
    let balance_penalty = {
        let max_layer = top_adj.max(heart_adj).max(base_adj);
        let min_layer = top_adj.min(heart_adj).min(base_adj);
        if max_layer > 0.01 { (max_layer - min_layer) / max_layer } else { 1.0 }
    };
    let accord_quality = ((1.0 - balance_penalty * 0.6)
                        * (0.5 + maceration * 0.3 + animal_adj * 0.2))
                        .clamp(0.0, 1.0);

    // ── Sillage verdict ─────────────────────────────────────────────────
    let sillage_verdict = if sillage > 0.6 {
        "HIGH SILLAGE \u{2014} signal propagates beyond the wearer"
    } else if sillage > 0.3 {
        "MODERATE SILLAGE \u{2014} detectable within conversational radius"
    } else {
        "LOW SILLAGE \u{2014} intimate projection only"
    };

    let fixation_verdict = if persists {
        "FIXED \u{2014} signal crosses thalamic gate into long-term memory"
    } else {
        "VOLATILE \u{2014} signal evaporates before fixation threshold"
    };

    let permeability_verdict = if permeability > 0.6 {
        "BIMMELBAHN \u{2014} open windows, ambient contamination, rich data"
    } else if permeability > 0.3 {
        "REGIONAL \u{2014} some ambient leakage, moderate environmental coupling"
    } else {
        "ICE \u{2014} sealed channel, sterile transport, no provincial scent"
    };

    // ── Output ──────────────────────────────────────────────────────────
    let line = "\u{2500}".repeat(72);
    let mut out = String::with_capacity(4096);

    write!(out, "\
OLFACTORY-COMPUTATIONAL KERNEL v1.0.0 // BIMMELBAHN ACCORD
{line}

  \u{00A7}0 AXIOM OF VOLATILITY
  Intelligence that cannot volatilise cannot propagate.
  Scent bypasses the thalamic gate \u{2014} amygdala before neocortex.

{line}

  \u{00A7}1 INPUT SIGNAL PROFILE
", line = line).unwrap();

    if preset_idx >= 0 && (preset_idx as usize) < PRESETS.len() {
        let p = &PRESETS[preset_idx as usize];
        write!(out, "  PRESET          = {} // {}\n", p.name, p.desc).unwrap();
    }

    write!(out, "\
  TOP NOTE    \u{16CF}     = {top:.3}   (flash interrupt \u{2014} SSH handshake)
  HEART NOTE  \u{16BA}     = {heart:.3}   (persistent daemon \u{2014} the runtime)
  BASE NOTE   \u{16D2}     = {base:.3}   (deep-time archive \u{2014} survives power-off)
  ANIMALIC    \u{16CA}     = {animal:.3}   (managed corruption \u{2014} fixative binding)
  TEMPERATURE        = {temp:.3}   (ambient \u{2014} evaporation modulator)

{line}

  \u{00A7}2 ACCORD ANALYSIS
  DOMINANT FAMILY    = {dom_id}  {dom_glyph} {dom_label}
  SIGNAL CLASS       = {dom_class}
  ACCORD QUALITY     = {quality:.4}
  EVAPORATION CURVE  = [{e0:.3}, {e1:.3}, {e2:.3}]  (top / heart / base)

{line}

  \u{00A7}3 SIGNAL PROPAGATION (SILLAGE)
  SILLAGE            = {sillage:.4}   {sillage_v}
  LONGEVITY          = {longevity:.4}   (signal persistence \u{2014} cache TTL)
  PROJECTION         = {projection:.4}   (amplitude at distance \u{2014} broadcast radius)
  MACERATION         = {maceration:.4}   (annealing depth \u{2014} improves with time in darkness)
  FIXATION           = {fixation:.4}   {fixation_v}
  PERMEABILITY       = {permeability:.4}   {permeability_v}

{line}

  \u{00A7}4 TEMPORAL DECAY ARCHITECTURE
",
        top     = top_adj,
        heart   = heart_adj,
        base    = base_adj,
        animal  = animal_adj,
        temp    = temp,
        dom_id  = dominant.id.to_uppercase(),
        dom_glyph = dominant.glyph,
        dom_label = dominant.label,
        dom_class = dominant.class,
        quality = accord_quality,
        e0      = evap[0],
        e1      = evap[1],
        e2      = evap[2],
        sillage = sillage,
        sillage_v = sillage_verdict,
        longevity = longevity,
        projection = projection,
        maceration = maceration,
        fixation = fixation,
        fixation_v = fixation_verdict,
        permeability = permeability,
        permeability_v = permeability_verdict,
        line    = line,
    ).unwrap();

    // Temporal decay at each time point
    for &(t_hours, label) in &decay_points {
        // Exponential decay with family-specific rates
        let top_remaining   = top_adj * (-t_hours / 0.25).exp();                // ~15min half-life
        let heart_remaining = heart_adj * (-t_hours / 2.0).exp();               // ~2h half-life
        let base_remaining  = base_adj * (-t_hours / 12.0).exp();               // ~12h half-life
        let animal_remaining = animal_adj * (-t_hours / 24.0).exp();            // ~24h half-life
        let total = top_remaining + heart_remaining + base_remaining + animal_remaining;

        let noise = lcg_next(&mut rng) * 0.02; // slight stochastic jitter
        let signal = (total / 4.0 + noise).clamp(0.0, 1.0);

        let bar_len = (signal * 40.0) as usize;
        let bar: String = "\u{2588}".repeat(bar_len) + &"\u{2591}".repeat(40 - bar_len);
        write!(out, "  {:<6} [{bar}] {signal:.3}  (T:{top:.2} H:{heart:.2} B:{base:.2} A:{anim:.2})\n",
            label,
            bar = bar,
            signal = signal,
            top = top_remaining,
            heart = heart_remaining,
            base = base_remaining,
            anim = animal_remaining,
        ).unwrap();
    }

    write!(out, "\n{line}\n\n", line = line).unwrap();

    // ── Ingredient matrix
    write!(out, "  \u{00A7}5 INGREDIENT MATRIX\n").unwrap();
    for f in &FAMILIES {
        let intensity = match f.id {
            "citrus"   => top_adj,
            "floral"   => heart_adj,
            "woody"    => base_adj,
            "animalic" => animal_adj,
            "aromatic" => (heart_adj * 0.7 + top_adj * 0.3).min(1.0),
            "resinous" => (base_adj * 1.1).min(1.0),
            "ozonic"   => (sillage * 0.8 + top_adj * 0.2).min(1.0),
            _          => 0.0,
        };
        let bar_len = (intensity * 20.0) as usize;
        let bar: String = "\u{2588}".repeat(bar_len) + &"\u{2591}".repeat(20 - bar_len);
        write!(out, "  {glyph} {id:<10} [{bar}] {val:.3}  {class}\n",
            glyph = f.glyph,
            id = f.id.to_uppercase(),
            bar = bar,
            val = intensity,
            class = f.class,
        ).unwrap();
    }

    // ── Signal presets reference
    write!(out, "\n{line}\n\n  \u{00A7}6 SIGNAL PRESETS\n", line = line).unwrap();
    for (i, p) in PRESETS.iter().enumerate() {
        let marker = if preset_idx >= 0 && i == preset_idx as usize { " \u{25C4}" } else { "" };
        write!(out, "  [{i}]  {name:<24} {desc}{marker}\n",
            i = i, name = p.name, desc = p.desc, marker = marker).unwrap();
    }

    // ── Province rule
    write!(out, "\n{line}\n\n\
  \u{00A7}7 PROVINCE RULE
  If your system cannot be described by the smell of the landscape
  it passes through, it has no sillage. It will not be remembered.

  \u{16CA}\u{2697}\u{16DF} \u{2014} Bimmelbahn Accord \u{2014} v1.0.0
  SOURCE: content/rust_kernels/src/kernels/ock.rs\n",
        line = line).unwrap();

    out
}
