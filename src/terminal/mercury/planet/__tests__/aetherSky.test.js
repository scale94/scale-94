// The moving per-element mirror sky (mirror-sky spec §2): approved looks, bound to the shared clock.
import { describe, it, expect } from 'vitest';
import { glf, v3 } from '../../../gl/glf';
import {
  AETHER_SKY_GLSL, ELEMENT_SKY_GLSL, ELEMENT_SKY_BAKE_FS, ELEMENT_SKY_FACE, ELEMENT_SKY_MAX_LOD, NEBULA_FACE, SKY_NOISE_GLSL, NEBULA_MAX_LOD, NEBULA_TEXEL_RAD, SKY_OCTAVES, SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, SKY_MEAN, AIR_SHEAR_BAND,
  AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y, AIR_SKY_LAT, AIR_SKY_WARP,
  NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT, NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW,
  TENT_EDGE_CRISP, TENT_CANOPY_HX, TENT_CANOPY_Z0, TENT_CANOPY_Z1, TENT_CANOPY_FADE, TENT_CANOPY_FRONT_SOFT, TENT_CANOPY_BACK,
  TENT_CANOPY_SIDE, TENT_STRIP_AZ, TENT_STRIP_HW, TENT_STRIP_SOFT, TENT_STRIP_Y0, TENT_STRIP_Y1, TENT_STRIP_YSOFT, TENT_STRIP_LUM,
  TENT_STRIP_GAIN, TENT_GAP, TENT_FLOOR_SOFT, TENT_FLOOR_FRONT, TENT_STRIP_FEATHER, STUDIO_DEFAULTS, studioMean, studioMeanCached, studioRadiance,
  TENT_FALLOFF_POW, TENT_SEAM_COUNT, TENT_SEAM_W, TENT_SEAM_LUM, TENT_SEAM_AZ, TENT_SEAM_AMP, TENT_CARD_AZ, TENT_CARD_Y, TENT_CARD_HW, TENT_CARD_COL, TENT_CARD_LUM,
  STUDIO_ROUGH_BLUR, STUDIO_MEAN_K0, studioMeanLiquidCached,
} from '../aetherSky';
import { NA_COL } from '../mercuryExosphere';
import { SUN_DIR_WORLD } from '../planetFrame';
import { HG_MIRROR_UNIFORMS, HG_MIRROR_DECLS_GLSL } from '../hgMirrorGlsl';
import { PLANET_UNIFORMS } from '../mercuryPlanetShader';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from '../aetherClock';
import { ROUGH_LIQUID, ROUGH_SOLID, PLANET_TUNE } from '../planetLook';

// One GLSL function, from its signature line to its closing brace at column 0.
const fnText = (src, sig) => { const i = src.indexOf(sig); if (i < 0) return null; const j = src.indexOf('\n}', i); return src.slice(i, j + 2); };
// Captured from 8255e4c0 (before the lighting polish): the ruled mirrors (crust, glaze, frost, quench, rock, frozen Hg)
// compile this exact skyStudio; the structure and the rough blur live in skyStudioLiquid only.
const SKY_STUDIO_8255 = [
  'vec3 skyStudio(vec3 R) {',
  '  float c = uStudioLook.x;',
  '  float L = NEUTRAL_SKY_FLOOR;',
  '  if (R.y > 0.02) { // canopy: a rectangle on the plane y = 1',
  '    vec2 p = R.xz / R.y;',
  '    float ef = mix(TENT_CANOPY_FRONT_SOFT, TENT_EDGE_CRISP, c);',
  '    float inX = smoothstep(TENT_CANOPY_HX + TENT_CANOPY_FADE, TENT_CANOPY_HX - TENT_CANOPY_FADE, abs(p.x));',
  '    float inZ = smoothstep(TENT_CANOPY_Z0 - TENT_CANOPY_FADE, TENT_CANOPY_Z0 + TENT_CANOPY_FADE, p.y) * smoothstep(TENT_CANOPY_Z1 + ef, TENT_CANOPY_Z1 - ef, p.y);',
  '    float u = p.x / TENT_CANOPY_HX;',
  '    float fall = mix(1.0, TENT_CANOPY_BACK, smoothstep(TENT_CANOPY_Z1, TENT_CANOPY_Z0, p.y)) * (1.0 - TENT_CANOPY_SIDE * min(u * u, 1.0));',
  '    L += uStudioLook.z * inX * inZ * fall;',
  '  }',
  '  float az = atan(R.x, R.z); // 0 = toward the camera',
  '  float ys = mix(TENT_STRIP_YSOFT, TENT_STRIP_FEATHER, c), se = mix(TENT_STRIP_SOFT, TENT_EDGE_CRISP, c);',
  '  float span = smoothstep(TENT_STRIP_Y0 - ys, TENT_STRIP_Y0 + ys, R.y) * smoothstep(TENT_STRIP_Y1 + ys, TENT_STRIP_Y1 - ys, R.y);',
  '  float sL = smoothstep(TENT_STRIP_HW + se, TENT_STRIP_HW - se, abs(az + TENT_STRIP_AZ.x));',
  '  float sR = smoothstep(TENT_STRIP_HW + se, TENT_STRIP_HW - se, abs(az - TENT_STRIP_AZ.y));',
  '  L += TENT_STRIP_LUM * uStudioLook.y * span * (TENT_STRIP_GAIN.x * sL + TENT_STRIP_GAIN.y * sR);',
  '  float fe = mix(TENT_FLOOR_SOFT, TENT_EDGE_CRISP, c);',
  '  L += uStudioLook.w * smoothstep(-TENT_GAP + fe, -TENT_GAP - fe, R.y) * (0.5 + 0.5 * smoothstep(-0.9, -0.15, R.y))',
  '     * mix(TENT_FLOOR_FRONT, 1.0, smoothstep(0.0, -0.8, R.z)); // floor sweep, lit behind: a lower rim',
  '  L += uStudioDome * (NEUTRAL_DOME_NADIR + (1.0 - NEUTRAL_DOME_NADIR) * pow(0.5 + 0.5 * R.y, NEUTRAL_DOME_POW));',
  '  return vec3(L);',
  '}',
].join('\n');

