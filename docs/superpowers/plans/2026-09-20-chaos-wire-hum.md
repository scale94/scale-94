# Wire Hum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the /chaos sphere's base edges a resting pulse — each edge's whole length slowly brightening and dimming on a phase taken from its 3-D position in the graph.

**Architecture:** A pure function in `artEdges.js` returns a gain around 1.0; the draw loop multiplies `baseAlpha` by it once per edge. No shader, no instance-stride change, no extra render pass. The phase advances on `performance.now()`, and the wave's axis precesses on a much longer period so the motion never reads as a metronome.

**Tech Stack:** Plain ES modules, Vitest, Puppeteer capture scripts under `scripts/`.

**Spec:** `docs/superpowers/specs/2026-09-20-chaos-wire-hum-design.md`

## Global Constraints

- Branch is `feature/chaos-mobile-and-hum`. Do not merge to `main`.
- **Step on `performance.now()`, never on a frame count.** A frame counter runs at double speed on a 120 Hz display. The capture harness virtualises `performance.now()` and advances it `FRAME_MS = 1000/60` per `__pump`, so clock-stepping is already bit-reproducible under capture.
- Base graph edges only. The prism cascade, the strimer, pulse rings, the additive layer, the nodes and the background are out of scope and must not change.
- `artEdges.js` must stay free of DOM and three.js imports — it is unit-tested in jsdom.
- Every commit message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `npm run lint` must report **0 errors**. Warnings ratchet at 153; do not raise the count.
- **Do not quote any `artCompare` parity number while this branch is in flight.** The hum moves the frame on purpose, so the reference at `baseline/art-sphere-phase2-bloom-dial-certified` (`d69ce75`) reads it as a regression until Task 5 re-bases.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artEdges.js` | **Modify.** Add the `HUM` constant block, `humAxis(nowMs)` and `humGain(mid, axis, phase)`, plus `humPhase(nowMs)`. Pure, testable, no DOM. |
| `src/terminal/art/__tests__/artEdges.test.js` | **Modify.** Unit tests for the three new functions. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Compute axis + phase once per frame; multiply `baseAlpha` by the gain per edge. |
| `scripts/_a4hum.mjs` | **Create.** Throwaway sweep: patches `HUM.amplitude` in tracked source, shoots one breath cycle per value, restores. Modelled on `scripts/_a3bloom.mjs`. |

---

### Task 1: The hum arithmetic

**Files:**
- Modify: `src/terminal/art/artEdges.js` (append a new section after the `ORTHO_*` block, which currently ends around line 90)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HUM` — frozen object `{ amplitude: number, wavenumber: number, periodMs: number, axisPeriodMs: number, axisTilt: number }`
  - `humPhase(nowMs: number) => number` — radians
  - `humAxis(nowMs: number) => { x: number, y: number, z: number }` — unit vector
  - `humGain(mid: {x,y,z}, axis: {x,y,z}, phase: number) => number` — in `[1 - HUM.amplitude, 1 + HUM.amplitude]`

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/art/__tests__/artEdges.test.js`:

```js
describe('the wire hum', () => {
  it('stays inside 1 +/- the amplitude for any phase', () => {
    const axis = { x: 0, y: 1, z: 0 };
    for (let p = 0; p < 20; p++) {
      const g = humGain({ x: 0.3, y: -0.2, z: 0.9 }, axis, p * 0.37);
      expect(g).toBeGreaterThanOrEqual(1 - HUM.amplitude - 1e-12);
      expect(g).toBeLessThanOrEqual(1 + HUM.amplitude + 1e-12);
    }
  });

  it('never returns a negative gain, which would invert an edge', () => {
    // Guards the constant as much as the function: an amplitude above 1 would
    // make an edge's alpha go negative at the trough.
    expect(HUM.amplitude).toBeLessThan(1);
  });

  it('gives edges that are close in space near-identical gain', () => {
    // This is the whole effect: neighbours breathe together.
    const axis = humAxis(0);
    const a = humGain({ x: 0.50, y: 0.10, z: 0.20 }, axis, 1.0);
    const b = humGain({ x: 0.52, y: 0.11, z: 0.21 }, axis, 1.0);
    expect(Math.abs(a - b)).toBeLessThan(0.02);
  });

  it('separates midpoints that are far apart along the axis', () => {
    // A wave that gives every edge the same answer is a global blink, which is
    // the mechanical failure this design exists to avoid.
    const axis = { x: 0, y: 1, z: 0 };
    const near = humGain({ x: 0, y:  1, z: 0 }, axis, 0);
    const far  = humGain({ x: 0, y: -1, z: 0 }, axis, 0);
    expect(Math.abs(near - far)).toBeGreaterThan(0.05);
  });

  it('is NOT a front/back dipole — K is deliberately not pi', () => {
    // At K = pi the poles sit in exact antiphase and the sphere reads as a
    // rotating two-lobe blink. 2K must not be a multiple of 2pi.
    const cycles = (2 * HUM.wavenumber) / (2 * Math.PI);
    expect(Math.abs(cycles - Math.round(cycles))).toBeGreaterThan(0.1);
  });

  it('handles an antipodal edge, whose midpoint is the origin', () => {
    const g = humGain({ x: 0, y: 0, z: 0 }, humAxis(0), 0.5);
    expect(Number.isFinite(g)).toBe(true);
  });

  it('advances the phase on the CLOCK, not on a frame count', () => {
    // One full period of wall time is one full turn of phase. A frame-counted
    // version would run at double speed on a 120Hz display — the /SCENT bug.
    const turn = humPhase(HUM.periodMs) - humPhase(0);
    expect(turn).toBeCloseTo(2 * Math.PI, 9);
  });

  it('returns a unit axis at every time', () => {
    for (const t of [0, 1234, 40000, 97000, 250000]) {
      const a = humAxis(t);
      expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(1, 9);
    }
  });

  it('precesses the axis — it is not a fixed direction', () => {
    const a = humAxis(0);
    const b = humAxis(HUM.axisPeriodMs / 4);
    expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBeGreaterThan(0.2);
  });

  it('does not re-phase against the breath inside ten minutes', () => {
    // The real invariant is the COMBINED repeat period, not the ratio's
    // distance from an integer: 10.5 is half a unit from the nearest integer
    // and still puts the whole pattern back where it started in two breaths.
    // 97/9 is in lowest terms with denominator 9, so it repeats after 9 axis
    // turns — 873 s, or 14.5 min. Longer than anyone looks at the sphere.
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const repeatMs = (HUM.periodMs * HUM.axisPeriodMs)
                   / gcd(HUM.periodMs, HUM.axisPeriodMs);
    expect(repeatMs).toBeGreaterThan(10 * 60 * 1000);
  });

  it('is deterministic — same inputs, same answer', () => {
    const m = { x: 0.1, y: 0.2, z: 0.3 };
    expect(humGain(m, humAxis(5000), humPhase(5000)))
      .toBe(humGain(m, humAxis(5000), humPhase(5000)));
  });
});
```

Add the new names to the file's existing import from `../artEdges`:

```js
import {
  /* ...whatever is already imported, unchanged... */
  HUM, humPhase, humAxis, humGain,
} from '../artEdges';
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js
```

Expected: FAIL — `HUM is not defined` / `humGain is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/terminal/art/artEdges.js`:

```js
// ── The wire hum ────────────────────────────────────────────────────────────
//
// The graph's resting pulse. Each edge's whole length brightens and dims on a
// phase taken from its 3-D midpoint, so edges near each other in space breathe
// together and the pattern drifts across the sphere. NOTHING travels along an
// edge: a travelling highlight on this layer smears through the trail
// accumulator into a comet, which is why option A needed its own
// non-accumulating pass and this one does not.
//
// Applied as a multiply on `baseAlpha` in ArtTab's draw loop, which is the one
// scalar all four edge branches derive from. That is the entire integration —
// no shader, no 19th instance float (slot 16 is the dash phase), no pass.
//
// TWO THINGS ARE DELIBERATE AND WILL LOOK LIKE ARBITRARY CONSTANTS:
//
// `wavenumber` is NOT pi. Midpoints live on a unit sphere, so `dot(mid, axis)`
// spans [-1, 1] and `2 * wavenumber` is the phase across the diameter. At pi
// exactly one wavelength spans it, the poles sit in perfect antiphase, and the
// sphere reads as a rotating two-lobe blink — the mechanical failure in
// another costume. 2.0 puts ~0.64 of a cycle across the diameter instead.
//
// `axisPeriodMs` is not a small-integer multiple of `periodMs`. A fixed axis at
// a fixed rate is a metronome, so the axis traces a slow cone; if the two
// cycles re-phased on a low-order beat the whole pattern would visibly repeat.
//
// All five are AESTHETIC DIALS, to be chosen on frames rather than argued
// about — see `scripts/_a4hum.mjs`, which sweeps `amplitude` over one breath
// cycle the way `_a3bloom.mjs` swept the bloom.
export const HUM = Object.freeze({
  amplitude:    0.15,   // +/- fraction of baseAlpha
  wavenumber:   2.0,    // radians of phase per unit of world distance
  periodMs:     9000,   // one breath
  axisPeriodMs: 97000,  // one turn of the cone, ~10.8 breaths
  axisTilt:     1.05,   // radians off +Y; ~60 deg, neither polar nor equatorial
});

