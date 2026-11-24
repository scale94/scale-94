// observerEyeHandle.test.jsx — the imperative kick/detonate handle, the new
// uniforms' defaults and the reduced-motion hold.
//
// Fake GL + fake clock exactly as glParity's driveFrames does it
// (src/terminal/gl/__tests__/driveFrames.js): rAF, performance.now and
// setTimeout all advance off one clock, and installRecordingGL logs every
// uniform push with a `uniform:<program>:<name>` handle tag.

import React, { createRef, Profiler } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ObserverEye from '../ObserverEye';
import { KICK } from '../observerEyeShader';
import { REACTIONS } from '../eyeReactions';

const hostless = vi.hoisted(() => ({ on: false }));
vi.mock('../../gl/glHost', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createShaderHost: (...args) => (hostless.on ? null : real.createShaderHost(...args)),
  };
});

const FRAME_MS = 16;
const NEW_UNIFORMS = ['u_core', 'u_orbit', 'u_shimmer', 'u_thread', 'u_turb', 'u_kick', 'u_kickKind', 'u_kickDir'];
// u_phase is not in NEW_UNIFORMS: it is the integrated swirl phase, non-zero
// by design whenever the eye moves (v1's u_t*u_speed).
const asVec3 = (c) => Array.from(new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]));

let rec;
let originalMatchMedia;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance',
             'setTimeout', 'clearTimeout', 'Date'],
  });
  rec = installRecordingGL({ version: 1 });
  originalMatchMedia = window.matchMedia;
});
afterEach(() => {
  cleanup();
  rec.restore();
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
  hostless.on = false;
});

// Every uniform push in log order: { name, value, at } where `at` is the
// index of the draw it belongs to.
function pushes(from = 0) {
  const out = [];
  let draw = 0;
  rec.log.slice(from).forEach((e) => {
    if (e[0] === 'drawArrays') { draw++; return; }
    if (typeof e[0] === 'string' && e[0].startsWith('uniform') && typeof e[1] === 'string') {
      out.push({ name: e[1].split(':').pop(), value: e[2], draw });
    }
  });
  return out;
}
const valuesOf = (name, from = 0) => pushes(from).filter((p) => p.name === name).map((p) => p.value);
const drawCount = (from = 0) => rec.log.slice(from).filter((e) => e[0] === 'drawArrays').length;

// Advance n frames; returns one record per frame: { t (ms since the call to
// frames()), u: { name: last pushed value } }.
function frames(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const from = rec.log.length;
    vi.advanceTimersByTime(FRAME_MS);
    const u = {};
    for (const p of pushes(from)) u[p.name] = p.value;
    out.push({ t: i * FRAME_MS, u });
  }
  return out;
}

