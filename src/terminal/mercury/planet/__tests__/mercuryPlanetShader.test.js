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
import { SCAR_DEPTH_RANGE_M } from '../scarMap';
import { RAY_ALBEDO } from '../planetLook';
import {
  IMPULSE_SLOTS, SHAPE_MAX, SHAPE_ITERS, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, WAVE_PACKET_RAD, WAVE_SPREAD_FLOOR,
  WAVE_KR_FINE, WAVE_C_PHASE_FINE, WAVE_C_GROUP_FINE, WAVE_FINE_W,
} from '../mercuryWaves';

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
    expect(PLANET_FS).toContain('float lonSun = length(uSunDir.xz) > 1e-4 ? atan(-uSunDir.z, uSunDir.x) : 0.0;');
    expect(PLANET_FS).toMatch(/float glint = [^;]*\* term;/);
  });

  it('runs the liquid branch only inside the front, and each phase only where it shows', () => {
    expect(PLANET_FS).toContain('if (fluid > 0.0) {');
    expect(PLANET_FS).toContain('if (liquidW > 0.0) {');
    expect(PLANET_FS).toContain('if (liquidW < 1.0) {');
  });

  it('adds the scar map to the terrain height (so craters cast shadows) and fresh rays to the albedo', () => {
    expect(PLANET_UNIFORMS).toEqual(expect.arrayContaining(['uScar', 'uRayGain']));
    expect(PLANET_FS).toContain(`const float SCAR_DEPTH_RANGE_M = ${glf(SCAR_DEPTH_RANGE_M)};`);
    expect(PLANET_FS).toContain(`const vec3 RAY_ALBEDO = ${v3(RAY_ALBEDO)};`);
    expect(PLANET_FS).toContain('return (textureGrad(uScar, vec2(fract(uv.x), uv.y), gx, gy).r * 255.0 - 128.0) / 127.0 * SCAR_DEPTH_RANGE_M;');
    expect(PLANET_FS).toContain('return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r) + scarHeightM(uv, gx, gy);');
    expect(PLANET_FS).toContain('albedo = mix(albedo, RAY_ALBEDO, clamp(textureGrad(uScar, uv, gx, gy).g * uRayGain, 0.0, 1.0));');
  });

  it('moves the bead: modes + bulge reshape the silhouette, ripples tilt the normal; constants from mercuryWaves', () => {
    expect(PLANET_UNIFORMS).toEqual(expect.arrayContaining(['uSurfOn', 'uImpDir', 'uImpMode', 'uImpWave', 'uBulge']));
    expect(PLANET_FS).toContain(`uniform vec3 uImpDir[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`uniform vec3 uImpMode[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`uniform vec2 uImpWave[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`const int IMPULSE_SLOTS = ${IMPULSE_SLOTS};`);
    expect(PLANET_FS).toContain(`const int SHAPE_ITERS = ${SHAPE_ITERS};`);
    for (const [name, value] of Object.entries({ SHAPE_MAX, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, WAVE_PACKET_RAD, WAVE_SPREAD_FLOOR, WAVE_KR_FINE, WAVE_C_PHASE_FINE, WAVE_C_GROUP_FINE, WAVE_FINE_W })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_VS).toContain(`const float SHAPE_MAX = ${glf(SHAPE_MAX)};`);
    expect(PLANET_VS).toContain('float rb = R_SCENE * (1.0 + SHAPE_MAX);');
  });

  it('mirrors mercuryWaves: Legendre P2..P4, their derivatives, and shapeHeight', () => {
    expect(PLANET_FS).toContain('float P2(float m) { return 0.5 * (3.0 * m * m - 1.0); }');
    expect(PLANET_FS).toContain('float P3(float m) { return 0.5 * (5.0 * m * m * m - 3.0 * m); }');
    expect(PLANET_FS).toContain('float P4(float m) { float m2 = m * m; return 0.125 * (35.0 * m2 * m2 - 30.0 * m2 + 3.0); }');
    expect(PLANET_FS).toContain('float dP2(float m) { return 3.0 * m; }');
    expect(PLANET_FS).toContain('float dP3(float m) { return 0.5 * (15.0 * m * m - 3.0); }');
    expect(PLANET_FS).toContain('float dP4(float m) { return 0.5 * (35.0 * m * m * m - 15.0 * m); }');
    expect(PLANET_FS).toContain('float h = uBulge.w * P2(dot(x, uBulge.xyz));');
    expect(PLANET_FS).toContain('h += dot(uImpMode[i], vec3(P2(m), P3(m), P4(m)));');
    expect(PLANET_FS).toContain('return clamp(h, -SHAPE_MAX, SHAPE_MAX);');
  });

  it('a still bead is the phase-2 sphere: shape gated by uSurfOn, silhouette from the closest-approach radius', () => {
    expect(PLANET_FS).toContain('if (uSurfOn < 0.5) return 0.0;');
    expect(PLANET_FS).toContain('float rl = R_SCENE * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));');
    expect(PLANET_FS).toContain('float disc = b * b - (dot(ro, ro) - rl * rl);');
    expect(PLANET_FS).toContain('for (int k = 0; k < SHAPE_ITERS; k++) {');
    expect(PLANET_FS).toContain('vec3 ng = normalize(xw - shapeGrad(xw) / (1.0 + shapeH(xw)));');
    expect(PLANET_FS).toContain('vec3 xb = xw * uBodyRot;');
    expect(PLANET_FS).toContain('float lat = asin(clamp(xb.y, -1.0, 1.0));');
    expect(PLANET_FS).toContain('float lon = atan(-xb.z, xb.x);');
  });

  it('the front and temperature follow the material point (xb); the ripples tilt the fluid normal', () => {
    expect(PLANET_FS).toContain('float mu0x = dot(xb, Lb);');
    expect(PLANET_FS).toContain('float front = 1.0 - acos(clamp(mu0x, -1.0, 1.0)) / PI;');
    expect(PLANET_FS).toContain('float edgeN = (vnoise3(xb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;');
    // Temperature in the world frame (rest spin axis = world Y): a tumbled body never reads sunlit metal as night.
    expect(PLANET_FS).toContain('float lonRel = mod(atan(-xw.z, xw.x) - lonSun + PI, TAU) - PI;');
    expect(PLANET_FS).toContain('float T = surfaceTempK(mu0x, lonRel, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK);');
    expect(PLANET_FS).toContain('float u = (th - cG * age) / WAVE_PACKET_RAD;');
    expect(PLANET_FS).toContain('return exp(-u * u) * sin(k * (th - cP * age));');
    expect(PLANET_FS).toContain('float slope = A * (aaMain * ripple(th, age, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP) + aaFine * ripple(th, age, WAVE_KR_FINE, WAVE_C_PHASE_FINE, WAVE_C_GROUP_FINE)) * sqrt(WAVE_SPREAD_FLOOR / max(s, WAVE_SPREAD_FLOOR));');
    // each band fades where its crests would fall under a few pixels (no limb aliasing)
    expect(PLANET_FS).toContain('float bandAA(float k, float pxArc) { return smoothstep(2.5, 5.0, TAU / (k * max(pxArc, 1e-6))); }');
    expect(PLANET_FS).toContain('float pxArc = length(fwidth(xw));');
    expect(PLANET_FS).toContain('nW = normalize(nW - fluid * waveTilt(xw, pxArc));');
  });

  it('keeps every derivative before the first loop and the discard', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const firstLoop = main.indexOf('for (');
    const lastDeriv = Math.max(main.lastIndexOf('fwidth('), main.lastIndexOf('dFdx('), main.lastIndexOf('dFdy('));
    expect(lastDeriv).toBeLessThan(main.search(/\bdiscard;/));
    // the shape refinement loop is uniform control flow; derivatives may follow it,
    // but none may appear inside helper loops that use continue:
    const waveFn = PLANET_FS.slice(PLANET_FS.indexOf('float ripple('), PLANET_FS.indexOf('void main()'));
    expect(waveFn).not.toMatch(/dFd[xy]|fwidth/);
    expect(firstLoop).toBeGreaterThan(-1);
  });
});
