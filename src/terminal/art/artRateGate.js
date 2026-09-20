// artRateGate.js — emission cadences, stepped on the clock instead of on draws.
//
// The sphere gated six of its emitters on a frame counter: `pFrame % 8 === 0`,
// `% 3`, `% 7`, `% 10`, `% 12`, `% 60`. None of those is a rate. Each one means
// "every Nth DRAW", so the artwork emits at 2x on a 120Hz phone and 6x on a
// 360Hz QD-OLED — the /SCENT collider defect, which this repo has now paid for
// three times: the collider itself, the standing comment the strimer carries in
// ArtTab, and the sphere's breath.
//
// ── A modulus gate is not a rate, in TWO senses ─────────────────────────────
//
// The first is the obvious one above. The second is what makes this more than
// a division: a modulus is a THRESHOLD, and a threshold crossed by a fractional
// step has to carry its remainder forward. At 360Hz one frame is a sixth of an
// authored frame, so a gate that asks "is a whole period's worth due?" and
// discards what is left over never fires at all. The accumulator here keeps the
// remainder (`acc -= period`, not `acc = 0`), which is what makes six 360Hz
// frames add up to exactly one authored frame rather than to nothing.
//
// ── The literals are kept, and divided against the frame they were authored
//    for ──────────────────────────────────────────────────────────────────────
//
// `period` stays the shipped 3, 7, 8, 10, 12, 60. Nothing is re-derived into a
// per-second rate, so 60fps is 1x BY CONSTRUCTION rather than by a constant
// someone has to check. This follows the breath fix (BREATH_PER_FRAME in
// artAwakening.js) deliberately: one pattern, one place to be wrong.

export const GATE_FRAME_MS = 1000 / 60;   // the frame every cadence was authored against

// dt policy, in ms, matching createFrameLoop's dtClamp (0.05s). A hidden tab
// parks rAF; without this the first frame back is billed the entire absence and
// crosses every threshold at once — something the frame counter could never do.
export const GATE_DT_CLAMP_MS = 50;

// ── Why a gate needs a tolerance and the breath did not ─────────────────────
//
// MEASURED, and NOT what the breath fix's ~1e-14 residue predicted. The capture
// harness advances `vnow += FRAME_MS` from VIRTUAL_START = 100000, so the
// timestamps live at a magnitude of 1e5 where a double's ulp is ~1.5e-11 ms.
// Summed dt telescopes that rounding: replaying the harness clock leaves the
// accumulator 1.4e-9 frames short of the integer by frame 5000, and 3.6e-7
// short by 500k.
//
// The breath could absorb that because an angle is CONTINUOUS. A gate is
// DISCRETE: a value a hair under its threshold does not fire a hair late, it
// fires a whole frame late. Measured with no tolerance, every one of the six
// cadences slipped one frame at around frame 2800 and stayed slipped — a
// visible, permanent phase shift in the reference images.
//
// 1e-6 frames is 17 NANOSECONDS of display time, which no panel can express,
// while sitting three orders of magnitude above the residue a capture can
// accumulate. It holds the frame-for-frame identity out to ~500k frames (about
// two and a half virtual hours, against captures of a few hundred frames), and
// past that the failure mode is a one-frame phase shift — the RATE stays exact.
export const GATE_EPSILON_FRAMES = 1e-6;

// ── The frame clock ─────────────────────────────────────────────────────────
//
// Converts wall time into the only unit the cadences are written in: authored
// 60fps frames. ONE clock is stepped per draw and its result handed to every
// gate, so six cadences can never disagree about when this frame is.

export function createFrameClock() {
  // `seeded` is an explicit flag, not `t`'s truthiness: under the capture
  // harness a legitimate timestamp of exactly 0 would read as "never seeded".
  // That trap is documented in createFrameLoop and cost the breath fix a
  // comment of its own; it is repeated here rather than rediscovered.
  return { t: 0, seeded: false };
}

