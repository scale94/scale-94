import { describe, it, expect } from 'vitest';
import {
  drawConductor, conductorState, CONDUCTOR,
  stepAwakening, resetAwakeningCadence, GENESIS_PERIOD_FRAMES,
} from '../artAwakening.js';
import { createParticlePool } from '../artParticles.js';
import { seedArtRandom, ART_SEED } from '../artRandom.js';

/** Records every ctx mutation and call in order. The conductor's 2-D form is
 *  the reference the GL port is measured against, so the refactor that splits
 *  state from drawing has to emit this sequence unchanged — captured from the
 *  pre-refactor function and frozen here, not re-derived from the new one. */
function recorder() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (_t, k) => (...a) => { log.push([k, ...a]); },
    set: (_t, k, v) => { log.push(['=' + k, v]); return true; },
  });
  return { ctx, log };
}

const TAU = Math.PI * 2;

// Captured from the 2-D implementation at e6728f6, before any refactor.
const GOLDEN_DRAG_PUSH = [
  ['save'],
  ['=globalAlpha', 0.3], ['=fillStyle', 'hsl(210, 50%, 55%)'],
  ['beginPath'], ['arc', 794, 300, 3, 0, TAU], ['fill'],
  ['=globalAlpha', 0.05], ['=strokeStyle', '#666'], ['=lineWidth', 1],
  ['beginPath'], ['moveTo', 794, 120], ['lineTo', 794, 480], ['stroke'],
  ['=globalAlpha', 0.1], ['=strokeStyle', 'hsla(210, 40%, 50%, 1)'], ['=lineWidth', 1],
  ['beginPath'], ['moveTo', 794, 480], ['lineTo', 794, 300], ['stroke'],
  ['=globalAlpha', 0.1], ['=shadowColor', 'hsl(210, 70%, 50%)'], ['=shadowBlur', 4],
  ['beginPath'], ['arc', 794, 300, 4, 0, TAU], ['fill'],
  ['=shadowBlur', 0],
  ['restore'],
];

const GOLDEN_IDLE = [
  ['save'],
  ['=globalAlpha', 0.03], ['=fillStyle', 'hsl(210, 50%, 55%)'],
  ['beginPath'], ['arc', 794, 300, 1.5, 0, TAU], ['fill'],
  ['restore'],
];

describe('drawConductor — 2-D parity across the refactor', () => {
  it('emits the captured sequence while dragging with a peer push', () => {
    const { ctx, log } = recorder();
    drawConductor(ctx, { conductorY: 0.5, collectiveR: 0.01 }, true, 800, 600);
    expect(log).toEqual(GOLDEN_DRAG_PUSH);
  });

  it('emits only the dormant thumb when neither dragging nor pushed', () => {
    const { ctx, log } = recorder();
    drawConductor(ctx, { conductorY: 0.5, collectiveR: 0 }, false, 800, 600);
    expect(log).toEqual(GOLDEN_IDLE);
  });

  it('draws nothing but the thumb when the fill bar is under a pixel', () => {
    const { ctx, log } = recorder();
    // stripH 360 * cY 0.002 = 0.72px, under MIN_FILL_H
    drawConductor(ctx, { conductorY: 0.002, collectiveR: 0 }, true, 800, 600);
    expect(log.filter(e => e[0] === 'stroke')).toHaveLength(1); // track only
  });
});

