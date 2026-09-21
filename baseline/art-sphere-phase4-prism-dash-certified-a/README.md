# /art sphere — PHASE 4 reference, CERTIFIED (prism depth, dash beads, ortho state)

Captured on `feature/chaos-prism-depth-dash-beads` at **`21e98283`**,
2026-09-21. **This is the reference later work is measured against.** It
supersedes `baseline/art-sphere-phase3-hum-merged-a/` at `eb83fda3`.

**It supersedes it; it does not correct it.** Phase 3 is an accurate picture of
the build it was taken from. What changed is the build — and, for the first
time in this sequence, **the shape of the capture itself**.

```bash
node scripts/artBaseline.mjs --out baseline/<name> --url http://localhost:5173/
node scripts/artCompare.mjs baseline/art-sphere-phase4-prism-dash-certified-a baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-phase4-prism-dash-certified-a baseline/<name>
```

**`-b`, `-c`, `-d` and `-e` are part of this set.** They are named in
`repro.dirs` and carry the same `gitCommit`. Sweeping one silently costs this
reference the floor it was certified against. Only `-a` is tracked, which is
the practice phases 1 and 2 established.

## THIS SET IS 24 CELLS, NOT 21 — AND THAT IS THE POINT

Every reference before this one was **structurally blind to the orthogonal
bridge layer**, and would have certified a deletion of it as ADMISSIBLE.

All seven prior states are hover, left-click or drag. `orthogonalBridges`
starts `[]`, and exactly one path appends to it: `ArtTab`'s
`handleContextMenu`, which fires on `contextmenu` and nothing else. So no
capture ever held a single ortho instance. `vIsOrtho` was 0 in all 21 cells,
and therefore

    beadGate = vIsOrtho * step(0.001, vDash.x) * (1.0 - vIsDisc)

was 0 in **every pixel of every reference frame ever cut**. The entire bead
could have been deleted and scored 21/21.

That is the same failure the `resonance` state carried for the whole of steps
2–4, where deleting the layer scored identically to shipping it. It was found
here only because this branch's own work lives in that layer.

`ortho-bridge` is the eighth state. It right-clicks four nodes through
`page.rightClick` — the **real** path, not `__artSetOrthogonal`, whose own
comment says not to rely on it surviving a real bridge forged underneath it
(the `orthogonalBridges` useEffect rebuilds `orthogonalEdgesRef` wholesale).
No new driver code: `page.rightClick` already existed in `cdp.mjs`.

**Four bridges, not one.** One right-click forges exactly one ortho edge, and
one 0.55–1.15px wire out of ~127 is thin enough that deleting its bead could
sit under the gate's own noise — technically populated, practically vacuous.

The state is **last**, deliberately: the forge appends to React state that
`__artHarnessReset` does not clear, so it cannot hand a clean world to anything
after it. Nothing follows it.

It **asserts its population after taking the picture**, like the GPU probe,
because a `page.eval` costs a yield and a yield is when real browser tasks
land. Throwing still makes the set unusable — the manifest is never written —
so a vacuous cell cannot reach disk and be quoted.

`orthoNodes` and `orthoInstances` are recorded per scale, for the reason
`resonanceNodes` already is: a run that forged a different set of bridges is
not comparable with one that did not.

**The forge is deterministic per scale, measured across all five sets:**

| scale | nodes right-clicked | ortho instances |
|---|---|---|
| laptop@1x | soma_kernel + soma_plus + bouligand_36 + feigenbaum | 4 |
| laptop@2x | soma_kernel + soma_plus + bouligand_36 + feigenbaum | 4 |
| projector@1x | chrono_actuary + bouligand_36 + fusion_plasma + dh_ec | **3** |

The projector forges 3 from 4 right-clicks — one candidate's orthogonal
partner was already connected, and `findOrthogonalNode` excludes existing
edges. It did so in **all five sets**, so it is a property of that scale's
graph and not a flake.

## THE SAME-BUILD NULL

Five independent capture runs of `21e98283`, ten pairs per cell,
`scripts/artNull.mjs`. Worst off-diagonal luminance correlation at full
resolution:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.9797 | **0.9744** | 0.9753 |
| `hover` | 0.9898 | 0.9900 | 0.9865 |
| `mid-drag` | 0.9852 | 0.9832 | 0.9772 |
| `fired-cascade` | 0.9863 | 0.9954 | 0.9943 |
| `resonance` | 0.9969 | 0.9959 | 0.9930 |
| `immersive-on` | 0.9897 | 0.9869 | 0.9848 |
| `immersive-off` | 0.9920 | 0.9901 | 0.9883 |
| **`ortho-bridge`** | **0.9988** | **0.9982** | **0.9992** |

**24/24 at floor 0.95. Worst cell anywhere: 0.9744**, laptop@2x `idle`.
Detection power at five sets: a 1-in-3 intermittent fault is caught 86% of the
time.

