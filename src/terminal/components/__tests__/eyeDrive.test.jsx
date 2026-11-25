// eyeDrive.test.jsx — the live channel: only `driven` eyes read it, every channel lets go
// after its hold, and releasing a palette that took the eye over back-spins it to silver.

import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ObserverEye from '../ObserverEye';
import { drivePalette, driveSpin, driveMood, release, HOLD_MS } from '../eyeDrive';
import { KICK } from '../observerEyeShader';
import { createRef } from 'react';

const FRAME_MS = 16;
let rec;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'] });
  rec = installRecordingGL({ version: 1 });
});
afterEach(() => { release(); cleanup(); rec.restore(); vi.useRealTimers(); });

function frames(n, each) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (each) each(i);
    const from = rec.log.length;
    vi.advanceTimersByTime(FRAME_MS);
    const u = {};
    rec.log.slice(from).forEach((e) => {
      if (typeof e[0] === 'string' && e[0].startsWith('uniform') && typeof e[1] === 'string') u[e[1].split(':').pop()] = e[2];
    });
    out.push(u);
  }
  return out;
}

const ORANGE = [255, 120, 40], TEAL = [20, 200, 180];

describe('eyeDrive', () => {
  it('undriven_eye_ignores_the_drive', () => {
    render(<ObserverEye size={64} />);
    const f = frames(40, () => { drivePalette(ORANGE, TEAL); driveSpin(6); });
    expect(f.every((u) => u.u_irid > 0.99)).toBe(true);
  });

  it('palette_takes_over_then_releases_with_back_spin', () => {
    render(<ObserverEye size={64} driven />);
    frames(10);
    const held = frames(40, () => drivePalette(ORANGE, TEAL));
    expect(held.at(-1).u_irid).toBeLessThan(0.02);
    Array.from(held.at(-1).c0).forEach((x, i) => expect(Math.abs(x * 255 - ORANGE[i])).toBeLessThan(8));
    const after = frames(Math.ceil((HOLD_MS + 2500) / FRAME_MS));
    expect(after.at(-1).u_irid).toBeGreaterThan(0.98);
    const ph = after.map((u) => u.u_phase);
    const reverse = ph.slice(1).map((p, i) => p - ph[i]).filter((d) => d < 0).reduce((a, b) => a + b, 0);
    expect(reverse).toBeLessThan(-2);
  });

  it('a_running_reaction_owns_the_unwind', () => {
    // /SOL: the hold's palette lapses while the snap's burst runs; no reverse brake under it.
    const ref = createRef();
    render(<ObserverEye ref={ref} size={64} driven />);
    frames(10);
    frames(40, () => drivePalette(ORANGE, TEAL));
    const curve = (x, d) => Object.assign(d, { level: 1, turn: 3 * x, focus: 0, shapeK: 0, shapeA: 0, shapeB: 0, shapeC: 0, gazeX: 0, gazeY: 0, turb: 0 });
    ref.current.kick({ kind: KICK.inhale, tint: ORANGE, durationMs: 1600, curve });
    const ph = frames(Math.ceil(1500 / FRAME_MS)).map((u) => u.u_phase);
    const d = ph.slice(1).map((p, i) => p - ph[i]);
    expect(Math.min(...d)).toBeGreaterThan(-0.01);
  });

  it('palette_weight_and_quiet_lapse', () => {
    render(<ObserverEye size={64} driven />);
    frames(10);
    const half = frames(60, () => drivePalette(ORANGE, TEAL, null, { w: 0.5, quiet: true }));
    expect(half.at(-1).u_irid).toBeGreaterThan(0.45);                    // half over silver
    expect(half.at(-1).u_irid).toBeLessThan(0.55);
    const full = frames(60, () => drivePalette(ORANGE, TEAL, null, { quiet: true }));
    const after = frames(Math.ceil((HOLD_MS + 2500) / FRAME_MS));
    expect(full.at(-1).u_irid).toBeLessThan(0.02);
    const ph = after.map((u) => u.u_phase);
    expect(Math.min(...ph.slice(1).map((p, i) => p - ph[i]))).toBeGreaterThan(-0.01);   // no back-spin
  });

  it('spin_adds_and_coasts_out', () => {
    render(<ObserverEye size={64} driven />);
    frames(10);
    const base = frames(30);
    const rate = (fs) => (fs.at(-1).u_phase - fs[0].u_phase) / ((fs.length - 1) * FRAME_MS / 1000);
    const spun = frames(30, () => driveSpin(8));
    expect(rate(spun.slice(15))).toBeGreaterThan(rate(base) + 5);
    frames(Math.ceil((HOLD_MS + 3000) / FRAME_MS));
    expect(Math.abs(rate(frames(30)) - rate(base))).toBeLessThan(0.05);
  });

  it('anger_contracts_calm_dilates', () => {
    render(<ObserverEye size={64} driven />);
    frames(30);
    const rest = frames(1)[0].u_focus;
    const angry = frames(40, () => driveMood(1)).at(-1).u_focus;
    release('mood');
    frames(80);
    const calm = frames(40, () => driveMood(-1)).at(-1).u_focus;
    expect(angry).toBeGreaterThan(rest + 0.35);
    expect(calm).toBeLessThanOrEqual(rest);
  });
});
