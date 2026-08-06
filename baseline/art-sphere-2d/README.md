> **SUPERSEDED as the working reference.** These frames were captured with
> the byte-hash harness, before it was rewritten to drive the GL layer.
> They remain the historical pre-WebGL record; the reference that step 3
> is measured against is `baseline/art-sphere-step2/`, and the gate is now
> `scripts/artCompare.mjs`, not hash equality. See that dir's README.

# /art sphere — pre-WebGL parity baseline

Captured on `fix/art-sphere-index-space`, on top of merged `main`, **before any
WebGL exists**. The sphere here is 100% Canvas2D. This is the "before" that spec
steps 2–6 are measured against.

Regenerate (from a running dev server on :5174):

```bash
node scripts/artBaseline.mjs && node scripts/artFrameTime.mjs --seconds 10
```

## What is here

| file | what it is |
|---|---|
| `manifest.json` | the actual gate — per-state canvas hashes, draw-cost stats, backing-store sizes |
| `<scale>__<state>.png` | reference frames, clipped to the sphere's own box |
| `frametime-headed-gpu.json` | wall-clock frame budget, real GPU |
| `frametime-headless-swiftshader.json` | same run under software GL, for comparison only |

Seven states — `idle`, `hover`, `mid-drag`, `fired-cascade`, `resonance`,
`immersive-on`, `immersive-off` — at three scales: laptop 1520×900 at 1× and 2×,
and projector 1920×1080. The 2× row exists because step 2 uploads the 2D canvas
as a texture every frame and that cost scales with the **backing store**
(2169×870 at 2×), not the CSS box.

Screenshots are clipped to the sphere's bounding box. The DOM label overlay sits
inside that box so labels are still captured, but the nav bar and control strip
are not: page chrome changing must never register as a sphere parity failure.

## Reproducibility — this is a gate, not a mood board

`scripts/determinism.mjs` pins `Math.random`, `performance.now`, `Date.now`,
`setTimeout`/`setInterval`, and frame advancement. rAF is queued rather than
scheduled, and the driver pumps an exact, constant number of frames, so
real-time waits in the driver cost zero frames.

**Verified:** two full independent capture runs produced all 24 hashes
identical (3 boot fingerprints + 21 state hashes).

Three things had to be fixed to get there, all of them the harness's fault
rather than the app's — worth knowing before trusting a future comparison:

1. **Timers had to be virtualised too.** Left on the real clock, a variable
   number of app timers fire during the driver's real-time waits. The idle
   frame hashed `2249bef0` on one run and `566f1193` on the next.
2. **Input dispatch races the pump.** CDP acknowledges an input command before
   the renderer has processed the event, so the input lands in this frame or the
   next. A 25ms real-time settle after each dispatch fixes it at zero frame
   cost. Without it the projector scale diverged from `hover` onward while its
   boot fingerprint and idle frame still matched — a very convincing way to
   look reproducible while not being.
3. **Async interactions need settling before pumping, not after.** Firing a
   node and completing a resonance pair kick off async work; absorb it with a
   real-time sleep, which does not advance the animation.

Step 2 added two more, both about a new dependency rather than a new renderer:

4. **Seed the RNG after module load, and again every frame.** Seeding once at
   document start is not enough — module evaluation consumes `Math.random()`
   before any app code runs, so merely *importing* three/r3f/postprocessing
   moved every captured hash while the draw loop was unchanged. And once a GPU
   layer is mounted, three calls `Math.random()` for every object UUID from the
   same global stream the simulation uses, continuously. The shim now re-seeds
   at the start of each frame; ArtTab draws first and advances the composite
   from its own tail, so the 2D layer is immune to what GL allocates afterwards.
5. **Never identify a canvas with `getContext()`.** Probing an uninitialised
   canvas with `getContext('2d')` permanently claims it, after which r3f can
   never obtain a WebGL context on it. That silently disabled the composite for
   a whole capture run and produced a bloom-free "step 2" set that looked
   entirely plausible. Selection is structural now, via `data-art-composite`.
   (Selecting by inline `cursor: grab` was the first attempt and also fails —
   ArtTab switches the cursor to `pointer` over a node.)

**The harness cannot see the GL layer.** It replaces `requestAnimationFrame`
with a manual pump, and r3f does not render under that — `useFrame` never runs,
in `frameloop="never"` and `"demand"` alike, so the cause is deeper than the
frameloop mode. The deterministic capture therefore gates the **2D layer only**.
That is sufficient for step 2 and **insufficient from step 3**, where real
content moves into GL: fixing it is a step-3 prerequisite. Until then
`scripts/artLiveShots.mjs` captures the GL layer live, non-reproducibly, for
looking at rather than hashing.

One race survives and is gated rather than fixed: module and WASM loading are
real-time, so boot lands in one of exactly two states (strictly bistable —
never a third). Each scale records its `bootFingerprint`, and re-runs relaunch
until they match, failing loudly after 8 tries rather than quietly diffing two
different worlds.

