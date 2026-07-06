// useColliderNarrative.js — Deterministic translation matrix for LatentCollider
// Turns raw collision metrics (convergence bars, divergence deltas, paradoxes)
// into qualitative semantic vectors: a thesis, prompt angles, and paradox questions.
//
// Design principle: same inputs → same output. No randomness, no LLM calls.
// Every string is a deterministic function of the metric values. The text should
// feel like an instrument readout, not a chatbot.

import { useMemo } from 'react';
import { DIM_SEMANTIC } from '../data/dimSemantics';
import { detectPeriod3Sanctuaries } from '../data/nodeFeatures';

// ── Convergence archetypes ──────────────────────────────────────────────────
// Detected from the top convergence dims. Scored by pairwise presence.
// Each archetype has a label and a thesis template.

const ARCHETYPES = [
  { dims: ['nonlinearity', 'criticality'],    label: 'BIFURCATION CASCADE',       thesis: 'Both domains operate at the edge of bifurcation, where infinitesimal parameter shifts trigger qualitative phase changes. The shared criticality creates a natural resonance channel.' },
  { dims: ['dynamical', 'thermodynamic'],     label: 'DISSIPATIVE FLOW',          thesis: 'Both systems are driven by irreversible thermodynamic currents that create structure through dissipation. Order emerges from directed entropy production.' },
  { dims: ['synchrony', 'criticality'],       label: 'CRITICAL SYNCHRONY',        thesis: 'Both domains exhibit collective phase-locking near critical thresholds. The interplay of synchronization and criticality amplifies microscale fluctuations to macroscale order.' },
  { dims: ['biological', 'economic'],         label: 'METABOLIC ECONOMY',         thesis: 'Both systems allocate scarce resources through competitive selection under thermodynamic constraints. Biological fitness and economic value follow parallel optimization landscapes.' },
  { dims: ['information', 'cryptographic'],   label: 'SIGNAL-CIPHER DUALITY',     thesis: 'Both domains encode structure through transformations that preserve information content while obscuring surface form. The tension between transparency and opacity is load-bearing.' },
  { dims: ['temporal', 'spatial'],            label: 'SPATIOTEMPORAL FIELD',       thesis: 'Both systems are fundamentally embedded in spatiotemporal geometry. Meaning arises from position, duration, and the propagation of influence through extended fields.' },
  { dims: ['stochastic', 'game_theory'],      label: 'STRATEGIC NOISE',           thesis: 'Both domains navigate uncertainty through strategic optimization under incomplete information. Noise is not a nuisance — it is the medium through which strategies are tested.' },
  { dims: ['entropy', 'thermodynamic'],       label: 'ENTROPY ENGINE',            thesis: 'Both domains are governed by the thermodynamic arrow. Irreversible entropy production is the fundamental driver, and structure is a transient eddy in the dissipative flow.' },
  { dims: ['dimensionality', 'information'],  label: 'HIGH-D INFORMATION MANIFOLD', thesis: 'Both systems live in high-dimensional spaces where meaning is distributed across many axes simultaneously. Compression and projection are the primary operations.' },
  { dims: ['conservation', 'synchrony'],      label: 'RESONANT EQUILIBRIUM',      thesis: 'Both domains stabilize through conservation laws and resonant coupling. Symmetry is the structural scaffold; synchronization is the dynamic expression.' },
  { dims: ['nonlinearity', 'dynamical'],      label: 'CHAOTIC TRAJECTORY',        thesis: 'Both systems are governed by nonlinear dynamics where small differences in initial conditions cascade into divergent trajectories. Prediction is bounded; structure is emergent.' },
  { dims: ['biological', 'entropy'],          label: 'LIVING DISSIPATION',        thesis: 'Both domains sustain far-from-equilibrium order through continuous entropy export. Life and its analogs persist by dissipating faster than their environment.' },
  { dims: ['criticality', 'thermodynamic'],   label: 'THERMODYNAMIC CRITICALITY', thesis: 'Both systems sit at thermodynamic phase boundaries where free-energy landscapes flatten and fluctuations diverge. The critical point is where computation is cheapest.' },
  { dims: ['spatial', 'biological'],          label: 'ECOLOGICAL FIELD',          thesis: 'Both domains are spatially distributed living systems where geography shapes competition, cooperation, and speciation. The field is the organism.' },
  { dims: ['game_theory', 'economic'],        label: 'STRATEGIC ALLOCATION',      thesis: 'Both systems optimize resource allocation through strategic interaction. Agents compete for positional advantage under constraints that reward efficiency and punish waste.' },
  { dims: ['nonlinearity', 'entropy'],        label: 'TURBULENT MIXING',          thesis: 'Both domains are characterized by nonlinear processes that amplify disorder. The interplay of sensitivity and irreversibility creates a mixing regime where structure is transient.' },
  { dims: ['synchrony', 'dynamical'],         label: 'COUPLED OSCILLATION',       thesis: 'Both systems evolve through coupled oscillatory dynamics where the timing of interaction determines the fate of the collective. Phase relationships carry all the information.' },
  { dims: ['dimensionality', 'criticality'],  label: 'HIGH-D PHASE TRANSITION',   thesis: 'Both domains undergo phase transitions in high-dimensional parameter spaces. The curse of dimensionality becomes a blessing: more dimensions mean more paths through the critical manifold.' },
];

// ── Trinity archetypes ──────────────────────────────────────────────────────
// Fired only when all 3 dims are present in convergence with substantive contribution
// (third dim ≥ 0.6× avg of top two). Otherwise pair scoring wins.