For comparison, and no direction here is a claim about quality: phase 3 worst
0.9764, phase 2 worst 0.9767, phase 1 worst 0.9791. All four sit in the same
band, and the worst cell is a quiet normal state every time.

**The new `ortho-bridge` cell is the most reproducible in the set** — the three
highest numbers in the table. A state that re-establishes the world, acts once
on a fresh grid sweep and has nothing after it is the easiest kind to repeat.

## WHAT THIS SET PAYS FOR — AND WHERE THE SIGNAL IS

`artCompare` against phase 3, mean / **max** of the 32×18 signature diff:

| state | laptop@1x | laptop@2x | projector@1x |
|---|---|---|---|
| `idle` | 0.285 / 9.2 | 0.159 / 9.7 | 0.110 / 7.1 |
| `hover` | 0.317 / 4.1 | 0.120 / 3.8 | 0.127 / 2.8 |
| `mid-drag` | 0.289 / 3.8 | 0.135 / 4.9 | 0.134 / 5.2 |
| **`fired-cascade`** | **0.890 / 67.6** | **0.779 / 65.1** | **1.086 / 58.8** |
| `resonance` | 0.227 / 1.9 | 0.022 / 1.9 | 0.071 / 1.6 |
| `immersive-on` | 0.389 / 8.7 | 0.160 / 4.2 | 0.172 / 3.8 |
| `immersive-off` | 0.254 / 2.9 | 0.132 / 3.1 | 0.078 / 2.5 |

**21/21 ADMISSIBLE.** `ortho-bridge` has no counterpart in phase 3 and is not
compared; that asymmetry is the whole reason this set exists.

**The signal is in `fired-cascade` and nowhere else.** Max 58.8–67.6 against
2.8–9.7 everywhere else, roughly an order of magnitude. `fired-cascade` is the
only prior state that left-clicks a node, and a left-click calls `spawnEffect`,
which is what puts prism chords on the sphere. So the prism depth cue and the
root taper moved the one cell that contains a prism and left the other six
alone — which is what a layer-local change should look like, stated as a
measurement rather than as an intention.

The measured root-ink cut behind that column was **0.188 → 0.071 per converging
endpoint (−62%)**, and 835 of 1290 prism segments now carry an alpha ramp that
was structurally impossible before.

**`artCompare`'s own verdict is `ok`, and that is not evidence the change is
small.** The instrument thresholds on a *mean* over ~1500 pixels a cell. Phase
2's README documents the same blindness arriving on the same instrument. Read
the max column, and read `artInk`.

## WHAT THIS SET IS NOT A PICTURE OF

**The beads are in it, but nothing has yet measured them through it.** This
reference makes a bead regression *detectable*; it does not itself report the
bead's cost. That measurement is still a bound, not a number — under ~1% of
frame ink and ~0.5% of hot pixels — because the four-launch A/B could not beat
its own boot-to-boot floor. See `_a10dash.mjs` and the handover. Converting
`beadGate` to a uniform for a same-**page** A/B is the open item that fixes it.

**The disc/streak threshold discontinuity** (~38x ink jump) is carried in this
build, unruled, from the previous branch.

**Mobile fps is stale** — measured at `e94fa33e`, before the fix wave.

## A CORRECTION THIS SET CARRIES

Phase 2's README and the branch handover both say `BASELINE_COMMIT` must be
exported or the capture stamps `gitCommit: null`. **That has not been true
since `b69c650f`** ("derive a capture's commit from git, not from an env var"),
which is in `main`. `scripts/_git.mjs` now derives provenance from
`git rev-parse HEAD` and the env var survives only as a fallback for a capture
taken outside a checkout; exporting a stale one produces a warning and is
ignored in favour of git.

**This set was captured with `BASELINE_COMMIT` unset**, and all five manifests
carry `gitCommit 21e98283`, `gitBranch feature/chaos-prism-depth-dash-beads`,
`gitDirty false`, `provenanceSource git`.

The dirty-tree guard is the live protection now, and it was exercised: it fired
correctly on both smoke runs of the new state, which were taken before the
harness change was committed.

## Capture notes

- Fresh directory per run; no run inherited another's boot fingerprint.
- Clean tracked tree for all five. The harness change was committed
  (`21e98283`) **before** the first set, so no capture ran against a dirty tree
  — and no tracked file was touched between the first set and the last, because
  the dev server is Vite with HMR and would have delivered the edit into the
  page mid-capture.
- The dev server must be on **5173**. `artBaseline`'s own `--url` default is
  `http://localhost:5174/`, which Vite never listens on (`vite.config.js` sets
  `port: 5173, strictPort: true`). Pass `--url` explicitly.
- A three-scale, 24-cell capture is about 7 minutes here; five sequential plus
  certification is about 40.
- Zero console errors, all five sets, all three scales. Renderer probed per
  run: `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti, Direct3D11)`.
- `canvasHash` and `shotHash` remain traps — see phase 1's README. Neither can
  tell you whether a composite change happened.
