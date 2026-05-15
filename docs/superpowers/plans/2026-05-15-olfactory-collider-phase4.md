# Olfactory Collider Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 4 refinement pass on the Olfactory Collider — trinity archetypes + metric-aware fragments + family interference, 16-beam parameter trace + vault decrypt shimmer + Matrix hash scramble + staggered card reveal, Discord `/seek` bot + Living Accord redemption, procedural Chimera Glyph, and Decay Trajectory Narrative.

**Architecture:** Pure narrative/glyph/decay functions live in `src/terminal/hooks/useColliderNarrative.js` and `src/terminal/views/chimeraGlyph.js` (testable). Living Accord substitution is server-side in `api/transmute/redeem.js` (signature-grade pool stays confidential). Discord bot is a separate Railway/Fly Node process using `discord.js` + `jose` for JWT issuance. Frontend visuals are React components inside the existing `LatentCollider.jsx`. Backwards-compatible with every existing accord.

**Tech Stack:** React + Vite, Vitest for tests, Vercel serverless functions, Vercel KV, `jose` for JWT, `discord.js` for bot, Web Crypto API for hashing, canvas 2D for collision visuals.

**Spec:** `docs/superpowers/specs/2026-05-15-olfactory-collider-phase4-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|------|----------------|
| `src/terminal/views/chimeraGlyph.js` | Pure SVG generator from accord hash + dims |
| `api/transmute/redeem.js` | JWT verify → deterministic Living Accord substitution → KV write |
| `api/sigil/[hash].js` | Public deterministic glyph endpoint (synthesizes dims from hash) |
| `bot/index.js` | Discord bot entry — slash command, JWT issuance, DM flow |
| `bot/package.json` | Bot deps (discord.js, jose, dotenv) |
| `bot/.env.example` | Documents env vars required |
| `bot/README.md` | Deploy instructions + rate-limit volatility note |
| `tests/colliderNarrative.test.js` | Trinity scoring, metric fragments, decay arc |
| `tests/chimeraGlyph.test.js` | Determinism + structural assertions on SVG |
| `tests/livingNote.test.js` | computeLivingNote determinism + idempotency |
| `tests/redeem.test.js` | API handler unit tests with mocked jose |

**Modified files:**

| Path | Why |
|------|-----|
| `src/terminal/hooks/useColliderNarrative.js` | Trinity archetypes, metric-aware fragments, decay arc builder |
| `src/terminal/views/LatentCollider.jsx` | Family interference, Tesseract dims passthrough, glyph render, 16-beam trace, ScramblingHash + ShimmeringCipher + DecayArcPanel + RedeemInput components, staggered reveal, 7-click affordance, redemption flow, manifest signature |
| `src/terminal/views/ScalingTab.jsx` | New CSS keyframes (`sc-vaultShimmer`, `sc-livingNote`) |
| `package.json` | Add `jose` dep |
| `.env.example` | Document `DISCORD_SOVEREIGN_SECRET` |

---

## Phase 1 — Pure Logic (Logic Refinements + Decay Arc)

### Task 1: Trinity Archetype Data Table

**Files:**
- Modify: `src/terminal/hooks/useColliderNarrative.js` — append after the existing `ARCHETYPES` array (after line ~58)

- [ ] **Step 1: Add `TRINITY_ARCHETYPES` constant**

Append immediately after the closing `];` of `ARCHETYPES`:

```js
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
```

- [ ] **Step 2: Verify file parses**

Run: `node -e "import('./src/terminal/hooks/useColliderNarrative.js').then(()=>console.log('ok'))"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/terminal/hooks/useColliderNarrative.js
git commit -m "feat(collider): add TRINITY_ARCHETYPES table for 3-dim collisions"
```

---

### Task 2: Trinity-Aware `detectArchetype` (TDD)

**Files:**
- Create: `tests/colliderNarrative.test.js`
- Modify: `src/terminal/hooks/useColliderNarrative.js` — replace `detectArchetype` (around line 72)

- [ ] **Step 1: Write the failing tests**

Create `tests/colliderNarrative.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { __test__ } from '../src/terminal/hooks/useColliderNarrative.js';

const { detectArchetype } = __test__;

