# Strimer Wavefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On left-click, a white-hot packet races outward along every edge touching the clicked node, lights a rail under itself, and terminates in a micro-ping at the far vertex — leaving zero residual.

**Architecture:** Two new files. `artStrimer.js` is pure math (profile, kinematics, lifecycle, pooled state) with no canvas and no three. `SphereStrimer.jsx` is an instanced mesh mounted in **r3f's scene graph** — inside `<EffectComposer>` so it gets Bloom and Knee, and *outside* the trail accumulator, which is the entire source of the zero-residual property. Nothing certified is modified except one backward-compatible option on `fireNode`.

**Tech Stack:** React 18, @react-three/fiber, @react-three/postprocessing 3.0.4, three.js, raw GLSL, vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-strimer-wavefront-design.md`. Read §1 before touching anything — three of its four measurements killed an earlier design.

## Global Constraints

- **Branch `fix/art-sphere-index-space`.** Do not merge. **Do not push.** Verification approval is not push consent — ask.
- **Never run `scripts/_s1wake.mjs` or `scripts/_s2layer.mjs` during a capture.** Both patch tracked source. `git status -- src/` after either.
- **Test command is `npx vitest run <path>`.** Full suite `npm test`. Baseline at plan time: **1316 tests pass**.
- **Lint gate: `npm run lint`, 0 errors, max 153 warnings.** Baseline 145.
- **Never drive this with a frame counter.** All kinematics use `performance.now()` deltas. A frame counter runs at double speed on the author's 120Hz display — that is the /SCENT bug.
- **This layer's buffer holds LINEAR colour.** `NODE_COLORS` is sRGB. Convert at the CPU write site or the tail reads brighter and flatter than the same hue on an edge.
- **The head must be authored white.** The knee scales all three channels equally and can never whiten a saturated colour.
- **No allocation in the draw loop.** Pooled typed arrays only, matching `createEdgeState`.
- **Never use the browser pane; use `scripts/cdp.mjs`. Never `--disable-gpu`.**
- **`artCompare` is a tripwire, not a verdict.** The frame strip is the gate. Read `artInk`'s `lit` and `meanLit` beside every ratio, never the ratio alone.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artStrimer.js` | **Create.** Constants, easing, duration, profile, sRGB→linear, pooled state, spawn, step, instance writing. Pure — importable by a test with no DOM. |
| `src/terminal/art/__tests__/artStrimer.test.js` | **Create.** The seven behaviours in spec §7. |
| `src/terminal/art/SphereStrimer.jsx` | **Create.** Instanced mesh, vertex + fragment shaders, per-frame buffer sync. |
| `src/terminal/art/SphereComposite.jsx` | **Modify.** Accept `strimerRef`, mount `<SphereStrimer>` after `<SourceQuad>`. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Own the pool, step it in the draw loop, spawn on click/touch, deliver arrivals, publish `window.__artStrimerState`. |
| `src/terminal/hooks/useSomaGraph.js` | **Modify.** `fireNode(id, { neighbours = true })`. Default preserves every existing caller. |
| `scripts/_s3strimer.mjs` | **Create.** The transient capture rig — `pump(1)` at offsets 1–8, both modes. |

---

## Task 1: The pure module

**Files:**
- Create: `src/terminal/art/artStrimer.js`
- Test: `src/terminal/art/__tests__/artStrimer.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `STRIMER_STRIDE`, `STRIMER_MAX_PACKETS`, `PING_FRAMES`, `PACKET_FRACTION`, `DURATION_MIN_MS`, `DURATION_MAX_MS`, `STRIMER_MS_PER_UNIT`, `HEAD_GAIN`, `HEAD_WIDTH`, `RAIL_GAIN`, `RAIL_WIDTH`, `PING_GAIN`, `PING_RADIUS`, `PROFILE_PACKET`, `PROFILE_RAIL`, `PROFILE_PING`, `easeOutCubic(t) -> number`, `packetDuration(worldLen) -> ms`, `packetProfile(h) -> number`, `srgbToLinear01(c) -> number`, `hslToLinearRgb({hue,sat,lit}, out) -> out`, `createStrimerState(cap?) -> state`, `spawnStrimer(state, {srcId, targets, nowMs, colour}) -> count`, `stepStrimer(state, nowMs) -> void`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/art/__tests__/artStrimer.test.js`:

