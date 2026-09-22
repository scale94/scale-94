# /art sphere — PHASE 5 reference, CERTIFIED (prism ruled: chroma arm A + packet arm 3)

Captured on `feature/chaos-prism-depth-dash-beads` at **`75ec6de3`**,
2026-09-22/23. **This is the reference later work is measured against.** It
supersedes `baseline/art-sphere-phase4-prism-dash-certified-a/` at `21e98283`.

**It supersedes it; it does not correct it.** Phase 4 is an accurate picture
of the build it was taken from. Five deliberate changes landed on top of it,
none of them ortho/dash/bead work — all five are the prism itself:

1. **Strimer depth cue** — a distance-based visual adjustment on the strimer
   layer (in-branch, pre-prism).
2. **Prism envelope on the clock** — `77d5612c` fixed the envelope from a
   frame-COUNT to a real-time measure (5th instance of that bug class on this
   project; see `strimer §4.6`, checkpointed first at `9723f94`).
3. **Prism wavefront** — `49a7351a` onward gave the prism a longitudinal
   wavefront: chord tessellation forced to carry it (`5a850395`), colour
   advected along its own coordinate (`b4ce9e4e`, `4dc1f139`), the unison
   collapse (`5b623948`), three chroma arms behind one anchor (`a8bda689`,
   `48f9bc1b`).
4. **Chroma arm A (achromatic lead) shipped as default** — `9fcc61e6`,
   "arm 2 (ACHROMATIC) is now the prism default." The crest bleaches toward
   white; hues do not move. Ruled after the author's eye reversed two calls
   made by proxy metric — see `project_chaos_chroma_ab.md`: **"the comb's
   diversity IS the structure; the +13.6% luminance IS the mechanism — never
   tune it down."**
5. **Packet arm 3 shipped as default** — `43ed17a8`, "arm 3 wins ship it,"
   ruled live on the author's 360Hz AW2725DF across all five arms. Arm 3
   narrows both the shear and the pulse bundle in lockstep (`w * 0.6`,
   `step * 0.6`), forces 72 tessellation segments (down from 80 — arm 4,
   the widest, was deleted on this ruling, and the buffer was repaid, not
   doubled). `PRISM_PACKET_ARM_RULED = 3` in `src/terminal/art/artEdges.js`.

**Also cosmetic, not visual:** `75ec6de3` changed the tab's DOM caption and
path text (`~/system/chaos`, festival string dropped) — no canvas pixel moves
because of it. It is the tip commit only because it is HEAD; it carries none
of the five changes above.

```bash
node scripts/artBaseline.mjs --out baseline/<name> --url http://localhost:5173/
node scripts/artCompare.mjs baseline/art-sphere-phase5-prism-ruled-certified-a baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase5-prism-ruled-certified-a baseline/<name>
```

`BASELINE_COMMIT` was left unset for this capture, per the handover's §4 item
1 correction (unchanged since phase 4): provenance comes from
`git rev-parse HEAD` via `scripts/_git.mjs`, guarded by the dirty-tree check.
All five sets carry `gitCommit 75ec6de364e392145ca1ebe381f54ca81b92cec6`,
`gitBranch feature/chaos-prism-depth-dash-beads`, `gitDirty false`,
`provenanceSource git`. The dirty-tree guard was never exercised because the
tracked tree stayed clean start to finish — no tracked file was touched
between the first set and the last, since the dev server is Vite with HMR and
would have delivered any edit into the page mid-capture.

**`-b`, `-c`, `-d` and `-e` are part of this set.** They are named in
`repro.dirs` and carry the same `gitCommit`. Sweeping one silently costs this
reference the floor it was certified against. Only `-a` is tracked, the
practice every prior phase established.

This set is the same 24 cells phase 4 introduced (the eighth, `ortho-bridge`,
right-clicks four nodes through `page.rightClick`; see phase 4's README for
why that state exists and what it forges per scale). Nothing about the ortho
layer changed on this branch since phase 4, so that finding is not repeated
here — read it there.

