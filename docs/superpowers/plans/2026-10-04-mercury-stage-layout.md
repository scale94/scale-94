# Mercury Stage Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the /mercury simulation the full container width (16:9, capped at the viewport), move the title into an in-canvas HUD, put controls + Slow Noon dial + vision caption in a row underneath, and fit the camera so all four element handles are always fully in frame.

**Architecture:** A pure `fitCameraDistance` (new `planet/stageFit.js`) computes the camera distance that keeps the orbit ring plus a pixel margin inside the shorter half of the canvas. A hook (`useStageCameraDist`) binds it to r3f's live canvas size; `MercuryCanvas` applies it to the camera, and `MercuryPlanet` feeds the same value to the one function that still assumed the constant distance (`subsolarPxArc`, pop sizing). The canvas size itself is pure CSS (`aspect-ratio` + `max-height`), no JS.

**Tech Stack:** React 19, @react-three/fiber, three.js, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-mercury-stage-layout-design.md`

**Deviation from spec (deliberate, simpler):** the spec named a `ResizeObserver` + pure `stageHeight`. CSS does it exactly: with `width: 100%`, `aspect-ratio: 16/9` and `max-height`, the browser computes `min(width·9/16, max-height)` and keeps the width. No JS, nothing to test in unit. Verified live in Task 4.

## Global Constraints

- Branch `feature/mercury-stage`. **Never push** — no `git push` of any kind without the author's explicit push command.
- `ORBIT_RADIUS` stays 1.4; FOVs (`CAMERA_FOV_DEG` = desktop 42, mobile 48) unchanged; `CAMERA_DIST` (desktop 3.6, mobile 4.6) becomes the FLOOR — the camera is never closer than today.
- Handle clearance: `HANDLE_MARGIN_PX = { desktop: 70, mobile: 78 }` (half a pressed handle — 92/104 px × 1.38 / 2 — plus glow).
- Mobile canvas height formula unchanged (`calc(100svh - 420px - env(safe-area-inset-bottom, 0px))`).
- No per-frame allocation or per-frame work for the fit (recompute only when the canvas size changes).
- Lint gate: `npm run lint` 0 errors; warnings must not exceed the ratchet (153). Do not sweep `exhaustive-deps`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Expected effect on the author's screen (~1057 px viewport): canvas grows from ~647 to ~817 px tall, camera goes 3.6 → ~4.4, so the planet's on-screen radius stays about the same (∝ canvasH / d: 647/3.6 ≈ 180 → 817/4.4 ≈ 186).

---

### Task 1: `fitCameraDistance` (pure)

**Files:**
- Create: `src/terminal/mercury/planet/stageFit.js`
- Test: `src/terminal/mercury/planet/__tests__/stageFit.test.js`

**Interfaces:**
- Produces: `fitCameraDistance({ halfWidthPx, halfHeightPx, ringR, marginPx, fovDeg, minDist }) → number`, `HANDLE_MARGIN_PX = { desktop: 70, mobile: 78 }`, `MIN_AVAIL_FRAC = 0.25`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/stageFit.test.js
import { describe, it, expect } from 'vitest';
import { fitCameraDistance, HANDLE_MARGIN_PX, MIN_AVAIL_FRAC } from '../stageFit';

const tanHalf = (fovDeg) => Math.tan((fovDeg * Math.PI) / 360);
// Projected ring radius in px for a camera at distance d (three's fov is vertical).
const ringPxV = (ringR, d, fovDeg, halfH) => (ringR / (d * tanHalf(fovDeg))) * halfH;
const ringPxH = (ringR, d, fovDeg, halfW, halfH) => (ringR / (d * tanHalf(fovDeg) * (halfW / halfH))) * halfW;

describe('fitCameraDistance', () => {
  it('wide canvas (height-limited): ring + margin lands exactly on the top edge', () => {
    const a = { halfWidthPx: 900, halfHeightPx: 408, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 };
    const d = fitCameraDistance(a);
    expect(ringPxV(1.4, d, 42, 408) + 70).toBeCloseTo(408, 6);
    expect(ringPxH(1.4, d, 42, 900, 408) + 70).toBeLessThan(900);
    expect(d).toBeGreaterThan(3.6);
  });

  it('portrait canvas (width-limited): ring + margin lands exactly on the side edge', () => {
    const a = { halfWidthPx: 187.5, halfHeightPx: 196, ringR: 1.4, marginPx: 78, fovDeg: 48, minDist: 4.6 };
    const d = fitCameraDistance(a);
    expect(ringPxH(1.4, d, 48, 187.5, 196) + 78).toBeCloseTo(187.5, 6);
    expect(ringPxV(1.4, d, 48, 196) + 78).toBeLessThanOrEqual(196 + 1e-9);
  });

  it('never moves closer than minDist', () => {
    const d = fitCameraDistance({ halfWidthPx: 2000, halfHeightPx: 2000, ringR: 0.5, marginPx: 70, fovDeg: 42, minDist: 3.6 });
    expect(d).toBe(3.6);
  });

  it('degenerate canvas (half-extent ≤ margin) stays finite and uses MIN_AVAIL_FRAC', () => {
    const d = fitCameraDistance({ halfWidthPx: 50, halfHeightPx: 40, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 });
    expect(Number.isFinite(d)).toBe(true);
    expect(ringPxV(1.4, d, 42, 40)).toBeLessThanOrEqual(40 * MIN_AVAIL_FRAC + 1e-9);
  });

  it('non-finite / zero sizes fall back to minDist', () => {
    expect(fitCameraDistance({ halfWidthPx: 0, halfHeightPx: 0, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 })).toBe(3.6);
    expect(fitCameraDistance({ halfWidthPx: NaN, halfHeightPx: 300, ringR: 1.4, marginPx: 70, fovDeg: 42, minDist: 3.6 })).toBe(3.6);
  });

  it('margins are half a pressed handle plus glow', () => {
    expect(HANDLE_MARGIN_PX.desktop).toBeGreaterThanOrEqual((92 * 1.38) / 2);
    expect(HANDLE_MARGIN_PX.mobile).toBeGreaterThanOrEqual((104 * 1.38) / 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/stageFit.test.js`
