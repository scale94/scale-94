# The wire hum — design

Status: approved 2026-09-20. Branch `feature/chaos-mobile-and-hum`.

An idle pulse for the /chaos sphere's edges. Between trigger events the graph
currently sits still except for the sphere's breath; this gives it a resting
pulse rate — each edge's whole length slowly brightening and dimming on a phase
taken from its position in the graph, so neighbouring edges breathe together
and the pattern drifts across the sphere without anything travelling along any
single wire.

This is option B of three. A was a travelling `sin(kx - wt)` packet — the
"dark fibre carrying telemetry" reading; C is both, B at rest and A on edges
adjacent to a recent event. **C is the destination and B is the first step**,
chosen in that order deliberately: B costs nothing and cannot fight the trail
accumulator, so it establishes the resting rate that A is later measured
against.

Every number here is either derived from source or named as an aesthetic dial.
Section 6 says which, and section 7 says what is NOT yet measured — this design
did not get the throwaway-probe treatment the strimer got, and that is a real
difference in confidence, not a formality.

---

## 1. Why there is no shader in this design

Every base edge in the draw loop derives from one scalar, `baseAlpha`, at
`ArtTab.jsx:1385`:

    baseAlpha = (min(na.energy, nb.energy) * 0.5 + 0.06
                 + spectralBoost + fusionBoost) * depthFade

All four render branches — ortho, fused, spectral, default — read it, and the
depth fade, the spectral-similarity boost and the bone-fusion boost have
already folded into it by that point. Because B modulates each edge's whole
length *uniformly*, the entire effect is one multiply on that scalar.

What that avoids, and each of these was a real candidate before the code was
read:

**No 19th float.** The obvious home for a per-edge phase is instance slot 16 —
but that slot is the DASH PHASE, written by `writePolyline` as a running sum of
arc length and read by the ortho and spectral branches. A hum there would
silently corrupt every dashed edge. The next free slot costs a stride bump, the
precedent for which is documented at length under "THE 18th FLOAT" in
`SphereEdges.js`. Deriving the phase CPU-side costs nothing instead.

**No extra pass.** Option A needed one: a travelling highlight on the edge mesh
smears through the trail accumulator into a comet, so it would have had to move
to the non-accumulating layer beside the strimer. B translates nothing, so the
accumulator merely blurs the modulation slightly in time — which softens it
further, in the direction we want.

**No mobile cost.** This lands in the same week as the DPR-1 cut for coarse
pointers (`c2d3529`). A design that spent a pass would have spent that cut.

The cost is one `humGain()` call per edge per frame — about 90 edges, one `sin`
each — plus two `sin` and one `cos` per frame for the axis. That is noise
against the ~18,500-instance prism cascade the same loop already writes.

## 2. The gain

A pure function in `artEdges.js`:

    humGain(mid, axis, phase) = 1 + A * sin(phase - K * dot(mid, axis))

`mid` is the **3-D** midpoint of the edge's two nodes, `(na + nb) / 2`, taken
before projection. Both nodes are already in hand at the call site.

3-D rather than projected screen space, and this is the load-bearing choice in
the whole design. Nodes live on a unit sphere (`useSomaGraph.js:3`), so a
world-space wave is anchored to the graph and ROTATES WITH IT. A screen-space
wave would be pinned to the viewport and the sphere would appear to slide
through a fixed curtain of light — which is a different effect, and a worse one
for a graph that is meant to look like it is idling rather than being lit.

`dot(mid, axis)` is in [-1, 1] for a unit-sphere midpoint, so `K` is read
directly as radians of phase across a sphere RADIUS, and `2K` across the
diameter.

## 3. Against "mechanical"

A fixed axis at a fixed rate is a metronome, and banded/mechanical motion is
the project's standing hard fail. So the axis PRECESSES: it traces a slow cone
rather than standing still.

    theta = TWO_PI * t / P
    axis  = ( sin(TILT) * cos(theta), cos(TILT), sin(TILT) * sin(theta) )

The wave direction therefore wanders, and two clusters that breathed in
sympathy a minute ago no longer do. `P` is deliberately not a small-integer
multiple of the breath period, so the two cycles do not re-phase on any
interval a viewer would notice.

`K` is deliberately NOT pi. At `K = pi` exactly one wavelength spans the
diameter and the front and back of the sphere sit in perfect antiphase, which
reads as a clean dipole — a rotating two-lobe blink, the mechanical failure in
another costume. `K = 2.0` puts about 0.64 of a cycle across the diameter, so
no two regions are ever exactly opposed.

## 4. The clock — corrected

