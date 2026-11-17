import { describe, it, expect } from 'vitest';
import { auroraUniforms, envelope } from '../aurora';

const storm = (id, stormNt, storm01) => ({ id, phase: 'storm', stormNt, storm01 });

describe('auroraUniforms', () => {
  it('no storm: all zero, no witnesses', () => {
    expect(auroraUniforms([])).toEqual({ uAurora: 0, uAuroraRed: 0, witnessIds: [] });
    expect(auroraUniforms([
      { id: 'f', phase: 'flight', stormNt: -1200, storm01: null },
      { id: 'l', phase: 'landed', stormNt: -1200, storm01: null },
    ])).toEqual({ uAurora: 0, uAuroraRed: 0, witnessIds: [] });
  });

  it('a Carrington-class storm at its middle is full, with the red crown', () => {
    const u = auroraUniforms([storm('a', -1200, 0.5)]);
    expect(u.uAurora).toBeCloseTo(1, 9);
    expect(u.uAuroraRed).toBeCloseTo(1, 9);
    expect(u.witnessIds).toEqual(['a']);
  });

  it('a weak storm is faint and green only', () => {
    const u = auroraUniforms([storm('a', -50, 0.5)]);
    expect(u.uAurora).toBeCloseTo(0.28, 2);
    expect(u.uAuroraRed).toBe(0);
  });

  it('rising at 2 %: above zero, below the hold', () => {
    const u = auroraUniforms([storm('a', -1200, 0.02)]).uAurora;
    expect(u).toBeGreaterThan(0);
    expect(u).toBeLessThan(1);
  });

  it('the envelope is continuous at the rise and fade joins', () => {
    for (const x of [0.1, 0.7]) {
      expect(Math.abs(envelope(x + 1e-3) - envelope(x - 1e-3))).toBeLessThan(0.02);
    }
    expect(envelope(0)).toBe(0);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.4)).toBe(1);
  });

  it('two storms: the stronger one shows, both are witnessed', () => {
    const u = auroraUniforms([storm('weak', -100, 0.5), storm('strong', -900, 0.5)]);
    expect(u.uAurora).toBeCloseTo(0.25 + 0.75 * 900 / 1200, 9);
    expect(u.witnessIds).toEqual(['weak', 'strong']);
  });

  it('a storm fading out loses to a fresh weaker one only by brightness', () => {
    const u = auroraUniforms([storm('old', -1200, 0.99), storm('new', -300, 0.5)]);
    expect(u.uAurora).toBeCloseTo(0.25 + 0.75 * 300 / 1200, 9);
  });
});
