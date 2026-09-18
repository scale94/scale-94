# /art sphere — PHASE 1 reference, CERTIFIED (bloom + immersive ink)

Captured on `fix/art-sphere-index-space` at **`b8ad97f`**, 2026-09-18. **This is
the reference phase 2 is measured against.** It supersedes
`baseline/art-sphere-phase1-inset-certified/`, captured at `c302167`.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-phase1-bloom-ink-certified baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase1-bloom-ink-certified baseline/<name>
```

**`p1bref-b`, `p1bref-c`, `p1bref-d` and `p1bref-e` are part of this set.** They
are named in `repro.dirs`, and `artInk` reads them for the same-build ink floor
it prints beside every ratio. Sweeping one silently costs this reference the
floor it was certified against. All five carry `gitCommit` `b8ad97f`.

## THIS SET RE-BASES ALL TWENTY-ONE CELLS, AND THAT IS UNUSUAL

Read this section before reading any row as unchanged. The previous two
references each moved **three** cells, and a reader who pattern-matches on that
will mis-read every quiet-looking row here.

This one pays for **two** changes at once, deliberately batched so the 21 cells
are captured once instead of twice:

- **Item 5a, the bloom** (`d1936f2` pyramid 8→5 levels, `7899b7a` intensity
  1.1→0.6). A **composite** change: it alters every cell's pixels, in all three
  scales and all seven states.
- **Item 5b, the ink scale** (`b8ad97f`). A **geometry** change, and it moves
  the world hash of the three `immersive-on` cells and nothing else.

The reference was held back through both bloom commits on the author's explicit
instruction so that one capture would settle both. That is why the previous
reference's own README says item 5b "will re-base these same three cells again"
— it did, and 5a re-based the other eighteen underneath it.

## WHAT MOVED: the world hash, three cells

| cell | inset-certified | this set |
|---|---|---|
| laptop@1x `immersive-on` | 1138486a/126 | **2fbd6cd2/126** |
| laptop@2x `immersive-on` | 1138486a/126 | **2fbd6cd2/126** |
| projector `immersive-on` | 796af83c/103 | **28975b7c/103** |
| *the other eighteen* | | **identical** |

`idle`, `hover`, `mid-drag`, `fired-cascade` and `resonance` hash identically at
all three scales, **and so do both `immersive-off` rows** — f2acc17d/134 at both
laptop scales and 5d6f91d8/121 at the projector, unchanged since `c302167`.

Three things to read off that table:

**The edge counts did not move.** 126, 126 and 103 on both sides, and no cell
anywhere changed its count. The same graph drawn thicker, which is what a pure
ink change should produce.

**`sphereR` did not move either** — 338.789 at both laptop scales and 414.637 at
the projector, identical to the previous reference to the last digit. That is
the check that item 5b took the *scale the ink* branch and not the *cap the
cage* one. Had anything been capped by accident, this is where it would show.

**`immersive-off` is unchanged because `inkScale` is exactly 1 outside immersive**
— numerator and denominator are the same expression on the same width. Predicted
by `scripts/_z2burst.mjs` before the capture (it read `OFF=94356b54` with the
stream gap still 124, both the values the handover named as the tripwire), and
confirmed here at all three scales.

## WHAT MOVED: the pixels, all twenty-one

Not one of the 21 frames is byte-identical to the previous reference. That is
5a, and it is expected. What it is *worth* is a different question, and
`artCompare` answers it — mean of the 32×18 signature diff, 0–255 scale:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.063 | 0.044 | 0.064 |
| `hover` | 0.039 | 0.057 | 0.067 |
| `mid-drag` | 0.070 | 0.056 | 0.068 |
| `fired-cascade` | 0.432 | 0.478 | 0.532 |
| `resonance` | 0.341 | 0.238 | 0.167 |
| **`immersive-on`** | **0.664** | **0.659** | **0.878** |
| `immersive-off` | 0.233 | 0.040 | 0.059 |

**21/21 admissible** — inside threshold 4 and reproducible on both sides.

The gradient is the physics: bloom only touches pixels above
`luminanceThreshold` 0.28, so a quiet `idle` frame has almost nothing for it to
act on, while `fired-cascade` and `resonance` are mostly bright ink.

**And the quiet rows are below this instrument's own noise.** `immersive-off`
has a *provably identical* world — same hash, same geometry — and still reads
0.040 to 0.233 across the three scales. That spread is run-to-run, so anything
at 0.04–0.07 is not resolvable here. It does **not** mean the bloom did nothing
to `idle`: 5a measured its effect with a radial profile against a bloom-off
control and found the pyramid's far-field contribution going +7.4% → +0.6%. It
means a whole-frame mean cannot see it, which is the same lesson the branch
already wrote down as "measure a profile, not a mean".

`immersive-on` at 0.66–0.88 is the one row clearly above that floor, and it is
the row carrying both changes.

## WHAT MOVED: the ink

`artInk`, this set against the previous reference, **per state**, `disc` column.
Read this table and not the tool's mode rollup: that rollup is sum-weighted, and
`fired-cascade` is heavy enough to drag a whole row with it — the tool says so
itself.

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.992 | 0.998 | 0.991 |
| `hover` | 0.984 | 0.975 | 0.979 |
| `mid-drag` | 0.988 | 0.989 | 0.988 |
| `fired-cascade` | 0.948 | 0.944 | **0.920** |
| `resonance` | 0.944 | 0.935 | 0.924 |
| **`immersive-on`** | **1.543** | **1.520** | **1.915** |
| `immersive-off` | 1.000 *(noise)* | 0.992 | 0.988 |

This separates the two commits cleanly, and it is the most useful table here.

**The bloom cut took ink out in proportion to how much was lit.** The quiet
states lose 0.2–2.5%; `fired-cascade` and `resonance` lose 5–8%. Geometry is
byte-identical in every one of those cells, so all of it is 5a. That gradient is
the same one `artCompare` shows above, measured a different way.

**`immersive-on` gained 1.52× to 1.92×.** That is 5b, and it is larger than
`inkScale` itself (1.386 at the laptop, 1.697 at the projector) because a
stroke's area grows linearly with its width while a disc's grows with the square
of its radius; a mixed population lands above the linear figure. The `frame`
column reads 2.040 at the projector — **the exhibit mode now carries roughly
twice the ink it did.**

**`immersive-off` is the internal control** and it behaves: 1.000, 0.992, 0.988,
against a world hash that did not move. At laptop@1x that row is graded `noise`,
meaning this instrument cannot tell it from running the same build twice — which
is the correct result for a cell where nothing changed but the bloom.

## The same-build null

Five independent capture runs of `b8ad97f`, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9826 | 0.9915 | **0.9791** |
| `hover` | 0.9950 | 0.9897 | 0.9874 |
| `mid-drag` | 0.9843 | 0.9839 | 0.9812 |
| `fired-cascade` | 0.9961 | 0.9966 | 0.9966 |
| `resonance` | 0.9969 | 0.9951 | 0.9910 |
| `immersive-on` | 0.9866 | 0.9901 | 0.9859 |
| `immersive-off` | 0.9926 | 0.9907 | 0.9878 |

**21/21 at floor 0.95. Worst cell anywhere: 0.9791**, projector `idle`. All 21
cells also agree on the world hash, so the runs drew the same graph and not
merely a similar picture. Detection power at five sets: a 1-in-3 intermittent
fault is caught 86% of the time.

For comparison, and neither direction is a claim about quality: the previous set
worst 0.9776, `art-sphere-step5-certified` worst 0.9775. All three sit in the
same band. The worst cell is a normal state again, as it was last time.

The `immersive-on` rows read 0.9859–0.9901 — no worse than before, despite
carrying roughly twice the ink. Thicker ink did not make the exhibit mode less
reproducible.

## TWO FIELDS IN THIS MANIFEST THAT ARE TRAPS

Found while writing this README, and recorded because both are easy to reach for
and both will mislead.

**`canvasHash` is not the artwork.** At laptop@1x it reads `d5b63165` for
`idle`, `hover`, `mid-drag`, `fired-cascade`, `resonance` AND `immersive-off` —
six visually different frames. It hashes the 2-D canvas, which has been nearly
empty since the GL migration. Compared across these two references it reports
21/21 identical, which would have said the bloom changed nothing.

**`shotHash` is not a change signal either.** It differs in all 21 cells here —
and it also differs between two runs of the *same* build, because the frames are
not byte-reproducible at all (that is why the null measures correlation). It can
prove two files are the same; it can never show that a change happened.

The instruments that answer "did this move" are `view.world.hash` for geometry,
`artCompare` for pixels and `artInk` for ink, each against its own floor.

## What the null does and does not cover

Five separate browser launches against one dev server, one machine, one GPU,
inside about seventeen minutes. Renderer probed per run, not asserted: `ANGLE
(NVIDIA, NVIDIA GeForce RTX 4070 Ti, Direct3D11)`. Zero console errors in all
five sets, all three scales.

It does **not** measure reproducibility across sessions, machines or GPU
drivers, and nothing on this branch does. It does not measure INK — `artNull`
certifies luminance CORRELATION and `artInk` carries its own same-build floor
from `repro.dirs` for that reason.

And it does not close item 1's one open observation: `_z1lazy-2x-b` showed
callback 5 entering 30 draws late, once, never reproduced in 28 recorded runs.
Not closed, not established — `baseline/_z1init-NOTES.md` carries the arithmetic.

## WHAT THIS SET IS NOT A PICTURE OF

**Item 5b's two aesthetic dials are deferred, not decided.** `inkScale` is
applied at FULL STRENGTH and UNCLAMPED here. Whether it should be clamped to
`>= 1`, and whether it should run under an exponent, are the author's calls and
he has not made them. The only case a clamp protects is a window shorter than
its own normal-mode canvas — at 600×400 immersive the ink would go *thinner* —
which no exhibit display reaches. If either dial moves, these three
`immersive-on` cells re-base a third time.

**The immersive trail gain is the next pass and this set makes it more urgent.**
`RIFT_ALPHA` is 0.72 normal against 0.32 immersive, a 3.125× standing gain into
an RGBA8 accumulator, and 869 of the fired state's 1429 clipped pixels already
clipped with the bloom entirely off — i.e. upstream of the post stack. The
handover predicted 5b would make that worse, and the `frame` ratio above puts a
number on it: **roughly 2× the ink into the same accumulator.** These immersive
frames should be read as the state that pass starts from, not as a target.

**`luminanceThreshold` (0.28) was never swept**, and a dither for the 8-bit
banding on black is unstarted. The bloom pyramid is already half-float, so that
dither belongs in the screen pass and nowhere else.

## Capture notes

- Fresh directory per run. Every cross-run guarantee here comes from the null,
  not from the boot fingerprint.
- Set `BASELINE_COMMIT`. It is the only thing that puts a build id in the
  manifest, **and it is not checked against the working tree** — capturing with
  uncommitted changes will stamp a commit that does not contain them. This set
  was captured from a clean tree at `b8ad97f`.
- Never capture a reference with `--reseed-per-callback` / `__reseedEachCallback`.
- A three-scale capture is 3m20s here; five sequential plus certification is
  about eighteen minutes. Wait on `manifest.json`, never on a log line.
- `p1iref-b..e`, the previous reference's siblings, are unblocked now that this
  set is certified and carries its own — that was the handover's condition. But
  sweeping them is not free: `art-sphere-phase1-inset-certified` loses the
  same-build ink floor it was certified against, so `artInk` can no longer grade
  a row against it as SIGNAL or noise. Keep the reference either way — its
  README is the record of what the immersive cells looked like before 5a and 5b.
