Continue the /art sphere WebGL work on `fix/art-sphere-index-space` in
F:\scale_9.4.

NOTE ON NAMING: the nav label /Chaos and the route ~/system/art are the SAME
TAB. `ArtTab.jsx` is the sphere. Phase 1 is functionally complete and CERTIFIED.

**ITEM 5a (BLOOM) IS CLOSED.** The author made both calls on rendered frames and
they are committed. Your job is **item 5b, and then the ONE capture that pays for
both of them.** Do not re-open 5a; do not re-derive 5b's mechanism. Both are
measured and the numbers are below.

READ FIRST, in this order:
1. `git show 7899b7a` and `git show d1936f2` — item 5a's two decisions, each with
   its measurement table. `d1936f2`'s message also states the ORDER dependency
   that must not be inherited wrong.
2. `baseline/art-sphere-phase1-inset-certified/README.md` — the current
   reference. **It is now stale in a way its own text does not say**: it was
   captured at `c302167`, before the bloom moved. See "THE CAPTURE" below.
3. `docs/superpowers/plans/handover-item5-cap-spherer.md` — the previous
   handover. Its item 5b arithmetic is still correct EXCEPT for the 580, which
   is corrected below. Its "what it costs" section is still the right model.
4. `git show c302167` — the scaling-law measurement, in full, with both scales.
5. `docs/superpowers/plans/handover-post-step7-fixes.md` — items 2, 3 and 4, the
   rig, and "what this branch has learned".
6. `scripts/_a2scale.mjs` — the instrument you will re-run to prove 5b worked.
   Read its header before quoting its output.

STATE, verified at the time of writing:

    HEAD                 7899b7a      tracked tree CLEAN
    origin/fix/...       827150b      SIX commits unpushed:
                                      cdec94f 5b0f8a8 2279ca5 d1936f2 061e68d 7899b7a
    main (local)         a54ea3e      untouched
    origin/main          811f290      LOCAL MAIN IS BEHIND — fetch before ever merging

208 untracked `baseline/*`, `scripts/_*` and `lookbook/*.png` are deliberate.
The ledger `.superpowers/sdd` is its own private repo (needs `git add -f`; its
.gitignore is `*`).

DO NOT push without a new explicit command — the author's standing rule is that
verification approval is not push consent. DO NOT merge. DO NOT touch `main`.
DO NOT run vitest with `-u`. NEVER `git add -A`.

--------------------------------------------------------------------------
THE AUTHOR'S DECISION, ALREADY MADE — DO NOT RE-PRESENT THE MENU
--------------------------------------------------------------------------

He was given the cap table and chose **NOT to cap**:

> "We are going with full-screen fill plus proportional ink scaling: keep
> today's screen fill (do not cap sphereR down to a smaller cage), and scale the
> ink geometry (line width and node disc radius proportional to sphereR / 245.7)
> to preserve physical visual density in immersive mode."

So `SPHERE_K` and the immersive container stay exactly as they are, vertical fill
stays at 90%, and the INK grows to match the cage. The cap branch is closed. If
you find yourself building a `SPHERE_CAP` constant you have taken the other
option by accident.

--------------------------------------------------------------------------
THE MECHANISM, MEASURED — DO NOT RE-DERIVE IT
--------------------------------------------------------------------------

`sphereR = SPHERE_K * min(w, h) * breathMod`, `SPHERE_K = 0.42`
(`ArtTab.jsx:198`, `:851`). `project()` returns `scale = FOCAL_K / (FOCAL_K + rz)`,
which is INDEPENDENT of `sphereR`, so the cage grows and the ink does not.

Measured at `c302167` with `scripts/_a2scale.mjs`, all three numbers out of ONE
buffer, medians not means:

| | 1520x900 | 1920x1080 |
|---|---|---|
| `sphereR` | 245.5 -> 336.8  **x1.372** | 245.9 -> 415.9  **x1.692** |
| node disc radius | 13.04 -> 12.84  x0.985 | 12.95 -> 12.47  x0.963 |
| edge line width | 1.05 -> 0.93  x0.889 | 1.05 -> 0.99  x0.950 |
| **sparser** | **1.393x** | **1.757x** |

The target after 5b is that the bottom row reads **~1.00 at both scales** — the
ink tracking the cage — with `sphereR` unchanged from the numbers above.

--------------------------------------------------------------------------
THE FORMULA, AND THE 580 THE PREVIOUS HANDOVER GETS WRONG
--------------------------------------------------------------------------