/**
 * The hum's phase at `nowMs`.
 *
 * ON THE CLOCK, NEVER ON A FRAME COUNT. A frame counter runs at double speed on
 * a 120Hz display — this repo has shipped that bug once already, in the /SCENT
 * collider. The capture harness virtualises performance.now() and advances it
 * FRAME_MS per pump, so reading the clock costs no reproducibility.
 */
export function humPhase(nowMs) {
  return (2 * Math.PI * nowMs) / HUM.periodMs;
}

/** The wave's direction at `nowMs` — a unit vector tracing a slow cone. */
export function humAxis(nowMs) {
  const theta = (2 * Math.PI * nowMs) / HUM.axisPeriodMs;
  const s = Math.sin(HUM.axisTilt);
  return { x: s * Math.cos(theta), y: Math.cos(HUM.axisTilt), z: s * Math.sin(theta) };
}

/**
 * The gain for one edge: 1 +/- HUM.amplitude.
 *
 * `mid` is the edge's 3-D midpoint, taken BEFORE projection. That is the
 * load-bearing choice in the whole design: a world-space wave is anchored to
 * the graph and rotates with it, where a screen-space one would be pinned to
 * the viewport and the sphere would appear to slide through a fixed curtain of
 * light. An antipodal edge has the origin for a midpoint, which is well
 * defined here — it simply rides the global phase.
 */
