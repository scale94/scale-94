// artStrimer.test.js — the arithmetic behind the click-triggered wavefront.
//
// Every number here is from the design's section 1, which was measured before
// it was designed. The two that matter most:
//   - the packet must SPAN at least the per-frame stride (17% of the edge) or
//     it strobes into discrete beads. Measured, photographed.
//   - the head must be WHITE, because the knee scales all three channels
//     equally and can never whiten a saturated colour.

import { describe, it, expect } from 'vitest';
import {
  easeOutCubic, packetDuration, packetProfile, srgbToLinear01, hslToLinearRgb,
  createStrimerState, spawnStrimer, stepStrimer,
  STRIMER_MAX_PACKETS, STRIMER_STRIDE, PING_MS,
  DURATION_MIN_MS, DURATION_MAX_MS,
} from '../artStrimer';

describe('easeOutCubic', () => {
  it('is exact at both endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('opens at 3x the average speed — this IS the "aggressive attack"', () => {
    // d/dt [1-(1-t)^3] = 3(1-t)^2, which is 3 at t = 0.
    const e = 1e-6;
    expect((easeOutCubic(e) - easeOutCubic(0)) / e).toBeCloseTo(3, 4);
  });

  it('decelerates monotonically into the node', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const u = easeOutCubic(Math.min(t, 1));
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
    }
  });
});

describe('packetDuration', () => {
  it('clamps at both ends', () => {
    expect(packetDuration(0)).toBe(DURATION_MIN_MS);
    expect(packetDuration(1e6)).toBe(DURATION_MAX_MS);
  });

  it('is linear in world length between the clamps', () => {
    // Two lengths that both land strictly inside the band must keep their
    // ratio. Chord length on the unit sphere the nodes live on is <= 2.
    // 0.4 and 0.7 both land strictly inside at STRIMER_MS_PER_UNIT = 200
    // (80ms and 140ms). 1.0 would be 200ms and CLAMP, which is what makes a
    // ratio test on it quietly wrong.
    const a = packetDuration(0.4), b = packetDuration(0.7);
    expect(a).toBeGreaterThan(DURATION_MIN_MS);
    expect(b).toBeLessThan(DURATION_MAX_MS);
    expect(b / a).toBeCloseTo(1.75, 6);
  });

  it('keeps every chord a unit sphere can produce inside the band', () => {
    // The clamp is what guarantees a degree-4 burst stays in unison whatever
    // the graph's chord distribution turns out to be.
    for (let L = 0; L <= 2; L += 0.05) {
      const d = packetDuration(L);
      expect(d).toBeGreaterThanOrEqual(DURATION_MIN_MS);
      expect(d).toBeLessThanOrEqual(DURATION_MAX_MS);
    }
  });
});

describe('packetProfile', () => {
  it('is 1 at the head and 0 at the tail end', () => {
    expect(packetProfile(0)).toBe(1);
    expect(packetProfile(1)).toBe(0);
  });

  it('decreases monotonically — a bump would read as two heads', () => {
    let prev = Infinity;
    for (let h = 0; h <= 1.0001; h += 0.02) {
      const v = packetProfile(Math.min(h, 1));
      expect(v).toBeLessThanOrEqual(prev + 1e-12);
      prev = v;
    }
  });

  it('is dense: over half its mass sits in the leading third', () => {
    // "Dense, compact packet", not a linear streak. pow(1-h, 2.5).
    const mass = (lo, hi) => {
      let s = 0;
      for (let h = lo; h < hi; h += 0.0005) s += packetProfile(h) * 0.0005;
      return s;
    };
    expect(mass(0, 1 / 3)).toBeGreaterThan(mass(1 / 3, 1));
  });
});

describe('srgbToLinear01', () => {
  it('matches the sRGB piecewise curve at its anchors', () => {
    expect(srgbToLinear01(0)).toBeCloseTo(0, 10);
    expect(srgbToLinear01(1)).toBeCloseTo(1, 10);
    expect(srgbToLinear01(0.5)).toBeCloseTo(0.21404114, 6);
  });

  it('is below the identity in the midtones — the trap this exists for', () => {
    // A cluster hue written straight from NODE_COLORS would read brighter
    // and flatter than the same hue on an edge. See the design, section 9.
    expect(srgbToLinear01(0.5)).toBeLessThan(0.5);
  });
});

describe('hslToLinearRgb', () => {
  it('writes into the caller\'s array and returns it — no allocation', () => {
    const out = [0, 0, 0];
    expect(hslToLinearRgb({ hue: 0, sat: 0, lit: 0 }, out)).toBe(out);
  });

  it('sends pure white to linear 1 and black to 0', () => {
    const out = [0, 0, 0];
    hslToLinearRgb({ hue: 210, sat: 100, lit: 100 }, out);
    expect(out).toEqual([1, 1, 1]);
    hslToLinearRgb({ hue: 210, sat: 100, lit: 0 }, out);
    expect(out).toEqual([0, 0, 0]);
  });

  it('is darker than the raw sRGB channels for a mid-lightness hue', () => {
    const out = [0, 0, 0];
    hslToLinearRgb({ hue: 180, sat: 100, lit: 50 }, out);
    // sRGB cyan at lit 50 is (0, 1, 1); linear leaves 1 at 1 and 0 at 0, so
    // pick a hue whose channels are genuinely mid.
    const mid = [0, 0, 0];
    hslToLinearRgb({ hue: 30, sat: 100, lit: 50 }, mid);
    expect(mid[1]).toBeLessThan(0.5);
    expect(out[0]).toBe(0);
  });
});

