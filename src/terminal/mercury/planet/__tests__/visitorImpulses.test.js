import { describe, it, expect } from 'vitest';
import {
  WAVE_DAMP_PER_S, KIND_DIMPLE, WAKE_DIMPLE_GAIN, createImpulses, addImpulse, createImpulseFrame, impulseFrame,
} from '../mercuryWaves';
import { VISITOR_IMPACT, IMPACT_MODE_AMP, IMPACT_WAVE_AMP } from '../mercuryImpacts';

const KINDS = ['dimple', 'crown', 'marangoni', 'jet'];

describe('visitor impulse kinds', () => {
  it('every visitor kind has a damping rate, a dimple weight and amplitudes', () => {
    for (const k of KINDS) {
      expect(WAVE_DAMP_PER_S[k]).toBeGreaterThan(0);
      expect(KIND_DIMPLE[k]).toBeGreaterThanOrEqual(0);
      expect(VISITOR_IMPACT[k].mode).toBeGreaterThanOrEqual(0);
      expect(VISITOR_IMPACT[k].wave).toBeGreaterThan(0);
    }
  });
  it('leaves the phase-3/5 tables untouched', () => {
    expect(IMPACT_MODE_AMP).toEqual({ splash: 0.035, ring: 0.015, crater: 0 });
    expect(IMPACT_WAVE_AMP).toEqual({ splash: 0.35, ring: 0.2, crater: 0 });
    expect([WAVE_DAMP_PER_S.splash, WAVE_DAMP_PER_S.wake, WAVE_DAMP_PER_S.ring]).toEqual([1.0, 1.6, 3.0]);
    expect(KIND_DIMPLE.wake).toBe(WAKE_DIMPLE_GAIN);
  });
  it('water hits with a third of a splash ripple; earth pushes 1.5x a splash mode', () => {
    expect(VISITOR_IMPACT.dimple.wave).toBeCloseTo(IMPACT_WAVE_AMP.splash / 3, 2);
    expect(VISITOR_IMPACT.crown.mode).toBeCloseTo(1.5 * IMPACT_MODE_AMP.splash, 3);
  });
  it('the Marangoni hit has no snap dimple (its clearing is a surface slot, plan D-3)', () => {
    expect(KIND_DIMPLE.marangoni).toBe(0);
    expect(VISITOR_IMPACT.marangoni.mode).toBe(0);
  });
  it('impulseFrame writes the per-kind dimple weight; splash and wake unchanged', () => {
    const buf = createImpulses();
    const f = createImpulseFrame();
    for (const kind of ['splash', 'wake', 'marangoni', 'crown']) addImpulse(buf, { dirBody: [0, 0, 1], tS: 0, wave: 0.1, kind });
    impulseFrame(buf, 0.1, {}, f);
    [1, WAKE_DIMPLE_GAIN, 0, KIND_DIMPLE.crown].forEach((v, i) => expect(f.dimple[i]).toBeCloseTo(v, 6));
  });
});
