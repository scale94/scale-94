# CHAOS prism — packet narrowing, measured and ruled

**Date:** 2026-09-22
**Branch:** `feature/chaos-prism-depth-dash-beads`
**Plan:** `docs/superpowers/plans/2026-09-22-prism-packet-narrowing.md`
**Ledger:** `.superpowers/sdd/progress.md`
**Status:** **RULED. Arm 3 ships, defaulted locally at `43ed17a8`. NOT merged, NOT pushed.**

---

## 1. The ruling

The author flipped all five arms live with `__artSetPacketArm(i)` on his 360Hz AW2725DF. His ruling, verbatim: **"arm 3 wins ship it."**

| arm | w | step | bundle (2w+6·step) | forced n | fate |
|---|---|---|---|---|---|
| 0 — pre-ruling | 0.18 | 0.05 | 0.66 | 40 | reachable ("before") |
| 1 — shear only | 0.18 | 0.025 | 0.51 | 40 | reachable |
| 2 — ×0.75 | 0.135 | 0.0375 | 0.495 | 56 | reachable |
| **3 — ×0.60** | **0.108** | **0.030** | **0.396** | **72** | **RULED, default** |
| 4 — ×0.50 | 0.09 | 0.025 | 0.33 | 80 | **deleted** on the ruling |

The bundle went from 0.66 of the chord to 0.40. What he'd named in mode 0 was *directional ambiguity*: the whole chord lit at once. The narrower packet targets exactly that, and it stacks on top of arm A's white-hot lead strand.

**He looked only at 360Hz.** At 60Hz, arm 3 on the shortest chord (56ms transit) advances 1.38 of its own support per frame, against arm 0's 0.83. If it ever reads as jumping on a 60Hz projector at Ars, that is the cause. **Check the exhibition display's refresh rate before the show.**

---

## 2. THE HANDOVER THAT STARTED THIS HAD THE TRAP BACKWARDS

The chroma handover said narrowing `W` would "silently FADE THE WAVE OUT under the `PRISM_WAVE_SEG_FULL` guard". **It would not have.** `prismSegmentFade(n)` read only `n`, and the draw loop forces `n` on every waving chord, so the fade read 1 at any W. A half-width pulse at the shipped 40 segments would have **beaded at 16.4% with every guard green**. Measured, `_a18wsweep`:

| | W=0.09 | W=0.108 | W=0.135 | W=0.18 |
|---|---|---|---|---|
| n=40 | **16.4%** | 11.6% | 7.6% | 4.3% |
| n=72 | 5.5% | **3.8%** | 2.5% | 1.4% |
| n=80 | 4.3% | 3.0% | 1.9% | 1.1% |

**Ripple is a function of samples across the support, 2·W·n.** The passing cells all sit at ≈14.4, the value W=0.18/n=40 already held. So the guard is now keyed on that, with `PRISM_WAVE_SAMPLES = 2·PRISM_WAVE_W·PRISM_WAVE_SEG_FULL`, and the forced count is `prismWaveSegmentsFor(w)`, rounded up to a multiple of 8. The old guard test (`2·W·SEG_FULL >= 5`) passed at W=0.09 and was replaced.

**The ripple instrument now lives in `src/terminal/art/artPrismRipple.js`**, a leaf shared by the test and the sweep, so neither carries a copy. The real-chord ripple test has a written falsification: `worstRipple(0.09, 40) > 0.10`.

---

## 3. Dials, by provenance

| dial | value | provenance |
|---|---|---|
| default packet arm | `PRISM_PACKET_ARM_RULED` = 3 | **RULED 2026-09-22, by eye, 360Hz only** |
| `PRISM_WAVE_W` / `PRISM_PHASE_STEP` | 0.18 / 0.05 | unchanged; now the BASE the arms scale from, **not what ships** |
| `PRISM_PACKET_ARM_SHIPPED` | 0 | name kept, following `PRISM_CHROMA_MODE_SHIPPED`; means *pre-ruling* |
| `PRISM_WAVE_SEGMENTS` | 72 (derived) | the max over arms; repaid from 80 on the ruling |
| `PRISM_WAVE_SWELL` | 0.10 | **MARGINAL AT ARM 3**: its launch step `DEPTH·SWELL` = 4.0% now sits just above arm 3's 3.8% ripple. Seen and ruled, but it's the first dial to try if the cascade's arrival at each chord ever shows an edge. |

---

## 4. What is verified

