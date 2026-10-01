# /MERCURY — gem polish: the planet under a real sun

Date: 2026-09-30 · Branch: `feature/mercury-gem-polish` (off main) · Status: DRAFT, awaiting author review

## 1. Intent

/MERCURY is the central tab. At rest it is **the planet** — Mercury in MESSENGER's
enhanced colour, real craters, lit by the real Sun at this UTC instant. Spin it and
it **transmutes into the element** — quicksilver, whose phase at every point is set
by that same Sun. Everyone gets the obvious meaning; the curious get the second one.

Quality bar: /ACCRETION (`views/manifesto/councilField*`). Raw GLSL 3, every physical
constant owned and tested by a JS module and interpolated into the shader with
`glf()`, so shader and physics cannot drift.

### What is wrong today (read from code, 2026-09-30)
- Rotation only drives `scale.set` squash (`MercurySphere.jsx:119-152`); the material
  (`chromePhase`) is driven only by the ~200 ms element-tap beat. Spinning never looks liquid.
- The spring is first-order (`k = 20·dt`): it cannot overshoot or ring → "tennis ball".
- Velocity EMA is frame-counted (`0.68/0.32` per frame) → 6× faster decay at 360 Hz.
- No relief, no Sun: a uniform grey ball inside a teal/magenta aether that swallows it.

## 2. Locked decisions (author, this session)
1. Custom shader from scratch. No `onBeforeCompile`, no three chunk injection.
2. Colour = USGS MESSENGER MDIS **enhanced-colour** global mosaic; relief = USGS global DEM.
3. Drag spins the **body** (torque, inertia); the Sun stays fixed. OrbitControls go.
4. Real Sun, live UTC ephemeris. At rest the planet sits in its true present orientation.
5. Released after spin, it settles back to the astronomical present.
6. Liquid lingers ~30–60 s after release (hysteresis), then refreezes.
7. Aether: A (clear window in front of the planet) + C (camera closer, planet dominates).
8. No passive cubemap reflections.

## 3. Corrections to the draft doctrine (Wren's review of Seraphine's pass)

| Draft claim | Problem | Resolution |
|---|---|---|
| "No reflections" (point 1) | A metal has no diffuse colour; measured July: no env → ~50% of the sphere black. That is the old black-glass ball. | **Live analytic reflections** of only what exists in the frame: Sun disc, the four aether elements as coloured area emitters at their true orbital positions and live opacity, black space. No cubemap, no PMREM (also removes the per-frame PMREM cost). |
| Liquid "only along the terminator band" | With T ≈ 700 K·cos^¼θ the boil line (630 K) sits at θ ≈ 49°; everything from there to the terminator is liquid — most of the lit disc, not a band. Plus thermal lag keeps dusk liquid past sunset. | Liquid = broad annulus on the day side, trailing into dusk; dawn side frozen. The asymmetry makes the rotation direction visible. |
| Night side = "frozen cratered crust" | Frozen mercury is not silicate crust. Once transmuted, the night side is **solid Hg**: matte, crystalline, silver. | Three phases of the element coexist on one globe: solid (night) · liquid (day annulus + dusk) · boiling (near noon). The USGS crust returns only when transmutation ends. |
| Physical window −39 °C…357 °C | These are 1-atm values. In vacuum liquid Hg has no boiling point — it evaporates at any T. | Kept as a **stated artistic convention** (1-atm window). Written in the physics module header, like `lunarEphemeris.js` states its precision boundary. |
| Noon: "boiling vapour shimmer, high solar glare" | Hg vapour is colourless; there is no air for heat haze and no atmosphere for glare. | Boiling = surface agitation: high-frequency roil, mirror coherence breaks up (roughness rises), plus a very faint exosphere haze at the limb. No bloom (canvas has none by design), no red incandescence (430 °C < ~525 °C Draper point). |
| "Solar-wind sodium tail" | The tail is driven mainly by **radiation pressure** (resonant scattering of Na D lines at 589 nm), not the solar wind. Its strength depends on Mercury's heliocentric **radial velocity** (Doppler shift out of the solar Fraunhofer line): weakest near perihelion/aphelion. | Tail brightness from the ephemeris: `∝ g(|v_r|) / r²`. Faint orange, anti-sunward, a soft glow — never particles (would clash with the aether). |
| "3:2 resonance and tidal pull settle it back" | Real tidal relaxation takes millions of years. | The return is a **time-based critically-damped spring toward the ephemeris orientation**. Honest name in code: `recapture`, not "tidal". The 3:2 lock is what the ephemeris orientation *is*. |

