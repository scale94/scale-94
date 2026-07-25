// src/terminal/mercury/__tests__/readingWitness.test.js
import { describe, it, expect } from 'vitest';
import { isAbsorbed, allWitnessed } from '../readingWitness';

const base = { activeSeconds: 40, requiredSeconds: 30, reachedBottom: true, scrollEvents: 5 };

describe('isAbsorbed', () => {
  it('true when time, bottom, and genuine scrolling all satisfied', () => {
    expect(isAbsorbed(base)).toBe(true);
  });
  it('false when under the time threshold', () => {
    expect(isAbsorbed({ ...base, activeSeconds: 10 })).toBe(false);
  });
  it('false when the bottom was never reached', () => {
    expect(isAbsorbed({ ...base, reachedBottom: false })).toBe(false);
  });
  it('false on a single instantaneous jump (too few scroll events)', () => {
    expect(isAbsorbed({ ...base, scrollEvents: 1 })).toBe(false);
  });
});

describe('allWitnessed', () => {
  it('true only when every required id is complete', () => {
    const req = ['a', 'b', 'c'];
    expect(allWitnessed(new Set(['a', 'b']), req)).toBe(false);
    expect(allWitnessed(new Set(['a', 'b', 'c']), req)).toBe(true);
    expect(allWitnessed(new Set(['a', 'b', 'c', 'x']), req)).toBe(true);
  });
  it('false for an empty required set (never fires with no kernels)', () => {
    expect(allWitnessed(new Set(['a']), [])).toBe(false);
  });
});
