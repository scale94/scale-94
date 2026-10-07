// The moving per-element mirror sky (mirror-sky spec §2): approved looks, bound to the shared clock.
import { describe, it, expect } from 'vitest';
import { glf, v3 } from '../../../gl/glf';
import {
  AETHER_SKY_GLSL, SKY_OCTAVES, SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, SKY_MEAN, AIR_SHEAR_BAND,
  NEUTRAL_SKY_LUM, NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT,
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
    expect(AETHER_SKY_GLSL).toContain('if (k >= 1.0) return mean;');
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

  describe('neutralSky (Task 7): the resting mirror sees a quiet silver sky', () => {
    it('constants as ruled, interpolated into the GLSL', () => {
      expect(NEUTRAL_SKY_LUM).toBe(0.03);
      expect(NEUTRAL_SKY_FLOOR).toBe(0.35);
      expect(NEUTRAL_SKY_DRIFT).toBe(0.02);
      for (const [n, v] of Object.entries({ NEUTRAL_SKY_LUM, NEUTRAL_SKY_FLOOR, NEUTRAL_SKY_DRIFT })) {
        expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
      }
    });

    it('SKY_MEAN.neutral is the analytic mean, colourless', () => {
      const BAND_MEAN = 0.55 + 0.45 * (1 - 0.5);
      const m = NEUTRAL_SKY_LUM * (NEUTRAL_SKY_FLOOR + (1 - NEUTRAL_SKY_FLOOR) * BAND_MEAN);
      expect(SKY_MEAN.neutral).toHaveLength(3);
      for (const c of SKY_MEAN.neutral) expect(c).toBeCloseTo(m, 12);
      expect(SKY_MEAN.neutral[0]).toBe(SKY_MEAN.neutral[1]);
      expect(SKY_MEAN.neutral[1]).toBe(SKY_MEAN.neutral[2]);
    });

    it('neutral weight fills what the element skies leave; evaluated only above SKY_W_MIN', () => {
      expect(AETHER_SKY_GLSL).toContain('float wN = uNeutralSky * clamp(1.0 - (uSkyW.x + uSkyW.y + uSkyW.z + uSkyW.w), 0.0, 1.0);');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyNeutral(vec3 R, float nOct) {');
      expect(AETHER_SKY_GLSL).toContain('mean += wN * SKY_MEAN_NEUTRAL;');
      expect(AETHER_SKY_GLSL).toContain('if (wN > SKY_W_MIN) s += wN * skyNeutral(R, nOct);');
    });

    it('colourless, horizon-bright band, slow drift on the calm-gated sky clock, at most 3 octaves', () => {
      expect(AETHER_SKY_GLSL).toContain('float band = 0.55 + 0.45 * (1.0 - abs(R.y));');
      expect(AETHER_SKY_GLSL).toContain('skyFbm(skyRotY(R, NEUTRAL_SKY_DRIFT * uSkyT) * 1.3 + vec3(0.0, uSkyT * NEUTRAL_SKY_DRIFT * 0.5, 0.0), min(nOct, 3.0)) * 2.0');
      expect(AETHER_SKY_GLSL).toContain('NEUTRAL_SKY_LUM * (NEUTRAL_SKY_FLOOR + (1.0 - NEUTRAL_SKY_FLOOR) * band * cloud)');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyRotY(vec3 v, float a)');
    });

    it('uNeutralSky is a mirror uniform, fed to the planet too', () => {
      expect(HG_MIRROR_UNIFORMS).toContain('uNeutralSky');
      expect(PLANET_UNIFORMS).toContain('uNeutralSky');
    });

    it('PLANET_TUNE.neutralSky is on by default', () => {
      expect(PLANET_TUNE.neutralSky).toBe(1);
    });
  });
});
