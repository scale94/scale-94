import { describe, it, expect } from 'vitest';
import {
  ECO_TUNING, growthToGdp, degrowthGate, healingPower, toxicityLoad,
  stepVitality, deriveFracs,
} from '../ecocideEngine';

describe('degrowthGate — the degrowth key', () => {
  it('is fully closed at high growth, fully open at steady-state', () => {
    expect(degrowthGate(5)).toBeCloseTo(0, 5);
    expect(degrowthGate(3.0)).toBeCloseTo(0, 5);
    expect(degrowthGate(1.5)).toBeCloseTo(1, 5);
    expect(degrowthGate(0)).toBeCloseTo(1, 5);
  });
  it('is ~0.5 at the midpoint of the gate window', () => {
    expect(degrowthGate(2.25)).toBeCloseTo(0.5, 2);
  });
  it('decreases monotonically across the window', () => {
    expect(degrowthGate(1.8)).toBeGreaterThan(degrowthGate(2.4));
  });
});

describe('healingPower', () => {
  it('is zero whenever the gate is closed — the greenwash invariant', () => {
    expect(healingPower(0, 1, 1)).toBe(0);
  });
  it('weights restoration above sanctuary', () => {
    expect(healingPower(1, 0, 1)).toBeGreaterThan(healingPower(1, 1, 0));
  });
  it('sums the two weighted levers at full gate', () => {
    expect(healingPower(1, 1, 1)).toBeCloseTo(
      ECO_TUNING.W_SANCTUARY + ECO_TUNING.W_RESTORATION, 6);
  });
});

describe('toxicityLoad', () => {
  it('is throttled to zero by a full cap and passes extraction at no cap', () => {
    expect(toxicityLoad(2, 1)).toBe(0);
    expect(toxicityLoad(2, 0)).toBe(2);
  });
});

describe('stepVitality — bidirectional integrator', () => {
  const maxProt = { toxicityCap: 1, sanctuary: 1, restoration: 1 };
  const noProt  = { toxicityCap: 0, sanctuary: 0, restoration: 0 };
  const dt = 0.1;

  it('GREENWASH: max protection at 5% growth does NOT heal', () => {
    const { v } = stepVitality(0, { growth: 5, ...maxProt }, dt);
    expect(v).toBeLessThanOrEqual(0);
  });
  it('DEGROWTH KEY: max protection at 1% growth heals (v rises)', () => {
    const { v } = stepVitality(0, { growth: 1, ...maxProt }, dt);
    expect(v).toBeGreaterThan(0);
  });
  it('NAIVE GROWTH: 5% growth with no protection degrades (v falls)', () => {
    const { v } = stepVitality(0, { growth: 5, ...noProt }, dt);
    expect(v).toBeLessThan(0);
  });
  it('clamps to [-1, 1]', () => {
    expect(stepVitality(1, { growth: 0, ...maxProt }, dt).v).toBeLessThanOrEqual(1);
    expect(stepVitality(-1, { growth: 10, ...noProt }, dt).v).toBeGreaterThanOrEqual(-1);
  });
});

describe('deriveFracs — signed v split into the two display tracks', () => {
  it('negative v is collapse (deadFrac), positive v is bloom', () => {
    expect(deriveFracs(-0.5)).toEqual({ deadFrac: 0.5, bloomFrac: 0 });
    expect(deriveFracs(0.5)).toEqual({ deadFrac: 0, bloomFrac: 0.5 });
    expect(deriveFracs(0)).toEqual({ deadFrac: 0, bloomFrac: 0 });
  });
});
