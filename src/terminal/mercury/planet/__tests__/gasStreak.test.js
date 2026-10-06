// Gas filaments (mirror-sky spec §3, Option A): two roles in one draw — fog (the old sprite, passed through)
// and filament capsules (width decoupled from length, jittered). JS replicas mirror the GLSL lines pinned below.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  GAS_STREAK_VS, GAS_STREAK_FS, STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, FIRE_EMBER_SHARE,
  GAS_PX_FLOOR, GAS_Z_REF, MASK_EVOLVE, FIL_GAP_CLOSE, FIL_GAP_ASPECT, FIL_TAPER, gasCounts, gasPointMax, GAS_POINT_MAX_UNKNOWN, gasRoles, GAS_TUNE_UNIFORMS, writeGasTune,
  gasThreads, gasStratified, gasPaceMatch, THREAD_ALONG_JITTER, THREAD_CROSS_CLIP, THREAD_WEIGHT_FLOOR, GAS_MASK_LOOP, GAS_MASK_LANE_GAP,
} from '../gasStreak';
import { mulberry32 } from '../prng';
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
  it('filament cap 16x ±30 % (Task 7d threads), fire embers ≤ 1.5x, no sub-pixel filaments; the old 3x/8x caps are gone', () => {
    expect(FIL_ASPECT).toBe(16);
    expect(FIL_JITTER).toBe(0.3);
    expect(FIRE_EMBER_STRETCH).toBe(1.5);
    expect(FIRE_EMBER_GAIN).toBe(20);
    expect(FIRE_EMBER_SHARE).toBe(0.15);
    expect(GAS_PX_FLOOR).toBe(1.5);
    expect(GAS_Z_REF).toBe(4.43);
    for (const [n, v] of Object.entries({ STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, GAS_PX_FLOOR, GAS_Z_REF, MASK_EVOLVE, GAS_MASK_LOOP, GAS_MASK_LANE_GAP })) {
      expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(GAS_STREAK_VS).not.toContain('STRETCH_MAX');
    for (const u of ['uAirFilGain', 'uPhaseRate', 'uStreakGain', 'uFilWidth', 'uFilAlpha', 'uFogAlpha', 'uMaskFreq', 'uMaskSharp', 'uMaskDepth', 'uDpr']) {
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
    expect(GAS_STREAK_VS).toMatch(/if \(role < 0\.5\) \{\s*vStreakDir = vec2\(1\.0, 0\.0\);\s*vStreakDir2 = vStreakDir;\s*vStreakCap = vec2\(0\.0, 0\.5\);\s*return size;\s*\}/);
    expect(sprite(0, 0.4, 999).total).toBe(0.4);
    expect(sprite(0, 237, 999).total).toBe(237);
  });

  it('filament: floored width; length = speed x shutter, capped at (aspect - 1) x width, jitter on both', () => {
    expect(GAS_STREAK_VS).toContain('float w = max(size, GAS_PX_FLOOR * uDpr);');
    expect(GAS_STREAK_VS).toContain('v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;');
    expect(GAS_STREAK_VS).toContain('float L = min(sp * gain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));');
    expect(GAS_STREAK_VS).toContain('vec2 dir = tl > 1e-3 ? tng / tl : (sp > 1e-3 ? v / sp : vec2(1.0, 0.0));');
    expect(GAS_STREAK_VS).toContain('vStreakDir = vec2(dirA.x, -dirA.y); // point coords: y down');
    expect(GAS_STREAK_VS).toContain('vec2 dirA = tl > 1e-3 && length(dA) > 1e-3 ? normalize(dA) : dir;');
    expect(GAS_STREAK_VS).toContain('vec2 dirB = tl > 1e-3 && length(dB) > 1e-3 ? normalize(dB) : dir;');
    expect(GAS_STREAK_VS).toContain('vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);');
    expect(sprite(1, 0.5, 0).total).toBe(GAS_PX_FLOOR);                 // calm or sub-pixel → a 1.5 px round dot
    const f = sprite(1, 2.2, 355);                                      // spec §3g: fluid mean speed, 2.2 px core; shutter 0.05 → ~9x
    expect(f.total / f.w).toBeGreaterThan(8);
    expect(f.total / f.w).toBeLessThan(10.5);
    expect(sprite(1, 2.2, 5000).total / 2.2).toBeCloseTo(FIL_ASPECT, 9);           // capped, jitter 0.5
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 0).total / 2.2).toBeCloseTo(1 + 15 * 0.7, 9);
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 1).total / 2.2).toBeCloseTo(1 + 15 * 1.3, 9);
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

