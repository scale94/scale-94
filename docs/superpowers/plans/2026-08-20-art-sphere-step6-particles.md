# /art sphere — Step 6: the particle ecology onto the GPU

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans`
> to implement this task-by-task. Steps use checkbox (`- [ ]`) syntax.
> This branch's own method takes precedence where it differs: a task is not done
> until it has been MEASURED, and a measurement is not admissible until the
> capture set it came from carries a same-build null.

**Goal:** move the particle ecology's two draw layers off the 2-D canvas and into
the existing GL additive instance stream, at measured visual parity.

**Architecture:** particles become more instances of the disc primitive the node
halo and core already use — no new mesh, no new material, no stride bump. The one
thing the primitive cannot currently express is the particle glow's three-stop
radial gradient, and the instance layout has exactly the five spare floats that
needs, reserved for this in step 4.

**Tech Stack:** react-three-fiber 9.5, three 0.183, Vitest 4, CDP harness
(`scripts/artBaseline.mjs`, `artNull.mjs`, `artCompare.mjs`, `artInk.mjs`,
`artSmoke.mjs`, `artPresence.mjs`).

## Global Constraints

- **Reference:** `baseline/art-sphere-step5-certified/`. It is certified (21/21,
  worst pair 0.9775). Nothing else on this branch may be used as a step-6
  reference.
- **A WIP set must be certified before any of its numbers are quoted.** Three
  captures minimum: `artNull a b c --write a`. `--ungated` is for iterating on
  the harness, never for a number that reaches a report or a commit message.
- **Do not push, do not merge, do not touch `main`.**
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.
- Backticks inside a template literal terminate the string. `SphereEdges.js` is
  mostly GLSL inside template literals; `determinism.mjs` is one big one.
- Lint ratchet is 153 warnings, currently 144. A new warning is yours.
  `npm run lint` is `--ext js,jsx` and **does not lint `.mjs` at all**.

---

## PRE-FLIGHT — what the block actually is

Done 2026-08-20 against `b477fb7`. Read this before the spec, which is wrong
about what follows this step.

**The live block is `ArtTab.jsx:1974`–`:2021`.** Two emission calls and one draw
loop:

```js
if (pFrame % 3 === 0) emitIdleParticles(pool, nodes);
if (pFrame % 7 === 0) emitIdleParticles(pool, nodes);

