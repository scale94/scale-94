Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

STATE: HEAD `20c367b`, tracked tree clean, **12 commits ahead of origin** (NOT pushed — do not push or merge without my say-so). The untracked `scripts/_*` and `baseline/*` scratch files are deliberate; leave them.

**Step 5 tasks 1-6 are DONE. Task 7 (the tail: the two orphan strokes and the probe) is next, then task 8 (verify, measure, record).**

READ FIRST, in this order:
1. `docs/superpowers/plans/2026-08-18-art-sphere-step5-nodes.md` — the plan. Task 7 is the section to execute; the sections "The instance encoding" and "The ordering hazard" above the task list both still apply.
2. `.superpowers/sdd/step5-preflight.md` — what the node block actually contains (thirteen draw layers where the spec named seven).
3. `.superpowers/sdd/step5-task5-report.md` and `step5-task6-report.md` — the two most recent, and the ones whose findings task 7 inherits. Earlier reports (`step5-task1-report.md` … `task4`) only if you need the history.

## What is already on the GPU

Everything in the node block except the tail: **halos and cores** (task 4, into `eg`, the source-over stream), the **beacon ring** (task 5, into `ag`, additive), both **chimera rings** (task 5, `eg`, one of them angular-dashed `[3,4]`), and both **ghost rings** (task 6, `ag`, the inner one a partial arc).

The shader's four disc branches — annulus, arc sweep, angular dash, radial falloff — are all in use and all proven (`scripts/_t3disc.mjs`, 20/20). `writeDisc()` / `readDisc()` / `discEncodingInvariant()` are the only way to touch the encoding; `DISC_OFF` in `SphereEdges.js` documents it. `strokeAnnulus(radius, lineWidth)` in `artNodes.js` is the only conversion from a stroked circle to an annulus — a canvas stroke is centred ON the path, so `r ± w/2`.

## TASK 7, and the four things that will bite

**The dashes are px of arc length at the band's MID radius.** The flicker ring already does this: `packFlags(period, duty, 0)` where period is `on + off` and duty is `on`. So the fusion pulse ring's `[5,4]` packs as period 9, duty 5. The presence harness's `dashLit()` mirrors the shader's `mod(rMid × theta, period) <= duty` exactly if you need to measure it.

**The probe halo is a RADIAL FALLOFF, not a gaussian.** `aC1.x = probeR * 0.3` (`probeGlowInnerRadius`). That is a `createRadialGradient`, flat inside the inner stop then linear to zero — NOT the `shadowBlur` shoulder, which is a real gaussian of sigma = blur/2. They match at exactly one radius and are wrong everywhere else. Task 4 already fought this for the node halos.

**The two orphan strokes and the probe tethers are ordinary segments** — straight lines with a dash. No shader change, no disc encoding. Dashes `[3,6]` for the cursor thread and `[3,5]` for the tethers, per-anchor alpha `weight/wmax` on the tethers.

**These land HERE, after the nodes, and not earlier.** Both orphan strokes terminate on node discs, and the GL composite renders under the 2D canvas. Moving them earlier would put them behind every disc they touch. That is the author's standing call.

`ArtTab.jsx:1665`–`:1770` comes out, **leaving the two `nextLabels` pushes** — those are DOM and they stay.

## What the last two tasks measured, that task 7 should not redo

- **The additive stream composites after the ENTIRE source-over stream.** Measured, not inferred: an opaque source-over probe disc laid across an additive stroke reads contrast 101.70 where the 2D order gives exactly 0, against a null of −0.21 for the same disc on empty canvas. The fusion pulse ring is source-over, so this does not touch it; if anything in task 7 turns out to be additive, the exposure arithmetic is `nearCoreAlpha × strokeAlpha × strokeLuminance` and both prior reports show how to count the overlap frequency out of the buffer geometry.
- **The depth-sorted single additive pass held in reserve is NOT needed.** Beacon ceiling 30.5/255, ghost ceiling 108.5/255 at 9.4% of instances. The ghosts are the closest call and they did not force it.
- **The bloom does NOT fill a hole or stretch an arc** at these radii. I assumed both and measured the opposite each time. `_t6ghost.mjs` part 2b is the rig: draw the same primitive isolated through the probe and compare.

## THE OPEN QUESTION — still open, still inherited

