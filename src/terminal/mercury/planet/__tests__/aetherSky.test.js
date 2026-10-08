// The moving per-element mirror sky (mirror-sky spec §2): approved looks, bound to the shared clock.
import { describe, it, expect } from 'vitest';
import { glf, v3 } from '../../../gl/glf';
import {
  AETHER_SKY_GLSL, SKY_NOISE_GLSL, NEBULA_MAX_LOD, NEBULA_TEXEL_RAD, SKY_OCTAVES, SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, SKY_MEAN, AIR_SHEAR_BAND,
  AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y, AIR_SKY_LAT, AIR_SKY_WARP,
  NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT, NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW,
  TENT_EDGE_CRISP, TENT_CANOPY_HX, TENT_CANOPY_Z0, TENT_CANOPY_Z1, TENT_CANOPY_FADE, TENT_CANOPY_FRONT_SOFT, TENT_CANOPY_BACK,
  TENT_CANOPY_SIDE, TENT_STRIP_AZ, TENT_STRIP_HW, TENT_STRIP_SOFT, TENT_STRIP_Y0, TENT_STRIP_Y1, TENT_STRIP_YSOFT, TENT_STRIP_LUM,
  TENT_STRIP_GAIN, TENT_GAP, TENT_FLOOR_SOFT, TENT_FLOOR_FRONT, TENT_STRIP_FEATHER, STUDIO_DEFAULTS, studioMean, studioMeanCached, studioRadiance,
} from '../aetherSky';
import { HG_MIRROR_UNIFORMS } from '../hgMirrorGlsl';
import { PLANET_UNIFORMS } from '../mercuryPlanetShader';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from '../aetherClock';
import { ROUGH_LIQUID, ROUGH_SOLID, PLANET_TUNE } from '../planetLook';

