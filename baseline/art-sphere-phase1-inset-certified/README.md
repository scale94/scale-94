# /art sphere — PHASE 1 reference, CERTIFIED (immersive inset)

Captured on `fix/art-sphere-index-space` at **`c302167`**, which is
`dc397b2` — the commit that stops immersive drawing the sphere underneath the
app header — plus its instruments. **This is the reference phase 2 is measured
against.** It supersedes `baseline/art-sphere-phase1-certified/`, captured six
hours earlier at `57f0d44`, for exactly three of its twenty-one cells.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-phase1-inset-certified baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase1-inset-certified baseline/<name>
```

**`p1iref-b`, `p1iref-c`, `p1iref-d` and `p1iref-e` are part of this set.** They
are named in `repro.dirs`, and `artInk` reads them for the same-build ink floor
it prints beside every ratio. Sweeping one silently costs this reference the
floor it was certified against. All five carry `gitCommit` `c302167`.

## Why this set exists

The immersive container was `fixed inset-0` — the full viewport — while the app
header is `sticky top-0`, `h-24`, painting `rgba(0,0,0,0.9)` with a 12px
backdrop blur over whatever is beneath it. MEASURED at 1920×1080: the sphere's
projected envelope reached y 50 against a header bottom edge of 96, and the
sphere was centred at y 540 while the band it can actually be seen in centres on
588. `dc397b2` insets the container below the header, so `min(w, h)` — and
therefore `sphereR` — is computed from the height the artwork actually has.

That moves the immersive picture, and therefore this reference.

## WHAT MOVED: THREE CELLS, AND THEY ARE ALL `immersive-on`

Measured against `baseline/art-sphere-phase1-certified`, cell by cell:

| cell | phase1-certified | this set |
|---|---|---|
| laptop@1x `immersive-on` | cad72951/126 | **1138486a/126** |
| laptop@2x `immersive-on` | cad72951/126 | **1138486a/126** |
| projector `immersive-on` | 4bf3d79c/103 | **796af83c/103** |
| *the other eighteen* | | **bit-identical** |

`idle`, `hover`, `mid-drag`, `fired-cascade` and `resonance` hash identically at
all three scales, **and so do both `immersive-off` rows** — f2acc17d/134 at both
laptop scales and 5d6f91d8/121 at the projector, unchanged.

Two things worth reading off that table:

**The edge counts did not move.** 126, 126 and 103 on both sides. The same graph
at different coordinates, which is what a pure geometry change should produce
and what a change that had disturbed the simulation would not.

**`immersive-off` is unchanged because it returns to the normal-mode geometry**,
and the inset only alters the immersive box. This was predicted by
`scripts/_z2burst.mjs` before the capture — it read `immersive-off` at
`94356b54` with the stream gap still 124 and `initState` still at 7 calls, both
identical to the pre-inset build — and the capture confirms it at all three
scales. Item 1's fix is intact underneath this one.

So every parity and ink number quoted at a normal state, and at either
`immersive-off` row, still stands against the older set. Items 2 and 3 are
untouched.

## The same-build null

Five independent capture runs of `c302167`, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9870 | **0.9776** | 0.9836 |
| `hover` | 0.9905 | 0.9873 | 0.9882 |
| `mid-drag` | 0.9807 | 0.9791 | 0.9818 |
| `fired-cascade` | 0.9958 | 0.9976 | 0.9958 |
| `resonance` | 0.9959 | 0.9955 | 0.9918 |
| `immersive-on` | 0.9835 | 0.9901 | 0.9808 |
| `immersive-off` | 0.9940 | 0.9907 | 0.9894 |

**21/21 at floor 0.95. Worst cell anywhere: 0.9776**, laptop@2x `idle`. All 21
cells also agree on the world hash, so the runs drew the same graph and not
merely a similar picture. Detection power at five sets: a 1-in-3 intermittent
fault is caught 86% of the time.

For comparison, and neither direction is a claim about quality: the previous set
worst 0.9746 at projector `immersive-on`, and `art-sphere-step5-certified` worst
0.9775. All three sit in the same band. What matters is that all 21 are
admissible, which was first true of the previous set and remains true here.

Note the worst cell is now a NORMAL state (`idle`), not an immersive one — the
immersive rows read 0.9808–0.9940, their tightest yet on this branch. The
immersive box is smaller than the viewport now, so there is less of it to
disagree about.

## What the null does and does not cover

Five separate browser launches against one dev server, one machine, one GPU,
inside about seventeen minutes. Renderer probed per run, not asserted: `ANGLE
(NVIDIA, NVIDIA GeForce RTX 4070 Ti, Direct3D11)`.

It does **not** measure reproducibility across sessions, machines or GPU
drivers, and nothing on this branch does. It does not measure INK — `artNull`
certifies luminance CORRELATION and `artInk` carries its own same-build floor
from `repro.dirs` for that reason.

And it does not close item 1's one open observation: `_z1lazy-2x-b` showed
callback 5 entering 30 draws late, once, never reproduced in 28 recorded runs.
Ruled out at 8% per run with ~90% confidence, at 3% with 57%. Not closed, not
established — `baseline/_z1init-NOTES.md` carries the arithmetic.

## WHAT THIS SET IS NOT A PICTURE OF

**Item 5b is still open and this reference contains it.** The immersive scaling
law was re-measured at this exact commit (`scripts/_a2scale.mjs`): `sphereR`
goes ×1.372 at 1520×900 and ×1.692 at 1920×1080 on the toggle, while the node
disc radius goes ×0.985 / ×0.963 and the edge line width ×0.889 / ×0.950. The
cage grows with display height and the ink does not — 1.393× and 1.757× sparser
respectively. The inset took roughly 8% off that at the laptop scale and nothing
off the mechanism.

So these immersive frames are the CURRENT composition, not a settled one. If the
author takes item 5b — capping `sphereR` in immersive, or scaling the node
radius and line width with it — it will re-base these same three cells again,
and this README should be read as the record of what they looked like before
that decision rather than as a target to preserve.

## Capture notes

- Fresh directory per run. The boot fingerprint gate relaunches until it matches
  a value already in the output directory, and fifteen independent captures
  produced fifteen distinct fingerprints. Every cross-run guarantee here comes
  from the null, not the fingerprint.
- Set `BASELINE_COMMIT`. It is the only thing that puts a build id in the
  manifest.
- Never capture a reference with `--reseed-per-callback` / `__reseedEachCallback`.
- A three-scale capture is 3m20s here; five sequential plus certification is
  about eighteen minutes. Wait on `manifest.json`, never on a log line.
