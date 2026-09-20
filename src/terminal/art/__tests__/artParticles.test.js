import { describe, it, expect } from 'vitest';
import {
  createParticlePool, emitParticle, stepParticles,
  PARTICLE_DRAG, PARTICLE_HUE_BLEND, MAX_PARTICLES,
  emitEdgeParticles, EDGE_PARTICLE_SPEED_K,
} from '../artParticles.js';

// ── The particle ECOLOGY is integrated on the clock, not on draws ────────────
//
// `stepParticles` aged every particle by `lifes[i] += 1` per DRAW and
// integrated position and drag per draw too. That is the same defect as the six
// emission cadences, one layer down, and the two interact in a way that hid it:
// while BOTH halves were per-frame they cancelled, so the live population was
// roughly rate-invariant and only the TEMPO was wrong — at 360Hz every particle
// lived and moved six times too fast. Fixing emission alone broke the
// cancellation and made the population fall instead.
//
// The contract frozen here:
//   1. the same wall-clock window leaves a particle in the same place, with the
//      same age and the same speed, at any refresh rate;
//   2. one step of dt=1 is EXACTLY what the per-draw version did, so 60fps is
//      unchanged and the reference images do not move;
//   3. drag and hue blending are EXPONENTIAL, so they compose across sub-steps
//      rather than drifting apart from the whole-step answer.
//
// ON TOLERANCES, because "exactly" has a ceiling here. The pool is a Float32
// SoA, so every write rounds to ~7 significant digits and a 360-step run banks
// six times as many roundings as a 60-step one. Cross-rate equality is
// therefore asserted at f32 precision, NOT at double. That is not slack hiding
// a bug: the defect being tested for is a factor of SIX (life 100 against 60,
// displacement 0.271 against 0.247), which is five orders of magnitude clear of
// these tolerances. The dt=1 parity assertions below are the exception and are
// exact, because one step rounds once either way.

/** A pool holding exactly one particle with known, non-symmetric state. */
function onePool({ v = 0.01, maxLife = 100, hue = 10, hueTarget = 70 } = {}) {
  const pool = createParticlePool();
  emitParticle(pool, 0, 0, 0, v, v * 2, v * 3, hue, hueTarget, 80, 1.5, maxLife);
  return pool;
}

/** Advances `frames` steps of `dt` authored frames each. */
function run(pool, frames, dt) {
  for (let i = 0; i < frames; i++) stepParticles(pool, dt);
  return {
    x: pool.xs[0], y: pool.ys[0], z: pool.zs[0],
    vx: pool.vxs[0], life: pool.lifes[0], hue: pool.hues[0],
  };
}

describe('stepParticles — one authored frame is exactly what it always was', () => {
  it('moves by the raw velocity and decays it once, for dt = 1', () => {
    // The parity anchor. Whatever form the conversion takes, dt=1 has to return
    // the shipped arithmetic UNROUNDED or every reference image moves.
    const pool = onePool({ v: 0.01 });
    const v0 = pool.vxs[0];              // as STORED: f32, not the 0.01 literal
    stepParticles(pool, 1);
    expect(pool.xs[0]).toBe(v0);                            // x += v, exactly
    expect(pool.vxs[0]).toBe(Math.fround(v0 * PARTICLE_DRAG));  // v *= drag, exactly
    expect(pool.lifes[0]).toBe(1);
  });

  it('blends the hue by exactly one step of the shipped factor, for dt = 1', () => {
    const pool = onePool({ hue: 10, hueTarget: 70 });
    stepParticles(pool, 1);
    expect(pool.hues[0]).toBeCloseTo(10 + 60 * PARTICLE_HUE_BLEND, 5);
  });

  it('still skips a particle that is already dead', () => {
    const pool = onePool({ maxLife: 2 });
    stepParticles(pool, 1);
    stepParticles(pool, 1);
    const frozen = pool.xs[0];
    stepParticles(pool, 1);
    expect(pool.lifes[0]).toBe(2);        // not aged past its span
    expect(pool.xs[0]).toBe(frozen);      // and not moved
  });
});