describe('lane mask along the threads (Task 7d)', () => {
  it('gasThreadCoord: lane id offsets the noise, the along-lane label runs a seamless loop; no cross-lane jitter in it', () => {
    expect(GAS_STREAK_VS).toContain('vec3 gasThreadCoord(float lane, float along) {');
    expect(GAS_STREAK_VS).toContain('float a = along * 6.283185307;');
    expect(GAS_STREAK_VS).toContain('return vec3(cos(a) * GAS_MASK_LOOP + lane * GAS_MASK_LANE_GAP, sin(a) * GAS_MASK_LOOP, 0.0);');
    // lanes sit in disjoint stretches of noise space (loop diameter + a noise feature < the gap, at the default freq)
    expect(GAS_MASK_LANE_GAP * PLANET_TUNE.maskFreq).toBeGreaterThan(2 * GAS_MASK_LOOP * PLANET_TUNE.maskFreq + 1);
  });
});

describe('gasThreads: filament lane placement (Task 7d)', () => {
  const build = (n = 2400, lanes = 12, seed = 7) => gasThreads(n, lanes, mulberry32(seed));
  const gaps = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const g = s.map((x, i) => (i + 1 < s.length ? s[i + 1] - x : s[0] + 1 - x));
    return g;
  };

  it('deterministic for the same seed, different for another', () => {
    const a = build(), b = build();
    expect(a.lane).toEqual(b.lane);
    expect(a.along).toEqual(b.along);
    expect(a.cross).toEqual(b.cross);
    expect(build(2400, 12, 8).along).not.toEqual(a.along);
  });

  it('every filament gets an integer lane in [0, lanes); counts sum to n', () => {
    const t = build();
    expect(t.lane).toBeInstanceOf(Float32Array);
    expect(t.lane.length).toBe(2400);
    expect(t.lane.every((k) => Number.isInteger(k) && k >= 0 && k < 12)).toBe(true);
    expect(t.counts.reduce((s, c) => s + c, 0)).toBe(2400);
    for (let k = 0; k < 12; k++) expect(t.lane.filter((x) => x === k).length).toBe(t.counts[k]);
  });

  it('lane weights are uneven (dense and faint threads) but every lane is non-empty', () => {
    for (const seed of [1, 2, 3, 7, 42, 0x7d1f]) {
      for (const [n, lanes] of [[2400, 12], [1200, 14], [600, 12], [30, 14]]) {
        const { counts } = gasThreads(n, lanes, mulberry32(seed));
        expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
        if (n >= 600) expect(Math.max(...counts) / Math.min(...counts)).toBeGreaterThan(1.8);
      }
    }
    expect(THREAD_WEIGHT_FLOOR).toBeGreaterThan(0);
  });

  it('within a lane the along positions are stratified: every gap ≤ 3x the mean spacing (uniform random would break this)', () => {
    const t = build();
    expect(THREAD_ALONG_JITTER).toBeLessThan(1);
    for (let k = 0; k < 12; k++) {
      const xs = Array.from(t.along).filter((_, i) => t.lane[i] === k);
      expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
      if (xs.length < 2) continue;
      expect(Math.max(...gaps(xs))).toBeLessThanOrEqual(3 / xs.length);
    }
    // control: the same counts drawn uniformly do break the bound somewhere
    const r = mulberry32(99);
    const worst = Math.max(...t.counts.map((n) => Math.max(...gaps(Array.from({ length: n }, r))) * n));
    expect(worst).toBeGreaterThan(3);
  });

  it('per-lane grid offsets (construction): every lane starts its stratified grid elsewhere, ≥ 0.5/L apart', () => {
    for (const seed of [1, 7, 42]) {
      for (const L of [6, 8, 12]) {
        const t = gasThreads(1200, L, mulberry32(seed));
        expect(t.starts.length).toBe(L);
        for (let a = 0; a < L; a++) {
          for (let b = a + 1; b < L; b++) {
            const d = Math.abs(t.starts[a] - t.starts[b]);
            expect(Math.min(d, 1 - d)).toBeGreaterThanOrEqual(0.5 / L - 1e-6);
          }
        }
        // each lane's first slot sits at its own start (the grid is anchored there)
        for (let k = 0; k < L; k++) {
          const xs = Array.from(t.along).filter((_, i) => t.lane[i] === k);
          const n = xs.length;
          const first = xs[0];
          const d = Math.abs(first - ((t.starts[k] + 0.5 / n) % 1));
          expect(Math.min(d, 1 - d)).toBeLessThanOrEqual(0.5 * THREAD_ALONG_JITTER / n + 1e-6);
        }
      }
    }
  });

  it('gasPaceMatch (Task 7e): reorders the values so the count-weighted mean is as close to 0.5 as any permutation; same multiset', () => {
    const wmean = (v, c) => v.reduce((s, x, k) => s + x * c[k], 0) / c.reduce((s, x) => s + x, 0);
    for (const seed of [1, 2, 3, 7, 42]) {
      for (const L of [6, 8]) {
        const r = mulberry32(seed);
        const vals = gasStratified(L, r);
        const { counts } = gasThreads(2400, L, r);
        const m = gasPaceMatch(vals, counts);
        expect(Array.from(m).sort()).toEqual(Array.from(vals).sort());
        expect(Math.abs(wmean(m, counts) - 0.5)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(wmean(m, counts) - 0.5)).toBeLessThanOrEqual(Math.abs(wmean(vals, counts) - 0.5) + 1e-12);
      }
    }
    // groups (Task 7e fix 2): each group's weighted mean is balanced on its own (air: lower 0 / upper 1), -1 = left
    // out (air: the ion lane); the objective is the sum of |mean_g - 0.5|
    for (const seed of [1, 2, 3, 9]) {
      const r = mulberry32(seed);
      const vals = gasStratified(8, r);
      const { counts } = gasThreads(2400, 8, r);
      const groups = [0, 1, 1, -1, 0, 1, 0, 1];
      const m = gasPaceMatch(vals, counts, groups);
      for (const g of [0, 1]) {
        const gc = counts.map((c, k) => (groups[k] === g ? c : 0));
        expect(Math.abs(wmean(m, gc) - 0.5)).toBeLessThanOrEqual(0.05);
      }
      expect(Array.from(m).sort()).toEqual(Array.from(vals).sort());
    }
    // deterministic, and not just sorted (irregular)
    const v = gasStratified(8, mulberry32(5)), c = gasThreads(2400, 8, mulberry32(6)).counts;
    expect(gasPaceMatch(v, c)).toEqual(gasPaceMatch(v, c));
  });

  it('gasStratified: one value per stratum (a permutation), irregular inside it, mean within 0.5/L of 0.5', () => {
    for (const seed of [1, 2, 3]) {
      for (const L of [6, 8, 12]) {
        const s = gasStratified(L, mulberry32(seed));
        expect(s.length).toBe(L);
        expect(new Set(Array.from(s, (x) => Math.floor(x * L))).size).toBe(L);
        const m = s.reduce((a, x) => a + x, 0) / L;
        expect(Math.abs(m - 0.5)).toBeLessThanOrEqual(0.5 / L);
      }
    }
    expect(Array.from(gasStratified(8, mulberry32(1)))).not.toEqual([...Array(8).keys()].map((k) => (k + 0.5) / 8));
  });

  it('cross-lane jitter: a clipped unit normal (|z| ≤ THREAD_CROSS_CLIP, sd ~1), so a thread is a few px wide', () => {
    const { cross } = build(4000, 12, 3);
    expect(Math.max(...cross.map(Math.abs))).toBeLessThanOrEqual(THREAD_CROSS_CLIP);
    const m = cross.reduce((s, x) => s + x, 0) / cross.length;
    const sd = Math.sqrt(cross.reduce((s, x) => s + (x - m) ** 2, 0) / cross.length);
    expect(Math.abs(m)).toBeLessThan(0.1);
    expect(sd).toBeGreaterThan(0.85);
    expect(sd).toBeLessThan(1.05);
  });

  it('edges: no filaments → empty; fewer filaments than lanes → one per lane, the rest empty', () => {
    const z = gasThreads(0, 12, mulberry32(1));
    expect(z.lane.length).toBe(0);
    expect(Array.from(z.counts)).toEqual(new Array(12).fill(0));
    const few = gasThreads(5, 12, mulberry32(1));
    expect(few.counts.reduce((s, c) => s + c, 0)).toBe(5);
    expect(Math.max(...few.counts)).toBe(1);
  });
});

