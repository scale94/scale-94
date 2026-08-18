Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

STATE: HEAD `4cff695`, tracked tree clean, 2 commits ahead of origin (NOT pushed — do not push or merge without my say-so). ~40 untracked scratch files in `scripts/_*` and `baseline/` are deliberate; leave them.

**Step 4 (edges) is COMPLETE** — all 7 tasks. Steps 0–3 and the trail sub-project were done earlier. **Step 5 (nodes) is next, and it has no plan document yet.**

READ FIRST, in this order:
1. `.superpowers/sdd/progress.md` — read the "REMAINING WORK" list from the Step 5 entry to the end. That entry carries my standing call on the orphan strokes and why the ordering matters.
2. `baseline/art-sphere-step4/README.md` — the step-4 record: what is on the GPU, what the gates cannot see, the frame-time numbers, and the pulse-ring finding.
3. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 5, plus the annotated §Step 4 block above it (four things the plan got wrong).
4. The step-4 plan `docs/superpowers/plans/2026-08-07-art-sphere-step4-edges.md` as the house format — every step gets a plan doc of this shape.

FIRST TASK: **a pre-flight scan of the node layers, BEFORE writing the step-5 plan.** The equivalent scan is what saved step 4 — it found that the prism "line segments" were actually quadratic Béziers over three sub-layers, and that two curve layers belonged to no step at all. Assume the spec's one-paragraph description of step 5 is incomplete in the same way. The node block is `src/terminal/views/ArtTab.jsx:1487`–`:1665`; enumerate every sub-layer, note every gradient/shadow/arc, and say what the spec does not mention. Then write the plan, then execute it task by task.

THE STANDING CALL ON THE TWO ORPHAN STROKES (mine, already recorded): the 2D canvas is deleted completely in step 6, so no legacy 2D stroke survives. The fusion-cursor thread (`ArtTab.jsx:1698`) and the probe-centroid tethers (`:1740`) get folded into the GL pipeline **at the TAIL of step 5, after the nodes land — never before**. They are drawn after the nodes and terminate on node discs, and the GL composite renders UNDER the 2D canvas, so moving them early puts them behind every disc they touch, and no capture state performs a long-press fusion or a probe, so nothing would catch it.

WHAT THIS BRANCH HAS LEARNED THE HARD WAY — apply all of it:
- **Ask what the gate can actually SEE before quoting it.** Six layers have now scored green while being structurally invisible to the comparator. Fused edges and ortho bridges appear in NO capture state (nothing runs `bone` or forges a bridge); the resonance state shift-clicks the same node twice; the analogy filaments have never drawn in any build. `scripts/_ampShot.mjs` (untracked) is the pattern for a control that can see a layer: force the state, then capture.
- **`__pump(n)` never yields.** It runs n rAF callbacks in one synchronous loop, so nothing driven by a promise continuation, the React scheduler or a worker message is reachable at ANY pump count — only frames interleaved with yields (`await page.pump(1)` in a loop). An instrument that steps and a harness that batches are not measuring the same world.
- **Measure the SHAPE of a defect, not its size** — "flat in alpha where the canvas is linear in alpha" is what identified the missing `* a`; no single-alpha reading could have.
- **Signed mean, not |abs|.** `|abs|` can be *smaller* across a real change than in a same-build null. Always capture a same-build null before quoting a delta.
- Never compare against a committed baseline for a parity claim — the boot fingerprint is not deterministic. Use a same-session control capture.
- Never run vitest with `-u`/`--update`. Never `git add -A`; stage only your own files. Re-read anything in `scripts/` before editing (other sessions touch this repo).
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the string — do not put them in comments there.
- `.superpowers/sdd` is its OWN git repo with `.gitignore = *`; ledger files need `git add -f` and a separate commit.

GATES (all currently green — vitest 1118/110, lint 0 errors/144 warnings ratcheted at 153, build clean, artSmoke 10/10, artPresence 10/10):
```
npx vitest run && npm run lint && npm run build
node scripts/artSmoke.mjs
node scripts/artPresence.mjs
node scripts/artBaseline.mjs --out baseline/<ctrl|wip>
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
```
The dev server is `.claude/launch.json` → `scale94-dev` on port 5174; drive the browser through `scripts/cdp.mjs`, never the browser pane (it reports `document.hidden`, which suspends rAF).

`artSmoke` scored 9/10 once in six runs and its summary now names the failing check — if that flake surfaces, capture the name rather than re-running until it passes.

Work as a critical senior dev: no yes-machine, push back when the evidence says so, and look at the render before theorising about a visual bug.