| claim | evidence |
|---|---|
| arm 0 was bit-identical to `cf171676` throughout the A/B | code trace in the final review + legacy-oracle `toBe` tests on `prismPulse`/`prismWavePhase`/`prismChromaSkew`/`prismSegmentFade` |
| every arm reaches the GPU buffer | `_a20wavetrace` run lengths 40/40/56/80 at arms 0/1/2/4; **72 at the new default, on all 6 runs** |
| the shear follows step | launch spread 0.292 (arm 0) → 0.249 (arm 2) → ~0.09 (arm 4); arm 3 ≈0.11 at 65ms |
| no overrun | `_a19budget`: capacity 229722 (was 131162 before the A/B, 254362 during it), dropped 0 |
| buffer tied to the ruled arm | tests: `PRISM_WAVE_SEGMENTS === prismWaveSegmentsFor(ruled.w)`, and no arm is narrower than the ruled one |
| arm 4 is gone | `__artSetPacketArm(4)` → `null` on the live page |

**The arm is LATCHED AT SPAWN** (`eff.packetArm`), so a flip applies to the next click, never to a wave in flight. That was a final-review finding: the per-frame read could make a mid-transit flip look like a glitch during his A/B.

### Not verified — say so

- **The four-effect worst case.** `_a19budget`'s click volley only ever reached 1–2 live effects, so its peak (7440) is not the worst case. Capacity is sized for `PRISM_MAX_EFFECTS` by derivation, and the capacity tests now size from the arm table. They were vacuous before; the final review caught it.
- **Mobile, on a real phone.** Mobile-emulated, desktop GPU: the prism-window rate fell 157.5 → 125.0fps from arm 0 to arm 4. Arm 3 was not measured; expect between. Carried forward from three handovers now.
- **Arm 1's spread** was never captured directly. It is proven through arm 4: spread depends on step alone, and they share step 0.025.

---

## 5. The parity reference

**RE-CUT at `75ec6de3`, committed `9d0cd8a9`:** `baseline/art-sphere-phase5-prism-ruled-certified-a` (with `-b`..`-e`, untracked, named in `repro.dirs`), 24 cells. `artNull` 24/24 at floor 0.95, worst 0.9706 (laptop@2x idle). All five manifests: `gitDirty false`, provenance from git. It supersedes `phase4-prism-dash-certified-a`. Read its README before quoting any number.

**AND IT IS BLIND TO THE PRISM.** Compared against phase 4, it scores **24/24 ADMISSIBLE**. `fired-cascade` is the only cell that ever puts a prism chord on screen, and all five rulings land there (strimer depth cue, prism clock, wavefront, chroma arm A, packet arm 3). It scores inside its own same-build null at every scale: mean diff 0.090/0.063/0.056, ink ratio ~1.00-1.01.

It is not the phase-3 zero-population shape, because the prism does fire every run. But the result is the same: **a regression to chroma mode 0 or packet arm 0 would very likely still pass 24/24.** This is the same class of blindness the ortho layer had until phase 4, and `artCompare` passing a visible change is already on record (the bloom-knee work).

**What protects the prism today is the unit tests plus the buffer probes (`_a20wavetrace` run lengths, `__artEdgeState`), not this reference.** A prism-isolating capture state is open work. It would be the ninth state, placed like `ortho-bridge`: fire one node, then shoot while the wave is in flight. The earliest reachable frame is about 55ms after a click, and the transit is about 100ms, so it is feasible but tight.

---

## 6. Process findings

1. **The plan's own premise was wrong, and measuring before planning caught it.** Extending `_a18wsweep` to narrow widths took one run and inverted the handover's trap. Every earlier defect list on this project traces to plan text; this one was caught before it became code.
2. **The capacity tests were vacuous against exactly the overrun this work enabled.** They computed need from `CURVE_MAX_SEGMENTS` (24), so reverting the buffer sizing would have passed while arm 4 needed 80. Only the whole-branch review saw it. A per-task reviewer can't, because the test predates the branch.
3. **A report path collided with an older plan's `task-5-report.md`.** Name SDD reports per plan.
4. **Commit `7374dd6b` alone forces 80 segments at arm 0.** `a7b276b9` restores 40. Never cherry-pick or bisect-ship the first without the second.

---

## 7. Still open

1. **Merge + push** — his call, and his explicit word only.
2. **A prism-isolating capture state** — the reference is blind to every prism ruling (§5).
3. **60Hz look** at the exhibition display (§1).
4. `PRISM_A_WAKE_SAT` has never been swept (chroma handover §3).
5. Mobile fps on a real phone (§4).
6. The disc↔streak ink discontinuity (~38×) — still needs an author ruling before any code.
7. Arms 0–2 and chroma mode 1 are reachable only as "before" arms. A future pass may delete them.
