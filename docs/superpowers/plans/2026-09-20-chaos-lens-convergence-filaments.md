# Chaos Sphere: Lens, Convergence and Filaments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CHAOS sphere's clickable nodes read as smoked glass, make every wire that reaches one converge cleanly into it, and give the particle layer real motion, arrival and velocity stretching.

**Architecture:** Four independent visual changes to an existing instanced-quad WebGL edge mesh (`src/terminal/art/SphereEdges.js`) and the draw loop that feeds it (`src/terminal/views/ArtTab.jsx`). Three of the four need no new per-instance floats: the lens reuses the three-stop radial ramp built in step 6 for the particle glow, and the wire taper rides a spare bit in the dash-duty byte plus one material uniform. Only the particle work adds state, and it adds it to the CPU-side SoA pool where the determinism instruments can still see it.

**Tech Stack:** React 18, three.js + @react-three/fiber, raw GLSL (WebGL1-style attributes on an `InstancedInterleavedBuffer`), Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-chaos-lens-convergence-filaments-design.md`

## Global Constraints

- **Branch:** `feature/chaos-lens-convergence-filaments`. Do not merge or push. Pushing requires an explicit instruction from the user; verification approval is not push consent.
- **`EDGE_STRIDE` stays 18.** No task in this plan may widen the instance layout. `DISC_RESERVED` is empty — step 6 consumed the last five spare floats — so a stride bump is a design change, not an implementation detail.
- **Never symmetrise `edgeStops`.** The 2.2x end-alpha spread is an authored directional readout of edge strength, documented in `artEdges.js`.
- **Tests:** `npm test` (vitest run) must be green before every commit.
- **Lint:** `npm run lint`. Read the **printed** error count from the terminal; never judge it from a piped tail. The ceiling is `--max-warnings 153`.
- **Rate laws compose.** Any new per-frame decay or approach must be expressed through `decayOverFrames` / `driftOverFrames` in `src/terminal/art/artRateGate.js` so that N sub-steps of `dt/N` equal one step of `dt`. A `dt = 1` assertion cannot detect a rate bug — the broken and correct factors are equal there.
- **Never edit any file while `artBaseline` is running.** Vite will HMR the edit into the page mid-capture. The tell is two different `gitCommit` stamps across the manifests.
- **Commit trailer:** every commit message ends with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility | Tasks |
| --- | --- | --- |
| `src/terminal/art/artEdges.js` | Prism geometry constants; edge width/alpha laws; the new `EDGE_TAPER_PX` | 1, 5 |
| `src/terminal/art/artNodes.js` | Node layer maths; the new lens ramp law | 2 |
| `src/terminal/art/SphereEdges.js` | Instance encoding (`packFlags`/`unpackFlags`), `EDGE_VERT`, `edgeFrag`, layer construction and sync | 4, 5 |
| `src/terminal/art/artParticles.js` | Particle pool, emitters, integrator | 6, 7 |
| `src/terminal/art/artParticleDraw.js` | Particle draw laws; the new streak law | 8 |
| `src/terminal/views/ArtTab.jsx` | The draw loop — every write into the two instance buffers | 1, 2, 5, 8 |

---

### Task 1: Prism convergence

Seven spectral lines are rigidly translated by `(k-3) * 2.8` px at **both** endpoints and at the control point. The endpoint offsets go; the control offset absorbs them so the mid-chord fan width is preserved exactly.

**Files:**
- Modify: `src/terminal/art/artEdges.js:216-219` (constants)
- Modify: `src/terminal/views/ArtTab.jsx:1779-1780` (endpoint offsets), `:99` (import)
- Test: `src/terminal/art/__tests__/artEdges.test.js:789-800` (existing `prismControl` test)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PRISM_CP_OFF_X = 3`, `PRISM_CP_OFF_Y = 2.0`; `PRISM_END_OFF_Y` no longer exported.

- [ ] **Step 1: Update the failing test to the new expected control point**

A quadratic weights its control point at 1/2 at `t = 0.5`, so the mid-chord offset contribution is `(end + 2*cp + end) / 4`. Preserving it means `x: (1 + 2*2 + 1)/4 = 1.5 -> (0 + 2*3 + 0)/4 = 1.5` and `y: (0.6 + 2*1.4 + 0.6)/4 = 1.0 -> (0 + 2*2.0 + 0)/4 = 1.0`.

In `src/terminal/art/__tests__/artEdges.test.js`, replace the body of the test named `pulls the control point 55% toward the sphere centre, from the UNSHIFTED midpoint`:

```js
  it('pulls the control point 55% toward the sphere centre, from the UNSHIFTED midpoint', () => {
    // The chord's ENDPOINTS now sit on the node centres and the whole spectral
    // offset lives in the control point, so the bundle fans from a point
    // instead of arriving as a parallel comb. The mid-chord width is
    // unchanged: a quadratic weights its control point at 1/2 at t = 0.5, so
    // (0 + 2*3 + 0)/4 = 1.5 is exactly what (1 + 2*2 + 1)/4 used to give.
    //   mid (200,300), centre (760,450), offset 2.8
    //   cpx = 200 + 560*0.55 + 2.8*3.0 = 516.4
    //   cpy = 300 + 150*0.55 + 2.8*2.0 = 388.1
    const out = [0, 0];
    prismControl(out, 100, 200, 300, 400, 760, 450, 2.8);
    expect(out[0]).toBeCloseTo(516.4, 10);
    expect(out[1]).toBeCloseTo(388.1, 10);
  });
```

Add a second test directly beneath it that pins the invariant rather than the literals:

```js
  it('preserves the mid-chord fan width now that the endpoints converge', () => {
    // The mid-chord offset contribution of a quadratic is
    // (endOff + 2*cpOff + endOff) / 4. Before: x (1 + 4 + 1)/4 = 1.5,
    // y (0.6 + 2.8 + 0.6)/4 = 1.0. After, with the ends at zero, the control
    // point alone must land on the same two numbers.
    expect((0 + 2 * PRISM_CP_OFF_X + 0) / 4).toBeCloseTo(1.5, 10);
    expect((0 + 2 * PRISM_CP_OFF_Y + 0) / 4).toBeCloseTo(1.0, 10);
  });
```

Add `PRISM_CP_OFF_X, PRISM_CP_OFF_Y` to the `artEdges.js` import block at the top of the test file (it already imports `prismControl` on line 18).

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "control point"
```

Expected: FAIL. The first test reports `expected 513.6 to be close to 516.4`; the second reports `expected 1 to be close to 1.5` (from the current `PRISM_CP_OFF_X = 2`).

- [ ] **Step 3: Change the constants**

In `src/terminal/art/artEdges.js`, replace lines 216-219:

```js
export const PRISM_OFFSET_MID = 3;         // k at which the offset is zero
export const PRISM_OFFSET_STEP = 2.8;      // px per line, in x
export const PRISM_CP_PULL = 0.55;         // control point, toward the sphere centre
// The spectral offset lives HERE ALONE. The chord's endpoints sit on the node
// centres, so the bundle fans from a point the way dispersion actually does —
// it used to be seven parallel copies, maximally split at exactly the place
// they should have been converged (a 17px comb across a 14-20px dot).
//
// These two numbers are not a taste change: a quadratic weights its control
// point at 1/2 at t = 0.5, so the mid-chord offset is (end + 2*cp + end)/4.
// Moving the ends' 1.0 and 0.6 into the control point means 2 -> 3 and
// 1.4 -> 2.0, which leaves the mid-chord fan at exactly the 1.5x and 1.0x it
// has always been. The bundle is the same width where the rainbow reads.
export const PRISM_CP_OFF_X = 3;
export const PRISM_CP_OFF_Y = 2.0;
```

Note this **deletes** `PRISM_END_OFF_Y` and moves `PRISM_CP_PULL` above the two offsets. Leave the rest of the block (`PRISM_SAT` onward) untouched.

- [ ] **Step 4: Converge the endpoints in the draw loop**

In `src/terminal/views/ArtTab.jsx`, replace lines 1779-1780:

```js
                // The chord terminates ON the node centre. Every spectral
                // line's offset is in the control point (PRISM_CP_OFF_X/Y), so
                // the bundle opens from a point and closes onto one — which is
                // what dispersion looks like, and what the polygon and the
                // spokes already did.
                const x0 = pA.sx, y0 = pA.sy;
                const x1 = pB.sx, y1 = pB.sy;