## 4. Viewing geometry (Wren's call — author may overrule)
Seen from Earth, Mercury shows phases; near inferior conjunction it is a black disc for
weeks. The central tab cannot go dark. So:
- **Real:** which face of Mercury is lit (subsolar lon/lat from the IAU rotation model),
  heliocentric distance r, radial velocity, Sun angular size, tail strength.
- **Chosen:** the camera sits at a fixed flattering phase angle (~55°, Sun behind-left
  of the viewer), so a gibbous planet with a visible terminator is always on screen.

## 5. Architecture

The Mercury canvas stays one R3F scene: the aether's four particle systems must sort in
front of and behind the planet, so a separate /ACCRETION-style canvas is not possible.

- **Planet = impostor quad + `RawShaderMaterial` (GLSL 300 es).** A camera-facing quad
  bounding the sphere plus max displacement. The fragment shader intersects the ray with
  the bounding sphere, then sphere-traces `r(dir) = R·(1 + h_dem + h_modes + h_waves)`
  (~24 steps + 4 bisection), shades, and writes `gl_FragDepth`. Pixel-exact silhouette,
  no tessellation.
- **Own output transform:** `RawShaderMaterial` skips three's colour-space chunks, so the
  shader encodes linear → sRGB itself, with ordered dither (banding on the author's
  QD-OLED is a known issue).
- **Equirect seam/pole:** sample with explicit gradients (`textureGrad`) from a
  seam-safe derivative, or the mip selector fires a 1-px seam at u = 0/1.

### Modules — `src/terminal/mercury/planet/`
Pure modules own the maths and are unit-tested; the shader reads them via `glf()`.