```js
// artStrimer.test.js — the arithmetic behind the click-triggered wavefront.
//
// Every number here is from the design's section 1, which was measured before
// it was designed. The two that matter most:
//   - the packet must SPAN at least the per-frame stride (17% of the edge) or
//     it strobes into discrete beads. Measured, photographed.
//   - the head must be WHITE, because the knee scales all three channels
//     equally and can never whiten a saturated colour.

import { describe, it, expect } from 'vitest';
import {
  easeOutCubic, packetDuration, packetProfile, srgbToLinear01, hslToLinearRgb,
  createStrimerState, spawnStrimer, stepStrimer,
  STRIMER_MAX_PACKETS, STRIMER_STRIDE, PING_FRAMES,
  DURATION_MIN_MS, DURATION_MAX_MS,
} from '../artStrimer';

describe('easeOutCubic', () => {
  it('is exact at both endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('opens at 3x the average speed — this IS the "aggressive attack"', () => {
    // d/dt [1-(1-t)^3] = 3(1-t)^2, which is 3 at t = 0.
    const e = 1e-6;
    expect((easeOutCubic(e) - easeOutCubic(0)) / e).toBeCloseTo(3, 4);
  });

  it('decelerates monotonically into the node', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const u = easeOutCubic(Math.min(t, 1));
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
    }
  });
});

describe('packetDuration', () => {
  it('clamps at both ends', () => {
    expect(packetDuration(0)).toBe(DURATION_MIN_MS);
    expect(packetDuration(1e6)).toBe(DURATION_MAX_MS);
  });

  it('is linear in world length between the clamps', () => {
    // Two lengths that both land strictly inside the band must keep their
    // ratio. Chord length on the unit sphere the nodes live on is <= 2.
    // 0.4 and 0.7 both land strictly inside at STRIMER_MS_PER_UNIT = 200
    // (80ms and 140ms). 1.0 would be 200ms and CLAMP, which is what makes a
    // ratio test on it quietly wrong.
    const a = packetDuration(0.4), b = packetDuration(0.7);
    expect(a).toBeGreaterThan(DURATION_MIN_MS);
    expect(b).toBeLessThan(DURATION_MAX_MS);
    expect(b / a).toBeCloseTo(1.75, 6);
  });

  it('keeps every chord a unit sphere can produce inside the band', () => {
    // The clamp is what guarantees a degree-4 burst stays in unison whatever
    // the graph's chord distribution turns out to be.
    for (let L = 0; L <= 2; L += 0.05) {
      const d = packetDuration(L);
      expect(d).toBeGreaterThanOrEqual(DURATION_MIN_MS);
      expect(d).toBeLessThanOrEqual(DURATION_MAX_MS);
    }
  });
});

describe('packetProfile', () => {
  it('is 1 at the head and 0 at the tail end', () => {
    expect(packetProfile(0)).toBe(1);
    expect(packetProfile(1)).toBe(0);
  });

  it('decreases monotonically — a bump would read as two heads', () => {
    let prev = Infinity;
    for (let h = 0; h <= 1.0001; h += 0.02) {
      const v = packetProfile(Math.min(h, 1));
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      prev = v;
    }
  });

  it('is dense: over half its mass sits in the leading third', () => {
    // "Dense, compact packet", not a linear streak. pow(1-h, 2.5).
    const mass = (lo, hi) => {
      let s = 0;
      for (let h = lo; h < hi; h += 0.0005) s += packetProfile(h) * 0.0005;
      return s;
    };
    expect(mass(0, 1 / 3)).toBeGreaterThan(mass(1 / 3, 1));
  });
});

describe('srgbToLinear01', () => {
  it('matches the sRGB piecewise curve at its anchors', () => {
    expect(srgbToLinear01(0)).toBeCloseTo(0, 10);
    expect(srgbToLinear01(1)).toBeCloseTo(1, 10);
    expect(srgbToLinear01(0.5)).toBeCloseTo(0.21404114, 6);
  });

  it('is below the identity in the midtones — the trap this exists for', () => {
    // A cluster hue written straight from NODE_COLORS would read brighter
    // and flatter than the same hue on an edge. See the design, section 9.
    expect(srgbToLinear01(0.5)).toBeLessThan(0.5);
  });
});

describe('hslToLinearRgb', () => {
  it('writes into the caller\'s array and returns it — no allocation', () => {
    const out = [0, 0, 0];
    expect(hslToLinearRgb({ hue: 0, sat: 0, lit: 0 }, out)).toBe(out);
  });

  it('sends pure white to linear 1 and black to 0', () => {
    const out = [0, 0, 0];
    hslToLinearRgb({ hue: 210, sat: 100, lit: 100 }, out);
    expect(out).toEqual([1, 1, 1]);
    hslToLinearRgb({ hue: 210, sat: 100, lit: 0 }, out);
    expect(out).toEqual([0, 0, 0]);
  });

  it('is darker than the raw sRGB channels for a mid-lightness hue', () => {
    const out = [0, 0, 0];
    hslToLinearRgb({ hue: 180, sat: 100, lit: 50 }, out);
    // sRGB cyan at lit 50 is (0, 1, 1); linear leaves 1 at 1 and 0 at 0, so
    // pick a hue whose channels are genuinely mid.
    const mid = [0, 0, 0];
    hslToLinearRgb({ hue: 30, sat: 100, lit: 50 }, mid);
    expect(mid[1]).toBeLessThan(0.5);
    expect(out[0]).toBe(0);
  });
});

describe('spawnStrimer', () => {
  const colour = { hue: 200, sat: 90, lit: 60 };
  const targets = [
    { dstId: 'b', worldLen: 0.5 },
    { dstId: 'c', worldLen: 0.8 },
    { dstId: 'd', worldLen: 1.1 },
    { dstId: 'e', worldLen: 0.9 },
  ];

  it('produces exactly one packet per target, all outward from the source', () => {
    const s = createStrimerState();
    expect(spawnStrimer(s, { srcId: 'a', targets, nowMs: 1000, colour })).toBe(4);
    expect(s.count).toBe(4);
    for (let i = 0; i < 4; i++) {
      // THE failure mode this guards: an edge tuple stored [neighbour, clicked]
      // spawning a packet that runs BACKWARD into the node that was clicked.
      expect(s.srcId[i]).toBe('a');
      expect(s.dstId[i]).not.toBe('a');
    }
    expect([...s.dstId.slice(0, 4)].sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('gives each packet its own duration from its own world length', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets, nowMs: 0, colour });
    expect(s.dur[0]).toBe(packetDuration(0.5));
    expect(s.dur[2]).toBe(packetDuration(1.1));
  });

  it('enforces the cap by dropping the OLDEST, and never exceeds it', () => {
    const s = createStrimerState();
    const one = [{ dstId: 'z', worldLen: 0.5 }];
    for (let i = 0; i < STRIMER_MAX_PACKETS + 20; i++) {
      spawnStrimer(s, { srcId: 's' + i, targets: one, nowMs: i, colour });
      expect(s.count).toBeLessThanOrEqual(STRIMER_MAX_PACKETS);
    }
    expect(s.count).toBe(STRIMER_MAX_PACKETS);
    // The survivors are the NEWEST, so the oldest source is gone.
    const alive = new Set([...s.srcId.slice(0, s.count)]);
    expect(alive.has('s0')).toBe(false);
    expect(alive.has('s' + (STRIMER_MAX_PACKETS + 19))).toBe(true);
  });

  it('sizes its buffer for two instances per slot — packet plus rail', () => {
    const s = createStrimerState();
    expect(s.data.length).toBe(STRIMER_MAX_PACKETS * 2 * STRIMER_STRIDE);
  });
});

describe('stepStrimer', () => {
  const colour = { hue: 200, sat: 90, lit: 60 };
  const one = [{ dstId: 'b', worldLen: 0.8 }];

  it('advances u by elapsed time, not by call count', () => {
    // The /SCENT double-speed bug in one assertion: two steps at the same
    // clock must leave u where one step did.
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    stepStrimer(s, 20);
    const after = s.u[0];
    stepStrimer(s, 20);
    expect(s.u[0]).toBe(after);
    stepStrimer(s, 40);
    expect(s.u[0]).toBeGreaterThan(after);
  });

  it('reports each arrival exactly once', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    const d = s.dur[0];
    stepStrimer(s, d * 0.5);
    expect(s.arrivedCount).toBe(0);
    stepStrimer(s, d + 1);
    expect(s.arrivedCount).toBe(1);
    expect(s.dstId[s.arrived[0]]).toBe('b');
    stepStrimer(s, d + 2);
    expect(s.arrivedCount).toBe(0);
  });

  it('retires a packet after its ping and frees the slot', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    const d = s.dur[0];
    stepStrimer(s, d + 1);
    expect(s.count).toBe(1);
    for (let i = 0; i < PING_FRAMES; i++) stepStrimer(s, d + 2 + i);
    expect(s.count).toBe(0);
  });

  it('survives head == tail without producing NaN', () => {
    // A zero-length edge degenerates the capsule into a disc, which is how
    // the ping is drawn. The edge shader already documents atan(0,0) and
    // mix(x, NaN, 0) as live hazards in exactly this situation.
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: [{ dstId: 'b', worldLen: 0 }], nowMs: 0, colour });
    stepStrimer(s, 1);
    expect(Number.isNaN(s.u[0])).toBe(false);
    expect(Number.isFinite(s.dur[0])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/art/__tests__/artStrimer.test.js`
Expected: FAIL — `Failed to resolve import "../artStrimer"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/art/artStrimer.js`:

