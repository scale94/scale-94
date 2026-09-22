# Prism chromatic front A/B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two alternative chromatic fronts for the CHAOS prism — arm U (the seven strands gather onto one hue) and arm A (the crest bleaches to white) — behind a runtime switch, so the author can rule between them inside one page at one seed.

**Architecture:** The machinery that applies the tint (`prismChromaBlend`, the per-point hot loop, `writePolyline`'s `rgbs`) landed at `b4ce9e4e` and is NOT touched. All three arms are a different *anchor*, computed once per spectral line per effect per frame. A mode ref, copied onto the effect each draw, selects the anchor expression; mode 0 is the shipped expression and the shipped path runs unchanged.

**Tech Stack:** Vanilla JS in `src/terminal/art/` (pure, unit-tested), React draw loop in `src/terminal/views/ArtTab.jsx`, vitest, CDP instruments under `scripts/`, `sharp` for frame analysis.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-22-prism-chroma-ab-design.md`. Every value below is copied from it verbatim.
- **`PRISM_CHROMA_MODE_SHIPPED = 0` is the default everywhere, and is load-bearing.** Mode 0 must select the shipped anchor expression so the parity reference cut at `33bda07e` is untouched.
- **`PRISM_UNISON_K` is derived from the live line count `n` as `(n - 1) / 2`. Never write a literal 3.** It is 3 on `PRISM_SPECTRAL_FINE` = 7 and **1.5 on `PRISM_SPECTRAL_COARSE` = 4**, where no strand sits on the fixed point. Every U property test runs on both line counts.
- **`PRISM_A_WAKE_SAT = 35`. CHOSEN, never seen by an eye.** Mark it so in its comment.
- **Both arms take the UN-SHEARED chroma phase**, `uu - tMs/durMs`, with no `prismPhaseOffset(k)` term. The alpha wave keeps its shear exactly as shipped. This is the fix for the comb folding; see spec §3.
- **`edgeFrag` in `SphereEdges.js` is a JS template literal. No backticks in any comment placed inside it.** Not touched by this plan, but the file is.
- **Every property test must be falsified against the unfixed code before it is believed.** Each task's "verify it fails" step names the exact expected failure.
- Lint gate: `npm run lint` must stay at 0 errors and at or under 153 warnings.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| file | responsibility | change |
|---|---|---|
| `src/terminal/art/artEdges.js` | all prism drawing arithmetic, pure | **modify** — add the chroma phase, the unison geometry, and the anchor writer |
| `src/terminal/art/__tests__/artEdges.test.js` | unit tests for the above | **modify** — add the property tests |
| `src/terminal/views/ArtTab.jsx` | the draw loop and the window hooks | **modify** — the mode ref, the anchor call, the chroma phase branch, `__artSetChromaMode` |
| `scripts/_a23combR.mjs` | circular concentration R and delivered saturation, per arm, on filmed frames | **create** |
| `scripts/_a22chroma.mjs` | the luminance bound | **modify** — extend part 1 to the saturation axis |

The anchor loop currently lives inline in `ArtTab.jsx:2011-2028`. Task 3 lifts it into `artEdges.js` as `prismWriteAnchors`, which is what makes the "once per spectral line, not per point" property testable at all — today it is only a comment.

---

### Task 1: The un-sheared chroma phase and the mode constants

**Files:**
- Modify: `src/terminal/art/artEdges.js` (after `prismWavePhase`, ~line 671)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `PRISM_WAVE_W`, `prismPhaseOffset`, `prismWavePhase` (all existing)
- Produces:
  - `prismChromaPhase(u: number, tMs: number, durMs: number) -> number`
  - `PRISM_CHROMA_MODE_SHIPPED = 0`, `PRISM_CHROMA_MODE_UNISON = 1`, `PRISM_CHROMA_MODE_ACHROMATIC = 2`
  - `PRISM_A_WAKE_SAT = 35`

- [ ] **Step 1: Write the failing tests**

Add to `src/terminal/art/__tests__/artEdges.test.js`, inside the existing prism describe block:

```js
describe('prismChromaPhase — the colour\'s advection coordinate', () => {
  // THE COLOUR AND THE BRIGHTNESS NO LONGER SHARE ONE PHASE, AND THAT IS THE
  // POINT. prismWavePhase carries prismPhaseOffset(k) * (1 - uu), which makes
  // each strand collapse by its own fraction -- and a unison collapse driven
  // that way folds the comb over itself (spec section 3, min neighbour gap
  // -31.16deg). The colour takes the un-sheared phase so the collapse is
  // common across the bundle; the alpha wave keeps its diagonal.
  it('is independent of the spectral line index', () => {
    const a = prismChromaPhase(0.4, 50, 120);
    for (let k = 0; k < 7; k++) {
      expect(prismChromaPhase(0.4, 50, 120)).toBe(a);
    }
    // and it differs from the sheared phase on every line but k = 0
    for (let k = 1; k < 7; k++) {
      expect(prismWavePhase(0.4, k, 50, 120)).not.toBe(a);
    }
  });

  it('agrees exactly with prismWavePhase on line 0, where the shear is zero', () => {
    // prismPhaseOffset(0) is 0, so this is an identity, not an approximation.
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      expect(prismChromaPhase(u, 70, 110)).toBe(prismWavePhase(u, 0, 70, 110));
    }
  });

  it('clamps u and guards a zero duration, exactly as prismWavePhase does', () => {
    expect(prismChromaPhase(-1, 0, 100)).toBe(prismChromaPhase(0, 0, 100));
    expect(prismChromaPhase(2, 0, 100)).toBe(prismChromaPhase(1, 0, 100));
    expect(Number.isFinite(prismChromaPhase(0.5, 10, 0))).toBe(true);
  });
});

describe('the chroma mode constants', () => {
  it('makes the SHIPPED arm 0, which is the default everywhere', () => {
    // Load-bearing: mode 0 selects the shipped anchor expression, so the
    // shipped path is unchanged and the parity reference at 33bda07e is
    // untouched. Getting this backwards would repaint every cascade.
    expect(PRISM_CHROMA_MODE_SHIPPED).toBe(0);
    expect(PRISM_CHROMA_MODE_UNISON).toBe(1);
    expect(PRISM_CHROMA_MODE_ACHROMATIC).toBe(2);
  });

  it('keeps arm A\'s wake saturation inside the real range', () => {
    expect(PRISM_A_WAKE_SAT).toBeGreaterThan(0);
    expect(PRISM_A_WAKE_SAT).toBeLessThan(PRISM_SAT);
  });
});
```

Add the new names to the existing import at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "chroma"
```

Expected: FAIL. `prismChromaPhase is not a function`, and `PRISM_CHROMA_MODE_SHIPPED is not defined`.

- [ ] **Step 3: Implement**

In `src/terminal/art/artEdges.js`, immediately after `prismWavePhase` (which ends ~line 671):

