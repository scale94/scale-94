# Shared GL Harness — Design

Date: 2026-07-26
Status: approved, phase 1 not started

## Problem

Three components hand-roll a WebGL renderer:

- `src/terminal/components/ObserverEye.jsx`
- `src/terminal/components/MercuryTerminator.jsx`
- `src/terminal/lunar/LunarShaderMoon.jsx`

The first two are near-identical copies of the same skeleton. The third was
written later against `src/terminal/lunar/glContext.js` and diverged. In
diverging it **lost the rAF watchdog** (so it cannot be driven from a
suspended-rAF preview pane — the recurring screenshot trap) and **lost the
`WEBGL_lose_context` teardown** (it frees GL objects but never the context).

The divergences are invisible today: they are spread across three files with no
single place that says how the renderers differ. That is how the moon's watchdog
went missing without anyone noticing.

Every shader in the codebase is the same shape — a fullscreen quad, a fragment
shader, a square canvas, uniforms pushed per frame. The moon adds a one-time
bake pass. Planned shaders (ambient particles, the WorldMap scan layer, a sun)
fit the same shape. The harness can therefore be narrow and honest rather than a
general GL abstraction.

### Current divergence

| | ObserverEye / MercuryTerminator | LunarShaderMoon |
|---|---|---|
| Context | WebGL1, straight alpha, AA on | WebGL2, premultiplied, AA off, `low-power` |
| Errors | silent in prod, `console.error` in DEV, no link check | throws with driver info log |
| Loop | rAF + 40ms watchdog | plain rAF, no watchdog |
| Idle | none | 30fps throttle at rest + `visibilitychange` |
| Reduced motion | halt the loop, expose a snap-repaint | keep looping, freeze `uTime` |
| Teardown | `WEBGL_lose_context` | deletes objects only |
| Fallback | none (blank canvas) | support probe → Canvas2D moon |
| Tests | smoke only — the GL path never runs | stub-GL exercises build + teardown |

## Goal

Phase 1 is a **pure extraction with zero behavior change**, verified. Phase 2
converges the divergences, one at a time, each independently reviewable.

Phase 1's deliverable is **not** less code. Extraction plus goldens will add
lines. The deliverable is an enumerated list of every way the three renderers
disagree, in one place, as flags. Phase 2 becomes "delete flag N, verify"
instead of an archaeology project. The line-count win arrives on shader #4.

**If the flag count does not shrink in phase 2, the harness was a mistake.**

## Architecture

Three new files in `src/terminal/gl/`. Co-located rather than split across
`hooks/` — the hook is meaningless without the two modules.

### `glHost.js` — pure, no React

```js
createShaderHost(canvas, {
  version,                 // 1 | 2
  contextOptions,          // passed straight through to getContext
  vs, fs,                  // shader source
  uniforms,                // string[] → harvested into a U map
  pixelSize,               // CSS px (square); DPR clamp of 2 applied inside
  setStyleSize,            // also write canvas.style.width/height
  blend,                   // 'straight' | 'premultiplied' | null
  loseContextOnDispose,    // bool
  onError,                 // 'throw' | 'warn'
}) → { gl, prog, U, draw(), dispose() } | null
```

Owns: context creation, compile + link, the fullscreen quad, uniform location
harvesting, DPR sizing, blend setup, teardown.

Returns `null` when no context is available; the caller decides the fallback.

WebGL1 takes the `attribute vec2 a` + `getAttribLocation` path. WebGL2 takes the
VAO + `layout(location = 0)` path. Both end in the same 4-vertex
`TRIANGLE_STRIP`.

`onError: 'throw'` surfaces the driver info log as a thrown `Error` (current
lunar behavior — a silently-null program renders black, which is
indistinguishable from the rAF trap). `onError: 'warn'` logs in DEV and returns
anyway (current eye/terminator behavior). Link status is checked under both;
under `'warn'` a link failure logs rather than throws.

### `frameLoop.js` — pure, no React

