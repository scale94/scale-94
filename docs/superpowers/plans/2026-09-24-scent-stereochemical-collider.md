# /SCENT Stereochemical Collider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace what the /SCENT collision chamber draws with a stereochemical collider: pinched ingress beams, a diamond Fresnel shock, a truncated-octahedron cage that rings down in benzene's mode ratios, needles driven by the 16 OCK dimensions, and knife-edge Schlieren fronts. Everything accumulates in half-float and resolves through a max-channel knee.

**Architecture:** `ColliderChamber` keeps glHost's fullscreen-quad field program and adds three programs it owns itself: instanced streak ribbons (4096), instanced cage ribbons (60), and a composite. With `EXT_color_buffer_float`, the first three passes add into an RGBA16F accumulator and the composite applies the knee. Without it, they screen-blend straight into the canvas. Every frame is a pure function of (seeds, props, phase, elapsed ms). All timing and shape constants live in `colliderPhases.js`, are interpolated into the GLSL, and the envelopes the chamber uploads are computed there, so the tests pin what is rendered.

**Tech Stack:** React 19, raw WebGL2 (GLSL ES 3.00) on the shared harness in `src/terminal/gl/`, Vitest + jsdom with the recording GL stub, and headless Chrome over CDP (`scripts/cdp.mjs`) for real compiles and screenshots.

**Spec:** `docs/superpowers/specs/2026-09-24-scent-stereochemical-collider-design.md` (approved).

## Global Constraints

- Work on branch `feature/scent-stereochemical-collider`. **Never push. Never merge.** Pushing needs the author's explicit command.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `ACCELERATE_MS = 1800` and `COLLIDE_MS = 2500` are unchanged. The phase graph and `usePhaseAdvance` are untouched.
- The chamber background `bg-black/60` is unchanged. "Fade to black" means zero emission and zero coverage.
- No diff to `src/terminal/gl/glHost.js`, `frameLoop.js` or `useShaderCanvas.js`. Only the test helpers in `src/terminal/gl/__tests__/` change, and only additively.
- `src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap` stays byte-identical to `main`.
- `paintChamber()` allocates nothing: no objects, arrays or closures per frame.
- No ringdown mode exceeds 18 Hz. The vibration moves geometry, never brightness.
- Every emission is exactly 0 at `ms >= 2400` in `colliding`.
- The knee is max-channel Reinhard, `f = knee + s·t/(t+s)`, with `knee = 0.6`.
- The shader and timeline modules (`colliderPhases.js`, `glsl.js`, `ribbonShader.js`, `streakShader.js`, `cageShader.js`, `compositeShader.js`, `fieldShader.js`, `cageTopology.js`, `domainMass.js`) must be importable by plain Node. Their relative imports use explicit `.js` extensions, and they never touch `import.meta.env` or the DOM.
- `npm run lint` exits 0 (warnings are ratcheted at 153 max). Do not sweep `react-hooks/exhaustive-deps`.
- **Every new test is mutation-checked:** apply the named mutation, see the test fail, revert. A test that cannot fail does not count.
- Run tests with `npx vitest run <path>`.

## File Structure

| file | responsibility |
|---|---|
| `src/terminal/gl/__tests__/recordingGL.js` | modify: `extensions` option, instancing, separate blend, framebuffer status, half-float enums |
| `src/terminal/gl/__tests__/driveFrames.js` | modify: pass `extensions` through |
| `src/terminal/gl/__tests__/recordingGLExtensions.test.js` | new: stub capability tests |
| `src/terminal/collider/domainMass.js` | new: feature vector → rank-normalised mass |
| `src/terminal/collider/cageTopology.js` | new: truncated octahedron, tilt, instance buffer |
| `src/terminal/collider/colliderPhases.js` | modify: timeline, geometry, gains, modes, envelopes, knee, mirrors of the shader curves; legacy `phaseTiming` deleted in Task 8 |
| `src/terminal/collider/accumTarget.js` | new: RGBA16F target create / resize / delete, with capability fallback |
| `src/terminal/collider/glsl.js` | new: `glslFloat`, shared GLSL chunks (`hue2rgb`, integer hash) |
| `src/terminal/collider/ribbonShader.js` | new: ribbon VS chunk plus the shared ribbon FS |
| `src/terminal/collider/streakShader.js` | new: ingress, idle-drift and needle streaks |
| `src/terminal/collider/cageShader.js` | new: cage docking, ringdown, bond failure |
| `src/terminal/collider/compositeShader.js` | new: knee plus shadow-coverage resolve |
| `src/terminal/collider/fieldShader.js` | rewrite: shock, glint, Schlieren fronts; legacy bursts removed |
| `src/terminal/collider/ColliderChamber.jsx` | rewrite: four programs, accumulator, per-phase snap, mass props, scrub hook |
| `src/terminal/collider/particleShader.js` | delete |
| `src/terminal/views/LatentCollider.jsx` | modify: compute and pass `massA` / `massB` only |
| `scripts/_scentShaders.mjs` | new: real-GPU compile / link check of every chamber program |
| `scripts/_scentMass.mjs` | new: prints grid-domain masses to pick eye-check pairs |
| `scripts/_scentSheet.mjs` | new: eight-instant contact sheet via the scrub hook |

---

### Task 1: Recording GL stub — instancing, separate blend, float targets

**Files:**
- Modify: `src/terminal/gl/__tests__/recordingGL.js`
- Modify: `src/terminal/gl/__tests__/driveFrames.js`
- Test: `src/terminal/gl/__tests__/recordingGLExtensions.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createRecordingGL({ version = 2, extensions = [] })`.
  - `installRecordingGL({ version = 2, extensions = [] })`.
  - `driveFrames(mount, { frames, version, rerenders, extensions = [] })`.
  - The stub gains the methods `vertexAttribDivisor`, `drawArraysInstanced`, `blendFuncSeparate` and `checkFramebufferStatus` (which always returns `FRAMEBUFFER_COMPLETE`).
  - It gains the constants `ZERO = 0`, `ONE_MINUS_SRC_COLOR = 0x0301`, `NEAREST = 0x2600`, `RGBA16F = 0x881a`, `HALF_FLOAT = 0x140b` and `FRAMEBUFFER_COMPLETE = 0x8cd5`.
  - `getExtension(name)` returns `{}` for names in `extensions`, the lose-context object for `WEBGL_lose_context`, and `null` otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/gl/__tests__/recordingGLExtensions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecordingGL } from './recordingGL';

