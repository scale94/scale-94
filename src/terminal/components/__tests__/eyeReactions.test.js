// eyeReactions.test.js — the per-piece choreography table and how an impulse becomes a kick.
import { describe, it, expect } from 'vitest';
import { REACTIONS, reactionKick, BSKY_EXIT, TX_IGNITE, ACC_TAG, EJECT_OUT, SCENT_HIT, surveillanceTrace, CRYPTO_SNAP, CRYPTO_TAG } from '../eyeReactions';
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

  it('accretion_lifecycle_stages_share_one_tag', () => {
    for (const p of ['accretion.prime', 'accretion.infall', 'accretion.collide', 'accretion.release']) {
      expect(REACTIONS[p].tag).toBe(ACC_TAG);
    }
    expect(REACTIONS['accretion.release'].release).toBe(true);
    expect(REACTIONS['accretion.prime'].durationMs).toBeGreaterThanOrEqual(45000);   // the ARMED timeout
  });

  it('accretion_prime_is_quiet_and_holds', () => {
    const r = REACTIONS['accretion.prime'];
    const at = (s) => r.curve(s / (r.durationMs / 1000), {});
    for (const s of [2, 10, 30]) {
      expect(at(s).level).toBeGreaterThan(0.2);
      expect(at(s).level).toBeLessThan(0.4);                   // subtle, never a full tint
      expect(at(s).shapeK).toBe(0);
    }
    expect(at(20).turn).toBeGreaterThan(at(10).turn);          // the slow inward draw keeps going
  });

  it('accretion_swallow_holds_the_horizon_through_the_flight', () => {
    const r = REACTIONS['accretion.infall'];
    expect(r.shape).toBe(SHAPE.horizon);
    const at = (s) => r.curve(s / (r.durationMs / 1000), {});
    expect(at(0).shapeB).toBeGreaterThan(1);                   // the front starts at the rim
    for (const s of [1, 2.5, 4.1, 5.5]) {                      // held: dark, ringed, violet
      expect(at(s).shapeA).toBeGreaterThan(0.33);
      expect(at(s).shapeB).toBeLessThan(0.52);
      expect(at(s).level).toBeGreaterThan(0.99);
      expect(at(s).shapeC).toBe(0);
    }
    expect(at(4.2).turn).toBeGreaterThan(at(4.0).turn);        // still turning, slowly, forward
    expect(at(7.5).shapeA).toBe(0);                            // the safety tail closes it
  });

  it('accretion_eject_leaves_the_core_before_the_horizon_collapses', () => {
    const r = REACTIONS['accretion.collide'];
    expect(r.shape).toBe(SHAPE.horizon);
    const D = r.durationMs / 1000;
    const at = (s) => r.curve(s / D, {});
    // It starts from the held horizon, exactly.
    expect(at(0).shapeA).toBeCloseTo(0.34, 6);
    expect(at(0).shapeB).toBeCloseTo(0.5, 6);
    expect(at(0).level).toBe(1);
    // The burst grows out of the core, through the ring (0.39), past the rim, and is gone.
    expect(at(0).shapeC).toBeLessThan(0.05);
    expect(at(0.2).shapeC).toBeGreaterThan(0.39);
    expect(at(EJECT_OUT).shapeC).toBeGreaterThan(1);
    expect(at(EJECT_OUT + 0.05).shapeC).toBe(0);
    // Only after it is out does the horizon collapse.
    expect(at(EJECT_OUT).shapeA).toBeCloseTo(0.34, 6);
    expect(at(D).shapeA).toBe(0);
    expect(at(D).level).toBe(0);
    // Forward all the way, coasting to rest.
    const xs = Array.from({ length: 300 }, (_, i) => i / 299);
    const T = xs.map((x) => r.curve(x, {}).turn);
    T.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(T[i] - 1e-12));
  });

  it('scent_lobes_spiral_in_collide_and_shock_out', () => {
    const r = REACTIONS['scent.collide'];
    expect(r.shape).toBe(SHAPE.accord);
    const D = r.durationMs / 1000;
    const at = (t) => r.curve(t / D, {});
    // Inspiral: the orbit only shrinks, the angle only advances, and faster as they close.
    const pre = Array.from({ length: 200 }, (_, i) => (i / 200) * SCENT_HIT);
    const A = pre.map((t) => at(t).shapeA), B = pre.map((t) => at(t).shapeB);
    A.slice(1).forEach((a, i) => expect(a).toBeLessThanOrEqual(A[i]));
    B.slice(1).forEach((b, i) => expect(b).toBeGreaterThan(B[i]));
    const w = (t) => (at(t + 1e-4).shapeB - at(t - 1e-4).shapeB) / 2e-4;
    expect(w(0.85)).toBeGreaterThan(w(0.2) * 2);
    expect(Math.abs(w(SCENT_HIT + 1e-3) / w(SCENT_HIT - 1e-3) - 1)).toBeLessThan(0.02);  // no jolt at the hit
    // They meet at the hit; the wave clock only runs after it, in real seconds.
    expect(at(SCENT_HIT - 1e-3).shapeA).toBeLessThan(0.01);
    expect(at(SCENT_HIT - 0.01).shapeC).toBe(0);
    expect(at(SCENT_HIT + 0.5).shapeC).toBeCloseTo(0.5, 2);
    // The third wave (0.30 s behind; radius 0.02 + 1.15·(1-(1-te/0.55)³) reaches the rim, 0.95,
    // at te ≈ 0.24 s) is out before the figure starts to fade.
    const third = SCENT_HIT + 0.3 + 0.25;
    expect(at(third).shapeK).toBeGreaterThan(0.95);
    // Forward all the way, resting and silver at the end.
    const xs = Array.from({ length: 300 }, (_, i) => i / 299);
    const T = xs.map((x) => r.curve(x, {}).turn);
    T.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(T[i] - 1e-12));
    expect(at(D).level).toBe(0);
    expect(at(D).shapeK).toBe(0);
  });

  it('sol_snap_bursts_from_the_held_surface_and_coasts_forward', () => {
    const r = REACTIONS['sol.release'];
    expect(r.shape).toBe(SHAPE.sun);
    expect(r.tint).toBeTruthy();                         // the solar palette, not the nav's pale yellow
    const D = r.durationMs / 1000;
    const at = (t) => r.curve(t / D, {});
    expect(at(0).shapeK).toBe(1);                         // takes over the held surface in form
    expect(at(0).shapeA).toBeGreaterThan(0.8);
    expect(at(0.5).shapeA).toBeLessThan(0.05);            // the twist lets go at once
    expect(at(0.3).shapeC).toBeCloseTo(0.3, 2);           // the burst clock, in seconds
    expect(at(D).shapeK).toBe(0);
    expect(at(D).level).toBe(0);
    const xs = Array.from({ length: 300 }, (_, i) => i / 299);
    const T = xs.map((x) => r.curve(x, {}).turn);
    T.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(T[i] - 1e-12));
  });

  it('surveillance_gaze_travels_the_route_headings', () => {
    // SE click: north to DE, then west to US (the plan's example), no source dwell.
    const data = { heads: [[0, -1], [-1, 0]], dwellMs: 0, hopMs: 700, cues: [700], durationMs: 1400 };
    const r = surveillanceTrace(data);
    expect(r.kind).toBe(KICK.watch);
    const D = r.durationMs / 1000;
    const at = (t) => r.curve(t / D, {});
    // Mid first hop: looking south (screen-down), on target.
    expect(at(0.5).gazeY).toBeCloseTo(-0.22, 3);
    expect(Math.abs(at(0.5).gazeX)).toBeLessThan(1e-9);
    // Mid second hop: looking west.
    expect(at(1.2).gazeX).toBeCloseTo(-0.22, 3);
    // It travels, never teleports: per-ms change stays small across each bounce.
    const ts = Array.from({ length: 1600 }, (_, i) => i / 1000);
    const g = ts.map((t) => at(t));
    const step = g.slice(1).map((p, i) => Math.hypot(p.gazeX - g[i].gazeX, p.gazeY - g[i].gazeY));
    expect(Math.max(...step)).toBeLessThan(0.005);
    // A flinch at the interception cue, and back to centre after landing.
    expect(at(0.7).focus).toBeGreaterThan(at(0.45).focus + 0.2);
    expect(Math.hypot(at(D).gazeX, at(D).gazeY)).toBeLessThan(1e-6);
    expect(at(D).level).toBe(0);
  });

  it('surveillance_lock_holds_until_replaced_or_released', () => {
    const r = REACTIONS['surveillance.lock'];
    expect(r.tag).toBe(REACTIONS['surveillance.release'].tag);
    expect(r.durationMs).toBeGreaterThanOrEqual(30000);
    for (const s of [1, 8, 20]) {
      const d = r.curve(s / (r.durationMs / 1000), {});
      expect(d.focus).toBeGreaterThan(0.3);
      expect(d.level).toBeGreaterThan(0.75);
    }
    expect(surveillanceTrace({ heads: [], durationMs: 0 }).tag).toBe(r.tag);   // the trace takes over in family
  });

  it('surveillance_trace_is_built_per_impulse', () => {
    const k = reactionKick({ piece: 'surveillance.trace', kind: KICK.watch, tint: [1, 2, 3], dir: 1, durationMs: 1100,
      data: { heads: [[1, 0]], dwellMs: 450, hopMs: 700, cues: [], durationMs: 1150 } });
    expect(typeof k.curve).toBe('function');
    expect(k.durationMs).toBeGreaterThan(1150);
    expect(reactionKick({ piece: 'surveillance.trace', kind: KICK.watch, tint: null, dir: 1, durationMs: 1100 }).curve).toBeUndefined();
  });

  it('crypto_scrambles_then_snaps_back_on_a_detent', () => {
    const r = REACTIONS['crypto.seal']({ data: null });
    expect(r.shape).toBe(SHAPE.cipher);
    const D = r.durationMs / 1000;
    const at = (t) => r.curve(t / D, {});
    // Scrambled almost at once; the blocks re-deal (the clock crosses integers) while it holds.
    expect(at(0.1).shapeA).toBeGreaterThan(0.95);
    expect(Math.floor(at(CRYPTO_SNAP - 0.01).shapeB) - Math.floor(at(0.1).shapeB)).toBeGreaterThanOrEqual(6);
    // The snap: clean within 50 ms, focused hard, one small forward click.
    expect(at(CRYPTO_SNAP + 0.05).shapeA).toBeLessThan(1e-9);
    expect(at(CRYPTO_SNAP + 0.01).focus).toBeGreaterThan(0.35);
    expect(at(CRYPTO_SNAP - 0.01).focus).toBe(0);
    expect(at(D).turn).toBeCloseTo(0.35, 6);
    const xs = Array.from({ length: 300 }, (_, i) => i / 299);
    const T = xs.map((x) => r.curve(x, {}).turn);
    T.slice(1).forEach((t, i) => expect(t).toBeGreaterThanOrEqual(T[i] - 1e-12));
    expect(at(D).level).toBe(0);
  });

  it('crypto_seal_ends_in_a_burst_out_of_the_core', () => {
    const r = REACTIONS['crypto.seal']({ data: null });
    const D = r.durationMs / 1000, at = (t) => r.curve(t / D, {});
    expect(at(CRYPTO_SNAP - 0.01).shapeB).toBeGreaterThan(0);            // re-dealing
    expect(at(CRYPTO_SNAP + 0.02).shapeB).toBeLessThan(0);               // the burst
    expect(-at(CRYPTO_SNAP + 0.3).shapeB).toBeGreaterThan(-at(CRYPTO_SNAP + 0.05).shapeB);
    expect(-at(CRYPTO_SNAP + 0.5).shapeB).toBeGreaterThan(1.1);          // past the rim
  });

  it('crypto_keygen_settles_chaos_into_a_held_lattice', () => {
    const r = REACTIONS['crypto.keygen'];
    expect(r.tag).toBe(CRYPTO_TAG);
    expect(REACTIONS['crypto.release']).toMatchObject({ release: true, tag: CRYPTO_TAG });
    const at = (s) => r.curve(s / (r.durationMs / 1000), {});
    expect(at(0.05).shapeA).toBeGreaterThan(at(0.05).shapeC);           // still chaotic
    for (const s of [1, 5, 20]) {                                          // held: ordered, lit, humming
      expect(at(s).shapeC).toBeGreaterThan(0.99);
      expect(at(s).shapeA).toBeLessThan(0.01);
      expect(at(s).level).toBeGreaterThan(0.99);
    }
    const f = [0, 0.1, 0.2, 0.3].map((d) => at(5 + d).focus);
    expect(Math.max(...f) - Math.min(...f)).toBeGreaterThan(0.04);        // the rhythm
    expect(at(20).turn).toBeGreaterThan(at(10).turn);
  });

  it('crypto_keyed_seal_locks_the_lattice_on_a_detent', () => {
    const r = REACTIONS['crypto.seal']({ data: { keyed: true } });
    expect(r.durationMs).toBeLessThan(1300);
    const D = r.durationMs / 1000, at = (t) => r.curve(t / D, {});
    expect(at(0).shapeC).toBeCloseTo(1, 6);                                // picks up the held lattice
    expect(at(0).level).toBe(1);
    expect(at(0.12).shapeC).toBe(0);                                        // locked shut
    expect(at(0.12).shapeA).toBe(0);                                        // no chaos on the way out
    expect(at(0.15).shapeB).toBeLessThan(0);                                // the burst
    expect(at(D).level).toBe(0);
    expect(at(D).shapeK).toBe(0);
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