/** Clears the seed so the NEXT step bills exactly one frame. Used by
 *  __artHarnessReset, which must not let a stamp taken during the real-timing
 *  boot be measured against the first virtualised frame. */
export function resetFrameClock(clock) {
  clock.t = 0;
  clock.seeded = false;
}

/** Advances `clock` to `nowMs` and returns the elapsed time in authored frames.
 *  An unseeded clock bills exactly one frame — never the gap back to mount. */
export function stepFrameClock(clock, nowMs = performance.now()) {
  const dtMs = clock.seeded
    // The lower clamp at 0 is not defensive noise: the harness snaps
    // performance.now() to a fixed VIRTUAL_START, which can land BEHIND the
    // real boot clock it replaces, and an unguarded dt would run the cadence
    // backwards on that one frame.
    ? Math.min(Math.max(nowMs - clock.t, 0), GATE_DT_CLAMP_MS)
    : GATE_FRAME_MS;
  clock.t = nowMs;
  clock.seeded = true;
  return dtMs / GATE_FRAME_MS;
}

// ── The gate ────────────────────────────────────────────────────────────────

/**
 * A single emission cadence.
 *
 * `primed` reproduces a counter read BEFORE it was incremented. Two of the six
 * sites did that — `stepAwakening(..., particleFrameRef.current, ...)` and the
 * reasoning push — so their first draw saw 0, and `0 % period === 0` fired
 * immediately. Starting the accumulator one frame short of the period makes the
 * first draw cross it, which is the difference between the genesis cascade
 * starting on frame 1 and starting a whole period late.
 */
export function createRateGate(period, { primed = false } = {}) {
  // `fires` is a DEV INSTRUMENT, and it is here rather than in the caller
  // because it is the only thing that can falsify this module in a real
  // browser. artCompare cannot: determinism.mjs virtualises the clock at
  // exactly 1000/60, so a capture is ALWAYS 60fps and is structurally blind to
  // refresh-rate dependence — it can confirm this change did not move the 60fps
  // frame, never that it fixed the bug. The rate has to be measured live, at
  // whatever the panel actually runs at, and that needs a count. Written but
  // never read by the artwork; __artCadenceState in ArtTab is its only reader.
  return { period, primed, acc: primed ? period - 1 : 0, fires: 0 };
}

/** Restores the constructed phase. __artHarnessReset zeroes everything that
 *  ACCRUES, and an accumulator carried across it would bring the real-timing
 *  boot into the capture — precisely the leak `particleFrameRef.current = 0`
 *  was there to close. */
export function resetRateGate(gate) {
  gate.acc = gate.primed ? gate.period - 1 : 0;
  // `fires` is deliberately NOT cleared. It is a monotonic instrument and its
  // only consumer takes DELTAS across a window; clearing it here would put a
  // harness reset inside a measurement and read as a cadence that stopped.
}

/**
 * Credits `dtFrames` and reports whether the cadence fires this frame.
 *
 * Fires AT MOST ONCE per call, deliberately. The clamp caps a frame at 3
 * authored frames and the shortest period is 3, so a second crossing is already
 * unreachable — but the cap is written rather than inferred, because two
 * emissions at one position and one instant is a burst, not a cadence, and the
 * argument that makes it unreachable is a property of constants that could
 * change. The subtraction also bounds `acc` by construction: it can never
 * exceed one clamped frame's credit, so a stall cannot bank.
 */
export function stepRateGate(gate, dtFrames) {
  gate.acc += dtFrames;
  if (gate.acc + GATE_EPSILON_FRAMES >= gate.period) {
    // `-= period`, never `= 0`: the remainder is what carries a fractional
    // frame forward. Zeroing here would quietly re-round every high-refresh
    // frame back down and reintroduce the rate error this module exists to fix.
    gate.acc -= gate.period;
    gate.fires++;      // DEV instrument only — see createRateGate
    return true;
  }
  return false;
}
