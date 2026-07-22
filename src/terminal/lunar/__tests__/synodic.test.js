import { describe, it, expect } from 'vitest';
import {
  SYNODIC_PERIOD, PHASES, getPhase, ASPECT_TENSION,
  tensionClassOf, ARC_QUADRANTS, quadrantOf, wrappedDistance,
} from '../synodic';

describe('synodic', () => {
  it('keeps the period and the eight phases in cycle order', () => {
    expect(SYNODIC_PERIOD).toBeCloseTo(29.53058770576, 10);
    expect(PHASES.map(p => p.id)).toEqual([
      'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
      'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
    ]);
  });

  it('getPhase resolves ages to phases and clamps past the end', () => {
    expect(getPhase(0).id).toBe('new');
    expect(getPhase(14.7).id).toBe('full');
    expect(getPhase(29.52).id).toBe('waning-crescent');
    expect(getPhase(99).id).toBe('new');   // out of range falls back to PHASES[0]
  });

  it('classifies aspect tension into four classes', () => {
    expect(tensionClassOf('Trine')).toBe('harmonic');
    expect(tensionClassOf('Sextile')).toBe('harmonic');
    expect(tensionClassOf('Conjunct')).toBe('fused');
    expect(tensionClassOf('Square')).toBe('friction');
    expect(tensionClassOf('Opposite')).toBe('polarity');
    expect(tensionClassOf('nonsense')).toBe('fused');   // unknown → zero tension
    expect(ASPECT_TENSION.Square).toBe(1);
  });

  it('splits the arc into four quadrants and clamps the endpoints', () => {
    expect(ARC_QUADRANTS).toHaveLength(4);
    expect(quadrantOf(0)).toBe('DARK-WAXING');
    expect(quadrantOf(8)).toBe('LIGHT-WAXING');
    expect(quadrantOf(16)).toBe('LIGHT-WANING');
    expect(quadrantOf(25)).toBe('DARK-WANING');
    expect(quadrantOf(SYNODIC_PERIOD)).toBe('DARK-WANING');   // clamp, not overflow
    expect(quadrantOf(-1)).toBe('DARK-WAXING');
  });

  it('measures distance across the wheel seam', () => {
    expect(wrappedDistance(0.1, 0)).toBeCloseTo(0.1, 6);
    // 29.4 is 0.13 days *before* new, not 29.4 days after it
    expect(wrappedDistance(29.4, 0)).toBeCloseTo(0.1305877, 5);
    expect(wrappedDistance(0, 14.765)).toBeCloseTo(14.765, 3);
    expect(wrappedDistance(5, 5)).toBe(0);
  });
});