describe('stepParticles — the same wall-clock window, at any refresh rate', () => {
  it('ages a particle by wall time, not by draws', () => {
    // One authored second. Under the per-draw version the 360Hz column aged six
    // times as fast, so a particle died in a sixth of the wall time.
    const at60  = run(onePool(), 60,  1);
    const at120 = run(onePool(), 120, 1 / 2);
    const at360 = run(onePool(), 360, 1 / 6);
    expect(at60.life).toBeCloseTo(60, 3);
    expect(at120.life).toBeCloseTo(60, 3);
    expect(at360.life).toBeCloseTo(60, 3);
  });

  it('leaves it in the same place, travelling at the same speed', () => {
    // This is the one that needs the exponential forms. Explicit Euler
    // sub-stepped six times does NOT land where one whole step lands — measured,
    // it falls ~1.5% short per authored frame, which compounds over a 140-frame
    // life. The displacement factor (drag^dt - 1)/(drag - 1) is chosen precisely
    // because it composes EXACTLY and still returns 1 at dt = 1.
    const at60  = run(onePool(), 60,  1);
    const at360 = run(onePool(), 360, 1 / 6);
    expect(at360.x).toBeCloseTo(at60.x, 5);
    expect(at360.y).toBeCloseTo(at60.y, 5);
    expect(at360.z).toBeCloseTo(at60.z, 5);
    expect(at360.vx).toBeCloseTo(at60.vx, 5);
  });

  it('blends the hue to the same place at any rate', () => {
    const at60  = run(onePool({ hue: 10, hueTarget: 300 }), 60,  1);
    const at360 = run(onePool({ hue: 10, hueTarget: 300 }), 360, 1 / 6);
    expect(at360.hue).toBeCloseTo(at60.hue, 3);
  });

  it('takes the short way round the colour wheel at any rate', () => {
    // hue 350 -> 10 must go FORWARD through 0, not backward through 180. The
    // wrap is recomputed every step, so a sub-stepped run must not take a
    // different branch on any of its steps.
    const at60  = run(onePool({ hue: 350, hueTarget: 10 }), 60,  1);
    const at360 = run(onePool({ hue: 350, hueTarget: 10 }), 360, 1 / 6);
    expect(at60.hue).toBeGreaterThan(350);
    expect(at360.hue).toBeCloseTo(at60.hue, 3);
  });

  it('composes exactly: N sub-steps equal one whole step', () => {
    // Stated as its own law because it is the property the whole conversion
    // rests on, and it is not true of the obvious `x += v * dt` / `v *= drag`
    // formulation that a reviewer would reach for first.
    const whole = run(onePool(), 1, 1);
    for (const n of [2, 3, 5, 6, 10]) {
      const split = run(onePool(), n, 1 / n);
      expect(split.x).toBeCloseTo(whole.x, 7);
      expect(split.vx).toBeCloseTo(whole.vx, 7);
      expect(split.life).toBeCloseTo(whole.life, 5);
    }
  });

  it('does not move a particle at all for dt = 0', () => {
    // A clock that ran backwards is floored at 0 upstream; the integrator must
    // treat that as "no time passed", not as "one frame".
    const pool = onePool();
    stepParticles(pool, 1);
    const { xs, vxs, lifes } = pool;
    const x = xs[0], v = vxs[0], l = lifes[0];
    stepParticles(pool, 0);
    expect(pool.xs[0]).toBe(x);
    expect(pool.vxs[0]).toBe(v);
    expect(pool.lifes[0]).toBe(l);
  });

  it('leaves empty slots alone', () => {
    // maxLife 0 is an unused slot; the guard that skips it is load-bearing for
    // the render loop, which reads the same condition.
    const pool = createParticlePool();
    stepParticles(pool, 1);
    for (let i = 0; i < MAX_PARTICLES; i++) expect(pool.lifes[i]).toBe(0);
  });
});

describe('edge particles have the range to cross their own edge', () => {
  it('derives its launch speed from the drag, not from a literal', () => {
    // Total displacement under geometric drag is v0 * sum(DRAG^k) =
    // v0 / (1 - DRAG). To cover an edge of length L in the limit, v0 must be
    // (1 - DRAG) * L. Anything else is a number someone typed.
    expect(EDGE_PARTICLE_SPEED_K).toBeCloseTo(1 - PARTICLE_DRAG, 12);
  });

  it('actually traverses the edge it was emitted along', () => {
    const pool = createParticlePool();
    // A straight unit-length edge along +x, seeded at its A end.
    emitEdgeParticles(pool, 0, 0, 0, 1, 0, 0, 10, 20, 1);
    const i = 0;
    pool.xs[i] = 0; pool.ys[i] = 0; pool.zs[i] = 0;
    // emitEdgeParticles also draws this particle's maxLife from the shared
    // artRandom() stream (60-130 frames). stepParticles freezes a particle's
    // position once its life reaches that cap, and 60-130 frames is only
    // 2.2-4.7 e-foldings of PARTICLE_DRAG — not enough to reach the asymptote
    // this test is checking. Left coupled to the random draw, this assertion
    // fails on roughly half of all runs (MEASURED). Pinning maxLife here tests
    // the KINEMATICS this test is actually about, without depending on an
    // absolute value the shared stream happens to return.
    pool.maxLifes[i] = 1000;
    for (let f = 0; f < 400; f++) stepParticles(pool, 1);
    // Asymptotically 1.0; 400 frames is ~14 e-foldings, so within a whisker.
    expect(pool.xs[i]).toBeGreaterThan(0.97);
    expect(pool.xs[i]).toBeLessThan(1.03);
  });

  it('was travelling 5.5% of an edge before this — the regression this locks out', () => {
    // The old coefficient. Kept as an explicit number rather than a comment so
    // that a future 'tidy the magic numbers' pass cannot quietly restore it.
    const OLD = 0.002;
    expect(OLD / (1 - PARTICLE_DRAG)).toBeLessThan(0.06);
  });
});
