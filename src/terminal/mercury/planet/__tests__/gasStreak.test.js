// Gas filaments (mirror-sky spec §3): velocity-aligned capsules + the lane mask.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  GAS_STREAK_VS, GAS_STREAK_FS, STREAK_DT, STRETCH_MAX, FIRE_EMBER_STRETCH, GAS_PX_FLOOR, MASK_EVOLVE,
  GAS_TUNE_UNIFORMS, writeGasTune,
} from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';

describe('gasStreak', () => {
  it('constants: stretch ≤ 3, fire embers ≤ 1.5, no sub-pixel sprites', () => {
    expect(STRETCH_MAX).toBe(3);
    expect(FIRE_EMBER_STRETCH).toBe(1.5);
    expect(GAS_PX_FLOOR).toBe(1.5);
    for (const [n, v] of Object.entries({ STREAK_DT, STRETCH_MAX, FIRE_EMBER_STRETCH, GAS_PX_FLOOR, MASK_EVOLVE })) {
      expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    }
  });

  it('the streak is the on-screen velocity × the shutter, capped at (stretchMax − 1) × size', () => {
    expect(GAS_STREAK_VS).toContain('float gasStreak(vec4 clipNow, vec4 clipPrev, float size, float stretchMax) {');
    expect(GAS_STREAK_VS).toContain('v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;');
    expect(GAS_STREAK_VS).toContain('float L = min(sp * uStreakGain, max(stretchMax - 1.0, 0.0) * size);');
    expect(GAS_STREAK_VS).toContain('vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);'); // point coords: y down
    expect(GAS_STREAK_VS).toContain('size = max(size, GAS_PX_FLOOR);');
  });

  it('the lane mask is ridged noise in the flow\'s labels, evolving in time', () => {
    expect(GAS_STREAK_VS).toContain('float gasLane(vec3 laneCoord, float t) {');
    expect(GAS_STREAK_VS).toContain('snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE))');
    expect(GAS_STREAK_VS).toContain('return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);');
  });

  it('FS: capsule distance, equal to the old round radius when the streak is 0', () => {
    expect(GAS_STREAK_FS).toContain('float gasStreakDist(vec2 pc) {');
    expect(GAS_STREAK_FS).toContain('float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('return length(q - vStreakDir * a) / vStreakCap.y;');
    // JS replica: L = 0 → cap (0, 0.5) → distance = 2·|pc − 0.5|, the old `length(gl_PointCoord - 0.5) * 2.0`
    const dist = (pc, dir, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], -cap[0]), cap[0]);
      return Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a) / cap[1];
    };
    expect(dist([0.8, 0.3], [1, 0], [0, 0.5])).toBeCloseTo(2 * Math.hypot(0.3, 0.2), 12);
    // a 3x capsule along x: its end cap at the sprite edge is exactly on the rim
    const total = 3, L = 2, size = 1;
    expect(dist([1, 0.5], [1, 0], [0.5 * L / total, 0.5 * size / total])).toBeCloseTo(1, 12);
  });

  it('every varying is declared on both sides', () => {
    for (const v of ['varying vec2 vStreakDir;', 'varying vec2 vStreakCap;', 'varying float vLane;']) {
      expect(GAS_STREAK_VS).toContain(v);
      expect(GAS_STREAK_FS).toContain(v);
    }
  });

  it('tune knobs: defaults live in PLANET_TUNE, copied per frame without allocation', () => {
    for (const k of ['streakGain', 'gasSize', 'gasAlpha', 'maskFreq', 'maskSharp', 'maskDepth']) expect(typeof PLANET_TUNE[k]).toBe('number');
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(u.uStreakGain.value).toBe(PLANET_TUNE.streakGain);
    const objs = Object.values(u);
    writeGasTune(u, { ...PLANET_TUNE, maskDepth: 0.25 });
    expect(u.uMaskDepth.value).toBe(0.25);
    expect(Object.values(u)).toEqual(objs);
  });
});
