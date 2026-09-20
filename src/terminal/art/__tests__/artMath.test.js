// artMath.test.js — item 5b's two geometry helpers.
//
// `project()` returns focal / (focal + rz * sphereR), in which sphereR
// CANCELS. So the sphere's cage tracks the viewport and the ink — every line
// width and disc radius in the renderer, all of it authored in screen px and
// multiplied by that scale — does not. Measured at c302167: the cage grew
// 1.372x on the immersive toggle at 1520x900 while the median node disc went
// 0.985x and the median edge width 0.889x, i.e. 1.393x sparser; at 1920x1080,
// 1.757x sparser. `inkScale` is the factor that closes that gap.
//
// Two claims are worth a test rather than an argument.
//
// ONE: it is EXACTLY 1 in normal mode, which is what makes "no normal-mode
// pixel can move" a property of the code instead of a hope pinned on a
// capture. That holds only because normalCanvasHeight() is the same
// expression, on the same width, with the same Math.floor, as the one the
// ResizeObserver uses — which is why the observer now calls this function
// instead of carrying its own copy of the clamp.
//
// TWO: the normal-mode height is NOT a flat 580. It is 580 only above about
// 892 px wide; below that it is 0.65 of the width with a 360 floor. A literal
// 580 in the ink scale would scale the ink against a sphere a narrow window
// never draws, and the error runs the wrong way — it would UNDER-scale, by up
// to 1.5x at 600px. That case has its own test below.

import { describe, it, expect } from 'vitest';
import {
  normalCanvasHeight, inkScale, project, stepAutoRotation,
  NORMAL_H_K, NORMAL_H_MIN, NORMAL_H_MAX,
  AUTO_SPIN, ROT_DECAY_IDLE, ROT_DECAY_HOVER, ROT_HOVER_SPIN_K,
} from '../artMath';

// The ResizeObserver's own expression, transcribed from ArtTab at the time of
// writing. If this ever stops agreeing with normalCanvasHeight the test fails
// here rather than in a capture three hours later.
const observerHeight = (W) => Math.floor(Math.min(Math.max(W * 0.65, 360), 580));

describe('normalCanvasHeight', () => {
  it('agrees with the resize observer at every width that changes branch', () => {
    for (const w of [320, 360, 400, 553, 554, 555, 800, 891, 892, 893, 1000,
                     1280, 1520, 1920, 2560, 3840]) {
      expect(normalCanvasHeight(w)).toBe(observerHeight(w));
    }
  });

  it('pins at 580 only above the crossover, not everywhere', () => {
    // 580 / 0.65 = 892.3, so 892 is still on the ramp and 893 is pinned.
    expect(normalCanvasHeight(892)).toBe(579);
    expect(normalCanvasHeight(893)).toBe(NORMAL_H_MAX);
    expect(normalCanvasHeight(1520)).toBe(NORMAL_H_MAX);
    expect(normalCanvasHeight(3840)).toBe(NORMAL_H_MAX);
  });

  it('rides the width between the floor and the pin', () => {
    expect(normalCanvasHeight(800)).toBe(Math.floor(800 * NORMAL_H_K));
    expect(normalCanvasHeight(700)).toBe(455);
  });

  it('floors at 360 on a narrow window', () => {
    // 360 / 0.65 = 553.8 — below that the floor is what is drawn.
    expect(normalCanvasHeight(400)).toBe(NORMAL_H_MIN);
    expect(normalCanvasHeight(553)).toBe(NORMAL_H_MIN);
    expect(normalCanvasHeight(554)).toBe(360);
    expect(normalCanvasHeight(560)).toBe(364);
  });

  it('truncates rather than rounds, exactly as the observer does', () => {
    // 700.7 * 0.65 = 455.455 -> 455, and a round() would give the same; pick a
    // width where the two differ. 701.6 * 0.65 = 456.04 -> 456 either way, so
    // use the .5+ case: 703.9 * 0.65 = 457.535.
    expect(normalCanvasHeight(703.9)).toBe(457);
    expect(Math.round(703.9 * NORMAL_H_K)).toBe(458);
  });
});

