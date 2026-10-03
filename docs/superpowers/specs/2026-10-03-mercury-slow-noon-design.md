# THE SLOW NOON: Mercury's solar day, made readable

Date: 2026-10-03 · Branch base: `feature/mercury-nebula-mirror` @efce3332
Mockup: `.superpowers/brainstorm/188-1791042105/content/solar-dial-v2.html` (option B)

## 1. Problem

The /mercury planet is driven by Mercury's real day/night cycle (`mercuryEphemeris.js` → sub-solar
longitude → `bodyYawFor` → body orientation; thermal field → liquid/frozen Hg). Nobody can read it:

- The Sun is fixed in world at a chosen 55° phase angle (`planetFrame.js` `PHASE_ANGLE_DEG`). Dates only
  spin the body. **Local solar time at the disc centre is therefore constant** (always afternoon) and
  cannot be the reading.
- One Mercury solar day = 176 Earth days; the body turns ~6°/Earth day. Nothing visibly moves in a visit.

Readability therefore means: *where are we in the 176-day day*, for a **place**, linked to the planet.

## 2. Decisions (author-approved)

- **Anchor:** Caloris basin, centre 162.7°E, 31.5°N, diameter ~1,550 km (angular radius 18.2° on
  R = 2,440 km). Near the 180° hot pole: perihelion falls near its local noon, so the retrograde Sun
  happens at its noon.
- **Form:** the resonance rosette (mockup B). Angle = Caloris local solar time (noon top, midnight
  bottom, dawn left, dusk right; day half warm ink, night half cold ink). Radius = heliocentric distance
  r (0.30 AU inner → 0.47 AU outer). The 3:2 spin-orbit resonance makes the trace a closed figure with
  two perihelion pinches. Last 15 days drawn bright, the full day dim. Dashed rings at the perihelion
  pinches. A ×22 loupe shows the real retrograde loop (~1.1° of sub-solar longitude).
- **Name:** THE SLOW NOON.
- **Readouts** (three lines under the dial, all real values):
  1. `06:12 · DAWN AT CALORIS` (24 Mercury-hour clock, hour angle / 15°; phase word from the hour:
     NIGHT / DAWN / MORNING / NOON / AFTERNOON / DUSK)
  2. `SUN 0.461 AU · 2.2× EARTH'S SKY · RECEDING` (angular diameter ratio = 1 AU / r; RECEDING when
     ṙ > 0, APPROACHING when ṙ < 0)
  3. Either `SUN STANDS IN 35 d  (noon, perihelion)` (days to next retrograde window start) or, inside the
     window, `THE SUN TURNS BACK · day k of n`
- **Placement:** left sidebar under `MercuryControls` (desktop: always beside the canvas; mobile: the
  sidebar already sits below the canvas).
- **Hover link:** hovering the dial (desktop) or tapping it (touch: reveal 4 s then fade) shows on the
  planet: the Hg freeze line, the Caloris ring, a sub-solar tick. At rest the planet is pixel-identical
  to today. Unhover fades out. `prefers-reduced-motion`: instant on/off.
- **Landing tab:** OUT of scope. KERNEL stays the landing tab until `feature/mercury-nebula-mirror` is on
  main and passes the phone hardware gate without frame drops; then a separate spec.

## 3. Architecture

### 3.1 `src/terminal/mercury/planet/slowNoon.js` (pure model, no React, no three)

```
CALORIS = { lonDeg: 162.7, latDeg: 31.5, angRadDeg: 18.2 }
slowNoonState(nowMs) -> {
  hour,            // 0..24 Caloris local solar time
  phaseWord,       // NIGHT|DAWN|MORNING|NOON|AFTERNOON|DUSK
  rAU, sunScale,   // r, 1/r
  receding,        // rdotKmS > 0
  retro: { startMs, endMs, active, dayIndex, days },  // next (or current) window
  daysToRetro,     // whole days to retro.startMs (0 when active)
  calorisFacing,   // Caloris centre on the camera hemisphere at HOME orientation (bodyYawFor), not drag
}
rosettePath(nowMs, stepDays = 0.25) -> [{ t, hour, rAU }]  // one full solar day centred on now
```