The previous handover says normal-mode canvas height is "pinned at 580 whatever
the viewport". **That is only true above about 892 px wide.** `ArtTab.jsx:814`:

    H = Math.floor(Math.min(Math.max(W * 0.65, 360), 580))

So a literal 580 in the ink scale is a latent bug on narrow windows — it would
scale the ink against a normal-mode sphere that the window never actually draws.
Write it as a ratio of the two geometries instead:

    normalH   = min(max(W * 0.65, 360), 580)
    inkScale  = min(w, h) / min(W, normalH)

`breathMod` and `SPHERE_K` cancel out of that ratio, which is the point: it is
the same number as `sphereR_immersive / sphereR_normal` without depending on
either constant. It is 1.0 in normal mode by construction, so normal-mode pixels
CANNOT move — and that is a claim the capture will check, not an argument.

Whether it should be clamped to `>= 1`, and whether it should be applied at
full strength or at some exponent, is an AESTHETIC call and therefore the
author's. Measure first, show him frames, let him choose. Item 3 is on record
for what happens when a number gets tuned until it agrees with itself.

--------------------------------------------------------------------------
THE CALL SITES — this recon is DONE, do not repeat it
--------------------------------------------------------------------------

**Node disc radius has exactly ONE source.** `nodeRadius(energy, scale)`
(`artNodes.js:60`) is `(NODE_RADIUS_BASE + energy * NODE_RADIUS_ENERGY_K) * scale`
and it is called from exactly one place in the whole tree:
`ArtTab.jsx:1702`, as `nodeRadius(energy, p.scale)`. That is the clean insertion
point and there is no second one to miss.

**Edge line width is a FAMILY of constants** in `artEdges.js`, several of which
are already multiplied by the mean projection scale at their call sites:
`RESONANCE_HALO_W` (131), `RESONANCE_CORE_W` (138), `PRISM_GLOW_W` (225),
`PRISM_CORE_W` (228), `PRISM_POLY_W` (233), `PRISM_SPOKE_W` (238),
`FILAMENT_GLOW_W` (333), `FILAMENT_CORE_W` (337), `CHIMERA_W` (393).

**`FILAMENT_CORE_W` is commented "a CONSTANT — see the note above".** Read that
note before touching it. At least one of these widths is deliberately unscaled
and blanket-multiplying the family will silently undo a decision someone already
made on purpose.

**THE TRAP THAT WILL COST YOU A CAPTURE IF YOU MISS IT.** There are 16
`writeDisc` sites in `ArtTab.jsx`, and they are NOT all world ink.
`eg.worldCount = eg.count` is set at **`ArtTab.jsx:2165`** — everything written
after that line is the conductor's SCREEN-SPACE furniture (the track at 2189, the
fill bar at 2194, the discs at 2173 and 2206). That furniture is in screen pixels
and must NOT scale with the sphere, or the HUD grows when the artwork does.

That boundary is the same prefix `_a2scale` reads and the same one the world hash
is computed over. **When you touch this buffer, ask what READS it, not just what
draws it** — that lesson is already in the branch's record and this is the exact
shape of it.

--------------------------------------------------------------------------
WHAT IT COSTS, and THE CAPTURE THAT PAYS FOR 5a AND 5b TOGETHER
--------------------------------------------------------------------------

**This is the operationally important part of this document.**

Item 5b moves the world hash of the `immersive-on` cells and nothing else —
THREE of 21, exactly as `dc397b2` and `827150b` did, with edge counts unchanged.
`immersive-off` returns to the normal-mode geometry, and `inkScale` is 1.0 there
by construction, so both `immersive-off` rows and all normal states should be
bit-identical. Confirm rather than assume:

    node scripts/_z2burst.mjs baseline/_z5ink-a.json 1520 900 2
    node scripts/_z2read.mjs  baseline/_z5ink-a.json

If `OFF` is not `94356b54` or the gap 5->6 is not 124, you have moved something
you did not mean to and item 1's fix is the first suspect.

**BUT ITEM 5a ALREADY MOVED ALL TWENTY-ONE.** Bloom is a COMPOSITE change —
`d1936f2` and `7899b7a` alter every cell's pixels, not just the immersive ones.
The reference was deliberately NOT re-captured for it, on the author's explicit
instruction, so that 5a and 5b are paid for in ONE capture instead of two.

