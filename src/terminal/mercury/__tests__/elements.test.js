// src/terminal/mercury/__tests__/elements.test.js — shared palette + env-state resolution.
import { describe, it, expect } from 'vitest';
import { ELEMENTS, NEUTRAL_NIGHT, elementForPhase, resolveEnvState } from '../elements';

const IDLE = { chromePhase: 0, colorBlend: 0 };

describe('ELEMENTS palette', () => {
  it('is keyed by phase name, not element name', () => {
    // Regression guard: 'thermal' and 'fluid' are the phase names the
    // transition system emits — an element-name-keyed map ('fire', 'water')
    // silently falls back to neutral for exactly these two.
    expect(elementForPhase('thermal').color).toBe('#f97316'); // FIRE
    expect(elementForPhase('fluid').color).toBe('#6366f1');   // WATER
    expect(elementForPhase('air').color).toBe('#38bdf8');
    expect(elementForPhase('earth').color).toBe('#d97706');
  });

  it('falls back to neutral night for unknown or null phase', () => {
    expect(elementForPhase('quintessence')).toBe(NEUTRAL_NIGHT);
    expect(elementForPhase(null)).toBe(NEUTRAL_NIGHT);
  });

  it('places air high and earth low in the world', () => {
    expect(ELEMENTS.air.horizonHeight).toBeGreaterThan(ELEMENTS.thermal.horizonHeight);
    expect(ELEMENTS.earth.horizonHeight).toBeLessThan(ELEMENTS.fluid.horizonHeight);
  });
});

describe('resolveEnvState', () => {
  it('idle: effective color is the active element, untouched by pending=null', () => {
    const s = resolveEnvState('thermal', null, IDLE);
    expect(s.elementColor.map(v => Math.round(v * 255))).toEqual([0xf9, 0x73, 0x16]);
    expect(s.horizonHeight).toBe(ELEMENTS.thermal.horizonHeight);
    expect(s.chromePhase).toBe(0);
  });

  it('continuity: end of emerging equals the new idle (no visual pop at beat reset)', () => {
    // usePhaseTransition.js:89-98 — at emerging end (active='fluid',
    // pending='thermal', colorBlend=1) the state resets to idle
    // (active='thermal', pending=null, colorBlend=0). Same frame, same world.
    const endOfEmerging = resolveEnvState('fluid', 'thermal', { chromePhase: 0, colorBlend: 1 });
    const newIdle       = resolveEnvState('thermal', null,     IDLE);
    expect(endOfEmerging.elementColor).toEqual(newIdle.elementColor);
    expect(endOfEmerging.horizonHeight).toBe(newIdle.horizonHeight);
  });

  it('mid-blend: color and horizon interpolate between active and pending', () => {
    const s = resolveEnvState('fluid', 'thermal', { chromePhase: 0.3, colorBlend: 0.5 });
    const water = resolveEnvState('fluid', null, IDLE);
    const fire  = resolveEnvState('thermal', null, IDLE);
    s.elementColor.forEach((v, i) => {
      expect(v).toBeCloseTo((water.elementColor[i] + fire.elementColor[i]) / 2, 5);
    });
    expect(s.horizonHeight).toBeCloseTo(
      (ELEMENTS.fluid.horizonHeight + ELEMENTS.thermal.horizonHeight) / 2, 5
    );
    expect(s.chromePhase).toBe(0.3);
  });

  it('tolerates missing sphereState (defensive default = idle)', () => {
    const s = resolveEnvState('air', null, undefined);
    expect(s.chromePhase).toBe(0);
    expect(s.horizonHeight).toBe(ELEMENTS.air.horizonHeight);
  });
});
