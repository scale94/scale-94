import { describe, it, expect } from 'vitest';
import {
  tensionG, energyErg, strength01, transitMs, speedKmS, stormNt, stormMs,
  couples, hemisphereHandedness, facesCamera,
  TENSION_QUIET_G, TENSION_SNAP_G, TURNS_TO_SNAP, MIN_SNAP_TURNS,
  E_MIN_ERG, E_MAX_ERG, TRANSIT_FAST_H, TRANSIT_SLOW_H, AU_KM,
  DST_WEAK_NT, DST_STRONG_NT, STORM_SHORT_H, STORM_LONG_H,
} from '../solPhysics.js';

describe('tensionG', () => {
  it('runs linearly from quiet to snap over 0..TURNS_TO_SNAP and clamps', () => {
    expect(tensionG(0)).toBe(300);
    expect(tensionG(6)).toBe(4000);
    expect(tensionG(99)).toBe(4000);
    expect(tensionG(-5)).toBe(TENSION_QUIET_G);
    expect(tensionG(3)).toBeCloseTo((TENSION_QUIET_G + TENSION_SNAP_G) / 2, 6);
  });
});

describe('energyErg', () => {
  it('maps MIN_SNAP_TURNS to E_MIN and TURNS_TO_SNAP to E_MAX', () => {
    expect(energyErg(6)).toBeCloseTo(5e32, -30);
    expect(energyErg(1)).toBeCloseTo(1e29, -27);
  });
  it('clamps below MIN_SNAP_TURNS and above TURNS_TO_SNAP', () => {
    expect(energyErg(-3)).toBe(E_MIN_ERG);
    expect(energyErg(0.5)).toBe(E_MIN_ERG);
    expect(energyErg(50)).toBe(E_MAX_ERG);
  });
  it('log-interpolates in the middle', () => {
    const mid = (MIN_SNAP_TURNS + TURNS_TO_SNAP) / 2;
    const expectedLog = (Math.log10(E_MIN_ERG) + Math.log10(E_MAX_ERG)) / 2;
    expect(Math.log10(energyErg(mid))).toBeCloseTo(expectedLog, 9);
  });
});

describe('strength01', () => {
  it('is 0 at E_MIN, 1 at E_MAX, and clamps outside', () => {
    expect(strength01(E_MIN_ERG)).toBe(0);
    expect(strength01(E_MAX_ERG)).toBe(1);
    expect(strength01(1e20)).toBe(0);
    expect(strength01(1e40)).toBe(1);
  });
  it('is 0.5 at the log-midpoint of the range', () => {
    expect(strength01(Math.sqrt(E_MIN_ERG * E_MAX_ERG))).toBeCloseTo(0.5, 9);
  });
});

describe('transitMs', () => {
  it('lerps slow to fast transit with strength', () => {
    expect(transitMs(5e32)).toBeCloseTo(17.6 * 3600e3, 0);
    expect(transitMs(1e29)).toBeCloseTo(72 * 3600e3, 0);
    expect(transitMs(Math.sqrt(1e29 * 5e32))).toBeCloseTo(((72 + 17.6) / 2) * 3600e3, -3);
  });
});

describe('speedKmS', () => {
  it('is AU divided by transit seconds', () => {
    expect(speedKmS(17.6 * 3600e3)).toBeCloseTo(2361, 0);
  });
});

describe('stormNt', () => {
  it('lerps weak to strong Dst with strength and returns exact endpoints', () => {
    expect(stormNt(5e32)).toBe(-1200);
    expect(stormNt(1e29)).toBe(-50);
    expect(stormNt(1e20)).toBe(DST_WEAK_NT);
    expect(stormNt(1e40)).toBe(DST_STRONG_NT);
  });
});

describe('stormMs', () => {
  it('lerps short to long storm duration and returns exact endpoints', () => {
    expect(stormMs(1e29)).toBe(3 * 3600e3);
    expect(stormMs(5e32)).toBe(12 * 3600e3);
    expect(stormMs(1e20)).toBe(STORM_SHORT_H * 3600e3);
    expect(stormMs(1e40)).toBe(STORM_LONG_H * 3600e3);
  });
});

describe('couples', () => {
  it('is true only for cw handedness', () => {
    expect(couples('cw')).toBe(true);
    expect(couples('ccw')).toBe(false);
  });
});

describe('hemisphereHandedness', () => {
  it('is ccw in the northern hemisphere (including the equator) and cw in the south', () => {
    expect(hemisphereHandedness(0.3)).toBe('ccw');
    expect(hemisphereHandedness(-0.3)).toBe('cw');
    expect(hemisphereHandedness(0)).toBe('ccw');
  });
});

describe('facesCamera', () => {
  it('is true for aligned unit vectors', () => {
    expect(facesCamera([0, 0, 1], [0, 0, 1])).toBe(true);
  });
  it('is true inside the 35 degree cone and false outside it', () => {
    expect(facesCamera([Math.sin(0.5), 0, Math.cos(0.5)], [0, 0, 1])).toBe(true);   // ~28.6 deg
    expect(facesCamera([Math.sin(0.7), 0, Math.cos(0.7)], [0, 0, 1])).toBe(false);  // 40 deg
  });
  it('is false on any NaN component', () => {
    expect(facesCamera([NaN, 0, 1], [0, 0, 1])).toBe(false);
    expect(facesCamera([0, 0, 1], [0, NaN, 1])).toBe(false);
  });
});

describe('constants', () => {
  it('keeps the AU and transit constants the maps depend on', () => {
    expect(AU_KM).toBe(1.496e8);
    expect(TRANSIT_FAST_H).toBe(17.6);
    expect(TRANSIT_SLOW_H).toBe(72);
  });
});