**CONSEQUENCE, and it is absolute until the new reference exists: no parity or
ink number on this branch may be quoted against
`baseline/art-sphere-phase1-inset-certified`.** That set is at `c302167`, three
bloom commits behind HEAD. `artCompare` and `artInk` will still run against it
and will still print numbers. Those numbers are meaningless right now. Anyone who
quotes one has compared two different builds.

THE CAPTURE, once 5b is implemented and gated. Five sets, `BASELINE_COMMIT` set,
fresh directories, `artNull` at floor 0.95 expecting **21/21**:

    BASELINE_COMMIT=$(git rev-parse HEAD) node scripts/artBaseline.mjs --out baseline/NAME-a
    ... and -b -c -d -e
    node scripts/artNull.mjs baseline/NAME-a ... baseline/NAME-e --write baseline/NAME-a

~3m20s a set, ~18 minutes for five plus certification. Run it in the background
and wait on the ARTIFACT (`manifest.json`), never a log line. Fresh output
directory per run. Never capture a reference with `--reseed-per-callback`.

Write `baseline/NAME/README.md` on the model of
`baseline/art-sphere-phase1-inset-certified/README.md`, and **say explicitly that
this set re-bases ALL 21 cells and why** — three from 5b's geometry and twenty-one
from 5a's composite — because the next session will otherwise assume the usual
three-cell story and mis-read every unchanged-looking row.

The siblings of the CURRENT reference (`p1iref-b..e`) are named in its
`repro.dirs` and `artInk` reads them for the same-build ink floor. Do not sweep
them until the new reference is certified and its own siblings exist.

--------------------------------------------------------------------------
GATES
--------------------------------------------------------------------------

    npx vitest run                 expect 1280 / 115 files
    npm run lint                   expect 0 errors, 145 warnings (ratchet 153)
    npm run build                  expect clean
    node scripts/artSmoke.mjs      expect 12/12
    node scripts/_s7probe.mjs      expect 11/11
    node scripts/artPresence.mjs   expect 19/19

(1280 not 1279: `5b0f8a8` added the `BLOOM.levels` contract test.)

Then re-measure 5b with `node scripts/_a2scale.mjs 1520 900 1` and
`... 1920 1080 1`. **That is the instrument that says whether 5b worked**: the
DIVERGENCE line should fall from 1.393x / 1.757x toward 1.00 while `sphereR`
stays at 336.8 / 415.9. If `sphereR` moved you capped something by accident.

Also re-check clearance with `node scripts/_a1clear.mjs 1920 1080 1 8`. Thicker
ink extends the envelope slightly, so unlike a cap this can only REDUCE the
clearance — the last measurement was 9-14 px at the top. Say the number.

**A WARNING ABOUT artPresence THAT THIS SESSION MEASURED.** It passed 19/19
through a 45% bloom intensity cut, with the star spoke reading 26.58 against a
19.5 bar — UP from the 25.03-25.08 on record. Every one of its ink statistics is
a CONTRAST against a displaced control, and a composite change lifts the layer
and its control together. **artPresence cannot see a composite change of that
size in either direction.** Do not read its pass as evidence that 5a or 5b left
the picture alone; only the capture can say that. This also matters the moment
item 3 is reopened, since that dispute assumes this gate can judge a ~10%
sub-layer brightness.

--------------------------------------------------------------------------
THE RIG
--------------------------------------------------------------------------

Dev server: `.claude/launch.json` gives `scale94-dev` on port 5174. Drive Chrome
through `scripts/cdp.mjs`, NEVER the browser pane (it reports `document.hidden`,
which suspends rAF).

`scripts/_a3bloom.mjs` is the pinned-sweep rig and it generalises: it PATCHES
TRACKED SOURCE and restores in a `finally`, so **check `git status` after running
it**. `--fired` stages resonance + a multi-node cascade + the bright pass;
`--levels` sweeps the pyramid instead of the intensity. Filenames carry BOTH
keys. `scripts/_a4halo.mjs` reads the halo out of a pinned set;
`scripts/_a5strip.mjs` puts one crop from each frame side by side, which is the
only way anyone actually SEES a sweep. All three are KEEP.

If you build a sweep for the ink scale, it is the same three rules: the world
must be PINNED, the pinned state must CONTAIN the thing being judged, and
whole-frame luminance cannot resolve it — measure a profile, not a mean.