ctx.save();
ctx.globalCompositeOperation = 'lighter';
for (let pi = 0; pi < MAX_PARTICLES; pi++) {
  if (pool.lifes[pi] >= pool.maxLifes[pi] || pool.maxLifes[pi] === 0) continue;
  const lifeT = pool.lifes[pi] / pool.maxLifes[pi];
  let alpha;
  if (lifeT < 0.15)      alpha = (lifeT / 0.15) * (lifeT / 0.15);      // quadratic ease-in
  else if (lifeT > 0.70) alpha = Math.pow(1 - (lifeT - 0.70) / 0.30, 2.2); // power ease-out
  else                   alpha = 1.0;
  alpha *= 0.55;
  if (alpha < 0.004) continue;

  const [prx, pry, prz] = applyM(M, pool.xs[pi], pool.ys[pi], pool.zs[pi]);
  const pp = project(prx, pry, prz, w, h, sphereR, focal);
  if (pp.depth < -0.6) continue;                    // cull deep back-face

  const sz  = Math.max(0.4, pool.sizes[pi] * pp.scale);
  const hue = pool.hues[pi];
  const sat = pool.sats[pi];

  const glowR = sz * 3.5;                           // GLOW: three-stop radial gradient
  const gGrd = ctx.createRadialGradient(pp.sx, pp.sy, 0, pp.sx, pp.sy, glowR);
  gGrd.addColorStop(0,   `hsla(${hue|0},${sat|0}%,82%,${alpha.toFixed(3)})`);
  gGrd.addColorStop(0.4, `hsla(${hue|0},${sat|0}%,65%,${(alpha*0.5).toFixed(3)})`);
  gGrd.addColorStop(1,   `hsla(${hue|0},${sat|0}%,50%,0)`);
  ctx.fillStyle = gGrd;
  ctx.beginPath(); ctx.arc(pp.sx, pp.sy, glowR, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = `hsla(${hue|0},${sat|0}%,92%,${(alpha*0.8).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(pp.sx, pp.sy, sz, 0, Math.PI * 2); ctx.fill();
}
ctx.restore();
```

### Findings, in order of how much they change the work

**1. Two sub-layers, not one "sprite".** The spec says "instanced sprites,
uploading `artParticles.js`'s existing `Float32Array` SoA buffers directly". The
buffers are model-space positions on a unit sphere; every particle is
`applyM` → `project`ed on the CPU each frame and drawn as **two** discs at
different radii, colours and alphas. This is the fifth time the spec has
understated a block.

**2. The glow is a genuine COLOUR ramp, and the disc primitive cannot express
it.** The node halo — migrated in step 5 — was a single-colour
`createRadialGradient`, so `falloffInner` reproduced it exactly by ramping
*coverage*. The particle glow darkens as it fades: lightness **82% → 65% → 50%**
with alpha **a → a/2 → 0**, and the knee is at **t = 0.4**, not the midpoint.
Ramping coverage alone reproduces the alpha and not the darkening.
**This is the one real piece of new work in step 6.**

**3. The layout has exactly the room, and says so.** `DISC_RESERVED` names five
floats that must be zero on a disc — `c1+1`, `c1+2`, `c2`, `c2+1`, `c2+2` — and
its own comment reads: *"Reserved rather than assigned, so a later step can take
them without a stride bump."* A mid stop needs colour (3) + position (1) + one
spare. The three alphas are already packed by `packAlphas(a0, a1, a2)` and
currently written flat for discs, so **the alpha ramp costs nothing at all**.

**4. Capacity is a non-issue.** `MAX_ADDITIVE_EDGES` is **81,882**. Particles
need at most `MAX_PARTICLES * 2 = 800`.

**5. Draw order is free.** `lighter` is commutative, so where particles sit
within the additive stream does not matter. Appending after the node loop
preserves the 2-D order regardless.

**6. The accumulation gain is preserved — check it anyway.** `BackdropPass`
takes `additiveStateRef` and renders **into the trail accumulator**
(`SphereTrail`), so a layer moved to the additive stream keeps the `1/m`
standing gain that the 2-D canvas's partial `destination-out` clear gave it.
This is the deficit that cost steps 3 and 4; it should not recur, and Task 5
measures rather than assumes it.

**7. Two quantisations the canvas performs and a float port will not.**
`hue|0` and `sat|0` truncate to integers, and every alpha goes through
`.toFixed(3)` because it is serialised into an `hsla()` string. A port passing
full floats is *more* precise and therefore **not** at parity. Reproduce both.

**8. THE CANVAS IS NOT EMPTY AFTER THIS STEP.** `ArtTab.jsx:2024` calls
`drawConductor(ctx, …)` → `artAwakening.js`, which holds **28 `ctx.` calls**.
The spec's *"The 2-D canvas is now empty: delete it, its texture and the
composite quad"* is **wrong for the third time on this branch**.
`baseline/art-sphere-step5/README.md` already recorded this ("Still 2D, for step
6: the particle ecology **and the conductor**"). **Do not delete the canvas.**
The full remaining 2-D surface after step 6 is three sites: `:931`
`setTransform`, `:947`–`:951` the `destination-out` clear, and the conductor.

**9. Particle colour cannot be measured off the ambient stream.** `_idleHueDrift`
(`artParticles.js:71`) is a module-level mount-time accumulator that
`__artHarnessReset` does not clear, and it sets particle hue. Clearing it was
tried and **the measurement refused it** — it makes `idle`'s per-channel spread
~2.5× worse (see `handover-post-rng.md`). Particle hue is not reproducible run to
run either way. **Task 1 exists because of this**: parity must be measured on a
forced, deterministic emission.

---

## File Structure

| file | responsibility | change |
|---|---|---|
| `src/terminal/art/SphereEdges.js` | instance encoding + both shaders | extend the disc branch with a mid gradient stop |
| `src/terminal/art/artParticles.js` | the SoA pool and emitters | unchanged |
| `src/terminal/art/artParticleDraw.js` | **new** — the per-particle alpha/size/colour laws, extracted pure so a test can pin them | create |
| `src/terminal/views/ArtTab.jsx` | the draw loop | replace the `ctx.` block with instance writes; add census + forcing hook |
| `src/terminal/art/__tests__/artParticleDraw.test.js` | the laws | create |
| `src/terminal/art/__tests__/sphereEdges.test.js` | encoding invariants | extend |
| `scripts/artPresence.mjs` | layer-presence gate | add a PARTICLE GLOW / PARTICLE CORE check |

---

## Task 1: A deterministic particle probe

Without this, nothing below can be measured: the ambient emitter's hue is not
reproducible, and no capture state asserts particles are on screen at all. This
is the branch's defining failure mode — nine of thirteen node layers were in no
capture state — and it is being closed *before* the migration rather than after.

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` (census block `:1571`–`:1576`, hooks near `:2294`, cleanup near `:2455`)
- Test: manual, via `node scripts/artPresence.mjs`

**Interfaces:**
- Produces: `window.__artForceParticles(specs)` where
  `specs = [{ x, y, z, hue, sat, size, life, maxLife }]` — writes them straight
  into the pool at fixed indices, bypassing `emitIdleParticles` and therefore
  bypassing `artRandom` and `_idleHueDrift` entirely.
- Produces: census fields `particleGlow` and `particleCore` (numbers).

- [ ] **Step 1: Add the two census fields**

In the reset block at `ArtTab.jsx:1571`, alongside the existing counters:

```js
      _cen.particleGlow = 0; _cen.particleCore = 0;
```

- [ ] **Step 2: Add the forcing hook**

Next to `window.__artSetDiscProbe` (`:2294`), inside the `import.meta.env.DEV`
guard:

```js
    // Particles with KNOWN hues, positions and lives, written straight into the
    // pool. The ambient emitter cannot serve a measurement: `_idleHueDrift`
    // (artParticles.js:71) is a mount-time accumulator the harness reset does
    // not clear, so ambient particle HUE differs run to run — measured, and
    // measured again after trying to clear it, which made things worse. A
    // parity claim about a colour ramp needs the colour pinned.
    window.__artForceParticles = (specs = []) => {
      const p = particlesRef.current;
      for (let i = 0; i < p.maxLifes.length; i++) p.maxLifes[i] = 0;  // kill the pool
      specs.forEach((s, i) => {
        if (i >= p.xs.length) return;
        p.xs[i] = s.x; p.ys[i] = s.y; p.zs[i] = s.z;
        p.vxs[i] = 0; p.vys[i] = 0; p.vzs[i] = 0;
        p.hues[i] = s.hue; p.hueTargets[i] = s.hue;   // no drift: a pinned colour
        p.sats[i] = s.sat; p.sizes[i] = s.size;
        p.lifes[i] = s.life; p.maxLifes[i] = s.maxLife;
      });
      p.count = specs.length;
    };
```

and the matching `delete window.__artForceParticles;` in the cleanup near `:2455`.

- [ ] **Step 3: Increment the census in the existing 2-D loop**

Still the 2-D draw, so this measures the BEFORE. After the glow `ctx.fill()` add
`_cen.particleGlow++;` and after the core `ctx.fill()` add `_cen.particleCore++;`.

- [ ] **Step 4: Verify the hook and census work on the unmigrated build**

```bash
node scripts/artSmoke.mjs
```
Expected: 10/10, console errors 0.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(art): a deterministic particle probe, before the layer moves"
```

---

## Task 2: Extract the particle draw laws, with tests

**Files:**
- Create: `src/terminal/art/artParticleDraw.js`
- Create: `src/terminal/art/__tests__/artParticleDraw.test.js`
- Modify: `src/terminal/views/ArtTab.jsx` (the block uses the extracted functions)

**Interfaces:**
- Produces: `particleAlpha(lifeT) -> number`, `particleVisible(alpha) -> boolean`,
  `particleSize(size, scale) -> number`, `particleGlowRadius(sz) -> number`,
  `GLOW_STOPS`, `CORE_LIGHTNESS`, `quantHue(h) -> int`, `quantAlpha(a) -> number`.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import {
  particleAlpha, particleVisible, particleSize, particleGlowRadius,
  quantHue, quantAlpha, GLOW_STOPS, CORE_LIGHTNESS,
} from '../artParticleDraw.js';

describe('particleAlpha', () => {
  it('eases in quadratically over the first 15% of life', () => {
    expect(particleAlpha(0)).toBeCloseTo(0, 10);
    expect(particleAlpha(0.075)).toBeCloseTo(0.25 * 0.55, 10);   // (0.5)^2 * 0.55
    expect(particleAlpha(0.15)).toBeCloseTo(0.55, 10);
  });
  it('holds flat between 15% and 70%', () => {
    expect(particleAlpha(0.3)).toBeCloseTo(0.55, 10);
    expect(particleAlpha(0.70)).toBeCloseTo(0.55, 10);
  });
  it('eases out with a 2.2 power over the last 30%', () => {
    expect(particleAlpha(0.85)).toBeCloseTo(Math.pow(0.5, 2.2) * 0.55, 10);
    expect(particleAlpha(1.0)).toBeCloseTo(0, 10);
  });
});

describe('particleVisible', () => {
  it('culls below the canvas threshold the 2D loop used', () => {
    expect(particleVisible(0.0039)).toBe(false);
    expect(particleVisible(0.004)).toBe(true);
  });
});

describe('particleSize', () => {
  it('scales with depth but never below the 0.4px floor', () => {
    expect(particleSize(2, 1.5)).toBeCloseTo(3, 10);
    expect(particleSize(0.1, 0.5)).toBeCloseTo(0.4, 10);
  });
});

describe('particleGlowRadius', () => {
  it('is 3.5x the core', () => {
    expect(particleGlowRadius(2)).toBeCloseTo(7, 10);
  });
});

describe('the canvas quantisations', () => {
  // hsla() takes an integer hue and sat in the 2D draw (`hue|0`), and every
  // alpha goes through toFixed(3) because it is serialised into a string. A
  // float port is MORE precise and therefore not at parity.
  it('truncates hue toward zero, as `|0` does', () => {
    expect(quantHue(214.99)).toBe(214);
    expect(quantHue(0.9)).toBe(0);
  });
  it('quantises alpha to three decimals, as toFixed(3) does', () => {
    expect(quantAlpha(0.5499999)).toBeCloseTo(0.55, 10);
    expect(quantAlpha(0.0004)).toBeCloseTo(0, 10);
  });
});

describe('the glow ramp', () => {
  it('is the three stops the canvas gradient declares', () => {
    expect(GLOW_STOPS).toEqual([
      { at: 0,   lightness: 82, alphaScale: 1 },
      { at: 0.4, lightness: 65, alphaScale: 0.5 },
      { at: 1,   lightness: 50, alphaScale: 0 },
    ]);
    expect(CORE_LIGHTNESS).toBe(92);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/terminal/art/__tests__/artParticleDraw.test.js
```
Expected: FAIL — cannot resolve `../artParticleDraw.js`.

- [ ] **Step 3: Write the module**

```js
// artParticleDraw.js — the particle layer's draw laws, extracted so they can be
// pinned by a test and shared by the 2D loop and the GL writer without a second
// copy drifting from the first.
//
// Every number here is the canvas's, including the two quantisations it
// performs by accident: `hue|0` truncates because hsla() is built from a string,
// and every alpha goes through toFixed(3) for the same reason. A GL port that
// passes full floats is MORE precise than the thing it is copying, which is a
// parity failure in the direction nobody thinks to check.

export const ALPHA_SCALE = 0.55;
export const FADE_IN_END = 0.15;
export const FADE_OUT_START = 0.70;
export const FADE_OUT_POWER = 2.2;
export const ALPHA_CULL = 0.004;
export const SIZE_FLOOR = 0.4;
export const GLOW_MULT = 3.5;
export const CORE_LIGHTNESS = 92;
export const CORE_ALPHA_SCALE = 0.8;

export const GLOW_STOPS = [
  { at: 0,   lightness: 82, alphaScale: 1 },
  { at: 0.4, lightness: 65, alphaScale: 0.5 },
  { at: 1,   lightness: 50, alphaScale: 0 },
];

export function particleAlpha(lifeT) {
  let a;
  if (lifeT < FADE_IN_END) {
    const u = lifeT / FADE_IN_END;
    a = u * u;
  } else if (lifeT > FADE_OUT_START) {
    a = Math.pow(1 - (lifeT - FADE_OUT_START) / (1 - FADE_OUT_START), FADE_OUT_POWER);
  } else {
    a = 1.0;
  }
  return a * ALPHA_SCALE;
}

export const particleVisible = (alpha) => alpha >= ALPHA_CULL;
export const particleSize = (size, scale) => Math.max(SIZE_FLOOR, size * scale);
export const particleGlowRadius = (sz) => sz * GLOW_MULT;
export const quantHue = (h) => h | 0;
export const quantAlpha = (a) => Number(a.toFixed(3));
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/terminal/art/__tests__/artParticleDraw.test.js
```
Expected: PASS, 11 tests.

- [ ] **Step 5: Rewire the 2-D block to use them, changing nothing**

Replace the inline arithmetic in `ArtTab.jsx:1979`–`:2021` with calls to
`particleAlpha`, `particleVisible`, `particleSize`, `particleGlowRadius`, and
build the `hsla()` strings from `GLOW_STOPS` / `CORE_LIGHTNESS`. **The canvas
output must not change**: this is a refactor, and Step 6 proves it.

- [ ] **Step 6: Prove the refactor moved nothing**

```bash
node scripts/artBaseline.mjs --out baseline/s6t2-a --scale laptop-1520x900@2x
node scripts/artBaseline.mjs --out baseline/s6t2-b --scale laptop-1520x900@2x
node scripts/artBaseline.mjs --out baseline/s6t2-c --scale laptop-1520x900@2x
node scripts/artNull.mjs baseline/s6t2-a baseline/s6t2-b baseline/s6t2-c --write baseline/s6t2-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/s6t2-a
```
Expected: null 7/7; compare `ok` on all 7 rows of that scale with **mean under
0.05** — an extraction that changes no arithmetic should be near-identical, not
merely inside the threshold of 4.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/art/artParticleDraw.js src/terminal/art/__tests__/artParticleDraw.test.js src/terminal/views/ArtTab.jsx
git commit -m "refactor(art): the particle draw laws, extracted and pinned"
```

---

## Task 3: A mid stop for the disc gradient — encoding

The disc branch today carries one colour and a coverage ramp. The particle glow
needs a colour ramp with a knee at 0.4. **This lands unwired**, with tests, and
Task 4 flips the shader — the same two-commit discipline `writeDisc` itself used,
and for the same reason: an encoding whose reader does not yet understand it
draws garbage.

**Files:**
- Modify: `src/terminal/art/SphereEdges.js` (`DISC_OFF` `:433`, `DISC_RESERVED` `:449`, `writeDisc` `:473`, `discEncodingInvariant` `:525`)
- Modify: `src/terminal/art/__tests__/sphereEdges.test.js`

**Interfaces:**
- Produces: `DISC_OFF.midR`, `DISC_OFF.midStop` and a `mid` option on
  `writeDisc({ …, mid: { at, rgb|hsl, alpha } })`.
- `DISC_RESERVED` shrinks to the floats still required to be zero.

- [ ] **Step 1: Write the failing test**

```js
it('writes a mid gradient stop into the floats reserved for it', () => {
  const out = new Float32Array(EDGE_STRIDE);
  writeDisc(out, 0, {
    cx: 10, cy: 20, rOuter: 8, falloffInner: 0,
    rgb: [1, 0.5, 0.25], alpha: 0.6,
    mid: { at: 0.4, rgb: [0.5, 0.25, 0.125], alpha: 0.3 },
  });
  const d = readDisc(out, 0);
  expect(d.mid.at).toBeCloseTo(0.4, 6);
  expect(d.mid.alpha).toBeCloseTo(0.3, 3);
  expect(discEncodingInvariant(out, 0)).toEqual([]);
});

it('leaves a disc with no mid stop byte-identical to before', () => {
  const withMid = new Float32Array(EDGE_STRIDE);
  const without = new Float32Array(EDGE_STRIDE);
  const args = { cx: 1, cy: 2, rOuter: 4, rgb: [1, 1, 1], alpha: 0.5 };
  writeDisc(withMid, 0, { ...args, mid: null });
  writeDisc(without, 0, args);
  expect(Array.from(withMid)).toEqual(Array.from(without));
});

it('rejects a mid stop outside (0,1)', () => {
  const out = new Float32Array(EDGE_STRIDE);
  writeDisc(out, 0, {
    cx: 0, cy: 0, rOuter: 4, rgb: [1, 1, 1], alpha: 1,
    mid: { at: 1.5, rgb: [1, 1, 1], alpha: 1 },
  });
  expect(discEncodingInvariant(out, 0)).toContain('mid stop is outside (0,1)');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/terminal/art/__tests__/sphereEdges.test.js -t "mid"
```
Expected: FAIL — `d.mid` undefined.

- [ ] **Step 3: Take two of the reserved floats and the third alpha**

`DISC_OFF` gains `midStop: EDGE_OFF.c1 + 1` (position in 0..1) and the mid colour
goes in `c2` (three floats). The mid ALPHA needs no float: `packAlphas` already
carries three and discs currently write them flat, so write
`packAlphas(alpha, midAlpha, 0)`. `c1 + 2` stays reserved.

Update `DISC_RESERVED` to `[EDGE_OFF.c1 + 2]` and extend
`discEncodingInvariant` with the `(0,1)` check and "mid colour set with no mid
stop".

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/terminal/art/__tests__/sphereEdges.test.js
```
Expected: PASS, including every pre-existing disc test — the no-mid path must be
byte-identical.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/art/__tests__/sphereEdges.test.js
git commit -m "feat(art): a mid gradient stop for discs, unwired

The layout reserved five floats for exactly this in step 4 and said so. Takes
one of them plus the two alpha slots discs already carry and write flat. Ships
unwired: the shader reads it in the next commit, and an encoding whose reader
does not understand it draws garbage."
```

---

## Task 4: The shader reads the mid stop

The first shader change since step 4 task 3. A **segment must collapse to exactly
the arithmetic it has today** — the file's own standard, stated at the disc
branch: *"a SEGMENT (which carries vDisc = vec4(0)) collapses through each one to
exactly the arithmetic it had before any of this existed."*

**Files:**
- Modify: `src/terminal/art/SphereEdges.js` (`EDGE_VERT` varyings `:699`–`:749`, `EDGE_FRAG` radial section `:918`–`:924`)

- [ ] **Step 1: Carry the mid stop and mid colour to the fragment stage**

In `EDGE_VERT`, multiply by `isDiscV` exactly as `vDisc` already is, so a
segment carries zero and every expression below collapses:

```glsl
    vDiscMid = vec4(aC2, aPack.x /* midStop, unpacked */) * isDiscV;
```

- [ ] **Step 2: Ramp colour and alpha radially, with the knee where the canvas put it**

In `EDGE_FRAG`, after the existing `ramp` computation, using the SAME radial
coordinate the falloff uses:

```glsl
    // THE GLOW'S COLOUR RAMP. The halo migrated in step 5 was a single-colour
    // createRadialGradient, so ramping COVERAGE reproduced it exactly. The
    // particle glow darkens as it fades — 82% to 65% to 50% lightness, knee at
    // 0.4 — so coverage alone is wrong everywhere except the two endpoints.
    // Non-premultiplied, matching the linear-gradient path above and the
    // canvas; see the task report for the measurement that settled which.
    float u = clamp(r / max(vHalfW, 1e-6), 0.0, 1.0);
    float m = vDiscMid.w;
    float mu = m > 1e-6
      ? (u < m ? u / m * 0.5 : 0.5 + (u - m) / max(1.0 - m, 1e-6) * 0.5)
      : u;
    // reuse the existing three-stop machinery by feeding it `mu` instead of `t`
```

Then select between the segment's `t` and the disc's `mu` with
`mix(t, mu, vIsDisc)` at the single existing gradient site, so there is **one**
gradient implementation, not two.

- [ ] **Step 3: Prove a segment did not move**

```bash
npx vitest run
node scripts/artPresence.mjs
```
Expected: full suite green; presence **19/19**. Presence exercises every edge
and ring layer, so a segment that shifted shows here.

- [ ] **Step 4: Prove the pixels did not move either**

```bash
node scripts/artBaseline.mjs --out baseline/s6t4-a --scale laptop-1520x900@2x
node scripts/artBaseline.mjs --out baseline/s6t4-b --scale laptop-1520x900@2x
node scripts/artBaseline.mjs --out baseline/s6t4-c --scale laptop-1520x900@2x
node scripts/artNull.mjs baseline/s6t4-a baseline/s6t4-b baseline/s6t4-c --write baseline/s6t4-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/s6t4-a
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/s6t4-a
```
Expected: 7/7 admissible; **ink ratio within the same-build band on every row**.
Nothing writes a mid stop yet, so any movement here is a regression in the
segment path and must be found before Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/SphereEdges.js
git commit -m "feat(art): the disc branch reads its mid gradient stop"
```

---

## Task 5: Move the particle block

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx:1974`–`:2021`

- [ ] **Step 1: Replace the two `ctx` fills with two instance writes**

Into the ADDITIVE stream (`ag`), appended after the node loop, guarded by the
same cap pattern the node halo uses (`ag.count < edgeCapacity(ag)`), so a
particle dropped at the cap cannot have its core written without its glow.

The glow: `rOuter = particleGlowRadius(sz)`, `falloffInner = 0`, `c0` = the 82%
colour, `alpha` = `quantAlpha(alpha)`, `mid = { at: 0.4, colour at 65%,
alpha: quantAlpha(alpha * 0.5) }`, and the outer stop's alpha 0 via
`packAlphas`. The core: `rOuter = sz`, no mid, colour at 92% lightness,
`alpha = quantAlpha(alpha * CORE_ALPHA_SCALE)`.

Hue and sat go through `quantHue` on both. Increment `_cen.particleGlow` and
`_cen.particleCore` exactly where the `ctx.fill()`s used to be.

- [ ] **Step 2: Prove the block contains no canvas API at all**

```bash
grep -n "ctx\." src/terminal/views/ArtTab.jsx | sed -n '1,40p'
```
Expected: exactly three sites remain — `:931` `setTransform`, the
`destination-out` clear, and `drawConductor(ctx, …)`. **The conductor is
supposed to still be there.** Anything else is a layer that was missed.

- [ ] **Step 3: Smoke and presence**

```bash
node scripts/artSmoke.mjs
node scripts/artPresence.mjs
```
Expected: 10/10 and 19/19.

- [ ] **Step 4: Capture, certify, compare**

```bash
node scripts/artBaseline.mjs --out baseline/s6wip-a
node scripts/artBaseline.mjs --out baseline/s6wip-b
node scripts/artBaseline.mjs --out baseline/s6wip-c
node scripts/artNull.mjs baseline/s6wip-a baseline/s6wip-b baseline/s6wip-c --write baseline/s6wip-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/s6wip-a
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/s6wip-a
```

**`artCompare` alone is not sufficient and this branch has proved it four
times.** A 22% edge-ink loss, an sRGB-vs-linear blend of the whole backdrop and
the entire trail-accumulation deficit all scored 21/21 green. `artInk` is the
gate that matters here: particles draw with `lighter` across the whole disc and
are, by `artInk`'s own accumulation arithmetic, the layer with the most to lose.
**Read the `frame` column for immersive and the `disc` column for normal** —
`trail-deficit.md` §1 rules the disc column inadmissible in immersive.

- [ ] **Step 5: The accumulation check, explicitly**

The additive stream renders into the trail accumulator, so the `1/m` standing
gain should survive. Do not assume it. Compare normal-mode `disc` ink against
the certified reference: a ratio near **0.72** rather than **1.00** is the
accumulation deficit, not a dim shader, and it means the particles are being
written outside the accumulator.

- [ ] **Step 6: Look at it**

Open `baseline/art-sphere-step5-certified/laptop-1520x900@2x__idle.png` and the
WIP's beside it. Numbers have pointed the wrong way three times on this branch
and two PNGs killed it in a minute each time.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(art): step 6 — the particle ecology on the GPU"
```

---

## Task 6: A presence check for both particle sub-layers

Nine of thirteen node layers were in no capture state, and that is this branch's
defining failure. Particles must not join them.

**Files:**
- Modify: `scripts/artPresence.mjs`

- [ ] **Step 1: Add PARTICLE GLOW and PARTICLE CORE checks**

Force a known emission with `__artForceParticles`, step one frame, and assert
each sub-layer from its own signature: the core is a hard-edged filled disc of
radius `sz`, the glow is a falloff of radius `3.5 * sz` whose lightness drops
82 → 65 → 50 across the ramp. Assert the **ramp**, not just presence — a glow
that renders at a flat 82% passes a presence test and fails parity.

- [ ] **Step 2: Run it**

```bash
node scripts/artPresence.mjs
```
Expected: **21/21**.

- [ ] **Step 3: Commit**

```bash
git add scripts/artPresence.mjs
git commit -m "test(art): the particle layers can be seen by the gate"
```

---

## Task 7: Re-capture the reference, and correct the spec

- [ ] **Step 1: Five sets, certified**

```bash
node scripts/artBaseline.mjs --out baseline/s6final-a    # …-b …-c …-d …-e
node scripts/artNull.mjs baseline/s6final-a … --write baseline/s6final-a
```
Expected: 21/21, worst pair above 0.97, all cells agreeing on the world hash.

- [ ] **Step 2: Correct the spec**

`docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 6 says the
2-D canvas is empty after this step. **It is not**, and this is the third time
the spec has been wrong about a block. Replace that sentence with the measured
list: `setTransform`, the `destination-out` clear, and the conductor's 28 `ctx.`
calls. Phase 1 does not end here.

- [ ] **Step 3: Write the task report**

`.superpowers/sdd/step6-report.md`, following the branch's form: what the block
was, what moved, what was measured, what was refused, what is left.

---

## Self-review against the spec

- §Step 6 "particle ecology → instanced sprites" → Tasks 3–5. **Amended**: the
  buffers are not uploaded directly; positions are CPU-projected per frame and
  each particle is two discs.
- §Step 6 "the trail moves to a GL feedback buffer" → already done 2026-08-10.
- §Step 6 "the 2-D canvas is now empty: delete it" → **REFUSED, with evidence.**
  Task 7 Step 2 corrects the spec instead.
- §6 Verification items 1–5 → Tasks 2, 4, 5 (captures, side-by-side, artInk,
  smoke). Frame time is NOT covered here: `artFrameTime.mjs` runs headed on the
  real GPU and the step-4 baseline mixes headed-GPU and headless-SwiftShader
  numbers 2–3× apart. If a frame-time claim is wanted, capture a fresh headed
  control in the same session and read the `renderer` field first.
