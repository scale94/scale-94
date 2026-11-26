// mercuryEye.test.js — /MERCURY turns the masthead eye with the visitor's spin, and only that.
import { describe, it, expect, afterEach } from 'vitest';
import { createMercuryEyeFeed, feedMercuryEye, eyeSpinOf, SPIN_MAX, SPIN_FLOOR, ELEMENT_EYE_COLS } from '../mercuryEye';
import { ELEMENTS } from '../elements';
import { eyeDrive, live, release } from '../../components/eyeDrive';

afterEach(() => release());
const now = () => performance.now();
const w = (x, y, z = 0) => ({ x, y, z });

describe('mercuryEye', () => {
  it('signed_spin_follows_the_dominant_screen_axis_and_is_capped', () => {
    expect(eyeSpinOf([0, 3, 0])).toBeCloseTo(-3);       // fling right: clockwise (u_phase runs ccw)
    expect(eyeSpinOf([0, -3, 0])).toBeCloseTo(3);
    expect(eyeSpinOf([2, 0.5, 0])).toBeCloseTo(-Math.hypot(2, 0.5));   // up/down drag: x dominates
    expect(eyeSpinOf([0, 12, 0])).toBe(-SPIN_MAX);
    expect(eyeSpinOf([0, -12, 0])).toBe(SPIN_MAX);
  });

  it('an_untouched_planet_never_drives_the_eye', () => {
    const mem = createMercuryEyeFeed();
    // the ephemeris recapture: the planet turns, no hand anywhere
    expect(feedMercuryEye(w(0, 0.8), false, false, mem)).toBe(false);
    expect(live(eyeDrive.spin, now())).toBe(false);
  });

  it('a_drag_drives_the_spin_and_the_coast_carries_it_until_the_floor', () => {
    const mem = createMercuryEyeFeed();
    expect(feedMercuryEye(w(0, 4), true, false, mem)).toBe(true);
    expect(eyeDrive.spin.v).toBeCloseTo(-4);
    expect(feedMercuryEye(w(0, 1.5), false, false, mem)).toBe(true);   // released: the coast
    expect(eyeDrive.spin.v).toBeCloseTo(-1.5);
    expect(feedMercuryEye(w(0, SPIN_FLOOR / 2), false, false, mem)).toBe(false);
    // the latch closed: a later recapture wobble is not the visitor's
    release();
    expect(feedMercuryEye(w(0, 0.5), false, false, mem)).toBe(false);
    expect(live(eyeDrive.spin, now())).toBe(false);
  });

  it('reduced_motion_drives_nothing', () => {
    const mem = createMercuryEyeFeed();
    expect(feedMercuryEye(w(0, 4), true, true, mem)).toBe(false);
    expect(live(eyeDrive.spin, now())).toBe(false);
  });

  it('every_element_has_a_palette_on_its_own_hue', () => {
    for (const [phase, el] of Object.entries(ELEMENTS)) {
      const n = parseInt(el.color.slice(1), 16);
      expect(ELEMENT_EYE_COLS[phase][0]).toEqual([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    }
  });
});
