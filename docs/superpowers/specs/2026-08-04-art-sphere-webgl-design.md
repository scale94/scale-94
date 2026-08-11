# The Art Sphere — WebGL Migration

Date: 2026-08-04
Status: design approved, not yet planned
Target: `src/terminal/views/ArtTab.jsx` (3208 lines)

---

## 1. What this is

The `/art` sphere is the site's most artistically developed piece and it is
drawn entirely in Canvas2D — a force-directed 3-D layout perspective-projected
onto a 2-D context, with bloom faked by downsampling through an offscreen
canvas. It reads as striking on a laptop. It will not survive projection at
Ars Electronica scale, because the two things that carry a piece at that
size — real bloom and real additive light — are exactly the two things
Canvas2D cannot do.

This document specifies migrating the *rendering* to WebGL via
react-three-fiber, in seven independently shippable steps, holding visual
parity as a floor and then spending the recovered GPU headroom as a separate
phase.

### 1.1 Decisions already made

| Decision | Choice | Rationale |
|---|---|---|
| Which sphere | ArtTab's, not `KernelSphere` | See §9.1 — two 272-node spheres would read as duplicates |
| Ambition | Faithful parity first, then push | Parity is the fallback; without it there is no way back |
| Stack | react-three-fiber | Already a dependency; `@react-three/postprocessing` ships the bloom |
| Audio | Deleted, not muted | Author's call: "it sounds like cheap church bells" |
| Immersive mode | Bloom becomes always-on; immersive keeps Voronoi + spectral ambient + vignette | Hiding the headline upgrade behind a toggle most visitors never find is a waste of the work |

---

## 2. Current state, measured

The draw loop is a single `useEffect` spanning `ArtTab.jsx:599-1704`.

- **Lines 599-788 (~190 lines): simulation.** Rotation, Hopfield step,
  sonification, temporal snapshots, projection, depth sort, particle ecology
  step. This is not rendering and does not move to the GPU.
- **Lines 788-1704 (~915 lines): rendering.** ~25 stacked Canvas2D layers.

Counts that shape the work:

| Quantity | Value | Source |
|---|---|---|
| Nodes | 272 | `NODES` in `nodeFeatures` |
| Particles | 400, SoA `Float32Array` | `MAX_PARTICLES`, `src/terminal/art/artParticles.js:5` |
| Canvas text draws | **3** | `ArtTab.jsx:911, 1506, 1606` |
| `SomaAudio.js` | 1216 lines, one consumer | Only `ArtTab.jsx` imports it |

Two of these are better news than expected. The particle system is already in
the exact struct-of-arrays layout a GPU attribute buffer wants — it uploads
with no restructuring. And there are only three `fillText` sites, so the
text-to-DOM step (§5, step 1) is small rather than the large de-risking job it
first appeared to be.

### 2.1 The layers that cost the most

These are the reason to do the work at all:

- **Per-node `createRadialGradient` halos** (`ArtTab.jsx:1379`) — a gradient
  object constructed per node, per frame. 272 allocations a frame for an
  effect that is one `smoothstep` in a fragment shader.
- **Per-edge `createLinearGradient` + `ctx.shadowBlur`**
  (`ArtTab.jsx:1110`, `:1116`). `shadowBlur` is the slowest primitive in the
  Canvas2D API and it is set and cleared per edge.
- **Per-particle radial glows** (`ArtTab.jsx:1642`) — same pattern, 400×.
- **The bloom** (`ArtTab.jsx:1662`) — `drawImage` into a small offscreen
  canvas and back up. This is a blurry copy, not a bright-pass bloom. It
  cannot produce the light bleed that makes a dark piece read at scale.
- **The trail fade** (`ArtTab.jsx:788`) — `fillRect` of `rgba(4,4,10,0.16)`
  over the previous frame. Because the fill is opaque-tinted rather than a
  true alpha decay, residue never fully clears; the field silts toward grey
  over time instead of decaying to black.

---

## 3. Architecture

Three surfaces coexist during the migration and collapse to two at the end.

| Layer | Owns | Lifetime |
|---|---|---|
| **DOM** (top) | All text: node labels, cluster labels, probe label, tooltips, readouts | Permanent |
| **r3f `<Canvas>`** | Migrated layers as scene objects; the 2-D canvas composited as a texture; the `EffectComposer` post chain | Permanent |
| **Canvas2D** | Layers not yet migrated; feeds GL as a texture | Deleted at step 6 |

### 3.1 The load-bearing rule

**The CPU keeps owning where things are. The GPU only owns how they look.**

Projection, depth sort and hit-testing stay exactly where they are today.
Each frame:

