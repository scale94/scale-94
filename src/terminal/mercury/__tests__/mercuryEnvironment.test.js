// src/terminal/mercury/__tests__/mercuryEnvironment.test.js — the dissolution
// arc's wiring into uniforms. resolveEnvState's own math is fully covered by
// elements.test.js; this file tests only that applyEnvState pipes it into
// real THREE uniforms correctly (and touches nothing else).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyEnvState, nextBurst } from '../MercuryEnvironment';
import { ELEMENTS } from '../elements';

function makeUniforms() {
  return {
    uElementColor:  { value: new THREE.Color() },
    uChromePhase:   { value: 9 },
    uHorizonHeight: { value: 9 },
    uTime:          { value: 0 },
  };
}

describe('applyEnvState', () => {
  it('idle thermal: uElementColor reads fire, chromePhase 0, horizon from ELEMENTS.thermal', () => {
    const uniforms = makeUniforms();
    applyEnvState(uniforms, 'thermal', null, { chromePhase: 0, colorBlend: 0 });
    const c = uniforms.uElementColor.value;
    expect(c.r).toBeCloseTo(0xf9 / 255, 5);
    expect(c.g).toBeCloseTo(0x73 / 255, 5);
    expect(c.b).toBeCloseTo(0x16 / 255, 5);
    expect(uniforms.uChromePhase.value).toBe(0);
    expect(uniforms.uHorizonHeight.value).toBe(ELEMENTS.thermal.horizonHeight);
  });

  it('peak chrome: uChromePhase passes through untouched (shader does the neutral drain)', () => {
    const uniforms = makeUniforms();
    applyEnvState(uniforms, 'fluid', 'thermal', { chromePhase: 1, colorBlend: 0 });
    expect(uniforms.uChromePhase.value).toBe(1);
  });

  it('flowing payoff: color and horizon are 60% toward fire from water', () => {
    const uniforms = makeUniforms();
    applyEnvState(uniforms, 'fluid', 'thermal', { chromePhase: 0.45, colorBlend: 0.6 });

    // Raw hex->0-1 channels, no color-management conversion — matches
    // elements.js's own hexToRgb (and setRGB's linear-srgb-workspace default).
    const hexToRgb = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    const water = hexToRgb(ELEMENTS.fluid.color);
    const fire  = hexToRgb(ELEMENTS.thermal.color);
    const c = uniforms.uElementColor.value;
    expect(c.r).toBeCloseTo(water[0] + (fire[0] - water[0]) * 0.6, 5);
    expect(c.g).toBeCloseTo(water[1] + (fire[1] - water[1]) * 0.6, 5);
    expect(c.b).toBeCloseTo(water[2] + (fire[2] - water[2]) * 0.6, 5);

    const expectedHorizon = ELEMENTS.fluid.horizonHeight
      + (ELEMENTS.thermal.horizonHeight - ELEMENTS.fluid.horizonHeight) * 0.6;
    expect(uniforms.uHorizonHeight.value).toBeCloseTo(expectedHorizon, 5);
  });

  it('continuity: end-of-emerging uniforms equal new-idle uniforms (no pop at beat reset)', () => {
    const endUniforms = makeUniforms();
    applyEnvState(endUniforms, 'fluid', 'thermal', { chromePhase: 0, colorBlend: 1 });

    const idleUniforms = makeUniforms();
    applyEnvState(idleUniforms, 'thermal', null, { chromePhase: 0, colorBlend: 0 });

    expect(endUniforms.uElementColor.value.getHex()).toBe(idleUniforms.uElementColor.value.getHex());
    expect(endUniforms.uHorizonHeight.value).toBe(idleUniforms.uHorizonHeight.value);
    expect(endUniforms.uChromePhase.value).toBe(idleUniforms.uChromePhase.value);
  });

  it('does not touch uTime', () => {
    const uniforms = makeUniforms();
    uniforms.uTime.value = 42;
    applyEnvState(uniforms, 'air', null, { chromePhase: 0, colorBlend: 0 });
    expect(uniforms.uTime.value).toBe(42);
  });
});

describe('nextBurst', () => {
  it('transition start increments', () => {
    expect(nextBurst(0, null, 'thermal')).toBe(1);
  });

  it('steady transition does not increment', () => {
    expect(nextBurst(1, 'thermal', 'thermal')).toBe(1);
  });

  it('transition end does not increment (double-remount regression guard)', () => {
    expect(nextBurst(1, 'thermal', null)).toBe(1);
  });

  it('idle stays', () => {
    expect(nextBurst(1, null, null)).toBe(1);
  });

  it('back-to-back different transition increments', () => {
    expect(nextBurst(1, 'thermal', 'air')).toBe(2);
  });
});
