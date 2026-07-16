# Nebula Condensation — the transition becomes one breath

**Date:** 2026-07-17
**Status:** Approved
**Predecessors:** Elemental mirror (merge b4560de), cloud parting + tuning rig (9e9d7dc, ecc5db1).

## Thesis

The cloud-parting duck proved a physical limit: per-sprite opacity fights
overlap logarithmically (coverage ≈ 1 − (1 − α)^N; live-traced at α=0.008 the
sky still holds an ~80% veil). Geometry wins where opacity loses: contract the
particle field into the drop and the overlap dies with it — and the motion IS
the meaning. Mercury inhales the sky, flashes as pure mirror, and exhales the
new element. Dissolution made physical.

## Decisions (resolved in brainstorming)

1. **Mechanism: position contraction + size slimming** (not size-only "evaporation",
   not sim-level attraction). Shader-only one-liners; the four motion sims stay
   untouched.
2. **Ghosts condense too** — mercury takes everything; what visually reads on the
   exhale is the new active cloud (opacity 1.0 vs ghosts' 0.12).
3. **Exhale curve:** condense falls `lerp(1, 0, easeOut(t))` during emerging.
   Composed with the spatial map `(1 − c²)`, outward velocity peaks at t=0 and
   decays — launch, then settle. No extra easing machinery.

## Architecture

### 1. Signal — `usePhaseTransition.js`

New per-phase output `phaseCondense` beside `phaseOpacities` (same object shape,
keys = PHASES, values 0..1):

- **idle:** 0 for every phase.
- **consolidating:** every phase `lerp(0, 1, easeIn(t))` — the inhale accelerates
  (squared spatial map does the snap; see §3).
- **elongating / flowing:** held at 1 (beats don't touch it — same convention as
  opacities).
- **emerging:** every phase `lerp(1, 0, easeOut(t))` — the exhale.
- Continuity by construction: emerging ends at 0 = idle value. Beat reset
  produces no pop.

The beat envelope is extracted as a pure exported helper so it is unit-testable
without rAF:

```js
// condenseEnvelope(beat, t) -> 0..1  (t already eased by the caller's beat easing)
export function condenseEnvelope(beat, easedT) { ... }
```

(Exact shape may fold into the existing beat handlers if extraction fights the
hook's structure — the requirement is a pure, tested mapping from
(beat, eased t) to condense value, not a specific function boundary.)

### 2. Plumbing — `MercuryCanvas.jsx`

`condenseFor(phase) = phaseCondense[phase]` beside `opacityFor`; each of the four
flows gets a `condense` prop (default 0). Each flow's existing per-frame uniform
block gains one line: `mat.uniforms.uCondense.value = condense;`.

### 3. Shader — ×4 flows, identical shape

In each vertex shader, applied to **`pos` — the post-sim position variable —**
immediately before the `modelViewMatrix` transform (NOT to the raw `position`
attribute, which would bypass the motion sim):

```glsl
float squeeze = 1.0 - uCondense * uCondense;  // gravity-well ease: slow drift, fast swallow
pos *= squeeze;
```

and on the size line:

```glsl
gl_PointSize = <existing formula> * (1.0 - uCondense * uCondenseSizeBite);
```

- The squared map gives the inhale momentum (gentle at c≈0, snapping at c≈1) and
  gives the exhale its launch (max outward velocity at emerging start).
- All four points objects sit at the scene origin, so local contraction pulls
  toward the drop. The sphere writes depth (`depthTest` true on the points
  materials, `depthWrite: false` only on themselves), so arriving sprites are
  occluded by the drop's silhouette — the GPU eats them, no manual clipping.
- Size slimming (default bite 0.6) prevents a bright pileup at the center in the
  last milliseconds before occlusion.

New uniforms per flow: `uCondense` (0..1, driven), `uCondenseSizeBite` (from TUNE).

### 4. TUNE knobs — `mercuryTuning.js`

- `condenseBite: 1.0` — max contraction. Applied in ONE place:
  `condenseFor(phase) = phaseCondense[phase] * TUNE.condenseBite` in
  MercuryCanvas — the shaders receive the final value. 0 disables the feature
  live from the rig.
- `condenseSizeBite: 0.6` — size slimming factor.
- Opacity ducks relax now that geometry does the clearing:
  `duckActive: 0.10`, `duckGhost: 0.03` (from the desperate 0.008/0.004).
- All rig-tunable via the existing `window.__mercuryTune`.

## Verification

Same instruments as the parting pass:

1. **Chain proof:** live uniform trace of `uCondense` across a slowed transition
   (idle 0 → held ~1 → recovered 0), like the uOpacity trace.
2. **Composition proof:** slow-mo (temporary BEAT_MS ×10, working tree only,
   reverted) CDP captures at inhale-mid, hold (sky empty, flash owns frame),
   exhale-mid, settled.
3. **Unit tests:** the pure condense envelope (idle/inhale/hold/exhale/continuity),
   plus existing 503 stay green.
4. **The user's eye at full speed is the final gate.** No push without their word.

## Out of Scope

- Flow motion sims (turbulence/curl/orbit logic) — untouched.
- Sphere material, env shader, beat durations — untouched.
- Sim-level attraction physics — explicitly rejected this pass.

## Named risks

- **Off-origin flows:** if any flow's points object turns out NOT to be at the
  scene origin, contraction pulls toward the wrong center — verify each flow's
  placement during implementation (expected: all bare children of the Canvas).
- **Sprites outside [0,1] condense range:** uCondense is clamped by construction
  (beat envelopes only emit 0..1); the shader needs no defensive clamp, but the
  TUNE `condenseBite` multiplication must not push it above 1.
