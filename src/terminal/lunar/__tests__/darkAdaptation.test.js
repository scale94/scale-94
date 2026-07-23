import { describe, it, expect } from 'vitest';
import {
  TAU_SECONDS, BLEACH_THRESHOLD, BLEACH_FACTOR,
  adaptCeiling, createAdaptState, stepAdapt, isAtRest,
} from '../darkAdaptation';

describe('darkAdaptation — ceiling', () => {
  it('falls as illumination rises', () => {
    expect(adaptCeiling(0)).toBeCloseTo(1.0, 6);
    expect(adaptCeiling(1)).toBeCloseTo(0.15, 6);
    expect(adaptCeiling(0.5)).toBeCloseTo(0.575, 6);
  });

  it('clamps illumination outside [0,1]', () => {
    expect(adaptCeiling(-3)).toBeCloseTo(1.0, 6);
    expect(adaptCeiling(9)).toBeCloseTo(0.15, 6);
  });
});

describe('darkAdaptation — ramp shape', () => {
  it('reaches 63% of ceiling after one time constant', () => {
    let s = createAdaptState(0);
    s = stepAdapt(s, { dt: TAU_SECONDS, illumination: 0 });
    expect(s.adapt).toBeCloseTo(1 - Math.exp(-1), 4);   // 0.6321
  });

  it('is frame-rate independent', () => {
    // One 5s step must equal fifty 0.1s steps.
    let coarse = createAdaptState(0);
    coarse = stepAdapt(coarse, { dt: 5, illumination: 0 });
    let fine = createAdaptState(0);
    for (let i = 0; i < 50; i++) fine = stepAdapt(fine, { dt: 0.1, illumination: 0 });
    expect(fine.adapt).toBeCloseTo(coarse.adapt, 6);
  });

  it('approaches but never exceeds the ceiling', () => {
    let s = createAdaptState(0.4);
    const ceiling = adaptCeiling(0.4);
    for (let i = 0; i < 2000; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0.4 });
    expect(s.adapt).toBeLessThanOrEqual(ceiling);
    expect(s.adapt).toBeCloseTo(ceiling, 5);
  });

  it('clamps down when the ceiling drops beneath the current value', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(0.9);
    // Illumination creeps up in sub-threshold steps: no bleach, but the
    // ceiling must still pull it down.
    for (let i = 0; i < 20; i++) {
      s = stepAdapt(s, { dt: 0.016, illumination: Math.min(1, i * 0.05) });
    }
    expect(s.adapt).toBeLessThanOrEqual(adaptCeiling(0.95) + 1e-9);
  });
});

describe('darkAdaptation — bleach', () => {
  function adapted() {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    return s;
  }

  it('fires on a jump strictly greater than the threshold', () => {
    const before = adapted();
    const after = stepAdapt(before, { dt: 0.016, illumination: BLEACH_THRESHOLD + 0.01 });
    expect(after.adapt).toBeLessThan(before.adapt * BLEACH_FACTOR * 1.5);
  });

  it('does NOT fire at exactly the threshold', () => {
    const before = adapted();
    const after = stepAdapt(before, { dt: 0.016, illumination: BLEACH_THRESHOLD });
    // No bleach: adapt is pulled down to the new ceiling and no further. A
    // bleach would have multiplied by BLEACH_FACTOR first, landing near 0.15.
    // Asserting against the ceiling separates the two causes; asserting
    // against `before` conflates them, because the clamp moves adapt too.
    expect(after.adapt).toBeCloseTo(adaptCeiling(BLEACH_THRESHOLD), 3);
  });

  it('does not fire when illumination drops', () => {
    let s = createAdaptState(0.9);
    s = stepAdapt(s, { dt: 5, illumination: 0.9 });
    const before = s.adapt;
    const after = stepAdapt(s, { dt: 0.016, illumination: 0.1 });
    expect(after.adapt).toBeGreaterThanOrEqual(before);
  });

  it('rebuilds after a bleach', () => {
    let s = adapted();
    s = stepAdapt(s, { dt: 0.016, illumination: 0.9 });
    const bleached = s.adapt;
    for (let i = 0; i < 300; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(bleached * 5);
  });
});

describe('darkAdaptation — freeze and reduced motion', () => {
  it('freezes while hidden without resetting', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 100; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    const held = s.adapt;
    for (let i = 0; i < 100; i++) {
      s = stepAdapt(s, { dt: 0.1, illumination: 0, hidden: true });
    }
    expect(s.adapt).toBe(held);
  });

  it('does not bleach on the frame it becomes visible again', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    const held = s.adapt;
    s = stepAdapt(s, { dt: 60, illumination: 0, hidden: true });
    s = stepAdapt(s, { dt: 0.016, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(held * 0.9);
  });

  it('pins at the ceiling under reduced motion', () => {
    const s = stepAdapt(createAdaptState(0.3), {
      dt: 0.016, illumination: 0.3, reducedMotion: true,
    });
    expect(s.adapt).toBeCloseTo(adaptCeiling(0.3), 6);
  });
});

describe('darkAdaptation — rest detection', () => {
  it('is not at rest while still ramping', () => {
    const s = createAdaptState(0);
    expect(isAtRest(s, 0)).toBe(false);
  });

  it('is at rest once settled', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 1000; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(isAtRest(s, 0)).toBe(true);
  });
});
