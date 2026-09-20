Continue the /art sphere WebGL work on `fix/art-sphere-index-space` in
F:\scale_9.4.

NOTE ON NAMING: the nav label /Chaos and the route ~/system/art are the SAME
TAB. `ArtTab.jsx` is the sphere. Phase 1 is functionally complete and CERTIFIED.

Your job is item 5 — the author's visual calls. Two of them, and they are
different kinds of task:

  5b  CAP `sphereR` IN IMMERSIVE and re-measure. The author has asked for this
      specifically. The mechanism is measured and settled; do not re-derive it.
  5a  BLOOM. Four frames plus an upper anchor are already rendered and the
      author is looking at them. He will bring his call into the session. Do
      not pick a value for him.

READ FIRST, in this order — the first two are the ones that matter:
1. `baseline/art-sphere-phase1-inset-certified/README.md` — the current
   reference, what moved last time and what did not. Short, and it tells you
   what your change will cost.
2. `git show c302167` — item 5b's measurement, in full, with both scales.
3. `docs/superpowers/plans/handover-post-step7-fixes.md` — items 2-5, the gates
   block, the rig, and "what this branch has learned".
4. `git show dc397b2` — the inset fix, because 5b sits directly on top of it and
   its comment block holds the projection arithmetic you need.
5. `scripts/_a2scale.mjs` — the instrument you will re-run. Read its header
   before quoting its output.

STATE: HEAD `827150b`, tracked tree clean, **branch fully pushed** to
`origin/fix/art-sphere-index-space`. `main` is untouched at `a54ea3e` and LOCAL
MAIN IS BEHIND `origin/main` at `811f290` — fetch before ever merging. Ledger
`.superpowers/sdd` is its own private repo (needs `git add -f`; its .gitignore
is `*`).

DO NOT push without a new explicit command — the author's standing rule is that
verification approval is not push consent. DO NOT merge. DO NOT touch `main`.
DO NOT run vitest with `-u`. NEVER `git add -A`. Backticks inside a template
literal terminate the GLSL string — grep every hunk before running. Use absolute
paths in subshells; `cd` in a Bash call persists. Do not edit source while a
capture is running.

--------------------------------------------------------------------------
ITEM 5b — THE MEASUREMENT, so you do not repeat it
--------------------------------------------------------------------------

`sphereR = SPHERE_K * min(w, h) * breathMod`, `SPHERE_K = 0.42`
(`ArtTab.jsx:198`, `:851`). `project()` returns
`scale = FOCAL_K / (FOCAL_K + rz)`, which is INDEPENDENT of `sphereR`, so the
cage grows and the ink does not.

Measured at `c302167` with `scripts/_a2scale.mjs` — all three numbers out of ONE
buffer, `__artEdgeState().instances` at `EDGE_STRIDE`, float 14, using the
shader's own discriminator (`width <= 0` is a disc of radius `abs(w)*0.5`,
positive is a line width), over the `worldCount` prefix, medians not means:

| | 1520x900 | 1920x1080 |
|---|---|---|
| `sphereR` | 245.5 -> 336.8  **x1.372** | 245.9 -> 415.9  **x1.692** |
| node disc radius | 13.04 -> 12.84  x0.985 | 12.95 -> 12.47  x0.963 |
| edge line width | 1.05 -> 0.93  x0.889 | 1.05 -> 0.99  x0.950 |
| **sparser** | **1.393x** | **1.757x** |

**WHY IT IS WORSE ON A TALLER DISPLAY, which is the whole point.** Normal mode's
canvas height is pinned at 580 whatever the viewport, so normal `sphereR` is
~245.7 EVERYWHERE. Immersive is `0.42 * (viewportH - 96)` — the 96 is the app
header, see `dc397b2`. So the growth factor is `(viewportH - 96) / 580`, and it
scales with the display. That is the record's "worse the taller the display",
now with both ends measured rather than fitted.

--------------------------------------------------------------------------
THE ARITHMETIC YOU NEED BEFORE CHOOSING A CAP — work it, do not re-derive it
--------------------------------------------------------------------------

A node's maximum projected offset is `FOCAL_K / sqrt(FOCAL_K^2 - 1)` =
**1.0707 x sphereR**, not `sphereR`. Rotation-invariant, so it is a bound and
not a sample.

Write the cap as a multiple `m` of the normal-mode radius (245.7):

    sphereR   = 245.7 m
    envelope  = +- 263 m
    fill      = 526 m / containerHeight

