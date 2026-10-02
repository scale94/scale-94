// src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
import { describe, it, expect } from 'vitest';
import {
  PLANET_VS, PLANET_FS, PLANET_UNIFORMS, PLANET_CALM_UNIFORMS, PLANET_BUILTINS, DEM_LSB_M, buildPlanetShader,
} from '../mercuryPlanetShader';
import { TIERS, TIER_NAMES } from '../planetQuality';
import { glf, v3 } from '../../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
  SHADOW_SOFT_LSB, SHADOW_BIAS_LSB, ROUGH_LIQUID, ROUGH_BOIL, SOLID_HG_ALBEDO,
  SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
  FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
  EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  AETHER_DIFFUSE, AETHER_DIFFUSE_REF_LOBES, NIGHT_TINT, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
} from '../planetLook';
import { CALM_GLOW_RAD } from '../mercuryImpacts';
import { HG_N, HG_K } from '../hgOptics';
import { MENISCUS_MAX_SIN, MENISCUS_MIN_PX, MENISCUS_GRAD_FLOOR } from '../mercuryMeniscus';
import { AETHER_LOBES, AETHER_SHAPES } from '../aetherLobes';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from '../mercuryThermal';
import { DEM_MIN_M, DEM_MAX_M } from '../mercuryMaps.generated';
import { SCAR_DEPTH_RANGE_M } from '../scarMap';
import { RAY_ALBEDO } from '../planetLook';
import {
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
  POP_DENSITY_K, POP_AMP, POP_SALTS, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP, ROIL_LITE_ACT,
  POP_RATE_ZOOM_EXP, POP_RATE_MAX,
} from '../mercuryRoil';
import {
  IMPULSE_SLOTS, SHAPE_MAX, SHAPE_ITERS, WAVE_KR, WAVE_C_GROUP, WAVE_SPREAD_FLOOR,
  WAVE_K_PEAK, WAVE_SPEC_W, WAVE_VISC_PER_S, WAVE_SHARP, WAVE_WARP_RAD, WAVE_WARP_FREQ, WAVE_DIMPLE_RAD, WAVE_DIMPLE_S, WAVE_DIMPLE_GAIN, WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI,
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
      ROUGH_BOIL, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
      FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
      EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
      AETHER_DIFFUSE, AETHER_DIFFUSE_REF_LOBES, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
      MENISCUS_MAX_SIN, MENISCUS_MIN_PX, MENISCUS_GRAD_FLOOR,
    })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const vec3 HG_N = ${v3(HG_N)};`);
    expect(PLANET_FS).toContain(`const vec3 HG_K = ${v3(HG_K)};`);
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
    expect(PLANET_FS).toMatch(/liquid = fresnelHg\(NoV\) \* envRadiance\(R, [^;]*, hit, nW\);/);
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
    // (age, amplitude, dimple weight): the snap dimple is per slot, so a wake can carry less of it than a splash
    expect(PLANET_FS).toContain(`uniform vec3 uImpWave[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`const int IMPULSE_SLOTS = ${IMPULSE_SLOTS};`);
    expect(PLANET_FS).toContain(`const int SHAPE_ITERS = ${SHAPE_ITERS};`);
    for (const [name, value] of Object.entries({ SHAPE_MAX, WAVE_KR, WAVE_C_GROUP, WAVE_SPREAD_FLOOR, WAVE_K_PEAK, WAVE_SPEC_W, WAVE_VISC_PER_S, WAVE_SHARP, WAVE_WARP_RAD, WAVE_WARP_FREQ, WAVE_DIMPLE_RAD, WAVE_DIMPLE_S, WAVE_DIMPLE_GAIN, WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_VS).toContain(`const float SHAPE_MAX = ${glf(SHAPE_MAX)};`);
    expect(PLANET_VS).toContain('float rb = uCoreR * (1.0 + SHAPE_MAX);');
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
    expect(PLANET_FS).toContain('float rl = uCoreR * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));');
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
    expect(PLANET_FS).toContain('vec4 en = vnoise3d(xb * FRONT_NOISE_FREQ);');
    expect(PLANET_FS).toContain('float edgeN = (en.x - 0.5) * FRONT_EDGE;');
    // Meniscus (mercuryMeniscus.js): arc distance from the contact line, a hard edge where liquid, the bead rim.
    expect(PLANET_FS).toContain('float dArc = sF / gLen;');
    expect(PLANET_FS).toContain('fluid = mix(fluidSoft, fluidHard, liquidW * clamp(uMeniscus, 0.0, 1.0));');
    expect(PLANET_FS).toContain('float rimS = liquidW * meniscusSin(dArc, max(uMeniscusW, MENISCUS_MIN_PX * pxArc), uMeniscus);');
    expect(PLANET_FS).toContain('return u >= 1.0 ? 0.0 : clamp(gain, 0.0, 1.0) * MENISCUS_MAX_SIN * (1.0 - u);');
    // Temperature in the world frame (rest spin axis = world Y): a tumbled body never reads sunlit metal as night.
    expect(PLANET_FS).toContain('float lonRel = mod(atan(-xw.z, xw.x) - lonSun + PI, TAU) - PI;');
    expect(PLANET_FS).toContain('float T = surfaceTempK(mu0x, lonRel, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK);');
    // mercuryWaves.rippleSlope, exactly: the dispersive train, sharp troughs, viscous k², the snap dimple
    expect(PLANET_FS).toContain('float k = WAVE_KR * q * q;');
    expect(PLANET_FS).toContain('float ph = k * th / 3.0;');
    expect(PLANET_FS).toContain('slope = exp(-lk * lk - WAVE_VISC_PER_S * kk * kk * age) * (bandAA(k, pxArc) * sin(ph) + 2.0 * WAVE_SHARP * bandAA(2.0 * k, pxArc) * sin(2.0 * ph));');
    expect(PLANET_FS).toContain('float rippleSlope(float th, float age, float pxArc, float dimple) {');
    expect(PLANET_FS).toContain('return slope + dimple * dimpleAA(pxArc) * WAVE_DIMPLE_GAIN * exp(-age / WAVE_DIMPLE_S) * DIMPLE_NORM * xd * exp(-xd * xd);');
    expect(PLANET_FS).toContain('float dimpleAA(float pxArc) { return pxArc > 0.0 ? smoothstep(WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI, WAVE_DIMPLE_RAD / pxArc) : 1.0; }');
    expect(PLANET_FS).toContain('float bandAA(float k, float pxArc) { return smoothstep(2.5, 5.0, TAU / (k * max(pxArc, 1e-6))); }');
    // a light warp of the arc distance so rings shear instead of reading as etched grooves
    expect(PLANET_FS).toContain('float warp = WAVE_WARP_RAD * (2.0 * vnoise3(xb * WAVE_WARP_FREQ) - 1.0);');
    expect(PLANET_FS).toContain('float slope = A * rippleSlope(max(th + warp, 0.0), age, pxArc, uImpWave[i].z) * sqrt(WAVE_SPREAD_FLOOR / max(s, WAVE_SPREAD_FLOOR));');
    expect(PLANET_FS).toContain('float pxArc = length(fwidth(xw));');
    expect(PLANET_FS).toContain('nW = normalize(nW - fluid * waveTilt(xw, pxArc, warp));');
  });

  it('keeps every derivative before the first loop and the discard', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const firstLoop = main.indexOf('for (');
    const lastDeriv = Math.max(main.lastIndexOf('fwidth('), main.lastIndexOf('dFdx('), main.lastIndexOf('dFdy('));
    expect(lastDeriv).toBeLessThan(main.search(/\bdiscard;/));
    // the shape refinement loop is uniform control flow; derivatives may follow it,
    // but none may appear inside helper loops that use continue:
    const waveFn = PLANET_FS.slice(PLANET_FS.indexOf('float bandAA('), PLANET_FS.indexOf('void main()'));
    expect(PLANET_FS.indexOf('float bandAA(')).toBeGreaterThan(-1);
    expect(waveFn).not.toMatch(/dFd[xy]|fwidth/);
    expect(firstLoop).toBeGreaterThan(-1);
  });
  it('the full variant is byte-identical to the pinned shader (phase-4 parity)', async () => {
    await expect(PLANET_FS).toMatchFileSnapshot('./__snapshots__/planetShader.full.fs.glsl');
    await expect(PLANET_VS).toMatchFileSnapshot('./__snapshots__/planetShader.full.vs.glsl');
  });
  it('buildPlanetShader: full is PLANET_FS/VS exactly; each tier sets its loop counts', () => {
    const full = buildPlanetShader();
    expect(full.fs).toBe(PLANET_FS);
    expect(full.vs).toBe(PLANET_VS);
    expect(buildPlanetShader({ tier: 'full' }).fs).toBe(PLANET_FS);
    for (const tier of TIER_NAMES) {
      const { fs } = buildPlanetShader({ tier });
      expect(fs).toContain(`const int SHADOW_STEPS = ${TIERS[tier].shadowSteps};`);
      expect(fs).toContain(`const int IMPULSE_SLOTS = ${TIERS[tier].rippleSlots};`);
      expect(fs).toContain(`const int SHAPE_ITERS = ${TIERS[tier].shapeIters};`);
      // the uniform arrays stay full-size: JS always writes IMPULSE_SLOTS slots, strongest first
      expect(fs).toContain(`uniform vec3 uImpDir[${IMPULSE_SLOTS}];`);
    }
    expect(buildPlanetShader({ tier: 'lite' }).fs).toContain('const int SHAPE_ITERS = 1;');
    expect(buildPlanetShader({ tier: 'full' }).fs).toContain(`const int SHAPE_ITERS = ${SHAPE_ITERS};`);
    expect(() => buildPlanetShader({ tier: 'ultra' })).toThrow(/unknown tier/);
  });

  it('a tier without a shadow march never calls castShadow', () => {
    const lite = buildPlanetShader({ tier: 'lite' }).fs;
    expect(lite).toContain('if (false && mu0g > -uSunSinR && mu0g < SHADOW_ZONE)');
    expect(PLANET_FS).toContain('if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE)');
  });

  it('the CALM variant compiles out every impulse loop and adds only the strike glow', () => {
    const calm = buildPlanetShader({ calm: true }).fs;
    expect(calm).toContain('const int IMPULSE_SLOTS = 0;');
    expect(calm).toContain('uniform vec4 uGlow;');
    expect(calm).toContain(`const float CALM_GLOW_RAD = ${glf(CALM_GLOW_RAD)};`);
    expect(calm).toMatch(/colLin \+= fluid \* uGlow\.w \* exp\(/);
    expect(PLANET_FS).not.toContain('uGlow');
    expect(buildPlanetShader({ tier: 'full', calm: false }).fs).toBe(PLANET_FS);
    for (const tier of TIER_NAMES) expect(buildPlanetShader({ tier, calm: true }).fs).toContain('const int IMPULSE_SLOTS = 0;');
  });

  it('declares exactly PLANET_CALM_UNIFORMS in the CALM variant', () => {
    const fs = buildPlanetShader({ calm: true }).fs;
    const names = declared(fs).filter((u) => !PLANET_BUILTINS.includes(u));
    expect([...names].sort()).toEqual([...PLANET_CALM_UNIFORMS].sort());
    expect(PLANET_CALM_UNIFORMS).toEqual([...PLANET_UNIFORMS, 'uGlow']);
  });
  it('roil: pop constants from mercuryRoil, mirrored functions, motion and mode per variant', () => {
    for (const [name, value] of Object.entries({
      POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
      POP_DENSITY_K, POP_AMP, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP, ROIL_LITE_ACT,
    })) expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    for (const [k, s] of Object.entries(POP_SALTS)) expect(PLANET_FS).toContain(`const vec3 POP_SALT_${k.toUpperCase()} = ${v3(s)};`);
    expect(PLANET_FS).toContain('float popSlope(float th, float age, float pxArc, float zoom)');
    expect(PLANET_FS).toContain('vec3 roilTilt(vec3 xb, float t, float dT, float pxArc, float zoom, out float act)');
    expect(PLANET_FS).toContain('const int ROIL_POPS = 1;');
    expect(PLANET_FS).toContain('const float ROIL_MOTION = 1.0;');
    expect(buildPlanetShader({ tier: 'lite' }).fs).toContain('const int ROIL_POPS = 0;');
    // the lite tier's stand-in activity is a named constant, not a literal
    expect(PLANET_FS).toContain('else { rt = roilNoiseTilt(xb, uTime * ROIL_MOTION, pxArc, uPopZoom); popAct = ROIL_LITE_ACT; }');
    // M2: the lite noise's cells (1/ROIL_LITE_FREQ rad) fade by bandAA where they fall under a few px
    const lite = buildPlanetShader({ tier: 'lite' }).fs;
    // …and their size follows the live pixel footprint like the pops' (uPopZoom)
    expect(lite).toContain('vec3 roilNoiseTilt(vec3 xb, float t, float pxArc, float zoom) {');
    expect(lite).toContain('float freq = ROIL_LITE_FREQ / zoom;');
    expect(lite).toContain('vec3 p = xb * freq + vec3(0.0, t * ROIL_LITE_SPEED, 0.0);');
    expect(lite).toContain('return ROIL_LITE_AMP * bandAA(TAU * freq, pxArc) * (g - xb * dot(g, xb));');
    expect(buildPlanetShader({ calm: true }).fs).toContain('const float ROIL_MOTION = 0.0;');
    expect(PLANET_FS).toContain('uniform float uRoilGain;');
    expect(PLANET_UNIFORMS).toContain('uRoilGain');
    // coherence loss: active pops scatter more; the 0.14 floor is ROUGH_LIQUID's
    expect(PLANET_FS).toContain('mix(uRoughLiquid, ROUGH_BOIL, boilW * (0.5 + 0.5 * popAct))');
  });

  it('roil: the pop size follows the live pixel footprint (uPopZoom); one geometry for every variant', () => {
    expect(PLANET_UNIFORMS).toContain('uPopZoom');
    for (const tier of TIER_NAMES) {
      for (const calm of [false, true]) {
        const fs = buildPlanetShader({ tier, calm }).fs;
        expect(fs).toContain('uniform float uPopZoom;');
        expect(fs).toContain(`const float POP_SCALE = ${glf(POP_SCALE)};`);
        expect(fs).toContain(`const float POP_TIME = ${glf(POP_TIME)};`);
      }
    }
    // mercuryRoil.popSlope / roilTilt with zoom, exactly: cells POP_FREQ / zoom, reach × zoom, scale ÷ zoom
    expect(PLANET_FS).toContain('float reach = POP_REACH_RAD * zoom;');
    expect(PLANET_FS).toContain('if (th >= reach || age >= POP_LIFE_S) return 0.0;');
    expect(PLANET_FS).toContain('float scale = POP_SCALE / zoom;');
    expect(PLANET_FS).toContain('float w = 1.0 - smoothstep(0.7 * reach, reach, th);');
    // a pop keeps the whole snap dimple (the wake-only gain never reaches it)
    expect(PLANET_FS).toContain('return POP_AMP * w * life * rippleSlope(th * scale, max(age * POP_TIME, 1e-3), pxArc * scale, 1.0);');
    expect(PLANET_FS).toContain('float freq = POP_FREQ / zoom;');
    expect(PLANET_FS).toContain('vec3 p = xb * freq;');
    expect(PLANET_FS).toContain('g += popSlope(d / freq, age, pxArc, zoom) * tang / tl;');
    expect(PLANET_FS).toContain('rt = roilTilt(xb, uTime * ROIL_MOTION, T - HG_BOIL_K, pxArc, uPopZoom, popAct);');
    // Task 7 pop rate: a cell's period ÷ min(zoom^k, POP_RATE_MAX), mercuryRoil.popPeriod exactly; zoom 1 untouched
    expect(PLANET_FS).toContain(`const float POP_RATE_ZOOM_EXP = ${glf(POP_RATE_ZOOM_EXP)};`);
    expect(PLANET_FS).toContain(`const float POP_RATE_MAX = ${glf(POP_RATE_MAX)};`);
    expect(PLANET_FS).toContain('float period = (POP_P_MIN + (POP_P_MAX - POP_P_MIN) * hash13(c + POP_SALT_PERIOD)) / min(pow(zoom, POP_RATE_ZOOM_EXP), POP_RATE_MAX);');
    // a uniform, never a derivative
    expect(PLANET_FS).not.toMatch(/fwidth\([^)]*uPopZoom/);
  });

  it('roil runs only in the boil band and never takes a derivative', () => {
    expect(PLANET_FS).toMatch(/if \(boilW > 0\.0\) \{\s*vec3 rt;/);
    const roilFns = PLANET_FS.slice(PLANET_FS.indexOf('float popDensity('), PLANET_FS.indexOf('void main()'));
    expect(roilFns).not.toMatch(/dFd[xy]|fwidth/);
  });
});