describe('conductorState — the geometry and the visibility law', () => {
  const at = (o, dragging = false, w = 800, h = 600) =>
    conductorState({ conductorY: 0, collectiveR: 0, ...o }, dragging, w, h);

  it('places the strip on the right edge, 20%..80% of the height', () => {
    const s = at({});
    expect(s.stripX).toBe(800 - CONDUCTOR.MARGIN_X);
    expect(s.stripY).toBeCloseTo(120);
    expect(s.stripH).toBeCloseTo(360);
  });

  it('runs the thumb from the strip bottom upward as conductorY rises', () => {
    expect(at({ conductorY: 0 }).thumbY).toBeCloseTo(480);
    expect(at({ conductorY: 1 }).thumbY).toBeCloseTo(120);
    expect(at({ conductorY: 0.5 }).thumbY).toBeCloseTo(300);
  });

  it('steps the hue cool -> warm -> hot at the two thresholds', () => {
    expect(at({ conductorY: 0.6 }).hue).toBe(CONDUCTOR.HUE_COOL);
    expect(at({ conductorY: 0.61 }).hue).toBe(CONDUCTOR.HUE_WARM);
    expect(at({ conductorY: 0.85 }).hue).toBe(CONDUCTOR.HUE_WARM);
    expect(at({ conductorY: 0.86 }).hue).toBe(CONDUCTOR.HUE_HOT);
  });

  it('is visible only while dragging or under a peer push', () => {
    expect(at({}, false).visible).toBe(false);
    expect(at({}, true).visible).toBe(true);
    expect(at({ collectiveR: 0.0004 }, false).visible).toBe(true);
    expect(at({ collectiveR: 0.0003 }, false).visible).toBe(false);
  });

  it('omits track, fill and glow entirely when dormant', () => {
    const s = at({}, false);
    expect(s.track).toBeNull();
    expect(s.fill).toBeNull();
    expect(s.glow).toBeNull();
    expect(s.thumb.alpha).toBe(CONDUCTOR.ALPHA_DORMANT);
  });

  it('fattens the thumb and brightens the fill while dragging', () => {
    expect(at({ conductorY: 0.5 }, false).thumb.r).toBe(CONDUCTOR.DOT_R);
    expect(at({ conductorY: 0.5 }, true).thumb.r).toBe(CONDUCTOR.DOT_R_DRAG);
    expect(at({ conductorY: 0.5 }, true).fill.alpha).toBe(CONDUCTOR.ALPHA_FILL_DRAG);
    expect(at({ conductorY: 0.5, collectiveR: 0.01 }, false).fill.alpha)
      .toBe(CONDUCTOR.ALPHA_FILL);
  });

  it('drops the fill bar below one pixel rather than drawing a stub', () => {
    expect(at({ conductorY: 0.002 }, true).fill).toBeNull();
    expect(at({ conductorY: 0.01 }, true).fill).not.toBeNull();
  });

  it('clamps the peer glow alpha and pads its radius past the thumb', () => {
    const weak = at({ collectiveR: 0.001 }, false);
    expect(weak.glow.alpha).toBeCloseTo(0.04);
    const strong = at({ collectiveR: 0.9 }, false);
    expect(strong.glow.alpha).toBe(CONDUCTOR.PEER_GLOW_MAX);
    expect(strong.glow.r).toBe(CONDUCTOR.DOT_R + CONDUCTOR.GLOW_PAD);
  });

  it('gives the glow the fill colour and a separate shadow colour', () => {
    // ctx.fill() paints the shape in fillStyle and the blur in shadowColor,
    // so these are two different colours and the GL port needs both.
    const g = at({ conductorY: 0.5, collectiveR: 0.01 }, false).glow;
    expect(g.hsl).toEqual({ hue: 210, sat: CONDUCTOR.THUMB_SAT, lit: CONDUCTOR.THUMB_LIT });
    expect(g.shadowHsl).toEqual({ hue: 210, sat: CONDUCTOR.SHADOW_SAT, lit: CONDUCTOR.SHADOW_LIT });
    expect(g.blur).toBe(CONDUCTOR.GLOW_BLUR);
  });

  it('reports every sub-layer that a frame actually drew', () => {
    expect(conductorState({ conductorY: 0.5, collectiveR: 0.01 }, true, 800, 600).drawn)
      .toEqual({ thumb: 1, track: 1, fill: 1, glow: 1 });
    expect(conductorState({ conductorY: 0.5, collectiveR: 0 }, false, 800, 600).drawn)
      .toEqual({ thumb: 1, track: 0, fill: 0, glow: 0 });
  });
});

describe('the GL port reads the same colours the 2-D path did', () => {
  it('means exactly #666 by the track RGB triple', () => {
    // The 2-D path emits the CSS literal '#666' (frozen in the golden above);
    // the GL path writes CONDUCTOR.TRACK_RGB / 255. Nothing makes those two
    // agree except this assertion, so it is here rather than in a comment.
    expect(CONDUCTOR.TRACK_RGB).toEqual([0x66, 0x66, 0x66]);
    expect(CONDUCTOR.TRACK_RGB.map(v => v / 255))
      .toEqual([0x66 / 255, 0x66 / 255, 0x66 / 255]);
  });

  it('keeps the glow blur inside the source-over mesh quantisation', () => {
    // The glow byte is 7 bits at 8 steps/px, so the largest representable
    // radius is 127/8 = 15.875. A 4px blur lands exactly on a step.
    expect(CONDUCTOR.GLOW_BLUR * 8).toBe(Math.round(CONDUCTOR.GLOW_BLUR * 8));
    expect(CONDUCTOR.GLOW_BLUR * 8).toBeLessThan(128);
  });

  it('keeps every disc radius inside the range the shadow fit was made for', () => {
    // discShadowFit is a fit over R/sigma in [1.25, 2], not a universal law.
    // The glow disc's radius is dotR + GLOW_PAD and sigma is GLOW_BLUR/2.
    const sigma = CONDUCTOR.GLOW_BLUR / 2;
    for (const dotR of [CONDUCTOR.DOT_R, CONDUCTOR.DOT_R_DRAG]) {
      const ratio = (dotR + CONDUCTOR.GLOW_PAD) / sigma;
      expect(ratio).toBeGreaterThanOrEqual(1.25);
      expect(ratio).toBeLessThanOrEqual(2);
    }
  });
});

