// src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_FS, PLANET_UNIFORMS } from '../mercuryPlanetShader';
import {
  HG_MIRROR_UNIFORMS, HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHAPE_GLSL,
} from '../hgMirrorGlsl';

describe('hgMirrorGlsl — one mirror for the planet and its droplets', () => {
  it('the planet shader is built from the shared chunks, verbatim', () => {
    expect(PLANET_FS).toContain(HG_FRESNEL_GLSL);
    expect(PLANET_FS).toContain(HG_ENV_GLSL);
    expect(PLANET_FS).toContain(AETHER_SHAPE_GLSL);
  });

  it('every declaration the chunks need is a line of the planet shader (no drift)', () => {
    const lines = new Set(PLANET_FS.split('\n'));
    for (const l of HG_MIRROR_DECLS_GLSL.split('\n')) expect(lines.has(l), l).toBe(true);
  });

  it('the shared uniforms are planet uniforms (the droplets share their objects)', () => {
    for (const u of HG_MIRROR_UNIFORMS) expect(PLANET_UNIFORMS).toContain(u);
    for (const u of HG_MIRROR_UNIFORMS) expect(HG_MIRROR_DECLS_GLSL).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });

  it('every uniform the declarations name is a shared uniform (the reverse: none is left unbound)', () => {
    const declared = [...HG_MIRROR_DECLS_GLSL.matchAll(/uniform \w+ (\w+)[[;]/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    for (const u of declared) expect(HG_MIRROR_UNIFORMS, u).toContain(u);
  });

  it('defines the two entry points', () => {
    expect(HG_FRESNEL_GLSL).toContain('vec3 fresnelHg(float cosI) {');
    expect(HG_ENV_GLSL).toContain('vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {');
  });
});
