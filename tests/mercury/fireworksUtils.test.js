import { describe, it, expect } from 'vitest';
import { doctrineAlpha, spawnRockets, spawnBurst } from '../../src/terminal/mercury/fireworksUtils';

describe('doctrineAlpha', () => {
  it('is 0 at age 0', () => {
    expect(doctrineAlpha(0, 100)).toBe(0);
  });

  it('ramps quadratically in 0–15% window', () => {
    // at t=0.075 (halfway into ramp): alpha = 0.75 * (0.5)^2 = 0.1875
    expect(doctrineAlpha(7.5, 100)).toBeCloseTo(0.1875, 3);
  });

  it('holds base alpha 0.75 at t=0.40 (middle of hold zone)', () => {
    expect(doctrineAlpha(40, 100)).toBeCloseTo(0.75, 3);
  });

  it('is culled (< 0.004) at age === lifespan', () => {
    expect(doctrineAlpha(100, 100)).toBeLessThan(0.004);
  });

  it('decays with power 2.2 in 70–100% window', () => {
    // at t=0.85: decay progress = (0.85-0.70)/0.30 = 0.5
    // alpha = 0.75 * (1 - 0.5)^2.2 = 0.75 * 0.2176 ≈ 0.1632
    expect(doctrineAlpha(85, 100)).toBeCloseTo(0.1632, 2);
  });
});

describe('spawnRockets', () => {
  it('returns 5–8 rockets', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    expect(rockets.length).toBeGreaterThanOrEqual(5);
    expect(rockets.length).toBeLessThanOrEqual(8);
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

  it('apex Y is in the upper 35% of screen height', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    for (const r of rockets) {
      expect(r.apexY).toBeLessThanOrEqual(600 * 0.35);
    }
  });

  it('delays are staggered 60–120ms apart (ascending)', () => {
    const rockets = spawnRockets('fluid', 200, 400, 800, 600);
    for (let i = 1; i < rockets.length; i++) {
      const gap = rockets[i].delay - rockets[i - 1].delay;
      expect(gap).toBeGreaterThanOrEqual(60);
      expect(gap).toBeLessThanOrEqual(120);
    }
  });
});

describe('spawnBurst', () => {
  it('thermal → 20–30 ember particles', () => {
    const ps = spawnBurst('thermal', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(20);
    expect(ps.length).toBeLessThanOrEqual(30);
    expect(ps[0].type).toBe('ember');
  });

  it('fluid → 18–26 droplet particles', () => {
    const ps = spawnBurst('fluid', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(18);
    expect(ps.length).toBeLessThanOrEqual(26);
    expect(ps[0].type).toBe('droplet');
  });

  it('air → 3–5 ring particles', () => {
    const ps = spawnBurst('air', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(3);
    expect(ps.length).toBeLessThanOrEqual(5);
    expect(ps[0].type).toBe('ring');
  });

  it('earth → 14–20 shard particles', () => {
    const ps = spawnBurst('earth', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(14);
    expect(ps.length).toBeLessThanOrEqual(20);
    expect(ps[0].type).toBe('shard');
  });

  it('non-ring burst particles start at age 0 with positive lifespan', () => {
    for (const el of ['thermal', 'fluid', 'earth']) {
      const ps = spawnBurst(el, 400, 200);
      for (const p of ps) {
        expect(p.age).toBe(0);
        expect(p.lifespan).toBeGreaterThan(0);
      }
    }
  });

  it('air rings are staggered: each ring starts 6 frames later than previous', () => {
    const rings = spawnBurst('air', 400, 200);
    for (let i = 0; i < rings.length; i++) {
      expect(rings[i].age).toBe(i * 6);
      expect(rings[i].lifespan).toBeGreaterThan(0);
    }
  });
});
