Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

STATE: HEAD `9a79f83`, tracked tree clean, **14 commits ahead of origin** (NOT pushed — do not push or merge without my say-so). The untracked `scripts/_*` and `baseline/*` scratch files are deliberate; leave them.

**Step 5 tasks 1-7 are DONE. Task 8 — verify, measure, record — is the LAST task in step 5.** It is mostly writing, not building: three documents, an audit, and a gate sweep.

READ FIRST, in this order:
1. `docs/superpowers/plans/2026-08-18-art-sphere-step5-nodes.md` — the plan. **Task 8 is the section to execute** and its six checkboxes are the whole scope.
2. `.superpowers/sdd/step5-task7-report.md` — the most recent, and the one whose numbers task 8 records.
3. `baseline/art-sphere-step4/README.md` — **the SHAPE the step-5 record must copy.** Do not invent a format.
4. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 4 — the annotated-block precedent, at line ~284. §Step 5 is at ~341 and is the block to annotate.
5. `.superpowers/sdd/step5-preflight.md` §1 — the thirteen-layer list task 8 must reconcile against.
6. Earlier reports `step5-task1-report.md` … `task6` only if you need the history.

## What is DONE, and must not be re-derived

**Every one of the thirteen node layers is on the GPU.** Halos and cores (task 4), the beacon ring and both chimera rings (task 5), both ghost rings (task 6), and the whole tail — fusion pulse ring, cursor thread, probe tethers, probe glow halo, probe core (task 7). The node block contains **no** `ctx.arc`, `ctx.fill`, `ctx.stroke`, `createRadialGradient` or `setLineDash`; the audit over the block returns comments only. Confirm it, do not re-litigate it.

**The frame-time numbers are measured**, at HEAD, `baseline/t7wip/`: idle p50 4.7ms / p95 14.8ms, drag p50 5.1 / p95 14.7, immersive p50 7.7 / p95 17.3 — indistinguishable from the same-session control (4.9 / 4.7 / 7.7). Compare these against `baseline/art-sphere-step4/README.md`, which reports MEANS not p50s; read its units before quoting a delta.

**The ordering hazard is answered and the fallback pass is NOT needed.** Beacon ceiling 30.5/255, ghost ceiling 108.5/255 at 9.4% of instances, and every task-7 layer is source-over so it adds nothing new. Task 5's and task 6's reports carry the arithmetic.

**The radial falloff is proved** — at 60px through `__artSetDiscProbe`, ramp R2 0.9978 vs gaussian 0.9841, flat inside the knee, zero past rOuter. It was deliberately NOT proved at the size the halo draws, because at 10-30px no fit separates the two laws.

## THE FOUR DELIVERABLES

**1. The gate sweep.** `artBaseline` already captures all three scales — 21 states is 7 × (laptop@1x, laptop@2x, projector@1x) — so one control/WIP pair covers the "all three scales" checkbox. Take a fresh same-session control; **never** `baseline/art-sphere-step4/` for a parity claim, the boot fingerprint is not deterministic.

**2. `baseline/art-sphere-step5/README.md`**, in the step-4 record's shape: what is on the GPU, **what the gates still cannot see**, the frame-time numbers, and every finding.

