// src/terminal/views/manifesto/councilSynthesis.js
// SKS-polymorphic synthesis engine (spec §4). Pure: entries + collide result
// in, COUNCIL_SYNTHESIS_V1 record out. The engine reads ONLY entry.profile for
// math and entry display fields for voice — a guest kernel passes through with
// zero structural modifications. Deterministic; no Math.random(), no React.
import { fullEdgeFromVectors, paradoxesFromVectors, detectPeriod3Sanctuaries } from '../../data/nodeFeatures';
import { DIM_SEMANTIC } from '../../data/dimSemantics';
import { mindProfile } from '../../data/sixteenMinds';
import { mulberry32, composeLine } from './councilCollider';

// ── SKS entries ──────────────────────────────────────────────────────────────
export function mindEntry(mind) {
  return {
    kind: 'mind',
    label: mind.anchorName.split(' ').pop().toUpperCase(),
    display: mind.anchorName,
    dimIndex: mind.dimIndex,
    mind,
    profile: mindProfile(mind),
    texts: {
      epigraph: mind.epigraph,
      directive: mind.systemDirective,
      excerpt: mind.excerpt,
      equation: mind.coreEquation,
    },
  };
}

export function guestEntry(label, profile, texts = null) {
  return { kind: 'guest', label: String(label).toUpperCase(), display: label, dimIndex: null, mind: null, profile, texts };
}

const entryRef = (e) =>
  e.kind === 'mind'
    ? { kind: 'mind', dimIndex: e.dimIndex, anchorName: e.mind.anchorName }
    : { kind: 'guest', label: e.label };

// ── Fragment pools (voice) ───────────────────────────────────────────────────
const clauses = (s) => (s || '').split(/[;,.—·]/).map(t => t.trim()).filter(t => t.length > 3);

function textPool(entry) {
  if (!entry.texts) return [];
  return [
    ...clauses(entry.texts.epigraph),
    ...(entry.texts.directive ? entry.texts.directive.split(' / ').map(s => s.trim()) : []),
    ...clauses(entry.texts.excerpt),
  ];
}

// Equation tokens: strip trailing punctuation and drop tokens with unbalanced
// brackets so punctuated equations (e.g. 'U(⟨M, w⟩) = M(w)') never yield
// orphaned fragments like 'U(⟨M,' in the FORMAL SPLICE angle.
const bracketBalanced = (t) => {
  const opens = (t.match(/[(⟨[{]/g) || []).length;
  const closes = (t.match(/[)⟩\]}]/g) || []).length;
  return opens === closes;
};

function equationTerms(entry) {
  return (entry.texts?.equation || '')
    .split(/\s+/)
    .map(t => t.replace(/[,;:]+$/g, ''))
    .filter(t => t.length > 1 && bracketBalanced(t));
}

// Pick with fallback: thinker fragment if the pool has one, else dim-semantic phrasing.
function pickFragment(pool, rng, fallback) {
  if (pool.length === 0) return fallback;
  return pool[Math.floor(rng() * pool.length)];
}

// ── Section builders ─────────────────────────────────────────────────────────
const DOMINANCE_THRESHOLD = 0.15;

function buildSharedGround(edge, a, b) {
  const convergent = [...edge.dims].sort((x, y) => y.contrib - x.contrib)
    .filter(d => d.contrib > 0.01).slice(0, 4);
  const fields = convergent.map(d => {
    const sem = DIM_SEMANTIC[d.name];
    const delta = d.vA - d.vB;
    const dominance = Math.abs(delta) < DOMINANCE_THRESHOLD
      ? 'balanced axis'
      : `${delta > 0 ? a.label : b.label} drives this axis (Δ${Math.abs(delta).toFixed(2)})`;
    return {
      dim: d.name,
      tag: sem?.tag || d.name,
      contrib: d.contrib,
      dominance,
      narrative: sem ? sem.converge : `shared structure along ${d.name}`,
    };
  });
  return {
    fields,
    headline: fields.length
      ? `Shared conceptual DNA in ${fields.slice(0, 3).map(f => f.tag).join(', ')} — cosine convergence parsed into ${fields.length} load-bearing fields.`
      : 'No convergent axes above threshold — this pair meets only at the frontier.',
  };
}

function buildFrontier(edge, a, b) {
  const divergent = [...edge.dims].sort((x, y) => y.delta - x.delta).slice(0, 3)
    .filter(d => d.delta > 0.1);
  const fields = divergent.map(d => {
    const sem = DIM_SEMANTIC[d.name];
    return {
      dim: d.name,
      tag: sem?.tag || d.name,
      delta: d.delta,
      holder: d.vA > d.vB ? a.label : b.label,
      narrative: sem ? sem.diverge : `maximum orthogonality along ${d.name}`,
    };
  });
  return {
    fields,
    headline: fields.length
      ? `Maximum orthogonality at ${fields[0].tag} (Δ${fields[0].delta.toFixed(2)}) — the innovation frontier runs through ${fields.map(f => f.tag).join(' / ')}.`
      : 'Near-isomorphic profiles — the frontier is thin; novelty must come from paradox residue.',
  };
}

