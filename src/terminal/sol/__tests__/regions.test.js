import { describe, it, expect } from 'vitest';
import {
  MAX_REGIONS, STAR_REGIONS, omega, createStar, makeStar, regionTurns,
  stepStar, applyStir, grab, release,
} from '../regions.js';
import { energyErg, TURNS_TO_SNAP } from '../solPhysics.js';

const reg = (o) => ({ id: 1, lat: 0.3, lon: 0, starTurns: 0, handTurns: 0, held: false, born: 'star', ...o });
const seqRng = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483647;
};

describe('omega', () => {
  it('equator to pole ratio is 1/0.735', () => {
    expect(Math.abs(omega(0) / omega(Math.PI / 2) - 1 / 0.735)).toBeLessThan(1e-3);
  });
});

describe('createStar', () => {
  it('returns STAR_REGIONS regions within bounds, deterministic', () => {
    const a = createStar(seqRng(3));
    const b = createStar(seqRng(3));
    expect(a.regions).toHaveLength(STAR_REGIONS);
    expect(a.regions).toEqual(b.regions);
    const lons = new Set();
    for (const r of a.regions) {
      const deg = Math.abs(r.lat) * 180 / Math.PI;
      expect(deg).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(deg).toBeLessThanOrEqual(35 + 1e-9);
      expect(r.starTurns).toBeGreaterThanOrEqual(0);
      expect(r.starTurns).toBeLessThan(TURNS_TO_SNAP);
      expect(r.handTurns).toBe(0);
      expect(r.held).toBe(false);
      expect(r.born).toBe('star');
      lons.add(r.lon);
    }
    expect(lons.size).toBe(STAR_REGIONS);
    expect(new Set(a.regions.map((r) => r.id)).size).toBe(STAR_REGIONS);
  });
});

describe('stepStar snaps', () => {
  it('self-snap takes the hemisphere handedness', () => {
    for (const [lat, h] of [[0.3, 'ccw'], [-0.3, 'cw']]) {
      const star = makeStar([reg({ lat, starTurns: 5.99 })]);
      const ev = stepStar(star, 5);
      expect(ev).toHaveLength(1);
      expect(ev[0].origin).toBe('star');
      expect(ev[0].handedness).toBe(h);
      expect(ev[0].regionId).toBe(1);
      expect(star.regions[0].starTurns).toBe(0);
      expect(star.regions[0].held).toBe(false);
    }
  });
  it('a hand-born region is removed after its snap', () => {
    const star = makeStar([reg({ born: 'hand', starTurns: 5.99 })]);
    expect(stepStar(star, 5)).toHaveLength(1);
    expect(star.regions).toHaveLength(0);
  });
  it('threshold crossed by the hand snaps in applyStir', () => {
    const star = makeStar([reg({ starTurns: 4 })]);
    const ev = applyStir(star, 1, 2.5);
    expect(ev.origin).toBe('hand');
    expect(ev.handedness).toBe('cw');
    expect(ev.turns).toBeCloseTo(6.5, 9);
    expect(star.regions[0].handTurns).toBe(0);
  });
});

describe('hand winding', () => {
  it('hand direction wins at release', () => {
    const star = makeStar([reg({ lat: -0.3, starTurns: 3 })]);
    const id = 1;
    grab(star, -0.3, 0);
    expect(applyStir(star, id, -2)).toBeNull();
    const ev = release(star, id);
    expect(ev.handedness).toBe('ccw');
    expect(ev.origin).toBe('hand');
    expect(ev.energyErg).toBe(energyErg(5));
    expect(ev.turns).toBe(5);
  });
  it('reversal runs through zero', () => {
    const star = makeStar([reg()]);
    applyStir(star, 1, 2);
    applyStir(star, 1, -3);
    expect(star.regions[0].handTurns).toBe(-1);
  });
  it('a click never fires', () => {
    const star = makeStar([reg()]);
    const id = grab(star, 0.3, 0);
    expect(id).toBe(1);
    expect(star.regions[0].held).toBe(true);
    star.regions[0].handTurns = 0.4;
    expect(release(star, id)).toBeNull();
    expect(star.regions[0].held).toBe(false);
  });
  it('regionTurns sums star and |hand|', () => {
    expect(regionTurns(reg({ starTurns: 1, handTurns: -2 }))).toBe(3);
  });
});