describe('gap-closing filament dashes (Task 7f)', () => {
  it('thread sprite (7f fix): path-secant direction, gap part at any speed (frozen threads in calm), point-size clamp; gasSprite = no thread', () => {
    expect(FIL_GAP_CLOSE).toBe(1.3);
    expect(FIL_GAP_ASPECT).toBe(24);
    for (const [n, v] of Object.entries({ FIL_GAP_CLOSE, FIL_GAP_ASPECT })) expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    expect(GAS_STREAK_VS).toContain('float gasSpriteThread(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit) {');
    expect(GAS_STREAK_VS).toContain('return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, uStreakGain);'); // Task 8b: via the core
    expect(GAS_STREAK_VS).toContain('vec2 tng = pAhead - pBack;');
    expect(GAS_STREAK_VS).toContain('float gapPx = max(length(pNow - pBack), length(pAhead - pNow));');
    expect(GAS_STREAK_VS).toContain('L = max(L, min(FIL_GAP_CLOSE * gapPx - w, (FIL_GAP_ASPECT - 1.0) * w));');
    expect(GAS_STREAK_VS).toContain('L = min(L, max(uPointMax - w, 0.0));');
    expect(GAS_STREAK_VS).toContain('uniform float uPointMax;');
    expect(GAS_STREAK_VS).toContain('return clip.w > 1e-4 ? clip.xy / clip.w * 0.5 * uViewportPx : vec2(0.0);');
    expect(GAS_STREAK_VS).not.toMatch(/if \(sp > 1e-3\) L = /); // no abrupt speed switch
    expect(GAS_STREAK_VS).not.toContain('gasSpriteGap');
  });

  it('end taper: the outer FIL_TAPER = 1 - 1/FIL_GAP_CLOSE of a filament dash fades (smoothstep, ordered edges); fog untouched', () => {
    expect(FIL_TAPER).toBeCloseTo(1 - 1 / 1.3, 12);
    expect(GAS_STREAK_FS).toContain(`const float FIL_TAPER = ${glf(FIL_TAPER)};`);
    expect(GAS_STREAK_FS).toMatch(/float gasTaper\(vec2 pc\) \{\s*if \(vRole < 0\.5\) return 1\.0;/);
    expect(GAS_STREAK_FS).toMatch(/float s = abs\(da <= db \? sa : sb\);\s*return 1\.0 - smoothstep\(0\.5 - FIL_TAPER, 0\.5, s\);\s*\}/);
    // two gap-closed dashes (length D = FIL_GAP_CLOSE x spacing) overlap by exactly their taper: the sum is flat
    const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
    const taper = (s) => 1 - ss(0.5 - FIL_TAPER, 0.5, Math.abs(s));
    const gap = 10, D = FIL_GAP_CLOSE * gap;
    for (let u = gap - D / 2; u <= D / 2; u += 0.05) {
      const a = Math.abs(u / D) <= 0.5 ? taper(u / D) : 0, b = Math.abs((u - gap) / D) <= 0.5 ? taper((u - gap) / D) : 0;
      expect(a + b).toBeCloseTo(1, 9);
    }
  });

  it('gasThreads gap: the larger along distance to the two lane neighbours, within [(1 - J)/n, (1 + J)/n]', () => {
    for (const J of [0.3, THREAD_ALONG_JITTER]) {
      const t = gasThreads(2400, 8, mulberry32(11), J);
      expect(t.gap.length).toBe(2400);
      for (let k = 0; k < 8; k++) {
        const ids = [];
        t.lane.forEach((l, i) => { if (l === k) ids.push(i); });
        const n = ids.length;
        const d = (a, b) => { const v = t.along[b] - t.along[a]; return v - Math.floor(v); };
        ids.forEach((i, j) => {
          const g = Math.max(d(ids[(j + n - 1) % n], i), d(i, ids[(j + 1) % n]));
          expect(t.gap[i]).toBeCloseTo(g, 6);
          expect(t.gap[i]).toBeGreaterThanOrEqual((1 - J) / n - 1e-6);
          expect(t.gap[i]).toBeLessThanOrEqual((1 + J) / n + 1e-6);
        });
      }
    }
    expect(gasThreads(5, 12, mulberry32(1)).gap.every((g) => g === 1)).toBe(true);
  });
});

