import { describe, it, expect } from 'vitest';
import { HUMANITY_TRAITS, TRAIT_PLANET_MAP } from '../src/terminal/data/humanityTraits';

const VALID_PLANETS    = ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Moon','Sun'];
const VALID_CATEGORIES = ['STRENGTH','PARADOX','WEAKNESS'];

describe('HUMANITY_TRAITS', () => {
  it('has 30 entries', () => expect(HUMANITY_TRAITS).toHaveLength(30));

  it('each trait has required fields with correct types', () => {
    for (const t of HUMANITY_TRAITS) {
      expect(typeof t.id,          `${t.id}.id`).toBe('string');
      expect(typeof t.label,       `${t.id}.label`).toBe('string');
      expect(VALID_PLANETS,        `${t.id}.rulingPlanet`).toContain(t.rulingPlanet);
      expect(VALID_CATEGORIES,     `${t.id}.category`).toContain(t.category);
      expect(t.strength,           `${t.id}.strength >= 0`).toBeGreaterThanOrEqual(0);
      expect(t.strength,           `${t.id}.strength <= 1`).toBeLessThanOrEqual(1);
      expect(typeof t.alienNote,   `${t.id}.alienNote`).toBe('string');
    }
  });

  it('STRENGTH traits have strength >= 0.70', () => {
    for (const t of HUMANITY_TRAITS.filter(t => t.category === 'STRENGTH'))
      expect(t.strength, t.id).toBeGreaterThanOrEqual(0.70);
  });

  it('PARADOX traits have strength 0.40–0.69', () => {
    for (const t of HUMANITY_TRAITS.filter(t => t.category === 'PARADOX')) {
      expect(t.strength, `${t.id} >= 0.40`).toBeGreaterThanOrEqual(0.40);
      expect(t.strength, `${t.id} < 0.70`).toBeLessThan(0.70);
    }
  });

  it('WEAKNESS traits have strength < 0.40', () => {
    for (const t of HUMANITY_TRAITS.filter(t => t.category === 'WEAKNESS'))
      expect(t.strength, t.id).toBeLessThan(0.40);
  });

  it('all trait ids are unique', () => {
    const ids = HUMANITY_TRAITS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('TRAIT_PLANET_MAP covers all trait ids', () => {
    for (const t of HUMANITY_TRAITS)
      expect(TRAIT_PLANET_MAP[t.id], `map missing: ${t.id}`).toBeDefined();
  });

  it('TRAIT_PLANET_MAP matches rulingPlanet on each trait', () => {
    for (const t of HUMANITY_TRAITS)
      expect(TRAIT_PLANET_MAP[t.id]).toBe(t.rulingPlanet);
  });
});