**Vertical fill is 89.9% at EVERY geometry today, by construction.** Whenever
the container is wider than it is tall — all three capture geometries are —
`min(w, h)` is `h`, so the envelope is `1.0707 * 0.42 * h` = `0.4497 h` and the
fill is `2 * 0.4497` = 0.899 regardless of the display. Capping is what trades
that away, and the table below is that trade.

| cap `m` | sphereR | fill @1920x1080 (container 984) | fill @1520x900 (804) | sparser |
|---|---|---|---|---|
| 1.0 | 245.7 | 53% | 65% | **1.03x** |
| 1.2 | 294.8 | 64% | 79% | 1.24x |
| 1.3 | 319.4 | 70% | 85% | 1.34x |
| 1.4 | 344.0 | 75% | 92% | 1.44x |
| **today** | 415.9 / 336.8 | **90%** | **90%** | 1.76x / 1.39x |

**TWO THINGS TO PUT IN FRONT OF THE AUTHOR BEFORE YOU COMMIT A NUMBER.**

**1. A cap only binds where the display is tall, and that is a feature.** At
1520x900 today's `m` is already 1.372, so a cap at 1.4 does NOTHING there and
only affects the projector. A cap at 1.3 pulls the projector from 1.76x sparser
to 1.34x — the laptop's current feel — and costs 90% -> 70% of vertical fill.
That is the trade, and it is the decision.

**2. CAPPING CANNOT REACH DENSITY PARITY, and the table says why.** The ink
multiplier is ~0.97, so the sparseness factor is about `1.03 m`. Parity needs
`m ~ 1.0`, i.e. immersive stops growing the sphere at all, which defeats
immersive. **If he wants full-screen fill AND normal density, the INK has to
scale, not the cage** — node disc radius and edge line width multiplied by
`sphereR / 245.7`. That is a bigger change and a different look (thicker lines,
larger discs), and it is a second option, not a refinement of the first. Cost it
and let him choose; do not quietly do the other one.

Whatever you change, it is an aesthetic call. Item 3 is on record for what
happens when a threshold gets tuned until it agrees with its own number.

--------------------------------------------------------------------------
WHAT IT COSTS, measured last time so you can predict it
--------------------------------------------------------------------------

Changing `sphereR` in immersive moves the world hash of the `immersive-on` cells
and nothing else. Last time (`dc397b2` -> `827150b`) exactly THREE of 21 cells
moved, all `immersive-on`, with edge counts UNCHANGED (126/126/103) — the same
graph at different coordinates. Both `immersive-off` rows were bit-identical,
because `immersive-off` returns to the normal-mode geometry.

Expect the same shape. Confirm it rather than assuming it: run
`node scripts/_z2burst.mjs baseline/_z5cap-a.json 1520 900 2` and read it with
`_z2read.mjs` — if `OFF` is not `94356b54` and the gap 5->6 is not 124, you have
moved something you did not mean to and item 1's fix is the first suspect.

`artPresence`'s `TRAIL ACCUMULATION` asserts the immersive BOX (width >= 98% of
the viewport, height exactly `viewportH - headerH`, top exactly `headerH`).
Capping `sphereR` does not change the box, so that gate should be untouched. If
it fires, you changed the container and not the radius.

--------------------------------------------------------------------------
GATES, and then the reference
--------------------------------------------------------------------------

Dev server: `.claude/launch.json` gives `scale94-dev` on port 5174. Drive Chrome
through `scripts/cdp.mjs`, NEVER the browser pane (it reports `document.hidden`,
which suspends rAF).

    npx vitest run                 expect 1279 / 115 files
    npm run lint                   expect 0 errors, 145 warnings (ratchet 153)
    npm run build                  expect clean
    node scripts/artSmoke.mjs      expect 12/12
    node scripts/_s7probe.mjs      expect 11/11
    node scripts/artPresence.mjs   expect 19/19

Then re-measure 5b with `node scripts/_a2scale.mjs 1520 900 1` and
`... 1920 1080 1`, and re-check the clearance with
`node scripts/_a1clear.mjs 1920 1080 1 8` — a smaller sphere can only increase
it, but say the number rather than assuming.

THEN THE REFERENCE. Five sets, `BASELINE_COMMIT` set, fresh directories, and
`artNull` at floor 0.95 expecting **21/21**:

    BASELINE_COMMIT=$(git rev-parse HEAD) node scripts/artBaseline.mjs --out baseline/NAME-a
    ... and -b -c -d -e
    node scripts/artNull.mjs baseline/NAME-a ... baseline/NAME-e --write baseline/NAME-a