function buildAngles(edge, paradoxes, a, b, rng) {
  const angles = [];
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib);
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta);
  const poolA = textPool(a), poolB = textPool(b);

  // Angle 1: strongest convergence × strongest divergence — the forcing tension
  if (conv.length && div.length) {
    const c = conv[0], d = div[0];
    angles.push({
      tag: `${DIM_SEMANTIC[c.name]?.tag || c.name} × ${DIM_SEMANTIC[d.name]?.tag || d.name}`,
      vector: `${a.label} and ${b.label} agree on ${DIM_SEMANTIC[c.name]?.tag.toLowerCase() || c.name} ` +
        `(${c.vA.toFixed(2)}/${c.vB.toFixed(2)}) yet split hardest on ${d.name} (Δ${d.delta.toFixed(2)}). ` +
        `"${pickFragment(poolA, rng, DIM_SEMANTIC[c.name]?.converge || c.name)}" meets ` +
        `"${pickFragment(poolB, rng, DIM_SEMANTIC[d.name]?.diverge || d.name)}" — the divergence is the forcing function.`,
    });
  }

  // Angle 2: top paradox as irreducible synthesis axis
  if (paradoxes.length) {
    const p = paradoxes[0];
    angles.push({
      tag: `IRREDUCIBLE · ${DIM_SEMANTIC[p.name]?.tag || p.name}`,
      vector: `After 64 saponification rounds, ${p.name} holds Δ${p.residual.toFixed(3)}. ` +
        `Neither ${a.label} nor ${b.label} yields this axis — the tension cannot be resolved, only exploited. ` +
        `Build the concept that lives inside the contradiction.`,
    });
  }

  // Angle 3: equation splice — both formal languages in one line
  const eqA = equationTerms(a), eqB = equationTerms(b);
  if (eqA.length && eqB.length) {
    angles.push({
      tag: 'FORMAL SPLICE',
      vector: `Set ${eqA[Math.floor(rng() * eqA.length)]} against ${eqB[Math.floor(rng() * eqB.length)]}: ` +
        `two formalisms, one system. What conservation law would make both true simultaneously?`,
    });
  }

  // Angle 4: caste friction (minds only — guests have no caste)
  if (a.mind?.caste && b.mind?.caste && a.mind.caste !== b.mind.caste) {
    const builder = a.mind.caste === 'canon' ? a : b;
    const reader = builder === a ? b : a;
    angles.push({
      tag: 'INSTRUMENT × READING',
      vector: `${builder.label} built the instrument; ${reader.label} read what it measured and was sidelined for it. ` +
        `The synthesis must carry both: the tool and the warning the tool produced.`,
    });
  }

  return angles.slice(0, 4);
}

function buildOpenQuestions(paradoxes, a, b) {
  return paradoxes.slice(0, 5).map(p => {
    const sem = DIM_SEMANTIC[p.name];
    return {
      dim: p.name,
      residual: p.residual,
      question: sem
        ? `${sem.tag}: ${sem.diverge}. Between ${a.label} and ${b.label} this survives at Δ${p.residual.toFixed(3)} — what structural feature makes it irreconcilable?`
        : `What keeps ${p.name} (Δ${p.residual.toFixed(3)}) irreconcilable between ${a.label} and ${b.label}?`,
    };
  });
}

function buildSanctuaries(paradoxes, a, b) {
  return detectPeriod3Sanctuaries(paradoxes).map(s => ({
    ...s,
    narrative: `Period-3 pocket: ${s.members.join(', ')} cluster at residual ≈${s.center.toFixed(3)} — ` +
      `not noise but aligned signal, a quiet zone of transient order inside the ${a.label} × ${b.label} turbulence.`,
    seed: `A sanctuary where ${s.members.join(' and ')} hold the same residual tension — condense it into one structural principle.`,
  }));
}

