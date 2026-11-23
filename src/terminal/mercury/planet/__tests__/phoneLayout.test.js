// src/terminal/mercury/planet/__tests__/phoneLayout.test.js — portrait phones: the element triggers in the canvas corners,
// the sphere as large as a 32 px flick gap to every trigger allows (author 2026-11-23: on the ring the 104 px hit boxes
// overlapped the sphere's edge by up to 5 px, so a thumb flicking the rim tripped an element).
import { describe, it, expect } from 'vitest';
import {
  phoneCornerLayout, isCornerLayout, PHONE_HANDLE_PX, CORNER_INSET_PX, TITLE_BAND_PX, FLICK_GAP_PX, SIDE_MARGIN_PX,
  CORNER_OF, phoneCanvasHeight,
} from '../phoneLayout';
import { R_SCENE } from '../planetLook';
import { fitCameraDistance, HANDLE_MARGIN_PX } from '../stageFit';

const FOV = 48; // CAMERA_FOV_DEG.mobile
const t = Math.tan((FOV * Math.PI) / 360);
// world (z = 0) -> canvas px, for a camera on +Z at distance d, three's vertical fov
const toPx = ([x, y], d, w, h) => [w / 2 + (x / (t * d)) * (h / 2), h / 2 - (y / (t * d)) * (h / 2)];
const PHONES = [[360, 640], [375, 667], [375, 812], [390, 844], [412, 915], [430, 932]];

describe('phoneCornerLayout', () => {
  for (const [vw, vh] of PHONES) {
    const w = vw - 32, h = phoneCanvasHeight(w, vh);
    it(`${vw}x${vh}: every trigger sits in its corner, ≥ ${FLICK_GAP_PX} px clear of the sphere, inside the canvas`, () => {
      const L = phoneCornerLayout({ wPx: w, hPx: h, fovDeg: FOV });
      const sphereR = (R_SCENE / (t * L.dist)) * (h / 2);
      expect(sphereR).toBeCloseTo(L.sphereRadiusPx, 6);
      expect(sphereR).toBeLessThanOrEqual(w / 2 - SIDE_MARGIN_PX + 1e-9);
      for (const phase of ['air', 'thermal', 'earth', 'fluid']) {
        const [px, py] = toPx(L.nodes[phase], L.dist, w, h);
        expect(px).toBeCloseTo(L.handlePx[phase][0], 6);
        expect(py).toBeCloseTo(L.handlePx[phase][1], 6);
        const half = PHONE_HANDLE_PX / 2;
        expect(px - half).toBeGreaterThanOrEqual(CORNER_INSET_PX - 1e-9);
        expect(px + half).toBeLessThanOrEqual(w - CORNER_INSET_PX + 1e-9);
        expect(py + half).toBeLessThanOrEqual(h - CORNER_INSET_PX + 1e-9);
        expect(py - half).toBeGreaterThanOrEqual(TITLE_BAND_PX - 1e-9); // the title band stays clear
        const gap = Math.hypot(px - w / 2, py - h / 2) - half - sphereR; // to the ROUND hit area (MercurySphere, corner mode)
        expect(gap).toBeGreaterThanOrEqual(FLICK_GAP_PX - 1e-6);
        expect(L.nodes[phase][2]).toBe(0);
      }
    });
  }

  it('the sphere grows on a tall phone (about twice today on a 412 x 915, OnePlus 9 Pro) and keeps today\'s size on a short one', () => {
    const today = (w) => ((w / 2 - HANDLE_MARGIN_PX.mobile) * R_SCENE) / 1.4;
    const r = (vw, vh) => { const w = vw - 32; return phoneCornerLayout({ wPx: w, hPx: phoneCanvasHeight(w, vh), fovDeg: FOV }).sphereRadiusPx; };
    expect(r(412, 915) / today(380)).toBeGreaterThan(1.9);
    expect(r(375, 812) / today(343)).toBeGreaterThan(1.4);
    expect(r(360, 640) / today(328)).toBeGreaterThan(0.9); // the shortest phone: the same planet, now clear of the triggers
  });

  it('the compass turns 45°: AIR top-right, FIRE bottom-right, EARTH bottom-left, WATER top-left', () => {
    expect(CORNER_OF).toEqual({ air: [1, -1], thermal: [1, 1], earth: [-1, 1], fluid: [-1, -1] });
    const L = phoneCornerLayout({ wPx: 343, hPx: 472, fovDeg: FOV });
    expect(L.handlePx.air[0]).toBeGreaterThan(343 / 2); expect(L.handlePx.air[1]).toBeLessThan(472 / 2);
    expect(L.handlePx.fluid[0]).toBeLessThan(343 / 2); expect(L.handlePx.earth[1]).toBeGreaterThan(472 / 2);
  });

  it('the canvas on a portrait phone: 100svh − 340 px, kept within 1.15x–1.5x its width', () => {
    expect(phoneCanvasHeight(343, 812)).toBe(472);
    expect(phoneCanvasHeight(328, 640)).toBeCloseTo(1.15 * 328, 9);
    expect(phoneCanvasHeight(380, 2000)).toBeCloseTo(1.5 * 380, 9);
  });

  it('only a portrait phone gets corners: desktop and a landscape phone keep the ring, and its fit, unchanged', () => {
    expect(isCornerLayout({ isMobile: true, wPx: 343, hPx: 472 })).toBe(true);
    expect(isCornerLayout({ isMobile: true, wPx: 780, hPx: 300 })).toBe(false);
    expect(isCornerLayout({ isMobile: false, wPx: 343, hPx: 472 })).toBe(false);
    expect(isCornerLayout({ isMobile: false, wPx: 950, hPx: 534 })).toBe(false);
    // the desktop fit this branch measured live (950 x 534 → 4.943) is the ring's, untouched
    const d = fitCameraDistance({ halfWidthPx: 475, halfHeightPx: 267, ringR: 1.4, marginPx: HANDLE_MARGIN_PX.desktop, fovDeg: 42, minDist: 3.6 });
    expect(d).toBeCloseTo(4.943, 3);
  });
});