describe('FS + varyings', () => {
  it('capsule distance equals the old round radius when the streak is 0', () => {
    expect(GAS_STREAK_FS).toContain('float gasStreakDist(vec2 pc) {');
    expect(GAS_STREAK_FS).toContain('float a = clamp(dot(q, vStreakDir), 0.0, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('float b = clamp(-dot(q, vStreakDir2), 0.0, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('return min(length(q - vStreakDir * a), length(q + vStreakDir2 * b)) / vStreakCap.y;');
    // the bent dash (Task 7g), JS mirror: ahead half along dir, back half along -dir2
    const bent = (pc, dir, dir2, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], 0), cap[0]);
      const b = Math.min(Math.max(-(q[0] * dir2[0] + q[1] * dir2[1]), 0), cap[0]);
      return Math.min(Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a), Math.hypot(q[0] + dir2[0] * b, q[1] + dir2[1] * b)) / cap[1];
    };
    const dist = (pc, dir, cap) => bent(pc, dir, dir, cap);
    // straight (dir2 = dir) = the old one-segment capsule clamp(±cap.x), anywhere in the sprite
    const old = (pc, dir, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], -cap[0]), cap[0]);
      return Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a) / cap[1];
    };
    const dd = [0.6, 0.8];
    for (let x = 0; x <= 1; x += 0.0625) for (let y = 0; y <= 1; y += 0.0625) expect(dist([x, y], dd, [0.3, 0.1])).toBeCloseTo(old([x, y], dd, [0.3, 0.1]), 12);
    // bent: the back half's tip sits on -dir2, not on -dir
    expect(bent([0.5 - 0.3, 0.5], [0, 1], [1, 0], [0.3, 0.1])).toBeCloseTo(0, 12);
    expect(dist([0.8, 0.3], [1, 0], [0, 0.5])).toBeCloseTo(2 * Math.hypot(0.3, 0.2), 12); // the fog role
    // an 8x capsule along a diagonal: its end cap touches the rim on the axis, inside the sprite square
    const w = 1, L = 7, total = w + L, d = [Math.SQRT1_2, Math.SQRT1_2];
    const end = 0.5 * total / total; // centre → tip along the axis = (L/2 + w/2) / total = 0.5
    expect(dist([0.5 + d[0] * end, 0.5 + d[1] * end], d, [0.5 * L / total, 0.5 * w / total])).toBeCloseTo(1, 12);
  });

  it('every varying is declared on both sides', () => {
    for (const v of ['varying vec2 vStreakDir;', 'varying vec2 vStreakDir2;', 'varying vec2 vStreakCap;', 'varying float vLane;']) {
      expect(GAS_STREAK_VS).toContain(v);
      expect(GAS_STREAK_FS).toContain(v);
    }
  });
});

