# Observer Eye — thematic reaction pass (plan)

Branch: `feature/eye-ambient`. Prereqs landed in this session (uncommitted at time of writing):
- `u_thread` teal hairline → resting-only thin-film sheen (`× u_irid × (1-kick) × (1-turb)`), so it
  can never sit on a coloured eye. eyeParity 30/30.
- Back-spin: crossing into silver throws a reverse coast (3.6 rad from full colour, τ 0.38 s,
  integrated off dt — same at 4 s or 1 h uptime, tested). Silver bleeds back slower (0.05^dt) so
  the colour runs under the spin. Leaning focus 0.34 → 0.52 (contracts further).

Feel is verified per step in the live build at 64 px before the next step starts.

## Phase 0 — why everything reads timid (do this first; every tab depends on it)

**Measured, not guessed:** a tinted kick on a resting eye shows *no colour at all*. The shader
replaces the nebula with the silver record by `mix(col, rec, u_irid)`, and kicks never touch
`u_irid`. At rest `u_irid = 1`, so `c0/c1/c2` (where the kick's hue goes) are invisible. Only
the paint-over terms (ring, packet, spiral) show, and in white-ish. Proof render: "red kick on
rest" in the proof sheet: a white ring on silver, zero red.

0a. **Kick owns colour.** In `overlay()`, a tinted kick drops irid by its level
    (`o.irid = cur.irid * (1 - level)`). Its end is then a real return-to-silver, so the new
    back-spin fires at the end of every coloured reaction too. Needs the back-spin trigger to
    read the *output* irid edge, not only the target's.
0b. **Shape channel.** New uniforms `u_shape` (id) + `u_shapeK` (0..1) + `u_shapeA/B` (two free
    params), branched like the kicks so all-zero keeps v1 parity. Pupil/disc SDFs live here
    (kernel, butterfly, moon, event horizon). Budget: analytic only, still 4 fbm calls.
0c. **Live drive channel.** Several asks are continuous, not one-shot (Mercury spin, lunar scrub,
    SOL hold, ecocide sliders, surveillance path, scent colours). A module-level `eyeDrive`
    (plain object, no React, no bus traffic per frame) that a tab writes and `ObserverEye` reads
    each frame: `{ spin, phase, gazePath, palette, mood, shape }`, each with its own decay so a
    tab that unmounts mid-drive lets go. Agency filter unchanged: the tab only writes on user input.
0d. **Multi-stage envelopes.** Several reactions are scripted (collapse → rebound, spin → settle,
    bounce A → B → C). Kick gets an optional `keys: [{t, ...uniforms}]` timeline interpolated per
    frame instead of the single attack/decay. Durations up to ~1.6 s (today's tiers are shorter).
0e. **Whisper placement.** The phrase box is `absolute left-full top-1/2` on the eye, so it runs
    right across /KERNEL /BSKY /ACCRETION for 6 s. Anchor it under the masthead border instead
    (`top-full`, left-aligned with the eye, below the rule line), same animation.

## Phase 1 — tabs, ordered by what they need

Each row: event source → what the eye does → primitives. One commit per tab, live look before next.

| # | Tab | Trigger | Eye | Needs |
|---|-----|---------|-----|-------|
| 1 | /KERNEL | load, run, **and Enter on a `tty0:~$` command** | Hard contraction, disc squares off into the KernelCoreIcon package (frame + top/bottom pins), pupil → diamond die; spin-up while held, back-spin settle on release to round | 0b, 0d |
| 2 | /BSKY | node selection | ~1.5 s: full 360° turn, pupil becomes a butterfly (flap 0.55–1.0 x-scale), rises and fades off the top of the disc; a new round pupil irises open from the centre; back-spin | 0b, 0d |
| 3 | /TRANSMISSION | mark | packet ring runs **big → small** (inward reception); today's `rr=0.05+0.85K` is already inward, the visible ring reads outward because of the attack, so the envelope flips, not the term | 0d |
| 4 | /ACCRETION | synthesis start (not end) | ~1.5 s swallow: focus → 1, disc darkens from the rim in, spiral infall tightens to an event horizon (black), photon-ring rim, then rebound open + back-spin | 0b, 0d |
| 5 | /SCENT | collide | the collider's **two live accord colours** as c0/c1, two streak lobes counter-rotating and merging into a swirl (merge kick, payload colours instead of tab tint) | 0c palette |
| 6 | /SOL | spinning the sun (hold) → release | while held: convection granulation (cell-noise on the fbm, warm palette, spin follows); release: solar-wind burst (ring + radial streaks outward) | 0c spin, 0d |
| 7 | /SURVEILLANCE | first input → focus; each packet bounce | gaze vector keyframed along the route's compass headings (e.g. SE click: N → S to DE → W to US); the pupil travels, doesn't teleport | 0c gazePath, 0d |
| 8 | /CRYPTOGRAPHY | seal | block-scramble: uv quantised into shifting 4–6 px blocks with horizontal shear, snaps back to focus on a detent | 0d |
| 9 | /CHAOS | **right-click (new interaction in the art tab)** + pick/fork | Feigenbaum cascade: the swirl forks 1 → 2 → 4 → 8 lobes at intervals shrinking by δ≈4.669, then smears into chaos and settles | 0d, art-tab handler |
| 10 | /ECOCIDE | growth_mandate / protection_protocol sliders | growth: anger stare (hard contraction, red-shift, agitation ∝ value); protection: relax (dilate, slow, soft). Live, both directions | 0c mood |
| 11 | /LEDGER | audit run | pollution: sepia-grey murk clouds in from the rim, swirl turbulent and dim, clears slowly | 0d |
| 12 | /LUNAR | scrub (live), compile phase | disc masked to the current moon phase (terminator SDF + earthshine); compile cycles new → full → new smoothly | 0b, 0c phase |
| 13 | /MERCURY | planet spin; element clicks | eye spins with the planet's angular velocity (live, signed); the 4 anachronistic elements each focus into their own palette | 0c spin, palette |
| 14 | Quintessence compile | each stage (spine read, periphery witnessed, ...) | the crescendo storm's gaze jitter goes. Each stage is a vault-dial click: a crisp angular step of the phase (~π/8 in 60 ms) + a tiny overshoot detent, focus steps in with it; Aether builds stage by stage into a luminous core with halo + rays (not the faint dot) | 0d |

Open questions for the author before the step that needs them:
- /SURVEILLANCE: which component owns the packet's route, and does it expose headings or only
  lat/lon? (gazePath needs one 2D direction per hop).
- /CHAOS right-click: what should right-click *do* in the art tab itself? The eye mirrors it,
  it can't be the only effect.
- /SCENT: the collider's two accord colours live where at collide time (GL uniforms or React state)?

## The kernel icon / butterfly question (answered by render, not opinion)

Proof sheet (real shader, real 37 CSS px canvas at DPR 2, plus 4× of the same pixels) in the
session scratchpad: `eyeproof/proof.png`.

- **Kernel: works.** Rendered at real size it reads as the nav icon immediately, and it's *not* a
  sprite: the disc squares off by blending the circle into a rounded-box SDF, the pupil turns into the
  die by blending into the L1 norm (|x|+|y|), the nebula keeps flowing inside the chip, and the
  strokes carry the fbm, so they look like liquid metal. Edges are crisp because they're SDFs with 1 px AA.
  The canvas is 37 px; the nav icon it copies is designed for 12–16 px. The canvas has
  2–3× the room the icon was drawn for. The "too small for an icon" objection doesn't hold.
- **Butterfly: partly right, fixable.** Open-wing frames read as a butterfly at real size;
  the closed-flap frames read as a blob, and the first silhouette (tight flap + bright rim) read
  as a skull. Fixes already in the second render: flap never below 0.55 width, a notch between
  wing pairs, no outline rim. Its legibility comes from motion (the flap and the rise), not from any single
  frame. Remaining rule for the build: the pupil *becomes* the butterfly (no second round pupil
  under it until it has left), and the silhouette stays generic, not the Bluesky logo's shape.
