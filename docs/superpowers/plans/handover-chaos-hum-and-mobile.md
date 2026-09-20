# Handover — /chaos mobile perf + the wire hum

Written 2026-09-20 at the end of a long session. Everything below is measured
or named as unmeasured. Nothing is merged and nothing is pushed.

## Read this first

Two branches, both off `main` at `14999da`:

- **`feature/chaos-mobile-and-hum`** — the real work. 12 commits. Clean tree.
- **`wip/hum-spin-look`** — ONE experiment commit on top of it (`7b671cf8`).
  **DO NOT MERGE THIS BRANCH.** It exists only so the author can look at the
  hum against a correct spin speed before choosing an amplitude.

The SDD ledger at `.superpowers/sdd/progress.md` is the detailed record and is
more complete than this file. The design doc is
`docs/superpowers/specs/2026-09-20-chaos-wire-hum-design.md` — read Amendment A
at the bottom, it overrides the body in two places. The plan is
`docs/superpowers/plans/2026-09-20-chaos-wire-hum.md`.

## Where it stopped: THE AUTHOR IS MID-DECISION

He looked at the hum at amplitude 0.25 and said it is "technically breathing"
but too subtle to show anyone. He proposed raising the amplitude to 0.45. That
was argued against and he agreed to a different move first:

**He is going to look at `wip/hum-spin-look` and then decide the amplitude.**

Why that branch and not a bigger amplitude, in one paragraph, because the next
session will otherwise just raise the dial: `AUTO_SPIN` is 0.0025 rad per
FRAME, so one rotation takes 2513 frames and its period is whatever the display
makes it. On his 360 Hz panel that is 7.0 s, so an edge crosses the visible
face in ~3.5 s and traverses only ~32% of an 11 s breath before rotating out of
sight. It can never be SEEN to swell, at any amplitude. MEASURED with
`scripts/_a7spinrate.mjs`, same instrument on both branches:

    feature/chaos-mobile-and-hum   271 fps   0.71338 rad/s   period  8.81 s   dwell  4.40 s
    wip/hum-spin-look              295 fps   0.14992 rad/s   period 41.91 s   dwell 20.96 s

1.90 breaths per pass against 0.40. Raising 0.25 -> 0.45 is 1.8x; fixing the
spin is ~4.8x on dwell. Tuning the amplitude against the broken spin would pick
a value that is garish once the spin is fixed.

**If he says it now reads:** leave the amplitude at 0.25, and the spin fix
belongs on the breath-clock branch (see "Sibling defects").

**If he says it still does not read:** the next move is a SHAPE change, not a
bigger multiplier. A proportional gain cannot give a near-black edge an
absolute swing — +/-25% of an alpha of 0.08 is +/-0.02 wherever you put the
parentheses. An ADDITIVE term (say `+0.04 * sin(...)`) gives dormant edges a
threefold relative swing while leaving bright edges alone, which also keeps the
bloom from pumping. That is what the design doc's section 7 alternative meant.

**Also note `packAlphas` CLAMPS at 255.** A bright edge already reaches
`(0.5 + 0.06 + 0.35 + 0.5) * depthFade` = up to 1.41 before the hum. Raising
the amplitude buys nothing upward on those and full swing downward — they dip
rather than swell, which reads as flicker. This is an argument against large
amplitudes specifically, not against the feature.

## What is DONE and verified

**`c2d3529` — coarse pointers render the whole chain at DPR 1.**
Every full-screen pass is paid per device pixel; phones report 2.5-3x and the
cap was 1.5. VERIFIED under touch emulation at devicePixelRatio 2: backing
store 343x360, implied DPR 1.0, where it was 515x540. Not a quality downgrade —
`BLOOM.intensity` and `levels` were both swept at DPR 1 because the mipmap
pyramid is measured in DEVICE pixels. The rule also stopped being written
twice; `compositeDpr` + `coarsePointer` in `artComposite.js` are the one source.

**`7389a23` — the 2-D source-canvas upload deleted.**
`SourceQuad` was marking a full-resolution CanvasTexture `needsUpdate` every
frame for a canvas the WebGL migration had emptied. MEASURED with
`scripts/_a5srcalpha.mjs` in a real Chrome at 272 fps: all 1,889,280 pixels
maxAlpha 0 at idle, mid-cascade and after. **VERIFIED 21/21 ADMISSIBLE**
against `baseline/art-sphere-phase2-bloom-dial-certified`, worst mean 0.419,
certified over 4 same-build sets — `baseline/srcrip-b` carries the null.

**`19590e2` / `9fbd0ac` / `37dfd40` / `f53582b` / `d93177b` / `bf98b6c` /
`1e6c8fb` / `bc78ff1` / `b0713ee` / `3cf0d18` — the hum.**
Tasks 1-4 of the plan, all reviewed clean. Shipped dials: amplitude 0.25,
wavenumber 2.0, periodMs 11000, axisPeriodMs 97000, axisTilt 1.05, and
attenuation on `e.pulse` only.

