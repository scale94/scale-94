import { describe, it, expect } from 'vitest';
import {
  hash13, popDensity, popSlope, popScale, popTime, roilTilt,
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME, POP_AMP,
} from '../mercuryRoil';
import {
  bandAA, dimpleAA, WAVE_C_FRONT, WAVE_K_PEAK, WAVE_SHARP, WAVE_DIMPLE_RAD, WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_GAIN, WAVE_DIMPLE_S,
} from '../mercuryWaves';
import { TIERS } from '../planetQuality';
import { CAMERA_DIST, CAMERA_FOV_DEG, R_SCENE } from '../planetLook';
import { SUN_DIR_WORLD } from '../planetFrame';

// pxArc = length(fwidth(xw)) at the SUBSOLAR point (the boil cap's centre, PHASE_ANGLE_DEG off
// the view axis, so foreshortened), from the real camera. three's fov is vertical, so only the
// canvas height in device pixels matters. Forward differences, |dFdx| + |dFdy| per component,
// as the shader takes it.
function subsolarPxArc(camera, heightCss, dpr) {
  const D = CAMERA_DIST[camera];
  const tanHalf = Math.tan((CAMERA_FOV_DEG[camera] * Math.PI) / 360);
  const P = SUN_DIR_WORLD.map((c) => c * R_SCENE);
  const s0 = [P[0] / (D - P[2]), P[1] / (D - P[2])];
  const hitDir = (sx, sy) => {
    const l = Math.hypot(sx, sy, 1), rd = [sx / l, sy / l, -1 / l];
    const b = D * rd[2];
    const t = -b - Math.sqrt(b * b - (D * D - R_SCENE * R_SCENE));
    const h = [rd[0] * t, rd[1] * t, D + rd[2] * t], hl = Math.hypot(...h);
    return h.map((c) => c / hl);
  };
  const step = (2 * tanHalf) / (heightCss * dpr);
  const a = hitDir(s0[0], s0[1]), bx = hitDir(s0[0] + step, s0[1]), by = hitDir(s0[0], s0[1] + step);
  return Math.hypot(...a.map((c, i) => Math.abs(bx[i] - c) + Math.abs(by[i] - c)));
}
// Each tier's reference viewport: full = 1920×1080 at DPR 2 (desktop camera), phone = 390×844 at its dprMax.
const REF = {
  full: subsolarPxArc('desktop', 1080, TIERS.full.dprMax),
  phone: subsolarPxArc('mobile', 844, TIERS.phone.dprMax),
};
// The ring train's amplitude at its spectral peak (fundamental + 2nd harmonic, as rippleSlope sums them).
const ringAmp = (px, refTh) => {
  const s = popScale(refTh);
  return (bandAA(WAVE_K_PEAK, px * s) + 2 * WAVE_SHARP * bandAA(2 * WAVE_K_PEAK, px * s)) / (1 + 2 * WAVE_SHARP);
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// popSlope's snap dimple alone, so ringPeak measures rings only.
const popDimple = (th, age, px, refTh) => {
  const s = popScale(refTh), xd = (th * s) / WAVE_DIMPLE_RAD, t = Math.max(age * popTime(refTh), 1e-3);
  return POP_AMP * (1 - ss(0.7 * POP_REACH_RAD, POP_REACH_RAD, th)) * (1 - ss(0.7 * POP_LIFE_S, POP_LIFE_S, age))
    * dimpleAA(px * s) * WAVE_DIMPLE_GAIN * Math.exp(-t / WAVE_DIMPLE_S) * 2.3316 * xd * Math.exp(-xd * xd);
};
const ringPeak = (px, refTh) => {
  let m = 0;
  for (let age = 0.01; age < POP_LIFE_S; age += 0.01) {
    for (let r = 0.0025; r < 1; r += 0.005) {
      const th = r * POP_REACH_RAD;
      m = Math.max(m, Math.abs(popSlope(th, age, px, refTh) - popDimple(th, age, px, refTh)));
    }
  }
  return m;
};

const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
// deterministic PRNG for sampling (mulberry32)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('mercuryRoil', () => {
  it('hash13 is deterministic and in [0, 1)', () => {
    const r = rng(1);
    for (let i = 0; i < 500; i++) {
      const p = [r() * 40 - 20, r() * 40 - 20, r() * 40 - 20];
      const h = hash13(...p);
      expect(h).toBe(hash13(...p));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('popDensity: 0 at and below the boil point, rising steadily, below 1', () => {
    expect(popDensity(0)).toBe(0);
    expect(popDensity(-20)).toBe(0);
    let prev = 0;
    for (let dT = 5; dT <= 200; dT += 5) {
      const d = popDensity(dT);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(1);
      prev = d;
    }
  });

  it('the miniature: the front reaches the edge of the reach exactly at end of life (R2)', () => {
    expect(POP_SCALE * POP_REACH_RAD).toBeCloseTo(POP_REF_TH, 12);
    expect(WAVE_C_FRONT * POP_LIFE_S * POP_TIME).toBeCloseTo(POP_REF_TH, 12);
    expect(POP_REACH_RAD).toBeCloseTo(POP_REACH / POP_FREQ, 12);
  });

  it('the miniature holds per tier: R1 containment, R2 front at the reach at end of life', () => {
    expect(POP_JITTER + POP_REACH).toBeLessThan(1);
    for (const { popRefTh } of Object.values(TIERS)) {
      expect(popScale(popRefTh) * POP_REACH_RAD).toBeCloseTo(popRefTh, 12);
      expect(WAVE_C_FRONT * POP_LIFE_S * popTime(popRefTh)).toBeCloseTo(popRefTh, 12);
    }
    expect(popScale()).toBe(POP_SCALE);
    expect(popTime()).toBe(POP_TIME);
    expect(TIERS.full.popRefTh).toBe(POP_REF_TH);
  });

  it('the subsolar pxArc helper matches the review (1600×1000 DPR 1 ≈ 0.0084; phone ≈ 0.0094)', () => {
    expect(subsolarPxArc('desktop', 1000, 1)).toBeCloseTo(0.0084, 4);
    expect(REF.phone).toBeCloseTo(0.0094, 4);
    expect(REF.full).toBeCloseTo(0.0039, 4);
  });

  it('rings resolve at each tier\'s reference viewport: ≥ 5 px per peak wavelength, a reach of ≥ 8 px (R2 amended)', () => {
    for (const tier of ['full', 'phone']) {
      const px = REF[tier], s = popScale(TIERS[tier].popRefTh);
      expect(WAVE_K_PEAK * px * s).toBeLessThanOrEqual((2 * Math.PI) / 5);
      expect(POP_REACH_RAD / px).toBeGreaterThanOrEqual(8);
    }
  });

  it('a pop ring keeps real slope at each tier\'s subsolar pxArc (bandAA does not erase it)', () => {
    for (const tier of ['full', 'phone']) {
      const px = REF[tier], refTh = TIERS[tier].popRefTh;
      expect(ringAmp(px, refTh)).toBeGreaterThanOrEqual(0.25);
      expect(ringPeak(px, refTh)).toBeGreaterThanOrEqual(0.25 * ringPeak(0, refTh));
    }
  });

  it('the pop dimple fades when sub-pixel and is untouched when resolved', () => {
    const dimple = (px) => { let m = 0; for (let th = 1e-5; th < 0.25 * POP_REACH_RAD; th += 1e-5) m = Math.max(m, Math.abs(popSlope(th, 0.002, px))); return m; };
    const subPx = (WAVE_DIMPLE_RAD / POP_SCALE) / (0.5 * WAVE_DIMPLE_AA_LO); // the dimple's radius is half a pixel
    expect(dimple(0)).toBeGreaterThan(0.1 * POP_AMP);
    expect(dimple(subPx)).toBeLessThan(1e-3 * dimple(0));
    expect(dimple(0.005)).toBeCloseTo(dimple(0), 6);
  });

  it('containment: no slope beyond the reach or after the life', () => {
    for (const age of [0.01, 0.1, 0.3, 0.55]) {
      expect(popSlope(POP_REACH_RAD, age, 0)).toBe(0);
      expect(popSlope(POP_REACH_RAD * 1.5, age, 0)).toBe(0);
    }
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S, 0)).toBe(0);
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S + 1, 0)).toBe(0);
    expect(Math.abs(popSlope(0.2 * POP_REACH_RAD, 0.1, 0))).toBeGreaterThan(0);
  });

  it('no pops below the boil point', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 100, -1, 0.002);
      expect(g).toEqual([0, 0, 0]);
      expect(act).toBe(0);
    }
  });

  it('more superheat, more surface boiling (a steady onset, no hard line)', () => {
    const r = rng(3);
    const xs = Array.from({ length: 4000 }, () => norm([r() - 0.5, r() - 0.5, r() - 0.5]));
    const busy = (dT) => xs.filter((x) => roilTilt(x, 7.3, dT, 0.002).act > 0).length;
    const a = busy(10), b = busy(60), c = busy(150);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('the slope is tangent to the sphere and activity stays in [0, 1]', () => {
    const r = rng(4);
    for (let i = 0; i < 2000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 50, 150, 0.002);
      expect(Math.abs(g[0] * x[0] + g[1] * x[1] + g[2] * x[2])).toBeLessThan(1e-9);
      expect(act).toBeGreaterThanOrEqual(0);
      expect(act).toBeLessThanOrEqual(1);
    }
  });

  it('seam-free (R1): continuous across every cell boundary, at full density', () => {
    expect(POP_JITTER + POP_REACH).toBeLessThan(1);
    const r = rng(5);
    let compared = 0;
    // A unit vector whose p.x = x·POP_FREQ is exactly px (y, z rescaled to stay on the sphere).
    const onSphere = (px, y, z) => {
      const x0 = px / POP_FREQ;
      const k = Math.sqrt(1 - x0 * x0) / Math.hypot(y, z);
      return [x0, y * k, z * k];
    };
    for (let i = 0; i < 3000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      // the nearest x-boundary of the 2×2×2 neighbourhood: p.x − 0.5 an integer
      const bx = Math.round(x[0] * POP_FREQ - 0.5) + 0.5;
      if (Math.abs(bx / POP_FREQ) > 0.98) continue;
      const xA = onSphere(bx - 1e-7, x[1], x[2]), xB = onSphere(bx + 1e-7, x[1], x[2]);
      const t = r() * 30;
      const A = roilTilt(xA, t, 200, 0.002), B = roilTilt(xB, t, 200, 0.002);
      if (A.act === 0 && B.act === 0) continue;
      compared++;
      for (let k = 0; k < 3; k++) expect(Math.abs(A.g[k] - B.g[k])).toBeLessThan(1e-3);
    }
    expect(compared).toBeGreaterThan(50);
  });
});