```js
// artStrimer.js — the click-triggered wavefront, as pure arithmetic.
//
// A Lian Li Strimer crack: on left-click a white-hot packet races outward
// along every edge touching the clicked node, a dim rail lights under it, and
// it terminates in a micro-ping at the far vertex. No ambient loop; wires sit
// dark until triggered.
//
// This module is the twin of artEdges.js and exists for the same reason: the
// GPU copy and anything that reasons about the effect read one source of
// truth, and the curves are testable without a canvas.
//
// ── THREE THINGS THAT WERE MEASURED, NOT CHOSEN ───────────────────────────
//
// 1. PACKET_FRACTION is not a style knob. At a 100ms transit the head
//    advances 41px per frame on a 249px edge; a head narrower than that
//    stride never overlaps itself and the effect STROBES INTO BEADS —
//    photographed in lookbook/wake/. 0.17 IS that stride.
// 2. The head is WHITE and the colour lives in the tail. The knee is a
//    max-channel Reinhard: it scales all three channels by one factor, so it
//    preserves hue and saturation exactly and can never whiten a saturated
//    colour. A cyan head at (0, 2.4, 2.4) exits as (0, 0.927, 0.927).
// 3. Duration comes from WORLD length, not screen length. That is correct
//    parallax (a near edge should look faster), and it is invariant under
//    rotation — which is what makes a capture of a transient reproducible.
//
// See docs/superpowers/specs/2026-09-20-strimer-wavefront-design.md.

// ── Layout ─────────────────────────────────────────────────────────────────
// Its own layout, deliberately NOT EDGE_STRIDE. The edge layout's byte-packed
// alpha is precisely what cannot carry this effect: writeHsl clamps, packAlphas
// quantises alpha to a byte, and COMPOSITE_ADDITIVE's factors are all <= 1, so
// one additive edge instance maxes at exactly 1.0 per channel. `gain` below is
// a PLAIN FLOAT, and that is the whole reason this layer exists.
//
//   0-1  hx, hy    head, CSS px, canvas y-down
//   2-3  tx, ty    tail end, same space
//   4    width     cross-section half-width, px
//   5    gain      LINEAR peak; may exceed 1
//   6-8  r, g, b   tail colour, LINEAR 0-1
//   9    profile   PROFILE_PACKET | PROFILE_RAIL | PROFILE_PING
export const STRIMER_STRIDE = 10;

export const PROFILE_PACKET = 0;
export const PROFILE_RAIL = 1;
export const PROFILE_PING = 2;

/**
 * Hard cap on live packets.
 *
 * MEASURED on SPHERE_ADJ 2026-09-20: 31 nodes, 40 edges, max degree 4, mean
 * 2.58. Concurrent spawns are capped at 4 by the same reasoning PRISM_MAX_EFFECTS
 * uses, so the worst case today is 16. Bifurcation adds dynamic nodes and can
 * raise degree, hence the headroom.
 *
 * ENFORCED in spawnStrimer by dropping the oldest — a cap a buffer is sized
 * from has to be a cap something actually applies, or it is a guess with a
 * comment. At 64 * 2 * 10 floats the whole buffer is 5KB.
 */
export const STRIMER_MAX_PACKETS = 64;

/** Frames the arrival ping lives. */
export const PING_FRAMES = 4;

/** Packet length as a fraction of the edge. See note 1 in the header. */
export const PACKET_FRACTION = 0.17;

// ── Kinematics ─────────────────────────────────────────────────────────────
// Constant world velocity, clamped. Electricity has a propagation speed; a
// fixed transit budget makes long edges read as slow motion and short ones as
// instant, and they stop reading as the same physical thing.
//
// Node positions live on a UNIT sphere (useSomaGraph strips the radial
// velocity component every step and project() applies sphereR afterwards), so
// a chord is at most 2. STRIMER_MS_PER_UNIT is the initial value and is a DIAL
// — _s3strimer reports the observed chord distribution so it can be set with
// evidence. The clamp is what makes a wrong value survivable rather than
// absurd, and it is what keeps a degree-4 burst in unison.
export const STRIMER_MS_PER_UNIT = 200;
export const DURATION_MIN_MS = 70;
export const DURATION_MAX_MS = 160;

// ── The three dials (spec section 9) ──────────────────────────────────────
// MEASURED peak through bloom+knee: 0.907 / 0.967 / 0.979 at gain 1 / 2.4 / 4.
// Gain and packet length are NOT orthogonal — measured span grew 0.114 ->
// 0.139 -> 0.165 across those gains, because the bloom halo widens with the
// head. Sweep them together or one gets tuned against the other.
export const HEAD_GAIN = 2.4;
export const HEAD_WIDTH = 3;
export const RAIL_GAIN = 0.08;
export const RAIL_WIDTH = 1.5;
export const PING_GAIN = 1.8;
export const PING_RADIUS = 6;

/** Ease-out cubic. Opens at 3x the average speed and settles into the node. */
export function easeOutCubic(t) {
  const c = 1 - Math.min(1, Math.max(0, t));
  return 1 - c * c * c;
}

/** A packet's transit in ms, from the 3D chord between its endpoints. */
export function packetDuration(worldLen) {
  const raw = worldLen * STRIMER_MS_PER_UNIT;
  return Math.min(DURATION_MAX_MS, Math.max(DURATION_MIN_MS, raw));
}

/**
 * Brightness along the packet: 1 at the head (h = 0), 0 at the tail (h = 1).
 *
 * The CPU mirror of the shader's `along` term. It is not used to draw — the
 * fragment evaluates its own copy — it exists so the curve is TESTABLE, the
 * same bargain artEdges.js strikes for every layer it describes.
 */
export function packetProfile(h) {
  const c = 1 - Math.min(1, Math.max(0, h));
  return Math.pow(c, 2.5);
}

/**
 * One sRGB channel to linear.
 *
 * THE TRAP THIS EXISTS FOR: SourceQuad emits linear working-space colour into
 * the composer, so this layer's buffer is LINEAR — while the additive edge
 * mesh writes sRGB bytes into an sRGB-conceptual accumulator. A cluster hue
 * taken straight from NODE_COLORS and written here reads brighter and flatter
 * than the same hue on an edge. Convert once, at the CPU write site.
 */
export function srgbToLinear01(c) {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * An HSL colour object — the shape NODE_COLORS carries — to LINEAR rgb, into
 * `out`. Writes rather than returns a fresh array: this runs per packet per
 * spawn and the draw loop is off the allocation path.
 *
 * The CSS Color 4 reference implementation, matching writeHsl in
 * SphereEdges.js exactly, with srgbToLinear01 applied to each channel after.
 */
export function hslToLinearRgb({ hue, sat, lit }, out) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, sat / 100));
  const l = Math.min(1, Math.max(0, lit / 100));
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  out[0] = srgbToLinear01(f(0));
  out[1] = srgbToLinear01(f(8));
  out[2] = srgbToLinear01(f(4));
  return out;
}

// ── State ──────────────────────────────────────────────────────────────────

/** Phase values for `state.phase`. */
const PHASE_TRAVEL = 0;
const PHASE_PING = 1;

/**
 * The pool. Parallel arrays, allocated once, never per frame — the same
 * contract createEdgeState() keeps, and for the same reason: `data` becomes
 * the GPU-bound InterleavedBuffer's own backing store, so reallocating it
 * would silently unbind the writer from the thing the GPU reads.
 *
 * `data` holds TWO instances per slot: a travelling slot emits its packet and
 * its rail, a pinging slot emits one disc. So 2 per slot is the true worst
 * case and not a guess.
 */
export function createStrimerState(cap = STRIMER_MAX_PACKETS) {
  return {
    cap,
    count: 0,
    srcId: new Array(cap).fill(null),
    dstId: new Array(cap).fill(null),
    t0: new Float64Array(cap),
    dur: new Float32Array(cap),
    u: new Float32Array(cap),
    rgb: new Float32Array(cap * 3),
    phase: new Uint8Array(cap),
    ping: new Uint8Array(cap),
    // Arrivals this step, as slot indices. Preallocated and reused; the
    // caller reads state.arrived[0 .. arrivedCount-1] and must not hold it.
    arrived: new Int32Array(cap),
    arrivedCount: 0,
    data: new Float32Array(cap * 2 * STRIMER_STRIDE),
    instances: 0,
    w: 0,
    h: 0,
  };
}

/** Move slot `from` onto slot `to`. Used by the cap drop and by retirement. */
function moveSlot(s, to, from) {
  if (to === from) return;
  s.srcId[to] = s.srcId[from];
  s.dstId[to] = s.dstId[from];
  s.t0[to] = s.t0[from];
  s.dur[to] = s.dur[from];
  s.u[to] = s.u[from];
  s.phase[to] = s.phase[from];
  s.ping[to] = s.ping[from];
  s.rgb[to * 3] = s.rgb[from * 3];
  s.rgb[to * 3 + 1] = s.rgb[from * 3 + 1];
  s.rgb[to * 3 + 2] = s.rgb[from * 3 + 2];
}

const _rgb = [0, 0, 0];

/**
 * Spawn one packet per target, all directed OUTWARD from `srcId`.
 *
 * `targets` is `[{ dstId, worldLen }]` — the caller resolves adjacency and the
 * 3D chord, because this module knows nothing about the graph. Returns how
 * many were spawned.
 *
 * Over the cap it drops the OLDEST rather than refusing the newest: a click
 * that produced nothing is a dead interface, and the oldest packet is the one
 * closest to finishing anyway.
 */
export function spawnStrimer(state, { srcId, targets, nowMs, colour }) {
  hslToLinearRgb(colour, _rgb);
  let n = 0;
  for (const t of targets) {
    if (state.count >= state.cap) {
      // Drop the oldest: slot 0 is the least recently spawned because every
      // retirement compacts downward and every spawn appends.
      for (let i = 1; i < state.count; i++) moveSlot(state, i - 1, i);
      state.count--;
    }
    const i = state.count++;
    state.srcId[i] = srcId;
    state.dstId[i] = t.dstId;
    state.t0[i] = nowMs;
    state.dur[i] = packetDuration(t.worldLen);
    state.u[i] = 0;
    state.phase[i] = PHASE_TRAVEL;
    state.ping[i] = 0;
    state.rgb[i * 3] = _rgb[0];
    state.rgb[i * 3 + 1] = _rgb[1];
    state.rgb[i * 3 + 2] = _rgb[2];
    n++;
  }
  return n;
}

/**
 * Advance every packet to `nowMs` and retire the finished ones.
 *
 * Time-based, NOT per-call: two steps at the same clock leave u where one did.
 * A frame counter here would run at double speed on a 120Hz display, which is
 * the /SCENT bug, and it costs nothing in reproducibility because
 * determinism.mjs virtualises performance.now() and advances it by exactly
 * FRAME_MS per __pump.
 *
 * Arrivals land in state.arrived[0 .. arrivedCount-1] as slot indices, ONCE.
 * The caller delivers the target's energy bump from there — see the design's
 * section 6 for why that bump moved off fireNode.
 */
export function stepStrimer(state, nowMs) {
  state.arrivedCount = 0;
  for (let i = 0; i < state.count; i++) {
    if (state.phase[i] === PHASE_TRAVEL) {
      const t = (nowMs - state.t0[i]) / Math.max(state.dur[i], 1e-6);
      if (t >= 1) {
        state.u[i] = 1;
        state.phase[i] = PHASE_PING;
        state.ping[i] = PING_FRAMES;
        state.arrived[state.arrivedCount++] = i;
      } else {
        state.u[i] = easeOutCubic(t);
      }
    } else if (state.ping[i] > 0) {
      state.ping[i]--;
    }
  }
  // Compact retired slots downward, preserving spawn order so the cap drop
  // above keeps meaning "oldest". Iterating forward with a write cursor is
  // stable; splicing in place while iterating is the version that skips one.
  let w = 0;
  for (let i = 0; i < state.count; i++) {
    const dead = state.phase[i] === PHASE_PING && state.ping[i] === 0;
    if (dead) continue;
    moveSlot(state, w, i);
    w++;
  }
  state.count = w;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/art/__tests__/artStrimer.test.js`
