import { describe, it, expect } from 'vitest';
import {
  tensionG, energyErg, strength01, transitMs, speedKmS, stormNt, stormMs,
  couples, hemisphereHandedness, facesCamera,
  xrayFluxWm2, goesClass, xrayClass, protonOnsetMs, protonPeakPfu, sScale,
  NEUTRINO_DELAY_S, LIGHT_DELAY_S, CORE_PHOTON_YEARS, HELIUM_FLASH_YEARS, HE_BURN_END_YEARS,
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

describe('non-finite and edge inputs (review minors)', () => {
  it('NaN or negative inputs never return NaN', () => {
    expect(tensionG(NaN)).toBe(TENSION_QUIET_G);
    expect(energyErg(NaN)).toBe(E_MIN_ERG);
    expect(strength01(NaN)).toBe(0);
    expect(strength01(-1)).toBe(0);
    expect(strength01(0)).toBe(0);
    expect(Number.isFinite(transitMs(NaN))).toBe(true);
    expect(Number.isFinite(stormNt(-5))).toBe(true);
  });

  it('a non-finite latitude passes (ccw), never couples by accident', () => {
    expect(hemisphereHandedness(NaN)).toBe('ccw');
    expect(hemisphereHandedness(-0.1)).toBe('cw');
    expect(hemisphereHandedness(0)).toBe('ccw');
  });

  it('the Earth cone is 35 degrees either side', () => {
    const at = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
    expect(facesCamera(at(34.9), [0, 0, 1])).toBe(true);
    expect(facesCamera(at(35.1), [0, 0, 1])).toBe(false);
    expect(facesCamera(at(-34.9), [0, 0, 1])).toBe(true);
  });
});

describe('messengers physics', () => {
  it('X-ray flux spans C1.0 at E_MIN to X45 at E_MAX', () => {
    expect(xrayClass(1e29)).toBe('C1.0');
    expect(xrayClass(5e32)).toBe('X45');
    expect(xrayClass(3.1e32)).toBe('X28');
    expect(xrayFluxWm2(1e29)).toBeCloseTo(1e-6, 12);
  });
  it('goesClass picks the letter after rounding, so nothing reads C10.0', () => {
    expect(goesClass(3.2e-5)).toBe('M3.2');
    expect(goesClass(9.96e-6)).toBe('M1.0');
    expect(goesClass(1.2e-3)).toBe('X12');
    expect(goesClass(4.0e-4)).toBe('X4.0');
    expect(goesClass(2e-7)).toBe('B2.0');
  });
  it('proton onset runs 2 h (weak) to 15 min (strong), log-interpolated', () => {
    expect(protonOnsetMs(1e29)).toBeCloseTo(2 * 3600e3, 3);
    expect(protonOnsetMs(5e32)).toBeCloseTo(15 * 60e3, 3);
    const mid = protonOnsetMs(10 ** ((29 + Math.log10(5e32)) / 2));
    expect(mid).toBeCloseTo(Math.sqrt(2 * 3600e3 * 15 * 60e3), 0);
  });
  it('S-scale from peak pfu', () => {
    expect(protonPeakPfu(1e29)).toBeCloseTo(1, 9);
    expect(protonPeakPfu(5e32)).toBeCloseTo(1e5, 3);
    expect(sScale(9.99)).toBe('below S1');
    expect(sScale(10)).toBe('S1');
    expect(sScale(1e3)).toBe('S3');
    expect(sScale(1e5)).toBe('S5');
  });
  it('bad energy reads as the weakest, never NaN', () => {
    expect(xrayClass(NaN)).toBe('C1.0');
    expect(Number.isFinite(protonOnsetMs(-1))).toBe(true);
  });
  it('deep-time constants', () => {
    expect(NEUTRINO_DELAY_S).toBe(LIGHT_DELAY_S);
    expect(CORE_PHOTON_YEARS).toBe(170000);
    expect(HELIUM_FLASH_YEARS).toBe(7.59e9);
    expect(HE_BURN_END_YEARS).toBe(7.70e9);
  });
});
