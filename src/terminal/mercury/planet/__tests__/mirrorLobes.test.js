// src/terminal/mercury/planet/__tests__/mirrorLobes.test.js
import { describe, it, expect } from 'vitest';
import { lobe, softShoulder } from '../mirrorLobes';
import { ROUGH_LIQUID, ROUGH_BOIL, SUN_SHOULDER, PLANET_TUNE } from '../planetLook';

// The Sun seen from Mercury at mean distance: 0.2666° / 0.387 AU ≈ 0.689°.
const SUN_SIN_R = Math.sin((0.2666 / 0.387) * Math.PI / 180);
// Display-linear Sun term at irradiance 1 (mean distance), angle a (rad) off the mirror direction.
const sunAt = (a, rough) =>
  softShoulder(PLANET_TUNE.sunGlint * PLANET_TUNE.exposure * lobe(Math.cos(a), SUN_SIN_R, rough), SUN_SHOULDER);

describe('mirrorLobes', () => {
  it('lobe conserves the disc energy: peak × width² is roughness-independent', () => {
    const e = (r) => lobe(1, 0.3, r) * (0.3 ** 2 + (r * r) ** 2);
    expect(e(0.14)).toBeCloseTo(0.09, 9);
    expect(e(0.4)).toBeCloseTo(0.09, 9);
  });

  it('softShoulder is ~identity when small, never exceeds k, and is monotone', () => {
    expect(softShoulder(0.01, 3)).toBeCloseTo(0.01, 4);
    expect(softShoulder(1e6, 3)).toBeLessThanOrEqual(3);
    expect(softShoulder(2, 3)).toBeLessThan(softShoulder(3, 3));
  });

  it('boiling Sun is a bright broad sheen, not a grey smudge', () => {
    expect(sunAt(0, ROUGH_BOIL)).toBeGreaterThan(0.9);
    expect(sunAt(0.1, ROUGH_BOIL)).toBeGreaterThan(0.5);
  });

  it('cooled liquid Sun is a saturated pinpoint', () => {
    expect(sunAt(0, ROUGH_LIQUID)).toBeGreaterThan(0.95 * SUN_SHOULDER);
    expect(sunAt(0.1, ROUGH_LIQUID)).toBeLessThan(0.05);
  });
});
