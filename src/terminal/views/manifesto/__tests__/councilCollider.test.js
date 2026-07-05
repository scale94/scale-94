import { describe, it, expect } from 'vitest';
import { mulberry32, expand, EXPANDED, BLOCK } from '../councilCollider';

describe('mulberry32', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual([c(), c(), c()]);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('expand', () => {
  const vec = new Float32Array(16).fill(0.05);
  vec[0] = 1.0; vec[4] = 0.5;

  it('returns 1536 components, deterministic across calls', () => {
    const e1 = expand(vec), e2 = expand(vec);
    expect(e1).toHaveLength(EXPANDED);
    expect(EXPANDED).toBe(16 * BLOCK);
    expect(Array.from(e1)).toEqual(Array.from(e2));
  });

  it('block energy scales with the base value (no zero blocks at floor)', () => {
    const e = expand(vec);
    const blockEnergy = (d) => {
      let s = 0;
      for (let k = 0; k < BLOCK; k++) s += e[d * BLOCK + k] ** 2;
      return s;
    };
    expect(blockEnergy(0)).toBeGreaterThan(blockEnergy(4)); // 1.0 > 0.5
    expect(blockEnergy(4)).toBeGreaterThan(blockEnergy(7)); // 0.5 > 0.05
    expect(blockEnergy(7)).toBeGreaterThan(0);              // floor still alive
  });
});
