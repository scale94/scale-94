# /SCENT Collider Chamber (WebGL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `scaling` tab's chrome to `/SCENT` and replace its 350-line Canvas2D collision chamber with a two-pass WebGL renderer on the shared GL harness.

**Architecture:** Pass 1 draws the field (grid, zone glow, crosshair, beamlines, shockwave rings, flash, 16 dimension beams) as one analytic fragment shader over the harness's existing fullscreen quad. Pass 2 draws 4096 stateless particles as `gl.POINTS` from a static seed buffer, with all motion derived in the vertex shader from `uPhaseT`. Both passes blend additively. All text leaves the canvas for positioned DOM.

**Tech Stack:** React 18, WebGL2, vitest + @testing-library/react, `src/terminal/gl/` harness (`glHost.js`, `frameLoop.js`, `useShaderCanvas.js`), `recordingGL`/`driveFrames` call-log snapshot toolkit.

**Spec:** `docs/superpowers/specs/2026-07-28-scent-collider-gl-design.md`

## Global Constraints

- **Test command is `npm test`** (vitest run). Single file: `npx vitest run <path>`.
- **Baseline is 847 tests / 92 files green.** Each task states how many it adds; anything else moving is a regression.
- **`npm run lint` is NOT clean repo-wide** — measured 2026-07-28: 559 problems, 403 errors, all pre-existing. Do not use a whole-repo lint pass as a gate; it will never be green and says nothing about your change. Instead lint only what you touched: `npx eslint <the files you changed>`, and confirm it reports zero errors for those paths. Where a step below says "run the linter", that is what it means.
- **The six frozen `glParity` snapshots must stay byte-identical.** Never run vitest with `-u`. If `glParity.test.jsx` fails, the change was not additive — fix the change, not the snapshot.
- **The render loop may read state and must never write it.** No `setState`, no ref mutation that drives a phase transition, inside any `draw()` callback. (Spec §6.2.)
- **No `Math.random()` in anything the GL path touches.** Particle seeds and all per-frame values must be deterministic or the parity snapshot cannot exist.
- **Internal tab key stays the string `'scaling'`.** Only user-visible chrome is renamed. (Spec §2.)
- **All new GLSL is `#version 300 es`** and must be the first line of the source string with no leading whitespace.
- **Existing commit style:** conventional commits, and every commit ends with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Deviations from the approved spec

Both are called out again at the task that implements them.

1. **Spec §4.1 promised two `glHost` changes; this plan makes three.** The third is exporting the existing private `buildProgram(gl, vs, fs, {strategy, label})`. Task 7 needs to build a second program and would otherwise copy-paste glHost's compile/link/error handling. `LunarShaderMoon.jsx:100`'s `buildBakeProgram` is already that same copy-paste — so this is n=2, which satisfies the "don't abstract on n=1" rule in spec §4.3. It is an export of code that already exists; it changes zero behaviour.
2. **Spec §4.2 said `blend: 'straight'` for pass 1 and additive for pass 2.** Both passes are additive instead. The chamber is entirely emissive light over the container's `bg-black/60`, so one blend mode removes all mid-frame blend switching and all alpha compositing math. `glHost` still enables `BLEND`; the component sets `blendFunc(ONE, ONE)` at the top of each frame.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/terminal/gl/glHost.js` | MODIFY — rectangular `pixelSize`, `resize()`, export `buildProgram` |
| `src/terminal/gl/__tests__/recordingGL.js` | MODIFY — record `POINTS`, `uniform3f/4f/1fv/4fv` |
| `src/terminal/collider/particleSeeds.js` | NEW — pure, deterministic seed buffer |
| `src/terminal/collider/colliderPhases.js` | NEW — pure, ms → timing curves |
| `src/terminal/collider/fieldShader.js` | NEW — pass 1 GLSL + its uniform contract |
| `src/terminal/collider/particleShader.js` | NEW — pass 2 GLSL + its uniform contract |
| `src/terminal/collider/ColliderChamber.jsx` | NEW — the GL component + DOM overlay |
| `src/terminal/collider/usePhaseAdvance.js` | NEW — the one clock-driven phase transition, off the render loop |
| `src/terminal/components/icons/ScentGlyph.jsx` | NEW — the nav icon |
| `src/terminal/views/LatentCollider.jsx` | MODIFY — delete the Canvas2D loop, mount the chamber, move the phase transition out of `draw()` |
| `src/terminal/App.jsx` | MODIFY — nav label, icon, aria-label, prompt path |
| `src/terminal/hooks/useCommandDispatch.js` | MODIFY — `scent`/`saponification` aliases |
| `src/terminal/hooks/useTerminalCommands.js` | MODIFY — same |
| `src/terminal/commands/runHelpers.js` | MODIFY — `CMD_MANIFEST`, which drives the terminal's live autocomplete dropdown |
| `content/system_logs/HELP.md` | MODIFY — help text |

**A note on "route":** there is no URL router. `handleNav(path, tab)` (`App.jsx:593`) sets a *displayed prompt string* and a tab key. So "renaming the route" means changing a display string at four call sites and adding command aliases. Nothing can 404.

---

### Task 1: `/SCENT` rename and the new icon

Independent of all GL work and immediately visible in the browser. Do it first so there is an early checkpoint.

**Files:**
- Create: `src/terminal/components/icons/ScentGlyph.jsx`
- Create: `src/terminal/components/icons/__tests__/ScentGlyph.test.jsx`
- Modify: `src/terminal/App.jsx:12` (import), `:1148` (desktop nav), `:1401` (mobile nav)
- Modify: `src/terminal/hooks/useCommandDispatch.js:30`, `:418-420`, `:483`, `:943`
- Modify: `src/terminal/hooks/useTerminalCommands.js:155-157`, `:194`, `:268`
- Modify: `content/system_logs/HELP.md:11`

**Interfaces:**
- Consumes: nothing.
- Produces: `ScentGlyph({ className })` — a stroke-only SVG component, drop-in compatible with a lucide icon (accepts and forwards `className`, renders a `<svg>` with `viewBox="0 0 24 24"`).

- [ ] **Step 1: Write the failing test**

Create `src/terminal/components/icons/__tests__/ScentGlyph.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ScentGlyph from '../ScentGlyph';

describe('ScentGlyph', () => {
  it('renders an svg that forwards className, like a lucide icon', () => {
    const { container } = render(<ScentGlyph className="w-3 h-3" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toBe('w-3 h-3');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('is legible at 12px: at most two stroked paths, no fills', () => {
    // Spec §3.1 — richer glyphs turn to mush at w-3 h-3. This is a design
    // constraint with teeth, so it is asserted rather than commented.
    const { container } = render(<ScentGlyph className="x" />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeLessThanOrEqual(2);
    expect(container.querySelector('svg').getAttribute('fill')).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/icons/__tests__/ScentGlyph.test.jsx`
Expected: FAIL — `Failed to resolve import "../ScentGlyph"`.

- [ ] **Step 3: Write the icon**

Create `src/terminal/components/icons/ScentGlyph.jsx`:

```jsx
import React from 'react';

// One droplet, one rising wisp. Spec §3.1: at w-3 h-3 (12px) only two or
// three strokes stay legible, so the two-droplets-merging glyph considered
// first is deliberately not built. Stroke language matches lucide-react so
// this sits correctly beside <Lock>, <Radio> and <Moon> in the same nav row.
const ScentGlyph = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* droplet */}
    <path d="M12 22a5 5 0 0 1-5-5c0-2.5 5-8 5-8s5 5.5 5 8a5 5 0 0 1-5 5Z" />
    {/* wisp rising from it */}
    <path d="M12 6c2-1.2 2-2.8 0-4" />
  </svg>
);

export default ScentGlyph;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/icons/__tests__/ScentGlyph.test.jsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Swap the icon and label in App.jsx**

At `src/terminal/App.jsx:12`, remove `Scale` from the lucide import (verify with `grep -n "Scale" src/terminal/App.jsx` that it has no other use; if it does, leave it):

```jsx
import { Hexagon, Cpu, Lock, Eye, ShieldAlert, KeyRound, Radio, Leaf, Moon } from 'lucide-react';
```

Add below the other local imports:

```jsx
import ScentGlyph from './components/icons/ScentGlyph';
```

Replace the desktop nav button at `:1148` — only `aria-label`, `handleNav`'s path argument, the icon, and the label text change; every class stays:

```jsx
<button aria-label="Scent" aria-current={activeTab === 'scaling' ? 'page' : undefined} onClick={() => handleNav('~/system/scent', 'scaling')} className={`${activeTab === 'scaling' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500 hover:text-fuchsia-200 hover:bg-fuchsia-900/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><ScentGlyph className="w-3 h-3" /> /Scent</button>
```

Replace the mobile nav button at `:1401`:

```jsx
<button onClick={() => handleNav('~/system/scent', 'scaling')} aria-label="Scent" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'scaling' ? 'text-fuchsia-400' : 'text-fuchsia-400/50'}`}>
  <ScentGlyph className="w-5 h-5" />
</button>
```

- [ ] **Step 6: Add the command aliases**

In `src/terminal/hooks/useCommandDispatch.js:30`, extend `LOAD_TAB_MAP`:

```js
  kernel: 'kernel', home: 'kernel', scaling: 'scaling', scent: 'scaling', saponification: 'scaling', transmission: 'transmission',