describe('aetherSky', () => {
  it('interpolates every constant from its owner', () => {
    for (const [n, v] of Object.entries({ FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK,
      SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, AIR_SHEAR_BAND })) {
      expect(ELEMENT_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(ELEMENT_SKY_GLSL).toContain(`const int SKY_OCTAVES = ${SKY_OCTAVES};`);
    for (const [n, v] of Object.entries({ SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, ELEMENT_SKY_MAX_LOD })) {
      expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
    for (const [el, rgb] of Object.entries(SKY_MEAN)) {
      expect(AETHER_SKY_GLSL).toContain(`const vec3 SKY_MEAN_${el.toUpperCase()} = ${v3(rgb)};`);
    }
  });

  it('the liquid and the glaze keep full detail; the polycrystalline crust is near-flat', () => {
    expect(ROUGH_LIQUID).toBeLessThanOrEqual(SKY_ROUGH_SHARP);
    expect(ROUGH_SOLID).toBeGreaterThan(SKY_ROUGH_SHARP + 0.8 * (SKY_ROUGH_FLAT - SKY_ROUGH_SHARP));
    expect(SKY_ROUGH_FLAT).toBeLessThan(1); // the frost/evaporite ambient lookups (rough 1) cost a constant
  });

  it('each element sky moves WITH its gas (sampled at minus the advected offset)', () => {
    expect(ELEMENT_SKY_GLSL).toContain('skyRotZ(R, -FLUID_SKY_RAD * uSkyPhase.x)');
    expect(ELEMENT_SKY_GLSL).toContain('(R.y - FIRE_SKY_RISE * uSkyPhase.y)');
    expect(ELEMENT_SKY_GLSL).toContain('R + vec3(0.0, EARTH_SKY_SINK * uSkyPhase.z, 0.0)');
    expect(ELEMENT_SKY_GLSL).toContain('skyAirLayer(R, az - spin, 1.0, nOct)');
    expect(ELEMENT_SKY_GLSL).toContain('skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct)');
    expect(ELEMENT_SKY_GLSL).toContain('float spin = AIR_SKY_RAD * uSkyPhase.w;');
  });

  it('the knot centre turns +2·2π per knot phase about +Z, so the water sky rotates by minus it', () => {
    // ParticleFlow.knotCenter, verbatim in JS
    const knot = (t) => { const phi = t * 2 * Math.PI, R = 1, r = 0.4; return [(R + r * Math.cos(3 * phi)) * Math.cos(2 * phi), (R + r * Math.cos(3 * phi)) * Math.sin(2 * phi)]; };
    const ang = (t) => Math.atan2(knot(t)[1], knot(t)[0]);
    const d = ang(0.01) - ang(0);
    expect(d).toBeGreaterThan(0);
    expect(d / 0.01).toBeCloseTo(4 * Math.PI, 1);
  });

  it('the air contra-rotation: upper layer +1, lower layer AIR_LOWER_DIR', () => {
    expect(ELEMENT_SKY_GLSL).toContain('skyAirLayer(R, az - spin, 1.0, nOct)');
    expect(ELEMENT_SKY_GLSL).toContain('skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct)');
    expect(ELEMENT_SKY_GLSL).toContain('smoothstep(-AIR_SHEAR_BAND, AIR_SHEAR_BAND, R.y)');
    expect(ELEMENT_SKY_GLSL).not.toContain('dirS');
  });

  it('the old sheared single field is gone for good (it wound up into equatorial bands)', () => {
    expect(AETHER_SKY_GLSL).not.toMatch(/uSkyPhase\.w \* dirS/);
  });

  it('only the weighted elements are baked; at or above SKY_ROUGH_FLAT the sky is its mean (no noise)', () => {
    for (const [i, f] of [['x', 'skyFluid'], ['y', 'skyThermal'], ['z', 'skyEarth'], ['w', 'skyAir']]) {
      expect(ELEMENT_SKY_GLSL).toContain(`if (uSkyW.${i} > SKY_W_MIN) s += uSkyW.${i} * ${f}(`);
    }
    expect(ELEMENT_SKY_GLSL).toContain('if (uSkyW.z > SKY_W_MIN) s += uSkyW.z * skyEarth(R, nOct, 0.0);'); // baked sharp: pings on
    expect(AETHER_SKY_GLSL).toContain('if (wE > SKY_W_MIN) s += skyElements(R, k); // the cube already carries the weights');
    expect(AETHER_SKY_GLSL).toContain('if (k >= 1.0) { neutral = meanN + neb; return mean; } // the nebula blurs by its own mips, never to a mean');
    expect(AETHER_SKY_GLSL).toContain('vec3 aetherSky(vec3 R, float rough) {');
  });

  it('aetherSkySplit separates the neutral sky and aetherSky is their sum', () => {
    expect(AETHER_SKY_GLSL).toContain('vec3 aetherSkySplit(vec3 R, float rough, out vec3 neutral) {');
    expect(AETHER_SKY_GLSL).toContain('vec3 aetherSkySplitLiquid(vec3 R, float rough, out vec3 neutral) {');
    const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('vec3 aetherSky(vec3 R, float rough) {'));
    expect(body.slice(0, body.indexOf('\n}') + 2)).toBe([
      'vec3 aetherSky(vec3 R, float rough) {',
      '  vec3 neutral;',
      '  vec3 elem = aetherSkySplit(R, rough, neutral); // the ruled mirrors: the studio mixes toward its mean, as before',
      '  return elem + neutral;',
      '}',
    ].join('\n'));
    // split before sum: the element part is declared first, so every caller of aetherSky still compiles
    expect(AETHER_SKY_GLSL.indexOf('vec3 aetherSkySplit(')).toBeLessThan(AETHER_SKY_GLSL.indexOf('vec3 aetherSky(vec3 R'));
    // each part: its own mean, its own k-mix; the nebula stays outside the mix (its mips are its blur)
    expect(AETHER_SKY_GLSL).toContain('vec3 s = vec3(0.0), sN = vec3(0.0);');
  });

  it('octaves past the budget contribute their mean (brightness holds as rough rises)', () => {
    expect(ELEMENT_SKY_GLSL).toContain('s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);');
  });

  it('earth pings: rare, sharp, sunward, off on a rough mirror', () => {
    expect(ELEMENT_SKY_GLSL).toContain('pow(max(dot(m, hv), 0.0), SKY_PING_EXP)');
    expect(ELEMENT_SKY_GLSL).toContain('smoothstep(-0.3, 0.5, dot(R, uSunDir))');
    expect(ELEMENT_SKY_GLSL).toContain('* (1.0 - smoothstep(0.0, 0.15, k))');
  });

  it('collision-safe names; no lobes, no wall clock', () => {
    expect(AETHER_SKY_GLSL).not.toMatch(/\bfloat h\(|\bfloat vn\(|\bfloat fbm\(|\bvec3 rotY\(/);
    expect(AETHER_SKY_GLSL).not.toMatch(/uAeth|uTime/);
  });

  describe('neutralSky: the resting mirror sees a macro tabletop tent (author 2026-10-08)', () => {
    const SCALARS = { NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT, NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW, TENT_EDGE_CRISP, TENT_CANOPY_HX,
      TENT_CANOPY_Z0, TENT_CANOPY_Z1, TENT_CANOPY_FADE, TENT_CANOPY_FRONT_SOFT, TENT_CANOPY_BACK, TENT_CANOPY_SIDE, TENT_STRIP_HW,
      TENT_STRIP_SOFT, TENT_STRIP_Y0, TENT_STRIP_Y1, TENT_STRIP_YSOFT, TENT_STRIP_LUM, TENT_GAP, TENT_FLOOR_SOFT, TENT_FLOOR_FRONT,
      TENT_STRIP_FEATHER, TENT_FALLOFF_POW, TENT_SEAM_W, TENT_SEAM_LUM, TENT_CARD_AZ, TENT_CARD_Y, TENT_CARD_HW,
      TENT_CARD_LUM, STUDIO_ROUGH_BLUR, STUDIO_MEAN_K0 };
    const K = STUDIO_DEFAULTS;
    const dir = (azDeg, elDeg) => { const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]; };
    const rad = (azDeg, elDeg, k = K, blur = 0) => { const [x, y, z] = dir(azDeg, elDeg); return studioRadiance(x, y, z, k, blur)[1]; }; // grey: any channel

    it('constants interpolated into the GLSL', () => {
      for (const [n, v] of Object.entries(SCALARS)) expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      expect(AETHER_SKY_GLSL).toContain(`const vec2 TENT_STRIP_AZ = vec2(${glf(TENT_STRIP_AZ[0])}, ${glf(TENT_STRIP_AZ[1])});`);
      expect(AETHER_SKY_GLSL).toContain(`const vec2 TENT_STRIP_GAIN = vec2(${glf(TENT_STRIP_GAIN[0])}, ${glf(TENT_STRIP_GAIN[1])});`);
      expect(AETHER_SKY_GLSL).toContain(`const vec3 TENT_CARD_COL = ${v3(TENT_CARD_COL)};`);
      expect(AETHER_SKY_GLSL).toContain(`const int TENT_SEAM_COUNT = ${TENT_SEAM_COUNT};`);
      expect(AETHER_SKY_GLSL).toContain(`const float TENT_SEAM_AZ[${TENT_SEAM_COUNT}] = float[${TENT_SEAM_COUNT}](${TENT_SEAM_AZ.map(glf).join(', ')});`);
      expect(AETHER_SKY_GLSL).toContain(`const float TENT_SEAM_AMP[${TENT_SEAM_COUNT}] = float[${TENT_SEAM_COUNT}](${TENT_SEAM_AMP.map(glf).join(', ')});`);
    });

    it('defaults: over-unity key and canopy, a subtle floor, no dome; PLANET_TUNE matches', () => {
      expect([PLANET_TUNE.studioCrisp, PLANET_TUNE.studioKey, PLANET_TUNE.studioSoftbox, PLANET_TUNE.studioFloor, PLANET_TUNE.studioDome])
        .toEqual([K.crisp, K.key, K.canopy, K.floor, K.dome]);
      expect(K.dome).toBe(0);
      expect(K.floor).toBe(0); // author 2026-10-08 locked the floor bounce off
      expect(K.key * TENT_STRIP_LUM * 1.4).toBeGreaterThan(1); // past the shoulder knee (aetherGain 1.4)
      expect(K.canopy * 1.4).toBeGreaterThan(2);
      for (const u of ['uStudioDome', 'uStudioLook', 'uStudioMean']) { expect(HG_MIRROR_UNIFORMS).toContain(u); expect(PLANET_UNIFORMS).toContain(u); }
    });

    it('layout: canopy overhead, flanking strips, dark trenches between, dark horizon gap, floor lit behind (replica)', () => {
      expect(rad(0, 80)).toBeGreaterThan(1.5);                 // canopy front, overhead
      expect(rad(180, 50)).toBeLessThan(rad(0, 80) * 0.6);     // falls off toward the back
      expect(rad(-TENT_STRIP_AZ[0] * 180 / Math.PI, 20)).toBeGreaterThan(1); // left strip (key)
      expect(rad(TENT_STRIP_AZ[1] * 180 / Math.PI, 20)).toBeGreaterThan(0.6); // right strip (fill)
      expect(rad(0, 20)).toBe(NEUTRAL_SKY_FLOOR);              // toward the camera: black (the ball's centre band)
      expect(rad(-35, 20)).toBe(NEUTRAL_SKY_FLOOR);            // trench between camera axis and the key strip
      expect(rad(180, -3)).toBe(NEUTRAL_SKY_FLOOR);            // horizon gap
      expect(rad(180, -30)).toBe(NEUTRAL_SKY_FLOOR);           // floor off by default
      const lit = { ...K, floor: 0.35 };
      expect(rad(180, -30, lit)).toBeGreaterThan(rad(0, -30, lit) * 3); // when on: lit behind the subject, a rim, not a bowl
      // strips wrap toward the poles and feather there: bright mid-span, fading (not cut) near the ends
      const az0 = -TENT_STRIP_AZ[0] * 180 / Math.PI, top = Math.asin(TENT_STRIP_Y1) * 180 / Math.PI;
      const stripOnly = { ...K, canopy: 0 }; // up there the strip runs into the canopy: isolate it
      expect(rad(az0, 50, stripOnly)).toBeGreaterThan(1);
      const nearEnd = rad(az0, top - 3, stripOnly);
      expect(nearEnd).toBeGreaterThan(NEUTRAL_SKY_FLOOR);
      expect(nearEnd).toBeLessThan(rad(az0, 50, stripOnly));
      expect(TENT_STRIP_FEATHER).toBeGreaterThan(5 * TENT_EDGE_CRISP);
    });

    it('GLSL mirrors the replica: canopy plane, camera-fixed azimuth, staggered strips, floor lit behind, no noise, no drift', () => {
      const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('vec3 skyStudioLiquid(vec3 R, float k) {'), AETHER_SKY_GLSL.indexOf('vec3 skyNebula(vec3 R, float k)'));
      expect(body).toContain('vec2 p = R.xz / R.y;');
      expect(body).toContain('float az = atan(R.x, R.z); // 0 = toward the camera');
      expect(body).toContain('float dL = az + TENT_STRIP_AZ.x, dR = az - TENT_STRIP_AZ.y;');
      expect(body).toContain('float sL = studioBand(dL, TENT_STRIP_HW, se), sR = studioBand(dR, TENT_STRIP_HW, se);');
      expect(body).toContain('* mix(TENT_FLOOR_FRONT, 1.0, smoothstep(0.0, -0.8, R.z)); // floor sweep, lit behind: a lower rim');
      expect(body).not.toMatch(/uStudioWarm|AMBER/); // the amber fill was indistinguishable (author 2026-10-08): removed
      expect(body).not.toMatch(/skyFbm|skyNoise|skyHash|uSkyT/);
      // uStudioMean is a float (HG_MIRROR_DECLS_GLSL): a bare float into a vec3 failed to compile live (2026-11-22)
      expect(HG_MIRROR_DECLS_GLSL).toContain('uniform float uStudioMean;');
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplit(')).toContain('vec3 meanN = vec3(wStudio * uStudioMean); // studioMeanCached (JS) at the live knobs (a float: the studio is grey)');
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplitLiquid(')).toContain('vec3 meanN = vec3(wStudio * uStudioMeanLiquid); // studioMeanLiquidCached (JS) at the live knobs (a float: the studio is grey)');
      expect(HG_MIRROR_DECLS_GLSL).toContain('uniform float uStudioMeanLiquid;');
      for (const u of ['uStudioMeanLiquid']) { expect(HG_MIRROR_UNIFORMS).toContain(u); expect(PLANET_UNIFORMS).toContain(u); }
    });

    it('studioMean: the grid mean converges (finer grid agrees), the cache recomputes only on a knob change', () => {
      for (const k of [K, { crisp: 0, key: 1, canopy: 0.5, floor: 0, dome: 0.06 }]) {
        expect(studioMean(k)).toBeCloseTo(studioMean(k, 384, 768), 2);
      }
      expect(SKY_MEAN.neutral).toEqual([studioMean(K), studioMean(K), studioMean(K)]);
      const a = studioMeanCached(1, 4, 2, 0.35, 0);
      expect(studioMeanCached(1, 4, 2, 0.35, 0)).toBe(a);
      expect(studioMeanCached(1, 4, 2, 0, 0)).toBeLessThan(a);
    }, 60000);

    it('neutral weight fills what the element skies leave; evaluated only above SKY_W_MIN', () => {
      expect(AETHER_SKY_GLSL).toContain('float wE = uSkyW.x + uSkyW.y + uSkyW.z + uSkyW.w;');
      expect(AETHER_SKY_GLSL).toContain('float wN = uNeutralSky * clamp(1.0 - wE, 0.0, 1.0);');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyStudio(vec3 R) {');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyStudioLiquid(vec3 R, float k) {');
      expect(AETHER_SKY_GLSL).toContain('float wStudio = wN * (1.0 - uNeutralNebula), wNeb = wN * uNeutralNebula;');
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplit(')).toContain('if (wStudio > SKY_W_MIN) sN += wStudio * skyStudio(R);');
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplitLiquid(')).toContain('if (wStudio > SKY_W_MIN) sN += wStudio * skyStudioLiquid(R, k);');
    });

    it('studio / nebula switch: each side evaluated only when it has weight; nebula = one rotated textureLod', () => {
      expect(AETHER_SKY_GLSL).toContain('vec3 neb = wNeb > SKY_W_MIN ? wNeb * skyNebula(R, k) : vec3(0.0);');
      expect(AETHER_SKY_GLSL).toContain('return textureLod(uNebulaMap, uNebulaRot * R, max(k * NEBULA_MAX_LOD, skyPxLod)).rgb;');
      // rough mirrors: the mip chain is the blur, added AFTER the element/studio mix toward the mean (no double flattening)
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplit(')).toContain('neutral = mix(sN, meanN, k) + neb;');
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplitLiquid(')).toContain('neutral = mix(sN, meanN, smoothstep(STUDIO_MEAN_K0, 1.0, k)) + neb;');
      expect(AETHER_SKY_GLSL).toContain('return mix(s, mean, k);');
      // limb: a pixel-footprint mip floor, set by shaders that have screen derivatives, 0 elsewhere
      expect(AETHER_SKY_GLSL).toContain('float skyPxLod = 0.0;');
      expect(AETHER_SKY_GLSL).toContain(`const float NEBULA_TEXEL_RAD = ${glf(NEBULA_TEXEL_RAD)};`);
      expect(AETHER_SKY_GLSL).toContain(`const float NEBULA_MAX_LOD = ${glf(NEBULA_MAX_LOD)};`);
      expect(AETHER_SKY_GLSL.match(/textureLod\(/g)).toHaveLength(2); // the nebula and the element cube
      expect(SKY_MEAN.nebula).toHaveLength(3);
      expect(SKY_MEAN.nebula[0]).toBe(SKY_MEAN.nebula[1]);
      expect(SKY_MEAN.nebula[1]).toBe(SKY_MEAN.nebula[2]);
    });

    it('SKY_MEAN.nebula is the measured mean (dark by ruling)', () => {
      // author 2026-10-08 ruled deeper obsidian voids. No studio/nebula ratio bound: the tent's lights lift the studio mean
      // far above it and the crust renders identically under both (tent-look.mjs, sheets chrome-a/b).
      expect(SKY_MEAN.nebula[0]).toBeGreaterThanOrEqual(0.015);
      expect(SKY_MEAN.nebula[0]).toBeLessThanOrEqual(0.035);
    });

    it('the nebula switch is a mirror uniform, studio by default (author rules after the look sheet)', () => {
      for (const u of ['uNeutralNebula', 'uNebulaRot', 'uNebulaMap']) {
        expect(HG_MIRROR_UNIFORMS).toContain(u);
        expect(PLANET_UNIFORMS).toContain(u);
      }
      expect(PLANET_TUNE.neutralNebula).toBe(0);
    });
    it('uNeutralSky is a mirror uniform, fed to the planet too', () => {
      expect(HG_MIRROR_UNIFORMS).toContain('uNeutralSky');
      expect(PLANET_UNIFORMS).toContain('uNeutralSky');
    });

    it('PLANET_TUNE.neutralSky is on by default', () => {
      expect(PLANET_TUNE.neutralSky).toBe(1);
    });

    // ── lighting polish Step 4: midtones from structure ──
    const grid = (N, M, f) => { for (let i = 0; i < N; i++) { const y = -1 + (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y);
      for (let j = 0; j < M; j++) { const a = -Math.PI + (2 * Math.PI * (j + 0.5)) / M; f(r * Math.sin(a), y, r * Math.cos(a), a, i * M + j); } } };
    const ZERO = { falloff: 0, seams: 0, card: 0 };

    it('new knobs at 0 reproduce the ruled tent exactly', () => {
      // captured at 994525bc (before Step 4): a weighted sum over a 32x64 grid, and studioMean
      const before = [[K, 1721.1202615196337], [{ crisp: 0, key: 1, canopy: 0.5, floor: 0.35, dome: 0.06 }, 1010.3102895363652]];
      for (const [k, want] of before) {
        let s = 0;
        grid(32, 64, (x, y, z, a, n) => { const c = studioRadiance(x, y, z, { ...k, ...ZERO }); expect(c[0]).toBe(c[1]); expect(c[1]).toBe(c[2]); s += c[1] * (1 + (n % 7)); });
        expect(Math.abs(s - want)).toBeLessThan(1e-12 * want);
      }
      expect(Math.abs(studioMean({ ...K, ...ZERO }) - 0.20844344093062325)).toBeLessThan(1e-12);
      expect(Math.abs(studioMean({ ...K, floor: 0.35, crisp: 0 }) - 0.25048383845301569)).toBeLessThan(1e-12);
    });

    it('falloff darkens the strip centre-to-edge, not the edge itself', () => {
      const az0 = -TENT_STRIP_AZ[0] * 180 / Math.PI, half = TENT_STRIP_HW / 2 * 180 / Math.PI;
      const k0 = { ...K, ...ZERO }, k1 = { ...K, ...ZERO, falloff: 1 };
      expect(rad(az0, 20, k1)).toBe(rad(az0, 20, k0)); // centre: untouched
      expect(rad(az0 + half, 20, k1)).toBeLessThan(rad(az0 + half, 20, k0) * 0.9); // halfway out: lower
      expect(rad(az0 + half, 20, { ...k0, falloff: 0.5 })).toBeGreaterThan(rad(az0 + half, 20, k1)); // monotone in the knob
      // the canopy too: its centre (on the plane y = 1) gains on its side with falloff
      const onPlane = (px, pz, k) => { const l = Math.hypot(px, 1, pz); return studioRadiance(px / l, 1 / l, pz / l, k)[1]; };
      const zc = 0.5 * (TENT_CANOPY_Z0 + TENT_CANOPY_Z1);
      expect(onPlane(0, zc, k1)).toBe(onPlane(0, zc, k0));
      const ratio = (k) => onPlane(0, zc, k) / onPlane(0.6, zc, k);
      expect(ratio(k1)).toBeGreaterThan(ratio(k0));
      expect(TENT_FALLOFF_POW).toBe(2);
    });

    it('seams are thin and faint', () => {
      let mx = 0, touched = 0, n = 0;
      grid(64, 4096, (x, y, z) => { const d = studioRadiance(x, y, z, { ...K, ...ZERO, seams: 1 })[1] - studioRadiance(x, y, z, { ...K, ...ZERO })[1];
        mx = Math.max(mx, d); if (d > 1e-9) touched++; n++; });
      expect(touched).toBeGreaterThan(0); // not vacuous
      expect(mx).toBeLessThanOrEqual(0.03 * TENT_STRIP_LUM * K.key); // ≤ 3 % of the key strip's radiance at knob 1 (spec ~1–3 %)
      expect(mx).toBeGreaterThan(0.01 * TENT_STRIP_LUM * K.key);      // and visible at all
      expect(touched / n).toBeLessThan(0.05);
      expect(TENT_SEAM_W).toBe(0.006);
      expect(TENT_SEAM_LUM).toBeCloseTo(0.02 * TENT_STRIP_LUM, 12);
    });

    it('seams live on the tent walls only: zero below the strips\' lower end (no meridians into the void)', () => {
      const yCut = TENT_STRIP_Y0 - TENT_STRIP_FEATHER; // the strips' lower end at crisp 1, feather included
      let checked = 0;
      grid(64, 4096, (x, y, z) => { if (y >= yCut) return; checked++;
        expect(studioRadiance(x, y, z, { ...K, ...ZERO, seams: 2 })[1]).toBe(studioRadiance(x, y, z, { ...K, ...ZERO })[1]); });
      expect(checked).toBeGreaterThan(0);
    });

    it('seams break the lattice: non-uniform spacing and per-seam amplitude from a fixed table', () => {
      expect(TENT_SEAM_AZ).toHaveLength(TENT_SEAM_COUNT);
      expect(TENT_SEAM_AMP).toHaveLength(TENT_SEAM_COUNT);
      const az = [...TENT_SEAM_AZ].sort((a, b) => a - b);
      const gaps = az.map((a, i) => (i + 1 < az.length ? az[i + 1] : az[0] + 2 * Math.PI) - a);
      expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(1.5); // not equal-period
      expect(new Set(TENT_SEAM_AMP).size).toBeGreaterThan(3);
      expect(Math.max(...TENT_SEAM_AMP)).toBe(1);
      for (const a of TENT_SEAM_AZ) expect(a > -Math.PI && a <= Math.PI).toBe(true);
      // not mirror-symmetric about the camera axis (no visor)
      for (const a of TENT_SEAM_AZ) expect(TENT_SEAM_AZ.some((b) => Math.abs(a + b) < 0.05)).toBe(false);
    });

    it('the structure knobs never touch the ruled mirrors: liquid 0 (and the base mean) equal knobs 0 exactly', () => {
      const ONE = { falloff: 1, seams: 1, card: 1 };
      for (const kb of [0, 0.6]) {
        grid(32, 512, (x, y, z) => expect(studioRadiance(x, y, z, { ...K, ...ONE }, kb, 0)).toEqual(studioRadiance(x, y, z, { ...K, ...ZERO }, kb, 0)));
      }
      // uStudioMean (crust, frozen Hg, glaze, frost read it) is keyed on the base knobs only; the liquid has its own
      expect(studioMeanCached(1, 4, 2, 0, 0)).toBe(studioMean({ ...K, ...ZERO }));
      expect(studioMeanLiquidCached(1, 4, 2, 0, 0, 1, 1, 1)).toBe(studioMean({ ...K, ...ONE }));
      expect(studioMeanLiquidCached(1, 4, 2, 0, 0, 1, 1, 1)).not.toBe(studioMeanCached(1, 4, 2, 0, 0));
      // GLSL: structure off is structural. The ruled skyStudio is the 8255e4c0 text; only skyStudioLiquid reads the knobs
      expect(fnText(AETHER_SKY_GLSL, 'vec3 skyStudio(vec3 R) {')).not.toMatch(/uStudioLook2|studioFall|studioBand|STUDIO_ROUGH_BLUR/);
      const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('vec3 skyStudioLiquid(vec3 R, float k) {'), AETHER_SKY_GLSL.indexOf('vec3 skyNebula(vec3 R, float k)'));
      expect(body).toContain('vec3 st = uStudioLook2.yzw;');
      expect(body).not.toMatch(/uStudioLook2\.[yzw](?!zw)/); // every structure read goes through st
    }, 60000);

    it('the card is warm and sunward only', () => {
      let touched = 0;
      grid(64, 1024, (x, y, z, a) => {
        const c1 = studioRadiance(x, y, z, { ...K, ...ZERO, card: 1 }), c0 = studioRadiance(x, y, z, { ...K, ...ZERO });
        const d = c1.map((v, i) => v - c0[i]);
        if (d[0] <= 1e-12) return;
        touched++;
        expect(Math.abs(a - TENT_CARD_AZ)).toBeLessThan(TENT_CARD_HW + TENT_EDGE_CRISP);
        expect(Math.abs(y - TENT_CARD_Y)).toBeLessThan(TENT_CARD_HW + TENT_EDGE_CRISP);
        expect(d[0]).toBeGreaterThan(d[1]); expect(d[1]).toBeGreaterThan(d[2]);
      });
      expect(touched).toBeGreaterThan(0);
      expect(TENT_CARD_COL).toEqual(NA_COL); // the corona's amber (mercuryExosphere NA_COL, the Na halo)
      expect(Math.sign(TENT_CARD_AZ)).toBe(Math.sign(Math.atan2(SUN_DIR_WORLD[0], SUN_DIR_WORLD[2]))); // the Sun side
      expect(TENT_CARD_Y).toBeLessThan(0); // low
      expect(TENT_CARD_HW).toBe(0.18);
      expect(TENT_CARD_LUM).toBe(0.15);
      // clear of the key strip: a card, not a strip extension
      expect(Math.abs(TENT_CARD_AZ + TENT_STRIP_AZ[0])).toBeGreaterThan(TENT_CARD_HW + TENT_STRIP_HW);
    });

    it('studioMeanCached recomputes when any new knob changes', () => {
      const a = studioMeanCached(1, 4, 2, 0, 0, 0, 0, 0);
      expect(a).toBe(studioMean({ ...K, ...ZERO }));
      for (const [f, s, c] of [[0.5, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const b = studioMeanCached(1, 4, 2, 0, 0, f, s, c);
        expect(b).not.toBe(a);
        expect(b).toBe(studioMean({ ...K, falloff: f, seams: s, card: c }));
      }
      expect(studioMeanCached(1, 4, 2, 0, 0, 0, 0, 1)).toBeGreaterThan(a); // the card adds light
      expect(studioMeanCached(1, 4, 2, 0, 0, 1, 0, 0)).toBeLessThan(a);    // falloff takes it
    }, 60000);

    it('skyStudio mirrors studioRadiance: the three structures in the GLSL, reading uStudioLook2.yzw', () => {
      const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('float studioBand(float d, float hw, float w) {'), AETHER_SKY_GLSL.indexOf('vec3 skyNebula(vec3 R, float k)'));
      expect(body).toContain('return 1.0 - f * pow(min(abs(d) / hw, 1.0), TENT_FALLOFF_POW);');
      expect(body).toContain('vec3 st = uStudioLook2.yzw;');
      expect(body).toContain('st.x');
      expect(body).toContain('st.y');
      expect(body).toContain('st.z');
      expect(body).toContain('return vec3(L) + cd * TENT_CARD_COL;');
      expect(body).not.toMatch(/skyFbm|skyNoise|skyHash|uSkyT/); // no noise: no banding source
    });

    it('the ruled skyStudio compiles the 8255e4c0 text exactly; no ruled path reaches skyStudioLiquid', () => {
      expect(fnText(AETHER_SKY_GLSL, 'vec3 skyStudio(vec3 R) {')).toBe(SKY_STUDIO_8255);
      for (const sig of ['vec3 skyStudio(vec3 R) {', 'vec3 aetherSkySplit(vec3 R, float rough, out vec3 neutral) {', 'vec3 aetherSky(vec3 R, float rough) {']) {
        expect(fnText(AETHER_SKY_GLSL, sig), sig).not.toMatch(/skyStudioLiquid|aetherSkySplitLiquid|uStudioMeanLiquid|uStudioLook2/);
      }
      // skyStudioLiquid: defined once, called once, from the liquid split only
      expect(AETHER_SKY_GLSL.match(/skyStudioLiquid\(/g)).toHaveLength(2);
      expect(fnText(AETHER_SKY_GLSL, 'vec3 aetherSkySplitLiquid(')).toContain('skyStudioLiquid(R, k)');
      expect(AETHER_SKY_GLSL.match(/\bskyStudio\(/g)).toHaveLength(2); // the ruled one: defined once, called once (aetherSkySplit)
      expect(AETHER_SKY_GLSL.match(/aetherSkySplitLiquid\(/g)).toHaveLength(1); // defined here, called by hgMirrorGlsl only
    });

    describe('boil blur (controller ruling 1): a rough liquid mirror sees the tent blurred, not its flat mean', () => {
      it('blur 0 is the sharp tent; the ruled mirrors pass blur 0, the liquid 1', () => {
        grid(16, 32, (x, y, z) => expect(studioRadiance(x, y, z, K, 0)).toEqual(studioRadiance(x, y, z, K)));
        expect(AETHER_SKY_GLSL).toContain('if (k >= 1.0) { neutral = meanN + neb; return mean; } // the nebula blurs by its own mips, never to a mean');
        expect(fnText(AETHER_SKY_GLSL, 'vec3 skyStudioLiquid(vec3 R, float k) {')).toContain('float b = STUDIO_ROUGH_BLUR * k;');
      });
      it('at boil k the day half is structured, not constant, and keeps the tent\'s energy', () => {
        const kBoil = 0.6;
        const v = [];
        for (let az = -100; az <= -20; az += 4) for (let el = -25; el <= 50; el += 5) v.push(rad(az, el, K, kBoil));
        const m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
        expect(sd / m).toBeGreaterThan(0.25);
        // up to where the mean-mix starts (above it the mirror fades to the exact mean anyway); measured -2.9 % at 0.6
        for (const kb of [kBoil, STUDIO_MEAN_K0]) expect(Math.abs(studioMean(K, 96, 192, kb) / studioMean(K) - 1)).toBeLessThan(0.05);
        // a wider, dimmer lobe: the key strip's centre drops, its trench neighbour rises
        const az0 = -TENT_STRIP_AZ[0] * 180 / Math.PI;
        expect(rad(az0, 20, K, kBoil)).toBeLessThan(rad(az0, 20, K, 0));
        expect(rad(az0 + 15, 20, K, kBoil)).toBeGreaterThan(rad(az0 + 15, 20, K, 0));
        expect(STUDIO_MEAN_K0).toBeGreaterThan(kBoil); // boil never reaches the mean-mix
        expect(STUDIO_ROUGH_BLUR).toBe(0.4);
      }, 60000);
    });
  });

  it('the sky noise is one shared chunk (the nebula bake reuses it verbatim)', () => {
    expect(SKY_NOISE_GLSL).toContain('float skyHash(vec3 p) {');
    expect(SKY_NOISE_GLSL).toContain('float skyNoise(vec3 x) {');
    expect(SKY_NOISE_GLSL).toContain('float skyFbm(vec3 p, float nOct) {');
    expect(ELEMENT_SKY_GLSL).toContain(SKY_NOISE_GLSL);
    expect(ELEMENT_SKY_GLSL.split('float skyHash(').length).toBe(2); // defined once
  });

  describe('element cube (2026-10-10: the analytic skies compiled once per mirror call site, 52 s / 47 s on ANGLE D3D11)', () => {
    it('the mirror chunk carries no noise at all: every mirror reads the baked cube', () => {
      expect(AETHER_SKY_GLSL).not.toMatch(/skyFbm|skyNoise|skyHash|skyFluid|skyThermal|skyEarth|skyAir|uSkyT|uSkyPhase|SKY_OCTAVES/);
      expect(AETHER_SKY_GLSL).toContain('return textureLod(uElementSky, R, max(k * ELEMENT_SKY_MAX_LOD, skyPxLod)).rgb;');
    });
    it('the bake pass evaluates the weighted skies at full detail', () => {
      expect(ELEMENT_SKY_BAKE_FS).toContain(ELEMENT_SKY_GLSL);
      expect(ELEMENT_SKY_BAKE_FS).toContain('o = vec4(elementSkies(normalize(vDir)), 1.0);');
      expect(ELEMENT_SKY_GLSL).toContain('float nOct = float(SKY_OCTAVES);');
      for (const u of ['uSkyT', 'uSkyPhase', 'uSkyW', 'uSunDir']) expect(ELEMENT_SKY_BAKE_FS).toMatch(new RegExp(`uniform \\w+ ${u};`));
    });
    it('same face as the nebula, so the one skyPxLod floor fits both; mips stand in for the 4 dropped octaves', () => {
      expect(ELEMENT_SKY_FACE).toBe(NEBULA_FACE);
      expect(ELEMENT_SKY_MAX_LOD).toBe(SKY_OCTAVES - 1);
      expect(ELEMENT_SKY_MAX_LOD).toBeLessThan(Math.log2(ELEMENT_SKY_FACE));
    });
    it('uElementSky is a mirror uniform, fed to the planet too', () => {
      expect(HG_MIRROR_UNIFORMS).toContain('uElementSky');
      expect(PLANET_UNIFORMS).toContain('uElementSky');
    });
  });

  describe('soft threads §5: the air mirror sky', () => {
    it('constants as specced, interpolated', () => {
      expect(AIR_SHEAR_BAND).toBe(0.25);
      expect(AIR_SKY_LINE_POW).toBe(10);
      expect(AIR_SKY_ENV_POW).toBe(1.5);
      expect(AIR_SKY_WARP_Y).toBe(0.15);
      expect(AIR_SKY_LAT).toBe(3.5);
      expect(AIR_SKY_WARP).toBe(0.6);
      for (const [n, v] of Object.entries({ AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y, AIR_SKY_LAT, AIR_SKY_WARP })) {
        expect(ELEMENT_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      }
    });

    it('stretch + warp are frozen consts; the warp is in the layer frame (ph), periodic (cos/sin ph), on the sky clock, <= 3 octaves', () => {
      expect(ELEMENT_SKY_GLSL).not.toContain('R.y * 8.0');
      expect(ELEMENT_SKY_GLSL).toContain('vec3 wq = vec3(cos(ph), sin(ph), R.y * 1.5) * 1.2 + vec3(0.0, 0.0, uSkyT * 0.03);');
      expect(ELEMENT_SKY_GLSL).toContain('float phw = ph + AIR_SKY_WARP * (skyFbm(wq, wOct) - 0.5);');
      expect(ELEMENT_SKY_GLSL).toContain('float yw = R.y + AIR_SKY_WARP_Y * (skyFbm(wq + 7.3, wOct) - 0.5);');
      expect(ELEMENT_SKY_GLSL).toContain('vec3 q = vec3(cos(phw) * 1.2, sin(phw) * 1.2, yw * AIR_SKY_LAT);');
      expect(ELEMENT_SKY_GLSL).toContain('float wOct = min(nOct, 3.0);');
    });

    it('softer lines; a smooth spherical envelope instead of the plateau + shoulder', () => {
      expect(ELEMENT_SKY_GLSL).toContain('float lines = pow(1.0 - abs(n * 2.0 - 1.0), AIR_SKY_LINE_POW);');
      expect(ELEMENT_SKY_GLSL).toContain('float band = pow(max(1.0 - R.y * R.y, 0.0), AIR_SKY_ENV_POW);');
      expect(ELEMENT_SKY_GLSL).not.toContain('smoothstep(0.95, 0.2, abs(R.y))');
      const env = (y) => Math.max(1 - y * y, 0) ** AIR_SKY_ENV_POW;
      for (let y = 0.01; y < 1; y += 0.01) expect(env(y)).toBeLessThan(env(y - 0.01));
      expect(env(0.2)).toBeLessThan(0.95);
    });

    it('both layers stay rigid: the warp reads ph (az - spin of its own layer), never az alone', () => {
      expect(ELEMENT_SKY_GLSL).toContain('c += wUp * skyAirLayer(R, az - spin, 1.0, nOct);');
      expect(ELEMENT_SKY_GLSL).toContain('c += (1.0 - wUp) * skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct);');
    });

    it('uAirSkyLat / uAirSkyWarp are gone: consts, no uniforms, no PLANET_TUNE knobs', () => {
      for (const u of ['uAirSkyLat', 'uAirSkyWarp']) {
        expect(HG_MIRROR_UNIFORMS).not.toContain(u);
        expect(PLANET_UNIFORMS).not.toContain(u);
        expect(ELEMENT_SKY_GLSL).not.toContain(u);
        expect(AETHER_SKY_GLSL).not.toContain(u);
      }
      expect(PLANET_TUNE).not.toHaveProperty('airSkyLat');
      expect(PLANET_TUNE).not.toHaveProperty('airSkyWarp');
    });
  });
});