```js
/**
 * The COLOUR's advection coordinate: `prismWavePhase` with the per-strand
 * shear removed.
 *
 * ── THE COLOUR AND THE BRIGHTNESS DELIBERATELY NO LONGER SHARE ONE PHASE ──
 *
 * The note on prismChromaBlend's original call site said they must, and the
 * reason was sound: one number means the tint cannot drift out of step with
 * the crest it belongs to. It is overridden here for a MEASURED reason, not a
 * taste one.
 *
 * prismWavePhase carries prismPhaseOffset(k) * (1 - uu), so each strand
 * reaches its crest at its own moment. Drive a UNISON COLLAPSE off that and
 * the comb folds over itself: strand 0 must travel 144deg to reach the middle
 * strand's hue while strand 1 travels only 96deg, so when the crest sits near
 * strand 0 it collapses further, OVERTAKES strand 1, and lands EXACTLY on
 * strand 1's resting hue. Measured minimum neighbour gap -31.16deg. That is
 * the "it jumps erratically between wire indices" reading this whole line of
 * work exists to remove, re-entering through a door the 0.75-step bound does
 * not cover -- that bound constrains the SIZE of a differential rotation and
 * says nothing about a collapse that overtakes.
 *
 * With a phase common to the bundle the collapse fraction is common too, and
 * the comb is monotone by construction: d(hue_k)/dk = PRISM_HUE_STEP * (1 - t),
 * which is positive for every t < 1. See prismUnisonHue.
 *
 * THE ALPHA WAVE IS NOT TOUCHED. The diagonal wavefront across the bundle is
 * the brightness's, and it stays exactly as it shipped. The shear belongs to
 * the light, not to the colour.
 */
export function prismChromaPhase(u, tMs, durMs) {
  const d = durMs > 1e-6 ? durMs : 1e-6;
  const uu = u < 0 ? 0 : u > 1 ? 1 : u;
  return uu - tMs / d;
}

// ── THE CHROMA ARMS ────────────────────────────────────────────────────────
//
// Three anchor expressions behind one switch, so the author can rule between
// them inside ONE page at one seed on one rAF cycle. See the design spec
// 2026-09-22-prism-chroma-ab-design.md for why the shipped arm is invisible:
// the bundle puts 288deg of the hue wheel on screen 2.8px apart, so a crest
// has no reference hue to be different from and no excursion of any size is
// trackable.

/** The shipped arm: hue_k + LEAD, skewed. Rotates each strand in place. */
export const PRISM_CHROMA_MODE_SHIPPED = 0;

/** Arm U: every strand gathers onto the comb's midpoint hue. */
export const PRISM_CHROMA_MODE_UNISON = 1;

/** Arm A: the crest bleaches; hues do not move at all. */
export const PRISM_CHROMA_MODE_ACHROMATIC = 2;

/**
 * Arm A's WAKE saturation, against a leading edge of 0.
 *
 * CHOSEN, NEVER SEEN BY AN EYE.
 *
 * A grey anchor has no hue for PRISM_HUE_SKEW to act on, so arm A would look
 * identical arriving and leaving -- a pattern that pulses rather than one that
 * flows, which is exactly what PRISM_HUE_SKEW was introduced to prevent. Arm
 * A takes its direction on the saturation axis instead: the leading edge
 * bleaches to pure white and colour floods back in behind it.
 */
export const PRISM_A_WAKE_SAT = 35;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "chroma"
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): give the colour its own un-sheared advection coordinate

The tint rides prismWavePhase today, which carries prismPhaseOffset(k). Drive
a unison collapse off that and the comb FOLDS: strand 0 travels 144deg where
strand 1 travels 96deg, overtakes it, and lands exactly on strand 1's resting
hue. Measured min neighbour gap -31.16deg -- the index-confusion reading this
work exists to remove, through a door the 0.75-step bound does not cover.

prismChromaPhase drops the shear term. The alpha wave keeps its diagonal
untouched: the shear belongs to the light, not the colour.

Also lands the three arm constants and PRISM_A_WAKE_SAT. Mode 0 is SHIPPED and
is the default everywhere, so the parity reference at 33bda07e is untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The unison geometry, and the monotone theorem

**Files:**
- Modify: `src/terminal/art/artEdges.js` (after the constants from Task 1)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `PRISM_HUE_STEP`, `PRISM_SPECTRAL_FINE`, `PRISM_SPECTRAL_COARSE`, `prismChromaPhase` (Task 1)
- Produces:
  - `prismUnisonK(n: number) -> number` — the comb's fixed point, `(n - 1) / 2`
  - `prismUnisonHue(hue0: number, k: number, n: number, t: number) -> number` — strand `k`'s hue at collapse fraction `t`, NOT wrapped to 360 so ordering is testable
  - `prismTravelSign(k: number, n: number) -> -1 | 0 | 1`

- [ ] **Step 1: Write the failing tests**

```js
describe('the unison collapse — arm U\'s geometry', () => {
  // THE THEOREM THIS ARM RESTS ON. A common collapse fraction gives
  //   hue_k(t) = hue_k + (target - hue_k) * t
  //   d(hue_k)/dk = PRISM_HUE_STEP * (1 - t) > 0   for all t < 1
  // so the comb contracts uniformly and NEVER self-crosses. Drive the same
  // collapse from the sheared per-strand amplitude instead and the measured
  // minimum neighbour gap is -31.16deg. This test is the difference.
  it.each([
    ['fine',   PRISM_SPECTRAL_FINE],
    ['coarse', PRISM_SPECTRAL_COARSE],
  ])('%s: the comb is strictly monotone in k at every collapse fraction', (_n, n) => {
    for (let i = 0; i < 100; i++) {          // t = 0 .. 0.99, excluding 1
      const t = i / 100;
      for (let k = 1; k < n; k++) {
        const gap = prismUnisonHue(0, k, n, t) - prismUnisonHue(0, k - 1, n, t);
        expect(gap).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ['fine',   PRISM_SPECTRAL_FINE],
    ['coarse', PRISM_SPECTRAL_COARSE],
  ])('%s: every strand lands on ONE hue at full collapse', (_n, n) => {
    const target = prismUnisonHue(0, 0, n, 1);
    for (let k = 1; k < n; k++) {
      expect(prismUnisonHue(0, k, n, 1)).toBeCloseTo(target, 10);
    }
    // and that hue is the comb's midpoint, not strand 0's
    expect(target).toBeCloseTo(prismUnisonK(n) * PRISM_HUE_STEP, 10);
  });

  it.each([
    ['fine',   PRISM_SPECTRAL_FINE],
    ['coarse', PRISM_SPECTRAL_COARSE],
  ])('%s: is exactly the resting comb at t = 0', (_n, n) => {
    for (let k = 0; k < n; k++) {
      expect(prismUnisonHue(40, k, n, 0)).toBe(40 + k * PRISM_HUE_STEP);
    }
  });

  it('puts the fine fixed point ON a strand and the coarse one BETWEEN two', () => {
    // A literal 3 would pass the fine path and put the coarse pointer's target
    // outside its own comb, on the far side of its widest line.
    expect(prismUnisonK(PRISM_SPECTRAL_FINE)).toBe(3);
    expect(prismUnisonK(PRISM_SPECTRAL_COARSE)).toBe(1.5);
  });

  it('gives the fine fixed-point strand exactly zero excursion', () => {
    const n = PRISM_SPECTRAL_FINE, k = prismUnisonK(n);
    for (const t of [0, 0.3, 0.7, 1]) {
      expect(prismUnisonHue(0, k, n, t)).toBe(k * PRISM_HUE_STEP);
    }
  });

  it('gives the outer strands equal and opposite excursions', () => {
    const n = PRISM_SPECTRAL_FINE, t = 1;
    const lo = prismUnisonHue(0, 0,     n, t) - 0;
    const hi = prismUnisonHue(0, n - 1, n, t) - (n - 1) * PRISM_HUE_STEP;
    expect(lo).toBeCloseTo(-hi, 10);
    expect(Math.abs(lo)).toBeCloseTo(3 * PRISM_HUE_STEP, 10);
  });

  it('signs the travel by which side of the fixed point a strand is on', () => {
    // The skew must follow the direction of travel. A fixed +SKEW would make
    // the leading edge OVERSHOOT on one half of the comb and UNDERSHOOT on the
    // other, so the two halves would read as arriving and leaving at once.
    const n = PRISM_SPECTRAL_FINE;
    expect(prismTravelSign(0, n)).toBe(1);
    expect(prismTravelSign(2, n)).toBe(1);
    expect(prismTravelSign(3, n)).toBe(0);   // the still centre of the gather
    expect(prismTravelSign(4, n)).toBe(-1);
    expect(prismTravelSign(6, n)).toBe(-1);
  });

  it('has no zero-sign strand on the coarse comb, where no line sits on the fixed point', () => {
    const n = PRISM_SPECTRAL_COARSE;
    for (let k = 0; k < n; k++) expect(prismTravelSign(k, n)).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "unison"
```

Expected: FAIL. `prismUnisonHue is not a function`.

- [ ] **Step 3: Implement**

In `src/terminal/art/artEdges.js`, after `PRISM_A_WAKE_SAT`:

```js
/**
 * The comb's fixed point: the spectral index every strand gathers onto.
 *
 * DERIVED FROM THE LIVE LINE COUNT, NEVER A LITERAL 3. It is 3 on
 * PRISM_SPECTRAL_FINE = 7 and 1.5 on PRISM_SPECTRAL_COARSE = 4, where NO
 * STRAND SITS ON IT AT ALL. That is not a defect -- the target is a HUE, not a
 * strand, and a coarse bundle gathers onto a colour none of its four lines is
 * wearing. A literal 3 would put the coarse target outside its own comb, on
 * the far side of its widest line.
 */
export function prismUnisonK(n) {
  return (n - 1) / 2;
}

/**
 * Strand `k`'s hue at collapse fraction `t`, for a bundle of `n` lines.
 *
 * NOT WRAPPED TO 360, deliberately. The monotonicity that makes this arm safe
 * is a statement about ORDER, and a modulo destroys the order it is asserted
 * on. The caller wraps, once, at the writeHsl boundary.
 *
 * ── WHY THIS IS SAFE AT 144deg WHEN THE SHIPPED ARM IS BOUNDED AT 34 ──────
 *
 * The 0.75-step bound exists because a crest free to rotate a full
 * PRISM_HUE_STEP wears its NEIGHBOUR's resting colour, which reads as the
 * bundle jumping between wire indices. That bound governs a DIFFERENTIAL
 * rotation: each strand moving independently past its neighbour.
 *
 * A collapse has no differential. Every strand moves toward the same point by
 * the same fraction, so
 *
 *     d(hue_k)/dk = PRISM_HUE_STEP * (1 - t)  >  0   for all t < 1
 *
 * and the comb contracts uniformly without ever crossing itself. No strand can
 * reach a neighbour's hue while the neighbour is elsewhere, because they are
 * both moving and the ordering is preserved. At t = 1 they are all equal,
 * which is the arm's whole point and cannot read as an index swap because no
 * index is singled out.
 *
 * THIS HOLDS ONLY FOR A COMMON `t`. See prismChromaPhase for what happens --
 * measured -- when the per-strand sheared amplitude is used instead.
 */
export function prismUnisonHue(hue0, k, n, t) {
  const rest = hue0 + k * PRISM_HUE_STEP;
  const target = hue0 + prismUnisonK(n) * PRISM_HUE_STEP;
  return rest + (target - rest) * t;
}

/**
 * Which way strand `k` travels under a collapse: +1 toward increasing hue, -1
 * toward decreasing, 0 for a strand already on the fixed point.
 *
 * THE SKEW MUST BE SIGNED BY THIS. Strands below the fixed point travel toward
 * increasing hue and strands above it travel toward decreasing hue, so a fixed
 * +PRISM_HUE_SKEW would make the leading edge OVERSHOOT on one half of the comb
 * and UNDERSHOOT on the other -- the two halves would read as arriving and
 * leaving at the same time, which is precisely the symmetric-tint failure
 * PRISM_HUE_SKEW exists to prevent.
 *
 * ZERO AT THE FIXED POINT, AND THAT IS NOT AN EDGE CASE TO PATCH AROUND. The
 * middle strand of a fine bundle does not move and takes no skew: it is the
 * still centre the others gather onto. On a coarse bundle the fixed point falls
 * between two lines and no strand returns 0.
 */
export function prismTravelSign(k, n) {
  const d = prismUnisonK(n) - k;
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "unison"
```

Expected: PASS, 11 tests (the three `it.each` cases produce 2 each).

- [ ] **Step 5: Falsify the theorem test**

This is the one test in the plan that must be proven non-vacuous by hand, because it is the defect that was found before any code existed.

Temporarily change `prismUnisonHue`'s last line to use a per-strand fraction:

```js
  return rest + (target - rest) * t * (1 - 0.12 * Math.abs(prismUnisonK(n) - k));
```

Run: `npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "monotone"`
Expected: **FAIL** — `expected -X to be greater than 0`. This is the comb folding.

Revert the line to `return rest + (target - rest) * t;` and re-run: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): the unison collapse, and the theorem that makes it safe

Arm U gathers every spectral line onto the comb's midpoint hue. That is a
144deg excursion on the outer strands against a shipped bound of 34, and it is
safe for a reason the bound does not describe: the bound governs DIFFERENTIAL
rotation, and a collapse has no differential.

  d(hue_k)/dk = PRISM_HUE_STEP * (1 - t) > 0  for all t < 1

so the comb contracts uniformly and never self-crosses. The test walks t in
100 steps on BOTH line counts and asserts a positive neighbour gap throughout;
falsified by hand against a per-strand fraction, which fails as the fold.

prismUnisonK is derived as (n-1)/2, never a literal 3 -- it is 1.5 on the
coarse comb, where no strand sits on the fixed point and the target is a hue
none of the four lines is wearing. prismTravelSign signs the skew by direction
of travel, and is 0 on the still centre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The anchor writer — one function, three arms

**Files:**
- Modify: `src/terminal/art/artEdges.js` (after `prismTintHue`, ~line 786)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1 and 2, plus `PRISM_SAT`, `PRISM_GLOW_LIT`, `PRISM_CORE_LIT`, `PRISM_HUE_LEAD`, `PRISM_HUE_SKEW`, `prismTintHue`, `writeHsl` (from `../gl/...`, already imported by `artEdges.js`'s consumers — see note in Step 3)
- Produces:
  - `prismAnchorHue(mode, hue0, k, n, side) -> number`
  - `prismAnchorSat(mode, side) -> number`
  - `prismWriteAnchors(out, mode, hue0, n, coreOff) -> number` — fills `out`, returns the number of anchors written

- [ ] **Step 1: Write the failing tests**

```js
describe('prismAnchorHue / prismAnchorSat — the three arms', () => {
  const N = PRISM_SPECTRAL_FINE;

  it('mode 0 reproduces the shipped expression EXACTLY', () => {
    // The parity argument. Mode 0 must not be "close to" the shipped path.
    for (let k = 0; k < N; k++) {
      const h = (40 + k * PRISM_HUE_STEP) % 360;
      for (const side of [1, -1]) {
        expect(prismAnchorHue(PRISM_CHROMA_MODE_SHIPPED, 40, k, N, side))
          .toBe(prismTintHue(h, side));
        expect(prismAnchorSat(PRISM_CHROMA_MODE_SHIPPED, side)).toBe(PRISM_SAT);
      }
    }
  });

  it('mode U anchors every strand on the fixed-point hue, skewed by travel', () => {
    for (let k = 0; k < N; k++) {
      const target = 40 + prismUnisonK(N) * PRISM_HUE_STEP;
      const sign = prismTravelSign(k, N);
      expect(prismAnchorHue(PRISM_CHROMA_MODE_UNISON, 40, k, N,  1))
        .toBeCloseTo(target + sign * PRISM_HUE_SKEW, 10);
      expect(prismAnchorHue(PRISM_CHROMA_MODE_UNISON, 40, k, N, -1))
        .toBeCloseTo(target - sign * PRISM_HUE_SKEW, 10);
    }
  });

  it('mode U leaves the still centre unskewed on both sides', () => {
    const k = prismUnisonK(N), target = 40 + k * PRISM_HUE_STEP;
    expect(prismAnchorHue(PRISM_CHROMA_MODE_UNISON, 40, k, N,  1)).toBeCloseTo(target, 10);
    expect(prismAnchorHue(PRISM_CHROMA_MODE_UNISON, 40, k, N, -1)).toBeCloseTo(target, 10);
  });

  it('mode U keeps full saturation — it is a gather, not a bleach', () => {
    expect(prismAnchorSat(PRISM_CHROMA_MODE_UNISON,  1)).toBe(PRISM_SAT);
    expect(prismAnchorSat(PRISM_CHROMA_MODE_UNISON, -1)).toBe(PRISM_SAT);
  });

  it('mode A does not move a single hue', () => {
    // If A were a rotation in disguise the A/B would be comparing two
    // rotations and would answer nothing.
    for (let k = 0; k < N; k++) {
      const rest = (40 + k * PRISM_HUE_STEP) % 360;
      for (const side of [1, -1]) {
        expect(prismAnchorHue(PRISM_CHROMA_MODE_ACHROMATIC, 40, k, N, side)).toBe(rest);
      }
    }
  });

  it('mode A bleaches the lead harder than the wake', () => {
    // A grey anchor has no hue for the skew to act on, so A takes its
    // direction here or it pulses instead of flowing.
    expect(prismAnchorSat(PRISM_CHROMA_MODE_ACHROMATIC,  1)).toBe(0);
    expect(prismAnchorSat(PRISM_CHROMA_MODE_ACHROMATIC, -1)).toBe(PRISM_A_WAKE_SAT);
    expect(prismAnchorSat(PRISM_CHROMA_MODE_ACHROMATIC, 1))
      .toBeLessThan(prismAnchorSat(PRISM_CHROMA_MODE_ACHROMATIC, -1));
  });
});

describe('prismWriteAnchors — once per spectral line, never per point', () => {
  const N = PRISM_SPECTRAL_FINE, CORE = PRISM_SPECTRAL_FINE * 6;

  it('writes exactly 4 anchors per line and says how many', () => {
    // THE ALLOCATION CONTRACT, MADE TESTABLE. This was only a comment before:
    // the anchors are converted once per line because writeHsl allocates a
    // closure per call, and evaluating it per point puts tens of thousands of
    // allocations a frame on a loop this file keeps clear of them.
    const out = new Float32Array(CORE * 2);
    const written = prismWriteAnchors(out, PRISM_CHROMA_MODE_SHIPPED, 40, N, CORE);
    expect(written).toBe(4 * N);
  });

  it('mode 0 fills the buffer byte-identically to the shipped loop', () => {
    const out = new Float32Array(CORE * 2);
    prismWriteAnchors(out, PRISM_CHROMA_MODE_SHIPPED, 40, N, CORE);

    const ref = new Float32Array(CORE * 2);
    for (let k = 0; k < N; k++) {
      const h = (40 + k * PRISM_HUE_STEP) % 360;
      const hL = prismTintHue(h, 1), hT = prismTintHue(h, -1);
      writeHsl(ref, k * 6,             hL, PRISM_SAT, PRISM_GLOW_LIT);
      writeHsl(ref, k * 6 + 3,         hT, PRISM_SAT, PRISM_GLOW_LIT);
      writeHsl(ref, CORE + k * 6,      hL, PRISM_SAT, PRISM_CORE_LIT);
      writeHsl(ref, CORE + k * 6 + 3,  hT, PRISM_SAT, PRISM_CORE_LIT);
    }
    expect(Array.from(out)).toEqual(Array.from(ref));
  });

  it('mode A writes an achromatic lead: r, g and b equal at every lead anchor', () => {
    const out = new Float32Array(CORE * 2);
    prismWriteAnchors(out, PRISM_CHROMA_MODE_ACHROMATIC, 40, N, CORE);
    for (let k = 0; k < N; k++) {
      const o = k * 6;                       // the LEAD anchor of the glow pass
      expect(out[o]).toBeCloseTo(out[o + 1], 6);
      expect(out[o + 1]).toBeCloseTo(out[o + 2], 6);
      const w = k * 6 + 3;                   // the WAKE anchor still has colour
      expect(Math.max(out[w], out[w+1], out[w+2]) - Math.min(out[w], out[w+1], out[w+2]))
        .toBeGreaterThan(0.01);
    }
  });

  it('mode U writes the SAME rgb into every line\'s lead anchor at the still centre\'s hue', () => {
    const out = new Float32Array(CORE * 2);
    prismWriteAnchors(out, PRISM_CHROMA_MODE_UNISON, 40, N, CORE);
    // strands equidistant from the fixed point travel opposite ways, so their
    // skewed anchors straddle it symmetrically
    const mid = prismUnisonK(N) * 6;
    for (let c = 0; c < 3; c++) {
      expect(out[mid + c]).toBeCloseTo(out[mid + 3 + c], 6);   // centre: no skew
    }
  });

  it('handles the coarse comb without reading past its own lines', () => {
    const out = new Float32Array(CORE * 2).fill(-1);
    const written = prismWriteAnchors(out, PRISM_CHROMA_MODE_UNISON, 40,
                                      PRISM_SPECTRAL_COARSE, CORE);
    expect(written).toBe(4 * PRISM_SPECTRAL_COARSE);
    // lines beyond the coarse count are untouched
    expect(out[PRISM_SPECTRAL_COARSE * 6]).toBe(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "arms"
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismWriteAnchors"
```

Expected: FAIL. `prismAnchorHue is not a function`, `prismWriteAnchors is not a function`.

- [ ] **Step 3: Implement**

First confirm `writeHsl`'s import path in `artEdges.js`. If `artEdges.js` does not already import it, add it from the same module `ArtTab.jsx:62` imports it from:

```bash
grep -n "writeHsl" src/terminal/art/artEdges.js | head -3
grep -n "^import" src/terminal/art/artEdges.js | head -5
grep -n "createEdgeState, writeHsl" src/terminal/views/ArtTab.jsx
```

Then, in `src/terminal/art/artEdges.js` after `prismTintHue`:

```js
/**
 * A tint anchor's HUE, for the selected arm. `side` is +1 for the leading
 * edge and -1 for the wake.
 *
 * THE ARMS ARE ONLY THIS FUNCTION AND ITS SATURATION TWIN. Everything that
 * applies the tint -- prismChromaBlend, the per-point loop, writePolyline's
 * rgbs -- is untouched by the A/B. That is deliberate: a comparison whose two
 * halves run different machinery compares the machinery.
 */
export function prismAnchorHue(mode, hue0, k, n, side) {
  const rest = (hue0 + k * PRISM_HUE_STEP) % 360;
  if (mode === PRISM_CHROMA_MODE_UNISON) {
    // The full collapse is the ANCHOR; how far a point actually travels toward
    // it is prismChromaBlend's `amp`, exactly as for the shipped arm.
    return prismUnisonHue(hue0, k, n, 1) + side * prismTravelSign(k, n) * PRISM_HUE_SKEW;
  }
  if (mode === PRISM_CHROMA_MODE_ACHROMATIC) return rest;   // A moves saturation, not hue
  return prismTintHue(rest, side);
}

/** A tint anchor's SATURATION, for the selected arm. */
export function prismAnchorSat(mode, side) {
  if (mode !== PRISM_CHROMA_MODE_ACHROMATIC) return PRISM_SAT;
  return side > 0 ? 0 : PRISM_A_WAKE_SAT;
}

/**
 * Fill the tint-anchor buffer for a whole bundle: four anchors per spectral
 * line (lead and wake, glow pass and core pass). Returns how many it wrote.
 *
 * LIFTED OUT OF THE DRAW LOOP SO THE "ONCE PER LINE" CONTRACT IS TESTABLE.
 * It was a comment before, and a comment cannot fail. writeHsl allocates a
 * closure per call and `subarray` allocates a view per call; either one
 * evaluated per POINT puts tens of thousands of allocations a frame on a loop
 * this file keeps deliberately clear of them. A spectral line's hue depends on
 * nothing about the chord, so this runs 4n times per effect per frame against
 * the 770 writeHsl calls the base colour already spends on a full eleven-node
 * effect.
 *
 * NOT GATED ON WHETHER ANYTHING IS WAVING, for the same reason it was not
 * before: the gate costs more to decide than the work it skips.
 */
export function prismWriteAnchors(out, mode, hue0, n, coreOff) {
  for (let k = 0; k < n; k++) {
    const hL = prismAnchorHue(mode, hue0, k, n,  1);
    const hT = prismAnchorHue(mode, hue0, k, n, -1);
    const sL = prismAnchorSat(mode,  1);
    const sT = prismAnchorSat(mode, -1);
    writeHsl(out, k * 6,                hL, sL, PRISM_GLOW_LIT);
    writeHsl(out, k * 6 + 3,            hT, sT, PRISM_GLOW_LIT);
    writeHsl(out, coreOff + k * 6,      hL, sL, PRISM_CORE_LIT);
    writeHsl(out, coreOff + k * 6 + 3,  hT, sT, PRISM_CORE_LIT);
  }
  return 4 * n;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "arms"
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismWriteAnchors"
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Falsify the mode-0 parity test**

Temporarily change `prismAnchorHue`'s last line to `return prismTintHue(rest, side) + 0.001;`

Run: `npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "byte-identically"`
Expected: **FAIL**. Revert and re-run: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): three chroma arms behind one anchor function

The arms ARE prismAnchorHue and prismAnchorSat and nothing else.
prismChromaBlend, the per-point loop and writePolyline's rgbs are untouched --
a comparison whose halves run different machinery compares the machinery.

prismWriteAnchors lifts the anchor loop out of ArtTab's draw path, which is
what makes the once-per-spectral-line contract testable: it was a comment
before, and a comment cannot fail.

Arm A moves SATURATION, not hue, and a test pins that it moves no hue at all.
Its lead bleaches to 0 and its wake keeps PRISM_A_WAKE_SAT, because a grey
anchor has no hue for PRISM_HUE_SKEW to act on and an A without that asymmetry
would pulse instead of flow.

Mode 0 is asserted byte-identical to the shipped loop, not close to it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the switch into the draw loop

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` — import block at `:103`, ref near `:554`, the chroma branch at `:1892-1923`, the anchor loop at `:2011-2028`, the hooks near `:3154`
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `prismChromaPhase`, `prismWriteAnchors`, `PRISM_CHROMA_MODE_*` (Tasks 1–3)
- Produces: `window.__artSetChromaMode(n) -> { chromaMode: number } | null`

- [ ] **Step 1: Add the imports and the ref**

In `ArtTab.jsx`, extend the import at `:103`:

```js
  prismPulse, prismWavePhase, prismChromaSkew, prismChromaBlend, prismTintHue,
  prismChromaPhase, prismWriteAnchors,
  PRISM_CHROMA_MODE_SHIPPED, PRISM_CHROMA_MODE_UNISON, PRISM_CHROMA_MODE_ACHROMATIC,
```

(`prismTintHue` stays imported only if still referenced after Step 3; remove it from the import if the anchor loop was its only consumer — `npm run lint` will report it as unused.)

Next to `beadScaleRef` at `:554`:

```js
  // The chromatic front's A/B arm. 0 is SHIPPED and is load-bearing: it
  // selects the shipped anchor expression, so the default path runs the code
  // it ran before this feature existed and the parity reference at 33bda07e is
  // untouched. Getting this default wrong would repaint every cascade the app
  // draws. A ref and not state, because flipping an arm must not re-render --
  // the whole point is to switch inside ONE page without disturbing the world
  // the previous arm was measured in.
  const chromaModeRef = useRef(PRISM_CHROMA_MODE_SHIPPED);
```

- [ ] **Step 2: Hoist the arm into the per-effect scope, then replace the anchor loop**

**`_cMode` MUST BE DECLARED WHERE BOTH SITES CAN SEE IT.** The anchor loop sits at `:2011` in the pair-loop scope; the chroma branch at `:1892` is inside the polyline lambda, which closes over the `let _wK, _wDur, _wT, _wDir, _wFade, _wEnv` block at `:1861` and `_wTintOff` at `:1867`. Declaring `_cMode` at the anchor loop would leave the lambda referencing an undefined name — and a piped lint has masked exactly that class of `no-undef` into a commit on this branch before.

At `ArtTab.jsx:1867`, beside `_wTintOff`:

```js
        // Read ONCE PER EFFECT, not per point and not per pair: an arm that
        // changed mid-effect would put two treatments in one frame and the
        // A/B would be comparing a blend of them.
        const _cMode = chromaModeRef.current;
```

Then at `ArtTab.jsx:2023-2028`, replace the six lines from `const h = (hue0 + ...` through the closing brace of the `for` with a single call. The surrounding comment block stays; append to it:

```js
          // THE ARM IS CHOSEN HERE AND NOWHERE ELSE. prismWriteAnchors owns
          // the expression; everything downstream is arm-agnostic.
          const tintCore = PRISM_SPECTRAL_FINE * 6;
          prismWriteAnchors(tint, _cMode, hue0, spectralN, tintCore);
```

- [ ] **Step 3: Split the chroma phase from the alpha phase**

At `ArtTab.jsx:1912-1922`, replace the comment and the `prismChromaBlend` call:

```js
              // THE COLOUR NO LONGER RIDES THE BRIGHTNESS'S NUMBER ON ARMS U
              // AND A, AND THAT OVERRIDES THE NOTE THAT USED TO STAND HERE.
              // The old reasoning was sound -- one advection coordinate means
              // the tint cannot drift out of step with its crest -- but
              // prismWavePhase carries prismPhaseOffset(k), and a UNISON
              // collapse driven per-strand folds the comb: strand 0 overtakes
              // strand 1 and lands exactly on its resting hue, measured min
              // neighbour gap -31.16deg. See prismChromaPhase.
              //
              // MODE 0 STILL USES `ph`, EXACTLY AS BEFORE, so the shipped path
              // is unchanged and the parity reference is untouched.
              let cph = ph;
              if (_cMode !== PRISM_CHROMA_MODE_SHIPPED) {
                cph = _wDir === 0
                  ? (prismChromaPhase(tt, _wT, _wDur) >= 0
                       ? prismChromaPhase(tt, _wT, _wDur)
                       : prismChromaPhase(1 - tt, _wT, _wDur))
                  : prismChromaPhase(_wDir < 0 ? 1 - tt : tt, _wT, _wDur);
              }
              const camp = _cMode === PRISM_CHROMA_MODE_SHIPPED ? amp : prismPulse(cph);
              const tO = _wTintOff + _wK * 6;
              // The tint's weight is the amplitude TIMES the envelope and the
              // segment fade -- the same three terms the alpha mix takes. A
              // tint that ignored them would be at full strength on a chord
              // whose brightness wave had already faded out.
              prismChromaBlend(crgb, i * 3, rgb, tint, tO, tO + 3,
                               camp * env * _wFade, prismChromaSkew(cph));
```

For the two-ended case (`_wDir === 0`) the stronger front must still own the point. Replace the expression above with the explicit branch so both phases are computed once:

```js
              let cph = ph;
              if (_cMode !== PRISM_CHROMA_MODE_SHIPPED) {
                if (_wDir === 0) {
                  const cA = prismChromaPhase(tt, _wT, _wDur);
                  const cB = prismChromaPhase(1 - tt, _wT, _wDur);
                  cph = prismPulse(cA) >= prismPulse(cB) ? cA : cB;
                } else {
                  cph = prismChromaPhase(_wDir < 0 ? 1 - tt : tt, _wT, _wDur);
                }
              }
```

- [ ] **Step 4: Add the hook**

Immediately above `window.__artSetBeadScale` at `ArtTab.jsx:3154`:

```js
    // The chromatic front's arm switch. Same contract and same reasons as
    // __artSetBeadScale below: writes a ref the draw loop already reads, takes
    // effect on the NEXT DRAW with no re-render, no rebuild and no relaunch,
    // and RETURNS what it set so a caller can assert the flip landed instead
    // of assuming it did.
    //
    //   0 = shipped (hue rotation in place)   1 = unison   2 = achromatic
    window.__artSetChromaMode = (v = PRISM_CHROMA_MODE_SHIPPED) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > PRISM_CHROMA_MODE_ACHROMATIC) return null;
      chromaModeRef.current = n;
      return { chromaMode: n };
    };
```

- [ ] **Step 5: Write the failing test for the hook's contract**

```js
describe('__artSetChromaMode — the arm switch contract', () => {
  // THE VACUOUS-HOOK LESSON. A setter that returns undefined lets a caller
  // "assert" the flip landed by asserting nothing. This one returns the value
  // it set, exactly as __artSetOrthogonal was made to after that bit.
  const make = () => {
    const ref = { current: PRISM_CHROMA_MODE_SHIPPED };
    const set = (v = PRISM_CHROMA_MODE_SHIPPED) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > PRISM_CHROMA_MODE_ACHROMATIC) return null;
      ref.current = n;
      return { chromaMode: n };
    };
    return { ref, set };
  };

  it('returns what it set, for every valid arm', () => {
    const { ref, set } = make();
    for (const m of [PRISM_CHROMA_MODE_SHIPPED, PRISM_CHROMA_MODE_UNISON,
                     PRISM_CHROMA_MODE_ACHROMATIC]) {
      expect(set(m)).toEqual({ chromaMode: m });
      expect(ref.current).toBe(m);
    }
  });

  it('refuses a mode outside the arms and leaves the ref alone', () => {
    const { ref, set } = make();
    set(PRISM_CHROMA_MODE_UNISON);
    for (const bad of [-1, 3, 1.5, NaN, 'unison', null]) {
      expect(set(bad)).toBeNull();
      expect(ref.current).toBe(PRISM_CHROMA_MODE_UNISON);
    }
  });

  it('defaults to the shipped arm when called with no argument', () => {
    const { set } = make();
    expect(set()).toEqual({ chromaMode: PRISM_CHROMA_MODE_SHIPPED });
  });
});
```

- [ ] **Step 6: Run the whole suite and the lint gate**

```bash
npm test
npm run lint
```

Expected: all tests pass (the suite was 1490 at `24803fc0`; the count will have grown). Lint: **0 errors**, warnings at or under 153. **Read the printed counts — do not pipe this command; a piped lint masked two `no-undef` errors into a commit on this branch before.**

- [ ] **Step 7: Verify the shipped path in the browser before trusting any arm**

Start the dev server on 5173 (`npm run dev`), then:

```bash
node scripts/_a22chroma.mjs 1520 900 1 5173
```

Expected: part 2 still reports runs with `c0 != c2`, i.e. the shipped arm still advects colour. If this regresses, mode 0 is not the identity and Task 3's parity test is lying.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): make the chromatic front an arm you can flip

Follows 24803fc0 exactly: a ref the draw loop already copies, a hook that
RETURNS what it set so a caller can assert the flip landed, effect on the next
draw with no re-render, no rebuild and no relaunch. Both arms reachable inside
ONE page at one seed on one rAF cycle, which is the only way this comparison
beats its own noise.

THE DEFAULT IS 0 AND IT IS THE SHIPPED PATH. Mode 0 takes the sheared `ph`
exactly as before and prismWriteAnchors is asserted byte-identical to the loop
it replaces, so the parity reference at 33bda07e is untouched.

Arms U and A take the un-sheared chroma phase, which overrides the note that
stood at the blend site -- the colour and the brightness deliberately no longer
share one number, for the measured reason in prismChromaPhase.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `_a23combR.mjs` — the visibility metric

**Files:**
- Create: `scripts/_a23combR.mjs`

**Interfaces:**
- Consumes: `scripts/cdp.mjs` (`launch`), `window.__artSetChromaMode`, `window.__artGeomState`, `sharp`
- Produces: a printed table, one row per arm per age: `R`, `sat p50`, `sat p90`, `hue bins occupied`, `mean value`

- [ ] **Step 1: Read the two instruments this one is built from**

```bash
sed -n '1,60p' scripts/_a21wavefilm.mjs
sed -n '1,40p' scripts/cdp.mjs
```

`_a21wavefilm.mjs` already solves spawning a pass and clipping to the effect's region, including three traps: the sphere rotates out from under a cached coordinate, "the largest disc" is the most LIT node rather than the nearest, and a synthetic `MouseEvent` spawns nothing — the click must go through CDP's input domain. **Reuse its spawn and clip logic rather than rewriting it.**

- [ ] **Step 2: Write the instrument**

```js
// _a23combR.mjs — does the crest have a reference hue to be different from?
//
// THE METRIC THE PROJECT DID NOT HAVE. The shipped chromatic front is
// invisible because the bundle puts 288deg of the hue wheel on screen 2.8px
// apart: 11-12 of 12 hue bins occupied every frame, circular concentration R
// as low as 0.03. A hue excursion is only readable against a field that is not
// already wearing every hue, so the number that matters is not the excursion
// in degrees -- it is R.
//
//   R = |mean unit vector over hue| :  1 = the bundle wears ONE hue
//                                      0 = the bundle wears every hue
//
// Arm U should drive R at the crest from ~0.03 toward 1. Arm A should drive
// delivered saturation down while the value holds.
//
// CLIPS TO THE BUNDLE. The section-0 measurement in the design spec was
// WHOLE-FRAME and therefore includes the nodes and the base edges. Those
// numbers must not be quoted against a crest; this script clips first.
//
//   node scripts/_a23combR.mjs [W] [H] [DPR] [PORT]
import sharp from 'sharp';
import { launch } from './cdp.mjs';

const W    = Number(process.argv[2] ?? 1520);
const H    = Number(process.argv[3] ?? 900);
const DPR  = Number(process.argv[4] ?? 1);
const PORT = Number(process.argv[5] ?? 5173);

const ARMS = [
  { mode: 0, name: 'shipped  (rotate in place)' },
  { mode: 1, name: 'U unison (gather to one hue)' },
  { mode: 2, name: 'A achrom (bleach the crest)' },
];
// Ages chosen to straddle the crescendo: prismWaveEnv swells over one transit
// (56-128ms) and releases over PRISM_WAVE_TAIL_MS = 360ms.
const AGES = [55, 80, 105, 140, 200];

/** HSV hue + saturation of one pixel. Returns null for pixels with no hue. */
function hueSat(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 0.35) return null;              // background and film-grain floor
  const sat = d / mx;
  if (sat < 0.25) return { hue: null, sat, val: mx };
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { hue: h, sat, val: mx };
}

/** R, the circular concentration, plus the saturation percentiles. */
function analyse(buf, channels) {
  const sats = [], bins = new Array(12).fill(0);
  let sx = 0, sy = 0, hued = 0, vsum = 0, n = 0;
  for (let i = 0; i < buf.length; i += channels) {
    const px = hueSat(buf[i] / 255, buf[i + 1] / 255, buf[i + 2] / 255);
    if (!px) continue;
    sats.push(px.sat); vsum += px.val; n++;
    if (px.hue === null) continue;
    const a = px.hue * Math.PI / 180;
    sx += Math.cos(a); sy += Math.sin(a); hued++;
    bins[Math.floor(px.hue / 30)]++;
  }
  sats.sort((a, b) => a - b);
  const q = (p) => sats.length ? sats[Math.min(sats.length - 1, Math.floor(sats.length * p))] : NaN;
  return {
    n, hued,
    R: hued ? Math.hypot(sx, sy) / hued : NaN,
    satP50: q(0.5), satP90: q(0.9),
    meanV: n ? vsum / n : NaN,
    bins: bins.filter(c => hued && c / hued > 0.02).length,
  };
}

const main = async () => {
  const { page, browser } = await launch({ width: W, height: H, dpr: DPR, port: PORT });

  console.log(`\n  R = 1 means the bundle wears ONE hue; R = 0 means it wears every hue.`);
  console.log(`  bins = 30deg hue bins holding >2% of hued pixels, out of 12.\n`);
  console.log('  arm                            age      R   sat p50  sat p90  bins  meanV');

  for (const arm of ARMS) {
    // ASSERT THE FLIP LANDED. __artSetChromaMode returns what it set precisely
    // so this is not an assumption.
    const got = await page.evaluate((m) => window.__artSetChromaMode(m), arm.mode);
    if (!got || got.chromaMode !== arm.mode) {
      console.log(`  ${arm.name}: SWITCH REFUSED (${JSON.stringify(got)}) -- arm NOT measured`);
      continue;
    }
    for (const age of AGES) {
      // Spawn a pass and shoot it at `age`, reusing _a21wavefilm's proven
      // routine. Read the YOUNGEST effect: effects[0] is the OLDEST, and a
      // spawn takes a render to reach geomEffectsRef.
      const hit = await shootAtAge(page, age);
      if (!hit) { console.log(`  ${arm.name.padEnd(28)} ${String(age).padStart(4)}ms  NO SPAWN`); continue; }
      const { data, info } = await sharp(hit.png).raw().toBuffer({ resolveWithObject: true });
      const a = analyse(data, info.channels);
      console.log(`  ${arm.name.padEnd(28)} ${String(Math.round(hit.age)).padStart(4)}ms  ` +
        `${a.R.toFixed(3)}    ${a.satP50.toFixed(3)}    ${a.satP90.toFixed(3)}   ` +
        `${String(a.bins).padStart(2)}/12  ${a.meanV.toFixed(3)}`);
    }
  }

  // Leave the page on the shipped arm so a later instrument does not inherit
  // an arm this one set.
  await page.evaluate(() => window.__artSetChromaMode(0));
  await browser.close();
};
main();
```

`shootAtAge(page, age)` is `_a21wavefilm.mjs`'s existing spawn-and-clip routine returning `{ png, age }`. Extract it from that file into a shared local helper rather than duplicating it; if extraction is awkward, import `_a21wavefilm.mjs`'s export.

- [ ] **Step 3: Run it and check the shipped arm reproduces the spec's section 0**

```bash
node scripts/_a23combR.mjs 1520 900 1 5173
```

Expected for the shipped arm: `R` in the 0.03–0.32 band and 10–12 bins occupied, matching the design spec's section 0 within the clip difference. **If the shipped arm does not reproduce, the instrument is wrong and no arm's number means anything — fix it before reading U or A.**

- [ ] **Step 4: Commit**

```bash
git add scripts/_a23combR.mjs
git commit -m "test(chaos): measure whether the crest has a reference hue at all

R, the circular concentration of hue over the bundle's pixels: 1 means the
bundle wears one hue, 0 means it wears every hue. That is the number the
chromatic front's visibility actually turns on, and the project had no
instrument for it -- the shipped arm measures 0.03-0.32 with 11-12 of 12 hue
bins occupied, which is why an excursion of any size is untrackable.

Clips to the bundle first. The design spec's section 0 was whole-frame and
includes the nodes and base edges; those numbers must not be quoted against a
crest.

Asserts the arm switch landed rather than assuming it, and restores mode 0 on
the way out so a later instrument cannot inherit an arm this one set.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Bound arm A's luminance cost

**Files:**
- Modify: `scripts/_a22chroma.mjs` (part 1)

**Interfaces:**
- Consumes: `PRISM_A_WAKE_SAT`, `PRISM_SAT`, `PRISM_GLOW_LIT`, `PRISM_CORE_LIT`
- Produces: a printed worst-case Rec.709 luminance ratio for arm A

- [ ] **Step 1: Read the existing bound**

```bash
sed -n '40,110p' scripts/_a22chroma.mjs
```

Part 1 computes the largest Rec.709 luminance ratio between any resting hue and the tint it can be rotated to, over every hue and both lightnesses. Arm A needs the same treatment on the saturation axis.

- [ ] **Step 2: Extend part 1**

Append to part 1, after the existing rotation bound is printed:

```js
// ── ARM A's BOUND, ON THE SATURATION AXIS ─────────────────────────────────
//
// Arm A holds LIGHTNESS fixed and drops saturation, which is the whole reason
// it was ruled onto this axis: it stays inside the ink-negative argument the
// alpha design rests on. But desaturating at constant HSL lightness still
// MOVES Rec.709 luminance -- a fully saturated blue at L=65 is far darker than
// a grey at L=65 -- so the cost is computed here rather than argued.
//
// It is a bound on the CREST only. The tint's weight is amp * env * segFade,
// so a point reaches this figure only where the pulse peaks on a chord that is
// mid-pass.
{
  let worstGlow = 1, worstCore = 1, atGlow = 0, atCore = 0;
  for (let hue = 0; hue < 360; hue += 0.5) {
    for (const [lit, tag] of [[PRISM_GLOW_LIT, 'glow'], [PRISM_CORE_LIT, 'core']]) {
      const rest = lum(hsl2rgb(hue, PRISM_SAT, lit));
      // the LEAD anchor is sat 0; the WAKE anchor is PRISM_A_WAKE_SAT
      for (const sat of [0, PRISM_A_WAKE_SAT]) {
        const r = lum(hsl2rgb(hue, sat, lit)) / rest;
        if (tag === 'glow' && r > worstGlow) { worstGlow = r; atGlow = hue; }
        if (tag === 'core' && r > worstCore) { worstCore = r; atCore = hue; }
      }
    }
  }
  console.log(`\n  ARM A worst-case luminance ratio on the crest:`);
  console.log(`    glow pass (L=${PRISM_GLOW_LIT}):  ${worstGlow.toFixed(3)}x  at hue ${atGlow.toFixed(0)}deg`);
  console.log(`    core pass (L=${PRISM_CORE_LIT}):  ${worstCore.toFixed(3)}x  at hue ${atCore.toFixed(0)}deg`);
  console.log(`    (compare the shipped rotation's bound printed above)`);
}
```

`lum` and `hsl2rgb` already exist in the file. Reuse them; do not redefine.

- [ ] **Step 3: Run it**

```bash
node scripts/_a22chroma.mjs 1520 900 1 5173
```

Expected: a finite ratio for both passes. **Record the numbers in the findings doc of Task 7 — they are the ink argument for arm A and must be quoted, not assumed.** A ratio meaningfully above the shipped rotation's 1.632x on the glow pass is a finding, not a failure, but it must be stated.

- [ ] **Step 4: Commit**

```bash
git add scripts/_a22chroma.mjs
git commit -m "test(chaos): bound arm A's luminance cost on the saturation axis

Arm A holds lightness fixed, which is why it was ruled onto this axis -- it
stays inside the ink-negative argument the alpha design rests on. But
desaturating at constant HSL lightness still moves Rec.709 luminance: a
saturated blue at L=65 is far darker than a grey at L=65. Computed exactly over
every hue and both passes rather than argued.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Run the A/B and record the ruling

**Files:**
- Create: `docs/superpowers/plans/handover-chaos-chroma-ab.md`
- Frames: `lookbook/prismfilm/` (gitignored working output)

- [ ] **Step 1: Film all three arms at one seed**

With the dev server on 5173:

```bash
node scripts/_a23combR.mjs 1520 900 1 5173
```

**Do not touch the working tree while this runs.** vite will HMR the edit into the page; the tell is two different `gitCommit` stamps across the manifests.

- [ ] **Step 2: Capture frames for the author to look at**

For each arm, set the mode and film. `_a21wavefilm.mjs` does not take an arm argument; set it from a one-line CDP call before each run, or add an optional 5th argument to the script. Write the frames to per-arm directories so they cannot be confused:

```bash
node scripts/_a21wavefilm.mjs 1520 900 1 5173      # after setting the arm
```

- [ ] **Step 3: LOOK at the frames before writing a single conclusion**

Open the shipped, U and A frames at the same age side by side. **The standing rule on this project is that the render is looked at before any visual claim is made; five wrong causal claims in one night came from reading statistics instead.** R and saturation say whether the mechanism fired; only the frames say whether it reads.

- [ ] **Step 4: Write the findings doc**

`docs/superpowers/plans/handover-chaos-chroma-ab.md`, carrying at minimum:

- the R / saturation / bins table for all three arms, from Task 5
- arm A's luminance bound, from Task 6
- which arm the author ruled, in his words
- **every dial marked by provenance**: MEASURED, CHOSEN, or RULED. `PRISM_A_WAKE_SAT` is CHOSEN and has still never been seen by an eye unless the A/B moved it.
- what is still open: the packet narrowing of spec §5.1 (`PRISM_WAVE_W` and `PRISM_PHASE_STEP` must move together, `_a19budget.mjs` must re-price the instances), the lightness lift of spec §5.2, and the parity re-cut already owed from the branch handover

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/handover-chaos-chroma-ab.md
git commit -m "docs(chaos): the chroma A/B, measured and ruled

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

| spec section | task |
|---|---|
| §0 measurement, reproduced against the bundle | 5 |
| §1 root cause — no reference hue; R as the metric | 5 |
| §2 the two unoccupied dimensions | 2, 3 |
| §3 the comb folds; un-sheared chroma phase | 1, 2, 4 |
| §4.1 the anchor table, both arms, A's saturation-axis direction | 3 |
| §4.2 the constants, `PRISM_UNISON_K` derived, coarse path | 1, 2 |
| §4.3 the switch, default 0, hook returns what it set | 4 |
| §4.4 every listed property test | 1, 2, 3, 4 |
| §4.5 `_a23combR.mjs`, `_a22chroma` extension, clip to bundle | 5, 6 |
| §5 out of scope — recorded, not built | 7 step 4 |
| §6 traps — HMR, oldest effect, most-lit disc, `artCompare` blindness | 5, 7 |

**Placeholder scan:** none. Every code step carries its code; `shootAtAge` is named as an extraction from an existing file with the exact file and line range given to read.

**Type consistency:** `prismUnisonHue(hue0, k, n, t)`, `prismTravelSign(k, n)`, `prismUnisonK(n)`, `prismAnchorHue(mode, hue0, k, n, side)`, `prismAnchorSat(mode, side)`, `prismWriteAnchors(out, mode, hue0, n, coreOff)`, `prismChromaPhase(u, tMs, durMs)` — each used with the same signature in every later task and in the tests.

One scoping bug was found and fixed in this review: `_cMode` was originally declared at the anchor loop (`:2011`, pair-loop scope) but read in the chroma branch (`:1892`, inside the polyline lambda). Task 4 Step 2 now hoists it beside `_wTintOff` at `:1867`, which both sites close over.