describe('inkScale', () => {
  it('is EXACTLY 1 in normal mode, at every width branch', () => {
    // Not toBeCloseTo. An exact 1 is the whole claim: it is what lets the
    // consolidated capture read the immersive-off cells as bit-identical.
    for (const w of [320, 400, 553, 554, 700, 800, 892, 893, 1280, 1520,
                     1920, 2560, 3840]) {
      expect(inkScale(w, normalCanvasHeight(w))).toBe(1);
    }
  });

  it('reproduces the measured immersive law at the two reference scales', () => {
    // The immersive container is inset below the app header (dc397b2), so the
    // height is the viewport's minus the header, not the viewport's. These are
    // the heights behind the sphereR figures _a2scale reported at c302167:
    // 336.8 / 0.42 = 801.9 and 415.9 / 0.42 = 990.2, less the breath.
    expect(inkScale(1520, 800)).toBeCloseTo(800 / 580, 12);
    expect(inkScale(1920, 990)).toBeCloseTo(990 / 580, 12);
    // And those are the cage ratios the divergence has to cancel: 1.372 and
    // 1.692, as _a2scale measured them. The agreement is to ~1%, NOT to three
    // decimals, and the residual is the breath: sphereR carries a breathMod of
    // 1 +/- 0.008 to 0.015 that is sampled at two different phases across the
    // immersive toggle, while inkScale is a ratio the breath cancels out of.
    // A tighter bound here would be a test of when the reading was taken.
    const within = (got, want, frac) => Math.abs(got - want) / want < frac;
    expect(within(inkScale(1520, 800), 1.372, 0.015)).toBe(true);
    expect(within(inkScale(1920, 990), 1.692, 0.015)).toBe(true);
  });

  it('scales against the height the narrow window ACTUALLY draws, not 580', () => {
    // The latent bug a literal 580 would have shipped. At 600px wide the
    // normal canvas is 390 tall, so the normal sphere is driven by its HEIGHT
    // and the immersive one by its width: 600 / 390 = 1.538. A literal 580
    // would have compared against a 580-tall canvas this window never draws,
    // said 600 / 580 = 1.034, and under-inked by a third.
    expect(normalCanvasHeight(600)).toBe(390);
    expect(inkScale(600, 800)).toBeCloseTo(600 / 390, 12);
    expect(inkScale(600, 800)).not.toBeCloseTo(600 / 580, 3);
  });

  it('takes the SMALLER dimension on both sides, as sphereR does', () => {
    // sphereR is SPHERE_K * min(w, h). A landscape window wider than it is
    // tall is driven by its height; a portrait one by its width.
    expect(inkScale(1200, 600)).toBeCloseTo(600 / 580, 12);
    expect(inkScale(500, 900)).toBeCloseTo(500 / Math.min(500, 360), 12);
  });

  it('cancels SPHERE_K and the breath by construction', () => {
    // The point of writing it as a ratio: it equals sphereR_immersive /
    // sphereR_normal without naming either constant, so neither can drift it.
    const SPHERE_K = 0.42;
    for (const breath of [0.992, 1, 1.008]) {
      const sphereR = (w, h) => Math.min(w, h) * SPHERE_K * breath;
      const imm = sphereR(1520, 800);
      const nrm = sphereR(1520, normalCanvasHeight(1520));
      expect(inkScale(1520, 800)).toBeCloseTo(imm / nrm, 12);
    }
  });

  it('returns a usable number on a degenerate canvas', () => {
    // A zero-width container happens for a frame or two on mount. NaN here
    // would reach a Float32Array as a width and take the whole mesh with it.
    expect(inkScale(0, 0)).toBe(1);
    expect(Number.isFinite(inkScale(0, 900))).toBe(true);
    expect(Number.isFinite(inkScale(1520, 0))).toBe(true);
  });
});

describe('project — the independence item 5b exists because of', () => {
  it('returns a scale that does NOT move when the cage grows', () => {
    // Same rotated point, two sphere radii, focal held at its own FOCAL_K
    // multiple of each. The projected scale is identical, which is exactly why
    // the ink stayed put while the sphere grew.
    const FOCAL_K = 2.8;
    const small = project(0.3, 0.4, 0.5, 1520, 580, 245.5, 245.5 * FOCAL_K);
    const big   = project(0.3, 0.4, 0.5, 1520, 800, 336.8, 336.8 * FOCAL_K);
    expect(big.scale).toBeCloseTo(small.scale, 12);
    // The POSITION does move with it — the cage is genuinely bigger.
    expect(Math.abs(big.sx - 1520 / 2))
      .toBeGreaterThan(Math.abs(small.sx - 1520 / 2));
  });
});