Expected: PASS, 22 tests.

If `spawnStrimer > cap` fails, the drop loop is the suspect: it must run *before* the append, and it must compact so slot 0 stays the oldest.

- [ ] **Step 5: Run the full suite and the lint gate**

Run: `npm test`
Expected: 1316 + 22 = **1338 passing**, 0 failing.

Run: `npm run lint`
Expected: 0 errors, ≤153 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/artStrimer.js src/terminal/art/__tests__/artStrimer.test.js
git commit -m "feat(art): the strimer's arithmetic, with the packet length measured not chosen

PACKET_FRACTION 0.17 is the per-frame stride at a 100ms transit, and a head
narrower than its own stride strobes into beads -- measured and photographed
before this was designed. gain is a plain float because the edge layout's
byte-packed alpha cannot express ink above 1.0 at all.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The pool, the trigger and the step — provable without pixels

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx`
- Modify: `src/terminal/hooks/useSomaGraph.js:218-228`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `strimerRef` (a `useRef` holding a `createStrimerState()`), `window.__artStrimerState() -> { count, instances, packets: [{src, dst, u, phase, ping}] }`, and `fireNode(id, { neighbours = true })`.

This task makes packets exist, advance on the clock, and die — and proves it from the published state. No pixels yet. Splitting it from the renderer means a failure has one candidate cause.

- [ ] **Step 1: Add the `neighbours` option to `fireNode`**

In `src/terminal/hooks/useSomaGraph.js`, replace the `fireNode` callback:

```js
  /**
   * Fire a node: its own energy to 1, and by default its neighbours to +0.6.
   *
   * `neighbours` is false ONLY where a strimer will deliver those bumps on
   * arrival instead — see the design's section 6. It defaults to true so every
   * existing caller and every existing test is unmoved, including the ambient
   * awakening fires, whose behaviour must not change.
   *
   * The pairing is the invariant worth protecting: a caller that suppresses
   * the bump without spawning a wavefront silently stops the graph
   * propagating. ArtTab keeps both on one flag for exactly that reason.
   */
  const fireNode = useCallback((id, { neighbours = true } = {}) => {
    const s = stateRef.current;
    if (!s) return;
    const n = s.nodes.find(x => x.id === id);
    if (!n) return;
    n.energy = 1;
    if (!neighbours) return;
    const adjacent = adj[id] ?? [];
    for (const adjId of adjacent) {
      const m = s.nodes.find(x => x.id === adjId);
      if (m) m.energy = Math.min(1, m.energy + 0.6);
    }
  }, [adj]);
```

- [ ] **Step 2: Run the existing suite to prove nothing moved**

Run: `npm test`
Expected: **1338 passing**, 0 failing. The default makes this a no-op; a failure here means a caller was already passing a second argument.

- [ ] **Step 3: Add the pool and the imports to ArtTab**

In `src/terminal/views/ArtTab.jsx`, add to the art imports near the `SphereEdges` import block:

```js
import {
  createStrimerState, spawnStrimer, stepStrimer,
  STRIMER_STRIDE, PACKET_FRACTION, PROFILE_PACKET, PROFILE_RAIL, PROFILE_PING,
  HEAD_GAIN, HEAD_WIDTH, RAIL_GAIN, RAIL_WIDTH, PING_GAIN, PING_RADIUS,
  PING_FRAMES,
} from '../art/artStrimer';
```

Beside `addGLRef` (currently `ArtTab.jsx:456-457`), add:

```js
  // The strimer pool. Created in the render body like the edge states, so its
  // `.data` array exists before SphereComposite's factory first runs.
  const strimerRef = useRef(null);
  if (strimerRef.current === null) strimerRef.current = createStrimerState();