// ── The genesis cascade emits on the CLOCK, not on a frame count ─────────────
//
// `if (frameCount % 10 === 0)` ran the opening four seconds of the artwork six
// times as densely on a 360Hz panel as it was authored to. This is the last of
// the six frame-counted cadences and the only one inside a phase window, so it
// is also the one where the error is least visible as "more particles" and most
// visible as "the birth of the world is the wrong texture".
describe('stepAwakening — genesis particles step on the clock', () => {
  const T0 = 100000;          // the harness's VIRTUAL_START, deliberately

  /** Phase 0 with every node already above the emission threshold, so the only
   *  thing deciding when a particle appears is the gate and the seeded stream. */
  const freshWorld = () => {
    const aw = {
      phase: 0, t0: T0, interacted: false, autoFiredNodes: [], beaconIdx: 0,
      breathPhase: 0,
    };
    resetAwakeningCadence(aw);
    const nodes = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`, cluster: 'eco', energy: 0.5,
      x: i * 0.01, y: i * 0.02, z: i * 0.03,
    }));
    return { aw, nodes };
  };

  /** Runs `frames` draws of `dtMs` and returns both the total particles emitted
   *  and the 1-based draws on which the pool grew. `pool.next` is the ring write
   *  head; every run here stays well under MAX_PARTICLES so it is the count. */
  const genesisRun = (frames, dtMs) => {
    seedArtRandom(ART_SEED);
    const { aw, nodes } = freshWorld();
    const pool = createParticlePool();
    const firedOn = [];
    let t = T0, last = 0;
    for (let i = 1; i <= frames; i++) {
      t += dtMs;
      stepAwakening(aw, nodes, pool, t);
      if (pool.next !== last) { firedOn.push(i); last = pool.next; }
    }
    return { emitted: pool.next, firedOn };
  };

  it('emits the same number of genesis particles per wall-second at any rate', () => {
    // Three seconds, inside phase 0's four-second window at every rate.
    const at60  = genesisRun(180,  1000 / 60);
    const at120 = genesisRun(360,  1000 / 120);
    const at360 = genesisRun(1080, 1000 / 360);

    expect(at60.emitted).toBeGreaterThan(20);     // the run actually emitted
    expect(at60.emitted).toBeLessThan(400);       // ...and never wrapped the ring
    // Under the frame counter the 360Hz column was 6x this.
    expect(at120.emitted).toBe(at60.emitted);
    expect(at360.emitted).toBe(at60.emitted);
  });

  it('draws the identical particles at any rate, not merely the same count', () => {
    // A count can match while the stream underneath has moved — this branch's
    // defining failure is a metric agreeing while the picture changed. Both
    // runs must consume the seeded stream in the same order, so every particle
    // has to land at the same place with the same hue and the same lifespan.
    const read = (frames, dtMs) => {
      seedArtRandom(ART_SEED);
      const { aw, nodes } = freshWorld();
      const pool = createParticlePool();
      let t = T0;
      for (let i = 1; i <= frames; i++) { t += dtMs; stepAwakening(aw, nodes, pool, t); }
      return {
        n: pool.next,
        xs: Array.from(pool.xs.slice(0, pool.next)),
        hues: Array.from(pool.hues.slice(0, pool.next)),
        maxLifes: Array.from(pool.maxLifes.slice(0, pool.next)),
      };
    };
    const a = read(180,  1000 / 60);
    const b = read(1080, 1000 / 360);
    expect(b.n).toBe(a.n);
    expect(b.xs).toEqual(a.xs);
    expect(b.hues).toEqual(a.hues);
    expect(b.maxLifes).toEqual(a.maxLifes);
  });

  it('fires on the frames `frameCount % 10 === 0` fired on, starting at the first', () => {
    // The counter was read BEFORE it was incremented, so draw 1 saw 0 and
    // fired. Preserving that is why the gate is primed: it is the difference
    // between the cascade opening on frame 1 and opening on frame 11.
    const { firedOn } = genesisRun(60, 1000 / 60);
    expect(firedOn[0]).toBe(1);
    for (const f of firedOn) expect((f - 1) % GENESIS_PERIOD_FRAMES).toBe(0);
  });

  it('leaves phase 0 for phase 1 on wall time, not on draws', () => {
    // Guards the conversion against the obvious over-reach: `elapsed` was
    // already wall-clock and must stay that way.
    const { aw, nodes } = freshWorld();
    const pool = createParticlePool();
    for (let i = 1; i <= 60; i++) stepAwakening(aw, nodes, pool, T0 + i * (1000 / 60));
    expect(aw.phase).toBe(0);                       // 1s in
    stepAwakening(aw, nodes, pool, T0 + 4001);
    expect(aw.phase).toBe(1);
  });
});
