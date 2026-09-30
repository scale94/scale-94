// src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_VS, PLANET_FS, PLANET_UNIFORMS, PLANET_BUILTINS, DEM_LSB_M } from '../mercuryPlanetShader';
import { glf } from '../../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
  SHADOW_SOFT_LSB, SHADOW_BIAS_LSB,
} from '../planetLook';
import { DEM_MIN_M, DEM_MAX_M } from '../mercuryMaps.generated';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+);/gm)].map((m) => m[1]);

describe('mercuryPlanetShader contract', () => {
  it('is raw GLSL 3 for three: no #version (three prepends it), no #include', () => {
    for (const s of [PLANET_VS, PLANET_FS]) {
      expect(s).not.toMatch(/#version/);
      expect(s).not.toMatch(/#include/);
    }
    expect(PLANET_VS).toMatch(/^in vec3 position;/m);
    expect(PLANET_FS).toMatch(/out vec4 fragColor;/);
  });

  it('declares exactly PLANET_UNIFORMS plus three built-ins in the fragment stage', () => {
    const fs = declared(PLANET_FS).filter((u) => !PLANET_BUILTINS.includes(u));
    expect([...fs].sort()).toEqual([...PLANET_UNIFORMS].sort());
    expect(new Set(declared(PLANET_FS)).size).toBe(declared(PLANET_FS).length);
  });

  it('interpolates every physical constant from its JS owner', () => {
    for (const [name, value] of Object.entries({
      R_SCENE, R_MERCURY_M, DEM_MIN_M, DEM_MAX_M, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
      SHADOW_SOFT_LSB, SHADOW_BIAS_LSB, DEM_LSB_M,
    })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const int SHADOW_STEPS = ${SHADOW_STEPS};`);
    expect(PLANET_VS).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
  });

  it('DEM_LSB_M is one 8-bit DEM step in true metres', () => {
    expect(DEM_LSB_M).toBe((DEM_MAX_M - DEM_MIN_M) / 255);
  });

  it('scales shadow softness and bias with relief', () => {
    expect(PLANET_FS).toMatch(/float soft = [^;]*\* uRelief;/);
    expect(PLANET_FS).toMatch(/float bias = [^;]*\* uRelief;/);
  });

  it('writes depth and never uses reserved or unsafe constructs', () => {
    expect(PLANET_FS).toContain('gl_FragDepth');
    for (const s of [PLANET_VS, PLANET_FS]) {
      expect(s).not.toMatch(/\bhalf\b/);
      expect(s).not.toMatch(/gl_FragColor/);
    }
  });
});