```js
createFrameLoop({
  onFrame,                 // (now, dt, { hidden }) => void
  watchdogMs,              // number | null
  trackVisibility,         // bool — adds a visibilitychange listener
  reducedMotion,           // 'halt' | 'freeze' | 'ignore'
  now,                     // injectable clock (defaults to performance.now)
  raf, caf,                // injectable (default to window)
}) → { start(), stop(), isRunning() }
```

Owns: rAF scheduling, the optional 40ms watchdog, reduced-motion policy, and
optional `visibilitychange` tracking. The `hidden` flag is passed to `onFrame`
because the moon's adaptation step consumes it.

The injectable clock and rAF are what make the parity test deterministic. This
is a load-bearing design decision, not a convenience.

**Constraint: the loop must schedule the next rAF at the top of the frame,
before invoking `onFrame`.** The moon schedules at the top; the eye and
terminator schedule at the bottom, after drawing. This looks cosmetic and is
not. The moon's idle throttle is an early `return` from the frame body before
`drawArrays`, so under bottom-scheduling the first throttled frame would fail to
queue a successor and the animation would stop permanently.

The goldens cannot catch this — they record GL calls, and `requestAnimationFrame`
is not a GL call. It therefore needs a dedicated test: drive a component past a
throttled frame and assert the loop is still running.

### `useShaderCanvas.js` — the React seam

```js
useShaderCanvas(canvasRef, {
  ...hostOptions,
  onInit,                  // (host) => void — the moon's bake pass
  draw,                    // (host, { now, dt, tsec, hidden }) => void
  reducedMotion,           // 'halt' | 'freeze'
  onSnap,                  // (host) => void — reduced-motion repaint
  onUnsupported,           // () => void — the moon's setSupported(false)
  deps,                    // effect deps (all three currently key on size)
}) → { snap() }
```

Effect body: create host → if `null`, call `onUnsupported()` and bail → `onInit`
→ draw one frame at `t = 0` **if `initialDraw`** → create loop → start unless
halted → return dispose.

`snap()` is returned so each component's existing props-sync effect can trigger
a reduced-motion repaint, preserving the current `snapRef` pattern.

### What stays in the components

Per-frame easing is **not** shared, because it is genuinely per-component:

- the eye's colour/focus/gaze lerps and `deriveCols` tint blending
- the terminator's flare decay and the retrograde one-shot
- the moon's dark adaptation stepping and 30fps idle throttle

In phase 1 this moves **verbatim** into each component's `draw` callback.
Nothing is restructured. Phase 2 extracts the eye's and terminator's easing into
pure tested modules, matching how lunar already separates `lunarEphemeris.js`
and `darkAdaptation.js`.

## The flags

Every current divergence survives phase 1 as an option, or it isn't a no-op:

1. `version` — 1 (eye, terminator) vs 2 (moon)
2. `contextOptions` — alpha/premultiplied/antialias/depth/stencil/powerPreference
3. `blend` — `'straight'` vs `'premultiplied'`
4. `onError` — `'warn'` vs `'throw'`
5. `setStyleSize` — moon only
6. `loseContextOnDispose` — `true` for eye/terminator, `false` for moon
7. `watchdogMs` — `40` vs `null`
8. `trackVisibility` — moon only
9. `reducedMotion` — `'halt'` vs `'freeze'`; `onSnap` is implied by `'halt'` and
   is not counted separately
10. `onInit` — moon only (bake pass)
11. `onUnsupported` — moon only (Canvas2D fallback)
12. `dtClamp` and first-frame dt — eye/terminator clamp to `0.05` and seed
    `last = performance.now()` (first dt is small but non-zero); the moon clamps
    to `0.25` and seeds `lastT = 0` (first dt is exactly `0`)
13. `initialDraw` — eye and terminator call `render(0)` synchronously before
    starting the loop; the moon does not, and paints first inside its first rAF
    frame

**Thirteen knobs.** Accepted with eyes open: an over-parameterized harness can
be worse than duplication. The justification is that each knob is a fact about
the code that is true today whether or not it is named, and phase 2 exists to
delete them.

Two candidate flags were **rejected** rather than accepted:

