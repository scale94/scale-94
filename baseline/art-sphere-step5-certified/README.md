# /art sphere — step 5 reference, CERTIFIED (nodes complete)

Captured on `fix/art-sphere-index-space` at `3551885`. **This is the reference
step 6 (particles) is measured against.** It supersedes
`baseline/art-sphere-step5/` for that purpose.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/<name>
```

`artCompare` will refuse to score any row `ok` until the candidate carries a
certificate of its own. That is deliberate; see `scripts/artNull.mjs`. Certify a
build once and every later comparison against it is free:

```bash
node scripts/artBaseline.mjs --out baseline/wip-a     # and -b, -c
node scripts/artNull.mjs baseline/wip-a baseline/wip-b baseline/wip-c --write baseline/wip-a
```

## Why this set exists and the old one is kept

`baseline/art-sphere-step5/` is an honest picture of its build, and it stays on
disk because four task reports quote numbers measured against it. But it was
captured by a harness that **could not repeat itself**: `immersive-off`
correlated 0.047 between two runs of ONE build, which is what two unrelated
pictures score. Any parity claim measured against it inherits that. Its own
README says so, at the top of §"THE IMMERSIVE ROWS ARE NOT A MEASUREMENT".

This set was captured after all four of those causes were fixed **and a fifth**
— the sphere sharing its random stream with three.js, so the GPU's allocation
timing decided which edges existed (`7f5f2ce` + `3551885`,
`post-step5-task3-report.md`).

That fifth one was caught by the gate **refusing to certify the first attempt at
this very set**, which had `immersive-off` at 0.0321. The second attempt got to
20/21 and the gate refused that too, which is what found the last three draw
sites. This is the third attempt, and it carries its proof in its manifest.

## THE TWO SETS DO NOT MATCH PIXEL-FOR-PIXEL, AND THAT IS NOT A REGRESSION

Read this before comparing them and concluding something broke. Three separate
reasons, none of them a rendering change:

**The breath phase.** `2adc482` added `awakeningRef.current.breathPhase = 0` to
the harness reset. `breathPhase` scales `sphereR`, which scales every projected
node position. The old reference holds one **arbitrary** draw of that phase —
whatever the real-timed boot happened to leave — and this one holds phase 0.

**The random stream.** `7f5f2ce` and `3551885` moved the sphere off the global `Math.random`
onto its own (`src/terminal/art/artRandom.js`), because the draw loop takes
threshold decisions from it and three.js was drawing UUIDs from the same stream.
The seed is unchanged (`ART_SEED` is the shim's `SEED`) and `idle`, `hover` and
`mid-drag` hash **identically** to a pre-change capture — but the states after
an interaction differ, because those are exactly the ones the GL layer had been
perturbing. `resonance` carries 116 edges where it carried 113.

**The step-5 record's own diff.** The only other app change since the old
reference was captured at `39204b4` is 45 lines, all inside
`import.meta.env.DEV`-gated `window.__art*` harness getters. Nothing in the draw
path. (`86fa009` in between touched only `baseline/` and docs.)

So: the same simulation, drawn from a stream nothing else is touching, at a
known breath phase. Not a different build.

## The same-build null

Five independent capture runs of this build, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9818 | 0.9801 | 0.9786 |
| `hover` | 0.9895 | 0.9897 | 0.9863 |
| `mid-drag` | 0.9802 | 0.9835 | 0.9775 |
| `fired-cascade` | 0.9967 | 0.9968 | 0.9840 |
| `resonance` | 0.9959 | 0.9954 | 0.9928 |
| `immersive-on` | 0.9964 | 0.9952 | 0.9938 |
| `immersive-off` | 0.9942 | 0.9908 | 0.9899 |

**Worst cell anywhere: 0.9775.** Five sets, ten pairs a cell. All 21
cells also agree on the *world hash*, so the runs drew the same graph and not
merely a similar picture.

The certificate is stored in `manifest.json` — `repro` per shot and once at the
top level — so it travels with the set and needs no re-capture to read.

**What the null does and does not cover.** It measures process-to-process
variation: five separate browser launches against one dev server, on one
machine, inside about twenty minutes. It does **not** measure reproducibility
across sessions, machines, or GPU drivers, and nothing on this branch does.
Do not read a passing null as "this picture is universal".

## The boot fingerprint is not bistable

`scripts/artBaseline.mjs`'s header describes the boot as reaching "one of two
states" and gates on a fingerprint within a single output directory. Fifteen
independent (run, scale) captures here produced **fifteen distinct
fingerprints**. Fifteen draws from two states cannot all differ; the fingerprint is a fine-grained hash of boot state, not a two-valued race.

Two consequences worth knowing before trusting it:

- It never constrained these five runs at all — each wrote to a fresh directory,
  so each simply recorded its own value. Every cross-run guarantee in this set
  comes from the null, not from the fingerprint.
- Re-running a capture **into an existing directory** asks it to relaunch until
  it matches a value it is very unlikely to hit again. Capture into a new
  directory.

The task-1 report already flagged the bistability claim as "unverified rather
than inherited". It is now measured, and it is false.

## What is still 2D after step 5

Unchanged from `baseline/art-sphere-step5/README.md`, which is the accurate
record — the **spec** is the stale document here:

| site | what |
|---|---|
| `ArtTab.jsx:931` | `setTransform(dpr, …)` |
| `ArtTab.jsx:947`–`:951` | the `destination-out` partial clear |
| `ArtTab.jsx:1979`–`:2021` | the particle block — **step 6** |
| `ArtTab.jsx:2024` | `drawConductor(ctx, …)` → `artAwakening.js`, **28 `ctx.` calls** |

So the spec's "the 2-D canvas is now empty: delete it, its texture and the
composite quad" is **wrong for the third time on this branch**. The conductor is
a whole layer it does not mention, and it survives step 6.

## Everything else about step 5

`baseline/art-sphere-step5/README.md` remains the record for what step 5 *is* —
the thirteen node layers, the blend classes, the census, the immersive
correction. Nothing in it is superseded except the reproducibility of its own
pictures.