describe('recordingGL — instancing and float-target support', () => {
  it('reports no optional extension unless asked', () => {
    const gl = createRecordingGL({ version: 2 });
    expect(gl.getExtension('EXT_color_buffer_float')).toBeNull();
  });

  it('reports exactly the extensions it was given', () => {
    const gl = createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    expect(gl.getExtension('EXT_color_buffer_float')).not.toBeNull();
    expect(gl.getExtension('EXT_float_blend')).toBeNull();
    expect(gl.getExtension('WEBGL_lose_context')).toHaveProperty('loseContext');
  });

  it('records the instancing and separate-blend calls', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.vertexAttribDivisor(0, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 60);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    expect(gl.__log).toEqual([
      ['vertexAttribDivisor', 0, 1],
      ['drawArraysInstanced', 5, 0, 4, 60],
      ['blendFuncSeparate', 1, 1, 0, 1],
    ]);
  });

  it('says every framebuffer is complete, and logs the check', () => {
    const gl = createRecordingGL({ version: 2 });
    expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(gl.FRAMEBUFFER_COMPLETE);
    expect(gl.__log).toEqual([['checkFramebufferStatus', 0x8d40]]);
  });

  it('has the half-float and screen-blend enums', () => {
    const gl = createRecordingGL({ version: 2 });
    expect([gl.RGBA16F, gl.HALF_FLOAT, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.NEAREST])
      .toEqual([0x881a, 0x140b, 0x0301, 0, 0x2600]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGLExtensions.test.js`
Expected: FAIL. `gl.vertexAttribDivisor is not a function` and wrong enum values.

- [ ] **Step 3: Implement**

In `src/terminal/gl/__tests__/recordingGL.js`:

Add to the `CONSTANTS` object, after `FRAMEBUFFER: 0x8d40, COLOR_ATTACHMENT0: 0x8ce0,`:

```js
  ZERO: 0, ONE_MINUS_SRC_COLOR: 0x0301, NEAREST: 0x2600,
  RGBA16F: 0x881a, HALF_FLOAT: 0x140b, FRAMEBUFFER_COMPLETE: 0x8cd5,
```

In `V1_METHODS`, change the last line `'getExtension',` to:

```js
  'getExtension', 'blendFuncSeparate', 'checkFramebufferStatus',
```

Change `V2_ONLY` to:

```js
const V2_ONLY = ['createVertexArray', 'bindVertexArray', 'deleteVertexArray', 'texStorage2D',
  'vertexAttribDivisor', 'drawArraysInstanced'];
```

Change the signature `export function createRecordingGL({ version = 2 } = {}) {` to:

```js
export function createRecordingGL({ version = 2, extensions = [] } = {}) {
```

Replace the whole `gl.getExtension = ...` override with:

```js
  gl.getExtension = (name) => {
    log.push(['getExtension', name]);
    if (name === 'WEBGL_lose_context') return { loseContext: () => log.push(['loseContext']) };
    // Optional capabilities are OFF unless a test asks for them, so every
    // snapshot captured before this option existed replays unchanged.
    return extensions.includes(name) ? {} : null;
  };
  gl.checkFramebufferStatus = (target) => {
    log.push(['checkFramebufferStatus', target]);
    return CONSTANTS.FRAMEBUFFER_COMPLETE;
  };
```

Change `installRecordingGL`'s first two lines to:

```js
export function installRecordingGL({ version = 2, extensions = [] } = {}) {
  const gl = createRecordingGL({ version, extensions });
```

In `src/terminal/gl/__tests__/driveFrames.js`, change the signature and the install line:

```js
export function driveFrames(mount, { frames = DEFAULT_FRAMES, version = 1, rerenders = [], extensions = [] } = {}) {
```

```js
  const rec = installRecordingGL({ version, extensions });
```

- [ ] **Step 4: Run the new tests and the whole GL suite**

Run: `npx vitest run src/terminal/gl`
Expected: PASS, including every existing test.

Run: `git diff --exit-code main -- src/terminal/gl/__tests__/__snapshots__/`
Expected: exit 0, no output.

- [ ] **Step 5: Mutation check**

Temporarily change `return extensions.includes(name) ? {} : null;` to `return {};`. The test "reports no optional extension unless asked" must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/__tests__/recordingGL.js src/terminal/gl/__tests__/driveFrames.js src/terminal/gl/__tests__/recordingGLExtensions.test.js
git commit -m "test(gl): recording stub learns instancing, separate blend and float targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Domain mass

**Files:**
- Create: `src/terminal/collider/domainMass.js`
- Test: `src/terminal/collider/__tests__/domainMass.test.js`

**Interfaces:**
- Consumes: `FEATURES`, `NODE_IDX` from `src/terminal/data/nodeFeatures.js` (tests only).
- Produces:
  - `DEFAULT_MASS = 0.5`
  - `rawMass(featureVec) -> number`, which is `f[11] - f[4]`
  - `rankNormalize(values: number[]) -> number[]`
  - `buildDomainMass(nodeIds: string[], nodeIdx: Record<string, number>, features: number[][]) -> number[]`, indexed like `nodeIds`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/domainMass.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { rankNormalize, rawMass, buildDomainMass, DEFAULT_MASS } from '../domainMass';
import { FEATURES, NODE_IDX } from '../../data/nodeFeatures';

describe('domainMass', () => {
  it('rawMass is weight minus volatility', () => {
    const f = new Array(32).fill(0);
    f[11] = 0.9;
    f[4] = 0.2;
    expect(rawMass(f)).toBeCloseTo(0.7, 12);
  });

  it('rank-normalises to [0,1] by order, not by value', () => {
    expect(rankNormalize([3, 1, 2])).toEqual([1, 0, 0.5]);
    expect(rankNormalize([100, -5, 0.001])).toEqual([1, 0, 0.5]);
  });

  it('averages the ranks of ties', () => {
    expect(rankNormalize([1, 1, 2])).toEqual([0.25, 0.25, 1]);
  });

  it('gives a non-finite value the default and leaves it out of the ranking', () => {
    expect(rankNormalize([NaN, 1, 2])).toEqual([DEFAULT_MASS, 0, 1]);
  });

  it('with fewer than two finite values everything is the default', () => {
    expect(rankNormalize([5])).toEqual([DEFAULT_MASS]);
    expect(rankNormalize([])).toEqual([]);
  });

  it('maps an unknown node to the default instead of throwing', () => {
    const m = buildDomainMass(['feigenbaum', 'no_such_node', 'kuramoto'], NODE_IDX, FEATURES);
    expect(m[1]).toBe(DEFAULT_MASS);
  });

  it('on real feature rows: bounded, deterministic, ordered by raw', () => {
    const ids = ['pqhash', 'biocoenosis', 'feigenbaum', 'kuramoto', 'surveillance', 'atmospheric'];
    const a = buildDomainMass(ids, NODE_IDX, FEATURES);
    expect(a).toEqual(buildDomainMass(ids, NODE_IDX, FEATURES));
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const raw = ids.map((id) => rawMass(FEATURES[NODE_IDX[id]]));
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (raw[i] < raw[j]) expect(a[i]).toBeLessThan(a[j]);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/domainMass.test.js`
Expected: FAIL with `Failed to resolve import "../domainMass"`.

- [ ] **Step 3: Implement**

Create `src/terminal/collider/domainMass.js`:

```js
// domainMass.js — how heavy each collider domain flies (spec §5.1).
//
// Mass is weight minus volatility from the domain's sphere-node feature
// vector, RANK-normalised across every collider domain. Rank, not min-max:
// the raw values skew volatile (mean f[4] 0.35 against mean f[11] 0.19), so a
// linear rescale would braid almost every beam. It is available the moment a
// domain is selected -- before collide() resolves -- which is the point: the
// ingress beams have to show it.
//
// Pure, no imports, Node-importable (scripts/_scentMass.mjs reads it).

export const DEFAULT_MASS = 0.5;

export const rawMass = (f) => f[11] - f[4];

export function rankNormalize(values) {
  const out = new Array(values.length).fill(DEFAULT_MASS);
  const idx = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) idx.push(i);
  const n = idx.length;
  if (n < 2) return out;
  idx.sort((a, b) => values[a] - values[b]);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const rank = (i + j) / 2;               // ties share their average rank
    for (let k = i; k <= j; k++) out[idx[k]] = rank / (n - 1);
    i = j + 1;
  }
  return out;
}

export function buildDomainMass(nodeIds, nodeIdx, features) {
  const raw = nodeIds.map((id) => {
    const row = features[nodeIdx[id]];
    return row ? rawMass(row) : NaN;         // unknown node -> default, never a throw
  });
  return rankNormalize(raw);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/domainMass.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Mutation check**

1. Change `const rank = (i + j) / 2;` to `const rank = i;`. "averages the ranks of ties" must FAIL. Revert.
2. Change `if (Number.isFinite(values[i])) idx.push(i);` to `idx.push(i);`. The non-finite test must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/domainMass.js src/terminal/collider/__tests__/domainMass.test.js
git commit -m "feat(collider): rank-normalised domain mass from the feature vector

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cage topology

**Files:**
- Create: `src/terminal/collider/cageTopology.js`
- Test: `src/terminal/collider/__tests__/cageTopology.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Constants: `CAGE_VERTEX_COUNT = 24`, `CAGE_BOND_COUNT = 36`, `CAGE_INSTANCE_COUNT = 60`, and `CAGE_TILT` (frozen `{ yaw: 0.78, pitch: 0.16, roll: 0.11 }`).
  - `cageBasePositions() -> number[24][3]`, the untilted integer coordinates.
  - `cageBonds(pos) -> [i, j][]`, the pairs at squared distance 2.
  - `cageRest() -> number[24][3]`, tilted and normalised to unit circumradius.
  - `cageRestFlat() -> Float32Array(72)`.
  - `buildCageInstances() -> Float32Array(180)`: 36 `(i, j, 0)` bond rows, then 24 `(v, v, 1)` vertex rows.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/cageTopology.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  cageBasePositions, cageBonds, cageRest, cageRestFlat, buildCageInstances,
  CAGE_VERTEX_COUNT, CAGE_BOND_COUNT, CAGE_INSTANCE_COUNT,
} from '../cageTopology';

const base = cageBasePositions();
const bonds = cageBonds(base);
const rest = cageRest();
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('cageTopology — truncated octahedron (sodalite cage)', () => {
  it('has 24 vertices and 36 bonds', () => {
    expect(base).toHaveLength(CAGE_VERTEX_COUNT);
    expect(bonds).toHaveLength(CAGE_BOND_COUNT);
    expect(CAGE_INSTANCE_COUNT).toBe(60);
  });

  it('is 3-regular: every vertex has exactly three bonds', () => {
    const deg = new Array(24).fill(0);
    for (const [i, j] of bonds) { deg[i]++; deg[j]++; }
    expect(new Set(deg)).toEqual(new Set([3]));
  });

  it('has 6 square faces and, by Euler, 8 hexagons', () => {
    const adj = Array.from({ length: 24 }, () => new Set());
    for (const [i, j] of bonds) { adj[i].add(j); adj[j].add(i); }
    // Every 4-cycle of this graph is a square face; hexagons contain none.
    const squares = new Set();
    for (let a = 0; a < 24; a++) {
      for (const b of adj[a]) {
        for (const c of adj[b]) {
          if (c === a) continue;
          for (const d of adj[c]) {
            if (d === a || d === b) continue;
            if (adj[d].has(a)) squares.add([a, b, c, d].sort((x, y) => x - y).join(','));
          }
        }
      }
    }
    expect(squares.size).toBe(6);
    const faces = 2 - 24 + 36;
    expect(faces).toBe(14);
    expect(faces - squares.size).toBe(8);
  });

  it('keeps every bond the same length after tilt and normalisation', () => {
    const want = Math.SQRT2 / Math.sqrt(5);
    for (const [i, j] of bonds) expect(len(rest[i], rest[j])).toBeCloseTo(want, 9);
  });

  it('puts every vertex on the unit sphere', () => {
    for (const v of rest) expect(Math.hypot(...v)).toBeCloseTo(1, 9);
  });

  it('is tilted so x = 0 splits the vertices 12 / 12 with none near the plane', () => {
    const xs = rest.map((v) => v[0]);
    expect(xs.filter((x) => x < 0)).toHaveLength(12);
    expect(Math.min(...xs.map(Math.abs))).toBeGreaterThan(0.05);
  });

  it('packs 36 bond rows then 24 vertex rows', () => {
    const b = buildCageInstances();
    expect(b).toHaveLength(180);
    for (let k = 0; k < 36; k++) {
      expect(b[k * 3 + 2]).toBe(0);
      expect(b[k * 3]).not.toBe(b[k * 3 + 1]);
    }
    for (let v = 0; v < 24; v++) {
      const o = (36 + v) * 3;
      expect([b[o], b[o + 1], b[o + 2]]).toEqual([v, v, 1]);
    }
  });

  it('flattens the rest positions for a vec3[24] uniform', () => {
    const f = cageRestFlat();
    expect(f).toBeInstanceOf(Float32Array);
    expect(f).toHaveLength(72);
    expect(f[3]).toBeCloseTo(rest[1][0], 6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/cageTopology.test.js`
Expected: FAIL with `Failed to resolve import "../cageTopology"`.

- [ ] **Step 3: Implement**

Create `src/terminal/collider/cageTopology.js`:

```js
// cageTopology.js — the cage the collision docks into (spec §6.2).
//
// A truncated octahedron: 24 vertices = every permutation of (0, ±1, ±2),
// 36 bonds = the vertex pairs at distance √2, faces 8 hexagons + 6 squares.
// It is the sodalite cage of zeolite chemistry -- a real molecular cage --
// and the hexagons are the benzene read. Fixed topology, built once: no
// Delaunay and no per-frame work.
//
// Pure, no imports, Node-importable.

export const CAGE_VERTEX_COUNT = 24;
export const CAGE_BOND_COUNT = 36;
export const CAGE_INSTANCE_COUNT = CAGE_BOND_COUNT + CAGE_VERTEX_COUNT; // bonds first, then vertices

// Chosen by search so the plane x = 0 splits the vertices 12/12 with the
// nearest vertex ~0.31 of the circumradius away from it -- docking sends
// x < 0 vertices in from beam A and x > 0 from beam B, so none may sit on it.
export const CAGE_TILT = Object.freeze({ yaw: 0.78, pitch: 0.16, roll: 0.11 });
const CIRCUMRADIUS = Math.sqrt(5);

export function cageBasePositions() {
  const out = [];
  for (let zeroAxis = 0; zeroAxis < 3; zeroAxis++) {
    const others = [0, 1, 2].filter((a) => a !== zeroAxis);
    for (const [a1, a2] of [[others[0], others[1]], [others[1], others[0]]]) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const v = [0, 0, 0];
          v[a1] = s1;
          v[a2] = 2 * s2;
          out.push(v);
        }
      }
    }
  }
  return out;
}

export function cageBonds(pos) {
  const out = [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d2 = (pos[i][0] - pos[j][0]) ** 2 + (pos[i][1] - pos[j][1]) ** 2 + (pos[i][2] - pos[j][2]) ** 2;
      if (Math.abs(d2 - 2) < 1e-9) out.push([i, j]);
    }
  }
  return out;
}

// x-axis pitch, then y-axis yaw, then z-axis roll.
function tilt([x0, y0, z0], { yaw, pitch, roll }) {
  let c = Math.cos(pitch);
  let s = Math.sin(pitch);
  const y1 = c * y0 - s * z0;
  const z1 = s * y0 + c * z0;
  c = Math.cos(yaw);
  s = Math.sin(yaw);
  const x2 = c * x0 + s * z1;
  const z2 = -s * x0 + c * z1;
  c = Math.cos(roll);
  s = Math.sin(roll);
  return [c * x2 - s * y1, s * x2 + c * y1, z2];
}

export function cageRest() {
  return cageBasePositions().map((v) => tilt(v, CAGE_TILT).map((c) => c / CIRCUMRADIUS));
}

export function cageRestFlat() {
  return Float32Array.from(cageRest().flat());
}

export function buildCageInstances() {
  const bonds = cageBonds(cageBasePositions());
  const out = new Float32Array(CAGE_INSTANCE_COUNT * 3);
  bonds.forEach(([i, j], k) => {
    out[k * 3] = i;
    out[k * 3 + 1] = j;
    out[k * 3 + 2] = 0;
  });
  for (let v = 0; v < CAGE_VERTEX_COUNT; v++) {
    const o = (CAGE_BOND_COUNT + v) * 3;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = 1;
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/cageTopology.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Mutation check**

1. Change `if (Math.abs(d2 - 2) < 1e-9)` to `if (Math.abs(d2 - 5) < 1e-9)`. The bond-count test must FAIL. Revert.
2. Change `CAGE_TILT` to `{ yaw: 0, pitch: 0, roll: 0 }`. The 12/12 test must FAIL, because 8 vertices sit on x = 0. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/cageTopology.js src/terminal/collider/__tests__/cageTopology.test.js
git commit -m "feat(collider): truncated-octahedron cage topology

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Collision timeline, constants and shader-curve mirrors

**Files:**
- Modify: `src/terminal/collider/colliderPhases.js`. Append below the existing `phaseTiming`, and do not touch the legacy code yet; Task 8 deletes it.
- Test: `src/terminal/collider/__tests__/colliderTimeline.test.js` (new)

**Interfaces:**
- Consumes: the existing `ACCELERATE_MS`, `COLLIDE_MS`, `PHASE_ID` and `clamp01` in the same file.
- Produces, all exported:
  - Constants:
    - `TIMELINE`, `GEOMETRY`, `GAINS`, `MODES`: frozen objects with the exact keys shown below.
    - `FREQ_CEILING_HZ = 18`, `MASS_PITCH = 1.5`, `KNEE = 0.6`.
    - `SNAP_MS` (`{ accelerating: 1800, colliding: 1300 }`) and `SNAP_DEFAULT_MS = 1800`.
  - Snap time: `snapMsFor(phase) -> number`.
  - Timing object:
    - `createTiming() -> Timing`, with `{ progress, ease, shockR, shockA, glint, cageT, cageA, squash, needleA, ringR: Float32Array(3), ringA: Float32Array(3), ringP: Float32Array(3) }`.
    - `timingInto(out: Timing, phase: string, elapsedMs: number) -> out`. It writes into `out`, returns it, and allocates nothing.
  - Mass-driven values:
    - `modeFrequency(f0, meanMass) -> Hz`
    - `ringThreeWeight(meanMass) -> [0,1]`
  - Colour: `mixHue01(a, b) -> [0,1)`, a shortest-arc hue blend.
  - JS mirrors of shader curves, pinned by tests:
    - `kneeScale(m) -> factor`
    - `easeIntegralS(tSec) -> number`
    - `dockCurve(tSec) -> number`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderTimeline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ACCELERATE_MS, COLLIDE_MS, PHASE_ID, TIMELINE, GEOMETRY, MODES, FREQ_CEILING_HZ, KNEE,
  createTiming, timingInto, modeFrequency, ringThreeWeight, mixHue01,
  kneeScale, easeIntegralS, dockCurve, snapMsFor,
} from '../colliderPhases';

const at = (phase, ms) => timingInto(createTiming(), phase, ms);
const envelopes = (T) => [T.shockA, T.glint, T.cageA, T.needleA, ...T.ringA];

describe('collision timeline', () => {
  it('keeps the parent-owned durations', () => {
    expect(ACCELERATE_MS).toBe(1800);
    expect(COLLIDE_MS).toBe(2500);
    expect(PHASE_ID.colliding).toBe(3);
  });

  it('writes into the object it is given and allocates no replacement arrays', () => {
    const out = createTiming();
    const rings = out.ringA;
    expect(timingInto(out, 'colliding', 700)).toBe(out);
    expect(out.ringA).toBe(rings);
  });

  it('every emission is exactly zero from EMISSION_END_MS on', () => {
    expect(TIMELINE.EMISSION_END_MS).toBe(2400);
    for (const ms of [2400, 2450, 2499, 2500, 9000]) {
      for (const v of envelopes(at('colliding', ms))) expect(v).toBe(0);
    }
  });

  it('the needle envelope is exactly zero from 1200ms and full mid-crackle', () => {
    for (const ms of [1200, 1300, 2000]) expect(at('colliding', ms).needleA).toBe(0);
    expect(at('colliding', 800).needleA).toBe(1);
    expect(at('colliding', 400).needleA).toBe(0);
  });

  it('the shock is gone by 350ms and the glint by 40ms', () => {
    expect(at('colliding', 0).shockA).toBe(1);
    expect(at('colliding', 349).shockA).toBeGreaterThan(0);
    expect(at('colliding', 350).shockA).toBe(0);
    expect(at('colliding', 39).glint).toBeGreaterThan(0);
    expect(at('colliding', 40).glint).toBe(0);
  });

  it('rings launch on schedule and are silent before', () => {
    expect(at('colliding', 599).ringA[0]).toBe(0);
    expect(at('colliding', 700).ringA[0]).toBeGreaterThan(0);
    expect(at('colliding', 700).ringA[1]).toBe(0);
    expect(at('colliding', 850).ringA[1]).toBeGreaterThan(0);
    expect(at('colliding', 959).ringA[2]).toBe(0);
    expect(at('colliding', 1100).ringA[2]).toBeGreaterThan(0);
  });

  it('the cage exists only inside its window and fades its vertices 650..750', () => {
    expect(at('colliding', 0).cageT).toBe(0);
    expect(at('colliding', 799).cageT).toBeCloseTo(0.799, 9);
    expect(at('colliding', 800).cageT).toBe(-1);
    expect(at('colliding', 600).cageA).toBe(1);
    expect(at('colliding', 700).cageA).toBeCloseTo(0.5, 9);
    expect(at('colliding', 750).cageA).toBe(0);
  });

  it('squash starts at 0.6 through docking and relaxes monotonically', () => {
    expect(at('colliding', 0).squash).toBe(0.6);
    expect(at('colliding', 120).squash).toBe(0.6);
    let prev = 0;
    for (let ms = 0; ms < 800; ms += 10) {
      const s = at('colliding', ms).squash;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBeGreaterThan(0.95);
  });

  it('pinches the beam below half a pixel at T-0', () => {
    expect(GEOMETRY.W_WALL * Math.exp(-GEOMETRY.KAPPA_HI)).toBeLessThan(0.5);
  });

  it('accelerating: easeInCubic, clamped', () => {
    expect(at('accelerating', 0).ease).toBe(0);
    expect(at('accelerating', 900).ease).toBeCloseTo(0.125, 9);
    expect(at('accelerating', 9000).ease).toBe(1);
    expect(at('accelerating', 9000).progress).toBe(1);
  });

  it('is frame-rate independent', () => {
    const a = at('accelerating', 54 * (1000 / 60));
    const b = at('accelerating', 108 * (1000 / 120));
    expect(a.ease).toBeCloseTo(b.ease, 12);
  });

  it('idle, selecting and result are inert', () => {
    for (const p of ['idle', 'selecting', 'result']) {
      const T = at(p, 1234);
      for (const v of envelopes(T)) expect(v).toBe(0);
      expect(T.cageT).toBe(-1);
      expect(T.squash).toBe(1);
      expect(T.ease).toBe(0);
    }
  });

  it('never produces NaN', () => {
    for (const ms of [-1000, NaN, 1e9]) {
      const T = at('colliding', ms);
      for (const v of Object.values(T)) {
        for (const x of (typeof v === 'number' ? [v] : Array.from(v))) expect(Number.isFinite(x)).toBe(true);
      }
    }
  });
});

describe('ringdown modes', () => {
  it("keep benzene's frequency ratios within 3%", () => {
    const [ch, cc, br, oop] = MODES;
    for (const [a, b] of [[ch, oop], [cc, oop], [br, oop], [ch, br]]) {
      expect(Math.abs((a.f0 / b.f0) / (a.cm / b.cm) - 1)).toBeLessThan(0.03);
    }
  });

  it('never exceed the 18 Hz ceiling, which is reached at the lightest mass', () => {
    let max = 0;
    for (let i = 0; i <= 100; i++) for (const m of MODES) max = Math.max(max, modeFrequency(m.f0, i / 100));
    expect(max).toBeLessThanOrEqual(FREQ_CEILING_HZ);
    expect(modeFrequency(MODES[0].f0, 0)).toBe(FREQ_CEILING_HZ);
  });

  it('heavier pairs ring lower (omega ~ 1/sqrt(m))', () => {
    expect(modeFrequency(9.4, 1)).toBeLessThan(modeFrequency(9.4, 0));
  });
});

describe('ring three weight', () => {
  it('is 0 below 0.3, 1 above 0.7, and continuous', () => {
    expect(ringThreeWeight(0.3)).toBe(0);
    expect(ringThreeWeight(0.7)).toBe(1);
    let prev = ringThreeWeight(0);
    for (let i = 1; i <= 1000; i++) {
      const w = ringThreeWeight(i / 1000);
      expect(Math.abs(w - prev)).toBeLessThan(0.01);
      prev = w;
    }
  });
});

describe('mixHue01', () => {
  it('blends along the short arc, including across 0', () => {
    expect(mixHue01(0.1, 0.3)).toBeCloseTo(0.2, 9);
    const h = mixHue01(0.9, 0.1);
    expect(Math.min(h, 1 - h)).toBeLessThan(1e-9);
  });
});

describe('kneeScale', () => {
  it('is the identity at and below the knee', () => {
    for (const m of [0, 0.3, KNEE]) expect(kneeScale(m)).toBe(1);
  });
  it('matches f = knee + s*t/(t+s) and never reaches 1', () => {
    expect(1 * kneeScale(1)).toBeCloseTo(0.6 + 0.4 * 0.4 / 0.8, 12);
    expect(1e6 * kneeScale(1e6)).toBeLessThan(1);
  });
  it('is monotonic in its output', () => {
    let prev = 0;
    for (let m = 0; m < 50; m += 0.05) {
      const y = m * kneeScale(m);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('easeIntegralS', () => {
  const T = ACCELERATE_MS / 1000;
  it('is zero at zero and T/4 at T', () => {
    expect(easeIntegralS(0)).toBe(0);
    expect(easeIntegralS(T)).toBeCloseTo(T / 4, 12);
  });
  it('has slope ease(t) inside the window and 1 beyond it', () => {
    const h = 1e-6;
    expect((easeIntegralS(0.9 + h) - easeIntegralS(0.9 - h)) / (2 * h)).toBeCloseTo((0.9 / T) ** 3, 6);
    expect((easeIntegralS(T + 1 + h) - easeIntegralS(T + 1 - h)) / (2 * h)).toBeCloseTo(1, 6);
  });
});

describe('dockCurve', () => {
  it('starts at 0, overshoots 6-10%, and settles within 3% by DOCK_MS', () => {
    expect(dockCurve(0)).toBe(0);
    let peak = 0;
    for (let t = 0; t <= 0.3; t += 0.0005) peak = Math.max(peak, dockCurve(t));
    expect(peak).toBeGreaterThan(1.06);
    expect(peak).toBeLessThan(1.10);
    expect(Math.abs(1 - dockCurve(TIMELINE.DOCK_MS / 1000))).toBeLessThan(0.03);
  });
});

describe('snapMsFor', () => {
  it('freezes accelerating fully pinched and colliding on the rings', () => {
    expect(snapMsFor('accelerating')).toBe(1800);
    expect(snapMsFor('colliding')).toBe(1300);
    expect(snapMsFor('idle')).toBe(1800);
  });
  it('the colliding snap shows rings but no needles and no shock', () => {
    const T = at('colliding', snapMsFor('colliding'));
    expect(T.needleA).toBe(0);
    expect(T.shockA).toBe(0);
    expect(T.ringA[0]).toBeGreaterThan(0.3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/colliderTimeline.test.js`
Expected: FAIL. `createTiming is not a function`, among others.

- [ ] **Step 3: Implement**

Append to the end of `src/terminal/collider/colliderPhases.js`:

```js
// ══ Stereochemical collider (spec 2026-09-24) ════════════════════════════════
// The single source of truth for the new chamber. The shaders interpolate
// these constants into their GLSL, and the chamber uploads the envelopes
// computed here, so the functions tested are the functions rendered.
// phaseTiming() above belongs to the legacy chamber and is deleted when the
// chamber switches over.

export const TIMELINE = Object.freeze({
  SHOCK_MS: 350,
  SHOCK_TAU_MS: 90,
  GLINT_MS: 40,
  DOCK_MS: 120,
  SQUASH_FROM: 0.6,
  SQUASH_TAU_MS: 250,
  BOND_BREAK_FROM_MS: 500,
  BOND_BREAK_SPAN_MS: 150,
  BOND_RETRACT_MS: 30,
  VERTEX_FADE_FROM_MS: 650,
  VERTEX_FADE_TO_MS: 750,
  CAGE_END_MS: 800,
  NEEDLE_LAUNCH_FROM_MS: 500,
  NEEDLE_LAUNCH_SPAN_MS: 250,
  NEEDLE_FADE_FROM_MS: 1100,
  NEEDLE_END_MS: 1200,
  RING_LAUNCH_MS: Object.freeze([600, 780, 960]),
  RING_TAU_MS: 600,
  RING_IN_MS: 60,
  EMISSION_END_MS: 2400,
});

// Lengths in CSS px unless the name says otherwise. Starting values -- the
// author tunes these by eye through the scrub hook (spec §12).
export const GEOMETRY = Object.freeze({
  W_WALL: 70, KAPPA_LO: 1.5, KAPPA_HI: 6, A_TURB: 14, V1: 1.6, INGRESS_TAIL_S: 0.03,
  CAGE_R_PX: 60, CAMERA_D: 4, DOCK_FROM_PX: 140, DOCK_ZETA: 0.63, DOCK_OMEGA: 52.9,
  TUMBLE_RAD_S: 0.9,
  NEEDLE_SHARE: 0.6, NEEDLE_DRAG: 3, NEEDLE_TAIL_S: 0.035,
  SHOCK_R_FRAC: 0.42, SHOCK_ASPECT: 1.8, FRINGE_PX: 6, GLINT_SIGMA: 3,
  RING_RK: Object.freeze([0.22, 0.34, 0.46]), RING_ASPECT: 1.8, RING_ROUND: 0.15,
  LOCUS_PX_PER_MASS: 40,
});

export const GAINS = Object.freeze({
  INGRESS: 0.55, NEEDLE: 1.2, BOND: 1.1, VERTEX: 1.6,
  SHOCK: 1.6, GLINT: 2.5, RING: 0.9, SHADOW: 0.35,
});

// Frequencies keep the ratios of benzene's real vibrational modes, scaled into
// the visible band. f0 is the frequency at the LIGHTEST mass, so the 18 Hz
// ceiling is pinned where ω ∝ 1/√m would otherwise push it higher.
export const MODES = Object.freeze([
  Object.freeze({ name: 'C-H stretch', cm: 3062, f0: 18.0, tauMs: 80, amp: 0.06 }),
  Object.freeze({ name: 'C=C stretch', cm: 1596, f0: 9.4, tauMs: 180, amp: 0.05 }),
  Object.freeze({ name: 'ring breathing', cm: 992, f0: 5.8, tauMs: 450, amp: 0.08 }),
  Object.freeze({ name: 'out-of-plane bend', cm: 673, f0: 4.0, tauMs: 350, amp: 0.12 }),
]);
export const FREQ_CEILING_HZ = 18;
export const MASS_PITCH = 1.5;
export const KNEE = 0.6;

// Reduced motion paints exactly one permanent frame per phase (spec §7).
export const SNAP_MS = Object.freeze({ accelerating: 1800, colliding: 1300 });
export const SNAP_DEFAULT_MS = 1800;
export const snapMsFor = (phase) => SNAP_MS[phase] ?? SNAP_DEFAULT_MS;

const finiteMs = (ms) => (Number.isFinite(ms) && ms > 0 ? ms : 0);
const massOrHalf = (m) => (Number.isFinite(m) ? clamp01(m) : 0.5);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function modeFrequency(f0, meanMass) {
  return f0 / Math.sqrt(1 + MASS_PITCH * massOrHalf(meanMass));
}

export function ringThreeWeight(meanMass) {
  return smooth(0.3, 0.7, massOrHalf(meanMass));
}

export function mixHue01(a, b) {
  const d = ((((b - a) % 1) + 1.5) % 1) - 0.5;
  return (((a + d * 0.5) % 1) + 1) % 1;
}

// Max-channel Reinhard shoulder. The composite shader applies the same curve.
export function kneeScale(m) {
  if (!(m > KNEE)) return 1;
  const t = m - KNEE;
  const s = 1 - KNEE;
  return (KNEE + (s * t) / (t + s)) / m;
}

// ∫0^t (t'/T)^3 dt', continued at slope 1 past T. The streak shader's
// easeIntegral() is this function; position is the integral of speed, never
// speed x time (spec §5.2).
export function easeIntegralS(tSec) {
  const T = ACCELERATE_MS / 1000;
  if (!(tSec > 0)) return 0;
  if (tSec <= T) {
    const p = tSec / T;
    return T * p * p * p * p * 0.25;
  }
  return T * 0.25 + (tSec - T);
}

// Under-damped docking spring, ~8% overshoot, settled by DOCK_MS. The cage
// shader's dockCurve() is this function.
export function dockCurve(tSec) {
  if (!(tSec > 0)) return 0;
  const z = GEOMETRY.DOCK_ZETA;
  const w = GEOMETRY.DOCK_OMEGA;
  const k = Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tSec) * (Math.cos(w * k * tSec) + (z / k) * Math.sin(w * k * tSec));
}

export function createTiming() {
  return {
    progress: 0, ease: 0,
    shockR: 0, shockA: 0, glint: 0,
    cageT: -1, cageA: 0, squash: 1,
    needleA: 0,
    ringR: new Float32Array(3), ringA: new Float32Array(3), ringP: new Float32Array(3),
  };
}

function inert(out) {
  out.progress = 0;
  out.ease = 0;
  out.shockR = 0;
  out.shockA = 0;
  out.glint = 0;
  out.cageT = -1;
  out.cageA = 0;
  out.squash = 1;
  out.needleA = 0;
  out.ringR.fill(0);
  out.ringA.fill(0);
  out.ringP.fill(0);
  return out;
}

export function timingInto(out, phase, elapsedMs) {
  const ms = finiteMs(elapsedMs);
  inert(out);

  if (phase === 'accelerating') {
    const p = clamp01(ms / ACCELERATE_MS);
    out.progress = p;
    out.ease = p * p * p;
    return out;
  }
  if (phase !== 'colliding') return out;

  const L = TIMELINE;
  out.progress = clamp01(ms / COLLIDE_MS);
  out.shockR = 1 - Math.exp(-ms / L.SHOCK_TAU_MS);
  out.shockA = ms < L.SHOCK_MS ? (1 - ms / L.SHOCK_MS) ** 2 : 0;
  out.glint = ms < L.GLINT_MS ? 1 - ms / L.GLINT_MS : 0;

  if (ms < L.CAGE_END_MS) {
    out.cageT = ms / 1000;
    out.cageA = ms < L.VERTEX_FADE_FROM_MS
      ? 1
      : clamp01(1 - (ms - L.VERTEX_FADE_FROM_MS) / (L.VERTEX_FADE_TO_MS - L.VERTEX_FADE_FROM_MS));
    out.squash = ms < L.DOCK_MS
      ? L.SQUASH_FROM
      : L.SQUASH_FROM + (1 - L.SQUASH_FROM) * (1 - Math.exp(-(ms - L.DOCK_MS) / L.SQUASH_TAU_MS));
  }

  if (ms >= L.NEEDLE_LAUNCH_FROM_MS) {
    out.needleA = ms < L.NEEDLE_FADE_FROM_MS
      ? 1
      : clamp01((L.NEEDLE_END_MS - ms) / (L.NEEDLE_END_MS - L.NEEDLE_FADE_FROM_MS));
  }

  if (ms < L.EMISSION_END_MS) {
    for (let k = 0; k < 3; k++) {
      const age = ms - L.RING_LAUNCH_MS[k];
      if (age < 0) continue;
      const p = age / (L.EMISSION_END_MS - L.RING_LAUNCH_MS[k]);
      out.ringR[k] = 1 - Math.exp(-age / L.RING_TAU_MS);
      out.ringA[k] = Math.min(1, age / L.RING_IN_MS) * (1 - p) * (1 - p);
      out.ringP[k] = p;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run it to verify it passes, and confirm the legacy suite is still green**

Run: `npx vitest run src/terminal/collider`
Expected: PASS, both the new `colliderTimeline.test.js` and the untouched `colliderPhases.test.js` / chamber tests.

- [ ] **Step 5: Mutation check**

1. Change `if (ms < L.EMISSION_END_MS) {` to `if (ms < L.EMISSION_END_MS + 50) {`. "every emission is exactly zero from EMISSION_END_MS on" must FAIL. Revert.
2. Change `f0: 18.0` to `f0: 18.5`. The ceiling test must FAIL. Revert.
3. Change `return T * 0.25 + (tSec - T);` to `return T * 0.25 + 2 * (tSec - T);`. The slope-beyond-T test must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/colliderPhases.js src/terminal/collider/__tests__/colliderTimeline.test.js
git commit -m "feat(collider): stereochemical timeline, modes and shader-curve mirrors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Half-float accumulator

**Files:**
- Create: `src/terminal/collider/accumTarget.js`
- Test: `src/terminal/collider/__tests__/accumTarget.test.js`

**Interfaces:**
- Consumes: `createRecordingGL({ version, extensions })` from Task 1 (tests).
- Produces:
  - `createAccumTarget(gl, w, h) -> Accum`, where `Accum = { mode: 'half-float' | 'screen', fbo, tex, w, h }`.
  - `resizeAccumTarget(gl, A, w, h) -> A`, which mutates `A`.
  - `deleteAccumTarget(gl, A)`, which mutates `A` to `mode 'screen'` with nulls.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/accumTarget.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../gl/__tests__/recordingGL';
import { createAccumTarget, resizeAccumTarget, deleteAccumTarget } from '../accumTarget';

const HALF = ['EXT_color_buffer_float'];
const calls = (gl, name) => gl.__log.filter((e) => e[0] === name);

describe('accumTarget', () => {
  it('without EXT_color_buffer_float: screen mode, no GL objects', () => {
    const gl = createRecordingGL({ version: 2 });
    const A = createAccumTarget(gl, 900, 220);
    expect(A).toEqual({ mode: 'screen', fbo: null, tex: null, w: 900, h: 220 });
    expect(calls(gl, 'createFramebuffer')).toHaveLength(0);
    expect(calls(gl, 'createTexture')).toHaveLength(0);
  });

  it('with it: an RGBA16F / HALF_FLOAT texture attached to a framebuffer, unbound after', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    expect(A.mode).toBe('half-float');
    expect(A.fbo).not.toBeNull();
    const tex = calls(gl, 'texImage2D');
    expect(tex).toHaveLength(1);
    expect(tex[0]).toEqual(['texImage2D', gl.TEXTURE_2D, 0, gl.RGBA16F, 900, 220, 0, gl.RGBA, gl.HALF_FLOAT, null]);
    const binds = calls(gl, 'bindFramebuffer');
    expect(binds[binds.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('an incomplete framebuffer falls back to screen and frees what it made', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    gl.checkFramebufferStatus = () => 0;
    const A = createAccumTarget(gl, 900, 220);
    expect(A.mode).toBe('screen');
    expect(calls(gl, 'deleteFramebuffer')).toHaveLength(1);
    expect(calls(gl, 'deleteTexture')).toHaveLength(1);
  });

  it('resize reallocates only when the size changes', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    const before = calls(gl, 'texImage2D').length;
    resizeAccumTarget(gl, A, 900, 220);
    expect(calls(gl, 'texImage2D')).toHaveLength(before);
    resizeAccumTarget(gl, A, 1200, 440);
    expect(calls(gl, 'texImage2D')).toHaveLength(before + 1);
    expect([A.w, A.h]).toEqual([1200, 440]);
  });

  it('resize is a no-op in screen mode', () => {
    const gl = createRecordingGL({ version: 2 });
    const A = createAccumTarget(gl, 900, 220);
    resizeAccumTarget(gl, A, 1200, 440);
    expect(calls(gl, 'texImage2D')).toHaveLength(0);
  });

  it('delete frees both objects once and is idempotent', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    deleteAccumTarget(gl, A);
    deleteAccumTarget(gl, A);
    expect(calls(gl, 'deleteFramebuffer')).toHaveLength(1);
    expect(calls(gl, 'deleteTexture')).toHaveLength(1);
    expect(A.mode).toBe('screen');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/accumTarget.test.js`
Expected: FAIL with `Failed to resolve import "../accumTarget"`.

- [ ] **Step 3: Implement**

Create `src/terminal/collider/accumTarget.js`:

```js
// accumTarget.js — the chamber's RGBA16F accumulator (spec §3).
//
// Why half-float: an RGBA8 target clamps at 255 INSIDE the blend unit, so no
// knee applied afterwards can recover the colour of overlapping ribbons (the
// /art sphere learned this the hard way). The accumulator is cleared every
// frame -- it is not a trail buffer -- so a frame stays a pure function of its
// inputs. Absent EXT_color_buffer_float, or if the attachment is incomplete,
// the chamber screen-blends straight into the canvas instead.

export function createAccumTarget(gl, w, h) {
  const screen = { mode: 'screen', fbo: null, tex: null, w, h };
  if (!gl.getExtension('EXT_color_buffer_float')) return screen;

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (!complete) {
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(tex);
    return screen;
  }
  return { mode: 'half-float', fbo, tex, w, h };
}

// Resize path only (the ResizeObserver) -- never per frame.
export function resizeAccumTarget(gl, A, w, h) {
  if (A.mode !== 'half-float' || (A.w === w && A.h === h)) return A;
  gl.bindTexture(gl.TEXTURE_2D, A.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  A.w = w;
  A.h = h;
  return A;
}

export function deleteAccumTarget(gl, A) {
  if (A.fbo) gl.deleteFramebuffer(A.fbo);
  if (A.tex) gl.deleteTexture(A.tex);
  A.fbo = null;
  A.tex = null;
  A.mode = 'screen';
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/accumTarget.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Mutation check**

Delete the line `if (!complete) { ... }` block's `return screen;`. The incomplete-framebuffer test must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/accumTarget.js src/terminal/collider/__tests__/accumTarget.test.js
git commit -m "feat(collider): half-float accumulator with screen-blend fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ribbon primitive and streak shader, plus a real-GPU compile check

**Files:**
- Create: `src/terminal/collider/glsl.js`
- Create: `src/terminal/collider/ribbonShader.js`
- Create: `src/terminal/collider/streakShader.js`
- Create: `scripts/_scentShaders.mjs`
- Test: `src/terminal/collider/__tests__/shaderContracts.test.js` (new; the old `shaderContract.test.js` stays until Task 8)

**Interfaces:**
- Consumes: `ACCELERATE_MS`, `GEOMETRY`, `GAINS`, `TIMELINE` from Task 4.
- Produces:
  - `glsl.js`:
    - `glslFloat(v) -> string`, which always has a decimal point or an exponent and throws on non-finite input.
    - `glslFloatArray(arr) -> 'float[N](…)'`.
    - The GLSL chunks `GLSL_HUE2RGB` (defines `vec3 hue2rgb(float h)`) and `GLSL_HASH` (defines `float hashI(uint x, uint salt)`).
  - `ribbonShader.js`:
    - `RIBBON_VS_CHUNK` declares the outs `vLocal, vLen, vHalfW, vGain, vTailA, vGap, vCol, vAlpha`, and `vec4 ribbonCorner(vec2 tail, vec2 head, float halfW, vec2 res, float px)`.
    - `RIBBON_FS` is a full fragment shader, and declares `uniform float uPx;`.
  - `streakShader.js`:
    - `STREAK_VS`.
    - `STREAK_UNIFORMS = ['uRes','uPx','uPhase','uPhaseT','uHue','uMass','uAccel','uLocus','uNeedleA','uBeams']`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/shaderContracts.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STREAK_VS, STREAK_UNIFORMS } from '../streakShader';
import { RIBBON_FS } from '../ribbonShader';
import { glslFloat, glslFloatArray } from '../glsl';

// Pulls every `uniform <type> <name>` declaration out of a GLSL source,
// dropping any `[n]` array suffix.
function declaredUniforms(src) {
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(\[\d+\])?\s*;/gm)].map((m) => m[1]);
}

const PROGRAMS = [
  ['streak', STREAK_VS, RIBBON_FS, STREAK_UNIFORMS],
];

describe.each(PROGRAMS)('%s program', (name, vs, fs, contract) => {
  it('starts both stages with #version 300 es', () => {
    expect(vs.startsWith('#version 300 es\n')).toBe(true);
    expect(fs.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the chamber harvests', () => {
    const declared = new Set([...declaredUniforms(vs), ...declaredUniforms(fs)]);
    expect([...declared].sort()).toEqual([...contract].sort());
  });

  it('binds its attribute at location 0', () => {
    expect(vs).toMatch(/layout\s*\(\s*location\s*=\s*0\s*\)\s+in\s/);
  });

  it('writes a declared out, never gl_FragColor', () => {
    expect(fs).not.toContain('gl_FragColor');
    expect(fs).toMatch(/^\s*out\s+vec4\s+\w+\s*;/m);
  });

  it('never uses gl_PointSize — the chamber has no points', () => {
    expect(vs).not.toContain('gl_PointSize');
  });

  it('interpolated every constant', () => {
    for (const s of [vs, fs]) expect(s).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe('glslFloat', () => {
  it('always emits a float literal', () => {
    expect(glslFloat(2)).toBe('2.0');
    expect(glslFloat(-1)).toBe('-1.0');
    expect(glslFloat(0.06)).toBe('0.06');
    expect(glslFloat(1e-7)).toBe('1e-7');
  });
  it('refuses non-finite values, so a missing constant fails at import', () => {
    expect(() => glslFloat(NaN)).toThrow();
    expect(() => glslFloat(undefined)).toThrow();
  });
  it('builds a GLSL float array constructor', () => {
    expect(glslFloatArray([0.22, 1])).toBe('float[2](0.22, 1.0)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/shaderContracts.test.js`
Expected: FAIL with `Failed to resolve import "../streakShader"`.

- [ ] **Step 3: Implement `glsl.js`**

Create `src/terminal/collider/glsl.js`:

```js
// glsl.js — shared GLSL for the stereochemical chamber's programs.
// Node-importable: no DOM, no import.meta.env.

export function glslFloat(v) {
  if (!Number.isFinite(v)) throw new TypeError(`glslFloat: not a finite number: ${v}`);
  const s = String(v);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}

export const glslFloatArray = (arr) => `float[${arr.length}](${arr.map(glslFloat).join(', ')})`;

export const GLSL_HUE2RGB = `
vec3 hue2rgb(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}
`;

// Every per-instance random dimension beyond the 4-float seed comes from
// here. NEVER derive a second spatial degree of freedom as fract(h * k) of a
// seed component -- it is still a function of that component and collapses
// the population onto a 1-D locus (trap 2, 2026-07-30).
export const GLSL_HASH = `
float hashI(uint x, uint salt) {
  x ^= salt * 0x9e3779b9u;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return float(x) * (1.0 / 4294967296.0);
}
`;
```

- [ ] **Step 4: Implement `ribbonShader.js`**

Create `src/terminal/collider/ribbonShader.js`:

```js
// ribbonShader.js — the chamber's one primitive (spec §4).
//
// Every piece of matter is a screen-space segment tail -> head, expanded in
// the vertex shader into a capsule one device px wider than it needs to be on
// every side, and resolved in the fragment shader by analytic distance. Widths
// are authored in CSS px and converted with uPx (device px per CSS px); a
// ribbon narrower than one device px keeps a one-device-px coverage footprint
// and dims by the ratio instead of breaking into beads.

export const RIBBON_VS_CHUNK = `
out vec2  vLocal;   // x along the segment from the tail, y across it (CSS px)
out float vLen;     // segment length (CSS px)
out float vHalfW;   // coverage half-width (CSS px), never below half a device px
out float vGain;    // true half-width / coverage half-width
out float vTailA;   // alpha at the tail end (1 = no taper)
out float vGap;     // 0..1 of the segment removed from the middle (bond failure)
out vec3  vCol;
out float vAlpha;

// Four vertices per instance, TRIANGLE_STRIP: 0 tail/-, 1 head/-, 2 tail/+, 3 head/+.
vec4 ribbonCorner(vec2 tail, vec2 head, float halfW, vec2 res, float px) {
  vec2 d = head - tail;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hw = max(halfW, 0.5 / px);
  float margin = hw + 1.0 / px;
  float along = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  float cap = along * 2.0 - 1.0;
  vec2 p = mix(tail, head, along) + dir * cap * margin + nrm * side * margin;
  vLocal = vec2(along * len + cap * margin, side * margin);
  vLen = len;
  vHalfW = hw;
  vGain = halfW / hw;
  return vec4((p / res) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const RIBBON_FS = `#version 300 es
precision highp float;

in vec2  vLocal;
in float vLen;
in float vHalfW;
in float vGain;
in float vTailA;
in float vGap;
in vec3  vCol;
in float vAlpha;
out vec4 fragColor;

uniform float uPx;

void main() {
  float x = vLocal.x;
  float dx = max(max(-x, x - vLen), 0.0);
  float dist = length(vec2(dx, vLocal.y));
  float cov = clamp((vHalfW - dist) * uPx + 0.5, 0.0, 1.0);
  float u = vLen > 1e-4 ? clamp(x / vLen, 0.0, 1.0) : 1.0;
  float taper = mix(vTailA, 1.0, u);
  float gap = step(1e-4, vGap) * step(abs(u - 0.5), 0.5 * vGap);
  float a = cov * taper * vGain * vAlpha * (1.0 - gap);
  vec3 c = vCol * a;
  // Alpha = max channel: the premultiplied value the screen-blend fallback
  // needs. The half-float path writes colour with blendFuncSeparate(.., ZERO,
  // ONE), so this alpha never reaches the accumulator's shadow channel.
  fragColor = vec4(c, max(c.r, max(c.g, c.b)));
}
`;
```

- [ ] **Step 5: Implement `streakShader.js`**

Create `src/terminal/collider/streakShader.js`:

```js
// streakShader.js — 4096 instanced ribbons: idle drift, the ingress pinch,
// and the needle evaporation (spec §4.2, §5, §6.3).
//
// Stateless: every ribbon is a closed-form function of its seed, the uniforms
// and uPhaseT. Nothing is stored between frames.

import { ACCELERATE_MS, GEOMETRY, GAINS, TIMELINE } from './colliderPhases.js';
import { glslFloat as f, GLSL_HUE2RGB, GLSL_HASH } from './glsl.js';
import { RIBBON_VS_CHUNK } from './ribbonShader.js';

export const STREAK_UNIFORMS = [
  'uRes', 'uPx', 'uPhase', 'uPhaseT', 'uHue', 'uMass', 'uAccel', 'uLocus', 'uNeedleA', 'uBeams',
];

export const STREAK_VS = `#version 300 es
layout(location = 0) in vec4 aSeed; // lane[-1,1), birth, h1, h2

uniform vec2  uRes;       // canvas size, CSS px
uniform float uPx;        // device px per CSS px
uniform float uPhase;     // PHASE_ID
uniform float uPhaseT;    // seconds in phase
uniform vec2  uHue;       // hueA, hueB in [0,1)
uniform vec2  uMass;      // massA, massB in [0,1]
uniform vec2  uAccel;     // progress, ease
uniform vec2  uLocus;     // impact offset from centre, CSS px
uniform float uNeedleA;   // needle envelope (0 from 1200ms)
uniform vec4  uBeams[16]; // angle(rad), mag[0,1], hue[0,1), unused
${RIBBON_VS_CHUNK}
${GLSL_HUE2RGB}
${GLSL_HASH}
const float TAU       = 6.28318530718;
const float ACCEL_S   = ${f(ACCELERATE_MS / 1000)};
const float W_WALL    = ${f(GEOMETRY.W_WALL)};
const float KAPPA_LO  = ${f(GEOMETRY.KAPPA_LO)};
const float KAPPA_HI  = ${f(GEOMETRY.KAPPA_HI)};
const float A_TURB    = ${f(GEOMETRY.A_TURB)};
const float V1        = ${f(GEOMETRY.V1)};
const float TAIL_S    = ${f(GEOMETRY.INGRESS_TAIL_S)};
const float CAGE_R    = ${f(GEOMETRY.CAGE_R_PX)};
const float N_SHARE   = ${f(GEOMETRY.NEEDLE_SHARE)};
const float N_DRAG    = ${f(GEOMETRY.NEEDLE_DRAG)};
const float N_TAIL_S  = ${f(GEOMETRY.NEEDLE_TAIL_S)};
const float N_FROM_S  = ${f(TIMELINE.NEEDLE_LAUNCH_FROM_MS / 1000)};
const float N_SPAN_S  = ${f(TIMELINE.NEEDLE_LAUNCH_SPAN_MS / 1000)};
const float G_INGRESS = ${f(GAINS.INGRESS)};
const float G_NEEDLE  = ${f(GAINS.NEEDLE)};

// Curl of a cheap 2-octave sine field: divergence-free, so it swirls.
vec2 curl(vec2 p) {
  float e = 0.35;
  float n0 = sin(p.x * 1.7 + p.y * 2.3) + 0.5 * sin(p.x * 3.9 - p.y * 1.1);
  float nx = sin((p.x + e) * 1.7 + p.y * 2.3) + 0.5 * sin((p.x + e) * 3.9 - p.y * 1.1);
  float ny = sin(p.x * 1.7 + (p.y + e) * 2.3) + 0.5 * sin(p.x * 3.9 - (p.y + e) * 1.1);
  return vec2(ny - n0, -(nx - n0)) / e;
}

// ∫0^t (t'/T)^3 dt', slope 1 past T. Mirrors easeIntegralS() in
// colliderPhases.js, which the tests pin. Position is the integral of speed;
// the legacy fract(birth + t * speed(t)) arrived ~3x too fast.
float easeIntegral(float t) {
  if (t <= 0.0) return 0.0;
  if (t <= ACCEL_S) { float p = t / ACCEL_S; return ACCEL_S * p * p * p * p * 0.25; }
  return ACCEL_S * 0.25 + (t - ACCEL_S);
}

// A point on one side's beam at travel s (0 wall .. 1 core). The envelope
// W(s) = W_WALL * exp(-kappa s) pinches toward the core and sharpens with
// ease; turbulence lives at the wall and dies toward the core (spec §5.3).
vec2 beamPoint(float s, float side, float lane, float strand, float m, float ease, float t, out float bright) {
  vec2 c = uRes * 0.5;
  float x = side < 0.0 ? mix(0.0, c.x, s) : mix(uRes.x, c.x, s);
  float W = W_WALL * exp(-mix(KAPPA_LO, KAPPA_HI, ease) * s);
  // heavy: one coherent ribbon fluttering ~2.5 times over the whole travel
  float flutter = 0.6 * sin(TAU * 2.5 * s - t * 2.0 + side * 1.3);
  // volatile: three strands, a helix seen side-on, 12-18 cycles
  float ph = TAU * mix(18.0, 12.0, m) * s + strand * (TAU / 3.0) - t * 6.0;
  float braid = 0.35 * cos(ph);
  bright = mix(0.6 + 0.4 * sin(ph), 1.0, m);
  float off = W * (mix(0.25, 0.6, m) * lane + mix(braid, flutter, m));
  float fall = (1.0 - s) * (1.0 - s) * (1.0 - ease);
  vec2 turb = curl(vec2(x * 0.012, (c.y + lane * 20.0) * 0.05) + t * 0.35) * (A_TURB * fall);
  return vec2(x + turb.x, c.y + off + turb.y);
}

void main() {
  float lane  = aSeed.x;
  float birth = aSeed.y;
  float h1    = aSeed.z;
  float h2    = aSeed.w;
  float side  = h2 < 0.5 ? -1.0 : 1.0;
  uint  id    = uint(gl_InstanceID);
  vec2  c     = uRes * 0.5;
  vec2  head  = c;
  vec2  tail  = c;
  float halfW = 0.5;
  float alpha = 0.0;
  float tailA = 0.0;
  vec3  col   = hue2rgb(side < 0.0 ? uHue.x : uHue.y);

  if (uPhase <= 1.0) {
    // idle / selecting: the July ambient drift, now as short faint streaks
    float s = fract(birth + uPhaseT * 0.06);
    float st = max(s - 0.015, 0.0);
    float y = c.y + lane * 12.0 + sin(uPhaseT * 0.7 + h1 * TAU) * 3.0;
    head = vec2(uRes.x * s, y);
    tail = vec2(uRes.x * st, y);
    alpha = step(0.94, h1) * 0.35;
    halfW = 0.5;

  } else if (uPhase == 2.0) {
    // accelerating: the pinch
    float t = uPhaseT;
    float ease = uAccel.y;
    float m = side < 0.0 ? uMass.x : uMass.y;
    float strand = floor(hashI(id, 1u) * 3.0);
    float v0 = 0.35 + 0.45 * h1;
    float ph = birth + v0 * t + V1 * easeIntegral(t);
    float tt = t - TAIL_S;
    float phT = birth + v0 * tt + V1 * easeIntegral(tt);
    float s = fract(ph);
    float st = max(s - (ph - phT), 0.0);   // same lap as the head; clamps at the wall
    float bH;
    float bT;
    head = beamPoint(s, side, lane, strand, m, ease, t, bH);
    tail = beamPoint(st, side, lane, strand, m, ease, tt, bT);
    // Ingress/egress ramps: no pop-in at the wall, no pop-out at the core.
    alpha = smoothstep(0.0, 0.03, s) * smoothstep(1.0, 0.97, s) * (0.35 + 0.65 * ease) * bH * G_INGRESS;
    halfW = mix(0.35, 0.7, m);
    tailA = 0.15;

  } else if (uPhase == 3.0) {
    // colliding: needles. The partition is fixed by hash; the envelope gates
    // alpha, never the branch (trap 3, 2026-07-30).
    float isNeedle = step(hashI(id, 2u), N_SHARE);
    int k = min(int(hashI(id, 3u) * 16.0), 15);
    vec4 B = uBeams[k];
    float mBar = 0.5 * (uMass.x + uMass.y);
    float alive = step(hashI(id, 4u), B.y * mix(1.0, 0.35, mBar));
    float ang = B.x + (hashI(id, 5u) - 0.5) * (TAU / 16.0);
    float launch = N_FROM_S + N_SPAN_S * hashI(id, 6u);
    float v0 = (600.0 + 800.0 * hashI(id, 7u)) * mix(1.0, 0.6, mBar);
    float tauE = 0.06 + 0.08 * hashI(id, 8u);
    float age = uPhaseT - launch;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 origin = c + uLocus + dir * CAGE_R;
    float rH = (v0 / N_DRAG) * (1.0 - exp(-N_DRAG * max(age, 0.0)));
    float rT = (v0 / N_DRAG) * (1.0 - exp(-N_DRAG * max(age - N_TAIL_S, 0.0)));
    head = origin + dir * rH;
    tail = origin + dir * rT;
    alpha = isNeedle * alive * step(0.0, age) * exp(-max(age, 0.0) / tauE) * uNeedleA * G_NEEDLE;
    halfW = 0.3;
    col = hue2rgb(B.z);
  }

  if (alpha <= 0.0) {
    // All four corners outside clip space: the instance rasterises nothing.
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  gl_Position = ribbonCorner(tail, head, halfW, uRes, uPx);
  vCol = col;
  vAlpha = alpha;
  vTailA = tailA;
  vGap = 0.0;
}
`;
```

- [ ] **Step 6: Run the contract tests**

Run: `npx vitest run src/terminal/collider/__tests__/shaderContracts.test.js`
Expected: PASS.

- [ ] **Step 7: Write the real-GPU compile check**

Create `scripts/_scentShaders.mjs`:

```js
// Compiles and links every /SCENT chamber program in real headless Chrome
// (SwiftShader). jsdom has no GL, so this is the only place a GLSL typo shows
// up before the browser. Programs whose module does not exist yet are skipped.
//
//   node scripts/_scentShaders.mjs
import { launch } from './cdp.mjs';

const SOURCES = [
  ['field', ['../src/terminal/collider/fieldShader.js'], (m) => [m.FIELD_VS, m.FIELD_FS]],
  ['streak', ['../src/terminal/collider/streakShader.js', '../src/terminal/collider/ribbonShader.js'],
    (m, r) => [m.STREAK_VS, r.RIBBON_FS]],
  ['cage', ['../src/terminal/collider/cageShader.js', '../src/terminal/collider/ribbonShader.js'],
    (m, r) => [m.CAGE_VS, r.RIBBON_FS]],
  ['composite', ['../src/terminal/collider/compositeShader.js'], (m) => [m.COMPOSITE_VS, m.COMPOSITE_FS]],
];

const programs = {};
const skipped = [];
for (const [name, paths, pick] of SOURCES) {
  try {
    const mods = [];
    for (const p of paths) mods.push(await import(new URL(p, import.meta.url)));
    programs[name] = pick(...mods);
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') skipped.push(name);
    else throw e;
  }
}

const page = await launch({ url: 'about:blank', width: 320, height: 240 });
let failed = false;
try {
  const result = await page.eval(`(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { __error: 'no webgl2 context' };
    const P = ${JSON.stringify(programs)};
    const out = { __extColorBufferFloat: !!gl.getExtension('EXT_color_buffer_float') };
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return { s, ok: gl.getShaderParameter(s, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(s) };
    };
    for (const [name, [vs, fs]] of Object.entries(P)) {
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      const p = gl.createProgram(); gl.attachShader(p, v.s); gl.attachShader(p, f.s); gl.linkProgram(p);
      const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
      out[name] = { ok: v.ok && f.ok && linked, vs: v.log, fs: f.log, link: gl.getProgramInfoLog(p) };
    }
    return out;
  })()`);
  console.log(JSON.stringify(result, null, 2));
  if (skipped.length) console.log('skipped (module not written yet):', skipped.join(', '));
  failed = !!result.__error || Object.entries(result).some(([k, r]) => !k.startsWith('__') && !r.ok);
} finally {
  await page.close();
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 8: Run the compile check**

Run: `node scripts/_scentShaders.mjs`
Expected: exit 0. The JSON shows `"streak": { "ok": true, ... }` and `"field": { "ok": true, ... }` (the legacy field shader still compiles). `cage` and `composite` are listed as skipped. If `streak` is not ok, fix the GLSL using the printed info log and rerun until it is.

- [ ] **Step 9: Mutation check**

In `STREAK_UNIFORMS`, delete `'uNeedleA'`. The contract test "declares exactly the uniforms" must FAIL. Revert.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/collider/glsl.js src/terminal/collider/ribbonShader.js src/terminal/collider/streakShader.js src/terminal/collider/__tests__/shaderContracts.test.js scripts/_scentShaders.mjs
git commit -m "feat(collider): ribbon primitive and pinched streak shader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cage and composite shaders

**Files:**
- Create: `src/terminal/collider/cageShader.js`
- Create: `src/terminal/collider/compositeShader.js`
- Modify: `src/terminal/collider/__tests__/shaderContracts.test.js`

**Interfaces:**
- Consumes:
  - `GEOMETRY`, `GAINS`, `TIMELINE`, `MODES`, `KNEE` (Task 4)
  - `glslFloat`, `GLSL_HUE2RGB`, `GLSL_HASH` (Task 6)
  - `RIBBON_VS_CHUNK`, `RIBBON_FS` (Task 6)
  - `CAGE_VERTEX_COUNT` (Task 3)
- Produces:
  - `CAGE_VS` and `CAGE_UNIFORMS = ['uRes','uPx','uLocus','uCageT','uCageA','uSquash','uModeF','uSpin','uHue3','uRest']`. The attribute is `vec3 aBond` = `(i, j, kind)`, at location 0.
  - `COMPOSITE_VS`, `COMPOSITE_FS` and `COMPOSITE_UNIFORMS = ['uAccum']`. The attribute is `vec2 aQuad`, at location 0, which glHost's quad VAO provides.

- [ ] **Step 1: Extend the contract table (failing)**

In `src/terminal/collider/__tests__/shaderContracts.test.js`, add these imports under the existing ones:

```js
import { CAGE_VS, CAGE_UNIFORMS } from '../cageShader';
import { COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../compositeShader';
import { KNEE } from '../colliderPhases';
```

Replace the `PROGRAMS` table with:

```js
const PROGRAMS = [
  ['streak', STREAK_VS, RIBBON_FS, STREAK_UNIFORMS],
  ['cage', CAGE_VS, RIBBON_FS, CAGE_UNIFORMS],
  ['composite', COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS],
];
```

Append at the end of the file:

```js
describe('composite knee', () => {
  it('uses the tested knee constant', () => {
    expect(COMPOSITE_FS).toContain(`const float KNEE = ${KNEE}`);
  });
  it('compresses by the max channel, never by luminance', () => {
    expect(COMPOSITE_FS).toMatch(/max\(c\.r,\s*max\(c\.g,\s*c\.b\)\)/);
    expect(COMPOSITE_FS).not.toMatch(/0\.2126|0\.7152|0\.0722/);
  });
});

describe('cage vibration', () => {
  it('moves geometry only: the mode envelope never reaches alpha or colour', () => {
    // env.* are the modal displacements; if any appears on an alpha or vCol
    // line the cage would strobe.
    for (const line of CAGE_VS.split('\n')) {
      if (/alpha\s*=|vCol\s*=|col\s*=/.test(line)) expect(line).not.toMatch(/env\./);
    }
  });
});
```

Run: `npx vitest run src/terminal/collider/__tests__/shaderContracts.test.js`
Expected: FAIL with `Failed to resolve import "../cageShader"`.

- [ ] **Step 2: Implement `cageShader.js`**

Create `src/terminal/collider/cageShader.js`:

```js
// cageShader.js — the stereochemical cage (spec §6.2): 36 bond ribbons and
// 24 vertex discs, one instanced draw. Docks in on an under-damped spring,
// rings down in four modes with benzene's frequency ratios, then each bond
// fails and retracts into its vertices.

import { GEOMETRY, GAINS, TIMELINE, MODES } from './colliderPhases.js';
import { glslFloat as f, GLSL_HUE2RGB, GLSL_HASH } from './glsl.js';
import { RIBBON_VS_CHUNK } from './ribbonShader.js';
import { CAGE_VERTEX_COUNT } from './cageTopology.js';

export const CAGE_UNIFORMS = [
  'uRes', 'uPx', 'uLocus', 'uCageT', 'uCageA', 'uSquash', 'uModeF', 'uSpin', 'uHue3', 'uRest',
];

export const CAGE_VS = `#version 300 es
layout(location = 0) in vec3 aBond; // i, j, kind (0 bond, 1 vertex)

uniform vec2  uRes;
uniform float uPx;
uniform vec2  uLocus;
uniform float uCageT;   // seconds since impact, < 0 = cage inactive
uniform float uCageA;   // vertex fade envelope
uniform float uSquash;  // x-axis pressure squash
uniform vec4  uModeF;   // mode frequencies (Hz), mass-pitched in JS
uniform float uSpin;    // +1 / -1 handedness from the mass asymmetry
uniform vec3  uHue3;    // hueA, hueB, hue-space blend
uniform vec3  uRest[${CAGE_VERTEX_COUNT}];
${RIBBON_VS_CHUNK}
${GLSL_HUE2RGB}
${GLSL_HASH}
const float TAU        = 6.28318530718;
const float DOCK_S     = ${f(TIMELINE.DOCK_MS / 1000)};
const float BREAK_S    = ${f(TIMELINE.BOND_BREAK_FROM_MS / 1000)};
const float BREAK_SPAN = ${f(TIMELINE.BOND_BREAK_SPAN_MS / 1000)};
const float RETRACT_S  = ${f(TIMELINE.BOND_RETRACT_MS / 1000)};
const float CAGE_R     = ${f(GEOMETRY.CAGE_R_PX)};
const float CAM_D      = ${f(GEOMETRY.CAMERA_D)};
const float DOCK_FROM  = ${f(GEOMETRY.DOCK_FROM_PX)};
const float ZETA       = ${f(GEOMETRY.DOCK_ZETA)};
const float OMEGA      = ${f(GEOMETRY.DOCK_OMEGA)};
const float TUMBLE     = ${f(GEOMETRY.TUMBLE_RAD_S)};
const vec4  AMP        = vec4(${MODES.map((m) => f(m.amp)).join(', ')});
const vec4  TAU_D      = vec4(${MODES.map((m) => f(m.tauMs / 1000)).join(', ')});
const float G_BOND     = ${f(GAINS.BOND)};
const float G_VERTEX   = ${f(GAINS.VERTEX)};

// Mirrors dockCurve() in colliderPhases.js, which the tests pin.
float dockCurve(float t) {
  if (t <= 0.0) return 0.0;
  float k = sqrt(1.0 - ZETA * ZETA);
  float e = exp(-ZETA * OMEGA * t);
  return 1.0 - e * (cos(OMEGA * k * t) + (ZETA / k) * sin(OMEGA * k * t));
}

// Four damped modes, summed. x is the collision axis.
vec3 modal(int idx, vec3 r, float t) {
  float on = clamp(t / 0.02, 0.0, 1.0);
  uint u = uint(idx);
  vec3 hd = normalize(vec3(hashI(u, 11u), hashI(u, 12u), hashI(u, 13u)) - 0.5 + 1e-3);
  vec4 env = AMP * exp(-t / TAU_D) * sin(TAU * uModeF * t + vec4(hashI(u, 14u) * TAU, 0.0, 0.0, 0.0)) * on;
  r += hd * env.x;                    // C-H stretch: per vertex
  r += vec3(r.x, -r.y, 0.0) * env.y;  // C=C stretch: quadrupolar
  r *= 1.0 + env.z;                   // ring breathing: radial
  float a = env.w * r.x;              // out-of-plane bend: torsion about the axis
  float ca = cos(a);
  float sa = sin(a);
  r.yz = vec2(ca * r.y - sa * r.z, sa * r.y + ca * r.z);
  return r;
}

vec3 tumble(vec3 r, float t) {
  vec3 k = normalize(vec3(0.0, 1.0, 0.3));
  float a = uSpin * TUMBLE * t;
  float ca = cos(a);
  float sa = sin(a);
  return r * ca + cross(k, r) * sa + k * dot(k, r) * (1.0 - ca);
}

// xy = screen position in CSS px, z = depth in [0,1] (1 = nearest).
vec3 vertexScreen(int idx, float t) {
  vec3 rest = uRest[idx];
  float ti = t - 0.02 * hashI(uint(idx), 15u);   // staggered docking
  vec3 r = modal(idx, rest, max(t - DOCK_S, 0.0));
  r.x *= uSquash;
  r = tumble(r, t);
  vec2 centre = uRes * 0.5 + uLocus;
  vec2 target = centre + r.xy * (CAM_D / (CAM_D - r.z)) * CAGE_R;
  vec2 from = centre + vec2(rest.x < 0.0 ? -DOCK_FROM : DOCK_FROM, 0.0);
  return vec3(mix(from, target, dockCurve(ti)), clamp(r.z * 0.5 + 0.5, 0.0, 1.0));
}

float arrival(int idx, float t) {
  return smoothstep(0.04, 0.09, t - 0.02 * hashI(uint(idx), 15u));
}

void main() {
  if (uCageT < 0.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float t = uCageT;
  int i = int(aBond.x + 0.5);
  int j = int(aBond.y + 0.5);
  bool isVertex = aBond.z > 0.5;
  vec3 A = vertexScreen(i, t);
  vec3 B = isVertex ? A : vertexScreen(j, t);
  bool leftI = uRest[i].x < 0.0;
  bool leftJ = uRest[j].x < 0.0;
  vec3 col = leftI == leftJ ? hue2rgb(leftI ? uHue3.x : uHue3.y) : hue2rgb(uHue3.z);
  float depth = 0.5 * (A.z + B.z);
  float depthA = mix(0.35, 1.0, depth);
  float wScale = mix(0.7, 1.2, depth);
  float halfW;
  float alpha;
  float gap = 0.0;
  if (isVertex) {
    halfW = 1.2 * wScale;
    alpha = arrival(i, t) * uCageA * depthA * G_VERTEX;
    col = mix(col, vec3(1.0), 0.35);
  } else {
    float breakT = BREAK_S + BREAK_SPAN * hashI(uint(gl_InstanceID), 21u);
    float retract = clamp((t - breakT) / RETRACT_S, 0.0, 1.0);
    halfW = 0.5 * wScale;
    alpha = min(arrival(i, t), arrival(j, t)) * depthA * G_BOND * (1.0 - step(1.0, retract));
    gap = retract;
  }
  if (alpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  gl_Position = ribbonCorner(A.xy, B.xy, halfW, uRes, uPx);
  vCol = col;
  vAlpha = alpha;
  vTailA = 1.0;
  vGap = gap;
}
`;
```

- [ ] **Step 3: Implement `compositeShader.js`**

Create `src/terminal/collider/compositeShader.js`:

```js
// compositeShader.js — resolves the half-float accumulator into the canvas
// (spec §3.2). Max-channel Reinhard knee: identity below KNEE, asymptote 1,
// hue preserved because every channel is scaled by the same factor. accum.a
// carries only the Schlieren shadow coverage, which darkens the page's
// existing bg-black/60 along a hairline.

import { KNEE } from './colliderPhases.js';
import { glslFloat as f } from './glsl.js';

export const COMPOSITE_UNIFORMS = ['uAccum'];

export const COMPOSITE_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uAccum;

const float KNEE = ${f(KNEE)};

float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 acc = texture(uAccum, vUv);
  vec3 c = max(acc.rgb, vec3(0.0));
  float m = max(c.r, max(c.g, c.b));
  if (m > KNEE) {
    float t = m - KNEE;
    float s = 1.0 - KNEE;
    c *= (KNEE + s * t / (t + s)) / m;
  }
  // Dither only where there is light, so empty chamber stays exactly 0.
  c = max(c + step(1e-5, m) * (dither(gl_FragCoord.xy) - 0.5) / 255.0, vec3(0.0));
  float cov = clamp(acc.a, 0.0, 1.0);
  // Premultiplied: alpha must be >= every channel.
  fragColor = vec4(c, clamp(max(max(c.r, max(c.g, c.b)), cov), 0.0, 1.0));
}
`;
```

- [ ] **Step 4: Run the contract tests**

Run: `npx vitest run src/terminal/collider/__tests__/shaderContracts.test.js`
Expected: PASS for the streak, cage and composite rows, the knee test and the vibration test.

Note: `KNEE` is `0.6`, so `${KNEE}` renders as `0.6`, which is the same text `glslFloat(0.6)` produces.

- [ ] **Step 5: Real-GPU compile check**

Run: `node scripts/_scentShaders.mjs`
Expected: exit 0, and `field`, `streak`, `cage` and `composite` all `"ok": true`. If anything fails, fix it from the info log and rerun.

- [ ] **Step 6: Mutation check**

In `CAGE_VS`, change `alpha = arrival(i, t) * uCageA * depthA * G_VERTEX;` to `alpha = arrival(i, t) * uCageA * depthA * G_VERTEX * (1.0 + env.x);`. The vibration test must FAIL. Revert. (That line would not even compile, since `env` is out of scope there. The contract test catches it textually first, which is the point.)

- [ ] **Step 7: Commit**

```bash
git add src/terminal/collider/cageShader.js src/terminal/collider/compositeShader.js src/terminal/collider/__tests__/shaderContracts.test.js
git commit -m "feat(collider): sodalite cage ringdown and max-channel knee composite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Field shader rewrite and the chamber switch

This is the one atomic swap. It deletes the legacy particle pass and `phaseTiming`, rewrites the field shader and the chamber, and rewrites the chamber's GL tests. The July parity snapshot is removed in the code commit (Step 11), and the new capture lands in its own commit (Step 12).

**Files:**
- Rewrite: `src/terminal/collider/fieldShader.js`
- Rewrite: `src/terminal/collider/ColliderChamber.jsx`
- Modify: `src/terminal/collider/colliderPhases.js` (delete legacy)
- Delete: `src/terminal/collider/particleShader.js`
- Delete: `src/terminal/collider/__tests__/shaderContract.test.js`
- Delete: `src/terminal/collider/__tests__/colliderPhases.test.js`
- Delete: `src/terminal/collider/__tests__/__snapshots__/colliderChamberParity.test.jsx.snap`
- Rewrite: `src/terminal/collider/__tests__/colliderChamberParity.test.jsx`
- Rewrite: `src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx`
- Modify: `src/terminal/collider/__tests__/shaderContracts.test.js` (adds the field row)

**Interfaces:**
- Consumes: everything produced by Tasks 1–7.
- Produces:
  - `ColliderChamber` props: all the existing ones, plus `massA` and `massB` (numbers in [0,1]; anything non-finite becomes `DEFAULT_MASS`).
  - Wrapper attribute `data-chamber-accum="half-float" | "screen"`.
  - `FIELD_UNIFORMS = ['uRes','uPx','uPhase','uPhaseT','uHue','uSel','uLocus','uShock','uGlint','uRingR','uRingA','uRingP','uDirect']`.

- [ ] **Step 1: Rewrite the chamber GL tests (failing)**

Replace the whole of `src/terminal/collider/__tests__/colliderChamberParity.test.jsx` with:

```jsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../gl/__tests__/driveFrames';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

const HALF = ['EXT_color_buffer_float'];
const BEAMS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
  mag: 0.2 + (i % 5) * 0.15,
  hue: (i * 23) % 360,
  lifespanMs: 120 + i * 40,
}));

const props = (over = {}) => ({
  phase: 'idle', hueA: 280, hueB: 120, selA: false, selB: false, massA: 0.2, massB: 0.7,
  beams: null, metrics: null, phaseStartedAt: 0, ...over,
});

function drive(over, frames = 12, extensions = HALF) {
  return driveFrames(
    () => {
      const r = render(<ColliderChamber {...props(over)} />);
      return { unmount: r.unmount, rerender: r.rerender };
    },
    { frames, version: 2, extensions }
  );
}
const names = (lines) => lines.map((l) => l.slice(0, l.indexOf('(')));

describe('ColliderChamber GL traffic', () => {
  it('builds four programs, three buffers and two instanced VAOs at init', () => {
    const n = names(drive({}).init);
    expect(n.filter((x) => x === 'createProgram')).toHaveLength(4); // field, streak, cage, composite
    expect(n.filter((x) => x === 'bufferData')).toHaveLength(3);    // quad, seeds, cage instances
    expect(n.filter((x) => x === 'vertexAttribDivisor')).toHaveLength(2);
  });

  it('allocates a half-float accumulator when the extension exists', () => {
    const { init } = drive({});
    expect(init).toContain('getExtension("EXT_color_buffer_float")');
    expect(init.some((l) => l.startsWith('texImage2D(') && l.includes(`${0x881a}`) && l.includes(`${0x140b}`)))
      .toBe(true);
    expect(names(init)).toContain('createFramebuffer');
  });

  it('falls back to screen blending with no framebuffer when it does not', () => {
    const { init, frames } = drive({ phase: 'accelerating' }, 12, []);
    expect(names(init)).not.toContain('createFramebuffer');
    const blends = frames.filter((l) => l.startsWith('blendFunc'));
    expect(new Set(blends)).toEqual(new Set([`blendFunc(1, ${0x0301})`]));
    expect(frames.some((l) => l.startsWith('bindFramebuffer'))).toBe(false);
  });

  it('half-float frame: field, streaks, cage into the accumulator, then one composite', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 2);
    expect(frames.filter((l) => l.startsWith('drawArrays')).slice(0, 4)).toEqual([
      'drawArrays(5, 0, 4)',
      'drawArraysInstanced(5, 0, 4, 4096)',
      'drawArraysInstanced(5, 0, 4, 60)',
      'drawArrays(5, 0, 4)',
    ]);
  });

  it('colour passes keep accumulator alpha; the composite runs unblended', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 2);
    expect(frames).toContain('blendFuncSeparate(1, 1, 0, 1)');
    const firstDisable = frames.indexOf(`disable(${0x0be2})`);
    const composites = frames.map((l, i) => (l === 'drawArrays(5, 0, 4)' ? i : -1)).filter((i) => i >= 0);
    expect(firstDisable).toBeGreaterThan(-1);
    expect(firstDisable).toBeLessThan(composites[1]); // [0] is the field, [1] the composite
  });

  it('skips the cage draw once the cage window has closed', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: -1000 }, 4);
    expect(frames).not.toContain('drawArraysInstanced(5, 0, 4, 60)');
  });

  it('uploads all 16 beams as one vec4 array', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 4);
    const up = frames.filter((l) => l.startsWith('uniform4fv') && l.includes(':uBeams"'));
    expect(up.length).toBeGreaterThan(0);
    expect(JSON.parse(`[${up[0].slice(up[0].indexOf('[') + 1, up[0].lastIndexOf(']'))}]`)).toHaveLength(64);
  });

  it('renders past COLLIDE_MS without advancing the phase itself', () => {
    // The render loop may READ state and must never write it.
    const { frames } = drive({ phase: 'colliding' }, 200, []);
    const phases = frames
      .filter((l) => l.startsWith('uniform1f(') && l.includes(':uPhase"'))
      .map((l) => Number(l.slice(l.lastIndexOf(',') + 1, l.lastIndexOf(')'))));
    expect(phases.length).toBeGreaterThan(100);
    expect(new Set(phases)).toEqual(new Set([3]));
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(200); // one field pass a frame
  });

  it('frozen GL call log', () => {
    expect(drive({ phase: 'colliding', beams: BEAMS, selA: true, selB: true }, 8)).toMatchSnapshot();
  });

  it('paints a settled frame under reduced motion: rings, no shock', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const rec = installRecordingGL({ version: 2 });
    try {
      render(<ColliderChamber {...props({ phase: 'colliding' })} />);
      const shock = rec.log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uShock'));
      expect(shock.length).toBeGreaterThan(0);
      for (const e of shock) expect(e[3]).toBe(0);
      const rings = rec.log.filter((e) => e[0] === 'uniform3fv' && String(e[1]).endsWith(':uRingA'));
      expect(rings[rings.length - 1][2][0]).toBeGreaterThan(0.3);
    } finally {
      rec.restore();
      vi.unstubAllGlobals();
    }
  });
});
```

Replace the whole of `src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx` with:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

const base = {
  hueA: 280, hueB: 120, selA: true, selB: true, massA: 0.3, massB: 0.6,
  beams: null, metrics: null, phaseStartedAt: 0, labelA: null, labelB: null,
};

describe('ColliderChamber under prefers-reduced-motion', () => {
  let rec;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    rec = installRecordingGL({ version: 2 });
  });
  afterEach(() => { rec.restore(); vi.unstubAllGlobals(); });

  it('paints exactly one static frame and never starts the loop', () => {
    render(<ColliderChamber phase="colliding" {...base} />);
    // Snap at 1300ms: the cage window is closed, so field + streaks only.
    const quads = rec.log.filter((e) => e[0] === 'drawArrays');
    const inst = rec.log.filter((e) => e[0] === 'drawArraysInstanced');
    expect(quads).toHaveLength(1);
    expect(quads[0][1]).toBe(0x0005);
    expect(inst).toHaveLength(1);
    expect(inst[0][4]).toBe(4096);
  });

  it('still shows the phase it was given', () => {
    render(<ColliderChamber phase="colliding" {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.4 }} />);
    const phaseUploads = rec.log.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith('uPhase'));
    expect(phaseUploads.some((e) => e[2] === 3)).toBe(true);
  });

  it('freezes accelerating fully pinched', () => {
    render(<ColliderChamber phase="accelerating" {...base} />);
    const accel = rec.log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uAccel'));
    expect(accel.length).toBeGreaterThan(0);
    expect(accel[accel.length - 1].slice(2)).toEqual([1, 1]);
  });
});
```

In `src/terminal/collider/__tests__/shaderContracts.test.js`, add this import:

```js
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from '../fieldShader';
```

and add this row as the first entry of `PROGRAMS`:

```js
  ['field', FIELD_VS, FIELD_FS, FIELD_UNIFORMS],
```

Run: `npx vitest run src/terminal/collider`
Expected: FAIL. There are four `createProgram` expectations, missing uniforms, and so on.

- [ ] **Step 2: Rewrite `fieldShader.js`**

Replace the whole of `src/terminal/collider/fieldShader.js` with:

```js
// fieldShader.js — pass 1. Everything in the chamber that is not matter,
// drawn analytically over glHost's fullscreen quad (spec §6.1, §6.4, §6.6).
//
// Kept from the July chamber: grid, central zone glow, crosshair, beamlines.
// New: the diamond Fresnel shock, the core glint, and up to three knife-edge
// Schlieren fronts. Removed: circular rings, the full-screen flash, and the
// 16-beam loop (the needles carry that data now).
//
// Hairlines use fwidth(), so every front is exactly one DEVICE px wide
// whatever the anisotropy of its distance field.

import { GEOMETRY, GAINS } from './colliderPhases.js';
import { glslFloat as f, glslFloatArray, GLSL_HUE2RGB } from './glsl.js';

export const FIELD_UNIFORMS = [
  'uRes', 'uPx', 'uPhase', 'uPhaseT', 'uHue', 'uSel', 'uLocus',
  'uShock', 'uGlint', 'uRingR', 'uRingA', 'uRingP', 'uDirect',
];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

export const FIELD_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uPx;
uniform float uPhase;
uniform float uPhaseT;
uniform vec3  uHue;     // hueA, hueB, hue-space blend -- each in [0,1)
uniform vec2  uSel;
uniform vec2  uLocus;   // impact offset from centre, CSS px
uniform vec2  uShock;   // radius fraction, amplitude
uniform float uGlint;
uniform vec3  uRingR;   // radius fraction per front
uniform vec3  uRingA;   // amplitude per front (front 3 already mass-weighted)
uniform vec3  uRingP;   // life progress per front
uniform float uDirect;  // 1 = no accumulator: write the canvas directly
${GLSL_HUE2RGB}
const float SHOCK_R_FRAC = ${f(GEOMETRY.SHOCK_R_FRAC)};
const float SHOCK_ASPECT = ${f(GEOMETRY.SHOCK_ASPECT)};
const float FRINGE_PX    = ${f(GEOMETRY.FRINGE_PX)};
const float GLINT_SIGMA  = ${f(GEOMETRY.GLINT_SIGMA)};
const float RING_ASPECT  = ${f(GEOMETRY.RING_ASPECT)};
const float RING_ROUND   = ${f(GEOMETRY.RING_ROUND)};
const float RING_RK[3]   = ${glslFloatArray(GEOMETRY.RING_RK)};
const float G_SHOCK      = ${f(GAINS.SHOCK)};
const float G_GLINT      = ${f(GAINS.GLINT)};
const float G_RING       = ${f(GAINS.RING)};
const float G_SHADOW     = ${f(GAINS.SHADOW)};

float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Triangle filter one device px wide, centred on s = 0 (s in device px).
float lobe(float s) {
  return max(0.0, 1.0 - abs(s));
}

// Hexagon with inradius r (Inigo Quilez).
float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  vec2 px = vUv * uRes;
  vec2 c  = uRes * 0.5;
  vec2 d  = px - c;
  float r = length(d);
  vec3 col = vec3(0.0);
  float shadow = 0.0;

  // grid
  vec2 g = abs(fract(px / 40.0) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  col += vec3(0.024, 0.714, 0.831) * grid * 0.04;

  // central zone glow
  float zoneR = mix(40.0, 60.0 + 10.0 * sin(uPhaseT * 6.0), step(3.0, uPhase));
  float glow  = exp(-r / max(zoneR, 1.0));
  float pulse = 0.06 + 0.04 * sin(uPhaseT * 1.8);
  col += hue2rgb(mix(uHue.x, uHue.y, 0.5)) * glow * pulse;

  // crosshair
  float chx = (1.0 - smoothstep(0.0, 0.8, abs(d.y))) * (1.0 - smoothstep(18.0, 20.0, abs(d.x)));
  float chy = (1.0 - smoothstep(0.0, 0.8, abs(d.x))) * (1.0 - smoothstep(18.0, 20.0, abs(d.y)));
  col += vec3(0.851, 0.275, 0.937) * (chx + chy) * (0.15 + 0.05 * sin(uPhaseT * 3.0));

  // beamlines
  float onAxis = 1.0 - smoothstep(0.0, 1.2, abs(d.y));
  float bAlpha = uPhase == 2.0 ? 0.30 + 0.15 * sin(uPhaseT * 9.0) : 0.12;
  col += hue2rgb(uHue.x) * uSel.x * onAxis * bAlpha * step(px.x, c.x - 100.0);
  col += hue2rgb(uHue.y) * uSel.y * onAxis * bAlpha * step(c.x + 100.0, px.x);

  vec2 q = px - (c + uLocus);

  // diamond Fresnel shock: front + three fringes at sqrt(n) spacing
  if (uShock.y > 0.0) {
    float R   = uShock.x * SHOCK_R_FRAC * uRes.x;
    float rho = abs(q.x) + SHOCK_ASPECT * abs(q.y);
    float fw  = max(fwidth(rho), 1e-4);
    float lit = lobe((rho - R) / fw);
    for (int n = 1; n <= 3; n++) {
      float Rn = R - FRINGE_PX * sqrt(float(n));
      if (Rn > 0.0) lit += (0.5 / float(n)) * lobe((rho - Rn) / fw);
    }
    col += mix(vec3(1.0), hue2rgb(uHue.z), 0.35) * lit * uShock.y * G_SHOCK;
  }

  // core glint (<= 40ms)
  col += mix(vec3(1.0), hue2rgb(uHue.z), 0.25)
       * exp(-dot(q, q) / (2.0 * GLINT_SIGMA * GLINT_SIGMA)) * uGlint * G_GLINT;

  // Schlieren fronts: rounded hexagon relaxing to an ellipse; bright outer
  // lobe with per-channel dispersion, shadow inner lobe into coverage.
  vec3 tint = mix(vec3(1.0), hue2rgb(uHue.z), 0.5);
  vec2 e = vec2(q.x, q.y * RING_ASPECT);
  for (int k = 0; k < 3; k++) {
    float A = uRingA[k];
    if (A <= 0.0) continue;
    float R = uRingR[k] * RING_RK[k] * uRes.x;
    float rr = RING_ROUND * R;
    float dHex = sdHexagon(e, R - rr) - rr;
    float dEll = length(e) - R;
    float dd = mix(dHex, dEll, smoothstep(0.0, 0.6, uRingP[k]));
    float s = dd / max(fwidth(dd), 1e-4);   // signed device px, + outside
    float disp = mix(0.5, 1.5, uRingP[k]);
    col += vec3(lobe(s - 0.75 - disp) * tint.r,
                lobe(s - 0.75) * tint.g,
                lobe(s - 0.75 + disp) * tint.b) * A * G_RING;
    shadow += lobe(s + 0.75) * A * G_SHADOW;
  }

  if (uDirect > 0.5) {
    // Screen-blend fallback: no composite runs, so dither here and emit
    // premultiplied alpha = max channel. No shadow lobes on this path.
    col = max(col + (dither(px) - 0.5) / 255.0, vec3(0.0));
    fragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
  } else {
    // Accumulator: rgb is light, alpha is shadow coverage only.
    fragColor = vec4(col, shadow);
  }
}
`;
```

- [ ] **Step 3: Rewrite `ColliderChamber.jsx`**

Replace the whole of `src/terminal/collider/ColliderChamber.jsx` with:

```jsx
// ColliderChamber.jsx — the WebGL stereochemical collision chamber.
//
// Four programs into one canvas (spec 2026-09-24):
//   field     — glHost's fullscreen quad: grid, zone, crosshair, beamlines,
//               the diamond shock, the glint, the Schlieren fronts
//   streak    — 4096 instanced ribbons: idle drift, ingress pinch, needles
//   cage      — 60 instanced ribbons: the truncated-octahedron cage
//   composite — max-channel knee out of the half-float accumulator
// With EXT_color_buffer_float the first three add into an RGBA16F target and
// the composite resolves it; without, they screen-blend straight into the
// canvas and the composite is skipped (spec §3.3).
//
// This component RENDERS. It does not own the phase graph and it never writes
// state from draw() -- the parent decides when colliding becomes result, so
// the chamber stays correct when the loop never runs (reduced motion, a
// suspended-rAF preview pane).

import React, { useRef, useState, useEffect } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { buildProgram } from '../gl/glHost';
import { buildParticleSeeds, PARTICLE_COUNT } from './particleSeeds';
import {
  PHASE_ID, MODES, GEOMETRY,
  createTiming, timingInto, modeFrequency, ringThreeWeight, mixHue01, snapMsFor,
} from './colliderPhases.js';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './fieldShader.js';
import { STREAK_VS, STREAK_UNIFORMS } from './streakShader.js';
import { CAGE_VS, CAGE_UNIFORMS } from './cageShader.js';
import { RIBBON_FS } from './ribbonShader.js';
import { COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from './compositeShader.js';
import { buildCageInstances, cageRestFlat, CAGE_INSTANCE_COUNT } from './cageTopology.js';
import { createAccumTarget, resizeAccumTarget, deleteAccumTarget } from './accumTarget.js';
import { DEFAULT_MASS } from './domainMass.js';

const CHAMBER_H = 220;
const CONTEXT_OPTIONS = {
  alpha: true, premultipliedAlpha: true, antialias: false,
  depth: false, stencil: false, powerPreference: 'low-power',
};

const hue01 = (h) => ((((h % 360) + 360) % 360) / 360);
const massOr = (m) => (Number.isFinite(m) ? Math.min(1, Math.max(0, m)) : DEFAULT_MASS);

function harvest(gl, prog, names) {
  const U = {};
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);
  return U;
}

// Everything paintChamber reads. Built once per mount; mutated only by the
// props effect, onInit/onDispose, the resize observer and the scrub hook --
// never allocated per frame.
function createChamberCtx() {
  return {
    props: { phase: 'idle', selA: false, selB: false, phaseStartedAt: null },
    derived: {
      h01a: 0, h01b: 0, hMix: 0,
      massA: DEFAULT_MASS, massB: DEFAULT_MASS, mBar: DEFAULT_MASS,
      locusX: 0, spin: 1, modeF: new Float32Array(4), ring3W: 0,
    },
    timing: createTiming(),
    ringA: new Float32Array(3),
    beamBuf: new Float32Array(64),
    size: { w: 900, h: CHAMBER_H },
    streak: { prog: null, vao: null, buf: null, U: null },
    cage: { prog: null, vao: null, buf: null, U: null },
    comp: { prog: null, U: null },
    accum: { mode: 'screen', fbo: null, tex: null, w: 0, h: 0 },
    scrub: null,
  };
}

// One frame. Module-level and reads only ctx, so the loop, onSnap and the dev
// scrub hook all paint through the same function, which allocates nothing.
function paintChamber(host, elapsedMs, ctx) {
  const { gl, U } = host;
  const p = ctx.props;
  const D = ctx.derived;
  const S = ctx.streak;
  const C = ctx.cage;
  const K = ctx.comp;
  const A = ctx.accum;
  const phase = ctx.scrub ? ctx.scrub.phase : p.phase;
  const ms = ctx.scrub ? ctx.scrub.ms : elapsedMs;
  const T = timingInto(ctx.timing, phase, ms);
  const phaseId = PHASE_ID[phase] ?? 0;
  const phaseT = ms / 1000;
  const { w, h } = ctx.size;
  const px = w > 0 ? gl.canvas.width / w : 1;
  const half = A.mode === 'half-float';

  if (half) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
    gl.viewport(0, 0, A.w, A.h);
  }
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  if (half) gl.blendFunc(gl.ONE, gl.ONE);
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);

  // ── field ──
  gl.useProgram(host.prog);
  gl.bindVertexArray(host.vao);
  gl.uniform2f(U.uRes, w, h);
  gl.uniform1f(U.uPx, px);
  gl.uniform1f(U.uPhase, phaseId);
  gl.uniform1f(U.uPhaseT, phaseT);
  gl.uniform3f(U.uHue, D.h01a, D.h01b, D.hMix);
  gl.uniform2f(U.uSel, p.selA ? 1 : 0, p.selB ? 1 : 0);
  gl.uniform2f(U.uLocus, D.locusX, 0);
  gl.uniform2f(U.uShock, T.shockR, T.shockA);
  gl.uniform1f(U.uGlint, T.glint);
  gl.uniform3fv(U.uRingR, T.ringR);
  const ra = ctx.ringA;
  ra[0] = T.ringA[0];
  ra[1] = T.ringA[1];
  ra[2] = T.ringA[2] * D.ring3W;
  gl.uniform3fv(U.uRingA, ra);
  gl.uniform3fv(U.uRingP, T.ringP);
  gl.uniform1f(U.uDirect, half ? 0 : 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // ── streaks ──
  if (half) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
  gl.useProgram(S.prog);
  gl.bindVertexArray(S.vao);
  gl.uniform2f(S.U.uRes, w, h);
  gl.uniform1f(S.U.uPx, px);
  gl.uniform1f(S.U.uPhase, phaseId);
  gl.uniform1f(S.U.uPhaseT, phaseT);
  gl.uniform2f(S.U.uHue, D.h01a, D.h01b);
  gl.uniform2f(S.U.uMass, D.massA, D.massB);
  gl.uniform2f(S.U.uAccel, T.progress, T.ease);
  gl.uniform2f(S.U.uLocus, D.locusX, 0);
  gl.uniform1f(S.U.uNeedleA, T.needleA);
  gl.uniform4fv(S.U.uBeams, ctx.beamBuf);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PARTICLE_COUNT);

  // ── cage ──
  if (T.cageT >= 0) {
    gl.useProgram(C.prog);
    gl.bindVertexArray(C.vao);
    gl.uniform2f(C.U.uRes, w, h);
    gl.uniform1f(C.U.uPx, px);
    gl.uniform2f(C.U.uLocus, D.locusX, 0);
    gl.uniform1f(C.U.uCageT, T.cageT);
    gl.uniform1f(C.U.uCageA, T.cageA);
    gl.uniform1f(C.U.uSquash, T.squash);
    gl.uniform4fv(C.U.uModeF, D.modeF);
    gl.uniform1f(C.U.uSpin, D.spin);
    gl.uniform3f(C.U.uHue3, D.h01a, D.h01b, D.hMix);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, CAGE_INSTANCE_COUNT);
  }

  // ── composite: knee + shadow coverage into the canvas ──
  if (half) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(K.prog);
    gl.bindVertexArray(host.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(K.U.uAccum, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

export default function ColliderChamber({
  phase, hueA, hueB, selA, selB, massA, massB, beams, metrics, phaseStartedAt, labelA, labelB,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const ctxRef = useRef(null);
  if (ctxRef.current === null) ctxRef.current = createChamberCtx();
  const [supported, setSupported] = useState(true);
  const [accumMode, setAccumMode] = useState(null);

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'straight',      // host enables BLEND; paintChamber sets the funcs per pass
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: ctxRef.current.size.w || 900, h: CHAMBER_H },
    setStyleSize: false,    // the canvas is sized by CSS (absolute inset-0)
    label: 'colliderChamber',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    dtClamp: 0.1,
    seedLast: 'zero',
    initialDraw: false,
    haltOnReducedMotion: true,
    onUnsupported: () => setSupported(false),

    onInit(gl, { canvas }) {
      const ctx = ctxRef.current;

      const sProg = buildProgram(gl, STREAK_VS, RIBBON_FS, { strategy: 'lunar', label: 'colliderStreaks' });
      const sVao = gl.createVertexArray();
      gl.bindVertexArray(sVao);
      const sBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buildParticleSeeds(PARTICLE_COUNT), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 1);
      ctx.streak = { prog: sProg, vao: sVao, buf: sBuf, U: harvest(gl, sProg, STREAK_UNIFORMS) };

      const cProg = buildProgram(gl, CAGE_VS, RIBBON_FS, { strategy: 'lunar', label: 'colliderCage' });
      const cVao = gl.createVertexArray();
      gl.bindVertexArray(cVao);
      const cBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buildCageInstances(), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 1);
      const cU = harvest(gl, cProg, CAGE_UNIFORMS);
      gl.useProgram(cProg);
      gl.uniform3fv(cU.uRest, cageRestFlat()); // constant: uploaded once, kept by the program
      ctx.cage = { prog: cProg, vao: cVao, buf: cBuf, U: cU };

      const kProg = buildProgram(gl, COMPOSITE_VS, COMPOSITE_FS, { strategy: 'lunar', label: 'colliderComposite' });
      ctx.comp = { prog: kProg, U: harvest(gl, kProg, COMPOSITE_UNIFORMS) };

      gl.bindVertexArray(null);
      ctx.accum = createAccumTarget(gl, canvas.width, canvas.height);
      setAccumMode(ctx.accum.mode);
      // No trailing viewport/useProgram restore -- glHost does both
      // immediately after onInit returns for strategy 'lunar'.
    },

    onDispose(gl) {
      const ctx = ctxRef.current;
      for (const P of [ctx.streak, ctx.cage]) {
        if (P.prog) gl.deleteProgram(P.prog);
        if (P.buf) gl.deleteBuffer(P.buf);
        if (P.vao) gl.deleteVertexArray(P.vao);
      }
      if (ctx.comp.prog) gl.deleteProgram(ctx.comp.prog);
      deleteAccumTarget(gl, ctx.accum);
      ctx.streak = { prog: null, vao: null, buf: null, U: null };
      ctx.cage = { prog: null, vao: null, buf: null, U: null };
      ctx.comp = { prog: null, U: null };
    },

    draw(host, { tsec }) {
      const ctx = ctxRef.current;
      const started = ctx.props.phaseStartedAt;
      const elapsed = started == null ? 0 : Math.max(0, tsec * 1000 - started);
      paintChamber(host, elapsed, ctx);
    },

    // Under prefers-reduced-motion the loop never starts, so this is the only
    // frame ever painted: the settled instant for the phase (spec §7).
    onSnap(host) {
      const ctx = ctxRef.current;
      paintChamber(host, snapMsFor(ctx.props.phase), ctx);
    },

    deps: [],
  });

  // Props sync. Declared AFTER useShaderCanvas so the hook has populated its
  // snap ref by the time this first runs. The snap() call is load-bearing:
  // under reduced motion nothing else ever paints.
  useEffect(() => {
    const ctx = ctxRef.current;
    ctx.props = { phase, selA, selB, phaseStartedAt };
    const D = ctx.derived;
    D.h01a = hue01(hueA);
    D.h01b = hue01(hueB);
    D.hMix = mixHue01(D.h01a, D.h01b);
    D.massA = massOr(massA);
    D.massB = massOr(massB);
    D.mBar = 0.5 * (D.massA + D.massB);
    D.locusX = GEOMETRY.LOCUS_PX_PER_MASS * (D.massA - D.massB); // lands toward the lighter beam
    D.spin = D.massA - D.massB < 0 ? -1 : 1;
    for (let k = 0; k < 4; k++) D.modeF[k] = modeFrequency(MODES[k].f0, D.mBar);
    D.ring3W = ringThreeWeight(D.mBar);
    const b = ctx.beamBuf;
    for (let i = 0; i < 16; i++) {
      const s = beams ? beams[i] : null;
      b[i * 4 + 0] = s ? s.angle : 0;
      b[i * 4 + 1] = s ? s.mag : 0;
      b[i * 4 + 2] = s ? hue01(s.hue) : 0;
      b[i * 4 + 3] = 0;
    }
    snap();
  }, [phase, hueA, hueB, selA, selB, massA, massB, beams, phaseStartedAt, snap]);

  // Width is fluid; height is fixed. Resize without rebuilding the programs;
  // the accumulator follows the backing store here and only here.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const ctx = ctxRef.current;
      const w = el.clientWidth;
      if (!w || w === ctx.size.w) return;
      ctx.size = { w, h: CHAMBER_H };
      const host = hostRef.current;
      if (!host) return;
      host.resize(w, CHAMBER_H);
      resizeAccumTarget(host.gl, ctx.accum, host.gl.canvas.width, host.gl.canvas.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full border border-fuchsia-900/30 bg-black/60 rounded-lg overflow-hidden"
      style={{ height: CHAMBER_H, animation: 'sc-borderBreath 8s ease-in-out infinite' }}
      data-chamber-renderer={supported ? 'webgl' : 'fallback'}
      data-chamber-accum={accumMode ?? undefined}
    >
      {supported
        ? <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        : <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-950/40 via-black to-cyan-950/40" />}

      {/* Readouts. These were fillText into the canvas; DOM is crisper and
          WebGL is bad at text. Font family deliberately differs from the old
          `9px monospace` -- that was the browser's generic mono, not the
          project's stack (spec §7). Positions match the old canvas coords. */}
      <div
        data-chamber-overlay
        className="absolute inset-0 pointer-events-none select-none font-mono"
        style={{ fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace" }}
      >
        {selA && labelA && (
          <div className="absolute text-[9px]" style={{ left: 8, top: CHAMBER_H / 2 - 15, color: `hsla(${hueA},80%,70%,0.6)` }}>{labelA}</div>
        )}
        {selB && labelB && (
          <div className="absolute text-[9px]" style={{ right: 8, top: CHAMBER_H / 2 - 15, color: `hsla(${hueB},80%,70%,0.6)` }}>{labelB}</div>
        )}
        {metrics && (
          <>
            <div className="absolute left-0 right-0 text-center text-[8px]" style={{ top: CHAMBER_H / 2 - 70, color: 'rgba(217,70,239,0.6)' }}>
              NOVELTY {(metrics.novelty * 100).toFixed(0)}%
            </div>
            <div className="absolute" style={{ left: '50%', marginLeft: -60, top: CHAMBER_H / 2 - 60, width: 120, height: 4, background: 'rgba(255,255,255,0.1)' }}>
              <div
                data-novelty-fill
                style={{
                  width: `${(metrics.novelty * 100).toFixed(0)}%`,
                  height: '100%',
                  background: 'hsla(280,70%,60%,0.8)',
                  transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
            {/* Canvas fillText positioned by BASELINE; CSS top positions the
                box top, so each of these is the old baseline minus the font's
                ascent (~0.8em). The novelty bar above came from a fillRect,
                which was already a top — hence no adjustment there. The theta
                row is held 4px above its converted value because the original
                drew its baseline at y=221 inside a 220px canvas, clipping its
                own descenders. */}
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 91, color: 'rgba(6,182,212,0.7)' }}>
              cos(θ) = {metrics.cosine.toFixed(4)}
            </div>
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 99, color: 'rgba(6,182,212,0.7)' }}>
              θ = {metrics.angle.toFixed(1)}°
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the legacy code**

In `src/terminal/collider/colliderPhases.js`, delete exactly these declarations, and nothing else:

- the constants `FLASH_MS`, `SHAKE_MS`, `RING1_MS`, `RING2_AT`, `RING2_MS`, `SPARK_MS`, `JET_MS`, `CHIMERA_IN`, `CHIMERA_OUT`, `VAPOR_IN`, `VAPOR_OUT`, `ARM_AT`, `METRICS_MS`;
- the helpers `gate` and `window01`, and the `INERT` object;
- the function `phaseTiming`.

Then update the file's header comment, replacing its second paragraph (the one beginning "Every constant below is an old frame threshold") with:

```js
// ACCELERATE_MS and COLLIDE_MS are the old frame thresholds converted at
// 60fps -- the chamber used to count frames, so a 120Hz display played the
// whole collision at double speed. Everything else in this file is the
// stereochemical collider's timeline (spec 2026-09-24).
```

Delete these files:

```bash
git rm src/terminal/collider/particleShader.js src/terminal/collider/__tests__/shaderContract.test.js src/terminal/collider/__tests__/colliderPhases.test.js src/terminal/collider/__tests__/__snapshots__/colliderChamberParity.test.jsx.snap
```

Verify nothing still references the removed names:

Run: `git grep -nE "phaseTiming|particleShader|PARTICLE_VS|MAX_POINT_SIZE|sparkGate|uBurst|uBeamT|shake" -- src/terminal/collider src/terminal/views/LatentCollider.jsx`
Expected: no output. The grep is scoped on purpose: other tabs legitimately use the word "shake".

- [ ] **Step 5: Run the collider suite**

Run: `npx vitest run src/terminal/collider`
Expected: PASS. The "frozen GL call log" test writes a NEW snapshot file, and vitest reports `1 written`.

- [ ] **Step 6: Run the GL suite and prove the shared snapshots are untouched**

Run: `npx vitest run src/terminal/gl`
Expected: PASS.

Run: `git diff --exit-code main -- src/terminal/gl/__tests__/__snapshots__/ src/terminal/gl/glHost.js src/terminal/gl/frameLoop.js src/terminal/gl/useShaderCanvas.js`
Expected: exit 0, no output.

- [ ] **Step 7: Real-GPU compile check**

Run: `node scripts/_scentShaders.mjs`
Expected: exit 0. All four programs are `"ok": true`, and none are skipped.

- [ ] **Step 8: Zero-allocation check of `paintChamber`**

Run: `git grep -nE "new |\[\]|\{\s*\}|=>|\.map\(|\.slice\(|\.\.\." -- src/terminal/collider/ColliderChamber.jsx`

Expected: none of the matching lines fall between `function paintChamber(` and its closing brace. Check the line numbers against the function's span.

- [ ] **Step 9: Mutation checks**

1. In `paintChamber`, change `if (half) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);` to `if (half) gl.blendFunc(gl.ONE, gl.ONE);`. "colour passes keep accumulator alpha" must FAIL. Revert.
2. Change `if (T.cageT >= 0) {` to `if (true) {`. "skips the cage draw once the cage window has closed" must FAIL. Revert.
3. In `colliderPhases.js`, change `SNAP_MS.colliding` to `100`. "paints a settled frame under reduced motion: rings, no shock" must FAIL. Revert.

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 11: Commit the switch (without the new snapshot)**

```bash
git add src/terminal/collider/fieldShader.js src/terminal/collider/ColliderChamber.jsx src/terminal/collider/colliderPhases.js src/terminal/collider/__tests__/colliderChamberParity.test.jsx src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx src/terminal/collider/__tests__/shaderContracts.test.js
git commit -m "feat(collider): mount the stereochemical chamber, retire the particle puff

Four programs into a half-float accumulator resolved through a max-channel
knee; screen-blend fallback without EXT_color_buffer_float. Rips out the
spark/jet/chimera/vapor populations, circular rings, full-screen flash,
shake plumbing and the field's 16-beam loop. phaseTiming allocated a new
object every frame; its replacement writes into a caller-owned one.
The July parity snapshot is removed here; the new capture is its own commit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Commit the new capture on its own**

Run: `git status --short src/terminal/collider/__tests__/__snapshots__/`
Expected: `?? src/terminal/collider/__tests__/__snapshots__/colliderChamberParity.test.jsx.snap`

```bash
git add src/terminal/collider/__tests__/__snapshots__/colliderChamberParity.test.jsx.snap
git commit -m "test(collider): capture the stereochemical chamber's GL call log

Deliberate re-capture: the chamber's output is entirely new, so the July
snapshot could not match. glParity.test.jsx.snap is byte-identical to main.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Pass mass from LatentCollider

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx` (the imports near line 17, after `DOMAIN_SPHERE_MAP` near line 511, and the `<ColliderChamber` props near line 1623)

**Interfaces:**
- Consumes: `buildDomainMass(nodeIds, nodeIdx, features)` (Task 2), and the `massA` / `massB` props (Task 8).
- Produces: nothing new. `DOMAIN_MASS` is module-private.

- [ ] **Step 1: Add the import**

After `import { usePhaseAdvance } from '../collider/usePhaseAdvance';` add:

```js
import { buildDomainMass } from '../collider/domainMass';
```

- [ ] **Step 2: Build the table once, at module load**

Immediately after the `];` that closes `const DOMAIN_SPHERE_MAP = [` (the line after `/* 80 PL */ { nodeId: 'necromantic', ... },`), add:

```js

// Beam mass per domain id (spec §5.1): weight − volatility of the mapped
// sphere node, rank-normalised across every collider domain. Computed once;
// the chamber reads it at selection time, before collide() resolves.
const DOMAIN_MASS = buildDomainMass(DOMAIN_SPHERE_MAP.map((m) => m.nodeId), NODE_IDX, FEATURES);
```

- [ ] **Step 3: Pass the props**

In the `<ColliderChamber` element, after `selB={domainB !== null}` add:

```jsx
          massA={domainA !== null ? DOMAIN_MASS[domainA] : undefined}
          massB={domainB !== null ? DOMAIN_MASS[domainB] : undefined}
```

- [ ] **Step 4: Verify nothing else in the file changed**

Run: `git diff --stat src/terminal/views/LatentCollider.jsx`
Expected: `1 file changed, 9 insertions(+)` or close to it, with no deletions.

Run: `npx vitest run src/terminal`
Expected: PASS.

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(scent): hand each beam its domain's mass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dev-only scrub hook

**Files:**
- Modify: `src/terminal/collider/ColliderChamber.jsx`
- Test: `src/terminal/collider/__tests__/colliderChamberScrub.test.jsx` (new)

**Interfaces:**
- Consumes: `paintChamber(host, elapsedMs, ctx)` and `ctx.scrub` (Task 8), and `hostRef` from `useShaderCanvas`.
- Produces: in DEV builds only, `window.__scentScrub(phase: string | null, ms: number) -> { phase, ms } | null`. It pins the painted phase and time and paints immediately. Passing `null` releases it. It is removed on unmount.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderChamberScrub.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

describe('ColliderChamber dev scrub hook', () => {
  it('pins phase and elapsed, paints at once, and is removed on unmount', () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      const { unmount } = render(
        <ColliderChamber phase="idle" hueA={280} hueB={120} selA selB massA={0.3} massB={0.6}
          beams={null} metrics={null} phaseStartedAt={0} labelA={null} labelB={null} />
      );
      expect(typeof window.__scentScrub).toBe('function');

      const before = rec.log.length;
      let pinned;
      act(() => { pinned = window.__scentScrub('colliding', 300); });
      expect(pinned).toEqual({ phase: 'colliding', ms: 300 });
      const after = rec.log.slice(before);
      const cageT = after.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uCageT'));
      expect(cageT).toHaveLength(1);
      expect(cageT[0][2]).toBeCloseTo(0.3, 6);
      expect(after.some((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uPhase') && e[2] === 3)).toBe(true);

      act(() => { expect(window.__scentScrub(null)).toBeNull(); });
      unmount();
      expect(window.__scentScrub).toBeUndefined();
    } finally {
      rec.restore();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberScrub.test.jsx`
Expected: FAIL. `expected 'undefined' to be 'function'`.

- [ ] **Step 3: Implement**

In `src/terminal/collider/ColliderChamber.jsx`, add this at module level, directly after the closing brace of `paintChamber`:

```jsx
// Dev-only: pin the painted phase and elapsed time so a contact sheet can be
// shot at exact instants (spec §8). Possible only because every frame is a
// pure function of (phase, ms). `import.meta.env.DEV` is written WITHOUT
// optional chaining so Vite replaces it with a literal and the production
// build folds this to null, taking the whole hook with it.
const installScrub = import.meta.env.DEV
  ? (ctxRef, hostRef) => {
    if (typeof window === 'undefined') return undefined;
    window.__scentScrub = (scrubPhase, ms) => {
      const ctx = ctxRef.current;
      ctx.scrub = scrubPhase == null ? null : { phase: scrubPhase, ms: Number.isFinite(ms) ? ms : 0 };
      const host = hostRef.current;
      if (host) paintChamber(host, 0, ctx);
      return ctx.scrub;
    };
    return () => { delete window.__scentScrub; };
  }
  : null;
```

And add this effect inside the component, directly after the resize-observer effect and before `return (`:

```jsx
  useEffect(() => (installScrub ? installScrub(ctxRef, hostRef) : undefined), [hostRef]);
```

- [ ] **Step 4: Run it to verify it passes, and run the collider suite**

Run: `npx vitest run src/terminal/collider`
Expected: PASS. The parity snapshot is unchanged, because the hook makes no GL calls unless it is invoked.

- [ ] **Step 5: Mutation check**

Delete the line `if (host) paintChamber(host, 0, ctx);`. The `cageT` length assertion must FAIL. Revert.

- [ ] **Step 6: Confirm production strips it**

Run: `npx vite build 2>&1 | tail -3`
Expected: the build succeeds.

Run: `node -e "const fs=require('fs'),p=require('path');let n=0;(function w(d){for(const f of fs.readdirSync(d)){const q=p.join(d,f);fs.statSync(q).isDirectory()?w(q):(/\.js$/.test(f)&&fs.readFileSync(q,'utf8').includes('__scentScrub')&&n++)}})('dist');console.log('files with __scentScrub:',n)"`
Expected: `files with __scentScrub: 0`

- [ ] **Step 7: Lint and commit**

Run: `npm run lint`
Expected: exit 0.

```bash
git add src/terminal/collider/ColliderChamber.jsx src/terminal/collider/__tests__/colliderChamberScrub.test.jsx
git commit -m "feat(collider): dev-only scrub hook for exact-instant contact sheets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Look at it — contact sheets, then the author's eye

No claim about how the collider looks is made before this task's screenshots have been opened and looked at. Proxy metrics don't count.

**Files:**
- Create: `scripts/_scentMass.mjs`
- Create: `scripts/_scentSheet.mjs`

**Interfaces:**
- Consumes: `buildDomainMass` (Task 2), `window.__scentScrub` (Task 10), `data-chamber-renderer` / `data-chamber-accum` (Task 8), and `launch` from `scripts/cdp.mjs`.
- Produces: PNGs in `lookbook/scent/`, which is untracked, like the rest of `lookbook/`.

- [ ] **Step 1: Full suite, lint and compile gate**

Run: `npx vitest run`
Expected: PASS, with 0 failures. Record the file and test counts for the report.

Run: `npm run lint`
Expected: exit 0.

Run: `node scripts/_scentShaders.mjs`
Expected: exit 0, all four programs ok. Note the `__extColorBufferFloat` value, which tells you which path SwiftShader will take.

- [ ] **Step 2: Write the mass printer and pick eye-check pairs**

Create `scripts/_scentMass.mjs`:

```js
// Prints the beam mass of each of the 16 grid domains, computed exactly as
// LatentCollider does (spec §5.1), lightest first. Used to pick the heavy x
// heavy and volatile x volatile eye-check pairs.
//
//   node scripts/_scentMass.mjs
import { readFileSync } from 'node:fs';
import { FEATURES, NODE_IDX } from '../src/terminal/data/nodeFeatures.js';
import { buildDomainMass } from '../src/terminal/collider/domainMass.js';

const src = readFileSync(new URL('../src/terminal/views/LatentCollider.jsx', import.meta.url), 'utf8');
const block = (start) => src.slice(src.indexOf(start), src.indexOf('];', src.indexOf(start)));
const nodeIds = [...block('const DOMAIN_SPHERE_MAP').matchAll(/nodeId: '([^']+)'/g)].map((m) => m[1]);
const domains = [...block('const DOMAINS = [').matchAll(/id: (\d+),\s+name: '([^']+)'/g)]
  .map((m) => ({ id: Number(m[1]), name: m[2] }));
const mass = buildDomainMass(nodeIds, NODE_IDX, FEATURES);
for (const d of domains.sort((a, b) => mass[a.id] - mass[b.id])) {
  console.log(mass[d.id].toFixed(3), d.name);
}
```

Run: `node scripts/_scentMass.mjs`
Expected: 16 lines, lightest first. Write down the two lightest names (the volatile pair) and the two heaviest (the heavy pair).

- [ ] **Step 3: Write the contact-sheet script**

Create `scripts/_scentSheet.mjs`:

```js
// Eight-instant contact sheet of the /SCENT chamber via the dev scrub hook.
// Needs the dev server on :5174.
//
//   node scripts/_scentSheet.mjs <outDir> [dpr] ["Domain A title"] ["Domain B title"]
import { mkdir } from 'node:fs/promises';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] ?? 'lookbook/scent';
const DPR = Number(process.argv[3] ?? 1);
const A = process.argv[4] ?? 'Feigenbaum Universality';
const B = process.argv[5] ?? 'Twisted Bilayer Graphene';
const URL_ = 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = [
  ['1-wall-cloud', 'accelerating', 200],
  ['2-t0-pinch', 'accelerating', 1790],
  ['3-docking', 'colliding', 60],
  ['4-ringdown', 'colliding', 250],
  ['5-bond-failure', 'colliding', 560],
  ['6-needles', 'colliding', 700],
  ['7-rings', 'colliding', 1300],
  ['8-dark', 'colliding', 2450],
];
const clickWhere = (pred) => `(() => {
  const b = [...document.querySelectorAll('button')]
    .find(e => e.getBoundingClientRect().width > 0 && (${pred})(e));
  if (!b) return false; b.click(); return true; })()`;
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

await mkdir(OUT, { recursive: true });
const page = await launch({ url: URL_, width: 1520, height: 900, dpr: DPR });
try {
  await page.waitFor(`(() => { const b = document.querySelector('button[aria-label="Scent"]');
    return !!b && b.getBoundingClientRect().width > 40; })()`, { label: 'Scent nav', timeoutMs: 60000 });
  await page.eval(`document.querySelector('button[aria-label="Scent"]').click()`);
  await page.waitFor('!!document.querySelector("[data-chamber-renderer]")', { label: 'chamber', timeoutMs: 30000 });
  await sleep(1500);
  for (const t of [A, B]) {
    if (!await page.eval(clickWhere(`e => e.title === ${JSON.stringify(t)}`))) throw new Error(`no domain button titled ${t}`);
    await sleep(400);
  }
  await page.waitFor('/WASM · RESULT/.test(document.body.innerText)', { label: 'collision result', timeoutMs: 30000 });
  console.log('accumulator:', await page.eval(
    `document.querySelector('[data-chamber-renderer]').getAttribute('data-chamber-accum')`));
  await page.eval(`document.querySelector('[data-chamber-renderer]').scrollIntoView({ block: 'center' })`);
  await sleep(400);
  for (const [name, phase, ms] of SHOTS) {
    await page.eval(`window.__scentScrub(${JSON.stringify(phase)}, ${ms})`);
    await sleep(150);
    const r = await page.eval(`(() => { const b = document.querySelector('[data-chamber-renderer]').getBoundingClientRect();
      return { x: b.left + window.scrollX, y: b.top + window.scrollY, width: b.width, height: b.height }; })()`);
    const path = `${OUT}/${slug(A)}-x-${slug(B)}-${name}-dpr${DPR}.png`;
    await page.screenshot({ path, clip: { ...r, scale: 1 } });
    console.log('shot', path);
  }
  await page.eval('window.__scentScrub(null)');
} finally {
  await page.close();
}
process.exit(0);
```

- [ ] **Step 4: Start the dev server**

Start the `scale94-dev` configuration from `.claude/launch.json` (port 5174), using the preview tool (`preview_start` with name `scale94-dev`), not Bash. Wait until `http://localhost:5174/` responds.

- [ ] **Step 5: Shoot the near-complementary pair at DPR 1 and DPR 2**

Run: `node scripts/_scentSheet.mjs lookbook/scent 1`
Run: `node scripts/_scentSheet.mjs lookbook/scent 2`
Expected: 16 PNGs, and `accumulator: half-float` (or `screen`; record which).

If the Scent nav wait times out, run `page.eval` of `[...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label') + '|' + b.innerText).join('\n')` to find the real selector. Fix the script and rerun. Do not guess.

- [ ] **Step 6: LOOK at every frame**

Open each PNG with the Read tool. For each instant, write one line saying what is actually visible, and check it against the spec:

| shot | must be true |
|---|---|
| 1 wall cloud | wide, diffuse streams at both walls; nothing dense at the core |
| 2 T−0 pinch | two razor-thin filaments meeting at the centre; no bloom blob at the core |
| 3 docking | vertices flying in from both sides; the diamond shock front visible, not a circle |
| 4 ringdown | a readable polyhedral cage with hexagons, 1px bonds; the shock fading |
| 5 bond failure | bonds visibly broken or retracting |
| 6 needles | thin needles radiating in sectors, with gaps where dimensions are idle; no round blobs |
| 7 rings | 2–3 hairline fronts with a colour fringe; no smoke |
| 8 dark | the chamber shows only the ambient grid, zone glow and crosshair, i.e. the background unchanged |

Also compare DPR 1 against DPR 2: line widths must look the same in CSS terms, with no 2× thinning.

**If any frame is wrong, stop.** Invoke `superpowers:systematic-debugging`, starting from the screenshot, and fix. Re-shoot before moving on. Do not tune gains to hide a structural defect.

- [ ] **Step 7: Shoot the heavy and volatile pairs**

Using the names from Step 2:

Run: `node scripts/_scentSheet.mjs lookbook/scent 1 "<heaviest name>" "<second heaviest name>"`
Run: `node scripts/_scentSheet.mjs lookbook/scent 1 "<lightest name>" "<second lightest name>"`

Look at shot 2 (T−0 pinch) and shot 4 (ringdown) of each pair:

- Heavy beams must read as single fluttering ribbons.
- Volatile beams must read as braided strands.
- The heavy pair's cage must sit off-centre toward neither side (equal masses give Δx ≈ 0).

- [ ] **Step 8: Hand the sheet to the author**

Send the DPR 1 sheet for FEIGEN × GRAPHN and shots 2 and 4 of both mass pairs using `SendUserFile`, with a one-paragraph caption:

- which accumulator path ran;
- the test and lint numbers from Step 1;
- anything that looked off in Step 6, stated plainly.

Then **stop and wait.** The next steps are his eye on real hardware (360 Hz panel) and tuning via the scrub hook. **Do not push. Do not merge.**

- [ ] **Step 9: Commit the verification scripts**

```bash
git add scripts/_scentMass.mjs scripts/_scentSheet.mjs
git commit -m "chore(scent): mass printer and scrub-driven contact-sheet scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
