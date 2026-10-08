// Neutral nebula (spec 2026-10-08): bake-time generator + the rigid drift rotation.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  NEBULA_FACE, NEBULA_GEN_GLSL, NEBULA_BAKE_VS, NEBULA_BAKE_FS, nebulaRotation,
  NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI, NEBULA_WISP_SCALE, NEBULA_WISP_WARP,
  NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS, NEBULA_STAR_RATE, NEBULA_STAR_SIGMA,
  NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN, NEBULA_STAR_REACH, NEBULA_STAR_SHELL,
} from '../nebulaSky';
import { SKY_NOISE_GLSL, NEUTRAL_SKY_DRIFT } from '../aetherSky';

const apply = (m, v) => [0, 1, 2].map((r) => m[3 * r] * v[0] + m[3 * r + 1] * v[1] + m[3 * r + 2] * v[2]);

describe('nebulaSky', () => {
  it('every constant reaches the generator', () => {
    for (const [n, v] of Object.entries({ NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI,
      NEBULA_WISP_SCALE, NEBULA_WISP_WARP, NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS,
      NEBULA_STAR_RATE, NEBULA_STAR_SIGMA, NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN,
      NEBULA_STAR_REACH, NEBULA_STAR_SHELL })) {
      expect(NEBULA_GEN_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
  });

  it('colourless, built on the shared sky noise, full octaves', () => {
    expect(NEBULA_GEN_GLSL).toContain(SKY_NOISE_GLSL);
    expect(NEBULA_GEN_GLSL).toContain('const int SKY_OCTAVES = 5;');
    expect(NEBULA_GEN_GLSL).toContain('vec3 skyNebulaGen(vec3 D) {');
    expect(NEBULA_GEN_GLSL).toContain('return vec3(L);');
    expect(NEBULA_GEN_GLSL).not.toMatch(/uniform/); // bake-time pure function of direction
  });

  it('stars: sparse, sharp cores reaching the shoulder; shell-bound and windowed so the 27-cell search never cuts one', () => {
    expect(NEBULA_STAR_RATE).toBeGreaterThan(0.97);
    expect(NEBULA_STAR_MIN).toBeGreaterThanOrEqual(3);
    expect(NEBULA_STAR_MAX).toBeLessThanOrEqual(8);
    // face-centre texels are the largest on a cube face (2/N vs the average (pi/2)/N): the worst case for core size
    const texel = 2 / NEBULA_FACE;
    expect(NEBULA_STAR_SIGMA / texel).toBeGreaterThan(1.1);
    expect(NEBULA_STAR_SIGMA / texel).toBeLessThan(2.5);
    expect(NEBULA_GEN_GLSL).toContain('for (int dz = -1; dz <= 1; dz++)');
    // a lit star's lattice point is within SHELL of the sample's shell radially and REACH tangentially:
    // |g - P| < 1 => every axis index within 1 => inside the 27-cell search
    expect(Math.hypot(NEBULA_STAR_SHELL, NEBULA_STAR_REACH)).toBeLessThan(1);
    expect(NEBULA_GEN_GLSL).toContain('if (abs(length(P) - NEBULA_STAR_CELLS) >= NEBULA_STAR_SHELL) continue;');
    expect(NEBULA_GEN_GLSL).toContain('* (1.0 - smoothstep(0.5 * reach, reach, d));');
  });

  it('no star is ever cut: brute-force a lattice patch, every star lighting a sample lies in its 27-cell search', () => {
    const C = NEBULA_STAR_CELLS, reach = NEBULA_STAR_REACH / C;
    let lit = 0;
    for (let k = 0; k < 4000; k++) {
      // deterministic sample directions spread over the sphere (golden spiral)
      const y = 1 - (2 * (k + 0.5)) / 4000, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653;
      const D = [r * Math.cos(a), y, r * Math.sin(a)], g = D.map((v) => v * C), gi = g.map(Math.floor);
      // every lattice point P near the shell whose direction is inside the window, regardless of jitter
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
        for (const f of [[0.1, 0.1, 0.1], [0.5, 0.5, 0.5], [0.9, 0.9, 0.9], [0.1, 0.9, 0.5], [0.9, 0.1, 0.5], [0.5, 0.1, 0.9]]) {
          const c = [gi[0] + dx, gi[1] + dy, gi[2] + dz], P = c.map((v, i) => v + f[i]);
          const L = Math.hypot(...P);
          if (Math.abs(L - C) >= NEBULA_STAR_SHELL) continue;
          const d = Math.hypot(D[0] - P[0] / L, D[1] - P[1] / L, D[2] - P[2] / L);
          if (d >= reach) continue;
          lit++;
          for (let i = 0; i < 3; i++) expect(Math.abs(c[i] - gi[i])).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(lit).toBeGreaterThan(0); // the property test is not vacuous
  });

  it('void floor darker than the studio floor (obsidian pockets)', () => {
    expect(NEBULA_FLOOR).toBeLessThan(0.004);
  });

  it('bake shaders: direction from the unit sphere, generator output', () => {
    expect(NEBULA_BAKE_VS).toContain('vDir = position;');
    expect(NEBULA_BAKE_FS).toContain(NEBULA_GEN_GLSL);
    expect(NEBULA_BAKE_FS).toContain('o = vec4(skyNebulaGen(normalize(vDir)), 1.0);');
  });

  it('nebulaRotation: orthonormal, identity at t 0, drifts like the studio (az - NEUTRAL_SKY_DRIFT · t)', () => {
    const I = nebulaRotation(0);
    expect(I.map((x) => +x.toFixed(12) + 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const t = 13.7, m = nebulaRotation(t);
    const R = apply(m, [1, 0, 0]);
    expect(Math.atan2(R[2], R[0])).toBeCloseTo(-NEUTRAL_SKY_DRIFT * t, 10);
    expect(apply(m, [0, 1, 0])).toEqual([0, 1, 0]);
    for (const v of [[1, 0, 0], [0, 0, 1], [0.3, -0.5, 0.81]]) {
      const a = apply(m, v);
      expect(Math.hypot(...a)).toBeCloseTo(Math.hypot(...v), 12);
    }
  });

  it('nebulaRotation(t, out) fills and returns the given array (useFrame allocates nothing)', () => {
    const out = new Array(9);
    const r = nebulaRotation(13.7, out);
    expect(r).toBe(out);
    expect(out).toEqual(nebulaRotation(13.7));
  });
});