describe('detectArchetype', () => {
  it('returns null when convergence is empty', () => {
    expect(detectArchetype([])).toBeNull();
    expect(detectArchetype(null)).toBeNull();
  });

  it('returns a pair archetype when only 2 strong dims present', () => {
    const conv = [
      { name: 'nonlinearity', contrib: 0.5 },
      { name: 'criticality',  contrib: 0.4 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
    expect(result.label).toBe('BIFURCATION CASCADE');
  });

  it('returns a trinity archetype when all 3 dims are substantively present', () => {
    const conv = [
      { name: 'nonlinearity',   contrib: 0.6 },
      { name: 'criticality',    contrib: 0.5 },
      { name: 'dimensionality', contrib: 0.4 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('trinity');
    expect(result.label).toBe('HIGH-D BIFURCATION CASCADE');
  });

  it('falls back to pair when the third trinity dim is too weak', () => {
    // Third dim contrib (0.05) is below 0.6 * avg(0.6, 0.5) = 0.33, so trinity is filtered out
    const conv = [
      { name: 'nonlinearity',   contrib: 0.6 },
      { name: 'criticality',    contrib: 0.5 },
      { name: 'dimensionality', contrib: 0.05 },
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
  });

  it('falls back to pair when only 2 of 3 trinity dims are present', () => {
    const conv = [
      { name: 'nonlinearity', contrib: 0.6 },
      { name: 'criticality',  contrib: 0.5 },
      // 'dimensionality' missing entirely
    ];
    const result = detectArchetype(conv);
    expect(result.kind).toBe('pair');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npx vitest run tests/colliderNarrative.test.js`
Expected: All tests FAIL — `__test__` export does not exist yet.

- [ ] **Step 3: Replace `detectArchetype` and add test export**

In `src/terminal/hooks/useColliderNarrative.js`, replace the existing `detectArchetype` function (around line 72-99) with:

```js
function detectArchetype(convergence) {
  if (!convergence || convergence.length < 2) return null;

  // Best pair (existing logic preserved)
  let bestPair = null, bestPairScore = -1;
  for (const arch of ARCHETYPES) {
    let score = 0, matches = 0;
    for (const dim of arch.dims) {
      const found = convergence.find(d => d.name === dim);
      if (found) { score += found.contrib; matches++; }
    }
    if (matches === 2) score *= 2;
    if (matches > 0 && score > bestPairScore) { bestPairScore = score; bestPair = arch; }
  }

  // Best trinity — full match + substantive third dim
  let bestTrinity = null, bestTrinityScore = -1;
  for (const arch of TRINITY_ARCHETYPES) {
    const found = arch.dims.map(d => convergence.find(c => c.name === d)).filter(Boolean);
    if (found.length < 3) continue;
    const sorted = found.map(f => f.contrib).sort((a, b) => b - a);
    const minContrib = sorted[2];
    const avgTopTwo = (sorted[0] + sorted[1]) / 2;
    if (minContrib < 0.6 * avgTopTwo) continue;
    const score = sorted[0] + sorted[1] + sorted[2];
    if (score > bestTrinityScore) { bestTrinityScore = score; bestTrinity = arch; }
  }

  if (bestTrinity && bestTrinityScore > bestPairScore * 0.55) {
    return { kind: 'trinity', label: bestTrinity.label, thesis: bestTrinity.thesis, dims: bestTrinity.dims };
  }
  return bestPair ? { kind: 'pair', label: bestPair.label, thesis: bestPair.thesis, dims: bestPair.dims } : null;
}
```

At the very bottom of the file (after the `useColliderNarrative` export), add a test-only export:

```js
// ── Test-only exports ──────────────────────────────────────────────────────
export const __test__ = { detectArchetype };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/colliderNarrative.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Verify upstream callers still work**

`detectArchetype` previously returned the bare archetype object (with `dims`, `label`, `thesis`). It now returns `{ kind, label, thesis, dims }`. Find usages and confirm they read `archetype.label` and `archetype.thesis`:

Run: `grep -n "archetype\." src/terminal/hooks/useColliderNarrative.js`

Expected: All references use `.label` or `.thesis` — both still valid on the new shape. (`kind` is additive.)

- [ ] **Step 6: Commit**

```bash
git add src/terminal/hooks/useColliderNarrative.js tests/colliderNarrative.test.js
git commit -m "feat(collider): trinity-aware detectArchetype with substantive-third-dim guard"
```

---

### Task 3: Metric-Aware Fragment Templates

**Files:**
- Modify: `src/terminal/hooks/useColliderNarrative.js` — `buildPromptFragments` and `FRAGMENT_TEMPLATES`

- [ ] **Step 1: Write failing test for metric injection**

Append to `tests/colliderNarrative.test.js`:

```js
import { describe, it, expect } from 'vitest';
// ... existing imports already at top

describe('buildPromptFragments metric injection', () => {
  it('passes metrics object to template functions', () => {
    const { buildPromptFragments } = __test__;
    const archetype = { kind: 'pair', label: 'BIFURCATION CASCADE', thesis: '', dims: ['nonlinearity','criticality'] };
    const result = {
      novelty: 0.6, coherence: 0.4, viability: 5.0,
      turbulence: 0.08, catalysis: 0.1, resonanceFreq: 0.3,
      convergence: [{ name: 'nonlinearity', contrib: 0.5, delta: 0.1 }],
      divergence: [{ name: 'temporal', delta: 0.87 }],
      paradoxes: [{ name: 'spatial', residual: 0.42 }],
    };
    const frags = buildPromptFragments(archetype, result, 'Cosmology', 'Music');
    // Find the turbulence fragment — it now reads delta from m
    const turb = frags.find(f => f.source === 'TURBULENCE');
    expect(turb).toBeTruthy();
    // Should reference daughter-concept count derived from turbulence
    expect(turb.text).toMatch(/\d+ daughter concepts/);
  });
});
```

Add `buildPromptFragments` to the test export at the bottom:

```js
export const __test__ = { detectArchetype, buildPromptFragments };
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx vitest run tests/colliderNarrative.test.js -t "metric injection"`
Expected: FAIL — current TURBULENCE fragment text does not contain "daughter concepts" number.

- [ ] **Step 3: Build the metrics object in `buildPromptFragments`**

In `src/terminal/hooks/useColliderNarrative.js`, find `buildPromptFragments(archetype, result, domainNameA, domainNameB)` (around line 299). Insert at the start of the function body, immediately after `const fragments = []; const a = domainNameA; const b = domainNameB;`:

```js
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
```

- [ ] **Step 4: Update the TURBULENCE fragment to use metrics**

Find the existing TURBULENCE branch (around line 337):

```js
  if ((result.turbulence || 0) > 0.04) {
    fragments.push({
      source: 'TURBULENCE',
      text: `Turbulent chimera: the ${a} × ${b} synthesis is unstable by design. It will fragment into 3–4 daughter concepts. Name them.`,
    });
  }
```

Replace with:

```js
  if ((result.turbulence || 0) > 0.04) {
    const daughters = Math.round(2 + m.turbulence * 30);
    fragments.push({
      source: 'TURBULENCE',
      text: `Turbulent chimera: the ${a} × ${b} synthesis is unstable by design. It will fragment into ${daughters} daughter concepts. Name them.`,
    });
  }
```

- [ ] **Step 5: Update CATALYSIS, INTERFERENCE, RESONANCE fragments to reference metrics**

Replace the CATALYSIS branch:

```js
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
```

Replace the RESONANCE branch:

```js
  if ((result.resonanceFreq || 0) > 0.45) {
    fragments.push({
      source: 'RESONANCE',
      text: `${a} and ${b} share a resonance frequency (${(m.resonanceFreq * 100).toFixed(0)}% phase-lock potential) — they can exchange information faster than either can with any other domain. Design the protocol.`,
    });
  }
```

Replace the PARADOX branch (around line 354):

```js
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
```

- [ ] **Step 6: Run test — expect pass**

Run: `npx vitest run tests/colliderNarrative.test.js -t "metric injection"`
Expected: PASS.

Run all tests: `npx vitest run tests/colliderNarrative.test.js`
Expected: All PASS (5 detect + 1 metric).

- [ ] **Step 7: Commit**

```bash
git add src/terminal/hooks/useColliderNarrative.js tests/colliderNarrative.test.js
git commit -m "feat(collider): metric-aware prompt fragments inject actual collision values"
```

---

### Task 4: Family Interference Table + buildPerfumeCard

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — add `FAMILY_INTERFERENCE` constant and integrate into `buildPerfumeCard` (around line 598-648)

- [ ] **Step 1: Add `FAMILY_INTERFERENCE` constant**

Insert in `src/terminal/views/LatentCollider.jsx` immediately after the closing `};` of `PERF_NOTES` (around line 594, before `_pickNote`):

```js
// ── Family interference patterns ────────────────────────────────────────────
// When two olfactory families collide, the chimera takes a named "interference"
// identity instead of a generic combination. Heart-note picker biases toward
// the interference vocabulary if those notes exist in PERF_NOTES.

const FAMILY_INTERFERENCE = {
  'citrus|woody':     { label: 'SMOKED',       prefix: 'Smoked',       notesBias: ['lapsang','cade','birch tar','smoked vetiver'] },
  'floral|animalic':  { label: 'SENSUAL',      prefix: 'Sensual',      notesBias: ['indole','civet','hyrax','jasmine sambac'] },
  'fresh|woody':      { label: 'GEOLOGICAL',   prefix: 'Geological',   notesBias: ['wet basalt','salt aerosol','flint','iodine'] },
  'floral|fresh':     { label: 'ROMANTIC',     prefix: 'Romantic',     notesBias: ['galbanum','mimosa','oakmoss','rose centifolia'] },
  'animalic|woody':   { label: 'ARCHAIC',      prefix: 'Archaic',      notesBias: ['labdanum','hyrax','tar musk','ambergris'] },
  'animalic|spicy':   { label: 'SUBTERRANEAN', prefix: 'Subterranean', notesBias: ['petrichor','geosmin','wet stone','musk seed'] },
  'citrus|oceanic':   { label: 'MARINE',       prefix: 'Marine',       notesBias: ['sea spray','calone','grapefruit zest','aldehyde'] },
};

function lookupInterference(domA, domB) {
  if (!domA || !domB) return null;
  const key = [domA, domB].map(s => s.toLowerCase()).sort().join('|');
  return FAMILY_INTERFERENCE[key] || null;
}
```

- [ ] **Step 2: Wire interference into `buildPerfumeCard`**

In the existing `buildPerfumeCard` function (line 598), find the `return { ... }` block at the end (line 629). Just before the `return`, add:

```js
  const interference = lookupInterference(dom, sec);
```

Then update the `name` field inside the returned object. Replace:

```js
    name: (result.chimeraName || `${dA.short} × ${dB.short}`)
            .replace(/[^\w\s×·]/g, '').trim().toUpperCase().slice(0, 42),
```

with:

```js
    name: (interference
      ? `${interference.prefix} ${heartNotes[0]} Chimera`
      : (result.chimeraName || `${dA.short} × ${dB.short}`))
        .replace(/[^\w\s×·]/g, '').trim().toUpperCase().slice(0, 42),
```

Add `interference` as a property of the returned object, just after `evap:`:

```js
    interference,
```

- [ ] **Step 3: Bias `_pickNote` toward interference vocabulary**

The cleanest path: post-process `heartNotes` after it's built (line 621). Replace:

```js
  const heartNotes = [pickH(dom, 5),  pickH(sec, 19),
    ...(result.novelty > 0.55 ? [pickH('spicy', 31)] : [])];
```

with:

```js
  let heartNotes = [pickH(dom, 5),  pickH(sec, 19),
    ...(result.novelty > 0.55 ? [pickH('spicy', 31)] : [])];

  // Apply interference bias — replace the second heart note with an interference
  // note IF such a note exists in any heart family pool.
  const interferenceForBias = lookupInterference(dom, sec);
  if (interferenceForBias) {
    const allHeartNotes = Object.values(PERF_NOTES.heart).flat();
    const biasMatches = interferenceForBias.notesBias.filter(n => allHeartNotes.includes(n));
    if (biasMatches.length > 0) {
      const idx = Math.abs(Math.floor(hA * 5 + hB * 11)) % biasMatches.length;
      heartNotes[1] = biasMatches[idx];
    }
  }
```

- [ ] **Step 4: Smoke test — render once and confirm no crash**

Run: `npm run dev` (in another terminal)
Open http://localhost:5173, click into Scaling tab, run any collision. Confirm:
- A perfume card renders
- Console has no errors
- If two domains land on a known interference pair (e.g. citrus × woody), accord name reads "Smoked <heart-note> Chimera"

Stop the dev server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): family interference renames chimera and biases heart notes"
```

---

### Task 5: `buildDecayArc` Pure Function (TDD)

**Files:**
- Modify: `src/terminal/hooks/useColliderNarrative.js`

- [ ] **Step 1: Write failing tests for decay arc**

Append to `tests/colliderNarrative.test.js`:

```js
describe('buildDecayArc', () => {
  it('returns 3 beats with time labels', () => {
    const { buildDecayArc } = __test__;
    const card = {
      topNotes: ['bergamot', 'neroli'],
      heartNotes: ['jasmine sambac', 'osmanthus'],
      baseNotes: ['vetiver', 'oud'],
      dom: 'citrus',
      sec: 'floral',
      interference: null,
    };
    const narrative = { registerTone: 'assertive' };
    const beats = buildDecayArc(card, narrative);
    expect(beats).toHaveLength(3);
    expect(beats[0].time).toBe('t = 0');
    expect(beats[1].time).toBe('t = 30 min');
    expect(beats[2].time).toBe('t = 4 h+');
    expect(beats[0].notes).toEqual(['bergamot', 'neroli']);
  });

  it('flavors prose with interference label when present', () => {
    const { buildDecayArc } = __test__;
    const card = {
      topNotes: ['bergamot'],
      heartNotes: ['lapsang'],
      baseNotes: ['vetiver'],
      dom: 'citrus',
      sec: 'woody',
      interference: { label: 'SMOKED', prefix: 'Smoked' },
    };
    const beats = buildDecayArc(card, { registerTone: 'assertive' });
    // At least one beat's prose should include a smoke-related word
    const smokyBeat = beats.find(b => /smoke|veil/i.test(b.prose));
    expect(smokyBeat).toBeTruthy();
  });
});
```

Add `buildDecayArc` to test export:

```js
export const __test__ = { detectArchetype, buildPromptFragments, buildDecayArc };
```

- [ ] **Step 2: Run test — expect failure**

Run: `npx vitest run tests/colliderNarrative.test.js -t "buildDecayArc"`
Expected: FAIL — function does not exist.

- [ ] **Step 3: Implement `buildDecayArc`**

In `src/terminal/hooks/useColliderNarrative.js`, add after `buildParadoxQuestions` (around line 209):

```js
// ── Decay Arc — time-evolution narrative ────────────────────────────────────

const PROSE_LIBRARY = {
  top: {
    assertive:    ['the chimera surfaces, %DOM%-forward, electric', 'first contact: %DOM% structure asserts itself', '%DOM% facets ignite first; the rest waits'],
    connective:   ['light %DOM% threads weave the opening', 'the chimera arrives in %DOM% drift', '%DOM% notes interlace and lift'],
    foundational: ['a quiet %DOM% prelude', '%DOM% scaffold rises', 'the chimera approaches in low %DOM%'],
    speculative:  ['something %DOM% — provisional', 'a hint of %DOM%, hard to fix', 'the opening is %DOM%-shaped, barely'],
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

function buildDecayArc(card, narrative) {
  const tone = narrative?.registerTone || 'assertive';
  const interference = card.interference || null;
  return [
    {
      time:  't = 0',
      label: '[bright opening]',
      notes: card.topNotes,
      prose: pickProse('top', tone, card.dom, interference),
    },
    {
      time:  't = 30 min',
      label: '[heart unfolds]',
      notes: card.heartNotes,
      prose: pickProse('heart', tone, card.dom, interference),
    },
    {
      time:  't = 4 h+',
      label: '[base residue]',
      notes: card.baseNotes,
      prose: pickProse('base', tone, card.dom, interference),
    },
  ];
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/colliderNarrative.test.js`
Expected: All PASS (8 total now).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useColliderNarrative.js tests/colliderNarrative.test.js
git commit -m "feat(collider): buildDecayArc — 3-beat time-evolution narrative with interference flavoring"
```

---

### Task 6: Expose `decayArc` From `useColliderNarrative`

**Files:**
- Modify: `src/terminal/hooks/useColliderNarrative.js` — `synthesizeNarrative` return value (around line 401)

- [ ] **Step 1: Modify `synthesizeNarrative` signature**

Change the function signature on line 401 from `function synthesizeNarrative(result)` to `function synthesizeNarrative(result, card)`.

- [ ] **Step 2: Build and return decay arc**

Inside `synthesizeNarrative`, just before the existing `return { ... }` block, add:

```js
  // ── Decay Arc — only computable when the perfume card is built
  const decayArc = card ? buildDecayArc(card, { registerTone: register.tone }) : null;
```

In the returned object, add `decayArc` as a property (next to `promptFragments`):

```js
    decayArc,
```

- [ ] **Step 3: Update the `useColliderNarrative` hook**

Replace the hook (around line 468) with:

```js
export function useColliderNarrative(result, card) {
  return useMemo(() => {
    if (!result || result.viability == null) return null;
    return synthesizeNarrative(result, card);
  }, [result, card]);
}
```

- [ ] **Step 4: Update the call site in LatentCollider.jsx**

In `src/terminal/views/LatentCollider.jsx`, find line 925:

```js
  const narrative = useColliderNarrative(result);
```

The card isn't available at this exact location (it's built in `handleCrystallize`). The `decayArc` is needed only inside the Tesseract card. Move card derivation into a `useMemo` so `decayArc` updates correctly. Replace line 925 with:

```js
  const narrativeCardPreview = useMemo(() => {
    if (!result || domainA == null || domainB == null) return null;
    try { return buildPerfumeCard(domainA, domainB, result); } catch { return null; }
  }, [result, domainA, domainB]);
  const narrative = useColliderNarrative(result, narrativeCardPreview);
```

(`useMemo` is already imported via `useState, useEffect, useRef, useCallback, useMemo` — verify with `grep "useMemo" src/terminal/views/LatentCollider.jsx | head -3`. If missing, add to the imports at line ~1.)

- [ ] **Step 5: Smoke test**

Run: `npm run dev`
Run a collision in the Scaling tab. Open dev tools console. Confirm no errors.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/hooks/useColliderNarrative.js src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): expose decayArc from narrative hook"
```

---

### Task 7: `buildChimeraGlyph` Pure Function (TDD)

**Files:**
- Create: `src/terminal/views/chimeraGlyph.js`
- Create: `tests/chimeraGlyph.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/chimeraGlyph.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildChimeraGlyph } from '../src/terminal/views/chimeraGlyph.js';

const SAMPLE_DIMS = {
  convergence: [
    { name: 'nonlinearity', contrib: 0.7 },
    { name: 'criticality',  contrib: 0.5 },
  ],
  divergence: [
    { name: 'temporal', delta: 0.6 },
  ],
  paradoxes: [
    { name: 'spatial', residual: 0.3 },
  ],
};

describe('buildChimeraGlyph', () => {
  it('returns an SVG string with viewBox 0 0 240 240', () => {
    const svg = buildChimeraGlyph({
      accordHash: 'a'.repeat(64),
      dims: SAMPLE_DIMS, hueA: 200, hueB: 320,
      viability: 5, nodeClass: 'RTA',
    });
    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 240 240"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('embeds the last 8 chars of hash as a stamp', () => {
    const svg = buildChimeraGlyph({
      accordHash: '1234567890abcdef'.repeat(4),
      dims: SAMPLE_DIMS, hueA: 100, hueB: 200,
      viability: 5, nodeClass: 'RTA',
    });
    expect(svg).toContain('90ABCDEF');
  });

  it('is deterministic — same hash always produces same SVG', () => {
    const args = {
      accordHash: 'deadbeef'.repeat(8),
      dims: SAMPLE_DIMS, hueA: 100, hueB: 200,
      viability: 5, nodeClass: 'DPA',
    };
    expect(buildChimeraGlyph(args)).toBe(buildChimeraGlyph(args));
  });

  it('produces different SVGs for different hashes', () => {
    const baseArgs = { dims: SAMPLE_DIMS, hueA: 100, hueB: 200, viability: 5, nodeClass: 'RTA' };
    const a = buildChimeraGlyph({ ...baseArgs, accordHash: 'a'.repeat(64) });
    const b = buildChimeraGlyph({ ...baseArgs, accordHash: 'b'.repeat(64) });
    expect(a).not.toBe(b);
  });

  it('uses 3-pointed star for RTA, 4 for DPA, 5 for R2A', () => {
    const args = { accordHash: '00'.repeat(32), dims: SAMPLE_DIMS, hueA: 0, hueB: 0, viability: 5 };
    const rta = buildChimeraGlyph({ ...args, nodeClass: 'RTA' });
    const dpa = buildChimeraGlyph({ ...args, nodeClass: 'DPA' });
    const r2a = buildChimeraGlyph({ ...args, nodeClass: 'R2A' });
    // Count the polygon points attribute lengths as a proxy
    const countPoints = svg => (svg.match(/<polygon[^>]*points="([^"]+)"/)?.[1] || '').split(/\s+/).length;
    expect(countPoints(rta)).toBe(3);
    expect(countPoints(dpa)).toBe(4);
    expect(countPoints(r2a)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx vitest run tests/chimeraGlyph.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildChimeraGlyph`**

Create `src/terminal/views/chimeraGlyph.js`:

```js
// chimeraGlyph.js — Pure procedural SVG sigil generator for Olfactory Collider accords.
// Deterministic from accord SHA-256 hash + OCK dim values.
//
// Output: 240x240 SVG string, transparent background.
//   - Outer ring with 16 anchor points (one per OCK dim)
//   - Inner geometry: 16 chords whose endpoints encode dim contributions
//   - Center mark: N-pointed star (3=RTA, 4=DPA, 5=R2A)
//   - Hash stamp: last 8 hex chars at bottom edge

const DIM_ORDER = [
  'dynamical','nonlinearity','dimensionality','criticality',
  'entropy','synchrony','conservation','temporal',
  'spatial','stochastic','game_theory','thermodynamic',
  'information','cryptographic','biological','economic',
];

function dimValue(name, dims) {
  const c = dims.convergence?.find(x => x.name === name);
  if (c) return Math.min(1, c.contrib);
  const d = dims.divergence?.find(x => x.name === name);
  if (d) return Math.min(1, d.delta);
  const p = dims.paradoxes?.find(x => x.name === name);
  if (p) return Math.min(1, p.residual);
  return 0;
}

function nPointStar(cx, cy, n, r, rotDeg) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rotDeg * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function buildChimeraGlyph({ accordHash, dims, hueA, hueB, viability, nodeClass }) {
  const cx = 120, cy = 120, R = 100;
  const safeHash = (accordHash || '0'.repeat(64)).toLowerCase();
  const hashRotation = parseInt(safeHash.slice(0, 4), 16) % 16;
  const hueMid = ((hueA + hueB) / 2) % 360;
  const visOpacity = Math.min(1, Math.max(0.3, viability / 10));

  // Inner geometry — 16 chords
  const chords = [];
  for (let i = 0; i < 16; i++) {
    const dimIdx = (i + hashRotation) % 16;
    const dimName = DIM_ORDER[dimIdx];
    const value = dimValue(dimName, dims);
    if (value < 0.05) continue;
    const a1 = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const targetIdx = (i + Math.round(value * 16)) % 16;
    const a2 = (targetIdx / 16) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    const x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R;
    const opacity = (0.2 + value * 0.7).toFixed(2);
    const width = (0.6 + value * 1.8).toFixed(2);
    chords.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="url(#cg-grad-${i})" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round"/>`);
  }

  // Per-chord gradients
  const grads = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * 360;
    grads.push(`<linearGradient id="cg-grad-${i}" gradientTransform="rotate(${angle.toFixed(1)})"><stop offset="0%" stop-color="hsl(${hueA.toFixed(0)},70%,55%)"/><stop offset="100%" stop-color="hsl(${hueB.toFixed(0)},70%,55%)"/></linearGradient>`);
  }

  // Center star
  const starN = nodeClass === 'DPA' ? 4 : nodeClass === 'R2A' ? 5 : 3;
  const starRot = parseInt(safeHash.slice(4, 6), 16);
  const starPts = nPointStar(cx, cy, starN, 18, starRot);
  const starColor = `hsla(${hueMid.toFixed(0)},60%,50%,${visOpacity.toFixed(2)})`;

  // Outer ring (dashed pattern from hash bytes 6..14)
  const dashBytes = [];
  for (let i = 6; i < 14; i += 2) dashBytes.push(parseInt(safeHash.slice(i, i + 2), 16) % 24 + 2);
  const dashArray = dashBytes.join(' ');
  const ringColor = `hsla(${hueMid.toFixed(0)},30%,50%,0.4)`;

  // Hash stamp (last 8 hex chars, uppercase)
  const stamp = safeHash.slice(-8).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">` +
    `<defs>${grads.join('')}</defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ringColor}" stroke-width="0.8" stroke-dasharray="${dashArray}"/>` +
    `${chords.join('')}` +
    `<polygon points="${starPts}" fill="${starColor}" stroke="hsl(${hueMid.toFixed(0)},70%,60%)" stroke-width="0.5"/>` +
    `<text x="${cx}" y="230" font-family="Courier New, monospace" font-size="7" fill="rgba(255,215,0,0.4)" text-anchor="middle" letter-spacing="2">${stamp}</text>` +
    `</svg>`;
}

// Synthesize plausible dims from a hash alone (used by /api/sigil/[hash] when dims not available)
export function synthDimsFromHash(hash) {
  const safe = (hash || '0'.repeat(64)).toLowerCase();
  const conv = [], div = [], para = [];
  for (let i = 0; i < 16; i++) {
    const byte = parseInt(safe.slice(i * 2, i * 2 + 2), 16);
    const name = DIM_ORDER[i];
    const value = byte / 255;
    if (value > 0.66) conv.push({ name, contrib: value });
    else if (value > 0.33) div.push({ name, delta: value });
    else para.push({ name, residual: value });
  }
  return { convergence: conv, divergence: div, paradoxes: para };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/chimeraGlyph.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/chimeraGlyph.js tests/chimeraGlyph.test.js
git commit -m "feat(collider): chimeraGlyph procedural SVG sigil generator"
```

---

## Phase 2 — Backend (Living Accord + Glyph endpoint)

### Task 8: Install `jose` Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install jose**

Run: `npm install jose`

- [ ] **Step 2: Verify install**

Run: `npx vitest --version` (sanity check that node_modules is intact)

Run: `node -e "import('jose').then(m => console.log(typeof m.SignJWT))"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add jose for JWT issuance/verification"
```

---

### Task 9: `computeLivingNote` (TDD)

**Files:**
- Create: `tests/livingNote.test.js`
- Create: `api/transmute/redeem.js` — start with just the helper

- [ ] **Step 1: Write failing tests**

Create `tests/livingNote.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeLivingNote, LIVING_NOTE_POOL } from '../api/transmute/redeem.js';

const SAMPLE_CARD = {
  topNotes:   ['bergamot', 'neroli'],
  heartNotes: ['jasmine sambac', 'osmanthus', 'rose'],
  baseNotes:  ['vetiver', 'oud'],
  dom: 'floral',
};

describe('computeLivingNote', () => {
  it('returns deterministic output for same (discordId, accordHash)', () => {
    const a = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    const b = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(a).toEqual(b);
  });

  it('returns different output for different discordIds', () => {
    const a = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    const b = computeLivingNote('user-456', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(a).not.toEqual(b);
  });

  it('substitutes a note from the LIVING_NOTE_POOL', () => {
    const result = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(['top', 'heart', 'base']).toContain(result.layer);
    expect(result.newNote).toBeTruthy();
    expect(result.editionEntropy).toMatch(/^[0-9a-f]{8}$/);
    expect(result.witnessHash).toMatch(/^[0-9a-f]+…[0-9a-f]+$/);
  });

  it('LIVING_NOTE_POOL has entries for all family-layer combos', () => {
    expect(LIVING_NOTE_POOL.FLORAL_heart.length).toBeGreaterThan(0);
    expect(LIVING_NOTE_POOL.CITRUS_top.length).toBeGreaterThan(0);
    expect(LIVING_NOTE_POOL._DEFAULT_heart.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx vitest run tests/livingNote.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `api/transmute/redeem.js` with `computeLivingNote`**

Create `api/transmute/redeem.js`:

```js
// api/transmute/redeem.js — Living Accord redemption endpoint.
// Verifies the JWT issued by the Discord bot, checks accord-hash prefix
// matches the token claim, computes the deterministic Living Note
// substitution, persists to KV for idempotency.

import { jwtVerify, errors as joseErrors } from 'jose';
import { createHash } from 'crypto';

// ── Signature-grade note pool ──────────────────────────────────────────────
// These are RARE materials, distinct from PERF_NOTES (the public/printable pool).
// One of these gets substituted into the user's accord per the deterministic
// hash of (discordId, accordHash). Server-side only — keeps the pool confidential.

export const LIVING_NOTE_POOL = {
  CITRUS_top:    ['cassis bud absolute','blood orange essence','bergamot mitcham','yuzu zest','citron galette'],
  CITRUS_heart:  ['neroli bigarade','petitgrain sur fleurs','orange blossom absolute','linden blossom'],
  CITRUS_base:   ['cedrat distillate','aged bergamot tincture'],

  FLORAL_top:    ['mimosa head space','jasmine grandiflorum','gardenia tincture'],
  FLORAL_heart:  ['osmanthus tincture','rose ottoman','tuberose absolute','ylang extra','jasmine sambac concrete'],
  FLORAL_base:   ['orris butter','iris pallida concrete','rose absolute maroc'],

  WOODY_top:     ['hinoki distillate','cypress needle absolute'],
  WOODY_heart:   ['atlas cedar absolute','sandalwood mysore aged'],
  WOODY_base:    ['oud Hindi aged','agarwood Cambodi','vetiver bourbon aged','sandalwood mysore amyris'],

  ANIMALIC_top:  ['costus root tincture','choya nakh distillate'],
  ANIMALIC_heart:['hyraceum tincture','africa stone tincture','musk seed CO2'],
  ANIMALIC_base: ['ambergris tincture (white)','beaver castoreum absolute','civet absolute aged'],

  SPICY_top:     ['pink pepper CO2','aged szechuan','cardamom absolute'],
  SPICY_heart:   ['saffron absolute','cinnamon bark CO2'],
  SPICY_base:    ['clove bud absolute','tonka bean absolute'],

  FRESH_top:     ['sea spray accord','aldehyde C-12 MNA','calone'],
  FRESH_heart:   ['violet leaf absolute','iodine accord'],
  FRESH_base:    ['ambroxan crystals','iso-E super'],

  OCEANIC_top:   ['marine accord','helional','dulse seaweed CO2'],
  OCEANIC_heart: ['ozone trace','cyclohexyl salicylate'],
  OCEANIC_base:  ['ambergris (synthetic)','ambroxide'],

  _DEFAULT_top:   ['rare aldehyde','unnamed top accord'],
  _DEFAULT_heart: ['lab signature note','archive heart molecule'],
  _DEFAULT_base:  ['archive accord','vault base resin'],
};

export function computeLivingNote(discordId, accordHash, card) {
  const seedHex = createHash('sha256')
    .update(`${discordId}:${accordHash}`)
    .digest('hex')
    .slice(0, 16);
  const seedInt = BigInt('0x' + seedHex);

  const layers   = ['top', 'heart', 'base'];
  const layer    = layers[Number(seedInt % 3n)];
  const layerKey = layer === 'top' ? 'topNotes' : layer === 'heart' ? 'heartNotes' : 'baseNotes';
  const layerNotes = card[layerKey] || [];
  const slotIdx  = layerNotes.length > 0 ? Number((seedInt >> 2n) % BigInt(layerNotes.length)) : 0;
  const oldNote  = layerNotes[slotIdx] || '—';

  const dom = (card.dom || '').toUpperCase();
  const poolKey  = `${dom}_${layer}`;
  const pool     = LIVING_NOTE_POOL[poolKey] || LIVING_NOTE_POOL[`_DEFAULT_${layer}`];
  const newNote  = pool[Number((seedInt >> 4n) % BigInt(pool.length))];

  const witnessFull = createHash('sha256').update(discordId).digest('hex');
  const witnessHash = witnessFull.slice(0, 8) + '…' + witnessFull.slice(-4);

  return {
    layer,
    slotIdx,
    oldNote,
    newNote,
    editionEntropy: seedHex.slice(0, 8),
    witnessHash,
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/livingNote.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/transmute/redeem.js tests/livingNote.test.js
git commit -m "feat(api): computeLivingNote + LIVING_NOTE_POOL signature-grade table"
```

---

### Task 10: `/api/transmute/redeem` Handler (TDD)

**Files:**
- Modify: `api/transmute/redeem.js` — append default export
- Create: `tests/redeem.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/redeem.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';

const SECRET = 'test-secret-do-not-use-in-prod-' + 'x'.repeat(20);

async function issueToken({ discordId, hashPrefix, expIn = '24h', secret = SECRET }) {
  return new SignJWT({ discordId, hashPrefix })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expIn)
    .setIssuer('bot.collider.scale94')
    .setAudience('api.transmute.redeem')
    .sign(new TextEncoder().encode(secret));
}

function mockResponse() {
  const res = { _status: 200, _body: null, _headers: {} };
  res.status = c => { res._status = c; return res; };
  res.json   = b => { res._body = b; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; return res; };
  res.end = () => res;
  res.send = b => { res._body = b; return res; };
  return res;
}

const SAMPLE_CARD = {
  topNotes:   ['bergamot', 'neroli'],
  heartNotes: ['jasmine sambac', 'osmanthus'],
  baseNotes:  ['vetiver', 'oud'],
  dom: 'floral',
};

beforeEach(() => {
  process.env.DISCORD_SOVEREIGN_SECRET = SECRET;
});

describe('/api/transmute/redeem handler', () => {
  it('rejects non-POST methods', async () => {
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'GET' }, res);
    expect(res._status).toBe(405);
  });

  it('rejects requests with missing fields', async () => {
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: {} }, res);
    expect(res._status).toBe(400);
  });

  it('returns living note for a valid token + matching prefix', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(res._body.living.newNote).toBeTruthy();
  });

  it('rejects token whose prefix does not match accordHash', async () => {
    const accordHash = '11111111' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(403);
  });

  it('returns code:expired for expired tokens', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12', expIn: '-5s' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('expired');
  });

  it('returns code:invalid for tampered tokens', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = (await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' })) + 'TAMPERED';
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('invalid');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npx vitest run tests/redeem.test.js`
Expected: All FAIL (no default export yet).

- [ ] **Step 3: Add the default export handler**

Append to `api/transmute/redeem.js`:

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { token, accordHash, accordCard } = req.body || {};
    if (!token || !accordHash || !accordCard) {
      return res.status(400).json({ ok: false, error: 'missing fields' });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET),
      { issuer: 'bot.collider.scale94', audience: 'api.transmute.redeem' },
    );

    if (accordHash.slice(0, 8).toLowerCase() !== payload.hashPrefix) {
      return res.status(403).json({ ok: false, error: 'prefix mismatch' });
    }

    const living = computeLivingNote(payload.discordId, accordHash, accordCard);

    // Best-effort KV write (Vercel KV) for idempotency
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const { kv } = await import('@vercel/kv');
        await kv.set(`living:${accordHash}:${payload.discordId}`, { living, redeemedAt: Date.now() });
      }
    } catch { /* KV optional — redemption is deterministic anyway */ }

    return res.status(200).json({ ok: true, living });
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return res.status(401).json({ ok: false, code: 'expired', error: 'Token expired. Run /seek again on Discord to receive a fresh sovereign key.' });
    }
    return res.status(401).json({ ok: false, code: 'invalid', error: 'Invalid sovereign key.' });
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run tests/redeem.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/transmute/redeem.js tests/redeem.test.js
git commit -m "feat(api): /api/transmute/redeem with JWT verify + expired/invalid distinction"
```

---

### Task 11: `/api/sigil/[hash]` Endpoint

**Files:**
- Create: `api/sigil/[hash].js`

- [ ] **Step 1: Implement endpoint**

Create `api/sigil/[hash].js`:

```js
// api/sigil/[hash].js — Public deterministic glyph endpoint.
// Renders a Chimera Glyph SVG from a 64-char SHA-256 hash alone.
// Uses synthDimsFromHash to fabricate plausible OCK dims when the real
// collision data isn't available — meant for sharing/embedding, not authenticity.

import { buildChimeraGlyph, synthDimsFromHash } from '../../src/terminal/views/chimeraGlyph.js';

export default function handler(req, res) {
  const { hash } = req.query;
  const safe = (typeof hash === 'string' ? hash : '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(safe)) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(400).send('hash must be 64 hex chars');
    return;
  }
  const dims = synthDimsFromHash(safe);
  const hueA = parseInt(safe.slice(0, 2), 16) * (360 / 256);
  const hueB = parseInt(safe.slice(2, 4), 16) * (360 / 256);
  const nodeClass = ['RTA','DPA','R2A'][parseInt(safe.slice(4, 6), 16) % 3];
  const svg = buildChimeraGlyph({ accordHash: safe, dims, hueA, hueB, viability: 5, nodeClass });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.status(200).send(svg);
}
```

- [ ] **Step 2: Smoke test locally**

Run: `npm run dev`
Browse: `http://localhost:5173/api/sigil/deadbeef${'00'.repeat(28)}`
Expected: An SVG renders showing a glyph. View source — confirm `viewBox="0 0 240 240"`.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add api/sigil/
git commit -m "feat(api): /api/sigil/[hash] public glyph endpoint"
```

---

## Phase 3 — Frontend Visual Components

### Task 12: CSS Keyframes

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

- [ ] **Step 1: Locate the existing keyframes block**

Run: `grep -n "@keyframes sc-vaultPulse\|@keyframes sc-cardReveal" src/terminal/views/ScalingTab.jsx | head -3`

This shows the line where existing keyframes live (likely inside a `<style>` block).

- [ ] **Step 2: Add new keyframes**

Inside the same `<style>` block (immediately after the existing `sc-vaultPulse` rule), add:

```css
@keyframes sc-vaultShimmer {
  0%   { color: rgba(217,70,239,0.18); filter: blur(1.5px); text-shadow: none; }
  30%  { color: rgba(255,150,255,0.95); filter: blur(0); text-shadow: 0 0 8px rgba(217,70,239,0.6); }
  100% { color: rgba(217,70,239,0.18); filter: blur(1.5px); text-shadow: none; }
}
.vault-shimmer { animation: sc-vaultShimmer 200ms ease-out; }

@keyframes sc-livingNote {
  0%   { color: rgba(255,215,0,0.7); text-shadow: none; }
  50%  { color: #39FF14; text-shadow: 0 0 12px rgba(57,255,20,0.6); }
  100% { color: rgba(57,255,20,0.85); text-shadow: 0 0 6px rgba(57,255,20,0.3); }
}
.living-note { animation: sc-livingNote 800ms cubic-bezier(0.16,1,0.3,1) forwards; }
```

- [ ] **Step 3: Visual verify (no test possible)**

No automated test. The CSS will be exercised once `ShimmeringCipher` and the mutated note span are in place (later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(collider): sc-vaultShimmer and sc-livingNote keyframes"
```

---

### Task 13: `ScramblingHash` Component

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — add component above `TesseractCard` (which starts at line ~3039)

- [ ] **Step 1: Add the component**

Find the line `function TesseractCard(...)` (line ~3039). Immediately above it, add:

```jsx
// ── ScramblingHash — Matrix-style cascade reveal of a SHA-256 hex hash ─────
function ScramblingHash({ value, duration = 1400, color = 'rgba(255,215,0,0.75)' }) {
  const [chars, setChars] = useState(() => Array(value.length).fill('0'));
  const startRef = useRef(null);

  useEffect(() => {
    let raf;
    const start = performance.now();
    startRef.current = start;
    const settleAt = value.split('').map((_, i) => (i / value.length) * (duration - 200));
    const HEX = '0123456789abcdef';
    const tick = (now) => {
      const t = now - start;
      const next = value.split('').map((real, i) => {
        if (t >= settleAt[i]) return real;
        return HEX[Math.floor(Math.random() * 16)];
      });
      setChars(next);
      if (t < duration) raf = requestAnimationFrame(tick);
      else setChars(value.split(''));
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);

  return (
    <div className="font-mono text-[10px] leading-relaxed break-all" style={{ color }}>
      {chars.join('')}
    </div>
  );
}
```

- [ ] **Step 2: Wire into TesseractCard hash display**

Inside `TesseractCard` (line ~3109-3114), replace the static hash div:

```jsx
          <div
            className="font-mono text-[10px] leading-relaxed break-all"
            style={{ color: 'rgba(255,215,0,0.75)', opacity: 0, animation: 'sc-hashReveal 1.2s cubic-bezier(0.16,1,0.3,1) 0.3s forwards' }}
          >
            {hash}
          </div>
```

with:

```jsx
          <div style={{ opacity: 0, animation: 'sc-hashReveal 0.4s cubic-bezier(0.16,1,0.3,1) 0.3s forwards' }}>
            <ScramblingHash value={hash} duration={1400} />
          </div>
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Open Scaling tab, run a collision, click "⚗ CRYSTALLIZE ACCORD". Confirm the hash scrambles char-by-char from left to right and settles to the real hash. No console errors.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): ScramblingHash — Matrix-style cascade reveal of SHA-256"
```

---

### Task 14: `ShimmeringCipher` Component

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Add component above `TesseractCard`**

```jsx
// ── ShimmeringCipher — vault ciphertext with transient decrypt flickers ────
function ShimmeringCipher({ rows }) {
  const [shimmers, setShimmers] = useState({});
  const HEX = '0123456789abcdef';

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      // Pick 2 random (rowIdx, charIdx) pairs
      const next = { ...shimmers };
      // Drop expired
      for (const key of Object.keys(next)) {
        if (next[key].expiresAt < now) delete next[key];
      }
      for (let n = 0; n < 2; n++) {
        const r = Math.floor(Math.random() * rows.length);
        const c = Math.floor(Math.random() * rows[r].length);
        const key = `${r}-${c}`;
        if (!next[key]) {
          next[key] = { char: HEX[Math.floor(Math.random() * 16)], expiresAt: now + 200 };
        }
      }
      setShimmers(next);
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  // Cleanup expired shimmers periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setShimmers(prev => {
        const next = { ...prev };
        let dirty = false;
        for (const key of Object.keys(next)) {
          if (next[key].expiresAt < now) { delete next[key]; dirty = true; }
        }
        return dirty ? next : prev;
      });
    }, 250);
    return () => clearInterval(cleanup);
  }, []);

  return (
    <div className="font-mono text-[7.5px] leading-[1.6] break-all select-none" style={{ color: 'rgba(217,70,239,0.18)', filter: 'blur(1.5px)', userSelect: 'none' }}>
      {rows.map((row, r) => (
        <div key={r}>
          {row.split('').map((ch, c) => {
            const sh = shimmers[`${r}-${c}`];
            if (sh && sh.expiresAt > Date.now()) {
              return <span key={c} className="vault-shimmer">{sh.char}</span>;
            }
            return <span key={c}>{ch}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `TesseractCard` vault block**

Find the existing blurred ciphertext in `TesseractCard` (line ~3199-3204):

```jsx
            <div className="font-mono text-[7.5px] leading-[1.6] break-all select-none" style={{ color: 'rgba(217,70,239,0.18)', filter: 'blur(1.5px)', userSelect: 'none' }}>
              {cipherRows.map((row, i) => (
                <div key={i}>{row}</div>
              ))}
            </div>
```

Replace with:

```jsx
            <ShimmeringCipher rows={cipherRows} />
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Crystallize an accord. Wait ~3-6 seconds. Observe occasional bright fuchsia char flickers in the vault block. No console errors.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): ShimmeringCipher — transient decrypt flickers in vault"
```

---

### Task 15: 16-Beam Parameter Trace at Impact

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — extend the canvas draw loop (around lines 1290-1635)

- [ ] **Step 1: Add `beamsRef` and beam-builder helper**

Near the other refs at the top of the `LatentCollider` component (after `canvasRef`, line ~912), add:

```jsx
  const beamsRef = useRef(null);
```

Find the function `createParticle` (around line 896). Above it, add:

```js
const DIM_ORDER_BEAMS = [
  'dynamical','nonlinearity','dimensionality','criticality',
  'entropy','synchrony','conservation','temporal',
  'spatial','stochastic','game_theory','thermodynamic',
  'information','cryptographic','biological','economic',
];

function buildBeams(result, hueA, hueB) {
  if (!result) return null;
  const beams = [];
  for (let i = 0; i < 16; i++) {
    const name = DIM_ORDER_BEAMS[i];
    const conv = result.convergence?.find(d => d.name === name);
    const div  = result.divergence?.find(d => d.name === name);
    const para = result.paradoxes?.find(d => d.name === name);
    let kind = 'idle', mag = 0, hue = 0;
    if (conv)      { kind = 'conv'; mag = Math.min(1, conv.contrib);  hue = (hueA + 60) % 360; }
    else if (div)  { kind = 'div';  mag = Math.min(1, div.delta);     hue = (hueB + 300) % 360; }
    else if (para) { kind = 'para'; mag = Math.min(1, para.residual); hue = 350; }
    beams.push({
      angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
      kind, mag, hue,
      lifespanMs: 120 + mag * 680,
    });
  }
  return beams;
}
```

- [ ] **Step 2: Populate `beamsRef` when result lands**

Find where `setResult(...)` is called inside `runCollision` (read context around line 1130). Just after the result is set, populate beams. Search for the pattern:

Run: `grep -n "setResult(parsed)" src/terminal/views/LatentCollider.jsx`

At each `setResult(parsed)` call site, add immediately after:

```js
beamsRef.current = { beams: buildBeams(parsed, domainById(a).hue, domainById(b).hue), startedAt: null };
```

- [ ] **Step 3: Add beam draw in the rAF loop**

Find the `draw` function inside the canvas useEffect (around line 1290-1630). Locate where `phaseRef.current === 'colliding'` rendering happens and the impact frame is detected. Add a new helper above the draw function:

```js
function drawDimensionBeams(ctx, beamsState, t, w, h) {
  if (!beamsState || !beamsState.beams) return;
  if (!beamsState.startedAt) beamsState.startedAt = t;
  const elapsed = t - beamsState.startedAt;
  const cx = w / 2, cy = h / 2;
  for (const beam of beamsState.beams) {
    if (elapsed > beam.lifespanMs) continue;
    const progress = elapsed / beam.lifespanMs;
    const eased = 1 - (1 - progress) * (1 - progress); // easeOut
    const length = beam.mag * 180 * eased;
    const alpha = (1 - progress) * 0.85;
    const x2 = cx + Math.cos(beam.angle) * length;
    const y2 = cy + Math.sin(beam.angle) * length;
    ctx.strokeStyle = `hsla(${beam.hue},85%,60%,${alpha})`;
    ctx.lineWidth = 0.5 + beam.mag * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
```

Inside the `draw` function, find the section that handles `ph === 'colliding'`. After the existing impact rendering (shockwave / debris) and **before** the result-phase transition, add:

```js
      if (ph === 'colliding' && t > 80 && beamsRef.current) {
        drawDimensionBeams(ctx, beamsRef.current, t, w, h);
      }
```

(`t` here is the frame counter from `timerRef.current` — verify by reading the surrounding code.)

- [ ] **Step 4: Reset beams in `handleReset`**

Find `handleReset` in the component. Add `beamsRef.current = null;` to the function body.

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. Run a collision. Watch the impact frame — 16 thin beams should fan out from the center, color-coded (greenish for convergence, magenta for divergence, red for paradox). No console errors.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): 16-beam parameter trace — OCK dims fire from impact point"
```

---

### Task 16: `DecayArcPanel` Component

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Add component above `TesseractCard`**

```jsx
// ── DecayArcPanel — time-evolution narrative below the note pyramid ────────
function DecayArcPanel({ beats, hueA, hueB }) {
  if (!beats || beats.length === 0) return null;
  const hueMid = ((hueA + hueB) / 2) % 360;
  return (
    <div className="mb-5 rounded-lg p-4" style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(255,215,0,0.015)' }}>
      <div className="text-[7px] font-mono tracking-[0.3em] mb-3" style={{ color: 'rgba(255,215,0,0.3)' }}>
        § DECAY ARC — TIME EVOLUTION
      </div>
      <div className="relative h-1 mb-4">
        <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(90deg, hsla(${hueA},70%,55%,0.5), hsla(${hueMid},60%,50%,0.4), hsla(${hueB},50%,45%,0.3))` }} />
        {[0.0, 0.5, 1.0].map((p, i) => (
          <div key={i} className="absolute top-1/2 w-2 h-2 rounded-full" style={{ left: `calc(${p * 100}% - 4px)`, transform: 'translateY(-50%)', background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.6)' }} />
        ))}
      </div>
      <div className="space-y-2.5">
        {beats.map((b, i) => (
          <div key={i} className="flex gap-3 items-start" style={{ opacity: 0, animation: `sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${1.2 + i * 0.4}s forwards` }}>
            <div className="text-[8px] font-mono tracking-widest shrink-0 w-16" style={{ color: 'rgba(255,215,0,0.5)' }}>{b.time}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono mb-0.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
                {b.notes.slice(0, 3).join(' · ')}
              </div>
              <div className="text-[8px] italic" style={{ color: 'rgba(255,215,0,0.45)' }}>
                {b.prose}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render inside `TesseractCard`**

The `decayArc` lives on the `narrative` object. `TesseractCard` doesn't currently receive `narrative`. Pass it down.

In `LatentCollider` component, find where `<TesseractCard ... />` is rendered (around line 2610). Add prop:

```jsx
<TesseractCard
  card={crystal}
  tesseract={tesseract}
  narrative={narrative}
  ...
/>
```

In `TesseractCard` function signature (line ~3039), add `narrative` to the destructured props:

```jsx
function TesseractCard({ card, tesseract, narrative, acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus }) {
```

Find where the note pyramid renders inside `TesseractCard` (the `NOTE_LAYERS.map(...)` block, around line 3147). Immediately after the closing `</div>` of the pyramid wrapper (`<div className="space-y-2 mb-5">...</div>`), insert:

```jsx
        {/* ── Decay Arc panel ── */}
        {narrative?.decayArc && <DecayArcPanel beats={narrative.decayArc} hueA={card.hueA} hueB={card.hueB} />}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`. Crystallize an accord. After the card reveals, the Decay Arc panel should appear below the note pyramid with 3 staggered beats.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): DecayArcPanel renders 3-beat time-evolution narrative"
```

---

### Task 17: Staggered Card Reveal (TesseractCard)

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` — `TesseractCard` block-level animation delays

- [ ] **Step 1: Add animation-delay to each block**

Inside `TesseractCard`, locate each major block. Add an `animationDelay` to the existing `style={{ ... }}` (or add `style` if absent). Use these exact delays:

| Block (search target)                         | Delay  |
|-----------------------------------------------|--------|
| The hash display block (`SHA-256 ACCORD FINGERPRINT` ancestor div) | `300ms` |
| Name + bottle/glyph row (`PUBLIC SCENT PROFILE` ancestor)          | `500ms` |
| Notes pyramid wrapper (`<div className="space-y-2 mb-5">`)         | `600ms` |
| Properties strip (`grid grid-cols-3`)                              | `950ms` |
| Encrypted vault wrapper (`ENCRYPTED MOLECULAR FORMULA` ancestor)   | `1100ms` |
| Acquire CTA wrapper (the conditional `!acquired ? ...` block parent) | `1500ms` |

For each: wrap the existing block in (or augment) an outer div with `style={{ opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) forwards', animationDelay: '<delay>' }}`.

Example for the hash block (around line 3105):

```jsx
        <div className="mb-5 rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.02)', border: '1px solid rgba(255,215,0,0.08)', opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) forwards', animationDelay: '300ms' }}>
```

Repeat for each block listed above with the corresponding delay.

- [ ] **Step 2: Smoke test**

Run: `npm run dev`. Crystallize. Confirm the card materializes block-by-block in cascade — frame → hash → name → notes → props → vault → acquire CTA — over ~1.5s.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): staggered TesseractCard reveal — block-by-block cascade"
```

---

### Task 18: Render Chimera Glyph in `TesseractCard`

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Extend `buildTesseractProfile` to carry dims + viability**

Find `async function buildTesseractProfile(card, accord, domA, domB)` (line ~701). Change signature to accept `result`:

```js
async function buildTesseractProfile(card, accord, domA, domB, result) {
```

Inside the function, find the `return { ... }` block. Add the dim data:

```js
  return {
    hash,
    publicProfile: ...,            // existing
    encryptedFormula,              // existing
    dims: result ? {
      convergence: result.convergence || [],
      divergence:  result.divergence  || [],
      paradoxes:   result.paradoxes   || [],
    } : null,
    viability: result?.viability ?? 5,
  };
```

(If you don't see `publicProfile` literally — read the existing return shape with `grep -n "return {" src/terminal/views/LatentCollider.jsx | head -5` and preserve all existing fields. Add `dims` and `viability` alongside them.)

- [ ] **Step 2: Update the call site**

Find `handleCrystallize` (line 941). The current line:

```js
      const profile = await buildTesseractProfile(card, result.accord, domainA, domainB);
```

Update to:

```js
      const profile = await buildTesseractProfile(card, result.accord, domainA, domainB, result);
```

- [ ] **Step 3: Import `buildChimeraGlyph` at top of file**

At the top of `LatentCollider.jsx` (with the other imports), add:

```js
import { buildChimeraGlyph } from './chimeraGlyph.js';
```

- [ ] **Step 4: Render glyph in `TesseractCard`**

Find the bottle render (around line 3140-3142):

```jsx
          <div className="shrink-0">
            <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
          </div>
```

Replace with:

```jsx
          <div className="shrink-0 flex items-center gap-3">
            <div
              dangerouslySetInnerHTML={{
                __html: buildChimeraGlyph({
                  accordHash: hash,
                  dims:       tesseract.dims || { convergence: [], divergence: [], paradoxes: [] },
                  hueA:       card.hueA,
                  hueB:       card.hueB,
                  viability:  tesseract.viability ?? 5,
                  nodeClass:  card.nodeClass,
                }),
              }}
              style={{ width: 96, height: 96 }}
            />
            <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
          </div>
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev`. Crystallize. Confirm a circular glyph appears beside the bottle. Run a different collision — confirm the glyph changes.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): render Chimera Glyph beside bottle in TesseractCard"
```

---

## Phase 4 — Living Accord Integration

### Task 19: Component State for Living Accord + Glyph Click Counter

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Add new state in LatentCollider component**

Near the existing crystallize state (line 930-933), add:

```jsx
  const [living, setLiving] = useState(null);
```

In `handleSelect` (find the function — search `const handleSelect`) and `handleReset`, add `setLiving(null);` to reset on collision change.

In `handleCrystallize`, after `setCrystal(card);`, hydrate from localStorage:

```js
    try {
      const stored = localStorage.getItem(`living:${profile?.hash}`);
      if (stored) setLiving(JSON.parse(stored));
    } catch { /* ignore */ }
```

Wait — `profile` isn't available yet at that point. Move this after `setTesseract(profile);`. The block becomes:

```js
    try {
      const profile = await buildTesseractProfile(card, result.accord, domainA, domainB, result);
      setTesseract(profile);
      try {
        const stored = localStorage.getItem(`living:${profile.hash}`);
        if (stored) setLiving(JSON.parse(stored));
        else setLiving(null);
      } catch { setLiving(null); }
    } catch (e) {
      console.error('[TESSERACT] hash generation failed:', e);
      setTesseract(null);
      setLiving(null);
    }
```

- [ ] **Step 2: Pass `living` to `TesseractCard`**

In the `<TesseractCard ... />` render, add prop:

```jsx
  living={living}
  onLivingRedeemed={(payload) => {
    setLiving(payload);
    try { localStorage.setItem(`living:${tesseract.hash}`, JSON.stringify(payload)); } catch { /* ignore */ }
  }}
```

In `TesseractCard` props destructure, add:

```jsx
function TesseractCard({ card, tesseract, narrative, acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus, living, onLivingRedeemed }) {
```

- [ ] **Step 3: Add 7-click vault glyph state inside TesseractCard**

At the top of `TesseractCard` (after the existing `useState` for `manifestState`), add:

```jsx
  const [vaultGlyphClicks, setVaultGlyphClicks] = useState(0);
```

Reset on card change:

```jsx
  useEffect(() => { setVaultGlyphClicks(0); }, [card.id]);
```

- [ ] **Step 4: Wire onClick on the ◈ glyph**

Find the `◈` span inside the encrypted formula vault header (around line 3190):

```jsx
              <span className="text-[8px]" style={{ color: 'rgba(217,70,239,0.6)' }}>◈</span>
```

Replace with:

```jsx
              <span
                className="text-[8px] cursor-pointer"
                onClick={() => setVaultGlyphClicks(c => c + 1)}
                style={{
                  color: vaultGlyphClicks >= 4 ? 'rgba(57,255,20,0.85)' : 'rgba(217,70,239,0.6)',
                  textShadow: vaultGlyphClicks >= 5 ? '0 0 6px rgba(57,255,20,0.5)' : 'none',
                  transition: 'color 200ms ease, text-shadow 200ms ease',
                }}
              >◈</span>
```

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): living accord state + 7-click vault glyph affordance"
```

---

### Task 20: `RedeemInput` Component

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Add `RedeemInput` above `TesseractCard`**

```jsx
// ── RedeemInput — sovereign key redemption affordance ──────────────────────
function RedeemInput({ accordHash, accordCard, onSuccess }) {
  const [token, setToken]       = useState('');
  const [status, setStatus]     = useState('idle');
  const [error, setError]       = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const handleRedeem = async () => {
    setStatus('loading');
    setError(null); setErrorCode(null);
    try {
      const r = await fetch('/api/transmute/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: token.trim(), accordHash, accordCard }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || 'redemption failed');
        setErrorCode(data.code || 'invalid');
        setStatus('error');
        return;
      }
      setStatus('done');
      onSuccess(data.living);
    } catch (e) {
      setError('Network error — try again.');
      setErrorCode('network');
      setStatus('error');
    }
  };

  return (
    <div className="rounded p-3 mt-3" style={{ border: '1px solid rgba(57,255,20,0.18)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="text-[7px] font-mono tracking-[0.3em] mb-2" style={{ color: 'rgba(57,255,20,0.4)' }}>
        § REDEEM SOVEREIGN KEY
      </div>
      <textarea
        rows={3}
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="paste sovereign key from discord dm"
        className="w-full font-mono text-[9px] p-2 mb-2 rounded"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(57,255,20,0.15)', color: 'rgba(57,255,20,0.85)', resize: 'none' }}
      />
      <button
        onClick={handleRedeem}
        disabled={status === 'loading' || !token.trim()}
        className="text-[9px] font-mono uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        style={{ borderColor: 'rgba(57,255,20,0.5)', color: '#39FF14', background: 'rgba(57,255,20,0.08)' }}
      >
        {status === 'loading' ? '[REDEEMING…]' : '◈ REDEEM'}
      </button>
      {error && (
        <div className="text-[8px] font-mono mt-2" style={{ color: errorCode === 'expired' ? 'rgba(255,215,0,0.7)' : 'rgba(244,63,94,0.7)' }}>
          {errorCode === 'expired' ? '⏳ ' : '⚠ '}{error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render `RedeemInput` when 7+ clicks AND not yet redeemed**

Inside `TesseractCard`, find the `acquire CTA` block (around line 3229-3324). Just below the closing `</div>` of the acquire CTA wrapper, add:

```jsx
        {vaultGlyphClicks >= 7 && !living && (
          <RedeemInput
            accordHash={hash}
            accordCard={card}
            onSuccess={onLivingRedeemed}
          />
        )}
```

- [ ] **Step 3: Smoke test (UI only — bot/API not yet ready)**

Run: `npm run dev`. Crystallize. Click ◈ glyph 7 times. Confirm the redeem input slides in below the acquire button. Pasting random text and clicking REDEEM should show an error.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): RedeemInput component + 7-click reveal"
```

---

### Task 21: Mutated Note Rendering + Living Accord Badge

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Apply mutated note inside the pyramid**

Inside `TesseractCard`, find the `NOTE_LAYERS.map(...)` block (around line 3147). Inside the inner map (`{notes.map((note, i) => ...)}`), the note span renders:

```jsx
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ color: `${color}cc`, background: `${color}0d`, border: `1px solid ${color}1a` }}>
                    {note}
                  </span>
```

Replace with:

```jsx
                  {(() => {
                    const isLiving = living && living.layer === key && living.slotIdx === i;
                    const display  = isLiving ? living.newNote : note;
                    return (
                      <span
                        key={i}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${isLiving ? 'living-note' : ''}`}
                        style={isLiving
                          ? { background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)' }
                          : { color: `${color}cc`, background: `${color}0d`, border: `1px solid ${color}1a` }}
                        title={isLiving ? `your signature (was: ${living.oldNote})` : undefined}
                      >
                        {display}
                      </span>
                    );
                  })()}
```

- [ ] **Step 2: Add Living Accord badge above the acquire CTA**

Find the acquire CTA wrapper (the `<div className="rounded-lg p-4 text-center transition-all ..."` around line 3229). Just above it, add:

```jsx
        {living && (
          <div className="text-center mb-3" style={{ opacity: 0, animation: 'sc-hashReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards' }}>
            <div className="text-[10px] font-bold font-mono tracking-[0.25em]" style={{ color: '#39FF14', textShadow: '0 0 12px rgba(57,255,20,0.5)' }}>
              ◈ LIVING ACCORD · YOUR SIGNATURE
            </div>
            <div className="text-[7px] font-mono tracking-widest mt-1" style={{ color: 'rgba(57,255,20,0.45)' }}>
              ENTROPY {living.editionEntropy} · WITNESS {living.witnessHash}
            </div>
          </div>
        )}
```

- [ ] **Step 3: Update acquire button text when living**

Find the acquire button text `◈ ACQUIRE COMPILED ASSET`. Replace with:

```jsx
                    {living ? '◈ ACQUIRE LIVING ASSET' : '◈ ACQUIRE COMPILED ASSET'}
```

- [ ] **Step 4: Smoke test (manually populate localStorage to simulate redemption)**

Run: `npm run dev`. Crystallize. Open dev tools console:

```js
const fakeLiving = { layer: 'heart', slotIdx: 0, oldNote: 'jasmine sambac', newNote: 'osmanthus tincture', editionEntropy: 'a3f7c2e1', witnessHash: '3b8d…f019' };
localStorage.setItem(`living:${document.querySelector('[data-vault-hash]')?.dataset.vaultHash || 'test'}`, JSON.stringify(fakeLiving));
location.reload();
```

(localStorage hydration is keyed to the actual hash; an alternative is to trigger via the redeem flow once the bot is running.)

For now, manually setting state via React DevTools or trusting Phase 5 integration testing is acceptable.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): living-note pyramid render + Living Accord badge + button text swap"
```

---

### Task 22: Manifest "§ LIVING SIGNATURE" Section

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Update `generateManifestMarkdown` signature**

Find `function generateManifestMarkdown(card, tesseract)` (line 787). Change to:

```js
function generateManifestMarkdown(card, tesseract, living = null) {
```

- [ ] **Step 2: Append the LIVING SIGNATURE section**

Inside the function body, find the closing template literal — the line ending with `_Transmutation complete. The physical substrate is vaulted. The data is sovereign._\n\``. Just before the `_Transmutation complete...` line, build a `livingSection` string:

Replace the function's `return ${...}` template tail (the part starting from `## ENCRYPTED FORMULA` through the final `Transmutation complete` italics) with:

```js
  const livingSection = living ? `

---

## § LIVING SIGNATURE

This accord carries the irreducible signature of one witness. The substituted note
was selected from the signature-grade pool by deterministic hash of the witness's
identity bound to this accord coordinate. The substitution is permanent for this
witness, and unique among all possible witnesses.

\`\`\`
LAYER         ${living.layer.toUpperCase()}
NOTE          ${living.newNote}  (was: ${living.oldNote})
ENTROPY       ${living.editionEntropy}
WITNESS HASH  ${living.witnessHash}
PROTOCOL      HS256 · 24h sovereign key · server-deterministic
\`\`\`

The molecule that is yours did not exist before this transmission. It does now.
` : '';

  return `# ECO_Sx TRANSMUTATION MANIFEST

\`\`\`
VAULT    ${hash}
COMPILED ${ts}
STATE    ◈ MANIFEST COMPILED
\`\`\`

---

## ACCORD · ${card.name}

\`\`\`
${noteLines}

CONC         ${card.conc} · ${card.concPct}
LONGEVITY    ${card.longevity}
NODE CLASS   ${card.nodeClass}
POLARITY     ${card.polLabel || 'MERIDIAN'}
OLFACTIVE    ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}
EVAP CURVE   TOP ${evapT}% / HEART ${evapH}% / BASE ${evapB}%
LOADING      ${loadingPct}%
FLASH POINT  ${flashPoint}°C
SG           ${specificGravity} g/ml
MACERATION   ${macDays} days
\`\`\`

---

## ORIGIN VECTOR // KERNEL 0.0.0.0

[... preserve existing kernel paragraph ...]

---

## FISH SCALE GEOMETRY // FEIGENBAUM δ

[... preserve existing Feigenbaum paragraph ...]

---

## ENCRYPTED FORMULA

\`\`\`
CIPHER  AES-256-GCM · RSA-OAEP-2048
BLAKE3  INTEGRITY BOUND

${cRows.join('\n')}
\`\`\`
${livingSection}
---

_Transmutation complete. The physical substrate is vaulted. The data is sovereign._
`;
```

**Important:** The bracketed `[... preserve existing ... ]` placeholders mean **do not delete those paragraphs** — keep the existing ORIGIN VECTOR and FISH SCALE prose verbatim. Only insert `${livingSection}` between the encrypted-formula closing fence and the closing italics.

The simplest implementation: don't restructure the whole template. Use string concatenation:

```js
  const baseManifest = `# ECO_Sx TRANSMUTATION MANIFEST
... [keep the existing template literal intact, ending with the ENCRYPTED FORMULA block and closing fence] ...
\`\`\`
`;

  const closingItalics = `
---

_Transmutation complete. The physical substrate is vaulted. The data is sovereign._
`;

  return baseManifest + livingSection + closingItalics;
```

Refactor the existing function to split at the right point: keep everything from the heading down through the encrypted-formula closing fence as `baseManifest`, then append `livingSection` (empty if no living), then `closingItalics`.

- [ ] **Step 3: Update download caller in `TesseractCard`**

Find `handleDownload` inside `TesseractCard` (line ~3042). Change:

```js
    const md = generateManifestMarkdown(card, tesseract);
```

to:

```js
    const md = generateManifestMarkdown(card, tesseract, living);
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Crystallize, simulate living state via DevTools, click "ACQUIRE LIVING ASSET", open the downloaded `.md` file. Confirm the LIVING SIGNATURE section appears.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): generateManifestMarkdown emits LIVING SIGNATURE section when redeemed"
```

---

## Phase 5 — Discord Bot

### Task 23: Bot Scaffolding

**Files:**
- Create: `bot/package.json`
- Create: `bot/.env.example`
- Create: `bot/.gitignore`

- [ ] **Step 1: Create `bot/package.json`**

```json
{
  "name": "scale94-collider-bot",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "Discord bot for the Olfactory Collider — issues sovereign keys for Living Accord redemption.",
  "scripts": {
    "start":    "node index.js",
    "register": "node register-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv":     "^16.4.5",
    "jose":       "^5.9.6"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create `bot/.env.example`**

```
# Discord bot credentials (Discord Developer Portal → Application → Bot)
DISCORD_BOT_TOKEN=

# Application + guild + channel IDs
DISCORD_APP_ID=
GUILD_ID=
CHANNEL_ID=1220252213742403666

# Shared secret with the Vercel /api/transmute/redeem endpoint
DISCORD_SOVEREIGN_SECRET=
```

- [ ] **Step 3: Create `bot/.gitignore`**

```
node_modules/
.env
.env.local
```

- [ ] **Step 4: Install bot deps**

```bash
cd bot
npm install
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add bot/package.json bot/package-lock.json bot/.env.example bot/.gitignore
git commit -m "chore(bot): scaffold Discord bot package"
```

---

### Task 24: Slash Command Registration Script

**Files:**
- Create: `bot/register-commands.js`

- [ ] **Step 1: Create the script**

```js
// register-commands.js — Run once after deploy or whenever command shape changes.
// Registers the /seek slash command to the configured guild.

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const command = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Seek the sovereign key for an accord. Provide the 8-char prefix from your manifest.')
  .addStringOption(opt =>
    opt.setName('prefix')
       .setDescription('First 8 hex chars of your accord SHA-256 hash')
       .setRequired(true)
       .setMinLength(8)
       .setMaxLength(8)
  )
  .toJSON();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

try {
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.GUILD_ID),
    { body: [command] },
  );
  console.log('✓ /seek registered to guild', process.env.GUILD_ID);
} catch (err) {
  console.error('✗ failed:', err);
  process.exit(1);
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/register-commands.js
git commit -m "feat(bot): register-commands script for /seek slash command"
```

---

### Task 25: Bot Main Entry — `/seek` Handler with JWT + DM

**Files:**
- Create: `bot/index.js`

- [ ] **Step 1: Create the bot main file**

```js
// index.js — Discord bot entry. Listens for /seek, validates input, signs a
// JWT bound to the requesting user + accord hash prefix, DMs the user the
// sovereign key with manifesto-voice copy.

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { SignJWT } from 'jose';

const HEX8 = /^[0-9a-f]{8}$/i;
const TTL  = '24h';

const ALLOWED_CHANNEL = process.env.CHANNEL_ID;
const SECRET = new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET);

// ── Rate limit (in-memory, single-instance) ───────────────────────────────
// Resets on container restart — documented limitation.
const seenPerUser = new Map(); // userId -> { count, dayKey }
const seenPerPrefix = new Map(); // `${userId}:${prefix}` -> hourTimestamp

function rateLimit(userId, prefix) {
  const now      = Date.now();
  const dayKey   = new Date(now).toISOString().slice(0, 10);
  const hourBin  = Math.floor(now / 3_600_000);
  const userRec  = seenPerUser.get(userId);
  if (!userRec || userRec.dayKey !== dayKey) {
    seenPerUser.set(userId, { count: 1, dayKey });
  } else if (userRec.count >= 5) {
    return { ok: false, reason: 'daily_limit' };
  } else {
    userRec.count++;
  }
  const prefixKey = `${userId}:${prefix}`;
  const lastHour  = seenPerPrefix.get(prefixKey);
  if (lastHour === hourBin) {
    return { ok: false, reason: 'prefix_cooldown' };
  }
  seenPerPrefix.set(prefixKey, hourBin);
  return { ok: true };
}

async function issueToken(discordId, prefix) {
  return new SignJWT({ discordId, hashPrefix: prefix.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .setIssuer('bot.collider.scale94')
    .setAudience('api.transmute.redeem')
    .sign(SECRET);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
  console.log(`◈ collider bot online as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'seek') return;
  if (ALLOWED_CHANNEL && interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({ content: '⚠ /seek is only available in the designated channel.', flags: MessageFlags.Ephemeral });
  }
  const prefix = interaction.options.getString('prefix', true);
  if (!HEX8.test(prefix)) {
    return interaction.reply({
      content: '⚠ Hash prefix must be 8 hex characters (0-9, a-f). Take it from the SHA-256 line in your manifest.',
      flags:   MessageFlags.Ephemeral,
    });
  }
  const rl = rateLimit(interaction.user.id, prefix.toLowerCase());
  if (!rl.ok) {
    const msg = rl.reason === 'daily_limit'
      ? '⚠ Daily limit reached (5 prefixes/day). Try again tomorrow.'
      : '⚠ This prefix was already sought within the last hour. Try again later or use a different accord.';
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const token = await issueToken(interaction.user.id, prefix);
  const expIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const dmBody =
`◈ SOVEREIGN KEY TRANSMITTED

Your sovereign key has been transmitted. The vault accepts only your hand.
The molecule that is yours did not exist before this transmission. It does now.

PREFIX     ${prefix.toLowerCase()}
EXPIRES    ${expIso}
PROTOCOL   HS256 / 24h ttl

———

Paste this token into the REDEEM SOVEREIGN KEY input on your accord:

\`\`\`
${token}
\`\`\`

(The input becomes visible after you witness the vault glyph seven times.)`;

  try {
    const dm = await interaction.user.createDM();
    await dm.send(dmBody);
    await interaction.editReply({ content: '◈ Sovereign key sent via DM. Check your messages.' });
  } catch (err) {
    // DM failed — user has DMs off. Fall back to ephemeral channel reply.
    await interaction.editReply({ content: dmBody });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

- [ ] **Step 2: Local sanity test — bot starts, no syntax errors**

Run: `cd bot && node --check index.js && cd ..`
Expected: no output (syntax OK).

- [ ] **Step 3: Commit**

```bash
git add bot/index.js
git commit -m "feat(bot): /seek handler — issues 24h JWT, DMs user with manifesto-voice copy"
```

---

### Task 26: Bot README with Deploy + Rate-Limit Note

**Files:**
- Create: `bot/README.md`

- [ ] **Step 1: Write the README**

```markdown
# scale94 Collider Bot

Discord bot for the Olfactory Collider's Living Accord easter egg. Listens for `/seek <prefix>` in a single channel, signs a JWT bound to (discordId, accordHashPrefix), DMs the user the sovereign key.

## Setup

1. Create an application in the Discord Developer Portal.
2. Enable the **bot** feature, copy the bot token.
3. Add the bot to your guild with the `bot` and `applications.commands` scopes.
4. Copy `.env.example` → `.env` and fill in:
   - `DISCORD_BOT_TOKEN` — bot token
   - `DISCORD_APP_ID` — application ID
   - `GUILD_ID` — server (guild) ID
   - `CHANNEL_ID` — channel where `/seek` is allowed (default: scale94 #channel)
   - `DISCORD_SOVEREIGN_SECRET` — must match the value set on the Vercel deployment for `/api/transmute/redeem`
5. Register the slash command (one-time, or whenever shape changes):

   ```bash
   npm run register
   ```

6. Start the bot:

   ```bash
   npm start
   ```

## Deployment

Recommended: **Railway** or **Fly.io**. The bot maintains a long-lived websocket connection to Discord, so Vercel serverless is not suitable. A small Hetzner droplet also works.

Set the same env vars in your platform's secret store.

## Rate Limits

Per-user limits are tracked **in-memory**:
- 1 successful `/seek` per accord-prefix per hour
- 5 distinct prefixes per day

**Limitation:** when the container restarts (deploys, autoscaling, periodic recycles), the in-memory counters reset. A determined user could refresh limits by waiting for a deploy. For an easter-egg flow this is acceptable — the harm ceiling is "user gets a few extra free `/seek` calls" and the protection against accidental token harvesting still works for the 99% case.

If abuse appears in practice, swap the in-memory `Map` for an Upstash Redis store keyed by `discordId:date`. Same code shape, no architectural changes.

## Token Format

Issued as `HS256` JWT with claims:

```
{ discordId, hashPrefix, iat, exp: iat + 24h, iss: 'bot.collider.scale94', aud: 'api.transmute.redeem' }
```

Verified server-side by `/api/transmute/redeem` using the shared `DISCORD_SOVEREIGN_SECRET`.
```

- [ ] **Step 2: Commit**

```bash
git add bot/README.md
git commit -m "docs(bot): README with deploy instructions + rate-limit volatility note"
```

---

### Task 27: `.env.example` for Vercel `DISCORD_SOVEREIGN_SECRET`

**Files:**
- Modify: `.env.example` (root)

- [ ] **Step 1: Append the new env var**

Append to `.env.example` (root, not `bot/.env.example`):

```
# Living Accord — shared HS256 secret with the Discord bot (bot/.env)
# Used by /api/transmute/redeem to verify sovereign keys issued by the bot.
DISCORD_SOVEREIGN_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document DISCORD_SOVEREIGN_SECRET for redeem endpoint"
```

---

### Task 28: End-to-End Manual Verification

**No file changes — pre-deploy verification.**

- [ ] **Step 1: Set `DISCORD_SOVEREIGN_SECRET` locally**

In root `.env.local`, add a test value:

```
DISCORD_SOVEREIGN_SECRET=test-secret-for-local-only-replace-in-prod-1234567890abcdef
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All test files PASS (colliderNarrative, chimeraGlyph, livingNote, redeem).

- [ ] **Step 3: Run dev server, exercise the full collider flow**

Run: `npm run dev`

In browser:
1. Scaling tab → run a collision (prefer one with 3+ strong dims to test trinity scoring)
2. Confirm 16 beams fire at impact
3. Confirm result panel renders with metric-aware fragments
4. Click "⚗ CRYSTALLIZE ACCORD"
5. Confirm card reveals in cascade (frame → hash scramble → name → notes → vault)
6. Confirm Chimera Glyph renders beside the bottle
7. Confirm Decay Arc panel renders below the note pyramid with 3 staggered beats
8. Wait ~5s — confirm vault ciphertext shows occasional shimmer flickers
9. Click ◈ glyph 7 times — confirm REDEEM input appears
10. Generate a test JWT in another terminal:

    ```bash
    cd bot
    node -e "
    import('jose').then(async ({ SignJWT }) => {
      const t = await new SignJWT({ discordId: 'test-user', hashPrefix: 'PREFIX_FROM_UI' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt().setExpirationTime('24h')
        .setIssuer('bot.collider.scale94').setAudience('api.transmute.redeem')
        .sign(new TextEncoder().encode('test-secret-for-local-only-replace-in-prod-1234567890abcdef'));
      console.log(t);
    });
    "
    ```

    (Replace `PREFIX_FROM_UI` with the first 8 hex chars of the hash shown on the card.)

11. Paste the token into REDEEM, click REDEEM. Confirm:
    - Living Accord badge appears ("◈ LIVING ACCORD · YOUR SIGNATURE")
    - One note in the pyramid changes color and content
    - Acquire button text changes to "ACQUIRE LIVING ASSET"
12. Click "ACQUIRE LIVING ASSET" — open the downloaded `.md` file. Confirm `## § LIVING SIGNATURE` section is present.

13. Test expired token: regenerate the script with `setExpirationTime('-5s')`, paste it. Confirm error reads "Token expired. Run /seek again on Discord…"

14. Test prefix mismatch: take a token signed for one accord, try to redeem on a different accord. Network response should be 403; UI error should read "Invalid sovereign key." (not the expired-token copy).

- [ ] **Step 4: Visit the sigil endpoint**

In browser: `http://localhost:5173/api/sigil/<paste-some-64-char-hash-here>`
Expected: A circular SVG glyph renders.

- [ ] **Step 5: Confirm with user before push**

Per project memory `feedback_no_push_without_verification.md`: do NOT push to remote until the user has confirmed the localhost behavior matches their expectations. Show them the page, let them click around. Wait for explicit go-ahead before `git push`.

- [ ] **Step 6: Final commit (if any cleanup)**

If lint/format pass surfaces anything trivial, fix and commit:

```bash
git add -p
git commit -m "chore: post-verification cleanup"
```

---

## Done. Summary of what shipped:

- **Logic:** trinity archetypes, metric-aware prompt fragments, family interference perfume mapping
- **Visuals:** 16-beam parameter trace, vault decrypt shimmer, Matrix hash scramble, staggered card reveal
- **Discord:** `/seek` bot with 24h JWT issuance, DM with manifesto-voice copy, in-memory rate limiting
- **Living Accord:** server-side deterministic note substitution, hidden 7-click affordance, `RedeemInput`, mutated note rendering with shimmer + green-gold glow, manifest signature section
- **A1 Glyph:** procedural SVG sigil, deterministic from accord hash + dims, on card + in manifest + at `/api/sigil/[hash]`
- **A3 Decay Arc:** 3-beat time-evolution narrative, interference-flavored, staggered reveal in the Tesseract card

Test coverage: trinity scoring, metric fragment injection, decay arc, glyph determinism + structure, living-note determinism + idempotency, redeem endpoint with mocked JWT (valid / expired / tampered / prefix mismatch).