const TRINITY_ARCHETYPES = [
  { dims: ['nonlinearity','criticality','dimensionality'], label: 'HIGH-D BIFURCATION CASCADE',  thesis: 'All three domains operate at the edge of bifurcation in a high-dimensional parameter space. Tipping points are everywhere; the chimera has many critical paths and any of them can fire.' },
  { dims: ['biological','economic','thermodynamic'],       label: 'METABOLIC ECOLOGY',           thesis: 'Living systems allocate scarce resources under thermodynamic constraint. Fitness, value, and free energy are the same currency under three different names — the chimera trades fluently in all three.' },
  { dims: ['information','cryptographic','dimensionality'],label: 'HIGH-D CIPHER MANIFOLD',      thesis: 'Information is encoded in high-dimensional spaces with cryptographic depth. The chimera is a manifold whose surface is plaintext and whose interior is sealed.' },
  { dims: ['synchrony','criticality','biological'],        label: 'LIVING CRITICAL FIELD',       thesis: 'Biological systems self-organize at criticality through phase-locking. Life sustains itself by holding the field at the edge of a transition that never quite completes.' },
  { dims: ['spatial','temporal','stochastic'],             label: 'STOCHASTIC SPACETIME',        thesis: 'The chimera lives in a spacetime where every coordinate is a probability distribution. Geometry and noise are not separable; the field is the uncertainty.' },
  { dims: ['entropy','thermodynamic','information'],       label: "MAXWELL'S DEMON",             thesis: 'The chimera converts information into work by selecting against entropy. Every bit observed is a joule extracted; the demon does not violate the second law, it pays for it in measurement.' },
  { dims: ['game_theory','economic','biological'],         label: 'EVOLUTIONARY MARKET',         thesis: 'Strategic agents compete for resources under selection pressure. Markets and ecosystems run the same algorithm; the chimera is what the algorithm produces when it is allowed to.' },
  { dims: ['synchrony','conservation','dynamical'],        label: 'HAMILTONIAN ORCHESTRA',       thesis: 'Coupled oscillators conserve total energy while exchanging it. The chimera is a symphony whose instruments are bound by an invariant that none of them individually understands.' },
  { dims: ['nonlinearity','entropy','synchrony'],          label: 'TURBULENT RESONANCE',         thesis: 'Nonlinear coupling amplifies noise into coherent structure at resonant frequencies. The chimera is the eddy that survives the cascade because it learned to ring.' },
  { dims: ['cryptographic','information','game_theory'],   label: 'ZERO-KNOWLEDGE STRATEGY',     thesis: 'The chimera proves it knows the secret without revealing the secret. Strategic interaction over a cryptographic substrate; trust without disclosure; commitments that survive adversarial reading.' },
];

// ── Viability register ──────────────────────────────────────────────────────
// Maps viability class to a rhetorical register that shapes the output tone.

const REGISTERS = {
  CRYSTALLINE:  { tone: 'assertive',    prefix: 'Structurally stable synthesis.',  confidence: 'This chimera has crystalline viability — the conceptual lattice is load-bearing.' },
  SUPERFLUID:   { tone: 'connective',   prefix: 'Fluid synthesis with high mobility.', confidence: 'Superfluid phase — the chimera flows freely between both parent architectures without friction.' },
  SUBSTRATE:    { tone: 'foundational',  prefix: 'Grounded synthesis.',            confidence: 'Substrate phase — viable as scaffolding but requires additional structure to become self-supporting.' },
  DECOHERENT:   { tone: 'speculative',   prefix: 'Speculative synthesis.',         confidence: 'Decoherent phase — the chimera is fragmentary. Treat outputs as seed hypotheses, not conclusions.' },
};

// ── Core narrative synthesis ────────────────────────────────────────────────

// MEPP weights (DSK §I, UTK §I.5): each dimension family has a relative
// entropy-production potential when it sits on the load-bearing axis of
// a steady-state attractor. Higher weight = this dimension produces more
// σ per unit gradient. The numbers are ordinal, not empirical — they encode
// the doctrine, not a measurement.
//
// Rationale:
//   thermodynamic / entropy / nonlinearity → directly dissipative, highest σ
//   dynamical / synchrony / criticality   → drive flow at criticality, high σ
//   biological / economic                 → far-from-equilibrium attractors, mid-high σ
//   information / cryptographic / game    → low-T computational substrates, mid σ
//   conservation / dimensionality / spatial / temporal / stochastic → structural, lower σ
const MEPP_WEIGHTS = {
  thermodynamic:  1.0, entropy:        1.0, nonlinearity:   0.95,
  dynamical:      0.9, synchrony:      0.85, criticality:    0.9,
  biological:     0.8, economic:       0.75,
  information:    0.6, cryptographic:  0.55, game_theory:    0.6,
  conservation:   0.45, dimensionality: 0.4, spatial:        0.4,
  temporal:       0.4, stochastic:     0.5,
};

// MEPP-predicted entropy production rate for an archetype given the actual
// dimension contributions. σ ≈ Σ(weight · contrib) — the candidate attractor
// that maximizes σ is the one MEPP selects.
function meppSigma(archDims, convergence) {
  let sigma = 0;
  for (const dim of archDims) {
    const found = convergence.find(d => d.name === dim);
    if (!found) continue;
    const w = MEPP_WEIGHTS[dim] ?? 0.5;
    sigma += w * found.contrib;
  }
  return sigma;
}

