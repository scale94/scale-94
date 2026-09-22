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

   **BOTH uniforms verified inert against the phase 4 reference**, each with
   three certified sets and a gated compare — 24/24 ADMISSIBLE both times:

   | | worst mean | worst max |
   |---|---|---|
   | reference vs ITSELF (`-a` v `-b`) | 0.302 | 11.7 |
   | `uBeadScale` alone (`24803fc0`) | 0.232 | 11.7 |
   | both uniforms (`4a6d7bd4`) | **0.292** | 11.7 |

   The shipped path deviates LESS than the same build does from itself, in
   13 of 24 cells. `x * 1.0` and `mix(x, y, 1.0)` being bit-exact in IEEE was
   the ARGUMENT; this is the evidence. Captures: `baseline/_beaduniform-*` and
   `baseline/_dashaa-*`, untracked scratch — numbers recorded here so the
   finding survives a sweep.

4. **ITEM 3 — reconcile the disc↔streak ink discontinuity, and re-measure
   mobile fps.** Recorded 2026-09-21 as one item at the author's request; it
   was previously carried as two (the old items 4 and 5). Both halves are
   measurement debt on the particle layer and both are still unruled.

   - **The ~38× disc↔streak ink discontinuity.** Carried over from the lens /
     filaments branch, where it was recorded as a consequence left open rather
     than a defect closed — see
     `docs/superpowers/specs/2026-09-20-chaos-lens-convergence-filaments-design.md`.
     The disc's half-width is `3.5 * sz` and the segment's is `sz / 2`, about
     **seven times thinner**, and the disc carries a soft radial glow the
     segment has no shoulder for at all. So a particle whose per-frame
     displacement hovers near `STREAK_MIN_PX` (0.75px, `artParticleDraw.js`)
     alternates between a soft blob and a near-invisible hairline — a ~38×
     step where the eye expects a ramp. The two remedies already named are a
     **hysteresis band** or a **streak width that preserves the glow
     footprint**; both change how particles look, so neither is the
     implementer's to pick. **This needs an author ruling before any code.**
   - **Mobile fps is stale.** The figure on record was measured at `e94fa33e`,
     BEFORE the fix wave. The frame-counted cadence family, the sphere's own
     rotation and the breath clock all changed how much work a frame does, so
     the recorded number describes a build that no longer exists. **Do not
     quote it.** Re-measure with `scripts/mobileFps.mjs`, which defaults to
     the dead 5174 origin (item 5 below) — pass
     `--url http://localhost:5173/`. Its own §31 note also records that it
     cannot baseline against `main` without a second server, so an unbaselined
     HEAD number is what it will return.

5. **ON HOLD — the dynamic strand MERGE / PINCH artifact.** Deferred to
   backlog 2026-09-22; the author is spending the remaining budget on visual
   and shader work. Two fixes attempted, neither resolved it. **See §4.7,
   including the correction to which file to refactor.**
6. **Every older instrument in `scripts/` points at `http://localhost:5174`,
   which vite never listens on** (`vite.config.js` sets `port: 5173,
   strictPort: true`). `_a10dash.mjs`, `_a13prism.mjs` and `_a14cusp.mjs` use
   5173 — the last two take the port as `argv[5]` (`W H DPR PORT`).
   `mobileFps.mjs` and the rest default to the dead origin; `mobileFps.mjs` at
   least accepts `--url`.
7. **`.claude/launch.json`'s `scale94-dev` passes `--port 5174`** and conflicts
   with the same config. Use the `scale94-dev-5173` entry instead.

### 4.7 Dynamic strand MERGE / PINCH artifact — ON HOLD, author's entry

**Status: ON HOLD.** Deferred to backlog 2026-09-22 by the author, to spend the
remaining budget on visual and shader work instead. **Do not reopen this
without being asked.**

**SYMPTOM.** When dynamic click pulses fire (e.g. `KURAMOTO` / the bundle), the
multi-strand ribbon does not maintain an organic volume or map cleanly between
true node targets. The strand geometry collapses inward, visibly pinching and
merging multiple wire paths into a narrow bottleneck / single-pixel pinch in 3D
space near the centre before fanning out again.

**ATTEMPTED FIXES — NEITHER RESOLVED THE ARTIFACT.**

