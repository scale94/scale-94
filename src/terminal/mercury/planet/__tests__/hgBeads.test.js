import { describe, it, expect } from 'vitest';
import {
  createBeads, spawnBead, spawnFling, spawnSplash, stepBeads, beadRadius, wobbleHz, wobbleGate, WOBBLE_HZ_MIN, WOBBLE_HZ_MAX,
  AMBIENT_RATE, BEAD_ESCAPE_R, BEAD_SHAPE_MARGIN, pearlStrike, HIT_STRIDE, FREEZE_FADE_S, FLING_LIFE, FLING_RETURN_V, BEAD_LIFE, DUST_R, PEARL_R, PEARL_P, EVAP_RATE, FLING_N, FLING_V_MAX, FLING_RADIAL, G_BEAD,
} from '../hgBeads';
import { mulberry32 } from '../prng';
import { MAX_OMEGA } from '../mercuryBody';
import { capillaryTime } from '../breakupPhysics';
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
    expect(b.outBead[2]).toBeCloseTo(wobbleGate(b.wph[0], b.ph2[0], b.ph3[0], b.ph4[0], b.tumble[0]), 6);
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
      const g = wobbleGate(2 * Math.PI * 5 * 20 * rng(), 6.3 * rng(), 6.3 * rng(), 6.3 * rng(), 0.15 + 0.15 * rng());
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
  // Dust radii only: a pearl's glint is mix(0.85, 1, gate), a shimmer, so it has no sparks to time.
  // Look round 2 (WOBBLE_K 3 -> 1.5, author 2026-10-05): seed 0x5eed measured min CV 0.42, duty ≈ 0.225 (~28 lit of ~125 in air).
  it('dust twinkle is not a metronome: every speck\'s spark intervals vary (CV ≥ 0.3); duty 15–30 %', () => {
    const b = createBeads(64, 0x5eed);
    for (let k = 0; k < 60; k++) spawnBead(b, 0, 2, 0, 0, 0, 0, [0.0015, 0.003, 0.0045, 0.006][k % 4]);
    let lit = 0, samples = 0;
    for (let i = 0; i < 60; i++) {
      const sparks = [];
      let prev = 0;
      for (let s = 0; s < 20 * 240; s++) {
        const g = wobbleGate(2 * Math.PI * wobbleHz(b.r[i]) * (s / 240), b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
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
    expect(lit / samples).toBeGreaterThan(0.15);
    expect(lit / samples).toBeLessThan(0.3);
  });
  it('remove keeps the wobble state in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    b.wph[2] = 1.25;
    const moved = [b.ph2[2], b.ph3[2], b.ph4[2], b.tumble[2]];
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect([b.ph2[1], b.ph3[1], b.ph4[1], b.tumble[1]]).toEqual(moved);
    expect(b.wph[1]).toBeGreaterThan(1.25); // the swapped bead's integrated phase (1.25 + one step)
    expect(b.wph[1]).toBeLessThan(1.25 + 0.2);
  });
  it('wobble phase is integrated: evaporation never pushes the advance past WOBBLE_HZ_MAX', () => {
    const b = createBeads(8);
    const i = spawnBead(b, 0, 2, 0, 0, 0, 0, 0.006);
    b.age[i] = 5;
    const dt = 1 / 360, cap = 2 * Math.PI * WOBBLE_HZ_MAX * dt + 1e-5; // + Float32 storage rounding
    let steps = 0;
    while (b.n > 0 && steps < 360 * 5) {
      const before = b.wph[0];
      stepBeads(b, dt, { ...CTX, phase: 'thermal', liquid: false });
      if (b.n > 0) expect(b.wph[0] - before).toBeLessThanOrEqual(cap);
      steps++;
    }
    expect(b.n).toBe(0);
    expect(steps).toBeGreaterThan(100);
  });
  it('the ambient trickle never evicts: a full cap keeps its beads', () => {
    const b = createBeads(8);
    for (let k = 0; k < 8; k++) spawnBead(b, 2 * Math.cos(k), 0, 2 * Math.sin(k), 0, 0, 0, 0.003 + k * 0.001);
    const before = Array.from(b.r.slice(0, 8)).sort();
    run(b, 1, { ...CTX, phase: 'none', liquid: true, boil: 1 });
    expect(b.n).toBe(8);
    expect(Array.from(b.r.slice(0, 8)).sort()).toEqual(before);
  });
  it('calm freezes the twinkle: the uploaded gate is 0', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 2, 0, 0, 0, 0, 0.003);
    b.age[0] = 1;
    stepBeads(b, 1 / 60, { ...CTX, calm: true });
    expect(b.n).toBe(1);
    expect(b.outBead[2]).toBe(0);
  });
  it('a fling never exceeds the cap', () => {
    const b = createBeads(32);
    spawnFling(b, [0, 1.78, 0], 0.75, FLING_N);
    expect(b.n).toBe(32);
    for (let i = 0; i < 32; i++) expect(b.free[i]).toBe(1);
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
      const radial = (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / pl; // the FLING_RADIAL outward kick is the only radial part
      expect(Math.abs(radial)).toBeLessThan(FLING_RADIAL + 1e-6);
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
  it('remove keeps free in step with the swapped bead', () => {
    const b = createBeads(8);
    spawnBead(b, 1, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 1.5, 0, 1, 0, 0, 0, 0.01); spawnBead(b, 2, 0, 1, 0, 0, 0, 0.01);
    b.free[0] = 0; b.free[1] = 0; b.free[2] = 1;
    b.r[1] = 0; // dies on the next step; bead 2 swaps into slot 1
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.n).toBe(2);
    expect(b.pos[3]).toBeCloseTo(2, 1);
    expect(b.free[1]).toBe(1);
  });
  it('spawnBead returns its slot and clears free; a fling sets it, including into an evicted slot', () => {
    const b = createBeads(4);
    for (let k = 0; k < 4; k++) { spawnBead(b, k, 0, 2, 0, 0, 0, 0.01); b.age[k] = 5; } // full, all old
    spawnFling(b, [0, 12, 0], 0.75, 4); // every fling bead evicts an old one
    for (let i = 0; i < 4; i++) expect(b.free[i]).toBe(1);
    const i = spawnBead(b, 0, 0, 2, 0, 0, 0, 0.01);
    expect(b.free[i]).toBe(0);
  });
  it('a flung bead flies free: at 1 s it is past 1.3 × coreR in every element (was: clung at ~0.97)', () => {
    for (const phase of ['air', 'fluid', 'earth', 'thermal']) {
      const b = createBeads(64);
      spawnFling(b, [0, 1.78, 0], 0.75, FLING_N); // release speed ≈ 1.5 u/s
      run(b, 1, { ...CTX, phase, liquid: false });
      expect(b.n).toBeGreaterThan(0); // thermal evaporates the smallest dust; the rest must be out
      for (let i = 0; i < b.n; i++) {
        expect(Math.hypot(b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2])).toBeGreaterThan(1.3 * 0.75);
      }
    }
  });
  it('a flung bead is ballistic at release: one frame changes its velocity by gravity alone', () => {
    const b = createBeads(8);
    spawnFling(b, [0, 1.78, 0], 0.75, 1);
    const v0 = [b.vel[0], b.vel[1], b.vel[2]];
    const p0 = [b.pos[0], b.pos[1], b.pos[2]];
    const dt = 1 / 600;
    stepBeads(b, dt, { ...CTX, liquid: false });
    const r2 = p0[0] ** 2 + p0[1] ** 2 + p0[2] ** 2, g = G_BEAD / (r2 * Math.sqrt(r2));
    for (let c = 0; c < 3; c++) expect(b.vel[c]).toBeCloseTo(v0[c] - g * p0[c] * dt, 3);
  });
});

