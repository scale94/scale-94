import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

const base = {
  hueA: 280, hueB: 120, selA: true, selB: true, massA: 0.3, massB: 0.6,
  beams: null, metrics: null, phaseStartedAt: 0, labelA: null, labelB: null,
};

describe('ColliderChamber under prefers-reduced-motion', () => {
  let rec;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    rec = installRecordingGL({ version: 2 });
  });
  afterEach(() => { rec.restore(); vi.unstubAllGlobals(); });

  it('paints exactly one static frame and never starts the loop', () => {
    render(<ColliderChamber phase="colliding" {...base} />);
    // Snap at 1300ms: the cage window is closed, so field + streaks only.
    const quads = rec.log.filter((e) => e[0] === 'drawArrays');
    const inst = rec.log.filter((e) => e[0] === 'drawArraysInstanced');
    expect(quads).toHaveLength(1);
    expect(quads[0][1]).toBe(0x0005);
    expect(inst).toHaveLength(1);
    expect(inst[0][4]).toBe(4096);
  });

  it('still shows the phase it was given', () => {
    render(<ColliderChamber phase="colliding" {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.4 }} />);
    const phaseUploads = rec.log.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith('uPhase'));
    expect(phaseUploads.some((e) => e[2] === 3)).toBe(true);
  });

  it('freezes accelerating fully pinched', () => {
    render(<ColliderChamber phase="accelerating" {...base} />);
    const accel = rec.log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uAccel'));
    expect(accel.length).toBeGreaterThan(0);
    expect(accel[accel.length - 1].slice(2)).toEqual([1, 1]);
  });
});
