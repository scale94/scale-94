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

One race survives and is gated rather than fixed: module and WASM loading are
real-time, so boot lands in one of exactly two states (strictly bistable —
never a third). Each scale records its `bootFingerprint`, and re-runs relaunch
until they match, failing loudly after 8 tries rather than quietly diffing two
different worlds.

## How to use it at each step

**Step 2 has an unusually strong gate, and it should be used.** Step 2 mounts an
r3f `<Canvas>` above the 2D canvas and takes the 2D output as a texture. The
3130-line 2D draw loop is not touched. So:

- the **2D canvas hash must be byte-identical** to `manifest.json` for all 21
  states. Any change means step 2 perturbed the 2D layer, which it must not.
- the **screenshots are expected to differ** — that is the bloom, and it is the
  point. Compare them by eye against these references.

From step 3 onward layers move off the 2D canvas, so its hash changes by design
and the screenshots become the only visual gate.

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
