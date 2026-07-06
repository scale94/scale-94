# Council Ring Vector Collider — Design Spec

**Date:** 2026-07-05
**Branch:** feat/the-sixteen-council-ring
**Status:** Approved layout (locked); ready for implementation planning
**Context:** Ars Electronica submission. Foundation phase — lays collider groundwork across tabs; the future final-compilation step consumes this module's bus events.

## Overview

Turn the static Council Ring (Manifesto tab) into an ambient generative vector collider. Pairs of the sixteen minds emit particles that gravitate from their ring seats to the torus center, collide in a 1536-D expansion of the legacy 16-D feature space, and eject a product particle toward either the **social foundation** ring (inward — shortfall) or the **biophysical ceiling** ring (outward — overshoot). The Raworth doughnut becomes a detector.

## Goals

- Sleek, high-refresh terminal aesthetic matching the existing UI (phosphor-decay trails, mono type, arc hues).
- Ambient autonomous loop with click override: the ring is always alive; clicking a node biases the next collision to include that mind (and still opens SixteenPanel).
- Deterministic math, zero runtime `Math.random()` in collision or narrative logic (seeded PRNG only).
- Clean WASM boundary: the pure-math module's API is the contract a future Rust kernel replaces.
- Integration hooks: generative narrative readout, `councilBus` event channel, extended roster schema.

## Non-goals (this phase)

- No Rust/WASM implementation — all-JS collision math.
- No mobile collider — the mobile crosshair wheel stays static; canvas-under-rotation compositing is deferred.
- No SixteenPanel collision-history section (explicitly deferred by user).
- No cross-tab compilation step — only the bus hook it will subscribe to.

## Module layout

| File | Role |
|---|---|
| `src/terminal/views/manifesto/councilCollider.js` (new) | Pure math, zero React: 1536-D expansion, collision, partition energy, ejection resolution, narrative fragment assembly. |
| `src/terminal/views/manifesto/useCouncilCollider.js` (new) | React hook: RAF loop, particle sim in mutable refs, ambient scheduler, click-bias queue. |
| `src/terminal/views/manifesto/councilBus.js` (new) | Module-level event channel, same pattern as `colliderBus` (listener list + pending buffer for late subscribers). |
| `src/terminal/data/sixteenMinds.js` (extended) | Adds `keyWorks: [{ title, year }]` (2–3 per mind) and `excerpt` (short quote) for all 16 minds. |
| `src/terminal/views/manifesto/CouncilRing.jsx` (modified) | Aligned canvas overlay + fixed-height narrative readout strip under the desktop SVG. SVG scaffold, nodes, labels, click targets untouched. |

## Coordinate mapping

All simulation math runs in **viewBox units** — the SVG's existing coordinate system (CX=320, CY=320, R_FOUNDATION=150, R_SEAT=220, R_CEILING=290). `polarToXY` from `councilRingMath.js` is reused verbatim for spawn points and ejection targets.

- Canvas absolutely positioned over the desktop SVG (`viewBox="-170 0 980 640"`), sized by ResizeObserver × `devicePixelRatio`.
- One transform per frame: `ctx.setTransform(s, 0, 0, s, 170·s, 0)` where `s = canvasCssWidth / 980`. Everything downstream draws in viewBox units.

### Particle lifecycle (one cycle ≈ 6–8 s)

1. **EMIT** — two particle streams spawn at the paired minds' seats (`polarToXY(seatAngle, R_SEAT)`), tinted with each mind's arc hue.
2. **INFALL** — radius eases `R_SEAT → 0` with decaying spiral: `θ(t) = seatAngle + spiralGain·(1 − r/R_SEAT)`. Trails via translucent-black fillRect phosphor decay.
3. **COLLAPSE** — at `r < 10`, center flash; `collide(A, B)` runs synchronously.
4. **EJECT** — one product particle fires outward at the **seat angle of the mind whose dim dominates the residual** (trajectory points at a named intellectual). Target radius `R_FOUNDATION` for social trajectory (bursts against the inner ring — shortfall), past `R_CEILING` for biophysical (punches through both rings — overshoot). Burst renders as a brief ring-flash on the boundary hit.
5. **COOLDOWN** — trails decay; scheduler arms the next pair.

## Latent math (`councilCollider.js`)

### Expansion: 16-D → 1536-D

`expand(vec16) → Float32Array(1536)`. Base dim `d` owns block `[d·96, d·96+96)`, filled with deterministic harmonics:

```
component[d·96 + k] = v_d · sin((k+1) · v_d · π + φ(d, k))
```

where `φ(d, k)` is a seeded integer-hash phase. No runtime randomness; stable across sessions. All 16 mind vectors precomputed at module load (16 × 1536 Float32 ≈ 98 KB). **Invariant:** every dim block uses the same harmonic family and width (96), so per-dim energy is comparably distributed — required for the unbiased partition comparison below.

### Collision

`collide(A, B) → { cosine, byDim, energies, trajectory, dominantDim }`

