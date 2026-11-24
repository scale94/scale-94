// eyeDrive.test.jsx — the live channel: only `driven` eyes read it, every channel lets go
// after its hold, and releasing a palette that took the eye over back-spins it to silver.

import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ObserverEye from '../ObserverEye';
import { drivePalette, driveSpin, driveMood, release, HOLD_MS } from '../eyeDrive';

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