1. **Static edge buffer audit** (`_a13prism.mjs`, `_a15mesh.mjs`). Evaluated the
   standard edge network and the additive pool. Confirmed the geometry of both
   is clean and the symptom is exclusive to the dynamic click ribbons.
2. **Depth cueing / luminance attenuation** (`artStrimer.js`,
   `_a16kuramoto.mjs`). Identified the missing depth term on `HEAD_GAIN`,
   `RAIL_GAIN` and `PING_GAIN`; added `strimerDepthCue` / `strimerCue` with
   `STRIMER_DEPTH_ALPHA_FLOOR = 0.25`. **Outcome: 1502 tests green, back-plane
   luminance measurably down (soma91 -25.7%), and the geometric pinch is
   COMPLETELY UNCHANGED.** The issue is positional / spline-tangent routing,
   not lighting or alpha gain. §4.6's fix is still correct on its own terms and
   stays; it simply does not address this.

**AUTHOR'S HYPOTHESIS.** The Bezier / Catmull-Rom control points or quadratic
curvature vectors share a hardcoded mid-vector, or pull toward the sphere
origin, instead of offsetting tangentially from the source/destination arc
normal. **Do not touch colour, gain or tests further until the spline
generation itself is refactored so strands stop bundling through one centre
point.**

> **ONE CORRECTION BEFORE ANYONE STARTS — IT WILL SAVE A SESSION.**
>
> The hypothesis is **right about the mechanism and wrong about the file.**
> There is NO spline in the strimer. `grep -niE
> "bezier|catmull|tessellate|quadSegments|arcControl|prismControl|ctrl"` over
> `artStrimer.js` and `SphereStrimer.jsx` returns **nothing in either file**.
> The strimer writes straight capsules: the rail is `pa.sx,pa.sy -> pb.sx,pb.sy`
> and the head is a capsule along that same vector (`ArtTab.jsx`, the
> `PHASE_TRAVEL` block). A refactor aimed at those two files has nothing to
> refactor.
>
> **The centre-pull the hypothesis describes is real, and it is `prismControl`**
> — `artEdges.js:311`:
>
> ```js
> const midX = (ax + bx) / 2, midY = (ay + by) / 2;
> out[0] = midX + (cx - midX) * PRISM_CP_PULL + offset * PRISM_CP_OFF_X;
> out[1] = midY + (cy - midY) * PRISM_CP_PULL + offset * PRISM_CP_OFF_Y;
> ```
>
> `cx, cy` is the PROJECTED SPHERE CENTRE and `PRISM_CP_PULL` is 0.55, so every
> chord in every pair bows 55% of the way toward one shared point. With a
> degree-4 click that is ~10 node pairs x 7 spectral lines all bowing toward the
> same centre — which is exactly the described bottleneck. `arcControl`
> (analogy filaments, chimera fringes) does the same thing toward `w/2, h/2`.
> **So the layer to refactor is the PRISM bundle, not the strimer** — the
> multi-strand coloured ribbon in the screenshots is the prism, and the strimer
> is the white-hot packet that runs along the edges underneath it.
>
> This is the FOURTH time on this branch that a reported symptom has named the
> wrong layer, and the third where the correction was cheap to make in advance.
> Not acted on — recorded so the next session starts in the right file.

### 4.6 THE STRIMER HAD NO DEPTH TERM — FOUND AND FIXED, NEEDS HIS EYE

**This is the actual defect behind all three reports.** §4.3, §4.4 and §4.5
each audited a buffer and each found its geometry clean — because none of them
read the buffer the symptom lives in.

**THE STRIMER IS A THIRD POOL.** `strimerRef`, `STRIMER_STRIDE` 10, its own
mesh in `SphereStrimer.jsx`. It is neither the edge stream nor the additive
stream, so `_a13prism.mjs` and `_a15mesh.mjs` — both of which I described as
exhaustive — never touched it. "I audited both streams" was true and still
missed the layer, because there are three.

**WHAT WAS WRONG.** `HEAD_GAIN` 2.4, `RAIL_GAIN` 0.08 and `PING_GAIN` 1.8 were
flat constants. Nothing in `artStrimer.js`, the draw block, or the shader
referenced depth in any form — grep for `depth|fade|cue` across all three
returns nothing but `depthTest: false`. So a packet bound for a node on the
FAR side arrived exactly as white-hot as one crossing the front, and its
arrival ping put a bright 6px disc on a node that depth cueing had dimmed.