- `cosine` — 1536-D cosine similarity of the two expanded vectors.
- `byDim` — 16-entry array of per-dim residual energy `e_d` (sum of squares over dim `d`'s 96-component block of `A₁₅₃₆ − B₁₅₃₆`).

> **As-built amendment:** the original spec returned the raw 1536-float `residual` vector; the shipped contract returns the reduced `byDim` energies instead — no consumer needs the raw vector, and the reduced form is what the UI, narrative, and bus actually use. A future Rust/WASM port must implement the shipped `byDim` contract, not the original wording. Also as-built: `keyWorks` was authored into the schema as deferred foundation data (per the locked scope) and has no consumer yet; `excerpt` is live in the narrative fragment pool.

### Partition & ejection (locked calibration)

Over the legacy 16 dims:

- `SOCIAL_DIMS` = `{ synchrony, temporal, game_theory, information, cryptographic, economic }` (6 dims)
- `BIOPHYSICAL_DIMS` = the remaining 10 (`dynamical, nonlinearity, dimensionality, criticality, entropy, conservation, spatial, stochastic, thermodynamic, biological`)

**Mean energy per dim, strictly:**

```
E_social = (1/6)  · Σ_{d ∈ SOCIAL} e_d
E_bio    = (1/10) · Σ_{d ∈ BIOPHYSICAL} e_d
trajectory = E_social ≥ E_bio ? FOUNDATION : CEILING
dominantDim = argmax_d e_d   (over all 16 — names the ejection angle's mind)
```

Dividing each partition's summed block energy by its dim count removes the 6/10 size bias entirely; combined with the equal-energy expansion invariant, the detector is unbiased at runtime.

## React state logic (`useCouncilCollider.js`)

**Hard rule: nothing that changes per frame touches React state.** The sim lives in `simRef.current = { phase, particles[], pair, product, t, ordinal }`; the RAF loop reads and writes only that.

React state is exactly three discrete values:

- `activePairIds` — set at cycle start; matching SVG nodes get the existing gold `active` treatment.
- `lastCollision` — set once at COLLAPSE; drives the narrative strip and `councilBus.emit`.
- `running` — gates the loop for `prefers-reduced-motion`, tab visibility (IntersectionObserver on the ring container), and mobile (always off).

Scheduler: an ambient timer arms a seeded-pseudo-random pair each cycle. Node click keeps its current behavior (opens SixteenPanel) and additionally pushes that `dimIndex` into a bias ref — the next ambient pair is guaranteed to include it, then the bias clears.

Hook signature:

```js
useCouncilCollider({ seated, enabled }) → { canvasRef, activePairIds, lastCollision, onNodeClick }
```

## Narrative readout (locked calibration — generative splice)

Fixed-height mono strip under the desktop SVG. The assembler does **not** print a static epigraph; it splices linguistic fragments from **both** colliding minds into a generative line per collision event.

- **Fragment pools per mind:** epigraph clauses (split on punctuation), `systemDirective` halves (split on `" / "`), `coreEquation` tokens, `excerpt` clauses (once schema lands), anchor surname.
- **Template grammar:** a small set of line shapes, e.g.
  `[COLLISION 0x{ordinal}] {SURNAME_A} × {SURNAME_B} · {fragA} ⇌ {fragB} · residual peaks dim:{dd} {dimName} · TRAJECTORY {▼ FOUNDATION | ▲ CEILING} · "{spliced clause}"`
  where the spliced clause joins one clause from each mind (e.g. half of A's epigraph + half of B's directive, or an equation term embedded in a clause).
- **Seeding:** a seeded PRNG (e.g. mulberry32) keyed on `(dimIndexA, dimIndexB, ordinal)`. Every collision event differs (ordinal advances each cycle), the output feels unpredictable, but there is no `Math.random()` — codebase convention — and a session replay is reproducible.
- Line length clamped (~140 chars) to keep the strip fixed-height with no layout shift.

## councilBus

Same pattern as `colliderBus`: listener array + pending buffer flushed to late subscribers. Event shape:

```js
{
  type: 'COUNCIL_COLLISION',
  pair: [dimIndexA, dimIndexB],
  cosine, trajectory: 'FOUNDATION' | 'CEILING',
  dominantDim, energies: { social, bio },
  line,          // the spliced narrative string
  ordinal, ts,
}
```

This is the hook the future final-compilation step subscribes to from any tab.

## Performance

- Particle cap ~120; single canvas layer; no per-frame allocation in the hot loop (particle pool reused).
- DPR-aware sizing; loop fully stopped (not just skipped) when `running` is false.
- Collision math is O(1536) per event, once per ~7 s — negligible.

## WASM boundary

`collide(A, B)`'s input/output contract is the future Rust kernel's signature. Phase 1 ships all-JS. When the kernel lands, `councilCollider.js` delegates and the hook/UI are untouched.

## Testing

Pure-math unit tests on `councilCollider.js`:

- Expansion determinism (same input → identical Float32Array across calls).
- Partition normalization (synthetic residual with equal per-dim energy → `E_social ≈ E_bio`).
- Ejection resolution for known mind pairs (stable trajectory + dominantDim).
- Narrative assembler: same `(pair, ordinal)` seed → identical line; differing ordinals → differing lines; length clamp respected.

No changes to `councilRingMath.js`; existing ring tests unaffected.