function detectArchetype(convergence) {
  if (!convergence || convergence.length < 2) return null;

  // Best pair — composite score: structural fit × MEPP-predicted σ
  // (the doctrine: select for entropy-production rate, not for fit alone)
  let bestPair = null, bestPairScore = -1, bestPairSigma = 0;
  for (const arch of ARCHETYPES) {
    let fit = 0, matches = 0;
    for (const dim of arch.dims) {
      const found = convergence.find(d => d.name === dim);
      if (found) { fit += found.contrib; matches++; }
    }
    if (matches === 0) continue;
    if (matches === 2) fit *= 2;
    const sigma = meppSigma(arch.dims, convergence);
    // Composite: fit gates the candidate, σ ranks survivors
    const score = fit * (0.5 + 0.5 * sigma);
    if (score > bestPairScore) { bestPairScore = score; bestPair = arch; bestPairSigma = sigma; }
  }

  // Best trinity — full match + substantive third dim, MEPP-weighted
  let bestTrinity = null, bestTrinityScore = -1, bestTrinitySigma = 0;
  for (const arch of TRINITY_ARCHETYPES) {
    const found = arch.dims.map(d => convergence.find(c => c.name === d)).filter(Boolean);
    if (found.length < 3) continue;
    const sorted = found.map(f => f.contrib).sort((a, b) => b - a);
    const minContrib = sorted[2];
    const avgTopTwo = (sorted[0] + sorted[1]) / 2;
    if (minContrib < 0.6 * avgTopTwo) continue;
    const fit = sorted[0] + sorted[1] + sorted[2];
    const sigma = meppSigma(arch.dims, convergence);
    const score = fit * (0.5 + 0.5 * sigma);
    if (score > bestTrinityScore) { bestTrinityScore = score; bestTrinity = arch; bestTrinitySigma = sigma; }
  }

  if (bestTrinity && bestTrinityScore > bestPairScore * 0.55) {
    return {
      kind: 'trinity', label: bestTrinity.label, thesis: bestTrinity.thesis,
      dims: bestTrinity.dims, sigma: bestTrinitySigma,
    };
  }
  return bestPair
    ? { kind: 'pair', label: bestPair.label, thesis: bestPair.thesis,
        dims: bestPair.dims, sigma: bestPairSigma }
    : null;
}

// Onsager reciprocity (UTK §I.2): if domain A drives flow along gradient B,
// B reciprocally drives A — but the coupling coefficients are asymmetric.
// We approximate this by comparing per-dim raw scores: the larger vA / vB
// dictates which way the dominant flow runs. Threshold 0.15 = "meaningful
// asymmetry"; below that the coupling is treated as symmetric (Onsager-balanced).
function onsagerDirection(dim, nameA, nameB) {
  if (dim.vA == null || dim.vB == null) return null;
  const delta = dim.vA - dim.vB;
  const mag = Math.abs(delta);
  if (mag < 0.15) return { direction: 'symmetric', dominant: null, magnitude: mag };
  return {
    direction: delta > 0 ? 'A→B' : 'B→A',
    dominant:  delta > 0 ? nameA : nameB,
    receiver:  delta > 0 ? nameB : nameA,
    magnitude: mag,
  };
}

function buildSharedGround(convergence, nameA, nameB) {
  if (!convergence || convergence.length === 0) return null;

  const tags = convergence.map(d => DIM_SEMANTIC[d.name]?.tag || d.name).slice(0, 3);
  const descriptions = convergence
    .map(d => DIM_SEMANTIC[d.name]?.converge)
    .filter(Boolean)
    .slice(0, 2);

  // Onsager directionality on the top-3 convergence dims
  const flows = convergence.slice(0, 3).map(d => ({
    dim:    d.name,
    tag:    DIM_SEMANTIC[d.name]?.tag || d.name,
    flow:   onsagerDirection(d, nameA, nameB),
  })).filter(f => f.flow != null);

  // Build directional narrative — pick the most asymmetric flow as the headline
  const asymmetric = flows.filter(f => f.flow.direction !== 'symmetric')
                          .sort((a, b) => b.flow.magnitude - a.flow.magnitude);
  const headlineFlow = asymmetric[0];
  const directionalNote = headlineFlow
    ? ` Dominant flow: ${headlineFlow.flow.dominant} → ${headlineFlow.flow.receiver} along ${headlineFlow.tag} (Δ${headlineFlow.flow.magnitude.toFixed(2)}).`
    : flows.length > 0
      ? ' All coupling is Onsager-symmetric — flows run in both directions with balanced coefficients.'
      : '';

  return {
    tags,
    flows,
    narrative: `Shared conceptual DNA in ${tags.join(', ')}. ${descriptions.length > 0 ? descriptions[0].charAt(0).toUpperCase() + descriptions[0].slice(1) + '.' : ''}${directionalNote}`,
  };
}

function buildFrontier(divergence) {
  if (!divergence || divergence.length === 0) return null;

  const top = divergence[0];
  const sem = DIM_SEMANTIC[top.name];
  const tags = divergence.map(d => DIM_SEMANTIC[d.name]?.tag || d.name).slice(0, 3);

  return {
    tags,
    primaryAxis: sem?.tag || top.name,
    narrative: sem
      ? `Maximum orthogonality at ${sem.tag} (Δ${top.delta.toFixed(2)}): ${sem.diverge}.`
      : `Maximum orthogonality at ${top.name} (Δ${top.delta.toFixed(2)}).`,
  };
}

