# Council Ring Vector Collider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static Council Ring (Manifesto tab, desktop) into an ambient generative vector collider: mind-pairs emit particles that infall to center, collide in a 1536-D expansion of the 16-D feature space, and eject toward the social-foundation or biophysical-ceiling ring, with a generative narrative readout and a `councilBus` event channel.

**Architecture:** Pure math in `councilCollider.js` (WASM-replaceable contract), RAF particle sim in `useCouncilCollider.js` with sim state in refs (React state only for discrete events), canvas layer *under* the existing SVG sharing its viewBox coordinate system. Spec: `docs/superpowers/specs/2026-07-05-council-ring-vector-collider-design.md`.

**Tech Stack:** React 18 (JSX, no TS), canvas 2D, vitest. No new dependencies.

**Conventions:** Tests live in `__tests__/` folders next to sources (see `src/observatory/__tests__/observatoryBus.test.js`). Run a single test file with `npx vitest run <path>`. No runtime `Math.random()` anywhere in this feature — seeded PRNG only. Commit after every task; **never push**.

---

### Task 1: Extend sixteenMinds schema (affinities, keyWorks, excerpt, mindProfile)

**Files:**
- Modify: `src/terminal/data/sixteenMinds.js`
- Test: `src/terminal/data/__tests__/sixteenMinds.test.js` (create)

Each mind gains three authored fields plus an exported `mindProfile()` builder. The profile is the mind's 16-D base vector: `1.0` in its own dim, authored secondary `affinities`, floor `0.05` everywhere else (no zero blocks after expansion).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/data/__tests__/sixteenMinds.test.js
import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS, mindProfile } from '../sixteenMinds';
import { DIM_NAMES } from '../nodeFeatures';

const LEGACY_DIMS = DIM_NAMES.slice(0, 16);