describe('aetherSky', () => {
  it('interpolates every constant from its owner', () => {
    for (const [n, v] of Object.entries({ FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK,
      SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, AIR_SHEAR_BAND })) {
      expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(AETHER_SKY_GLSL).toContain(`const int SKY_OCTAVES = ${SKY_OCTAVES};`);
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
    expect(AETHER_SKY_GLSL).toContain('skyRotZ(R, -FLUID_SKY_RAD * uSkyPhase.x)');
    expect(AETHER_SKY_GLSL).toContain('(R.y - FIRE_SKY_RISE * uSkyPhase.y)');
    expect(AETHER_SKY_GLSL).toContain('R + vec3(0.0, EARTH_SKY_SINK * uSkyPhase.z, 0.0)');
    expect(AETHER_SKY_GLSL).toContain('skyAirLayer(R, az - spin, 1.0, nOct)');
    expect(AETHER_SKY_GLSL).toContain('skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct)');
    expect(AETHER_SKY_GLSL).toContain('float spin = AIR_SKY_RAD * uSkyPhase.w;');
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
    expect(AETHER_SKY_GLSL).toContain('skyAirLayer(R, az - spin, 1.0, nOct)');
    expect(AETHER_SKY_GLSL).toContain('skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct)');
    expect(AETHER_SKY_GLSL).toContain('smoothstep(-AIR_SHEAR_BAND, AIR_SHEAR_BAND, R.y)');
    expect(AETHER_SKY_GLSL).not.toContain('dirS');
  });

  it('the old sheared single field is gone for good (it wound up into equatorial bands)', () => {
    expect(AETHER_SKY_GLSL).not.toMatch(/uSkyPhase\.w \* dirS/);
  });

  it('only the weighted elements are evaluated; at or above SKY_ROUGH_FLAT the sky is its mean (no noise)', () => {
    for (const [i, f] of [['x', 'skyFluid'], ['y', 'skyThermal'], ['z', 'skyEarth'], ['w', 'skyAir']]) {
      expect(AETHER_SKY_GLSL).toContain(`if (uSkyW.${i} > SKY_W_MIN) s += uSkyW.${i} * ${f}(`);
    }
    expect(AETHER_SKY_GLSL).toContain('if (k >= 1.0) return mean + neb;'); // the nebula blurs by its own mips, never to a mean
    expect(AETHER_SKY_GLSL).toContain('vec3 aetherSky(vec3 R, float rough) {');
  });

  it('octaves past the budget contribute their mean (brightness holds as rough rises)', () => {
    expect(AETHER_SKY_GLSL).toContain('s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);');
  });

  it('earth pings: rare, sharp, sunward, off on a rough mirror', () => {
    expect(AETHER_SKY_GLSL).toContain('pow(max(dot(m, hv), 0.0), SKY_PING_EXP)');
    expect(AETHER_SKY_GLSL).toContain('smoothstep(-0.3, 0.5, dot(R, uSunDir))');
    expect(AETHER_SKY_GLSL).toContain('* (1.0 - smoothstep(0.0, 0.15, k))');
  });

  it('collision-safe names; no lobes, no wall clock', () => {
    expect(AETHER_SKY_GLSL).not.toMatch(/\bfloat h\(|\bfloat vn\(|\bfloat fbm\(|\bvec3 rotY\(/);
    expect(AETHER_SKY_GLSL).not.toMatch(/uAeth|uTime/);
  });

  describe('neutralSky: the resting mirror sees a macro tabletop tent (author 2026-10-08)', () => {
    const SCALARS = { NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT, NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW, TENT_EDGE_CRISP, TENT_CANOPY_HX,
      TENT_CANOPY_Z0, TENT_CANOPY_Z1, TENT_CANOPY_FADE, TENT_CANOPY_FRONT_SOFT, TENT_CANOPY_BACK, TENT_CANOPY_SIDE, TENT_STRIP_HW,
      TENT_STRIP_SOFT, TENT_STRIP_Y0, TENT_STRIP_Y1, TENT_STRIP_YSOFT, TENT_STRIP_LUM, TENT_GAP, TENT_FLOOR_SOFT, TENT_FLOOR_FRONT,
      TENT_STRIP_FEATHER };
    const K = STUDIO_DEFAULTS;
    const dir = (azDeg, elDeg) => { const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)]; };
    const rad = (azDeg, elDeg, k = K) => { const [x, y, z] = dir(azDeg, elDeg); return studioRadiance(x, y, z, k); };

    it('constants interpolated into the GLSL', () => {
      for (const [n, v] of Object.entries(SCALARS)) expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      expect(AETHER_SKY_GLSL).toContain(`const vec2 TENT_STRIP_AZ = vec2(${glf(TENT_STRIP_AZ[0])}, ${glf(TENT_STRIP_AZ[1])});`);
      expect(AETHER_SKY_GLSL).toContain(`const vec2 TENT_STRIP_GAIN = vec2(${glf(TENT_STRIP_GAIN[0])}, ${glf(TENT_STRIP_GAIN[1])});`);
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
      const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('vec3 skyStudio(vec3 R) {'), AETHER_SKY_GLSL.indexOf('vec3 skyNebula(vec3 R, float k)'));
      expect(body).toContain('vec2 p = R.xz / R.y;');
      expect(body).toContain('float az = atan(R.x, R.z); // 0 = toward the camera');
      expect(body).toContain('abs(az + TENT_STRIP_AZ.x)');
      expect(body).toContain('abs(az - TENT_STRIP_AZ.y)');
      expect(body).toContain('* mix(TENT_FLOOR_FRONT, 1.0, smoothstep(0.0, -0.8, R.z)); // floor sweep, lit behind: a lower rim');
      expect(body).not.toMatch(/uStudioWarm|AMBER/); // the amber fill was indistinguishable (author 2026-10-08): removed
      expect(body).not.toMatch(/skyFbm|skyNoise|skyHash|uSkyT/);
      expect(AETHER_SKY_GLSL).toContain('mean += wStudio * uStudioMean; // studioMeanCached (JS) at the live knobs');
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
      expect(AETHER_SKY_GLSL).toContain('float wN = uNeutralSky * clamp(1.0 - (uSkyW.x + uSkyW.y + uSkyW.z + uSkyW.w), 0.0, 1.0);');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyStudio(vec3 R) {');
      expect(AETHER_SKY_GLSL).toContain('float wStudio = wN * (1.0 - uNeutralNebula), wNeb = wN * uNeutralNebula;');
      expect(AETHER_SKY_GLSL).toContain('if (wStudio > SKY_W_MIN) s += wStudio * skyStudio(R);');
    });

    it('studio / nebula switch: each side evaluated only when it has weight; nebula = one rotated textureLod', () => {
      expect(AETHER_SKY_GLSL).toContain('vec3 neb = wNeb > SKY_W_MIN ? wNeb * skyNebula(R, k) : vec3(0.0);');
      expect(AETHER_SKY_GLSL).toContain('return textureLod(uNebulaMap, uNebulaRot * R, max(k * NEBULA_MAX_LOD, skyPxLod)).rgb;');
      // rough mirrors: the mip chain is the blur, added AFTER the element/studio mix toward the mean (no double flattening)
      expect(AETHER_SKY_GLSL).toContain('return mix(s, mean, k) + neb;');
      // limb: a pixel-footprint mip floor, set by shaders that have screen derivatives, 0 elsewhere
      expect(AETHER_SKY_GLSL).toContain('float skyPxLod = 0.0;');
      expect(AETHER_SKY_GLSL).toContain(`const float NEBULA_TEXEL_RAD = ${glf(NEBULA_TEXEL_RAD)};`);
      expect(AETHER_SKY_GLSL).toContain(`const float NEBULA_MAX_LOD = ${glf(NEBULA_MAX_LOD)};`);
      expect(AETHER_SKY_GLSL.match(/textureLod\(/g)).toHaveLength(1);
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
  });

  it('the sky noise is one shared chunk (the nebula bake reuses it verbatim)', () => {
    expect(SKY_NOISE_GLSL).toContain('float skyHash(vec3 p) {');
    expect(SKY_NOISE_GLSL).toContain('float skyNoise(vec3 x) {');
    expect(SKY_NOISE_GLSL).toContain('float skyFbm(vec3 p, float nOct) {');
    expect(AETHER_SKY_GLSL).toContain(SKY_NOISE_GLSL);
    expect(AETHER_SKY_GLSL.split('float skyHash(').length).toBe(2); // defined once
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
        expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      }
    });

    it('stretch + warp are frozen consts; the warp is in the layer frame (ph), periodic (cos/sin ph), on the sky clock, <= 3 octaves', () => {
      expect(AETHER_SKY_GLSL).not.toContain('R.y * 8.0');
      expect(AETHER_SKY_GLSL).toContain('vec3 wq = vec3(cos(ph), sin(ph), R.y * 1.5) * 1.2 + vec3(0.0, 0.0, uSkyT * 0.03);');
      expect(AETHER_SKY_GLSL).toContain('float phw = ph + AIR_SKY_WARP * (skyFbm(wq, wOct) - 0.5);');
      expect(AETHER_SKY_GLSL).toContain('float yw = R.y + AIR_SKY_WARP_Y * (skyFbm(wq + 7.3, wOct) - 0.5);');
      expect(AETHER_SKY_GLSL).toContain('vec3 q = vec3(cos(phw) * 1.2, sin(phw) * 1.2, yw * AIR_SKY_LAT);');
      expect(AETHER_SKY_GLSL).toContain('float wOct = min(nOct, 3.0);');
    });

    it('softer lines; a smooth spherical envelope instead of the plateau + shoulder', () => {
      expect(AETHER_SKY_GLSL).toContain('float lines = pow(1.0 - abs(n * 2.0 - 1.0), AIR_SKY_LINE_POW);');
      expect(AETHER_SKY_GLSL).toContain('float band = pow(max(1.0 - R.y * R.y, 0.0), AIR_SKY_ENV_POW);');
      expect(AETHER_SKY_GLSL).not.toContain('smoothstep(0.95, 0.2, abs(R.y))');
      const env = (y) => Math.max(1 - y * y, 0) ** AIR_SKY_ENV_POW;
      for (let y = 0.01; y < 1; y += 0.01) expect(env(y)).toBeLessThan(env(y - 0.01));
      expect(env(0.2)).toBeLessThan(0.95);
    });

    it('both layers stay rigid: the warp reads ph (az - spin of its own layer), never az alone', () => {
      expect(AETHER_SKY_GLSL).toContain('c += wUp * skyAirLayer(R, az - spin, 1.0, nOct);');
      expect(AETHER_SKY_GLSL).toContain('c += (1.0 - wUp) * skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct);');
    });

    it('uAirSkyLat / uAirSkyWarp are gone: consts, no uniforms, no PLANET_TUNE knobs', () => {
      for (const u of ['uAirSkyLat', 'uAirSkyWarp']) {
        expect(HG_MIRROR_UNIFORMS).not.toContain(u);
        expect(PLANET_UNIFORMS).not.toContain(u);
        expect(AETHER_SKY_GLSL).not.toContain(u);
      }
      expect(PLANET_TUNE).not.toHaveProperty('airSkyLat');
      expect(PLANET_TUNE).not.toHaveProperty('airSkyWarp');
    });
  });
});