--------------------------------------------------------------------------
WHAT THIS SESSION LEARNED, beyond the branch's standing list
--------------------------------------------------------------------------

- **Heredocs through the Bash tool strip one backslash level even with a quoted
  delimiter.** `'(\\n\\s*...)'` written that way became `(newline)s*` and matched
  nothing, silently. Anything containing regex escapes goes through the **Write
  tool**, and commit messages through `git commit -F` on a Written file. Same
  family as the backtick-terminates-the-GLSL-string rule.
- **A measurement without a control can refute a true hypothesis.** The first
  levels reading (lv5 against lv8) said the far field moved only 6% and looked
  like a refutation. Against a bloom-OFF frame the same data said the pyramid's
  entire far-field contribution went from +7.4% to +0.6% — it removes 92% of it.
  The control was one extra boot and it reversed the conclusion.
- **artBaseline's fired-cascade recipe cannot be reused in a sweep.** It pumps
  UNTIL the rings arrive and retries up to three nodes; a variable frame count is
  a variable ROTATION. Fix the budget, drop the retry, and REPORT the arrival
  frame instead of waiting on it. `findNodes` was already safe — constant 90
  frames whatever it finds.
- **A two-axis sweep needs both axes in the filename.** The first intensity run
  after `levels` moved would have overwritten the eight-level frame of the same
  name — which was half of the same-build null pair that made the whole levels
  argument quotable.
- **The app cannot draw five simultaneous thick wires.** Resonance caps at two
  nodes (`[2/2]`), and firing nodes adds particles and activation, not wires. The
  author's "5 nodes wired and fired" was never reproduced here and it is STILL
  UNRESOLVED what he was doing. Every bloom number on this branch describes ONE
  wire of ~1427 core px, and the coarse-mip effect scales with lit AREA — so the
  mechanism is measured and its magnitude at his real lit area is NOT.

--------------------------------------------------------------------------
STILL OPEN
--------------------------------------------------------------------------

**On 5a, none blocking:** `luminanceThreshold` (0.28, which decides WHAT blooms)
was never swept. A DITHER in the composite for the 8-bit banding on black is on
his radar and not started — note the bloom pyramid is ALREADY half-float
(@react-three/postprocessing defaults `frameBufferType` to HalfFloatType), so the
8-bit surfaces are the trail accumulator and the final canvas, and a dither
belongs in the screen pass and nowhere else.

**The immersive TRAIL GAIN is his next pass and it is not 5b.** 869 of the 1429
clipped pixels in the fired state survive with the bloom entirely off — that is
ink saturating in the RGBA8 accumulator before the bloom runs. `RIFT_ALPHA` is
0.72 normal against 0.32 immersive (`artBackground.js:42`), a 3.125x standing
gain against 1.389x, so dim ink settles up to 2.25x higher in the exhibit mode
against a bloom threshold that does not move with it. **Note the interaction with
5b: thicker ink is more energy into that same accumulator**, so 5b may make this
worse and he knows it — that is why he sequenced them this way.

**Unanswered, asked three times, not blocking:** does the disc/particle freeze
still reproduce? It never reproduced here. `scripts/artFreezeProbe.js` is with
him. If he says it is gone, record that explicitly rather than letting it lapse.
And does the inset's 9-14 px top clearance look right in his real browser?

Item 1 is CLOSED (`57f0d44`) with one observation deliberately left open — a
single run showed callback 5 entering 30 draws late, never reproduced in 28
recorded runs. `baseline/_z1init-NOTES.md` carries the arithmetic. **Not closed
and not established.** Do not record it as either.

Items 2 (particle ink excess), 3 (the spoke's 1.098, which needs a worktree at
`cbf22f1` and can NEVER be gated by `artPresence` — see the warning above, which
strengthens that point) and 4 (the unreviewed commits, now SIX more from this
session: `5b0f8a8` `2279ca5` `d1936f2` `061e68d` `7899b7a` plus `cdec94f`) are all
in `handover-post-step7-fixes.md`. **Item 4's debt grows with every session and
the review must happen before any merge conversation.**

Ledger: `.superpowers/sdd/item1-fix-and-phase1-reference-report.md` is the model.
The immersive inset, item 5b's re-measurement and now the whole of item 5a have
NO ledger entry — their evidence lives in `dc397b2`, `c302167`, `827150b`,
`d1936f2` and `7899b7a`'s commit messages. That is now FIVE. Do not let it reach
six.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.
