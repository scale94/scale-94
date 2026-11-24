// solEye.test.js — /SOL drives the masthead eye live only while a region is held.
import { describe, it, expect, afterEach } from 'vitest';
import { createSolEyeFeed, feedSolEye, SUN_COLS } from '../solEye';
import { eyeDrive, live, release } from '../../components/eyeDrive';
import { SHAPE } from '../../components/observerEyeShader';

afterEach(() => release());
const now = () => performance.now();

describe('solEye', () => {
  it('drives_nothing_without_a_hold', () => {
    const mem = createSolEyeFeed();
    expect(feedSolEye({ held: false, tension01: 0.9, turns: 3 }, 1 / 60, mem)).toBe(false);
    expect(feedSolEye(undefined, 1 / 60, mem)).toBe(false);
    expect(live(eyeDrive.shape, now())).toBe(false);
    expect(live(eyeDrive.palette, now())).toBe(false);
  });

  it('holding_makes_the_eye_the_sun_with_its_tension', () => {
    const mem = createSolEyeFeed();
    feedSolEye({ held: true, tension01: 0.4, turns: 0 }, 1 / 60, mem);
    expect(live(eyeDrive.shape, now())).toBe(true);
    expect(eyeDrive.shape).toMatchObject({ id: SHAPE.sun, k: 1, a: 0.4 });
    expect(Array.from(eyeDrive.palette.cols[0])).toEqual(SUN_COLS[0]);
  });

  it('spin_follows_the_stir_both_ways_and_is_clamped', () => {
    const mem = createSolEyeFeed();
    let turns = 0;
    for (let i = 0; i < 60; i++) { turns += 0.5 / 60; feedSolEye({ held: true, tension01: 0.2, turns }, 1 / 60, mem); }
    expect(eyeDrive.spin.v).toBeGreaterThan(1.5);                    // 0.5 turn/s clockwise -> ~1.9 rad/s
    for (let i = 0; i < 60; i++) { turns -= 0.5 / 60; feedSolEye({ held: true, tension01: 0.2, turns }, 1 / 60, mem); }
    expect(eyeDrive.spin.v).toBeLessThan(-1.5);
    for (let i = 0; i < 60; i++) { turns += 20 / 60; feedSolEye({ held: true, tension01: 0.2, turns }, 1 / 60, mem); }
    expect(eyeDrive.spin.v).toBeLessThanOrEqual(9);
  });

  it('a_new_hold_starts_from_rest', () => {
    const mem = createSolEyeFeed();
    feedSolEye({ held: true, tension01: 0, turns: 5 }, 1 / 60, mem);
    feedSolEye({ held: false }, 1 / 60, mem);
    feedSolEye({ held: true, tension01: 0, turns: 40 }, 1 / 60, mem);   // a different region: no jump
    expect(eyeDrive.spin.v).toBe(0);
  });
});