## How to use it at each step

**Step 2 has an unusually strong gate, and it should be used.** Step 2 mounts an
r3f `<Canvas>` above the 2D canvas and takes the 2D output as a texture. The
3130-line 2D draw loop is not touched. So:

There are 21 captured states: 7 states × 3 scales.

- the **2D canvas hash must be byte-identical** to `manifest.json` for the 18
  states that are not `immersive-on`. Any change means step 2 perturbed the 2D
  layer, which it must not.
- the 3 **`immersive-on`** states must change, because step 2 deletes the fake
  `ctx.filter` bloom and the radial-gradient vignette from the draw loop —
  today's only 2D post-process, and gated on `immersiveRef`, so no other state
  is affected. That deletion is the point of the step.
- the **screenshots are expected to differ** for every state — that is the
  bloom, and it is the point. Compare them by eye against these references.

From step 3 onward layers move off the 2D canvas, so its hash changes by design
and the screenshots become the only visual gate.

## Coupled constants

`DPR_CAP` in `src/terminal/art/artComposite.js` and the `1.5` in
`src/terminal/views/ArtTab.jsx`'s ResizeObserver are the same number in two
places. If they diverge the fullscreen quad resamples the 2D output instead of
presenting it texel-for-texel, which reads as a soft, slightly blurred sphere —
easy to mistake for the bloom radius being too wide.

## What step 2 actually measured

Reference re-captured on `9f6cc71` after the harness fixes below; step-2 capture
in `baseline/art-sphere-step2/`.

**2D parity: 15 of 21 states byte-identical.** The 6 that differ are exactly
`idle` and `immersive-on` on each of the three scales.

- `immersive-on` ×3 — **differs by design.** Step 2 deletes the fake
  `ctx.filter` bloom and the radial-gradient vignette from the draw loop.
- `idle` ×3 — a residual, not a rendering change. `idle` is captured first, and
  the composite's three.js allocations interleave with ArtTab's `initState` in
  the mount frame. Every state captured later — `hover`, `mid-drag`,
  `fired-cascade`, `resonance` — is byte-identical, which is what shows the 2D
  layer itself is untouched.
- **Discount `immersive-off`.** All three are a blank canvas with only DOM labels
  on it: exiting immersive leaves the sphere unpainted for well over 600 frames.
  They hash identically no matter what, which is why they survived a full RNG
  reseed unchanged. Worthless as a gate, and **pre-existing** — the same hashes
  appear in the pre-step-2 reference. So the meaningful match count is **12 of
  21**, not 15.

**Cost, headed on the real GPU, 1520×900, idle:**

| | p50 | p95 | p99 |
|---|---|---|---|
| before (2D only) | 1.5 ms | 11.2 ms | 14.7 ms |
| + quad and texture upload | 2.2 ms | 11.8 ms | 14.9 ms |
| + bloom (shipped) | 2.6 ms | 12.5 ms | 18.1 ms |

The whole composite costs about **+1.1 ms at p50 and +1.3 ms at p95** — inside
the "acceptable, record it" band. The upload is the larger half. Frame rate fell
from ~480 to ~160 fps, still far above 60. One number did get worse and should
not be rounded away: **idle p99 crossed the frame budget, 14.7 ms → 18.1 ms.**

## Frame budget

Measured headed on the real GPU, 1520×900, sphere 1446×580, 10s per state:

| | p50 | p95 | p99 | max |
|---|---|---|---|---|
| idle — draw cost | 1.5 ms | 11.2 ms | 14.7 ms | 18.7 ms |
| drag — draw cost | 1.6 ms | 11.2 ms | 13.5 ms | 17.2 ms |

**Read the tail, not the median.** The median frame is cheap; it is the p95 that
matters, and it is ~7× the median. At a 16.7 ms budget a p95 of 11.2 ms is the
draw loop alone consuming two-thirds of the frame, and the p99/max exceed the
budget outright. There are three rAF loops on this page (4784 rAF ticks vs 1595
`draw` calls over 10s, a clean 3:1), so `draw` is not the only claimant. Steps
4–6 target exactly this tail: `ctx.shadowBlur` and per-node
`createRadialGradient` are the obvious spike sources.

**Caveat on the interval numbers, stated plainly:** rAF is *not* vsync-capped in
either configuration here (p50 interval 1.4 ms ≈ 700 fps headed). So the
interval distribution in these JSON files is **not** a user-experienced fps
figure and must not be quoted as one. Draw cost is the number that transfers.
A true fps reading needs the author's own browser on the target hardware.

Software-GL figures (`frametime-headless-swiftshader.json`) run about 30–40%
slower and exist only so the headless capture rig's numbers can be sanity
-checked against the real one. Never compare a headless number to a headed one.