- The moon's 30fps idle throttle is a draw-body concern, not a loop concern. It
  stays inside the moon's `draw` callback.
- The canvas size multipliers (moon 1.25×, eye 0.58×, terminator 1×) are not a
  flag — the caller computes `pixelSize`.

### The reduced-motion fork

Under `prefers-reduced-motion` the eye and terminator **halt the loop entirely**
and expose a snap-repaint; the moon **keeps looping** and freezes `uTime`. These
are different philosophies, not an oversight. Phase 1 preserves both. Phase 2
must pick one.

Note the known consequence documented in `MercuryTerminator.jsx`: under halt,
the retrograde arming guard never fires, so an earned token can be left set with
no visible event. Phase 1 does not change this.

## Proving the no-op

`src/terminal/gl/__tests__/recordingGL.js` extends the existing stub in
`src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx` into a recorder: every
GL call captured as `[method, ...args]`, with `performance.now` and
`requestAnimationFrame` mocked to a fixed step.

For each of the three components: render with fixed props, drive a fixed N
frames at fixed dt, serialize the ordered call log including uniform values, and
compare against a committed golden file. N must be large enough that the easing
has visibly moved but not settled (the interesting values are the intermediate
ones); 60 frames at dt = 16ms is the default unless a component needs more.

**Sequencing is the whole trick and the implementation plan must enforce it:**
goldens are generated from the *current* code and committed in their own commit,
before a single line of harness exists. The refactor must then reproduce them
exactly.

Determinism holds: the easing is `Math.pow(0.004, dt)` against an injected
clock, libration is a pure function of `timestamp`, and no draw path calls
`Math.random`. Float uniform values are therefore reproducible.

This catches a swapped blend mode, a reordered `useProgram`, or a dropped
uniform — none of which a screenshot would reliably reveal.

### What the goldens cannot catch

The log records GL calls only. Anything that governs *whether the next frame
happens* is invisible to it: rAF scheduling position, watchdog behavior, the
`visibilitychange` listener, teardown completeness. Those need their own
assertions — see the scheduling constraint under `frameLoop.js`, and the
existing listener-balance tests in
`src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx`, which should be
generalized to all three components.

Float determinism is assumed, not proved: it holds only if the harness computes
`dt` with the same operations in the same order as the code it replaces, which
is why the `dtClamp` and first-frame-dt divergence is a named flag rather than
something normalized away. If a golden ever fails on a last-ulp difference, that
is a signal the dt path changed, not noise to be papered over with a tolerance.

## Migration order

1. **MercuryTerminator** — simplest, and its GL path has zero coverage today, so
   the golden is a real gain on its own.
2. **LunarShaderMoon** — the stress case (WebGL2, bake pass, fallback,
   visibility tracking, the `'freeze'` policy). Second, not last: if the harness
   API is wrong, this is where it shows, and there is then only one migration to
   redo rather than two.
3. **ObserverEye** — same family as the terminator, plus the SVG lens wrapper
   and the tint-derived palette.

## Out of scope

- `MercuryCanvas` and the r3f elemental scenes — three.js owns its own context.
- `LunarCanvasMoon` — the Canvas2D A/B reference, deliberately kept.
- `ArtTab`, `KuramotoVisualizer`, `AmbientParticles`, `WorldMap` — Canvas2D and
  SVG, not shaders. They are candidates to *consume* the harness later.
- Any new shader. Ambient particles and a sun consume this later; they do not
  get to shape it now.
- Phase 2 convergence itself, which gets its own spec.

## Done means

- Call-log goldens byte-identical for all three components.
- The 766 existing tests still green, plus the new parity tests.
- Author's own look at the eye, the terminator, and the moon on the live site.
- A phase 2 backlog written as one item per flag.

## Phase 2 backlog (not this spec)

One item per flag, each independently reviewable. Expected early candidates:

- Give the moon the watchdog (makes it screenshot-able from a preview pane).
- Give the moon `WEBGL_lose_context` on dispose.
- Give the eye and terminator real link-error surfacing.
- Pick one reduced-motion policy for all three.
- Extract the eye's and terminator's easing into pure tested modules.