describe('hgBeads touchdown (fix/mercury-motion: beads clipped into the sphere with no ripple)', () => {
  const old = (b, i) => { b.age[i] = 1; return i; }; // past the spawn guard
  it('a bead touches down when its surface meets the live planet, not when its centre passes coreR', () => {
    const b = createBeads(8);
    old(b, spawnBead(b, 0, 0, 0.815, 0, 0, -0.5, 0.02));
    const ctx = { ...CTX, liquid: false, planetRadiusAt: () => 0.8 }; // a bulged surface above coreR 0.75
    stepBeads(b, 1 / 60, ctx); // |p| 0.8067, minus r 0.02 = 0.787 <= 0.8: contact, centre still far outside coreR
    expect(b.n).toBe(0);
    expect(b.nHits).toBe(1);
    expect(b.hits[0]).toBeCloseTo(0, 2); expect(b.hits[1]).toBeCloseTo(0, 2); expect(b.hits[2]).toBeCloseTo(1, 4); // world dir (air drifts x a hair)
    expect(b.hits[3]).toBeCloseTo(0.02, 6); // radius
    expect(b.hits[4]).toBeGreaterThan(0.49); // inward normal speed
  });
  it('without planetRadiusAt the contact sphere is coreR, still at the bead surface', () => {
    const b = createBeads(8);
    old(b, spawnBead(b, 0.765, 0, 0, -0.3, 0, 0, 0.02));
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.nHits).toBe(1);
  });
  it('a fresh fling overlapping the surface on its way out is not a touchdown', () => {
    const b = createBeads(64);
    spawnFling(b, [0, 9, 0], 0.75);
    run(b, 0.2, { ...CTX, liquid: false, planetRadiusAt: () => 0.75 });
    expect(b.n).toBe(FLING_N);
  });
  it('hits are this step only; dust and pearls both report (the caller decides what ripples)', () => {
    const b = createBeads(8);
    old(b, spawnBead(b, 0, 0.76, 0, 0, -1, 0, DUST_R[0]));
    old(b, spawnBead(b, 0.77, 0, 0, -1, 0, 0, PEARL_R[1]));
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.nHits).toBe(2);
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.nHits).toBe(0);
  });
  it('the live surface is only sampled near the planet (BEAD_SHAPE_MARGIN)', () => {
    const b = createBeads(8);
    old(b, spawnBead(b, 0, 0, 0.75 * BEAD_SHAPE_MARGIN + 0.1, 0, 0, 0, PEARL_R[1]));
    let calls = 0;
    stepBeads(b, 1 / 60, { ...CTX, liquid: false, planetRadiusAt: () => { calls++; return 0.75; } });
    expect(calls).toBe(0);
  });
});

