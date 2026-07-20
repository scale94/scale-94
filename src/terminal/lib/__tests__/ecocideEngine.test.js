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

import { socialPenaltyLevel } from '../ecocideEngine';

describe('socialPenaltyLevel — the reframed double-bind', () => {
  it('is 0 when the mandate never engaged', () => {
    expect(socialPenaltyLevel(1.0, 0, 0, false)).toBe(0);
  });
  it('is 0 when growth is at/above the mandate line', () => {
    expect(socialPenaltyLevel(2.0, 0, 0, true)).toBe(0);
  });
  it('NAIVE degrowth (no protection funding) fires the full penalty', () => {
    expect(socialPenaltyLevel(0.5, 0, 0, true)).toBe(3);
    expect(socialPenaltyLevel(1.2, 0, 0, true)).toBe(2);
    expect(socialPenaltyLevel(1.8, 0, 0, true)).toBe(1);
  });
  it('JUST TRANSITION: funded protection buys the penalty down', () => {
    // same 0.5% growth that fired level 3 above, now with protection funded
    expect(socialPenaltyLevel(0.5, 1, 1, true)).toBeLessThan(3);
  });
  it('fully funded protection can neutralise the penalty entirely', () => {
    expect(socialPenaltyLevel(1.8, 1, 1, true)).toBe(0);
  });
});

import { REGEN_NAME, REGEN_COLOR, bloomPhase } from '../ecocideEngine';

describe('regen phase ladder', () => {
  it('names mirror the collapse ladder around HOMEOSTASIS', () => {
    expect(REGEN_NAME[0]).toBe('HOMEOSTASIS');
    expect(REGEN_NAME).toHaveLength(5);
    expect(REGEN_COLOR).toHaveLength(5);
  });
  it('maps bloomFrac onto ascending phases', () => {
    expect(bloomPhase(0)).toBe(0);
    expect(bloomPhase(0.2)).toBe(1);
    expect(bloomPhase(0.45)).toBe(2);
    expect(bloomPhase(0.7)).toBe(3);
    expect(bloomPhase(0.9)).toBe(4);
  });
  it('is monotonic non-decreasing', () => {
    expect(bloomPhase(0.3)).toBeLessThanOrEqual(bloomPhase(0.6));
  });
});

import { stepVitalityHybrid } from '../ecocideEngine';

describe('stepVitalityHybrid — WASM-free bidirectional integrator (preserves main collapse)', () => {
  const dt = 0.1;
  const noProt  = { toxicityCap: 0, sanctuary: 0, restoration: 0 };
  const maxProt = { toxicityCap: 1, sanctuary: 1, restoration: 1 };

  // Reference = main's EXACT one-way JS integrator (EcocideTab.jsx ~L420-447).
  const refStep = (prevDF, growth) => {
    const extraction   = Math.max(0, growthToGdp(growth, prevDF) - 1);
    const regeneration = 0.12 * (1 - prevDF);
    const damage       = Math.max(0, extraction * 0.055 - regeneration) * dt;
    const recovery     = growth < 0.5 ? 0.008 * (1 - prevDF) * dt : 0;
    return Math.max(0, Math.min(0.98, prevDF + damage - recovery));
  };

  it('COLLAPSE IDENTITY: no protection tracks main\'s integrator exactly (growth 5%)', () => {
    let v = 0, refDF = 0;
    for (let i = 0; i < 40; i++) {
      v = stepVitalityHybrid(v, { growth: 5, ...noProt }, dt).v;
      refDF = refStep(refDF, 5);
      expect(deriveFracs(v).deadFrac).toBeCloseTo(refDF, 6);
    }
  });

  it('COLLAPSE IDENTITY holds at low growth (recovery branch, growth 0.3%)', () => {
    let v = -0.5, refDF = 0.5;
    for (let i = 0; i < 20; i++) {
      v = stepVitalityHybrid(v, { growth: 0.3, ...noProt }, dt).v;
      refDF = refStep(refDF, 0.3);
      expect(deriveFracs(v).deadFrac).toBeCloseTo(refDF, 6);
    }
  });

  it('GREENWASH: max protection at 5% collapses identically to no protection', () => {
    let vMax = 0, vNone = 0;
    for (let i = 0; i < 30; i++) {
      vMax  = stepVitalityHybrid(vMax,  { growth: 5, ...maxProt }, dt).v;
      vNone = stepVitalityHybrid(vNone, { growth: 5, ...noProt  }, dt).v;
    }
    expect(vMax).toBeCloseTo(vNone, 6);
    expect(vMax).toBeLessThan(0);
  });

  it('DEGROWTH KEY: max protection at 1% growth heals a collapsed world (v rises)', () => {
    const start = -0.5;
    expect(stepVitalityHybrid(start, { growth: 1, ...maxProt }, dt).v).toBeGreaterThan(start);
  });

  it('NAIVE GROWTH: 5% growth, no protection, drives v down', () => {
    expect(stepVitalityHybrid(0, { growth: 5, ...noProt }, dt).v).toBeLessThan(0);
  });

  it('heals into bloom (positive v) under sustained low-growth protection', () => {
    let v = -0.4;
    for (let i = 0; i < 200; i++) v = stepVitalityHybrid(v, { growth: 1, ...maxProt }, dt).v;
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('clamps to [-0.98, 1] — preserves main\'s 0.98 dead-ceiling', () => {
    let v = 0;
    for (let i = 0; i < 500; i++) v = stepVitalityHybrid(v, { growth: 10, ...noProt }, dt).v;
    expect(v).toBeCloseTo(-0.98, 6);
    let vb = 0.5;
    for (let i = 0; i < 500; i++) vb = stepVitalityHybrid(vb, { growth: 0, ...maxProt }, dt).v;
    expect(vb).toBeLessThanOrEqual(1);
  });

  it('TOXICITY_CAP throttles collapse when the gate is open (growth 2%)', () => {
    const capped   = stepVitalityHybrid(-0.5, { growth: 2, toxicityCap: 1, sanctuary: 0, restoration: 0 }, dt).v;
    const uncapped = stepVitalityHybrid(-0.5, { growth: 2, toxicityCap: 0, sanctuary: 0, restoration: 0 }, dt).v;
    expect(capped).toBeGreaterThan(uncapped);
  });
});
