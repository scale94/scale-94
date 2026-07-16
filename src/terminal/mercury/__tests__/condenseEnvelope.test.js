// src/terminal/mercury/__tests__/condenseEnvelope.test.js — the breath's
// pure envelope: inhale on consolidating, hold, exhale on emerging.
import { describe, it, expect } from 'vitest';
import { condenseEnvelope } from '../usePhaseTransition';

describe('condenseEnvelope', () => {
  it('idle: 0', () => {
    expect(condenseEnvelope('idle', 0)).toBe(0);
  });

  it('consolidating: rises with eased t (the inhale)', () => {
    expect(condenseEnvelope('consolidating', 0)).toBe(0);
    expect(condenseEnvelope('consolidating', 0.5)).toBe(0.5);
    expect(condenseEnvelope('consolidating', 1)).toBe(1);
  });

  it('elongating and flowing: held at 1 (sky empty, flash owns the frame)', () => {
    expect(condenseEnvelope('elongating', 0.3)).toBe(1);
    expect(condenseEnvelope('flowing', 0.9)).toBe(1);
  });

  it('emerging: falls with eased t (the exhale — launch fast, settle slow)', () => {
    expect(condenseEnvelope('emerging', 0)).toBe(1);
    expect(condenseEnvelope('emerging', 0.5)).toBe(0.5);
    expect(condenseEnvelope('emerging', 1)).toBe(0);
  });

  it('continuity at both seams: idle==consolidating start, emerging end==idle', () => {
    expect(condenseEnvelope('consolidating', 0)).toBe(condenseEnvelope('idle', 0));
    expect(condenseEnvelope('emerging', 1)).toBe(condenseEnvelope('idle', 0));
  });
});