The branch's own premise — *"THE PRISM WAS THE ONLY LAYER ON THE SPHERE WITH NO
DEPTH TERM"* (`artEdges.js`) — **was wrong.** This was the other one, and it is
the brightest layer in the renderer.

**MEASURED** (`scripts/_a16kuramoto.mjs`, fired through `__artFireStrimer` so
WHICH node fires does not depend on a hit-test grid). `kuramoto` aims three
strands, at `ceei`, `soma91` and `feigenbaum`. All three are real drawn nodes
at 0.00px — nothing dropped, no attractor, no control point — but:

| target | depth | disc peak alpha | vs median |
|---|---|---|---|
| ceei | +0.5456 | 0.604 | 1.48x |
| feigenbaum | +0.5362 | 0.600 | 1.47x |
| **soma91** | **-0.3625** | **0.247** | **0.61x** |

**THE FIX.** `strimerDepthCue` / `strimerCue` in `artStrimer.js`, deliberately
the twin of `prismChordCue` down to interpolating the CUES rather than the
depths (a clamp does not commute with a lerp). The cue multiplies the GAIN and
nothing else — geometry, width and colour untouched. Rail takes the midpoint
cue, the head takes the cue AT `u` so it dims as it travels, and the ping takes
the DESTINATION's cue, which is the one that was putting a bright disc where no
node was visible. `STRIMER_DEPTH_ALPHA_FLOOR = 0.25`, level with the prism's
0.24 for the same footprint reason (a 3px additive head is not a 14-20px disc).
6 new tests, 1502 green, lint 0 errors.

**MEASURED BEFORE/AFTER**, same pinned frame, 22x22 patch at each target:

| target | depth | before mean L | after mean L | change |
|---|---|---|---|---|
| ceei | +0.546 | 35.1 | 34.2 | -2.5% |
| feigenbaum | +0.536 | 18.3 | 17.7 | -3.3% |
| **soma91** | **-0.363** | **48.6** | **36.1** | **-25.7%** |

Selective, in the intended direction: the back-bound strand loses a quarter of
its light and the two front-bound ones barely move.

**THREE THINGS THE AUTHOR HAS TO RULE ON.**

1. **`STRIMER_DEPTH_ALPHA_FLOOR = 0.25` IS A DIAL CHOSEN BY ANALOGY, NOT
   MEASURED.** It is set level with the prism because the two layers now
   answer the same question. It wants an eye.
2. **THIS DIMS THE WHOLE LAYER, not only back-bound strands.** The cue is
   `(depth + 1) / 2`, so a strand to a node at depth +0.55 draws at 0.77, not
   1.0 — only depth exactly +1 is unchanged. Measured cost on the front
   targets is -2.5% / -3.3%, which is small, but it is not zero and it is the
   whole wavefront.
3. **THE PARITY REFERENCE IS NOW STALE FOR THIS LAYER.** `fired-cascade` is
   the one capture state that left-clicks, so `artCompare` against
   `art-sphere-phase4-prism-dash-certified-a` will show a real difference
   there. That is the change working, not a regression — but the reference
   needs re-cutting once this is approved.

**WHAT I DID NOT DO, AND WHY.** The report proposed clamping the target vector
to a verified-visible node, or suppressing strand generation when the target
fails a visibility threshold. Both break propagation:

- **Clamping reroutes the packet.** `stepStrimer` delivers the +0.6 arrival
  bump via `arrivedDst`, so a re-aimed strand would deposit energy on the
  WRONG node and the graph would propagate incorrectly.
- **Suppressing cancels the bump entirely.** `artStrimer.js` already names
  this failure: *"a dropped packet silently cancels its target's arrival bump
  ... the same 'suppress without spawning' failure the `{ neighbours }`
  contract in useSomaGraph exists to prevent."*

Giving the layer a depth term reaches the same visual goal — a strand can no
longer out-shine the node it lands on — with the graph semantics untouched.
**Say so if you want the literal suppression instead; it is a different
trade and it is yours to make.**

