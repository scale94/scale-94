# Mercury stage — full-width canvas, in-canvas HUD, ring-fitted camera

Date: 2026-10-04 · Branch: `feature/mercury-stage` (off `feature/mercury-matrix`) · Part 1 of 2
(part 2: `2026-10-04-mercury-aether-light-beads-design.md`)

## Problem

1. On desktop the controls column (`// <phase> :: active`) and THE SLOW NOON dial take a 280 px left
   column (`views/MercuryTab.jsx`, `grid lg:grid-cols-[280px_1fr]`), so the simulation never gets the
   full width.
2. The WATER (top) and EARTH (bottom) element handles are clipped. This is NOT a layout bug: the
   desktop camera (`CAMERA_DIST.desktop = 3.6`, `CAMERA_FOV_DEG.desktop = 42`, vertical) sees a world
   half-height of 3.6 · tan 21° ≈ 1.38 at z = 0, while `ORBIT_RADIUS = 1.4`. The ring centre is outside
   the frame at any aspect; widening the canvas only adds width. The handles are fixed-size HTML
   (`MercurySphere.jsx`: 92 px desktop / 104 px mobile, press-burst scale 1.38, glow up to 40 px).

## Decisions (author)

- Canvas: **full container width; height = min(width · 9/16, viewport-available height)** (option B).
  16:9 when the window is tall enough, wider otherwise. The simulation never goes below the fold.
- Under the canvas: **one row, controls then dial** (option A); stacked on mobile.
- Clipping: **recover vertical space first, then a small camera pull-back** (option C).
- The title + phase subtitle become an **in-canvas HUD overlay, top-left** (approved).

## Design

### 1. Header → in-canvas HUD

- `◉ MERCURY TERMINAL` and the `{activePhase} :: phase active // …` subtitle move into an absolutely
  positioned overlay at the canvas's top-left, `pointer-events: none`, `select-none`, styled in the
  register of the existing bottom-right credit (`MESSENGER MDIS · USGS ASTROGEOLOGY`). The
  `hg-titleReveal` animations are kept.
- The energy line (`hg-energyLine`) becomes the canvas's top edge (a 1 px absolutely positioned line
  inside the canvas frame).
- The three-line vision statement (`// MERCURY`, `// EYE PROTOCOL`, `// OBSERVATION LOOP`) moves below
  the canvas, into the controls row (§3), as a caption. Text is unchanged.
- The old header block, its rule lines and its `mb-6` spacing are removed.
- The HUD must not overlap the WATER handle at any supported size: the camera fit (§2) keeps the ring
  inside a centred square-ish region; the HUD sits in the corner. Verified live (§5).
- The HUD is capped at maxWidth calc(50% − 80px) and wraps, so it never reaches the central handle column.

### 2. Canvas size and camera fit

- Canvas frame height (desktop): `min(containerWidth · 9/16, 100svh − NAV_OFFSET_PX)`, min 300 px.
  `NAV_OFFSET_PX` replaces the old magic `260` and is re-measured against the real nav + page padding
  (the header block no longer sits above the canvas, so it shrinks). Width is measured with a
  `ResizeObserver` on the frame; the aspect formula is pure (`stageHeight({ width, viewportH, isMobile })`)
  and tested. Mobile keeps its existing formula.

> Implementation note: the plan (docs/superpowers/plans/2026-10-04-mercury-stage-layout.md) replaced the ResizeObserver + stageHeight with pure CSS (width 100%, aspect-ratio 16/9, max-height calc(100svh − NAV_OFFSET_PX), min-height 300px); there is no stageHeight function.
- New pure function in `planet/planetLook.js` (or a sibling `planet/stageFit.js`):

  ```
  fitCameraDistance({ halfWidthPx, halfHeightPx, ringR, marginPx, fovDeg, minDist })
  ```

  Returns the camera distance d such that the ring (radius `ringR` at z = 0) plus `marginPx` of handle
  clearance fits inside the SHORTER half-extent. With h = half-extent px and t = tan(vfov/2) (for the
  horizontal half-extent use t · aspect):  `d = ringR · h / ((h − marginPx) · t)`, clamped to
  `≥ minDist` (today's 3.6 desktop / 4.6 mobile — the planet never grows, only shrinks when it must).
  `marginPx` = HANDLE_MARGIN_PX ≈ 70 (half the pressed handle 64 px + a few px of glow); exported
  constant.
- `MercuryCanvas` applies it in a small child component (`<StageCameraFit />`) that reads `size` from
  `useThree`, sets `camera.position.z`, and calls `updateProjectionMatrix` only when the value changes
  (no per-frame allocation, no per-frame work when idle). FOV is unchanged — the planet's look
  (perspective, limb) is not touched.
- Consumers that assume the camera distance constant: grep `CAMERA_DIST` (pickSphere, droplet pixel
  angle `uPxAngle`, planet window, pop sizing `uPopZoom`) and make them read the live camera instead of
  the constant where they derive screen sizes. This is a required audit, not optional.

### 3. Controls row

- Under the canvas, desktop: `grid lg:grid-cols-[320px_auto_1fr] gap-4 items-start` →
  `MercuryControls` · `SlowNoonDial` · vision-statement caption. Mobile: stacked, canvas first, as now.
- No change to the controls' or dial's internals.

### 4. Out of scope

- No change to particle shading, planet shading or the ring radius (`ORBIT_RADIUS` stays 1.4).
- No change to mobile's canvas formula beyond the camera fit (which also fixes portrait clipping,
  where width is the limit).

### 5. Verification

- Unit: `fitCameraDistance` — wide (height-limited), tall, portrait (width-limited), and floor cases;
  `stageHeight` — tall window (exact 16:9), short window (viewport cap), 300 px floor.
- Lint gate (0 errors, warnings ≤ ratchet).
- Live, browser pane (dev server): screenshots at the author's 2000 × 1125 window and at the mobile
  preset, showing all four handles (incl. a pressed one) fully inside the frame, the HUD clear of the
  WATER handle, and the row underneath. Screenshot before theorising about any visual bug.
- No push without an explicit push command.
