import { describe, it, expect } from 'vitest';
import {
  hash13, popDensity, popSlope, roilTilt, subsolarPxArc, popZoom,
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME, POP_AMP,
  POP_PX_REF, POP_CREST_PX, POP_ZOOM_MAX, ROIL_LITE_FREQ,
  POP_P_MIN, POP_P_MAX, POP_SALTS, POP_RATE_ZOOM_EXP, POP_RATE_MAX, popRate, popPeriod,
} from '../mercuryRoil';
import {
  bandAA, dimpleAA, WAVE_C_FRONT, WAVE_K_PEAK, WAVE_SHARP, WAVE_DIMPLE_RAD, WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_GAIN, WAVE_DIMPLE_S,
} from '../mercuryWaves';
import { TIERS } from '../planetQuality';

// The REAL /mercury canvas, not the window (measured live with __mercury.size,
// sig-final-fix-report.md §A, 2026-10-01): a 1920×1080 desktop window holds a 1504×820 canvas;
// a 390×844 phone viewport holds a 358×424 css canvas. three's fov is vertical, so only the
// canvas height in device px enters pxArc.
const DESKTOP_CANVAS_H_CSS = 820;
const PHONE_CANVAS_H_CSS = 424;
const PHONE_DPR = TIERS.phone.dprMax; // 1.5: what a DPR ≥ 1.5 phone renders at
const REF_CANVASES = {
  desktopDpr2: subsolarPxArc('desktop', DESKTOP_CANVAS_H_CSS * 2),
  desktopDpr1: subsolarPxArc('desktop', DESKTOP_CANVAS_H_CSS * 1),
  phone: subsolarPxArc('mobile', PHONE_CANVAS_H_CSS * PHONE_DPR),
};
// The ring train's amplitude at its spectral peak (fundamental + 2nd harmonic, as rippleSlope sums them).
const ringAmp = (px, zoom = 1) => {
  const s = POP_SCALE / zoom;
  return (bandAA(WAVE_K_PEAK, px * s) + 2 * WAVE_SHARP * bandAA(2 * WAVE_K_PEAK, px * s)) / (1 + 2 * WAVE_SHARP);
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// popSlope's snap dimple alone, so ringPeak measures rings only.
const popDimple = (th, age, px, zoom) => {
  const reach = POP_REACH_RAD * zoom, s = POP_SCALE / zoom;
  const xd = (th * s) / WAVE_DIMPLE_RAD, t = Math.max(age * POP_TIME, 1e-3);
  return POP_AMP * (1 - ss(0.7 * reach, reach, th)) * (1 - ss(0.7 * POP_LIFE_S, POP_LIFE_S, age))
    * dimpleAA(px * s) * WAVE_DIMPLE_GAIN * Math.exp(-t / WAVE_DIMPLE_S) * 2.3316 * xd * Math.exp(-xd * xd);
};
const ringPeak = (px, zoom = 1) => {
  let m = 0;
  for (let age = 0.01; age < POP_LIFE_S; age += 0.01) {
    for (let r = 0.0025; r < 1; r += 0.005) {
      const th = r * POP_REACH_RAD * zoom;
      m = Math.max(m, Math.abs(popSlope(th, age, px, zoom) - popDimple(th, age, px, zoom)));
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
    expect(POP_JITTER + POP_REACH).toBeLessThan(1); // R1 is in cell units: no zoom touches it
  });

  it('R2 holds at every zoom: a zoomed pop is the reference pop stretched in space, its clock unchanged', () => {
    for (const zoom of [1, 1.4, 2, 3.7]) {
      const reach = POP_REACH_RAD * zoom;
      for (const age of [0.004, 0.05, 0.2, 0.45, 0.59]) {
        for (let r = 0.01; r < 1; r += 0.07) {
          for (const px of [0, 0.004, 0.009]) {
            expect(popSlope(r * reach, age, px * zoom, zoom)).toBeCloseTo(popSlope(r * POP_REACH_RAD, age, px, 1), 12);
          }
        }
        expect(popSlope(reach, age, 0, zoom)).toBe(0);
      }
      expect(Math.abs(popSlope(0.2 * reach, 0.1, 0, zoom))).toBeGreaterThan(0);
      expect(popSlope(0.3 * reach, POP_LIFE_S, 0, zoom)).toBe(0);
    }
  });

  it('subsolarPxArc pins the live canvases (1504×820 at DPR 2 and 1; the 358×424 phone at DPR 1.5)', () => {
    expect(REF_CANVASES.desktopDpr2).toBeCloseTo(0.00514, 5);
    expect(REF_CANVASES.desktopDpr1).toBeCloseTo(0.01024, 5);
    expect(REF_CANVASES.phone).toBeCloseTo(0.01863, 5);
    // twice the device px, half the footprint (to first order)
    expect(REF_CANVASES.desktopDpr1 / REF_CANVASES.desktopDpr2).toBeCloseTo(2, 1);
  });

  it('POP_PX_REF: today\'s full geometry at POP_CREST_PX px per peak crest; the DPR-2 desktop canvas is inside it', () => {
    expect(WAVE_K_PEAK * POP_PX_REF * POP_SCALE).toBeCloseTo((2 * Math.PI) / POP_CREST_PX, 12);
    expect(bandAA(WAVE_K_PEAK, POP_PX_REF * POP_SCALE)).toBeGreaterThanOrEqual(0.75);
    expect(REF_CANVASES.desktopDpr2).toBeLessThanOrEqual(POP_PX_REF);
  });

  it('popZoom: 1 on the DPR-2 desktop canvas, > 1 at DPR 1 and on the phone, monotonic, never < 1', () => {
    expect(popZoom(REF_CANVASES.desktopDpr2)).toBe(1);
    expect(popZoom(REF_CANVASES.desktopDpr1)).toBeGreaterThan(1);
    expect(popZoom(REF_CANVASES.phone)).toBeGreaterThan(1);
    expect(popZoom(0)).toBe(1);
    expect(popZoom(POP_PX_REF)).toBe(1);
    expect(popZoom(2 * POP_PX_REF)).toBeCloseTo(2, 12);
    let prev = 0;
    for (let px = 0; px < 0.05; px += 0.0005) {
      const z = popZoom(px);
      expect(z).toBeGreaterThanOrEqual(1);
      expect(z).toBeGreaterThanOrEqual(prev);
      prev = z;
    }
  });

  it('popZoom: any non-finite or non-positive input is 1 (no NaN into the uniform)', () => {
    for (const bad of [NaN, -1, -0.01, 0, Infinity, -Infinity, undefined, null]) expect(popZoom(bad)).toBe(1);
  });

  it('popZoom: clamps to POP_ZOOM_MAX (6)', () => {
    expect(POP_ZOOM_MAX).toBe(6);
    expect(popZoom(6 * POP_PX_REF)).toBeCloseTo(6, 12);
    expect(popZoom(100 * POP_PX_REF)).toBe(POP_ZOOM_MAX);
    expect(popZoom(0.5)).toBe(POP_ZOOM_MAX);
  });

  // The lite noise reuses POP_PX_REF (cells ÷ zoom at ROIL_LITE_FREQ), so its crest is
  // zoom / (ROIL_LITE_FREQ · pxArc) px. That lands near POP_CREST_PX only by coincidence of the
  // constants; this pins it so a change to either one cannot silently erase the lite roil.
  it('lite roil noise survives bandAA (>= 0.75) on every reference canvas', () => {
    for (const px of Object.values(REF_CANVASES)) {
      const zoom = popZoom(px);
      expect(bandAA((2 * Math.PI * ROIL_LITE_FREQ) / zoom, px)).toBeGreaterThanOrEqual(0.75);
    }
  });

  // The 8 px floor: at the reference footprint the fundamental's crest is POP_CREST_PX px, so a
  // reach under ~8 px holds fewer than two crests. That reads as a dome or a bead with one rim
  // (seen live at a 4.8 px reach on the phone, sig-final-fix-report E2), not as a ring.
  it('rings resolve on every reference canvas: ring peak ≥ 0.25 of the unfiltered peak, a reach of ≥ 8 px', () => {
    for (const px of Object.values(REF_CANVASES)) {
      const zoom = popZoom(px);
      expect(ringAmp(px, zoom)).toBeGreaterThanOrEqual(0.25);
      expect(ringPeak(px, zoom)).toBeGreaterThanOrEqual(0.25 * ringPeak(0, zoom));
      expect((POP_REACH_RAD * zoom) / px).toBeGreaterThanOrEqual(8);
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
      const { g, act } = roilTilt(x, r() * 50, 150, 0.002, 1 + 2 * r());
      expect(Math.abs(g[0] * x[0] + g[1] * x[1] + g[2] * x[2])).toBeLessThan(1e-9);
      expect(act).toBeGreaterThanOrEqual(0);
      expect(act).toBeLessThanOrEqual(1);
    }
  });

  it('seam-free (R1): continuous across every cell boundary, at full density, at any zoom', () => {
    expect(POP_JITTER + POP_REACH).toBeLessThan(1);
    for (const zoom of [1, 2.3]) {
      const freq = POP_FREQ / zoom;
      const r = rng(5);
      let compared = 0;
      // A unit vector whose p.x = x·freq is exactly px (y, z rescaled to stay on the sphere).
      const onSphere = (px, y, z) => {
        const x0 = px / freq;
        const k = Math.sqrt(1 - x0 * x0) / Math.hypot(y, z);
        return [x0, y * k, z * k];
      };
      for (let i = 0; i < 3000; i++) {
        const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
        // the nearest x-boundary of the 2×2×2 neighbourhood: p.x − 0.5 an integer
        const bx = Math.round(x[0] * freq - 0.5) + 0.5;
        if (Math.abs(bx / freq) > 0.98) continue;
        const xA = onSphere(bx - 1e-7, x[1], x[2]), xB = onSphere(bx + 1e-7, x[1], x[2]);
        const t = r() * 30;
        const A = roilTilt(xA, t, 200, 0.002, zoom), B = roilTilt(xB, t, 200, 0.002, zoom);
        if (A.act === 0 && B.act === 0) continue;
        compared++;
        for (let k = 0; k < 3; k++) expect(Math.abs(A.g[k] - B.g[k])).toBeLessThan(1e-3);
      }
      expect(compared).toBeGreaterThan(zoom > 1 ? 15 : 50);
    }
  });
});

