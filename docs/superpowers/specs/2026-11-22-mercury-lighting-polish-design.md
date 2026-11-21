# Mercury lighting polish: physics first (design)

Branch `polish/mercury-lighting` (from main 8255e4c0). Author pick 2026-11-22: approach A.

## Intent

The spun liquid planet on /MERCURY should read as photographed liquid mercury, at socks/∞ standard. Many earlier
rounds got it to "liquid chrome with a clay undertone". The author ran a Gemini proposal (warm/cool horizon gradient,
a wider soft wrap lobe, NEUTRAL_SKY_FLOOR lifted to 0.015–0.025). We evaluated it against the render and the earlier
rulings and declined it: two of its three moves repeat looks already ruled clay (smooth dome 2026-10-08, soft strips
2026-10-07/08, amber fill indistinguishable), and a uniform floor lift veils the whole ball grey (sheet
`.superpowers/sdd/tools/out/polish-base-sheet.png`, middle).

## What the baseline render showed (2026-11-22)

`.superpowers/sdd/tools/out/polishiso-a-sheet.png`: the ruled liquid has a lit grey **day half with a soft terminator**,
and the canopy turns dim and blue across it. Turning `aetherGain` to 0 removes both. Cause: `aetherTint(nW)`
(hgMirrorGlsl.js) multiplies ALL reflected aether by 0.2 × NIGHT_TINT on the night hemisphere, keyed on the surface
normal. Right for the element gas skies (that gas is in the planet's shadow); wrong for the camera-fixed studio tent.
A mirror has no terminator. This is the clay.

Also: the output path is linear → sRGB with a hard clip at 1, and the aether is soft-capped at AETHER_SHOULDER 1 ×
Fresnel ≈ 0.78. So the softboxes read as grey-white painted panels, never as blinding lights.

## Goals

1. Remove the terminator from the liquid's studio reflection.
2. Highlights behave like a photograph: lights blow out to white with a smooth roll-off.
3. The liquid becomes a sharper mirror (roughness well under 0.14) without reading as black glass.
4. Midtones come from structure in what the mirror sees (gradients, seams), never from a flat lift.

## Non-goals

- The crust / frozen Hg / glaze / frost looks (all ruled). They keep `aetherMirror` exactly as now.
- The element skies (water/fire/earth/air) and their night attenuation: unchanged.
- The neutral nebula option (neutralNebula 1): untouched, but must still compile and render.
- A captured HDRI (approach B) is not shipped. It may be built later as a side-by-side reference only.

## Anti-goals (fail even if it "works")

- Any flat ambient lift, smooth dome, or soft wrap lobe: ruled clay three times.
- Banding or mechanical-looking gradients (author hard fail).
- Changing the crust or regolith look through the tone curve.
- Judging from stills alone: every look step is judged in motion (spin + ripples) by the author.
- Regressing phone frame time (OnePlus 9 Pro gate) or the D3D11 compile time (the 87 s stall history).

## Constraints

- Camera-fixed studio; reflections only move with the liquid.
- `studioRadiance` (JS) must stay a line-for-line replica of `skyStudio` (GLSL); `studioMean` is derived from it.
- PLANET_FS is snapshot-pinned; re-pin deliberately per step.
- HMR trap: the author's dev tab reloads half-done edits. Make cross-reference edits in one write.
- Push only on explicit author command; no merge or PR without one.

## Approaches considered

- **A. Fix the physics first (picked).** Targeted fixes for the measured causes, keeping the authored tent and its knobs.
- B. Bake a CC0 studio HDRI into the existing cube path. Fastest "photo", but loses the authored tent and its tuning; reference only.
- C. Gemini as written. Low risk, but repeats ruled-clay looks and the floor lift veils the ball.

## Design (four steps, each its own look gate)

### Step 1: the mirror sees the tent everywhere

Split the aether in the liquid path only. `envRadiance` stays byte-for-byte as it is: frost rime, the quench core,
evaporite and the visitor water/rock terms call it and are ruled looks. A new `envRadianceLiquid` (my call) tints only
the element part; the studio term reaches the liquid untinted. Call sites that switch: the planet liquid
(mercuryPlanetShader `liquid = fresnelHg(NoV) * envRadiance(...)`), the visitor crust pool (it is liquid Hg), the
droplets and the Hg beads. Every other `envRadiance` / `aetherMirror` caller is unchanged. Mechanism (my call):
`aetherSky` returns the element part and the studio/nebula part separately (e.g. an out parameter).

**Decided:** the nebula part (neutralNebula > 0) follows the studio and is untinted (my call: it is also a camera
scene the mirror sees, not sunlit gas).

**Diagnose first:** the day half also shows a broad mid-grey fill whose source is not yet identified (canopy wrap,
strip span, or the shoulder's path-to-white). Step 1 starts with a probe that zeroes each tent term and records which
one fills it. If it is a tent term, that term's geometry is the fix; if it is not the tent, report before changing anything.

Gate: A/B sheet (before/after, liquid, same pose) + author look in motion. Crust A/B must be pixel-identical, meaning
within ±1 LSB per channel (the output carries a time-seeded dither; my call).

### Step 2: highlights that blow out

- A highlight curve on the **liquid Hg term only** (my call, after the builder check): applied to the
  `envRadianceLiquid` result before it is mixed with anything else, in the planet liquid, the visitor crust pool, the
  droplets and the beads. It is not an output-stage curve, so the crust, regolith, steam, embers and every ruled
  non-Hg term are untouched by construction. Identity below a knee (≈ 0.6 linear, my call), a smooth C1 roll-off
  toward 1, hue-preserving like `aetherShoulder`. One shared GLSL chunk, so the four shaders can't drift.
- The studio gets its own shoulder constant (my call, `STUDIO_SHOULDER`), raised with the tent's key/canopy so the
  strip cores reach white. `AETHER_SHOULDER` stays at 1 for the element skies and frozen paths (non-goals). New values
  are live knobs first, ruled by the author.
- Optional highlight halation (glow): only if the author wants it after the curve lands, and only after a phone
  frame-time check. Not part of the first pass.

Gate: A/B sheet + crust/regolith pixel diff within ±1 LSB + author look in motion.

### Step 3: a sharper mirror

Lower `roughLiquid` from 0.14 toward 0.04–0.06 (author picks from a sweep sheet: 0.14 / 0.08 / 0.06 / 0.04). Check
the limb for sparkle/aliasing (skyPxLod already floors the mip) and the Sun lobe size. If 0.04 still reads as black
glass, that is the signal for step 4 to carry more, not to stop at 0.14.

Gate: sweep sheet + author look in motion.

### Step 4: midtones from structure

Add structure to the tent, never a constant:
- **Softbox falloff:** each strip and the canopy get a hot centre falling off toward their edges (edges stay crisp).
- **Tent seams:** a few faint fabric seams / panel joins in the tent walls at ~1–3 % of key, so the ripples have
  something to bend.
- **Warm bounce card (from Gemini's one good idea):** a small, warm, low card on the Sun side matching the corona hue,
  so the reflection agrees with what surrounds the planet. A card with edges, not a gradient.
- Each is a live knob (default from the author's ruling); `studioRadiance` mirrors every addition; `studioMean` follows.

Gate: knob sheets per element + author look in motion; phone gate on the final combination.

## Verification across all steps

- Unit tests: studioRadiance ↔ skyStudio replica (existing test pattern), studioMean, tone curve identity below the knee.
- Look tooling: `.superpowers/sdd/tools/polish-look.mjs` / `polish-iso.mjs` (CDP, dev server on 5175).
- Phone gate (OnePlus 9 Pro) before any push; 360 Hz desktop check.

## Left to the builder

Exact GLSL factoring, test file layout, sheet layouts, the curve's exact formula (within: identity below the knee,
hue-preserving, C1-smooth), and any refactor needed to keep the four shaders' curves identical (one shared chunk).