```

- [ ] **Step 4: Spawn on click and on touch**

In the left-click handler, replace the bare `fireNode(node.id);` (currently `ArtTab.jsx:3038`) with:

```js
        // The strimer delivers each neighbour's bump when its packet LANDS,
        // so the instant loop is suppressed here. The two are one decision:
        // suppressing without spawning would stop the graph propagating.
        fireNode(node.id, { neighbours: false });
        fireStrimer(node.id);
```

In the touch handler, replace the bare `fireNode(node.id);` (currently `ArtTab.jsx:3218`) with the identical two lines.

In `spawnEffect`, replace its trailing `if (node) { fireNode(node.id); }` (currently `ArtTab.jsx:733`) with:

```js
    // `opts.strimer` says a wavefront is being spawned by the caller and will
    // deliver the neighbour bumps itself. Terminal `run` and the ambient
    // awakening fires do NOT pass it, so they keep the instant propagation
    // they have always had.
    if (node) { fireNode(node.id, { neighbours: !opts.strimer }); }
```

and at both handler call sites change `spawnEffect(node.id, { soft: true })` /
`spawnEffect(node.id, { soft: true, rightClick: false })` to include `strimer: true`.

- [ ] **Step 5: Add `fireStrimer`, above the click handler**

```js
  /**
   * Spawn one packet per edge touching `id`, outward.
   *
   * Adjacency is SPHERE_ADJ — the 31-node, 40-edge set the sphere actually
   * draws and fires over. (ArtTab's label cascade uses the full 272-node ADJ;
   * the two disagree about who a node's neighbours are. Not changed here, and
   * recorded in the design's section 10.)
   *
   * The chord is 3D and unprojected: that is correct parallax, and it is
   * invariant under rotation, which is what makes the transient reproducible
   * in a capture.
   */
  const fireStrimer = useCallback((id) => {
    const st = stateRef.current;
    const pool = strimerRef.current;
    if (!st || !pool) return;
    const src = st.nodes.find(n => n.id === id);
    if (!src) return;
    const targets = [];
    for (const dstId of (SPHERE_ADJ[id] ?? [])) {
      const dst = st.nodes.find(n => n.id === dstId);
      if (!dst) continue;
      targets.push({
        dstId,
        worldLen: Math.hypot(dst.x - src.x, dst.y - src.y, dst.z - src.z),
      });
    }
    if (!targets.length) return;
    spawnStrimer(pool, {
      srcId: id,
      targets,
      nowMs: performance.now(),
      colour: NODE_COLORS[id] ?? { hue: 200, sat: 90, lit: 60 },
    });
  }, []);
```

- [ ] **Step 6: Step the pool and deliver arrivals in the draw loop**

In the draw loop, immediately before `const _pcen = nodeCensusRef.current;`:

```js
      // ── The strimer wavefront ────────────────────────────────────────────
      // Stepped on the clock, never on a frame count: a frame counter runs at
      // double speed on a 120Hz display, which is the /SCENT bug. The harness
      // virtualises performance.now() and advances it FRAME_MS per __pump, so
      // this stays bit-reproducible under a capture.
      {
        const sp = strimerRef.current;
        stepStrimer(sp, performance.now());

        // ARRIVALS. This is the +0.6 that used to fire instantly inside
        // fireNode for every neighbour at once; it now lands when the packet
        // that was sent to that neighbour actually gets there.
        for (let k = 0; k < sp.arrivedCount; k++) {
          const nb = nodes.find(n => n.id === sp.dstId[sp.arrived[k]]);
          if (nb) nb.energy = Math.min(1, nb.energy + 0.6);
        }

        sp.w = w; sp.h = h;
        sp.instances = 0;
        for (let i = 0; i < sp.count; i++) {
          const ia = nodes.findIndex(n => n.id === sp.srcId[i]);
          const ib = nodes.findIndex(n => n.id === sp.dstId[i]);
          if (ia < 0 || ib < 0) continue;
          const pa = proj[ia], pb = proj[ib];
          if (!pa || !pb) continue;   // dynamic node not yet projected
          const r = sp.rgb[i * 3], g = sp.rgb[i * 3 + 1], b = sp.rgb[i * 3 + 2];
          const scale = (pa.scale + pb.scale) * 0.5 * ink;

          if (sp.phase[i] === 0) {
            // The RAIL first, so the packet adds over it. `lighter` commutes,
            // so this is for legibility rather than correctness.
            let o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = pa.sx; sp.data[o + 1] = pa.sy;
            sp.data[o + 2] = pb.sx; sp.data[o + 3] = pb.sy;
            sp.data[o + 4] = RAIL_WIDTH * scale;
            sp.data[o + 5] = RAIL_GAIN;
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_RAIL;
            sp.instances++;

            const u = sp.u[i];
            const hx = pa.sx + (pb.sx - pa.sx) * u;
            const hy = pa.sy + (pb.sy - pa.sy) * u;
            const L = Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy) * PACKET_FRACTION;
            const dx = pb.sx - pa.sx, dy = pb.sy - pa.sy;
            const n = Math.max(Math.hypot(dx, dy), 1e-6);
            o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = hx; sp.data[o + 1] = hy;
            sp.data[o + 2] = hx - dx / n * L; sp.data[o + 3] = hy - dy / n * L;
            sp.data[o + 4] = HEAD_WIDTH * scale;
            sp.data[o + 5] = HEAD_GAIN;
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_PACKET;
            sp.instances++;
          } else {
            // The PING: head == tail, which the same capsule arithmetic
            // renders as a disc. One shader, three profiles.
            const k2 = sp.ping[i] / PING_FRAMES;
            const o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = pb.sx; sp.data[o + 1] = pb.sy;
            sp.data[o + 2] = pb.sx; sp.data[o + 3] = pb.sy;
            sp.data[o + 4] = PING_RADIUS * scale;
            sp.data[o + 5] = PING_GAIN * k2;
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_PING;
            sp.instances++;
          }
        }
      }
```

- [ ] **Step 7: Publish the debug hook**

Beside `window.__artEdgeState` (currently `ArtTab.jsx:2713`):

```js
    // The strimer, for the harness. `instances` answers a different question
    // from `count`: whether the layer had anything ON SCREEN when a number was
    // taken. A transient that has already passed is not in the frame being
    // graded, and this is what says so.
    window.__artStrimerState = () => {
      const sp = strimerRef.current;
      const packets = [];
      for (let i = 0; i < sp.count; i++) {
        packets.push({
          src: sp.srcId[i], dst: sp.dstId[i],
          u: +sp.u[i].toFixed(4), phase: sp.phase[i], ping: sp.ping[i],
        });
      }
      return { count: sp.count, instances: sp.instances, w: sp.w, h: sp.h, packets };
    };

    // Fire a node's wavefront directly, for the harness. The alternative is a
    // hover-grid click, which costs a node-finding sweep and makes WHICH node
    // fired depend on where the grid happened to land -- so a probe of the
    // effect would be measuring the grid too.
    window.__artFireStrimer = (id) => {
      fireNode(id, { neighbours: false });
      fireStrimer(id);
      return strimerRef.current.count;
    };
```

- [ ] **Step 8: Verify from a real browser**

With `npm run dev` serving on 5174, save this as
`C:/Users/raul-/AppData/Local/Temp/strimer-check.mjs` and run it with
`node <path>`:

```js
import { launch } from './scripts/cdp.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;

