// Gas filaments (mirror-sky spec §3, Option A): two roles in one draw — fog (the old sprite, passed through)
// and filament capsules (width decoupled from length, jittered). JS replicas mirror the GLSL lines pinned below.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  GAS_STREAK_VS, GAS_STREAK_FS, STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, FIRE_EMBER_SHARE,
  GAS_PX_FLOOR, GAS_Z_REF, MASK_EVOLVE, gasCounts, gasRoles, GAS_TUNE_UNIFORMS, writeGasTune,
} from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';

// Replica of gasSprite(): role 0 passes the size through; role 1 = floored width (CSS px × dpr) + jittered,
// capped length. sp is the buffer-px speed, so it already carries the dpr.
const sprite = (role, size, sp, aspect = FIL_ASPECT, jit = 0.5, gain = PLANET_TUNE.streakGain, dpr = 1) => {
  if (role < 0.5) return { total: size, w: size };
  const w = Math.max(size, GAS_PX_FLOOR * dpr);
  const L = Math.min(sp * gain, Math.max(aspect - 1, 0) * w) * (1 + FIL_JITTER * (2 * jit - 1));
  return { total: w + L, w };
};
// Replica of gasFilWidth() (the floor is applied in gasSprite).
const filWidth = (depth, s, bite = 1, dpr = 1) => PLANET_TUNE.filWidth * dpr * (GAS_Z_REF / Math.max(depth, 0.5)) * (0.75 + 0.5 * s) * bite;