**Stepped on `performance.now()`, never on a frame count.** This reverses what
was said during the brainstorm, where a per-frame phase increment was proposed
on the grounds that the capture rig needed it. That reasoning was wrong in both
directions:

- A frame counter runs at DOUBLE SPEED on a 120 Hz display. That is a bug this
  repo has already shipped and fixed once, in the /SCENT collider, and the
  strimer carries the rule in a comment at `ArtTab.jsx:2131`.
- The capture harness virtualises `performance.now()` and advances it
  `FRAME_MS` per `__pump`, so a clock-stepped effect is already
  bit-reproducible under capture. There was nothing to trade away.

The hum therefore reads the same clock the strimer does, at the same call site
granularity: once per frame, into `phase` and `theta`, then shared by every
edge that frame.

This leaves an OPEN DEFECT that this design does not fix: the sphere's own
breath (`awakeningRef.current.breathPhase`) advances a fixed 0.015 per draw and
so does run at double speed on a 120 Hz display. Out of scope here, logged in
section 8.

## 5. Scope

Base graph edges only.

Untouched: the prism cascade, the strimer, pulse rings, the additive layer, the
nodes, the background. The hum is what the graph does when NOTHING is
happening, so anything that is an event must stay outside it or the event stops
reading as an event.

## 6. The numbers

Derived from source:

| name | value | where it comes from |
|---|---|---|
| midpoint space | unit sphere | `useSomaGraph.js:3`, R = 1.0 |
| `dot(mid, axis)` range | [-1, 1] | unit-sphere midpoints |

Aesthetic dials, to be chosen on frames, not settled here:

| name | start | reasoning for the start value |
|---|---|---|
| `HUM.amplitude` A | 0.15 | Seraphine's proposal; +/-15% on `baseAlpha` |
| `HUM.wavenumber` K | 2.0 | ~0.64 cycle across the diameter; avoids the pi dipole |
| `HUM.periodMs` T | 9000 | "glacial" — slower than the sphere's own breath |
| `HUM.axisPeriodMs` P | 97000 | 97/9 breaths; the combined pattern repeats in 14.5 min |
| `HUM.axisTilt` | 1.05 rad | ~60 deg cone; not polar, not equatorial |

All five live together as a frozen `HUM` block in `artEdges.js`, in the same
shape the `BLOOM` block takes in `artComposite.js`, so the sweep can patch them
and the chosen values can carry their own dated note.

The pair T and P is chosen on the RATIO, not on either number alone. 97/9 is in
lowest terms with a denominator of 9, so the wave direction and the breath
re-phase only once every 9 axis turns — 873 s, about 14.5 minutes. A ratio like
10 or 10.5 would put the whole pattern back where it started in under two
minutes, which is inside the time somebody actually looks at the sphere.

## 7. What is NOT measured, and the two ways this can be wrong

**The hum may pump the bloom.** `baseAlpha` can reach roughly 1.41 before
`depthFade` on a fused spectral edge, and the bloom's `luminanceThreshold` is
0.28. A +15% lift on an edge already near the threshold makes its BLOOM breathe
too, not just its ink — and a breathing bloom halo at this amplitude could read
as flicker rather than as breath. This is the single most likely way the design
is wrong and it is unmeasured.

The fallback, if the strip shows it: attenuate the amplitude by how boosted the
edge is, `A_eff = A * (1 - min(1, spectralBoost + fusionBoost + pulseBoost))`,
so the hum lives on the dormant graph and fades out of edges that are already
saying something. That is arguably the better design on its own merits — it is
not chosen up front only because it should be chosen against a frame.

**Depth attenuates the hum.** `baseAlpha` already carries `depthFade`, so a
multiply means back-of-sphere edges hum proportionally less in absolute terms.
This was raised and accepted during the brainstorm: depth should attenuate
everything, including the breath. The alternative — adding the hum AFTER the
depth fade so the far side pulses as loudly as the near side — is a one-line
change if the frames say otherwise.

## 8. What this owes, and what it defers

**A re-base is owed.** This moves the frame, so `artCompare` will read it as a
regression and it will BE one. The live reference is
`baseline/art-sphere-phase2-bloom-dial-certified` at `d69ce75`. Once the dials
are chosen: one capture, five sets, same drill as the bloom dial. Until then
every parity number on this branch is meaningless and must not be quoted.

**Deferred to C.** Travelling telemetry on event-adjacent edges. It needs the
non-accumulating layer, so it is a genuinely larger piece of work, and it wants
the resting rate settled first so the two can be dialled against each other
rather than in isolation.

**Logged, not fixed.** `breathPhase` advances per frame and runs at double
speed on 120 Hz displays (section 4).