const page = await launch({ url: 'http://localhost:5174/', width: 1520, height: 900, dpr: 1, deterministic: true });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot' });
  await sleep(2500);
  await page.eval(`[...document.querySelectorAll('button')]
    .find(e => /\/CHAOS/i.test(e.innerText || '')).click()`);
  await page.waitFor(`(() => { const c = ${SPHERE};
    return !!c && c.getBoundingClientRect().width > 800; })()`, { label: 'sphere', timeoutMs: 40000 });
  await sleep(4000);
  await page.eval('window.__virtualize()');
  await sleep(150);
  await page.eval('window.__reseed(); window.__artHarnessReset();');
  await page.pump(270);

  console.log('hook:', await page.eval('typeof window.__artFireStrimer'));
  // biocoenosis is one of the five degree-4 nodes measured on SPHERE_ADJ.
  console.log('spawned:', await page.eval('window.__artFireStrimer("biocoenosis")'));

  for (let f = 0; f <= 12; f++) {
    await page.pump(1);
    const s = JSON.parse(await page.eval('JSON.stringify(window.__artStrimerState())'));
    console.log('f' + String(f).padStart(2), 'count', s.count, 'inst', s.instances,
      s.packets.map(p => p.dst + '@' + p.u + (p.phase ? ' ping' + p.ping : '')).join('  '));
  }
} finally { await page.close(); }
```

Expected: `spawned: 4`. Then `count` 4 with `inst` 8 while travelling, and `u`
rising on an **ease-out curve, not in equal steps** — at sixths of a packet's
duration it reads roughly **0.42, 0.70, 0.88, 0.96, 1.00**. Then packets flip
to `phase 1` with `ping` counting 4 → 0, `inst` drops to `count`, and `count`
returns to 0.

**If `u` advances in equal 0.167 increments, `easeOutCubic` is not being
applied.** If it only advances when you pump twice, something is reading a
frame count instead of the clock — the /SCENT bug, and the one failure mode
this design exists to avoid.

- [ ] **Step 9: Run the suite and lint**

Run: `npm test` → **1338 passing**. Run: `npm run lint` → 0 errors, ≤153 warnings.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/views/ArtTab.jsx src/terminal/hooks/useSomaGraph.js
git commit -m "feat(art): the strimer pool, its trigger, and the arrival it now causes

fireNode's neighbour bump used to fire instantly for every neighbour at once,
so the target vertex was already lit ~100ms before the crack reached it and
the effect decorated a confirmation that had already happened. The bump now
lands when the packet does. The option defaults to true, so every other
caller -- terminal run, the ambient awakening fires -- is unmoved.

Suppressing the bump and spawning the wavefront are ONE flag: a caller that
suppressed without spawning would silently stop the graph propagating.

No pixels yet; provable from window.__artStrimerState.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The renderer

**Files:**
- Create: `src/terminal/art/SphereStrimer.jsx`
- Modify: `src/terminal/art/SphereComposite.jsx:479` (props), `:545` (mount)
- Modify: `src/terminal/views/ArtTab.jsx:3716-3722` (pass the ref)

**Interfaces:**
- Consumes: `strimerRef` from Task 2, `STRIMER_STRIDE` from Task 1.
- Produces: `<SphereStrimer strimerRef={...} />`, default-exported from `SphereStrimer.jsx`.

- [ ] **Step 1: Create the renderer**

Create `src/terminal/art/SphereStrimer.jsx`:

```jsx
// SphereStrimer.jsx — the click-triggered wavefront, on the one layer in this
// pipeline that does not accumulate.
//
// ── WHY IT IS HERE AND NOT ON THE ADDITIVE EDGE MESH ──────────────────────
//
// BackdropPass renders the backdrop and BOTH edge meshes into `trail.write`,
// after renderTrailFade — so anything drawn there feeds back at
// survival = 1 - m. MEASURED: 0.21-0.24 normal, 0.48-0.59 immersive. The knee
// then compresses the decaying residual so it reads FLAT: a stack-3 head held
// 98 / 96 / 87% of peak for three frames after it stopped being drawn, where a
// stack-1 head fell 73 / 41 / 22%. On that layer, head brightness IS tail
// length in exhibit mode, and "zero lingering residual wash" is unreachable at
// any parameter.
//
// This mesh is in r3f's own scene graph, so it is NOT in that path at all.
// MEASURED on the same probe: lift fell 0.80 -> 0.020 (normal) and
// 0.78 -> 0.027 (immersive) on the single frame after the packet stopped —
// both at the simulation's own noise floor, both modes identical. That is the
// entire reason this file exists.
//
// Three things about the mount are load-bearing:
//   - It is INSIDE <EffectComposer>'s input, so the packet gets Bloom and then
//     Knee exactly as everything else does.
//   - That input is HalfFloatType (the @react-three/postprocessing 3.0.4
//     default), so gain above 1.0 survives to the bright-extract. MEASURED
//     peak 0.907 / 0.967 / 0.979 at gain 1 / 2.4 / 4.
//   - renderOrder 10 with depthTest off. SourceQuad is opaque at the default
//     renderOrder 0, and without an explicit order three's opaque-first sort
//     could place this either side of it.
//
// THE COST, ACCEPTED KNOWINGLY: this layer is over the 2D canvas, so a packet
// passes IN FRONT OF node glyphs rather than behind them.
//
// ── THE BUFFER HOLDS LINEAR COLOUR ────────────────────────────────────────
// SourceQuad emits srgbToLinear(min(srgb,1)) + max(srgb-1,0), so everything
// downstream is linear working space — unlike the additive edge mesh, which
// writes sRGB bytes into an sRGB-conceptual accumulator. The colours in the
// instance buffer are ALREADY LINEAR; artStrimer.hslToLinearRgb does that
// conversion once, on the CPU, at the write site.

import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { STRIMER_STRIDE, STRIMER_MAX_PACKETS } from './artStrimer';

const STRIMER_VERT = /* glsl */`
  attribute vec2  aHead;
  attribute vec2  aTail;
  attribute vec2  aStyle;    // x = width px, y = gain (LINEAR, may exceed 1)
  attribute vec3  aColor;    // the tail colour, LINEAR
  attribute float aProfile;  // 0 packet, 1 rail, 2 ping

  uniform vec2 uResolution;  // CSS px, matching the coordinates the loop wrote

  varying vec2  vP;
  varying vec2  vHead;
  varying vec2  vTail;
  varying float vWidth;
  varying float vGain;
  varying float vProfile;
  varying vec3  vColor;

  void main() {
    vec2 d = aTail - aHead;
    float L = length(d);
    // A PING has head == tail, so d is the zero vector. Falling back to a
    // fixed axis keeps dir finite; the fragment never reads it in that case
    // because h clamps to 0 and the distance becomes plain radial.
    vec2 dir = L > 1e-6 ? d / L : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Pad for the gaussian's reach. exp(-2(d/w)^2) drops below 1/255 at
    // d = 1.66w, the same reach the edge layer's GLOW_REACH uses; +1 covers
    // the antialiasing shoulder.
    float pad = aStyle.x * 1.75 + 1.0;

    // position.xy is PlaneGeometry(1,1), i.e. [-0.5, 0.5]. Map x along the
    // capsule from -pad to L+pad, and y across it from -pad to +pad.
    float s = (position.x + 0.5) * (L + 2.0 * pad) - pad;
    float t = position.y * 2.0 * pad;
    vec2 p = aHead + dir * s + nrm * t;

    vP = p; vHead = aHead; vTail = aTail;
    vWidth = aStyle.x; vGain = aStyle.y; vProfile = aProfile; vColor = aColor;

    // Clip space straight from CSS px. The CPU has already projected, so the
    // camera takes no part in this geometry — the same contract EDGE_VERT
    // keeps, and why the orthographic camera's existence is irrelevant here.
    gl_Position = vec4(p.x / uResolution.x * 2.0 - 1.0,
                       1.0 - p.y / uResolution.y * 2.0,
                       0.0, 1.0);
  }
`;