| File | Owns |
|---|---|
| `mercuryEphemeris.js` | JPL (Standish) Keplerian elements + rates; Kepler solve; r, v_r; heliocentric → ICRF; IAU/WGCCRE rotation (pole α₀ = 281.0103 − 0.0328T, δ₀ = 61.4155 − 0.0049T, W = 329.5988 + 6.1385108·d); body-frame Sun vector, subsolar lon/lat, Sun angular radius. Precision boundary stated in header. |
| `mercuryThermal.js` | `T_ss(r) = 700 K · √(0.307 AU / r)` (≈700 K perihelion, ≈570 K aphelion); day `T = T_ss·cos^¼θ`; night decay toward 100 K with hours after sunset; Hg window 234.32 K / 629.88 K (1-atm convention); transmutation hysteresis thresholds. |
| `mercuryBody.js` | Time-based integrator: drag → torque → angular velocity ω (inertia, damping); heat store `H += κ·|ω|²·dt` (dissipated rotational energy), leak `H -= λ·H·dt`; transmutation `τ ∈ [0,1]` with melt/freeze thresholds; `recapture` spring back to ephemeris orientation. Parity test: 60 Hz vs 360 Hz give the same trajectory. |
| `mercuryWaves.js` | Rayleigh body modes ℓ = 2,3,4 (ω ratios 1 : 1.936 : 3, damping 1 : 2.8 : 5.4); capillary dispersion ω² = σk³/ρ with Hg σ, ρ; impulse ring buffer (8). |
| `mercuryImpacts.js` | Impact events (element fire → impact point = sub-node point on the sphere); crater profile (bowl, rim, ray albedo); ray maturation (space weathering) over minutes. |
| `mercuryPlanetShader.js` | VS/FS strings, uniform list, constants interpolated from the modules above. |
| `MercuryPlanet.jsx` | Impostor mesh, textures, uniform writes **inside `useFrame`** (never via React state — today's beat re-renders the tab every frame). |
| `useMercuryDrag.js` | Pointer → torque on the body; auto-rotate is gone (the planet's true rotation is ~imperceptible; drag supplies motion). |
| `scarMap` via `gl/pingPong.js` | Equirect scar texture (crater depth + fresh-ray albedo), accumulated in-session. |

### Shading per pixel
1. `τ = 0` (planet): enhanced-colour albedo × Lambert from the real Sun direction, DEM
   normals (hard terminator, black crater shadows — no atmosphere), scar map on top
   (fresh bright rays maturing to background).
2. `τ > 0` (transmuting): front advances from the subsolar region outward (noise-edged),
   crust relief flattens into fluid as it passes. Refreeze returns the crust from the
   night side. Melting **erases scars** — the liquid heals the surface.
3. Element phases by local temperature (T_solar + spin heat):
   - **solid Hg** (< 234 K): matte crystalline silver, faint facet sparkle.
   - **liquid** (234–630 K): mirror, roughness ≥ 0.14 (never lower — black-mirror trap),
     analytic reflections, body modes + capillary waves + spin bulge.
   - **boiling** (> 630 K): roiling high-frequency surface, coherence loss, faint limb haze.
4. Sodium tail: additive soft glow anti-sunward, brightness from ephemeris.

### Events
- **Element tap** (unchanged trigger, `usePhaseTransition` still switches the aether):
  the sphere no longer flashes chrome. The element *strikes*: on crust → crater with
  bright rays; on liquid → capillary ring splash; on solid/boiling Hg → damped ring.
- **Drag:** torque, heat, waves from the drag point.
- **Release:** inertia → damping → recapture to the true present; liquid lingers, freezes.

### Aether window + camera
- Shared GLSL snippet in the four flow shaders (`ParticleFlow`, `ThermalFlow`,
  `SedimentFlow`, `AtmosphericFlow`): fade particles near the view ray to the planet
  centre **and** nearer than its surface, soft noisy edge. Geometric, because opacity
  cannot empty overlapping sprites (`mercuryTuning.js:31-33`).
- Camera: desktop 5 → ~3.6, mobile 6 → ~4.6. Final values tuned on the author's screen.

### Removed
`MercuryEnvironment.jsx` (drei Environment/PMREM), the sphere mesh and `scale.set`
squash in `MercurySphere.jsx` (ring, orbit nodes, thread, handles stay), `OrbitControls`.

## 6. Assets
One-off node script `scripts/build-mercury-maps.mjs` (not runtime): fetch the USGS
enhanced-colour mosaic and global DEM (public domain), resample to equirect.
- Albedo: 4096×2048 WebP desktop, 2048×1024 mobile.
- DEM: 16-bit height packed into RG of a lossless PNG (8-bit is too coarse for relief),
  same two sizes.
- Budget ≤ 4 MB desktop / ≤ 1.5 MB mobile. Lazy-loaded; until loaded the planet renders
  flat grey-brown (true colour) so the tab is never empty.
- Credit line in the tab footer: "MESSENGER MDIS / USGS Astrogeology".

## 7. Phasing (each phase shippable on its own)
1. **The planet:** asset pipeline, impostor + raw shader, ephemeris lighting, camera C,
   aether window A. The biggest visible jump; no interaction changes yet.
2. **The body:** drag-torque, inertia, recapture, heat store, transmutation, thermal
   phases, analytic reflections. Remove OrbitControls + MercuryEnvironment.
3. **The surface:** body modes, capillary waves, impacts/craters, scar map.
4. **The Sun's signature + gem pass:** sodium tail, boiling roil, mobile perf, reduced
   motion (static at ephemeris, no waves), author tuning pass.

## 8. Testing
- Unit: ephemeris vs JPL Horizons reference points (distance, subsolar longitude at ≥3
  dates incl. a perihelion); thermal window; body integrator 60/360 Hz parity; wave ratios.
- Shader: compile test + constant-interpolation test (the /ACCRETION pattern).
- Visual: screenshot first (hard rule). Known trap: the embedded preview pane cannot boot
  R3F — resize first / probe page. Motion feel, banding and FPS judged in the author's
  real browser and on their phone.

## 9. Out of scope
KernelTab's `MercuryTerminator` gauge and the retrograde easter egg (could later read
this ephemeris). A Sun shader. Persisting scars across visits.

## Amendment 2026-10-01 — after the phase-2 live look (author decisions)

The first live render of phase 2 showed the transmuted liquid as a black glass ball. The author decided:

1. **The aether is reflected.** "Liquid metal wrapped in an alchemical aether": the aether surrounds the planet on every side, including the camera side we never see. The mirror reflects it as 8 analytic soft lobes coloured by the live element flows. Still no cubemap, no PMREM. This supersedes "reflects only the Sun, the four elements, and black space".
2. **Night side** is a cold, deep, low-luminance silver/indigo: the aether attenuated on the night hemisphere via the surface normal's Sun-facing. Clearly darker than day, never black glass. This supersedes "night side stays near-black".
3. **Element reflections** are widened so the elements wash broad tints across the liquid, not grazing rims.
4. **Boiling Sun glint:** a broad bright sheen in the boil zone that tightens to a pinpoint as the surface cools (brighter true Sun radiance + a soft highlight shoulder; the lobe already conserves energy).
5. **Linger** ~40 s, even after a hard spin (heat store capped). This supersedes "~30–60 s".