**HARNESS ADDED.** `projRef` in `ArtTab.jsx` stashes the frame's projection
(one assignment, nothing in the render reads it) and `__artStrimerState` now
reports each packet's endpoint world `(x,y,z)`, projected `(sx,sy)`, `depth`
and `scale`. Without it the strimer hook could say which node a packet was
aimed at but not where that landed or how deep it sat — the two questions
actually asked of this layer.

### 4.5 The re-report, re-tested against an INDEPENDENT reference — STILL NOT A PHANTOM

> **OVERTURNED 2026-09-23. THE PHANTOM WAS REAL, AND THIS SECTION CERTIFIED IT.**
> The table below says every additive run ends "on a disc **or the sphere
> centre**". The sphere centre WAS the phantom: the prism's star spokes ran
> from `(w/2, h/2)`, where no node is drawn, to each effect node, so every
> click put 4-5 straight lines on an empty vertex. `_a15mesh.mjs` exempted
> exactly that point (`// prism spoke hub`), so it could never fail on the
> defect it was written to find. That is the vacuous-instrument trap this very
> section names, one layer down. Fixed in `2d710ad8`: the star radiates from
> the clicked node (`prismSpokeHub`), and the exemption is deleted. Falsified:
> with the old spokes restored the same check flags 5 run ends per frame at
> the sphere centre, and 0 with the fix, over 8 frames of the prism's life.
> **Lesson: an exemption in an instrument is a claim. Test it like one.**

**Ruled 2026-09-21.** The author re-reported the convergence, correctly noting
it was NOT the click wavefront but the base edge / network mesh, and asked
three specific questions. All three are answered below, this time WITHOUT the
circularity that §4.3 and §4.4 both carried.

**THE FLAW IN THE TWO EARLIER INSTRUMENTS, STATED PLAINLY.** `_a12ortho.mjs`
and `_a13prism.mjs` both build "where the nodes are" out of the BASE EDGE
ENDPOINTS, on the assumption that every base edge runs centre to centre. Test
the claim "an edge ends where no node is" against that set and the phantom
point is admitted into the reference and the check passes vacuously. **Neither
instrument could ever have detected the defect it was aimed at.** This is the
same family as the blind parity reference in §4.1: an instrument that cannot
fail is not evidence.

**THE INDEPENDENT REFERENCE.** Node discs are written into the same buffer with
a NEGATIVE width, at instance index >= `discStart`, by the NODE draw loop —
not the edge loop. `scripts/_a15mesh.mjs` uses those disc centres, forging 4–5
ortho bridges through the real right-click path to match the reported state
(`31 nodes · 45 edges · ⊥ 5 orthogonal`).

| checked | result |
|---|---|
| base + ortho lines | 44 instances, **88/88 endpoints on a drawn disc** (≤1px) |
| additive stream | 11592 line instances in **868 polyline runs, every run's two ends on a disc** or the sphere centre |
| discs present | **32 distinct centres for 31 nodes** |
| dropped instances | **0** edge stream, **0** additive |

Additive runs are chained by EXACT float equality — `writePolyline` guarantees
segment i's `(bx,by)` IS segment i+1's `(ax,ay)` — so interior tessellation
joints are never mistaken for termini.

**ANSWERS TO THE THREE QUESTIONS.**

1. **Node culling vs the edge buffer — REFUTED.** No node is culled while its
   edges draw. 32 disc centres for 31 nodes, zero dropped, and every endpoint
   in both buffers has a disc on it. The disc writes *are* guarded by
   `eg.count < MAX_EDGES` and the node loop *does* `continue` on a missing
   colour (`ArtTab.jsx`), so the failure mode is real in principle — it is
   simply not firing here.
2. **The vertex is a real node.** At 8× magnification of the reported
   screenshot the convergence is a node: a ~50px amber halo with the green
   bridge and two base edges landing on it. Its disc draw call is not failing.
3. **Control points / handles — REFUTED.** Every polyline run's two ends are on
   discs; nothing is drawn to a Bezier control point. (A quadratic control
   point is not on its own curve in any case.)

