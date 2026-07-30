# Shared GL Harness — Phase 2 Backlog

Date: 2026-07-26
Status: backlog, phase 1 complete

Phase 1 (tasks 1-9, branch `feature/gl-harness`) extracted `glHost.js`,
`frameLoop.js`, and `useShaderCanvas.js`, migrated `MercuryTerminator`,
`LunarShaderMoon`, and `ObserverEye` onto them with zero behavior change
(frozen GL call-log snapshots, byte-identical), and machine-checked the
resulting divergence in
`src/terminal/gl/__tests__/convergence.test.jsx`.

Per the design doc's own success criterion: **if the flag count does not
shrink in phase 2, the harness was a mistake.** This document is that
shrinking, planned. One item per flag. Each is independently reviewable —
land them one at a time, not as a batch.

Every item below names the `convergence.test.jsx` test that flips when the
item ships. That test failing after the change (with the assertion updated
to match) is the acceptance criterion; the test failing *without* a
corresponding code change is a regression.

---

## 1. `strategy` — collapse `'legacy'` into `'lunar'`

**Current divergence:** `MercuryTerminator` and `ObserverEye` use
`strategy: 'legacy'` (silent-in-prod, `console.error`-in-DEV shader
errors, no link-status check); `LunarShaderMoon` uses `strategy: 'lunar'`
(throws with the driver's info log on compile or link failure).

**Which value should win:** `'lunar'`. A shader that fails to compile
under `'legacy'` renders a black canvas — indistinguishable from the
suspended-rAF trap this whole harness exists to defend against. Real error
surfacing is strictly more useful in every environment, including
production (an `Error` from a broken build is more actionable than a
silent black hexagon).

**What breaks if it changes:** `glHost.js`'s `buildLegacy` path currently
never checks `LINK_STATUS` and never calls `getShaderInfoLog` outside DEV —
converging removes `buildLegacy` entirely (or makes it call `buildLunar`
under the hood) and every shader error becomes a thrown exception instead
of a warning. Any latent shader bug in `MercuryTerminator.jsx` or
`ObserverEye.jsx` that has been silently rendering black will now throw at
mount — this is a *feature* of the change, but it means the migration
cannot be verified by the frozen `frames`/`init` snapshots alone (they only
exercise the success path); it needs a dedicated test that intentionally
breaks a shader source string for each component and asserts a thrown
`Error`, mirroring `useShaderCanvas.test.jsx`'s existing lunar-compile-
failure test.

**What would prove it safe:** all three components' existing shader
sources still compile and link without throwing (i.e. `glParity.test.jsx`
and `convergence.test.jsx` stay green with no snapshot update), plus a new
test per component that swaps in an intentionally-broken `fs` string and
asserts `onUnsupported` fires with a thrown/caught error carrying the
driver's log — the same shape as the existing lunar case in
`useShaderCanvas.test.jsx`.

**Which test flips:** `backlog #1 — strategy` in `convergence.test.jsx`
(both `M.strategy` and `O.strategy` change from `'legacy'` to `'lunar'`).

---

## 2. `watchdogMs` — give the moon `40`

**Current divergence:** `MercuryTerminator` and `ObserverEye` pass
`watchdogMs: 40`; `LunarShaderMoon` passes `watchdogMs: null`.

**Which value should win:** `40`. This is additive, not a behavior
change under normal conditions — `frameLoop.js`'s watchdog only fires when
the scheduled rAF from `schedule()` doesn't arrive within `watchdogMs`, so
on a live tab with a healthy compositor it never triggers. It is the fix
for a real, named problem: this project's recurring "screenshot trap" —
a hidden/embedded preview pane suspends `requestAnimationFrame` while
still compositing, and every prior debugging session on the moon's tab has
had to work around that blind spot (see `project_lunar_doctrine_register.md`
and `project_ship_2026_07_15.md` in memory — "screenshot trap SOLVED" /
"pane-probe toolkit" were built *around* this gap, not by closing it).

**What breaks if it changes:** nothing behaviorally on a live tab. The
risk is a *false-positive* watchdog fire in an environment where rAF is
merely slow (not suspended) — e.g. a heavily throttled CPU. 40ms is
already MercuryTerminator's and ObserverEye's proven value in production,
so this is inheriting a tested constant, not inventing one.

**What would prove it safe:** `frameLoop.test.js` already covers watchdog
firing/cancellation generically (it is loop-agnostic); confirm the moon's
existing tests (`LunarShaderMoon.test.jsx`, the idle-throttle liveness
tests in `glParity.test.jsx`) still pass, since the watchdog changes
nothing about `dt`/`draw` semantics — it only adds a fallback scheduler.
Then the real proof is the author's own look: drive the Lunar tab inside
a suspended-rAF preview pane (the exact repro from the design doc) and
confirm the moon now renders where it previously went blank.

**Which test flips:** `backlog #2 — watchdogMs` in `convergence.test.jsx`
(`L.watchdogMs` changes from `null` to `40`). Falsified live during task 9
— see the task report for the observed failure and revert.

---

## 3. `loseContextOnDispose` — give the moon `true`

**Current divergence:** `MercuryTerminator` and `ObserverEye` pass
`loseContextOnDispose: true` (the terminator explicitly, the eye by
inheriting `glHost.js`'s default); `LunarShaderMoon` explicitly passes
`false`.

**Which value should win:** `true`. The moon frees its GL objects
(`deleteTexture`, `deleteProgram`, `deleteBuffer`, `deleteVertexArray` via
`onDispose`/`dispose()`) but never releases the context itself. On a page
that mounts/unmounts the Lunar tab repeatedly (tab switching, phase-jump
remounts), this leaks one WebGL2 context per unmount until the browser's
context-limit eviction kicks in — a real, if slow-burning, resource leak.

**What breaks if it changes:** none of the moon's own logic depends on
keeping the context alive post-unmount — `onDispose` already assumes
teardown is terminal (it deletes the bake texture unconditionally). The
only risk is timing: `WEBGL_lose_context`'s `loseContext()` is
synchronous-looking but the actual context loss event fires
asynchronously in a real browser; if any code path assumed the context
stayed valid for one more tick after unmount, it would now see a lost
context instead. A search of `LunarShaderMoon.jsx` shows no such
assumption — `dispose()` order in `useShaderCanvas.js` already stops the
loop before disposing the host, so no frame can run after `loseContext()`.

**What would prove it safe:** the existing `installRecordingGL` stub
doesn't model asynchronous context-loss events, so the strongest evidence
available in this test suite is exactly what `convergence.test.jsx`'s
sibling behavioral check would show — `rec.log` containing `loseContext`
on unmount, with no GL calls logged afterward. Beyond that, the author's
own look: mount and unmount the Lunar tab several times in a row on the
live site and confirm no console warnings about exceeding the
context-limit (Chrome logs `WARNING: Too many active WebGL contexts` past
~16 live contexts).

**Which test flips:** `backlog #3 — loseContextOnDispose` in
`convergence.test.jsx` (`L.loseContextOnDispose` changes from `false` to
`true`).

---

## 4. `reducedMotion` policy — pick one for all three

**Current divergence:** `MercuryTerminator` and `ObserverEye` pass
`haltOnReducedMotion: true` and supply `onSnap` — under
`prefers-reduced-motion`, `frameLoop.start()` never starts the loop at
all, and each component's props-sync effect calls `snap()` to paint one
static frame reflecting the current target state. `LunarShaderMoon` passes
`haltOnReducedMotion: false` and no `onSnap` — the loop keeps running every
frame, but inside `draw()` the component freezes `uTime` to `0` under
`reducedMotion` (comment: "Frozen under reduced motion: stars stop
twinkling... a fixed dither is still a dither") while every other
uniform (`uAdapt`, libration, radius) keeps updating from live props.

**Which value should win:** `'halt'` (the eye/terminator policy), on
consistency grounds alone.

**It does not fix the retrograde defect — do not skip that work.** An
earlier draft of this item claimed converging to `'halt'` would fix
`MercuryTerminator`'s "retrograde token left set with no visible event"
defect for free. That has the causality backwards. Mercury is *already*
on `haltOnReducedMotion: true` (`MercuryTerminator.jsx:94`), so the defect
exists **because of** the current policy, not despite it; converging the
*moon* changes nothing for Mercury. Nor would converging the other way
help: the arming guard at `MercuryTerminator.jsx:139` is
`if (r && r.ts !== cur.retroTs && !reducedMotion)`, which independently
blocks arming whenever `reducedMotion` is true — so even under `'freeze'`,
with the loop running, the token would still never arm.

Fixing it requires new code in `MercuryTerminator`'s `onSnap`, which today
(`:111-116`) never touches `retroRef` or `doneRef` at all: the snap path
must process a pending retrograde token as a one-shot — either play it as
a single static frame or explicitly drop it and call `onRetrogradeDone`
so the token is cleared rather than orphaned. Treat that as its own
sub-task with its own test, not as a side effect of the flag flip.

If the moon converges to `'halt'` too, its analogous per-frame
state (dark adaptation stepping, the 30fps idle throttle) needs the same
audit: does anything the moon computes only inside `draw()` need to fire
once on transition into reduced-motion, the way `onSnap` fires for the
other two? `stepAdapt` is probably fine (it's a converging low-pass, not a
one-shot), but `onAdaptChange` (the `propsRef.current.onAdaptChange?.(...)`
callback) would stop firing entirely under `'halt'` unless the moon grows
its own `onSnap` that calls it once.

**What breaks if it changes:** the moon's `draw()` currently reads
`reducedMotion` per-frame to decide whether to freeze `uTime`; if the loop
halts instead, that branch becomes dead code and should be removed, not
just left unreachable. The moon would need an `onSnap` implementation that
performs one static paint with the current `adaptState` and `uTime: 0`
mirroring what the eye/terminator do — this is new code, not a flag flip,
because the moon currently has no snap-repaint machinery at all.

**What would prove it safe:** `glParity.test.jsx` explicitly documents
(in its "Known gaps" header) that `prefers-reduced-motion` is *never*
exercised today because jsdom has no `matchMedia` — so the frozen
snapshots give zero coverage here regardless of which policy is chosen.
This item needs new tests that stub `window.matchMedia` to return
`matches: true` (the existing `useShaderCanvas.test.jsx` pattern, see its
`snap() invokes onSnap only under reduced motion` test) for all three
components, and assert: (a) the loop never starts (no `drawArrays` beyond
the one `onSnap`-triggered paint), (b) the retrograde-token-left-set defect
is gone for the terminator specifically (arm a retrograde token under
reduced motion, confirm it either fires once via snap or is explicitly
dropped, not silently orphaned), and (c) the moon's `onAdaptChange`
callback still fires at least once so downstream UI reading adaptation
state doesn't go stale.

**Which test flips:** `backlog #4 — reducedMotion policy` in
`convergence.test.jsx` (`L.haltOnReducedMotion` changes from `false` to
`true`, and `L.onSnap` changes from absent to a function).

**Already measured and locked (final review's fix wave, before phase 2
starts):** the harness migration changed ObserverEye's mount-time behavior
under reduced motion, invisible to `glParity.test.jsx` and worth recording
here so phase 2 doesn't re-discover or re-litigate it. Pre-migration, both
`ObserverEye` and `MercuryTerminator` declared their props-sync `useEffect`
*before* the GL effect; React fires effects in declaration order on mount, so
the snap-repaint ref was still unset when props-sync ran — the mount snap was
a guaranteed no-op. The migration (and a later backport to Mercury) moved
`useShaderCanvas(...)` above the props-sync effect, so the hook populates the
ref first and props-sync's `snap()` now actually fires. Measured with
`matchMedia` forced to `{ matches: true }`:
- old `ObserverEye`: **1** draw at mount, `c0` = `[56,189,248]/255` (raw
  `STATES.leaning`)
- new `ObserverEye`: **2** draws at mount, `c0` = `[56,189,248]/255` then
  `[255,90,30]/255` (`deriveCols(tint)`)
- `MercuryTerminator`: 1 → 2 draws, but `u_tw` identical both times — wasted
  work only, no visual change

This is a **correct** behavior change, kept deliberately: under reduced
motion the loop never starts, so the mount frame is the image permanently
until a prop changes, and the new behavior shows the suggested tab's hue
instead of generic leaning-cyan (real consumers:
`src/terminal/mercury/ElementSeal.jsx:34`,
`src/terminal/components/MercuryEyeIndicator.jsx:273`). The same divergence
applies to `gaze`, `constrict` and `pulse`, not just `tint`. Locked by
`src/terminal/gl/__tests__/observerEyeReducedMotionMount.test.jsx`, which
asserts both the draw count (2) and that the final `c0` is the tinted value,
not merely that a second draw happened. Mercury's analogous draw-count-only
change (wasted work, no visual delta) is not separately test-locked — a
lower-priority follow-up if item 4's terminator work touches this path.

---

## 5. `dtClamp` / `seedLast` — pick one dt policy

**Current divergence:** `MercuryTerminator` and `ObserverEye` use
`dtClamp: 0.05` (clamps a stalled frame's dt to 50ms) and `seedLast: 'now'`
(the first frame's `dt` is small-but-nonzero, seeded from
`performance.now()` at `start()`). `LunarShaderMoon` uses `dtClamp: 0.25`
(clamps to 250ms) and `seedLast: 'zero'` (the first frame's `dt` is exactly
`0`, per `frameLoop.js`'s `seeded` flag).

**Which value should win:** per the design doc, this is "pure drift, no
design intent" — meaning there is no documented reason for either specific
number, only a documented reason `frameLoop.js` needs *a* dt policy
(fixed-clock determinism for the parity tests). Recommend converging on
the moon's `seedLast: 'zero'` (a first-frame dt of exactly `0` is strictly
safer — it can never apply a spurious ease step before any prior frame
exists) and picking `dtClamp` empirically: `0.05` protects against a
250ms-old easing constant like `Math.pow(0.004, dt)` blowing past its
target in one jump on a stalled frame; `0.25` is closer to "one dropped
frame at low framerate is fine." Recommend `0.1` as a middle value, but
this is the one item in this backlog that is genuinely a judgment call
with no test that can settle it — flag for the author's own call rather
than a default "smallest wins" resolution.

**What breaks if it changes:** any easing computed as
`1 - Math.pow(k, dt)` (both the eye's and terminator's per-frame lerps) is
sensitive to `dtClamp` only in the pathological case of a genuinely
stalled frame — normal frames run well under either clamp. The moon's
`dtClamp: 0.25` combined with `seedLast: 'zero'` means its very first
"real" frame (second tick) could see a dt up to 250ms if the bake pass
inside `onInit` was slow; converging to `0.05` would make that dt look
like a normal frame instead, changing the observed rate of the *first*
adaptation step measurably (not corrupting it, since `stepAdapt` is a
continuous low-pass, but shifting where in its curve the first visible
frame lands).

**What would prove it safe:** `frameLoop.test.js` already parametrizes
`dtClamp`/`seedLast` generically; this item needs a test that mounts each
component with a synthetic multi-hundred-ms gap before the first frame
(simulating a slow `onInit`) and confirms the resulting `dt` is clamped to
whatever the new shared constant is, plus a rerun of the
`glParity.test.jsx` case with the new constant to see how many uniform
values shift in the regenerated `init`/`frames` diff (expect the diff to
be reviewed, not surprising).

**Which test flips:** `backlog #5 — dtClamp/seedLast` in
`convergence.test.jsx`.

---

## 6. `initialDraw` — decide whether a synchronous first paint is wanted

**Current divergence:** `MercuryTerminator` and `ObserverEye` pass
`initialDraw: true` — `useShaderCanvas.js` calls `draw(host, { now: 0, ... })`
synchronously inside the mount effect, before the loop starts.
`LunarShaderMoon` passes `initialDraw: false` — its first paint happens
inside the first rAF callback.

**Which value should win:** keep the divergence, or converge cautiously
toward `true` — but only after checking the moon's `onInit` bake pass
cost. The design doc's own caution stands: "Forcing the moon's loop-only
behavior onto the eye risks a one-frame blank on slow mounts" is the
argument *against* moving the eye/terminator to `false`; the inverse risk
(giving the moon `initialDraw: true`) is that its `draw()` callback reads
`adaptRef.current` and `surfaceTexRef.current`, both of which are set
inside `onInit` — since `onInit` always runs before `initialDraw`'s call
in `useShaderCanvas.js`'s effect body, this is probably safe, but the bake
pass is real GPU work (a framebuffer render), so forcing a synchronous
draw immediately after it, before the browser has had a chance to paint
anything, could make the very first commit noticeably heavier on slow
devices — exactly the kind of thing a golden snapshot cannot measure
(it's a timing/perf concern, not a call-sequence concern).

**What breaks if it changes:** if the moon converges to `true`, `draw()`
must be defensive about `adaptRef.current` being freshly created (already
true today — `onInit` sets it before `initialDraw` would fire) and the
30fps idle-throttle's `lastDrawRef.current` starting at `0` needs
re-checking so the synchronous frame at `now: 0` doesn't get skipped by
`isAtRest` (unlikely on frame 1, but worth a test rather than an assumption).

**What would prove it safe:** a new test asserting `drawArrays` appears in
the moon's `init` log segment (today it does not — the bake pass draws to
an FBO, the main quad's first `drawArrays` to the visible canvas happens
inside the frame loop) rather than only in `frames`; plus a timing
measurement (even a rough `performance.now()` delta around mount in a
manual/browser check) confirming the synchronous draw doesn't add a
visible stutter versus today's loop-only first paint.

**Which test flips:** `backlog #6 — initialDraw` in
`convergence.test.jsx`.

---

## 7. `version` / `contextOptions` / `blend` — WebGL2 + premultiplied as house standard?

**Current divergence:** `MercuryTerminator`/`ObserverEye` use
`version: 1`, `{ alpha: true, premultipliedAlpha: false, antialias: true }`,
`blend: 'straight'`. `LunarShaderMoon` uses `version: 2`,
`{ alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }`,
`blend: 'premultiplied'`.

**Which value should win:** lean toward the moon's combination as the
house standard for *new* shaders (WebGL2's VAOs and `layout(location=0)`
are strictly nicer to write against, and `low-power` is a reasonable
default for ambient chrome like an eye or a terminator that isn't the
user's primary focus) — but converging the *existing* eye/terminator is
higher-risk than any other item in this backlog, because `blend` and
`premultipliedAlpha` interact: switching `premultipliedAlpha: false` →
`true` without also fixing every place the fragment shader writes
`gl_FragColor` (both `MercuryTerminator`'s and `ObserverEye`'s shaders
write straight, non-premultiplied colors — e.g.
`gl_FragColor=vec4(col,a)` with `col` never multiplied by `a`) will
visibly change edge blending (halos, the rim glow, the retrograde tint)
the instant `blend: 'premultiplied'` is flipped without also premultiplying
in-shader. This is not a config flag, it is a shader rewrite wearing a
config flag's clothes.

**What breaks if it changes:** every alpha-blended edge in both shaders
(the terminator's `halo`/`rim`, the eye's disc falloff `a` in
`gl_FragColor=vec4(col,a)`) darkens or lightens incorrectly if `blend` and
`premultipliedAlpha` disagree with the shader's own math. AA quality also
changes (`antialias: true` → `false` softens/hardens the quad's
rasterized edges, though since both shaders render a full-screen quad with
their own analytic AA via `smoothstep`, the canvas-level MSAA may matter
less here than it would for a geometry-heavy scene).

**What would prove it safe:** this is the one item that most needs the
author's own look before any test is trusted — screenshot the eye and
terminator before/after at multiple states (armed, compiling, a
retrograde in flight) and diff pixel-for-pixel, because the existing
`glParity.test.jsx` snapshots record *uniform values and call order*, not
rendered pixels — a wrong `premultipliedAlpha` setting produces the exact
same GL call log with visibly different output. Do this one item last, in
its own reviewable step, and expect it to require in-shader changes to the
fragment sources, not just an options object.

**Which test flips:** `backlog #7a/7b/7c` in `convergence.test.jsx`.

---

## 8. `setStyleSize` — unify how the canvas is sized

**Current divergence:** `LunarShaderMoon` alone passes `setStyleSize: true`
— it writes `canvas.style.width/height` in addition to the backing-store
`canvas.width/height`. `MercuryTerminator` explicitly opts out
(`setStyleSize: false`); `ObserverEye` relies on the same default by
omission. Both of the latter instead size their *wrapper* `<canvas>` via
inline `style` in JSX (`MercuryTerminator`: `style={{ width: size, height: size }}`;
`ObserverEye`: `style={{ width: Math.round(size * (lens ? 0.58 : 0.94)), ... }}`)
— i.e. the CSS size is set by the component's own render output, not by
`glHost.js`.

**Related, called out explicitly in the task brief:** the eye's backing
store is `pixelSize: size` while its *displayed* canvas is
`size * (lens ? 0.58 : 0.94)` — meaning the eye already deliberately
renders at a higher resolution than it displays (a lens-cropping effect),
which is a third sizing concern layered on top of the `setStyleSize` flag
itself and must survive whatever unification happens here.

**Which value should win:** let `glHost.js` own CSS sizing uniformly
(`setStyleSize: true` for all three) and delete the redundant inline
`style.width/height` from `MercuryTerminator.jsx`'s and `ObserverEye.jsx`'s
JSX — but the eye's `size * 0.58` cropping ratio must move into its
`pixelSize` computation (i.e. `pixelSize` stays `size`, but a *second*,
distinct display-size value gets passed through and set on `canvas.style`)
rather than being lost. This is genuinely two flags wearing one name in
`glHost.js` today: "does the host size the canvas's CSS box" and
"what size does it size it to" (currently always `pixelSize`, the same
value used for the backing store) — converging this properly may require
`glHost.js` to accept an optional distinct `styleSize` alongside
`pixelSize`, not just flipping the existing boolean.

**What breaks if it changes:** if `setStyleSize: true` is flipped for the
eye/terminator without adding a distinct `styleSize`, the eye's canvas
would grow to `size` px displayed (losing its lens-crop entirely) unless
the JSX-level inline style stays as an override — in which case the flag
did nothing observable and the "unification" is cosmetic only. Do the
`styleSize` design work before touching this flag, not while.

**What would prove it safe:** a new `glHost.test.js` case asserting
`canvas.style.width`/`height` reflect a `styleSize` distinct from
`pixelSize` when both are supplied; then a browser check confirming the
eye's lens-cropped look (the "socks/10" reference mock) is pixel-identical
before and after.

**Which test flips:** `backlog #8 — setStyleSize` in `convergence.test.jsx`.

---

## 9. `trackVisibility` — decide whether all three pause work when hidden

**Current divergence:** `LunarShaderMoon` alone passes
`trackVisibility: true` — `frameLoop.js` adds a `visibilitychange`
listener that reseeds `last`/`seeded` on tab-return so the moon isn't
"billed" dt for time spent on a backgrounded tab. `MercuryTerminator` and
`ObserverEye` don't track visibility at all; their loops keep ticking
(and their easing keeps advancing in wall-clock time, clamped per-frame by
`dtClamp`) even while the tab is backgrounded — though in practice the
browser throttles `requestAnimationFrame` to near-zero on a hidden tab
regardless, so the *practical* difference is mostly about the reseed
behavior on return-to-foreground, not steady-state background cost.

**Which value should win:** `true` for all three. There is no argument
in the design doc or the components for *not* tracking visibility — it
looks like an oversight inherited from the eye/terminator's shared
skeleton predating the moon's addition of the concern, not a deliberate
choice. Low risk, since the watchdog (item 2) and this flag are
independent and the reseed-on-return logic in `frameLoop.js` is already
generic (not moon-specific).

**What breaks if it changes:** the eye's and terminator's easing would
snap-reseed rather than jump on tab-return — e.g. a retrograde excursion
in flight on the terminator when the tab backgrounds would, on return,
resume from `now - retroStart` computed against a *reseeded* clock
(`seedLast: 'now'` reseeds `last = now()` on visibility return per
`frameLoop.js`'s `onVisibility`), which changes `p = (now - cur.retroStart) / RETROGRADE_MS`
only in that `now` itself jumps forward by however long the tab was
hidden — likely fine (the retrograde curve would simply complete/skip
ahead), but worth a dedicated test given retrograde is a one-shot,
narrative-bearing animation, not ambient chrome.

**What would prove it safe:** a test that mounts the terminator mid-
retrograde, fires a `visibilitychange` to hidden then back to visible
after a simulated gap, and confirms the retrograde either completes
cleanly (calls `onRetrogradeDone`) or continues coherently rather than
getting stuck or double-firing.

**Which test flips:** `backlog #9 — trackVisibility` in
`convergence.test.jsx`.

---

## 10. `onInit` / `onUnsupported` — keep `onInit`, give the eye and terminator a fallback

**Current state — not drift:** all three components already pass their
own `onInit` (state-reset for the eye/terminator, the bake pass for the
moon) for genuinely different, legitimate reasons — this is not a
convergence target and `convergence.test.jsx` does not assert on it.

**Current divergence that *is* real:** only `LunarShaderMoon` passes
`onUnsupported` (`() => setSupported(false)`, which swaps in the
Canvas2D `LunarCanvas` fallback). `MercuryTerminator` and `ObserverEye`
have no `onUnsupported` at all — on a browser/context that returns no
WebGL context, `useShaderCanvas.js` logs to console and returns early;
the component still renders its wrapper `<div>` and an empty `<canvas>`,
with nothing drawn, forever.

**Which value should win:** give both a fallback. The simplest option
matching the project's existing pattern: a static SVG/CSS rendition (the
eye already has `lens && <svg>...</svg>` in its JSX — for a no-WebGL
browser, that lens SVG alone, styled to suggest a state color, is a
plausible degraded-but-present fallback) or, more simply, a single flat
`<div>` tinted to the current state's primary color. The terminator has
no existing non-GL fallback asset to reuse and may need a small new one
(e.g. a static gradient div in Mercury's twilight color).

**What breaks if it changes:** nothing existing — this is purely
additive, a new render branch gated on a new `supported` state (mirroring
`LunarShaderMoon`'s own `useState(() => ...)` pattern) that only activates
where today nothing renders at all.

**What would prove it safe:** a test per component mirroring
`useShaderCanvas.test.jsx`'s existing "calls onUnsupported and never draws
when there is no context" case, extended to assert the fallback markup
appears (e.g. `queryByTestId`/`data-*` attribute analogous to
`LunarShaderMoon`'s `data-moon-renderer="canvas"`).

**Which test flips:** `backlog #10 — onUnsupported` in
`convergence.test.jsx` (`M.onUnsupported` and `O.onUnsupported` change
from absent to functions).

---

## 11. Extract the eye's and terminator's per-frame easing into pure tested modules

**Current state:** `LunarShaderMoon.jsx` already separates its per-frame
math into `lunarEphemeris.js` (libration, apparent radius) and
`darkAdaptation.js` (`createAdaptState`/`stepAdapt`/`isAtRest`), each with
its own test file (`lunarEphemeris.test.js`, `darkAdaptation.test.js`) —
pure functions, no GPU required to test them. `MercuryTerminator.jsx`'s
`paint()` and `ObserverEye.jsx`'s `draw()`/`targets()` inline their easing
directly in the component (the `lerp` helper, the flare-bloom decay, the
retrograde-curve driving in the terminator; the per-channel color/focus/
gaze lerps and `deriveCols` tint blend in the eye) — untestable without
mounting the component and driving fake GL.

**Which value should win:** extract. Candidate modules:
- `terminatorEasing.js` (or similar): given `{ cur, targets, dt, now,
  retrogradeState }`, return the next `cur` — pure, testable independent
  of `retrogradeCurve.js` (which already exists as its own module and stays
  as-is).
- `eyeEasing.js`: given `{ cur, targets, dt }`, return the next `cur`,
  plus `deriveCols` (already a pure top-level function in
  `ObserverEye.jsx` today — trivial to move) and the `targets()` selection
  logic.

**What breaks if it changes:** nothing behaviorally if the extraction is
verbatim (the design doc's own phase-1 rule: "moves verbatim... nothing is
restructured" applies equally well to a phase-2 extraction) — the risk is
purely mechanical (a copy-paste transcription error). `paint()`/`draw()`
already read from refs (`twRef`, `dayRef`, `flareRef`, `retroRef` for the
terminator; `stateRef`, `tintRef`, `gazeRef`, `pulseRef`, `constrictRef`
for the eye) that must become explicit function arguments rather than
closures — a mechanical but non-trivial rewrite since it changes every
call site's signature.

**What would prove it safe:** write the new module's unit tests *first*
against the extracted pure function (asserting the exact lerp formulas:
`1 - Math.pow(0.004, dt)`, the bloom decay `1 - Math.pow(0.02, dt)`, the
retrograde arming guard), confirm they pass, then re-run
`glParity.test.jsx` with zero snapshot changes — a byte-identical `frames`
snapshot after the extraction is the proof the rewrite was truly verbatim,
exactly as it was for the phase-1 harness extraction itself.

**Which test flips:** none in `convergence.test.jsx` (this item is a
structural refactor, not a config flag) — success is `glParity.test.jsx`
staying green with an *unchanged* `.snap`, plus new unit test files
analogous to `lunarEphemeris.test.js`/`darkAdaptation.test.js`.

---

## Sequencing recommendation

Land in roughly this order, each as its own commit/PR:

1. Item 2 (`watchdogMs`) — additive, zero behavioral risk, fixes the
   named screenshot-trap problem immediately.
2. Item 3 (`loseContextOnDispose`) — additive-ish, low risk, fixes a real
   resource leak.
3. Item 10 (`onUnsupported` fallback) — additive, no interaction with the
   others.
4. Item 9 (`trackVisibility`) — low risk, but land after 2 and 3 so any
   watchdog/context interaction during a visibility transition is
   isolated to one new variable at a time.
5. Item 11 (easing extraction) — mechanical, best done once the flags
   above have stopped moving so the extracted modules don't need a second
   pass.
6. Item 6 (`initialDraw`) and item 5 (`dtClamp`/`seedLast`) — both need
   the author's judgment call more than a right answer; batch them since
   both are "pure drift" per the design doc.
7. Item 4 (`reducedMotion` policy) — `matchMedia`-stubbed test coverage
   already exists (`useShaderCanvas.test.jsx:119-120`'s generic `snap()
   invokes onSnap only under reduced motion` test, plus
   `src/terminal/gl/__tests__/observerEyeReducedMotionMount.test.jsx`, added
   in the final review's fix wave, which locks the eye's specific mount-time
   repaint — see item 4's own section below for the measured numbers) but
   the moon has none of it, and nothing yet locks the retrograde-token-
   orphan defect this item names for the terminator. Do the moon- and
   terminator-specific coverage once the easing extraction (item 11) has
   landed so the new reduced-motion tests can target the pure easing
   modules directly instead of the components.
8. Item 1 (`strategy`) — do after everything above; converging error
   surfacing is the highest-value item but also the one most likely to
   surface a latent bug in either shader, and every other item should be
   settled first so a failure here is attributable to this change alone.
9. Item 8 (`setStyleSize`) — needs the `styleSize`-vs-`pixelSize` design
   work called out above before it can start; not blocked on anything
   else, but likely the most design-time-heavy item.
10. Item 7 (`version`/`contextOptions`/`blend`) — last. Highest visual
    risk, needs pixel-diff verification, and every other convergence
    should be done first so this one item's diff isn't tangled with
    unrelated changes.

---

## 12. Multi-program hosts — now measured, still n=2

Added 2026-07-28 by the `/SCENT` collider chamber
(`docs/superpowers/specs/2026-07-28-scent-collider-gl-design.md`).

`glHost.js` builds exactly one program and one fullscreen quad. Two
consumers now build a second program themselves inside `onInit` using the
raw `gl` handle: `LunarShaderMoon`'s `buildBakeProgram` (render-to-texture)
and `ColliderChamber`'s particle pass (`gl.POINTS` from its own VAO and
attribute buffer).

The shared compile/link/throw sequence has been extracted as
`export function buildProgram(gl, vs, fs, { strategy, label })` — but the
*second-program lifecycle* (its VAO, its buffers, its uniform harvest, its
teardown ordering against `dispose()`) is still hand-rolled twice.

**Do not extract it yet.** The two consumers' second programs differ in
kind: the moon's is transient (built, used once, deleted inside `onInit`),
the chamber's is persistent (built at init, bound every frame, freed in
`onDispose`). A shared abstraction over both would have to model both
lifecycles, which is exactly the speculative generality phase 1 existed to
delete. Revisit at a third consumer, or at a second *persistent* one.

**Also landed here, additively, with `glParity` byte-identical:**
- `pixelSize` accepts `{ w, h }` — it was scalar-only, i.e. square canvases
  only. Every prior consumer is square; the chamber is a 220px letterbox.
- `host.resize(w, h)` — re-sizes the backing store and viewport without a
  rebuild.
- `useShaderCanvas` returns `hostRef` alongside `snap`.