describe('ObserverEye imperative handle', () => {
  it('kick_writes_uniforms_without_render', () => {
    const ref = createRef();
    let commits = 0;
    render(
      <Profiler id="eye" onRender={() => { commits++; }}>
        <ObserverEye ref={ref} size={64} />
      </Profiler>
    );
    frames(3);
    const before = commits;
    ref.current.kick({ kind: KICK.merge, tint: [217, 70, 239], durationMs: 1100 });
    const f = frames(5);
    expect(f.some((x) => x.u.u_kick > 0)).toBe(true);
    expect(f.every((x) => x.u.u_kickKind === 3)).toBe(true);
    expect(f.every((x) => x.u.u_kickDir === 1)).toBe(true);
    // the hue rides the envelope: c0 has left the resting silver
    expect(f[4].u.c0).not.toEqual(asVec3([210, 220, 232]));
    expect(commits).toBe(before);
  });

  it('kick_decays_to_zero', () => {
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(2);
    ref.current.kick({ kind: KICK.ring, tint: [255, 200, 80], durationMs: 1100, strength: 0.8 });
    const f = frames(Math.ceil((1100 + 200) / FRAME_MS));
    const k = f.map((x) => x.u.u_kick);
    expect(Math.max(...k)).toBeLessThanOrEqual(0.8 + 1e-6);
    expect(Math.max(...k)).toBeGreaterThan(0.7);
    // attack ~120 ms, then monotone decay
    const peakAt = k.indexOf(Math.max(...k));
    expect(f[peakAt].t).toBeGreaterThanOrEqual(112);
    expect(f[peakAt].t).toBeLessThanOrEqual(160);
    for (let i = peakAt + 1; i < k.length; i++) expect(k[i]).toBeLessThanOrEqual(k[i - 1]);
    expect(k[k.length - 1]).toBe(0);
    expect(f[f.length - 1].u.u_kickKind).toBe(0);
  });

  it('detonate_runs_crescendo_phases', () => {
    const ref = createRef();
    const { rerender } = render(<ObserverEye ref={ref} state="resting" size={64} />);
    frames(2);
    rerender(<ObserverEye ref={ref} state="charging" size={64} />);
    const charging = frames(60).map((x) => x.u.u_core);
    expect(charging[charging.length - 1]).toBeGreaterThan(charging[0] + 0.3);
    for (let i = 1; i < charging.length; i++) expect(charging[i]).toBeGreaterThanOrEqual(charging[i - 1]);

    ref.current.detonate();
    act(() => { rerender(<ObserverEye ref={ref} state="resting" thread={1} size={64} />); });
    const f = frames(Math.ceil(5700 / FRAME_MS));
    const at = (ms) => f.find((x) => x.t >= ms).u;

    // implosion: the core falls to a point by 250 ms
    expect(at(250).u_core).toBeLessThanOrEqual(0.01);
    expect(f[0].u.u_core).toBeGreaterThan(at(250).u_core);
    // detonation: turbulence peaks
    const turbMid = f.filter((x) => x.t >= 250 && x.t <= 600).map((x) => x.u.u_turb);
    expect(Math.max(...turbMid)).toBeGreaterThanOrEqual(0.9);
    // a white-gold ring flash fires in the detonation window
    const ring = f.filter((x) => x.t >= 250 && x.t <= 600);
    expect(Math.max(...ring.map((x) => x.u.u_kick))).toBeGreaterThan(0.9);
    expect(ring.find((x) => x.u.u_kick > 0.9).u.u_kickKind).toBe(KICK.ring);
    // storm: the gaze shakes, bounded by ±0.03
    const storm = f.filter((x) => x.t >= 700 && x.t <= 2500).map((x) => x.u.u_gaze);
    expect(storm.some((g) => Math.abs(g[0]) > 0.005)).toBe(true);
    expect(storm.every((g) => Math.abs(g[0]) <= 0.0301 && Math.abs(g[1]) <= 0.0301)).toBe(true);
    // settle: back to baseline
    expect(at(5600).u_core).toBeCloseTo(0, 2);
    expect(at(5600).u_turb).toBeCloseTo(0, 2);
    expect(f[f.length - 1].u.u_turb).toBe(0);
    expect(f[f.length - 1].u.u_kick).toBe(0);
    expect(f[f.length - 1].u.u_thread).toBeGreaterThan(0.99);
  });

  it('phase_is_uptime_independent', () => {
    // The swirl phase is integrated (speed·dt), not u_t·speed, so the same
    // detonation advances it by the same amount 5 s or 1 h after load.
    // Nothing is mounted while the clock jumps, so no frames are run.
    const advanceOverDetonation = (mountAtMs) => {
      vi.advanceTimersByTime(mountAtMs - performance.now());
      const ref = createRef();
      const { unmount } = render(<ObserverEye ref={ref} state="aether" size={64} />);
      frames(60);
      const before = valuesOf('u_phase').at(-1);
      ref.current.detonate();
      frames(Math.ceil(5700 / FRAME_MS));
      const after = valuesOf('u_phase').at(-1);
      unmount();
      rec.log.length = 0;
      return { start: performance.now(), advance: after - before };
    };
    const early = advanceOverDetonation(4000);
    const late = advanceOverDetonation(3599000);
    expect(late.start).toBeGreaterThan(3600000);
    expect(early.advance).toBeGreaterThan(0.5);   // non-vacuous: the storm really spins
    expect(Math.abs(late.advance - early.advance) / early.advance).toBeLessThan(0.01);
  });

  it('return_to_silver_back_spins_uptime_independently', () => {
    // Leaving a coloured state for silver throws the swirl into a reverse coast
    // (the CDJ back-spin the u_t*u_speed bug used to make by accident), then it
    // resumes forward. Same impulse 4 s or 1 h after load.
    const backspin = (mountAtMs) => {
      vi.advanceTimersByTime(mountAtMs - performance.now());
      const { rerender, unmount } = render(<ObserverEye state="leaning" tint={[255, 120, 40]} size={64} />);
      frames(90);
      const mark = rec.log.length;
      act(() => { rerender(<ObserverEye state="resting" size={64} />); });
      frames(180);
      const ph = valuesOf('u_phase', mark);
      unmount();
      rec.log.length = 0;
      const d = ph.slice(1).map((p, i) => p - ph[i]);
      const reverse = d.filter((x) => x < 0).reduce((a, b) => a + b, 0);
      return { reverse, endsForward: d.slice(-10).every((x) => x > 0) };
    };
    const early = backspin(4000);
    const late = backspin(3599000);
    expect(early.reverse).toBeLessThan(-2);           // a real turn backwards, not a flicker
    expect(early.reverse).toBeGreaterThan(-6);        // controlled: about one turn at most
    expect(early.endsForward).toBe(true);
    expect(Math.abs(late.reverse - early.reverse)).toBeLessThan(0.02);
  });

  it('no_back_spin_without_a_colour_to_leave', () => {
    const { rerender } = render(<ObserverEye state="resting" size={64} />);
    frames(30);
    const mark = rec.log.length;
    act(() => { rerender(<ObserverEye state="aether" size={64} />); });
    frames(60);
    const ph = valuesOf('u_phase', mark);
    expect(ph.slice(1).every((p, i) => p >= ph[i])).toBe(true);
  });

  it('tinted_kick_shows_over_silver_then_back_spins', () => {
    // At rest u_irid = 1 replaces the nebula outright, so a kick's hue was invisible.
    // A tinted kick now steps silver aside by its level, and its unwind back-spins.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(30);
    const mark = rec.log.length;
    ref.current.kick({ kind: KICK.ring, tint: [239, 68, 68], durationMs: 1400 });
    const f = frames(Math.ceil(1600 / FRAME_MS));
    expect(Math.min(...f.map((x) => x.u.u_irid))).toBeLessThan(0.05);
    expect(f.at(-1).u.u_irid).toBeGreaterThan(0.99);
    const ph = valuesOf('u_phase', mark);
    const reverse = ph.slice(1).map((p, i) => p - ph[i]).filter((d) => d < 0).reduce((a, b) => a + b, 0);
    expect(reverse).toBeLessThan(-1.5);
  });

  it('untinted_kick_keeps_silver', () => {
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(30);
    ref.current.kick({ kind: KICK.ring, durationMs: 900 });
    expect(frames(20).every((x) => x.u.u_irid > 0.99)).toBe(true);
  });

  it('keyed_kick_runs_its_timeline', () => {
    // A scripted full turn and a shape morph that peak mid-kick and return to 0.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    ref.current.kick({
      kind: KICK.flutter, durationMs: 1500, shape: 2,
      keys: [{ t: 0, turn: 0, shapeK: 0 }, { t: 0.5, turn: Math.PI * 2, shapeK: 1, shapeA: 0.5 }, { t: 1, turn: Math.PI * 2, shapeK: 0, shapeA: 1 }],
    });
    const f = frames(Math.ceil(1600 / FRAME_MS));
    const mid = f[Math.round(750 / FRAME_MS) - 1].u;
    expect(mid.u_shape).toBe(2);
    expect(mid.u_shapeK).toBeGreaterThan(0.95);
    expect(Math.max(...f.map((x) => x.u.u_shapeK))).toBeLessThanOrEqual(1);
    expect(f.at(-1).u.u_shapeK).toBe(0);
    expect(f.at(-1).u.u_shape).toBe(0);
  });

  it('keyed_turn_folds_into_phase_without_a_snap', () => {
    // A timeline that ends turned 6 rad must not jerk back 6 rad when it ends.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    const p0 = frames(1)[0].u.u_phase;
    ref.current.kick({ kind: KICK.miosis, durationMs: 1000, keys: [{ t: 0, turn: 0 }, { t: 0.5, turn: 6 }, { t: 1, turn: 6 }] });
    const f = frames(Math.ceil(1400 / FRAME_MS));
    const ph = f.map((x) => x.u.u_phase);
    const steps = ph.slice(1).map((p, i) => p - ph[i]);
    expect(Math.min(...steps)).toBeGreaterThan(-0.05);   // never a step backwards
    expect(ph.at(-1) - p0).toBeGreaterThan(6);
    expect(ph.at(-1) - p0).toBeLessThan(6.6);
  });

  it('curve_kick_runs_continuously_and_brakes_into_back_spin', () => {
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    const curve = (x, d) => Object.assign(d, { level: 1, turn: 8 * x * x, focus: 0, shapeK: 0, shapeA: 0, shapeB: 0, gazeX: 0, gazeY: 0, turb: 0 });
    ref.current.kick({ kind: KICK.inhale, tint: [56, 189, 248], durationMs: 1000, curve, backspinAt: 0.7 });
    const ph = frames(Math.ceil(1600 / FRAME_MS)).map((x) => x.u.u_phase);
    const d = ph.slice(1).map((p, i) => p - ph[i]);
    const brake = Math.round(700 / FRAME_MS);
    expect(Math.min(...d.slice(2, brake - 2))).toBeGreaterThan(0);          // winding up, no stall
    expect(Math.min(...d.slice(brake, brake + 15))).toBeLessThan(-0.05);   // the brake reverses
    expect(Math.min(...d.slice(-5))).toBeGreaterThan(-0.01);               // and coasts out
  });

  it('bsky_vortex_never_turns_backwards', () => {
    // The tornado coasts out forward: no reverse brake anywhere in the arc or after it.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    ref.current.kick({ tint: [56, 189, 248], dir: 1, ...REACTIONS['bsky.trend'] });
    const ph = frames(Math.ceil(2600 / FRAME_MS)).map((x) => x.u.u_phase);
    const d = ph.slice(1).map((p, i) => p - ph[i]);
    expect(Math.min(...d)).toBeGreaterThan(0);
    expect(Math.max(...d)).toBeGreaterThan(0.3);                          // it really winds up
  });

  it('tagged_release_fades_the_held_kick_gracefully', () => {
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    const curve = (x, d) => Object.assign(d, { level: 1, turn: 20 * x, focus: 0, shapeK: 1, shapeA: 0.3, shapeB: 0.5, shapeC: 0, gazeX: 0, gazeY: 0, turb: 0 });
    ref.current.kick({ kind: KICK.spiral, tint: [139, 92, 246], durationMs: 10000, shape: 4, curve, tag: 'acc' });
    expect(frames(30).at(-1).u.u_shapeK).toBeCloseTo(1, 5);
    ref.current.kick({ release: true, tag: 'other', durationMs: 500 });     // another family: ignored
    expect(frames(5).at(-1).u.u_shapeK).toBeCloseTo(1, 5);
    ref.current.kick({ release: true, tag: 'acc', durationMs: 500 });
    const f = frames(Math.ceil(700 / FRAME_MS));
    const K = f.map((x) => x.u.u_shapeK), ph = f.map((x) => x.u.u_phase);
    K.slice(1).forEach((k, i) => expect(k).toBeLessThanOrEqual(K[i] + 1e-9));   // fades, never pops
    expect(K[Math.round(250 / FRAME_MS)]).toBeGreaterThan(0.2);
    expect(K.at(-1)).toBe(0);
    const d = ph.slice(1).map((p, i) => p - ph[i]);
    expect(Math.min(...d)).toBeGreaterThan(-0.05);                          // the turn folds, no snap back
  });

  it('same_shape_rekick_holds_its_form', () => {
    // load -> run in quick succession: the chip does not melt to a disc for a frame.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    frames(10);
    const keys = [{ t: 0, shapeK: 0 }, { t: 0.3, shapeK: 1 }, { t: 0.8, shapeK: 1 }, { t: 1, shapeK: 0 }];
    ref.current.kick({ kind: KICK.miosis, durationMs: 1500, shape: 1, keys });
    expect(frames(Math.ceil(700 / FRAME_MS)).at(-1).u.u_shapeK).toBeGreaterThan(0.95);
    ref.current.kick({ kind: KICK.miosis, durationMs: 1500, shape: 1, keys });
    const after = frames(Math.ceil(500 / FRAME_MS)).map((x) => x.u.u_shapeK);
    expect(Math.min(...after)).toBeGreaterThan(0.6);
    // A different figure starts from its own nothing.
    ref.current.kick({ kind: KICK.flutter, durationMs: 1500, shape: 2, keys });
    expect(frames(1)[0].u.u_shapeK).toBeLessThan(0.05);
  });

  it('reduced_motion_hold_shows_its_colour', () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    const mark = rec.log.length;
    ref.current.kick({ kind: KICK.ring, tint: [239, 68, 68], durationMs: 900 });
    expect(valuesOf('u_irid', mark).at(-1)).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(valuesOf('u_irid').at(-1)).toBe(1);
  });

  it('handle_is_noop_without_host', () => {
    hostless.on = true;
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    expect(() => ref.current.kick({ kind: KICK.ring, tint: null, durationMs: 900 })).not.toThrow();
    expect(() => ref.current.detonate()).not.toThrow();
    expect(() => frames(4)).not.toThrow();
    cleanup();

    hostless.on = false;
    const ref2 = createRef();
    const { unmount } = render(<ObserverEye ref={ref2} size={64} />);
    const handle = ref2.current;
    unmount();
    expect(() => handle.kick({ kind: KICK.inhale, tint: [56, 189, 248], durationMs: 900 })).not.toThrow();
    expect(() => handle.detonate()).not.toThrow();
    expect(() => vi.advanceTimersByTime(6000)).not.toThrow();
  });

  it('defaults_push_zero', () => {
    render(<ObserverEye size={64} />);
    const f = frames(30);
    const draws = drawCount();
    expect(draws).toBe(31); // initialDraw + 30 frames
    for (const name of NEW_UNIFORMS) {
      const v = valuesOf(name);
      expect(v).toHaveLength(draws);
      expect(v.every((x) => x === 0)).toBe(true);
    }
    expect(f).toHaveLength(30);
  });

  it('reduced_motion_kick_holds_static', () => {
    window.matchMedia = () => ({ matches: true });
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    const mark = rec.log.length;
    ref.current.kick({ kind: KICK.ring, tint: [255, 90, 30], durationMs: 800 });
    expect(drawCount(mark)).toBe(1);
    expect(valuesOf('c0', mark)).toEqual([asVec3([255, 90, 30])]);
    expect(valuesOf('u_kick', mark)).toEqual([0]);

    vi.advanceTimersByTime(799);
    expect(drawCount(mark)).toBe(1);
    vi.advanceTimersByTime(2);
    expect(drawCount(mark)).toBe(2);
    expect(valuesOf('c0', mark)[1]).toEqual(asVec3([210, 220, 232]));
    expect(valuesOf('u_t').every((t) => t === 0)).toBe(true);
    expect(valuesOf('u_phase').every((p) => p === 0)).toBe(true);
  });

  it('a second tint (kernel run violet x lime) becomes the middle shade of the kick palette', () => {
    window.matchMedia = () => ({ matches: true });
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} />);
    const mark = rec.log.length;
    ref.current.kick({ kind: KICK.miosis, tint: [167, 139, 250], tint2: [122, 184, 0], durationMs: 800 });
    expect(valuesOf('c0', mark)).toEqual([asVec3([167, 139, 250])]);
    expect(valuesOf('c1', mark)).toEqual([asVec3([122, 184, 0])]);
  });

  it('reduced_motion_detonate_holds_flash_then_baseline', () => {
    window.matchMedia = () => ({ matches: true });
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} thread={1} />);
    const mark = rec.log.length;
    ref.current.detonate();
    expect(drawCount(mark)).toBe(1);
    expect(valuesOf('u_core', mark)[0]).toBeGreaterThan(1);
    vi.advanceTimersByTime(6000);
    expect(drawCount(mark)).toBe(2);
    expect(valuesOf('u_core', mark)[1]).toBe(0);
    expect(valuesOf('u_thread', mark)[1]).toBe(1);
    expect(valuesOf('c0', mark)[1]).toEqual(asVec3([210, 220, 232]));
    expect(valuesOf('u_t').every((t) => t === 0)).toBe(true);
    expect(valuesOf('u_phase').every((p) => p === 0)).toBe(true);
  });
});

