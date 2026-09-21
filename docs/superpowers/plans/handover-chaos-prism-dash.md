# Handover — CHAOS prism depth, root taper, dash beads

**Written 2026-09-21.** Paste-ready for a fresh session.

---

## 1. Git state

| fact | value |
|---|---|
| branch | `feature/chaos-prism-depth-dash-beads` |
| HEAD | `33bda07e` (was `f3e06bf7` when written) |
| forked from | `main` at `09e86f44` |
| ahead / behind main | **14 / 0** (was 10 when written) |
| `main` vs `origin/main` | **0 / 0** — in sync, nothing unpushed on main |
| tracked tree | **clean** |
| tests | **1484 passing, 121 files** |
| lint | **0 errors / 146 warnings** (`npm run lint`; 146 is main's own count) |
| pushed? | **NO. Nothing on this branch is pushed.** |

```
f3e06bf7 test(chaos): forge orthogonal bridges for the harness, and find the floor
e121ab27 test(chaos): measure what the dash work costs, and refuse to guess
a6830695 feat(chaos): give each ortho dash its own photon envelope
b8ffe777 fix(chaos): the dash cut was the one hard edge left in the shader
40e6319a fix(chaos): taper the prism wide pass so the dot survives its own bundle
79e5adda feat(chaos): lift the prism off the disc depth floor
40c9661f feat(chaos): the prism was the only layer with no depth term
9254604f feat(chaos): per-segment alpha on a tessellated polyline
c6fad227 docs(chaos): plan the prism depth cue, root taper and dash beads
b7dfa2f5 docs(chaos): spec the prism depth cue, root taper and dash beads
```

Spec: `docs/superpowers/specs/2026-09-21-chaos-prism-depth-dash-beads-design.md`
(**read the amendment in §3** — it supersedes the body twice).
Plan: `docs/superpowers/plans/2026-09-21-chaos-prism-depth-dash-beads.md`.

---

## 2. What the three reported defects actually were

The author reported: node discs swallowed by a luminous sheath, a fan that
feathers out in mid-air, and blocky un-antialiased dashed tracks.

**Two of the three diagnoses in the brief were wrong, and the code said so.**

- **Not buffer overflow.** `additive.dropped` read **0** throughout and the
  buffer is sized for the provable worst case (`MAX_ADDITIVE_EDGES = 81 882`).
- **Not unconverged endpoints.** Both ends already terminated on node centres;
  that shipped last session.
- **Not a 10:1 root-to-tail energy split.** Endpoint loads measured
  **60/60/45/45/45/45** — symmetric. This was my hypothesis and the data
  refused it.
- **The actual cause:** the prism was the **only layer on the sphere with no
  depth term at all**. Base edges fade on `avgDepth` (`ArtTab.jsx:1472`), node
  discs on `depthCueAlpha` (`:1897`), filaments on `avgDepth` (`:1303`). The
  prism drew at full envelope alpha wherever its endpoints sat in Z, so a chord
  running to the far side arrived at full brightness onto a disc cued toward
  its floor.
- **The dashed tracks were NOT "zero bloom shoulder".** Ortho bridges carry
  `orthoGlow` = 10 ± 4px with the opaque `isOrtho` shadow. The halo simply was
  not gated by the dash, so a continuous 6–14px haze ran the whole chord with
  hard chips of core punched on top. That is what read as a flat 2D overlay.

---

## 3. Numbers that are verified

| measurement | before | after |
|---|---|---|
| ink per converging endpoint (6 hottest 2×2px cells) | **0.188** | **0.071** (−62%) |
| prism segments carrying an alpha ramp | 0 (impossible) | **835 / 1290 (64.7%)** |
| applied alpha spread across the layer | one value per effect | **0.0078 – 0.2627** |
| `additive.dropped` | 0 | 0 |
| shader link | — | **compiles and renders, 3 builds, `shaderErrors=0`** |

**Author signed off the prism half by eye** on 5173: backplane chords readable
and stable under rotation, no quantisation flicker, node silhouettes sharp
under overlapping bundles. **He ruled the core strokes stay untouched.**

### The bloom measurement, and why it is a bound not a number

| run | same-build floor (ink / hot) | no-bead | hard-cut |
|---|---|---|---|
| 2 | 0.08% / 0.23% | 0.12% / 0.56% | 0.98% / 0.37% |
| 3 | **0.96% / 0.45%** | 0.80% / 0.31% | 0.93% / 0.22% |

In run 3 the **same build shot twice differed by more than either treatment
arm**, and the floor itself swings 0.08% → 0.96% between runs. So
`deterministic: true` + `__reseed` + a fixed `pump` does **not** pin this world
across separate browser launches.

**Verified conclusion: both effects are BELOW the floor — bounded under ~1% of
frame ink and ~0.5% of hot pixels, inside the sphere's own boot-to-boot
variation.** Nothing moves energy density at the composer's `0.28`
luminanceThreshold more than the sphere already moves it unaided.

**The spec's claim that the box filter is "ink-neutral by construction" is NOT
confirmed** — it is unresolvable at this precision and the bound is merely
consistent with it. Do not quote it as supported.

### 3.1 The dash half, ruled by eye — and the GPU debt discharged

**2026-09-21.** The author watched the dashes render and signed them off.
Verbatim gist: beads track the wire's own vector rather than sliding across
screen space; dashed strokes hold under rotation without staircasing; the
`SINGULARITY` cluster fire flares hot cores with a fast penumbra falloff and no
milky blowout; beads and dashes terminate into node cores without clipping or
overhang. His summary: reads as an optoelectronic instrument in an unlit
cleanroom rather than a web animation.

**THIS DISCHARGES THE GPU DEBT.** Both shader commits (`b8ffe777`, `a6830695`)
shipped carrying *"STILL OWED: GPU verification"* — the browser pane was
rAF-suspended, so neither change had ever been exercised on a real GL context.
A shader that fails to link draws nothing and raises no GL error, and this
project has shipped exactly that once. **It has now been seen drawing.** That
is the verification the source-level locks explicitly refused to stand in for.

**Two mechanism claims in his read were checked against the shader, and one is
wrong. Do not let it harden.**

- **Line weight under perspective compression is NOT the new box filter.** That
  is `side` at `SphereEdges.js:1255`, the pre-existing CROSS-line filter on
  `pxD`. The box filter this branch added is at `:1359`, on `sd / dpxDash` —
  the dash boundary ALONG the wire. What it actually bought is the adjacent
  win: as a chord rotates near edge-on and `dpxDash` approaches the period, the
  mask converges to a constant D/P grey instead of beating against the pixel
  grid. Dash RHYTHM stability, not width stability. Anyone tuning line weight
  must go to `:1255`, not here.
- **There is no traveling wave.** `phase0` is 0 and nothing advances it per
  frame; the beads are FIXED positions on the chord. `dashPos = vPhase +
  t * vLen` (`:1213`) anchors the pattern to the projected path, so it
  foreshortens with the wire — which is the "moves along the wire's vector"
  he correctly saw. The apparent TRAVEL is rotation plus `orthoGlow(now)`
  breathing the envelope 6→14px and `orthoHue(now)` cycling a full turn every
  7500ms, both in unison across every bead. **If the sphere is ever held
  static and the travel stops, that is NOT a regression** — there was never a
  marching term. Same reason the green is a moment in a 7.5s hue cycle, not a
  colour.
- Correct and load-bearing: `dOut = max(max(0.0, max(-vAlong, vAlong - vLen)),
  dDash * beadGate)` — the bead distance is a `max()` WITH the cap term, not a
  replacement, so a blurred butt cap still rounds off and the envelope cannot
  project past an endpoint. That is the clean node termination he saw.

---

## 4. Open items

1. ~~**The parity reference has NOT been re-cut.**~~ **CLOSED 2026-09-21 at
   `33bda07e`.** The live reference is now
   `baseline/art-sphere-phase4-prism-dash-certified-a` at `21e98283`, **24
   cells**, five sets, `artNull` 24/24 at floor 0.95, worst 0.9744. Read its
   README before quoting any number out of it.

   **THE INSTRUCTION THAT USED TO BE HERE WAS WRONG AND IS NOT TO BE
   RESTORED.** It said `BASELINE_COMMIT` MUST be set or `artBaseline` stamps
   `gitCommit: null`. That stopped being true at `b69c650f`, which is in
   `main`: `scripts/_git.mjs` derives provenance from `git rev-parse HEAD`, and
   the env var survives only as a fallback for a capture taken outside a
   checkout. Setting a stale one earns a warning and is ignored in favour of
   git. **This set was cut with it UNSET** and all five manifests carry
   `gitCommit 21e98283`, `gitDirty false`, `provenanceSource git`. What
   actually protects attribution now is the dirty-tree guard, and it fires.

   `artNull --write` per set is still required, and was done for all five.

   **AND THE REFERENCE WAS BLIND BEFORE THIS.** See §4.1.
2. ~~**The author has not looked at the dashes yet.**~~ **CLOSED 2026-09-21 —
   he has now ruled the dash half by eye, and it also discharges the GPU
   debt. See §3.1.**
3. ~~**Sharpening the bloom measurement needs a same-PAGE A/B.**~~ **CLOSED
   `87ae6b86`. THE BOUND IS NOW A NUMBER.** Both arms are uniforms
   (`uBeadScale` `24803fc0`, `uDashAA` `35065ead`), `_a10dash.mjs` launches
   Chrome ONCE and never touches a tracked file. At the shipped 11-bridge
   world, 32 triples, sphere-clipped:

   | | ink | hot |
   |---|---|---|
   | the BEAD removes | **0.905% ± 0.385** (RESOLVED) | 0.012% ± 0.262 (bound) |
   | ANTIALIASING OFF adds | −0.303% ± 0.495 (bound) | **0.506% ± 0.434** (marginal) |

   **The bead does NOT move energy at the composer's `0.28`
   luminanceThreshold** — bounded under ~0.32%. That is the reassurance the
   whole exercise was after, now measured rather than shrugged at.

   **The spec's "ink-neutral by construction" claim for the box filter is
   SUPPORTED on ink**, to within 0.69%, where it was previously unresolvable
   at any precision. It is still not PROVEN — a bound consistent with the
   claim is not the claim.

   **The hard-cut HOT result is MARGINAL** (sep/tol 1.17, ~2.3 sigma). Confirm
   before leaning on it.

   Verified inert against the phase 4 reference: 24/24 ADMISSIBLE, and the
   uniform build deviates LESS from the reference (worst mean 0.232) than the
   reference does from itself (0.302).

4. **The disc↔streak threshold discontinuity** (~38× ink jump) carried over
   from the previous branch. Still unruled.
5. **Mobile fps is stale** — measured at `e94fa33e`, before the fix wave.
6. **Every older instrument in `scripts/` points at `http://localhost:5174`,
   which vite never listens on** (`vite.config.js` sets `port: 5173,
   strictPort: true`). `_a10dash.mjs` uses 5173. The others are aimed at a dead
   origin and would need fixing before they mean anything.
7. **`.claude/launch.json`'s `scale94-dev` passes `--port 5174`** and conflicts
   with the same config. Use the `scale94-dev-5173` entry instead.

### 4.2 Three A/B designs, two of them measurably wrong

Kept because the wrong ones are cheap to re-invent.

1. **Re-establish the world per arm** (`__reseed`, `__artHarnessReset`,
   re-forge, fixed pump). **Floor 21.0%** — far worse than the four-launch rig
   it replaced. `__artHarnessReset` is NOT idempotent, so POSITION IN THE CYCLE
   decided the world and the uniform did not. **The tell was in the census, not
   the ink**: `count` swung 103–134 and the arm that always ran third was
   systematically low. Do not restore it.
2. **Span as the floor statistic.** A span only GROWS with more samples, so the
   floor got worse the harder the rig worked. Standard error tightens as
   1/√n, which is what a floor must do. RESOLVED is now a two-sample
   comparison against the `repeat` arm, not a threshold on one number.
3. **Symmetric ABA triples** — shipped, X, shipped, one pump apart. Over three
   frames the drift is locally linear, so `(S1+S2)/2` estimates what `shipped`
   would have measured at X's own frame and the drift is SUBTRACTED rather than
   averaged down. No Latin square needed.

**AND THE LIVENESS GATE WAS UNDERPOWERED BY CONSTRUCTION.** It proved the
switch live by flipping `beadScale` to 0 — but that IS the small effect under
test, so a null proved nothing either way, and it printed **LIVENESS FAILED
against a shader that was fine**. It now probes at `beadScale` 64, which drives
the gap distance past the glow radius and erases the halo between dashes:
**−13.713% ± 0.927, separation 13.928 vs tolerance 1.122.** That is the
distinction the old rig could never make — a dead uniform and a cheap bead both
read as "under the floor", and they are not the same finding.

A frozen-clock hypothesis for that null (virtualised time pinning `orthoGlow`
near 6px, where a documented note says shadow alpha goes to 0) was **checked
and is WRONG**: `SphereEdges.js:1056` is
`shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho)`, so ortho is opaque. That
note belongs to a different layer.

**Percentages are of SPHERE ink now**, not full-frame ink — the clip excludes
constant UI chrome that diluted every number toward zero, so they are NOT
comparable with the pre-uniform bound.

### 4.1 The reference could not see the ortho layer — fixed at `21e98283`

Cutting the reference exposed that **every reference ever cut on this project
was structurally blind to the orthogonal bridge layer.**

All seven prior capture states are hover, left-click or drag.
`orthogonalBridges` starts `[]` and exactly one path appends to it —
`handleContextMenu`, on `contextmenu` and nothing else. So `vIsOrtho` was 0 in
all 21 cells, and `beadGate = vIsOrtho * step(0.001, vDash.x) * (1 - vIsDisc)`
was 0 in every pixel of every reference frame. **The whole bead could have been
deleted and scored 21/21 ADMISSIBLE.** Same shape as the `resonance` state,
which was empty for the whole of steps 2–4.

Fixed by an eighth state that right-clicks four nodes via `page.rightClick` —
the REAL path. **Not `__artSetOrthogonal`**, whose own comment says not to rely
on it surviving a real bridge forged underneath it. Four bridges, not one,
because a single 0.55–1.15px wire out of ~127 could have its bead deleted
under the gate's own noise. Placed LAST because the forge appends to React
state `__artHarnessReset` does not clear. Asserts its population AFTER the
shot, like the GPU probe.

Measured: 4 / 4 / 3 ortho instances per scale, identical node lists in all five
sets. The cell is the MOST reproducible in the set (0.9988 / 0.9982 / 0.9992).

**What the branch did, against phase 3: 21/21 ADMISSIBLE, and the signal is in
`fired-cascade` and nowhere else** — max 58.8–67.6 vs 2.8–9.7 elsewhere.
That is the only prior state that left-clicks, and a left-click calls
`spawnEffect`, which is what puts prism chords on the sphere. The `ok` verdict
is NOT evidence the change is small; `artCompare` thresholds on a mean over
~1500 px a cell. Read the max column.

---

## 5. Traps paid for this session

- **The vacuous harness hook.** `__artSetOrthogonal` marks REAL edges out of
  `edgeStateRef` and keys exactly as the draw loop does. Minting invented id
  pairs would build a map matching no `edgeKey`, so the hook would report
  success and change nothing. `_a10dash` throws if it marks nothing.
- **A measurement whose mechanism was never exercised.** The instrument's first
  run reported **−8.26% ink for the bead** while its own census said **zero
  ortho instances were on screen**. Pure boot noise. It now refuses to report
  when the population is empty and prints a flag histogram instead.
- **Never quote a delta smaller than a same-build repeat.** Run 2 would have
  shipped "the antialiasing adds 0.98% ink". Run 3's repeat arm was 0.96%.
- **A backtick inside a GLSL comment terminates the shader's template
  literal.** `edgeFrag` is a JS template string; a comment reading
  `` `ang` `` broke the whole module. The file now asserts zero backticks
  inside that body.
- **`git checkout -- <file>` restores to the last COMMIT, not to pre-patch
  bytes.** Every A/B and every liveness check here holds original bytes in
  memory and verifies the restore by re-reading.
- **The browser pane suspends rAF when hidden or when the app window is
  behind another window.** `__artEdgeState().count === 0` and `w/h = 1x1` is
  that signature, NOT a render failure. Screenshots time out; the buffer
  instruments still read fine, which is why they are trustworthy when the
  screenshots are not.
- **`npm run lint` is `--ext js,jsx`, so `.mjs` instruments are not linted at
  all.** All 30+ scripts in `scripts/` show the same 4 `no-undef process`
  errors under a direct `eslint` call. Not a regression.

---

## 6. Recovery CLI

```bash
cd /f/scale_9.4
git checkout feature/chaos-prism-depth-dash-beads
git log --oneline main..HEAD
git rev-list --left-right --count main...HEAD
npx vitest run
npm run lint
```

Dev server (the working entry, **not** `scale94-dev`):

```bash
npm run dev
```

The instrument, with the dev server already up on 5173:

```bash
node scripts/_a10dash.mjs
```

---

## 7. Standing constraints

- **Do not merge. Do not push.** Verification approval is not push consent.
- **Never run vitest with `-u` / `--update`.**
- Each task commits only its own named files — **never `git add -A`**.
- **`EDGE_STRIDE` stays 18.**
- **The bloom dial is off limits**: `BLOOM.intensity`, `BLOOM.levels`,
  `BLOOM.luminanceThreshold`, `KNEE.knee`. Bring numbers, do not turn a dial.
- **Never edit tracked source while an `artBaseline`/`artCompare` capture is
  running** — Vite HMRs the edit into the page and the tell is two different
  `gitCommit` stamps across manifests.