const STRIMER_FRAG = /* glsl */`
  precision highp float;

  varying vec2  vP;
  varying vec2  vHead;
  varying vec2  vTail;
  varying float vWidth;
  varying float vGain;
  varying float vProfile;
  varying vec3  vColor;

  void main() {
    if (vGain <= 0.0) discard;

    vec2 pa = vP - vHead, ba = vTail - vHead;
    // LOAD-BEARING, not defensive: a ping has ba = 0, and this is what turns
    // the capsule into a disc instead of a division by zero. h clamps to 0 and
    // d becomes the plain radial distance from the centre.
    float bb = max(dot(ba, ba), 1e-6);
    float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);   // 0 at the head, 1 at the tail
    float d = length(pa - ba * h);

    // The same exp(-2(d/w)^2) the edge shader's glow uses, so the two read as
    // one family of light rather than two.
    float w = max(vWidth, 1e-3);
    float cross = exp(-2.0 * (d / w) * (d / w));

    // Branching is safe here: vProfile is constant across an instance, so a
    // warp never diverges on it, and nothing below reads a derivative. (The
    // edge shader has to use mix() instead precisely because it does.)
    float along = vProfile < 0.5 ? pow(1.0 - h, 2.5) : 1.0;

    // WHITE AT THE HEAD, and this is forced rather than a taste call: the knee
    // is a max-channel Reinhard, so it scales all three channels by one factor
    // and can never whiten a saturated colour. A cyan head at (0, 2.4, 2.4)
    // exits as (0, 0.927, 0.927) — bright cyan, never white.
    vec3 col = vProfile < 0.5
      ? mix(vColor, vec3(1.0), pow(1.0 - h, 6.0))
      : (vProfile < 1.5 ? vColor : vec3(1.0));

    // Alpha is written 0 and the material takes Zero/One for it. The screen
    // pass wrote full alpha and the vignette and knee read it; an additive
    // layer that also accumulated alpha would quietly change what they see.
    gl_FragColor = vec4(col * (vGain * along * cross), 0.0);
  }
`;