describe('spawnStrimer', () => {
  const colour = { hue: 200, sat: 90, lit: 60 };
  const targets = [
    { dstId: 'b', worldLen: 0.5 },
    { dstId: 'c', worldLen: 0.8 },
    { dstId: 'd', worldLen: 1.1 },
    { dstId: 'e', worldLen: 0.9 },
  ];

  it('produces exactly one packet per target, all outward from the source', () => {
    const s = createStrimerState();
    expect(spawnStrimer(s, { srcId: 'a', targets, nowMs: 1000, colour })).toBe(4);
    expect(s.count).toBe(4);
    for (let i = 0; i < 4; i++) {
      // THE failure mode this guards: an edge tuple stored [neighbour, clicked]
      // spawning a packet that runs BACKWARD into the node that was clicked.
      expect(s.srcId[i]).toBe('a');
      expect(s.dstId[i]).not.toBe('a');
    }
    expect([...s.dstId.slice(0, 4)].sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('gives each packet its own duration from its own world length', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets, nowMs: 0, colour });
    expect(s.dur[0]).toBe(packetDuration(0.5));
    expect(s.dur[2]).toBe(packetDuration(1.1));
  });

  it('enforces the cap by dropping the OLDEST, and never exceeds it', () => {
    const s = createStrimerState();
    const one = [{ dstId: 'z', worldLen: 0.5 }];
    for (let i = 0; i < STRIMER_MAX_PACKETS + 20; i++) {
      spawnStrimer(s, { srcId: 's' + i, targets: one, nowMs: i, colour });
      expect(s.count).toBeLessThanOrEqual(STRIMER_MAX_PACKETS);
    }
    expect(s.count).toBe(STRIMER_MAX_PACKETS);
    // The survivors are the NEWEST, so the oldest source is gone.
    const alive = new Set([...s.srcId.slice(0, s.count)]);
    expect(alive.has('s0')).toBe(false);
    expect(alive.has('s' + (STRIMER_MAX_PACKETS + 19))).toBe(true);
  });

  it('sizes its buffer for two instances per slot — packet plus rail', () => {
    const s = createStrimerState();
    expect(s.data.length).toBe(STRIMER_MAX_PACKETS * 2 * STRIMER_STRIDE);
  });
});

describe('stepStrimer', () => {
  const colour = { hue: 200, sat: 90, lit: 60 };
  const one = [{ dstId: 'b', worldLen: 0.8 }];

  it('advances u by elapsed time, not by call count', () => {
    // The /SCENT double-speed bug in one assertion: two steps at the same
    // clock must leave u where one step did.
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    stepStrimer(s, 20);
    const after = s.u[0];
    stepStrimer(s, 20);
    expect(s.u[0]).toBe(after);
    stepStrimer(s, 40);
    expect(s.u[0]).toBeGreaterThan(after);
  });

  it('reports each arrival exactly once', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    const d = s.dur[0];
    stepStrimer(s, d * 0.5);
    expect(s.arrivedCount).toBe(0);
    stepStrimer(s, d + 1);
    expect(s.arrivedCount).toBe(1);
    expect(s.dstId[s.arrived[0]]).toBe('b');
    stepStrimer(s, d + 2);
    expect(s.arrivedCount).toBe(0);
  });

  it('retires a packet after its ping and frees the slot', () => {
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    const d = s.dur[0];
    stepStrimer(s, d + 1);
    expect(s.count).toBe(1);
    expect(s.ping[0]).toBe(1);
    // Half way through the ping it is still alive and half faded.
    stepStrimer(s, d + 1 + PING_MS * 0.5);
    expect(s.count).toBe(1);
    expect(s.ping[0]).toBeCloseTo(0.5, 5);
    // Past its end it is gone.
    stepStrimer(s, d + 1 + PING_MS + 1);
    expect(s.count).toBe(0);
  });

  it('fades the ping on the clock, not on the call count', () => {
    // The /SCENT bug again, one phase later: the packet's travel was already
    // time-based, and a ping that decremented per call would run at double
    // speed on a 120Hz display while every reference capture showed 60.
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: one, nowMs: 0, colour });
    const d = s.dur[0];
    stepStrimer(s, d + 1);
    stepStrimer(s, d + 1 + PING_MS * 0.25);
    const after = s.ping[0];
    stepStrimer(s, d + 1 + PING_MS * 0.25);
    expect(s.ping[0]).toBe(after);
  });

  it('survives head == tail without producing NaN', () => {
    // A zero-length edge degenerates the capsule into a disc, which is how
    // the ping is drawn. The edge shader already documents atan(0,0) and
    // mix(x, NaN, 0) as live hazards in exactly this situation.
    const s = createStrimerState();
    spawnStrimer(s, { srcId: 'a', targets: [{ dstId: 'b', worldLen: 0 }], nowMs: 0, colour });
    stepStrimer(s, 1);
    expect(Number.isNaN(s.u[0])).toBe(false);
    expect(Number.isFinite(s.dur[0])).toBe(true);
  });
});
