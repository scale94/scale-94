# `_z1init` — the immersive-off divergence, LOCATED (2026-09-18)

Instrument: `scripts/_z1init.mjs`. Mirrors artBaseline's immersive window
exactly (the same sequence `_t9trace` mirrors, including the resize DELIVERY
and the real hover) and reads `window.__artInitLog` at each phase boundary.

## WHICH SETS ARE WHICH BUILD — read this before quoting any number

| prefix | build | use |
|---|---|---|
| `_z1init-2x-*` | HEAD + the initState log, no render counter | the first divergence (run `a`) |
| `_z1r-2x-*`, `_z1r-proj-*` | HEAD + log + render counter | 15 runs, all clean |
| **`_z1lazy-2x-*`** | **A SCRATCH PATCH THAT IS REVERTED** — `beaconIdx` hoisted into a lazy `useRef` initializer | the causal intervention ONLY |
| `_z1via-a`, `_z1w-*` | HEAD + log + a per-draw caller watch (also reverted) | caller attribution |

**`_z1lazy-*` IS NOT A PICTURE OF THIS BRANCH.** It is a different world by
construction — removing per-render draws shifts every between-frame draw. Its
world hashes must never be compared against any reference.

The per-draw watch in `_z1w-*` takes an `Error().stack` on EVERY draw. It is
slow enough to change the timing of the race it is measuring; six clean runs
under it are not six clean runs of the app.

## The finding

On `immersive-off` the ResizeObserver fires **twice**, with **no pumped frame
between the two callbacks** (so no reseed between them). On `immersive-on` it
fires once. Each callback ends in `initState()`, which re-scatters all 31 nodes
from 124 `artRandom` draws.

The gap between callback 5 and callback 6, in draws, decides the second
re-scatter's whole layout:

| build | gap 5 -> 6 | runs | immersive-off world |
|---|---|---|---|
| HEAD | **125** = 124 + 1 | 11 of 12 at 2x, 6 of 6 at projector | agree |
| HEAD | **124** | 1 of 12 at 2x | DIFFERENT, same edge count (134) |
| lazy patch | **124** | 4 of 4 | 3 agree, 1 diverges by another route |

The `+1` is one ArtTab render landing in that gap: React evaluates the
`useRef({ beaconIdx: Math.floor(artRandom() * ...) })` object literal on every
render and discards all but the first, so **every render takes one draw**.

Removing that draw (the lazy patch) made the gap exactly 124 in 4 of 4 runs —
the ±1 is gone. That is the causal test, and it is why this is located rather
than correlated.

## The failure is BINARY, and that is the strongest part of the finding

21 recorded runs at HEAD produced exactly **two** immersive-off worlds, never
three: `a0c3af39` on a gap of 125 draws (19 runs) and `280ffe40` on a gap of
124 (2 runs). Both divergent runs landed on the SAME hash. The record's "three
distinct world hashes" at 2x is a description of a chaotic process; this is not
one. It is a switch with two positions, thrown by whether one render lands in
the gap.

`_z2burst-h` is the direct observation: render count IDENTICAL at callbacks 5
and 6 (r20, r20), gap 124, world `280ffe40`. Every clean run increments by one
and reads 125.

## The fix is render-INDEPENDENT, measured within one build

`_z2lz-*` (8 recorded runs of the lazy patch) contains the controlled contrast:
runs a/b/e/f/g/h took one render across the gap, runs **c and d took none** —
and all eight produced `94356b54`. The contrast that flips the world at HEAD
produces no difference at all once the draw is hoisted.

## What is NOT explained -- and a correction to this file's first version

`_z1lazy-2x-b` diverged by a different signature: callback 5 entered **30 draws
late** (72 instead of 42) at an identical render count. This file originally
called that "a second displacement source". **That was one observation stated
as a fact, and it is retracted.**

Measured since: **28 further recorded runs of the lazy build** (`_z2lz-a..h`,
`_z2lz2-a..t`) are UNANIMOUS — one world (`94356b54`), callback 5 at 42 every
time, gap 124 every time. The 30-draw entry has never recurred, and the one run
that showed it had no frame recorder attached, so it cannot even be said whether
those draws were extra draws or a different frame boundary.

Detection power of those 28 runs, which is the honest limit:

| if the fault is | chance 28 runs would have caught it |
|---|---|
| 8% per run (the rate first estimated) | **90%** |
| 5% per run | 76% |
| 3% per run (1 in 32, its observed rate) | **57%** |

So a fault at 8% is ruled out with reasonable confidence and a fault at 3% is
not. Do not record source 2 as closed, and do not record it as established.
It is one unexplained observation below the rate that should block the fix.