**3. The spec's §Step 5 annotated block**, matching the §Step 4 precedent. What that section got wrong, and it is a lot:
- It named **seven** layers; the block had **THIRTEEN**, plus five state paths it does not mention (birth lerp, resonance dimming, spectral tint, bleed, the hovered core's opaque bypass).
- "Retires per-node `createRadialGradient`" is true but understates it: `ctx.arc`, `ctx.fill`, `ctx.stroke` and `setLineDash` are all gone from the block too.
- The chimera halo is TWO rings, one angular-dashed. The ghost outline is TWO rings, and the inner one is a **partial arc whose sweep IS the animation** — the 2D comment called it "dashed" and it never was.
- **§Step 4's outstanding author's call is now closed.** That block records "two straight-line strokes that no step owns — the fusion-cursor thread and the probe-centroid tethers". They landed in step 5 task 7. Say so, in both places if the §Step 4 note needs a pointer.

**4. `.superpowers/sdd/progress.md`.** Remember `.superpowers/sdd` is its OWN git repo with `.gitignore = *`; files need `git add -f` and a separate commit.

## WHAT THE GATES STILL CANNOT SEE — carry this into the step-5 record

This is the most important section of the README, and step 4's is the model.

- **Nine of thirteen node layers are in no capture state.** `_nodeShot.mjs`'s coverage table prints it: only `halo`, `core`, `chimeraSync` and `spectral` are live in an idle capture. `artCompare 21/21` across a change to any of the other nine means nothing.
- **All five task-7 layers read "idle= no"** — no capture state forces a fusion or a probe at all.
- **The beacon ring has never been in a reference image**: it draws for one node between elapsed 4.1s and 8.0s of a REAL boot, and every harness capture virtualises past it.
- Carried from step 4 and still true: fused edges and orthogonal bridges appear in no capture state (nothing runs `bone` or forges a bridge); the resonance state shift-clicks the same node twice; the analogy filaments have never drawn in any build (`fil.nodeA` indexes the 272-node corpus, the draw loop indexes the 31-node sphere) and are deliberately unfixed, because making an invisible layer appear is a visual change, not a port.
- **Immersive was never fullscreen** until that was fixed; treat any immersive baseline older than that as invalid.

## THE OPEN QUESTION — three tasks running, and task 8 is where it was flagged to land

`artInk` immersive lost ink in task 4 (0.69-0.74 and 0.78-0.84 against nulls of 0.91-1.21). Tasks 5, 6 and 7 have all read **inside the same-build null** (task 7: normal 0.984-1.009, immersive 0.913-1.061, against a null band of 0.878-1.051). The core interior also reads ~8% brighter in GL.

**The author decided to proceed past this at task 5 and has not reopened it. Quote it; do not silently absorb it; do not re-raise it as a blocker.**

My read, for whatever it is worth to you: **the ink ratio cannot answer this at its resolution.** Three tasks have now read inside the null, and task 7 measured the column's own run-to-run spread at ±4.5% on states with NO code change. If task 8 is to pin it, it needs an instrument with a SPATIAL null — the same region, same frame, layer on vs off — not another whole-frame ratio. Say plainly in the report which it was: pinned, or still open.

## The instruments you have

- `scripts/_nodeShot.mjs --tag X` — forces all thirteen layers, prints the census AND the coverage table §5 of the record needs. **Run it; the coverage table is data, not prose.** Two counts (`chimeraSync`, `chimeraFlicker`) vary run to run on an IDENTICAL build.
- `scripts/_t7tail.mjs` — the tail: buffer decode, the angular dash, the isolated falloff proof, the pooled tether dash. 18/18.
- `scripts/_t6ghost.mjs` (16/16), `scripts/_t5rings.mjs` (14/14), `scripts/_t3disc.mjs` (20/20) — the earlier layers' proofs.
- `scripts/_crop.mjs in.png out.png x y w h [scale]` — so a 2px ring can actually be LOOKED at.
- `window.__artNodeState()`, `window.__artEdgeState()`, and the forcing hooks `__artSetChimera` / `__artSetGhostNodes` / `__artForceFusion` / `__artForceProbe` / `__artForceBirth` / `__artForceBeacon` / `__artForceBleed` / `__artSetDiscProbe`.

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **The forcing hook always moves more than its layer.** Held for four hooks across four consecutive tasks. What works: in-frame contrasts, a spatial null, and re-asserting a non-sticky injection every single pump.
- **A layer can give itself a null.** The probe's is the cleanest on the branch: clear it, step ONE frame (the sphere moves 0.08px at the glow radius), and the difference IS the layer.
- **Pool a dashed layer's samples across instances rather than voting per instance.** Three tethers read -3.3 / 0.2 / 2.6 individually and a majority vote failed a working layer; pooled they read 2.1-4.5 against an anti-phase null.
- **Ask what the gate can actually SEE before quoting it.**
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`. Always a same-build null before quoting a delta.
- **Every threshold must be a contrast, never an absolute level** — the composite blooms.
- **When a metric is too coarse for its signal, fix the metric, not the bar.**
- **Prove a law where there is a lever, not where the layer happens to draw.**
- **Look at the render before theorising.** Two hypotheses died the moment the PNG was opened.
- `__pump(n)` **never yields** — step with `await page.pump(1)` in a loop.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/` before editing it.
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the string.

## GATES (all green at `9a79f83`)

```
npx vitest run          1188 passed / 111 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS, fix it)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     19/19
node scripts/artBaseline.mjs --out baseline/<ctrl|wip>
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
```

**TWO KNOWN FLAKES, measured, not yours.** `artSmoke`'s `3b hover between nodes reports an edge` fails about one run in three — on the WIP build AND on the control with the source stashed. `artPresence`'s `GENESIS GLOW` failed once and passed on the next run at this same HEAD with nothing changed between them; `FLASH GRID` has the same history. If one surfaces, **capture the name** rather than re-running until green.

The dev server is `.claude/launch.json` → `scale94-dev` on port 5174; it has died mid-session before and needed restarting — a `waitFor timed out: boot` is that, not your code. Drive the browser through `scripts/cdp.mjs`, **never the browser pane** (it reports `document.hidden`, which suspends rAF).

Work as a critical senior dev: no yes-machine, push back when the evidence says so, and look at the render before theorising about a visual bug. **Do not push or merge — report to me and I decide.**
