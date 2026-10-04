# Mercury aether — sunlit element matter + Hg beads

Date: 2026-10-04 · Branch: `feature/mercury-stage` · Part 2 of 2 (build after part 1,
`2026-10-04-mercury-stage-layout-design.md`)

## Problem

The four element flows (`fluid/ParticleFlow.jsx`, `thermal/ThermalFlow.jsx`, `earth/SedimentFlow.jsx`,
`air/AtmosphericFlow.jsx`) are self-luminous soft sprites (often wider than the planet), NormalBlending,
cleared off the planet's face by `planetWindow`. They are the only thing in the scene that ignores the
Sun: the planet has exact Hg Fresnel (`hgOptics`), sun glints, a day/night aether attenuation, and the
breakup droplets share its mirror (`hgMirrorGlsl`).

## Decisions (author)

- **Both layers** (C): the element flows stay as coloured matter but are lit by the Sun; a sparse
  population of true liquid-Hg beads rides through them.
- **Bead sources** (C): a sparse ambient trickle (the planet's steady loss to space) + bursts on
  interaction; the active element carries all of them.
- **Lighting literalness** (C): per-element physical scattering, a night/shadow floor so the flows never
  go fully black, a soft penumbra (never a hard edge — banded/mechanical is a hard fail).
- **Fallback approved:** if per-element bead advection costs too much on the phone, beads move in a cheap
  shared curl-noise field instead.

## Physics anchor

A small Hg droplet in vacuum is a near-perfect sphere; at F0 ≈ 0.78 it is a convex mirror of the whole
sky. Every bead therefore shows a pinpoint sun glint on its sunward side — all glints displaced the same
way — and otherwise a dark, tiny, curved image of its surroundings (black space, a sliver of the lit
planet, the element handles). In the planet's shadow the glint goes out. The Sun is fixed in world space
(`SUN_DIR_WORLD`, planet turns under it), so the shadow cylinder is fixed on screen, anti-sunward, along
the same axis as the sodium tail (`TAIL_AXIS`): the flows darken exactly where the amber tail streams.

## Design

### 1. Shared light — `planet/aetherLight.js`

One module, GLSL chunk + JS mirrors (the `planetWindow` pattern), unit-tested:

- `sunDir` = `SUN_DIR_WORLD` (uniform, so a future moving Sun is one write).
- `shadowFactor(p)`: the planet's shadow cylinder — radius = the live planet radius, axis
  anti-sunward from the centre, only for points with dot(p, sun) < 0. Soft penumbra over a tunable
  width (`AETHER_PENUMBRA`, scene units), a smoothstep (C¹) ramp in the radial distance from the axis —
  no visible bands (verify by screenshot, dithered like the flows' alpha). Returns 1 lit … 0 umbra.
- Phase functions, by element, of cos θ between view and Sun:
  - **water** (mist): forward-scattering Henyey–Greenstein, g ≈ +0.6 — a silver halo where it crosses
    the sunward limb.
  - **earth** (regolith dust): back-scattering, g ≈ −0.3, plus an opposition-surge lobe near θ = 180°.
  - **air** (gas): near-isotropic Rayleigh `(1 + cos²θ)`, low gain, blue-biased tint.
  - **fire**: emissive — no phase, no shadow (fire makes its own light).
- `AETHER_FLOOR` ≈ 0.2 (mirrors `AETHER_NIGHT`): lit = floor + (1 − floor) · shadow · phase, so flows
  never go fully black.
- Knobs live in `PLANET_TUNE` (live, as today); defaults in `planetLook.js`.

### 2. Lit flows

- Water, earth and air multiply their final colour by the light term. Phase + shadow are evaluated
  **per fragment**, not per sprite: the sprite centre's view-space position plus the fragment's offset in
  the sprite plane (`gl_PointCoord` × the sprite's world size) gives an approximate world point — a
  per-sprite test would step the cone edge across whole sprites wider than the planet.
- Fire unchanged.
- Motion, palettes and existing slider knobs unchanged.
- Shader snapshot tests (`__snapshots__`) are updated deliberately.

### 3. Hg beads — `HgBeads.jsx` + `planet/hgBeads.js` (sim) + `planet/hgBeadShader.js`

- **Render:** one `THREE.Points` draw. Each sprite is a sphere impostor — analytic normal from
  `gl_PointCoord`, discard outside the disc, `gl_FragDepth` from the sphere surface — shaded by the SAME
  `HG_FRESNEL_GLSL` / `HG_ENV_GLSL` the planet and the breakup droplets use (uniform objects shared with
  the planet material, as `useDropletField` does), so the beads are the planet's material by
  construction. Beads in the shadow cylinder lose the Sun term (glint). Depth-tested against the planet;
  **not** cleared by `planetWindow` (they are solid: a bead in front of the face stays visible). Render
  order after the flows and the exosphere; sub-pixel beads fade by coverage, never flicker (a bead
  smaller than ~1 px renders as its glint only, alpha by area).
- **Fire warms the beads:** when thermal is the active element, the bead environment adds the fire
  palette as a nearby emitter (it already exists in the mirror's element terms — reuse, no new path).
- **Sources:** (a) ambient — a trickle off the surface at random sunlit points, rate tuned so a few
  dozen beads are alive; (b) bursts — MercuryPlanet emits events (fling, hyper-fling, boil, visitor
  impact) into a small ring buffer the bead sim drains each frame (the `strikesRef` pattern), each with a
  position, velocity and count.
- **Motion:** per bead, gravity toward the planet + the active element's flow velocity sampled in JS
  (a simplified mirror of that flow's motion: fluid curl tubes, thermal updraft, earth eruption
  ballistics, air orbit). Fire evaporates beads (shrinks to nothing); beads that re-enter the planet
  merge (removed). Fallback: one shared curl-noise field (author-approved) if the per-element field is
  too costly on the phone.
- **Budget:** fixed typed-array buffers, cap 64 mobile / 256 desktop (in `TIERS`), oldest-first eviction,
  zero per-frame allocation, `drawRange` = live count.
- **Calm (reduced motion):** ambient trickle and drift freeze; bursts still spawn but don't advect.

### 4. Mirror consistency

`aetherLobeColors` today weights each of the 16 lobes by flow opacity. It additionally multiplies each
element's contribution by that element's light term (shadow + phase + floor, §1) evaluated at the lobe
direction, so the reflected flows look the way the flows look. JS-side, once per frame, 16 × 4 evals.

### 5. Out of scope

Flow motion/palettes; the exosphere (tail + halo) — untouched, it already lies along the shadow axis;
the breakup SDF pass.

### 6. Verification

- Unit: `shadowFactor` (lit, umbra, penumbra monotonic, sunward side always lit), each phase function
  (normalisation, forward vs back), floor, bead budget/eviction, burst ring buffer, evaporation and merge.
- Snapshot tests updated on purpose; lint gate.
- Live, browser pane: screenshots of (1) the shadow lane coinciding with the sodium tail, (2) a bead in
  front of the planet with its glint on the sunward side, (3) a fling burst carried by the active
  element, (4) water's sunward-limb halo. Perf HUD on desktop; the author's phone gate last.
- No push without an explicit push command.
