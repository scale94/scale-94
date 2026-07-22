import { describe, it, expect } from 'vitest';
import { compileLunarDoctrine } from '../compileLunarDoctrine';
import { SYNODIC_PERIOD } from '../synodic';

const NEW_MOON = {
  age: 0.4, illumination: 0.01, phaseId: 'new', currentAccord: 'DARK INCUBATION',
  transits: [], planets: {}, spine: null,
};

describe('compileLunarDoctrine', () => {
  it('returns a fully populated reading with no empty strings', () => {
    const r = compileLunarDoctrine(NEW_MOON);
    for (const k of ['lensId', 'kernel', 'axis', 'plato', 'promo', 'paradox', 'directive', 'coda']) {
      expect(typeof r[k], k).toBe('string');
      expect(r[k].trim().length, k).toBeGreaterThan(0);
    }
    expect(r.lensId).toBe('hudelschublade');
    expect(r.quadrant).toBe('DARK-WAXING');
  });

  it('is deterministic', () => {
    expect(compileLunarDoctrine(NEW_MOON)).toEqual(compileLunarDoctrine(NEW_MOON));
  });

  it('synthesises the Sun-Moon aspect when no transit is available', () => {
    const r = compileLunarDoctrine(NEW_MOON);
    expect(r.dominant.synthetic).toBe(true);
    expect(r.dominant.aspect).toBe('Conjunct');
    expect(r.tension).toBe('fused');
  });

  it('prefers the tightest real transit over the synthetic one', () => {
    const r = compileLunarDoctrine({
      ...NEW_MOON,
      transits: [{ p1: 'Mercury', p2: 'Saturn', aspect: 'Square', orb: 1.2 }],
    });
    expect(r.dominant.synthetic).toBeUndefined();
    expect(r.dominant.aspect).toBe('Square');
    expect(r.tension).toBe('friction');
  });

  it('carries dryness and phase into provenance', () => {
    const r = compileLunarDoctrine({ ...NEW_MOON, currentAccord: 'MINERAL STILLNESS' });
    expect(r.provenance.dryness).toBe(96);
    expect(r.provenance.accord).toBe('MINERAL STILLNESS');
    expect(r.provenance.illumination).toBe(0.01);
  });

  it('picks the complete coda only for a fully marked spine', () => {
    const partial = compileLunarDoctrine({ ...NEW_MOON, spine: { element: 'FIRE' } });
    const full = compileLunarDoctrine({
      ...NEW_MOON,
      spine: { trend: { label: 'x' }, council: { pair: ['a', 'b'] }, phase: 'DARK INCUBATION', element: 'FIRE' },
    });
    expect(partial.provenance.spineComplete).toBe(false);
    expect(full.provenance.spineComplete).toBe(true);
    expect(partial.coda).not.toBe(full.coda);
  });

  it('never yields an empty slot anywhere on the arc, under any tension, with or without a spine', () => {
    const spines = [null, { element: 'WATER' },
      { trend: { label: 'x' }, council: { pair: ['a', 'b'] }, phase: 'DARK INCUBATION', element: 'FIRE' }];
    const aspects = ['Conjunct', 'Sextile', 'Square', 'Trine', 'Opposite'];
    for (let age = 0; age < SYNODIC_PERIOD; age += 0.25) {
      for (const spine of spines) {
        for (const aspect of aspects) {
          const r = compileLunarDoctrine({
            ...NEW_MOON, age, spine,
            transits: [{ p1: 'Mercury', p2: 'Saturn', aspect, orb: 2 }],
          });
          for (const k of ['axis', 'plato', 'promo', 'paradox', 'directive', 'coda']) {
            expect(r[k], `age ${age.toFixed(2)} ${aspect} → ${k}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('tolerates a malformed transit rather than denying a reading', () => {
    const r = compileLunarDoctrine({ ...NEW_MOON, transits: [{ p1: 'Nibiru', p2: 'Moon', aspect: 'Wobble', orb: 3 }] });
    expect(r.tension).toBe('fused');       // unknown aspect reads as zero tension
    expect(r.directive.length).toBeGreaterThan(0);
  });

  it('wraps an age past the end of the cycle onto its equivalent reading', () => {
    const wrapped = compileLunarDoctrine({ ...NEW_MOON, age: 3.47 + SYNODIC_PERIOD });
    const base = compileLunarDoctrine({ ...NEW_MOON, age: 3.47 });
    expect(wrapped).toEqual(base);
  });

  it('wraps a negative age rather than clamping it', () => {
    const r = compileLunarDoctrine({ ...NEW_MOON, age: -3 });
    expect(r.quadrant).toBe('DARK-WANING');
  });

  it('returns a well-formed reading for a non-finite age instead of throwing', () => {
    expect(() => compileLunarDoctrine({ ...NEW_MOON, age: NaN })).not.toThrow();
    const r = compileLunarDoctrine({ ...NEW_MOON, age: NaN });
    expect(typeof r.directive).toBe('string');
    expect(r.directive.trim().length).toBeGreaterThan(0);
  });
});