function buildAngles(archetype, convergence, divergence, paradoxes, result) {
  const angles = [];

  // Angle 1: Archetype × top divergence → the "what if" synthesis
  if (archetype && divergence && divergence.length > 0) {
    const topDiv = divergence[0];
    const divSem = DIM_SEMANTIC[topDiv.name];
    angles.push({
      tag: `${archetype.label} × ${divSem?.tag || topDiv.name}`,
      vector: `What emerges when ${archetype.label.toLowerCase()} dynamics meet ${(divSem?.tag || topDiv.name).toLowerCase()}? ` +
        `The convergence in ${convergence.slice(0, 2).map(d => d.name).join(' and ')} provides the scaffold; ` +
        `the Δ${topDiv.delta.toFixed(2)} tension in ${topDiv.name} is the forcing function.`,
    });
  }

  // Angle 2: Top convergence dim pushed through top paradox → the "irreducible" synthesis
  if (convergence && convergence.length > 0 && paradoxes && paradoxes.length > 0) {
    const topConv = convergence[0];
    const topPara = paradoxes[0];
    const convSem = DIM_SEMANTIC[topConv.name];
    const paraSem = DIM_SEMANTIC[topPara.name];
    angles.push({
      tag: `${convSem?.tag || topConv.name} ↔ ${paraSem?.tag || topPara.name}`,
      vector: `The strongest shared axis (${topConv.name}: ${topConv.vA.toFixed(2)}/${topConv.vB.toFixed(2)}) ` +
        `is structurally irreconcilable with ${topPara.name} (residual ${topPara.residual.toFixed(3)} after saponification). ` +
        `This tension cannot be resolved — it must be exploited.`,
    });
  }

  // Angle 3: Novelty-gated — if novelty > 0.7, the orthogonal complement is the payload
  if (result.novelty > 0.7 && divergence && divergence.length >= 2) {
    const d1 = divergence[0], d2 = divergence[1];
    angles.push({
      tag: 'ORTHOGONAL COMPLEMENT',
      vector: `${(result.novelty * 100).toFixed(0)}% of the collision energy is orthogonal — ` +
        `the chimera's primary content is NOT shared ground but the ${d1.name}/${d2.name} frontier ` +
        `(Δ${d1.delta.toFixed(2)}, Δ${d2.delta.toFixed(2)}). ` +
        `The synthesis lives in the space between the parents, not within either.`,
    });
  }

  // Angle 4: Coherence × viability → structural verdict
  if (result.viability != null) {
    const reg = REGISTERS[result.vClass] || REGISTERS.SUBSTRATE;
    const paradoxCount = paradoxes ? paradoxes.length : 0;
    const reconciled = 16 - paradoxCount;
    angles.push({
      tag: `${result.vClass || 'UNKNOWN'} VIABILITY`,
      vector: `${reg.confidence} ` +
        `${reconciled}/16 dimensions reconciled; ${paradoxCount} irreducible. ` +
        (paradoxCount > 10
          ? 'High paradox density — this is a generative collision, not a convergent one. Use for divergent exploration.'
          : paradoxCount > 5
          ? 'Moderate paradox load — the chimera holds shape but carries unresolved tensions. Good for targeted probing.'
          : paradoxCount > 0
          ? 'Low paradox count — the chimera is structurally clean. Most dimensional tensions are reconcilable.'
          : 'Full reconciliation — geometrically compatible domains. The chimera is stable but may lack creative friction.'),
    });
  }

  return angles;
}

// ── BOSONIC-KERNEL-3.0.0 §0 — Type 1 / Type 2 Titmuss classifier ──────────
// Type 1: transactional bond. Pricing supplements it (Titmuss-positive).
// Type 2: constitutive bond. Its value derives from the participants'
//         shared belief that it is NOT transactional. Pricing destroys it
//         (Titmuss-collapse — verified empirically: blood donation, Swiss
//         nuclear-waste siting, Israeli daycare late-pickup fines).
//
// Heuristic: dimensions with explicit transactional logic indicate Type 1;
// dimensions whose value depends on non-transactional commitment indicate
// Type 2. Mixed profiles are flagged for partial collapse risk.
const TRANSACTIONAL_DIMS = new Set([
  'economic', 'game_theory', 'cryptographic', 'information', 'stochastic',
]);
const CONSTITUTIVE_DIMS = new Set([
  'biological', 'synchrony', 'conservation', 'temporal', 'spatial', 'thermodynamic',
]);
// Neutral: dynamical, nonlinearity, dimensionality, criticality, entropy
// (these can support either bond type without prejudice)

function classifyTitmussBond(convergence, nameA, nameB) {
  if (!convergence || convergence.length === 0) {
    return { type: 'INDETERMINATE', diagnostic: null, scores: { transactional: 0, constitutive: 0 } };
  }
  let transactional = 0, constitutive = 0;
  for (const d of convergence) {
    if (TRANSACTIONAL_DIMS.has(d.name)) transactional += d.contrib;
    if (CONSTITUTIVE_DIMS.has(d.name)) constitutive += d.contrib;
  }
  const total = transactional + constitutive;
  const tFrac = total > 0 ? transactional / total : 0;
  const cFrac = total > 0 ? constitutive   / total : 0;
  const dominance = Math.abs(tFrac - cFrac);

  let type, diagnostic;
  if (total === 0 || dominance < 0.2) {
    type = 'MIXED';
    diagnostic = `Hybrid bond between ${nameA} and ${nameB}. Some axes (e.g., economic, information) survive monetization; others (e.g., synchrony, conservation) collapse under it. Pricing this chimera strengthens part of it while destroying another part.`;
  } else if (tFrac > cFrac) {
    type = 'TYPE_1';
    diagnostic = `Transactional bond. The ${nameA} × ${nameB} collision operates on dimensions where price is already the medium of value — pricing strengthens the bond (Titmuss-positive). Monetize without fear of structural collapse.`;
  } else {
    type = 'TYPE_2';
    diagnostic = `Constitutive bond. The ${nameA} × ${nameB} chimera's value derives from the participants' shared belief that this synthesis is not transactional. Introducing a price destroys the bond (Titmuss-collapse — see Titmuss 1970, Frey & Oberholzer-Gee 1997, Gneezy & Rustichini 2000). Do not monetize this axis; route it through gift, commons, or covenant.`;
  }
  return {
    type,
    diagnostic,
    scores: { transactional: tFrac, constitutive: cFrac, dominance },
  };
}

