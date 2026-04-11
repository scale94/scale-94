import { describe, it, expect } from 'vitest';
import { doctrineAlpha, spawnRockets, spawnBurst } from '../../src/terminal/mercury/fireworksUtils';

describe('doctrineAlpha', () => {
  it('is 0 at age 0', () => {
    expect(doctrineAlpha(0, 100)).toBe(0);
  });

  it('ramps quadratically in 0–15% window', () => {
    // at t=0.075 (halfway into ramp): alpha = 0.55 * (0.5)^2 = 0.1375
    expect(doctrineAlpha(7.5, 100)).toBeCloseTo(0.1375, 3);
  });

  it('holds base alpha 0.55 at t=0.40 (middle of hold zone)', () => {
    expect(doctrineAlpha(40, 100)).toBeCloseTo(0.55, 3);
  });

  it('is culled (< 0.004) at age === lifespan', () => {
    expect(doctrineAlpha(100, 100)).toBeLessThan(0.004);
  });

  it('decays with power 2.2 in 70–100% window', () => {
    // at t=0.85: progress into decay = (0.85-0.70)/0.30 = 0.5
    // alpha = 0.55 * (1 - 0.5)^2.2 = 0.55 * 0.5^2.2 ≈ 0.55 * 0.2176 ≈ 0.1197
    expect(doctrineAlpha(85, 100)).toBeCloseTo(0.1197, 2);
  });
});

describe('spawnRockets', () => {
  it('returns 3–5 rockets', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    expect(rockets.length).toBeGreaterThanOrEqual(3);
    expect(rockets.length).toBeLessThanOrEqual(5);
  });

  it('each rocket has required fields', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    for (const r of rockets) {
      expect(r).toMatchObject({
        type: 'rocket',
        element: 'thermal',
        age: 0,
        hasExploded: false,
      });
      expect(typeof r.lifespan).toBe('number');
      expect(typeof r.apexX).toBe('number');
      expect(typeof r.apexY).toBe('number');
      expect(typeof r.delay).toBe('number');
    }
  });

  it('apex Y is in the upper 40% of screen height', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    for (const r of rockets) {
      expect(r.apexY).toBeLessThanOrEqual(600 * 0.4);
    }
  });

  it('delays are staggered 80–150ms apart (ascending)', () => {
    const rockets = spawnRockets('fluid', 200, 400, 800, 600);
    for (let i = 1; i < rockets.length; i++) {
      const gap = rockets[i].delay - rockets[i - 1].delay;
      expect(gap).toBeGreaterThanOrEqual(80);
      expect(gap).toBeLessThanOrEqual(150);
    }
  });
});

describe('spawnBurst', () => {
  it('thermal → 12–18 ember particles', () => {
    const ps = spawnBurst('thermal', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(12);
    expect(ps.length).toBeLessThanOrEqual(18);
    expect(ps[0].type).toBe('ember');
  });

  it('fluid → 10–14 droplet particles', () => {
    const ps = spawnBurst('fluid', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(10);
    expect(ps.length).toBeLessThanOrEqual(14);
    expect(ps[0].type).toBe('droplet');
  });

  it('air → 2–3 ring particles', () => {
    const ps = spawnBurst('air', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(2);
    expect(ps.length).toBeLessThanOrEqual(3);
    expect(ps[0].type).toBe('ring');
  });

  it('earth → 8–12 shard particles', () => {
    const ps = spawnBurst('earth', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(8);
    expect(ps.length).toBeLessThanOrEqual(12);
    expect(ps[0].type).toBe('shard');
  });

  it('all burst particles start at age 0 with positive lifespan', () => {
    for (const el of ['thermal', 'fluid', 'air', 'earth']) {
      const ps = spawnBurst(el, 400, 200);
      for (const p of ps) {
        expect(p.age).toBe(0);
        expect(p.lifespan).toBeGreaterThan(0);
      }
    }
  });
});
