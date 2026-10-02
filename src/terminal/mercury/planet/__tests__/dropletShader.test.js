// src/terminal/mercury/planet/__tests__/dropletShader.test.js
import { describe, it, expect } from 'vitest';
import { buildDropletShader, DROPLET_UNIFORMS, DROPLET_VS, NECK_BLEND } from '../dropletShader';
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
    expect(fs).toContain('d = min(d, sdEll(p, uBead[i], uBeadAxis[i]));');
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

  it('declares every uniform it lists', () => {
    const { fs, vs } = buildDropletShader();
    for (const u of DROPLET_UNIFORMS) expect(fs + vs).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });
});
