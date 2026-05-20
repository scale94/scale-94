import { describe, it, expect } from 'vitest';
import { CASTLES, buildStatusLine, J2000_MS } from '../../src/terminal/mercury/castles';

describe('CASTLES', () => {
  it('has exactly four castles', () => {
    expect(CASTLES).toHaveLength(4);
  });

  it('one castle per phase id', () => {
    const phases = CASTLES.map(c => c.phase).sort();
    expect(phases).toEqual(['air', 'earth', 'fluid', 'thermal']);
  });

  it('each castle has required fields', () => {
    for (const c of CASTLES) {
      expect(c).toHaveProperty('phase');
      expect(c).toHaveProperty('glyph');
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('silhouette');
      expect(c).toHaveProperty('commemorates');
      expect(c).toHaveProperty('builtFrom');
      expect(c).toHaveProperty('cycle');
      expect(c).toHaveProperty('dedication');
      expect(typeof c.statusFn).toBe('function');
      expect(c.silhouette.split('\n')).toHaveLength(4);
    }
  });
});

describe('buildStatusLine', () => {
  const mockMercury = {
    heliocentricDistanceAU: 0.4,
    subsolarTempK: 650,
    daysToNextPerihelion: 30,
    subsolarLongitudeDeg: 45,
    earthMercuryDistanceAU: 1.0,
  };
  const mockCanvas = {
    turbulence: 0.3, eruptStrength: 0.8, flameWidth: 0.85, spread: 1.0,
  };
  const fixedDate = new Date('2026-05-20T12:00:00Z');

  it('FLUID status mentions subsolar temp and graphene tension', () => {
    const fluid = CASTLES.find(c => c.phase === 'fluid');
    const line = fluid.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Nave \d+ of 23/);
    expect(line).toMatch(/650/);
    expect(line).toMatch(/graphene tension/);
  });

  it('THERMAL status mentions hearth number and perihelion countdown', () => {
    const thermal = CASTLES.find(c => c.phase === 'thermal');
    const line = thermal.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Hearth \d+ of 49/);
    expect(line).toMatch(/T−30d/);
  });

  it('EARTH status mentions wall course and longitude offset', () => {
    const earth = CASTLES.find(c => c.phase === 'earth');
    const line = earth.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Wall course/);
    expect(line).toMatch(/hot-pole face/);
  });

  it('AIR status mentions filament and earth-mercury distance', () => {
    const air = CASTLES.find(c => c.phase === 'air');
    const line = air.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Filament \d+/);
    expect(line).toMatch(/1\.000 AU/);
  });
});