```

Then remove `PRISM_END_OFF_Y` from the import on line 99. The line currently reads:

```js
  PRISM_SPECTRAL_FINE, PRISM_SPECTRAL_COARSE, PRISM_HUE_STEP, PRISM_END_OFF_Y,
```

and becomes:

```js
  PRISM_SPECTRAL_FINE, PRISM_SPECTRAL_COARSE, PRISM_HUE_STEP,
```

- [ ] **Step 5: Run the full suite and the lint**

```bash
npm test
```

Expected: PASS, with no remaining reference to `PRISM_END_OFF_Y`. If any other test imports it, that test is asserting the old geometry — update it to the converged form rather than re-exporting the constant.

```bash
npm run lint
```

Expected: `0 errors`. Read the printed count.

- [ ] **Step 6: Verify in the browser**

Start the dev server via the preview tool (never `npm run dev` through a shell), open the CHAOS tab, and click a node to fire a prism effect. Compare against the pre-change screenshot: the bundle must still be the same width at mid-chord and must now terminate at a single point on each node.

Assert no instance overflow on a full-strength frame:

```js
window.__artEdgeState().additive   // inspect `dropped`; must be 0
```

- [ ] **Step 7: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): the prism bundle converges on the node

Seven spectral lines were rigidly translated by +/-8.4px in x and
+/-5.0px in y AT THE ENDPOINTS, i.e. a 17px comb landing on a 14-20px
dot. That is the wrong shape for the thing it imitates: dispersion
originates at a point and separates along the path.

The offset moves entirely into the control point, and the two constants
are chosen so the mid-chord fan is UNCHANGED -- a quadratic weights its
control point at 1/2 at t = 0.5, so (end + 2*cp + end)/4 stays at 1.5x
and 1.0x. Same rainbow, and it now opens from somewhere.

PRISM_END_OFF_Y is gone. prismControl's note about taking the midpoint
from the unshifted endpoints becomes trivially true, and all three prism
sub-layers finally agree on where a node is.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The lens

The node core disc becomes smoked glass: transparent in the middle, today's opacity at the rim. This reuses `DISC_OFF.midStop` / `midColor` / `outerK` and `packAlphas` — the three-stop radial ramp step 6 built for the particle glow — with **the same colour at all three stops**, so only opacity moves.

**Files:**
- Modify: `src/terminal/art/artNodes.js` (append after `coreColorSource`, before the `── Birth animation ──` banner)
- Modify: `src/terminal/views/ArtTab.jsx:1937-1944` (the core `writeDisc` call)
- Test: `src/terminal/art/__tests__/artNodes.test.js`

**Interfaces:**
- Consumes: `coreAlpha(energy, depthAlpha)`, `coreIsOpaque(isHovered)`, `coreColorSource(renderCol, preTint, isHovered)` — all already exported from `artNodes.js`.
- Produces: `LENS_CENTER_K`, `LENS_KNEE`, `LENS_KNEE_K`, `LENS_RIM_K`, and `lensStops(alpha) -> { center, knee, rim, at }`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/art/__tests__/artNodes.test.js`:

```js
describe('the lens — the node core as smoked glass', () => {
  it('ramps alpha UPWARD from centre to rim', () => {
    const s = lensStops(0.8);
    expect(s.center).toBeLessThan(s.knee);
    expect(s.knee).toBeLessThan(s.rim);
  });

  it('keeps the rim at the flat alpha it always had', () => {
    // LENS_RIM_K is 1.0 on purpose: the node keeps its present silhouette and
    // only its interior opens up. A rim below 1 dims the whole node, which is
    // a different change wearing this one's name.
    expect(LENS_RIM_K).toBe(1);
    expect(lensStops(0.73).rim).toBeCloseTo(0.73, 12);
  });

  it('is LINEAR in the alpha it is handed, so depth and energy still ride through', () => {
    const a = lensStops(1.0), b = lensStops(0.25);
    expect(b.center).toBeCloseTo(a.center * 0.25, 12);
    expect(b.knee).toBeCloseTo(a.knee * 0.25, 12);
    expect(b.rim).toBeCloseTo(a.rim * 0.25, 12);
  });

  it('puts the knee strictly inside the disc, which discEncodingInvariant requires', () => {
    // writeDisc's `mid.at` must land in the OPEN interval (0,1): 0 is how "no
    // mid stop" is spelled and >= 1 is a divide by ~zero in the shader's
    // second span.
    expect(lensStops(1).at).toBe(LENS_KNEE);
    expect(LENS_KNEE).toBeGreaterThan(0);
    expect(LENS_KNEE).toBeLessThan(1);
  });

  it('approximates 1 - u^2 between the stops to within a twentieth of the range', () => {
    // The authored curve is alpha(u) = rim + (ctr - rim)(1 - u^2). Two linear
    // spans cannot match it exactly and do not need to; this pins how far off
    // the fit is so a later knee change cannot quietly become a shape change.
    const s = lensStops(1);
    const trueA = (u) => s.rim + (s.center - s.rim) * (1 - u * u);
    const fit = (u) => (u < LENS_KNEE
      ? s.center + (s.knee - s.center) * (u / LENS_KNEE)
      : s.knee + (s.rim - s.knee) * ((u - LENS_KNEE) / (1 - LENS_KNEE)));
    let worst = 0;
    for (let u = 0; u <= 1.0001; u += 0.01) worst = Math.max(worst, Math.abs(fit(u) - trueA(u)));
    expect(worst).toBeLessThan(Math.abs(s.rim - s.center) * 0.05);
  });
});
```

Add `lensStops, LENS_CENTER_K, LENS_KNEE, LENS_KNEE_K, LENS_RIM_K` to the `../artNodes.js` import at the top of that test file.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artNodes.test.js -t "lens"
```

Expected: FAIL with `lensStops is not a function`.

- [ ] **Step 3: Write the law**

In `src/terminal/art/artNodes.js`, insert after `coreColorSource` and before the `// ── Birth animation ──` banner:

```js
// ── The lens ────────────────────────────────────────────────────────────────
//
// The core is drawn as a three-stop RADIAL ramp with RISING alpha: transparent
// in the middle, today's opacity at the rim. It is smoked glass, not a window —
// the halo underneath is deliberately untouched, so the interior fills with the
// node's own light rather than with the network behind it.
//
// It costs no new float. The disc branch already carries a three-stop ramp
// (DISC_OFF.midStop / midColor / outerK, and packAlphas' three alphas), built
// in step 6 for the particle glow, whose stops DARKEN as they fade. This writes
// the SAME COLOUR into all three stops and leaves outerK at 0, so `outer == mid
// == c0` and only opacity moves. No hue shift, no darkening.
//
// A HOVERED core does not take this path at all: coreIsOpaque() still writes a
// flat alpha of 1 from the pre-spectral colour. Glass at rest, solid under the
// cursor — which is also what protects the click target.
//
// The authored curve is alpha(u) = rim + (centre - rim)(1 - u^2), fitted with
// the two linear spans the encoding gives. LENS_KNEE is the shoulder control:
// 0.45 is a broad smoked field, 0.75 a tight bright rim. All four are tuned on
// the render, not derived.

/** Interior opacity, as a fraction of the flat alpha the core used to carry. */
export const LENS_CENTER_K = 0.35;
/** Where the shoulder sits across the radius, 0..1. Must stay in the OPEN
 *  interval — `discEncodingInvariant` rejects 0 (which spells "no mid stop")
 *  and anything at or past 1 (a divide by ~zero in the shader's second span). */
