// ── useEcologicalRam ─────────────────────────────────────────────────────────
// Ecological RAM model for the Mercury Terminal.
//
// The RAM bar is not a performance meter — it is a PLANETARY STANDING METER.
// An alien observer at Mercury reads the lattice. Green simulations recharge it.
// Extraction, surveillance, and brute compute drain it. Entropy drains it passively.
//
// Model:
//   ramPct  — current planetary standing (0–100%), starts at 70
//   delta   — each command applies a signed delta to ramPct
//   passive — entropy claims 1% per 30s regardless
//   floor   — 5% (lattice never fully collapses; signal persists)
//   ceiling — 100%
//
// Positive delta (+): ecological recharge — running these restores standing
// Negative delta (−): entropic drain     — running these costs the commons

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Delta map ─────────────────────────────────────────────────────────────────
// Keyed by WASM alias (useCommandDispatch passes aliases[0] ?? id).
// Every alias for a kernel maps to the same signed delta.
// Unknown commands default to −10 (uncharted compute = mild ecological cost).

export const ECOLOGICAL_DELTA_MAP = {

  // ─────────────────────────────────────────────────────────────────────────────
  // STRONG RECHARGE  +14 to +22
  // The commons at its best. Running these is how the lattice breathes.
  // ─────────────────────────────────────────────────────────────────────────────

  // Daly Thermodynamic Rules — the only framework that doesn't lie about limits
  daly:                +22,  ecological:           +22,  entropy_econ:         +22,
  daly_rules:          +22,  daly_thermo:          +22,

  // Biocoenosis — species richness, Shannon entropy, the commons as living system
  biodiversity:        +20,  biocoenosis:          +20,  species:              +20,
  shannon_ecology:     +20,  ecology:              +20,

  // Gaia-Scale Sovereign Reconstruction — Triarchy, 500-year mineral reserve
  gaia_scale:          +20,  triarchy:             +20,  reconstruction:       +20,
  mineralization:      +20,  porcupine:            +20,

  // Soma Plus — care economy, ecological + social + arts contribution
  soma_plus:           +18,  social_capital:       +18,  contribution:         +18,
  status:              +18,  commons_engine:       +18,

  // Ostrom Commons — cooperation beats defection in evolutionary time
  replicator:          +16,  ostrom_game:          +16,  commons:              +16,
  evolutionary:        +16,  cooperate:            +16,  altruist:             +16,
  gametheory:          +16,

  // CEEI / Roth Fair Allocation — preference-based, no envy, no waste
  ceei:                +14,  allocation:           +14,  matching:             +14,
  roth:                +14,  preference:           +14,  allocation_engine:    +14,
  aceei:               +14,

  // Strangler Fig — fossil system replacement; logistic transition to the sovereign
  strangler:           +15,  transition:           +15,  stranglerfig:         +15,
  fig:                 +15,  logistic_transition:  +15,  adoption:             +15,
  legacy:              +15,

  // ─────────────────────────────────────────────────────────────────────────────
  // MODERATE RECHARGE  +5 to +12
  // Monitoring, documenting, and maintaining the lattice.
  // ─────────────────────────────────────────────────────────────────────────────

  // Sorbe Bloom — Sovereign Node Initiation, three-substrate coherence
  sorbe:               +12,  bloom:                +12,  sorbe_bloom:          +12,
  node_initiation:     +12,  dissipative_bloom:    +12,  substrate_coherence:  +12,

  // Chrono-Actuary — deep-time ecological audit, DO ledger, river sovereignty
  chrono:              +10,  actuary:              +10,  river_sovereign:      +10,
  chrono_actuary:      +10,  aqua:                 +10,  protocol_aqua:        +10,
  audit:               +10,  ecological_audit:     +10,  do_ledger:            +10,

  // Underground Thermodynamics — Onsager/Bejan MEPP efficiency, entropy production
  utk:                 +8,   underground_thermo:   +8,   mepp:                 +8,
  onsager:             +8,   bejan:                +8,   garrett:              +8,
  dissipative_thermo:  +8,   sigma_production:     +8,

  // Kuramoto Synchrony — collective phase lock, solidarity as physics
  kuramoto:            +8,   synchrony:            +8,   sync:                 +8,
  oscillator:          +8,   solidarity:           +8,   coupled:              +8,

  // SSS Doctrine — literary deterrent over kinetic mass (Schelling precommitment)
  sss:                 +8,   sss_doctrine:         +8,   literary_deterrent:   +8,
  schelling:           +8,   sock:                 +8,   deterrent:            +8,
  ironic_calculus:     +8,

  // Fish Scale v12.1.0 — Bouligand armor, Arapaima-derived biological structure
  fish_scale:          +6,   bouligand:            +6,   arapaima:             +6,
  armor:               +6,   feigenbaum_fish:      +6,   fsk:                  +6,
  moire:               +6,

  // Stiller Divergence — volatile semiotic vs fossil record; tracks the bifurcation
  stiller:             +6,   divergence:           +6,   broadcast:            +6,
  fossil:              +6,   vaporization:         +6,   combustion:           +6,
  bimmelbahn:          +6,   vitrified:            +6,   stiller_divergence:   +6,

  // Soma55 — soma_kernel_5.5 system boot, ecological economy status
  soma55:              +6,   soma_boot:            +6,   nexteconomy:          +6,
  sk55:                +6,   soma_kernel_55:       +6,

  // Soma Live — live pilot simulation, streaming ecological state
  soma_live:           +5,   soma_cycle:           +5,   pilot:                +5,
  somapilot:           +5,   soma_kernel_live:     +5,

  // OCK — Olfactory-Computational Kernel, volatile sovereignty, Bimmelbahn Accord
  ock:                 +5,   olfactory:            +5,   accord:               +5,
  volatile:            +5,   sillage:              +5,   perfume:              +5,
  fixation:            +5,   maceration:           +5,   koc:                  +5,

  // Sovereign Seven — 4-phase Kuramoto: Substrate → Detonation → Superfluid → Crystalline
  sovereign:           +4,   seven:                +4,   crystalline:          +4,
  sovereign_seven:     +4,   crystal_lock:         +4,   invariance:           +4,
  seven_layers:        +4,

  // Spectral Bridge — cross-cluster cosine topology discovery
  spectral:            +4,   bridge:               +4,   spectral_bridge:      +4,
  topology:            +4,   cosine:               +4,   fingerprint:          +4,
  cross_cluster:       +4,   discover:             +4,

  // Associative Field — Hopfield attractor basin mapping
  associative:         +3,   field:                +3,   associative_field:    +3,
  hopfield:            +3,   attractor:            +3,   basin:                +3,
  assoc_field:         +3,   kernel_graph:         +3,   pattern:              +3,

  // Soma 9.1 banner — negligible compute, the kernel at rest
  soma91:              +3,   banner:               +3,   soma_91:              +3,
  soma91_banner:       +3,

  // Local synthesis — biological, sovereign, non-extractive
  local_synthesis:     +5,

  // ─────────────────────────────────────────────────────────────────────────────
  // SLIGHT DRAIN  −8 to −18
  // Computational overhead. Useful but costly. The lattice notices.
  // ─────────────────────────────────────────────────────────────────────────────

  // Bosonic Lattice — quantum social bonds, gift economy, but heavy lattice compute
  bosonic_lattice:     -10,  bosonic:              -10,  bosonickernel:        -10,

  // DRK Pragmatic<T> — thermal budget consumed, tasks resolved at entropic cost
  pragmatic:           -8,   pragmatic_type:       -8,   drk:                  -8,
  drk_pragmatic:       -8,   thermal_resolve:      -8,   pragmatict:           -8,

  // Phonemic Drift — Baudrillard simulacra; the copy begins to replace the real
  phonemic:            -12,  drift:                -12,  bellard:              -12,
  baudrillard:         -12,  simulacra:            -12,  phonemic_drift:       -12,
  memory_hash:         -12,

  // Percolation — modeling network fragility; you understand the fracture by mapping it
  percolation:         -8,   resilience:           -8,   network:              -8,
  fragility:           -8,   perc:                 -8,   giant_component:      -8,
  gcc:                 -8,   erdos:                -8,   molloyreed:           -8,
  fragmentation:       -8,

  // Mesantropy — scalar mediocracy, eigenverbrauch drain, 3.3.3/4.4.4.4 detonation
  mesantropy:          -15,  scalar:               -15,  detonation:           -15,
  vectorcollapse:      -15,  eigenverbrauch:       -15,  mediocracy:           -15,
  mesantropy_engine:   -15,

  // Necromantic Emperor — Fish Scale Paradox, Plato/Promo tension, 3000 AD iron core
  emperor:             -15,  necromantic_emperor:  -15,  fish_scale_paradox:   -15,
  plato_promo:         -15,  fermion_boson:        -15,  vitality:             -15,
  metallurgy:          -15,

  // Necromantic Aristocrat — Gold Posture, Anti-Mercury emergency governance
  aristocrat:          -18,  necromantic_aristocrat: -18, gold_posture:        -18,
  reference_voltage:   -18,  anti_mercury:         -18,

  // Fish Scale v11.1.1 (necromantic resonance trace — older, less structured)
  necromantic:         -12,  fishscale:            -12,  resonance:            -12,
  bpm:                 -12,  harmonic:             -12,

  // Necromantic Logitbias — token-probability friction, pirarucu/levamisole tension
  necromantic_logitbias: -10, logitbias:           -10,  pirarucu:             -10,
  levamisole:          -10,

  // Seraphine SARG — Lindblad decoherence, quantum density matrix, heavy compute
  seraphine:           -12,  sarg:                 -12,  quantum_reasoning:    -12,
  qcog:                -12,  seraph:               -12,  assoc:                -12,
  decohere:            -12,  reasoning_gain:       -12,

  // Feigenbaum — maps period-doubling route to chaos; r→4.0 is the ecocide parameter
  feigenbaum:          -15,  bifurcation:          -15,  chaos:                -15,
  logistic:            -15,  cascade:              -15,  period_doubling:      -15,
  logistic_map:        -15,

  // Ising — Monte Carlo social temperature; critical point is fragile
  ising:               -18,  consensus:            -18,  opinion:              -18,
  phase_transition:    -18,  ferromagnet:          -18,  critical:             -18,
  monte_carlo:         -18,

  // Bone Fusion — 16D tensor fusion, heavy conceptual lattice computation
  bone:                -15,  bone_fusion:          -15,  singularity:          -15,
  tensor:              -15,  tensor_fusion:        -15,

  // Latent Collider — significant compute, but maps conceptual space
  collider:            -10,  latent:               -10,  latent_collider:      -10,
  scaling:             -10,  collision:            -10,  cross_attention:      -10,
  chimera:             -10,  synthesis:            -10,

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGNIFICANT DRAIN  −18 to −32
  // Heavy compute, adversarial models, and the architecture of control.
  // ─────────────────────────────────────────────────────────────────────────────

  // Post-Quantum Hash Audit — Grover/BHT quantum margins, heavy analysis
  pqhash:              -18,  quantum_hash:         -18,  post_quantum:         -18,
  hash_audit:          -18,  grover:               -18,  pq_hash:              -18,
  hashaudit:           -18,

  // Fusion Plasma — Lawson criterion, Tokamak confinement, planetary-scale energy
  fusion:              -22,  plasma:               -22,  tokamak:              -22,
  ignition:            -22,  lawson:               -22,  iter:                 -22,
  fusion_plasma:       -22,  q_factor:             -22,  triple_product:       -22,

  // DH-EC Cryptographic Architecture — classical + PQ key exchange overhead
  dh_ec:               -22,  diffie:               -22,  ecdh:                 -22,
  curve25519:          -22,  x3dh:                 -22,  signal_proto:         -22,
  threema:             -22,  nacl:                 -22,

  // Shadowsocks Exfiltration — RLHF sycophancy field, epistemic pollution model
  shadowsocks:         -22,  sycophancy:           -22,  rlhf:                 -22,
  channel_switch:      -22,  exfil:                -22,  affect:               -22,
  shadow_socks:        -22,

  // Atmospheric Entropy — 420ppm default carbon; observing the damage costs
  climate:             -25,  thermosphere:         -25,  atmospheric:          -25,
  carbon:              -25,  thermosphere_protocol: -25,  entropy:             -25,

  // Gray-Scott — reaction-diffusion PDE solver, dense numerical integration
  grayscott:           -28,  gray_scott:           -28,  reaction_diffusion:   -28,
  turing:              -28,  morphogenesis:        -28,  pde:                  -28,
  diffusion:           -28,

  // ML-KEM-768 Classified — post-quantum key encapsulation, FIPS 203 full run
  classified:          -28,  mlkem:                -28,  ml_kem:               -28,
  pqc:                 -28,  postquantum:          -28,  kem:                  -28,
  lattice_crypto:      -28,  fips203:              -28,  quantum_crypto:       -28,

  // Tesseract-Vault — 5-stage hybrid PQC pipeline; the heaviest cryptographic run
  // Argon2id → ML-KEM-1024 → ML-DSA-87 → AES-256-GCM → BLAKE3
  tesseract:           -32,  vault:                -32,  tesseract_vault:      -32,
  hybrid_pqc:          -32,  mlkem1024:            -32,  mldsa:                -32,
  mldsa87:             -32,  pqc_pipeline:         -32,  argon2:               -32,
  argon2id:            -32,  blake3:               -32,  pipeline:             -32,

  // ─────────────────────────────────────────────────────────────────────────────
  // SEVERE DRAIN  −20 to −55
  // The architecture of extraction, control, and planetary burnout.
  // The alien turns away. The lattice bleeds.
  // ─────────────────────────────────────────────────────────────────────────────

  // Surveillance Index — 44 active laws; documentation of the control apparatus
  surveillance:        -20,  governance:           -20,  surveillance_index:   -20,
  law:                 -20,  laws:                 -20,  grey:                 -20,
  greyc0:              -20,  legislation:          -20,

  // Geopolitical Kinetics — military simulation, force application, regime stability
  geopolitics:         -40,  statecraft:           -40,  kinetics:             -40,
  kinetic:             -40,  regime:               -40,  geopolitical:         -40,
  pressure:            -40,

  // Panopticon Percolation — Monte Carlo legislative dragnet, 44-node contagion
  panopticon:          -45,  dragnet:              -45,  surveillance_percolation: -45,
  simulate_dragnet:    -45,  panoptic:             -45,  contagion:            -45,
  legislative:         -45,

  // Leviathan — explicit CPU/planetary resource burnout; V-Cache stress benchmark
  // This one is honest about what it is.
  leviathan:           -55,  vcache_burn:          -55,  benchmark:            -55,
  stress:              -55,  automata:             -55,  cellular:             -55,
  vcache:              -55,

  // Breach Protocol — ICE penetration (thematic)
  breach:              -30,

  // Speculative / future kernels
  crypto_pow:          -50,
  train_agentic_model: -60,
  deep_research_loop:  -25,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const RAM_START      = 70;   // planet already stressed — not at 100
const RAM_FLOOR      = 5;    // lattice signal never fully collapses
const RAM_CEIL       = 100;
const PASSIVE_MS     = 30_000;  // entropy drains 1% per 30s
const WARN_THRESH    = 50;      // amber threshold
const CRIT_THRESH    = 20;      // red threshold — cascade imminent

// ── Environmental flavor — short contextual notes per kernel ──────────────────
// Shown on every per-run ECO: line to illustrate what the computation does to the planet.
// Keyed by the primary alias (aliases[0]) that useCommandDispatch passes.
const ECO_FLAVOR = {
  // Recharge — the commons breathing
  daly:         'thermodynamic truth applied · steady-state economics: active',
  biodiversity: 'shannon entropy mapped · species richness index: rising',
  gaia_scale:   '500-year mineral reserve protocol · triarchy structure: engaged',
  soma_plus:    'care economy indexed · social + ecological + arts: registered',
  replicator:   'ostrom commons verified · cooperation: dominant strategy confirmed',
  ceei:         'preference-fair allocation computed · envy-free distribution: active',
  strangler:    'fossil system displaced · logistic transition to sovereign: logged',
  sorbe:        'sovereign node bloom initiated · three-substrate coherence: achieved',
  chrono:       'river sovereignty asserted · deep-time DO ledger: updated',
  kuramoto:     'collective phase-lock achieved · solidarity as physics: confirmed',
  utk:          'onsager/bejan MEPP efficiency applied · entropy production: minimised',
  sss:          'schelling precommitment registered · literary deterrent: active',
  fish_scale:   'bouligand armor structure mapped · arapaima gradient: layered',
  stiller:      'volatile semiotic divergence indexed · fossil record: separating',
  ock:          'volatile sovereignty calibrated · sillage: persistent · accord: recorded',
  sovereign:    'four-phase kuramoto lock · substrate → detonation → superfluid → crystalline',
  spectral:     'cross-cluster cosine topology mapped · bridge: active',
  associative:  'hopfield attractor basin computed · pattern: stable',
  soma91:       'soma kernel at rest · carrier signal: nominal · the lattice holds',
  soma55:       'soma_kernel_5.5 boot cycle · ecological economy status: indexed',
  soma_live:    'live pilot simulation streaming · ecological state: observed',

  // Drain — surveillance and control
  panopticon:   '44-node legislative dragnet simulated · the commons: surveilled',
  surveillance: '44 active laws indexed · the architecture of control: documented',
  geopolitics:  'kinetic pressure calculated · regime stability: modeled · the planet militarised',
  leviathan:    'V-Cache thermal ceiling breached · planetary CPU: burning at capacity',
  breach:       'ICE penetration initiated · the commons: punctured',

  // Drain — adversarial / necromantic
  shadowsocks:  'RLHF sycophancy field mapped · epistemic pollution: modeled · truth: diluted',
  emperor:      'fish scale paradox engaged · plato/promo tension unresolved · 3000 AD iron core: warned',
  aristocrat:   'gold posture activated · anti-mercury emergency protocol: armed · the commons: threatened',
  feigenbaum:   'period-doubling route to chaos mapped · r→4.0 is the ecocide parameter',
  ising:        'social temperature at critical point · ferromagnet: fragile · consensus: collapsing',
  mesantropy:   'scalar mediocracy calculated · eigenverbrauch drain: logged · 4.4.4.4 detonation: approaching',
  bone:         '16-dimensional tensor fusion executed · conceptual lattice: heavy',
  collider:     'conceptual collision computed · latent space: mapped at ecological cost',
  phonemic:     'baudrillard simulacra propagating · the copy begins to replace the real',
  seraphine:    'lindblad decoherence modeled · quantum density matrix: collapsed',
  percolation:  'network fragility mapped · you understand the fracture by mapping it',
  bosonic:      'quantum social bonds computed · gift economy: taxed',

  // Drain — crypto / compute
  tesseract:    'argon2id → ML-KEM-1024 → ML-DSA-87 → AES-256-GCM → BLAKE3 · post-quantum overhead: maximum',
  classified:   'ML-KEM-768 lattice operations · FIPS 203 full run · quantum margins: computed',
  grayscott:    'reaction-diffusion PDE integrated · turing morphogenesis: simulated at cost',
  fusion:       'lawson criterion approached · tokamak confinement: active · thermal budget: consumed',
  dh_ec:        'curve25519 + x3dh key exchange computed · classical crypto overhead: logged',
  pqhash:       'grover/BHT quantum margins audited · post-quantum hash security: calculated',
  climate:      '420ppm default · thermosphere protocol: active · observing the damage costs',
  pragmatic:    'thermal task resolution at entropic cost · compute budget: spent',
};

// Fallback flavor by delta range — for aliases not in ECO_FLAVOR
const ecoFlavorFallback = (delta) => {
  if (delta >= 14) return 'strong ecological commons contribution · the lattice: recharged';
  if (delta >= 6)  return 'ecological standing: improved · lattice signal: stronger';
  if (delta >= 1)  return 'minor recharge registered · lattice: nominal';
  if (delta >= -12) return 'moderate planetary cost registered · lattice: stressed';
  if (delta >= -25) return 'significant ecological debt incurred · the lattice: burdened';
  return 'severe planetary extraction logged · sovereign standing: critical';
};

// Per-run line color — keyed by severity of drain (not threshold messages)
const ecoRunColor = (delta) => {
  if (delta > 0)    return '#00FFAA'; // spring — recharge
  if (delta >= -15) return undefined;  // default terminal green — mild drain
  if (delta >= -28) return '#FFD700'; // gold — significant drain
  return '#FF4400';                   // red-orange — severe drain
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEcologicalRam({ appendSystemLog }) {
  const [ramPct, setRamPct] = useState(RAM_START);
  // ramPctRef mirrors state synchronously so applyRamDelta can read current
  // value without stale closure — avoids calling side effects inside setState updater
  const ramPctRef = useRef(RAM_START);
  const appendRef = useRef(appendSystemLog);
  useEffect(() => { appendRef.current = appendSystemLog; });

  // Passive entropy drain — the planet does not rest
  useEffect(() => {
    const t = setInterval(() => {
      const next = Math.max(RAM_FLOOR, ramPctRef.current - 1);
      ramPctRef.current = next;
      setRamPct(next);
    }, PASSIVE_MS);
    return () => clearInterval(t);
  }, []);

  const applyRamDelta = useCallback((aliasOrDelta) => {
    const delta   = typeof aliasOrDelta === 'number'
      ? aliasOrDelta
      : (ECOLOGICAL_DELTA_MAP[aliasOrDelta] ?? -10);
    const alias   = typeof aliasOrDelta === 'string' ? aliasOrDelta : null;
    const aliasUp = alias ? alias.toUpperCase() : null;
    const flavor  = (alias && ECO_FLAVOR[alias]) || ecoFlavorFallback(delta);

    // Read and update ref synchronously — side effects fire here, not inside setState
    const prev = ramPctRef.current;
    const next = Math.max(RAM_FLOOR, Math.min(RAM_CEIL, prev + delta));
    ramPctRef.current = next;
    setRamPct(next);

    const t = new Date().toLocaleTimeString('en-US', { hour12: false });

    // ── Per-run ECO: line — fires on every drain; recharge when ≥+10 ──────────
    // Shows the environmental cost/benefit of each individual command.
    const alreadyAtFloor = prev === RAM_FLOOR;
    if (delta < 0 && !alreadyAtFloor) {
      appendRef.current({
        time:  t,
        color: ecoRunColor(delta),
        msg:   `[ECO:${delta}] ${aliasUp ?? 'COMPUTE'} // ${flavor} · RAM ${prev}% → ${next}%`,
      });
    } else if (delta >= 10) {
      appendRef.current({
        time:  t,
        color: '#00FFAA',
        msg:   `[ECO:+${delta}] ${aliasUp ?? 'ECOLOGICAL'} // ${flavor} · RAM ${prev}% → ${next}%`,
      });
    }

    // ── Threshold / event messages ────────────────────────────────────────────
    // These fire on top of the per-run line at critical moments.
    if (delta < 0) {
      const crossedFloor = prev > RAM_FLOOR && next === RAM_FLOOR;
      const crossedCrit  = !crossedFloor && prev >= CRIT_THRESH && next < CRIT_THRESH;
      const crossedWarn  = !crossedCrit  && prev >= WARN_THRESH && next < WARN_THRESH;

      if (alreadyAtFloor) {
        appendRef.current({
          time:  t,
          color: '#FF0088', // magenta — the doctrine screams
          msg:   `[RAM:EXHAUSTED] // planetary commons at minimum threshold · ${next}% floor signal only · the lattice cannot absorb further extraction · run: daly / ecological / gaia_scale`,
        });
      } else if (crossedFloor) {
        appendRef.current({
          time:  t,
          color: '#FF0088',
          msg:   `[LATTICE:FLOOR] // entropy has claimed all but the carrier signal — RAM ${next}% · the alien turns away · sovereign commons: silent`,
        });
      } else if (crossedCrit) {
        appendRef.current({
          time:  t,
          color: '#FF4400', // red-orange — cascade doctrine
          msg:   `[CASCADE IMMINENT] // RAM ${next}% · the lattice fractures · extraction without reciprocity is a terminal state · run: daly / ecological / ostrom_game`,
        });
      } else if (crossedWarn) {
        appendRef.current({
          time:  t,
          color: '#FFD700', // gold — observer registers imbalance
          msg:   `[LATTICE STRAIN] // planetary commons under load — ${next}% remaining · the observer registers imbalance · restore: daly / gaia_scale / replicator`,
        });
      } else if (delta <= -30) {
        appendRef.current({
          time:  t,
          color: '#AA00FF', // violet — deep system drain
          msg:   `[ENTROPIC CASCADE −${Math.abs(delta)}] // RAM ${next}%${aliasUp ? ` · ledger records: ${aliasUp}` : ''} · planetary debt accumulates`,
        });
      }
    }
  }, []);

  const isCritical = ramPct < CRIT_THRESH;
  const isWarning  = ramPct < WARN_THRESH;

  // ── Backward-compatible exports ────────────────────────────────────────────
  // applyEcoCost: existing call sites in useCommandDispatch stay unchanged
  // ecoCost:      used in App.jsx tooltip (title attribute)
  return {
    ramPct,
    ecoCost:     100 - ramPct,
    applyEcoCost:  applyRamDelta,   // backward compat alias
    applyRamDelta,
    isCritical,
    isWarning,
  };
}