describe('ObserverEye lean (D5 glance ease)', () => {
  const TINT = [56, 189, 248];
  const REST = [210, 220, 232];
  const mid = (a, b) => a.map((x, i) => (x + b[i]) / 2);
  const near = (got, want) => got.forEach((x, i) => expect(x).toBeCloseTo(want[i], 3));

  it('lean 0.5 pushes the colours, gaze and pulse halfway to the baseline', () => {
    render(<ObserverEye state="leaning" tint={TINT} gaze={[0.15, -0.04]} pulse baseState="resting" lean={0.5} size={64} />);
    const f = frames(240);
    const u = f.at(-1).u;
    near(u.c0, asVec3(mid(REST, TINT)));
    expect(u.u_pulse).toBeCloseTo(0.5, 3);
    near(u.u_gaze, [0.075, -0.02]);
  });

  it('lean 1 (the default) is the plain leaning look', () => {
    render(<ObserverEye state="leaning" tint={TINT} pulse baseState="resting" size={64} />);
    const u = frames(240).at(-1).u;
    near(u.c0, asVec3(TINT));
    expect(u.u_pulse).toBeCloseTo(1, 3);
  });

  it('getLean is read every frame, with no re-render', () => {
    let level = 0;
    let commits = 0;
    render(
      <Profiler id="eye" onRender={() => { commits++; }}>
        <ObserverEye state="leaning" tint={TINT} baseState="resting" getLean={() => level} size={64} />
      </Profiler>
    );
    near(frames(240).at(-1).u.c0, asVec3(REST));
    const before = commits;
    level = 1;
    near(frames(240).at(-1).u.c0, asVec3(TINT));
    expect(commits).toBe(before);
  });
});