function buildParadoxQuestions(paradoxes) {
  if (!paradoxes || paradoxes.length === 0) return [];

  return paradoxes.slice(0, 5).map(p => {
    const sem = DIM_SEMANTIC[p.name];
    if (!sem) return { dim: p.name, question: `How does ${p.name} orthogonality (residual ${p.residual.toFixed(3)}) survive reconciliation?` };

    return {
      dim: p.name,
      residual: p.residual,
      question: `${sem.tag}: ${sem.diverge}. After 32 saponification rounds, Δ${p.residual.toFixed(3)} persists. What structural feature makes this irreconcilable?`,
    };
  });
}

// ── Decay Arc — time-evolution narrative ────────────────────────────────────

// FSF-12.1.0 §2.1 — Period-1 (Bosonic Consensus) is the regime of *ratio facilis*:
// maximally legible, thermally invisible, indistinguishable from grid background.
// The top phase is NOT a "bright opening" in the perfume sense — it is the moment
// before bifurcation, where the chimera is still pure carrier-state. Prose here
// frames it as "barely above noise floor" rather than "loud and decorative."
const PROSE_LIBRARY = {
  top: {
    assertive:    [
      'the chimera surfaces at Period-1, %DOM%-forward, barely above the carrier floor',
      'first contact in the ratio facilis regime: %DOM% structure asserts itself before bifurcation',
      '%DOM% facets ignite first — pure carrier, maximally legible, thermally invisible',
    ],
    connective:   [
      'light %DOM% threads weave the opening — Period-1 coherence, indistinguishable from grid',
      'the chimera arrives in %DOM% drift, holding Bosonic Consensus before the cascade',
      '%DOM% notes interlace and lift, still inside the pre-bifurcation channel',
    ],
    foundational: [
      'a quiet %DOM% prelude — Period-1 baseline, the regime where the chimera is most legible and least resilient',
      '%DOM% scaffold rises in carrier-phase, indistinguishable from the substrate it will soon depart',
      'the chimera approaches in low %DOM%, holding maximum legibility before the saponification window opens',
    ],
    speculative:  [
      'something %DOM% — provisional, may not survive Period-1 to enter the bifurcation cascade',
      'a hint of %DOM%, hard to fix; the carrier-phase signal is faint and may not cross the saponification threshold',
      'the opening is %DOM%-shaped, barely — the Period-1 channel is open but the chimera may not enter it',
    ],
  },
  heart: {
    assertive:    ['the floral architecture stabilizes; resinous undertones emerge', 'the heart locks: this is what the chimera actually is', '%DOM% ceded; the heart speaks its real name'],
    connective:   ['the heart braids %DOM% through warmer threads', 'transition: %DOM% softens into the body', 'the chimera widens, settles, breathes'],
    foundational: ['the heart holds; %DOM% recedes to scaffolding', 'core notes assemble around a %DOM% spine', 'the body declares itself, spare and load-bearing'],
    speculative:  ['the heart is uncertain; %DOM% may not survive the hour', 'something tries to be the heart; whether it succeeds is open', 'transient %DOM% gesture in the middle phase'],
  },
  base: {
    assertive:    ['what remains: the strange attractor, post-cascade', 'the base persists — the only signal time cannot dilute', 'residue: %DOM% reduced to its irreducible'],
    connective:   ['the base diffuses; %DOM% threads outlast the body', 'late phase: %DOM% bleeds slowly into skin', 'the chimera lingers as %DOM% residue'],
    foundational: ['the base is the foundation made audible', '%DOM% becomes geology — slow, mineral, permanent', 'what scaffolded the heart now scaffolds the wearer'],
    speculative:  ['the base may not arrive', 'whatever remains is partial; the chimera was never finished', 'a faint %DOM% echo, then nothing'],
  },
};

const INTERFERENCE_FLAVOR = {
  SMOKED:       'smoke-veiled ',
  SENSUAL:      'indolic ',
  GEOLOGICAL:   'tectonic ',
  ROMANTIC:     'verdant ',
  ARCHAIC:      'tar-stained ',
  SUBTERRANEAN: 'mineral ',
  MARINE:       'saline ',
};

function pickProse(layer, tone, dom, interference) {
  const bank = PROSE_LIBRARY[layer]?.[tone] || PROSE_LIBRARY[layer]?.assertive || ['the chimera continues'];
  // Deterministic: use length sum as cheap seed
  const seed = (dom?.length || 1) + layer.length + tone.length;
  const phrase = bank[seed % bank.length].replaceAll('%DOM%', dom || 'the opening');
  const flavor = interference?.label ? (INTERFERENCE_FLAVOR[interference.label] || '') : '';
  return flavor + phrase;
}