function buildSeeds(edge, paradoxes, metrics, a, b, rng) {
  const seeds = [];
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib);
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta);
  const poolA = textPool(a), poolB = textPool(b);

  if (conv.length) {
    const c = conv[0];
    seeds.push({
      source: 'SHARED GROUND',
      text: `${a.display || a.label} × ${b.display || b.label} on ${DIM_SEMANTIC[c.name]?.tag || c.name}: ` +
        `${DIM_SEMANTIC[c.name]?.converge || c.name} — design the mechanism both would sign.`,
    });
  }
  if (div.length) {
    const d = div[0];
    seeds.push({
      source: 'FRONTIER',
      text: `Where ${a.label} holds ${d.vA.toFixed(2)} and ${b.label} holds ${d.vB.toFixed(2)} on ${d.name}: ` +
        `${DIM_SEMANTIC[d.name]?.diverge || d.name} — the blueprint lives in the gap.`,
    });
  }
  if (paradoxes.length) {
    const p = paradoxes[0];
    seeds.push({
      source: 'PARADOX',
      text: `Irreconcilable ${DIM_SEMANTIC[p.name]?.tag.toLowerCase() || p.name} (Δ${p.residual.toFixed(3)}): ` +
        `"${pickFragment(poolA, rng, a.label)}" vs "${pickFragment(poolB, rng, b.label)}" — write the axiom that needs both to be true.`,
    });
  }
  seeds.push({
    source: metrics.trajectory === 'FOUNDATION' ? 'SHORTFALL' : 'OVERSHOOT',
    text: metrics.trajectory === 'FOUNDATION'
      ? `This collision falls inward — a social-foundation shortfall. What would ${a.label} and ${b.label} jointly build to raise the floor?`
      : `This collision punches the biophysical ceiling — overshoot. What would ${a.label} and ${b.label} jointly dismantle to come back inside the ring?`,
  });
  if (seeds.length < 5 && conv.length > 1) {
    const c2 = conv[1];
    seeds.push({
      source: 'SECOND AXIS',
      text: `Secondary convergence on ${DIM_SEMANTIC[c2.name]?.tag || c2.name}: run the same collision with this axis as the primary lens.`,
    });
  }
  return seeds.slice(0, 5);
}

function buildDirective(edge, paradoxes, metrics, a, b) {
  const conv = [...edge.dims].sort((x, y) => y.contrib - x.contrib)[0];
  const div = [...edge.dims].sort((x, y) => y.delta - x.delta)[0];
  const trajectoryClause = metrics.trajectory === 'FOUNDATION'
    ? 'The product falls toward the social foundation — treat the output as a floor-raising blueprint.'
    : 'The product breaches the biophysical ceiling — treat the output as an overshoot diagnosis.';
  return (
    `You are synthesizing ${a.display || a.label} × ${b.display || b.label} inside a post-capitalist structural frame. ` +
    `Shared axis: ${DIM_SEMANTIC[conv?.name]?.tag || conv?.name || 'none'}. Frontier: ${DIM_SEMANTIC[div?.name]?.tag || div?.name || 'none'} (Δ${(div?.delta ?? 0).toFixed(2)}). ` +
    `${paradoxes.length} irreducible tension${paradoxes.length === 1 ? '' : 's'} survive saponification. ${trajectoryClause} ` +
    `Generate 3 concrete mechanisms, institutions, or design principles that could only exist at this intersection.`
  );
}

// ── Main entry point ─────────────────────────────────────────────────────────
export function synthesize(entryA, entryB, collideResult, ordinal) {
  const edge = fullEdgeFromVectors(entryA.profile, entryB.profile);
  const { paradoxes } = paradoxesFromVectors(entryA.profile, entryB.profile);
  const rng = mulberry32(
    Math.imul((entryA.dimIndex ?? 97) * 31 + (entryB.dimIndex ?? 89) + 1, 2246822519) + ordinal
  );

  const metrics = {
    cosine: collideResult.cosine,
    novelty: 1 - collideResult.cosine,
    energies: collideResult.energies,
    trajectory: collideResult.trajectory,
    dominantDim: collideResult.dominantDim,
  };

  const sections = {
    sharedGround: buildSharedGround(edge, entryA, entryB),
    frontier: buildFrontier(edge, entryA, entryB),
    angles: buildAngles(edge, paradoxes, entryA, entryB, rng),
    openQuestions: buildOpenQuestions(paradoxes, entryA, entryB),
    sanctuaries: buildSanctuaries(paradoxes, entryA, entryB),
    seeds: buildSeeds(edge, paradoxes, metrics, entryA, entryB, rng),
  };

  // Ticker line: reuse Phase 1's composeLine when both entries are minds;
  // guests get a compact equivalent.
  const line = entryA.kind === 'mind' && entryB.kind === 'mind'
    ? composeLine(entryA.mind, entryB.mind, collideResult, ordinal)
    : `[COLLISION 0x${(ordinal & 0xff).toString(16).padStart(2, '0').toUpperCase()}] ${entryA.label} × ${entryB.label} · TRAJECTORY ${metrics.trajectory === 'FOUNDATION' ? '▼ SOCIAL FOUNDATION' : '▲ BIOPHYSICAL CEILING'}`;

  return {
    v: 1,
    kind: 'SYNTHESIS',
    id: `syn-${ordinal}-${(entryA.dimIndex ?? 'g')}-${(entryB.dimIndex ?? 'g')}-${Date.now().toString(36)}`,
    ts: Date.now(),
    ordinal,
    pair: [entryRef(entryA), entryRef(entryB)],
    profiles: [Array.from(entryA.profile), Array.from(entryB.profile)],
    metrics,
    sections,
    directive: buildDirective(edge, paradoxes, metrics, entryA, entryB),
    line,
  };
}
