import { describe, it, expect } from 'vitest';
import { KERNEL_HOROSCOPE, TENSION_CLASSES } from '../kernelHoroscope';
import { ARC_QUADRANTS } from '../../lunar/synodic';
import { LENSES } from '../../lunar/doctrineLens';

// Grows as each lens lands. The final entry (Task 9) flips this to all five.
const AUTHORED = ['hudelschublade', 'blackhole', 'semiotic', 'fishscale', 'rossignol'];

// Directives are imperatives. This list is deliberately broad — a hedge that
// slips through is worse than a false positive, because the whole point of the
// register is that it commits.
const HEDGES = /\b(may|maybe|might|perhaps|possibly|possible|considers?|considered|considering|invites?|invited|inviting|could|should)\b/i;

function assertEntryComplete(id) {
  const e = KERNEL_HOROSCOPE[id];
  expect(e, `${id} missing from corpus`).toBeTruthy();
  expect(e.axis.length).toBeGreaterThan(10);

  for (const q of ARC_QUADRANTS) {
    expect(e.quadrants[q], `${id}.${q}`).toBeTruthy();
    for (const slot of ['plato', 'promo', 'directive']) {
      expect(e.quadrants[q][slot].trim().length, `${id}.${q}.${slot}`).toBeGreaterThan(10);
    }
    // directives are imperatives: one sentence, no hedging
    expect(e.quadrants[q].directive, `${id}.${q}.directive hedges`).not.toMatch(HEDGES);
  }

  for (const t of TENSION_CLASSES) {
    expect(e.paradox[t].trim().length, `${id}.paradox.${t}`).toBeGreaterThan(10);
  }
  for (const c of ['complete', 'partial']) {
    expect(e.coda[c].trim().length, `${id}.coda.${c}`).toBeGreaterThan(10);
  }
}

describe('kernelHoroscope', () => {
  it('declares the four tension classes', () => {
    expect(TENSION_CLASSES).toEqual(['harmonic', 'fused', 'friction', 'polarity']);
  });

  it.each(AUTHORED)('%s has all 19 slots filled', assertEntryComplete);

  it('has no duplicate directives anywhere in the corpus', () => {
    const all = Object.values(KERNEL_HOROSCOPE)
      .flatMap(e => ARC_QUADRANTS.map(q => e.quadrants[q].directive));
    expect(new Set(all).size).toBe(all.length);
  });

  it('covers every lens in the wheel, and nothing else', () => {
    expect(Object.keys(KERNEL_HOROSCOPE).sort()).toEqual(LENSES.map(l => l.id).sort());
  });
});