```

At `:418-420`, accept the new words and show the new path:

```js
    if (['scaling', 'scent', 'saponification', 'services', 'custom'].includes(action)) {
      handleNav('~/system/scent', 'scaling');
      executeCommand(rawCmd, "Switching directory to /system/scent...");
```

At `:483`, change the thesis path only: `handleNav('~/system/scent/thesis', 'scaling');`

At `:943`, in the help string, replace the bare word `scaling` with `scent`.

Apply the identical four edits in `src/terminal/hooks/useTerminalCommands.js` at `:155-157`, `:194`, and `:268`.

In `content/system_logs/HELP.md:11`:

```markdown
* **scent** / **saponification** / **scaling** / **services** — Open the Saponification chamber.
```

- [ ] **Step 7: Verify nothing else referenced the old strings**

Run: `npx vitest run` — expected: full suite passes (847 tests green before this branch).
Run: `npm run lint` — expected: no errors. This catches an orphaned `Scale` import.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/components/icons src/terminal/App.jsx src/terminal/hooks/useCommandDispatch.js src/terminal/hooks/useTerminalCommands.js content/system_logs/HELP.md
git commit -m "feat(scent): rename the scaling tab's chrome to /SCENT

Nav label, aria-label, icon and prompt path only. The internal tab key
stays 'scaling' -- it threads through NAV_TINTS, resolveEyeState, the
vertebrae guard and the scaling_visit bus channel.

'scaling' and 'services' stay accepted as command aliases; 'scent' and
'saponification' are added.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `glHost` accepts a rectangular `pixelSize`

**Files:**
- Modify: `src/terminal/gl/glHost.js:64-88`
- Test: `src/terminal/gl/__tests__/glHost.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createShaderHost(canvas, { pixelSize })` where `pixelSize` is `number` (square, unchanged) **or** `{ w: number, h: number }`.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('createShaderHost', ...)` block in `src/terminal/gl/__tests__/glHost.test.js`:

```js
  it('accepts a rectangular pixelSize and sizes both axes independently', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const canvas = canvasWith(createRecordingGL({ version: 2 }));
    createShaderHost(canvas, {
      ...BASE, version: 2, strategy: 'lunar', pixelSize: { w: 900, h: 220 },
    });
    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(440);
    vi.unstubAllGlobals();
  });

  it('writes a rectangular style size when asked', () => {
    const canvas = canvasWith(createRecordingGL({ version: 2 }));
    createShaderHost(canvas, {
      ...BASE, version: 2, strategy: 'lunar',
      pixelSize: { w: 900, h: 220 }, setStyleSize: true,
    });
    expect(canvas.style.width).toBe('900px');
    expect(canvas.style.height).toBe('220px');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: FAIL — `expected NaN to be 1800`. A scalar `pixelSize` is multiplied directly, so an object yields `NaN`.

- [ ] **Step 3: Implement**

In `src/terminal/gl/glHost.js`, replace lines 82-88 (the `dpr`/sizing block) with:

```js
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  // pixelSize is a scalar (square, the original contract) or { w, h }. The
  // collider chamber is a 220px-tall letterbox; every prior consumer is square.
  const size = typeof pixelSize === 'number' ? { w: pixelSize, h: pixelSize } : pixelSize;
  canvas.width = Math.round(size.w * dpr);
  canvas.height = Math.round(size.h * dpr);
  if (setStyleSize) {
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Prove the change was additive**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`
Expected: PASS with **no snapshot written or updated**. If vitest reports "snapshots written", the change was not additive — revert and fix. Do not pass `-u`.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/glHost.js src/terminal/gl/__tests__/glHost.test.js
git commit -m "feat(gl): glHost accepts a rectangular pixelSize

pixelSize was a scalar used for both axes -- square canvases only. The
collider chamber is a 220px-tall letterbox. A scalar still means square.

glParity snapshots unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `glHost` gains `resize()` and exports `buildProgram`

**Deviation from spec §4.1** — see "Deviations" at the top. `buildProgram` is an export of existing private code; it changes no behaviour, and `LunarShaderMoon.jsx:100`'s `buildBakeProgram` is the second consumer proving the need.

**Files:**
- Modify: `src/terminal/gl/glHost.js`
- Test: `src/terminal/gl/__tests__/glHost.test.js`

**Interfaces:**
- Consumes: Task 2's `{ w, h }` sizing.
- Produces:
  - `host.resize(w, h)` — sets the backing store by DPR and calls `gl.viewport`; returns nothing; never rebuilds the program.
  - `export function buildProgram(gl, vs, fs, { strategy = 'lunar', label = 'glHost' })` → `WebGLProgram`. Throws on compile/link failure under `'lunar'`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('createShaderHost', ...)`:

```js
  it('resize() updates the backing store and viewport without rebuilding', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const gl = createRecordingGL({ version: 2 });
    const canvas = canvasWith(gl);
    const host = createShaderHost(canvas, {
      ...BASE, version: 2, strategy: 'lunar', pixelSize: { w: 900, h: 220 },
    });
    const before = gl.__log.length;
    host.resize(400, 220);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(440);
    // Exactly one new GL call, and it is the viewport. A rebuild would emit
    // createShader/linkProgram here -- that is the defect this test catches.
    expect(gl.__log.slice(before).map(e => e[0])).toEqual(['viewport']);
    expect(gl.__log[gl.__log.length - 1]).toEqual(['viewport', 0, 0, 800, 440]);
    vi.unstubAllGlobals();
  });
```

And a new top-level `describe` in the same file:

```js
describe('buildProgram', () => {
  it('compiles, links and returns a program', () => {
    const gl = createRecordingGL({ version: 2 });
    const prog = buildProgram(gl, 'VS', 'FS', { strategy: 'lunar', label: 'x' });
    expect(prog.__tag).toMatch(/^program:/);
    expect(gl.__log.map(e => e[0])).toContain('linkProgram');
  });

  it('throws with the driver log on compile failure', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getShaderParameter = () => false;
    gl.getShaderInfoLog = () => 'BOOM';
    expect(() => buildProgram(gl, 'VS', 'FS', { strategy: 'lunar', label: 'chamber' }))
      .toThrow(/chamber.*BOOM/s);
  });
});
```

Extend the import at the top of the file:

```js
import { createShaderHost, buildProgram } from '../glHost';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: FAIL — `buildProgram is not a function`, and `host.resize is not a function`.

- [ ] **Step 3: Implement**

In `src/terminal/gl/glHost.js`, export the existing `buildLunar` under a public name by replacing its declaration (line 47) with:

```js
// Exported: the collider chamber builds a second program for its particle
// pass inside onInit, and LunarShaderMoon's buildBakeProgram is the same
// compile/link/throw sequence copy-pasted. Two consumers, so it is shared
// rather than triplicated. `strategy` is accepted for symmetry with
// createShaderHost; only 'lunar' error handling is exposed, because a second
// program that silently fails to compile is exactly the black-canvas failure
// mode the harness exists to prevent.
export function buildProgram(gl, vsSrc, fsSrc, { strategy = 'lunar', label = 'glHost' } = {}) {
  if (strategy === 'legacy') return buildLegacy(gl, vsSrc, fsSrc, label);
  return buildLunar(gl, vsSrc, fsSrc, label);
}

function buildLunar(gl, vsSrc, fsSrc, label) {
```

Then add `resize` to the returned host object, immediately before `dispose()` (line 170):

```js
    resize(w, h) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (setStyleSize) {
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: PASS, 19 tests.

- [ ] **Step 5: Prove the change was additive**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx src/terminal/gl/__tests__/convergence.test.jsx`
Expected: PASS, no snapshots written.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/glHost.js src/terminal/gl/__tests__/glHost.test.js
git commit -m "feat(gl): add host.resize() and export buildProgram

resize() re-sizes the backing store and viewport without rebuilding --
pixelSize is read once at build time, so a fluid-width consumer would
otherwise recompile its shaders on every resize tick.

buildProgram exposes the compile/link/throw sequence that the collider
chamber's second program needs and that LunarShaderMoon's
buildBakeProgram already duplicates.

glParity and convergence snapshots unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `particleSeeds.js`

**Files:**
- Create: `src/terminal/collider/particleSeeds.js`
- Test: `src/terminal/collider/__tests__/particleSeeds.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const PARTICLE_COUNT = 4096`
  - `export const SEED_STRIDE = 4`
  - `export function buildParticleSeeds(count = PARTICLE_COUNT): Float32Array` — length `count * 4`, laid out `[lane, birthPhase, hash1, hash2]` per particle. `lane ∈ [-1, 1)`, the other three `∈ [0, 1)`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/particleSeeds.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildParticleSeeds, PARTICLE_COUNT, SEED_STRIDE } from '../particleSeeds';

describe('buildParticleSeeds', () => {
  it('returns count * 4 floats', () => {
    expect(buildParticleSeeds(10)).toHaveLength(40);
    expect(buildParticleSeeds()).toHaveLength(PARTICLE_COUNT * SEED_STRIDE);
  });

  it('is deterministic — the parity snapshot depends on this', () => {
    expect(Array.from(buildParticleSeeds(64)))
      .toEqual(Array.from(buildParticleSeeds(64)));
  });

  it('is a prefix-stable sequence: a bigger buffer extends, never reshuffles', () => {
    const small = buildParticleSeeds(16);
    const big = buildParticleSeeds(64);
    expect(Array.from(big.slice(0, 64))).toEqual(Array.from(small));
  });

  it('keeps lane in [-1,1) and the three hashes in [0,1)', () => {
    const s = buildParticleSeeds(512);
    for (let i = 0; i < 512; i++) {
      expect(s[i * 4 + 0]).toBeGreaterThanOrEqual(-1);
      expect(s[i * 4 + 0]).toBeLessThan(1);
      for (const k of [1, 2, 3]) {
        expect(s[i * 4 + k]).toBeGreaterThanOrEqual(0);
        expect(s[i * 4 + k]).toBeLessThan(1);
      }
    }
  });

  it('spreads: no two adjacent particles share a birthPhase, and both streams are populated', () => {
    const s = buildParticleSeeds(512);
    let same = 0;
    let streamA = 0;
    for (let i = 1; i < 512; i++) if (s[i * 4 + 1] === s[(i - 1) * 4 + 1]) same++;
    for (let i = 0; i < 512; i++) if (s[i * 4 + 3] < 0.5) streamA++;
    expect(same).toBe(0);
    // hash2 < 0.5 selects stream A in the vertex shader; a degenerate hash
    // that put every particle in one stream would render a one-sided collision.
    expect(streamA).toBeGreaterThan(150);
    expect(streamA).toBeLessThan(362);
  });

  it('rejects a non-positive or non-integer count', () => {
    expect(() => buildParticleSeeds(0)).toThrow(RangeError);
    expect(() => buildParticleSeeds(-4)).toThrow(RangeError);
    expect(() => buildParticleSeeds(3.5)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/particleSeeds.test.js`
Expected: FAIL — `Failed to resolve import "../particleSeeds"`.

- [ ] **Step 3: Implement**

Create `src/terminal/collider/particleSeeds.js`:

```js
// particleSeeds.js — the chamber's only per-particle state.
//
// 4096 particles x 4 floats = 64KB, built once at mount and never touched
// again. Every trajectory is derived from these four numbers plus uPhaseT in
// the vertex shader, which is what makes the whole system snapshot-testable:
// no Math.random anywhere, so a given frame is a pure function of its inputs.

export const PARTICLE_COUNT = 4096;
export const SEED_STRIDE = 4; // lane, birthPhase, hash1, hash2

// A 32-bit integer avalanche (Murmur3 finaliser). Chosen over Math.random for
// determinism and over a plain LCG because consecutive indices must not
// correlate — adjacent particles sharing a birthPhase would render as a comb.
function hash01(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function buildParticleSeeds(count = PARTICLE_COUNT) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`buildParticleSeeds: count must be a positive integer, got ${count}`);
  }
  const out = new Float32Array(count * SEED_STRIDE);
  for (let i = 0; i < count; i++) {
    const o = i * SEED_STRIDE;
    // Keyed off i alone (not a running counter) so the sequence is
    // prefix-stable: buildParticleSeeds(64) starts with buildParticleSeeds(16).
    out[o + 0] = hash01(i * 4 + 1) * 2 - 1; // lane, transverse offset in the beam
    out[o + 1] = hash01(i * 4 + 2);         // birthPhase, staggers the stream
    out[o + 2] = hash01(i * 4 + 3);         // hash1, helix angle + ambient gating
    out[o + 3] = hash01(i * 4 + 4);         // hash2, stream side + post-impact role
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/particleSeeds.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/collider/particleSeeds.js src/terminal/collider/__tests__/particleSeeds.test.js
git commit -m "feat(collider): deterministic particle seed buffer

4096 x vec4, built once. No Math.random anywhere in the GL path -- a
frame must be a pure function of its inputs or the parity snapshot
cannot exist.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `colliderPhases.js`

Owns timing *within* a phase, not the state graph — six of seven transitions are event-driven (spec §6.1). Every constant here is the existing frame threshold converted at 60fps, so the sequence keeps its authored shape while becoming frame-rate independent.

**Files:**
- Create: `src/terminal/collider/colliderPhases.js`
- Test: `src/terminal/collider/__tests__/colliderPhases.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const ACCELERATE_MS = 1800`, `export const COLLIDE_MS = 2500`
  - `export const PHASE_ID = { idle: 0, selecting: 1, accelerating: 2, colliding: 3, result: 4 }`
  - `export function phaseTiming(phase: string, elapsedMs: number)` → `{ progress, ease, shake, ring1, ring2, flash, sparkGate, jetGate, chimeraGate, vaporGate, beamT, metrics, done }`. All numbers. `ring1`/`ring2`/`beamT` are `-1` when inactive. Gates are `0` or `1`. `done` is `0` or `1`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderPhases.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { phaseTiming, ACCELERATE_MS, COLLIDE_MS, PHASE_ID } from '../colliderPhases';

describe('colliderPhases', () => {
  it('preserves the authored durations from the old frame counters', () => {
    // Old: `progress = t / 108` with "~1800ms at 60fps"; `t > 150` -> result.
    expect(ACCELERATE_MS).toBe(1800);
    expect(COLLIDE_MS).toBe(2500);
    expect(PHASE_ID.colliding).toBe(3);
  });

  it('is frame-rate independent: the same elapsed ms gives the same curve', () => {
    // The defect this module exists to fix. 60fps reached 900ms in 54 frames,
    // 120fps in 108 -- both must produce identical output now.
    const at60 = phaseTiming('accelerating', 54 * (1000 / 60));
    const at120 = phaseTiming('accelerating', 108 * (1000 / 120));
    expect(at60.ease).toBeCloseTo(at120.ease, 12);
    expect(at60.progress).toBeCloseTo(at120.progress, 12);
  });

  it('accelerating: easeInCubic, clamped at both ends', () => {
    expect(phaseTiming('accelerating', 0).ease).toBe(0);
    expect(phaseTiming('accelerating', 900).ease).toBeCloseTo(0.125, 6); // 0.5^3
    expect(phaseTiming('accelerating', 1800).ease).toBe(1);
    expect(phaseTiming('accelerating', 9000).ease).toBe(1);
    expect(phaseTiming('accelerating', 9000).progress).toBe(1);
  });

  it('colliding: flash, shake and rings run on their original windows', () => {
    const t0 = phaseTiming('colliding', 0);
    expect(t0.flash).toBe(1);      // 15 frames = 250ms
    expect(t0.shake).toBe(1);      // 20 frames = 333ms
    expect(t0.ring1).toBe(0);      // 35 frames = 583ms
    expect(t0.ring2).toBe(-1);     // starts at frame 5 = 83ms

    expect(phaseTiming('colliding', 250).flash).toBe(0);
    expect(phaseTiming('colliding', 300).flash).toBe(0);
    expect(phaseTiming('colliding', 100).ring2).toBeGreaterThanOrEqual(0);
    expect(phaseTiming('colliding', 600).ring1).toBe(-1);
  });

  it('colliding: spawn gates match the original frame windows', () => {
    expect(phaseTiming('colliding', 100).sparkGate).toBe(1);   // t < 40  = 667ms
    expect(phaseTiming('colliding', 700).sparkGate).toBe(0);
    expect(phaseTiming('colliding', 300).jetGate).toBe(1);     // t < 25  = 417ms
    expect(phaseTiming('colliding', 500).jetGate).toBe(0);
    expect(phaseTiming('colliding', 400).chimeraGate).toBe(0); // 30..120 = 500..2000ms
    expect(phaseTiming('colliding', 900).chimeraGate).toBe(1);
    expect(phaseTiming('colliding', 2100).chimeraGate).toBe(0);
    expect(phaseTiming('colliding', 900).vaporGate).toBe(0);   // 60..140 = 1000..2333ms
    expect(phaseTiming('colliding', 1500).vaporGate).toBe(1);
  });

  it('colliding: beams and metrics arm at 1333ms', () => {
    expect(phaseTiming('colliding', 1000).beamT).toBe(-1);
    expect(phaseTiming('colliding', 1000).metrics).toBe(0);
    expect(phaseTiming('colliding', 1333).beamT).toBeCloseTo(0, 6);
    expect(phaseTiming('colliding', 1833).beamT).toBeCloseTo(0.5, 6); // seconds
    expect(phaseTiming('colliding', 1583).metrics).toBeCloseTo(0.5, 6);
    expect(phaseTiming('colliding', 1833).metrics).toBe(1);
  });

  it('done flips exactly at COLLIDE_MS and only for colliding', () => {
    expect(phaseTiming('colliding', 2499).done).toBe(0);
    expect(phaseTiming('colliding', 2500).done).toBe(1);
    expect(phaseTiming('accelerating', 99999).done).toBe(0);
    expect(phaseTiming('idle', 99999).done).toBe(0);
  });

  it('idle and selecting are inert but well-formed', () => {
    for (const p of ['idle', 'selecting', 'result']) {
      const t = phaseTiming(p, 1234);
      expect(t.ease).toBe(0);
      expect(t.flash).toBe(0);
      expect(t.ring1).toBe(-1);
      expect(t.beamT).toBe(-1);
      expect(Number.isFinite(t.progress)).toBe(true);
    }
  });

  it('never returns NaN for a negative or absurd elapsed', () => {
    for (const ms of [-1000, 0, 1e9]) {
      for (const v of Object.values(phaseTiming('colliding', ms))) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/colliderPhases.test.js`
Expected: FAIL — `Failed to resolve import "../colliderPhases"`.

- [ ] **Step 3: Implement**

Create `src/terminal/collider/colliderPhases.js`:

```js
// colliderPhases.js — timing curves for the collision chamber.
//
// This module owns durations, NOT the state graph. Six of the seven phase
// transitions are event-driven (a domain is selected, collide() resolves, the
// user resets); only colliding -> result is a clock, and even that fires from
// a timer in the component, never from the render loop. See spec section 6.
//
// Every constant below is an old frame threshold converted at 60fps. The
// chamber used to count frames -- `const t = timerRef.current++` -- so on a
// 120Hz display the entire collision played at double speed. Same authored
// shape, real clock.

export const ACCELERATE_MS = 1800; // was progress = t / 108
export const COLLIDE_MS    = 2500; // was t > 150 -> result

const FLASH_MS   = 250;  // t < 15
const SHAKE_MS   = 333;  // t < 20
const RING1_MS   = 583;  // t < 35
const RING2_AT   = 83;   // t > 5
const RING2_MS   = 500;  // over 30 frames
const SPARK_MS   = 667;  // t < 40
const JET_MS     = 417;  // t < 25
const CHIMERA_IN = 500;  // t > 30
const CHIMERA_OUT= 2000; // t < 120
const VAPOR_IN   = 1000; // t > 60
const VAPOR_OUT  = 2333; // t < 140
const ARM_AT     = 1333; // t > 80 -- beams and metrics
const METRICS_MS = 500;  // fadeIn over 30 frames

export const PHASE_ID = { idle: 0, selecting: 1, accelerating: 2, colliding: 3, result: 4 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const gate = (ms, lo, hi) => (ms >= lo && ms < hi ? 1 : 0);
// Rising 0..1 over `dur` from `from`, or -1 once past it. -1 is the inactive
// sentinel so these stay plain floats on the way to a uniform.
const window01 = (ms, from, dur) => (ms < from || ms >= from + dur ? -1 : (ms - from) / dur);

const INERT = {
  progress: 0, ease: 0, shake: 0, ring1: -1, ring2: -1, flash: 0,
  sparkGate: 0, jetGate: 0, chimeraGate: 0, vaporGate: 0,
  beamT: -1, metrics: 0, done: 0,
};

export function phaseTiming(phase, elapsedMs) {
  const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

  if (phase === 'accelerating') {
    const progress = clamp01(ms / ACCELERATE_MS);
    return { ...INERT, progress, ease: progress * progress * progress };
  }

  if (phase === 'colliding') {
    return {
      progress: clamp01(ms / COLLIDE_MS),
      ease: 0,
      shake: clamp01(1 - ms / SHAKE_MS),
      ring1: window01(ms, 0, RING1_MS),
      ring2: window01(ms, RING2_AT, RING2_MS),
      flash: clamp01(1 - ms / FLASH_MS),
      sparkGate: gate(ms, 0, SPARK_MS),
      jetGate: gate(ms, 0, JET_MS),
      chimeraGate: gate(ms, CHIMERA_IN, CHIMERA_OUT),
      vaporGate: gate(ms, VAPOR_IN, VAPOR_OUT),
      beamT: ms < ARM_AT ? -1 : (ms - ARM_AT) / 1000, // seconds, for the shader
      metrics: ms < ARM_AT ? 0 : clamp01((ms - ARM_AT) / METRICS_MS),
      done: ms >= COLLIDE_MS ? 1 : 0,
    };
  }

  return { ...INERT };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/colliderPhases.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/collider/colliderPhases.js src/terminal/collider/__tests__/colliderPhases.test.js
git commit -m "feat(collider): wall-clock timing curves for the chamber

The chamber counted frames, so on a 120Hz display the whole collision
played at double speed. Every constant here is the old frame threshold
converted at 60fps -- same authored shape, real clock.

Owns durations only. The state graph stays in the component, where its
event sources are.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: teach `recordingGL` the calls the chamber makes

The chamber calls `uniform4fv` (for `uBeams[16]`), `uniform4f`, `uniform3f`, and `drawArrays(gl.POINTS, ...)`. `recordingGL` stubs none of these and has no `POINTS` constant, so `gl.POINTS` is `undefined` and every particle draw would serialise identically — hiding exactly the class of bug the snapshot exists to catch.

**Files:**
- Modify: `src/terminal/gl/__tests__/recordingGL.js:17-48`
- Test: `src/terminal/gl/__tests__/recordingGL.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `createRecordingGL()` gains `POINTS`, `LINES`, `uniform1fv`, `uniform3f`, `uniform4f`, `uniform4fv`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/gl/__tests__/recordingGL.test.jsx`:

```jsx
  it('records the vec4 and POINTS traffic the collider chamber emits', () => {
    const gl = createRecordingGL({ version: 2 });
    expect(gl.POINTS).toBe(0x0000);
    gl.uniform4f({ __tag: 'uniform:p:uBurst' }, 1, 2, 3, 4);
    gl.uniform4fv({ __tag: 'uniform:p:uBeams' }, new Float32Array([1, 2, 3, 4]));
    gl.uniform3f({ __tag: 'uniform:p:uTint' }, 0.1, 0.2, 0.3);
    gl.drawArrays(gl.POINTS, 0, 4096);
    expect(gl.__log.slice(-4)).toEqual([
      ['uniform4f', 'uniform:p:uBurst', 1, 2, 3, 4],
      ['uniform4fv', 'uniform:p:uBeams', [1, 2, 3, 4]],
      ['uniform3f', 'uniform:p:uTint', 0.1, 0.2, 0.3],
      ['drawArrays', 0, 0, 4096],
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGL.test.jsx`
Expected: FAIL — `expected undefined to be 0` on `gl.POINTS`.

- [ ] **Step 3: Implement**

In `src/terminal/gl/__tests__/recordingGL.js`, add to `CONSTANTS` (after the `TRIANGLE_STRIP` line):

```js
  POINTS: 0x0000, LINES: 0x0001,
```

And extend the uniform-setter line in `V1_METHODS`:

```js
  'uniform1f', 'uniform1i', 'uniform1fv', 'uniform2f', 'uniform2fv',
  'uniform3f', 'uniform3fv', 'uniform4f', 'uniform4fv',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGL.test.jsx`
Expected: PASS.

- [ ] **Step 5: Prove the change was additive**

Run: `npx vitest run src/terminal/gl/__tests__/`
Expected: PASS across the whole directory, no snapshots written. New stub methods are only recorded when called, so no existing consumer's log changes.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/__tests__/recordingGL.js src/terminal/gl/__tests__/recordingGL.test.jsx
git commit -m "test(gl): recordingGL records vec4 uniforms and POINTS

The collider chamber uploads uBeams[16] via uniform4fv and draws
gl.POINTS. Neither was stubbed, so gl.POINTS was undefined and every
particle draw would have serialised identically -- hiding the exact
class of bug these snapshots exist to catch.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: the two shader sources

GLSL cannot be compiled in jsdom, so the test asserts the *contract* between each shader and the JS that feeds it: every uniform the component will harvest is declared in the source, and vice versa. That catches the classic "renamed the uniform in GLSL but not in JS" bug, which otherwise shows up as a silently black canvas.

**Files:**
- Create: `src/terminal/collider/fieldShader.js`
- Create: `src/terminal/collider/particleShader.js`
- Test: `src/terminal/collider/__tests__/shaderContract.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fieldShader.js`: `FIELD_VS`, `FIELD_FS`, `FIELD_UNIFORMS = ['uRes','uPhase','uPhaseT','uHue','uSel','uBurst','uBeamT','uBeams']`
  - `particleShader.js`: `PARTICLE_VS`, `PARTICLE_FS`, `PARTICLE_UNIFORMS = ['uRes','uPhase','uPhaseT','uHue','uEase','uGates']`, `MAX_POINT_SIZE = 32`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/shaderContract.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from '../fieldShader';
import { PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS, MAX_POINT_SIZE } from '../particleShader';

// Pulls every `uniform <type> <name>` declaration out of a GLSL source,
// dropping any `[n]` array suffix.
function declaredUniforms(src) {
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(\[\d+\])?\s*;/gm)].map(m => m[1]);
}

describe.each([
  ['field', FIELD_VS, FIELD_FS, FIELD_UNIFORMS],
  ['particle', PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS],
])('%s shader', (name, vs, fs, contract) => {
  it('declares #version 300 es as the very first characters', () => {
    // A leading newline or space makes the directive illegal and the shader
    // fails to compile with a message that does not mention whitespace.
    expect(vs.startsWith('#version 300 es\n')).toBe(true);
    expect(fs.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the component will harvest', () => {
    const declared = new Set([...declaredUniforms(vs), ...declaredUniforms(fs)]);
    expect([...declared].sort()).toEqual([...contract].sort());
  });

  it('binds its attribute to location 0, which is what glHost enables', () => {
    expect(vs).toMatch(/layout\s*\(\s*location\s*=\s*0\s*\)\s+in\s/);
  });

  it('writes to a declared out, not the removed gl_FragColor', () => {
    expect(fs).not.toContain('gl_FragColor');
    expect(fs).toMatch(/^\s*out\s+vec4\s+\w+\s*;/m);
  });
});

describe('particle shader specifics', () => {
  it('clamps gl_PointSize to avoid ANGLE large-point quirks', () => {
    // Spec 5.3. Windows/ANGLE misrenders points above ~64px; 32 is the cap.
    expect(MAX_POINT_SIZE).toBe(32);
    expect(PARTICLE_VS).toContain('gl_PointSize');
    expect(PARTICLE_VS).toContain(`${MAX_POINT_SIZE}.0`);
  });

  it('fades particles in at ingress', () => {
    // Spec 5.3: gl.POINTS are culled on their centre, so a sprite entering at
    // x=0 pops in at full size unless its alpha ramps. Guard the marker
    // comment so the mitigation cannot be silently deleted.
    expect(PARTICLE_VS).toContain('INGRESS');
  });
});

describe('field shader specifics', () => {
  it('dithers the final colour', () => {
    // Spec 5.1: the radial falloffs band on OLED without this.
    expect(FIELD_FS).toContain('dither');
  });

  it('sizes its beam array to the 16 OCK dimensions', () => {
    expect(FIELD_FS).toMatch(/uniform\s+vec4\s+uBeams\s*\[\s*16\s*\]\s*;/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/shaderContract.test.js`
Expected: FAIL — `Failed to resolve import "../fieldShader"`.

- [ ] **Step 3: Write the field shader**

Create `src/terminal/collider/fieldShader.js`:

```js
// fieldShader.js — pass 1. Everything in the chamber that is not a particle,
// drawn analytically over glHost's fullscreen quad.
//
// Replaces the Canvas2D grid, radial zone gradient, crosshair, beamlines,
// shockwave rings, impact flash and 16 dimension beams. Blended additively:
// the chamber is emissive light over the container's bg-black/60, so there is
// no alpha compositing to get wrong.

export const FIELD_UNIFORMS = [
  'uRes',    // vec2  canvas size in CSS px
  'uPhase',  // float PHASE_ID
  'uPhaseT', // float seconds in phase
  'uHue',    // vec2  hueA, hueB, each in [0,1)
  'uSel',    // vec2  is-domain-A-selected, is-domain-B-selected (0 or 1)
  'uBurst',  // vec4  ring1, ring2, flash, metrics  (-1 = inactive)
  'uBeamT',  // float seconds since the dimension beams armed, -1 = inactive
  'uBeams',  // vec4[16] angle(rad), mag[0,1], hue[0,1), lifespan(sec)
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
uniform float uPhase;
uniform float uPhaseT;
uniform vec2  uHue;
uniform vec2  uSel;
uniform vec4  uBurst;
uniform float uBeamT;
uniform vec4  uBeams[16];

vec3 hue2rgb(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}

// Interleaved-gradient noise. One multiply-add and a fract, and it is what
// keeps the radial falloffs below off an OLED's banding staircase.
float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 px = vUv * uRes;
  vec2 c  = uRes * 0.5;
  vec2 d  = px - c;
  float r = length(d);
  vec3 col = vec3(0.0);

  // grid
  vec2 g = abs(fract(px / 40.0) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  col += vec3(0.024, 0.714, 0.831) * grid * 0.04;

  // central zone — the shaped analytic bloom (spec 5.2)
  float zoneR = mix(40.0, 60.0 + 10.0 * sin(uPhaseT * 6.0), step(3.0, uPhase));
  float glow  = exp(-r / max(zoneR, 1.0));
  float pulse = 0.06 + 0.04 * sin(uPhaseT * 1.8);
  col += mix(hue2rgb(uHue.x), hue2rgb(uHue.y), 0.5) * glow * pulse;

  // crosshair
  float chx = (1.0 - smoothstep(0.0, 0.8, abs(d.y))) * (1.0 - smoothstep(18.0, 20.0, abs(d.x)));
  float chy = (1.0 - smoothstep(0.0, 0.8, abs(d.x))) * (1.0 - smoothstep(18.0, 20.0, abs(d.y)));
  col += vec3(0.851, 0.275, 0.937) * (chx + chy) * (0.15 + 0.05 * sin(uPhaseT * 3.0));

  // beamlines
  float onAxis  = 1.0 - smoothstep(0.0, 1.2, abs(d.y));
  float bAlpha  = uPhase == 2.0 ? 0.30 + 0.15 * sin(uPhaseT * 9.0) : 0.12;
  col += hue2rgb(uHue.x) * uSel.x * onAxis * bAlpha * step(px.x, c.x - 100.0);
  col += hue2rgb(uHue.y) * uSel.y * onAxis * bAlpha * step(c.x + 100.0, px.x);

  // shockwave rings
  if (uBurst.x >= 0.0) {
    float rr = uBurst.x * 120.0;
    float w  = 3.0 * (1.0 - uBurst.x) + 1.0;
    col += vec3(1.0) * (1.0 - uBurst.x) * 0.7 * (1.0 - smoothstep(0.0, w, abs(r - rr)));
  }
  if (uBurst.y >= 0.0) {
    float rr = uBurst.y * 90.0;
    float w  = 2.0 * (1.0 - uBurst.y) + 1.0;
    col += hue2rgb(mix(uHue.x, uHue.y, 0.5)) * (1.0 - uBurst.y) * 0.4
         * (1.0 - smoothstep(0.0, w, abs(r - rr)));
  }

  // 16 dimension beams
  if (uBeamT >= 0.0) {
    for (int i = 0; i < 16; i++) {
      vec4 B = uBeams[i];
      float p = uBeamT / max(B.w, 0.001);
      if (B.y < 0.02 || p > 1.0) continue;
      float eased = 1.0 - (1.0 - p) * (1.0 - p);
      float len   = B.y * min(uRes.x, uRes.y) * 0.4 * eased;
      vec2  dir   = vec2(cos(B.x), sin(B.x));
      float along = dot(d, dir);
      if (along < 0.0 || along > len) continue;
      float perp = abs(dot(d, vec2(-dir.y, dir.x)));
      col += hue2rgb(B.z) * (1.0 - p) * 0.85
           * (1.0 - smoothstep(0.0, 0.5 + B.y * 2.0, perp));
    }
  }

  // impact flash
  col += vec3(1.0) * max(uBurst.z, 0.0) * 0.35;

  col += (dither(px) - 0.5) / 255.0;

  // Additive blend: alpha carries luminance so unlit pixels stay transparent
  // and the container's bg-black/60 shows through.
  fragColor = vec4(col, clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0));
}
`;
```

- [ ] **Step 4: Write the particle shader**

Create `src/terminal/collider/particleShader.js`:

```js
// particleShader.js — pass 2. 4096 stateless particles as gl.POINTS.
//
// Every trajectory is a closed-form function of (aSeed, uPhaseT). Nothing is
// stored between frames, nothing is allocated, and replaying a collision is
// uPhaseT = 0. That is also what makes the parity snapshot possible.

export const MAX_POINT_SIZE = 32;

export const PARTICLE_UNIFORMS = [
  'uRes',    // vec2  canvas size in CSS px
  'uPhase',  // float PHASE_ID
  'uPhaseT', // float seconds in phase
  'uHue',    // vec2  hueA, hueB
  'uEase',   // float easeInCubic of the accelerating progress
  'uGates',  // vec4  sparkGate, jetGate, chimeraGate, vaporGate
];

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec4 aSeed; // lane[-1,1), birthPhase, hash1, hash2

uniform vec2  uRes;
uniform float uPhase;
uniform float uPhaseT;
uniform vec2  uHue;
uniform float uEase;
uniform vec4  uGates;

out vec3  vCol;
out float vAlpha;

const float TAU = 6.28318530718;

// ES 3.00 requires a function to be declared before it is used, so this sits
// above main rather than below it.
vec3 hue2rgbLocal(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}

// Curl of a cheap 2-octave sine field. Divergence-free by construction, so
// the streams swirl instead of piling up -- the "fluid deflection" the design
// asks for, at four sines a vertex.
vec2 curl(vec2 p) {
  float e = 0.35;
  float n0 = sin(p.x * 1.7 + p.y * 2.3) + 0.5 * sin(p.x * 3.9 - p.y * 1.1);
  float nx = sin((p.x + e) * 1.7 + p.y * 2.3) + 0.5 * sin((p.x + e) * 3.9 - p.y * 1.1);
  float ny = sin(p.x * 1.7 + (p.y + e) * 2.3) + 0.5 * sin(p.x * 3.9 - (p.y + e) * 1.1);
  return vec2(ny - n0, -(nx - n0)) / e;
}

void main() {
  float lane  = aSeed.x;
  float birth = aSeed.y;
  float h1    = aSeed.z;
  float h2    = aSeed.w;

  float side  = h2 < 0.5 ? -1.0 : 1.0;   // which beam this particle rides
  vec2  c     = uRes * 0.5;
  vec2  pos   = c;
  float size  = 3.0;
  float alpha = 0.0;
  vec3  col   = hue2rgbLocal(side < 0.0 ? uHue.x : uHue.y);

  if (uPhase <= 1.0) {
    // idle / selecting — sparse ambient drift along the beam axis
    float s = fract(birth + uPhaseT * 0.06);
    pos = vec2(mix(0.0, uRes.x, s), c.y + lane * 12.0 + sin(uPhaseT * 0.7 + h1 * TAU) * 3.0);
    alpha = step(0.94, h1) * 0.35;
    size = 2.0;

  } else if (uPhase == 2.0) {
    // accelerating — helical tightening plus curl turbulence
    float speed = 0.35 + 0.45 * h1 + uEase * 1.6;
    float s = fract(birth + uPhaseT * speed);          // 0 at the wall, 1 at the core
    float x = side < 0.0 ? mix(0.0, c.x, s) : mix(uRes.x, c.x, s);

    float twist  = 5.5 + 4.0 * h1;
    float theta  = s * twist + h1 * TAU;
    float radius = (18.0 + 14.0 * abs(lane)) * pow(1.0 - s, 1.7);   // tightens inward
    vec2  helix  = vec2(cos(theta), sin(theta)) * radius;

    vec2 turb = curl(vec2(x * 0.012, (c.y + lane * 20.0) * 0.05) + uPhaseT * 0.35)
              * (2.0 + 9.0 * s * uEase);

    pos   = vec2(x + helix.x * 0.35 + turb.x, c.y + lane * 6.0 + helix.y + turb.y);
    // INGRESS: gl.POINTS are culled on their centre, so a sprite arriving at
    // x=0 would pop in at full size. Ramp alpha over the first 3% of travel.
    alpha = smoothstep(0.0, 0.03, s) * (0.35 + 0.65 * uEase);
    size  = 2.0 + 3.0 * h1 + 3.0 * uEase;

  } else {
    // colliding / result — the same vertices, re-tasked by hash into three
    // populations. No reallocation, no respawn bookkeeping.
    float role = h2 * 2.0; // 0..2, uniform because h2 also chose the side
    if (role < 0.9 && uGates.x > 0.5) {
      // spark — radial burst with drag
      float ang = h1 * TAU;
      float v   = 60.0 + 300.0 * fract(h1 * 7.13);
      float k   = 1.0 - exp(-uPhaseT * 2.4);
      pos   = c + vec2(cos(ang), sin(ang)) * v * k;
      alpha = max(0.0, 1.0 - uPhaseT * 1.5);
      size  = 1.5 + 2.0 * h1;
      col   = hue2rgbLocal(h1 < 0.5 ? uHue.x : uHue.y);

    } else if (role < 1.1 && uGates.y > 0.5) {
      // orthogonal debris jet — the cross-shaped burst
      float dir = h1 < 0.5 ? -1.0 : 1.0;
      float v   = 180.0 + 300.0 * h1;
      float k   = 1.0 - exp(-uPhaseT * 2.4);
      pos   = c + vec2(lane * 40.0 * k, dir * v * k);
      alpha = max(0.0, 1.0 - uPhaseT * 2.4);
      size  = 1.5 + 2.0 * h1;

    } else if (role < 1.6 && uGates.z > 0.5) {
      // chimera — slow orbit at the blended hue
      float ang = uPhaseT * 1.2 + h1 * TAU;
      float rad = 15.0 + 25.0 * h1;
      pos   = c + vec2(cos(ang), sin(ang)) * rad;
      alpha = 0.5;
      size  = 5.0 + 6.0 * h1;
      col   = hue2rgbLocal(mix(uHue.x, uHue.y, 0.5));

    } else if (uGates.w > 0.5) {
      // vapor — sillage. Rises, drifts, thins.
      float age = fract(h1 + uPhaseT * 0.35);
      pos   = c + vec2((lane * 25.0) + sin(age * 4.0 + h1 * TAU) * 8.0, 10.0 - age * 90.0);
      alpha = (1.0 - age) * 0.4;
      size  = 6.0 + 10.0 * age;
      col   = hue2rgbLocal(0.111); // amber, the olfactory layer
    }
  }

  vCol   = col;
  vAlpha = alpha;
  gl_PointSize = clamp(size, 1.0, ${MAX_POINT_SIZE}.0);
  gl_Position = vec4((pos / uRes) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const PARTICLE_FS = `#version 300 es
precision highp float;

in vec3  vCol;
in float vAlpha;
out vec4 fragColor;

void main() {
  // Soft radial sprite. Additive blending sums these, so dense convergence
  // blows the core out to white on its own -- this is the bloom (spec 5.2).
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, d));
  a *= a * vAlpha;
  fragColor = vec4(vCol * a, a);
}
`;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/shaderContract.test.js`
Expected: PASS, 12 tests (4 shared × 2 shaders, plus 2 particle-specific and 2 field-specific).

**A class of bug this test cannot catch:** the contract test parses source text; it never compiles GLSL, because jsdom has no GL. Declaration order, type mismatches and swizzle errors all pass here and fail at mount. That is survivable only because `strategy: 'lunar'` throws with the driver's log — Task 12 step 2 is where such a failure surfaces, and it surfaces loudly rather than as a black canvas.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/fieldShader.js src/terminal/collider/particleShader.js src/terminal/collider/__tests__/shaderContract.test.js
git commit -m "feat(collider): field and particle shader sources

Pass 1 draws everything that is not a particle analytically -- grid,
zone glow, crosshair, beamlines, rings, flash, 16 dimension beams --
with a dither on the output, because the radial falloffs it replaces
band on OLED.

Pass 2 derives every trajectory from (seed, uPhaseT) in the vertex
shader: helical tightening, curl turbulence, and three post-impact
populations selected by hash from the same 4096 vertices.

The contract test asserts each shader declares exactly the uniforms its
component harvests -- a renamed uniform otherwise shows up as a silently
black canvas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `ColliderChamber.jsx` — the GL core

**Files:**
- Create: `src/terminal/collider/ColliderChamber.jsx`
- Test: `src/terminal/collider/__tests__/colliderChamberParity.test.jsx`

**Interfaces:**
- Consumes: `buildProgram` and `host.resize` (Task 3), `buildParticleSeeds`/`PARTICLE_COUNT` (Task 4), `phaseTiming`/`PHASE_ID` (Task 5), the four shader exports (Task 7).
- Produces: `<ColliderChamber phase hueA hueB selA selB beams metrics phaseStartedAt />` where `phase` is one of `'idle'|'selecting'|'accelerating'|'colliding'|'result'`, `hueA`/`hueB` are degrees `0..360`, `selA`/`selB` are booleans, `beams` is `null` or an array of 16 `{ angle, mag, hue, lifespanMs }`, `metrics` is `null` or `{ cosine, angle, novelty }`, and `phaseStartedAt` is a `performance.now()` timestamp captured **at the transition**.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderChamberParity.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../gl/__tests__/driveFrames';
import ColliderChamber from '../ColliderChamber';

const BEAMS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
  mag: 0.2 + (i % 5) * 0.15,
  hue: (i * 23) % 360,
  lifespanMs: 120 + i * 40,
}));

const props = (over = {}) => ({
  phase: 'idle', hueA: 280, hueB: 120, selA: false, selB: false,
  beams: null, metrics: null, phaseStartedAt: 0, ...over,
});

function drive(over, frames = 12) {
  return driveFrames(
    () => {
      const r = render(<ColliderChamber {...props(over)} />);
      return { unmount: r.unmount, rerender: r.rerender };
    },
    { frames, version: 2 }
  );
}

describe('ColliderChamber GL traffic', () => {
  it('builds two programs and one seed buffer at init', () => {
    const { init } = drive({});
    const names = init.map(l => l.slice(0, l.indexOf('(')));
    // glHost's field program + the particle program built inside onInit.
    expect(names.filter(n => n === 'createProgram')).toHaveLength(2);
    expect(names.filter(n => n === 'bufferData')).toHaveLength(2); // quad + seeds
    expect(names).toContain('createVertexArray');
  });

  it('draws both passes every frame, quad then points', () => {
    const { frames } = drive({ phase: 'colliding', phaseStartedAt: 0 });
    const draws = frames.filter(l => l.startsWith('drawArrays'));
    expect(draws.length).toBeGreaterThan(0);
    // TRIANGLE_STRIP is 5, POINTS is 0.
    expect(draws[0]).toBe('drawArrays(5, 0, 4)');
    expect(draws[1]).toBe('drawArrays(0, 0, 4096)');
  });

  it('sets additive blending, never straight alpha, inside the frame', () => {
    const { frames } = drive({ phase: 'accelerating' });
    const blends = frames.filter(l => l.startsWith('blendFunc'));
    expect(blends.length).toBeGreaterThan(0);
    expect(new Set(blends)).toEqual(new Set(['blendFunc(1, 1)']));
  });

  it('uploads all 16 beams as one vec4 array when armed', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: 0 }, 120);
    const up = frames.filter(l => l.startsWith('uniform4fv'));
    expect(up.length).toBeGreaterThan(0);
    // 16 beams x 4 components, flattened into one upload.
    expect(JSON.parse(`[${up[0].slice(up[0].indexOf('[') + 1, up[0].lastIndexOf(']'))}]`))
      .toHaveLength(64);
  });

  it('never writes state from the render loop — no drawArrays after unmount', () => {
    const { frames } = drive({ phase: 'colliding', phaseStartedAt: 0 }, 200);
    // 200 frames is 3200ms, well past COLLIDE_MS. The chamber must keep
    // rendering the post-done state rather than tearing itself down: the
    // transition belongs to the parent (spec 6.2).
    expect(frames.filter(l => l.startsWith('drawArrays')).length).toBeGreaterThan(300);
  });

  it('frozen GL call log', () => {
    expect(drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: 0 }, 8))
      .toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberParity.test.jsx`
Expected: FAIL — `Failed to resolve import "../ColliderChamber"`.

- [ ] **Step 3: Implement the component**

Create `src/terminal/collider/ColliderChamber.jsx`:

```jsx
// ColliderChamber.jsx — the WebGL collision chamber.
//
// Two passes into one canvas. Pass 1 is glHost's fullscreen quad running the
// field shader; pass 2 is 4096 gl.POINTS running the particle shader from a
// static seed buffer built in onInit. Both blend additively.
//
// This component RENDERS. It does not own the phase graph and it never writes
// state from draw() -- the parent decides when colliding becomes result (spec
// section 6.2), so the chamber stays correct even when the loop never runs
// (prefers-reduced-motion, a suspended-rAF preview pane).

import React, { useRef, useState, useEffect } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { buildProgram } from '../gl/glHost';
import { buildParticleSeeds, PARTICLE_COUNT } from './particleSeeds';
import { phaseTiming, PHASE_ID } from './colliderPhases';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './fieldShader';
import { PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS } from './particleShader';

const CHAMBER_H = 220;
const CONTEXT_OPTIONS = {
  alpha: true, premultipliedAlpha: true, antialias: false,
  depth: false, stencil: false, powerPreference: 'low-power',
};

export default function ColliderChamber({
  phase, hueA, hueB, selA, selB, beams, metrics, phaseStartedAt,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [supported, setSupported] = useState(true);

  const particleRef = useRef({ prog: null, vao: null, buf: null, U: null });
  const beamBufRef = useRef(new Float32Array(64));
  // The host is built before the wrapper can be measured, so it starts at a
  // placeholder width and the ResizeObserver below corrects it on its first
  // (synchronous-on-observe) callback, via resize() rather than a rebuild.
  const sizeRef = useRef({ w: 900, h: CHAMBER_H });

  // Live props for the loop, so draw() never re-runs the mount effect.
  const propsRef = useRef({ phase, hueA, hueB, selA, selB, beams, phaseStartedAt });

  const paint = (host, tsec) => {
    const { gl, U } = host;
    const p = propsRef.current;
    const P = particleRef.current;
    const { w, h } = sizeRef.current;

    const elapsed = p.phaseStartedAt == null ? 0 : Math.max(0, tsec * 1000 - p.phaseStartedAt);
    const T = phaseTiming(p.phase, elapsed);
    const phaseId = PHASE_ID[p.phase] ?? 0;
    const phaseT = elapsed / 1000;
    const h01a = ((p.hueA % 360) + 360) % 360 / 360;
    const h01b = ((p.hueB % 360) + 360) % 360 / 360;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE);

    // ── pass 1: field ──
    gl.useProgram(host.prog);
    gl.bindVertexArray(host.vao);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uPhase, phaseId);
    gl.uniform1f(U.uPhaseT, phaseT);
    gl.uniform2f(U.uHue, h01a, h01b);
    gl.uniform2f(U.uSel, p.selA ? 1 : 0, p.selB ? 1 : 0);
    gl.uniform4f(U.uBurst, T.ring1, T.ring2, T.flash, T.metrics);
    gl.uniform1f(U.uBeamT, p.beams ? T.beamT : -1);
    if (p.beams) {
      const b = beamBufRef.current;
      for (let i = 0; i < 16; i++) {
        const s = p.beams[i];
        b[i * 4 + 0] = s ? s.angle : 0;
        b[i * 4 + 1] = s ? s.mag : 0;
        b[i * 4 + 2] = s ? (((s.hue % 360) + 360) % 360) / 360 : 0;
        b[i * 4 + 3] = s ? s.lifespanMs / 1000 : 1;
      }
      gl.uniform4fv(U.uBeams, b);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ── pass 2: particles ──
    gl.useProgram(P.prog);
    gl.bindVertexArray(P.vao);
    gl.uniform2f(P.U.uRes, w, h);
    gl.uniform1f(P.U.uPhase, phaseId);
    gl.uniform1f(P.U.uPhaseT, phaseT);
    gl.uniform2f(P.U.uHue, h01a, h01b);
    gl.uniform1f(P.U.uEase, T.ease);
    gl.uniform4f(P.U.uGates, T.sparkGate, T.jetGate, T.chimeraGate, T.vaporGate);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
  };

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'straight',      // host enables BLEND; paint() sets ONE,ONE per frame
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: sizeRef.current.w || 900, h: CHAMBER_H },
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

    onInit(gl) {
      const prog = buildProgram(gl, PARTICLE_VS, PARTICLE_FS, {
        strategy: 'lunar', label: 'colliderParticles',
      });
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, buildParticleSeeds(PARTICLE_COUNT), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of PARTICLE_UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
      particleRef.current = { prog, vao, buf, U };
      // No trailing viewport/useProgram restore -- glHost does both
      // immediately after onInit returns for strategy 'lunar'.
    },

    onDispose(gl) {
      const P = particleRef.current;
      if (P.prog) gl.deleteProgram(P.prog);
      if (P.buf) gl.deleteBuffer(P.buf);
      if (P.vao) gl.deleteVertexArray(P.vao);
      particleRef.current = { prog: null, vao: null, buf: null, U: null };
    },

    draw(host, { tsec }) { paint(host, tsec); },

    // Under prefers-reduced-motion the loop never starts, so this is the only
    // frame the chamber ever paints. It still shows the correct phase.
    onSnap(host) { paint(host, (propsRef.current.phaseStartedAt || 0) / 1000); },

    deps: [],
  });

  // Props sync. Declared AFTER useShaderCanvas so the hook has populated its
  // snap ref by the time this first runs — the ordering the phase-1 migration
  // established (see the phase-2 backlog's "Already measured and locked" note).
  //
  // The snap() call is load-bearing, not decoration: useShaderCanvas only
  // *arms* onSnap, it never invokes it. Under prefers-reduced-motion the loop
  // never starts and initialDraw is false, so without this line the chamber
  // would paint nothing, ever. Outside reduced motion snap() is a no-op.
  useEffect(() => {
    propsRef.current = { phase, hueA, hueB, selA, selB, beams, phaseStartedAt };
    snap();
  }, [phase, hueA, hueB, selA, selB, beams, phaseStartedAt, snap]);

  // Width is fluid; height is fixed. Resize without rebuilding the programs.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (!w || w === sizeRef.current.w) return;
      sizeRef.current = { w, h: CHAMBER_H };
      hostRef.current?.resize(w, CHAMBER_H);
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
    >
      {supported
        ? <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        : <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-950/40 via-black to-cyan-950/40" />}
    </div>
  );
}
```

**`hostRef` is referenced by the resize effect but `useShaderCanvas` does not expose the host.** Add it: in `src/terminal/gl/useShaderCanvas.js`, add `const hostRef = useRef(null);`, set `hostRef.current = host;` immediately after the host is built, clear it to `null` in the cleanup alongside `snapRef.current = null`, and return `{ snap, hostRef }`. Then in `ColliderChamber`, destructure `const { hostRef } = useShaderCanvas(...)`. This is additive — no existing consumer reads the returned object's new key, and no GL call changes, so the parity snapshots stay identical. Verify that in step 5.

- [ ] **Step 4: Run tests, write the snapshot**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberParity.test.jsx`
Expected: PASS, 6 tests, with `1 snapshot written`. **Read the written snapshot before continuing** — confirm it contains two `createProgram`, a `bufferData` whose array is 16384 floats, `drawArrays(5, 0, 4)` followed by `drawArrays(0, 0, 4096)` each frame, and `blendFunc(1, 1)`.

- [ ] **Step 5: Prove the harness change was additive**

Run: `npx vitest run src/terminal/gl/`
Expected: PASS, no snapshots written or updated.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/ColliderChamber.jsx src/terminal/collider/__tests__/colliderChamberParity.test.jsx src/terminal/gl/useShaderCanvas.js
git commit -m "feat(collider): WebGL collision chamber, two passes

Pass 1 is the field over glHost's quad; pass 2 is 4096 gl.POINTS from a
static seed buffer built in onInit, the same precedent as the moon's
bake pass. Both additive.

The chamber renders and never writes state -- the parent owns the phase
graph, so a halted loop (reduced motion, suspended rAF) cannot strand a
collision.

useShaderCanvas now returns hostRef so a fluid-width consumer can call
host.resize() without rebuilding. Additive: glParity unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: the DOM readout overlay

**Files:**
- Modify: `src/terminal/collider/ColliderChamber.jsx`
- Test: `src/terminal/collider/__tests__/colliderChamberOverlay.test.jsx`

**Interfaces:**
- Consumes: the `metrics`, `selA`, `selB`, `labelA`, `labelB` props.
- Produces: two new props on `ColliderChamber` — `labelA` and `labelB` (the domain short-names, strings or `null`).

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderChamberOverlay.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ColliderChamber from '../ColliderChamber';

const base = {
  phase: 'colliding', hueA: 280, hueB: 120, selA: true, selB: true,
  beams: null, phaseStartedAt: 0, labelA: 'THERMO', labelB: 'CRYPTO',
};

describe('ColliderChamber DOM overlay', () => {
  it('renders the metrics readouts as text, not canvas pixels', () => {
    render(<ColliderChamber {...base} metrics={{ cosine: 0.8123, angle: 35.7, novelty: 0.42 }} />);
    expect(screen.getByText('cos(θ) = 0.8123')).toBeInTheDocument();
    expect(screen.getByText('θ = 35.7°')).toBeInTheDocument();
    expect(screen.getByText('NOVELTY 42%')).toBeInTheDocument();
  });

  it('renders the beamline domain labels only for selected domains', () => {
    render(<ColliderChamber {...base} selB={false} metrics={null} />);
    expect(screen.getByText('THERMO')).toBeInTheDocument();
    expect(screen.queryByText('CRYPTO')).toBeNull();
  });

  it('hides the metrics block entirely when there are none', () => {
    render(<ColliderChamber {...base} metrics={null} />);
    expect(screen.queryByText(/cos\(θ\)/)).toBeNull();
  });

  it('is inert to pointer events', () => {
    // Spec §7: nothing under the overlay is interactive, and a stray drag
    // must not land on a text node instead of the chamber.
    const { container } = render(<ColliderChamber {...base} metrics={null} />);
    const overlay = container.querySelector('[data-chamber-overlay]');
    expect(overlay).not.toBeNull();
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('drives the novelty bar width from the metric', () => {
    const { container } = render(
      <ColliderChamber {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.42 }} />
    );
    expect(container.querySelector('[data-novelty-fill]').style.width).toBe('42%');
  });

  it('falls back to a static field when there is no WebGL context', () => {
    // Spec §4.2 / backlog #10. jsdom's canvas returns null for 'webgl2', so
    // this is the default path here -- which is precisely why the assertion
    // has to be explicit rather than assumed.
    const { container } = render(<ColliderChamber {...base} metrics={null} />);
    const wrap = container.querySelector('[data-chamber-renderer]');
    expect(wrap.dataset.chamberRenderer).toBe('fallback');
    expect(container.querySelector('canvas')).toBeNull();
    // The readouts must survive the fallback -- they are DOM, not GL.
    expect(container.querySelector('[data-chamber-overlay]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberOverlay.test.jsx`
Expected: FAIL — `Unable to find an element with the text: cos(θ) = 0.8123`.

- [ ] **Step 3: Implement**

In `src/terminal/collider/ColliderChamber.jsx`, add `labelA` and `labelB` to the destructured props, and insert this block inside the wrapper `<div>`, immediately after the `<canvas>`:

```jsx
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
          <div className="absolute text-[9px]" style={{ left: 8, top: CHAMBER_H / 2 - 18, color: `hsla(${hueA},80%,70%,0.6)` }}>{labelA}</div>
        )}
        {selB && labelB && (
          <div className="absolute text-[9px]" style={{ right: 8, top: CHAMBER_H / 2 - 18, color: `hsla(${hueB},80%,70%,0.6)` }}>{labelB}</div>
        )}
        {metrics && (
          <>
            <div className="absolute left-0 right-0 text-center text-[8px]" style={{ top: CHAMBER_H / 2 - 72, color: 'rgba(217,70,239,0.6)' }}>
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
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 50 + 33, color: 'rgba(6,182,212,0.7)' }}>
              cos(θ) = {metrics.cosine.toFixed(4)}
            </div>
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 50 + 45, color: 'rgba(6,182,212,0.7)' }}>
              θ = {metrics.angle.toFixed(1)}°
            </div>
          </>
        )}
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberOverlay.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Confirm the overlay did not disturb the GL log**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberParity.test.jsx`
Expected: PASS, no snapshot written.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/collider/ColliderChamber.jsx src/terminal/collider/__tests__/colliderChamberOverlay.test.jsx
git commit -m "feat(collider): move the chamber readouts to DOM

cos(theta), theta, the novelty bar and the beamline domain labels were
fillText into the canvas. WebGL is bad at text; DOM is crisper and
scales for free. pointer-events-none, so the chamber stays inert.

The font family deliberately changes: the old calls used '9px
monospace', the browser's generic mono, not the project's stack.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: wire the chamber into `LatentCollider` and get the transition out of `draw()`

The behavioural heart of the change. Deleting the Canvas2D loop is mechanical; moving `colliding → result` off the render loop is the fix.

**Files:**
- Create: `src/terminal/collider/usePhaseAdvance.js`
- Test: `src/terminal/collider/__tests__/usePhaseAdvance.test.jsx`
- Modify: `src/terminal/views/LatentCollider.jsx` — delete `:903-904` (`MAX_PARTICLES`), `:1091-1124` (`drawDimensionBeams`, `createParticle`), `:1597-1951` (the whole render effect), and `:2006-2013` (the chamber markup)

**Interfaces:**
- Consumes: `<ColliderChamber>` from Tasks 8-9, `COLLIDE_MS` from Task 5.
- Produces: `usePhaseAdvance(phase: string, startedAt: number, onAdvance: () => void): void` — schedules `onAdvance` once, `COLLIDE_MS` after `startedAt`, only while `phase === 'colliding'`. Self-cancelling on phase change, timestamp change and unmount.

**Why a hook and not a test against `LatentCollider` directly:** reaching `colliding` through the real component means driving `runCollision` (`:1353`), which awaits an 1800ms timer and then `loadWasm()`. Mocking a WASM module to test a `setTimeout` is a bad trade. The transition is extracted into a hook instead — the same shape as this repo's existing `usePhaseJump`, which was extracted from `LunarTab` for exactly this reason. The hook is testable with no WASM, no GL and no frames.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/usePhaseAdvance.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, act, screen } from '@testing-library/react';
import { usePhaseAdvance } from '../usePhaseAdvance';
import { COLLIDE_MS } from '../colliderPhases';

// A host that mirrors how LatentCollider will use the hook.
function Host({ startPhase = 'idle' }) {
  const [phase, setPhase] = useState(startPhase);
  const [startedAt, setStartedAt] = useState(0);
  usePhaseAdvance(phase, startedAt, () => setPhase('result'));
  return (
    <>
      <div data-testid="phase">{phase}</div>
      <button onClick={() => { setPhase('colliding'); setStartedAt(performance.now()); }}>fire</button>
      <button onClick={() => { setPhase('idle'); setStartedAt(performance.now()); }}>reset</button>
    </>
  );
}

const phase = () => screen.getByTestId('phase').textContent;

describe('usePhaseAdvance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('advances colliding -> result with zero frames rendered', () => {
    // The defect this exists for: the old transition fired from inside the
    // Canvas2D draw loop. Under prefers-reduced-motion the loop never starts,
    // so the result card never appeared. No rAF is faked here at all -- if
    // this passes, the transition genuinely does not depend on rendering.
    render(<Host />);
    act(() => { screen.getByText('fire').click(); });
    expect(phase()).toBe('colliding');

    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 1); });
    expect(phase()).toBe('colliding');

    act(() => { vi.advanceTimersByTime(1); });
    expect(phase()).toBe('result');
  });

  it('cancels a pending advance when the phase changes first', () => {
    render(<Host />);
    act(() => { screen.getByText('fire').click(); });
    act(() => { vi.advanceTimersByTime(COLLIDE_MS / 2); });
    act(() => { screen.getByText('reset').click(); });
    act(() => { vi.advanceTimersByTime(COLLIDE_MS * 3); });
    expect(phase()).toBe('idle');
  });

  it('never schedules for a phase that has no timed exit', () => {
    for (const p of ['idle', 'selecting', 'accelerating', 'result']) {
      const spy = vi.spyOn(globalThis, 'setTimeout');
      const { unmount } = render(<Host startPhase={p} />);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
      unmount();
    }
  });

  it('cancels on unmount so a stale advance cannot fire', () => {
    const onAdvance = vi.fn();
    function Bare() { usePhaseAdvance('colliding', 0, onAdvance); return null; }
    const { unmount } = render(<Bare />);
    unmount();
    act(() => { vi.advanceTimersByTime(COLLIDE_MS * 2); });
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('re-arms when the same phase restarts with a new timestamp', () => {
    // Firing a second collision without leaving 'colliding' must reset the
    // clock, not inherit the first one's remaining time.
    const onAdvance = vi.fn();
    function Bare({ at }) { usePhaseAdvance('colliding', at, onAdvance); return null; }
    const { rerender } = render(<Bare at={0} />);
    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 100); });
    rerender(<Bare at={1} />);
    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 100); });
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/collider/__tests__/usePhaseAdvance.test.jsx`
Expected: FAIL — `Failed to resolve import "../usePhaseAdvance"`.

- [ ] **Step 3: Write the hook**

Create `src/terminal/collider/usePhaseAdvance.js`:

```js
// usePhaseAdvance.js — the one phase transition that is driven by a clock.
//
// colliding -> result used to fire from inside the Canvas2D draw loop. That
// coupled a narrative state change to whether a frame happened to render, so
// under prefers-reduced-motion (loop halted by design) or inside a preview
// pane with suspended rAF, the collision would sit in 'colliding' forever and
// the result card would never appear.
//
// Extracted rather than inlined for the same reason usePhaseJump was pulled
// out of LunarTab: reaching this code path through the real component means
// driving a WASM collision, so the behaviour would be effectively untestable
// in place.

import { useEffect } from 'react';
import { COLLIDE_MS } from './colliderPhases';

export function usePhaseAdvance(phase, startedAt, onAdvance) {
  useEffect(() => {
    if (phase !== 'colliding') return undefined;
    // Fires COLLIDE_MS after the transition, not after this effect runs, so a
    // re-render mid-collision cannot extend the collision.
    const remaining = Math.max(0, COLLIDE_MS - (performance.now() - startedAt));
    const id = setTimeout(onAdvance, remaining);
    return () => clearTimeout(id);
    // onAdvance is intentionally absent: callers pass an inline closure, so
    // including it would re-arm the timer on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startedAt]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/collider/__tests__/usePhaseAdvance.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Delete the Canvas2D renderer**

In `src/terminal/views/LatentCollider.jsx`, delete in this order (highest line numbers first, so earlier line numbers stay valid):

1. The chamber markup at `:2006-2013` — the `<div className="relative w-full border …">` opening tag through the `<canvas … />`, keeping the idle-prompt and loading children (they move in step 4).
2. The entire render effect, `:1597-1951` (`// ── Canvas render loop ──` through `}, [domainA, domainB]);`).
3. `createParticle` at `:1115-1124`.
4. `drawDimensionBeams` at `:1091-1113`.
5. `const MAX_PARTICLES = 300;` at `:904`.

Then delete the now-unused refs in the component body: `canvasRef`, `rafRef`, `particlesRef`, `sizeRef`. Keep `phaseRef`, `metricsRef`, `beamsRef` and `timerRef` for now; `timerRef` is removed in step 5.

- [ ] **Step 6: Mount the chamber**

Add the imports at the top of the file:

```jsx
import ColliderChamber from '../collider/ColliderChamber';
import { usePhaseAdvance } from '../collider/usePhaseAdvance';
```

Replace the deleted chamber markup with:

```jsx
      {/* ── Collision Chamber (WebGL) ── */}
      <div className="relative">
        <ColliderChamber
          phase={phase}
          hueA={domainA !== null ? domainById(domainA).hue : 280}
          hueB={domainB !== null ? domainById(domainB).hue : 120}
          selA={domainA !== null}
          selB={domainB !== null}
          labelA={domainA !== null ? domainById(domainA).short : null}
          labelB={domainB !== null ? domainById(domainB).short : null}
          beams={beamsRef.current?.beams ?? null}
          metrics={phase === 'colliding' || phase === 'result' ? metricsRef.current : null}
          phaseStartedAt={phaseStart}
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center border border-dashed border-fuchsia-500/20 rounded-sm px-10 py-6">
              <div className="text-[11px] font-mono text-fuchsia-500/40 uppercase tracking-widest animate-pulse">
                SELECT TWO DOMAINS TO COLLIDE
              </div>
              <div className="text-[9px] font-mono text-cyan-600/30 mt-1">
                1536-dimensional vector intersection · cross-attention synthesis
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-[10px] font-mono text-fuchsia-400 uppercase tracking-widest animate-pulse">
              COMPUTING COLLISION...
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 7: Wire the timestamps and the advance hook, and fix the beam clock**

Add `phaseStart` as real state so the chamber re-renders when a phase begins:

```jsx
  const [phaseStart, setPhaseStart] = useState(0);
```

At every one of the seven sites that assign `phaseRef.current` (`:1357-1359`, `:1487-1489`, `:1540-1541`, `:1555-1556`, `:1574-1575`, `:1588-1592`, and the deleted `:1940`), replace the `timerRef.current = 0;` line with `setPhaseStart(performance.now());` and delete `timerRef` entirely. At `:1487-1489` specifically — the site that enters `colliding` and populates `beamsRef` — also set the beam clock explicitly rather than letting the first draw assign it:

```js
      beamsRef.current = { beams: buildBeams(result, hueA, hueB), startedAt: performance.now() };
      setPhase('colliding');
      phaseRef.current = 'colliding';
      setPhaseStart(performance.now());
```

Then call the hook near the other hooks in the component body — this replaces the deleted `if (ph === 'colliding' && t > 150)` block that used to live inside `draw()`:

```jsx
  usePhaseAdvance(phase, phaseStart, () => {
    phaseRef.current = 'result';
    setPhase('result');
    setPhaseStart(performance.now());
  });
```

- [ ] **Step 8: Confirm the chamber still renders what the parent hands it**

Run: `npx vitest run src/terminal/collider/`
Expected: PASS across all six collider test files, no snapshot written.

- [ ] **Step 9: Run the whole suite and the linter**

Run: `npx vitest run`
Expected: PASS. No snapshot written.
Run: `npm run lint`
Expected: no errors. This catches leftover unused refs and imports from step 5.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/collider/usePhaseAdvance.js src/terminal/collider/__tests__/usePhaseAdvance.test.jsx src/terminal/views/LatentCollider.jsx
git commit -m "feat(collider): mount the WebGL chamber, retire the Canvas2D loop

Deletes ~350 lines of Canvas2D: the 300-particle CPU simulation, the
radial-gradient orbs, the rings, the flash and the fillText readouts.

Moves colliding -> result out of the render loop and onto a timer. It
used to fire from inside draw(), so under prefers-reduced-motion or a
suspended-rAF preview pane the result card would never have appeared at
all. The render loop may read state; it may never write it.

The dimension-beam clock is now captured at the transition that arms it
rather than lazily on first draw, for the same reason.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: reduced-motion coverage and the phase-2 backlog note

**Files:**
- Create: `src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx`
- Modify: `docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx`, following the `matchMedia` pattern from `src/terminal/gl/__tests__/observerEyeReducedMotionMount.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

describe('ColliderChamber under prefers-reduced-motion', () => {
  let rec;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    rec = installRecordingGL({ version: 2 });
  });
  afterEach(() => { rec.restore(); vi.unstubAllGlobals(); });

  it('paints exactly one static frame and never starts the loop', () => {
    render(<ColliderChamber
      phase="colliding" hueA={280} hueB={120} selA selB
      beams={null} metrics={null} phaseStartedAt={0} labelA={null} labelB={null}
    />);
    const draws = rec.log.filter(e => e[0] === 'drawArrays');
    // onSnap paints both passes once. Anything more means the loop ran.
    expect(draws).toHaveLength(2);
    expect(draws[0][1]).toBe(0x0005); // TRIANGLE_STRIP
    expect(draws[1][1]).toBe(0x0000); // POINTS
  });

  it('still shows the phase it was given', () => {
    render(<ColliderChamber
      phase="colliding" hueA={280} hueB={120} selA selB
      beams={null} metrics={{ cosine: 0.5, angle: 60, novelty: 0.4 }}
      phaseStartedAt={0} labelA={null} labelB={null}
    />);
    // The static frame must carry the real phase id, not the idle default --
    // otherwise reduced-motion users see an empty chamber next to a filled
    // result card.
    const phaseUploads = rec.log.filter(e => e[0] === 'uniform1f' && String(e[1]).endsWith('uPhase'));
    expect(phaseUploads.some(e => e[2] === 3)).toBe(true); // PHASE_ID.colliding
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx`
Expected: PASS if `onSnap` was implemented correctly in Task 8; FAIL with `expected [] to have length 2` if `onSnap` was omitted. If it fails, fix `ColliderChamber`'s `onSnap`, not the test.

- [ ] **Step 3: Record the harness findings in the phase-2 backlog**

Append a new section to `docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md`:

```markdown
---

## 12. Multi-program hosts — now measured, still n=2

Added 2026-07-28 by the `/SCENT` collider chamber
(`docs/superpowers/specs/2026-07-28-scent-collider-gl-design.md`).

`glHost.js` builds exactly one program and one fullscreen quad. Two
consumers now build a second program themselves inside `onInit` using the
raw `gl` handle: `LunarShaderMoon`'s `buildBakeProgram` (render-to-texture)
and `ColliderChamber`'s particle pass (`gl.POINTS` from its own VAO and
attribute buffer).

The shared compile/link/throw sequence has been extracted as
`export function buildProgram(gl, vs, fs, { strategy, label })` — but the
*second-program lifecycle* (its VAO, its buffers, its uniform harvest, its
teardown ordering against `dispose()`) is still hand-rolled twice.

**Do not extract it yet.** The two consumers' second programs differ in
kind: the moon's is transient (built, used once, deleted inside `onInit`),
the chamber's is persistent (built at init, bound every frame, freed in
`onDispose`). A shared abstraction over both would have to model both
lifecycles, which is exactly the speculative generality phase 1 existed to
delete. Revisit at a third consumer, or at a second *persistent* one.

**Also landed here, additively, with `glParity` byte-identical:**
- `pixelSize` accepts `{ w, h }` — it was scalar-only, i.e. square canvases
  only. Every prior consumer is square; the chamber is a 220px letterbox.
- `host.resize(w, h)` — re-sizes the backing store and viewport without a
  rebuild.
- `useShaderCanvas` returns `hostRef` alongside `snap`.
```

- [ ] **Step 4: Full verification sweep**

Run: `npx vitest run`
Expected: the entire suite passes. Confirm the output says **no snapshots were written or updated** for `glParity.test.jsx`.

Run: `npm run lint`
Expected: no errors, no warnings (the lint script uses `--max-warnings 0`).

Run: `git diff --stat main -- src/terminal/gl/__tests__/__snapshots__/`
Expected: `glParity.test.jsx.snap` is **absent from the output** — only the new `colliderChamberParity` snapshot file should exist, and it is a new file, not a modification.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/collider/__tests__/colliderChamberReducedMotion.test.jsx docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md
git commit -m "test(collider): lock the reduced-motion static frame

Asserts the loop never starts, onSnap paints both passes exactly once,
and the static frame carries the real phase -- not the idle default,
which would leave reduced-motion users with an empty chamber beside a
filled result card.

Records the multi-program finding in the phase-2 backlog: two consumers
now hand-roll a second program, but their lifecycles differ in kind, so
the abstraction waits for a third.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: browser verification

No test in this plan proves the chamber is beautiful, and three of the defects it fixes are only visible in a real browser.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Use the preview tooling (never `npm run dev` via a shell): `preview_start` with the project's `.claude/launch.json` entry. Navigate to the running origin and enter the tab with `/SCENT` in the nav or by typing `scent` in the terminal.

- [ ] **Step 2: Check the console before looking at anything**

Read console messages. Expected: **no errors**. A GLSL compile failure now *throws* (`strategy: 'lunar'`), so a broken shader appears here as `[colliderChamber] fragment shader failed to compile:` or `[colliderParticles] …` with the driver's log — this is where the `hue2rgbLocal` declaration-order problem noted in Task 7 will surface.

- [ ] **Step 3: Verify the five things tests cannot**

Select two domains and fire a collision, then confirm each:

1. **Timing.** The acceleration takes ~1.8s, not ~0.9s. This is the frame-counter fix and it is the single most important visual check.
2. **No ingress pop.** Particles fade in at the left and right walls rather than appearing abruptly at full size.
3. **No banding.** The central zone glow is smooth, with no concentric steps. Check on the OLED display specifically.
4. **Readout alignment.** `cos(θ)`, `θ` and the novelty bar sit where they used to; the beamline labels sit at the ends of their beams.
5. **Helix and turbulence are visible.** The streams should visibly twist and deflect as they converge, not travel in straight lines.

- [ ] **Step 4: Screenshot the impact and the result state**

Capture both for the author's review.

- [ ] **Step 5: Resize the window**

Drag the window narrow and wide. The chamber should re-size smoothly with no flash, no blank frame, and no console output — proving `host.resize()` is being used and the host is not rebuilding.

- [ ] **Step 6: Report to the author**

Post the screenshots and the five checks. **Do not merge.** The author's own look is the gate (spec §9.6).
