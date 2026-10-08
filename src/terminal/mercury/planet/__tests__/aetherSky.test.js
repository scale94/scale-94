// The moving per-element mirror sky (mirror-sky spec §2): approved looks, bound to the shared clock.
import { describe, it, expect } from 'vitest';
import { glf, v3 } from '../../../gl/glf';
import {
  AETHER_SKY_GLSL, SKY_NOISE_GLSL, NEBULA_MAX_LOD, NEBULA_TEXEL_RAD, SKY_OCTAVES, SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, SKY_MEAN, AIR_SHEAR_BAND,
  AIR_SKY_LINE_POW, AIR_SKY_ENV_POW, AIR_SKY_WARP_Y, AIR_SKY_LAT, AIR_SKY_WARP,
  NEUTRAL_SKY_FLOOR, NEUTRAL_HORIZON_LUM, NEUTRAL_HORIZON_W, NEUTRAL_STRIP_LUM, NEUTRAL_STRIP_AZ, NEUTRAL_STRIP_HW,
  NEUTRAL_STRIP_GAIN, NEUTRAL_STRIP_Y0, NEUTRAL_STRIP_Y1, NEUTRAL_STRIP_YSOFT, NEUTRAL_SKY_DRIFT,
  NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW, NEUTRAL_DOME_MEAN,
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

  describe('neutralSky (Task 7, option B): the resting mirror sees a studio', () => {
    const SCALARS = { NEUTRAL_SKY_FLOOR, NEUTRAL_HORIZON_LUM, NEUTRAL_HORIZON_W, NEUTRAL_STRIP_LUM, NEUTRAL_STRIP_HW,
      NEUTRAL_STRIP_Y0, NEUTRAL_STRIP_Y1, NEUTRAL_STRIP_YSOFT, NEUTRAL_SKY_DRIFT, NEUTRAL_DOME_NADIR, NEUTRAL_DOME_POW, NEUTRAL_DOME_MEAN };

    it('constants interpolated into the GLSL', () => {
      for (const [n, v] of Object.entries(SCALARS)) expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      expect(AETHER_SKY_GLSL).toContain(`const vec3 NEUTRAL_STRIP_AZ = ${v3(NEUTRAL_STRIP_AZ)};`);
      expect(AETHER_SKY_GLSL).toContain(`const vec3 NEUTRAL_STRIP_GAIN = ${v3(NEUTRAL_STRIP_GAIN)};`);
      expect(NEUTRAL_SKY_DRIFT).toBe(0.02);
    });

    it('contrast without decals: near-black floor, reflectors far above it, soft (Gaussian, uneven, soft horizon band)', () => {
      expect(NEUTRAL_SKY_FLOOR).toBeLessThan(0.01);
      expect(NEUTRAL_HORIZON_LUM / NEUTRAL_SKY_FLOOR).toBeGreaterThan(25);
      expect(NEUTRAL_STRIP_LUM / NEUTRAL_SKY_FLOOR).toBeGreaterThan(50);
      expect(NEUTRAL_HORIZON_W).toBeGreaterThanOrEqual(0.05); // a band, not a drawn line (author 2026-10-08)
      expect(AETHER_SKY_GLSL).toContain('return exp(-d * d);'); // no plateau, no edge
      expect(new Set(NEUTRAL_STRIP_GAIN).size).toBe(NEUTRAL_STRIP_GAIN.length); // a key, a fill, a rim
      expect(Math.max(...NEUTRAL_STRIP_GAIN)).toBe(1);
    });

    it('reflectors never overlap (the analytic mean assumes it): gaps exceed 3 widths each side', () => {
      const az = [...NEUTRAL_STRIP_AZ].sort((x, y) => x - y);
      const gaps = az.map((c, i) => (i + 1 < az.length ? az[i + 1] - c : az[0] + 2 * Math.PI - c));
      for (const g of gaps) expect(g).toBeGreaterThan(6 * NEUTRAL_STRIP_HW);
      expect(NEUTRAL_STRIP_Y1 - NEUTRAL_STRIP_Y0).toBeGreaterThan(2 * NEUTRAL_STRIP_YSOFT);
    });

    it('studio dome: directional (bright overhead, dark below), live, default off until the author rules', () => {
      expect(AETHER_SKY_GLSL).toContain('L += uStudioDome * (NEUTRAL_DOME_NADIR + (1.0 - NEUTRAL_DOME_NADIR) * pow(0.5 + 0.5 * R.y, NEUTRAL_DOME_POW));');
      expect(NEUTRAL_DOME_NADIR).toBeLessThan(0.2); // never a flat wash: zenith ≥ 5× nadir
      expect(HG_MIRROR_UNIFORMS).toContain('uStudioDome');
      expect(PLANET_UNIFORMS).toContain('uStudioDome');
      expect(PLANET_TUNE.studioDome).toBe(0);
      // numeric mean of the dome shape over the sphere (uniform in R.y)
      const N = 20000; let m = 0;
      for (let i = 0; i < N; i++) { const y = -1 + (2 * (i + 0.5)) / N; m += NEUTRAL_DOME_NADIR + (1 - NEUTRAL_DOME_NADIR) * ((1 + y) / 2) ** NEUTRAL_DOME_POW; }
      expect(NEUTRAL_DOME_MEAN).toBeCloseTo(m / N, 5);
      expect(AETHER_SKY_GLSL).toContain('mean += wStudio * (SKY_MEAN_NEUTRAL + uStudioDome * NEUTRAL_DOME_MEAN);');
    });

    it('SKY_MEAN.neutral is the analytic mean, colourless, and matches a numeric integral', () => {
      const ss = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
      const N = 2000, M = 2000; let sum = 0;
      for (let i = 0; i < N; i++) {
        const y = -1 + (2 * (i + 0.5)) / N;
        const hz = y / NEUTRAL_HORIZON_W;
        const span = ss(NEUTRAL_STRIP_Y0 - NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y0 + NEUTRAL_STRIP_YSOFT, y)
          * ss(NEUTRAL_STRIP_Y1 + NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y1 - NEUTRAL_STRIP_YSOFT, y);
        let strips = 0;
        for (let j = 0; j < M; j++) {
          const az = -Math.PI + (2 * Math.PI * (j + 0.5)) / M;
          NEUTRAL_STRIP_AZ.forEach((c, k) => {
            const d = Math.abs((((az - c + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / NEUTRAL_STRIP_HW;
            strips += NEUTRAL_STRIP_GAIN[k] * Math.exp(-d * d);
          });
        }
        sum += NEUTRAL_SKY_FLOOR + NEUTRAL_HORIZON_LUM * Math.exp(-hz * hz) + NEUTRAL_STRIP_LUM * span * strips / M;
      }
      expect(SKY_MEAN.neutral).toHaveLength(3);
      for (const c of SKY_MEAN.neutral) expect(c).toBeCloseTo(sum / N, 5);
      expect(SKY_MEAN.neutral[0]).toBe(SKY_MEAN.neutral[1]);
      expect(SKY_MEAN.neutral[1]).toBe(SKY_MEAN.neutral[2]);
    });

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

    it("SKY_MEAN.nebula is the measured mean, in the studio's range (frost / crust ambient does not jump between modes)", () => {
      // author 2026-10-08 ruled deeper obsidian voids: the nebula now sits ~1/3 under the studio (was within 30 %)
      expect(SKY_MEAN.nebula[0]).toBeGreaterThanOrEqual(0.015);
      expect(SKY_MEAN.nebula[0]).toBeLessThanOrEqual(0.035);
      expect(Math.abs(SKY_MEAN.nebula[0] - SKY_MEAN.neutral[0]) / SKY_MEAN.neutral[0]).toBeLessThan(0.4);
    });

    it('the nebula switch is a mirror uniform, studio by default (author rules after the look sheet)', () => {
      for (const u of ['uNeutralNebula', 'uNebulaRot', 'uNebulaMap']) {
        expect(HG_MIRROR_UNIFORMS).toContain(u);
        expect(PLANET_UNIFORMS).toContain(u);
      }
      expect(PLANET_TUNE.neutralNebula).toBe(0);
    });
    it('no noise, rigid drift on the calm-gated sky clock', () => {
      const body = AETHER_SKY_GLSL.slice(AETHER_SKY_GLSL.indexOf('float skyNeutralStrip('), AETHER_SKY_GLSL.indexOf('vec3 skyNebula(vec3 R, float k)'));
      expect(body).not.toMatch(/skyFbm|skyNoise|skyHash/);
      expect(body).toContain('float az = atan(R.z, R.x) - NEUTRAL_SKY_DRIFT * uSkyT;');
      expect(body).toContain('NEUTRAL_HORIZON_LUM * exp(-hz * hz)');
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