// The author ruled 2026-11-22: rippling every visible bead (with a floor) buzzed the liquid nonstop. Only a pearl thrown
// by a fling ripples, in proportion; the trickle and splash beads coalesce silently, so the mirror is still at rest.
describe('pearlStrike: a landing pearl ripples like a small drop (no floor)', () => {
  it('dust never ripples; a pearl does, more for a bigger or faster one, never past a full splash', () => {
    expect(pearlStrike(DUST_R[1], 1)).toBe(0);
    const small = pearlStrike(PEARL_R[0], 0.5), big = pearlStrike(PEARL_R[1], 0.5);
    expect(small).toBeGreaterThan(0.1); // √(energy share): visible, not the 1.6 % a linear share would give
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThan(0.35);
    expect(pearlStrike(PEARL_R[1], 0)).toBeCloseTo(0.5 * pearlStrike(PEARL_R[1], 10), 6); // vnK spans 0.5 → 1
    expect(pearlStrike(1, 100)).toBe(1);
  });
  // Author 2026-11-22 (round 2): an idle trickle pearl has visible mass, so it ripples like a flung one; only beads
  // brought home by the refreeze guard stay silent (a ripple burst while the planet settles). pearlStrike keeps dust and
  // sub-pearl beads silent by class.
  it('each hit says whether it may ripple: flung or trickle alike, but never a refreeze-homing landing', () => {
    const b = createBeads(8);
    const i = spawnBead(b, 0.77, 0, 0, -1, 0, 0, PEARL_R[1]); b.age[i] = 1; b.free[i] = 1;
    const j = spawnBead(b, 0, 0.77, 0, 0, -1, 0, PEARL_R[1]); b.age[j] = 1;
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.nHits).toBe(2);
    expect([b.hits[5], b.hits[HIT_STRIDE + 5]]).toEqual([1, 1]);
    const k = spawnBead(b, 0, 0, 0.77, 0, 0, -1, PEARL_R[1]); b.age[k] = 1;
    stepBeads(b, 1 / 60, { ...CTX, liquid: false, freezeIn: 1 });
    expect(b.nHits).toBe(1);
    expect(b.hits[5]).toBe(0);
  });
  it('at rest the trickle ripples gently: ~1 proportional pearl ripple a second, never the old buzz', () => {
    const b = createBeads(256);
    const ctx = { ...CTX, phase: 'neutral', liquid: true, boil: 0, rateScale: 1 };
    let n = 0, sMin = Infinity, sMax = 0;
    const T = 60;
    for (let t = 0; t < T; t += 1 / 60) {
      stepBeads(b, 1 / 60, ctx);
      for (let k = 0; k < b.nHits; k++) {
        const h = HIT_STRIDE * k;
        if (!b.hits[h + 5]) continue;
        const s = pearlStrike(b.hits[h + 3], b.hits[h + 4]);
        if (s > 0) { n++; sMin = Math.min(sMin, s); sMax = Math.max(sMax, s); }
      }
    }
    expect(n / T).toBeGreaterThan(0.5);
    expect(n / T).toBeLessThan(1.5); // the px-gated floor version was ~6/s
    expect(sMin).toBeGreaterThan(0.05); // proportional, no floor: the smallest pearl landing slowly
    expect(sMax).toBeLessThan(0.3); // well under a drop's splash
  });
});