**SO WHY IT READS AS EMPTY.** The node is drawn at the bottom of the scene's
range. Disc PEAK alpha across all 32 nodes: **min 0.027, median 0.373, max
0.812**. Two of the four ortho bridges terminate on nodes at **0.063** — about
6× below the median node — and those nodes are ~50px soft halos whose core is
a lens ramp with a deliberately transparent centre (`LENS_CENTER_K`), so there
is no bright dot at all. The bridge landing on them is 3.3–4.3px wide (vs a
base wire's 1.15–1.30px) and is the ONE edge kind that gets an opaque shadow:
`shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho)` — SphereEdges.js's
`SHADOW_SRC_OVER`, *"Ortho: always 1.0 (fully opaque)"* — so it carries a 6–14px
halo a plain edge does not. Bright wide wire, near-invisible node.

**TWO THINGS I ALMOST ASSERTED AND MEASUREMENT REFUSED.**

- *"The ortho glow has no depth term."* **Wrong.** `shadowAlpha` is only one
  factor: `peak = shadowAlpha * a * 1.5958 * vHalfW / vGlow`
  (`SphereEdges.js:1465`), and `a` is the stroke alpha, which carries
  `depthFade` twice for ortho. The constant 1.0 is the SHADOW's alpha, not the
  glow's brightness.
- *"The node is at 0.024 alpha."* **Wrong, and it was my own decode.** Reading
  only `a0` gives the CENTRE stop, which for a node core is
  `lensStops().center` — deliberately the most transparent of three. Decoding
  all three stops moves the same nodes from 0.024 to 0.063 and the scene
  median from 0.129 to 0.373. `_a15mesh.mjs` now reports the peak stop and
  says so.

Instrument: `scripts/_a15mesh.mjs`. It also writes
`lookbook/mesh/mesh-annotated.png`, the live frame with every MEASURED disc
centre ringed — the claim is checkable by eye, not just in a table.

### 4.3 Reported "triangular wire ghosts" — INVESTIGATED, NOT A DEFECT

**Ruled 2026-09-21: leave it, it is the design.** Do not re-open without new
evidence; both proposed causes were tested and refuted.

Reported as 1px stray wires forming a flat triangular chord structure "rather
than curving along the spherical attractor manifold", said to be appearing
across multiple nodes *now*, with two proposed causes.

- **"Ortho endpoints hit a stale/null target index and collapse to a default
  vector" — REFUTED.** `scripts/_a12ortho.mjs` forges bridges through the REAL
  right-click path (the harness hook only re-flags existing edges, so it cannot
  reproduce a bad TARGET INDEX) and decodes every ortho instance's endpoints
  against the node centres implied by the non-ortho population. **All 8
  terminate on real node centres at both ends. Zero at the origin, zero at the
  buffer centre.**
- **"They bypass the bend/spline curvature pass" — REFUTED. There is no such
  pass for these edges.** `tessellateQuad` is called at exactly four sites: the
  prism, the analogy filaments, the chimera fringes. `ArtTab.jsx:1544` says it
  plainly — *"All four cases now write one instance into the GL buffer instead
  of stroking."* One straight instance each.
- **"Now" — REFUTED.** The pre-branch reference (`eb83fda3`) and phase 4 are
  visually identical on `idle`; `artCompare` puts them at mean 0.285 / max 9.2.
  `artEdges.js:75` states it outright: a base wire is a **1.15–1.30px thread**
  and *"the geometry, which has always run centre to centre."*

**WHAT THE TRIANGLE ACTUALLY IS.** The endpoint tally: `857,68` serves three
bridges and `719,375` serves three more. `findOrthogonalNode` excludes existing
connections but keeps selecting the same maximally-divergent partners, so
bridges fan out of and into SHARED HUBS. That fan is the triangular structure.

Also: ortho bridges measure **3.3–4.3px** wide. The 1px wires are the BASE
EDGES underneath them — a different layer from the one named in the report,
which is the third time on this project that a reported symptom has named the
wrong layer.

### 4.4 Reported click-pulse "phantom triangle" — INVESTIGATED, NOT A DEFECT

**Ruled 2026-09-21: the bundle's geometry is correct. Do not re-open on the
same evidence.** This is the FOURTH time on this project that a reported
symptom has named the wrong layer, and the second in two days on this branch
(§4.3 was the first).

Reported as: on left-click the multi-strand curved bundle fires, and its outer
~4 strands break away from the arc and pinch together at an arbitrary empty
coordinate where NO node exists, forming a sharp triangular sail beside the
curve. The ask was to diagnose why the outer strand indices/vectors collapse
to a false vertex during the pulse lifecycle.

> **METHOD CAVEAT, added after §4.5.** The instrument below takes its node
> centres FROM THE BASE EDGE ENDPOINTS. That is circular against the question
> "does a line end where no node is", and §4.3's `_a12ortho.mjs` has the same
> flaw. The conclusion here survived an independent re-test (§4.5) — but the
> reasoning as written was not sound on its own, and neither instrument could
> ever have failed. Use the DISC stream, as §4.5 does.

**THERE IS NO FALSE VERTEX.** `scripts/_a13prism.mjs` fires a real left-click
on the highest-degree node, decodes the additive stream, and classifies every
vertex by multiplicity.

- The bundle has **exactly five termini**, each shared by 59 strands. The next
  vertex down is x8 — a tessellation joint (two abutting segments × the glow
  and core passes, × neighbouring spectral lines colliding on the 1px rounding
  grid). The gap between 59 and 8 is what makes "terminus" a measured category
  and not a chosen threshold.
- **All five land on a node centre to 0.00px** — bit-identical floats, which
  is exactly what `tessellateQuad`'s Bernstein form guarantees at t=0 and t=1.
- **This holds at nine points across the whole 120-frame lifecycle** (frames
  2, 6, 12, 24, 40, 60, 78, 96, 114). Zero phantoms at every one.

The five are the clicked hub and its four neighbours, named by how many base
edges terminate on them: `soma91` (degree 4), `soma_plus` (1), `pragmatic`
(2), and `kuramoto`/`leviathan` (3 each, not separable by degree alone).

**WHAT THE CUSP ACTUALLY IS.** The terminus that reads as empty is
`pragmatic`. It is a real node, the bundle lands on it correctly, and it is
the node that is not being SHOWN. Mean luminance in a 25×25 patch at each
terminus at frame 2 — where the envelope is still at ~9% of peak, so the
discs dominate and the bundle barely contributes:

| terminus | mean L |
|---|---|
| `soma91` (clicked hub) | 170.79 |
| `kuramoto` / `leviathan` | 91.36 |
| `soma_plus` | 74.17 |
| `kuramoto` / `leviathan` | 51.94 |
| **`pragmatic` — the cusp** | **20.36** |

`pragmatic` is 2.6× below the next dimmest and 8.4× below the hub: it is the
most back-facing of the five, cued down toward `DEPTH_ALPHA_FLOOR = 0.08`
(`artNodes.js:26`), while the 59 chords converging on it are held up at
`PRISM_DEPTH_ALPHA_FLOOR = 0.24` (`artEdges.js:379`). That 3:1 lift is
deliberate, and `artEdges.js`'s own comment already states the cost — a
back-facing chord ends "up to 3x its own disc". The triangular sail is what
that trade looks like when the disc loses.

**NOT MEASURED, AND THEREFORE NOT CLAIMED.** The causal A/B was not run.
Dropping `PRISM_DEPTH_ALPHA_FLOOR` to the disc's 0.08 and re-shooting the same
pinned click would prove the mechanism and hand over the dial, but it moves an
authored aesthetic constant and was not touched unasked.

Instruments: `scripts/_a13prism.mjs` (geometry + disc luminance — the
load-bearing one) and `scripts/_a14cusp.mjs` (hover/hit-test, secondary and
weaker). Frames in `lookbook/prism/`, full run in `lookbook/prism/report.txt`.

**TWO TRAPS THIS COST, both worth the re-read.**

1. **Node centres must be measured in the SAME FRAME as the vertices.** A
   first pass took them before the click; the sphere's auto-spin then put two
   genuine termini 3.7px and 5.3px outside a 3px tolerance and they reported
   as phantoms. The instrument was measuring its own drift, and it very nearly
   shipped a false positive that agreed with the report.
2. **The hover tooltip is debounced 130ms in REAL time** (`ArtTab.jsx:3497`,
   "so it doesn't flash on a spinning sphere"). The clock is virtualised but
   `setTimeout` is not, so a 60ms wait read NOTHING at every terminus —
   including the hub a liveness probe had named one step earlier. A liveness
   check on a known node AND known-empty space is what caught it; without one
   the run would have "confirmed" no node at all five termini.

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
