import { describe, it, expect } from 'vitest';
import {
  createBeads, spawnBead, spawnFling, spawnSplash, stepBeads, beadRadius, wobbleHz, wobbleGate, WOBBLE_HZ_MIN, WOBBLE_HZ_MAX,
  AMBIENT_RATE, BEAD_ESCAPE_R, BEAD_LIFE, DUST_R, PEARL_R, PEARL_P, EVAP_RATE, FLING_N, FLING_V_MAX, FLING_DRAG_BOOST,
} from '../hgBeads';
import { mulberry32 } from '../aetherLobes';
import { SUN_DIR_WORLD } from '../planetFrame';

const CTX = { phase: 'air', coreR: 0.75, calm: false, liquid: true, boil: 0 };
const run = (b, seconds, ctx = CTX, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) stepBeads(b, dt, ctx); return b.n; };

describe('hgBeads sim', () => {
  it('spawn radii split into dust (~95 %) and pearls (~5 %), each inside its range', () => {
    const rng = mulberry32(42);
    let pearls = 0;
    for (let k = 0; k < 10000; k++) {
      const r = beadRadius(rng);
      const dust = r >= DUST_R[0] && r <= DUST_R[1];
      const pearl = r >= PEARL_R[0] && r <= PEARL_R[1];
      expect(dust || pearl).toBe(true);
      if (pearl) pearls++;
    }
    expect(pearls / 10000).toBeGreaterThan(PEARL_P - 0.01);
    expect(pearls / 10000).toBeLessThan(PEARL_P + 0.01);
  });
  it('dust is skewed small: its median radius sits in the lower third of the dust range', () => {
    const rng = mulberry32(7);
    const dust = [];
    for (let k = 0; k < 4000; k++) { const r = beadRadius(rng); if (r <= DUST_R[1]) dust.push(r); }
    dust.sort((a, b) => a - b);
    expect(dust[dust.length >> 1]).toBeLessThan(DUST_R[0] + (DUST_R[1] - DUST_R[0]) / 3);
  });
  it('rateScale scales the ambient trickle (1 s: no bead has fallen back yet)', () => {
    const full = createBeads(256), phone = createBeads(256);
    run(full, 1, { ...CTX, phase: 'none' });
    run(phone, 1, { ...CTX, phase: 'none', rateScale: 0.55 });
    expect(full.n).toBeGreaterThanOrEqual(AMBIENT_RATE - 1);
    expect(full.n).toBeLessThanOrEqual(AMBIENT_RATE);
    expect(phone.n).toBeGreaterThanOrEqual(9);
    expect(phone.n).toBeLessThanOrEqual(10);
  });
  it('ambient trickle settles near rate × life (a few dozen), off the sunlit side', () => {
    const b = createBeads(256);
    run(b, 1 / 60);
    const n = run(b, 20);
    expect(n).toBeGreaterThan(AMBIENT_RATE * BEAD_LIFE * 0.5);
    expect(n).toBeLessThanOrEqual(AMBIENT_RATE * BEAD_LIFE * 1.3);
  });
  it('a bead flung past the escape radius is removed, not held for its whole life', () => {
    const b = createBeads(8);
    spawnBead(b, 3 * 0.75, 0, 0, 20, 0, 0, 0.01);
    expect(b.n).toBe(1);
    const n = run(b, 0.2, { ...CTX, liquid: false });
    expect(n).toBe(0);
    expect(BEAD_ESCAPE_R).toBe(4);
  });
  it('a frozen planet sheds nothing; boiling sheds more', () => {
    const frozen = createBeads(256); run(frozen, 5, { ...CTX, liquid: false });
    expect(frozen.n).toBe(0);
    const boiling = createBeads(256); run(boiling, 2, { ...CTX, boil: 1 });
    const still = createBeads(256); run(still, 2, CTX);
    expect(boiling.n).toBeGreaterThan(still.n * 2);
  });
  it('new ambient beads leave from the sunward hemisphere', () => {
    const b = createBeads(256);
    run(b, 0.5, { ...CTX, phase: 'none' }); // no flow: gravity is radial, so a bead keeps its direction
    for (let i = 0; i < b.n; i++) {
      const d = [b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2]];
      expect(d[0] * SUN_DIR_WORLD[0] + d[2] * SUN_DIR_WORLD[2]).toBeGreaterThan(0);
    }
  });
  it('the cap holds and the oldest bead is evicted first', () => {
    const b = createBeads(4);
    for (let k = 0; k < 4; k++) { spawnBead(b, k, 0, 2, 0, 0, 0, 0.01); b.age[k] = 10 - k; }
    spawnBead(b, 9, 0, 2, 0, 0, 0, 0.01);
    expect(b.n).toBe(4);
    const xs = Array.from(b.pos.filter((_, i) => i % 3 === 0));
    expect(xs).not.toContain(0); // age 10 was the oldest
    expect(xs).toContain(9);
  });
  it('a fling throws FLING_N beads tangentially around the spin axis', () => {
    const b = createBeads(256);
    spawnFling(b, [0, 3, 0], 0.75, FLING_N);
    expect(b.n).toBe(FLING_N);
    for (let i = 0; i < b.n; i++) {
      expect(Math.abs(b.pos[3 * i + 1])).toBeLessThan(1e-6); // on the equator of the spin
      const tangential = b.pos[3 * i] * b.vel[3 * i + 2] - b.pos[3 * i + 2] * b.vel[3 * i];
      expect(Math.sign(tangential)).toBe(-1); // ω = +Y: v = ω × p
    }
  });
  it('a bead that falls back into the planet merges (is removed)', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 0, 0.8, 0, 0, -2, 0.01);
    run(b, 0.2, { ...CTX, liquid: false }); // no trickle, so the count is only this bead
    expect(b.n).toBe(0);
  });
  it('fire evaporates beads', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 1.2, 0, 0, 0, 0, DUST_R[0] * 1.5);
    run(b, (DUST_R[0] * 1.5) / EVAP_RATE + 0.5, { ...CTX, phase: 'thermal', liquid: false });
    expect(b.n).toBe(0);
  });
  it('calm (sim-level): no trickle; a bead spawned anyway does not advect', () => {
    const b = createBeads(16);
    spawnSplash(b, [1, 0, 0], 0.75, 3);
    const x0 = b.pos[0];
    run(b, 1, { ...CTX, calm: true });
    expect(b.n).toBe(3);
    expect(b.pos[0]).toBe(x0);
  });
  it('packs position and (radius, alpha, gate) into reused buffers', () => {
    const b = createBeads(8);
    const p = b.outPos, q = b.outBead;
    expect(q.length).toBe(8 * 3);
    spawnBead(b, 0.1, 1.5, 0.2, 0, 0, 0, 0.01);
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.outPos).toBe(p); expect(b.outBead).toBe(q);
    expect(b.outBead[0]).toBeCloseTo(0.01, 6);
    expect(b.outBead[1]).toBeGreaterThan(0);
    expect(b.outBead[2]).toBeCloseTo(wobbleGate(0.01, b.age[0], b.ph2[0], b.ph3[0], b.ph4[0], b.tumble[0]), 6);
  });
  it('wobble rate ∝ r^-1.5, clamped to [WOBBLE_HZ_MIN, WOBBLE_HZ_MAX]', () => {
    expect(wobbleHz(0.012)).toBeCloseTo(0.8, 6);
    expect(wobbleHz(0.006)).toBeCloseTo(0.8 * 2 ** 1.5, 6);
    expect(wobbleHz(0.0015)).toBe(WOBBLE_HZ_MAX);
    expect(wobbleHz(0.05)).toBe(WOBBLE_HZ_MIN);
  });
  it('the gate stays in [0, 1]', () => {
    const rng = mulberry32(3);
    for (let k = 0; k < 2000; k++) {
      const g = wobbleGate(0.0015 + 0.02 * rng(), 20 * rng(), 6.3 * rng(), 6.3 * rng(), 6.3 * rng(), 0.15 + 0.15 * rng());
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
  // Dust radii only: a pearl's glint is mix(0.85, 1, gate), a shimmer, so it has no sparks to time.
  // Plan-time check with this exact model over seeds 0x5eed, 1, 7, 99, 12345: min CV 0.47, ≥ 18 intervals, duty ≈ 0.096.
  it('dust twinkle is not a metronome: every speck\'s spark intervals vary (CV ≥ 0.3); duty 5–20 %', () => {
    const b = createBeads(64, 0x5eed);
    for (let k = 0; k < 60; k++) spawnBead(b, 0, 2, 0, 0, 0, 0, [0.0015, 0.003, 0.0045, 0.006][k % 4]);
    let lit = 0, samples = 0;
    for (let i = 0; i < 60; i++) {
      const sparks = [];
      let prev = 0;
      for (let s = 0; s < 20 * 240; s++) {
        const g = wobbleGate(b.r[i], s / 240, b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
        if (g > 0.05) lit++;
        if (g > 0.05 && prev <= 0.05) sparks.push(s / 240);
        prev = g; samples++;
      }
      const iv = sparks.slice(1).map((t, j) => t - sparks[j]);
      expect(iv.length).toBeGreaterThanOrEqual(3);
      const m = iv.reduce((a, c) => a + c, 0) / iv.length;
      const sd = Math.sqrt(iv.reduce((a, c) => a + (c - m) ** 2, 0) / iv.length);
      expect(sd / m).toBeGreaterThanOrEqual(0.3);
    }
    expect(lit / samples).toBeGreaterThan(0.05);
    expect(lit / samples).toBeLessThan(0.2);
  });
  it('remove keeps the wobble state in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    const moved = [b.ph2[2], b.ph3[2], b.ph4[2], b.tumble[2]];
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect([b.ph2[1], b.ph3[1], b.ph4[1], b.tumble[1]]).toEqual(moved);
  });
  it('fling launch speed is capped at FLING_V_MAX', () => {
    const b = createBeads(64);
    spawnFling(b, [0, 12, 0], 0.75, FLING_N);
    for (let i = 0; i < b.n; i++) {
      expect(Math.hypot(b.vel[3 * i], b.vel[3 * i + 1], b.vel[3 * i + 2])).toBeLessThanOrEqual(FLING_V_MAX + 1e-6);
    }
  });
  it('a fling about +X (the other basis branch) is tangential too', () => {
    const b = createBeads(64);
    spawnFling(b, [12, 0, 0], 0.75, FLING_N);
    expect(b.n).toBe(FLING_N);
    for (let i = 0; i < b.n; i++) {
      expect(Math.abs(b.pos[3 * i])).toBeLessThan(1e-6); // on the spin equator
      const v = [b.vel[3 * i], b.vel[3 * i + 1], b.vel[3 * i + 2]];
      const p = [b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2]];
      const pl = Math.hypot(...p);
      const radial = (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / pl; // the 0.1 outward kick is the only radial part
      expect(Math.abs(radial)).toBeLessThan(0.1 + 1e-6);
    }
  });
  it('the early drag arc keeps a fling in the scene past 0.6 s (air)', () => {
    const b = createBeads(64);
    const ctx = { ...CTX, liquid: false };
    spawnFling(b, [0, 12, 0], 0.75, FLING_N);
    const ids = b.n;
    run(b, 0.6, ctx);
    const frac = b.n / ids; // alive = inside BEAD_ESCAPE_R·coreR (stepBeads removes escapers)
    expect(frac).toBeGreaterThanOrEqual(0.5);
  });
  it('remove keeps boost in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    b.boost[0] = 0; b.boost[1] = 7; b.boost[2] = FLING_DRAG_BOOST;
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.n).toBe(2);
    expect(b.pos[3]).toBeCloseTo(2, 1);
    expect(b.boost[1]).toBe(FLING_DRAG_BOOST);
  });
  it('spawnBead returns its slot and zeroes boost; a fling sets it, even on eviction', () => {
    const b = createBeads(4);
    spawnFling(b, [0, 12, 0], 0.75, 4);
    for (let i = 0; i < 4; i++) expect(b.boost[i]).toBe(FLING_DRAG_BOOST);
    const i = spawnBead(b, 0, 0, 2, 0, 0, 0, 0.01);
    expect(b.boost[i]).toBe(0);
  });
});
