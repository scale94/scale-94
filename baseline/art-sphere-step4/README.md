# /art sphere — step 4 reference (edges complete)

Captured on `fix/art-sphere-index-space` with the whole edge slice on the GPU.
This is the reference **step 5 (nodes)** is measured against.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step4 baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-step4 baseline/<name>
```

**Do not compare against a committed baseline for a parity claim.** The boot
fingerprint is not deterministic (eight relaunches, eight fingerprints), so
per-change parity uses a same-session control capture. This set is a reference
for what step 4 looks like, not a byte gate.

## What is on the GPU now

Everything the edge slice owns, in draw-loop order:

base edge mesh (spectral / fused / ortho / default) · pulse rings ·
analogy filaments · chimera boundary zones · resonance edge (halo + core) ·
prism chords · sacred-polygon outline · star spokes

Two instanced line meshes: `SRC_OVER_LAYER` for the base mesh and the rings,
`ADDITIVE_LAYER` for everything that used `lighter`. One 17-float instance
layout, one decoder, one fragment-shader body compiled twice with a per-material
shadow snippet and composite.

Still 2D, for step 5 onward: nodes, particles, labels, conductor.

## `ctx.shadowBlur` is gone from the draw loop

`grep -n "shadowBlur" src/terminal/views/ArtTab.jsx` returns four hits and none
is a draw call: three comments explaining the gaussian port, and the readout copy
string at `:3247`. `createLinearGradient`, `quadraticCurveTo` and
`ctx.shadowColor` return **zero** hits anywhere in the file.

### Seven `ctx.stroke()` calls remain, and the plan never enumerated two of them

Five are rings and arcs around nodes (chimera state halo, chimera boundary ring,
the double reconstruction ring, the completion halo, the locked-source ring) —
node decorations, step 5's business.

The other two are **straight-line strokes**: the dashed fusion-cursor thread
(`:1698`) and the probe-centroid tether lines (`:1740`). They are flat-coloured
and unshadowed, so they are cheap, but they are line geometry that no step owns.
The pre-flight scan that caught the two orphan CURVE layers (analogy filaments,
chimera zones, folded in as Task 6b) scanned for curves and did not look for
these. Step 6 ends "the 2-D canvas is now empty: delete it" — it will not be.
**Author's call needed**, same shape as the Task 6b decision.

## The line count went UP, and the plan's inference from that is wrong

The plan said 3185 lines "should fall" by ~270, and that if it did not, "the
layers were copied rather than moved". It is now **3495**, +310. The split:

| | at plan (`783f4dd`) | now (`65e62b8`) | Δ |
|---|---|---|---|
| comment | 373 | 631 | **+258** |
| blank | 237 | 244 | +7 |
| **code** | **2575** | **2620** | **+45** |

The layers really did move — the zero gradient/shadow/curve hits above are the
direct evidence, and they are a much better test than a line count. The file grew
because this branch writes its reasoning into comments. Net code is +45, not
−270: instanced float writes are more verbose than `ctx` calls, and the CPU-side
curve tessellation and depth sort stayed. **Retire the line-count criterion.**

## Frame time, headed on the real GPU

`frametime-headed-gpu.json`, 10s per state, sphere 1446×580 in every set so the
three are comparable.

| idle draw cost (ms) | p50 | p95 | p99 | mean |
|---|---|---|---|---|
| step 3 | 2.1 | 11.9 | 15.4 | 3.00 |
| trail target | 2.1 | 12.2 | 15.6 | 2.95 |
| **step 4** | **1.9** | **11.3** | **15.2** | **2.75** |
| *this run's own drift* | *−0.1* | *−0.2* | *−2.4* | |

It fell — mean −8.3% — but **say it plainly: by little more than the
instrument's own drift floor.** The run's drift control (`idleAfter` minus
`idle`, same state, same code, ~40s apart) is −0.1 / −0.2 / −2.4, so p50 and p95
are 2–3× the drift and **p99 is entirely swamped**. The script prints its own
warning that the ordering of idle/drag/immersive in a single run is warm-up
rather than cost.

"Edges are the heaviest remaining 2D work, so this should fall" was directionally
right and badly over-optimistic. Immersive is the clearer win: mean 2.55 → 2.30,
p99 14.2 → 12.8 against the trail set. The plan's Risk 1 (the second render
target costs a full-screen write per frame) shows up as step 3 → trail being
flat, so the target paid for itself and the edges then bought −0.25 ms.

## `fired-cascade` now contains a pulse ring — and no pump count could have done it

Every stored `fired-cascade` reference before this one was missing the pulse-ring
layer, and the recorded fix (`pump(25)` → `~35`) **would not have worked**.

`__pump(n)` (`scripts/determinism.mjs:173`) runs n rAF callbacks in ONE
synchronous loop and never yields. No promise continuation, React scheduler task
or worker message can be delivered between those frames. The cascade's pulse is
set by `applyAttractor` (`useKineticEdges.js:93`), which arrives on the **async**
kernel result — so it cannot fire inside a single pump call at any n. Measured:

| after the click | rings |
|---|---|
| `pump(25)`, `(35)`, `(60)`, `(100)`, `(160)`, `(240)` in one call | **0** every time |
| `sleep(1500)`, `(2500)`, `(4000)` then `pump(35)` in one call | **0** every time |
| 35 × `pump(1)` — a CDP round trip, i.e. a yield, between each | **3** |

Frames alone do not do it and yields alone do not do it; only interleaving does.
The earlier probe that reported "rings arrive at frame 24–26" was measuring
itself: it read state between every `pump(1)` and so supplied the yields.

Two further things the capture now does:

- **It waits for the rings and asserts them.** A fixed offset of 10 frames
  *after arrival*, not a fixed count from the click, because the ring decays over
  its ~48-frame life (radius 5.39 → 2.77 px, mid alpha 0.345 → 0.039). The count
  is printed every run and a miss says so loudly.
- **It retries on a different node.** `applyAttractor` only sets `pulse = 1.0`
  when one end of an edge dominates; on a node that stays mid-activation it takes
  the proportional branch and never clears `PULSE_DRAW_CUTOFF`. Firing
  `replicator` gave 3 rings; `ceei` — the projector grid's first hit — gave none
  in 200 stepped frames. This set fired `replicator` / `replicator` /
  `soma_plus` (2 nodes tried on the projector).

**The cost, stated:** the arrival step count varies run to run (15 / 24 / 26
here), so `fired-cascade` now carries a frame or two of rotation jitter. Measured
against a fresh same-build capture, that row's mean rose to **0.577 / 0.365 /
0.034** where idle reads ~0.27 / 0.07 / 0.13 — roughly double the noise on the
laptop rows, still 21/21 within threshold 4. A noisier row that contains the
layer beats a quiet one that does not.

## Gates at capture

```
npx vitest run          1118 passed / 110 files
npm run lint            0 errors, 144 warnings   (ratchet 153)
npm run build           clean
node scripts/artSmoke.mjs      10/10, console errors 0
node scripts/artPresence.mjs   10/10
node scripts/artCompare.mjs (same-build null)   21/21 within 4
```

`artSmoke` scored **9/10 once in six runs** in this session and 10/10 the other
five. The failing check's name was lost to a `tail` — `check()` does print a
`FAIL` line, but the summary did not repeat it, and these gates are read through
`tail` every time. The summary now lists failed check names, so the next
occurrence arrives with a finding attached instead of a score.

## What the gate could NOT see in this step

Recorded because it is the recurring failure mode of this branch, not an aside.

- **Fused edges and orthogonal bridges appear in NO capture state.** Fused edges
  need `run bone` to populate `boneFusions`; ortho bridges need a right-click.
  No state in this harness does either, so `artCompare` scored Task 6c's
  deliberate pixel change 21/21 while being structurally unable to see it.
  Verified instead with `scripts/_ampShot.mjs` (untracked): forge three bridges,
  run bone, capture at a fixed frame count — signed mean −0.4128 against a
  same-build null of +0.0510.
- **The resonance capture state never selects a node** (it shift-clicks the same
  node twice), so the resonance edge has never been exercised by the harness
  either. A parallel session's fix is not landed.
- **The analogy filaments have never drawn at all** — `fil.nodeA` indexes the
  272-node corpus while the draw loop indexes the 31-node sphere. Deliberately
  not fixed: repairing it makes an invisible layer appear, which is a visual
  change, not a port.
- The prism, filament and chimera layers are covered by `artPresence`, which
  measures the layer rather than the frame, precisely because the comparator
  cannot.
