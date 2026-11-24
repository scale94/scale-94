// eyeReactions.test.js — the per-piece choreography table and how an impulse becomes a kick.
import { describe, it, expect } from 'vitest';
import { REACTIONS, reactionKick, BSKY_EXIT, TX_IGNITE } from '../eyeReactions';
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

  it('bsky_is_a_vortex_launch_with_no_held_beat', () => {
    const r = REACTIONS['bsky.trend'];
    expect(r.shape).toBe(SHAPE.butterfly);
    expect(typeof r.curve).toBe('function');
    const N = 600;
    const at = (x) => r.curve(x, {});
    const xs = Array.from({ length: N + 1 }, (_, i) => i / N);
    const pre = xs.filter((x) => x > 0.02 && x < BSKY_EXIT);
    // Spin winds up: turn velocity only ever grows until the exit.
    const dTurn = pre.map((x) => at(x + 1e-4).turn - at(x).turn);
    dTurn.slice(1).forEach((d, i) => expect(d).toBeGreaterThanOrEqual(dTurn[i] - 1e-12));
    // The wingbeat never holds: its phase always advances, and faster as the spin grows.
    const dB = pre.map((x) => at(x + 1e-4).shapeB - at(x).shapeB);
    expect(Math.min(...dB)).toBeGreaterThan(0);
    expect(dB.at(-1)).toBeGreaterThan(dB[0] * 2);
    // Slingshot: the rise is still slow at mid-launch, then leaves at its fastest.
    expect(at(BSKY_EXIT * 0.5).shapeA).toBeLessThan(0.1);
    expect(at(BSKY_EXIT).shapeA).toBe(1);
    // No reverse brake: the spin coasts on forward, its rate continuous at the exit,
    // and comes to rest exactly at the end.
    expect(r.backspinAt).toBeUndefined();
    const rate = (x) => (at(x + 1e-5).turn - at(x - 1e-5).turn) / 2e-5;
    expect(rate(BSKY_EXIT + 1e-4) / rate(BSKY_EXIT - 1e-4)).toBeCloseTo(1, 2);
    const post = xs.filter((x) => x > BSKY_EXIT && x < 1);
    const dPost = post.map((x) => at(x + 1e-4).turn - at(x).turn);
    expect(Math.min(...dPost)).toBeGreaterThanOrEqual(0);
    dPost.slice(1).forEach((d, i) => expect(d).toBeLessThanOrEqual(dPost[i] + 1e-12));  // only slows
    expect(rate(1 - 1e-4)).toBeLessThan(0.01);
    // It ends turned (folded into the phase), uncoloured and figure-less.
    expect(at(1).level).toBe(0);
    expect(at(1).shapeK).toBe(0);
    expect(at(1).turn).toBeGreaterThan(2 * Math.PI);
  });

  it('transmission_raises_an_antenna_and_broadcasts_outward', () => {
    const r = REACTIONS['transmission.mark'];
    expect(r.shape).toBe(SHAPE.antenna);
    const at = (x) => r.curve(x, {});
    // The mast is up and lit before the beacon ignites, and back in the pupil at the end.
    expect(at(TX_IGNITE).shapeA).toBeGreaterThan(0.95);
    expect(at(0).shapeA).toBe(0);
    expect(at(1).shapeA).toBe(0);
    expect(at(1).shapeK).toBe(0);
    expect(at(1).level).toBe(0);
    // Unlit until ignition, then the broadcast clock only runs forward (rings travel OUT).
    expect(at(TX_IGNITE - 0.01).shapeB).toBeLessThan(0);
    const xs = Array.from({ length: 300 }, (_, i) => TX_IGNITE + (i / 300) * (1 - TX_IGNITE));
    const B = xs.map((x) => at(x).shapeB);
    B.slice(1).forEach((b, i) => expect(b).toBeGreaterThan(B[i]));
    // All three pulses (0.45 apart, faded by 1.9) have left and faded while the mast still stands.
    const third = TX_IGNITE + (2 * 0.45 + 1.9) / 4.6;
    expect(third).toBeLessThan(0.9);
    // Each pulse shoves the liquid forward: a continuous turn, never backwards.
    const T = xs.map((x) => at(x).turn);
    T.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(T[i] - 1e-12));
    expect(at(1).turn).toBeCloseTo(0.9, 2);
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