describe('pop rate from the screen (Task 7): a coarse screen keeps a lively boil', () => {
  it('POP_RATE_ZOOM_EXP is a named exponent in [0, 2]; zoom 1 (the DPR-2 desktop) is untouched', () => {
    expect(POP_RATE_ZOOM_EXP).toBeGreaterThanOrEqual(0);
    expect(POP_RATE_ZOOM_EXP).toBeLessThanOrEqual(2);
    expect(popRate(1)).toBe(1);
    for (let h = 0; h <= 1; h += 0.125) expect(popPeriod(h, 1)).toBe(POP_P_MIN + (POP_P_MAX - POP_P_MIN) * h);
  });

  it('each cell period shrinks by zoom^k, capped so it never drops under the life (R2 is about life, not period)', () => {
    expect(POP_RATE_MAX).toBe(POP_P_MIN / POP_LIFE_S);
    for (const z of [1.5, 1.833, 3.335, POP_ZOOM_MAX, 50]) {
      expect(popRate(z)).toBeCloseTo(Math.min(z ** POP_RATE_ZOOM_EXP, POP_RATE_MAX), 12);
      for (let h = 0; h <= 1; h += 0.125) {
        expect(popPeriod(h, z)).toBeCloseTo(popPeriod(h, 1) / popRate(z), 12);
        expect(popPeriod(h, z)).toBeGreaterThanOrEqual(POP_LIFE_S - 1e-12);
      }
    }
    // the life is not scaled: a pop at any zoom is still over at POP_LIFE_S
    for (const z of [1, 3.335, POP_ZOOM_MAX]) expect(popSlope(0.5 * POP_REACH_RAD * z, POP_LIFE_S, 0.002 * z, z)).toBe(0);
  });

  it('roilTilt pops each cell every popPeriod(hash, zoom): measured onset to onset at a lone site', () => {
    const salted = (c, s) => hash13(c[0] + s[0], c[1] + s[1], c[2] + s[2]);
    for (const zoom of [1, 3.335]) {
      const freq = POP_FREQ / zoom;
      const r = rng(11);
      let found = null;
      // a point inside exactly one site's reach (full density), so its activity is that one cell's clock
      for (let n = 0; n < 20000 && !found; n++) {
        const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
        const p = x.map((v) => v * freq);
        const base = p.map((v) => Math.floor(v - 0.5));
        const hits = [];
        for (let i = 0; i < 8; i++) {
          const c = [base[0] + (i & 1), base[1] + ((i >> 1) & 1), base[2] + ((i >> 2) & 1)];
          const s = ['x', 'y', 'z'].map((a, k) => c[k] + 0.5 + (salted(c, POP_SALTS[a]) - 0.5) * 2 * POP_JITTER);
          if (Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]) < 0.8 * POP_REACH) hits.push(c);
          else if (Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2]) < POP_REACH) hits.push(null);
        }
        if (hits.length === 1 && hits[0]) found = { x, c: hits[0] };
      }
      expect(found).not.toBeNull();
      const want = popPeriod(salted(found.c, POP_SALTS.period), zoom);
      const onsets = [];
      let was = roilTilt(found.x, 0, 1e4, 0.002, zoom).act > 0;
      for (let t = 0.005; t < 4 * POP_P_MAX; t += 0.005) {
        const on = roilTilt(found.x, t, 1e4, 0.002, zoom).act > 0;
        if (on && !was) onsets.push(t);
        was = on;
      }
      expect(onsets.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < onsets.length; i++) expect(Math.abs(onsets[i] - onsets[i - 1] - want)).toBeLessThan(0.011);
    }
  });
});
