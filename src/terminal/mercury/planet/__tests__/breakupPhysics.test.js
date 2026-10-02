import { describe, it, expect } from 'vitest';
import {
  M_PER_UNIT, TONGUE_ROOT_R, DROP_PLAYBACK, DROP_TC_ANCHOR_S, RP_LAMBDA_PER_R, BRIDGE_C,
  capillaryTime, rpWavelength, pinchRadius, bridgeRadius, bridgeTime, taylorCulick, wobbleOmega,
  sigmaRatio, sphereVol, radiusOfVol,
} from '../breakupPhysics';
import { DROP_R_M, MODE_PLAYBACK } from '../mercuryWaves';
import { R_SCENE } from '../planetLook';

describe('breakupPhysics — the laws the breakup runs on', () => {
  it('the planet is the 1 cm bead', () => {
    expect(M_PER_UNIT * R_SCENE).toBeCloseTo(DROP_R_M, 12);
  });

  it('droplets get their own playback (P1), anchored at the thread', () => {
    expect(capillaryTime(TONGUE_ROOT_R)).toBeCloseTo(DROP_TC_ANCHOR_S, 9);
    expect(DROP_PLAYBACK).toBeLessThan(MODE_PLAYBACK / 10);
  });

  it('capillary time scales as r^1.5 inside the family', () => {
    expect(capillaryTime(4 * TONGUE_ROOT_R) / capillaryTime(TONGUE_ROOT_R)).toBeCloseTo(8, 9);
  });

  it('Rayleigh–Plateau: λ ≈ 9.02 r0', () => {
    expect(rpWavelength(0.01)).toBeCloseTo(RP_LAMBDA_PER_R * 0.01, 12);
  });

  it('inviscid pinch-off thins as (t0 − t)^(2/3)', () => {
    expect(pinchRadius(1, 0, 1)).toBe(1);
    expect(pinchRadius(1, 1, 1)).toBe(0);
    expect(pinchRadius(1, 2, 1)).toBe(0);
    const t0 = 0.4;
    expect(pinchRadius(1, t0 - 0.2, t0) / pinchRadius(1, t0 - 0.1, t0)).toBeCloseTo(2 ** (2 / 3), 9);
  });

  it('inertial coalescence: the bridge grows as √t and reaches the small radius at bridgeTime', () => {
    const r = 0.03;
    expect(bridgeRadius(r, bridgeTime(r))).toBeCloseTo(r, 9);
    expect(bridgeRadius(r, 0.4) / bridgeRadius(r, 0.1)).toBeCloseTo(2, 9);
    expect(bridgeTime(r) / capillaryTime(r)).toBeCloseTo(1 / (BRIDGE_C * BRIDGE_C), 9);
    expect(bridgeRadius(r, 0)).toBe(0);
  });

  it('Taylor–Culick retracts √2 h per capillary time', () => {
    const h = TONGUE_ROOT_R;
    expect(taylorCulick(h) * capillaryTime(h)).toBeCloseTo(Math.sqrt(2) * h, 9);
  });

  it('a bead rings in ℓ = 2 at ω₂ t_c = √8', () => {
    expect(wobbleOmega(0.02) * capillaryTime(0.02)).toBeCloseTo(Math.sqrt(8), 9);
  });

  it('Σ = ρω²R³/8σ crosses the fission branch (~0.46) near 11.5 rad/s', () => {
    expect(sigmaRatio(11.47)).toBeGreaterThan(0.45);
    expect(sigmaRatio(11.47)).toBeLessThan(0.47);
    expect(sigmaRatio(7.5)).toBeLessThan(0.2);
  });

  it('volume ↔ radius round-trips', () => {
    expect(radiusOfVol(sphereVol(0.037))).toBeCloseTo(0.037, 12);
    expect(radiusOfVol(-1)).toBe(0);
  });
});
