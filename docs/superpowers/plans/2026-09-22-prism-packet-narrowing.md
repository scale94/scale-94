# CHAOS prism — packet narrowing, as a live switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the author a live switch, `window.__artSetPacketArm(i)`, over five packet shapes for the prism wavefront, so he can rule by eye on whether a narrower packet fixes mode 0's *directional ambiguity*. The switch comes with a sampling guard that can no longer be fooled by a narrow pulse.

**Architecture:** `PRISM_WAVE_W` and `PRISM_PHASE_STEP` stay as the shipped defaults, but the pulse primitives in `artEdges.js` gain optional width and step parameters. ArtTab reads the selected arm once per effect, like it reads `chromaModeRef`, and passes the arm's values through. The tessellation guard is re-keyed from raw segment count `n` to **samples across the support** (`2·W·n`). The forced segment count is derived per arm, and the buffer is sized for the narrowest arm.

**Tech Stack:** vanilla JS modules, React refs in `ArtTab.jsx`, vitest, CDP probe scripts in `scripts/` (Node, `./cdp.mjs`).

**Branch:** `feature/chaos-prism-depth-dash-beads`. Base is `cf171676`. **NOT pushed, and nothing in this plan pushes.**

## Global Constraints

- **Arm 0 is the default and must draw bit-identically to `cf171676`.** Every new parameter defaults to the shipped constant. `prismSegmentFade(n)` with no width must return exactly what it returns today.
- **Do not touch chroma.** `chromaModeRef` stays `PRISM_CHROMA_MODE_ACHROMATIC`. Arm A's +13.6% luminance is load-bearing (handover-chaos-chroma-ab §2b). The packet switch is orthogonal to the chroma switch.
- **Do not touch** `PRISM_WAVE_DEPTH` (0.40, ruled), the 0.8× strimer timing ratio (test-locked), `PRISM_WAVE_SWELL`, `PRISM_WAVE_TAIL_MS`, or `PRISM_CASCADE_MS`.
- **Build the switch, not the metric.** No pixel metric decides between arms. Buffer-level probes only establish that each arm is *alive and distinct*. The author rules.
- **Every test names the mutation it catches and is run against that mutation before it is trusted** (artPrismWave.test.js header).
- **No literal 80, 72, 56 or 14.4 anywhere in `src/`.** Segment counts and the samples bar are derived from `PRISM_WAVE_W`, `PRISM_WAVE_SEG_FULL` and the arm table.
- Lint gate: `npm run lint` must print **0 errors** and ≤153 warnings. Read the printed count; do not pipe it.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Why this plan differs from the handover's framing (read first)

1. **The guard today does not fade a narrow wave. It lets it bead.** `prismSegmentFade(n)` (`artEdges.js:1047`) reads only `n`, and the draw loop forces `n = 40`, so the fade reads 1 at any `W`. Measured with an extended `_a18wsweep` (this session), worst-case ripple at `n = 40`:

   | | W=0.09 | W=0.108 | W=0.135 | W=0.18 |
   |---|---|---|---|---|
   | n=40 | **16.4%** | 11.6% | 7.6% | 4.3% |
   | n=56 | 8.7% | 6.1% | 3.9% | 2.2% |
   | n=64 | 6.9% | 4.8% | 3.1% | 1.8% |
   | n=72 | 5.5% | 3.8% | 2.5% | 1.4% |
   | n=80 | **4.3%** | 3.0% | 1.9% | 1.1% |

   The handover's "silently fade out" is what the guard does **after** Task 2 re-keys it: at `W=0.09, n=40` the effective count is 20, so the fade reads 0. Without Task 2 the failure is silent beading at 16%.

2. **Ripple is a function of samples across the support.** The four passing cells all sit at `2·W·n ≈ 14.4`, the value `W=0.18, n=40` already holds. So `n(W) = ceil8(14.4 / 2W)` gives 40 / 56 / 72 / 80. The sweep confirms 56 and 80 exactly; at W=0.108, 64 would pass (4.8%) and the rule picks 72, which is conservative.

3. **The existing guard test is vacuous for this change.** `2*W*SEG_FULL >= 5` (`artPrismWave.test.js:388`) passes at W=0.09. The comment at `artEdges.js:1045` says "5.04 samples"; the real figure is 14.4. Its test title says "six". None of the three agree.

4. **The budget can only be measured after the change.** `_a19budget.mjs` is a live CDP probe, and `MAX_ADDITIVE_EDGES` is sized at module top level from `PRISM_WAVE_SEGMENTS`. The order is: change, run, measure.

## The arms

| arm | `w` | `step` | bundle `2w+6·step` | forced `n` | what it isolates |
|---|---|---|---|---|---|
| 0 — shipped | 0.18 | 0.05 | 0.66 | 40 | the "before" |
| 1 — shear only | 0.18 | 0.025 | 0.51 | 40 | narrows the diagonal, **costs no segments** |
| 2 — ×0.75 | 0.135 | 0.0375 | 0.495 | 56 | **same bundle as arm 1**, split the other way |
| 3 — ×0.60 | 0.108 | 0.030 | 0.396 | 72 | |
| 4 — ×0.50 | 0.09 | 0.025 | 0.33 | 80 | the extreme; sizes the buffer |

**Arms 1 and 2 are a controlled pair.** Their bundle widths match to within 0.015, and one spends the narrowing on the shear while the other spends it on the pulse. If he can't tell them apart, the bundle width is what matters and arm 1 is free. If he can, we learn which half carries the direction.

## Two risks the author has to see, not us

- **Temporal sampling.** The packet advances `frameMs / transitMs` of the chord per frame. Measured in *supports per frame* (lower is smoother):

  | chord | Hz | arm 0 (support 0.36) | arm 4 (support 0.18) |
  |---|---|---|---|
  | median, 103ms | 60 | 0.45 | 0.90 |
  | median, 103ms | 120 | 0.22 | 0.45 |
  | median, 103ms | 360 | 0.07 | 0.15 |
  | shortest, 56ms | 60 | 0.83 | **1.65** |

  At 60Hz on short chords, arm 4 jumps more than its own width every frame. His 360Hz desktop hides this. **He must also look on the phone (120Hz)**, and at 60Hz if a 60Hz display is available.
