// src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_VS, PLANET_FS, PLANET_UNIFORMS, PLANET_BUILTINS, DEM_LSB_M } from '../mercuryPlanetShader';
import { glf, v3 } from '../../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
  SHADOW_SOFT_LSB, SHADOW_BIAS_LSB, HG_F0, ROUGH_LIQUID, ROUGH_BOIL, SOLID_HG_ALBEDO,
  SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
  FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
  EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  AETHER_DIFFUSE, AETHER_DIFFUSE_REF_LOBES, NIGHT_TINT, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
} from '../planetLook';
import { AETHER_LOBES, AETHER_SHAPES } from '../aetherLobes';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from '../mercuryThermal';
import { DEM_MIN_M, DEM_MAX_M } from '../mercuryMaps.generated';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);

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
      HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
      ROUGH_LIQUID, ROUGH_BOIL, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
      FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
      EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
      AETHER_DIFFUSE, AETHER_DIFFUSE_REF_LOBES, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
    })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const vec3 HG_F0 = ${v3(HG_F0)};`);
    expect(PLANET_FS).toContain(`const vec3 SOLID_HG_ALBEDO = ${v3(SOLID_HG_ALBEDO)};`);
    expect(PLANET_FS).toContain(`const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};`);
    expect(PLANET_FS).toContain(`const int AETHER_LOBES = ${AETHER_LOBES};`);
    expect(PLANET_FS).toContain(`const int SHADOW_STEPS = ${SHADOW_STEPS};`);
    expect(PLANET_VS).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
  });

  it('DEM_LSB_M is one 8-bit DEM step in true metres', () => {
    expect(DEM_LSB_M).toBe((DEM_MAX_M - DEM_MIN_M) / 255);
  });

  it('scales shadow softness and bias with relief', () => {
    expect(PLANET_FS).toMatch(/float soft = [^;]*\* max\(uRelief, 1e-3\);/);
    expect(PLANET_FS).toMatch(/float bias = [^;]*\* uRelief;/);
  });

  it('never lets the liquid mirror go sharper than roughness 0.14; front softness < half its edge', () => {
    expect(ROUGH_LIQUID).toBeGreaterThanOrEqual(0.14);
    expect(FRONT_SOFT).toBeLessThan(FRONT_EDGE / 2);
  });

  it('rotates by the body matrix, reflects four emitters, and mirrors the thermal model', () => {
    expect(PLANET_FS).toContain('uniform mat3 uBodyRot;');
    expect(PLANET_FS).toContain('uniform vec3 uEmitPos[4];');
    expect(PLANET_FS).toContain('uniform vec3 uEmitCol[4];');
    expect(PLANET_FS).toContain('vec3 nb = ng * uBodyRot;');
    expect(PLANET_FS).toMatch(/float surfaceTempK\(float mu0, float lonRel, float cosLat, float tss, float heatK\)/);
    expect(PLANET_FS).not.toMatch(/uBodyYaw/);
  });

  it('writes depth and never uses reserved or unsafe constructs', () => {
    expect(PLANET_FS).toContain('gl_FragDepth');
    for (const s of [PLANET_VS, PLANET_FS]) {
      expect(s).not.toMatch(/\bhalf\b/);
      expect(s).not.toMatch(/gl_FragColor/);
    }
  });

  it('reflects the aether as AETHER_LOBES soft lobes, attenuated on the night side by the surface normal', () => {
    expect(PLANET_FS).toContain(`uniform vec3 uAethDir[${AETHER_LOBES}];`);
    expect(PLANET_FS).toContain(`uniform vec3 uAethCol[${AETHER_LOBES}];`);
    expect(PLANET_FS).toContain('uniform float uAetherGain;');
    expect(PLANET_FS).toMatch(/float dayW = smoothstep\(AETHER_DAY_LO, AETHER_DAY_HI, dot\(nW, uSunDir\)\);/);
    expect(PLANET_FS).toContain('uniform float uAetherEdge;');
    expect(PLANET_FS).toContain('uniform float uAetherStretch;');
    expect(PLANET_FS).toContain('vec2 aetherStreak(vec3 R, vec3 d, vec2 shape, float rough) {');
    expect(PLANET_FS).toContain('float silhouette = exp(-pow(d2, max(uAetherEdge, 0.5)));');
    expect(PLANET_FS).toContain('float body = exp(-uAetherCurve * d2);');
    expect(PLANET_FS).toContain('return mix(vec3(peak * uAetherCore), aetherHue(col), f);');
    expect(PLANET_FS).toContain('a += aetherStreakColor(uAethCol[i], s.y) * s.x;');
    expect(PLANET_FS).toContain('uniform float uAetherCurve;');
    expect(PLANET_FS).toContain('uniform float uAetherCore;');
    expect(PLANET_FS).toContain(`const vec2 AETHER_SHAPE[${AETHER_LOBES}] = vec2[${AETHER_LOBES}](${AETHER_SHAPES.map(([w, s]) => `vec2(${glf(w)}, ${glf(s)})`).join(', ')});`);
    expect(PLANET_FS).toContain('uniform float uAetherSinW;');
    expect(PLANET_FS).toContain('uniform float uAetherSilver;');
    expect(PLANET_FS).toContain('return mix(col, vec3(l), uAetherSilver);');
    expect(PLANET_FS).not.toMatch(/AETHER_SIN_W/);
    expect(PLANET_FS).toMatch(/liquid = F \* envRadiance\(R, [^;]*, hit, nW\);/);
    expect(PLANET_FS).toMatch(/\+ aetherDiffuse\(nW\)/);
    expect(PLANET_FS).toContain('return c + aetherTint(nW) * aetherShoulder(uAetherGain * a);');
    expect(PLANET_FS).toContain('return uAetherGain * AETHER_DIFFUSE * aetherTint(nW) * a * (AETHER_DIFFUSE_REF_LOBES / float(AETHER_LOBES));');
  });

  it('mirrors mirrorLobes.js: same lobe and soft shoulder maths; the Sun goes through the shoulder', () => {
    expect(PLANET_FS).toContain('return (sinR * sinR / w2) * exp(-a * a / w2);');
    expect(PLANET_FS).toContain('float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }');
    expect(PLANET_FS).toMatch(/softShoulder\(uSunGlint \* uSunIrr \* uExposure \* lobe\(dot\(R, uSunDir\), uSunSinR, rough\), SUN_SHOULDER\)/);
  });

  it('widens and horizon-masks the element reflections', () => {
    expect(PLANET_FS).toContain('float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);');
    expect(PLANET_FS).toMatch(/smoothstep\(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot\(nW, dir\)\)/);
  });

  it('guards the Sun longitude at the body pole and gates facet sparkle by the terminator', () => {
    expect(PLANET_FS).toContain('float lonSun = length(Lb.xz) > 1e-4 ? atan(-Lb.z, Lb.x) : 0.0;');
    expect(PLANET_FS).toMatch(/float glint = [^;]*\* term;/);
  });

  it('runs the liquid branch only inside the front, and each phase only where it shows', () => {
    expect(PLANET_FS).toContain('if (fluid > 0.0) {');
    expect(PLANET_FS).toContain('if (liquidW > 0.0) {');
    expect(PLANET_FS).toContain('if (liquidW < 1.0) {');
  });
});
