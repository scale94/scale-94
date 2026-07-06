import { describe, it, expect } from 'vitest';
import {
  FEATURES, NODE_IDX,
  analyzeFullEdge, extractParadoxes,
  fullEdgeFromVectors, paradoxesFromVectors, detectPeriod3Sanctuaries,
} from '../nodeFeatures';

const anyTwoIds = () => {
  const ids = Object.keys(NODE_IDX);
  return [ids[0], ids[3]];
};

describe('vector cores delegate identically (Scaling regression guard)', () => {
  it('analyzeFullEdge(idA,idB) ≡ fullEdgeFromVectors on the same FEATURES rows', () => {
    const [idA, idB] = anyTwoIds();
    const byId = analyzeFullEdge(idA, idB);
    const byVec = fullEdgeFromVectors(FEATURES[NODE_IDX[idA]], FEATURES[NODE_IDX[idB]]);
    expect(byVec.sim).toBe(byId.sim);
    expect(byVec.dims).toEqual(byId.dims);
    expect(byVec.drivers).toEqual(byId.drivers);
  });

  it('extractParadoxes(idA,idB) ≡ paradoxesFromVectors on the same FEATURES rows', () => {
    const [idA, idB] = anyTwoIds();
    const byId = extractParadoxes(idA, idB);
    const byVec = paradoxesFromVectors(FEATURES[NODE_IDX[idA]], FEATURES[NODE_IDX[idB]]);
    expect(byVec.finalSim).toBe(byId.finalSim);
    expect(byVec.paradoxes).toEqual(byId.paradoxes);
  });
});

describe('cores handle 16-D council profiles', () => {
  const mk = (self) => { const v = new Float32Array(16).fill(0.05); v[self] = 1.0; v[(self + 5) % 16] = 0.5; return v; };

  it('fullEdgeFromVectors on 16-D vectors returns exactly 16 dims', () => {
    const r = fullEdgeFromVectors(mk(0), mk(4));
    expect(r.dims).toHaveLength(16);
    expect(r.drivers.length).toBeGreaterThan(0);
    expect(r.sim).toBeGreaterThan(-1.001);
  });

  it('paradoxesFromVectors on 16-D vectors returns residuals over 16 dims only', () => {
    const r = paradoxesFromVectors(mk(0), mk(8));
    for (const p of r.paradoxes) expect(p.i).toBeLessThan(16);
  });
});

describe('detectPeriod3Sanctuaries (relocated)', () => {
  it('clusters 3+ paradoxes within the band into a sanctuary', () => {
    const paradoxes = [
      { name: 'a', residual: 0.10 }, { name: 'b', residual: 0.12 },
      { name: 'c', residual: 0.13 }, { name: 'd', residual: 0.40 },
    ];
    const s = detectPeriod3Sanctuaries(paradoxes, 0.05);
    expect(s).toHaveLength(1);
    expect(s[0].members.sort()).toEqual(['a', 'b', 'c']);
    expect(s[0].size).toBe(3);
  });

  it('returns [] for fewer than 3 paradoxes', () => {
    expect(detectPeriod3Sanctuaries([{ name: 'a', residual: 0.1 }])).toEqual([]);
  });
});
