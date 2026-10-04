// src/terminal/mercury/planet/__tests__/hgBeadShader.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BEAD_VS, BEAD_FS, BEAD_MATERIAL, BEAD_RENDER_ORDER, BEAD_MIN_PX, SUN_TERM_GLSL, BEAD_UNIFORMS_OWN } from '../hgBeadShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from '../hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from '../aetherLight';
import { DROPLET_RENDER_ORDER } from '../dropletShader';

describe('Hg bead shader', () => {
  it('is the planet\'s mirror, by construction', () => {
    for (const chunk of [HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHADOW_GLSL]) expect(BEAD_FS).toContain(chunk);
    expect(BEAD_FS).toContain('fresnelHg(');
    expect(BEAD_FS).toContain('envRadiance(R, uRoughLiquid, P, n)');
  });
  it('the shadowed Sun term is the envRadiance Sun term, verbatim (drift guard)', () => {
    expect(HG_ENV_GLSL).toContain(SUN_TERM_GLSL);
    expect(BEAD_FS).toContain(SUN_TERM_GLSL);
  });
  it('a sphere impostor: disc discard, view normal to world, sub-pixel beads by coverage', () => {
    expect(BEAD_FS).toContain('if (d2 > 1.0) discard;');
    expect(BEAD_FS).toContain('transpose(mat3(viewMatrix))');
    expect(BEAD_VS).toContain(`max(px, ${BEAD_MIN_PX.toFixed(1)})`);
  });
  it('draws after the droplets, depth-tested, never writes depth', () => {
    expect(BEAD_RENDER_ORDER).toBeGreaterThan(DROPLET_RENDER_ORDER);
    expect(BEAD_MATERIAL).toEqual({
      transparent: true, depthTest: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    });
    expect(Object.isFrozen(BEAD_MATERIAL)).toBe(true);
  });
  it('premultiplied output: a scaled-down body occluder plus an analytic additive sun glint', () => {
    expect(BEAD_FS).toContain('fragColor = vec4(srgb * aBody + glint, aBody);');
    expect(BEAD_FS).toContain('normalize(Vc + uSunDir)');
    expect(BEAD_UNIFORMS_OWN).toContain('uBeadSparkle');
  });
});