describe('tune knobs (spec §3g)', () => {
  it('defaults: the 54d8ef0e live-sweep set (Task 7d); the old gasSize/gasAlpha are gone', () => {
    expect(PLANET_TUNE).toMatchObject({ filWidth: 2.2, streakGain: 0.05, filAlpha: 4, fogAlpha: 0.7, maskFreq: 2.5, maskSharp: 3, maskDepth: 0.3, airFilGain: 3 });
    expect(PLANET_TUNE.fogAlpha).toBeLessThan(1);
    expect('gasSize' in PLANET_TUNE).toBe(false);
    expect('gasAlpha' in PLANET_TUNE).toBe(false);
  });

  it('copied per frame without allocation, with the renderer pixel ratio', () => {
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(Object.keys(u).sort()).toEqual(['uAirFilGain', 'uDpr', 'uEarthStreakGain', 'uEmberGain', 'uEmberSize', 'uFilAlpha', 'uFilWidth', 'uFogAlpha', 'uMaskDepth', 'uMaskFreq', 'uMaskSharp', 'uPointMax', 'uStreakGain']);
    expect(u.uFilWidth.value).toBe(PLANET_TUNE.filWidth);
    expect(u.uDpr.value).toBe(1);
    const objs = Object.values(u);
    writeGasTune(u, { ...PLANET_TUNE, fogAlpha: 0.5 }, 2, 511);
    expect(u.uFogAlpha.value).toBe(0.5);
    expect(u.uDpr.value).toBe(2);
    expect(u.uPointMax.value).toBe(511);
    expect(Object.values(u)).toEqual(objs);
  });
});