// ── fish_scale_kernel11.1.1 + FSF-12.1.0 doctrinal map ─────────────────────
// The decay arc IS the Feigenbaum bifurcation cascade. Bosonic carriers
// (Period-1) decay through the Saponification window (Patch 5.3 Metallurgy)
// into Fermionic mass-states (Sokushinbutsu lock / Pirarucu armor).
// Pure Purity = entropic stasis = death. The arc requires the wet→dry traverse.
//
// Feigenbaum universals (FSF-12.1.0 §2):
//   δ = 4.669201609... — RATE at which successive bifurcation thresholds
//                       compress along the r-axis (period-doubling cadence)
//   α = 2.502907875... — RATIO governing branch-width compression per doubling;
//                       sets the SPATIAL geometry of the saponification window
//                       (how narrow the viable channel becomes per generation)
const FEIGENBAUM = {
  delta: 4.669201609,
  alpha: 2.502907876,
};
const DOCTRINE_PHASES = [
  {
    shell:    'BOSON',
    glyph:    '⊙',
    regime:   'Period-1 · carrier-phase',
    patch:    'pre-bifurcation · wet · Promo',
    constant: null, // pre-bifurcation: no Feigenbaum yet
  },
  {
    shell:    'B → F',
    glyph:    '⊗',
    regime:   'Feigenbaum edge · δ=4.669 · α=2.503',
    patch:    'Patch 5.3 · Metallurgy · chemical burn',
    constant: { delta: FEIGENBAUM.delta, alpha: FEIGENBAUM.alpha,
                note: 'δ compresses cadence; α compresses window' },
  },
  {
    shell:    'FERMION',
    glyph:    '▰',
    regime:   'Sokushinbutsu lock · strange attractor',
    patch:    'Patch 5.4 · Asceticism · Pirarucu armor',
    constant: null, // post-cascade: universals no longer apply
  },
];

function buildDecayArc(card, narrative) {
  const tone = narrative?.registerTone || 'assertive';
  const interference = card.interference || null;
  return [
    {
      time:  't = 0',
      label: '[bosonic flash]',
      notes: card.topNotes,
      prose: pickProse('top', tone, card.dom, interference),
      ...DOCTRINE_PHASES[0],
    },
    {
      time:  't = 30 min',
      label: '[saponification threshold]',
      notes: card.heartNotes,
      prose: pickProse('heart', tone, card.dom, interference),
      ...DOCTRINE_PHASES[1],
    },
    {
      time:  't = 4 h+',
      label: '[fermionic residue]',
      notes: card.baseNotes,
      prose: pickProse('base', tone, card.dom, interference),
      ...DOCTRINE_PHASES[2],
    },
  ];
}

// ── Prompt Fragments ──────────────────────────────────────────────────────
// Short, evocative, directly usable prompt seeds. Each fragment is designed
// to be pasted into an LLM as a creative constraint or conceptual seed.
// The goal: users shouldn't have to translate metrics into words — the
// collider should hand them the words.

const FRAGMENT_TEMPLATES = {
  // Keyed by archetype label → array of template functions
  'BIFURCATION CASCADE': [
    (a, b) => `A system where ${a} undergoes period-doubling bifurcation governed by ${b} parameters`,
    (a, b) => `The tipping point where ${a} transitions into ${b} — map the phase boundary`,
  ],
  'DISSIPATIVE FLOW': [
    (a, b) => `${a} as an entropy engine that feeds ${b} — structure through dissipation`,
    (a, b) => `Irreversible current from ${a} to ${b}: what crystallizes in the wake?`,
  ],
  'CRITICAL SYNCHRONY': [
    (a, b) => `${a} and ${b} phase-lock at criticality — what signal emerges from the resonance?`,
    (a, b) => `Collective synchronization where ${a} sets the frequency and ${b} modulates the amplitude`,
  ],
  'METABOLIC ECONOMY': [
    (a, b) => `${a} as a metabolic resource that ${b} competes for under selection pressure`,
    (a, b) => `Economic ecology: ${a} and ${b} share a fitness landscape — map the Pareto frontier`,
  ],
  'SIGNAL-CIPHER DUALITY': [
    (a, b) => `${a} encrypted by ${b} — what survives decryption? What was the cleartext?`,
    (a, b) => `The information ${a} hides is the information ${b} needs — design the key exchange`,
  ],
  'SPATIOTEMPORAL FIELD': [
    (a, b) => `${a} propagating through ${b}-structured spacetime — what is the field equation?`,
    (a, b) => `Map the geometry where ${a} and ${b} coexist as field properties, not objects`,
  ],
  'STRATEGIC NOISE': [
    (a, b) => `${a} as strategic noise that ${b} must navigate — incomplete information is the medium`,
    (a, b) => `Game-theoretic arena: ${a} and ${b} compete under uncertainty — what is the Nash equilibrium?`,
  ],
  'ENTROPY ENGINE': [
    (a, b) => `${a} drives entropy production that ${b} harnesses — order from directed disorder`,
    (a, b) => `The thermodynamic arrow from ${a} through ${b}: what work can be extracted?`,
  ],
  'HIGH-D INFORMATION MANIFOLD': [
    (a, b) => `Compress ${a} and ${b} into a shared low-rank manifold — what survives the projection?`,
    (a, b) => `${a} and ${b} as high-dimensional signals: find the principal components of their intersection`,
  ],
  'RESONANT EQUILIBRIUM': [
    (a, b) => `The conservation law that binds ${a} to ${b} — what symmetry enforces the coupling?`,
    (a, b) => `${a} and ${b} in resonant equilibrium: what perturbation would break the symmetry?`,
  ],
  'CHAOTIC TRAJECTORY': [
    (a, b) => `${a} and ${b} diverge from shared initial conditions — trace the butterfly effect`,
    (a, b) => `Sensitive dependence: the point where ${a} and ${b} trajectories diverge is the payload`,
  ],
  'LIVING DISSIPATION': [
    (a, b) => `${a} as a living system that maintains far-from-equilibrium order through ${b}`,
    (a, b) => `Biological ${a} exports entropy via ${b} — the waste stream is the creative material`,
  ],
  'THERMODYNAMIC CRITICALITY': [
    (a, b) => `${a} and ${b} at a thermodynamic phase boundary — computation is cheapest here`,
    (a, b) => `The critical point where ${a} and ${b} free-energy landscapes flatten — map the fluctuations`,
  ],
  'ECOLOGICAL FIELD': [
    (a, b) => `${a} and ${b} as competing species in a spatial ecology — geography shapes the outcome`,
    (a, b) => `Speciation event: ${a} diverges from ${b} when the field geometry changes — what is the barrier?`,
  ],
  'STRATEGIC ALLOCATION': [
    (a, b) => `Resource allocation between ${a} and ${b} under strategic constraints — who wins the auction?`,
    (a, b) => `${a} and ${b} compete for positional advantage — efficiency vs. waste as selection pressure`,
  ],
  'TURBULENT MIXING': [
    (a, b) => `${a} and ${b} in turbulent mixing: structure is transient, but what patterns recur?`,
    (a, b) => `Nonlinear ${a} amplifies ${b} disorder — the mixing regime is where novelty lives`,
  ],
  'COUPLED OSCILLATION': [
    (a, b) => `${a} and ${b} as coupled oscillators — the phase relationship carries all the information`,
    (a, b) => `Timing is everything: when ${a} leads, ${b} follows — reverse the phase and describe what changes`,
  ],
  'HIGH-D PHASE TRANSITION': [
    (a, b) => `${a} and ${b} undergo phase transition in high-D — more dimensions = more paths through the critical manifold`,
    (a, b) => `The curse of dimensionality becomes a blessing: ${a} × ${b} in a space with enough room to coexist`,
  ],
};