describe('sixteenMinds schema', () => {
  it('has exactly 16 minds with unique dimIndex 0..15', () => {
    expect(SIXTEEN_MINDS).toHaveLength(16);
    const idx = SIXTEEN_MINDS.map(m => m.dimIndex).sort((a, b) => a - b);
    expect(idx).toEqual([...Array(16).keys()]);
  });

  it('every mind has affinities over valid legacy dims, keyWorks, excerpt', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(Object.keys(m.affinities).length).toBeGreaterThanOrEqual(3);
      for (const name of Object.keys(m.affinities)) {
        expect(LEGACY_DIMS).toContain(name);
        expect(name).not.toBe(m.dimName); // self-dim is implicit 1.0
      }
      expect(m.keyWorks.length).toBeGreaterThanOrEqual(1);
      for (const w of m.keyWorks) {
        expect(typeof w.title).toBe('string');
        expect(typeof w.year).toBe('number');
      }
      expect(typeof m.excerpt).toBe('string');
      expect(m.excerpt.length).toBeGreaterThan(10);
    }
  });

  it('mindProfile: self-dim 1.0, affinities applied, 0.05 floor, length 16', () => {
    const meadows = SIXTEEN_MINDS.find(m => m.dimIndex === 0);
    const p = mindProfile(meadows);
    expect(p).toHaveLength(16);
    expect(p[0]).toBe(1.0);
    expect(p[15]).toBeCloseTo(meadows.affinities.economic);
    // a dim with no affinity gets the floor
    const untouched = LEGACY_DIMS.findIndex(
      (n, i) => i !== 0 && !(n in meadows.affinities)
    );
    expect(p[untouched]).toBeCloseTo(0.05);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/sixteenMinds.test.js`
Expected: FAIL — `mindProfile` is not exported / `affinities` undefined.

- [ ] **Step 3: Implement — imports and `mindProfile` in `sixteenMinds.js`**

Add at the top of the file (after the existing header comment):

```js
import { DIM_NAMES } from './nodeFeatures';

// 16-D base profile: 1.0 in the mind's own dim, authored secondary
// affinities, 0.05 floor elsewhere so every 96-block carries energy
// after expansion (required by the collider's unbiased-partition invariant).
export function mindProfile(mind) {
  const p = new Float32Array(16).fill(0.05);
  p[mind.dimIndex] = 1.0;
  for (const [name, w] of Object.entries(mind.affinities)) {
    const i = DIM_NAMES.indexOf(name);
    if (i >= 0 && i < 16) p[i] = w;
  }
  return p;
}
```

(`nodeFeatures.js` does not import `sixteenMinds.js`, so no import cycle.)

- [ ] **Step 4: Implement — add the three fields to every mind entry**

Field format, shown complete for Meadows (dimIndex 0); apply the same shape to all 16 using the table below:

```js
    affinities: { economic: 0.6, entropy: 0.45, biological: 0.4, temporal: 0.35 },
    keyWorks: [
      { title: 'The Limits to Growth', year: 1972 },
      { title: 'Thinking in Systems', year: 2008 },
    ],
    excerpt: 'A system is a set of things interconnected in a way that produces its own pattern of behavior over time.',
```

Authored content for all 16 (exact values — transcribe into each entry):

| dim | mind | affinities | keyWorks | excerpt |
|---|---|---|---|---|
| 0 | Meadows | economic .6, entropy .45, biological .4, temporal .35 | The Limits to Growth (1972); Thinking in Systems (2008) | "A system is a set of things interconnected in a way that produces its own pattern of behavior over time." |
| 1 | Mandelbrot | stochastic .55, spatial .45, economic .4, dimensionality .35 | The Fractal Geometry of Nature (1982); The (Mis)Behavior of Markets (2004) | "Clouds are not spheres, mountains are not cones, coastlines are not circles." |
| 2 | Grothendieck | conservation .35, information .3, nonlinearity .3, cryptographic .25 | Éléments de géométrie algébrique (1960); Récoltes et Semailles (1986) | "I could imagine the sea rising until the problem, without resistance, dissolves." |
| 3 | Kauffman | biological .55, dynamical .45, stochastic .4, entropy .3 | The Origins of Order (1993); At Home in the Universe (1995) | "Order arises for free, poised between the frozen and the chaotic." |
| 4 | Georgescu-Roegen | thermodynamic .6, economic .55, temporal .4, biological .3 | The Entropy Law and the Economic Process (1971); Energy and Economic Myths (1976) | "The economic process is entropic in all its material fibers." |
| 5 | Kuramoto | dynamical .5, nonlinearity .4, temporal .35, criticality .3 | Self-entrainment of coupled oscillators (1975); Chemical Oscillations, Waves, and Turbulence (1984) | "Beyond the critical coupling, incoherence itself becomes unstable." |
| 6 | Noether | dimensionality .45, temporal .35, information .3, cryptographic .2 | Invariante Variationsprobleme (1918); Idealtheorie in Ringbereichen (1921) | "To every differentiable symmetry there corresponds a conserved quantity." |
| 7 | Prigogine | entropy .55, thermodynamic .5, dynamical .4, criticality .35 | From Being to Becoming (1980); Order Out of Chaos (1984) | "Far from equilibrium, matter begins to organize itself." |
| 8 | Thompson | biological .55, dimensionality .4, dynamical .35, nonlinearity .3 | On Growth and Form (1917); Historia Animalium translation (1910) | "The form of an object is a diagram of forces." |
| 9 | Bayes | information .5, game_theory .35, economic .3, temporal .25 | An Essay towards solving a Problem in the Doctrine of Chances (1763) | "Belief is a quantity to be revised by the weight of what is observed." |
| 10 | Ostrom | economic .55, biological .35, synchrony .3, information .3 | Governing the Commons (1990); Understanding Institutional Diversity (2005) | "Neither the state nor the market is uniformly successful in sustaining the commons." |
| 11 | Daly | economic .6, entropy .55, biological .4, game_theory .3 | Steady-State Economics (1977); Beyond Growth (1996) | "The economy grows physically; the ecosystem that contains it does not." |
| 12 | Shannon | cryptographic .5, stochastic .45, synchrony .3, dimensionality .25 | A Mathematical Theory of Communication (1948); Communication Theory of Secrecy Systems (1949) | "Information is the resolution of uncertainty." |
| 13 | Turing | information .5, biological .35, dimensionality .35, stochastic .3 | On Computable Numbers (1936); The Chemical Basis of Morphogenesis (1952) | "We can only see a short distance ahead, but we can see plenty there that needs to be done." |
| 14 | Margulis | entropy .35, criticality .35, game_theory .35, spatial .3 | Origin of Eukaryotic Cells (1970); Symbiotic Planet (1998) | "Life did not take over the globe by combat, but by networking." |
| 15 | Raworth | thermodynamic .5, game_theory .45, biological .4, information .25 | A Safe and Just Space for Humanity (2012); Doughnut Economics (2017) | "Meet the needs of all within the means of the living planet." |

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/sixteenMinds.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/terminal/data/sixteenMinds.js src/terminal/data/__tests__/sixteenMinds.test.js
git commit -m "feat(manifesto): extend sixteenMinds schema with affinities, keyWorks, excerpt + mindProfile"
```

---

### Task 2: councilCollider — seeded PRNG and 1536-D expansion

**Files:**
- Create: `src/terminal/views/manifesto/councilCollider.js`
- Test: `src/terminal/views/manifesto/__tests__/councilCollider.test.js` (create)

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilCollider.test.js
import { describe, it, expect } from 'vitest';
import { mulberry32, expand, EXPANDED, BLOCK } from '../councilCollider';

describe('mulberry32', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('expand', () => {
  const vec = new Float32Array(16).fill(0.05);
  vec[0] = 1.0; vec[4] = 0.5;

  it('returns 1536 components, deterministic across calls', () => {
    const e1 = expand(vec), e2 = expand(vec);
    expect(e1).toHaveLength(EXPANDED);
    expect(EXPANDED).toBe(16 * BLOCK);
    expect(Array.from(e1)).toEqual(Array.from(e2));
  });

  it('block energy scales with the base value (no zero blocks at floor)', () => {
    const e = expand(vec);
    const blockEnergy = (d) => {
      let s = 0;
      for (let k = 0; k < BLOCK; k++) s += e[d * BLOCK + k] ** 2;
      return s;
    };
    expect(blockEnergy(0)).toBeGreaterThan(blockEnergy(4)); // 1.0 > 0.5
    expect(blockEnergy(4)).toBeGreaterThan(blockEnergy(7)); // 0.5 > 0.05
    expect(blockEnergy(7)).toBeGreaterThan(0);              // floor still alive
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilCollider.js
// Pure collision math for the Council Ring vector collider. Zero React,
// zero runtime randomness. This module's API is the contract a future
// Rust/WASM kernel replaces — keep inputs/outputs plain arrays and objects.
import { DIM_NAMES } from '../../data/nodeFeatures';

export const DIMS = 16;
export const BLOCK = 96;
export const EXPANDED = DIMS * BLOCK; // 1536

// Seeded PRNG — codebase convention forbids Math.random() in collision paths.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic phase φ(d, k) — integer hash → [0, 2π). Same harmonic
// family and width for every dim block: the unbiased-partition invariant.
function phase(d, k) {
  let h = (d * 73856093) ^ (k * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

// 16-D → 1536-D: dim d owns block [d·96, d·96+96).
export function expand(vec16) {
  const out = new Float32Array(EXPANDED);
  for (let d = 0; d < DIMS; d++) {
    const v = vec16[d];
    for (let k = 0; k < BLOCK; k++) {
      out[d * BLOCK + k] = v * Math.sin((k + 1) * v * Math.PI + phase(d, k));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilCollider.js src/terminal/views/manifesto/__tests__/councilCollider.test.js
git commit -m "feat(manifesto): council collider seeded PRNG + 1536-D expansion"
```

---

### Task 3: councilCollider — collide() with unbiased dim-partition

**Files:**
- Modify: `src/terminal/views/manifesto/councilCollider.js`
- Modify: `src/terminal/views/manifesto/__tests__/councilCollider.test.js`

- [ ] **Step 1: Add failing tests**

Append to the test file (extend the import line to include `collide, SOCIAL_DIMS`):

```js
import { mulberry32, expand, collide, EXPANDED, BLOCK, SOCIAL_DIMS } from '../councilCollider';
```

```js
describe('collide', () => {
  const mk = (selfDim, aff = {}) => {
    const v = new Float32Array(16).fill(0.05);
    v[selfDim] = 1.0;
    for (const [i, w] of Object.entries(aff)) v[i] = w;
    return expand(v);
  };

  it('partition is exactly 6 social dims', () => {
    expect(SOCIAL_DIMS).toEqual(
      ['synchrony', 'temporal', 'game_theory', 'information', 'cryptographic', 'economic']
    );
  });

  it('returns cosine in [-1,1], a 16-entry byDim energy array, and mean energies', () => {
    const r = collide(mk(0), mk(1));
    expect(r.cosine).toBeGreaterThanOrEqual(-1);
    expect(r.cosine).toBeLessThanOrEqual(1);
    expect(r.byDim).toHaveLength(16);
    expect(r.energies.social).toBeGreaterThan(0);
    expect(r.energies.bio).toBeGreaterThan(0);
  });

  it('is deterministic and symmetric in energy for a fixed pair', () => {
    const a = mk(2), b = mk(9);
    const r1 = collide(a, b), r2 = collide(a, b);
    expect(r1.trajectory).toBe(r2.trajectory);
    expect(r1.dominantDim).toBe(r2.dominantDim);
    expect(r1.cosine).toBeCloseTo(r2.cosine, 12);
  });

  it('mean-per-dim normalization: identical per-dim residual energy → E_social ≈ E_bio', () => {
    // Craft two vectors whose residual is uniform across dims: same base
    // profile except a constant offset in every dim.
    const va = new Float32Array(16).fill(0.30);
    const vb = new Float32Array(16).fill(0.55);
    const r = collide(expand(va), expand(vb));
    const ratio = r.energies.social / r.energies.bio;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });

  it('social-heavy residual ejects toward FOUNDATION, names the dominant dim', () => {
    // Difference concentrated in economic (dim 15, social partition):
    const va = new Float32Array(16).fill(0.2); va[15] = 1.0;
    const vb = new Float32Array(16).fill(0.2); vb[15] = 0.1;
    const r = collide(expand(va), expand(vb));
    expect(r.trajectory).toBe('FOUNDATION');
    expect(r.dominantDim).toBe(15);
  });

  it('bio-heavy residual ejects toward CEILING', () => {
    // Difference concentrated in entropy (dim 4, biophysical partition):
    const va = new Float32Array(16).fill(0.2); va[4] = 1.0;
    const vb = new Float32Array(16).fill(0.2); vb[4] = 0.1;
    const r = collide(expand(va), expand(vb));
    expect(r.trajectory).toBe('CEILING');
    expect(r.dominantDim).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: FAIL — `collide` / `SOCIAL_DIMS` not exported. (Prior tests still pass.)

- [ ] **Step 3: Implement — append to `councilCollider.js`**

```js
// ── Partition (locked calibration) ──────────────────────────────────────────
export const SOCIAL_DIMS = ['synchrony', 'temporal', 'game_theory', 'information', 'cryptographic', 'economic'];
const SOCIAL_IDX = new Set(SOCIAL_DIMS.map(n => DIM_NAMES.indexOf(n)));
const N_SOCIAL = SOCIAL_DIMS.length;          // 6
const N_BIO = DIMS - N_SOCIAL;                // 10

// collide(A₁₅₃₆, B₁₅₃₆) — the WASM-replaceable contract.
// Returns { cosine, byDim, energies: {social, bio}, trajectory, dominantDim }.
export function collide(a, b) {
  let dot = 0, na = 0, nb = 0;
  const byDim = new Array(DIMS).fill(0);
  for (let d = 0; d < DIMS; d++) {
    let e = 0;
    for (let k = 0; k < BLOCK; k++) {
      const i = d * BLOCK + k;
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
      const r = a[i] - b[i]; // residual component
      e += r * r;
    }
    byDim[d] = e;
  }
  const cosine = dot / (Math.sqrt(na * nb) || 1);

  // Mean energy per dim, strictly — removes the 6/10 partition-size bias.
  let sumSocial = 0, sumBio = 0;
  let dominantDim = 0, dominantE = -1;
  for (let d = 0; d < DIMS; d++) {
    if (SOCIAL_IDX.has(d)) sumSocial += byDim[d]; else sumBio += byDim[d];
    if (byDim[d] > dominantE) { dominantE = byDim[d]; dominantDim = d; }
  }
  const social = sumSocial / N_SOCIAL;
  const bio = sumBio / N_BIO;

  return {
    cosine,
    byDim,
    energies: { social, bio },
    trajectory: social >= bio ? 'FOUNDATION' : 'CEILING',
    dominantDim,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilCollider.js src/terminal/views/manifesto/__tests__/councilCollider.test.js
git commit -m "feat(manifesto): collide() with unbiased mean-per-dim partition energy"
```

---

### Task 4: councilCollider — pickPair scheduler + generative narrative splice

**Files:**
- Modify: `src/terminal/views/manifesto/councilCollider.js`
- Modify: `src/terminal/views/manifesto/__tests__/councilCollider.test.js`

- [ ] **Step 1: Add failing tests**

Extend the import line with `pickPair, composeLine`, then append:

```js
describe('pickPair', () => {
  it('returns two distinct indices in [0,16), deterministic per ordinal', () => {
    for (let o = 0; o < 40; o++) {
      const [a, b] = pickPair(o);
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(16);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(16);
      expect(pickPair(o)).toEqual([a, b]);
    }
  });

  it('bias index is always included and never paired with itself', () => {
    for (let o = 0; o < 20; o++) {
      const [a, b] = pickPair(o, 7);
      expect(a).toBe(7);
      expect(b).not.toBe(7);
    }
  });
});

describe('composeLine', () => {
  const mindA = {
    dimIndex: 0, dimName: 'dynamical', anchorName: 'Donella Meadows',
    coreEquation: 'dX/dt = inflow − outflow',
    systemDirective: 'Leverage Point Location / Paradigm Stack Intervention',
    epigraph: 'The highest leverage is the paradigm the system arises from.',
    excerpt: 'A system is a set of things interconnected in a way that produces its own pattern of behavior over time.',
  };
  const mindB = {
    dimIndex: 4, dimName: 'entropy', anchorName: 'Nicholas Georgescu-Roegen',
    coreEquation: 'ΔS > 0  per production cycle',
    systemDirective: 'Entropy Debt Accounting / Irreversibility Audit',
    epigraph: 'Every economic act is an irreversible burn.',
    excerpt: 'The economic process is entropic in all its material fibers.',
  };
  const collision = { trajectory: 'CEILING', dominantDim: 4 };

  it('same (pair, ordinal) → identical line; different ordinal → different line', () => {
    const l1 = composeLine(mindA, mindB, collision, 3);
    const l2 = composeLine(mindA, mindB, collision, 3);
    const l3 = composeLine(mindA, mindB, collision, 4);
    expect(l1).toBe(l2);
    expect(l1).not.toBe(l3);
  });

  it('contains surnames, dominant dim readout, trajectory arrow, and a spliced clause', () => {
    const l = composeLine(mindA, mindB, collision, 0);
    expect(l).toContain('MEADOWS × GEORGESCU-ROEGEN');
    expect(l).toContain('dim:04 entropy');
    expect(l).toContain('▲ BIOPHYSICAL CEILING');
    expect(l).toMatch(/"[^"]{10,}"/); // quoted generative splice present
  });

  it('clamps line length', () => {
    for (let o = 0; o < 30; o++) {
      expect(composeLine(mindA, mindB, collision, o).length).toBeLessThanOrEqual(180);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: FAIL — `pickPair` / `composeLine` not exported.

- [ ] **Step 3: Implement — append to `councilCollider.js`**

```js
// ── Ambient pair scheduler ───────────────────────────────────────────────────
// Indices are positions 0..15 (caller maps to its seated array). biasIdx,
// when set, is guaranteed the first slot (click override).
export function pickPair(ordinal, biasIdx = null) {
  const rng = mulberry32(0x5CA1E ^ Math.imul(ordinal + 1, 2654435761));
  const a = biasIdx != null ? biasIdx : Math.floor(rng() * DIMS);
  let b = Math.floor(rng() * (DIMS - 1));
  if (b >= a) b += 1;
  return [a, b];
}

// ── Generative narrative splice (locked calibration) ─────────────────────────
// Fragments from BOTH minds, template grammar, seeded per (pair, ordinal):
// every collision event yields a different line; replay is reproducible.
const MAX_LINE = 180;

const clauses = (s) => (s || '').split(/[;,.—·]/).map(t => t.trim()).filter(t => t.length > 3);

function fragmentPool(mind) {
  return [
    ...clauses(mind.epigraph),
    ...mind.systemDirective.split(' / ').map(s => s.trim()),
    ...clauses(mind.excerpt),
  ];
}

function equationTerms(mind) {
  return mind.coreEquation.split(/\s+/).filter(t => t.length > 1);
}

const surname = (mind) => mind.anchorName.split(' ').pop().toUpperCase();

export function composeLine(mindA, mindB, collision, ordinal) {
  const rng = mulberry32(
    Math.imul(mindA.dimIndex * 31 + mindB.dimIndex + 1, 1009) + ordinal
  );
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const fragA = pick(fragmentPool(mindA));
  const fragB = pick(fragmentPool(mindB));
  const eq = pick([...equationTerms(mindA), ...equationTerms(mindB)]);

  const spliced = pick([
    `${fragA} ⇌ ${fragB}`,
    `${fragB}, until ${fragA.toLowerCase()}`,
    `${fragA} — where ${eq} — ${fragB.toLowerCase()}`,
    `${eq}: ${fragA.toLowerCase()}; ${fragB.toLowerCase()}`,
  ]);

  const arrow = collision.trajectory === 'FOUNDATION'
    ? '▼ SOCIAL FOUNDATION' : '▲ BIOPHYSICAL CEILING';
  const dd = String(collision.dominantDim).padStart(2, '0');
  const hex = (ordinal & 0xff).toString(16).padStart(2, '0').toUpperCase();

  const prefix = `[COLLISION 0x${hex}] ${surname(mindA)} × ${surname(mindB)} · residual peaks dim:${dd} ${DIM_NAMES[collision.dominantDim]} · TRAJECTORY ${arrow} · `;
  // Clamp the splice, not the whole line: format literals and both quotes
  // must survive (a whole-line clamp would conflict with the test regex).
  const budget = MAX_LINE - prefix.length - 2;
  const clipped = spliced.length > budget ? spliced.slice(0, budget - 1) + '…' : spliced;
  return `${prefix}"${clipped}"`;
}
```

> **Amendment (during execution):** the original whole-line clamp (`line.slice(0, MAX_LINE - 1) + '…'`) conflicted with the test regex `/"[^"]{10,}"/` whenever the splice overflowed — truncation destroyed the closing quote. Resolution: clamp the spliced fragment to the remaining budget so the format literals and both quotes always survive. Also, the Task 3 test `collide(mk(0), mk(1))` was corrected to `collide(mk(2), mk(5))` — dims 0 and 1 are both biophysical, so `energies.social` was provably 0 and the `> 0` assertion unsatisfiable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilCollider.test.js`
Expected: PASS (15 tests)

Note: the "different ordinal → different line" test can theoretically collide for one specific ordinal pair; it is deterministic, so if it passes once it always passes. If it fails on first run, bump the template count or the seed mix constant — do not weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilCollider.js src/terminal/views/manifesto/__tests__/councilCollider.test.js
git commit -m "feat(manifesto): pair scheduler + seeded generative narrative splice"
```

---

### Task 5: councilBus event channel

**Files:**
- Create: `src/terminal/views/manifesto/councilBus.js`
- Test: `src/terminal/views/manifesto/__tests__/councilBus.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/views/manifesto/__tests__/councilBus.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { councilBus } from '../councilBus';

describe('councilBus', () => {
  beforeEach(() => councilBus._resetForTests());

  it('delivers events to live listeners', () => {
    const seen = [];
    const off = councilBus.on(e => seen.push(e));
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 0 });
    expect(seen).toHaveLength(1);
    off();
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 1 });
    expect(seen).toHaveLength(1);
  });

  it('buffers events with no listeners and flushes to the first subscriber', () => {
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 0 });
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 1 });
    const seen = [];
    councilBus.on(e => seen.push(e));
    expect(seen.map(e => e.ordinal)).toEqual([0, 1]);
  });

  it('caps the pending buffer at 32 (ambient loop must not leak)', () => {
    for (let i = 0; i < 50; i++) councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: i });
    const seen = [];
    councilBus.on(e => seen.push(e));
    expect(seen).toHaveLength(32);
    expect(seen[0].ordinal).toBe(18); // oldest dropped
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilBus.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilBus.js
// Cross-tab event channel for Council Ring collisions — the hook the future
// final-compilation step subscribes to. Same pattern as colliderBus, with a
// bounded pending buffer: the ambient loop emits forever, so unbounded
// buffering would leak.
const PENDING_CAP = 32;

export const councilBus = {
  _listeners: [],
  _pending: [],
  emit(event) {
    if (this._listeners.length === 0) {
      this._pending.push(event);
      if (this._pending.length > PENDING_CAP) this._pending.shift();
      return;
    }
    this._listeners.forEach(fn => fn(event));
  },
  on(fn) {
    this._listeners.push(fn);
    if (this._pending.length) {
      const queue = this._pending;
      this._pending = [];
      queue.forEach(e => fn(e));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
  _resetForTests() { this._listeners = []; this._pending = []; },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilBus.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilBus.js src/terminal/views/manifesto/__tests__/councilBus.test.js
git commit -m "feat(manifesto): councilBus event channel with bounded pending buffer"
```

---

### Task 6: useCouncilCollider hook (RAF sim, refs-only per-frame state)

**Files:**
- Create: `src/terminal/views/manifesto/useCouncilCollider.js`

No unit test for this file — it is canvas/RAF glue over already-tested pure math (jsdom has no real canvas or RAF timing). Verification is Task 7's browser pass. Keep ALL per-frame mutation inside `simRef`; React state changes only at cycle start (`activePairIds`) and collapse (`lastCollision`).

- [ ] **Step 1: Implement the hook**

```js
// src/terminal/views/manifesto/useCouncilCollider.js
// RAF particle sim for the Council Ring collider. Sim state lives in refs;
// React state changes only on discrete events (cycle start, collapse).
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { mindProfile } from '../../data/sixteenMinds';
import { polarToXY } from './councilRingMath';
import { expand, collide, composeLine, pickPair } from './councilCollider';
import { councilBus } from './councilBus';

const CX = 320, CY = 320;
const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;
const VIEW_W = 980, VIEW_X0 = -170; // desktop SVG viewBox "-170 0 980 640"

// Cycle timing (ms) — full cycle ≈ 7.3 s
const T_INFALL = 2600, T_FLASH = 380, T_EJECT = 1100, T_COOLDOWN = 3200;
const STREAM_N = 22;               // particles per stream (2 streams, cap 44 ≪ 120)
const SPIRAL_GAIN = 0.9;           // radians of spiral over the full infall
const CORE_R = 10;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function useCouncilCollider({ seated, enabled }) {
  const canvasRef = useRef(null);
  const simRef = useRef({ phase: 'IDLE', t0: 0, pair: null, product: null, ordinal: 0, particles: [] });
  const rafRef = useRef(0);
  const biasRef = useRef(null); // dimIndex of a clicked mind

  const [activePairIds, setActivePairIds] = useState([]);
  const [lastCollision, setLastCollision] = useState(null);
  const [running, setRunning] = useState(false);

  // Precompute every mind's 1536-D vector once (16 × 1536 Float32 ≈ 98 KB).
  const expanded = useMemo(() => seated.map(m => expand(mindProfile(m))), [seated]);

  const onNodeClick = useCallback((mind) => { biasRef.current = mind.dimIndex; }, []);

  // Gate: enabled flag, prefers-reduced-motion, viewport visibility.
  useEffect(() => {
    if (!enabled) { setRunning(false); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { setRunning(false); return; }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
    io.observe(canvas);
    return () => io.disconnect();
  }, [enabled]);

  // The loop. Everything below the state setters mutates simRef only.
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let scale = 1;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      scale = canvas.width / VIEW_W;
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const seatedIndexOfDim = (dimIndex) => seated.findIndex(m => m.dimIndex === dimIndex);

    const startCycle = (now) => {
      const sim = simRef.current;
      const biasSeat = biasRef.current != null ? seatedIndexOfDim(biasRef.current) : null;
      biasRef.current = null;
      const [ia, ib] = pickPair(sim.ordinal, biasSeat != null && biasSeat >= 0 ? biasSeat : null);
      sim.pair = [ia, ib];
      sim.phase = 'INFALL';
      sim.t0 = now;
      sim.particles = [];
      const jitter = (seed) => {
        // deterministic per-particle stagger, seeded off ordinal
        let h = Math.imul(seed + sim.ordinal * 97, 2654435761) >>> 0;
        return (h % 1000) / 1000;
      };
      [ia, ib].forEach((seatIdx, s) => {
        const mind = seated[seatIdx];
        for (let i = 0; i < STREAM_N; i++) {
          sim.particles.push({
            angle: mind.angle,
            hue: mind.hue,
            delay: jitter(s * STREAM_N + i) * 900,
            wobble: (jitter(s * STREAM_N + i + 500) - 0.5) * 14, // degrees
          });
        }
      });
      setActivePairIds([seated[ia].dimIndex, seated[ib].dimIndex]);
    };

    const runCollision = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const result = collide(expanded[ia], expanded[ib]);
      const mindA = seated[ia], mindB = seated[ib];
      const line = composeLine(mindA, mindB, result, sim.ordinal);
      // Ejection angle: the seat of the mind whose dim dominates the residual.
      const domSeat = seatedIndexOfDim(result.dominantDim);
      sim.product = {
        angle: seated[domSeat].angle,
        targetR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING + 28,
        boundaryR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING,
        color: result.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA',
      };
      sim.phase = 'FLASH';
      sim.t0 = now;
      const event = {
        type: 'COUNCIL_COLLISION',
        pair: [mindA.dimIndex, mindB.dimIndex],
        cosine: result.cosine,
        trajectory: result.trajectory,
        dominantDim: result.dominantDim,
        energies: result.energies,
        line,
        ordinal: sim.ordinal,
        ts: Date.now(),
      };
      setLastCollision(event);
      councilBus.emit(event);
      sim.ordinal += 1;
    };

    const dot = (x, y, r, color) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (now) => {
      const sim = simRef.current;
      // Phosphor decay — canvas sits UNDER the SVG, background matches the
      // container, so a translucent wash fades old trails without occluding.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(4, 4, 10, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // viewBox-unit space: x' = (x − VIEW_X0)·scale, y' = y·scale
      ctx.setTransform(scale, 0, 0, scale, -VIEW_X0 * scale, 0);

      const t = now - sim.t0;

      if (sim.phase === 'IDLE') {
        startCycle(now);
      } else if (sim.phase === 'INFALL') {
        let allDone = true;
        for (const p of sim.particles) {
          const prog = Math.min(1, Math.max(0, (t - p.delay) / T_INFALL));
          if (prog < 1) allDone = false;
          if (prog <= 0) continue;
          const r = R_SEAT * (1 - easeInCubic(prog));
          const theta = p.angle + p.wobble * prog
            + (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);
          const { x, y } = polarToXY(theta, r, CX, CY);
          dot(x, y, 2.2, p.hue);
        }
        if (allDone) runCollision(now);
      } else if (sim.phase === 'FLASH') {
        const prog = Math.min(1, t / T_FLASH);
        dot(CX, CY, CORE_R + 26 * prog, `rgba(255, 215, 0, ${0.85 * (1 - prog)})`);
        if (prog >= 1) { sim.phase = 'EJECT'; sim.t0 = now; }
      } else if (sim.phase === 'EJECT') {
        const prog = Math.min(1, t / T_EJECT);
        const r = sim.product.targetR * easeOutCubic(prog);
        const { x, y } = polarToXY(sim.product.angle, r, CX, CY);
        dot(x, y, 3.5, sim.product.color);
        // Ring-flash when the product crosses its boundary
        if (r >= sim.product.boundaryR - 2) {
          ctx.beginPath();
          ctx.arc(CX, CY, sim.product.boundaryR, 0, Math.PI * 2);
          ctx.strokeStyle = sim.product.color;
          ctx.globalAlpha = 0.5 * (1 - prog);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (prog >= 1) { sim.phase = 'COOLDOWN'; sim.t0 = now; }
      } else if (sim.phase === 'COOLDOWN') {
        if (t >= T_COOLDOWN) sim.phase = 'IDLE';
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      simRef.current.phase = 'IDLE';
      simRef.current.particles = [];
    };
  }, [running, seated, expanded]);

  return { canvasRef, activePairIds, lastCollision, onNodeClick };
}
```

- [ ] **Step 2: Verify it parses and existing tests still pass**

Run: `npx vitest run src/terminal/views/manifesto/ src/terminal/data/`
Expected: all prior tests PASS; no import errors.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/manifesto/useCouncilCollider.js
git commit -m "feat(manifesto): useCouncilCollider RAF sim hook (refs-only per-frame state)"
```

---

### Task 7: CouncilRing integration — canvas layer + narrative strip

**Files:**
- Modify: `src/terminal/views/manifesto/CouncilRing.jsx` (desktop branch only, lines ~172-187)

- [ ] **Step 1: Wire the hook into `CouncilRing`**

Add imports at the top of `CouncilRing.jsx`:

```js
import { useCouncilCollider } from './useCouncilCollider';
```

Inside `CouncilRing()`, after `const [selected, setSelected] = useState(null);`:

```js
const collider = useCouncilCollider({ seated, enabled: !isMobile });
const handleSelect = useCallback((mind) => {
  setSelected(mind);
  collider.onNodeClick(mind);
}, [collider.onNodeClick]);
```

- [ ] **Step 2: Replace the desktop return block**

Replace the existing desktop `return` (the final `return` in the component) with:

```jsx
// Desktop — canvas collider layer sits UNDER the SVG (SVG has no background
// fill, so trails show through; nodes/labels/hit-targets stay on top).
return (
  <div style={{ width: '100%', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
    <div style={{ position: 'relative' }}>
      <canvas
        ref={collider.canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {/* viewBox widened horizontally (−170..810) so long anchor labels on both
          arcs (e.g. "Nicholas Georgescu-Roegen", "D'Arcy Wentworth Thompson")
          have margin and are not clipped by the SVG edge; ring stays centered on 320. */}
      <svg viewBox="-170 0 980 640" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
        <RingScaffold />
        {seated.map(m => (
          <Node
            key={m.dimIndex}
            mind={m}
            active={collider.activePairIds.includes(m.dimIndex)}
            onSelect={handleSelect}
          />
        ))}
      </svg>
    </div>
    {/* Narrative strip — fixed height, no layout shift */}
    <div style={{ height: 44, padding: '8px 14px', borderTop: '1px solid rgba(120,140,200,0.12)', fontFamily: MONO, fontSize: 11, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      {collider.lastCollision ? (
        <span style={{ color: collider.lastCollision.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {collider.lastCollision.line}
        </span>
      ) : (
        <span style={{ color: 'rgba(120,140,200,0.4)', letterSpacing: '0.2em' }}>◉ COUNCIL COLLIDER · AWAITING FIRST EVENT</span>
      )}
    </div>
    {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
  </div>
);
```

Mobile branch: unchanged (collider `enabled: !isMobile` keeps it fully off).

- [ ] **Step 3: Run the full test suite and lint**

Run: `npm test` then `npm run lint`
Expected: all tests PASS, lint clean. (If lint flags the `collider.onNodeClick` dep, wrap `handleSelect` deps as `[collider.onNodeClick]` exactly as shown — it is a stable useCallback.)

- [ ] **Step 4: Browser verification (preview tools)**

Start the dev server (`preview_start` with the vite config; port 5173). On the Manifesto tab, verify:

1. Particles stream from two seat dots, spiral inward, gold flash at center.
2. Product particle ejects; pink burst on the inner ring OR green burst punching to the outer ring.
3. Narrative strip updates each cycle with a different spliced line; trajectory color matches the burst.
4. The two active minds' nodes turn gold during their cycle.
5. Clicking a node opens SixteenPanel AND that mind is in the *next* collision pair.
6. Console: no errors; no React warnings about setState in RAF.
7. `preview_eval`: emulate `prefers-reduced-motion` OFF path by checking canvas repaints stop when the ring is scrolled out of view (IntersectionObserver gate).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx
git commit -m "feat(manifesto): wire Council Ring collider — canvas layer + narrative strip"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full suite + build**

Run: `npm test && npm run lint && npm run build`
Expected: all PASS, build succeeds.

- [ ] **Step 2: Verify no `Math.random()` crept in**

Run: `git grep -n "Math.random" -- src/terminal/views/manifesto/ src/terminal/data/sixteenMinds.js`
Expected: no output.

- [ ] **Step 3: Commit any stragglers; do NOT push**

Per project rule: pushing requires an explicit user command — stop after the final local commit and report.

---

## Self-Review Notes

- **Spec coverage:** expansion+invariant (Task 2), collide+partition (Task 3), scheduler+narrative splice (Task 4), bus with bounded buffer (Task 5), hook state rules+gating (Task 6), coordinate mapping+canvas layer+strip+click bias (Task 7), schema (Task 1), performance caps (44 particles < 120 cap, pooled per cycle), WASM boundary (collide contract note in Task 2/3), testing section (Tasks 1-5). Mobile/no-WASM/no-panel-history non-goals respected.
- **Deviation from spec, intentional:** canvas renders *under* the SVG rather than over it — phosphor-decay trails require an opaque-ish wash each frame, which would occlude the SVG if layered on top. Visual result is identical; hit-testing is better (SVG stays on top).
- **Addition beyond spec:** `affinities`/`mindProfile` — the spec said "each mind's 16-D vector" without defining it; one-hot vectors would make every collision residual peak trivially in the two colliding dims, so authored affinity profiles are required for non-degenerate dynamics.