- **Memory.** Sizing for arm 4 doubles `PRISM_PER_EFFECT`. The additive scratch goes from ~5.6MB to ~11MB. That is acceptable for the A/B and gets repaid in Task 7.

---

## File map

| file | change |
|---|---|
| `src/terminal/art/artEdges.js` | width/step params on the pulse primitives; `PRISM_WAVE_SAMPLES`, `prismWaveSegmentsFor`, re-keyed `prismSegmentFade`; `PRISM_PACKET_ARMS`, `prismPacketArmOf`; `PRISM_WAVE_SEGMENTS` derived |
| `src/terminal/art/artPrismRipple.js` | **new, leaf.** The ripple instrument, shared by the test and the sweep so neither carries a copy |
| `src/terminal/art/__tests__/artPrismWave.test.js` | new and replaced tests |
| `src/terminal/art/__tests__/artEdges.test.js` | validator tests beside `prismChromaModeOf`'s |
| `src/terminal/views/ArtTab.jsx` | `packetArmRef`, per-effect read, pass-through, `__artSetPacketArm` |
| `scripts/_a18wsweep.mjs` | imports the shared ripple; narrow candidates; forced n to 112 |
| `scripts/_a19budget.mjs`, `scripts/_a20wavetrace.mjs` | optional 6th argv = packet arm |
| `scripts/_a23combR.mjs` | **deleted** (confound 4) |

---

### Task 1: Width- and step-parametrised pulse primitives

**Files:**
- Modify: `src/terminal/art/artEdges.js:630-707` (`prismPulse`, `prismPhaseOffset`, `prismWaveAmp`, `prismWavePhase`), `:938-941` (`prismChromaSkew`)
- Test: `src/terminal/art/__tests__/artPrismWave.test.js`

**Interfaces:**
- Produces: `prismPulse(x, w = PRISM_WAVE_W)`, `prismPhaseOffset(k, step = PRISM_PHASE_STEP)`, `prismWavePhase(u, k, tMs, durMs, step = PRISM_PHASE_STEP)`, `prismWaveAmp(u, k, tMs, durMs, w = PRISM_WAVE_W, step = PRISM_PHASE_STEP)`, `prismChromaSkew(phase, w = PRISM_WAVE_W)`. `prismChromaPhase` is unchanged because it carries no shear.

- [ ] **Step 1: Write the failing tests** (append to `artPrismWave.test.js`)

```js
describe('packet width and shear are parameters, and default to the shipped values', () => {
  // CATCHES: the new `w` parameter accepted but ignored (the body still reads
  // PRISM_WAVE_W). A narrower pulse must be exactly 0 where the shipped one is
  // still lit.
  it('narrows the support to the width it is given', () => {
    const w = PRISM_WAVE_W / 2;
    expect(prismPulse(w, w)).toBeCloseTo(0, 12);
    expect(prismPulse(w * 1.001, w)).toBe(0);
    expect(prismPulse(w * 1.001)).toBeGreaterThan(0.4);      // shipped width, still lit
    expect(prismPulse(w / 2, w)).toBeCloseTo(0.5, 12);        // half-way down the cosine
  });

  // CATCHES: the default drifting off the shipped constant. Arm 0 must be
  // bit-identical, so this is toBe, not toBeCloseTo.
  it('is bit-identical to the shipped call when no width or step is passed', () => {
    for (let i = -40; i <= 40; i++) {
      const x = i / 100;
      expect(prismPulse(x)).toBe(prismPulse(x, PRISM_WAVE_W));
      expect(prismChromaSkew(x)).toBe(prismChromaSkew(x, PRISM_WAVE_W));
    }
    for (let k = 0; k < PRISM_SPECTRAL_FINE; k++) {
      expect(prismPhaseOffset(k)).toBe(prismPhaseOffset(k, PRISM_PHASE_STEP));
      for (const u of [0, 0.3, 0.7, 1]) {
        expect(prismWavePhase(u, k, 40, 103)).toBe(prismWavePhase(u, k, 40, 103, PRISM_PHASE_STEP));
        expect(prismWaveAmp(u, k, 40, 103))
          .toBe(prismWaveAmp(u, k, 40, 103, PRISM_WAVE_W, PRISM_PHASE_STEP));
      }
    }
  });

  // CATCHES: `step` accepted by prismPhaseOffset but not threaded through
  // prismWavePhase / prismWaveAmp.
  it('threads the shear step through the phase and the amplitude', () => {
    const half = PRISM_PHASE_STEP / 2;
    expect(prismPhaseOffset(6, half)).toBeCloseTo(6 * half, 12);
    // At u = 0 the shear term is phi_k * 1, so the phase differs by exactly
    // the offset difference.
    expect(prismWavePhase(0, 6, 0, 100) - prismWavePhase(0, 6, 0, 100, half))
      .toBeCloseTo(6 * (PRISM_PHASE_STEP - half), 12);
    expect(prismWaveAmp(0, 6, 0, 100, PRISM_WAVE_W, half))
      .not.toBeCloseTo(prismWaveAmp(0, 6, 0, 100), 6);
  });

  // CATCHES: prismChromaSkew still normalising by PRISM_WAVE_W, which would
  // saturate the tint at half the pulse and read as a hard colour edge.
  it('normalises the colour skew by the width it is given', () => {
    const w = PRISM_WAVE_W / 2;
    expect(prismChromaSkew(w, w)).toBeCloseTo(1, 12);
    expect(prismChromaSkew(w / 2, w)).toBeCloseTo(0.5, 12);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/art/__tests__/artPrismWave.test.js -t "packet width and shear"`
