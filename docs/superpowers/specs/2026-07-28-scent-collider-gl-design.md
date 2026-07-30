# /SCENT — Collider Chamber on WebGL

Date: 2026-07-28
Status: approved, ready for planning
Branch: `feature/scent-collider-gl`

Renames the `scaling` tab's chrome to `/SCENT`, and replaces the Canvas2D
collision chamber inside `LatentCollider.jsx` with a two-pass WebGL renderer
built on the shared harness (`src/terminal/gl/`).

---

## 1. What exists today

The tab body already reads `SAPONIFICATION` (`ScalingTab.jsx:112`, from the
2026-05-21 monument spec). What still says "Scaling" is the chrome: the desktop
nav button and its `Scale` icon (`App.jsx:1148`), the mobile bar icon
(`App.jsx:1401`), and the route `~/system/scaling`.

The chamber is a 220px-tall, full-width letterbox (`LatentCollider.jsx:2007`)
holding a `<canvas>` driven by a ~350-line Canvas2D loop
(`LatentCollider.jsx:1597-1951`). It draws, per frame: a line grid, a radial
zone gradient, a crosshair, two beamlines with `fillText` labels, converging
orbs, a screen shake, two shockwave rings, up to 300 CPU-simulated particles,
a white flash, 16 dimension beams, and a metrics overlay (`cos(θ)`, `θ`, a
novelty bar) also drawn with `fillText`.

`LatentCollider.jsx` is 4394 lines and has **zero tests**.

### 1.1 The frame-counter defect

The loop is driven by a frame counter, not a clock:

```js
const t = timerRef.current++;              // :1624
const progress = Math.min(1, t / 108);     // :1689  "~1800ms at 60fps"
if (ph === 'colliding' && t > 150) { ... } // :1939
const elapsed = (frameT - startedAt) * 16; // :1095  "assuming ~16ms per frame"
```

Every duration in the chamber is expressed in frames. On a 120Hz display the
entire collision plays at **double speed** — the 1800ms acceleration takes
900ms. This is not a rendering problem and it is the likely cause of the
sequence reading as abrupt. The port fixes it as a side effect of moving to the
harness, which supplies a real `dt`.

---

## 2. Non-goals

- No change to the collision *maths* (`collide()`, `buildPerfumeCard`, the
  narrative engine, the Tesseract pipeline). This is a renderer and a rename.
- No post-processing FBO. See §5.2.
- No rename of the internal tab key `'scaling'`. It threads through
  `NAV_TINTS`, `resolveEyeState`, the vertebrae guard and the `scaling_visit`
  bus channel; renaming it buys nothing visible and widens the diff across ~10
  files and their tests.
- No multi-program API on `glHost.js`. See §4.3.
- Not a decomposition of the rest of `LatentCollider.jsx`. Only the chamber
  comes out.

---

## 3. Naming and icon

| Surface | Before | After |
|---|---|---|
| Desktop nav label | `/Scaling` | `/SCENT` |
| Desktop nav icon | `Scale` (lucide) | custom glyph, §3.1 |
| Mobile bar icon | `Scale` | same custom glyph |
| `aria-label` | `Scaling` | `Scent` |
| Route | `~/system/scaling` | `~/system/scent` |
| Tab body header | `SAPONIFICATION` | unchanged |
| Internal tab key | `'scaling'` | unchanged |

`~/system/scaling` remains accepted as a silent alias so existing deep links
and the `scaling` / `services` terminal aliases (`content/system_logs/HELP.md:11`)
keep working; `scent` and `saponification` are added as aliases.

The nav reads `/SCENT` rather than `/SAPONIFICATION` (15 chars in a row already
holding 10+ buttons) or `/SAPON.` (a truncation reads as a bug). Plain door,
strange room: the nav says what it is, the header says what it means.

### 3.1 Icon

Rendered at `w-3 h-3` (12px) desktop and `w-5 h-5` (20px) mobile. **At 12px
only 2–3 strokes stay legible** — the two-droplets-merging-into-a-wisp glyph
considered first is mush at that size.

Ship: a single droplet outline with one rising wisp curve above it. Two paths,
24-unit viewBox, `stroke-width: 2`, round caps — lucide's stroke language, so
it sits correctly beside `Lock`, `Radio` and `Waves` in the same row. Lives in
`src/terminal/components/icons/ScentGlyph.jsx`.

---

## 4. Architecture

Two passes into one canvas, both inside a single `draw()` callback.