export const LENS_KNEE = 0.45;
/** Opacity at the knee. */
export const LENS_KNEE_K = 0.62;
/** Rim opacity. ONE, deliberately: the node keeps exactly the silhouette and
 *  the edge presence it has today, and only its interior opens. Dropping this
 *  below 1 dims the whole node, which is a different change. */
export const LENS_RIM_K = 1;

/**
 * The lens's three stops for a core whose flat alpha would have been `alpha`.
 *
 * LINEAR in `alpha`, so `depthCueAlpha`, `resonanceDimmed` and the energy term
 * all still ride through untouched — this reshapes the disc, it does not
 * re-derive how bright the disc is.
 */
export function lensStops(alpha) {
  return {
    center: alpha * LENS_CENTER_K,
    knee:   alpha * LENS_KNEE_K,
    rim:    alpha * LENS_RIM_K,
    at:     LENS_KNEE,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/terminal/art/__tests__/artNodes.test.js -t "lens"
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into the draw loop**

In `src/terminal/views/ArtTab.jsx`, replace the core `writeDisc` block at lines 1937-1944:

```js
          const _lensCol = coreColorSource(renderCol, _preTint, _hov);
          const _lens = _hov ? null : lensStops(coreAlpha(energy, depthAlpha));
          writeDisc(eg.data, eg.count * EDGE_STRIDE, {
            cx: p.sx, cy: p.sy,
            rOuter: radius,
            hsl: _lensCol,
            // A hovered core stays FLAT and opaque — see coreIsOpaque().
            alpha: _hov ? 1 : _lens.center,
            // The same colour in the mid stop, and outerK left at 0, so the
            // three-stop machinery carries opacity alone. Omitting `mid`
            // entirely on hover keeps that instance byte-identical to what it
            // has always been.
            mid: _lens ? { at: _lens.at, hsl: _lensCol, alpha: _lens.knee } : null,
            outerAlpha: _lens ? _lens.rim : 0,
            flags: packFlags(0, 0, 0),
          });
```

Add `lensStops` to the `artNodes.js` import block near the top of `ArtTab.jsx` (it already imports `coreAlpha`, `coreIsOpaque`, `coreColorSource`).

- [ ] **Step 6: Run the full suite and lint**

```bash
npm test
```

Expected: PASS. If a disc-encoding test asserts node cores carry no mid stop, it is pinning the pre-lens shape — update it to assert the lens instance passes `discEncodingInvariant` with an empty violation list.

```bash
npm run lint
```

Expected: `0 errors`.

- [ ] **Step 7: Measure the ink delta — this is a reporting requirement**

Capture whole-frame ink with `artInk` **before and after**, in **both** normal and immersive mode, on the same seed and the same frame indices. Report the four numbers and the deltas to the user.

Do **not** change `BLOOM.intensity`, `BLOOM.levels` or `KNEE.knee` in this task under any circumstances. The dial is at `intensity 1.1 / levels 4 / knee 0.6` and reaching it cost a great deal; if the numbers argue for a change, bring the numbers and let the user rule.

- [ ] **Step 8: Verify in the browser**

Screenshot a hub at a real viewport. Confirm: the interior is translucent and filled with the node's own halo colour, the rim still reads at full strength, and **hovering a node snaps it back to a solid disc**.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/art/artNodes.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artNodes.test.js
git commit -m "feat(chaos): the clickable nodes become smoked glass

The core disc was a flat opaque fill. It is now a three-stop RADIAL ramp
with rising alpha -- transparent in the middle, today's opacity at the
rim -- so a node reads as a lit lens rather than a sticker.

It costs no new float. The disc branch has carried a three-stop ramp
since step 6, built for the particle glow, whose stops darken as they
fade. Writing the SAME COLOUR into all three stops with outerK at 0
makes that machinery carry opacity alone: no hue shift, no darkening.

The halo underneath is deliberately untouched -- this is smoked glass,
not a window, so the interior fills with the node's own light. And a
HOVERED core still writes a flat alpha of 1 from the pre-spectral
colour, so the target solidifies under the cursor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The taper bit

Pure encoding, no pixels move. `packFlags` gains a `taper` flag that rides bit 7 of the dash-duty byte — the same trick `isOrtho` already plays in bit 7 of the glow byte. Every dash duty in the codebase maxes at 8 (`[4,3] [8,4] [3,4] [5,4] [3,6] [3,5] [6,8]`), so the bit is free.

**Files:**
- Modify: `src/terminal/art/SphereEdges.js:699-721` (`packFlags`, `unpackFlags`)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `packFlags(dashPeriod, dashDuty, glow, isOrtho = false, glowQuant = GLOW_QUANT_SRC_OVER, taper = false)`; `unpackFlags(packed, glowQuant)` now returns `{ dashPeriod, dashDuty, isOrtho, glow, taper }`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/art/__tests__/artEdges.test.js`:

```js
describe('the taper bit — bit 7 of the dash-duty byte', () => {
  it('round-trips through pack/unpack', () => {
    const p = packFlags(8, 4, 6, false, 8, true);
    const u = unpackFlags(p, 8);
    expect(u.taper).toBe(true);
    expect(u.dashPeriod).toBe(8);
    expect(u.dashDuty).toBe(4);
    expect(u.glow).toBeCloseTo(6, 10);
    expect(u.isOrtho).toBe(false);
  });

  it('defaults to false, so every existing call site packs the byte it always packed', () => {
    expect(packFlags(8, 4, 6)).toBe(packFlags(8, 4, 6, false, 8, false));
    expect(unpackFlags(packFlags(8, 4, 6), 8).taper).toBe(false);
  });

  it('is independent of the isOrtho bit in the glow byte', () => {
    for (const ortho of [false, true]) {
      for (const taper of [false, true]) {
        const u = unpackFlags(packFlags(6, 8, 10, ortho, 8, taper), 8);
        expect(u.isOrtho).toBe(ortho);
        expect(u.taper).toBe(taper);
        expect(u.dashDuty).toBe(8);
      }
    }
  });

  it('clamps the duty to 127 so a caller cannot forge the bit', () => {
    // The duty byte was clamped to 255 when it held a whole byte. It now holds
    // seven bits, and a duty of 200 setting the taper flag by accident is
    // exactly the failure this clamp exists to prevent.
    expect(unpackFlags(packFlags(0, 200, 0, false, 8, false), 8).taper).toBe(false);
    expect(unpackFlags(packFlags(0, 200, 0, false, 8, false), 8).dashDuty).toBe(127);
  });

  it('covers every dash duty the codebase actually uses', () => {
    // [4,3] [8,4] [3,4] [5,4] [3,6] [3,5] [6,8] -- the whole set is <= 8, which
    // is what makes bit 7 free. If a new dash ever needs a duty above 127 this
    // test is where it should fail.
    for (const duty of [3, 4, 5, 6, 8]) {
      const u = unpackFlags(packFlags(12, duty, 4, false, 8, true), 8);
      expect(u.dashDuty).toBe(duty);
      expect(u.taper).toBe(true);
    }
  });
});
```

Add `packFlags, unpackFlags` to the `../SphereEdges.js` import in that test file if they are not already there.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "taper bit"
```

Expected: FAIL — `expected undefined to be true` on `u.taper`.

- [ ] **Step 3: Implement**

In `src/terminal/art/SphereEdges.js`, replace `packFlags` and `unpackFlags` (lines 699-721) with:

```js
export function packFlags(dashPeriod, dashDuty, glow, isOrtho = false,
                          glowQuant = GLOW_QUANT_SRC_OVER, taper = false) {
  const p = Math.max(0, Math.min(255, Math.round(dashPeriod)));
  // SEVEN bits, not eight: bit 7 of this byte now carries the terminal-taper
  // flag, exactly as bit 7 of the glow byte carries isOrtho. Every dash duty
  // in this codebase is <= 8 ([4,3] [8,4] [3,4] [5,4] [3,6] [3,5] [6,8]), so
  // nothing loses range. The clamp is to 127 rather than 255 so a caller with
  // an out-of-range duty cannot forge the flag.
  const d = Math.max(0, Math.min(127, Math.round(dashDuty))) + (taper ? 128 : 0);
  const g = Math.max(0, Math.min(127, Math.round(glow * glowQuant))) + (isOrtho ? 128 : 0);
  return p + d * 256 + g * 65536;
}

/** The inverse of `packFlags`, mirroring exactly what `EDGE_VERT` unpacks
 *  (dashPeriod via mod/floor, the duty byte's top bit split off as the taper
 *  flag, glow's top bit split off as isOrtho, the rest divided by the
 *  material's `uGlowQuant`). Exported so `artEdges.test.js` cannot drift from
 *  the shader's arithmetic — see `EDGE_VERT` for the GLSL twin of this
 *  function. */
export function unpackFlags(packed, glowQuant = GLOW_QUANT_SRC_OVER) {
  const gByte = Math.floor(packed / 65536);
  const dByte = Math.floor((packed / 256) % 256);
  return {
    dashPeriod: Math.floor(packed % 256),
    dashDuty: dByte % 128,
    taper: dByte >= 128,
    isOrtho: gByte >= 128,
    glow: (gByte % 128) / glowQuant,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS. No pixels moved — every existing call site omits the new argument, so every packed word is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): a taper flag in bit 7 of the dash-duty byte

Groundwork for the wire terminal taper, and the reason it does not need
a stride bump. DISC_RESERVED is empty -- step 6 took the last five spare
floats -- so the next per-instance field would have cost float 19 on
every one of ~74000 instances.

It does not have to. Every dash duty in this codebase is <= 8, so the
duty byte has a free top bit, exactly like the glow byte that already
carries isOrtho there. The clamp drops from 255 to 127 so an
out-of-range duty cannot forge the flag.

No pixels move: the argument defaults to false and every existing call
site packs the word it always packed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The taper shader

The gaussian shoulder fades to nothing over the last `uTaperPx` of a segment. The `side * cap` core term is untouched, so the 1.2px thread runs solid to the exact centre.

**Files:**
- Modify: `src/terminal/art/SphereEdges.js` — `EDGE_VERT` (varying + unpack), `edgeFrag` (varying + the `glow` line), `createEdgeLayer` (uniform), `syncEdgeLayer` (per-frame set)
- Modify: `src/terminal/art/artEdges.js` (the `EDGE_TAPER_PX` constant)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `unpackFlags(...).taper` from Task 3.
- Produces: `EDGE_TAPER_PX = 14`; `layer.uniforms.uTaperPx`; `state.taperPx` read by `syncEdgeLayer`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/art/__tests__/artEdges.test.js`:

```js
describe('the wire taper — the uniform and the shader contract', () => {
  it('reaches beyond a node radius so the shoulder is gone before the rim', () => {
    // A node core is 7-10px at a 900x700 viewport and a base wire carries an
    // 8.6-9px gaussian shoulder. The taper has to outrun the core, or the glow
    // simply stops at the silhouette instead of dissolving into it.
    expect(EDGE_TAPER_PX).toBeGreaterThan(10);
  });

  it('declares uTaperPx on both materials', () => {
    for (const spec of [SRC_OVER_LAYER, ADDITIVE_LAYER]) {
      const layer = createEdgeLayer(null, spec);
      expect(layer.uniforms.uTaperPx).toBeDefined();
      expect(layer.uniforms.uTaperPx.value).toBe(0);
      layer.dispose();
    }
  });

  it('takes the taper length from the state each frame, defaulting to 0', () => {
    const layer = createEdgeLayer(null, SRC_OVER_LAYER);
    const state = createEdgeState(4);
    state.count = 1; state.w = 800; state.h = 600; state.taperPx = 17.5;
    syncEdgeLayer(layer, state);
    expect(layer.uniforms.uTaperPx.value).toBeCloseTo(17.5, 10);
    delete state.taperPx;
    syncEdgeLayer(layer, state);
    expect(layer.uniforms.uTaperPx.value).toBe(0);
    layer.dispose();
  });

  it('applies the taper to the GLOW only, never to the core', () => {
    // The whole point of choosing this over a full fade: the thread stays
    // solid to the centre so four wires visibly meet at one point under the
    // lens. A taper on `core` would dissolve them at the rim instead.
    const src = createEdgeLayer(null, SRC_OVER_LAYER).material.fragmentShader;
    expect(src).toMatch(/float\s+core\s*=\s*mix\(side \* cap, disc, vIsDisc\);/);
    expect(src).toMatch(/\* taper;/);
    // The taper multiply must be on the `glow` line, not the `core` one.
    const coreLine = src.split('\n').find(l => /float\s+core\s*=/.test(l));
    expect(coreLine).not.toMatch(/taper/);
  });

  it('collapses to 1 for a disc and for any instance without the bit', () => {
    const src = createEdgeLayer(null, SRC_OVER_LAYER).material.fragmentShader;
    // vTaper is multiplied by (1 - vIsDisc) so a ring can never take it, and
    // mix(1.0, ..., 0.0) is exactly 1 for every instance that omits the flag.
    expect(src).toMatch(/mix\(1\.0, taperT, vTaper \* \(1\.0 - vIsDisc\)\)/);
  });
});
```

Add `EDGE_TAPER_PX` to the `artEdges.js` import and `SRC_OVER_LAYER, ADDITIVE_LAYER, createEdgeLayer, createEdgeState, syncEdgeLayer` to the `SphereEdges.js` import in that test file if not already present.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "wire taper"
```

Expected: FAIL — `EDGE_TAPER_PX` is undefined and `uTaperPx` is undefined.

- [ ] **Step 3: Add the constant**

In `src/terminal/art/artEdges.js`, directly beneath `edgeLineWidth`:

```js
/**
 * How far back from each end of a base edge the gaussian shoulder fades out,
 * in px before `ink` scaling.
 *
 * MEASURED, at a 900x700 viewport: a base wire is a 1.15-1.30px thread wearing
 * an 8.6-9.0px gaussian coat, and a node core is 7-10px. So four wires
 * arriving at a hub stack four shoulders that are each the size of the whole
 * dot, lobed by the incident angles. That -- not the geometry, which has always
 * run centre to centre -- is why a hub looked ragged.
 *
 * The CORE thread is deliberately not tapered. It runs solid to the exact
 * centre, so with the lens in front of it the convergence is visible THROUGH
 * the glass: several wires meeting at one point, which is the thing the taper
 * was asked for in the first place.
 *
 * 14 is about 1.5x a node radius: far enough that the shoulder is already gone
 * by the silhouette rather than being cut off at it.
 */
export const EDGE_TAPER_PX = 14;
```

- [ ] **Step 4: Add the varying and the unpack to EDGE_VERT**

In `src/terminal/art/SphereEdges.js`, in `EDGE_VERT`, add beside the other varyings (next to `varying float vIsOrtho;`):

```glsl
  varying float vTaper;      // 0.0 or 1.0 — bit 7 of the dash-duty byte
```

Then replace the dash-duty unpack line:

```glsl
    float dashDuty   = floor(mod(f / 256.0, 256.0));
```

with:

```glsl
    // The duty byte is SEVEN bits plus a flag, mirroring the glow byte above:
    // bit 7 is the terminal-taper opt-in. See packFlags/unpackFlags.
    float dutyByte   = floor(mod(f / 256.0, 256.0));
    float taperBit   = step(127.5, dutyByte);
    float dashDuty   = mod(dutyByte, 128.0);
```

and add, beside `vIsOrtho = isOrtho;`:

```glsl
    vTaper = taperBit;
```

- [ ] **Step 5: Add the uniform and the taper term to edgeFrag**

In `edgeFrag`, declare the uniform beside `uniform float uOrthoHue;`:

```glsl
  // The terminal taper's reach in px. Per frame, not per instance — the
  // opt-in is the per-instance half (vTaper).
  uniform float uTaperPx;
```

and the varying beside `varying float vIsOrtho;`:

```glsl
  varying float vTaper;
```

Then replace the single `glow` line:

```glsl
    float glow = mix(glowSeg, glowDisc, vIsDisc) * step(0.001, vGlow);
```

with:

```glsl
    // THE TERMINAL TAPER. The shoulder fades to nothing over the last
    // uTaperPx at EACH end, so a wire dissolves into the node it reaches
    // instead of stacking a full-strength 9px halo on a 7-10px dot.
    //
    // On the GLOW only. `core` above is untouched, so the thread runs solid to
    // the exact centre and several wires visibly converge on one point --
    // which is what this was for, and what a fade on `core` would destroy.
    //
    // Multiplied by (1.0 - vIsDisc) as well as vTaper: a ring shares this
    // buffer and has no ends to taper, and its vAlong/vLen are a radius and a
    // zero. mix() rather than a branch, so an instance without the flag
    // collapses to exactly the arithmetic it had before this existed.
    float taperT = clamp(min(vAlong, vLen - vAlong) / max(uTaperPx, 1e-3), 0.0, 1.0);
    float taper = mix(1.0, taperT, vTaper * (1.0 - vIsDisc));
    float glow = mix(glowSeg, glowDisc, vIsDisc) * step(0.001, vGlow) * taper;
```

- [ ] **Step 6: Declare the uniform and sync it**

In `createEdgeLayer`, add to the `uniforms` object:

```js
    uTaperPx:    { value: 0 },
```

In `syncEdgeLayer`, beside the `uOrthoHue` line:

```js
  // 0 disables the taper for every instance regardless of the flag, which is
  // what a caller that has not opted in gets.
  layer.uniforms.uTaperPx.value = state.taperPx ?? 0;
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "wire taper"
```

Expected: PASS, 5 tests.

- [ ] **Step 8: Commit the shader half**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): a terminal taper on the edge shoulder

The gaussian shoulder now fades out over the last uTaperPx at each end
of an opted-in segment. Nothing is wired to it yet, so no pixels move.

On the GLOW only. The side*cap core term is untouched on purpose: the
thread runs solid to the exact centre, so with the lens in front of it
several wires are visibly seen converging on one point THROUGH the
glass. A fade on the core would dissolve them at the rim instead, which
is the other option and not the one chosen.

One uniform and one spare bit. EDGE_STRIDE stays 18.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the taper to the base edges

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` — the base edge block (around `:1509-1600`) and wherever `egRef`'s per-frame fields (`w`, `h`, `orthoHue`) are set.
- Test: manual browser verification; the shader contract is already pinned by Task 4.

**Interfaces:**
- Consumes: `EDGE_TAPER_PX` (Task 4), `packFlags(..., taper)` (Task 3), `state.taperPx` (Task 4).
- Produces: base edges carrying the taper bit.

- [ ] **Step 1: Set the per-frame taper length**

Find where `eg.w` / `eg.h` are assigned each frame (the same place `ag.w = w; ag.h = h;` is set for the additive stream) and add beside them:

```js
      // Scaled by `ink` for the same reason every radius in this loop is: it
      // is one number for the whole frame, so the taper stays a fixed fraction
      // of a node radius at every viewport.
      eg.taperPx = EDGE_TAPER_PX * ink;
```

Import `EDGE_TAPER_PX` from `../art/artEdges.js` in `ArtTab.jsx`.

- [ ] **Step 2: Set the bit on base edges**

The four base-edge branches (`isOrtho` / `isFused` / `isSpectral` / default) each write `ed[o + 15]` directly. Rather than editing four branches, OR the bit in once **after** the branch closes and before `eg.count++`:

```js
            // The terminal taper, on the base edges alone. Bit 7 of the
            // dash-duty byte; see packFlags. OR'd in after the branch so all
            // four paths (ortho / fused / spectral / default) get it from one
            // place and none of them can be missed.
            ed[o + 15] += 128 * 256;
```

Use `+=` rather than `|=`: `ed` is a `Float32Array`, and a bitwise OR on a float coerces through int32 and would silently truncate the packed word. The flag is provably not already set, because no `packFlags` call in this block passes `taper`.

- [ ] **Step 3: Run the suite and lint**

```bash
npm test && npm run lint
```

Expected: PASS, `0 errors`.

- [ ] **Step 4: Verify in the browser — this is the acceptance test for Tasks 3-5**

Open the CHAOS tab at a real viewport and screenshot a degree-4 hub. Confirm:
- the lobed glow cloud around the hub is gone;
- the thin core threads still reach the centre and are visible through the lens;
- wires away from their endpoints are unchanged in brightness.

Then confirm the bit survives the round trip on a live instance:

```js
// discStart bounds the segments; instance 0 is a base edge.
(() => { const s = window.__artEdgeState(), d = s.instances;
  const f = d[15]; const dByte = Math.floor((f / 256) % 256);
  return { taper: dByte >= 128, dashDuty: dByte % 128 }; })()
```

Expected: `{ taper: true, dashDuty: 0 }` for a solid default edge.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(chaos): base edges dissolve into the node they reach

Wires the taper built in the previous two commits. A base wire's 9px
gaussian coat now fades out over the last 14px * ink while its 1.2px
thread runs solid to the exact centre.

MEASURED at 900x700 before this: node core 7-10px, wire thread
1.15-1.30px, wire shoulder 8.6-9.0px. Four wires at a hub stacked four
shoulders each the size of the whole dot. The geometry was never the
problem -- base edges have always run centre to centre -- and this is
why 'anchor the endpoints to the centre' would have changed nothing.

The end-alpha asymmetry is untouched. It is an authored directional
readout of edge strength (see edgeStops), the taper hides it exactly
where it looked ragged, and symmetrising it would have deleted an
information channel to fix a cosmetic problem.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Particle range

Edge particles travel 5.5% of their wire and die. Total displacement under the pool's geometric drag is `v0 / (1 - DRAG)` = `v0 / 0.036`, so traversing an edge of length `L` needs `v0 = 0.036 * L` against today's `0.002 * L`.

**Files:**
- Modify: `src/terminal/art/artParticles.js` (`emitEdgeParticles`)
- Test: `src/terminal/art/__tests__/artParticles.test.js`

**Interfaces:**
- Consumes: `PARTICLE_DRAG`, `stepParticles` — already exported.
- Produces: `EDGE_PARTICLE_SPEED_K = 0.036`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/art/__tests__/artParticles.test.js`:

```js
describe('edge particles have the range to cross their own edge', () => {
  it('derives its launch speed from the drag, not from a literal', () => {
    // Total displacement under geometric drag is v0 * sum(DRAG^k) =
    // v0 / (1 - DRAG). To cover an edge of length L in the limit, v0 must be
    // (1 - DRAG) * L. Anything else is a number someone typed.
    expect(EDGE_PARTICLE_SPEED_K).toBeCloseTo(1 - PARTICLE_DRAG, 12);
  });

  it('actually traverses the edge it was emitted along', () => {
    const pool = createParticlePool();
    // A straight unit-length edge along +x, seeded at its A end.
    emitEdgeParticles(pool, 0, 0, 0, 1, 0, 0, 10, 20, 1);
    const i = 0;
    pool.xs[i] = 0; pool.ys[i] = 0; pool.zs[i] = 0;
    for (let f = 0; f < 400; f++) stepParticles(pool, 1);
    // Asymptotically 1.0; 400 frames is ~14 e-foldings, so within a whisker.
    expect(pool.xs[i]).toBeGreaterThan(0.97);
    expect(pool.xs[i]).toBeLessThan(1.03);
  });

  it('was travelling 5.5% of an edge before this — the regression this locks out', () => {
    // The old coefficient. Kept as an explicit number rather than a comment so
    // that a future 'tidy the magic numbers' pass cannot quietly restore it.
    const OLD = 0.002;
    expect(OLD / (1 - PARTICLE_DRAG)).toBeLessThan(0.06);
  });
});
```

Add `emitEdgeParticles, EDGE_PARTICLE_SPEED_K` to the `../artParticles.js` import in that test file.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artParticles.test.js -t "range"
```

Expected: FAIL — `EDGE_PARTICLE_SPEED_K` is undefined.

- [ ] **Step 3: Implement**

In `src/terminal/art/artParticles.js`, above `emitEdgeParticles`:

```js
/**
 * An edge particle's launch speed, as a fraction of the edge vector.
 *
 * DERIVED, not chosen. Velocity decays geometrically, so total displacement is
 * `v0 * sum(DRAG^k)` = `v0 / (1 - DRAG)`. Covering an edge of length L
 * therefore needs `v0 = (1 - DRAG) * L`, which is what this is.
 *
 * It used to be 0.002, i.e. 5.5% of an edge. MEASURED: drag e-folds velocity in
 * 27.8 authored frames against lifespans of 60-130, so an edge particle spent
 * the overwhelming majority of its visible life motionless a few percent from
 * where it was born. The flow layer was wired, seeded along the edge and aimed
 * A to B with the hue blending from node A's colour to node B's — and it had
 * never once arrived, so the blend never completed either.
 *
 * Written against PARTICLE_DRAG rather than as a literal so the two cannot
 * drift: change the drag and the range follows it.
 */
export const EDGE_PARTICLE_SPEED_K = 1 - PARTICLE_DRAG;
```

Then in `emitEdgeParticles`, replace the three velocity terms — `(bx - ax) * 0.002` and its y and z twins — with `(bx - ax) * EDGE_PARTICLE_SPEED_K` etc. Leave the `(artRandom() - 0.5) * 0.0008` jitter exactly as it is; it is a spread, not a rate.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS. Note `EDGE_PARTICLE_SPEED_K` must be declared **after** `PARTICLE_DRAG` in the module, or it reads `undefined`.

- [ ] **Step 5: Verify in the browser**

Open the CHAOS tab, click a node to raise edge pulses above 0.2, and watch. Particles should now visibly run the length of a wire and fade near its far node instead of budding and stalling.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/artParticles.js src/terminal/art/__tests__/artParticles.test.js
git commit -m "fix(chaos): edge particles travel their edge instead of 5.5% of it

MEASURED: drag e-folds velocity in 27.8 authored frames against 60-130
frame lifespans, and the launch speed was 0.002 * |B-A| against a total
displacement of v0 / (1 - DRAG). So an edge particle covered 5.5% of its
wire and then sat still for most of its visible life.

The flow layer was already wired, already seeded along the edge, already
aimed A to B with the hue blending from node A's colour to node B's. It
had simply never arrived, so the blend never completed either.

The coefficient is now DERIVED from the drag -- (1 - DRAG) is exactly
the speed that covers a unit edge -- so the two cannot drift apart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Particle arrival

A per-particle target and an exponential approach toward it, so bursts curve along the graph instead of diffusing isotropically.

**Files:**
- Modify: `src/terminal/art/artParticles.js` (`createParticlePool`, `emitParticle`, `stepParticles`, `emitEdgeParticles`)
- Test: `src/terminal/art/__tests__/artParticles.test.js`

**Interfaces:**
- Consumes: `decayOverFrames` from `./artRateGate.js` (already imported by this module).
- Produces: pool fields `txs`, `tys`, `tzs`, `pulls`; `emitParticle(..., maxLife, tx = 0, ty = 0, tz = 0, pull = 0)`; `PARTICLE_PULL`.

- [ ] **Step 1: Write the failing test — composition first**

This is the test that matters. A `dt = 1` assertion cannot detect a rate bug, because the broken and the correct factor are equal there.

Append to `src/terminal/art/__tests__/artParticles.test.js`:

```js
describe('particle arrival — an exponential approach, not a spring', () => {
  const seed = (pull) => {
    const pool = createParticlePool();
    emitParticle(pool, 0, 0, 0, 0, 0, 0, 10, 10, 50, 1, 500, 1, 0, 0, pull);
    return pool;
  };

  it('COMPOSES: N sub-steps of dt/N land where one step of dt lands', () => {
    // The whole reason this is a positional approach and not `v += (T-P)*k*dt`.
    // A Euler spring does not compose, and at dt = 1 it agrees with the
    // correct form exactly -- so a dt = 1 test would pass on the broken one.
    const whole = seed(1);
    stepParticles(whole, 6);

    const split = seed(1);
    for (let i = 0; i < 6; i++) stepParticles(split, 1);

    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 9);
    expect(split.ys[0]).toBeCloseTo(whole.ys[0], 9);
    expect(split.zs[0]).toBeCloseTo(whole.zs[0], 9);
  });

  it('composes at a fractional sub-step too, which is what a 360Hz panel gives', () => {
    const whole = seed(1); stepParticles(whole, 1);
    const split = seed(1); for (let i = 0; i < 6; i++) stepParticles(split, 1 / 6);
    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 9);
  });

  it('puts the per-particle strength INSIDE the exponent, not outside the result', () => {
    // The trap: `approach * pulls[i]` scales the COMPOSED factor and breaks
    // composition per particle. The strength has to scale the RATE, i.e. the
    // base that gets raised to dt. Two particles at half strength stepped six
    // times must still equal one step of six.
    const whole = seed(0.5); stepParticles(whole, 6);
    const split = seed(0.5); for (let i = 0; i < 6; i++) stepParticles(split, 1);
    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 9);
  });

  it('approaches the target and never overshoots it', () => {
    const pool = seed(1);
    let prev = -Infinity;
    for (let f = 0; f < 200; f++) {
      stepParticles(pool, 1);
      expect(pool.xs[0]).toBeLessThanOrEqual(1 + 1e-9);
      expect(pool.xs[0]).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = pool.xs[0];
    }
    expect(pool.xs[0]).toBeGreaterThan(0.9);
  });

  it('is EXACTLY inert at pull = 0, so every untargeted emitter is untouched', () => {
    const pulled = seed(0);
    const plain = createParticlePool();
    emitParticle(plain, 0, 0, 0, 0.01, 0, 0, 10, 10, 50, 1, 500);
    pulled.vxs[0] = 0.01;
    for (let i = 0; i < 50; i++) { stepParticles(pulled, 1); stepParticles(plain, 1); }
    expect(pulled.xs[0]).toBe(plain.xs[0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artParticles.test.js -t "arrival"
```

Expected: FAIL — the extra `emitParticle` arguments are ignored, so every particle sits at the origin and `expect(pool.xs[0]).toBeGreaterThan(0.9)` fails.

- [ ] **Step 3: Add the pool fields**

In `createParticlePool`, beside the existing arrays:

```js
    txs:       new Float32Array(MAX_PARTICLES),   // target x — the node it flies to
    tys:       new Float32Array(MAX_PARTICLES),
    tzs:       new Float32Array(MAX_PARTICLES),
    pulls:     new Float32Array(MAX_PARTICLES),   // 0 = no target, 1 = full rate
```

- [ ] **Step 4: Extend emitParticle**

Change the signature and add four writes:

```js
export function emitParticle(pool, x, y, z, vx, vy, vz, hue, hueTarget, sat, size, maxLife,
                             tx = 0, ty = 0, tz = 0, pull = 0) {
```

and inside, beside `pool.sizes[i] = size;`:

```js
  pool.txs[i] = tx; pool.tys[i] = ty; pool.tzs[i] = tz;
  pool.pulls[i] = pull;
```

The four defaults are what keep every existing emitter byte-identical.

- [ ] **Step 5: Add the approach to stepParticles**

Above `stepParticles`, beside `PARTICLE_DRAG`:

```js
/**
 * The per-frame fraction of the remaining gap a fully-pulled particle closes.
 * `retain = 1 - PARTICLE_PULL * pulls[i]`, raised to dt.
 */
export const PARTICLE_PULL = 0.02;
```

Inside the per-slot loop, after the position integration and before the hue drift:

```js
    // ARRIVAL — an exponential approach on POSITION, deliberately the same law
    // as the hue drift below and for the same reason: it COMPOSES. N sub-steps
    // of dt/N land exactly where one step of dt lands, so no refresh rate is
    // privileged.
    //
    // A spring (`v += (T - P) * k * dt`) does not compose, and it agrees with
    // the correct form at dt = 1 — which is precisely why a dt = 1 parity test
    // cannot catch the difference. That is the shape of the bug that hid in
    // the emission cadences for years.
    //
    // The strength scales the RATE, i.e. the base of the exponent, NOT the
    // composed result. `(1 - k^dt) * pulls[i]` would break composition per
    // particle while looking identical at dt = 1 — the same trap one level in.
    // At pulls[i] = 0 the base is exactly 1, 1^dt is exactly 1, and the
    // approach is exactly 0: every untargeted emitter is bit-identical.
    const pull = pool.pulls[i];
    if (pull > 0) {
      const approach = 1 - decayOverFrames(1 - PARTICLE_PULL * pull, dtFrames);
      pool.xs[i] += (pool.txs[i] - pool.xs[i]) * approach;
      pool.ys[i] += (pool.tys[i] - pool.ys[i]) * approach;
      pool.zs[i] += (pool.tzs[i] - pool.zs[i]) * approach;
    }
```

- [ ] **Step 6: Give edge particles their target**

In `emitEdgeParticles`, pass the B end as the target. Add a `pull` parameter defaulting to 1 so the call site reads plainly, and forward it:

```js
export function emitEdgeParticles(pool, ax, ay, az, bx, by, bz, hue, hueTarget, count, pull = 1) {
```

and extend the `emitParticle` call with `bx, by, bz, pull` after `maxLife`.

The analogy-filament emitter at `ArtTab.jsx:1106` also calls this; it gets the same arrival behaviour, which is correct — a filament terminates at a node too.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS, including every pre-existing `artParticles` test. The `is EXACTLY inert at pull = 0` case is the one that proves idle and burst particles did not move.

- [ ] **Step 8: Verify in the browser and re-check Task 6's speed**

With the pull active, the derived launch speed from Task 6 may now overshoot — the particle is being carried by two mechanisms. Watch a pulsing edge. If particles pile onto the target node too early, reduce `EDGE_PARTICLE_SPEED_K`'s multiplier at the call site rather than changing the derived constant, and say so in the commit.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/art/artParticles.js src/terminal/art/__tests__/artParticles.test.js
git commit -m "feat(chaos): particles arrive at the node they were aimed at

A per-particle target and an exponential approach toward it, so an edge
particle completes its crossing and a burst curves along the graph
instead of diffusing isotropically.

The law is the same one the hue drift already uses, and the choice is
not stylistic: it COMPOSES. N sub-steps of dt/N land exactly where one
step of dt lands, so no refresh rate is privileged. A Euler spring does
not compose AND agrees with the correct form at dt = 1, which is exactly
why a dt = 1 parity test cannot tell them apart -- the shape of the bug
that hid in the emission cadences for years. The tests assert
composition, not the dt = 1 value.

One trap one level in, also tested: the per-particle strength scales the
RATE (the base of the exponent), never the composed result. Outside, it
would break composition per particle while looking identical at dt = 1.

At pull = 0 the base is exactly 1, so every untargeted emitter is
bit-identical.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Velocity-stretched streaks

Each particle's glow disc becomes a **segment** from its previous projected position to its current one. The segment branch already supplies width, a head-to-tail gradient and a gaussian shoulder, so this needs no shader work and no new floats.

**Files:**
- Modify: `src/terminal/art/artParticles.js` (previous-position arrays)
- Modify: `src/terminal/art/artParticleDraw.js` (the streak law)
- Modify: `src/terminal/views/ArtTab.jsx:2377-2397` (the glow `writeDisc` becomes a segment write)
- Test: `src/terminal/art/__tests__/artParticleDraw.test.js`

**Interfaces:**
- Consumes: `writePolyline` / the raw segment layout from `SphereEdges.js`; `particleAlpha`, `particleSize`, `GLOW_MULT` from `artParticleDraw.js`.
- Produces: pool fields `pxs`, `pys`, `pzs`; `STREAK_STRETCH`, `STREAK_MIN_PX`, `streakTail(headX, headY, prevX, prevY)`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/art/__tests__/artParticleDraw.test.js`:

```js
describe('velocity-stretched streaks', () => {
  it('stretches the frame displacement by a constant factor', () => {
    const t = streakTail(100, 100, 98, 99);
    expect(t.x).toBeCloseTo(100 - 2 * STREAK_STRETCH, 10);
    expect(t.y).toBeCloseTo(100 - 1 * STREAK_STRETCH, 10);
  });

  it('reports a degenerate streak rather than emitting one', () => {
    // A zero-length SEGMENT is not a disc: isDisc() keys on the width SIGN, so
    // `a == b` takes the segment path with len = 0, dir falls back to (1,0),
    // and the cap term evaluates to 0.25 at vAlong = 0 -- a faint
    // quarter-alpha blob where a spark should be. The caller must fall back to
    // the disc path, so the law has to say so.
    expect(streakTail(50, 50, 50, 50).degenerate).toBe(true);
    expect(streakTail(50, 50, 49.999, 50).degenerate).toBe(true);
    expect(streakTail(50, 50, 40, 50).degenerate).toBe(false);
  });

  it('calls a streak degenerate exactly below STREAK_MIN_PX of stretched length', () => {
    const d = STREAK_MIN_PX / STREAK_STRETCH;
    expect(streakTail(0, 0, d * 1.01, 0).degenerate).toBe(false);
    expect(streakTail(0, 0, d * 0.99, 0).degenerate).toBe(true);
  });

  it('floors at a length the box filter can actually resolve', () => {
    // Below about half a pixel the segment deposits less ink than the disc it
    // replaced, so the fallback threshold has to sit above that.
    expect(STREAK_MIN_PX).toBeGreaterThanOrEqual(0.5);
  });
});
```

Add `streakTail, STREAK_STRETCH, STREAK_MIN_PX` to the `../artParticleDraw.js` import in that test file.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/terminal/art/__tests__/artParticleDraw.test.js -t "streak"
```

Expected: FAIL — `streakTail is not a function`.

- [ ] **Step 3: Write the law**

Append to `src/terminal/art/artParticleDraw.js`:

```js
// ── Velocity-stretched streaks ──────────────────────────────────────────────
//
// A particle's soft glow was a disc with a three-stop RADIAL ramp. It is now a
// SEGMENT from where the particle was last frame to where it is now, stretched
// along that displacement — which is what the mesh's segment branch already
// draws, with a width, a head-to-tail gradient and a gaussian shoulder. No
// shader, no new float, and the instance count per particle stays at two.
//
// ONE FIDELITY LOSS, recorded rather than hidden: the disc's ramp DARKENED as
// it faded (lightness 82 -> 65 -> 50, knee at 0.4 — see GLOW_STOPS and
// GLOW_OUTER_K). A segment's gradient runs along its LENGTH, not radially, so
// the shoulder is single-colour. Small on a spark, real, and not recoverable
// without a radial term a segment does not have.

/** How far the one-frame displacement is exaggerated. A frame's real
 *  displacement is sub-pixel at any sane speed, so an un-stretched streak is a
 *  dot; this is the knob that turns motion into a needle. Tuned by eye. */
export const STREAK_STRETCH = 5;

/** Below this stretched length in px the caller must draw the DISC instead.
 *  See `streakTail`'s note — a zero-length segment is not a disc. */
export const STREAK_MIN_PX = 0.75;

/**
 * The tail end of a particle's streak, in screen px, and whether it is long
 * enough to draw as one.
 *
 * `degenerate` is not defensive. `isDisc()` keys on the width SIGN, so a
 * segment written with `a == b` takes the SEGMENT path: `len` is 0, `dir`
 * falls back to (1,0), `t` is 0, and the cap term
 * `clamp(vAlong/pxA + 0.5) * clamp((vLen - vAlong)/pxA + 0.5)` evaluates to
 * 0.25 at the centre. The result is a faint quarter-alpha blob exactly where a
 * spark should be — a stalled particle rendering as a dimmer, wrongly-shaped
 * dot, which reads as a bug in the ecology rather than in the encoding.
 */
export function streakTail(headX, headY, prevX, prevY) {
  const dx = (headX - prevX) * STREAK_STRETCH;
  const dy = (headY - prevY) * STREAK_STRETCH;
  return {
    x: headX - dx,
    y: headY - dy,
    degenerate: Math.hypot(dx, dy) < STREAK_MIN_PX,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/terminal/art/__tests__/artParticleDraw.test.js -t "streak"
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Record the previous position in the pool**

In `src/terminal/art/artParticles.js`, add to `createParticlePool`:

```js
    pxs:       new Float32Array(MAX_PARTICLES),   // position at the END of the
    pys:       new Float32Array(MAX_PARTICLES),   // previous step — the streak's
    pzs:       new Float32Array(MAX_PARTICLES),   // tail anchor
```

In `emitParticle`, beside the position writes, seed the previous position to the current one so a newborn has a zero-length streak and takes the disc fallback on its first frame:

```js
  pool.pxs[i] = x; pool.pys[i] = y; pool.pzs[i] = z;
```

In `stepParticles`, capture the position **before** integrating, at the top of the per-slot body:

```js
    // Captured before the integration, not derived from velocity afterwards:
    // once the arrival term is in, displacement is no longer `v * move`.
    pool.pxs[i] = pool.xs[i];
    pool.pys[i] = pool.ys[i];
    pool.pzs[i] = pool.zs[i];
```

- [ ] **Step 6: Draw the streak**

In `src/terminal/views/ArtTab.jsx`, in the particle loop, project the previous position alongside the current one:

```js
        const [qrx, qry, qrz] = applyM(M, pool.pxs[pi], pool.pys[pi], pool.pzs[pi]);
        const qp = project(qrx, qry, qrz, w, h, sphereR, focal);
        const _st = streakTail(pp.sx, pp.sy, qp.sx, qp.sy);
```

Then replace the glow `writeDisc` (lines 2377-2397) with a branch. The degenerate arm writes **exactly today's disc**, unchanged, so a stalled particle is bit-identical to what it was:

```js
        if (_st.degenerate) {
          // Too short to be a segment — and a zero-length segment is NOT a
          // disc. See streakTail.
          writeDisc(ag.data, ag.count * EDGE_STRIDE, {
            cx: pp.sx, cy: pp.sy,
            rOuter: particleGlowRadius(sz),
            hsl: { hue, sat, lit: GLOW_STOPS[0].lightness },
            alpha: quantAlpha(alpha * GLOW_STOPS[0].alphaScale),
            mid: {
              at: GLOW_STOPS[1].at,
              hsl: { hue, sat, lit: GLOW_STOPS[1].lightness },
              alpha: quantAlpha(alpha * GLOW_STOPS[1].alphaScale),
            },
            outerK: GLOW_OUTER_K,
            outerAlpha: quantAlpha(alpha * GLOW_STOPS[2].alphaScale),
            flags: PARTICLE_FLAGS,
          });
        } else {
          // The streak, as ONE segment: tail to head, with the gradient running
          // dark-to-bright along it and the gaussian shoulder carrying the glow.
          const o = ag.count * EDGE_STRIDE;
          const ad = ag.data;
          ad[o] = _st.x; ad[o + 1] = _st.y; ad[o + 2] = pp.sx; ad[o + 3] = pp.sy;
          writeHsl(ad, o + 4,  hue, sat, GLOW_STOPS[2].lightness);   // tail
          writeHsl(ad, o + 7,  hue, sat, GLOW_STOPS[1].lightness);   // mid
          writeHsl(ad, o + 10, hue, sat, GLOW_STOPS[0].lightness);   // head
          ad[o + 13] = packAlphas(
            quantAlpha(alpha * GLOW_STOPS[2].alphaScale),
            quantAlpha(alpha * GLOW_STOPS[1].alphaScale),
            quantAlpha(alpha * GLOW_STOPS[0].alphaScale),
          );
          ad[o + 14] = sz;
          ad[o + 15] = PARTICLE_FLAGS;
          ad[o + 16] = 0;   // phase — a straight stroke starts its dash at 0
          // Float 17 is a DISC's shadow colour. The buffer is reused frame to
          // frame, so a segment landing where a disc was would inherit it:
          // invisible in the render (vIsDisc mixes it out) but not invisible to
          // the world hash, which reads the raw buffer.
          ad[o + 17] = 0;
        }
        ag.count++;
        _pcen.particleGlow++;
```

The core disc that follows is unchanged. Import `streakTail`, `packAlphas` and `writeHsl` in `ArtTab.jsx` if not already imported.

- [ ] **Step 7: Run the suite and lint**

```bash
npm test && npm run lint
```

Expected: PASS, `0 errors`. If `artParticles.test.js` asserts the pool's exact key set, extend it rather than deleting the assertion.

- [ ] **Step 8: Verify in the browser and check the budget**

Fire a node burst and a prism effect together — the worst case for the additive stream.

```js
window.__artEdgeState().additive   // `dropped` must stay 0
```

Confirm visually: fast sparks are needles, slow ones compress toward round, and no particle renders as a faint quarter-alpha smudge (that would mean the degenerate branch is not being taken).

- [ ] **Step 9: Measure the mobile cost**

Set a coarse-pointer viewport (`PRISM_SPECTRAL_COARSE = 4` is the mobile path) and record fps with a CDP probe, counting `cb.name === 'draw'` callbacks only — counting every rAF callback inflates the figure by ~3x and hides stalls. Report the number.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/art/artParticles.js src/terminal/art/artParticleDraw.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artParticleDraw.test.js
git commit -m "feat(chaos): particles stretch along their own velocity

The soft glow was a disc with a three-stop radial ramp. It is now a
SEGMENT from last frame's position to this one's, stretched along the
displacement -- which is what the mesh's segment branch already draws,
with a width, a head-to-tail gradient and a gaussian shoulder. No
shader, no new float, and the instance count per particle stays at two.

The previous position is RECORDED rather than derived from velocity:
once the arrival term landed, displacement stopped being v * move.

Two things named rather than discovered:

- A zero-length segment is NOT a disc. isDisc() keys on the width sign,
  so `a == b` takes the segment path with len 0, dir (1,0) and a cap
  term of 0.25 at the centre -- a faint quarter-alpha blob where a spark
  should be. Below STREAK_MIN_PX the caller writes the disc instead, and
  that arm is byte-identical to what shipped.
- The disc's ramp DARKENED as it faded (82 -> 65 -> 50, knee at 0.4). A
  segment's gradient runs along its length, not radially, so the
  shoulder is single-colour now. Real loss, small on a spark, not
  recoverable without a radial term a segment does not have.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Closing out

After Task 8, before anything is proposed for merge:

- [ ] **Re-cut the parity reference.** `artBaseline` with `BASELINE_COMMIT` set — leave it unset and the manifest records `gitCommit: null` and the reference is unattributable. **Do not touch the working tree while it runs.**
- [ ] **Run `artCompare` against the new reference** as a regression net only. It is structurally blind to refresh-rate behaviour (it virtualises the clock at exactly 1000/60) and has passed blatantly visible changes before. 21/21 ADMISSIBLE proves the 60fps frame did not move — nothing more. The look is ruled by the user.
- [ ] **Report the bloom ink delta** from Task 2, Step 7, and the mobile fps from Task 8, Step 9.
- [ ] **Do not merge and do not push.** Both require an explicit instruction.