## THE SAME-BUILD NULL

Five independent capture runs of `75ec6de3`, ten pairs per cell,
`scripts/artNull.mjs --write`. Worst off-diagonal luminance correlation at
full resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9775 | 0.9706 | 0.9843 |
| `hover` | 0.9886 | 0.9857 | 0.9911 |
| `mid-drag` | 0.9816 | 0.9749 | 0.9847 |
| `fired-cascade` | 0.9933 | 0.9930 | 0.9954 |
| `resonance` | 0.9976 | 0.9961 | 0.9938 |
| `immersive-on` | 0.9845 | 0.9827 | 0.9886 |
| `immersive-off` | 0.9933 | 0.9900 | 0.9888 |
| `ortho-bridge` | 0.9991 | 0.9983 | 0.9990 |

**24/24 at floor 0.95. Worst cell anywhere: 0.9706**, laptop@2x `idle` — the
same cell/scale that carried the worst number in phase 4 (0.9744), and in the
same band. Detection power at five sets: a 1-in-3 intermittent fault is
caught 86% of the time.

Certified into `manifest.json` via `artNull.mjs --write`.

## COMPARE AGAINST PHASE 4 — AND THE BLINDNESS FINDING

`node scripts/artCompare.mjs baseline/art-sphere-phase4-prism-dash-certified-a baseline/art-sphere-phase5-prism-ruled-certified-a`:

**24/24 states ADMISSIBLE** (inside threshold 4 mean-abs-diff, and both sides
reproducible against their own same-build null). Every cell's mean/max sits
inside or near its own null band — there is no cell here that reads anything
like phase 4's own `fired-cascade` row against phase 3 (mean 0.78–1.09,
max 58.8–67.6, an order of magnitude above everything else in that table).

| state | laptop@1x mean/max | laptop@2x mean/max | projector@1x mean/max |
|---|---|---|---|
| `idle` | 0.193 / 2.0 | 0.069 / 9.7 | 0.028 / 7.4 |
| `hover` | 0.264 / 3.1 | 0.061 / 4.5 | 0.060 / 2.6 |
| `mid-drag` | 0.238 / 4.3 | 0.048 / 1.8 | 0.055 / 0.3 |
| **`fired-cascade`** | **0.090 / 6.0** | **0.063 / 4.9** | **0.056 / 0.5** |
| `resonance` | 0.270 / 4.0 | 0.060 / 4.5 | 0.045 / 0.2 |
| `immersive-on` | 0.213 / 7.4 | 0.047 / 9.2 | 0.052 / 1.1 |
| `immersive-off` | 0.028 / 0.5 | 0.050 / 0.7 | 0.044 / 0.3 |
| `ortho-bridge` | 0.280 / 5.2 | 0.092 / 4.0 | 0.127 / 11.7 |

**SAY THIS LOUDLY: `fired-cascade` — the one cell that left-clicks a node,
calls `spawnEffect`, and is the only state that ever puts a prism chord on
the sphere at all — scores at or inside its own same-build null in every
scale.** laptop@1x mean 0.090 against a null band of 0.9863→0.9933 (phase
4's `fired-cascade` null was 0.9863; this set's own is 0.9933 — both sides
tightened, not loosened); laptop@2x mean 0.063; projector@1x mean 0.056, the
smallest max (0.5) of any state in the whole table. **All five prism changes
land in this cell and none of them move the mean/max instrument past
same-build noise.**

`artInk.mjs` against the same pair confirms it independently, on a different
metric (summed luminance above a floor, not a signature diff): `fired-cascade`
reads **`noise`** in every scale and region —

| scale | region | ink ratio | floor | read |
|---|---|---|---|---|
| laptop@1x | frame | 1.012 | ±0.016 | noise |
| laptop@1x | disc | 1.006 | ±0.015 | noise |
| laptop@2x | frame | 1.000 | ±0.011 | noise |
| laptop@2x | disc | 1.006 | ±0.001 | SIGNAL (but 0.6% total) |
| projector@1x | frame | 1.003 | ±0.001 | SIGNAL (but 0.3% total) |
| projector@1x | disc | 1.002 | ±0.005 | noise |