describe('slip and clock', () => {
  it('unheld hand winding slips, star winding does not', () => {
    const star = makeStar([reg({ handTurns: 2, starTurns: 1 })]);
    stepStar(star, 8, { selfWind: false });
    expect(Math.abs(star.regions[0].handTurns - 2 / Math.E)).toBeLessThan(1e-2);
    expect(star.regions[0].starTurns).toBe(1);
  });
  it('a held region does not slip', () => {
    const star = makeStar([reg({ handTurns: 2, starTurns: 1, held: true })]);
    stepStar(star, 8, { selfWind: false });
    expect(star.regions[0].handTurns).toBe(2);
  });
  it('is invariant to step size', () => {
    const mk = () => makeStar([reg({ handTurns: 1.5, starTurns: 1, lat: 0.4 })]);
    const a = mk();
    const b = mk();
    for (let i = 0; i < 3600; i++) stepStar(a, 1 / 60);
    for (let i = 0; i < 21600; i++) stepStar(b, 1 / 360);
    for (const k of ['starTurns', 'handTurns', 'lon']) {
      expect(Math.abs(a.regions[0][k] - b.regions[0][k])).toBeLessThan(1e-6);
    }
  });
  it('selfWind: false leaves starTurns', () => {
    const star = makeStar([reg({ starTurns: 2 })]);
    stepStar(star, 10, { selfWind: false });
    expect(star.regions[0].starTurns).toBe(2);
  });
  it('non-finite inputs never poison state', () => {
    const star = makeStar([reg({ starTurns: 1, handTurns: 1 })]);
    stepStar(star, NaN);
    stepStar(star, Infinity);
    applyStir(star, 1, NaN);
    applyStir(star, 1, Infinity);
    for (const k of ['lon', 'starTurns', 'handTurns']) {
      expect(Number.isFinite(star.regions[0][k])).toBe(true);
    }
  });
});

describe('grab cap', () => {
  it('never exceeds MAX_REGIONS and never evicts a star region', () => {
    const star = createStar(seqRng(11));
    const starIds = star.regions.map((r) => r.id);
    for (let i = 0; i < 7; i++) {
      const id = grab(star, 0.2 * (i % 2 ? 1 : -1), 0.9 + i * 0.9);
      expect(star.regions.some((r) => r.id === id)).toBe(true);
      expect(star.regions.length).toBeLessThanOrEqual(MAX_REGIONS);
      release(star, id);
    }
    for (const id of starIds) expect(star.regions.some((r) => r.id === id)).toBe(true);
  });
  it('holding all slots still respects the cap', () => {
    const star = createStar(seqRng(11));
    for (let i = 0; i < 7; i++) grab(star, 0.2, 0.9 + i * 0.9);
    expect(star.regions.length).toBeLessThanOrEqual(MAX_REGIONS);
    expect(star.regions.filter((r) => r.born === 'star')).toHaveLength(STAR_REGIONS);
  });
  it('evicts the least-wound unheld hand region and never reuses ids', () => {
    const star = makeStar([
      reg({ id: 1, lon: 0 }),
      reg({ id: 2, lon: 1, born: 'hand', handTurns: 0.5 }),
      reg({ id: 3, lon: 2, born: 'hand', handTurns: 0.1 }),
      reg({ id: 4, lon: 3 }), reg({ id: 5, lon: 4 }), reg({ id: 6, lon: 5 }),
    ]);
    const id = grab(star, 0.3, -2);
    expect(star.regions.some((r) => r.id === 3)).toBe(false);
    expect(star.regions.some((r) => r.id === 2)).toBe(true);
    expect(id).toBe(7);
  });
});