`artInk` immersive lost ink in task 4 (0.69-0.74 and 0.78-0.84 against nulls of 0.91-1.21). Tasks 5 and 6 both read **inside the same-build null** (immersive 0.873-1.043 against nulls of 0.878-1.051), which neither reproduces it nor resolves it — the column's own spread is wide enough to hide the effect. The core interior also reads ~8% brighter in GL.

**The author decided to proceed past this at task 5 and has not reopened it.** Quote it when you report; do not silently absorb it; do not re-raise it as a blocker. Task 8's full gate sweep is the place it may finally be pinned, if anywhere.

## The instruments you have

- `scripts/_nodeShot.mjs --tag X` — forces all the blind layers and prints the census. **Run before and after; the counts must match.** Two counts (`chimeraSync`, `chimeraFlicker`) vary run to run on an IDENTICAL build — proven with a same-build null — so check those against a null before believing a difference.
- `scripts/_t3disc.mjs` — the disc-branch proof (annulus, sweep, dash, falloff). 20/20.
- `scripts/_t5rings.mjs` — the beacon and chimera rings: buffer decode, stream order, exposure arithmetic, and the ring-vs-disc power test. 14/14.
- `scripts/_t6ghost.mjs` — the ghost arc: sweep in the buffer, candidate-match in the pixels, isolated-probe control, ordering arithmetic. 16/16.
- `scripts/_crop.mjs in.png out.png x y w h [scale]` — crop and magnify, so a 2px ring can actually be LOOKED at.
- `window.__artNodeState()` — the per-sub-layer census, counted AT each draw call.
- `window.__artForceFusion({ cursor })` and `window.__artForceProbe("mercury")` — **the two hooks task 7 needs.** Both resolve node ids themselves.
- `window.__artSetDiscProbe(specs)` — synthetic disc/ring instances through the real buffer, mesh, material and blend. Note it is appended BEFORE the node loop, so node discs draw on top of it.

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen node layers are in no capture state. 21/21 across a change to them means nothing.
- **The forcing hook always moves more than its layer.** `__artForceBeacon` drives awakening phase 1, which PUMPS the node's energy; `__artSetChimera` spawns boundary zones and their additive fringes; `__artSetGhostNodes` writes targets the sim then walks off; `__artSetAnalogy` accepts filaments and reports them, and `_updateAnalogies` wipes the list before the next frame draws. **Never a cross-frame delta on a forced layer.** What works: in-frame contrasts, a spatial null (the same band around the other nodes), and re-asserting a non-sticky injection every single pump.
- **Compare the render against what THAT FRAME'S BUFFER wrote**, never against what you injected.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`. Always a same-build null before quoting a delta. Never a committed baseline for a parity claim.
- **Every threshold must be a contrast, never an absolute level** — the composite blooms, and an absolute floor is what made three earlier harnesses report bugs that were not there.
- **When a metric is too coarse for its signal, fix the metric, not the bar.** The flicker ring's check went from a 20%-headroom flake to a 38x margin by sampling only the angles the shader lights.
- **Look at the render before theorising.** Two of my hypotheses this session died the moment I opened the PNG.
- `__pump(n)` **never yields** — only frames interleaved with yields reach a promise continuation. Step with `await page.pump(1)` in a loop.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/` before editing it.
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the string.
- `.superpowers/sdd` is its OWN git repo with `.gitignore = *`; ledger files need `git add -f` and a separate commit.

## GATES (all green at `20c367b`)

```
npx vitest run          1188 passed / 111 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS, fix it)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     15/15
node scripts/artBaseline.mjs --out baseline/<ctrl|wip>
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
```

**A KNOWN FLAKE, measured, not yours:** `artSmoke`'s `3b hover between nodes reports an edge` fails about one run in three — on the WIP build AND on the control with the source stashed. Do not bisect it onto a commit. `artPresence`'s `FLASH GRID` and `GENESIS GLOW` are also timing-sensitive and have a recorded flake history; if one surfaces, capture the name rather than re-running until green.

The dev server is `.claude/launch.json` → `scale94-dev` on port 5174; it has died mid-session before and needed restarting — a `waitFor timed out: boot` is that, not your code. Drive the browser through `scripts/cdp.mjs`, **never the browser pane** (it reports `document.hidden`, which suspends rAF).

Work as a critical senior dev: no yes-machine, push back when the evidence says so, and look at the render before theorising about a visual bug.
