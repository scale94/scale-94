import { describe, it, expect } from 'vitest';
import {
  hash13, popDensity, popSlope, roilTilt, subsolarPxArc, popZoom,
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME, POP_AMP,
  POP_PX_REF, POP_CREST_PX, POP_ZOOM_MAX, ROIL_LITE_FREQ,
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