// ── The sphere's own rotation is stepped on the CLOCK ────────────────────────
//
// `AUTO_SPIN` was commented "rad/frame" and `rotRef.current.ry += spin` ran once
// per DRAW, so the whole artwork turned at the display's refresh rate. MEASURED
// live at 283fps before the fix: 0.7083 rad/s against an authored 0.15, a full
// revolution in 8.9 SECONDS where it should take 41.9. On a 360Hz panel that is
// ~7s. This is the same defect as the particle cadences and the largest one by
// visible area — it is the entire picture, not a layer of it.
//
// `drag.vx *= 0.94` per draw is the same bug on the flick inertia: a throw
// stopped roughly six times too soon.
//
// THE ORDER IS NOT THE PARTICLE INTEGRATOR'S. `stepParticles` adds the raw
// velocity and THEN decays; this decays FIRST and adds the already-decayed
// value. So the drift factor is the particle one multiplied by one more decay,
// and dt = 1 must return `retain`, not 1. Getting that wrong is invisible at
// 60fps in a single frame and wrong everywhere else, which is exactly the class
// of error these tests exist to catch.
describe('stepAutoRotation — the spin and the flick, on wall time', () => {
  const idle = () => ({ active: false, lastX: 0, lastY: 0, vx: 0.02, vy: -0.03 });
  const rot0 = () => ({ rx: 0.18, ry: 0 });

  /** Advances `frames` steps of `dt` authored frames. */
  const run = (frames, dt, hovered = false) => {
    const rot = rot0(), drag = idle();
    for (let i = 0; i < frames; i++) stepAutoRotation(rot, drag, hovered, dt);
    return { ...rot, vx: drag.vx, vy: drag.vy };
  };

  it('is exactly the shipped arithmetic for dt = 1, idle', () => {
    const rot = rot0(), drag = idle();
    const vx0 = drag.vx, vy0 = drag.vy;
    stepAutoRotation(rot, drag, false, 1);
    expect(drag.vx).toBeCloseTo(vx0 * ROT_DECAY_IDLE, 15);
    expect(rot.rx).toBeCloseTo(0.18 + vx0 * ROT_DECAY_IDLE, 15);
    expect(rot.ry).toBeCloseTo(vy0 * ROT_DECAY_IDLE + AUTO_SPIN, 15);
  });

  it('is exactly the shipped arithmetic for dt = 1, hovered', () => {
    // Time dilation: a hovered sphere damps harder and barely spins, so the
    // user can actually hit a node. Both numbers have to survive the change.
    const rot = rot0(), drag = idle();
    const vy0 = drag.vy;
    stepAutoRotation(rot, drag, true, 1);
    expect(drag.vy).toBeCloseTo(vy0 * ROT_DECAY_HOVER, 15);
    expect(rot.ry).toBeCloseTo(vy0 * ROT_DECAY_HOVER + AUTO_SPIN * ROT_HOVER_SPIN_K, 15);
  });

  it('turns the same angle per wall second at 60, 120 and 360Hz', () => {
    // The headline. 0.0025 rad/frame x 60 = 0.15 rad/s — a revolution in 41.9s.
    const spinOnly = (frames, dt) => {
      const rot = rot0(), drag = { active: false, vx: 0, vy: 0 };
      for (let i = 0; i < frames; i++) stepAutoRotation(rot, drag, false, dt);
      return rot.ry;
    };
    expect(spinOnly(60,  1)).toBeCloseTo(0.15, 12);
    expect(spinOnly(120, 1 / 2)).toBeCloseTo(0.15, 12);
    expect(spinOnly(360, 1 / 6)).toBeCloseTo(0.15, 12);
    // 2*pi / 0.15 — the authored period, stated so a future change to AUTO_SPIN
    // has to look at what it costs in seconds.
    expect(2 * Math.PI / 0.15).toBeCloseTo(41.9, 1);
  });

  it('lets a flick coast the same distance and die at the same time', () => {
    const at60  = run(60,  1);
    const at360 = run(360, 1 / 6);
    expect(at360.vx).toBeCloseTo(at60.vx, 12);   // same speed left
    expect(at360.rx).toBeCloseTo(at60.rx, 12);   // same distance travelled
    expect(at360.ry).toBeCloseTo(at60.ry, 12);
  });

  it('composes exactly: N sub-steps equal one whole step', () => {
    const whole = run(1, 1);
    for (const n of [2, 3, 6, 10]) {
      const split = run(n, 1 / n);
      expect(split.rx).toBeCloseTo(whole.rx, 14);
      expect(split.vx).toBeCloseTo(whole.vx, 14);
      expect(split.ry).toBeCloseTo(whole.ry, 14);
    }
  });

  it('does nothing at all while the pointer is down', () => {
    // Dragging drives rotation from pointer deltas; this must not also run, or
    // the drag would carry an inertia it has not been given yet.
    const rot = rot0(), drag = { ...idle(), active: true };
    stepAutoRotation(rot, drag, false, 1);
    expect(rot).toEqual(rot0());
    expect(drag.vx).toBe(0.02);
  });

  it('does nothing for dt = 0', () => {
    const rot = rot0(), drag = idle();
    stepAutoRotation(rot, drag, false, 0);
    expect(rot).toEqual(rot0());
    expect(drag.vx).toBe(0.02);
  });
});
