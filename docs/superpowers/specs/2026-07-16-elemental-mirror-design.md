# The Elemental Mirror — Procedural Elemental Environment for the Mercury Drop

**Date:** 2026-07-16
**Status:** Approved
**Predecessor:** Mercury liquid material Phase 1 (merge e89c23c) — roughness 0.14 mercury optics, tuned against `<Environment preset="night" />`.

## Thesis

Mercury is the mirror — the fifth element that reflects and compiles the other four. At
roughness 0.14 the drop's dominant visual surface *is* its reflection, and today that
reflection is a single static night HDR, identical for Fire, Water, Earth, and Air. The
element is loudest in the particle clouds — the one thing a static env map cannot see.

This work makes the reflection elemental: the mirror reflects a procedural night *world*
colored by the active element, dissolving through neutral night at the peak of each
transition. The thesis becomes literal.

## Decisions (resolved in brainstorming)

1. **Flash moment: dissolve through night.** During a transition the old element's world
   drains to a near-colorless deep night exactly as `chromePhase` peaks — for one beat,
   pure liquid mercury reflects nothing but night. The new element floods in with
   `colorBlend`. The neutral night gradient is what quintessence reflects, visible only
   in the mercury moment.
2. **World shape: shared template, recolored per element.** One procedural night-world
   luminance structure; four palettes. "The same night, different element burning in it."
3. **Life: alive on desktop, staged on mobile.** Continuous env re-render on desktop;
   mobile re-renders only during the ~800ms transition and holds a static frame at idle.

## Architecture

### New: `src/terminal/mercury/MercuryEnvironment.jsx`