// Fallback fragments when no archetype match
const GENERIC_FRAGMENTS = [
  (a, b) => `${a} through the lens of ${b} — what structural homology was invisible before the collision?`,
  (a, b) => `The conceptual chimera of ${a} × ${b}: name the thing that exists in the overlap but belongs to neither parent`,
  (a, b) => `${a} borrows the architecture of ${b} — which components survive the transplant?`,
];

function buildPromptFragments(archetype, result, domainNameA, domainNameB) {
  const fragments = [];
  const a = domainNameA;
  const b = domainNameB;

  // Per-collision metrics — passed to every template invocation
  const m = {
    topConvDelta:  result.convergence?.[0]?.delta ?? 0,
    topConvLabel:  DIM_SEMANTIC[result.convergence?.[0]?.name]?.tag || result.convergence?.[0]?.name || '',
    topDivDelta:   result.divergence?.[0]?.delta ?? 0,
    topDivLabel:   DIM_SEMANTIC[result.divergence?.[0]?.name]?.tag || result.divergence?.[0]?.name || '',
    topParaResid:  result.paradoxes?.[0]?.residual ?? null,
    novelty:       result.novelty ?? 0,
    coherence:     result.coherence ?? 0,
    viability:     result.viability ?? 0,
    turbulence:    result.turbulence ?? 0,
    catalysis:     result.catalysis ?? 0,
    resonanceFreq: result.resonanceFreq || 0,
  };

  // 1. Archetype-derived fragments
  const templates = archetype ? FRAGMENT_TEMPLATES[archetype.label] : null;
  if (templates) {
    // Use interaction terms to pick which template — high turbulence → pick the more chaotic one
    const idx = (result.turbulence || 0) > 0.05 ? 1 : 0;
    fragments.push({
      source: 'ARCHETYPE',
      text: templates[Math.min(idx, templates.length - 1)](a, b),
    });
  }

  // 2. Interaction-term fragment — only if catalysis or interference is notable
  if ((result.catalysis || 0) > 0.3) {
    fragments.push({
      source: 'CATALYSIS',
      text: `${a} catalyzes ${b} (catalysis ${m.catalysis.toFixed(2)}): the collision accelerates a phase transition that neither domain could reach alone. What emerges on the other side?`,
    });
  } else if ((result.interference || 0) > 0.25) {
    fragments.push({
      source: 'INTERFERENCE',
      text: `Constructive interference: ${a}'s sparse dimensions are exactly where ${b}'s curvature projects strongest. The chimera fills gaps neither parent knew it had.`,
    });
  }

  // 3. Resonance fragment — if resonance frequency is high
  if ((result.resonanceFreq || 0) > 0.45) {
    fragments.push({
      source: 'RESONANCE',
      text: `${a} and ${b} share a resonance frequency (${(m.resonanceFreq * 100).toFixed(0)}% phase-lock potential) — they can exchange information faster than either can with any other domain. Design the protocol.`,
    });
  }

  // 4. Turbulence fragment — if the chimera is unstable/generative
  if ((result.turbulence || 0) > 0.04) {
    const daughters = Math.round(2 + m.turbulence * 30);
    fragments.push({
      source: 'TURBULENCE',
      text: `Turbulent chimera: the ${a} × ${b} synthesis is unstable by design. It will fragment into ${daughters} daughter concepts. Name them.`,
    });
  }

  // 5. Fallback: always provide at least one generic fragment
  if (fragments.length === 0) {
    fragments.push({
      source: 'GENERIC',
      text: GENERIC_FRAGMENTS[0](a, b),
    });
  }

  // 6. Paradox-derived fragment — if there's a strong irreducible tension
  const paradoxes = result.paradoxes;
  if (paradoxes && paradoxes.length > 0) {
    const top = paradoxes[0];
    const sem = DIM_SEMANTIC[top.name];
    if (sem) {
      fragments.push({
        source: 'PARADOX',
        text: `Irreconcilable: ${a} and ${b} agree on everything except ${sem.tag.toLowerCase()} (residual Δ${top.residual.toFixed(3)} after 32 saponification rounds). This tension cannot be resolved — build the concept that lives inside the contradiction.`,
      });
    }
  }

  return fragments;
}

