import { describe, it, expect } from 'vitest';
import {
  AETHER_ELEMENT_LIGHT, LIT_MAX, COS_REF, litPhase, litRef, shadowFactor, aetherLightAt,
  AETHER_SHADOW_GLSL, AETHER_LIGHT_VS, aetherLightFS,
} from '../aetherLight';
import { SUN_DIR_WORLD } from '../planetFrame';
import { PLANET_TUNE } from '../planetLook';
import { glf } from '../../../gl/glf';

const S = SUN_DIR_WORLD;
const scale = (v, k) => v.map((c) => c * k);
const add = (a, b) => a.map((c, i) => c + b[i]);
const OPT = { floor: 0.2, pen: 0.08, R: 0.75 };
const CAM = [0, 0, 4.4];

describe('shadowFactor (the planet shadow cylinder, anti-sunward)', () => {
  it('sunward side is always lit; the anti-sunward axis is umbra', () => {
    expect(shadowFactor(scale(S, 2), S, 0.75, 0.08)).toBe(1);
    expect(shadowFactor(scale(S, -2), S, 0.75, 0.08)).toBe(0);
  });
  it('outside the cylinder is lit; the penumbra is monotonic and soft', () => {
    const perp = [0, 1, 0]; // ⟂ to the Sun (S has y = 0)
    const at = (radial) => shadowFactor(add(scale(S, -1.5), scale(perp, radial)), S, 0.75, 0.08);
    expect(at(0.75 + 0.2)).toBe(1);
    expect(at(0.75 - 0.2)).toBe(0);
    const samples = [0.67, 0.70, 0.73, 0.75, 0.77, 0.80, 0.83].map(at);
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    expect(at(0.75)).toBeCloseTo(0.5, 6);
  });
});

describe('phase functions', () => {
  it('water scatters forward, earth backward (with an opposition surge), air is symmetric', () => {
    const { fluid, earth, air } = AETHER_ELEMENT_LIGHT;
    expect(litPhase(fluid, 0.9)).toBeGreaterThan(litPhase(fluid, -0.9));
    expect(litPhase(earth, -0.9)).toBeGreaterThan(litPhase(earth, 0.9));
    expect(litPhase(earth, -1)).toBeGreaterThan(litPhase(earth, -0.8) * 1.1);
    expect(litPhase(air, 0.6)).toBeCloseTo(litPhase(air, -0.6), 12);
  });
  it('is normalised at the camera scattering angle', () => {
    expect(COS_REF).toBeCloseTo(-Math.cos((55 * Math.PI) / 180), 12);
    for (const el of ['fluid', 'earth', 'air']) expect(litPhase(AETHER_ELEMENT_LIGHT[el], COS_REF) / litRef(el)).toBeCloseTo(1, 12);
  });
});

describe('aetherLightAt', () => {
  it('a lit particle on the camera axis keeps exactly today\'s brightness', () => {
    for (const el of ['fluid', 'earth', 'air']) expect(aetherLightAt(el, [0, 0, 1.5], CAM, OPT)).toBeCloseTo(1, 12);
  });
  it('umbra falls to the floor, never below', () => {
    for (const el of ['fluid', 'earth', 'air']) expect(aetherLightAt(el, scale(S, -2), CAM, OPT)).toBeCloseTo(0.2, 12);
  });
  it('is capped at floor + (1 − floor) · LIT_MAX', () => {
    // Lit point under true forward scattering: c = 1, water's HG ratio ≈ 46, exceeds cap without clamp
    const p = scale(S, 2);
    const viewer = add(p, scale(S, -40));
    expect(aetherLightAt('fluid', p, viewer, OPT)).toBeCloseTo(0.2 + 0.8 * LIT_MAX, 12);
  });
  it('fire is emissive: always 1', () => {
    expect(aetherLightAt('thermal', scale(S, -2), CAM, OPT)).toBe(1);
  });
});

describe('GLSL chunks', () => {
  it('shadow chunk is the JS shadowFactor', () => {
    expect(AETHER_SHADOW_GLSL).toContain('float aetherShadow(vec3 rel, vec3 s, float R, float pen)');
    expect(AETHER_SHADOW_GLSL).toContain('smoothstep(R - pen, R + pen, radial)');
  });
  it('vertex chunk reconstructs the sprite size in view units', () => {
    expect(AETHER_LIGHT_VS).toContain('void aetherLightVS(vec3 mv, float pointSizePx)');
    expect(AETHER_LIGHT_VS).toContain('pointSizePx * 2.0 * (-mv.z) / (projectionMatrix[1][1] * uViewportPx.y)');
  });
  it('fragment chunk bakes each element\'s constants', () => {
    const fs = aetherLightFS('earth');
    expect(fs).toContain('float aetherLight()');
    expect(fs).toContain(`const float LIT_G = ${glf(-0.3)};`);
    expect(fs).toContain(`const float LIT_REF = ${glf(litRef('earth'))};`);
    expect(fs).toContain(AETHER_SHADOW_GLSL);
    expect(() => aetherLightFS('thermal')).toThrow(/emissive/);
  });
  it('tunables live in PLANET_TUNE', () => {
    expect(PLANET_TUNE.aetherFloor).toBe(0.2);
    expect(PLANET_TUNE.aetherPenumbra).toBe(0.08);
  });
});
