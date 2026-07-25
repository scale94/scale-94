import { describe, it, expect } from 'vitest';
import { mulberry32, expand, collide, EXPANDED, BLOCK, SOCIAL_DIMS, pickPair, composeLine } from '../councilCollider';

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

// ── TRIPWIRE (measured + locked 2026-07-25) ──────────────────────────────────
// These tests assert a LIMITATION, not a desirable property. They exist so that
// nobody builds a "kindred minds" / similarity feature on collide().cosine, and
// so that any future change to expand()'s harmonic law fails loudly here with a
// pointer to the decision. See the block comment above expand() in
// councilCollider.js. If you are deliberately making the lift faithful, these
// two tests are the ones you must delete — read that comment first.
describe('expand: value-frequency coupling (KNOWN LIMITATION, locked)', () => {
  // Cosine of one 96-sample block for two minds holding va / vb in the same dim.
  const blockCosine = (va, vb) => {
    const a = new Float32Array(16).fill(va);
    const b = new Float32Array(16).fill(vb);
    const ea = expand(a), eb = expand(b);
    let dot = 0, na = 0, nb = 0;
    for (let k = 0; k < BLOCK; k++) {
      dot += ea[k] * eb[k]; na += ea[k] ** 2; nb += eb[k] ** 2;
    }
    return dot / (Math.sqrt(na * nb) || 1);
  };

  it('aligns perfectly only when the two values are exactly equal', () => {
    expect(blockCosine(1.0, 1.0)).toBeCloseTo(1, 6);
    expect(blockCosine(0.6, 0.6)).toBeCloseTo(1, 6);
    expect(blockCosine(0.05, 0.05)).toBeCloseTo(1, 6);
  });

  it('decoheres to noise once the values differ at all — cosine is not similarity', () => {
    // Frequency is a function of v, so near-equal values beat out of phase
    // across the block instead of staying aligned. A 5% gap is already gone.
    expect(Math.abs(blockCosine(1.0, 0.95))).toBeLessThan(0.15);
    expect(Math.abs(blockCosine(1.0, 0.9))).toBeLessThan(0.15);
    expect(Math.abs(blockCosine(0.6, 0.55))).toBeLessThan(0.15);
  });
});

describe('collide().cosine carries no authored-affinity signal (KNOWN, locked)', () => {
  it('ranks THE SIXTEEN pairs uncorrelated with their authored 16-D affinities', async () => {
    const { SIXTEEN_MINDS, mindProfile } = await import('../../../data/sixteenMinds');
    const profiles = SIXTEEN_MINDS.map(mindProfile);
    const lifted = profiles.map(expand);

    const cos16 = (a, b) => {
      let d = 0, na = 0, nb = 0;
      for (let i = 0; i < 16; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
      return d / (Math.sqrt(na * nb) || 1);
    };

    const pairs = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        pairs.push({ key: `${i}-${j}`, authored: cos16(profiles[i], profiles[j]), lifted: collide(lifted[i], lifted[j]).cosine });
      }
    }
    expect(pairs).toHaveLength(120);

    const ranks = (field) => {
      const m = new Map();
      [...pairs].sort((a, b) => b[field] - a[field]).forEach((p, i) => m.set(p.key, i + 1));
      return m;
    };
    const rA = ranks('authored'), rL = ranks('lifted');
    const sumD2 = pairs.reduce((s, p) => s + (rA.get(p.key) - rL.get(p.key)) ** 2, 0);
    const rho = 1 - (6 * sumD2) / (120 * (120 * 120 - 1));

    // Measured rho = 0.027. Indistinguishable from an unrelated ordering.
    expect(Math.abs(rho)).toBeLessThan(0.2);

    // And the field is crushed toward zero, so no absolute threshold is usable:
    // any selection built on this number must be rank-based, and even then the
    // ranks are meaningless (above). Measured range: -0.086 .. 0.268.
    const all = pairs.map(p => p.lifted);
    expect(Math.max(...all)).toBeLessThan(0.4);
    expect(Math.min(...all)).toBeGreaterThan(-0.4);
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

describe('pickPair', () => {
  it('returns two distinct indices in [0,16), deterministic per ordinal', () => {
    for (let o = 0; o < 40; o++) {
      const [a, b] = pickPair(o);
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(16);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(16);
      expect(pickPair(o)).toEqual([a, b]);
    }
  });

  it('bias index is always included and never paired with itself', () => {
    for (let o = 0; o < 20; o++) {
      const [a, b] = pickPair(o, 7);
      expect(a).toBe(7);
      expect(b).not.toBe(7);
    }
  });
});

describe('composeLine', () => {
  const mindA = {
    dimIndex: 0, dimName: 'dynamical', anchorName: 'Donella Meadows',
    coreEquation: 'dX/dt = inflow − outflow',
    systemDirective: 'Leverage Point Location / Paradigm Stack Intervention',
    epigraph: 'The highest leverage is the paradigm the system arises from.',
    excerpt: 'A system is a set of things interconnected in a way that produces its own pattern of behavior over time.',
  };
  const mindB = {
    dimIndex: 4, dimName: 'entropy', anchorName: 'Nicholas Georgescu-Roegen',
    coreEquation: 'ΔS > 0  per production cycle',
    systemDirective: 'Entropy Debt Accounting / Irreversibility Audit',
    epigraph: 'Every economic act is an irreversible burn.',
    excerpt: 'The economic process is entropic in all its material fibers.',
  };
  const collision = { trajectory: 'CEILING', dominantDim: 4 };

  it('same (pair, ordinal) → identical line; different ordinal → different line', () => {
    const l1 = composeLine(mindA, mindB, collision, 3);
    const l2 = composeLine(mindA, mindB, collision, 3);
    const l3 = composeLine(mindA, mindB, collision, 4);
    expect(l1).toBe(l2);
    expect(l1).not.toBe(l3);
  });

  it('contains surnames, dominant dim readout, trajectory arrow, and a spliced clause', () => {
    const l = composeLine(mindA, mindB, collision, 0);
    expect(l).toContain('MEADOWS × GEORGESCU-ROEGEN');
    expect(l).toContain('dim:04 entropy');
    expect(l).toContain('▲ BIOPHYSICAL CEILING');
    expect(l).toMatch(/"[^"]{10,}"/); // quoted generative splice present
  });

  it('clamps line length', () => {
    for (let o = 0; o < 30; o++) {
      expect(composeLine(mindA, mindB, collision, o).length).toBeLessThanOrEqual(180);
    }
  });
});
