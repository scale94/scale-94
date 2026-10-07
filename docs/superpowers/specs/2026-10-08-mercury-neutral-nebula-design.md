# Mercury neutral nebula — design (2026-10-08)

Branch: `feature/mercury-stage` (local, not pushed). Builds on neutral state A (`819877ac` studio sky, option B).

## 0. Decision and scope

The author asked for a colourless procedural nebula as the resting mirror's environment, **as a live switch beside the
studio** (option B, ruled 2026-10-07), not a replacement. One switch, `PLANET_TUNE.neutralNebula`:

- `0` — studio (default until the author rules; today's look, byte-identical shader output);
- `1` — nebula;
- between — a linear mix of both (both evaluated only while strictly between 0 and 1).

The element skies (fluid, thermal, earth, air), the `uSkyW` crossfade, the Hg Fresnel, roughness and the shoulder are
**unchanged**. Hue enters only with an element's sky, as today.

Out of scope: tuning Fresnel (`fresnelHg` stays the exact conductor Fresnel, F0 ≈ 0.78 neutral; Schlick at 0.92 would
be silver, not Hg), changing `ROUGH_LIQUID` (0.14), a visible background nebula behind the planet, internal nebula
evolution (rigid drift only — see §6).

## 1. Diagnosis (why the current rest state reads flat)

From `out/nsky-1.png` (studio, `819877ac`):

1. **No midtones.** ~85 % of directions are `NEUTRAL_SKY_FLOOR` 0.004: most of the ball mirrors black and reads as black
   glass with decals. A mirror's gunmetal is the sky's 0.02–0.15 band; the studio has none.
2. **No peaks.** Brightest sky ≈ 0.3 × aetherGain 1.4 × F0 0.78 ≈ 0.33 linear: light grey. Only the Sun glint reaches
   white, so the dynamic range is grey-on-black.
3. **Surface tension is invisible.** Capillary ripples only show where a strip crosses them.
4. **The earlier grey cloud failed on the opposite histogram** (uniform mid-grey ⇒ a 0.14-rough mirror reads matte).
   Both failures are a luminance-histogram problem, so the nebula is specified by histogram targets (§3), not by look
   words alone.

## 2. Architecture

```
nebulaSky.js
  NEBULA_GEN_GLSL       skyNebulaGen(vec3 D) — the analytic generator (bake-time only, never in the frame loop)
  bakeNebula(renderer)  → THREE.WebGLCubeRenderTarget (256²/face, HalfFloat, mipmapped, LinearMipmapLinear)
                          via CubeCamera + a BackSide sphere carrying the generator material; disposed with the planet
  NEBULA_* constants, NEBULA_MEAN (measured, §5)

aetherSky.js  skyNeutral(R, k) = mix(skyStudio(R), skyNebula(R, k), uNeutralNebula)   (studio = today's skyNeutral body)
              skyNebula(R, k) = textureLod(uNebulaMap, uNebulaRot * R, k * NEBULA_MAX_LOD).rgb
              SKY_MEAN_NEUTRAL → mix(studio mean, NEBULA_MEAN, uNeutralNebula)
hgMirrorGlsl.js  HG_MIRROR_UNIFORMS += 'uNeutralNebula', 'uNebulaRot', 'uNebulaMap' (+ decls)
MercuryPlanet.jsx  bake at mount; upload uNeutralNebula from PLANET_TUNE; uNebulaRot = nebulaRotation(uSkyT): a rigid turn about +Y at the
                   studio's NEUTRAL_SKY_DRIFT (no tilt: the view axis is +Z already)
```

The four shaders that use the mirror chunk (planet, droplets, beads, visitors) share the planet's uniform objects by
reference (`HG_MIRROR_UNIFORMS` loop), so the map and switch reach all of them with no per-field wiring.

**Why bake, not per-fragment noise.** A domain-warped ridged fBm is ~9 noise evaluations (~70 hashes) per fragment in
four shaders, paid every frame of the rest state, on top of the unmeasured air-warp cost. The bake costs one
`textureLod` per fragment, its mip chain gives the rough mirrors (frost, crust, quench) a correctly blurred nebula
instead of fading to a flat mean, and mip filtering stops the limb (where dR/dpixel explodes) from shimmering, which
analytic noise would alias. Hybrid per-fragment hot spots are held back: add only if the look round finds 256² cores
too soft.

**Branch cost.** `uNeutralNebula` is a uniform, so `if` on it is coherent. At 0 the nebula fetch is skipped; at 1 the
studio is skipped; `wN ≤ SKY_W_MIN` (an element up) skips both, as today.

**Unsupported half-float render targets** (`EXT_color_buffer_half_float` / `EXT_color_buffer_float` absent): no bake,
`neutralNebula` is forced to 0 with one `console.warn`. No RGBM fallback (YAGNI until a real device needs it).

## 3. The generator (`skyNebulaGen`, colourless, linear radiance)

Three layers, starting values for the look round:

| layer | form | radiance | target share of solid angle |
|---|---|---|---|
| **void** | low-freq fBm (3 oct, scale ~1.3) through `smoothstep(0.42, 0.62, ·)` → density mask `m` | `m` gates everything | **≥ 50 % below 0.005** |
| **wisps** | ridged fBm `pow(1 − |2n − 1|, 6)`, 4 oct, scale ~3, domain-warped by a 3-oct fBm vector (amp ~1.2) | `m · (0.02 + 0.13 · ridge)` | ~35 % in 0.02–0.15 |
| **hot spots** | cell hash on the direction grid (~40 cells/rad), 1 in ~60 cells lit, Gaussian core σ ≈ 1.5 texels, plus a soft halo 6× wider at 2 % | peak 3–8 (into the shoulder → white via `AETHER_PATH_WHITE`), biased into `m` | ~0.3 % above 1 |

Floor 0.002 outside `m` (darker than the studio's 0.004: the voids are obsidian). Peak/median ≥ 300:1.
Mean target ≈ the studio's analytic mean (~0.027) so the frozen-Hg and frost ambient (`SKY_MEAN`) does not shift
between modes; if the look round wants a different mean, re-measure and say so.

## 4. Motion

Rigid rotation only: `uNebulaRot = nebulaRotation(uSkyT)` at `NEUTRAL_SKY_DRIFT` = 0.02 rad/s (the studio's
rate), on the calm-gated sky clock (calm freezes it, as today). A mat3 per frame on the CPU; no trig in the fragment.

## 5. Verification

- **Unit (vitest):** studio path unchanged — the `planetShader.*.fs.glsl` snapshots change only by the added
  declarations and the `skyNeutral` mix (reviewed diff, then re-pin); `HG_MIRROR_UNIFORMS` lists the three new names and
  every decl line is a PLANET_FS line (existing test); the rotation helper is orthonormal and frozen at `uSkyT` const.
- **Bake measurement (CDP tool `.superpowers/sdd/tools/nebula-hist.mjs`):** read back the six faces, solid-angle-weight
  the texels, report: share < 0.005, share in 0.02–0.15, share > 1, mean, peak/median. Gate: the §3 targets. Writes
  `NEBULA_MEAN` (as `ms-mean.mjs` did for the element skies).
- **Look sheet (`neutral-nebula-sheet.mjs`):** studio | nebula | 0.5 mix, at rest and right after a melt (ripples on),
  plus a frozen planet (rough mip path). For the author's ruling; the switch stays at 0 until then.
- **Compile:** 0 shader errors in all four materials in both modes (live `m.errors()`).
- **Phone gate (before any push):** 60 fps at the rest state with `neutralNebula` 1 vs 0 on real hardware; bake time at
  mount logged.

## 6. Open / author calls

- Default mode after the look sheet (studio stays default until ruled).
- Internal nebula evolution (re-bake slices + crossfade) is deferred; rigid drift may be enough because nothing on the
  stage shows the neutral sky directly to compare against.
- Face size 256 vs 512 if the cores read soft on desktop at full stage size (512 = 4× memory, still one fetch).
