# Handover 2 — the wire hum, after the carrier was falsified

**THE WORK DESCRIBED HERE HAS LANDED ON THIS BRANCH.** It was REWRITTEN onto
`feature/chaos-mobile-and-hum`, not merged, exactly as the "Still owed"
section below required — the experiment commits each said NOT FOR MERGE in
their body and none of them was carried across:

    d4cac8e3  feat: the hum breathes at 3500 ms and 0.40, chosen by looking
    8a9b8b34  tools: two instruments for the halo’s open questions
    41aa0b0d  feat: breathe a glow shoulder onto the dormant edges, scaled

**The spin fix was deliberately left behind.** `7b671cf8` on
`wip/hum-spin-look` steps `AUTO_SPIN` on the clock instead of a frame count.
It is a real bug fix and it belongs with `breathPhase` and the `e.pulse`
decay on `fix/art-breath-clock`, because a second frame-moving change on this
branch would confound the reference re-base this branch still owes. Its
instrument, `scripts/_a7spinrate.mjs`, stayed with it.

Everything below is the reasoning as it stood before the promotion, kept
unedited except for this header. Where it says "this branch" or "wip", read
it as the history of how the code on THIS branch came to look the way it
does. The dial values it quotes were superseded by the author twice, and the
final ones are in `HUM` and `HUM_GLOW` in `artEdges.js`, not here.

Supersedes the "Where it stopped" section of
`handover-chaos-hum-and-mobile.md`. Everything else in that file still
stands — read it for the DPR work, the source-canvas removal, the traps and
the tooling. This file covers only what changed after it was written.

## The state, in one paragraph

**CORRECTED 2026-09-20, after the numbers below were measured rather than
carried over.** The original text of this paragraph said the shippable branch
was "16 commits" and that `wip` carried "four experiment commits **on top of
it**". Both were wrong, and the second one mattered: the branches are
**siblings, not a stack.**

`feature/chaos-mobile-and-hum` is unchanged and still the shippable branch:
**15 commits ahead of `main`** at `4e83466c`, clean tree. `wip/hum-spin-look`
was **19 ahead of `main`** at `65a47955` and grows by one with every commit
added after it, docs included — so COUNT it, never quote it from here:
`git rev-list --count main..wip/hum-spin-look`. Neither branch contains the
other — `git merge-base --is-ancestor`
answers NO. They forked at `3cf0d181` (14 ahead of `main`) when the first
handover was committed onto `feature` alone, three minutes after the first
experiment was committed onto `wip` alone.
**Neither branch is merged or pushed. `main` is 0/0 with origin.**

On `wip`, and not on `feature`:

    e86f7919  docs: the handover for the hum and the mobile pass  <-- cherry-picked here
    65a47955  docs: handover 2 (this file)
    116228b6  fix: the glow experiment's import never landed
    48d6c596  experiment: breathe a glow shoulder onto the dormant edges   <-- UNSEEN
    c75806b4  experiment: 3500ms and 0.40, to test the RATE hypothesis     <-- seen, verdict below
    7b671cf8  experiment: step the spin on the clock                       <-- seen, verdict below

`e86f7919` is `4e83466c` cherry-picked over from `feature`. Until that was
done, the two pointers in this file to `handover-chaos-hum-and-mobile.md`
resolved to a file that **did not exist on the branch this file lives on** —
each half of the record named the other's absence. Docs only; no experiment
commit was touched.