Across all 48 graded rows in the full `artInk` run, 9 read SIGNAL and 39 read
noise, and the SIGNAL rows that do appear (`mid-drag` frame at both laptop
scales, `resonance` disc, `immersive-off` frame at laptop@2x — a state the
tool itself flags "blank, proves nothing") **do not cluster on
`fired-cascade` or trace to the prism at all.** There is no ink signature
here that says "the prism moved."

**Is the reference blind, the way it was blind to the ortho layer in phase
4?** Not in the same shape. The ortho layer literally never fired in any of
the 21 states phase 3 captured — `vIsOrtho` was 0 in every pixel of every
frame, a zero-population bug, not a measurement-sensitivity one. Here,
`fired-cascade` DOES fire the effect every run (the capture log records
"fired-cascade carries 3 pulse ring(s)" in all five sets, all three scales) —
the prism chord is on screen. **But the instruments this reference is
certified against (mean/max luminance-signature diff, and summed
above-floor luminance) are not sensitive to what these two rulings actually
changed:**

- Packet arm 3 **narrows** the pulse's spatial packet (bundle 2w+6·step drops
  from 0.66 of the chord under arm 0 to 0.396 under arm 3) — it redistributes
  where energy sits along the chord, without a design intent to add energy.
  A narrower packet at similar peak intensity does not obviously move a
  *summed* luminance metric.
- Chroma arm A moves **hue**, and the design spec for this exact work says so
  explicitly: *"the bundle puts 288deg of the hue wheel on screen 2.8px
  apart, so a crest has no reference hue to be different from and no
  excursion of any size is trackable"* (`2026-09-22-prism-chroma-ab-design.md`).
  Arm A's own mechanism is desaturation toward white on the leading edge,
  which IS a luminance change (the author's own ruling names "+13.6%
  luminance" as load-bearing) — but that number was measured on a same-page
  uniform A/B at the moment the wake is brightest, not necessarily at the
  single stepped frame this harness happens to land `fired-cascade` on.

**So say it plainly: this reference set, on the instruments it ships with,
cannot see any of the five prism changes it exists to protect.** It is
certified reproducible (24/24, worst 0.9706) and it is a faithful picture of
`75ec6de3` — but a regression that deleted chroma arm A, reverted to packet
arm 0, or hollowed out the wavefront entirely would very plausibly still
score ADMISSIBLE against it, the same shape of failure phase 4's README
documented for the ortho bridge before `ortho-bridge` was added as an eighth
state. **No cell here plays that role for the prism.** Building one — a state
whose shot is timed to the wake's peak, or that isolates the prism chord the
way `ortho-bridge` isolates the forged edge — is open work, not done by this
capture.

## WHAT THIS SET IS NOT A PICTURE OF

**It does not isolate the prism.** All 24 cells are the same interaction
states phase 4 defined; none of them were added or re-timed to specifically
exercise chroma arm A or packet arm 3. Read the blindness finding above
before quoting this set as evidence a prism regression would be caught.

**The bead/disc-streak items carried in phase 4 are unchanged and still
open** — the ~38× disc↔streak ink discontinuity (item 3 in the handover) and
stale mobile fps are untouched by this recut; see phase 4's README and the
handover §4 for their status.

## Capture notes

- Fresh directory per run; no run inherited another's boot fingerprint.
- Clean tracked tree for all five sets and all five `artNull` writes — `git
  status` showed no tracked changes at any point during capture.
- The dev server was already running on **5173**; `--url` was passed
  explicitly on every run (artBaseline's own default, 5174, is not listened
  on by this checkout's `vite.config.js`).
- Zero console errors, all five sets, all three scales. Renderer probed per
  run: `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti, Direct3D11)`.
- `canvasHash` and `shotHash` remain traps — see phase 1's README. Neither can
  tell you whether a composite change happened.