```
 pass 1  field       host quad, TRIANGLE_STRIP, blend: straight
         grid · zone glow · crosshair · beamlines · rings · flash · 16 beams
 pass 2  particles   own buffer, gl.POINTS, blend: additive (ONE, ONE)
         streams · sparks · chimera · vapor
 DOM     overlay     cos(θ) · θ · NOVELTY bar · domain labels · idle · loading
```

### 4.1 Harness changes (`glHost.js`)

Two strictly additive changes, both defaulted to today's behaviour:

1. **`pixelSize` accepts `{ w, h }`.** Today it is a scalar and both
   `canvas.width` and `canvas.height` are set from it — i.e. **square canvases
   only**. The chamber is a letterbox. A scalar continues to mean square.
2. **`host.resize(w, h)`.** Sets the backing store and `gl.viewport` without
   rebuilding. Without it a fluid-width chamber would recompile both programs
   on every resize tick, since `pixelSize` is read once at build time.

Neither changes a single GL call for an existing consumer. The acceptance
proof is that all six frozen `glParity` snapshots stay byte-identical.

### 4.2 Chamber host options

New consumer, so it adopts the policies the phase-2 backlog recommends rather
than inheriting drift:

| Option | Value | Why |
|---|---|---|
| `version` | `2` | VAOs, `layout(location=)` |
| `strategy` | `'lunar'` | shader errors throw with the driver log (backlog #1) |
| `watchdogMs` | `40` | the suspended-rAF pane trap (backlog #2) |
| `trackVisibility` | `true` | backlog #9 |
| `loseContextOnDispose` | `true` | backlog #3 |
| `haltOnReducedMotion` | `true` + `onSnap` | backlog #4 — **see §6.2** |
| `blend` | `'straight'` | pass 1; pass 2 sets additive itself |
| `deps` | `[]` | **see §6.3** |
| `onUnsupported` | provided | backlog #10 — falls back to a static CSS field |

### 4.3 The second program

Pass 2 needs its own program and its own attribute buffer. `glHost` builds one
program and one quad.

The component builds the particle program and buffer itself inside `onInit`
using the raw `gl` it is handed, and frees them in `onDispose` — the precedent
`LunarShaderMoon`'s bake pass already set. `glHost` does **not** grow a
multi-program API for a single consumer. Log it in the phase-2 backlog as a
now-measured requirement, to extract when a second consumer appears.

---

## 5. Rendering

### 5.1 Pass 1 — the field

One fragment shader over the host's existing quad, everything analytic:

- background grid, zone glow, crosshair
- two beamlines, hue-driven by `uHueA` / `uHueB`
- shockwave rings and the impact flash, driven by `uPhaseT`
- the 16 dimension beams as `uniform vec4 uBeams[16]` — `(angle, mag, hue,
  lifespanSec)` — evaluated as distance-to-ray per fragment. Cheap at 220px.
- **an ordered dither on the final colour.** Today's chamber is built from
  `createRadialGradient` over near-black, which bands on OLED. This is the
  single most valuable line in the pass.

### 5.2 Pass 2 — particles, and why there is no bloom pass

Soft radial sprites (`gl_PointCoord` falloff) with additive blending. Density
sums: where streams converge the core blows out to white on its own. The
localized "soft neon bloom at the impact zone" is a **shaped analytic term in
the field shader**, which gives exact control over the glow boundary — better
than blurring whatever happens to be bright.

A real bloom is bright-pass + separable blur + composite: two FBOs and three
more programs, for a 220px-tall strip. Deferred. If the live look reads flat or
lacks analog bleed, escalating to an FBO pass is a contained follow-up ticket.

### 5.3 Particle motion — analytic, stateless

One static `Float32Array` of `vec4` seeds, built once at mount (4096 × 16B =
**64KB, uploaded once**), never touched again. Per particle:

```
aSeed = (lane ∈ [-1,1], birthPhase ∈ [0,1), hash1, hash2)
```

The **vertex shader** derives position from `uPhase` + `uPhaseT`:

- **accelerating** — longitudinal `s = fract(birthPhase + t·speed)`, with the
  existing easeInCubic ramp so tension still builds.
  - *helical tightening*: transverse offset `r(s)·(cos θ, sin θ)`, with
    `θ = s·twist + hash1·τ` and `r(s) = laneRadius·(1-s)^k` — the stream screws
    inward and tightens as it approaches the threshold.
  - *turbulence*: a 2D curl-noise deflection whose amplitude ramps with `s`.
    ~20 lines of GLSL, no texture.
- **colliding** — the same vertices are re-tasked by `hash2` into three
  populations with zero reallocation: sparks (radial, drag), chimera (orbiting,
  hue blended between A and B), vapor (buoyant, amber, lateral drift). Replaying
  a collision is `uPhaseT = 0`.
- **idle / selecting** — low-density ambient drift along the beamlines, alpha
  gated by `hash1`, so the chamber is never dead.

Budget 4096 (from 300). Two streams, not "thousands of streams" — but at
~1000×220 that is one particle per ~54px², genuinely dense.

**Ingress clipping.** `gl.POINTS` are culled on their *centre*, not their
bounds, so a sprite entering at `x=0` pops in at full size instead of sliding
in. Streams enter at both edges, so this would be visible. Mitigation: alpha
fades in over the first 3% of `s`, and `gl_PointSize` is clamped to ≤32 — which
also avoids ANGLE's large-point quirks on Windows.

---

## 6. Timing, phases, and three corrections

### 6.1 `colliderPhases.js` owns curves, not the graph

An earlier draft of this design claimed a pure module could own "elapsed ms →
phase." That is wrong. Six of the seven transitions are **event**-driven, not
time-driven:

| Transition | Driver | Site |
|---|---|---|
| `idle → selecting` | user selects a domain | `:1555`, `:1574` |
| `selecting → accelerating` | user fires | `:1357` |
| `accelerating → colliding` | async collide() resolves | `:1487` |
| `colliding → result` | **elapsed time** | `:1939` |
| `* → idle` | reset | `:1540`, `:1588` |

So the pure module's real scope is *timing within a phase*:
`(phase, elapsedMs) → { progress, ease, ringT, flashA, beamElapsed }`. The state
graph stays in the component, where its event sources are. Small and honest, and
fully unit-testable.

### 6.2 No state transition may live in `draw()`

`phaseRef.current = 'result'` currently fires **inside the render loop**
(`:1939-1942`). Combined with `haltOnReducedMotion: true`, the loop never
starts, the phase never advances, and **the result card never appears** for
reduced-motion users. The same hole opens whenever rAF is suspended — this
project's recurring pane trap.

The `colliding → result` transition moves to a phase-keyed effect with an
explicit timer, independent of whether any frame ever renders. `onSnap` then
paints one static frame for the current phase, and correctness no longer depends
on it.

This is a rule, not a patch: **the render loop may read state and must never
write it.**

### 6.3 Rebuild on domain change

Today's effect deps are `[domainA, domainB]` — the loop tears down and restarts
on every selection (resetting neither the particle array nor the frame counter,
so the restart accomplishes nothing). Under GL that would recompile both
programs on every click. Hues become `uHueA` / `uHueB` uniforms and `deps` is
`[]`. Behaviour change: the loop no longer restarts on selection.

### 6.4 Beam clock

`drawDimensionBeams` lazily assigns `beamsState.startedAt` during its first
draw (`:1093`). Under a suspended rAF the beams' clock therefore starts on
*visibility*, not at impact. The timestamp is captured at the transition that
populates `beamsRef` instead.

---

## 7. DOM overlay

`cos(θ)`, `θ`, the `NOVELTY` bar and label, and the two beamline domain
short-names leave the canvas and become absolutely-positioned DOM inside the
chamber container.

- `pointer-events: none` on the overlay root. Verified safe: the chamber has no
  handlers of its own and both existing overlays are already
  `pointer-events-none`. **Cost:** the readouts stop being selectable. Accepted
  — they are 8–10px telemetry, not content.
- Position, size, tracking and colour match the canvas coordinates exactly.
- **The font family deliberately does not match.** Today's calls are `9px
  monospace` — the *generic* family (`:1670`, `:1682`, `:1916`, `:1931`), not
  the project's Geist Mono stack. The DOM readouts use Geist Mono and will look
  different and better. Matching exactly would mean shipping the browser's
  default mono on purpose.
- The novelty bar becomes a div with a width transition, not two `fillRect`s.

---

## 8. Files

| Path | Action |
|---|---|
| `src/terminal/gl/glHost.js` | MODIFY — rect `pixelSize`, `resize()` |
| `src/terminal/gl/__tests__/glHost.test.js` | MODIFY — cases for both |
| `src/terminal/collider/ColliderChamber.jsx` | NEW — GL component + DOM overlay |
| `src/terminal/collider/colliderPhases.js` | NEW — pure timing curves (§6.1) |
| `src/terminal/collider/particleSeeds.js` | NEW — pure deterministic seed buffer |
| `src/terminal/collider/fieldShader.js` | NEW — pass 1 sources |
| `src/terminal/collider/particleShader.js` | NEW — pass 2 sources |
| `src/terminal/components/icons/ScentGlyph.jsx` | NEW — the icon |
| `src/terminal/views/LatentCollider.jsx` | MODIFY — delete ~350 lines, mount the chamber, move the `→ result` transition out of `draw()` |
| `src/terminal/App.jsx` | MODIFY — nav label, icon, aria-label, route + alias |
| `content/system_logs/HELP.md` | MODIFY — command aliases |
| `docs/.../2026-07-26-shared-gl-harness-phase2-backlog.md` | MODIFY — log multi-program as measured (§4.3) |

---

## 9. Verification

1. **Pure units** — `colliderPhases.test.js` (curve values at known elapsed
   times, including the 120Hz-independence property), `particleSeeds.test.js`
   (determinism, range, buffer length).
2. **Call-log parity** — `colliderChamberParity.test.jsx`, using the existing
   `recordingGL` / `driveFrames` toolkit: a frozen snapshot of init + N frames
   per phase. Analytic particles make every uniform a pure function of
   `(seed, t, phase)`, so this is deterministic in the same way phase 1 was.
3. **Additivity proof** — all six existing `glParity` snapshots stay
   **byte-identical**, with `-u` never used. Baseline confirmed clean at
   branch point.
4. **Reduced motion** — `matchMedia` stubbed to `{ matches: true }`: assert the
   loop never starts, `onSnap` paints once, and — the §6.2 defect —
   **`colliding` still advances to `result`**.
5. **Browser** — dev server, run a collision, confirm: the sequence takes its
   real ~1800ms on a high-refresh display; no ingress pop at the chamber edges;
   no banding in the zone glow; DOM readouts land on their canvas coordinates.
6. **Author's live look** — nothing above proves it is beautiful.

---

## 10. Deferred

- FBO bloom pass, if the analytic glow reads flat (§5.2).
- Full rename of the internal `'scaling'` key (§2).
- The rest of `LatentCollider.jsx`'s 4012 lines. The next seam is the phase
  graph: seven hand-maintained `phaseRef.current = X` / `setPhase(X)` /
  `setPhaseStart(...)` triples, of which `phaseRef` now has **no readers at
  all** — its only reader was the deleted `_draw()`. A two-line reducer would
  delete that dead ref and make "every transition stamps its start time"
  enforceable rather than remembered.
- `glHost` multi-program support — see the phase-2 backlog §12. Resolved
  partway: `buildProgram` is now shared and `LunarShaderMoon` migrated onto it.
  The *second-program lifecycle* is still hand-rolled twice, deliberately: the
  moon's is transient, the chamber's persistent.

### 10.1 OPEN — three visuals dropped in the port, author's decision

Found by the final whole-branch review, after the work shipped. All three are
in §1's inventory of what the Canvas2D loop drew, and none reached §4/§5.1's
pass-1 list. They were not consciously cut — nothing anywhere records a
decision — and two carry direct evidence of being planned and abandoned:

1. **The converging domain orbs.** Two radial-gradient orbs with bright cores
   easing from the walls to ±100px of centre over the full 1800ms. This was the
   *primary* visual of the acceleration phase; what ships is streams only.
2. **The impact screen shake.** `colliderPhases.js` still computes `shake`, and
   `colliderPhases.test.js` still asserts it — but nothing uploads it and
   neither shader has a shake term. Two lines in the field shader (offset `px`
   by a hash-driven vector scaled by `shake`) would restore it.
3. **The cosine-similarity arc.** A stroked arc sweeping `θ` at `(cx, cy+50)`,
   `r = min(w,h) * 0.15`. §7 correctly excluded it from the DOM migration
   because it is a graphic, but nothing put it into pass 1 either — and
   `ColliderChamber` uploads `T.metrics` into `uBurst.w` every frame while
   `fieldShader` reads `.x`, `.y`, `.z` and never `.w`. That unread component
   is the residue of this feature.

Restoring any of them is cheap and self-contained. Deleting the dead `shake`
field, its test, and the `uBurst.w` upload is cheaper still. Either is fine;
leaving the half-built plumbing in place is not.

### 10.2 Population mix changed, unrecorded

The original spawned roughly 69% sparks / 22% jets / 5% chimera / 3% vapor.
`role = h2 * 2.0` with cuts at 0.9/1.1/1.6 gives **45/10/25/20** on a buffer
13× larger — chimera is 5× and vapor 6.7× their original *share*. Almost
certainly the intent of "budget 4096 (from 300)", but it is the number to reach
for if the impact ever reads weak: the sparks are faithfully sized at 1.5–3.5px
and now compete against ~1024 chimera sprites at 5–11px.
