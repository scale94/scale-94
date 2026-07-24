# Lunar shader moon — design

**Date:** 2026-07-22
**Status:** approved, not started
**Supersedes:** §8 of `2026-07-22-lunar-doctrine-register-design.md` (Phase 2)
**Phase 1 (doctrine register):** shipped, merged to local main at `ce999d6`

---

## 1. What this is

A WebGL2 moon for the `/LUNAR` tab, replacing the canvas moon's *rendering*
while leaving the canvas moon in place behind a persisted toggle.

The existing canvas moon (`LunarTab.jsx:152-460`) renders once into an offscreen
buffer. The only motion on the tab is star twinkle. That is its real weakness —
not pixel quality. It is a still image of a moon.

This design makes it a body: it nods, it swells and shrinks, its surface
reorganises itself as your eye adapts, and it runs on three real periods that
never quite line up.

## 2. Thesis

Three claims, all citable, all rendered rather than stated. The tab's header
carries `⊘ NO ESOTERICISM · CITED`; nothing here weakens that.

1. **Earthshine.** The canvas moon's dark half is `rgb(0,0,0)` — it asserts the
   unlit half is empty. That is the wrong doctrine. The half the sun refuses is
   lit by Earth, and Earth at that moment is full.
2. **The Purkinje shift.** Dark adaptation moves peak visual sensitivity from
   555 nm to 507 nm. Reds die, blues survive. The longer you stay in the dark,
   the more you see — and you see *different things*, not merely more of them.
3. **Three clocks.** Synodic 29.531 d, anomalistic 27.554 d, draconic 27.212 d.
   Phase, size and nod are independent. The wheel does not close.

The third is the counterweight to Phase 1. The doctrine register closes on the
wheel and hard-cuts through ten discrete states (measured 2026-07-22). The moon
sits beside it as the continuous, non-repeating thing.

## 3. Architecture — two passes, one canvas

`§8.1` of the Phase 1 spec specified per-pixel FBM + three crater scales + a
four-tap ±ε gradient **per frame**. At 340 px × dpr 2 that is ~460k pixels ×
~40 noise evaluations every frame. It runs, but it will not hold 60 fps on
mobile and it caps how rich the surface can be. Rejected.

### 3.1 Pass A — bake

Runs once per mount (and on resize past a threshold). Renders an equirectangular
selenographic map into an RGBA8 texture:

| resolution | when |
| :--- | :--- |
| 2048 × 1024 | desktop |
| 1024 × 512 | `innerWidth < 768` |

| channel | contents |
| :--- | :--- |
| `RGB` | tangent-space surface normal, packed |
| `A` | albedo (highland ↔ mare mix) |

The full height field is evaluated **here and only here**: FBM highlands, the
`MARE_BASINS` array ported to a GLSL const array, and multi-scale craters. Four
taps per texel produce the gradient, which is written as the normal. One draw
call, amortised across the session.

### 3.2 Pass B — render

One fullscreen quad. Per pixel: one texture fetch and roughly 30 ALU ops.
Per-frame cost is effectively free, which is what allows the surface in §4 to be
richer than either the canvas moon or the original §8 could afford.

## 4. The surface

**This is the part most likely to miss.** Everything else in this design is
arithmetic or compositing. The surface is where "correct" and "beautiful" can
diverge, and it will be iterated in the browser rather than got right on first
compile.

The canvas moon scatters craters on fixed-frequency grids
(`LunarTab.jsx:275-293`, `freq = [15, 35, 80]`), which produces a visible
lattice — the mechanical failure mode, and a hard fail for this project.

Replacement, and it is cited: **lunar crater size-frequency follows a power law,
N ∝ D⁻².**

- jittered-grid (Worley) cell placement, not fixed-frequency stamping
- per-cell radius drawn from a D⁻² distribution
- a real rim / floor / ejecta profile, not a linear ramp
- a small number of large basins placed by hand (the existing `MARE_BASINS`)

Getting the *distribution* right is what makes a procedural surface read as a
moon rather than as noise.

## 5. Per-frame pipeline

1. **Sky first.** Procedural starfield (in-shader hash, no vertex buffers),
   chromatic corona with R/G/B falloffs at slightly different radii, violet
   haze. All alpha. See §8.
2. **Disc test** against `uAngularRadius` (§6.2).
3. Sphere normal `N`; rotate by the libration matrix (§6.1) → selenographic UV.
4. Fetch normal + albedo; perturb → `Np`. This is the terminator relief: crater
   rims cast long shadows where `dot(Np, L) → 0`. The canvas path cannot do this
   — it shades a smooth sphere with albedo painted on.
5. **Lommel–Seeliger scattering, not Lambert.** The canvas moon uses
   `limbDark = 0.7 + 0.3 * nz` (`LunarTab.jsx:301`), which renders a full moon as
   a lit ball with a bright centre. Real full moons are near-uniformly bright
   edge to edge. The lunar law is `µ₀ / (µ₀ + µ)`. More correct and visually
   distinctive.