Expected: FAIL. `narrows the support` fails because `prismPulse(w*1.001, w)` is > 0 while `w` is ignored. `threads the shear step` fails on the first `toBeCloseTo`.

- [ ] **Step 3: Implement**

In `artEdges.js`, replace the bodies (keep every existing doc comment and add one line to each noting the new param):

```js
export function prismPulse(x, w = PRISM_WAVE_W) {
  const a = x < 0 ? -x : x;
  if (a >= w) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * x / w));
}

export function prismPhaseOffset(k, step = PRISM_PHASE_STEP) {
  return k * step;
}

export function prismWaveAmp(u, k, tMs, durMs, w = PRISM_WAVE_W, step = PRISM_PHASE_STEP) {
  return prismPulse(prismWavePhase(u, k, tMs, durMs, step), w);
}

export function prismWavePhase(u, k, tMs, durMs, step = PRISM_PHASE_STEP) {
  const d = durMs > 1e-6 ? durMs : 1e-6;
  const uu = u < 0 ? 0 : u > 1 ? 1 : u;
  return uu - tMs / d + prismPhaseOffset(k, step) * (1 - uu);
}

export function prismChromaSkew(phase, w = PRISM_WAVE_W) {
  const s = phase / w;
  return s < -1 ? -1 : s > 1 ? 1 : s;
}
```

Bit-identity holds by construction: with the defaults, every expression evaluates the same operations on the same operands as before.

- [ ] **Step 4: Falsify.** Temporarily change `prismPulse`'s body to `if (a >= PRISM_WAVE_W)` / `/ PRISM_WAVE_W` (i.e., ignore `w`), then run the block. Expected: `narrows the support` and `normalises the colour skew` FAIL. Revert. Then drop `step` from the `prismPhaseOffset` call inside `prismWavePhase` and expect `threads the shear step` to FAIL. Revert.

- [ ] **Step 5: Run the whole file and the suite**

Run: `npx vitest run src/terminal/art/__tests__/artPrismWave.test.js` then `npm test`
Expected: all green. Record the suite count; it is the baseline for later tasks.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artPrismWave.test.js
git commit -m "feat(chaos): prism pulse width and shear become parameters, defaulting to shipped"
```

---

### Task 2: The sampling guard keyed to samples across the support, and the shared ripple instrument

**Files:**
- Create: `src/terminal/art/artPrismRipple.js`
- Modify: `src/terminal/art/artEdges.js:611-626` (constants), `:1034-1052` (`prismSegmentFade` + its comment)
- Modify: `scripts/_a18wsweep.mjs`
- Test: `src/terminal/art/__tests__/artPrismWave.test.js:350-390`

**Interfaces:**
- Consumes: `prismPulse(x, w)` (Task 1); `prismControl`, `prismOffset` (`artEdges.js`); `tessellateQuad`, `quadSegments` (`artCurve.js`)
- Produces:
  - `PRISM_WAVE_SAMPLES` (number, `= 2 * PRISM_WAVE_W * PRISM_WAVE_SEG_FULL`, i.e. 14.399…)
  - `prismWaveSegmentsFor(w) -> integer`, the forced count for width `w`, rounded up to a multiple of 8
  - `prismSegmentFade(n, w = PRISM_WAVE_W)`
  - `artPrismRipple.js`: `RIPPLE_SPANS` (array), `rippleChordUs(span, k, n) -> number[]`, `prismRipple(us, w) -> number`, `worstRipple(w, n) -> number`

**`artPrismRipple.js` must import only from `artEdges.js` and `artCurve.js`, and `artEdges.js` must NOT import it.** That keeps it a leaf. The chroma A/B shipped a real TDZ crash from exactly this kind of back-import.

- [ ] **Step 1: Write the failing tests.** Replace the test at `artPrismWave.test.js:387-389` ("guarantees at least six samples…") and append to the same `describe`:

```js
  // REPLACES a test that asserted 2*W*SEG_FULL >= 5 -- which still passed at
  // W = 0.09, where the crest ripples 16.4% (_a18wsweep, 2026-09-22).
  // CATCHES: the samples bar re-typed as a literal, or drifting off the
  // count the shipped width was measured at.
  it('sets the samples bar from the shipped width at its measured count', () => {
    expect(PRISM_WAVE_SAMPLES).toBe(2 * PRISM_WAVE_W * PRISM_WAVE_SEG_FULL);
    expect(prismWaveSegmentsFor(PRISM_WAVE_W)).toBe(PRISM_WAVE_SEG_FULL);
  });

  // CATCHES: THE BEADING THIS PLAN EXISTS TO STOP. The old guard read only n,
  // so a half-width pulse at the shipped 40 segments read fade = 1 and drew
  // a 16% ripple. It must now read as under-sampled.
  it('fades a narrow pulse that is tessellated for the wide one', () => {
    expect(prismSegmentFade(40, PRISM_WAVE_W / 2)).toBe(0);
    expect(prismSegmentFade(40, PRISM_WAVE_W * 0.75)).toBeLessThan(1);
  });

  // CATCHES: the width-keyed path changing arm 0. toBe, every n.
  it('is bit-identical to the shipped guard at the shipped width', () => {
    const legacy = (n) => {
      if (n >= PRISM_WAVE_SEG_FULL) return 1;
      if (n <= PRISM_WAVE_SEG_NONE) return 0;
      const f = (n - PRISM_WAVE_SEG_NONE) / (PRISM_WAVE_SEG_FULL - PRISM_WAVE_SEG_NONE);
      return f * f * (3 - 2 * f);
    };
    for (let n = 0; n <= 128; n++) {
      expect(prismSegmentFade(n)).toBe(legacy(n));
      expect(prismSegmentFade(n, PRISM_WAVE_W)).toBe(legacy(n));
    }
  });

  // CATCHES: prismWaveSegmentsFor rounding DOWN, or the fade and the forced
  // count disagreeing for a narrow width.
  it('forces enough segments for any width to read full fade', () => {
    for (const w of [0.09, 0.108, 0.135, 0.18]) {
      const n = prismWaveSegmentsFor(w);
      expect(n % 8).toBe(0);
      expect(2 * w * n).toBeGreaterThanOrEqual(PRISM_WAVE_SAMPLES - 1e-9);
      expect(prismSegmentFade(n, w)).toBe(1);
    }
  });
