// eyeReactions.test.js — the per-piece choreography table and how an impulse becomes a kick.
import { describe, it, expect } from 'vitest';
import { REACTIONS, reactionKick } from '../eyeReactions';
import { KICK, SHAPE } from '../observerEyeShader';

const last = (keys, f) => keys.slice().sort((a, b) => a.t - b.t).at(-1)[f];

describe('eyeReactions', () => {
  it('kernel_pieces_become_the_chip', () => {
    for (const piece of ['kernel.load', 'kernel.run', 'kernel.enter']) {
      const r = REACTIONS[piece];
      expect(r.shape).toBe(SHAPE.kernel);
      expect(Math.max(...r.keys.map((k) => k.shapeK))).toBeGreaterThan(0.8);
      expect(last(r.keys, 'shapeK')).toBe(0);                    // melts back to the disc
      expect(last(r.keys, 'level')).toBe(0);
    }
  });

  it('kernel_die_spins_up_then_backspins_to_upright', () => {
    for (const piece of ['kernel.load', 'kernel.run', 'kernel.enter']) {
      const B = REACTIONS[piece].keys.map((k) => k.shapeB);
      const peak = Math.max(...B);
      const end = B.at(-1);
      expect(end).toBeLessThan(peak);                            // it brakes and comes back
      const q = end / (Math.PI / 2);
      expect(Math.abs(q - Math.round(q))).toBeLessThan(1e-9);    // the diamond lands upright
    }
    expect(Math.max(...REACTIONS['kernel.run'].keys.map((k) => k.shapeB)))
      .toBeGreaterThan(Math.max(...REACTIONS['kernel.load'].keys.map((k) => k.shapeB)));
  });

  it('impulse_overlays_its_choreography', () => {
    const imp = { piece: 'kernel.run', kind: KICK.miosis, tint: [167, 139, 250], tint2: [122, 184, 0], dir: 1, durationMs: 1100 };
    const k = reactionKick(imp);
    expect(k).toMatchObject({ tint: imp.tint, tint2: imp.tint2, shape: SHAPE.kernel, durationMs: 2100 });
    expect(k.keys).toBe(REACTIONS['kernel.run'].keys);
  });

  it('unchoreographed_piece_keeps_its_plain_kick', () => {
    const imp = { piece: 'ledger.write', kind: KICK.ripple, tint: [1, 2, 3], tint2: null, dir: -1, durationMs: 1100, at: 5 };
    expect(reactionKick(imp)).toEqual({ kind: KICK.ripple, tint: [1, 2, 3], tint2: null, dir: -1, durationMs: 1100 });
  });
});
