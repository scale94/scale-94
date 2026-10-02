// src/terminal/mercury/planet/__tests__/dropletShader.test.js
import { describe, it, expect } from 'vitest';
import {
  buildDropletShader, DROPLET_UNIFORMS, DROPLET_VS, NECK_BLEND, RIM_PX, RIM_FADE_PX, RIM_FLOOR, RIM_NECK_LO, RIM_NECK_HI, rimSilPx, rimShade,
} from '../dropletShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from '../hgMirrorGlsl';
import { TIERS, TIER_NAMES } from '../planetQuality';
import { BOUND_BEAD } from '../breakupFrame';
import { glf } from '../../../gl/glf';

describe('dropletShader — the family as one SDF impostor', () => {
  it('builds per tier with that tier\'s caps and march budget', () => {
    for (const t of TIER_NAMES) {
      const { fs, vs } = buildDropletShader({ tier: t });
      const d = TIERS[t].drop;
      expect(vs).toBe(DROPLET_VS);
      expect(fs).toContain(`uniform vec4 uBead[${d.bodies}];`);
      expect(fs).toContain(`uniform vec4 uNeck[${d.necks}];`);
      expect(fs).toContain(`uniform float uNeckR[${d.necks}];`);
      expect(fs).toContain(`uniform vec4 uBridge[${d.bridges}];`);
      expect(fs).toContain(`const int STEPS = ${d.steps};`);
    }
    expect(() => buildDropletShader({ tier: 'ultra' })).toThrow();
  });

  it('is the same quicksilver as the planet', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(HG_MIRROR_DECLS_GLSL);
    expect(fs).toContain(HG_FRESNEL_GLSL);
    expect(fs).toContain(HG_ENV_GLSL);
    expect(fs).toContain('vec3 col = max(fresnelHg(NoV) * envRadiance(R, uRoughLiquid, p, n), 0.0);');
  });

  it('surface tension in the SDF: necks blend at their own radius; separate bodies use a hard min', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(`const float NECK_BLEND = ${glf(NECK_BLEND)};`);
    expect(fs).toContain('float k = h * NECK_BLEND;');
    expect(fs).toContain('d = min(d, db);'); // separate bodies: hard min (db = sdEll of bead i)
    expect(fs).toContain('gBeadR = uBead[i].w;'); // map records the nearest bead's radius for the rim
    expect(fs).not.toMatch(/float dB = 1e9/); // ...so main() has no second sdEll loop
    // volume-preserving prolate ellipsoid: ra·rp² = r³
    expect(fs).toContain('float ra = b.w * (1.0 + ax.w);');
    expect(fs).toContain('float rp = b.w * inversesqrt(1.0 + ax.w);');
  });

  it('bounds match the CPU rect, the bare planet is left to the planet pass, depth is written', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(`const float BOUND_BEAD = ${glf(BOUND_BEAD)};`);
    expect(fs).toContain('if (gPlanetOnly > 0.5) discard;');
    expect(fs).toContain('gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);');
  });

  // Author 2026-10-02: the ~10 px mirror beads vanished into the nebula; a thin dark edge (the planet meniscus rim's
  // idea: a pixel-footprint band, never under 1.5 px) gives every bead a silhouette. The mirror stays inside.
  it('dark rim: a >= 1.5 px pixel-footprint band at the silhouette, mirror shading inside', () => {
    expect(RIM_PX).toBeGreaterThanOrEqual(1.5);
    expect(RIM_FLOOR).toBeLessThan(0.3);
    // distance to the silhouette, px: 0 at grazing, the full radius face-on
    expect(rimSilPx(10, 0)).toBe(0);
    expect(rimSilPx(10, 1)).toBeCloseTo(10, 12);
    expect(rimSilPx(10, Math.sqrt(1 - 0.81))).toBeCloseTo(1, 9);
    // the band: dark at the edge, through RIM_PX, then a RIM_FADE_PX ramp back to the plain mirror
    expect(rimShade(0)).toBeCloseTo(RIM_FLOOR, 12);
    expect(rimShade(RIM_PX)).toBeCloseTo(RIM_FLOOR, 12);
    expect(rimShade(RIM_PX + RIM_FADE_PX)).toBe(1);
    expect(rimShade(RIM_PX + 0.5 * RIM_FADE_PX)).toBeGreaterThan(RIM_FLOOR);
    expect(rimShade(RIM_PX + 0.5 * RIM_FADE_PX)).toBeLessThan(1);
    // a 12 px bead keeps most of its face as mirror
    let lit = 0;
    for (let i = 0; i < 1000; i++) { const rho = Math.sqrt((i + 0.5) / 1000); lit += rimShade(rimSilPx(12, Math.sqrt(1 - rho * rho))) === 1 ? 1 : 0; }
    expect(lit / 1000).toBeGreaterThan(0.5);
  });

  it('the FS rim mirrors rimSilPx / rimShade, after the shading, with no screen derivatives', () => {
    for (const t of TIER_NAMES) {
      const { fs } = buildDropletShader({ tier: t });
      expect(fs).toContain(`const float RIM_PX = ${glf(RIM_PX)};`);
      expect(fs).toContain(`const float RIM_FADE_PX = ${glf(RIM_FADE_PX)};`);
      expect(fs).toContain(`const float RIM_FLOOR = ${glf(RIM_FLOOR)};`);
      expect(fs).toContain('float rimShade(float d)');
      expect(fs).toContain('col *= mix(1.0, rimShade(');
      expect(fs).toContain('uPxAngle');
      expect(fs).not.toMatch(/dFdx|dFdy|fwidth/); // discard above: derivatives would be undefined in divergent flow
    }
  });

  it('declares every uniform it lists', () => {
    const { fs, vs } = buildDropletShader();
    for (const u of DROPLET_UNIFORMS) expect(fs + vs).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });

  it('the rim is gated off on necks, root fillets and bridges (it belongs to the bead silhouette)', () => {
    const { fs } = buildDropletShader();
    expect(RIM_NECK_HI).toBeGreaterThan(RIM_NECK_LO);
    expect(fs).toContain(`const float RIM_NECK_LO = ${glf(RIM_NECK_LO)};`);
    expect(fs).toContain('gBeadOnly = 1.0 - smoothstep(RIM_NECK_LO * gBeadR, RIM_NECK_HI * gBeadR, dBead - d);');
    expect(fs).toContain('col *= mix(1.0, rimShade(');
    expect(fs).toContain('rimOn);');
  });
});