Gates at handover: **1364 tests pass, lint 0 errors / 146 warnings** (ratchet
153). Tracked tree clean on both branches.

## What is OPEN

1. **The author's amplitude decision.** Above. Blocks everything else.
2. **Task 5 of the plan — the reference re-base.** NOT started, deliberately:
   it certifies whatever the sphere looks like when it runs, and five capture
   sets is expensive to throw away if the amplitude moves. Do it only after he
   confirms. The live reference is
   `baseline/art-sphere-phase2-bloom-dial-certified` at `d69ce75`.
   **Until it is paid, no artCompare number on this branch means anything** —
   the hum moves the frame on purpose.
3. **The final whole-branch review.** Never run. Range `14999da..HEAD`, on the
   most capable model. Point it at the Minor findings list in the ledger. The
   strimer branch's lesson applies directly: BOTH per-task reviews passed a
   real bug that only the whole-branch review caught, and it came from the
   plan's own text.
4. **Option C of the original brainstorm** — travelling telemetry on
   event-adjacent edges. Needs the non-accumulating layer beside the strimer.
   Its own spec and plan.

## Sibling defects, all the same class, none fixed here

`AUTO_SPIN` (0.0025 rad/frame), `breathPhase` (0.015/draw) and `e.pulse` decay
(0.018/frame) are all frame-counted, so all three run ~6x fast on the author's
360 Hz panel. A background session was spawned for `breathPhase`
(`fix/art-breath-clock`, `5ed3344`). **`AUTO_SPIN` and the pulse decay should
go with it**, not onto the hum branch — a second frame-moving change here would
confound the re-base that is already owed.

## Traps this session paid for

**The desktop app's browser pane fires ZERO rAF callbacks** with
`document.hidden` false. MEASURED: 0 frames in 1 s. Every canvas read there
returns the pre-boot state, which looks exactly like a confirmed-dead layer.
Nothing about this sphere can be verified in the pane. Use `scripts/cdp.mjs`.

**A single failed `artNull` is not a regression — get a control at HEAD.**
The first three sets after the source-canvas removal failed on three cells with
"2 distinct hashes". Three sets captured at HEAD certified 21/21, so the
obvious read was "I broke reproducibility". The world hashes disproved it:
two of the three matched all three controls hash for hash, and only one boot
diverged, only from `fired-cascade` onward — the state `artBaseline`'s own
header documents as having a non-constant frame budget.

**A live trace on this sphere CANNOT isolate the hum.** `AUTO_SPIN` is
unconditional, so rotation moves `depthFade`, which moves the same alpha a
trace samples. Reading `scripts/_a6humtrace.mjs` without a control put the hum
at its full designed amplitude when it was at two thirds of it. Worse, the
script's headline number went DOWN (0.3585 -> 0.3211) when the amplitude went
UP, because the hum and the rotation beat and `periodMs` had moved. The script
now says so in its header. **The only comparison that isolates the hum is
rotation-matched: capture with `scripts/_a4hum.mjs` and diff matched FRAME
INDEX across amplitude values.**

**Do not edit tracked source while a capture runs.** `artBaseline` and
`_a4hum` drive the live dev server on :5174; vite HMR will reload the page
mid-capture and silently corrupt the set.

**Every substantive error on this branch was a measurement or a comment being
wrong, not the code.** In order: the confounded live trace; a 1:1 spin/hum beat
that was an artefact of a headless capture at ~284 fps; `clamp01`'s doc comment
claiming it clamped when it returned NaN for NaN; a test comment still
narrating `97/9` after `periodMs` moved; the FIX for that claiming +Infinity
resolved "to the wrong end" when it already returned 1; and a comment of mine
saying depth attenuation could be changed by moving a multiply inside
parentheses, which is a no-op because multiplication commutes. The
implementations went in clean every time. **Weight the prose accordingly, and
re-derive any number before quoting it.**

## Scratch scripts written this session (all committed, all `_`-prefixed)

- `scripts/_a5srcalpha.mjs` — is the 2-D source canvas carrying any ink?
- `scripts/_a4hum.mjs` — the hum sweep. Patches `HUM` in tracked source and
  restores in an outer `finally`. Amplitude by default, `--wavenumber` for the
  other key, `--normal` adds normal mode. `git status` after running it.
- `scripts/_a6humtrace.mjs` — live trace. READ ITS HEADER before quoting it.
- `scripts/_a7spinrate.mjs` — measures the actual rotation period in seconds.

`lookbook/hum/` holds 96+ PNGs from the sweeps; not committed.
