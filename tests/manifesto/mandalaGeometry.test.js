import { describe, it, expect } from 'vitest';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
} from '../../src/terminal/views/manifesto/MandalaGeometry';

describe('MANDALA_SECTOR_ORDER', () => {
  it('has exactly 16 sectors in chapter-contiguous clockwise order', () => {
    expect(MANDALA_SECTOR_ORDER).toEqual([
      'eco', 'bio', 'chem',
      'sync', 'phys', 'math',
      'topo', 'meta', 'synth',
      'cogn', 'aesth',
      'phil', 'hum', 'ling',
      'crypto', 'drk',
    ]);
  });
});

describe('sectorAngle', () => {
  it('places sector 0 (eco) at angle 0 (12 o\'clock)', () => {
    expect(sectorAngle(0)).toBeCloseTo(0, 6);
  });

  it('places sector 4 at π/2 (3 o\'clock equivalent for clockwise)', () => {
    expect(sectorAngle(4)).toBeCloseTo((4 / 16) * 2 * Math.PI, 6);
  });

  it('places sector 8 at π (6 o\'clock)', () => {
    expect(sectorAngle(8)).toBeCloseTo(Math.PI, 6);
  });

  it('throws for out-of-range sector index', () => {
    expect(() => sectorAngle(-1)).toThrow();
    expect(() => sectorAngle(16)).toThrow();
  });
});