// The tiniest visible pearls vanished in one frame on contact (the drops' cascade sits on the surface, drains and sinks
// over a capillary time): a bead drawn as a body now coalesces the same way, anchored to the turning planet.
describe('coalescence: a visible bead merges over its capillary time (fix/mercury-motion)', () => {
  const Q0 = [0, 0, 0, 1];
  const drop = (r, ctx) => {
    const b = createBeads(8);
    const i = spawnBead(b, 0, 0, 0.75 + r + 0.004, 0, 0, -0.5, r); b.age[i] = 1;
    stepBeads(b, 1 / 60, ctx);
    return b;
  };
  it('stays on the surface at contact, drains and sinks, and is gone after capillaryTime(r); one hit only', () => {
    const r = PEARL_R[0];
    const ctx = { ...CTX, phase: 'neutral', liquid: false, pxPerUnit: 300, q: Q0 };
    const b = drop(r, ctx);
    expect(b.nHits).toBe(1);
    expect(b.n).toBe(1);
    let hits = 0, rPrev = b.r[0], t = 1 / 60;
    while (b.n > 0 && t < 2) {
      stepBeads(b, 1 / 60, ctx); t += 1 / 60; hits += b.nHits;
      if (b.n) {
        expect(b.r[0]).toBeLessThanOrEqual(rPrev + 1e-7);
        const d = Math.hypot(b.pos[0], b.pos[1], b.pos[2]);
        expect(d).toBeGreaterThanOrEqual(0.75 - 1e-6);
        expect(d).toBeLessThanOrEqual(0.75 + r + 1e-6);
        rPrev = b.r[0];
      }
    }
    expect(hits).toBe(0);
    expect(Math.abs(t - capillaryTime(r))).toBeLessThan(3 / 60);
  });
  it('rides the planet: the merge point turns with the body quaternion', () => {
    const ctx = { ...CTX, phase: 'neutral', liquid: false, pxPerUnit: 300, q: [0, 0, 0, 1] };
    const b = drop(PEARL_R[1], ctx);
    const s = Math.SQRT1_2; // 90° about +Y: +Z goes to +X
    stepBeads(b, 1 / 60, { ...ctx, q: [0, s, 0, s] });
    expect(b.pos[0]).toBeGreaterThan(0.7);
    expect(Math.abs(b.pos[2])).toBeLessThan(0.02);
  });
  it('a glint-only speck still merges at once, and without pxPerUnit every bead does (headless default)', () => {
    expect(drop(DUST_R[1], { ...CTX, liquid: false, pxPerUnit: 100, q: Q0 }).n).toBe(0);
    expect(drop(PEARL_R[1], { ...CTX, liquid: false }).n).toBe(0);
  });
});

