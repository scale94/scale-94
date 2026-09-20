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

/**
 * The ping's life, on the CLOCK rather than on a frame count.
 *
 * Spec section 4 specifies it as 4 frames, and that is where this number comes
 * from — but a per-call decrement runs at double speed on a 120Hz display,
 * which is the /SCENT bug and the one failure mode this design exists to
 * avoid. Deriving ms from frames is exactly identical under the capture
 * harness, which advances performance.now() by FRAME_MS per __pump, and
 * correct on a display that is not 60Hz.
 */
export const PING_MS = PING_FRAMES * (1000 / 60);

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
    // Remaining ping life as a FRACTION in [0,1] — 1 the frame it arrives,
    // 0 when it is dead. The draw loop multiplies PING_GAIN by it directly.
    ping: new Float32Array(cap),
    // Absolute ms at which that ping dies. The clock, not a countdown.
    pingEnd: new Float64Array(cap),
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
  s.pingEnd[to] = s.pingEnd[from];
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
    state.pingEnd[i] = 0;
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
        state.pingEnd[i] = nowMs + PING_MS;
        state.ping[i] = 1;
        state.arrived[state.arrivedCount++] = i;
      } else {
        state.u[i] = easeOutCubic(t);
      }
    } else {
      // Time-based, exactly like the travel phase: two steps at the same clock
      // must leave the ping where one did.
      state.ping[i] = Math.max(0, (state.pingEnd[i] - nowMs) / PING_MS);
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
