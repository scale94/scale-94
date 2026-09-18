# /art sphere — PHASE 1 reference, CERTIFIED (step 7 + item 1's fix)

Captured on `fix/art-sphere-index-space` at **`57f0d44`**, the commit that stops
every React render taking a draw from the sphere's stream. **This is the
reference phase 2 is measured against.** It does NOT supersede
`baseline/art-sphere-step5-certified/` — that set stays exactly where it is,
because the step-5-vs-step-7 parity numbers items 2 and 3 are argued from were
measured against it and must not move under them.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-phase1-certified baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase1-certified baseline/<name>
```

`artCompare` will refuse to score any row `ok` until the candidate carries a
certificate of its own. Certify a build once and every later comparison against
it is free:

```bash
node scripts/artBaseline.mjs --out baseline/wip-a     # and -b, -c
node scripts/artNull.mjs baseline/wip-a baseline/wip-b baseline/wip-c --write baseline/wip-a
```

**`p1ref-b`, `p1ref-c`, `p1ref-d` and `p1ref-e` are part of this set.** They are
named in `repro.dirs`, and `artInk` reads them to compute the same-build floor it
prints beside every ratio. Sweeping one silently costs this reference the floor
it was certified against.

**This is the first set on this branch that records which build it is.**
`gitCommit` was `null` in every manifest on disk because nothing had ever set
`BASELINE_COMMIT`. All five here carry `57f0d44`.

## Why this set exists

`beaconIdx` was drawn inside a `useRef({ ... })` object literal, which React
evaluates on every render and discards all but the first — so every render of
`ArtTab` consumed one draw from the sphere's private stream. On `immersive-off`
the `ResizeObserver` fires TWICE with no pumped frame between the two callbacks,
and each callback ends in `initState()`, which re-scatters all 31 nodes from 124
draws. Whether one render landed in that gap decided the entire second layout:
21 runs at 1520x900@2x produced exactly TWO worlds, `a0c3af39` on a gap of 125
draws and `280ffe40` on a gap of 124. `57f0d44` hoists the draw into a lazy
initializer and the gap is 124 in 28 recorded runs, including runs that took no
render across the gap where their siblings took one.

That changes the world, and therefore every reference on this branch that holds
an immersive row. This set is that world.

## WHAT MOVED, MEASURED — and it is the single most useful fact here

**The five normal states did not move at all.** Every one of the five sets
captured here hashes IDENTICALLY to `baseline/s7cond2-a`, the step-7 candidate
reference, at all three scales. Only the six immersive cells re-based.

| cell | `s7cond2-a` | this set |
|---|---|---|
| laptop@1x `idle` | a81a248e/127 | **a81a248e/127** |
| laptop@1x `hover` | 8d064eb4/132 | **8d064eb4/132** |
| laptop@1x `mid-drag` | 1307b9f8/128 | **1307b9f8/128** |
| laptop@1x `fired-cascade` | 3f109b5f/137 | **3f109b5f/137** |
| laptop@1x `resonance` | d92dcde6/117 | **d92dcde6/117** |
| laptop@1x `immersive-on` | 7a133196/127 | cad72951/126 |
| laptop@1x `immersive-off` | ff08bd06/134 | f2acc17d/134 |
| laptop@2x `idle` | a81a248e/127 | **a81a248e/127** |
| laptop@2x `hover` | 8d064eb4/132 | **8d064eb4/132** |
| laptop@2x `mid-drag` | 1307b9f8/128 | **1307b9f8/128** |
| laptop@2x `fired-cascade` | 3f109b5f/137 | **3f109b5f/137** |
| laptop@2x `resonance` | d92dcde6/117 | **d92dcde6/117** |
| laptop@2x `immersive-on` | 7a133196/127 | cad72951/126 |
| laptop@2x `immersive-off` | 3de6ce51/134 | f2acc17d/134 |
| projector `idle` | a39ed7c6/127 | **a39ed7c6/127** |
| projector `hover` | f8d08849/132 | **f8d08849/132** |
| projector `mid-drag` | a0a056dc/128 | **a0a056dc/128** |
| projector `fired-cascade` | fcc57868/133 | **fcc57868/133** |
| projector `resonance` | 0b3f3260/115 | **0b3f3260/115** |
| projector `immersive-on` | 43b76b01/103 | 4bf3d79c/103 |
| projector `immersive-off` | 8c7c8222/123 | 5d6f91d8/121 |

**So every existing parity and ink number for `idle`, `hover`, `mid-drag`,
`fired-cascade` and `resonance` still stands.** Item 2's per-cell rows, item 3's
spoke, every ink ratio quoted at a normal state — none of them are invalidated
by `57f0d44`, and none of them need re-deriving. Only the six immersive cells
are re-based, and the two `immersive-off` rows were never admissible in the
first place.

The mechanism predicts exactly this: the normal states involve no resize, so no
between-frame `initState()`, so nothing displaces them. Corroborated
independently by `scripts/_z2burst.mjs`, which reads world `50d32e49` at
`pre immersive-on click` on BOTH the patched and the unpatched build.

`immersive-on` moved too, which is worth saying plainly because a reader
expecting "the fix is about `immersive-off`" will not expect it. The capture
takes renders before the `immersive-on` resize as well; only `immersive-off` had
the two-callback gap that let that displacement decide the layout, but both
inherit a stream that now advances once per mount rather than once per render.

## THE TWO ROWS THAT HAD NEVER CERTIFIED NOW DO

`baseline/s7cond2-a` — the step-7 candidate reference — certified **19/21,
`partial: true`**, failing exactly:

```
laptop-1520x900@2x      immersive-off
projector-1920x1080@1x  immersive-off
```

Those two are the whole reason item 1 existed. Here they read **0.9907** and
**0.9915**, over five sets and ten pairs a cell, and all 21 cells agree on the
world hash as well as correlating — the runs drew the same graph, not merely a
similar picture.

## The same-build null

Five independent capture runs of `57f0d44`, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9829 | 0.9801 | 0.9797 |
| `hover` | 0.9943 | 0.9888 | 0.9879 |
| `mid-drag` | 0.9830 | 0.9813 | 0.9785 |
| `fired-cascade` | 0.9965 | 0.9963 | 0.9969 |
| `resonance` | 0.9972 | 0.9954 | 0.9929 |
| `immersive-on` | 0.9924 | 0.9903 | **0.9746** |
| `immersive-off` | 0.9940 | 0.9907 | 0.9915 |

**21/21 at floor 0.95. Worst cell anywhere: 0.9746**, projector
`immersive-on`. Detection power at five sets: a 1-in-3 intermittent fault is
caught 86% of the time.

That 0.9746 is **lower than `art-sphere-step5-certified`'s worst of 0.9775**, and
it is not presented here as an improvement on it. It is a different cell
(projector `immersive-on`, against that set's projector `mid-drag`), comfortably
over the floor, and it sits in the band the immersive cells have always occupied
at the projector scale. It is recorded so nobody later reads "21/21" as "tighter
everywhere". What IS better is coverage: 21 admissible cells against
`s7cond2-a`'s 19.

## What the null does and does not cover

It measures process-to-process variation: five separate browser launches against
one dev server, on one machine, one GPU, inside about sixteen minutes. The
renderer is probed per run, not asserted — `ANGLE (NVIDIA, NVIDIA GeForce RTX
4070 Ti, Direct3D11)`, the real driver, not SwiftShader.

It does **not** measure reproducibility across sessions, machines or GPU
drivers, and nothing on this branch does. It does not measure INK: `artNull`
certifies luminance CORRELATION, and `artInk` prints its own same-build floor
from `repro.dirs` for exactly that reason. Do not read a passing null as "this
picture is universal".

And it does not close the one thing item 1 leaves open. `_z1lazy-2x-b` showed
callback 5 entering 30 draws late at an identical render count, once, and it has
never recurred in 28 recorded runs of this build. That rules out a fault at 8%
per run with ~90% confidence and a fault at 3% with only 57%. **Not closed and
not established** — see `baseline/_z1init-NOTES.md`, which carries the
arithmetic.

## Capture notes for whoever re-captures next

- Capture into a FRESH directory. `artBaseline`'s boot fingerprint gate relaunches
  until it matches a value already in the output directory, and fifteen
  independent captures produced fifteen distinct fingerprints — it is a
  fine-grained hash of boot state, not a two-valued race. Every cross-run
  guarantee in this set comes from the null, not from the fingerprint.
- Set `BASELINE_COMMIT`. It is the only thing that puts a build id in the
  manifest.
- Never capture a reference with `--reseed-per-callback` / `__reseedEachCallback`.
  That is a diagnostic, and it produces a different picture, not a truer one.
- A three-scale capture is 3m20s–3m30s here; five sequential is about sixteen
  minutes. Wait on `manifest.json`, never on a log line.

## What is still 2D at phase 1

Two `ctx.` sites in `ArtTab.jsx`, and neither is a layer:

| site | what |
|---|---|
| `setTransform(dpr, …)` | sets the DPR |
| the `destination-out` partial clear | drives the trail fade |

The spec's "the 2-D canvas is now empty: delete it, its texture and the
composite quad" is therefore still wrong. Deleting it is a real change to how
the trail works — the GL trail accumulator would have to take over the fade
entirely — not a tidy-up. It is item 5c, an author's call.
