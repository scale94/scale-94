import { describe, it, expect } from 'vitest';
import { rankNormalize, rawMass, buildDomainMass, DEFAULT_MASS } from '../domainMass';
import { FEATURES, NODE_IDX } from '../../data/nodeFeatures';

describe('domainMass', () => {
  it('rawMass is weight minus volatility', () => {
    const f = new Array(32).fill(0);
    f[11] = 0.9;
    f[4] = 0.2;
    expect(rawMass(f)).toBeCloseTo(0.7, 12);
  });

  it('rank-normalises to [0,1] by order, not by value', () => {
    expect(rankNormalize([3, 1, 2])).toEqual([1, 0, 0.5]);
    expect(rankNormalize([100, -5, 0.001])).toEqual([1, 0, 0.5]);
  });

  it('averages the ranks of ties', () => {
    expect(rankNormalize([1, 1, 2])).toEqual([0.25, 0.25, 1]);
  });

  it('gives a non-finite value the default and leaves it out of the ranking', () => {
    expect(rankNormalize([NaN, 1, 2])).toEqual([DEFAULT_MASS, 0, 1]);
  });

  it('with fewer than two finite values everything is the default', () => {
    expect(rankNormalize([5])).toEqual([DEFAULT_MASS]);
    expect(rankNormalize([])).toEqual([]);
  });

  it('maps an unknown node to the default instead of throwing', () => {
    const m = buildDomainMass(['feigenbaum', 'no_such_node', 'kuramoto'], NODE_IDX, FEATURES);
    expect(m[1]).toBe(DEFAULT_MASS);
  });

  it('on real feature rows: bounded, deterministic, ordered by raw', () => {
    const ids = ['pqhash', 'biocoenosis', 'feigenbaum', 'kuramoto', 'surveillance', 'atmospheric'];
    const a = buildDomainMass(ids, NODE_IDX, FEATURES);
    expect(a).toEqual(buildDomainMass(ids, NODE_IDX, FEATURES));
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const raw = ids.map((id) => rawMass(FEATURES[NODE_IDX[id]]));
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (raw[i] < raw[j]) expect(a[i]).toBeLessThan(a[j]);
      }
    }
  });
});
