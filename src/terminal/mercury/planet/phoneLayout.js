// src/terminal/mercury/planet/phoneLayout.js — portrait phones: the four element triggers in the canvas corners.
//
// On the ring (stageFit.js) the handles ride at the orbit radius and the planet is locked to 0.75 / 1.4 of it, so on a
// ~350 px portrait canvas the 104 px hit boxes overlapped the sphere's edge (gap −5…+12 px): a thumb flicking the rim
// tripped an element, and the planet stayed small (author 2026-11-23, phone test). Here the handles sit in the corners,
// the top pair below the title band, and the sphere takes the largest radius that leaves FLICK_GAP_PX of clear space
// to every handle. The camera is placed so the sphere draws at that radius; each corner's world position on the z = 0
// plane (what the handles, the mercury thread, the mirror's element reflections and the visitors' launch all read)
// projects back onto its corner exactly. Desktop and a landscape phone keep the ring.
// Pure (no three).

import { R_SCENE } from './planetLook';

export const PHONE_HANDLE_PX = 104; // MercurySphere's mobile hit box (a resting handle)
export const CORNER_INSET_PX = 4;   // handle box to the canvas edge
export const TITLE_BAND_PX = 52;    // MercuryTab's one-line title + phase line on a phone; the top handles start below it
export const FLICK_GAP_PX = 32;     // clear space between the sphere and every handle box (a thumb's contact patch)
export const SIDE_MARGIN_PX = 24;   // the sphere never comes closer than this to the canvas sides
const MIN_SPHERE_PX = 12;

// The compass turned 45° (clockwise N, E, S, W → NE, SE, SW, NW), as [x sign, y sign] in screen space (y down).
export const CORNER_OF = Object.freeze({ air: [1, -1], thermal: [1, 1], earth: [-1, 1], fluid: [-1, -1] });

export const isCornerLayout = ({ isMobile, wPx, hPx }) => !!isMobile && hPx > wPx;

// A portrait phone's stage height (MercuryTab): 100svh − 340 px, kept between 1.15x and 1.5x the canvas width so the
// corners always leave the sphere room, and a tall phone does not push the controls off the page.
export const PHONE_STAGE_CHROME_PX = 340;
export const PHONE_STAGE_MIN_K = 1.15;
export const PHONE_STAGE_MAX_K = 1.5;
export function phoneCanvasHeight(wPx, viewportHPx) {
  return Math.min(Math.max(PHONE_STAGE_MIN_K * wPx, viewportHPx - PHONE_STAGE_CHROME_PX), PHONE_STAGE_MAX_K * wPx);
}
// The same rule as CSS for the stage div (svh + the safe area, which JS does not see).
export const phoneStageHeightCss = (wPx) =>
  `clamp(${PHONE_STAGE_MIN_K * wPx}px, calc(100svh - ${PHONE_STAGE_CHROME_PX}px - env(safe-area-inset-bottom, 0px)), ${PHONE_STAGE_MAX_K * wPx}px)`;

export function phoneCornerLayout({ wPx, hPx, fovDeg }) {
  const cx = wPx / 2, cy = hPx / 2;
  const half = PHONE_HANDLE_PX / 2;
  const hx = half + CORNER_INSET_PX;                    // handle centre to the side edge
  const top = TITLE_BAND_PX + half;                     // top handles' centre row
  const bot = hPx - half - CORNER_INSET_PX;             // bottom handles' centre row
  // the nearest handle's edge from the sphere centre. In corner mode the hit area is ROUND (MercurySphere sets
  // borderRadius 50% on it, and browsers clip hit testing to the border radius): a square box's corner would point at
  // the sphere and cost the planet up to half · (√2 − 1) ≈ 21 px of radius, below today's size on short phones.
  const near = Math.min(Math.hypot(cx - hx, cy - top), Math.hypot(cx - hx, bot - cy)) - half;
  const sphereRadiusPx = Math.max(MIN_SPHERE_PX, Math.min(near - FLICK_GAP_PX, cx - SIDE_MARGIN_PX));
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const dist = (R_SCENE * cy) / (t * sphereRadiusPx);
  const k = (t * dist) / cy; // world units per px on the z = 0 plane
  const nodes = {}, handlePx = {};
  for (const phase of Object.keys(CORNER_OF)) {
    const [sx, sy] = CORNER_OF[phase];
    const px = sx > 0 ? wPx - hx : hx;
    const py = sy < 0 ? top : bot;
    handlePx[phase] = [px, py];
    nodes[phase] = [(px - cx) * k, -(py - cy) * k, 0];
  }
  return { mode: 'corners', dist, sphereRadiusPx, nodes, handlePx };
}
