import { describe, it, expect } from 'vitest';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  nodeMagnitude,
  nodePosition,
  hashNodeId,
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

describe('hashNodeId', () => {
  it('is deterministic', () => {
    expect(hashNodeId('bouligand_36')).toBe(hashNodeId('bouligand_36'));
  });

  it('produces different hashes for different ids', () => {
    expect(hashNodeId('bouligand_36')).not.toBe(hashNodeId('kuramoto'));
  });

  it('returns a finite number in [0, 1)', () => {
    const h = hashNodeId('seraphine');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
    expect(Number.isFinite(h)).toBe(true);
  });
});

describe('nodePosition', () => {
  const R = 400;
  const tensor = new Array(32).fill(0.5); // magnitude ≈ 0.5

  it('places a node on its cluster spoke with small jitter', () => {
    const pos = nodePosition({ id: 'bouligand_36', cluster: 'eco' }, tensor, R);
    // eco is sector 0, angle 0, so base direction is straight up (0, -r).
    // r = (0.2 + 0.75 * 0.5) * R = 0.575 * 400 = 230
    // Jitter ±0.03 rad keeps x within ~7 of 0, y close to -230.
    expect(pos.x).toBeGreaterThan(-10);
    expect(pos.x).toBeLessThan(10);
    expect(pos.y).toBeGreaterThan(-235);
    expect(pos.y).toBeLessThan(-225);
  });

  it('is deterministic for the same node id', () => {
    const a = nodePosition({ id: 'kuramoto', cluster: 'sync' }, tensor, R);
    const b = nodePosition({ id: 'kuramoto', cluster: 'sync' }, tensor, R);
    expect(a).toEqual(b);
  });

  it('returns null for a cluster not on a mandala spoke (fsk → nearest spoke)', () => {
    // fsk is not in MANDALA_SECTOR_ORDER, but we still want to place its
    // nodes somewhere — we fall them back onto the first sector (eco)
    // which is conceptually adjacent (bouligand_fsk ↔ eco/bouligand_36).
    const pos = nodePosition({ id: 'arapaima', cluster: 'fsk' }, tensor, R);
    expect(pos).not.toBeNull();
    // Should land near the eco spoke (x near 0, y negative).
    expect(pos.x).toBeGreaterThan(-20);
    expect(pos.x).toBeLessThan(20);
    expect(pos.y).toBeLessThan(0);
  });
});
