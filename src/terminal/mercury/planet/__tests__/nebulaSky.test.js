// Neutral nebula (spec 2026-10-08): bake-time generator + the rigid drift rotation.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  NEBULA_FACE, NEBULA_GEN_GLSL, NEBULA_BAKE_VS, NEBULA_BAKE_FS, nebulaRotation,
  NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI, NEBULA_WISP_SCALE, NEBULA_WISP_WARP,
  NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS, NEBULA_STAR_RATE, NEBULA_STAR_SIGMA,
  NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN, NEBULA_STAR_REACH,
} from '../nebulaSky';
import { SKY_NOISE_GLSL, NEUTRAL_SKY_DRIFT } from '../aetherSky';

const apply = (m, v) => [0, 1, 2].map((r) => m[3 * r] * v[0] + m[3 * r + 1] * v[1] + m[3 * r + 2] * v[2]);

describe('nebulaSky', () => {
  it('every constant reaches the generator', () => {
    for (const [n, v] of Object.entries({ NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI,
      NEBULA_WISP_SCALE, NEBULA_WISP_WARP, NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS,
      NEBULA_STAR_RATE, NEBULA_STAR_SIGMA, NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN,
      NEBULA_STAR_REACH })) {
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

  it('stars: sparse, sharp cores reaching the shoulder; windowed inside the 27-cell search so nothing clips', () => {
    expect(NEBULA_STAR_RATE).toBeGreaterThan(0.99);
    expect(NEBULA_STAR_MIN).toBeGreaterThanOrEqual(3);
    expect(NEBULA_STAR_MAX).toBeLessThanOrEqual(8);
    const texel = (Math.PI / 2) / NEBULA_FACE;
    expect(NEBULA_STAR_SIGMA / texel).toBeGreaterThan(1.2);
    expect(NEBULA_STAR_SIGMA / texel).toBeLessThan(2.5);
    expect(NEBULA_GEN_GLSL).toContain('for (int dz = -1; dz <= 1; dz++)');
    // excluded stars are >= (1 + 0.5 - 0.4) = 1.1 cells away (jitter 0.8 x [-0.5, 0.5] around the cell centre)
    expect(NEBULA_STAR_REACH).toBeLessThan(1.1);
    expect(NEBULA_GEN_GLSL).toContain('* smoothstep(reach, 0.5 * reach, d);');
    expect(NEBULA_GEN_GLSL).toContain('c + 0.5 + 0.8 * j');
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
});