Gates on `wip`, **re-measured 2026-09-20, not inherited**: 1369 tests in 119
files pass, lint prints `0 errors, 146 warnings` (read off the printed count,
not a pipeline's exit status), tracked tree clean. The 1364 quoted for
`feature` is inherited from the earlier handover and was NOT re-measured.

## What the author has ACTUALLY SEEN, and ruled

Three hypotheses were put to him and he falsified two by looking. This is the
spine of the whole investigation and it should not be re-litigated:

1. **"Rotation masks it."** WRONG. He held the sphere static — zero rotational
   motion — and it was still imperceptible. The spin fix (`7b671cf8`) is still
   a genuine bug fix and should still land, but it was not the cause.
2. **"It is a global dimmer, so raise the wavenumber."** WRONG, and measured
   rather than argued: the per-edge gain spread at K = 2 is already **85-100%
   of the full swing** at every point in the precession — some edges sit at
   peak while others sit at trough. K = 10 measures the same. Wavenumber is
   not a lever and should not be swept again.
3. **"The rate is too slow (0.09 Hz is near DC)."** PARTLY RIGHT. At 3500 ms
   and amplitude 0.40 he reports it **is** pulsing and visible — "but
   blink-and-you-miss-it, because the wire is too thin to carry it against the
   node bloom and grain."

**HIS RULING: the carrier is confirmed wrong. Stop dialling wire alpha.** The
effect was modulating the least perceptible attribute (alpha) of the least
perceptible carrier (a 0.55-1.15 px dim line) at, originally, the least
perceptible rate. Rate is fixed; carrier is not.

## What was built in response, and HIS VERDICT ON IT

`48d6c596` implements **candidate 2: breathe the edge glow shoulder**, on his
explicit instruction.

**SEEN AND RULED 2026-09-20: "it’s breathing now, socks/10."** That closes
question 1 below and, with it, the carrier question the whole investigation
turned on. The diagnosis holds: the effect was never too weak, it was
modulating the wrong attribute of the wrong carrier. Moving the same wave
onto a large, soft, low-spatial-frequency area — changing NOTHING about the
wave itself — is what made it perceptible. Do not reopen amplitude,
wavenumber or rate looking for the win; it was never there.

It is still on an experiment commit that says NOT FOR MERGE. Questions 2 and
3 are still UNMEASURED — a socks/10 on a desktop panel is not a mobile
budget and not a bloom measurement.

**The finding that shaped it, and it is the reusable part.** Dormant edges
wrote `packFlags(..., 0)` — they have **no glow shoulder at all**; only fused
edges do. So this INTRODUCES a halo rather than modulating one. And
`EDGE_FRAG` does not carry a shadow alpha, it DERIVES one from the radius:

    fuseCos     = clamp((vGlow - FUSED_GLOW_BASE) / FUSED_GLOW_SCALE, 0, 1)
    shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho)

`FUSED_GLOW_BASE` is 6, so **any radius at or below 6 px renders alpha 0.** The
obvious implementation — breathe the glow 0 -> 5 px — would have rendered
NOTHING and read as a wiring bug. Caught before writing it, and it is the same
shape as the strimer's shader material that drew nothing.

Taken as a gift rather than worked around: over `[6, 10]` the derived alpha
runs `[0, 0.3]`, so the halo's SIZE and INTENSITY breathe together the way a
swelling glow physically does, the trough is genuinely absent so the resting
sphere is unchanged, and **no certified shader code is touched**. The halo
takes `vC1`, the edge's own mid stop, so it needs no colour of its own.
`humWave()` was split out of `humGain()` so the glow rides the SAME wave as the
alpha rather than a second oscillator that would drift against it.

Constants: `HUM_GLOW = { floor: 6, swing: 4 }` in `artEdges.js`. Both are
dials. `packFlags` quantises glow to 1/8 px and clamps at 15.875, so the swing
has room to grow to ~9.8 before it hits the encoding.

## DO THIS FIRST

Question 1 is **PAID** — he looked, on `wip/hum-spin-look` at `116228b6`
served by the live vite server, and ruled socks/10. Questions 2 and 3 are
what remain, and neither needs his eye:

1. ~~Does the halo read as breathing where the line alpha did not?~~ **YES.**
2. **Does it pump the bloom? MEASURED 2026-09-20: NO.** `scripts/_a8glow.mjs`
   shoots 8 frames across one breath from the standard pinned world;
   `scripts/_a8ink.mjs` reads the light budget out of them. The control and
   the glow build produce an IDENTICAL a0 series frame for frame
   (0.1805, 0.1701, 0.1632, 0.1811, 0.2061, 0.1771, 0.1825, 0.1859), so the
   halo is provably the only difference between the two sets.
   `hot` — pixels at or above the composer’s 0.28 `luminanceThreshold`, i.e.
   the population the bright-pass actually acts on — moves x1.0144 in the mean,
   and its swing across the breath goes 25.91% -> 27.71%. **The control already
   swings 26% there from the alpha hum alone**, so the halo adds under two
   points to a pump that was always running. The p10 floor is byte-identical at
   0.00784 in all 16 frames and peak luminance moves 0.8692 -> 0.8717: no milky
   lift, no new highlight. The added light lands BELOW the bright-pass, exactly
   as the derived-alpha cap of 0.3 predicts. Not a flicker risk.
3. **Mobile cost. MEASURED, and the finding is not the ms.** Same rig at
   390x844 with touch emulation, so `(pointer: coarse)` really matches and the
   DPR-1 path engages: GL backing 358x360 = 128,880 px against the desktop
   run’s 1,044,000. Drawn AREA (`lit`) goes x1.0878 desktop, x1.1047 mobile.
   Main-thread `draw` cost is inside the run-to-run drift — desktop p50 1.3 ->
   1.1 ms, i.e. the glow build measured FASTER, which is drift, not a speedup;
   mobile p50 1.5 -> 1.6. Those runs are headless SwiftShader and are NOT a
   frame budget, per `artFrameTime.mjs`’s own header.
   **THE REAL FINDING: `HUM_GLOW` is an ABSOLUTE radius, and the sphere is
   not.** `maxGlow` reads exactly 10.000 px in BOTH runs, but `sphereR` is
   410.83 on desktop and 162.83 on the phone. The halo is therefore 2.43% of
   the sphere radius on desktop and **6.14% on a phone — 2.5x wider relative to
   the artwork**, and its area swing across the breath goes 14.18% -> 26.65%.
   This is the same class as the certified `inkScale` lesson: **write it as a
   RATIO of `sphereR`, never a literal**, or decide deliberately that a phone
   held at arm’s length WANTS the fatter halo. Right now it is a literal, so
   whatever ships is unchosen rather than chosen.

If it works, the dials to settle are `HUM_GLOW.swing`, and then walk
`HUM.amplitude` back DOWN from 0.40 — the line alpha is a supporting actor now,
not the effect, and 0.40 was chosen when it was carrying everything.

## Still owed on the shippable branch

Unchanged from handover 1, and none of it should start until the look is
settled, because all of it certifies or reviews whatever the sphere finally
looks like:

1. **Task 5, the reference re-base.** Until paid, NO artCompare number on this
   branch means anything.
2. **The final whole-branch review** over `14999da..HEAD`. Never run. On the
   strimer branch this was the pass that caught a real bug both per-task
   reviews missed, and it came from the plan's own text.
3. The experiment commits on `wip` must be **rewritten, not merged** — each
   says NOT FOR MERGE in its body. The spin fix belongs with `breathPhase` and
   the `e.pulse` decay on `fix/art-breath-clock`, because a second
   frame-moving change on this branch would confound the re-base.

## Two process failures from this session, both mine, both worth inheriting

**A piped lint masked a broken gate.** `npm run lint 2>&1 | tail -2` returns
`tail`'s exit status, so `&&` chained on and committed code with two `no-undef`
errors that would have thrown on the first frame. **Check the printed error
count, never the exit status of a pipeline.**

**A string-replace patch silently matched nothing.** `humWave`/`humGlowRadius`
were added to a standalone import line that did not exist — an earlier agent
had folded the hum names into the big `artEdges` block. The replace was a
no-op and reported success. **Assert the anchor, or grep the result.**

Both are the session's larger pattern in miniature: the code was fine every
time; the instruments and the prose were what lied. Full list in
`handover-chaos-hum-and-mobile.md` under "Traps this session paid for".