export default function SphereStrimer({ strimerRef }) {
  const size = useThree(s => s.size);
  const meshRef = useRef(null);

  // Built once. `data` is the draw loop's own Float32Array and becomes the
  // InterleavedBuffer's backing store, so the sync below never copies — it
  // only flags the written range dirty. Reallocating it would silently unbind
  // the writer from the thing the GPU reads.
  const { geometry, material, buffer } = useMemo(() => {
    const data = strimerRef?.current?.data
      ?? new Float32Array(STRIMER_MAX_PACKETS * 2 * STRIMER_STRIDE);
    const buf = new THREE.InstancedInterleavedBuffer(data, STRIMER_STRIDE, 1);
    buf.setUsage(THREE.DynamicDrawUsage);

    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    quad.dispose();
    geo.setAttribute('aHead', new THREE.InterleavedBufferAttribute(buf, 2, 0));
    geo.setAttribute('aTail', new THREE.InterleavedBufferAttribute(buf, 2, 2));
    geo.setAttribute('aStyle', new THREE.InterleavedBufferAttribute(buf, 2, 4));
    geo.setAttribute('aColor', new THREE.InterleavedBufferAttribute(buf, 3, 6));
    geo.setAttribute('aProfile', new THREE.InterleavedBufferAttribute(buf, 1, 9));
    geo.instanceCount = 0;
    // The quad is written in clip space from uResolution, so three's own
    // bounding sphere is meaningless and would cull the whole mesh.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uResolution: { value: new THREE.Vector2(1, 1) } },
      vertexShader: STRIMER_VERT,
      fragmentShader: STRIMER_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      toneMapped: false,
    });

    return { geometry: geo, material: mat, buffer: buf };
  }, [strimerRef]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(() => {
    const st = strimerRef?.current;
    if (!st) return;
    const n = Math.min(st.instances, st.cap * 2);
    geometry.instanceCount = n;
    // addUpdateRange + needsUpdate, exactly as syncEdgeLayer does it. three
    // 0.183 replaced the old `updateRange = {offset, count}` property, and
    // setting that instead uploads nothing while everything else looks fine.
    if (n > 0) {
      buffer.addUpdateRange(0, n * STRIMER_STRIDE);
      buffer.needsUpdate = true;
    }
    // Skip the draw entirely when the layer is idle, as the edge layers do.
    if (meshRef.current) meshRef.current.visible = n > 0;
    // CSS px, published WITH the coordinates by the draw loop rather than
    // measured here — r3f's own `size` comes from a ResizeObserver documented
    // in SphereComposite as getting stuck on this page, and a stale resolution
    // rescales absolute pixel coordinates about the origin.
    material.uniforms.uResolution.value.set(
      st.w || size.width, st.h || size.height);
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={10}
      geometry={geometry} material={material} />
  );
}
```

- [ ] **Step 2: Mount it**

In `src/terminal/art/SphereComposite.jsx`, add the import beside the others:

```js
import SphereStrimer from './SphereStrimer';
```

Change the component signature (`:479`) to accept the ref:

```js
export default function SphereComposite({ sourceRef, immersive, onAdvanceReady, bgStateRef, edgeGLRef, addGLRef, strimerRef }) {
```

and add the mount immediately after `<SourceQuad ... />` (`:545`):

```jsx
        {/* The strimer. AFTER SourceQuad and BEFORE the composer: inside the
            composer's input so it gets Bloom and Knee, and outside the trail
            accumulator so it leaves zero residual. See SphereStrimer.jsx. */}
        <SphereStrimer strimerRef={strimerRef} />
```

In `src/terminal/views/ArtTab.jsx`, add `strimerRef={strimerRef}` to the `<SphereComposite>` props (`:3716-3722`).

- [ ] **Step 3: Verify the pixels against the probe's own frames**

Run: `node scripts/_s2layer.mjs --imm`
Then compare its `lookbook/layer/imm-g2p4-f02.png` against a frame of the real implementation at the same offset.

The probe's capsule and this shader share their arithmetic, so a packet at the same `u` on the same edge must look the same to the eye. What will differ legitimately: the real one has a **rail** under it, which the probe did not draw.

Expected: a white head with a cyan-to-cluster-hue tail along the wire, a dim rail on the full edge, and **nothing at all** on the frame after arrival.

- [ ] **Step 4: Check the console**

The rig prints console errors per cell. Expected: **0**. A `GL_INVALID_OPERATION` here means an attribute size or offset disagrees with `STRIMER_STRIDE`.

- [ ] **Step 5: Run the suite and lint**

Run: `npm test` → **1338 passing**. Run: `npm run lint` → 0 errors, ≤153 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/SphereStrimer.jsx src/terminal/art/SphereComposite.jsx src/terminal/views/ArtTab.jsx
git commit -m "feat(art): the strimer renderer, on the layer that does not accumulate

Measured on a throwaway probe before this was written: on the additive edge
mesh a stack-3 head held 98/96/87% of peak for three frames after it stopped
being drawn, because the knee compresses the decaying residual flat -- so head
brightness IS tail length in immersive there. In r3f's scene graph the same
packet falls 0.78 -> 0.027 in ONE frame, both modes identical.

Three profiles on one capsule: the packet, the rail under it, and a ping whose
head == tail, which the same arithmetic renders as a disc.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: The capture rig

**Files:**
- Create: `scripts/_s3strimer.mjs`

**Interfaces:**
- Consumes: `window.__artStrimerState` from Task 2, the renderer from Task 3.
- Produces: `lookbook/strimer/` frames and `report.json`; the observed chord distribution that sets `STRIMER_MS_PER_UNIT`.

- [ ] **Step 1: Write the rig**

Create `scripts/_s3strimer.mjs`. Copy the launch, world-pinning, immersive
toggle, canvas-rect read and `profileAlong`/`describe`/`ascii` blocks from
`scripts/_s2layer.mjs` **verbatim** — they are correct, they were paid for, and
re-deriving them is how the two drift. Three differences:

1. **It patches nothing.** The feature is real now. Delete the
   `ART_PATCH` / `CMP_PATCH` constants and the whole `try/finally`
   patch-and-restore wrapper; keep the loop inside it.
2. **It fires a real node** through the app's own path, not a probe.
3. **It shoots `pump(1)` at offsets 0–8** and reads the strimer state at each.

The fire and the shot loop, replacing `_s2layer`'s `window.__strimer` block:

```js
        const basePath = `${OUT}/${tag}-base.png`;
        await page.screenshot({ path: basePath });

        // A degree-4 node, from the SPHERE_ADJ census of 2026-09-20. Fired
        // through the app's own handler rather than a hover-grid click, so
        // WHICH node fired is a fact about this script and not about where
        // the grid happened to land.
        const spawned = Number(await page.eval('window.__artFireStrimer("biocoenosis")'));
        if (!spawned) throw new Error('fired biocoenosis and got no packets');

        const shots = [];
        for (let f = 0; f <= 8; f++) {
          await page.pump(1);
          const path = `${OUT}/${tag}-f${String(f).padStart(2, '0')}.png`;
          await page.screenshot({ path });
          const st = JSON.parse(await page.eval(
            'JSON.stringify(window.__artStrimerState())'));
          shots.push({ f, path, count: st.count, instances: st.instances,
            us: st.packets.map(p => p.u), dsts: st.packets.map(p => p.dst) });
        }

        // THE ASSERTION THIS SCRIPT EXISTS FOR. A transient that has already
        // passed is not in the frame being graded: the old
        // LIVE_OFFSETS = [14, 26, 44] shoots long after a 6-frame packet has
        // landed, and grading an absent effect is the trap that cost the old
        // bloom sweep a whole session. Fail loudly rather than produce
        // confident frames of nothing.
        if (!shots.some(s => s.instances > 0)) {
          throw new Error(tag + ': NO STRIMER INSTANCES IN ANY FRAME'
            + ' — the capture missed the transient');
        }

        // The observed transit, which is what sets STRIMER_MS_PER_UNIT. Each
        // packet's duration is the frame it first reached u = 1, times the
        // harness frame of 1000/60 ms.
        const transit = {};
        for (let k = 0; k < spawned; k++) {
          const hit = shots.findIndex(s => (s.us[k] ?? 0) >= 1);
          transit[shots[0].dsts[k]] = hit < 0 ? null
            : +((hit + 1) * (1000 / 60)).toFixed(1);
        }
        console.log(tag, 'transit ms:', JSON.stringify(transit));
```

- [ ] **Step 2: Run it**

Run: `node scripts/_s3strimer.mjs`
Expected: 2 cells (normal, immersive), each printing 4 packets, `instances` = 8 while travelling, and frames in `lookbook/strimer/`.

- [ ] **Step 3: Look at the frames**

This is the gate. `artCompare` passed the entire bloom dial move 21/21; it cannot be the verdict here either.

Check: the packet reads as a continuous crack and **not** as beads; the head is white and the tail carries the cluster hue; the rail makes it read as current in a trace rather than a comet in the dark; the frame after arrival is clean.

- [ ] **Step 4: Set the dial from the frames**

Report the observed transit durations to the author with the frames, and set `STRIMER_MS_PER_UNIT` on his call. Sweep it **together with** `HEAD_GAIN` — measured, they are not orthogonal: span grew 0.114 → 0.139 → 0.165 across gains 1 → 2.4 → 4.

- [ ] **Step 5: Commit**

```bash
git add scripts/_s3strimer.mjs
git commit -m "test(art): a capture rig that can actually catch the transient

pump(1) at offsets 0-8, and it FAILS LOUDLY if no frame contains a strimer
instance. The existing LIVE_OFFSETS = [14, 26, 44] shoots long after a 6-frame
packet has landed, and a wavefront that has already passed is not in the frame
being graded -- the trap that cost the old bloom sweep a whole session.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Certification, and the claim worth being right about

**Files:** none modified. This task produces a report.

- [ ] **Step 1: Test the no-re-base claim FIRST**

Because this layer leaves zero residual after one frame, any frame shot ≥2 frames past arrival is identical to the pre-click frame — and every existing capture state shoots far later (`artBaseline` waits 20–24 frames for the pulse rings; `_a3bloom --live` uses 14/26/44).

Run: `node scripts/artNull.mjs` (5 sets)
Run: `node scripts/artCompare.mjs` against `baseline/art-sphere-phase2-bloom-dial-certified`

Expected: 21/21 ADMISSIBLE, no cell moved.

**If that holds, no re-base is owed** and `d69ce75`'s attribution chain stays intact. Record it.

- [ ] **Step 2: If any cell DID move, find out which and why before re-basing**

A moved cell means some capture state does catch the transient. Identify it, confirm from its frames that the strimer is what changed, and only then re-base — **once**, and only after the dials in Task 4 are settled. Re-basing twice is how attribution is lost.

- [ ] **Step 3: Read artInk correctly**

Run: `node scripts/artInk.mjs`
Read `lit` and `meanLit` beside every ratio, never the ratio alone. A ratio of sums cannot see a redistribution, which is exactly the shape a travelling bright head has.

- [ ] **Step 4: Full suite, lint, and a clean tree**

Run: `npm test` → **1338 passing**, 0 failing.
Run: `npm run lint` → 0 errors, ≤153 warnings.
Run: `git status` → clean. If `src/` shows modified files, a probe's restore was beaten by a hard kill; `git checkout -- src/terminal/views/ArtTab.jsx src/terminal/art/SphereComposite.jsx`.

- [ ] **Step 5: Report to the author and stop**

Hand over: the frames, the dial recommendation, whether the reference moved, and the test/lint numbers.

**Do not merge. Do not push.** `main` is untouched and behind `origin/main`; fetch before any merge. Verification approval is not push consent — ask.

---

## Out of scope

- **The standing wave** on resonance-adjacent straight edges. Its own spec.
- **The dither** (design 2.4/2.5). Deliberately unbuilt.
- **`BLOOM` mode-dependence.** Measured and killed.
- **The `ADJ` / `SPHERE_ADJ` disagreement** in the label cascade (spec §10). Noted, not touched.
- **The first-touch crescendo** at `ArtTab.jsx:3030-3034` bumps neighbours `+0.5` once per session, outside `fireNode`. It is a deliberate one-time flourish rather than the per-click confirmation, so it stays. Expect the very first click of a session to light neighbours slightly ahead of its packets.