export function humGain(mid, axis, phase) {
  const d = mid.x * axis.x + mid.y * axis.y + mid.z * axis.z;
  return 1 + HUM.amplitude * Math.sin(phase - HUM.wavenumber * d);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -F- <<'MSG'
feat(art): the hum's arithmetic, with the two anti-metronome choices named

A gain of 1 +/- amplitude per edge, phased on the 3-D midpoint so
neighbours breathe together and the pattern drifts across the sphere.
Nothing travels along an edge, so nothing smears through the trail.

The wavenumber is deliberately not pi (that is a rotating two-lobe
blink) and the axis period is deliberately not a small-integer multiple
of the breath (that visibly repeats). Both are tested as invariants
rather than left as trivia in a comment.

On performance.now(), never on a frame count: a frame counter runs at
double speed on a 120Hz display, and the capture harness virtualises the
clock anyway.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: Wire it into the draw loop

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` — the import block near line 113, and the base-edge loop that begins `for (const e of sortedEdges) {` near line 1352.

**Interfaces:**
- Consumes: `HUM`, `humPhase`, `humAxis`, `humGain` from Task 1.
- Produces: nothing new for later tasks. `baseAlpha` keeps its name and meaning.

- [ ] **Step 1: Add the import**

`ArtTab.jsx` already imports from `../art/artComposite` on the line after the `artAwakening` import. Add a sibling import beside it:

```js
import { humPhase, humAxis, humGain } from '../art/artEdges';
```

If the file already imports other names from `../art/artEdges`, add these three to that existing statement instead of writing a second one.

- [ ] **Step 2: Compute the axis and phase ONCE per frame**

Immediately above `for (const e of sortedEdges) {` (near line 1352), insert:

```js
        // Once per frame, not once per edge: every edge this frame shares one
        // wave. `performance.now()` and not a frame counter — see humPhase.
        const _humNow   = performance.now();
        const _humPhase = humPhase(_humNow);
        const _humAxis  = humAxis(_humNow);
```

- [ ] **Step 3: Multiply the gain into baseAlpha**

Find this line inside the loop (near line 1385):

```js
          const baseAlpha = (Math.min(na.energy, nb.energy) * 0.5 + 0.06 + spectralBoost + fusionBoost) * depthFade;
```

Replace it with:

```js
          // The wire hum. One multiply, on the one scalar all four branches
          // below derive from, so ortho / fused / spectral / default all
          // breathe without any of them knowing about it.
          //
          // The midpoint is the 3-D one — na and nb are unit-sphere positions,
          // not the projected pA/pB — so the wave rotates WITH the graph
          // instead of the graph sliding through it.
          //
          // AFTER depthFade on purpose: the hum is attenuated by depth along
          // with everything else, so the far side of the sphere does not pulse
          // as loudly as the near side. If the frames say otherwise, the fix is
          // to move the multiply inside the parentheses.
          const _humMid = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2, z: (na.z + nb.z) / 2 };
          const baseAlpha = (Math.min(na.energy, nb.energy) * 0.5 + 0.06 + spectralBoost + fusionBoost)
                          * depthFade * humGain(_humMid, _humAxis, _humPhase);
```

- [ ] **Step 4: Run the full suite and the lint gate**

```bash
npx vitest run
```

Expected: PASS — 119 files, all tests green. No test asserts on `baseAlpha` directly, so nothing should turn red; if something does, read it before changing it.

```bash
npm run lint
```

Expected: `0 errors`. Warnings must not exceed 153.

- [ ] **Step 5: Look at it in a real browser**

The browser pane's rAF is suspended, so the pane cannot render this — do not try to verify there and do not report "no visible change" from it.

Start the dev server and open `/chaos` in a real browser:

```bash
npm run dev -- --port 5174
```

Watch the idle graph for at least 20 seconds without clicking anything. Expected: the edges do not all brighten together; brightness drifts across the sphere. Expected NOT: a visible band with a hard edge, a uniform global blink, or any flicker on the bright fused/spectral edges.

If the bright edges flicker, that is the failure section 7 of the spec predicts — **stop and report it** rather than dialling around it. The fix is the attenuation fallback, and it is a design decision, not a tweak.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -F- <<'MSG'
feat(art): the graph breathes at rest

One multiply, on the one scalar every base-edge branch derives from.
The midpoint is the 3-D one rather than the projected pair, so the wave
is anchored to the graph and rotates with it — a screen-space wave would
have pinned the light to the viewport and made the sphere look like it
was sliding through a curtain.

Applied after depthFade, so the far side breathes proportionally less.
That is a choice and the comment says how to reverse it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: A sweep to look at

**Files:**
- Create: `scripts/_a4hum.mjs`
- Reference (read before writing): `scripts/_a3bloom.mjs`

**Interfaces:**
- Consumes: the `HUM` block from Task 1, by patching its source text.
- Produces: PNGs under `lookbook/hum/`.

The amplitude is an aesthetic dial and a still frame cannot show breathing, so this shoots **one full breath cycle per value** and montages it. `HUM.periodMs` is 9000 and the harness advances `1000/60` ms per pump, so one cycle is **540 pumps**; six frames at 90-pump intervals cover it.

- [ ] **Step 1: Read the precedent**

```bash
sed -n '1,120p' scripts/_a3bloom.mjs
```

Note three things it does that this must also do: it patches **tracked source** and restores in a `finally`; it launches a **fresh browser per value** so nothing depends on HMR; and it **pins the world** so each value is shot against the same graph.

- [ ] **Step 2: Write the script**

Create `scripts/_a4hum.mjs` following `_a3bloom.mjs`'s structure exactly, with these differences:

- The patched file is `src/terminal/art/artEdges.js`, and the patched line is `  amplitude:    0.15,` inside the `HUM` block. Match it with `/^(\s*amplitude:\s*)[\d.]+,/m` and substitute the swept value.
- Default values to sweep: `0, 0.10, 0.15, 0.22` — **0 is the control** and must be in the set, because a hum nobody can see and a hum that is not running produce the same still.
- Per value, after the world is pinned, shoot 6 frames at 90-pump intervals into `lookbook/hum/<mode>-a<value>-f<n>.png`.
- Support `--normal` to shoot normal mode as well as immersive, as `_a3bloom.mjs` does.
- The header comment must carry `_a3bloom.mjs`'s warning verbatim in substance: a session that dies while patched leaves tracked source modified, and the revert is `git checkout -- src/terminal/art/artEdges.js`.

- [ ] **Step 3: Run it**

```bash
node scripts/_a4hum.mjs 1920 1080 1 --normal
```

Expected: 48 PNGs under `lookbook/hum/` (4 values x 6 frames x 2 modes).

- [ ] **Step 4: Confirm the tree is clean**

```bash
git status --short src/terminal/art/artEdges.js
```

Expected: **no output.** If it shows the file modified, the restore did not run:

```bash
git checkout -- src/terminal/art/artEdges.js
```

- [ ] **Step 5: Check the control is distinguishable**

Open `lookbook/hum/imm-a0-f0.png` and `lookbook/hum/imm-a0-f5.png`, then `imm-a0.15-f0.png` and `imm-a0.15-f5.png`. The `a0` pair must look identical to each other and the `a0.15` pair must not. If the `a0.15` pair is also identical, the hum is not reaching the render and the sweep is worthless — stop and debug that before showing anyone the pictures.

- [ ] **Step 6: Commit the script only**

`lookbook/` output is not committed.

```bash
git add scripts/_a4hum.mjs
git commit -F- <<'MSG'
test(art): a sweep for the hum, with a control in the set

A still cannot show breathing, so each amplitude is shot six times
across one full breath cycle — 540 pumps at the harness's 1000/60 ms,
sampled every 90 — and amplitude 0 is in the sweep as the control. A hum
nobody can see and a hum that is not running make the same picture, and
without the control there is no way to tell them apart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: Dial it

**Files:**
- Modify: `src/terminal/art/artEdges.js` — the `HUM` block only.

This task has **no code to write until the author has looked.** The values are his call, exactly as `BLOOM.intensity` and `BLOOM.levels` were.

- [ ] **Step 1: Present the frames**

Show the author the montages from Task 3, naming which is the control. Ask for one amplitude. If he asks to see a different `wavenumber` or `periodMs`, re-run Task 3's script against that key rather than guessing.

- [ ] **Step 2: Apply the chosen value**

Edit the `HUM` block and add a dated note above it in the shape `artComposite.js` uses for its dial decisions — what moved, what it was chosen on, and what it cost. Name the file the choice was made from.

- [ ] **Step 3: Re-run the gates**

```bash
npx vitest run && npm run lint
```

Expected: all tests pass, `0 errors`. Task 1's invariant tests (`not pi`, `no low-order beat`, `amplitude < 1`) will catch a chosen value that breaks the design's own rules — if one fails, that is the test doing its job, so raise it rather than relaxing it.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/art/artEdges.js
git commit -F- <<'MSG'
feat(art): the hum's amplitude, chosen on frames

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 5: Pay the re-base

**Files:**
- Create: `baseline/art-sphere-phase3-hum-certified-{a,b,c,d,e}/`

The hum moves the frame on purpose, so the reference at `baseline/art-sphere-phase2-bloom-dial-certified` (`d69ce75`) now reads it as a regression. It is a real one, and the debt is paid the same way the bloom dial paid it: five capture sets, compared against each other to establish the new reference is stable.

- [ ] **Step 1: Capture five sets**

```bash
node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-a
node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-b
node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-c
node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-d
node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-e
```

`artBaseline` stamps `gitCommit` from `BASELINE_COMMIT` **only** — if it is unset the manifest records `null` and the whole reference set is unattributable. So set it on each run (bash; PowerShell has no inline env-var prefix, use `$env:BASELINE_COMMIT = "..."` first there):

```bash
BASELINE_COMMIT=$(git rev-parse HEAD) node scripts/artBaseline.mjs --out baseline/art-sphere-phase3-hum-certified-a
```

- [ ] **Step 2: Compare the sets against each other**

```bash
node scripts/artCompare.mjs baseline/art-sphere-phase3-hum-certified-a baseline/art-sphere-phase3-hum-certified-b
```

Repeat for the other pairs. Expected: 21/21 ADMISSIBLE on each pair.

The hum is time-varying and the sets are separate boots, so **if a cell is unstable across sets, do not silently accept it.** Report which cell and by how much. An unstable reference is worse than none — it makes every future comparison unfalsifiable.

- [ ] **Step 3: Record the result**

Append a section to `docs/superpowers/specs/2026-09-20-chaos-wire-hum-design.md` stating the new reference path, the commit it was captured at, the worst pairwise score, and — if any cell was unstable — which one and what was decided about it. Strike the "a re-base is owed" line in section 8 and say it is discharged.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-20-chaos-wire-hum-design.md
git commit -F- <<'MSG'
docs(art): the hum's re-base, discharged

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Out of scope, recorded on purpose

**Option C — travelling telemetry on event-adjacent edges.** Needs the non-accumulating layer beside the strimer, so it is a separate plan. It wants the resting rate settled first so the two can be dialled against each other.

**`breathPhase` runs at double speed on 120 Hz displays.** `awakeningRef.current.breathPhase` advances a fixed 0.015 per draw. Same class of bug as the /SCENT frame counter. Not fixed here — fixing it moves the frame a second time, which would confound this re-base with an unrelated change.

**The dead source-canvas upload.** `SourceQuad` re-uploads a full-resolution `CanvasTexture` every frame for a 2-D canvas that may now be entirely empty. Gated on the author's `maxAlpha` probe; if it reads 0, removing it is bit-identical and `artCompare` will prove it.
