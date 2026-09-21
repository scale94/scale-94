import { describe, it, expect } from 'vitest';
import {
  createParticlePool, emitParticle, stepParticles,
  PARTICLE_DRAG, PARTICLE_HUE_BLEND, MAX_PARTICLES,
  emitEdgeParticles, EDGE_PARTICLE_SPEED_K, edgeLaunchK, PARTICLE_PULL,
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
  it('carries a launch speed that drifts exactly one edge under the real integrator', () => {
    // NOT `toBeCloseTo(1 - PARTICLE_DRAG)` — that restates the constant's own
    // definition and cannot fail while the definition is copied into it. This
    // runs the integrator's own arithmetic (add v, then decay) and asserts the
    // CONSEQUENCE: a unit edge is exactly covered. A wrong constant fails here
    // however tidily it was written.
    let x = 0, v = EDGE_PARTICLE_SPEED_K;
    for (let f = 0; f < 2000; f++) { x += v; v *= PARTICLE_DRAG; }
    expect(x).toBeCloseTo(1, 6);
  });

  it('reduces to the plain drag coefficient when there is no arrival term', () => {
    // The identity that keeps edgeLaunchK and EDGE_PARTICLE_SPEED_K from
    // drifting: at pull = 0 the denominator is 1 and the formula IS 1 - DRAG.
    expect(edgeLaunchK(0)).toBeCloseTo(EDGE_PARTICLE_SPEED_K, 12);
  });

  it('NEVER passes the node, at the pull the emitter actually ships with', () => {
    // The configuration production uses is pull = 1 -- both ArtTab call sites
    // omit the argument. Drag and arrival both aim at B and SUPERPOSE, so a
    // speed sized for the whole remaining distance overshoots: MEASURED peak
    // 1.124 of the way along the edge before this, about 40-60px past the node
    // at 900x700, and a particle lives 60-130 frames, squarely in that
    // transient.
    //
    // This walks the real per-frame map rather than the emitter, so it pins the
    // PROPERTY (the error never changes sign) and not a sampled position.
    for (const pull of [0, 0.25, 0.5, 1]) {
      const p = PARTICLE_PULL * pull;
      let x = 0, v = edgeLaunchK(pull), peak = 0;
      for (let n = 0; n < 4000; n++) {
        x += v; v *= PARTICLE_DRAG; x += (1 - x) * p;
        peak = Math.max(peak, x);
      }
      expect(peak).toBeLessThanOrEqual(1 + 1e-9);   // never overshoots
      expect(x).toBeCloseTo(1, 6);                  // and still arrives
    }
  });

  it('traverses the REST of the edge from wherever along it it was seeded', () => {
    const pool = createParticlePool();
    // `pull = 0`, and that is the whole point of this test. emitEdgeParticles
    // defaults pull to 1, and the arrival term alone drags a particle to its
    // target regardless of launch speed — MEASURED: with the old 0.002
    // coefficient restored this assertion still passed at xs = 0.9997. The
    // test could not fail for the reason it exists. Turning the pull off
    // isolates the drag kinematics, which is what the launch speed is for.
    emitEdgeParticles(pool, 0, 0, 0, 1, 0, 0, 10, 20, 1, 0);
    const i = 0;
    // The seed position is deliberately NOT overwritten. A particle is born at
    // `t = artRandom()` along the edge and launched at `(1 - t)` of the full
    // speed, so it asymptotes to `t + (1 - t)` = B exactly. Zeroing the
    // position here — as this test used to — would leave it aimed at `1 - t`
    // and assert an arrival it can no longer make.
    //
    // maxLife IS pinned: emitEdgeParticles draws it from the shared
    // artRandom() stream (60-130 frames), stepParticles freezes a particle at
    // that cap, and 60-130 frames is only 2.2-4.7 e-foldings — short of the
    // asymptote. Left on the draw, this failed on roughly half of all runs.
    pool.maxLifes[i] = 1000;
    for (let f = 0; f < 400; f++) stepParticles(pool, 1);
    // Asymptotically 1.0; 400 frames is ~14 e-foldings, so within a whisker.
    // The velocity jitter is +/-0.0004, i.e. +/-0.011 of displacement.
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

describe('particle arrival — an exponential approach, not a spring', () => {
  const seed = (pull) => {
    const pool = createParticlePool();
    emitParticle(pool, 0, 0, 0, 0, 0, 0, 10, 10, 50, 1, 500, 1, 0, 0, pull);
    return pool;
  };

  it('COMPOSES: N sub-steps of dt/N land where one step of dt lands', () => {
    // The whole reason this is a positional approach and not `v += (T-P)*k*dt`.
    // A Euler spring does not compose, and at dt = 1 it agrees with the
    // correct form exactly -- so a dt = 1 test would pass on the broken one.
    const whole = seed(1);
    stepParticles(whole, 6);

    const split = seed(1);
    for (let i = 0; i < 6; i++) stepParticles(split, 1);

    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 9);
    expect(split.ys[0]).toBeCloseTo(whole.ys[0], 9);
    expect(split.zs[0]).toBeCloseTo(whole.zs[0], 9);
  });

  it('composes at a fractional sub-step too, which is what a 360Hz panel gives', () => {
    const whole = seed(1); stepParticles(whole, 1);
    const split = seed(1); for (let i = 0; i < 6; i++) stepParticles(split, 1 / 6);
    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 9);
  });

  it('puts the per-particle strength INSIDE the exponent, not outside the result', () => {
    // The trap: `approach * pulls[i]` scales the COMPOSED factor and breaks
    // composition per particle. The strength has to scale the RATE, i.e. the
    // base that gets raised to dt. Two particles at half strength stepped six
    // times must still equal one step of six.
    const whole = seed(0.5); stepParticles(whole, 6);
    const split = seed(0.5); for (let i = 0; i < 6; i++) stepParticles(split, 1);
    // Precision 7, not 9: xs is a Float32Array, and this path rounds to f32 on
    // every one of the 6 sub-steps against 1 rounding for the whole step. In
    // double precision the two forms agree to 1e-17 (MEASURED) -- the law
    // composes exactly. One float32 ULP at this position is 3.725e-9; precision 7
    // yields tolerance 5e-8 (13.4x that noise floor, stable). Precision 9 (5e-10)
    // is tighter than one ULP and fails on correct implementations. The actual bug
    // this test exists to catch (strength outside the exponent) diverges by 1.441e-3
    // (29,000x the precision-7 tolerance), so discrimination is unaffected. Same
    // convention as the structurally identical position-composition test at line 129.
    expect(split.xs[0]).toBeCloseTo(whole.xs[0], 7);
  });

  it('approaches the target and never overshoots it', () => {
    const pool = seed(1);
    let prev = -Infinity;
    for (let f = 0; f < 200; f++) {
      stepParticles(pool, 1);
      expect(pool.xs[0]).toBeLessThanOrEqual(1 + 1e-9);
      expect(pool.xs[0]).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = pool.xs[0];
    }
    expect(pool.xs[0]).toBeGreaterThan(0.9);
  });

  it('is EXACTLY inert at pull = 0, so every untargeted emitter is untouched', () => {
    const pulled = seed(0);
    const plain = createParticlePool();
    emitParticle(plain, 0, 0, 0, 0.01, 0, 0, 10, 10, 50, 1, 500);
    pulled.vxs[0] = 0.01;
    for (let i = 0; i < 50; i++) { stepParticles(pulled, 1); stepParticles(plain, 1); }
    expect(pulled.xs[0]).toBe(plain.xs[0]);
  });
});