```
sim step → project 272 nodes → depth sort
                ↓                    ↓
   Canvas2D draws what it       GL fills instance buffers
   still owns                   from the same array
                ↓
       hit-testing reads that identical array
```

`getProjected`, `nodeAt`, `edgeAt` and `conductorHit`
(`ArtTab.jsx:1705-1794`) all read projected screen coordinates the draw loop
computed. The instinctive WebGL move — projecting in the vertex shader —
destroys that: the CPU stops knowing where anything is, and every mouse
handler, touch handler, shift-click resonance comparison and manual fusion
interaction breaks simultaneously.

272 nodes is a trivial per-frame upload. Keeping projection on the CPU costs
nothing measurable and means **no interaction code changes at any step of the
migration.** That is what makes an incremental migration safe.

### 3.2 Loop reconciliation

`useFrame` inside the `<Canvas>` becomes the single clock; the body of
ArtTab's rAF loop moves into it. The simulation hooks stay in `ArtTab`
itself — only a small child component lives inside `<Canvas>` and reads the
refs. This is the standard r3f shape and avoids restructuring the component
tree.

Step 0 (audio excision) lands first specifically because the continuous
sonification at `ArtTab.jsx:695` runs *inside* this loop and is the messiest
part of the move.

---

## 4. What does not change

Stated explicitly so no step quietly violates it:

- Every mouse, touch and pointer handler (`ArtTab.jsx:1795-2150`).
- The hit-test functions and the projected-coordinate array they read.
- The simulation: Hopfield field, morphogenesis, spectral light, analogical
  reasoning, particle ecology, bifurcation conductor, temporal archaeology.
- `SomaPresence` and the multiplayer layer (see §8.2).
- The IndexedDB temporal-archaeology persistence.
- Command dispatch, prism effects, probe injection, manual fusion.

---

## 5. Phasing

Seven steps. Each is independently shippable and independently revertible.
Ordered so the largest visual win lands early and the largest risk lands late.

### Step 0 — Audio excision

Delete `src/terminal/audio/SomaAudio.js` (1216 lines) and its ~28 call sites
in `ArtTab.jsx`, plus the UI it powers: the mute button (`:2536`), the
beat-clock toggle (`:2552`), recording (`:2372`, `:2584`) and MIDI export
(`:2608`).

**Must not regress:** the ambient beat pulse. `beatPhaseRef` is written
*only* by `somaAudio.startBeatClock(114, …)` (`:2552`) and read at `:871` to
drive a radial pulse glow. Deleting audio naively leaves `beatPhaseRef`
pinned at 0 and the layer silently stops existing. Replace it with a plain
114 BPM timer carrying no sound.

**Must not delete:** `SomaPresence` — see §8.2.

**Acceptance:** the sphere is pixel-identical apart from the removed audio
controls; the beat pulse still pulses; multiplayer still connects.

### Step 1 — Text to DOM

Move the three `fillText` sites (`:911` cluster labels, `:1506` node labels,
`:1606` probe label) to a DOM overlay positioned from the same projected
array. Preserve depth-derived opacity and the fired-node label cascade
timing.

Text is the one layer that genuinely resists GL — an SDF atlas is real work,
and Geist Mono has already dropped glyphs on this project once. Because the
labels sit mid-stack, leaving them in Canvas2D would block migration of every
layer beneath them. House precedent: `5ef4b47 feat(collider): move the
chamber readouts to DOM`.

**Acceptance:** crisper, not different.

**Deviation, decided during implementation:** the labels are *not* selectable.
`SphereLabels` sets `pointer-events: none` (without which the overlay would
swallow hover, drag-rotate and click-to-cue) and, since that already makes a
selection drag impossible, also `user-select: none` and `aria-hidden="true"` —
27 constantly-repositioning spans would otherwise flood the accessibility tree
of a canvas that already carries its own text description. Selection was
traded for pointer transparency deliberately; this is finished, not pending.

**Also decided during implementation:** canvas `fillText(t, x, y)` treats `y`
as the *alphabetic baseline*, while CSS `translate(-50%, -100%)` puts the box
*bottom* at `y` — labels sat ~2px high until corrected. The correction lives in
the font shorthand (`bold ${n}px/1 monospace`), **not** in a separate
`line-height` assignment, because the per-frame `style.font` shorthand write
resets `line-height` to `normal` and would silently undo it.

### Step 2 — Real bloom

Mount the r3f `<Canvas>` *above* the 2-D canvas. Upload the 2-D output as a
texture each frame onto a fullscreen quad, then run `EffectComposer`:
bright-extract bloom, plus vignette.

