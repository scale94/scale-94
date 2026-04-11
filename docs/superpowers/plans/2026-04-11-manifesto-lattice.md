# Manifesto Lattice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current text-heavy `ManifestoTab.jsx` with a static radial mandala — 256 concept specks + ~40 curated beacons across 16 sector spokes, 6 chapter territories as wedge overlays, a center HUD absorbing all chrome, inline-expansion beacon cards, first-class mobile.

**Architecture:** Pure React + inline SVG. No Canvas2D, no WebGL, no WASM. `ManifestoTab.jsx` becomes a thin shell that mounts a single `Mandala` component edge-to-edge. `Mandala` owns the hover/select UI state and composes `CenterHUD` + `BeaconCard`. All geometry math lives in pure functions in `MandalaGeometry.js` and is unit-tested in isolation. All text content lives in two small data modules (`manifestoBeacons.js`, `manifestoChapters.js`). Architect thesis reuses the existing `ThesisView` full-page route via the `setArchitectThesis` callback already plumbed through `App.jsx`.

**Tech Stack:** React 18, Vite, Tailwind, lucide-react, Vitest + @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-11-manifesto-lattice-design.md` is the source of truth — consult it when any detail in this plan is ambiguous.

---

## File Structure

**Create:**
- `src/terminal/views/manifesto/MandalaGeometry.js` — pure geometry functions (sector angles, node placement, hit testing). No React, no SVG.
- `src/terminal/views/manifesto/Mandala.jsx` — SVG container, hover/select state, renders rings + spokes + wedges + specks + beacons + center HUD + beacon card.
- `src/terminal/views/manifesto/CenterHUD.jsx` — the `◉` pupil (idle / hover / selected states).
- `src/terminal/views/manifesto/BeaconCard.jsx` — inline-expansion card (desktop floating, mobile bottom-sheet).
- `src/terminal/data/manifestoBeacons.js` — curated beacon list: `{ nodeId, chapter, quote }[]`.
- `src/terminal/data/manifestoChapters.js` — 6 chapters: `{ id, title, sectorArc, epigraph, opening }`.
- `tests/manifesto/mandalaGeometry.test.js` — unit tests for pure geometry functions.
- `tests/manifesto/manifestoData.test.js` — data integrity tests (every `nodeId` resolves to a real `NODES` entry; every `chapter` matches one of the 6 chapters).

**Modify:**
- `src/terminal/views/ManifestoTab.jsx` — rewrite as a thin wrapper that mounts `<Mandala />` edge-to-edge on black. Target ~40 lines down from ~137.
- `src/terminal/App.jsx:1215` — pass `setArchitectThesis` prop into `ManifestoTab` (same pattern as `ScalingTab` at line 1192).

**Delete:** nothing. The old `ManifestoTab.jsx` contents are replaced in place.

---

## Shared Context for All Tasks

### Key facts about the existing codebase

- **Dataset:** `src/terminal/data/nodeFeatures.js` exports `NODES` (272 entries across 17 clusters), `NODE_IDX`, `FEATURES` (272 × 32 tensor array), `DIM_NAMES` (32 dim names), `SECTORS` (17 sector definitions), and math helpers `cosineSim`, `topDrivers`, `compareNodes`. Read-only consumer — do not modify.
- **Sectors** (17 total, in definition order): `eco, sync, phys, crypto, drk, phil, math, chem, bio, hum, ling, cogn, aesth, topo, meta, synth, fsk`. The mandala uses the first 16 as spokes. `fsk` nodes still render as ambient specks, placed inside the visually nearest wedge (the implementation can assign them to a fake "fsk" spoke that overlaps `eco` since fsk is conceptually descended from the bouligand/arapaima scale work in eco).
- **Sector→chapter mapping** (matches spec §3.2 wedge overlay, adjusted to the real sector order so each chapter spans contiguous spokes starting at 12 o'clock and going clockwise):
  - §1 SUBSTRATE      → `eco, bio, chem`                (3 spokes)
  - §2 FEATURE_SPACE  → `sync, phys, math`              (3 spokes)
  - §3 BONE_FUSION    → `topo, meta, synth`             (3 spokes)
  - §4 SARG           → `cogn, aesth`                   (2 spokes)
  - §5 FADE           → `phil, hum, ling`               (3 spokes)
  - §8 ENCLAVE        → `crypto, drk`                   (2 spokes)
  - Total: 16 spokes.
  - Note that the mandala re-orders sectors on the wheel so chapters are contiguous. The rendering order around the circle (clockwise from 12 o'clock) is: `eco, bio, chem, sync, phys, math, topo, meta, synth, cogn, aesth, phil, hum, ling, crypto, drk`. `fsk` is not on a spoke but its nodes still render as ambient specks (see task 2 step 3).
- **Architect thesis access:** `src/terminal/App.jsx:98` defines `architectThesis` state + `setArchitectThesis` setter. `ThesisView.jsx` already exists and renders full-page when `architectThesis === true` (App.jsx:1200). `ScalingTab` at App.jsx:1192 is the reference pattern for passing `setArchitectThesis` into a tab.
- **Node color:** `src/terminal/data/kernelColorMap.js` exports `nodeColor(id, cluster) → { hsl, hue, sat, lit }`. Only 5 cluster bands are defined (`eco`, `sync`, `phys`, `crypto`, `drk`); all other clusters fall back to `drk` (purple). This is existing behavior — do not expand.
- **Testing:** Vitest is already set up. `package.json` has `"test": "vitest run"`. Existing pure-function tests live at `tests/mercury/fireworksUtils.test.js` as precedent.

### Coordinate conventions

- SVG coordinate system: `+x` right, `+y` down. Angles measured clockwise from 12 o'clock (SVG angle = `angle - π/2` converted to `(cos θ, sin θ)` with `y` flipped).
- Standard conversion: for a point at angle `θ` (measured clockwise from 12 o'clock, in radians) and radius `r`, SVG coordinates are `(r * sin(θ), -r * cos(θ))`.
- Inner rings dashed, outer ring solid. Ring radii: `R`, `0.75·R`, `0.5·R`, `0.25·R`.

### Non-goals (reject scope creep)

- No rotation, drag, zoom, pan.
- No audio, particles, animations beyond the card open/close transition.
- No new cluster color bands.
- No changes to `nodeFeatures.js` or `kernelColorMap.js`.
- No changes to `ThesisView.jsx` or the `architectThesis` flow in `App.jsx` beyond the single prop-passing line.
- No new tests beyond what this plan specifies. No integration tests.

---

## Task 1: Create `MandalaGeometry.js` with sector ordering + pure angle functions

**Files:**
- Create: `src/terminal/views/manifesto/MandalaGeometry.js`
- Test: `tests/manifesto/mandalaGeometry.test.js`

- [ ] **Step 1: Write failing test for `MANDALA_SECTOR_ORDER` and `sectorAngle`**

Create `tests/manifesto/mandalaGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
} from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('MANDALA_SECTOR_ORDER', () => {
  it('has exactly 16 sectors in chapter-contiguous clockwise order', () => {
    expect(MANDALA_SECTOR_ORDER).toEqual([
      'eco', 'bio', 'chem',
      'sync', 'phys', 'math',
      'topo', 'meta', 'synth',
      'cogn', 'aesth',
      'phil', 'hum', 'ling',
      'crypto', 'drk',
    ]);
  });
});