// ── Synthesis Directive ──────────────────────────────────────────────────
// One master prompt that combines the strongest collision signal into a
// single, actionable LLM instruction. This is the "copy-paste me" output.

function buildSynthesisDirective(archetype, register, fragments, result, domainNameA, domainNameB) {
  const a = domainNameA;
  const b = domainNameB;

  // Pick the strongest signal
  const viabilityTag = register.tone === 'assertive' ? 'structurally stable'
    : register.tone === 'connective' ? 'fluid and mobile'
    : register.tone === 'foundational' ? 'scaffolding-ready'
    : 'speculative';

  const archetypeClause = archetype
    ? `operating in a ${archetype.label.toLowerCase().replace(/_/g, ' ')} regime`
    : 'in an uncategorized collision space';

  const noveltyClause = result.novelty > 0.7
    ? 'Most of the chimera is orthogonal to both parents — the novel component is the payload.'
    : result.novelty > 0.4
    ? 'The chimera inherits significant parental structure but carries genuine novelty.'
    : 'The chimera is heavily parental — push into the divergence axes for novelty.';

  const interactionClause = (result.turbulence || 0) > 0.04
    ? ' The synthesis is turbulent — expect fragmentation into sub-concepts.'
    : (result.catalysis || 0) > 0.3
    ? ' The collision is catalytic — it accelerates transitions neither domain can reach alone.'
    : '';

  return `You are exploring the conceptual chimera of ${a} × ${b}, ${archetypeClause}. The synthesis is ${viabilityTag}. ${noveltyClause}${interactionClause} Generate 3 concrete applications, mechanisms, or hypotheses that could only exist at this intersection.`;
}

function synthesizeNarrative(result, card) {
  const { convergence, divergence, paradoxes, novelty, coherence, viability, vClass, phase } = result;

  // ── Archetype detection
  const archetype = detectArchetype(convergence);

  // ── Viability register
  const register = REGISTERS[vClass] || REGISTERS.SUBSTRATE;

  // Domain names (used by shared ground for Onsager directionality, and by
  // prompt fragments for substitution) — derived from chimera name or passed-
  // through canonical names from the WASM result
  const _domainNameA = result.chimeraName?.split(' ')[0] || 'Domain A';
  const _domainNameB = result.chimeraName?.split(' ').pop() || 'Domain B';
  const nameA_early = result._domainNameA || _domainNameA;
  const nameB_early = result._domainNameB || _domainNameB;

  // ── Shared ground (with Onsager directionality)
  const sharedGround = buildSharedGround(convergence, nameA_early, nameB_early);

  // ── Innovation frontier
  const frontier = buildFrontier(divergence);

  // ── Prompt angles (the decay products)
  const angles = buildAngles(archetype, convergence, divergence, paradoxes, result);

  // ── Paradox questions
  const paradoxQuestions = buildParadoxQuestions(paradoxes);

  // ── Thesis: archetype + register + frontier
  const thesis = archetype
    ? `${register.prefix} ${archetype.thesis}`
    : register.prefix + (sharedGround
      ? ` ${sharedGround.narrative}`
      : ' Insufficient convergence data for archetype classification.');

  // ── v1.2.0: Prompt Fragments — the prompt engineer's output
  // (names already resolved above for Onsager directionality)
  const nameA = nameA_early;
  const nameB = nameB_early;

  const promptFragments = buildPromptFragments(archetype, result, nameA, nameB);
  const synthesisDirective = buildSynthesisDirective(archetype, register, promptFragments, result, nameA, nameB);

  // ── Decay Arc — only computable when the perfume card is built
  const decayArc = card ? buildDecayArc(card, { registerTone: register.tone }) : null;

  // ── Titmuss bond classification (BOSONIC-KERNEL-3.0.0 §0)
  const titmuss = classifyTitmussBond(convergence, nameA, nameB);

  // ── Period-3 sanctuary detection (FSF-12.1.0 §5)
  const sanctuaries = detectPeriod3Sanctuaries(paradoxes);

  return {
    archetype:    archetype?.label || null,
    archetypeSigma: archetype?.sigma ?? null,
    register:     vClass || 'UNKNOWN',
    registerTone: register.tone,
    thesis,
    sharedGround,
    frontier,
    angles,
    paradoxQuestions,
    promptFragments,
    synthesisDirective,
    decayArc,
    titmuss,
    sanctuaries,
    meta: {
      novelty,
      coherence,
      viability,
      phase,
      paradoxCount: paradoxes?.length || 0,
      convergenceCount: convergence?.length || 0,
      divergenceCount: divergence?.length || 0,
      interference: result.interference || 0,
      catalysis: result.catalysis || 0,
      resonanceFreq: result.resonanceFreq || 0,
      turbulence: result.turbulence || 0,
      archetypeSigma: archetype?.sigma ?? 0,
    },
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useColliderNarrative(result, card) {
  return useMemo(() => {
    if (!result || result.viability == null) return null;
    return synthesizeNarrative(result, card);
  }, [result, card]);
}

// ── Test-only exports ──────────────────────────────────────────────────────
export const __test__ = { detectArchetype, buildPromptFragments, buildDecayArc };