The existing 3200 lines of draw code are not touched. No clear-mode change is
needed yet — the 2-D canvas is still the only content, so it may stay opaque.

Per §1.1, **bloom is always on**; **vignette stays gated to immersive**, which
is where it lives today. The composer therefore runs one unconditional pass
and one conditional one. Immersive's distinguishing layers after this step are
the Voronoi mesh, the spectral ambient and the vignette.

**Measure, do not assume:** the per-frame canvas→texture upload. Reuse a
single texture object rather than reallocating. If the cost is material at
1080p, cap the 2-D backing store's DPR before optimising anything else.

**Acceptance:** side-by-side screenshots showing real light bleed where the
old bloom showed a smear; frame time measured against the step-0 baseline.

**DONE 2026-08-05.** Built as `art/SphereComposite.jsx` + `art/artComposite.js`.
Four corrections this step forced on the text above:

1. The DPR cap suggested here as the first optimisation **already existed** at
   1.5x (`ArtTab.jsx` ResizeObserver), which the baseline confirms: at DPR 2 the
   backing store is 2169x870, exactly 1446x580 x 1.5. The lever is mostly spent.
2. "The existing draw code is not touched" cannot be literally true — the fake
   `ctx.filter` bloom and radial vignette had to be deleted from the loop or
   immersive would carry both. That is the only change inside `draw`, and it is
   gated on `immersiveRef`, so exactly 3 of 21 captured states move.
3. Loop reconciliation (SS3.2) started here **inverted**: the 2D loop drives the
   GL canvas via `frameloop="never"` + `advance()` from its own tail, rather
   than `useFrame` becoming the clock. SS3.2's direction is still the step-6
   destination.
4. Measured cost, real GPU, 1520x900 idle: +0.7ms p50 for the quad and texture
   upload, +0.4ms more for bloom, so **+1.1ms p50 / +1.3ms p95** total. Idle p99
   crossed the frame budget (14.7 -> 18.1ms). Full numbers and the 12-of-21
   parity result in `baseline/art-sphere-2d/README.md`.

**Blocking step 3:** the deterministic capture harness cannot drive r3f (it
replaces rAF with a manual pump; `useFrame` never runs, in either frameloop
mode). It gates the 2D layer only. Step 3 moves real content into GL, so this
must be solved before step 3 starts, or step 3 ships unverified.

### Step 3 — Background slice

Migrate the bottom of the stack: genesis glow, state flash grid, spectral
ambient, sphere wireframe ghost, temporal ghost trails, beat pulse.

The 2-D clear becomes a `destination-out` transparent decay **here** (not at
step 2), so the GL background shows through while the 2-D canvas continues
trailing its own remaining content.

**Known temporary state:** two independent trail decays coexist from step 3
to step 6 and must be tuned to match. This resolves itself at step 6.

