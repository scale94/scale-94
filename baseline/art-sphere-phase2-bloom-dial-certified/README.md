# /art sphere — PHASE 2 reference, CERTIFIED (bloom dial)

Captured on `fix/art-sphere-index-space` at **`d69ce75`**, 2026-09-19. **This is
the reference later work is measured against.** It supersedes
`baseline/art-sphere-phase1-bloom-ink-certified/` at `b8ad97f`.

**It supersedes it; it does not correct it.** Phase 1 is an accurate picture of
the build it was taken from, and it stays on disk as the attribution for
everything before `b506462`. What changed is the build, deliberately and with
the author's sign-off.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-phase2-bloom-dial-certified baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase2-bloom-dial-certified baseline/<name>
```

**`p2ref-b`, `p2ref-c`, `p2ref-d` and `p2ref-e` are part of this set.** They are
named in `repro.dirs`, and `artInk` reads them for the same-build ink floor it
prints beside every ratio. Sweeping one silently costs this reference the floor
it was certified against. All five carry `gitCommit` `d69ce75`.

## WHAT THIS SET PAYS FOR

One commit, and only two executable lines:

    b506462  feat(art): intensity 1.1 and levels 4, chosen on the frames

    -  intensity: 0.6,        +  intensity: 1.1,
    -  levels: 5,             +  levels: 4,

`git diff dc54693..b506462 -- src/` is 79 insertions and 2 deletions in
`artComposite.js`, and every insertion is comment. Those four lines are the
whole build delta this reference exists to describe.

A **composite** change: it alters every cell's pixels and no cell's geometry.

## GEOMETRY DID NOT MOVE — ALL TWENTY-ONE CELLS

`view.world.hash`, `view.world.edges` and `view.sphereR` are **identical in all
21 cells** against phase 1. Not "within tolerance" — equal.

That is the check that this was a fragment-stage change and nothing leaked into
the scene. It also means every pixel difference below is attributable to the
dial (and to the knee work between the two references), with no geometry term
mixed in.

It is worth recording that **`immersive-off`'s world-hash race did not bite
once** in five captures. That cell has historically been the unstable one —
`be882152` against `5d6f91d8` at identical rotation — and here it pinned in all
five sets and matched phase 1 as well. One quiet run of a known intermittent
fault is not a fix, and it should not be read as one.

## THE SAME-BUILD NULL

Five independent capture runs of `d69ce75`, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9836 | **0.9767** | 0.9793 |
| `hover` | 0.9956 | 0.9885 | 0.9900 |
| `mid-drag` | 0.9896 | 0.9821 | 0.9839 |
| `fired-cascade` | 0.9963 | 0.9958 | 0.9965 |
| `resonance` | 0.9977 | 0.9961 | 0.9928 |
| `immersive-on` | 0.9837 | 0.9836 | 0.9814 |
| `immersive-off` | 0.9946 | 0.9913 | 0.9894 |

**21/21 at floor 0.95. Worst cell anywhere: 0.9767**, laptop@2x `idle`.
Detection power at five sets: a 1-in-3 intermittent fault is caught 86% of the
time.

For comparison, and no direction here is a claim about quality: phase 1 worst
0.9791, the previous set 0.9776, `art-sphere-step5-certified` 0.9775. All four
sit in the same band, and the worst cell is a quiet normal state every time.

`immersive-on` reads 0.9814–0.9837, unchanged in character from phase 1's
0.9859–0.9901 despite the dial roughly doubling the mean luminance of its lit
pixels. A hotter core did not cost it reproducibility.

## artCompare AGAINST PHASE 1 — AND WHY ITS VERDICT IS NOT THE FINDING

Mean of the 32×18 signature diff, 0–255 scale:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.088 | 0.043 | 0.080 |
| `hover` | 0.391 | 0.170 | 0.171 |
| `mid-drag` | 0.308 | 0.202 | 0.229 |
| `fired-cascade` | 0.574 | 0.399 | 0.561 |
| `resonance` | 0.429 | 0.287 | 0.228 |
| `immersive-on` | 0.420 | 0.279 | 0.287 |
| `immersive-off` | 0.218 | 0.143 | 0.201 |

**21/21 ADMISSIBLE — inside threshold 4 and reproducible on both sides.**

**The handover predicted this would be non-`ok`, and it predicted the re-base
was blocking because `artCompare` "will read this as a regression and it is not
one". Both halves of that are wrong, measured.** `artCompare` does not flag this
change at all. Max cell differences reach 42.3, but the instrument thresholds on
a *mean* over ~1500 pixels a cell, and the dial's effect — a brighter field
between the strands — averages into nothing at that resolution. This is the
blindness the handover itself documents two paragraphs later, arriving on the
very comparison it was predicting a regression for.

So the re-base was **not** unblocking a false alarm. It was worth doing for the
plain reason: the reference should describe the build, and now it does, with its
own null attached. Nothing downstream was ever going to trip.

## WHAT MOVED: the ink

`artInk`, `disc` column, per state. Read this and not the tool's mode rollup —
that rollup is sum-weighted and `fired-cascade` is heavy enough to drag a whole
row, as the tool says itself.

### Phase 1 → this set — TWO changes, not one

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 1.018 | 1.018 | 1.017 |
| `hover` | 1.153 | 1.115 | 1.151 |
| `mid-drag` | 1.200 | 1.158 | 1.216 |
| `fired-cascade` | 1.178 | 1.127 | 1.231 |
| `resonance` | 1.243 | 1.181 | 1.291 |
| **`immersive-on`** | **0.948** | **0.936** | **0.936** |
| `immersive-off` | 1.182 | 1.146 | 1.215 |

**This table is NOT "what the dial did", and the handover's step 4 was wrong to
call it that.** Phase 1 was captured at `b8ad97f`, which predates the half-float
accumulator, the clamped `srgbToLinear` and the Reinhard knee. Everything above
is **knee work plus dial, cumulative.**

The knee work's own contribution was already on record before this session —
`handover-bloom-knee.md`: normal **+7 to +11%**, exhibit **−4 to −8%**. Normal
ink was therefore already up against phase 1 *before the dial moved at all*.

### Knee-final → this set — THE DIAL, ISOLATED

Against `baseline/_knee-final-a` at `dc54693`, whose only executable delta to
`b506462` is the four lines quoted at the top:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 1.014 | 1.015 | 1.013 |
| `hover` | 1.080 | 1.047 | 1.078 |
| `mid-drag` | 1.071 | 1.044 | 1.082 |
| `fired-cascade` | 1.097 | 1.052 | 1.113 |
| `resonance` | 1.123 | 1.075 | 1.184 |
| **`immersive-on`** | **1.024** *(noise)* | **1.010** *(noise)* | **0.995** *(noise)* |
| `immersive-off` | 1.103 | 1.067 | 1.111 |

**The dial raises normal-mode ink 1.3–18.4%, and leaves exhibit-mode total ink
at the same-build noise floor.** All three `immersive-on` cells grade `noise` in
both `frame` and `disc` — this instrument cannot distinguish them from running
one build twice, and they must not be quoted as a finding.

`immersive-off` behaves like the normal-mode cell it is (+6.7 to +11.1%, in line
with `hover` and `mid-drag`), which is the internal consistency check: a
composite change should treat it as normal mode, and it does.

### THE HANDOVER SAID "IF INK GOES UP, STOP AND INVESTIGATE". IT WENT UP. HERE IS THE INVESTIGATION.

Its prediction was: `levels 4` cuts the glow footprint, so **ink DOWN, and the
drop larger in immersive than in normal**, citing an immersive lit-pixel fall of
622k → 453k on a pinned probe. Normal-mode ink instead went up 1.3–18.4% and
exhibit-mode ink did not move at all.

The capture is sound. The prediction was mis-derived, in three ways:

**1. Ink is not footprint.** `ink = sum(luminance − floor)` over lit pixels;
`lit` is the count. `levels 5 → 4` removes the widest mip, which is a wide, dim
contribution — it takes out many pixels each carrying little. `intensity
0.6 → 1.1` nearly doubles what the surviving levels deposit. The two moved
together *as one decision*, and in normal mode the second dominates the first.
Reasoning about `levels` alone was always going to predict the wrong sign.

**2. The footprint collapse it cited belongs to the KNEE work, not the dial.**
`immersive-on` frame lit pixels, phase 1 → knee-final → this set:

| scale | `b8ad97f` | `dc54693` | `d69ce75` | dial's own share |
|---|---|---|---|---|
| laptop@1x | 203,172 | 112,169 | 107,549 | −4.1% |
| laptop@2x | 748,242 | 461,089 | 455,361 | −1.2% |
| projector@1x | 276,193 | 164,927 | 153,857 | −6.7% |

The 622k → 453k figure is the *cumulative* fall, and ~95% of it is the knee. The
dial's own share is −1 to −7%.

**3. The mechanism it described does hold — for exhibit mode, and it is
visible in the right column.** `immersive-on` mean luminance of lit pixels,
phase 1 → this set: 9.87 → 18.13, 10.63 → 16.84, 10.41 → 18.04. **Fewer lit
pixels, each roughly twice as bright, same total ink.** That is precisely
"footprint down, core hotter" — it simply nets to flat rather than down, and it
is a *redistribution*, which a ratio of sums is the wrong instrument to see.

None of this touches the author's decision. `1.1 / levels 4` was chosen on the
frames, which is the right way to choose it; the arithmetic prediction attached
to it in the handover was just wrong about the sign.

## A DEPENDENCY THIS SET HAS ON UNTRACKED SCRATCH

The dial-isolation table above is measured against `baseline/_knee-final-a`,
which is **untracked**, as are `-b` and `-c` that certify it. They are the only
capture of `dc54693` that exists. If `baseline/_*` is ever swept, the dial can
no longer be isolated from the knee work by re-measurement — only by re-capturing
`dc54693`, which means checking it out.

The numbers are written down here so the finding survives the sweep. Whether the
*set* should also be promoted and tracked is a repo-size call and the author's,
not one to make quietly: it is 21 PNGs, the same weight as this reference.

## TRAPS PAID FOR CAPTURING THIS SET

**`artBaseline` STAMPS `gitCommit` FROM `BASELINE_COMMIT` AND NOTHING ELSE.**
The first capture of this set came back `"gitCommit": null` and was thrown away.
`scripts/artFrameTime.mjs:43` already solved this — it calls `git rev-parse` in
the cwd and records the branch and the dirty flag too, with a comment saying
exactly why the env-var version is not good enough. `artBaseline` never got the
same treatment.

This set was captured the phase-1 way, with `BASELINE_COMMIT` exported, on
purpose: **patching the capture rig in the middle of capturing a reference would
mean the two references were taken by two different scripts**, and the entire
value of this one is that the only thing separating it from phase 1 is the
build. Porting `gitProvenance()` into `artBaseline` is worth doing and belongs
in its own commit, after this. **Done** — `scripts/_git.mjs`, shared with
`artFrameTime`, which also adds the dirty-tree check this set had to make by
hand. Manifests captured from then on carry `gitBranch`, `gitDirty` and
`provenanceSource`; this set predates them and was verified clean with
`git status --porcelain -uno` instead. The manifest is NOT backfilled — a
certified artefact is not edited after the fact.

(Phase 1's README already documents the env-var requirement under *Capture
notes*. The handover dropped it.)

## Capture notes

- Fresh directory per run; the previous contents were removed rather than
  re-entered, so no run inherited another's boot fingerprint. Every cross-run
  guarantee here comes from the null.
- Clean tracked tree, verified with `git status --porcelain -uno` before the
  first capture and after the last. `src/` was not touched at any point.
- A three-scale capture is 3m20s here; five sequential plus certification is
  about twenty minutes.
- Zero console errors, all five sets, all three scales. Renderer probed per run:
  `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti, Direct3D11)`.
- `canvasHash` and `shotHash` remain traps — see phase 1's README. Neither can
  tell you whether a composite change happened.

## WHAT THIS SET IS NOT A PICTURE OF

**The strimer wavefront is unbuilt**, and it is the next item. The HDR headroom
its ">1.0 blinding head" needs now exists.

**The dither for 8-bit banding on black is deliberately unbuilt.** The milky
halo that motivated it was traced to the site-wide CSS film grain, which the
author ruled stays.

**`levels 3` is an open aesthetic thread, not a defect.** It reads as more
definition rather than harshness — tighter halos, blacker gaps, sharper strands
— and it is a direction for both modes at once. Frames:
`lookbook/opt-normal-f26.png`, `opt-imm-f26.png`, panel 3.