~3m20s a set, ~18 minutes for five plus certification. Run it in the background
and wait on the ARTIFACT (`manifest.json`), never a log line. Fresh output
directory per run. Never capture a reference with `--reseed-per-callback`.
Write `baseline/NAME/README.md` on the model of
`baseline/art-sphere-phase1-inset-certified/README.md`, and say explicitly which
cells moved and which did not — it is the single most useful fact the next
session inherits.

The siblings of the CURRENT reference (`p1iref-b..e`) are named in its
`repro.dirs` and `artInk` reads them for the same-build ink floor. Do not sweep
them.

--------------------------------------------------------------------------
ITEM 5a — BLOOM. The frames exist; the author is looking at them.
--------------------------------------------------------------------------

`scripts/_a3bloom.mjs` rendered `lookbook/bloom-bright-{1p1,0p85,0p6,0p4,8}.png`
at 1920x1080, immersive, with the world PINNED identically across all five
(1920x984, 103 edges, ry 2.775, sphereR 408.32) so the only variable is
`BLOOM.intensity`. 1.1 is the current value; 8.0 is an upper anchor so the range
is visible.

`BLOOM` lives in `src/terminal/art/artComposite.js` and is unit-tested for its
CONTRACT, not its values. The sweep PATCHES TRACKED SOURCE and restores in a
`finally` — the `_nullPatch` trap — so **check `git status` after running it**.

Three corrections that instrument needed, all of which apply to any sweep you
build next:

- **A sweep is not a sweep unless the world is pinned.** Unpinned, each value
  needs its own boot and the boot-to-boot difference was the SAME SIZE as the
  effect: whole-frame luminance read 1.000 / 0.889 / 0.782 / **0.785**,
  non-monotonic in the only variable.
- **A pinned state must CONTAIN the thing being judged.** The first pin chose
  `immersive-on` after a harness reset, which is dim — 23k lit pixels against
  62k in a live boot. A sweep of a state where the effect is absent is not
  evidence that the effect is small. Hence `--bright`.
- **Whole-frame luminance cannot resolve bloom at all.** Same-build frames
  correlate 0.98-0.99, not 1.0, so run-to-run composite variation is the same
  size as a 1.1 -> 0.4 change. The instrument was verified to work by shooting
  8.0 (luma x1.045, lit px x1.124). **The pictures are the deliverable.** If a
  number is wanted, measure the halo profile around one bright node, not the
  frame.

If he names a value: change it, run the gates, and note that bloom is a
COMPOSITE change, so it moves every cell's pixels rather than only the immersive
ones — that is a different re-capture from 5b's, and doing both before one
capture is the cheap order.

--------------------------------------------------------------------------
STILL OPEN, and two questions the author has not answered
--------------------------------------------------------------------------

Unanswered, asked twice, not blocking: **does the disc/particle freeze still
reproduce?** It never reproduced here across six geometries on the real NVIDIA
driver and three fixes have landed since. `scripts/artFreezeProbe.js` is with
him. If he says it is gone, record that explicitly rather than letting it lapse.
And **does the inset's 9-14 px top clearance look right in his real browser?**
Measured headless at 1920x1080 and 1520x900 only.

Item 1 is CLOSED (`57f0d44`) with one observation deliberately left open: a
single run showed callback 5 entering 30 draws late, never reproduced in 28
recorded runs — ruled out at 8% per run with ~90% confidence, at 3% with 57%.
`baseline/_z1init-NOTES.md` carries the arithmetic. **Not closed and not
established.** Do not record it as either.

Item 2 (particle ink excess — real at the mode rollup, noise in 20 of 42
per-cell rows), item 3 (the spoke's 1.098, which needs a worktree at `cbf22f1`
and can NEVER be gated by `artPresence`), item 4 (12 of ~20 commits unreviewed,
and the debt grows with every commit this session adds — review once, before any
merge conversation) are all in `handover-post-step7-fixes.md`.

Ledger: `.superpowers/sdd/item1-fix-and-phase1-reference-report.md` is the model.
The immersive inset and item 5b's re-measurement have NO ledger entry yet —
their evidence lives in `dc397b2`, `c302167` and `827150b`'s commit messages.
Do not let that reach four again.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.