Expected: FAIL — `Failed to resolve import "../stageFit"`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/terminal/mercury/planet/stageFit.js — the camera distance that keeps the element ring in frame.
//
// The handles are fixed-size HTML (MercurySphere: 92 px desktop / 104 px mobile, ×1.38 on press, plus glow),
// so the ring needs a margin in CSS PIXELS, not scene units. three's fov is vertical: the vertical half-extent
// sees tan(fov/2) per unit distance, the horizontal one tan(fov/2)·aspect. For a half-extent of h px the ring
// (radius ringR at z = 0) projects to ringR / (d·t) · h px; requiring that plus the margin to fit in h gives
// d = ringR · h / ((h − margin) · t). The shorter side wins; the camera never comes closer than minDist.

export const HANDLE_MARGIN_PX = Object.freeze({ desktop: 70, mobile: 78 });
export const MIN_AVAIL_FRAC = 0.25; // a canvas smaller than its margin still fits the ring in its central quarter

function distFor(ringR, halfPx, marginPx, t) {
  const avail = Math.max(halfPx - marginPx, halfPx * MIN_AVAIL_FRAC);
  return (ringR * halfPx) / (avail * t);
}

export function fitCameraDistance({ halfWidthPx, halfHeightPx, ringR, marginPx, fovDeg, minDist }) {
  if (!(halfWidthPx > 0) || !(halfHeightPx > 0)) return minDist;
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = halfWidthPx / halfHeightPx;
  const dV = distFor(ringR, halfHeightPx, marginPx, t);
  const dH = distFor(ringR, halfWidthPx, marginPx, t * aspect);
  return Math.max(minDist, dV, dH);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/stageFit.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/stageFit.js src/terminal/mercury/planet/__tests__/stageFit.test.js
git commit -m "feat(mercury): fitCameraDistance — the ring plus a handle margin fits the shorter side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Apply the fit live (camera + pop sizing)

**Files:**
- Create: `src/terminal/mercury/useStageCameraDist.js`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx` (add `StageCameraFit`, render it inside `<Suspense>`)
- Modify: `src/terminal/mercury/planet/mercuryRoil.js:58-75` (`subsolarPxArc` takes an optional distance)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx:459-463` (pop-zoom effect uses the fitted distance)
- Test: `src/terminal/mercury/planet/__tests__/mercuryRoil.test.js` (append)

**Interfaces:**
- Consumes: `fitCameraDistance`, `HANDLE_MARGIN_PX` from Task 1; `ORBIT_RADIUS` from `src/terminal/mercury/orbitNodes.js`; `CAMERA_DIST`, `CAMERA_FOV_DEG` from `planet/planetLook.js`.
- Produces: `useStageCameraDist(isMobile) → number` (default export); `subsolarPxArc(camera, heightPx, dist = CAMERA_DIST[camera])`.

Audit result (done while planning — do not redo, but do not skip the change): of everything deriving screen sizes from the camera, only `subsolarPxArc` reads the `CAMERA_DIST` constant. `fireHyperDrop` (`rVis`), `pxPerUnitAt`, `pxAngleOf`, `planetWindow` and the droplet view matrices read the live camera (`camera.position.length()`, `camera.fov`, `projectionMatrix`) and need nothing. Nothing else writes `camera.position` on /mercury.

- [ ] **Step 1: Write the failing test** (append to `mercuryRoil.test.js`; it already imports `subsolarPxArc`)

```js
describe('subsolarPxArc with a live camera distance', () => {
  it('defaults to CAMERA_DIST (existing callers unchanged)', () => {
    expect(subsolarPxArc('desktop', 1300, 3.6)).toBe(subsolarPxArc('desktop', 1300));
    expect(subsolarPxArc('mobile', 900, 4.6)).toBe(subsolarPxArc('mobile', 900));
  });
  it('a farther camera makes one pixel cover more arc', () => {
    expect(subsolarPxArc('desktop', 1300, 4.4)).toBeGreaterThan(subsolarPxArc('desktop', 1300, 3.6));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`
Expected: FAIL on "a farther camera…" (the third argument is ignored, values are equal).

- [ ] **Step 3: Implement `subsolarPxArc`'s distance parameter**

In `src/terminal/mercury/planet/mercuryRoil.js` replace the comment's last line and the first line of the body:

```js
// component, as the shader takes it. three's fov is vertical, so only the drawing buffer's
// height in device px matters. camera: 'desktop' | 'mobile'; dist: the LIVE camera distance
// (useStageCameraDist fits it to the canvas; CAMERA_DIST is its floor and the default).
export function subsolarPxArc(camera, heightPx, dist = CAMERA_DIST[camera]) {
  const D = dist;
```

(the rest of the function is unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`
Expected: PASS (20 existing + 2 new).

- [ ] **Step 5: Create the hook**

```js
// src/terminal/mercury/useStageCameraDist.js — the fitted camera distance for the live canvas size.
// MercuryCanvas applies it to the camera; MercuryPlanet sizes its pops from it. Both derive it from the
// same r3f size, so they always agree. Recomputes only when the canvas size changes.

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { ORBIT_RADIUS } from './orbitNodes';
import { CAMERA_DIST, CAMERA_FOV_DEG } from './planet/planetLook';
import { fitCameraDistance, HANDLE_MARGIN_PX } from './planet/stageFit';

export default function useStageCameraDist(isMobile) {
  const w = useThree((s) => s.size.width);
  const h = useThree((s) => s.size.height);
  const key = isMobile ? 'mobile' : 'desktop';
  return useMemo(() => fitCameraDistance({
    halfWidthPx: w / 2,
    halfHeightPx: h / 2,
    ringR: ORBIT_RADIUS,
    marginPx: HANDLE_MARGIN_PX[key],
    fovDeg: CAMERA_FOV_DEG[key],
    minDist: CAMERA_DIST[key],
  }), [w, h, key]);
}
```

- [ ] **Step 6: Apply it in `MercuryCanvas.jsx`**

Add imports (`useLayoutEffect` joins the existing react import; `useThree` joins the fiber import):

```js
import { Suspense, useCallback, useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import useStageCameraDist from './useStageCameraDist';
```

Add above `export default function MercuryCanvas`:

```js
// Keeps the four element handles fully in frame at any canvas size (spec: stage layout §2).
// Writes the camera only when the fitted distance changes; FOV is untouched.
function StageCameraFit({ isMobile }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const dist = useStageCameraDist(isMobile);
  useLayoutEffect(() => {
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, dist, invalidate]);
  return null;
}
```

Render it as the first child of `<Suspense fallback={null}>`:

```jsx
      <Suspense fallback={null}>
        <StageCameraFit isMobile={isMobile} />
```

- [ ] **Step 7: Feed the fitted distance to pop sizing in `MercuryPlanet.jsx`**

Add import next to the other local hooks:

```js
import useStageCameraDist from './useStageCameraDist';
```

Inside the component, next to `bufferH` / `bufferW` (line ~280):

```js
  const camDist = useStageCameraDist(isMobile);
```

Replace the pop-zoom layout effect (lines ~459-463):

```js
  // Pop size from the screen: on mount, on resize / DPR change, on a camera re-fit, and for each new material;
  // never per frame. The pop lattice re-forms only here, so a pop never jumps mid-life except on a resize.
  useLayoutEffect(() => {
    material.uniforms.uPopZoom.value = popZoom(subsolarPxArc(isMobile ? 'mobile' : 'desktop', bufferH, camDist));
  }, [material, bufferH, isMobile, camDist]);
```

- [ ] **Step 8: Run the mercury suite + lint**

Run: `npx vitest run src/terminal/mercury`
Expected: all PASS (shader snapshots unchanged — no GLSL touched).
Run: `npm run lint`
Expected: 0 errors, warnings ≤ 153.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/mercury/useStageCameraDist.js src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/mercuryRoil.js src/terminal/mercury/planet/__tests__/mercuryRoil.test.js
git commit -m "feat(mercury): the camera fits the element ring to the canvas; pop sizing follows the live distance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Layout — full-width stage, in-canvas HUD, controls row

**Files:**
- Modify: `src/terminal/views/MercuryTab.jsx:107-210` (header block, main grid, canvas frame)
- Modify: `src/terminal/mercury/SlowNoonDial.jsx:79` (drop `mt-4`; the row's gap spaces it now)

**Interfaces:**
- Consumes: nothing new (Task 2's camera fit makes the bigger canvas frame correctly).
- Produces: `NAV_OFFSET_PX` module constant in `MercuryTab.jsx` (Task 4 calibrates its value).

- [ ] **Step 1: Add the constant** (below the `isMobile` line, ~16)

```js
// Desktop stage: full width, 16:9, capped so the whole canvas sits below the nav on load.
// Calibrated live (stage-layout plan Task 4): canvas top at scrollY 0 + a little breathing room.
const NAV_OFFSET_PX = 240;
```

- [ ] **Step 2: Replace the header block, main grid and canvas frame**

Replace everything from `{/* Header — Mercury Terminal · vision statement */}` (line ~107) through the closing `</div>` of the main grid (the one that closes after the `MESSENGER MDIS` span, line ~210) with:

```jsx
      {/* Stage — the simulation gets the full width (16:9, capped at the viewport); the title rides inside it */}
      <div
        className="w-full rounded-sm overflow-hidden"
        style={{
          ...(isMobile
            ? { height: 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))' }
            : { aspectRatio: '16 / 9', maxHeight: `calc(100svh - ${NAV_OFFSET_PX}px)` }),
          minHeight: '300px',
          background: '#000',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <MercuryCanvas
          params={mergedParams}
          onPhaseChange={setActivePhase}
          onFps={setFps}
          overlay={slowNoonOverlay}
        />

        {/* Energy line — the stage's top edge */}
        <div
          aria-hidden="true"
          className="pointer-events-none"
          style={{
            position: 'absolute', left: 0, top: 0, height: '1px',
            background: 'linear-gradient(90deg, rgba(192,192,192,0.6), rgba(192,192,192,0.1), transparent)',
            animation: 'hg-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
          }}
        />

        {/* HUD — title + phase, top-left, in the credit's register; never takes the pointer */}
        <div className="absolute top-3 left-4 pointer-events-none select-none flex items-start gap-2">
          <span
            aria-hidden="true"
            style={{
              fontSize: 16,
              lineHeight: 1,
              color: 'rgba(192,192,192,0.4)',
              animation: 'hg-titleReveal 1s cubic-bezier(0.16,1,0.3,1) both',
              marginTop: 2,
            }}
          >◉</span>
          <div>
            <h2
              className="text-sm sm:text-base font-bold tracking-tight uppercase font-mono"
              style={{
                background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #a0a0a0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'hg-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
              }}
            >
              Mercury Terminal
            </h2>
            <div
              className="text-[9px] font-mono text-zinc-500/50 uppercase tracking-[0.2em] mt-0.5"
              style={{ animation: 'hg-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
            >
              {activePhase} :: phase active // perihelion precession // metallurgy of the present
            </div>
          </div>
        </div>

        <span
          className="absolute bottom-2 right-3 pointer-events-none select-none font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)' }}
        >
          MESSENGER MDIS · USGS ASTROGEOLOGY
        </span>
      </div>

      {/* Under the stage — controls · the Slow Noon dial · the vision statement as a caption */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[320px_320px_1fr] gap-4 items-start">
        <MercuryControls
          activePhase={activePhase}
          params={mergedParams}
          onChange={handleParamsChange}
          fps={fps}
          particleCount={liveDensity}
        />
        <SlowNoonDial onOverlay={setSlowNoonOverlay} />
        <div
          className="font-mono text-[8px] tracking-[0.12em] leading-relaxed lg:pt-3"
          style={{
            color: 'rgba(192,192,192,0.2)',
            animation: 'hg-titleReveal 0.8s 0.25s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// MERCURY`}</span>
          {' '}— building fairy tale castles on mercury · surveying from perihelion · holding up the mirror
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// EYE PROTOCOL`}</span>
          {' '}— the observer is the instrument · four elements · one surface · humanity reflected
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// OBSERVATION LOOP`}</span>
          {' '}— outer cosmos × inner mirror · castles cast in real time · the log writes itself
        </div>
      </div>
```

Note the energy-line `<div>` needs an explicit animated width: `hg-energyLine` animates `width` 0 → 100%, which works on an absolutely positioned element with `left: 0` (same as before).

- [ ] **Step 3: Drop the dial's top margin** — `src/terminal/mercury/SlowNoonDial.jsx:79`

```jsx
      className="border border-zinc-600/[0.05] rounded-lg bg-black/30 p-3 select-none"
```

- [ ] **Step 4: Run the tests touching these files + lint**

Run: `npx vitest run src/terminal/mercury/__tests__`
Expected: all PASS (`SlowNoonDial.test.jsx` asserts no classes; `mercuryPlanetUniforms.test.js` is unaffected).
Run: `npm run lint`
Expected: 0 errors, warnings ≤ 153.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/MercuryTab.jsx src/terminal/mercury/SlowNoonDial.jsx
git commit -m "feat(mercury): full-width 16:9 stage with the title as an in-canvas HUD; controls, dial and caption in a row below

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Live calibration + verification

**Files:**
- Modify (only if the measurement says so): `src/terminal/views/MercuryTab.jsx` (`NAV_OFFSET_PX`)

- [ ] **Step 1: Open the app** — `preview_start` with `{ name: "scale94-dev" }` (Vite on :5174, from `.claude/launch.json`; the author's own server on :5173 is theirs — leave it), navigate to the Mercury tab. If the pane is hidden, rAF is suspended — keep it visible while measuring.

- [ ] **Step 2: Measure the nav offset** at desktop size, scrollY 0:

```js
window.scrollTo(0, 0);
const c = document.querySelector('canvas').parentElement.getBoundingClientRect();
({ top: Math.round(c.top), height: Math.round(c.height), width: Math.round(c.width), vh: innerHeight })
```

Set `NAV_OFFSET_PX = top + 16` (round to the nearest 4). If it changed, re-run lint and commit:

```bash
git add src/terminal/views/MercuryTab.jsx
git commit -m "fix(mercury): calibrate the stage's nav offset from the live layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Check the frame and handles** — `javascript_tool`:

```js
const st = document.querySelector('canvas').parentElement.getBoundingClientRect();
const handles = [...document.querySelectorAll('[aria-label*="switch to"]')].map((e) => {
  const r = e.getBoundingClientRect(); return { l: e.getAttribute('aria-label').split(' ')[0], top: r.top - st.top, bottom: st.bottom - r.bottom, left: r.left - st.left, right: st.right - r.right };
});
({ cam: window.__mercury.camera.position.z, stage: [st.width, st.height], handles })
```

Expected: every handle's `top/bottom/left/right` ≥ ~6 px (the pressed state's extra ~18 px is inside the margin); camera z > 3.6 desktop. Wait ~10 s and re-run: the ring precesses, values must stay ≥ 0.

- [ ] **Step 4: Screenshots** — desktop (the pane at the author's ~2000 × 1125 class), then `resize_window` preset `mobile`, reload, re-run Step 3, screenshot; then `resize_window` preset `desktop` to reset. Look at each screenshot BEFORE drawing any conclusion: all four handles whole, HUD clear of the WATER handle, row underneath (stacked on mobile), no horizontal scroll.

- [ ] **Step 5: Full suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Report** to the author with the screenshots and the measured numbers (canvas size, camera z, minimum handle clearance). Do not push.