6. **Opposition surge.** A nonlinear brightness spike within a few degrees of
   zero phase angle — shadow-hiding among regolith grains. The full moon becomes
   genuinely hot, which is also what bleaches you (§7).
7. **Mesopic composite** (§7.2).
8. **Dither.** Triangular noise at ~1/255 before output. Non-negotiable: violet
   gradients over near-black is the worst case for OLED banding, which was
   already hit during the nebula work.

## 6. Ephemeris — `lunar/lunarEphemeris.js`

Pure module, no WebGL, fully testable.

```
timestampForScrub(age, now) → number     scrub position → real forward timestamp
libration(t)                → { lon, lat, pa }
apparentRadius(t)           → number
```

### 6.1 The scrub is a clock

The scrub maps to an actual timestamp rather than to a bare phase value. This is
what makes libration and apparent size worth building: both run on the
anomalistic month and would be frozen within any session otherwise.

Nothing outside the moon changes. The transit matrix and the doctrine register
continue to read lunar age exactly as they do today.

### 6.2 Terms

| quantity | amplitude | period |
| :--- | :--- | :--- |
| optical libration in longitude | ±7.9° | anomalistic, 27.554 d |
| optical libration in latitude | ±6.7° | draconic, 27.212 d |
| apparent diameter | 29.43′ – 33.53′ (14% swing) | anomalistic, 27.554 d |

Apparent radius from `r = a(1 − e²) / (1 + e·cos ν)`, `e = 0.0549`.

### 6.3 Precision — stated, not assumed

Right amplitudes, right periods, right beating between them. **Not** JPL-accurate
absolute positions: a simplified two-term analytic model, phase-anchored to a
recent epoch.

This is the correct level for the tab. `⊘ NO ESOTERICISM · CITED` is a claim
about mechanism, not about arcseconds. The module docblock states this
explicitly so no future reader assumes more. Substituting real ELP terms later
changes one file and nothing else.

## 7. Dark adaptation

### 7.1 State — `lunar/darkAdaptation.js`

Pure step function.

```
ceiling = 1 − 0.85 · illumination
adapt  += (ceiling − adapt) · (1 − exp(−dt / τ))     τ = 5 s
```

63% at 5 s, 87% at 10 s, 99% at 25 s. Exponential approach is the shape of real
rod recovery: feedback arrives within the first second, and the last of it never
quite lands.

This replaces the linear 25 s ramp in the original §8.2.

| condition | behaviour |
| :--- | :--- |
| illumination jump > 0.15 in one frame | **bleach** — `adapt *= 0.15`, instantly |
| tab hidden | freeze, do not reset (you are not in the light) |
| `prefers-reduced-motion` | pin at `ceiling`; no ramp, no libration drift |

### 7.2 The mesopic split

Adaptation is not a local glow on the dark half. Luminance decides which visual
system renders each pixel.

Total scene luminance `Y = Ld + Le` (direct + earthshine). Mesopic weight:

```
s = smoothstep(Y_hi, Y_lo, Y)          0 = photopic, 1 = scotopic
```

**`Y_hi` and `Y_lo` scale with `adapt`.** Adapting raises the thresholds, so the
scotopic zone climbs up into the lit side.

- **Photopic path** — neutral silver, faint warm cast on highlands. Honest: the
  lit crescent is bright enough to stimulate cones, so it must not go violet.
- **Scotopic path** — albedo reweighted by V′(λ) (blue up, red down), *then*
  tinted visual purple.

The reweighting is the Purkinje shift proper, and it buys more than a tint:
**mare and highlands swap relative brightness as you dark-adapt.** Bluish basalt
seas brighten; warmer anorthosite highlands sink. The surface reorganises itself
while you sit still.

The terminator therefore becomes a **hue** boundary rather than only a brightness
edge — placing the strangest colour exactly where the crater relief is sharpest.

### 7.3 Earthshine

Rendered as **frontal fill**, near-flat across the disc, not as a shaded sphere.
Earth is behind the viewer at new moon, which is why the real old-moon-in-the-
new-moon's-arms reads as a flat grey disc. Strength `pow(1 − illum, 1.6) · adapt`,
soft-wrapped around the limb, coloured through the scotopic path.

### 7.4 SCOTOPIC meter — in

`SCOTOPIC ▁▂▃▄▅▆▇█` below the moon, violet fill, reading `adapt`, in the visual
language `ParamBar` already establishes on this tab.

In rather than optional: without it the ramp reads as *nothing is happening*,
which is a UX failure rather than a subtlety. One component, one uniform read —
trivially removable if it proves noisy.

## 8. Presentation — unboxing the sky

Today the moon is a 340 px rounded-corner square with an opaque black fill
(`LunarTab.jsx:454`, `LunarTab.jsx:1239-1243`). A hard-edged rounded rect is what
makes any render read as *an asset in a box*.