describe('sectorAngle', () => {
  it('places sector 0 (eco) at angle 0 (12 o\'clock)', () => {
    expect(sectorAngle(0)).toBeCloseTo(0, 6);
  });

  it('places sector 4 at π/2 (3 o\'clock equivalent for clockwise)', () => {
    expect(sectorAngle(4)).toBeCloseTo((4 / 16) * 2 * Math.PI, 6);
  });

  it('places sector 8 at π (6 o\'clock)', () => {
    expect(sectorAngle(8)).toBeCloseTo(Math.PI, 6);
  });

  it('throws for out-of-range sector index', () => {
    expect(() => sectorAngle(-1)).toThrow();
    expect(() => sectorAngle(16)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: FAIL — `MandalaGeometry` does not exist.

- [ ] **Step 3: Create `MandalaGeometry.js` with `MANDALA_SECTOR_ORDER` and `sectorAngle`**

Create `src/terminal/views/manifesto/MandalaGeometry.js`:

```js
// MandalaGeometry.js — pure geometry functions for the manifesto lattice.
// No React, no SVG DOM. Everything here is unit-testable in isolation.

/**
 * The 16 sectors that get spokes on the mandala, in clockwise order
 * starting at 12 o'clock. This order is chosen so that the 6 manifesto
 * chapters map to contiguous arcs (see manifestoChapters.js).
 *
 * Note: the real nodeFeatures.js SECTORS has 17 entries — `fsk` is
 * excluded from the spokes but its nodes still render as ambient specks.
 */
export const MANDALA_SECTOR_ORDER = [
  'eco', 'bio', 'chem',          // §1 SUBSTRATE
  'sync', 'phys', 'math',        // §2 FEATURE_SPACE
  'topo', 'meta', 'synth',       // §3 BONE_FUSION
  'cogn', 'aesth',               // §4 SARG
  'phil', 'hum', 'ling',         // §5 FADE
  'crypto', 'drk',               // §8 ENCLAVE
];

export const SECTOR_COUNT = 16;

/**
 * Angle for a sector spoke, in radians. Measured clockwise from 12 o'clock.
 * Sector 0 = 0 rad (12 o'clock). Sector 4 = π/2 (3 o'clock). Etc.
 */
export function sectorAngle(sectorIndex) {
  if (sectorIndex < 0 || sectorIndex >= SECTOR_COUNT) {
    throw new Error(`sectorAngle: sectorIndex ${sectorIndex} out of range [0, ${SECTOR_COUNT})`);
  }
  return (sectorIndex / SECTOR_COUNT) * 2 * Math.PI;
}

/**
 * Index of a cluster id in the mandala sector order, or -1 if the
 * cluster is not on a spoke (e.g. fsk).
 */
export function clusterToSectorIndex(clusterId) {
  return MANDALA_SECTOR_ORDER.indexOf(clusterId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/MandalaGeometry.js tests/manifesto/mandalaGeometry.test.js
git commit -m "feat(manifesto): add MandalaGeometry sector ordering and angles"
```

---

## Task 2: Add `polarToCartesian` and `nodeMagnitude` geometry helpers

**Files:**
- Modify: `src/terminal/views/manifesto/MandalaGeometry.js`
- Modify: `tests/manifesto/mandalaGeometry.test.js`

- [ ] **Step 1: Write failing tests for `polarToCartesian` and `nodeMagnitude`**

Append to `tests/manifesto/mandalaGeometry.test.js`:

```js
import { polarToCartesian, nodeMagnitude } from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('polarToCartesian', () => {
  it('angle 0, radius 100 → (0, -100) (12 o\'clock)', () => {
    const { x, y } = polarToCartesian(0, 100);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-100, 6);
  });

  it('angle π/2, radius 100 → (100, 0) (3 o\'clock)', () => {
    const { x, y } = polarToCartesian(Math.PI / 2, 100);
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it('angle π, radius 100 → (0, 100) (6 o\'clock)', () => {
    const { x, y } = polarToCartesian(Math.PI, 100);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(100, 6);
  });
});

describe('nodeMagnitude', () => {
  it('returns 0 for an all-zero tensor', () => {
    expect(nodeMagnitude(new Array(32).fill(0))).toBe(0);
  });

  it('returns 1 for an all-ones tensor (L2 / sqrt(32))', () => {
    expect(nodeMagnitude(new Array(32).fill(1))).toBeCloseTo(1, 6);
  });

  it('returns ~0.5 for a half-filled tensor', () => {
    const t = new Array(32).fill(0.5);
    expect(nodeMagnitude(t)).toBeCloseTo(0.5, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: FAIL — `polarToCartesian` / `nodeMagnitude` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/terminal/views/manifesto/MandalaGeometry.js`:

```js
/**
 * Convert polar (θ clockwise from 12 o'clock, radius r) to SVG Cartesian.
 * SVG y grows downward, so 12 o'clock is (0, -r).
 */
export function polarToCartesian(angleRad, radius) {
  return {
    x: radius * Math.sin(angleRad),
    y: -radius * Math.cos(angleRad),
  };
}

/**
 * L2 magnitude of a node's 32D feature vector, normalized by sqrt(32)
 * so an all-ones vector gives magnitude 1. Used as the radial distance
 * for node placement — "louder" nodes land further from center.
 */
export function nodeMagnitude(featureVector) {
  let sumSq = 0;
  for (let i = 0; i < featureVector.length; i++) {
    sumSq += featureVector[i] * featureVector[i];
  }
  return Math.sqrt(sumSq) / Math.sqrt(featureVector.length);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: PASS — 10 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/MandalaGeometry.js tests/manifesto/mandalaGeometry.test.js
git commit -m "feat(manifesto): add polarToCartesian and nodeMagnitude helpers"
```

---

## Task 3: Add `nodePosition` with deterministic angular jitter

**Files:**
- Modify: `src/terminal/views/manifesto/MandalaGeometry.js`
- Modify: `tests/manifesto/mandalaGeometry.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/manifesto/mandalaGeometry.test.js`:

```js
import { nodePosition, hashNodeId } from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('hashNodeId', () => {
  it('is deterministic', () => {
    expect(hashNodeId('bouligand_36')).toBe(hashNodeId('bouligand_36'));
  });

  it('produces different hashes for different ids', () => {
    expect(hashNodeId('bouligand_36')).not.toBe(hashNodeId('kuramoto'));
  });

  it('returns a finite number in [0, 1)', () => {
    const h = hashNodeId('seraphine');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
    expect(Number.isFinite(h)).toBe(true);
  });
});

describe('nodePosition', () => {
  const R = 400;
  const tensor = new Array(32).fill(0.5); // magnitude ≈ 0.5

  it('places a node on its cluster spoke with small jitter', () => {
    const pos = nodePosition({ id: 'bouligand_36', cluster: 'eco' }, tensor, R);
    // eco is sector 0, angle 0, so base direction is straight up (0, -r).
    // r = (0.2 + 0.75 * 0.5) * R = 0.575 * 400 = 230
    // Jitter ±0.03 rad keeps x within ~7 of 0, y close to -230.
    expect(pos.x).toBeGreaterThan(-10);
    expect(pos.x).toBeLessThan(10);
    expect(pos.y).toBeGreaterThan(-235);
    expect(pos.y).toBeLessThan(-225);
  });

  it('is deterministic for the same node id', () => {
    const a = nodePosition({ id: 'kuramoto', cluster: 'sync' }, tensor, R);
    const b = nodePosition({ id: 'kuramoto', cluster: 'sync' }, tensor, R);
    expect(a).toEqual(b);
  });

  it('returns null for a cluster not on a mandala spoke (fsk → nearest spoke)', () => {
    // fsk is not in MANDALA_SECTOR_ORDER, but we still want to place its
    // nodes somewhere — we fall them back onto the first sector (eco)
    // which is conceptually adjacent (bouligand_fsk ↔ eco/bouligand_36).
    const pos = nodePosition({ id: 'arapaima', cluster: 'fsk' }, tensor, R);
    expect(pos).not.toBeNull();
    // Should land near the eco spoke (x near 0, y negative).
    expect(pos.x).toBeGreaterThan(-20);
    expect(pos.x).toBeLessThan(20);
    expect(pos.y).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: FAIL — `nodePosition` / `hashNodeId` not exported.

- [ ] **Step 3: Implement `hashNodeId` + `nodePosition`**

Append to `src/terminal/views/manifesto/MandalaGeometry.js`:

```js
/**
 * Deterministic hash of a node id to a float in [0, 1).
 * Uses djb2 like kernelColorMap.js so behavior is consistent across the site.
 */
export function hashNodeId(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  return (h >>> 0) / 0x100000000;
}

const JITTER_RAD = 0.03;

/**
 * Cartesian SVG position for a node.
 *
 * Angle = sectorAngle(cluster) + deterministic jitter ±0.03 rad.
 * Radius = (0.2 + 0.75 * nodeMagnitude(tensor)) * R.
 *
 * Nodes whose cluster is not on a mandala spoke (e.g. fsk) fall back
 * to sector 0 (eco) — this keeps fsk nodes visible as ambient specks
 * near the bouligand/arapaima neighborhood they conceptually share.
 *
 * @param {{id: string, cluster: string}} node
 * @param {number[]} tensor  32-element feature vector
 * @param {number} R         outer ring radius in px
 * @returns {{x: number, y: number}}
 */
export function nodePosition(node, tensor, R) {
  let sectorIdx = clusterToSectorIndex(node.cluster);
  if (sectorIdx < 0) sectorIdx = 0; // fsk fallback
  const baseAngle = sectorAngle(sectorIdx);
  const jitter = (hashNodeId(node.id) - 0.5) * 2 * JITTER_RAD;
  const angle = baseAngle + jitter;
  const mag = nodeMagnitude(tensor);
  const r = (0.2 + 0.75 * mag) * R;
  return polarToCartesian(angle, r);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: PASS — 13 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/MandalaGeometry.js tests/manifesto/mandalaGeometry.test.js
git commit -m "feat(manifesto): add deterministic node placement with angular jitter"
```

---

## Task 4: Add `wedgePath` SVG arc builder for chapter territories

**Files:**
- Modify: `src/terminal/views/manifesto/MandalaGeometry.js`
- Modify: `tests/manifesto/mandalaGeometry.test.js`

- [ ] **Step 1: Write failing test**

Append to `tests/manifesto/mandalaGeometry.test.js`:

```js
import { wedgePath } from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('wedgePath', () => {
  it('returns an SVG path string starting at the origin', () => {
    const path = wedgePath(0, Math.PI / 2, 100);
    expect(typeof path).toBe('string');
    expect(path.startsWith('M 0 0')).toBe(true);
  });

  it('contains an arc command (A)', () => {
    const path = wedgePath(0, Math.PI / 2, 100);
    expect(path).toMatch(/\bA\b/);
  });

  it('closes back to origin (Z)', () => {
    const path = wedgePath(0, Math.PI / 2, 100);
    expect(path.trim().endsWith('Z')).toBe(true);
  });

  it('uses large-arc-flag=0 for arcs ≤ π and 1 for arcs > π', () => {
    const small = wedgePath(0, Math.PI / 2, 100);   // 90°
    const large = wedgePath(0, Math.PI * 1.5, 100); // 270°
    expect(small).toMatch(/A\s+100\s+100\s+0\s+0\s+1/);
    expect(large).toMatch(/A\s+100\s+100\s+0\s+1\s+1/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: FAIL — `wedgePath` not exported.

- [ ] **Step 3: Implement `wedgePath`**

Append to `src/terminal/views/manifesto/MandalaGeometry.js`:

```js
/**
 * Build an SVG path `d` attribute for a pie-slice wedge from angle
 * `startAngle` to `endAngle` (both clockwise from 12 o'clock, radians)
 * with outer radius `R`. Returns a string like:
 *   "M 0 0 L x1 y1 A R R 0 <large> 1 x2 y2 Z"
 *
 * `sweep-flag` is always 1 (clockwise). `large-arc-flag` is 1 iff the
 * arc spans more than π radians.
 */
export function wedgePath(startAngle, endAngle, R) {
  const { x: x1, y: y1 } = polarToCartesian(startAngle, R);
  const { x: x2, y: y2 } = polarToCartesian(endAngle, R);
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/manifesto/mandalaGeometry.test.js`
Expected: PASS — 17 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/MandalaGeometry.js tests/manifesto/mandalaGeometry.test.js
git commit -m "feat(manifesto): add wedgePath arc builder for chapter territories"
```

---

## Task 5: Create `manifestoChapters.js` with 6 chapters

**Files:**
- Create: `src/terminal/data/manifestoChapters.js`
- Test: `tests/manifesto/manifestoData.test.js`

- [ ] **Step 1: Write failing test for the chapters data module**

Create `tests/manifesto/manifestoData.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { MANIFESTO_CHAPTERS } from '../../src/terminal/data/manifestoChapters';
import { MANDALA_SECTOR_ORDER } from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('MANIFESTO_CHAPTERS', () => {
  it('has exactly 6 chapters', () => {
    expect(MANIFESTO_CHAPTERS).toHaveLength(6);
  });

  it('every chapter has required fields', () => {
    for (const ch of MANIFESTO_CHAPTERS) {
      expect(typeof ch.id).toBe('string');
      expect(typeof ch.number).toBe('string');
      expect(typeof ch.title).toBe('string');
      expect(Array.isArray(ch.sectors)).toBe(true);
      expect(typeof ch.epigraph).toBe('string');
      expect(typeof ch.opening).toBe('string');
    }
  });

  it('all chapter sectors are valid mandala sectors', () => {
    for (const ch of MANIFESTO_CHAPTERS) {
      for (const s of ch.sectors) {
        expect(MANDALA_SECTOR_ORDER).toContain(s);
      }
    }
  });

  it('chapter sectors collectively cover all 16 mandala sectors exactly once', () => {
    const covered = MANIFESTO_CHAPTERS.flatMap(ch => ch.sectors);
    expect(covered).toHaveLength(16);
    expect(new Set(covered).size).toBe(16);
    for (const s of MANDALA_SECTOR_ORDER) {
      expect(covered).toContain(s);
    }
  });

  it('chapter sectors appear in MANDALA_SECTOR_ORDER contiguously per chapter', () => {
    let cursor = 0;
    for (const ch of MANIFESTO_CHAPTERS) {
      const expected = MANDALA_SECTOR_ORDER.slice(cursor, cursor + ch.sectors.length);
      expect(ch.sectors).toEqual(expected);
      cursor += ch.sectors.length;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manifesto/manifestoData.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `manifestoChapters.js`**

Create `src/terminal/data/manifestoChapters.js`:

```js
// manifestoChapters.js — 6 manifesto chapters mapped to contiguous arcs
// of mandala sectors. Epigraphs and opening paragraphs are hand-excerpted
// from content/system_logs/MANIFESTO.md — duplicated here because the
// mandala needs synchronous access and the source markdown is only
// hydrated into systemArticles asynchronously.

export const MANIFESTO_CHAPTERS = [
  {
    id: 'substrate',
    number: '§1',
    title: 'THE SUBSTRATE',
    sectors: ['eco', 'bio', 'chem'],
    epigraph: '34 kernels. Each one a .rs file compiled to WebAssembly.',
    opening:
      '34 kernels. Each one a .rs file compiled to WebAssembly through a thin routing membrane. The kernel graph is not a dependency tree — it is a conceptual lattice. Nodes are computational probes for distinct regions of mathematical property space. The system does not have an API. It has a terminal.',
  },
  {
    id: 'feature_space',
    number: '§2',
    title: 'THE FEATURE SPACE',
    sectors: ['sync', 'phys', 'math'],
    epigraph: 'Every kernel node occupies a position in a 16-dimensional feature space.',
    opening:
      'Every kernel node occupies a position in a 16-dimensional feature space. The axes were not derived from corpus statistics — they were selected on one criterion: they collectively span the relevant mathematical property space of complex dynamical systems, each axis anchored in primary physical literature. The highest-variance axes are game_theory, thermodynamic, stochastic, synchrony, information.',
  },
  {
    id: 'bone_fusion',
    number: '§3.3.3',
    title: 'THE BONE FUSION ENGINE',
    sectors: ['topo', 'meta', 'synth'],
    epigraph: 'Bouligand 36°. Magic angle 1.1°. Saponification.',
    opening:
      'Given two SovereignTensors, the engine drives them toward convergence through three sequential operations: a 36° Bouligand rotation (from Arapaima gigas dermal scale architecture, the angle of maximum energy dissipation), a 1.1° magic-angle micro-rotation (from twisted bilayer graphene, where electron kinetic energy is quenched), and saponification (stripping metabolic_cost to expose the structural skeleton underneath).',
  },
  {
    id: 'sarg',
    number: '§4.4.4.4',
    title: 'THE SARG METRIC',
    sectors: ['cogn', 'aesth'],
    epigraph: 'Lindblad evolution. Decoherence always wins.',
    opening:
      'Seraphine models n active concept clusters as a quantum density matrix in H^n. Off-diagonal elements decay exponentially at rate γ — this is not a failure mode, it is the primary dynamics. The Seraphine Associative Reasoning Gain peaks at t* = 1/γ, then decays toward zero. Narrative compellingness and geometric similarity are negatively correlated.',
  },
  {
    id: 'fade',
    number: '§5.5.5.5.5',
    title: 'THE FADE DOCTRINE',
    sectors: ['phil', 'hum', 'ling'],
    epigraph: 'Feigenbaum δ ≈ 4.6692. The system is governed by dissolution.',
    opening:
      'The Fading Feigenbaum Sphere operates at the edge between order and chaos — 34 kernel nodes poised in Kauffman\'s ordered regime adjacent to chaos. Connections are forged, local coherence rises, then the Lindblad operator runs. Decoherence always wins. The score is the event. High scores are not permanent states — they are peaks in a SARG time series, a reasoning window that opens, reaches maximum associative density, then fades back to classical noise.',
  },
  {
    id: 'enclave',
    number: '§8.8.8.8.8.8.8.8',
    title: 'THE ENCLAVE',
    sectors: ['crypto', 'drk'],
    epigraph: 'ML-KEM-768 + AES-256-GCM. Real post-quantum key encapsulation.',
    opening:
      'enclave.rs implements ML-KEM-768 (NIST FIPS 203) + AES-256-GCM. This is not a cryptography metaphor. This is real post-quantum key encapsulation running in WebAssembly. Keys are session-only. No backup. No recovery. Refresh loses all sealed data. The visual distinction between the classified enclave and the WASM enclave: one is a game, one is the boundary.',
  },
];

export const CHAPTER_BY_ID = Object.fromEntries(
  MANIFESTO_CHAPTERS.map(ch => [ch.id, ch]),
);

export const CHAPTER_BY_SECTOR = (() => {
  const out = {};
  for (const ch of MANIFESTO_CHAPTERS) {
    for (const s of ch.sectors) out[s] = ch;
  }
  return out;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/manifesto/manifestoData.test.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/manifestoChapters.js tests/manifesto/manifestoData.test.js
git commit -m "feat(manifesto): add MANIFESTO_CHAPTERS data with 6→16 sector mapping"
```

---

## Task 6: Create `manifestoBeacons.js` with curated beacon list

**Files:**
- Create: `src/terminal/data/manifestoBeacons.js`
- Modify: `tests/manifesto/manifestoData.test.js`

This task curates ~36 beacon nodes. The IDs below are all verified to exist in `NODES` in `src/terminal/data/nodeFeatures.js` — do not change them without also updating the test.

- [ ] **Step 1: Write failing data-integrity test**

Append to `tests/manifesto/manifestoData.test.js`:

```js
import { MANIFESTO_BEACONS } from '../../src/terminal/data/manifestoBeacons';
import { NODES, NODE_IDX } from '../../src/terminal/data/nodeFeatures';
import { CHAPTER_BY_ID } from '../../src/terminal/data/manifestoChapters';

describe('MANIFESTO_BEACONS', () => {
  it('has at least 30 beacons', () => {
    expect(MANIFESTO_BEACONS.length).toBeGreaterThanOrEqual(30);
  });

  it('every beacon resolves to a real NODES entry', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(NODE_IDX[b.nodeId]).toBeDefined();
    }
  });

  it('every beacon has a valid chapter id', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(CHAPTER_BY_ID[b.chapter]).toBeDefined();
    }
  });

  it('every beacon has a non-empty quote', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(typeof b.quote).toBe('string');
      expect(b.quote.length).toBeGreaterThan(5);
    }
  });

  it('no duplicate beacon node ids', () => {
    const ids = MANIFESTO_BEACONS.map(b => b.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every chapter has at least 2 beacons', () => {
    const counts = {};
    for (const b of MANIFESTO_BEACONS) {
      counts[b.chapter] = (counts[b.chapter] || 0) + 1;
    }
    for (const chId of Object.keys(CHAPTER_BY_ID)) {
      expect(counts[chId] || 0).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/manifesto/manifestoData.test.js`
Expected: FAIL — `manifestoBeacons` does not exist.

- [ ] **Step 3: Create `manifestoBeacons.js`**

Create `src/terminal/data/manifestoBeacons.js`:

```js
// manifestoBeacons.js — curated subset of node ids that the manifesto
// namechecks, each tagged with the chapter it belongs to and a one-line
// quote for the center HUD hover state.
//
// Every nodeId here is verified to exist in NODES (src/terminal/data/nodeFeatures.js).
// The data-integrity test in tests/manifesto/manifestoData.test.js enforces this.

export const MANIFESTO_BEACONS = [
  // ── §1 SUBSTRATE ──────────────────────────────────────────────────────
  { nodeId: 'bouligand_36',    chapter: 'substrate',    quote: 'collagen lamellae rotate at 36°, dissipating crack propagation laterally' },
  { nodeId: 'mycorrhizal',     chapter: 'substrate',    quote: 'the kernel graph is a conceptual lattice, not a dependency tree' },
  { nodeId: 'replicator',      chapter: 'substrate',    quote: 'dissipative ecological models — executable, structured' },
  { nodeId: 'grayscott',       chapter: 'substrate',    quote: 'reaction-diffusion pattern formation on a static grid' },
  { nodeId: 'biocoenosis',     chapter: 'substrate',    quote: 'each kernel a probe for distinct regions of property space' },
  { nodeId: 'crispr',          chapter: 'substrate',    quote: 'thin routing membrane — lib.rs is 12 lines' },
  { nodeId: 'polymer_fold',    chapter: 'substrate',    quote: 'the intelligence is in the vesicles' },
  { nodeId: 'terpene',         chapter: 'substrate',    quote: 'the system does not have an API — it has a terminal' },

  // ── §2 FEATURE SPACE ──────────────────────────────────────────────────
  { nodeId: 'kuramoto',        chapter: 'feature_space', quote: 'synchrony axis — individual to collective phase-locking' },
  { nodeId: 'soma91',          chapter: 'feature_space', quote: 'the SovereignTensor is 176 bytes, packed across three cache lines' },
  { nodeId: 'feigenbaum',      chapter: 'feature_space', quote: 'δ ≈ 4.6692 — universal scaling law at the edge of chaos' },
  { nodeId: 'ising',           chapter: 'feature_space', quote: 'criticality axis — smooth to sharp phase transition' },
  { nodeId: 'fourier',         chapter: 'feature_space', quote: '16 dimensions: fewer collapse distinctions, more destabilise estimates' },
  { nodeId: 'nash_equil',      chapter: 'feature_space', quote: 'game_theory is one of the highest-variance axes' },
  { nodeId: 'chaos_attractor', chapter: 'feature_space', quote: 'dynamical axis — static equilibrium to stochastic PDE' },

  // ── §3 BONE FUSION ────────────────────────────────────────────────────
  { nodeId: 'magic_angle_1p1', chapter: 'bone_fusion',  quote: 'at exactly 1.1°, twisted bilayer graphene forms Moiré flat bands' },
  { nodeId: 'mobius',          chapter: 'bone_fusion',  quote: 'the engine drives tensors toward convergence threshold τ = 0.9990' },
  { nodeId: 'homology',        chapter: 'bone_fusion',  quote: 'saponification asks: strip metabolic cost, are these structurally equivalent?' },
  { nodeId: 'edge_chaos',      chapter: 'bone_fusion',  quote: 'the 1.1° rotation induces constructive interference without destroying tensors' },
  { nodeId: 'dissipative',     chapter: 'bone_fusion',  quote: 'FusionRejected is a meaningful signal — metabolic stripping cannot dissolve it' },
  { nodeId: 'analogy',         chapter: 'bone_fusion',  quote: 'convergence through Bouligand rotation and magic-angle micro-rotation' },
  { nodeId: 'isomorphism',     chapter: 'bone_fusion',  quote: 'some systems are structurally incompatible at a level stripping cannot dissolve' },

  // ── §4 SARG ───────────────────────────────────────────────────────────
  { nodeId: 'seraphine',       chapter: 'sarg',         quote: 'n active clusters as a quantum density matrix in H^n' },
  { nodeId: 'global_workspace',chapter: 'sarg',         quote: 'SARG(t) = C_l1(t) · (1 + λ_e · Δ(t)) — peak at t* = 1/γ' },
  { nodeId: 'binding_problem', chapter: 'sarg',         quote: 'off-diagonal elements encode associative coherence between concepts' },
  { nodeId: 'sublime',         chapter: 'sarg',         quote: 'narrative compellingness and geometric similarity are negatively correlated' },

  // ── §5 FADE ───────────────────────────────────────────────────────────
  { nodeId: 'rhizome',         chapter: 'fade',         quote: 'the Lindblad operator runs — decoherence always wins' },
  { nodeId: 'dialectic',       chapter: 'fade',         quote: 'poised in Kauffman\'s ordered regime adjacent to chaos — not chaotic, poised' },
  { nodeId: 'palimpsest',      chapter: 'fade',         quote: 'a reasoning window that opens, reaches maximum density, then fades' },
  { nodeId: 'saussure',        chapter: 'fade',         quote: 'the system is governed by dissolution, not accumulation' },
  { nodeId: 'longue_duree',    chapter: 'fade',         quote: 'high scores are not permanent states — they are peaks in a SARG time series' },
  { nodeId: 'metaphor_engine', chapter: 'fade',         quote: 'the score is the event' },

  // ── §8 ENCLAVE ────────────────────────────────────────────────────────
  { nodeId: 'pqhash',          chapter: 'enclave',      quote: 'ML-KEM-768 — real post-quantum key encapsulation in WebAssembly' },
  { nodeId: 'lattice_sieve',   chapter: 'enclave',      quote: '1184-byte encapsulation key, 2400-byte decapsulation key — session only' },
  { nodeId: 'classified',      chapter: 'enclave',      quote: 'the visual distinction: one is a game, one is the boundary' },
  { nodeId: 'zkp_circuit',     chapter: 'enclave',      quote: 'HMAC-signed session tokens, 60-second time gate, AES-GCM payload' },
  { nodeId: 'surveillance',    chapter: 'enclave',      quote: 'no backup, no recovery — refresh loses all sealed data' },
  { nodeId: 'panspectron',     chapter: 'enclave',      quote: 'the import pipeline does not check for cleverness, it checks for integrity' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/manifesto/manifestoData.test.js`
Expected: PASS — 11 tests passing total.

If any beacon nodeId fails the `NODE_IDX[b.nodeId]` check, look up the failing id in `src/terminal/data/nodeFeatures.js` lines 46–386 and replace it with the closest existing id from the same sector. Then re-run the test.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/manifestoBeacons.js tests/manifesto/manifestoData.test.js
git commit -m "feat(manifesto): add MANIFESTO_BEACONS curated list with chapter quotes"
```

---

## Task 7: Scaffold `Mandala.jsx` — static SVG with rings, spokes, and wedges

**Files:**
- Create: `src/terminal/views/manifesto/Mandala.jsx`

This task builds the non-interactive visual skeleton. Beacons, HUD, and interaction come in later tasks.

- [ ] **Step 1: Create the `Mandala.jsx` skeleton**

Create `src/terminal/views/manifesto/Mandala.jsx`:

```jsx
import React, { useRef, useState, useEffect } from 'react';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  wedgePath,
} from './MandalaGeometry';
import { MANIFESTO_CHAPTERS } from '../../data/manifestoChapters';

// Tailwind color tokens used throughout (match existing terminal palette).
const RING_STROKE = '#164e63';
const SPOKE_STROKE = '#164e63';

function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setSize({ width: el.clientWidth || 800, height: el.clientHeight || 600 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

const Mandala = ({ setArchitectThesis, systemArticles }) => {
  const containerRef = useRef(null);
  const { width, height } = useContainerSize(containerRef);

  // Responsive outer radius (spec §6.3).
  const minDim = Math.min(width, height);
  let radiusScale = 0.38;
  if (minDim < 960 && minDim >= 720) radiusScale = 0.42;
  else if (minDim < 720 && minDim >= 480) radiusScale = 0.46;
  else if (minDim < 480) radiusScale = 0.48;
  const R = minDim * radiusScale;

  const cx = width / 2;
  const cy = height / 2;

  const viewBox = `${-cx} ${-cy} ${width} ${height}`;

  // 6 chapter territories as wedge paths.
  const chapterWedges = (() => {
    let cursor = 0;
    return MANIFESTO_CHAPTERS.map((ch, i) => {
      const startIdx = cursor;
      const endIdx = cursor + ch.sectors.length;
      cursor = endIdx;
      // Start arc at the left edge of the first sector, end at the right edge of the last.
      // Each sector occupies 2π/16 rad; place spokes at sector centers so the wedge
      // spans from (startIdx - 0.5) to (endIdx - 0.5) in sector units.
      const sliceRad = (2 * Math.PI) / 16;
      const startAngle = (startIdx - 0.5) * sliceRad;
      const endAngle = (endIdx - 0.5) * sliceRad;
      return {
        id: ch.id,
        startAngle,
        endAngle,
        midAngle: (startAngle + endAngle) / 2,
        fill: `hsla(${(i * 60) % 360}, 70%, 50%, 0.10)`,
      };
    });
  })();

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative"
      style={{ minHeight: '80vh' }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        style={{ display: 'block' }}
      >
        {/* ── Chapter territory wedges ─────────────────────────── */}
        <g>
          {chapterWedges.map(w => (
            <path
              key={w.id}
              d={wedgePath(w.startAngle, w.endAngle, R)}
              fill={w.fill}
              stroke="none"
            />
          ))}
        </g>

        {/* ── Concentric rings ─────────────────────────────────── */}
        <g>
          <circle r={R} fill="none" stroke={RING_STROKE} strokeWidth="0.8" />
          <circle r={R * 0.75} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
          <circle r={R * 0.5} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
          <circle r={R * 0.25} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
        </g>

        {/* ── 16 sector spokes ─────────────────────────────────── */}
        <g>
          {MANDALA_SECTOR_ORDER.map((_, i) => {
            const { x, y } = polarToCartesian(sectorAngle(i), R);
            return (
              <line
                key={i}
                x1="0" y1="0"
                x2={x.toFixed(2)} y2={y.toFixed(2)}
                stroke={SPOKE_STROKE}
                strokeWidth="0.3"
                opacity="0.8"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default Mandala;
```

- [ ] **Step 2: Commit skeleton**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): scaffold Mandala.jsx with rings, spokes, wedges"
```

---

## Task 8: Wire `ManifestoTab.jsx` to mount `Mandala` edge-to-edge

**Files:**
- Modify: `src/terminal/views/ManifestoTab.jsx` (full rewrite)
- Modify: `src/terminal/App.jsx` (one prop pass)

- [ ] **Step 1: Rewrite `ManifestoTab.jsx` as a thin shell**

Replace the entire contents of `src/terminal/views/ManifestoTab.jsx` with:

```jsx
import React from 'react';
import Mandala from './manifesto/Mandala';

const ManifestoTab = ({ systemArticles = {}, setArchitectThesis }) => {
  return (
    <div className="tab-fade-v2 w-full">
      <Mandala
        systemArticles={systemArticles}
        setArchitectThesis={setArchitectThesis}
      />
    </div>
  );
};

export default React.memo(ManifestoTab);
```

- [ ] **Step 2: Pass `setArchitectThesis` prop from App.jsx**

In `src/terminal/App.jsx`, find the manifesto tab mount (around line 1214):

```jsx
{/* Manifesto Tab */}
{activeTab === 'manifesto' && !selectedArticle && !architectThesis && (
  <ManifestoTab systemArticles={systemArticles} />
)}
```

Replace with:

```jsx
{/* Manifesto Tab */}
{activeTab === 'manifesto' && !selectedArticle && !architectThesis && (
  <ManifestoTab
    systemArticles={systemArticles}
    setArchitectThesis={setArchitectThesis}
  />
)}
```

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: build succeeds with no new errors.

If the build reports any import errors, re-check that the `Mandala` import path matches the file you created in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ManifestoTab.jsx src/terminal/App.jsx
git commit -m "feat(manifesto): mount Mandala as the new manifesto tab view"
```

---

## Task 9: Render 256 ambient specks from `NODES`

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Import `NODES` and `FEATURES` and compute speck positions**

In `src/terminal/views/manifesto/Mandala.jsx`, update the top imports:

```jsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  wedgePath,
  nodePosition,
} from './MandalaGeometry';
import { MANIFESTO_CHAPTERS } from '../../data/manifestoChapters';
import { NODES, FEATURES } from '../../data/nodeFeatures';
```

Then inside the `Mandala` component, immediately before the `return` statement, add:

```jsx
// Pre-compute speck positions once per radius change.
const specks = useMemo(() => {
  return NODES.map((n, idx) => ({
    id: n.id,
    ...nodePosition(n, FEATURES[idx], R),
  }));
}, [R]);
```

- [ ] **Step 2: Render the specks**

Inside the SVG, immediately after the `{/* ── 16 sector spokes ─ */}` group, add:

```jsx
{/* ── 256 ambient specks ────────────────────────────────── */}
<g>
  {specks.map(s => (
    <circle
      key={s.id}
      cx={s.x.toFixed(2)}
      cy={s.y.toFixed(2)}
      r={minDim < 480 ? 0.5 : minDim < 720 ? 0.6 : minDim < 960 ? 0.8 : 1}
      fill="#06b6d4"
      opacity={minDim < 480 ? 0.20 : minDim < 720 ? 0.25 : 0.35}
    />
  ))}
</g>
```

- [ ] **Step 3: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Then manually verify by running `npm run dev` and navigating to the manifesto tab — you should see ~272 dim cyan dots inside the outer ring, clustered around 16 spokes.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): render 256 ambient specks from NODES"
```

---

## Task 10: Render ~36 beacons with labels and `nodeColor` hues

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Import beacons and color helper**

Update the imports at the top of `src/terminal/views/manifesto/Mandala.jsx`:

```jsx
import { NODES, NODE_IDX, FEATURES } from '../../data/nodeFeatures';
import { nodeColor } from '../../data/kernelColorMap';
import { MANIFESTO_BEACONS } from '../../data/manifestoBeacons';
```

- [ ] **Step 2: Pre-compute beacon positions and colors**

Below the `specks` `useMemo`, add:

```jsx
// Pre-compute beacon positions + colors.
const beacons = useMemo(() => {
  return MANIFESTO_BEACONS.map(b => {
    const idx = NODE_IDX[b.nodeId];
    const node = NODES[idx];
    const { x, y } = nodePosition(node, FEATURES[idx], R);
    const color = nodeColor(b.nodeId, node.cluster);
    return {
      nodeId: b.nodeId,
      chapter: b.chapter,
      quote: b.quote,
      cluster: node.cluster,
      x, y,
      color: color.hsl,
    };
  });
}, [R]);

const showLabels = minDim >= 720;
```

- [ ] **Step 3: Render the beacons**

Inside the SVG, after the ambient specks group, add:

```jsx
{/* ── ~36 curated beacons ───────────────────────────────── */}
<g>
  {beacons.map(b => {
    // Label offset radially outward from origin.
    const dist = Math.hypot(b.x, b.y) || 1;
    const labelX = b.x + (b.x / dist) * 10;
    const labelY = b.y + (b.y / dist) * 10;
    return (
      <g key={b.nodeId}>
        <circle
          cx={b.x.toFixed(2)}
          cy={b.y.toFixed(2)}
          r="3"
          fill={b.color}
          stroke={b.color}
          strokeOpacity="0.3"
          strokeWidth="4"
        />
        {showLabels && (
          <text
            x={labelX.toFixed(2)}
            y={labelY.toFixed(2)}
            fill={b.color}
            fontFamily="monospace"
            fontSize="7"
            textAnchor={b.x >= 0 ? 'start' : 'end'}
            dominantBaseline="middle"
          >
            {b.nodeId}
          </text>
        )}
      </g>
    );
  })}
</g>
```

- [ ] **Step 4: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, navigate to manifesto tab — you should now see ~36 bright colored beacon dots (with glow halos) and their labels on desktop; labels hidden on mobile viewport.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): render curated beacons with colors and labels"
```

---

## Task 11: Create `CenterHUD.jsx` with idle state

**Files:**
- Create: `src/terminal/views/manifesto/CenterHUD.jsx`
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Create `CenterHUD.jsx`**

Create `src/terminal/views/manifesto/CenterHUD.jsx`:

```jsx
import React from 'react';

/**
 * CenterHUD — the ◉ pupil that sits at the mandala center and absorbs
 * all informative chrome. Three states:
 *   - idle: observer / architect / thesis lines
 *   - hover: beacon id + quote (or chapter id + epigraph)
 *   - selected: × close affordance while a card is open
 *
 * All three states render inside a circular black disk with a
 * subtle stroke, visually reading as the mandala's pupil.
 */
const CenterHUD = ({
  radius,
  hover,          // { type: 'beacon' | 'chapter', data: object } | null
  selected,       // truthy if a beacon card is currently open
  onOpenThesis,
}) => {
  const clickable = !selected && hover == null;

  return (
    <g
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      onClick={clickable ? onOpenThesis : undefined}
    >
      <circle
        r={radius}
        fill="rgba(0,0,0,0.6)"
        stroke="#164e63"
        strokeWidth="0.5"
      />
      {selected && (
        <text
          y="3"
          textAnchor="middle"
          fill="#f87171"
          fontFamily="monospace"
          fontSize="9"
        >
          × close
        </text>
      )}

      {!selected && hover == null && (
        <g textAnchor="middle" fontFamily="monospace" fontSize="8">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" opacity="0.75">observer: mercury</text>
          <text y="7"  fill="#06b6d4" opacity="0.6">architect: active</text>
          <text y="18" fill="#06b6d4" opacity="0.6">thesis: still running</text>
          <text y="30" fill="#06b6d4" opacity="0.5">↻</text>
        </g>
      )}

      {!selected && hover?.type === 'beacon' && (
        <g textAnchor="middle" fontFamily="monospace">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" fontSize="9" fontWeight="bold">{hover.data.nodeId}</text>
          <text y="7"  fill="#06b6d4" fontSize="7" opacity="0.6">sector: {hover.data.cluster}</text>
          <text y="20" fill="#39ff14" fontSize="7">
            {hover.data.quote.length > 32
              ? hover.data.quote.slice(0, 30) + '…'
              : hover.data.quote}
          </text>
        </g>
      )}

      {!selected && hover?.type === 'chapter' && (
        <g textAnchor="middle" fontFamily="monospace">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" fontSize="9" fontWeight="bold">
            {hover.data.number} {hover.data.title}
          </text>
          <text y="14" fill="#39ff14" fontSize="7">
            {hover.data.epigraph.length > 36
              ? hover.data.epigraph.slice(0, 34) + '…'
              : hover.data.epigraph}
          </text>
        </g>
      )}
    </g>
  );
};

export default React.memo(CenterHUD);
```

- [ ] **Step 2: Import and render CenterHUD inside Mandala**

At the top of `src/terminal/views/manifesto/Mandala.jsx`, add:

```jsx
import CenterHUD from './CenterHUD';
```

Inside the `Mandala` component, compute the HUD radius based on viewport:

```jsx
const hudRadius = minDim < 480 ? 44 : minDim < 720 ? 48 : minDim < 960 ? 54 : 60;
```

Then at the very end of the SVG (after the beacons group), add:

```jsx
<CenterHUD
  radius={hudRadius}
  hover={null}
  selected={false}
  onOpenThesis={() => setArchitectThesis?.(true)}
/>
```

- [ ] **Step 3: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, navigate to the manifesto tab — you should see the 3-line HUD at the center. Clicking it should switch to the full-page `ThesisView`.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/CenterHUD.jsx src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): add CenterHUD with idle state and thesis access"
```

---

## Task 12: Add beacon hover state — HUD swaps, beacon highlights

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Lift hover state into Mandala**

Inside the `Mandala` component, near the top (after the size hook), add:

```jsx
const [hover, setHover] = useState(null);
// hover shape: { type: 'beacon', data: beaconObject } | { type: 'chapter', data: chapterObject } | null

const handleBeaconEnter = (beacon) => setHover({ type: 'beacon', data: beacon });
const handleBeaconLeave = () => setHover(null);
```

- [ ] **Step 2: Wire beacon hover events**

In the beacon render loop, add `onMouseEnter` / `onMouseLeave` to the `<g>` wrapper and visually mark the hovered beacon:

Replace the beacon rendering block with:

```jsx
{/* ── ~36 curated beacons ───────────────────────────────── */}
<g>
  {beacons.map(b => {
    const isHovered = hover?.type === 'beacon' && hover.data.nodeId === b.nodeId;
    const dist = Math.hypot(b.x, b.y) || 1;
    const labelX = b.x + (b.x / dist) * 10;
    const labelY = b.y + (b.y / dist) * 10;
    return (
      <g
        key={b.nodeId}
        onMouseEnter={() => handleBeaconEnter(b)}
        onMouseLeave={handleBeaconLeave}
        style={{ cursor: 'pointer' }}
      >
        {/* Invisible hit box for touch / small beacons (36x36). */}
        <rect
          x={(b.x - 18).toFixed(2)}
          y={(b.y - 18).toFixed(2)}
          width="36"
          height="36"
          fill="transparent"
        />
        <circle
          cx={b.x.toFixed(2)}
          cy={b.y.toFixed(2)}
          r={isHovered ? 4 : 3}
          fill={b.color}
          stroke={b.color}
          strokeOpacity={isHovered ? 0.7 : 0.3}
          strokeWidth="4"
        />
        {showLabels && (
          <text
            x={labelX.toFixed(2)}
            y={labelY.toFixed(2)}
            fill={b.color}
            fontFamily="monospace"
            fontSize="7"
            fontWeight={isHovered ? 'bold' : 'normal'}
            textAnchor={b.x >= 0 ? 'start' : 'end'}
            dominantBaseline="middle"
          >
            {b.nodeId}
          </text>
        )}
      </g>
    );
  })}
</g>
```

- [ ] **Step 3: Pass hover state to CenterHUD**

Replace the `<CenterHUD />` call with:

```jsx
<CenterHUD
  radius={hudRadius}
  hover={hover}
  selected={false}
  onOpenThesis={() => setArchitectThesis?.(true)}
/>
```

- [ ] **Step 4: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, hover beacons on the manifesto tab — the HUD should swap to show the beacon id + quote, and the beacon itself should brighten + grow.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): beacon hover swaps CenterHUD and highlights beacon"
```

---

## Task 13: Add chapter wedge hover state

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Import chapter lookup**

Update import in `src/terminal/views/manifesto/Mandala.jsx`:

```jsx
import { MANIFESTO_CHAPTERS, CHAPTER_BY_ID } from '../../data/manifestoChapters';
```

- [ ] **Step 2: Wire wedge hover**

Replace the chapterWedges render loop with:

```jsx
{/* ── Chapter territory wedges ─────────────────────────── */}
<g>
  {chapterWedges.map((w, i) => {
    const isHovered = hover?.type === 'chapter' && hover.data.id === w.id;
    return (
      <path
        key={w.id}
        d={wedgePath(w.startAngle, w.endAngle, R)}
        fill={w.fill}
        stroke="none"
        opacity={isHovered ? 2.2 : 1}
        onMouseEnter={() => setHover({ type: 'chapter', data: CHAPTER_BY_ID[w.id] })}
        onMouseLeave={() => setHover(null)}
        style={{ cursor: 'pointer', pointerEvents: 'all' }}
      />
    );
  })}
</g>
```

Note: wedges must sit behind beacons in the DOM so that hovering a beacon still takes precedence. Verify that the chapter wedges group appears before the beacons group in the SVG render order.

- [ ] **Step 3: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, hover empty areas of the mandala between beacons — HUD should swap to show the chapter number, title, and epigraph.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): chapter wedge hover shows chapter epigraph in HUD"
```

---

## Task 14: Create `BeaconCard.jsx`

**Files:**
- Create: `src/terminal/views/manifesto/BeaconCard.jsx`

- [ ] **Step 1: Create `BeaconCard.jsx`**

Create `src/terminal/views/manifesto/BeaconCard.jsx`:

```jsx
import React from 'react';
import { X } from 'lucide-react';
import { NODE_IDX, FEATURES, DIM_NAMES } from '../../data/nodeFeatures';
import { CHAPTER_BY_ID } from '../../data/manifestoChapters';

/**
 * BeaconCard — inline-expansion card for a selected beacon.
 * On desktop: floating card anchored near the beacon (positioned by Mandala).
 * On mobile: bottom sheet covering the lower 60% of the viewport.
 */
const BeaconCard = ({ beacon, onClose, isMobile }) => {
  if (!beacon) return null;

  const idx = NODE_IDX[beacon.nodeId];
  const tensor = FEATURES[idx] || [];
  const chapter = CHAPTER_BY_ID[beacon.chapter];

  // Find the two highest-magnitude dims to color the tensor bars.
  const ranked = tensor.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const top1 = ranked[0]?.i ?? 0;
  const top2 = ranked[1]?.i ?? 1;

  const containerClass = isMobile
    ? 'fixed left-0 right-0 bottom-0 h-[60vh] bg-black/95 border-t border-cyan-900/50 p-6 overflow-y-auto'
    : 'absolute bg-black/95 border border-cyan-900/50 rounded-sm p-5 shadow-2xl';

  const containerStyle = isMobile
    ? { zIndex: 40 }
    : {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        maxHeight: '280px',
        zIndex: 40,
      };

  return (
    <div className={containerClass} style={containerStyle}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-cyan-400 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-sm font-bold" style={{ color: beacon.color }}>
          {beacon.nodeId}
        </span>
        <span className="font-mono text-[10px] text-cyan-500 opacity-70">
          sector: {beacon.cluster}
        </span>
        <span className="font-mono text-[10px] text-fuchsia-500 opacity-70 ml-auto">
          {chapter?.number} {chapter?.title}
        </span>
      </div>

      {/* Tensor strip — 32 tiny vertical bars. */}
      <div className="flex gap-[2px] items-end mb-4 h-[24px]">
        {tensor.map((v, i) => (
          <div
            key={i}
            title={`${DIM_NAMES[i] ?? `dim_${i}`}: ${v.toFixed(2)}`}
            style={{
              width: '6px',
              height: `${Math.max(2, v * 24)}px`,
              backgroundColor: i === top1 ? '#39ff14' : i === top2 ? '#06b6d4' : '#164e63',
              opacity: i === top1 || i === top2 ? 0.95 : 0.55,
            }}
          />
        ))}
      </div>

      {/* Quote. */}
      <p className="font-mono text-xs text-[#39ff14] leading-relaxed">
        "{beacon.quote}"
      </p>
    </div>
  );
};

export default React.memo(BeaconCard);
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/views/manifesto/BeaconCard.jsx
git commit -m "feat(manifesto): add BeaconCard component (desktop card + mobile sheet)"
```

---

## Task 15: Wire beacon click → inline expansion with blur

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Add selected state and click handler**

Near the top of the `Mandala` component (below the `hover` state), add:

```jsx
const [selected, setSelected] = useState(null);
// selected shape: a beacon object, or null.

const handleBeaconClick = (beacon, e) => {
  e?.stopPropagation?.();
  setSelected(beacon);
};

const closeSelected = () => setSelected(null);

// Esc key closes.
useEffect(() => {
  if (!selected) return;
  const onKey = (e) => { if (e.key === 'Escape') closeSelected(); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [selected]);

const isMobile = minDim < 720;
```

- [ ] **Step 2: Import BeaconCard and attach click handler to beacons**

At the top of the file, add:

```jsx
import BeaconCard from './BeaconCard';
```

In the beacon loop, add `onClick={(e) => handleBeaconClick(b, e)}` to the wrapper `<g>`. Full updated `<g>` for each beacon:

```jsx
<g
  key={b.nodeId}
  onMouseEnter={() => handleBeaconEnter(b)}
  onMouseLeave={handleBeaconLeave}
  onClick={(e) => handleBeaconClick(b, e)}
  style={{ cursor: 'pointer' }}
>
  {/* ... rect + circle + text as before ... */}
</g>
```

- [ ] **Step 3: Apply blur to mandala when selected**

Wrap the SVG's top-level `<g>` children in a single `<g>` that gets the blur when selected. Update the SVG contents so there is one outer `<g>` wrapping wedges, rings, spokes, specks, beacons:

```jsx
<svg /* ... */>
  <g
    style={{
      filter: selected ? 'blur(3px) brightness(0.4)' : 'none',
      transition: 'filter 250ms ease',
    }}
  >
    {/* ── Chapter wedges ── */}
    {/* ── Rings ── */}
    {/* ── Spokes ── */}
    {/* ── Specks ── */}
    {/* ── Beacons ── */}
  </g>

  {/* Center HUD is NOT blurred — it absorbs the close affordance. */}
  <CenterHUD
    radius={hudRadius}
    hover={hover}
    selected={!!selected}
    onOpenThesis={() => setArchitectThesis?.(true)}
  />
</svg>
```

Add the `onClick` to the HUD group when selected (so clicking the HUD closes the card):

In `CenterHUD.jsx`, update the top `<g>` wrapper's `onClick` to:

```jsx
onClick={
  selected
    ? onClose
    : (hover == null ? onOpenThesis : undefined)
}
```

And accept a new `onClose` prop in the component signature:

```jsx
const CenterHUD = ({ radius, hover, selected, onOpenThesis, onClose }) => {
```

In `Mandala.jsx`, pass `onClose={closeSelected}`:

```jsx
<CenterHUD
  radius={hudRadius}
  hover={hover}
  selected={!!selected}
  onOpenThesis={() => setArchitectThesis?.(true)}
  onClose={closeSelected}
/>
```

- [ ] **Step 4: Render the `BeaconCard` outside the SVG**

At the bottom of the `Mandala` component's return (after the closing `</svg>` but inside the wrapping `<div>`), add:

```jsx
{selected && (
  <>
    {/* Click-outside overlay. */}
    <div
      className="absolute inset-0"
      style={{ zIndex: 30 }}
      onClick={closeSelected}
    />
    <BeaconCard
      beacon={selected}
      onClose={closeSelected}
      isMobile={isMobile}
    />
  </>
)}
```

- [ ] **Step 5: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`: click a beacon → card should appear centered, rest of mandala should blur. Click outside the card, press Esc, or click the center HUD → card should close.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx src/terminal/views/manifesto/CenterHUD.jsx
git commit -m "feat(manifesto): beacon click opens BeaconCard with blur backdrop"
```

---

## Task 16: Add chapter perimeter labels

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Render chapter labels at wedge midpoints**

Inside the SVG wrapping `<g>` (the blurred one), after the beacons group, add:

```jsx
{/* ── Chapter perimeter labels ─────────────────────────── */}
<g pointerEvents="none">
  {chapterWedges.map((w, i) => {
    const labelR = R * 1.05;
    const { x, y } = polarToCartesian(w.midAngle, labelR);
    const chapter = MANIFESTO_CHAPTERS[i];
    return (
      <text
        key={`label-${w.id}`}
        x={x.toFixed(2)}
        y={y.toFixed(2)}
        fill={`hsl(${(i * 60) % 360}, 70%, 60%)`}
        fontFamily="monospace"
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity="0.7"
      >
        {chapter.number} {chapter.title}
      </text>
    );
  })}
</g>
```

- [ ] **Step 2: Hide labels on narrow viewports**

Wrap the chapter-labels group in `{minDim >= 720 && (...)}`:

```jsx
{minDim >= 720 && (
  <g pointerEvents="none">
    {/* ... chapter labels ... */}
  </g>
)}
```

- [ ] **Step 3: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`: chapter labels should appear just outside the outer ring at each wedge midpoint on desktop, hidden on narrow viewports.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): add chapter perimeter labels (desktop only)"
```

---

## Task 17: Mobile two-tap interaction (preview → commit)

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Replace `onClick` with touch-aware handler**

Replace `handleBeaconClick` with:

```jsx
const handleBeaconClick = (beacon, e) => {
  e?.stopPropagation?.();
  if (isMobile) {
    // Two-tap: first tap = hover preview, second tap on same beacon = open.
    if (hover?.type === 'beacon' && hover.data.nodeId === beacon.nodeId) {
      setSelected(beacon);
    } else {
      setHover({ type: 'beacon', data: beacon });
    }
  } else {
    setSelected(beacon);
  }
};
```

- [ ] **Step 2: Dismiss mobile preview on outside tap**

Add a click handler to the outer container `<div>`:

```jsx
const handleContainerClick = (e) => {
  // Only dismiss preview on mobile, when nothing is selected,
  // and the click was on the container itself (not a child beacon/wedge).
  if (isMobile && !selected && e.target === e.currentTarget) {
    setHover(null);
  }
};
```

Attach it:

```jsx
<div
  ref={containerRef}
  className="w-full h-full bg-black relative"
  style={{ minHeight: '80vh' }}
  onClick={handleContainerClick}
>
```

- [ ] **Step 3: Verify build and manual mobile check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, then use browser DevTools device-emulation to switch to a phone viewport (e.g. 390×844). Tap a beacon once → HUD updates, beacon highlights, no card opens. Tap the same beacon again → card opens as bottom sheet.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): mobile two-tap (preview → commit) interaction"
```

---

## Task 18: Keyboard navigation — Tab cycles beacons, Enter opens

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Add `tabIndex` and `onKeyDown` to each beacon**

Inside the beacon render loop, add `tabIndex={0}` and `onKeyDown` to the wrapper `<g>`. Update the `<g>` wrapper:

```jsx
<g
  key={b.nodeId}
  tabIndex={0}
  role="button"
  aria-label={`beacon ${b.nodeId}`}
  onMouseEnter={() => handleBeaconEnter(b)}
  onMouseLeave={handleBeaconLeave}
  onFocus={() => handleBeaconEnter(b)}
  onBlur={handleBeaconLeave}
  onClick={(e) => handleBeaconClick(b, e)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(b);
    }
  }}
  style={{ cursor: 'pointer', outline: 'none' }}
>
```

- [ ] **Step 2: Add visible focus ring via CSS**

At the top of the SVG (just after the opening tag), add:

```jsx
<defs>
  <style>{`
    g[role="button"]:focus-visible circle {
      stroke: #ffffff !important;
      stroke-opacity: 0.9 !important;
    }
  `}</style>
</defs>
```

- [ ] **Step 3: Verify build and keyboard check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`: press Tab — focus should move through beacons in DOM order (which is the order in `MANIFESTO_BEACONS`). Press Enter on a focused beacon → card opens. Esc closes.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): keyboard navigation — Tab/Enter/Space on beacons"
```

---

## Task 19: Session-scoped `read` checkmarks on opened beacons

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

- [ ] **Step 1: Track read beacons in state**

Near the `selected` state, add:

```jsx
const [readBeacons, setReadBeacons] = useState(() => new Set());
```

In `handleBeaconClick`, after `setSelected(beacon)`, add:

```jsx
setReadBeacons(prev => {
  const next = new Set(prev);
  next.add(beacon.nodeId);
  return next;
});
```

Do this in both branches (mobile second-tap and desktop direct-click).

- [ ] **Step 2: Render a `✓` tick next to read beacon labels**

Inside the beacon loop, where the `<text>` label is rendered, add a sibling `<text>` for the check mark when the beacon has been read:

```jsx
{showLabels && readBeacons.has(b.nodeId) && (
  <text
    x={(labelX + (b.x >= 0 ? 52 : -52)).toFixed(2)}
    y={labelY.toFixed(2)}
    fill="#39ff14"
    fontFamily="monospace"
    fontSize="7"
    textAnchor={b.x >= 0 ? 'start' : 'end'}
    dominantBaseline="middle"
  >
    ✓
  </text>
)}
```

- [ ] **Step 3: Verify build and visual check**

Run: `npx vite build`
Expected: build succeeds.

Run `npm run dev`, click several beacons → a green `✓` should appear next to each opened beacon's label on desktop.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): session-scoped read checkmarks on opened beacons"
```

---

## Task 20: Full test run + build + manual verification checklist

**Files:** (none modified)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run tests/manifesto/`
Expected: PASS — all 16 tests in `mandalaGeometry.test.js` and all 11 tests in `manifestoData.test.js` passing.

- [ ] **Step 2: Run full build**

Run: `npx vite build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Manual verification on desktop (≥960 px)**

Run `npm run dev`, open the manifesto tab, and check each item:

- [ ] Mandala fills the tab, no rectangular chrome visible
- [ ] 256 ambient specks visible (dim cyan)
- [ ] ~36 bright beacons visible with labels
- [ ] 16 spokes + 4 concentric rings visible
- [ ] 6 colored wedge territories visible
- [ ] Chapter labels visible on the outer ring
- [ ] Center HUD shows `observer: mercury / architect: active / thesis: still running`
- [ ] Hover a beacon → HUD swaps to beacon id + quote, beacon brightens
- [ ] Hover an empty wedge area → HUD swaps to chapter number/title/epigraph
- [ ] Click a beacon → card opens, rest of mandala blurs
- [ ] Press Esc → card closes
- [ ] Click the center HUD (× close) while card open → card closes
- [ ] Click outside the card → card closes
- [ ] Click the center HUD (with nothing selected) → full-page `ThesisView` appears
- [ ] Tab key cycles focus through beacons
- [ ] Enter/Space on focused beacon opens its card
- [ ] Opened beacons show a `✓` tick

- [ ] **Step 4: Manual verification on tablet (720–959 px)**

Use DevTools responsive mode at 820×1180:

- [ ] Mandala scales up (bigger relative to viewport)
- [ ] Labels still visible but shorter
- [ ] All interactions still work

- [ ] **Step 5: Manual verification on phone (< 480 px)**

Use DevTools responsive mode at 390×844:

- [ ] Beacon labels hidden
- [ ] Mandala nearly fills viewport
- [ ] First tap on beacon → HUD preview, no card
- [ ] Second tap on same beacon → card opens as bottom sheet covering lower 60%
- [ ] Tap outside bottom sheet → card closes
- [ ] Chapter perimeter labels hidden

- [ ] **Step 6: Commit the final verification**

If any manual check fails, fix it inline and run this task's steps again from Step 1. Do not proceed without all checks passing.

Once all checks pass:

```bash
git commit --allow-empty -m "chore(manifesto): verification pass complete"
```

---

## Self-Review Notes

This plan was checked against the spec (`docs/superpowers/specs/2026-04-11-manifesto-lattice-design.md`) for coverage before finalization:

- **§2 Goal** — achieved by Task 7 (scaffold) + Task 8 (mount).
- **§3.1 Single region, edge-to-edge** — Task 8 (thin wrapper) + Task 7 (`min-height: 80vh`).
- **§3.2 Radial mandala geometry** — Tasks 1–4 (pure geometry), Task 7 (rings/spokes/wedges), Task 9 (specks), Task 10 (beacons).
- **§3.2 Beacon selection** — Task 6 (36 verified beacons); integrity test enforces membership.
- **§3.2 Chapter territories** — Task 5 (data) + Task 7 (render) + Task 16 (perimeter labels).
- **§3.3 Center HUD (idle/hover/selected)** — Task 11 (component), Task 12 (beacon hover wiring), Task 13 (chapter hover), Task 15 (selected state / close).
- **§3.4 Old chrome removed** — Task 8 replaces `ManifestoTab.jsx` in full; all rails deleted.
- **§4.1 Hover model** — Tasks 12, 13, 17.
- **§4.2 Inline expansion with blur** — Task 14 (card component) + Task 15 (blur + click).
- **§4.3 Chapter wedge click** — partial: wedge hover is in Task 13. Clicking a wedge to open a chapter card is NOT in this plan's scope — the spec says the wedge click "opens a card at the wedge centroid." This is a deliberate YAGNI cut; if the user wants it, it can be added as a follow-up using the same `BeaconCard` component with chapter content. Noted here so the omission is intentional, not an oversight.
- **§4.4 Keyboard** — Task 18.
- **§4.5 What the tab does NOT do** — zero rotation/audio/particles/fusion code anywhere in this plan.
- **§5 File decomposition** — exactly matches Tasks 1–6 and 7–15 (5 files + 2 data files + 2 test files).
- **§6.1 Audit** — Tasks 5, 6 enforce integrity via tests; sector ordering locked in Task 1; beacon list verified by data test in Task 6.
- **§6.2 Missing data fallbacks** — BeaconCard (Task 14) uses safe defaults (`|| []`, `?.`). CenterHUD shows static "thesis: still running" regardless of data state.
- **§6.3 Responsive** — Task 7 (radius scale), Task 9 (speck sizing), Task 10 (`showLabels`), Task 11 (HUD radius), Task 14 (mobile bottom sheet), Task 16 (labels hidden on narrow), Task 17 (two-tap), Task 20 (manual checks).
- **§7 Testing** — Tasks 1–6 provide unit + data integrity tests; Task 20 provides the manual interaction checklist.
- **§8 Rollout** — single atomic change, no flag, old `ManifestoTab.jsx` replaced in Task 8.

**Intentional scope cut:** chapter wedge click-to-open-card (§4.3). Everything else from the spec is covered.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-11-manifesto-lattice.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because the tasks have clear boundaries and each one produces a visually-verifiable increment.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Faster through-put but less isolation.

**Which approach?**