// fix/mercury-motion: in a still aether (no element active) the drag braked a flung bead to rest far out, where G_BEAD
// barely pulls (terminal ≈ 0.01–0.03 u/s), and BEAD_LIFE faded it out in space. Flung beads now ease into an inward
// return drift after their free flight, and live until they land (FLING_LIFE is only the safety cap).
describe('flung beads come home (fix/mercury-motion)', () => {
  const landAll = (phase, omega = [0, MAX_OMEGA, 0], seconds = FLING_LIFE) => {
    const b = createBeads(64);
    spawnFling(b, omega, 0.75, FLING_N);
    let landed = 0;
    const ctx = { ...CTX, phase, liquid: false };
    for (let t = 0; t < seconds && b.n > 0; t += 1 / 60) { stepBeads(b, 1 / 60, ctx); landed += b.nHits; }
    return { landed, left: b.n };
  };
  it('a hyper-strength fling in a still aether: ≥ 95 % of the beads land on the planet', () => {
    const { landed } = landAll('neutral');
    expect(landed / FLING_N).toBeGreaterThanOrEqual(0.95);
  });
  it('carried by fluid or earth they still come home (the flow turns them; the drift brings them in)', () => {
    for (const phase of ['fluid', 'earth']) {
      const { landed } = landAll(phase);
      expect(landed / FLING_N, phase).toBeGreaterThanOrEqual(0.9);
    }
  });
  it('air (a rigid rotation) carries them off centrifugally: each one lands or leaves the scene, none fades in view', () => {
    const { landed, left } = landAll('air', [0, MAX_OMEGA, 0], FLING_LIFE - 1); // stop before the cap could fire
    // gone before FLING_LIFE: at hyper strength every one leaves past BEAD_ESCAPE_R · coreR (off frame), none faded
    expect(left).toBe(0);
    expect(landed).toBeLessThan(FLING_N / 2);
  });
  it('a flung bead does not hover: in a still aether most of the swarm is home within 8 s', () => {
    const { landed } = landAll('neutral', [0, MAX_OMEGA, 0], 8);
    expect(landed / FLING_N).toBeGreaterThanOrEqual(0.8);
    expect(FLING_RETURN_V).toBeGreaterThan(0);
  });
  it('a flung bead keeps full alpha past BEAD_LIFE (it fades only at the FLING_LIFE cap); ambient beads still fade', () => {
    const b = createBeads(8);
    const i = spawnBead(b, 0, 2.5, 0, 0, 0, 0, 0.01); b.free[i] = 1; b.age[i] = BEAD_LIFE - 0.1;
    const j = spawnBead(b, 0, -2.5, 0, 0, 0, 0, 0.01); b.age[j] = BEAD_LIFE - 0.1;
    stepBeads(b, 1 / 60, { ...CTX, calm: true, liquid: false });
    expect(b.outBead[3 * i + 1]).toBe(1);
    expect(b.outBead[3 * j + 1]).toBeLessThan(0.1);
  });
});

// While the planet refreezes (visible tab), airborne beads home onto the still-liquid surface before it stops counting as
// liquid; any still airborne once it has crusted fade out. Liquid beads never orbit a solid crust (fix/mercury-motion).
describe('freeze guard: airborne beads settle or clear as the planet refreezes (fix/mercury-motion)', () => {
  const base = { ...CTX, phase: 'neutral', liquid: false };
  const landBy = (b, ctx, seconds) => {
    let landed = 0, t = 0;
    for (; t < seconds && b.n > 0; t += 1 / 60) {
      const fi = ctx.freezeIn === undefined ? undefined : Math.max(0, ctx.freezeIn - t);
      stepBeads(b, 1 / 60, { ...ctx, freezeIn: fi }); landed += b.nHits;
    }
    return landed;
  };
  it('a trickle bead hovering far out lands before the surface stops being liquid', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 1.4, 0, 0, 0, 0, 0.004); b.age[0] = 1;
    expect(landBy(b, { ...base, freezeIn: 1.2 }, 1.2 + 0.1)).toBe(1);
  });
  it('a flung bead still heading out turns and lands in the window too', () => {
    const b = createBeads(8);
    const i = spawnBead(b, 1.6, 0, 0, 0.5, 0, 0, 0.01); b.free[i] = 1; b.age[i] = 2;
    expect(landBy(b, { ...base, freezeIn: 1.5 }, 1.5 + 0.1)).toBe(1);
  });
  it('on a crust an airborne bead fades out over FREEZE_FADE_S and is removed', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 2, 0, 0, 0, 0, 0.01); b.age[0] = 1;
    const ctx = { ...base, freezeIn: 0, pxPerUnit: 300, q: [0, 0, 0, 1] };
    stepBeads(b, 1 / 60, ctx);
    const a0 = b.outBead[1];
    stepBeads(b, 0.2, ctx);
    expect(b.outBead[1]).toBeLessThan(a0);
    for (let t = 0; t < FREEZE_FADE_S; t += 1 / 60) stepBeads(b, 1 / 60, ctx);
    expect(b.n).toBe(0);
  });
  it('a melted planet (freezeIn Infinity, the default) changes nothing: a hovering trickle bead keeps its full life', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 1.4, 0, 0, 0, 0, 0.004); b.age[0] = 1;
    run(b, 2, base);
    expect(b.n).toBe(1);
    expect(b.outBead[1]).toBe(1);
  });
});
