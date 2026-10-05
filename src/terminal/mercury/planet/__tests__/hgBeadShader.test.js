// src/terminal/mercury/planet/__tests__/hgBeadShader.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BEAD_VS, BEAD_FS, BEAD_MATERIAL, BEAD_RENDER_ORDER, BEAD_MIN_PX, SUN_TERM_GLSL, BEAD_UNIFORMS_OWN, BEAD_GLINT_MAX, DUST_GLINT_MAX, DUST_SIZE_FLOOR } from '../hgBeadShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from '../hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from '../aetherLight';
import { DROPLET_RENDER_ORDER } from '../dropletShader';
import { glf } from '../../../gl/glf';

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
  it('premultiplied output: a pearl-only body occluder plus an additive, gated sun glint', () => {
    expect(BEAD_FS).toContain('fragColor = vec4(srgb * aBody + glint, aBody);');
    expect(BEAD_FS).toContain('normalize(Vc + uSunDir)');
    expect(BEAD_FS).toContain('vec3 F = fresnelHg(dot(H, Vc)) * sh;'); // fresnelHg is vec3: a float G did not compile (live, 2026-10-05)
    expect(BEAD_FS).toContain('vec3 G = mix(min(dustGain * F, vec3(');
    expect(BEAD_UNIFORMS_OWN).toContain('uBeadSparkle');
    expect(BEAD_UNIFORMS_OWN).toContain('uDustSparkle');
  });
  it('dust (< 2 px) has no body and a gated glint; pearls (> 4 px) keep the body and a steady glint', () => {
    expect(BEAD_VS).toContain('vGate = aBead.z;');
    expect(BEAD_FS).toContain('float kPearl = smoothstep(2.0, 4.0, vPx);');
    expect(BEAD_FS).toContain('float aBody = vA * vCover * vCover * edgeK * kPearl;');
    expect(BEAD_FS).toContain('float dustGain = uDustSparkle * vGate * sizeW;');
    expect(BEAD_FS).toContain('float pearlGain = uBeadSparkle * mix(0.85, 1.0, vGate);');
    expect(BEAD_FS).not.toContain('bodyK');
  });
  it('dust has its own glint cap, above the pearls\' (headroom to punch through a bright nebula)', () => {
    expect(DUST_GLINT_MAX).toBeGreaterThan(BEAD_GLINT_MAX);
    expect(BEAD_FS).toContain(`vec3 G = mix(min(dustGain * F, vec3(${glf(DUST_GLINT_MAX)})), min(pearlGain * F, vec3(${glf(BEAD_GLINT_MAX)})), kPearl);`);
  });
  it('dust glint scales with projected area (vCover²), floored so the smallest specks still shimmer', () => {
    expect(DUST_SIZE_FLOOR).toBeGreaterThan(0);
    expect(DUST_SIZE_FLOOR).toBeLessThan(1);
    expect(BEAD_FS).toContain(`float sizeW = mix(${glf(DUST_SIZE_FLOOR)}, 1.0, vCover * vCover);`);
  });
  it('one glint on a resolved pearl: the analytic glint fades out 4 -> 6 px', () => {
    expect(BEAD_FS).toContain('float unresolved = 1.0 - smoothstep(4.0, 6.0, vPx);');
    expect(BEAD_FS).toContain('vec3 glint = G * (w * vA * unresolved);');
  });
  it('aBead carries (radius, alpha, glint gate)', () => {
    expect(BEAD_VS).toContain('attribute vec3 aBead;');
  });
});