Replaces `<Environment preset="night" />` at `MercuryCanvas.jsx:74`. Uses drei's
`<Environment>` in **children mode**: renders a virtual scene — one inverted sphere
carrying a custom gradient fragment shader — into a small cubemap (~128px) that becomes
`scene.environment`. No HDR files, no runtime CDN fetch (removes the current dependency
on drei's preset host).

Props: `activePhase`, `pendingPhase`, `sphereState`, `isMobile` — the exact signals
`usePhaseTransition` already emits. Shader uniforms are driven in `useFrame`. **No new
timing system.**

The env feeds only PBR materials; in this scene that is effectively the mercury sphere
(particle systems and node dots use their own materials). Verify this assumption during
implementation (grep the four flow systems for standard/physical materials).

### Changed: `src/terminal/mercury/elements.js` (new shared module)

Element hues move out of `ORBIT_NODES` (`MercurySphere.jsx:11-16`) into a shared module:

| element | phase    | hue       |
|---------|----------|-----------|
| air     | air      | `#38bdf8` |
| fire    | thermal  | `#f97316` |
| earth   | earth    | `#d97706` |
| water   | fluid    | `#6366f1` |

`MercurySphere` and `MercuryEnvironment` both import from it. Single source of truth.

Each entry also carries a `horizonHeight` field (air high, fire centered, water low-mid,
earth lowest) so per-element world placement lives in the palette, not in shader
constants. Lookups are keyed by **phase name** (`thermal`, `fluid`, `earth`, `air`) —
the signal the transition system actually emits.

### Changed: `MercuryCanvas.jsx`

One-line swap: `<Environment preset="night" />` → `<MercuryEnvironment ... />` (plus
passing the phase signals it already holds). Nothing else in the canvas changes.

## The World Template

One fragment shader on an inverted sphere, shaped by world direction:

- **Zenith:** deep near-black (quintessence dark).
- **Horizon band:** the element's glow — the world's main light source, what the mirror
  catches at eye level.
- **Below horizon:** darker ground with a faint element-tinted stratum.
- **2–3 soft gaussian blobs** at fixed world directions (distant sources), drifting
  slowly via a time uniform — the structural "touch of C" that keeps the reflection
  reading as a world, not a flat colored ball. Blob positions/weights are uniforms inside
  the same shader (one draw call total).
- **Dithering from day one:** hash-based dither in the fragment shader. A smooth gradient
  in a low-res cubemap is a banding machine, and banding is a hard fail for this project.
  Escalate to a half-float render target if dithering alone doesn't kill it.

Per-element differences are palette + placement weights only: fire = ember horizon;
water = indigo; air = pale cyan sitting *higher* in the world; earth = amber shifted
*low* toward the ground.

**Neutral night palette:** near-colorless deep blue-grey-violet (the `#0a0a12` /
`#1a1a2e` family already used by the scene lights). This is both the quintessence
reflection and the tuning reference for luminance (see Risk section).

## The Dissolution Arc

Env palette = `f(activeHue, pendingHue, chromePhase, colorBlend)`:

1. **consolidating** (`chromePhase` 0→1): active element's palette lerps toward the
   neutral night. At peak mirror, the world is colorless night.
2. **elongating / flowing** (`chromePhase` decays, `colorBlend` 0→1): pending element's
   palette floods the horizon.
3. **emerging → idle:** end of `emerging` (pendingHue at blend=1) equals the new idle
   state (activeHue at blend=0 with activePhase updated), so the beat reset at
   `usePhaseTransition.js:89-98` produces no visual pop. Continuity is by construction;
   verify it explicitly during implementation.

`usePhaseTransition.js` is **not modified**.

**The payoff window.** At idle the drop is planet-mode (roughness 0.72, envIntensity
0.3) — the env reads as a subtle element-tinted ambient sheen, not a mirror. The true
mirror exists only during the flash. The moment the elemental world is most visible is
therefore the **flowing beat**: the sphere is still substantially chrome
(`chromePhase` 0.6→0) while `colorBlend` floods the new element in. Tune the palette
ramp so the element is unmistakably present while chrome is still high — this beat is
the thesis made visible, and it lasts 250ms. If it reads as neutral-night-then-suddenly-
planet, the ramp is too late.

## Idle Life & Performance

- **Desktop:** `frames={Infinity}` — horizon breathes, blobs drift; the reflection is
  never frozen. Cost: six tiny renders of one draw call + PMREM per frame at ~128px.
- **Mobile:** `frames={~60}` with a remount `key` tied to a transition counter — the env
  re-renders through the ~800ms crossfade, then holds a static frame. Matches the
  existing mobile-degrade pattern (density 600 vs 1200, dpr 1.5 vs 2).
- Resolution starts at 128; drop to 64 if mobile transition frames stutter (gradient
  content doesn't need resolution — but re-check banding at 64).

## Named Risk: Regressing Phase 1

The shipped mercury material was tuned against `preset="night"`
(`envIntensity 1.6 — "tuned against preset=night"`, `MercurySphere.jsx:184`). Swapping
the env can silently change the drop's brightness and mood.

**Mitigation, in order:**

1. Build and tune the **neutral night state first, alone**, to visually match the shipped
   look — screenshot comparison against production/current build, not vibes or metrics.
2. Only then layer the element palettes on top.
3. Material params (`roughness`, `metalness`, `envMapIntensity` formula) stay untouched.
   If the drop reads wrong, fix the world, not the mercury.

## Out of Scope

- Particle systems, scene lights, transition timing, sphere material — untouched.
- Phase 2 displacement (separate pending work).
- Any change to the Mercury tab outside `MercuryCanvas.jsx` / `MercurySphere.jsx` /
  the two new files.

## Verification

- Browser screenshots (mandatory per project rule: look before claiming):
  - Neutral-night-only build vs shipped look (Risk step 1).
  - Idle ambient sheen per element × 4 (subtle element tint on the planet surface).
  - Mid-transition captures: the night dip at peak chrome, and the flowing-beat payoff
    (new element's world visible on a still-chrome sphere).
- FPS via the existing `onFps` hook: desktop steady-state with env alive; mobile
  emulation during transition.
- Confirm mobile idle holds a static env (no per-frame cube render) via renderer info or
  profiling.
- Confirm the preset HDR network fetch is gone (network panel).