> **CORRECTION (2026-08-11) — step 3 shipped without the second decay, and
> "verified" was true for placement and false for weight.**
>
> This paragraph says two trail decays coexist. Only one did. The `destination-out`
> clear is a *partial alpha erase*, so everything the 2D canvas drew after it
> compounded — a layer redrawn at alpha `a` settles at
> `a / (1 - (1-m)(1-a))`, i.e. `1/m` for small `a`, and `m` is per-mode (0.72
> normal, **0.32 immersive**). Every layer step 3 moved to the GPU drew into a
> target that *was* fully rewritten each frame, so all six lost that gain the
> moment they moved: **1.389× normal, 3.125× immersive.**
>
> Measured after the fact: immersive-on was losing **44% of lit pixels**, all in
> the faintest band, mass conserved below the floor — dimming, not deletion. The
> loss peaks at the wireframe radius, where `WIRE_ALPHA = 0.03` predicts a
> 22.5 → 7.65 luminance drop. Every step-3 layer rendered in the right place at
> roughly a third of the light it should carry in the exhibit mode.
>
> **Nothing detected it.** The 32×18 comparator scored it 21/21 green, and so did
> the five bespoke presence checks — they ask whether a layer paints, never
> whether what it paints survives into the next frame. This is why the trail
> target was pulled forward out of step 6 (author's call, 2026-08-09) and why
> `scripts/artInk.mjs` (a summed, not averaged, ink instrument) and a sixth
> accumulation presence check now exist. Reference set:
> `baseline/art-sphere-trail/`.
>
> Step 3's cost figures stand — re-measured 2026-08-11 against a same-session
> control and they reproduce. Its *immersive* parity claims do not: see §8.4.

### Step 4 — Edges

Edges, resonance edge and prism geometry chords → line geometry with
per-vertex colour for the gradients and real additive glow. Retires
`ctx.shadowBlur` entirely.

Keep the CPU depth sort initially for parity, even though additive blending
makes ordering largely moot — parity first.

### Step 5 — Nodes

Instanced sprites for node discs, halos, chimera state halos, awakening
beacon rings, Gestalt ghost outlines, the probe node and the fusion source
pulse ring. Retires per-node `createRadialGradient`.

Hit-testing is untouched — it reads the CPU array (§3.1).

### Step 6 — Particles and trail

Particle ecology → instanced sprites, uploading `artParticles.js`'s existing
`Float32Array` SoA buffers directly. The trail moves to a GL feedback buffer,
which decays properly to black instead of silting toward grey.

> **DONE EARLY (2026-08-10).** The feedback buffer was pulled forward to sit
> under step 4, because every layer migrated from step 3 onward was silently
> losing its accumulation without it (see the correction under step 3). It is a
> ping-pong pair of `NoColorSpace` RGBA8 targets (`SphereTrail.js`) faded by
> `1 - m`, with `m` read per frame from the tint the 2D canvas erased with
> (`state.rift.a`) rather than re-derived from an immersive flag, so a mode
> toggle cannot desynchronise the fade from the fill for a frame.
>
> The clear colour is **not** in the accumulator. `sphereBackgroundInk()` returns
> premultiplied layer ink with coverage in alpha and the base enters once, in the
> screen pass, as `ink.rgb + uRift * (1 - ink.a)`. Feeding the clear through the
> loop instead multiplies the whole frame by `1/m` — which is indistinguishable
> from "correct but brighter" to every instrument in this repo.
>
> Only the particle migration is left in this step.

The 2-D canvas is now empty: delete it, its texture and the composite quad.

**Phase 1 ends here.** The piece is DOM text over one r3f Canvas.

---

## 6. Verification

**Pixel diffs, not GL call-log snapshots.** This is a deliberate departure
from the harness and `/SCENT` work, and the reason is in this project's own
phase-2 backlog: a wrong `premultipliedAlpha` setting *"produces the exact
same GL call log with visibly different output."* For a migration whose
entire acceptance criterion is visual parity, the call log is the wrong
instrument.

Each step is verified by:

1. **Real screenshots**, captured through the headless-Chrome-over-CDP recipe
   (never `--disable-gpu`; use `--enable-unsafe-swiftshader`). The browser
   pane suspends `requestAnimationFrame`, so anything captured there is a
   frozen first frame, not the piece.
2. **Side-by-side comparison** against the previous step at both laptop and
   projector scale.
3. **Frame time** against the step-0 baseline.
4. **Interaction smoke test** — hover, click, shift-click resonance,
   right-click fusion, touch drag, pinch — after every step that touches the
   render path, because §3.1 is an invariant and invariants need proving.

Unit tests cover extracted pure modules only. They cannot see pixels and must
not be treated as parity evidence.

**AMENDED 2026-08-11 — a tolerance gate answers "did anything move", never "is
it right".** Item 2 above is necessary and nowhere near sufficient, and three
signed-off steps were measured with it alone. The comparator is a mean over a
32×18 grid, so a thin edge or a 0.03-alpha wireframe occupies a few percent of
any cell and averages into that cell's dark majority. Demonstrated failures, all
scored **21/21 green**:

- a measured **22% edge-ink loss**;
- an **sRGB-vs-linear** blend of the whole backdrop, at mean 1.285 against a
  threshold of 4;
- the entire **trail-accumulation deficit** (44% of lit pixels in immersive);
- a pair whose `immersive-on` frames are **1800×324 vs 1920×1080** — 3.3× the
  pixels, a different picture of a different amount of world — at mean 2.5.

So every step also needs, and these are not optional:

5. **`scripts/artInk.mjs`** — summed (not averaged) luminance above a floor,
   reported whole-frame *and* disc, plus the cross-mode ratio. Half as much light
   is half the number wherever it sits in the frame. Read frame for immersive and
   disc for normal: disc-only ink in immersive has ±12% run-to-run noise, the
   same size as some real signals.
6. **Bespoke presence checks** (`scripts/artPresence.mjs`, currently 5/5) for
   every layer the capture set structurally cannot see — five of step 3's seven
   never draw during a capture at all, and a green comparator on them follows
   identically from deleting the layer.
7. **Same-session control captures.** The boot fingerprint is not reproducible
   (8 relaunches, 8 fingerprints), so any comparison against a committed baseline
   measures code change plus boot race, inseparably. Capture the control and the
   candidate in one session, with the same harness.

Weight every parity judgement toward **`immersive-on`**: it is the exhibit mode,
and it is where the clear alpha (0.32 against 0.72) makes every accumulation
error 2.25× larger.

---

## 7. Structural outcome

`ArtTab.jsx` is 3208 lines. Each migrated layer becomes its own module as it
moves, so the file shrinks continuously rather than being rewritten in place.

If Phase 1 completes and `ArtTab.jsx` is still ~3000 lines, the migration
created a second problem instead of solving one. By step 6 it should read as
an orchestrator: simulation hooks, the projected-coordinate array,
hit-testing, and a `<Canvas>` mounting the layer modules.

---

## 8. Traps

### 8.1 The beat clock drives a visual

Covered in step 0. Restated here because it is the single most likely thing
to be silently lost: `beatPhaseRef` looks like audio state and is not.

### 8.2 `SomaPresence` is not audio

`src/terminal/audio/SomaPresence.js` lives in the audio directory but is the
**multiplayer layer** — peer cursors, fire events, phase broadcast — and it
feeds Collective Perturbation via `useCollectiveR`. Deleting the `audio/`
directory during step 0 would kill multiplayer.

Step 0 moves it out of `audio/` to remove the ambiguity permanently.

### 8.3 Projection must not move to the vertex shader

§3.1. The failure mode is not a crash — the sphere renders fine and every
interaction silently stops working, which is far harder to notice in review
than a black canvas.

### 8.4 Immersive mode changes canvas geometry, not just layers

`immersiveRef` gates the spectral ambient (`:841`) and Voronoi mesh (`:917`),
but also changes the canvas height calculation (`:580`), the rift alpha
(`:794`), and switches the container to `position: fixed` fullscreen
(`:2633`). The r3f `<Canvas>` must follow all of it, not just the layer
gating.

**AND `position: fixed` was not reaching the viewport at all — fixed 31bff8a.**
The immersive container measured **1800×324** on a 1920×1080 panel: a letterbox
strip with two thirds of the screen black. `.tab-fade-v2` animates with
`fill-mode: both`, so it permanently retained its 100% keyframe —
`filter: brightness(1)` and `transform: translateY(0)`. Both are *visually
identity*; both establish a containing block for `position: fixed` descendants,
so `inset: 0` resolved against the tab wrapper. `.breadcrumb-fade` had the same
latent trap. Fix: `backwards` instead of `both` — the 100% keyframe is identical
to the element's base style in every property, so `forwards` bought nothing.

Pre-existing since before the migration, and **structurally invisible to every
pixel gate in this repo**: the gates capture *the canvas*, and the canvas was
consistently the wrong size in all of them. Consequence: every committed
`immersive-on` baseline before `baseline/art-sphere-trail/` — including
`baseline/art-sphere-2d`, the pre-migration truth — is invalid, and `artInk.mjs`
refuses those rows as `GEOMETRY MISMATCH`. Any new immersive claim needs a fresh
reference. The exhibit now draws 3.3× the pixels it did while the bug was live.

---

## 9. Out of scope

### 9.1 KernelSphere stays dead

`src/terminal/views/manifesto/KernelSphere.jsx` (250 lines, r3f) is a 16-D→3-D
PCA projection of the same 272 nodes, with the seven manifesto chapters mapped
onto cluster centroids. It was built in `d0ada94` and never imported anywhere.
`manifestoChapters.js` and `ChapterPanel.jsx` are unmounted with it.

It is not resurrected here. Two 272-node spheres on one site read as the same
object rendered twice, and the weaker one discredits the stronger. Its PCA
axes are noted in §9.2 as a possible Phase 2 overlay on the real sphere.

The dead files are left in place, untouched, for now — deleting them is a
separate decision.

### 9.2 Phase 2 — the push

Named, not specified. To be brainstormed separately once Phase 1 parity is
locked and shipped:

- Volumetric depth and fog
- True additive light accumulation
- A far larger particle budget than 400
- Node-count headroom
- Depth of field
- Possibly the `kernelSpherePca` axes as an optional structural overlay,
  recovering the one genuinely distinct idea from KernelSphere

### 9.3 Site-wide audio

Explicitly future, explicitly not now. The author's interest is in
**strudel.cc** as a possible route to site-wide audio once the visual work is
finished.

Recorded assessment so it is not re-derived later: Strudel is a TidalCycles
port, strong at evolving polyrhythmic pattern material and capable of driving
techno through sample playback and drum machines. Its weakness is the
sound-design-heavy side — no deep FX chains or proper sidechain compression
the way a DAW provides. Viable, non-trivial, correctly out of scope.

Note that step 0 deletes the existing sonification entirely rather than
preserving it, so a future audio pass starts from a clean sheet rather than
from `SomaAudio.js`.
