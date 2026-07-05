import { describe, it, expect } from 'vitest';
import { mulberry32, expand, collide, EXPANDED, BLOCK, SOCIAL_DIMS } from '../councilCollider';

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

describe('collide', () => {
  const mk = (selfDim, aff = {}) => {
    const v = new Float32Array(16).fill(0.05);
    v[selfDim] = 1.0;
    for (const [i, w] of Object.entries(aff)) v[i] = w;
    return expand(v);
  };

  it('partition is exactly 6 social dims', () => {
    expect(SOCIAL_DIMS).toEqual(
      ['synchrony', 'temporal', 'game_theory', 'information', 'cryptographic', 'economic']
    );
  });

  it('returns cosine in [-1,1], a 16-entry byDim energy array, and mean energies', () => {
    const r = collide(mk(2), mk(5));
    expect(r.cosine).toBeGreaterThanOrEqual(-1);
    expect(r.cosine).toBeLessThanOrEqual(1);
    expect(r.byDim).toHaveLength(16);
    expect(r.energies.social).toBeGreaterThan(0);
    expect(r.energies.bio).toBeGreaterThan(0);
  });

  it('is deterministic and symmetric in energy for a fixed pair', () => {
    const a = mk(2), b = mk(9);
    const r1 = collide(a, b), r2 = collide(a, b);
    expect(r1.trajectory).toBe(r2.trajectory);
    expect(r1.dominantDim).toBe(r2.dominantDim);
    expect(r1.cosine).toBeCloseTo(r2.cosine, 12);
  });

  it('mean-per-dim normalization: identical per-dim residual energy → E_social ≈ E_bio', () => {
    // Craft two vectors whose residual is uniform across dims: same base
    // profile except a constant offset in every dim.
    const va = new Float32Array(16).fill(0.30);
    const vb = new Float32Array(16).fill(0.55);
    const r = collide(expand(va), expand(vb));
    const ratio = r.energies.social / r.energies.bio;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });

  it('social-heavy residual ejects toward FOUNDATION, names the dominant dim', () => {
    // Difference concentrated in economic (dim 15, social partition):
    const va = new Float32Array(16).fill(0.2); va[15] = 1.0;
    const vb = new Float32Array(16).fill(0.2); vb[15] = 0.1;
    const r = collide(expand(va), expand(vb));
    expect(r.trajectory).toBe('FOUNDATION');
    expect(r.dominantDim).toBe(15);
  });

  it('bio-heavy residual ejects toward CEILING', () => {
    // Difference concentrated in entropy (dim 4, biophysical partition):
    const va = new Float32Array(16).fill(0.2); va[4] = 1.0;
    const vb = new Float32Array(16).fill(0.2); vb[4] = 0.1;
    const r = collide(expand(va), expand(vb));
    expect(r.trajectory).toBe('CEILING');
    expect(r.dominantDim).toBe(4);
  });

  it('expand block ownership: one-hot input has zero energy outside its own block', () => {
    // Guards index arithmetic in expand() — added per Task 2 quality review.
    const v = new Float32Array(16).fill(0);
    v[3] = 1.0;
    const e = expand(v);
    for (let d = 0; d < 16; d++) {
      let s = 0;
      for (let k = 0; k < BLOCK; k++) s += e[d * BLOCK + k] ** 2;
      if (d === 3) expect(s).toBeGreaterThan(0);
      else expect(s).toBe(0);
    }
  });
});