```

Create a new `describe` in the same file for the real ripple. This is the test that is not vacuous: it runs real chords through the shipped tessellator.

```js
import { worstRipple } from '../artPrismRipple';

describe('the forced tessellation actually holds the ripple bar (real chords)', () => {
  // CATCHES: a samples rule that is right on paper and wrong on the uneven
  // parameter spacing of real near-cusp chords. The bar is 5%, _a18wsweep's.
  it('holds every width under 5% at its forced count', () => {
    for (const w of [0.09, 0.108, 0.135, 0.18]) {
      expect(worstRipple(w, prismWaveSegmentsFor(w))).toBeLessThanOrEqual(0.05);
    }
  });

  // THE FALSIFICATION, WRITTEN DOWN. If this ever passes at <= 5%, the ripple
  // instrument has stopped measuring anything and the test above is vacuous.
  it('fails the bar for the narrowest width at the shipped count', () => {
    expect(worstRipple(0.09, 40)).toBeGreaterThan(0.10);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/art/__tests__/artPrismWave.test.js`
Expected: FAIL, with import errors for `PRISM_WAVE_SAMPLES`, `prismWaveSegmentsFor` and `../artPrismRipple`. Add the two names to the file's `artEdges` import list.

- [ ] **Step 3: Implement in `artEdges.js`.** Directly after `PRISM_WAVE_SEG_NONE` (line 626):

```js
/**
 * SAMPLES ACROSS THE PULSE'S FULL SUPPORT, and the actual quantity the ripple
 * depends on. _a18wsweep (2026-09-22) found every width passes the 5% bar at
 * 2*W*n ~= 14.4 -- W=0.18/n=40, W=0.135/n=56, W=0.09/n=80 -- so the guard
 * keys on this, not on n. Derived from the count the shipped width was
 * measured at; never type 14.4.
 */
export const PRISM_WAVE_SAMPLES = 2 * PRISM_WAVE_W * PRISM_WAVE_SEG_FULL;

/** The count a chord carrying a pulse of half-width `w` is forced to:
 *  enough for PRISM_WAVE_SAMPLES across its support, rounded UP to a multiple
 *  of 8. The epsilon absorbs 14.3999.../0.36 landing a hair above 40. */
export function prismWaveSegmentsFor(w) {
  const raw = Math.ceil(PRISM_WAVE_SAMPLES / (2 * w) - 1e-9);
  return Math.ceil(raw / 8) * 8;
}
```

Replace `prismSegmentFade` and fix its stale "5.04 samples" sentence:

```js
 * ...
 * KEYED TO SAMPLES ACROSS THE SUPPORT, NOT TO n. Until 2026-09-22 this read
 * n alone, so a pulse half as wide at the same 40 segments read 1 here and
 * rippled 16.4%. `n` is rescaled to the count the SHIPPED width would need
 * for the same sample density, so the thresholds keep their measured meaning.
 * At the shipped width the ratio is skipped, not multiplied by 1, so arm 0 is
 * bit-identical. At PRISM_WAVE_SEG_FULL the pulse gets PRISM_WAVE_SAMPLES
 * (14.4) samples across its full support.
 */
export function prismSegmentFade(n, w = PRISM_WAVE_W) {
  const ne = w === PRISM_WAVE_W ? n : n * (w / PRISM_WAVE_W);
  if (ne >= PRISM_WAVE_SEG_FULL) return 1;
  if (ne <= PRISM_WAVE_SEG_NONE) return 0;
  const f = (ne - PRISM_WAVE_SEG_NONE) / (PRISM_WAVE_SEG_FULL - PRISM_WAVE_SEG_NONE);
  return f * f * (3 - 2 * f);
}
```

`prismWaveSegmentsFor(0.09) = 80` and `80 * (0.09/0.18)` evaluates to exactly 40 (checked in node), so the fade reads 1 there.

- [ ] **Step 4: Create `src/terminal/art/artPrismRipple.js`.** Move `chordUs` and `ripple` out of `_a18wsweep.mjs` (lines 38-99) verbatim in behaviour. Drop the `__W_OVERRIDE` save/restore, which was dead, and call the real `prismPulse(x, w)` instead of the script's `ampAt` copy. The copy existed only because the width could not be passed in:

```js
// artPrismRipple.js — the prism pulse's sampling ripple on REAL chords.
//
// Shared by artPrismWave.test.js and scripts/_a18wsweep.mjs so the test and
// the instrument cannot measure different things. A LEAF: imports artEdges
// and artCurve, and nothing imports it back into the render path.
//
// Ripple = max - min, over one transit, of the reconstructed crest. The
// reconstruction is piecewise linear through the samples, and a piecewise-
// linear interpolant peaks at a sample, so the peak is the largest sampled
// amplitude. Only crest positions u in [0.25, 0.75] are scored; near the ends
// the endpoint genuinely clips the pulse.
import { prismControl, prismOffset, prismPulse } from './artEdges.js';
import { tessellateQuad, quadSegments } from './artCurve.js';

export const RIPPLE_SPANS = [20, 40, 70, 110, 160, 220, 300, 400, 520];
const DUR = 120;
const pts = new Float32Array(2 * 256);
const ctrl = new Float32Array(2);

export function rippleChordUs(span, k, n = 0) {
  const cx = 760, cy = 450;
  const ax = cx - span, ay = cy - span * 0.35;
  const bx = cx + span * 0.8, by = cy + span * 0.55;
  prismControl(ctrl, ax, ay, bx, by, cx, cy, prismOffset(k));
  const m = tessellateQuad(pts, ax, ay, ctrl[0], ctrl[1], bx, by,
    n || quadSegments(ax, ay, ctrl[0], ctrl[1], bx, by));
  let total = 0;
  for (let i = 0; i + 1 < m; i++) {
    total += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
  }
  const us = [];
  let s = 0;
  for (let i = 0; i < m; i++) {
    if (i > 0) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    us.push(total > 1e-6 ? s / total : 0);
  }
  return us;
}

export function prismRipple(us, w) {
  let lo = Infinity, hi = -Infinity;
  for (let step = 0; step <= 600; step++) {
    const t = (0.25 + (step / 600) * 0.5) * DUR;
    let peak = 0;
    for (const u of us) {
      const a = prismPulse(u - t / DUR, w);
      if (a > peak) peak = a;
    }
    if (peak < lo) lo = peak;
    if (peak > hi) hi = peak;
  }
  return hi - lo;
}

/** Worst ripple over every span and spectral lines 0, 3, 6 at forced n. */
export function worstRipple(w, n) {
  let worst = 0;
  for (const span of RIPPLE_SPANS) {
    for (const k of [0, 3, 6]) worst = Math.max(worst, prismRipple(rippleChordUs(span, k, n), w));
  }
  return worst;
}
```

The scratch holds 256 points, which covers `n ≤ 255`. The sweep's largest forced count is 112.

- [ ] **Step 5: Rewire `_a18wsweep.mjs` to import the shared module.** Delete its local `chordUs`, `ripple`, `ampAt` and the profile-check block; the check is redundant now that the real `prismPulse` is called. Set `W_CANDIDATES = [0.09, 0.108, 0.135, 0.18, 0.22, 0.30]` and `FORCED = [24, 32, 40, 48, 56, 64, 72, 80, 96, 112]`. `chordUs(span,k,n)` call sites become `rippleChordUs(span,k,n)`, which returns the `us` array directly. The `.n` the "REAL CHORDS" table printed becomes `rippleChordUs(span,k).length - 1`. Then run:

Run: `node scripts/_a18wsweep.mjs`
Expected, in the FORCED table: W=0.09 → n=80, W=0.135 → n=56, W=0.18 → n=40, and the W=0.18/n=40 cell at 4.3%, matching the table in this plan's preamble. **If any cell differs, the move changed behaviour; stop and diff.**

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/terminal/art/__tests__/artPrismWave.test.js`
Expected: PASS. Note the runtime of the real-chord block (~10⁷ pulse evaluations). If it exceeds ~3s, reduce `prismRipple`'s 600 steps to 300 **in the test only**, by adding a `steps` param defaulting to 600.

- [ ] **Step 7: Falsify.** Revert `prismSegmentFade` to ignore `w` and confirm `fades a narrow pulse` FAILS. Make `prismWaveSegmentsFor` use `Math.floor` and confirm `forces enough segments` FAILS (0.135 → 48). Revert both.

- [ ] **Step 8: Suite, lint, commit**

Run: `npm test`, then `npm run lint`. Expected: green, and lint prints 0 errors.

```bash
git add src/terminal/art/artEdges.js src/terminal/art/artPrismRipple.js src/terminal/art/__tests__/artPrismWave.test.js scripts/_a18wsweep.mjs
git commit -m "fix(chaos): key the prism sampling guard to samples across the support, not n"
```

---

### Task 3: The packet arms, their validator, and a buffer sized for the narrowest

**Files:**
- Modify: `src/terminal/art/artEdges.js` (after `prismWaveSegmentsFor`; `PRISM_WAVE_SEGMENTS` at line 611 moves below it)
- Test: `src/terminal/art/__tests__/artEdges.test.js` (beside `prismChromaModeOf`, ~line 1147), `artPrismWave.test.js`

**Interfaces:**
- Consumes: `prismWaveSegmentsFor(w)` (Task 2)
- Produces: `PRISM_PACKET_ARMS: ReadonlyArray<{ w: number, step: number }>` (index = arm id), `PRISM_PACKET_ARM_SHIPPED = 0`, `prismPacketArmOf(v) -> integer | null`, `PRISM_WAVE_SEGMENTS` (now derived, = 80)

- [ ] **Step 1: Write the failing tests.** In `artEdges.test.js`:

```js
describe('prismPacketArmOf — the packet switch\'s validator', () => {
  it('accepts every arm and returns it', () => {
    for (let i = 0; i < PRISM_PACKET_ARMS.length; i++) expect(prismPacketArmOf(i)).toBe(i);
  });

  // CATCHES: Number(null) === 0 and Number('') === 0 sliding through as arm 0
  // -- the chroma switch shipped that exact bug in its brief.
  it('refuses anything that is not an arm', () => {
    for (const bad of [-1, PRISM_PACKET_ARMS.length, 1.5, NaN, Infinity, '', 'x',
                       null, undefined, {}]) {
      expect(prismPacketArmOf(bad)).toBeNull();
    }
  });

  it('arm 0 is exactly the shipped packet', () => {
    expect(PRISM_PACKET_ARM_SHIPPED).toBe(0);
    expect(PRISM_PACKET_ARMS[0].w).toBe(PRISM_WAVE_W);
    expect(PRISM_PACKET_ARMS[0].step).toBe(PRISM_PHASE_STEP);
    expect(Object.isFrozen(PRISM_PACKET_ARMS)).toBe(true);
  });
});
```

In `artPrismWave.test.js`, extending the import list with `PRISM_PACKET_ARMS`:

```js
describe('the packet arms fit the machinery that carries them', () => {
  // CATCHES: THE SILENT OVERRUN. tessellateQuad has no bounds check and a
  // Float32Array write past the end is a no-op, so a buffer sized below the
  // narrowest arm's count drops chord tails with nothing thrown.
  it('sizes PRISM_WAVE_SEGMENTS for the most demanding arm', () => {
    for (const a of PRISM_PACKET_ARMS) {
      expect(PRISM_WAVE_SEGMENTS).toBeGreaterThanOrEqual(prismWaveSegmentsFor(a.w));
    }
    expect(PRISM_WAVE_SEGMENTS).toBe(Math.max(...PRISM_PACKET_ARMS.map(a => prismWaveSegmentsFor(a.w))));
  });

  // CATCHES: an arm whose shear pushes the last strand's crest off the chord
  // before the pulse leaves (the existing single-width test at :91,
  // generalised).
  it('keeps every arm\'s last strand launchable', () => {
    for (const a of PRISM_PACKET_ARMS) {
      expect(prismPhaseOffset(PRISM_SPECTRAL_FINE - 1, a.step)).toBeLessThan(1 - 2 * a.w);
    }
  });

  // CATCHES: arms 1 and 2 drifting apart, which would destroy the controlled
  // pair (same bundle, split differently) the A/B is designed around.
  it('arms 1 and 2 span the same bundle within 0.02 of the chord', () => {
    const bundle = (a) => 2 * a.w + (PRISM_SPECTRAL_FINE - 1) * a.step;
    expect(Math.abs(bundle(PRISM_PACKET_ARMS[1]) - bundle(PRISM_PACKET_ARMS[2]))).toBeLessThan(0.02);
    expect(PRISM_PACKET_ARMS[1].w).toBe(PRISM_WAVE_W);           // arm 1 is shear-only
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/art/__tests__/artEdges.test.js src/terminal/art/__tests__/artPrismWave.test.js`
Expected: FAIL on missing exports.

- [ ] **Step 3: Implement.** Delete the literal `export const PRISM_WAVE_SEGMENTS = 40;` at line 611, keeping its long doc comment but appending the paragraph below. Then add after `prismWaveSegmentsFor`:

```js
// ── THE PACKET ARMS (A/B, 2026-09-22) ─────────────────────────────────────
//
// The author named mode 0's flaw as DIRECTIONAL AMBIGUITY. The bundle-level
// packet is 2W + 6*STEP = 0.66 of the chord, so the whole chord appears to
// change at once. These arms narrow it, behind a live switch, for his eye.
// Arm 1 narrows only the shear (free: no extra segments). Arm 2 matches arm
// 1's bundle but spends it on the pulse -- a controlled pair. Arms 3-4 scale
// both in lockstep. Arm 4 is the extreme and sizes the buffer.
export const PRISM_PACKET_ARM_SHIPPED = 0;
export const PRISM_PACKET_ARMS = Object.freeze([
  Object.freeze({ w: PRISM_WAVE_W,        step: PRISM_PHASE_STEP }),
  Object.freeze({ w: PRISM_WAVE_W,        step: PRISM_PHASE_STEP * 0.5 }),
  Object.freeze({ w: PRISM_WAVE_W * 0.75, step: PRISM_PHASE_STEP * 0.75 }),
  Object.freeze({ w: PRISM_WAVE_W * 0.6,  step: PRISM_PHASE_STEP * 0.6 }),
  Object.freeze({ w: PRISM_WAVE_W * 0.5,  step: PRISM_PHASE_STEP * 0.5 }),
]);

/** Pure, in this file, for the same reason as prismChromaModeOf: a hook that
 *  validates inline cannot be tested without a copy of itself. */
export function prismPacketArmOf(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (n < 0 || n >= PRISM_PACKET_ARMS.length) return null;
  return n;
}

/** ... (the existing PRISM_WAVE_SEGMENTS doc comment, plus:)
 *  DERIVED, NOT TYPED, SINCE 2026-09-22: the most any packet arm forces.
 *  During the A/B that is arm 4's 80, which doubles MAX_ADDITIVE_EDGES
 *  (~5.6MB -> ~11MB scratch). Task 7 repays it once an arm is ruled. */
export const PRISM_WAVE_SEGMENTS =
  Math.max(...PRISM_PACKET_ARMS.map(a => prismWaveSegmentsFor(a.w)));
```

**Module-order trap.** `SphereEdges.js` reads `PRISM_WAVE_SEGMENTS` at *its* top level. `PRISM_WAVE_SAMPLES`, `PRISM_PACKET_ARMS` and `PRISM_WAVE_SEGMENTS` must all be defined, in that order, **before** anything in `artEdges.js` that is evaluated at module top level reads them. `prismWaveSegmentsFor` is a function declaration and hoists; the constants do not. Grep `artEdges.js` for any top-level use of `PRISM_WAVE_SEGMENTS` before its new position.

- [ ] **Step 4: Run tests.** Run the two files, then `npm test`. Expected: green. Also confirm the existing `artEdges.test.js` assertions on `MAX_ADDITIVE_EDGES` still hold. If any asserts a literal capacity, it is **stale by design**: update it to the derived value and say so in the commit message.

- [ ] **Step 5: Falsify.** Change arm 4's `w` factor to `0.4` without touching anything else. `sizes PRISM_WAVE_SEGMENTS…` must still PASS (the value is derived, so it goes to 104), which proves it tracks. Then hard-code `PRISM_WAVE_SEGMENTS = 40` and confirm it FAILS. Revert both.

- [ ] **Step 6: Lint, commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js src/terminal/art/__tests__/artPrismWave.test.js
git commit -m "feat(chaos): five prism packet arms, validated; tessellation sized for the narrowest"
```

---

### Task 4: Wire the switch into the draw loop

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx`: imports (~:102-106), refs (~:578), per-effect reads (~:1893), `chord()` (~:1927-1966), tessellation (~:2129-2139), window hooks (~:3207)

**Interfaces:**
- Consumes: `PRISM_PACKET_ARMS`, `PRISM_PACKET_ARM_SHIPPED`, `prismPacketArmOf`, `prismWaveSegmentsFor`, and the Task 1 signatures
- Produces: `window.__artSetPacketArm(v = PRISM_PACKET_ARM_SHIPPED) -> { packetArm, w, step, segments } | null`

No unit test can reach the draw loop. That is why Task 5's buffer probes exist and are **required**, not optional.

- [ ] **Step 1: Ref.** Beside `chromaModeRef`:

```js
  // The packet-width A/B arm (2026-09-22). NOT RULED: arm 0 is the shipped
  // packet and the default, so a fresh page draws exactly what cf171676 drew.
  // A ref, not state, for the chroma switch's reason: flipping must not
  // re-render the world the previous arm was judged in.
  const packetArmRef = useRef(PRISM_PACKET_ARM_SHIPPED);
```

- [ ] **Step 2: Per-effect read**, directly under `const _cMode = chromaModeRef.current;`:

```js
        // Read ONCE PER EFFECT, like _cMode: an arm that changed mid-effect
        // would put two packet widths on one bundle.
        const _pArm = PRISM_PACKET_ARMS[packetArmRef.current];
        const _pW = _pArm.w, _pStep = _pArm.step;
        const _pSegs = prismWaveSegmentsFor(_pW);
```

- [ ] **Step 3: Thread through `chord()`.** Every wave call in the `if (waving)` block gets the arm's values. Exactly these replacements:

```js
                const phA = prismWavePhase(tt, _wK, _wT, _wDur, _pStep);
                const phB = prismWavePhase(1 - tt, _wK, _wT, _wDur, _pStep);
                const ampA = prismPulse(phA, _pW), ampB = prismPulse(phB, _pW);
  ...
                ph = prismWavePhase(_wDir < 0 ? 1 - tt : tt, _wK, _wT, _wDur, _pStep);
                amp = prismPulse(ph, _pW);
  ...
                  cph = prismPulse(cA, _pW) >= prismPulse(cB, _pW) ? cA : cB;
  ...
              const camp = _cMode === PRISM_CHROMA_MODE_SHIPPED ? amp : prismPulse(cph, _pW);
  ...
                               camp * env * _wFade, prismChromaSkew(cph, _pW));
```

`prismChromaPhase` calls are unchanged because they carry no shear. Afterwards, grep the chord body. **Every `prismPulse(`, `prismWavePhase(` and `prismChromaSkew(` inside it must carry `_pW` / `_pStep`.** A single missed call gives colour and brightness different widths, which is the drift `prismWavePhase`'s comment warns about.

- [ ] **Step 4: Tessellation and fade:**

```js
                const m = tessellateQuad(pts, x0, y0, ctrl[0], ctrl[1], x1, y1,
                  _wEnv > 0 ? Math.max(baseSegs, _pSegs) : baseSegs);
  ...
                _wFade = prismSegmentFade(m - 1, _pW);
```

Update the comment above it: "forced to `prismWaveSegmentsFor` the arm's width (40 at arm 0, measured to hold the ripple under 5%)".

- [ ] **Step 5: Hook**, beside `__artSetChromaMode`:

```js
    // The packet A/B, same contract as __artSetChromaMode: writes a ref the
    // draw loop reads once per effect, takes effect on the next effect drawn,
    // and RETURNS what it set so a caller can assert the flip landed.
    //   0 shipped  1 shear-only  2 x0.75  3 x0.60  4 x0.50
    window.__artSetPacketArm = (v = PRISM_PACKET_ARM_SHIPPED) => {
      const n = prismPacketArmOf(v);
      if (n === null) return null;
      packetArmRef.current = n;
      const a = PRISM_PACKET_ARMS[n];
      return { packetArm: n, w: a.w, step: a.step, segments: prismWaveSegmentsFor(a.w) };
    };
```

Remove `window.__artSetPacketArm` in the same cleanup that removes `__artSetChromaMode`. Grep for `delete window.__artSetChromaMode` and mirror it.

- [ ] **Step 6: Suite + lint.** Run `npm test` and `npm run lint`. Expected: green, 0 errors, warnings ≤153. `PRISM_WAVE_SEGMENTS` may now be an unused import in ArtTab: remove it if lint says so, but **keep `PRISM_SCRATCH_SEGMENTS`'s `max()` reading it**. The scratch must cover arm 4.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(chaos): __artSetPacketArm -- the prism packet width, switchable live"
```

---

### Task 5: Prove every arm is alive and distinct in the GPU buffer, and re-price the budget

**Files:**
- Modify: `scripts/_a20wavetrace.mjs`, `scripts/_a19budget.mjs`
- Delete: `scripts/_a23combR.mjs`

This task gates the handoff. **It is not a metric for choosing an arm.** It answers only "does the buffer show what the arm claims", which is what made the chroma gate worth everything. Dev server: `preview_start` the project's vite config (port 5173).

- [ ] **Step 1: Optional arm argument in both scripts.** After the `PORT` line:

```js
const ARM = process.argv[6] === undefined ? null : Number(process.argv[6]);
```

After `await sleep(1500);` (sphere ready), before any click:

```js
  let armSet = null;
  if (ARM !== null) {
    armSet = JSON.parse(await page.eval(`JSON.stringify(window.__artSetPacketArm(${ARM}))`));
    if (!armSet || armSet.packetArm !== ARM) throw new Error(`__artSetPacketArm(${ARM}) did not land: ${JSON.stringify(armSet)}`);
    console.log(`packet arm ${ARM}: w=${armSet.w} step=${armSet.step} forced n=${armSet.segments}`);
  }
  const FORCED_N = armSet ? armSet.segments : 40;
```

In `_a20wavetrace.mjs`, replace the three literal `40`s (`r.runs[j].n >= 40`, `rows.filter(r => r.segs >= 40)` and its label, `g.n < 40 || c.n < 40`) with `FORCED_N`. **`>= 40` would pass at arm 4 as well, so it could never show the forced count moving.** Add under the "frames at forced n" line:

```js
  const seenN = [...new Set(rows.map(r => r.segs))].sort((a, b) => a - b);
  console.log(`  run lengths seen           ${seenN.join(', ')}   (arm expects ${FORCED_N})`);
```

- [ ] **Step 2: The liveness gate.** Run each arm on a fresh page (the scripts launch their own):

```bash
node scripts/_a20wavetrace.mjs 1520 900 1 5173 0
```

Then the same with arm `1`, `2` and `4`. Record, per arm: forced n, "crest travelled", and the **launch** shear spread from the first shear-table row. Expected:

| arm | run length | launch spread (earliest row) | why |
|---|---|---|---|
| 0 | 40 | ≈0.29 (matches the wavefront handover's 0.294) | control |
| 1 | 40 | ≈0.15 | step halved, width not |
| 2 | 56 | ≈0.22 | step ×0.75 |
| 4 | 80 | ≈0.15 | step halved |

The spread depends on sample age, so compare rows at a **similar age**, not exact numbers. **Pass = the run length equals the arm's `segments` AND the spread orders 0 > 2 > {1,4}.** If arm 4's run length reads 40, the tessellation isn't wired, whatever else looks right. If arm 0's spread is not ≈0.29, the default path moved: **stop, because arm 0 is supposed to be identical.**

- [ ] **Step 3: Budget at the extreme arm.**

```bash
node scripts/_a19budget.mjs 1520 900 1 5173 4
```

Expected: `capacity` roughly doubled from 131162, `dropped 0`. Record the peak and percentage. Then run arm `0` for the control and confirm its peak matches the prior 11290 within a few %. **`dropped > 0` at any arm is a hard stop**: the silent-overrun path is live.

- [ ] **Step 4: Mobile cost at the extreme arm.** `scripts/mobileFps.mjs` does not take an arm argument. Add the same `argv` arm block, adapted to its own arg parsing (read its header first; it takes `--url`). Then:

```bash
node scripts/mobileFps.mjs --url http://localhost:5173/
```

Run once for arm 0 and once for arm 4. Record both. This is the first mobile measurement since the fix wave, so record it even if nothing is wrong. Coarse pointers draw 4 lines × 6 nodes, so expect the delta to be small. **Report the numbers; do not argue them.**

- [ ] **Step 5: Delete the confounded instrument.**

```bash
git rm scripts/_a23combR.mjs
```

It sampled a fresh spawn per arm (chroma handover §5, confound 4). Its three-arm table must not be quotable.

- [ ] **Step 6: Commit** the script changes and the deletion together, with the gate table and budget numbers in the message body.

```bash
git add scripts/_a20wavetrace.mjs scripts/_a19budget.mjs scripts/mobileFps.mjs
git commit -m "test(chaos): packet arms proven alive in the GPU buffer; budget re-priced; drop confounded _a23combR"
```

---

### Task 6: Hand the switch to the author

No code. Present in chat, briefly:

- The console lines, flippable on the live dev page, with chroma left at arm A:
  `__artSetPacketArm(0)` through `__artSetPacketArm(4)`. Each takes effect on the next click.
- **Look at arms 1 vs 2 as a pair**: same bundle, split differently.
- **Look on the phone too** (120Hz), and at 60Hz if a 60Hz display is available. Arm 4 at 60Hz on short chords jumps 1.65 supports per frame.
- What stays fixed: chroma (arm A), depth, swell, tail, cascade, timing.

**Wait for his ruling. Do not pre-select an arm.**

---

### Task 7: Ship the ruling (after he rules — do not start before)

**Files:** `artEdges.js`, `ArtTab.jsx`, the two test files, a new handover `docs/superpowers/plans/handover-chaos-packet-narrowing.md`

- [ ] **Step 1:** Default `packetArmRef` (and the hook's default argument) to the ruled arm, with a `RULED <date>` comment in the chroma ruling's style: his words, what it inverts.
- [ ] **Step 2: Repay the memory.** Choose one of these and write the reason in the commit message:
  (a) Keep all arms reachable and leave `PRISM_WAVE_SEGMENTS` at the max. Costs ~11MB scratch permanently.
  (b) Promote the ruled arm's `w`/`step` into `PRISM_WAVE_W`/`PRISM_PHASE_STEP`, delete the arms narrower than it, and let `PRISM_WAVE_SEGMENTS` re-derive down.
  **Recommend (b)** unless he wants the switch kept for exhibition tuning. Note that (b) changes `PRISM_WAVE_SAMPLES`'s derivation base. `PRISM_WAVE_SEG_FULL` must be re-set so that `2·W_new·SEG_FULL` stays 14.4. Assert this with a test, never by retyping.
- [ ] **Step 3:** Re-run Task 5 Steps 2-3 at the new default. Then `npm test` and `npm run lint`.
- [ ] **Step 4: Parity re-cut.** It is now five layers stale (strimer depth cue, prism clock, prism wavefront, chroma arm A, packet width), and `fired-cascade` is where they all land. **Set `BASELINE_COMMIT`** or the reference records `gitCommit: null`. **Do not touch the working tree while artBaseline runs**, because vite HMR corrupts it.
- [ ] **Step 5:** Write the handover: the ruling, the dial provenance table, the gate numbers, the budget, the mobile fps, and what is still open (`PRISM_A_WAKE_SAT` unswept; the disc↔streak 38× discontinuity; Mode 1 still reachable). Commit. **Do not push**; pushing needs his explicit command.

---

## Self-review notes

- **Spec coverage:** couple W and STEP → arms 2-4. Nyquist trap → Task 2, now with its direction corrected. Re-price → Task 5.3 (after, not before, with the reason given). Keep the chroma switch → Global Constraints. `_a23combR` → Task 5.5. Parity re-cut → Task 7.4. Added beyond the brief: arm 1 (shear-only, free), the temporal-sampling check, mobile fps.
- **Known soft spot:** Task 5's expected spreads are approximate because the probe cannot choose its sample age (earliest reachable ≈55ms). The gate uses **ordering plus exact run length**, not the spread values.
- **Known soft spot:** `PRISM_WAVE_SWELL`'s ceiling argument (launch step 4.0% < tolerated ripple) was made at 4.3%. Arm 3's forced ripple is 3.8%, so the launch step slightly exceeds its ripple there. It is sub-visible in principle; flag it only if he reports an edge at launch on arm 3.