describe('gasStreak constants', () => {
  it('filament cap ~8x ±30 %, fire embers ≤ 1.5x, no sub-pixel filaments; the old 3x cap is gone', () => {
    expect(FIL_ASPECT).toBe(8);
    expect(FIL_JITTER).toBe(0.3);
    expect(FIRE_EMBER_STRETCH).toBe(1.5);
    expect(FIRE_EMBER_GAIN).toBe(20);
    expect(FIRE_EMBER_SHARE).toBe(0.15);
    expect(GAS_PX_FLOOR).toBe(1.5);
    expect(GAS_Z_REF).toBe(4.43);
    for (const [n, v] of Object.entries({ STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, GAS_PX_FLOOR, GAS_Z_REF, MASK_EVOLVE })) {
      expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(GAS_STREAK_VS).not.toContain('STRETCH_MAX');
    for (const u of ['uPhaseRate', 'uStreakGain', 'uFilWidth', 'uFilAlpha', 'uFogAlpha', 'uMaskFreq', 'uMaskSharp', 'uMaskDepth', 'uDpr']) {
      expect(GAS_STREAK_VS).toContain(`uniform float ${u};`);
    }
    expect(GAS_STREAK_VS).not.toMatch(/uGasSize|uGasAlpha/);
  });
});

describe('gas roles (spec §3b, §3e)', () => {
  it('fluid/air/earth: fog = the old (base) count on every tier; the multiplier feeds the filaments', () => {
    expect(gasCounts(1200, 3)).toEqual({ n: 3600, fog: 1200 });  // full, active
    expect(gasCounts(600, 3)).toEqual({ n: 1800, fog: 600 });    // phone
    expect(gasCounts(600, 2)).toEqual({ n: 1200, fog: 600 });    // phone after the gate
    expect(gasCounts(1200, 1)).toEqual({ n: 1200, fog: 1200 });  // lite: the old look, no filaments
    expect(gasCounts(300, 1)).toEqual({ n: 300, fog: 300 });     // ghost: the old look
  });

  it('fire: body = the old body count, embers = the old ember count x the multiplier; N = base at x1', () => {
    expect(gasCounts(1200, 3, true)).toEqual({ n: 1560, fog: 1020 }); // 540 embers = 3 x the old 180
    expect(gasCounts(600, 3, true)).toEqual({ n: 780, fog: 510 });
    expect(gasCounts(600, 2, true)).toEqual({ n: 690, fog: 510 });
    expect(gasCounts(1200, 1, true)).toEqual({ n: 1200, fog: 1020 }); // lite = the old 85/15 split
    expect(gasCounts(300, 1, true)).toEqual({ n: 300, fog: 255 });    // ghost
    expect(gasCounts(150, 1, true)).toEqual({ n: 150, fog: 127 });    // round(22.5) = 23 embers; N stays 150
  });

  it('gasRoles: exact fog count, deterministic, evenly spread, 0/1 floats', () => {
    const r = gasRoles(3600, 1200);
    expect(r).toBeInstanceOf(Float32Array);
    expect(r.length).toBe(3600);
    expect(r.filter((x) => x === 0).length).toBe(1200);
    expect(r.every((x) => x === 0 || x === 1)).toBe(true);
    expect(gasRoles(3600, 1200)).toEqual(r);
    for (let i = 0; i + 30 <= 3600; i += 30) {
      const fog = r.subarray(i, i + 30).filter((x) => x === 0).length;
      expect(Math.abs(fog - 10)).toBeLessThanOrEqual(1);
    }
    expect(gasRoles(10, 0).every((x) => x === 1)).toBe(true);
    expect(gasRoles(10, 10).every((x) => x === 0)).toBe(true);
    expect(gasRoles(0, 0).length).toBe(0);
  });
});

describe('gasSprite (spec §3c)', () => {
  it('fog passes the old size straight through: round, no floor, no stretch', () => {
    expect(GAS_STREAK_VS).toContain('float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {');
    expect(GAS_STREAK_VS).toMatch(/if \(role < 0\.5\) \{\s*vStreakDir = vec2\(1\.0, 0\.0\);\s*vStreakCap = vec2\(0\.0, 0\.5\);\s*return size;\s*\}/);
    expect(sprite(0, 0.4, 999).total).toBe(0.4);
    expect(sprite(0, 237, 999).total).toBe(237);
  });

  it('filament: floored width; length = speed x shutter, capped at (aspect - 1) x width, jitter on both', () => {
    expect(GAS_STREAK_VS).toContain('float w = max(size, GAS_PX_FLOOR * uDpr);');
    expect(GAS_STREAK_VS).toContain('v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;');
    expect(GAS_STREAK_VS).toContain('float L = min(sp * uStreakGain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));');
    expect(GAS_STREAK_VS).toContain('vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);'); // point coords: y down
    expect(GAS_STREAK_VS).toContain('vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);');
    expect(sprite(1, 0.5, 0).total).toBe(GAS_PX_FLOOR);                 // calm or sub-pixel → a 1.5 px round dot
    const f = sprite(1, 2.2, 355);                                      // spec §3g: fluid mean speed, 2.2 px core
    expect(f.total / f.w).toBeGreaterThan(5);
    expect(f.total / f.w).toBeLessThan(7);
    expect(sprite(1, 2.2, 5000).total / 2.2).toBeCloseTo(FIL_ASPECT, 9);           // capped, jitter 0.5
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 0).total / 2.2).toBeCloseTo(1 + 7 * 0.7, 9);
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 1).total / 2.2).toBeCloseTo(1 + 7 * 1.3, 9);
    expect(sprite(1, 2.2, 5000, FIRE_EMBER_STRETCH, 0.5).total / 2.2).toBeCloseTo(1.5, 9); // embers pass jit 0.5
  });

  it('DPR (author ruling): the width and the 1.5 CSS-px floor scale with dpr; the length scales via the buffer-px speed, so the aspect is the same', () => {
    expect(sprite(1, 0.5, 0, FIL_ASPECT, 0.5, PLANET_TUNE.streakGain, 2).total).toBe(3);   // floor = 1.5 CSS px = 3 buffer px
    expect(filWidth(GAS_Z_REF, 0.5, 1, 2)).toBeCloseTo(2 * PLANET_TUNE.filWidth, 12);
    const one = sprite(1, filWidth(GAS_Z_REF, 0.5, 1, 1), 355, FIL_ASPECT, 0.3, PLANET_TUNE.streakGain, 1);
    const two = sprite(1, filWidth(GAS_Z_REF, 0.5, 1, 2), 710, FIL_ASPECT, 0.3, PLANET_TUNE.streakGain, 2);
    expect(two.total).toBeCloseTo(2 * one.total, 9);
    expect(two.total / two.w).toBeCloseTo(one.total / one.w, 9);
  });

  it('filament width: the knob is px at GAS_Z_REF, ±25 % by a size label, perspective, condensation bite', () => {
    expect(GAS_STREAK_VS).toContain('float gasFilWidth(float depth, float s01, float bite) {');
    expect(GAS_STREAK_VS).toContain('return uFilWidth * uDpr * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;');
    expect(filWidth(GAS_Z_REF, 0.5)).toBeCloseTo(PLANET_TUNE.filWidth, 12);
    // spec §3g: fluid depths 3.7..5.2 → a 1.5..3.3 px core after the floor
    expect(Math.max(filWidth(5.2, 0), GAS_PX_FLOOR)).toBe(GAS_PX_FLOOR);
    expect(filWidth(3.7, 1)).toBeLessThan(3.4);
  });

  it('per-particle jitter hash', () => {
    expect(GAS_STREAK_VS).toContain('float gasHash(float a, float b) {');
    expect(GAS_STREAK_VS).toContain('return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);');
  });
});

