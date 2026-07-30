import { describe, it, expect } from 'vitest';
import { phaseTiming, ACCELERATE_MS, COLLIDE_MS, PHASE_ID } from '../colliderPhases';

describe('colliderPhases', () => {
  it('preserves the authored durations from the old frame counters', () => {
    // Old: `progress = t / 108` with "~1800ms at 60fps"; `t > 150` -> result.
    expect(ACCELERATE_MS).toBe(1800);
    expect(COLLIDE_MS).toBe(2500);
    expect(PHASE_ID.colliding).toBe(3);
  });

  it('is frame-rate independent: the same elapsed ms gives the same curve', () => {
    // The defect this module exists to fix. 60fps reached 900ms in 54 frames,
    // 120fps in 108 -- both must produce identical output now.
    const at60 = phaseTiming('accelerating', 54 * (1000 / 60));
    const at120 = phaseTiming('accelerating', 108 * (1000 / 120));
    expect(at60.ease).toBeCloseTo(at120.ease, 12);
    expect(at60.progress).toBeCloseTo(at120.progress, 12);
  });

  it('accelerating: easeInCubic, clamped at both ends', () => {
    expect(phaseTiming('accelerating', 0).ease).toBe(0);
    expect(phaseTiming('accelerating', 900).ease).toBeCloseTo(0.125, 6); // 0.5^3
    expect(phaseTiming('accelerating', 1800).ease).toBe(1);
    expect(phaseTiming('accelerating', 9000).ease).toBe(1);
    expect(phaseTiming('accelerating', 9000).progress).toBe(1);
  });

  it('colliding: flash, shake and rings run on their original windows', () => {
    const t0 = phaseTiming('colliding', 0);
    expect(t0.flash).toBe(1);      // 15 frames = 250ms
    expect(t0.shake).toBe(1);      // 20 frames = 333ms
    expect(t0.ring1).toBe(0);      // 35 frames = 583ms
    expect(t0.ring2).toBe(-1);     // starts at frame 5 = 83ms

    expect(phaseTiming('colliding', 250).flash).toBe(0);
    expect(phaseTiming('colliding', 300).flash).toBe(0);
    expect(phaseTiming('colliding', 100).ring2).toBeGreaterThanOrEqual(0);
    expect(phaseTiming('colliding', 600).ring1).toBe(-1);
  });

  it('colliding: spawn gates match the original frame windows', () => {
    expect(phaseTiming('colliding', 100).sparkGate).toBe(1);   // t < 40  = 667ms
    expect(phaseTiming('colliding', 700).sparkGate).toBe(0);
    expect(phaseTiming('colliding', 300).jetGate).toBe(1);     // t < 25  = 417ms
    expect(phaseTiming('colliding', 500).jetGate).toBe(0);
    expect(phaseTiming('colliding', 400).chimeraGate).toBe(0); // 30..120 = 500..2000ms
    expect(phaseTiming('colliding', 900).chimeraGate).toBe(1);
    expect(phaseTiming('colliding', 2100).chimeraGate).toBe(0);
    expect(phaseTiming('colliding', 900).vaporGate).toBe(0);   // 60..140 = 1000..2333ms
    expect(phaseTiming('colliding', 1500).vaporGate).toBe(1);
  });

  it('colliding: beams and metrics arm at 1333ms', () => {
    expect(phaseTiming('colliding', 1000).beamT).toBe(-1);
    expect(phaseTiming('colliding', 1000).metrics).toBe(0);
    expect(phaseTiming('colliding', 1333).beamT).toBeCloseTo(0, 6);
    expect(phaseTiming('colliding', 1833).beamT).toBeCloseTo(0.5, 6); // seconds
    expect(phaseTiming('colliding', 1583).metrics).toBeCloseTo(0.5, 6);
    expect(phaseTiming('colliding', 1833).metrics).toBe(1);
  });

  it('done flips exactly at COLLIDE_MS and only for colliding', () => {
    expect(phaseTiming('colliding', 2499).done).toBe(0);
    expect(phaseTiming('colliding', 2500).done).toBe(1);
    expect(phaseTiming('accelerating', 99999).done).toBe(0);
    expect(phaseTiming('idle', 99999).done).toBe(0);
  });

  it('idle and selecting are inert but well-formed', () => {
    for (const p of ['idle', 'selecting', 'result']) {
      const t = phaseTiming(p, 1234);
      expect(t.ease).toBe(0);
      expect(t.flash).toBe(0);
      expect(t.ring1).toBe(-1);
      expect(t.beamT).toBe(-1);
      expect(Number.isFinite(t.progress)).toBe(true);
    }
  });

  it('never returns NaN for a negative or absurd elapsed', () => {
    for (const ms of [-1000, 0, 1e9]) {
      for (const v of Object.values(phaseTiming('colliding', ms))) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