describe('fire ember + earth streak knobs (Task 8b)', () => {
  it('defaults: embers ~1.75x wider + brighter, earth shutter x5; live in PLANET_TUNE', () => {
    expect(PLANET_TUNE).toMatchObject({ emberSize: 1.75, emberGain: 1.75, earthStreakGain: 5 });
  });

  it('wired as uniforms (declared in the shared VS) and copied per frame', () => {
    for (const u of ['uEmberSize', 'uEmberGain', 'uEarthStreakGain']) expect(GAS_STREAK_VS).toContain(`uniform float ${u};`);
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(u.uEmberSize.value).toBe(PLANET_TUNE.emberSize);
    expect(u.uEmberGain.value).toBe(PLANET_TUNE.emberGain);
    expect(u.uEarthStreakGain.value).toBe(PLANET_TUNE.earthStreakGain);
    writeGasTune(u, { ...PLANET_TUNE, emberSize: 3, emberGain: 0.5, earthStreakGain: 7 }, 1, 511);
    expect([u.uEmberSize.value, u.uEmberGain.value, u.uEarthStreakGain.value]).toEqual([3, 0.5, 7]);
  });

  it('one sprite core with the shutter as a parameter: thread/plain sprites pass uStreakGain, gasSpriteGain its own', () => {
    expect(GAS_STREAK_VS).toContain('float gasSpriteCore(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit, float gain) {');
    expect(GAS_STREAK_VS).toContain('return gasSpriteCore(clipNow, clipPrev, clipBack, clipAhead, role, size, aspectMax, jit, uStreakGain);');
    expect(GAS_STREAK_VS).toContain('return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, uStreakGain);');
    expect(GAS_STREAK_VS).toContain('float gasSpriteGain(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit, float gain) {');
    expect(GAS_STREAK_VS).toContain('return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, gain);');
    expect(GAS_STREAK_VS).not.toContain('sp * uStreakGain');
  });

  it('replica: the earth shutter lengthens slow dashes but never past the FIL_ASPECT cap', () => {
    const g = PLANET_TUNE.streakGain;
    const slow = sprite(1, 2.2, 60, FIL_ASPECT, 0.5, g);                       // ~60 px/s settling dust
    const earth = sprite(1, 2.2, 60, FIL_ASPECT, 0.5, g * PLANET_TUNE.earthStreakGain);
    expect(slow.total / slow.w).toBeLessThan(2.5);                               // the old round-ish speck
    expect(earth.total / earth.w).toBeGreaterThan(4);                            // a streak
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 0.5, g * PLANET_TUNE.earthStreakGain).total / 2.2).toBeCloseTo(FIL_ASPECT, 9);
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

describe('point-size guard (Task 7f fix)', () => {
  it('gasPointMax reads ALIASED_POINT_SIZE_RANGE[1] once per renderer; unknown → no clamp', () => {
    let calls = 0;
    const ctx = { ALIASED_POINT_SIZE_RANGE: 0x846d, getParameter: (p) => { calls++; return p === 0x846d ? new Float32Array([1, 511]) : null; } };
    const renderer = { getContext: () => ctx };
    expect(gasPointMax(renderer)).toBe(511);
    expect(gasPointMax(renderer)).toBe(511);
    expect(calls).toBe(1);
    expect(gasPointMax(null)).toBe(GAS_POINT_MAX_UNKNOWN);
    expect(gasPointMax({ getContext: () => ({ getParameter: () => null }) })).toBe(GAS_POINT_MAX_UNKNOWN);
    expect(GAS_TUNE_UNIFORMS(PLANET_TUNE).uPointMax.value).toBe(GAS_POINT_MAX_UNKNOWN);
  });
});
