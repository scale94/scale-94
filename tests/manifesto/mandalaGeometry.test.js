import { describe, it, expect } from 'vitest';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  nodeMagnitude,
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

describe('polarToCartesian', () => {
  it('angle 0, radius 100 → (0, -100) (12 o\'clock)', () => {
    const { x, y } = polarToCartesian(0, 100);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-100, 6);
  });

  it('angle π/2, radius 100 → (100, 0) (3 o\'clock)', () => {
    const { x, y } = polarToCartesian(Math.PI / 2, 100);
    expect(x).toBeCloseTo(100, 6);
    expect(y).toBeCloseTo(0, 6);
  });

  it('angle π, radius 100 → (0, 100) (6 o\'clock)', () => {
    const { x, y } = polarToCartesian(Math.PI, 100);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(100, 6);
  });
});

describe('nodeMagnitude', () => {
  it('returns 0 for an all-zero tensor', () => {
    expect(nodeMagnitude(new Array(32).fill(0))).toBe(0);
  });

  it('returns 1 for an all-ones tensor (L2 / sqrt(32))', () => {
    expect(nodeMagnitude(new Array(32).fill(1))).toBeCloseTo(1, 6);
  });

  it('returns ~0.5 for a half-filled tensor', () => {
    const t = new Array(32).fill(0.5);
    expect(nodeMagnitude(t)).toBeCloseTo(0.5, 6);
  });
});
