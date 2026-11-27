import { describe, it, expect } from 'vitest';
import { canonicalJson } from '../canonicalJson.js';

describe('canonicalJson', () => {
  it('key order does not change the output; nested objects are sorted too', () => {
    const a = { b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } };
    const b = { a: { c: 'x', d: [3, { y: 2, z: 1 }] }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it('arrays keep their order', () => {
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });

  it('non-finite numbers throw', () => {
    expect(() => canonicalJson({ x: NaN })).toThrow();
    expect(() => canonicalJson([Infinity])).toThrow();
  });

  it('round-trips a base accord through JSON.parse', () => {
    const acc = { rows: [{ materialId: 'fx-a', parts: 0.25 }], notes: [{ note: 'N', cardLayer: 'top', materials: [] }] };
    expect(JSON.parse(canonicalJson(acc))).toEqual(acc);
  });
});