Changes:

- canvas grows to full column width × ~1.25 × the disc diameter
- **no `rounded-lg`, no opaque black fill**
- `alpha: true` context, premultiplied output
- starfield, corona and haze render with a radial alpha falloff reaching zero
  *inside* the canvas bounds

Result: no visible edge; the sky composites onto the page background. This needs
no layout rework — the `lg:grid-cols-[340px_1fr]` grid, the transit matrix and
the doctrine register all stay where they are.

A desktop-only negative-margin bleed behind the panel is available as a later
refinement. The alpha falloff alone is sufficient to kill the boxed read.

## 9. Performance

| stage | cost |
| :--- | :--- |
| bake | one draw call, once per mount |
| render | ~700k pixels at dpr ≤ 2, one texture fetch + ~30 ALU |

Frame rate: full while adapting or scrubbing, **30 fps at rest** (twinkle and
drift only), which halves idle power on mobile.

"At rest" is defined, because §7.1's ramp asymptotes and never formally
completes: `|ceiling − adapt| < 0.002` **and** no scrub interaction within the
last 500 ms. Any scrub input or bleach returns to full rate immediately.

### 9.1 The rAF trap applies harder here

A hidden pane suspends `requestAnimationFrame`, so this moon does not render at
all — not merely slowly. Additionally the CDP capture scripts in
`C:\Users\raul-\.claude\projects\F--scale-9-4\tools\` pass `--disable-gpu`, which
forces software GL.

**Drop `--disable-gpu` (or add `--enable-unsafe-swiftshader`) before any capture
attempt.** Otherwise you will screenshot a black canvas and diagnose a shader bug
that does not exist.

## 10. Toggle and fallback

`localStorage['lunar_moon_renderer_v1'] ∈ { 'canvas', 'shader' }`, default
`shader` during evaluation so the comparison is the default experience.

If `getContext('webgl2')` returns null, fall back to canvas regardless of the
stored setting.

**The canvas moon is not deleted.** Whether it goes is the author's call after a
live browser review, and is not a decision this spec makes.

## 11. Files

| file | role |
| :--- | :--- |
| `lunar/lunarEphemeris.js` | pure — scrub↔time, libration, apparent radius |
| `lunar/darkAdaptation.js` | pure — adapt state step function |
| `lunar/moonShader.js` | GLSL: bake source + render source |
| `lunar/LunarShaderMoon.jsx` | WebGL2 host, rAF loop, fallback |
| `lunar/MoonRendererToggle.jsx` | persisted switch + SCOTOPIC meter |

Two pure modules rather than the original §9's single host file. Same shape that
worked in Phase 1 (pure engine + thin component), and the only way any of this is
testable.

`LunarTab.jsx` gains imports and mount points. Nothing existing is deleted.

## 12. Testing

`lunarEphemeris.test.js`
- a known perigee date yields apparent radius near maximum; a known apogee date
  near minimum
- libration amplitudes stay within ±7.9° / ±6.7°
- each term's period matches its stated month to within tolerance over a
  multi-year sweep
- `age → timestamp` is monotonic within a cycle and wraps cleanly
- the three periods do not alias: no common return within a 5-year sweep

`darkAdaptation.test.js`
- `adapt` clamps to `[0, ceiling]`; `ceiling` tracks illumination
- exponential shape: at `t = τ`, `adapt ≈ 0.63 · ceiling`
- bleach fires at an illumination jump > 0.15 and **not** at exactly 0.15
- hidden freezes without resetting
- `prefers-reduced-motion` pins at `ceiling`

`LunarShaderMoon.test.jsx`
- `getContext('webgl2') === null` → canvas fallback renders
- unmount cancels rAF **and** removes every listener. The pointer-listener leak
  from the ecocide work must not be repeated here.

The shader itself is not unit-testable. Verified by CDP capture across a swept
set of ages, using the Phase 1 recipe with the GPU flag corrected per §9.1.

**Note from Phase 1:** plan-authored test code carried five real defects that
only mutation testing found. A passing test here proves nothing until it has been
watched to fail.

## 13. Out of scope

- **Register coupling.** The moon and the doctrine register share a thesis, not
  an import. Nothing here imports from `compileLunarDoctrine`. Coupling would
  muddy both, and the moon's job is to be the continuous thing beside a discrete
  one.
- **A real star catalogue behind the moon.** The moon moves ~13°/day through
  actual constellations, and rendering that against the scrub-as-clock is a good
  idea — deliberately deferred to a later phase.
- **Transit matrix, `LUNAR_ACCORDS`, `DRYNESS`** — unchanged.
- **Deleting the canvas moon** — author's call, post-review.
- **The three Phase 1 open items** (quadrant axis, σ feel, register label
  contrast) — tracked separately, untouched by this work.