describe('lane mask + role alpha (spec §3d)', () => {
  it('ridged noise in the flow labels, evolving; only filaments are carved', () => {
    expect(GAS_STREAK_VS).toContain('float gasLane(vec3 laneCoord, float t) {');
    expect(GAS_STREAK_VS).toContain('snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE))');
    expect(GAS_STREAK_VS).toContain('return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);');
    expect(GAS_STREAK_VS).toMatch(/float gasAlpha\(float role, vec3 laneCoord, float t\) \{\s*if \(role < 0\.5\) return uFogAlpha;\s*return gasLane\(laneCoord, t\) \* uFilAlpha;\s*\}/);
    expect(GAS_STREAK_VS).toMatch(/float gasRoleAlpha\(float role\) \{\s*return role < 0\.5 \? uFogAlpha : uFilAlpha;\s*\}/);
  });
});

describe('FS + varyings', () => {
  it('capsule distance equals the old round radius when the streak is 0', () => {
    expect(GAS_STREAK_FS).toContain('float gasStreakDist(vec2 pc) {');
    expect(GAS_STREAK_FS).toContain('float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('return length(q - vStreakDir * a) / vStreakCap.y;');
    const dist = (pc, dir, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], -cap[0]), cap[0]);
      return Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a) / cap[1];
    };
    expect(dist([0.8, 0.3], [1, 0], [0, 0.5])).toBeCloseTo(2 * Math.hypot(0.3, 0.2), 12); // the fog role
    // an 8x capsule along a diagonal: its end cap touches the rim on the axis, inside the sprite square
    const w = 1, L = 7, total = w + L, d = [Math.SQRT1_2, Math.SQRT1_2];
    const end = 0.5 * total / total; // centre → tip along the axis = (L/2 + w/2) / total = 0.5
    expect(dist([0.5 + d[0] * end, 0.5 + d[1] * end], d, [0.5 * L / total, 0.5 * w / total])).toBeCloseTo(1, 12);
  });

  it('every varying is declared on both sides', () => {
    for (const v of ['varying vec2 vStreakDir;', 'varying vec2 vStreakCap;', 'varying float vLane;']) {
      expect(GAS_STREAK_VS).toContain(v);
      expect(GAS_STREAK_FS).toContain(v);
    }
  });
});

describe('tune knobs (spec §3g)', () => {
  it('defaults are derived from the px targets; the old gasSize/gasAlpha are gone', () => {
    expect(PLANET_TUNE).toMatchObject({ filWidth: 2.2, streakGain: 0.03, filAlpha: 1, fogAlpha: 0.9, maskFreq: 2.5, maskSharp: 3, maskDepth: 0.7 });
    expect(PLANET_TUNE.fogAlpha).toBeLessThan(1);
    expect('gasSize' in PLANET_TUNE).toBe(false);
    expect('gasAlpha' in PLANET_TUNE).toBe(false);
  });

  it('copied per frame without allocation, with the renderer pixel ratio', () => {
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(Object.keys(u).sort()).toEqual(['uDpr', 'uFilAlpha', 'uFilWidth', 'uFogAlpha', 'uMaskDepth', 'uMaskFreq', 'uMaskSharp', 'uStreakGain']);
    expect(u.uFilWidth.value).toBe(PLANET_TUNE.filWidth);
    expect(u.uDpr.value).toBe(1);
    const objs = Object.values(u);
    writeGasTune(u, { ...PLANET_TUNE, fogAlpha: 0.5 }, 2);
    expect(u.uFogAlpha.value).toBe(0.5);
    expect(u.uDpr.value).toBe(2);
    expect(Object.values(u)).toEqual(objs);
  });
});

describe('gasOut: premultiplied one-draw output (Task 7c)', () => {
  it('FS defines gasOut + vRole + uPremult; fog = (color*a, a), filament = (color*a, 0.0) with dithered colour; VS writes vRole', () => {
    expect(GAS_STREAK_FS).toContain('varying float vRole;');
    expect(GAS_STREAK_FS).toContain('uniform float uPremult;');
    expect(GAS_STREAK_FS).toContain('vec4 gasOut(vec3 color, float a, float dither)');
    expect(GAS_STREAK_FS).toContain('if (uPremult < 0.5) return vec4(color, a + dither);');
    expect(GAS_STREAK_FS).toContain('if (vRole < 0.5) return vec4(color * (a + dither), a + dither);');
    expect(GAS_STREAK_FS).toContain('return vec4(color * a + dither, 0.0);');
    expect(GAS_STREAK_VS).toContain('varying float vRole;');
    expect(GAS_STREAK_VS).toContain('vRole = role;');
  });
});
