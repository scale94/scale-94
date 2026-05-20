import { describe, it, expect } from 'vitest';
import { computeInstruments } from '../../src/terminal/mercury/instruments';

const mockMercury = {
  heliocentricDistanceAU:  0.387,    // baseline (semi-major axis)
  solarFluxWm2:            9080,
  subsolarTempK:           650,
  earthMercuryDistanceAU:  0.9,
};

const mockCanvas = {
  activePhase:   'fluid',
  turbulence:    0.25,
  density:       1200,
  speed:         0.1,
  curlAmp:       0.02,
  eruptStrength: 0.8,
  spread:        1.0,
  chromatic:     0.0,
  orbitalSpeed:  1.2,
  flameWidth:    0.85,
};

describe('computeInstruments', () => {
  it('returns exactly six instruments', () => {
    expect(computeInstruments(mockMercury, mockCanvas)).toHaveLength(6);
  });

  it('each instrument has label, unit, value, min, max', () => {
    const arr = computeInstruments(mockMercury, mockCanvas);
    for (const inst of arr) {
      expect(inst).toHaveProperty('label');
      expect(inst).toHaveProperty('unit');
      expect(inst).toHaveProperty('value');
      expect(inst).toHaveProperty('min');
      expect(inst).toHaveProperty('max');
      expect(typeof inst.value).toBe('number');
      expect(Number.isFinite(inst.value)).toBe(true);
    }
  });

  it('PROMISE HALF-LIFE shortens with turbulence', () => {
    const calm   = computeInstruments(mockMercury, { ...mockCanvas, turbulence: 0.0 });
    const stormy = computeInstruments(mockMercury, { ...mockCanvas, turbulence: 0.9 });
    const calmVal   = calm.find(i => i.label === 'PROMISE HALF-LIFE').value;
    const stormyVal = stormy.find(i => i.label === 'PROMISE HALF-LIFE').value;
    expect(stormyVal).toBeLessThan(calmVal);
  });

  it('WORSHIP TEMPERATURE equals subsolar temp when EARTH phase inactive', () => {
    const result = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'fluid' });
    const worship = result.find(i => i.label === 'WORSHIP TEMPERATURE').value;
    expect(worship).toBeCloseTo(650, 0);
  });

  it('WORSHIP TEMPERATURE amplified when EARTH phase active', () => {
    const result = computeInstruments(mockMercury, {
      ...mockCanvas, activePhase: 'earth', eruptStrength: 1.0,
    });
    const worship = result.find(i => i.label === 'WORSHIP TEMPERATURE').value;
    expect(worship).toBeGreaterThan(650);
  });

  it('FORGETTING FLUX is inverse-square of earth-mercury distance', () => {
    const near = computeInstruments(
      { ...mockMercury, earthMercuryDistanceAU: 0.6 },
      { ...mockCanvas, chromatic: 0.9 },
    );
    const far  = computeInstruments(
      { ...mockMercury, earthMercuryDistanceAU: 1.4 },
      { ...mockCanvas, chromatic: 0.9 },
    );
    const nearVal = near.find(i => i.label === 'FORGETTING FLUX').value;
    const farVal  = far.find(i => i.label === 'FORGETTING FLUX').value;
    expect(nearVal).toBeGreaterThan(farVal);
  });

  it('GRIEF INDEX modulator active only in FLUID or AIR phase', () => {
    const fluid   = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'fluid',   curlAmp: 0.1 });
    const thermal = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'thermal', curlAmp: 0.1 });
    const fluidGrief   = fluid.find(i => i.label === 'GRIEF INDEX').value;
    const thermalGrief = thermal.find(i => i.label === 'GRIEF INDEX').value;
    expect(fluidGrief).toBeGreaterThan(thermalGrief);
  });
});
