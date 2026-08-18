Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

STATE: HEAD `1193a55`, tracked tree clean, **9 commits ahead of origin** (NOT pushed — do not push or merge without my say-so). The untracked `scripts/_*` and `baseline/*` scratch files are deliberate; leave them.

**Step 5 tasks 1-4 are DONE. Task 5 (the beacon and chimera rings) is next.**

READ FIRST, in this order:
1. `docs/superpowers/plans/2026-08-18-art-sphere-step5-nodes.md` — the plan. Task 5 is the section to execute; the sections "The instance encoding" and "The ordering hazard" above the task list both bear on it.
2. `.superpowers/sdd/step5-preflight.md` — what the node block actually contains (thirteen draw layers where the spec named seven).
3. `.superpowers/sdd/step5-task1-report.md` … `step5-task4-report.md` — in order. Task 4's §5 is the open question below.

## What is already on the GPU

Node **glow halos** and **core discs**, written into `eg` — the SAME source-over stream the edges use — from inside the node loop, so the 2D draw order (edges → halos → cores → rings) is preserved. The rings still on the 2D canvas composite on top, which is where they were.

The shader gained four branches in task 3 (`SphereEdges.js`): **annulus** (inner radius), **arc sweep**, **angular dash**, **radial falloff**. All four are proven by `scripts/_t3disc.mjs` (20/20) — sweeps read 25.4/60.4/95.4% against 25/60/95, a 10/5 dash lights 61% against a solid ring's 100%, dash boundaries radial at 96%. **Task 5 is the first real user of the annulus.** The primitive is proven; do not re-litigate it, but do read `_t3disc` before trusting a ring that looks wrong.

The encoding uses eight floats that are dead in the disc branch — `DISC_OFF` in `SphereEdges.js`. No stride change. `writeDisc()` / `readDisc()` / `discEncodingInvariant()` are the only way to touch it.

## TASK 5, and the three things that will bite

**A stroked circle is not an annulus until you convert it.** Every one of these three layers is `ctx.arc(r) + stroke` with a `lineWidth`. The annulus wants `rOuter = r + lineWidth/2` and `rInner = r - lineWidth/2`. There is no helper for that yet — write one in `artNodes.js` with a test, and clamp `rInner` at 0 for a width wider than the radius. Passing `r` as `rOuter` with `rInner = 0` draws a filled disc that looks plausible at a glance and is wrong.

**The beacon and both ghost rings are `lighter`, so they belong in `ag`, the additive stream — and that stream composites AFTER the whole source-over stream.** In 2D a near node's core disc occludes a far node's beacon ring; after this task it will not. The plan's "ordering hazard" section is explicit that Task 5 must MEASURE that specific case — force two overlapping nodes with a beacon on the far one, capture with and without, quote the signed delta — and record the finding either way. Do not assume it is invisible; do not assume it is fatal.

`ag` is reset near the top of the frame and written by the filaments, chimera fringes, prism and resonance edge during the edge phase. Appending from the node loop puts the beacon after all four, which is the 2D order. `ag` has a `dropped` counter and a real cap; use it.

**`drawBeaconRing` still draws.** It lives in `artAwakening.js` and currently takes `ctx`. The plan turns it into `beaconRingState` returning parameters. It already returns a boolean for the census (task 1) — keep that signal working, whatever shape you give it.

Layers, with their 2D source (`ArtTab.jsx`):
- beacon ring — `artAwakening.js:82`, additive, width `1.5*scale`, ONE node only, awakening phase 1
- chimera **sync** ring — src-over, solid, width `1.5*scale`, `hsla(45,90%,70%)`
- chimera **flicker** ring — src-over, **dashed [3,4]**, width `1.0*scale`, animated hue

All three already have their maths extracted and tested in `artNodes.js`. Do not re-derive them.

## THE OPEN QUESTION — task 4 found it, you inherit it

Two measurements I could not explain, both flagged and both deliberately not chased:

- **`artInk` immersive loses ink.** Normal mode is clean (0.99-1.04 against nulls of 0.98-1.00). Immersive reads **0.69-0.74** and **0.78-0.84** across two independent samples, against nulls spanning 0.91-1.21. The sign is real (no overlap); the magnitude is not pinned (that column's own noise is ±10-20%).
- **The core interior reads ~8% brighter in GL** (raw r0-r4: 2D 104/100/98 vs GL 111/109/106; matched from r6 out). Two runs of each build agree with themselves and disagree with each other, so it is systematic.

Both are consistent with the recorded **trail-accumulation deficit** — immersive runs `m = 0.32` against normal's `0.72`, so a mismatch between the 2D canvas's `destination-out` accumulation and the GL feedback buffer's fade is amplified about threefold there and nearly invisible in normal mode. That is a hypothesis, not a diagnosis.

**The author has decided to proceed with task 5 rather than resolve this first.** So: task 5's ring numbers INHERIT it. Ring alphas are small (0.16, 0.18, 0.15), so a proportional deficit bites them harder than it bit the core. Quote it when you report, do not silently absorb it, and do not re-raise it as a blocker — that call is made.

## The instruments you have

- `scripts/_nodeShot.mjs --tag X` — forces all the blind layers and prints the census. **Run it before and after; the counts must match.** This is the only evidence for any layer no capture state contains.
- `scripts/_t3disc.mjs` — the disc-branch proof (annulus, sweep, dash, falloff). 20/20.
- `scripts/_haloProfile.mjs --tag X [--pump N]`, then `--diff A B` — radial profile, normalised to peak. The normalised column is the gate; the raw column carries composition noise.
- `window.__artNodeState()` — the per-sub-layer census, counted AT each draw call.
- `window.__artSetChimera(map)` — the ONLY way to reach the chimera rings; `__artSetAnalogy` does not touch `clusterSync`.
- `window.__artForceBeacon(on)` — the beacon window is real (elapsed 4.1s-8.0s of a REAL boot) but every harness capture virtualises past it, so no reference image has ever contained that layer.
- `window.__artSetDiscProbe(specs)` — synthetic disc/ring instances through the real buffer, mesh, material and blend.

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen node layers are in no capture state.
- **Two instruments lying in one session is normal here.** Task 1's chimera forcing captured a frame with the layer OFF while reporting it forced ON (a pinned clock put every cluster at the sync pulse's trough). Task 3's disc probe reported four shader bugs that did not exist (absolute-darkness thresholds, defeated by the bloom pass). Task 4's halo profile pinned on a fingerprint that was unstable on the same build. **Every forcing hook must assert the layer actually drew; every threshold must be a contrast, not an absolute; every pin must be null-tested against its own build first.**
- **A harness can be broken BY a change without the change being wrong.** Task 4's node discs made `artPresence`'s `ringsOf()` count 62 of them as pulse rings (129 matched over 79640px instead of 39 over 207px) and the check collapsed on a frame that was fine. The fix was to have the WRITER publish `discStart` rather than the reader guess.
- **`__pump(n)` never yields.** Only frames interleaved with yields reach a promise continuation.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`. Always a same-build null before quoting a delta. Never compare against a committed baseline for a parity claim.
- **Look at the render before theorising.** Task 3's four phantom bugs died the moment I opened the PNG.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/` before editing it.
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the string.
- `.superpowers/sdd` is its OWN git repo with `.gitignore = *`; ledger files need `git add -f` and a separate commit.

## GATES (all green at `1193a55`)

```
npx vitest run          1180 passed / 111 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS, fix it)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     10/10
node scripts/artBaseline.mjs --out baseline/<ctrl|wip>
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
```

The dev server is `.claude/launch.json` → `scale94-dev` on port 5174; it died once mid-session and needed restarting — a `waitFor timed out: boot` is that, not your code. Drive the browser through `scripts/cdp.mjs`, **never the browser pane** (it reports `document.hidden`, which suspends rAF).

`artPresence` flaked once at 8/10 (GENESIS GLOW + FLASH GRID, both timing-sensitive background checks, FLASH GRID has a recorded flake history from step 4 task 6c). If it surfaces, capture the names rather than re-running until green.

Work as a critical senior dev: no yes-machine, push back when the evidence says so, and look at the render before theorising about a visual bug.
