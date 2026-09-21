# Handover — CHAOS prism depth, root taper, dash beads

**Written 2026-09-21.** Paste-ready for a fresh session.

---

## 1. Git state

| fact | value |
|---|---|
| branch | `feature/chaos-prism-depth-dash-beads` |
| HEAD | `f3e06bf7` |
| forked from | `main` at `09e86f44` |
| ahead / behind main | **10 / 0** |
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

---

## 4. Open items

1. **The parity reference has NOT been re-cut.** Still
   `baseline/art-sphere-phase3-hum-merged-a` at `eb83fda3`, i.e. the previous
   sphere. Every `artCompare` number against the current build is meaningless
   until re-cut. **`BASELINE_COMMIT` MUST be set** or `artBaseline` stamps
   `gitCommit: null` and the reference is unattributable. And run
   `node scripts/artNull.mjs --write <set>` once per set, or every pair comes
   back `0/21 ADMISSIBLE, 21/21 no-null`.
2. **The author has not looked at the dashes yet.** He signed off the prism
   half only. Tasks 4 and 5 (antialiasing, beads) are unruled by eye.
3. **Sharpening the bloom measurement needs a same-PAGE A/B**, not four browser
   launches. `beadGate` is compiled into the shader rather than a uniform, so
   this needs a uniform or a define to become measurable below ~1%.
4. **The disc↔streak threshold discontinuity** (~38× ink jump) carried over
   from the previous branch. Still unruled.
5. **Mobile fps is stale** — measured at `e94fa33e`, before the fix wave.
6. **Every older instrument in `scripts/` points at `http://localhost:5174`,
   which vite never listens on** (`vite.config.js` sets `port: 5173,
   strictPort: true`). `_a10dash.mjs` uses 5173. The others are aimed at a dead
   origin and would need fixing before they mean anything.
7. **`.claude/launch.json`'s `scale94-dev` passes `--port 5174`** and conflicts
   with the same config. Use the `scale94-dev-5173` entry instead.

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