- Hour angle H = CALORIS.lonDeg − subsolarLonDeg, wrapped to (−180, 180]; hour = 12 + H/15 (mod 24).
- Retrograde window = interval where d(subsolarLon)/dt > 0 (normal motion is decreasing). Found by
  sampling at 0.05 d around each r minimum and bisecting the two sign changes to < 1 h.
- `rosettePath` is cached per solar day (recompute when `nowMs` leaves the cached span); the dial
  re-renders on the existing minute tick, not per frame.

### 3.2 `src/terminal/mercury/SlowNoonDial.jsx`

SVG, styled to the instruments panel voice (mono, zinc, warm/cold halves, gold #e8c27a for perihelion and
loupe). Hand = bright dot at (hour, r) now. When `calorisFacing` is false the hand and bright trail dim
to ~35% (Caloris is on the far side; the ring will not be visible). Emits `onOverlay(bool)`:
`pointerenter`/`pointerleave` for mouse; for `pointerType` touch/pen a tap sets true and a 4 s timer sets
false (re-tap restarts). Accessible label reads line 1–3 as text.

### 3.3 Wiring

`MercuryTab` holds `overlay` state → `MercuryCanvas` prop `overlay` → `MercuryPlanet` prop `overlay`.
`MercuryPlanet` eases `uOverlay` toward 0/1 in `useFrame` (~250 ms; snap when reduced motion).
New constant uniform `uCaloris` (body-frame unit vector from `dirFromLonLat`). No new meshes, no new
draw calls.

### 3.4 Shader marks (`mercuryPlanetShader.js`)

All marks are ~1 px hairlines, neutral white at low alpha × `uOverlay`, composited after `colLin`:

- **Freeze line:** `|T − HG_MELT_K| / fwidth(T) < 1`, using the shader's own `T` (noise edge, spin heat
  `heatK` included), so it hugs the real phase boundary. Drawn on crust and liquid alike (it is the Hg melt
  isotherm). If it reads wrong on crust, gate it on the liquid state instead (decide at the look sheet).
- **Caloris ring:** angular distance from body-frame normal to `uCaloris` = 18.2°, width via `fwidth`.
  Body frame, so it follows drags and spins.
- **Sub-solar tick:** a short cross (~6 px arms) at the sub-solar point (`uSunDir`); screen-fixed by
  construction, marks "noon is here".
- `fwidth` / derivatives are computed in uniform control flow, before any early-out (the SCENT
  fwidth-after-continue trap). The mark block runs only when `uOverlay > 0.0`.

## 4. Testing and gates

- `slowNoon.test.js` (real ephemeris, no mocks):
  - 2026-10-03T12:00Z → hour ≈ 06:12 (±2 min), r ≈ 0.461, receding.
  - next perihelion ≈ 2026-11-10; retrograde window ≈ 2026-11-07 → 2026-11-14 (±0.5 d).
  - rosette closes: point at t and t + 175.94 d coincide (hour ±0.05 h, r ±1e-4 AU).
  - hour increases monotonically outside the window; decreases inside it.
  - inside the window: `retro.active`, `dayIndex` counts 1..n; line 3 switches text.
- Shader snapshot `planetShader.full.fs.glsl` updated.
- **Parity gate (hard):** `uOverlay = 0` frame is pixel-identical to the pre-change build.
- Draw calls unchanged (11).
- Dial component test: hover on/off calls `onOverlay`; touch tap → true, false after 4 s (fake timers).
- Live look sheet (CDP): rest · hover today · hover with `dateOverride` in the retrograde week · hover
  after a hard spin (freeze line moves) · mobile layout with tap reveal.
- Full suite + lint ratchet (0 errors, warnings ≤ current).

## 5. Risks checked, not assumed

1. **Longitude convention:** confirm the MDIS maps / `uvFromLonLat` are east-positive by checking that the
   Caloris ring lands on the visible basin in the first screenshot.
2. **Freeze line on crust:** see §3.4.
3. **Phone cost:** marks run only while revealed; zero at rest. Added to the phone gate checklist.

## 6. Out of scope

Landing-tab switch (separate spec, gated as in §2). Changes to the six existing instruments.
