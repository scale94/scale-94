// src/terminal/mercury/planet/planetLook.js — the planet's constants.
//
// Physical/structural constants are baked into the shader via glf().
// PLANET_TUNE values are HYPOTHESES until the author tunes them live
// (__mercuryTune.planet.exposure = …) and exports; they reach the shader as
// uniforms re-read every frame, so pokes are authoritative.

export const R_SCENE = 0.75;            // scene units — unchanged from the old sphere
export const R_MERCURY_M = 2439400;     // USGS DEM datum radius
export const MEAN_R_AU = 0.387098;      // semi-major axis; irradiance = (MEAN_R_AU / r)^2

// Cast crater shadows: a short heightfield march toward the Sun near the terminator.
export const SHADOW_STEPS = 12;
export const SHADOW_REACH_RAD = 0.03;   // ~73 km of arc
export const SHADOW_SOFT_M = 300;       // edge softness in TRUE metres (the shader multiplies by uRelief)
export const SHADOW_SOFT_LSB = 1.5;   // softness floor in DEM quantisation steps (true metres, before relief)
export const SHADOW_BIAS_LSB = 1.0;   // march bias against quantisation acne, in DEM steps
export const SHADOW_ZONE = 0.35;        // only march where the Sun is lower than ~20°

export const FALLBACK_ALBEDO = [0.16, 0.15, 0.14]; // linear; true-colour grey-brown until maps load
export const RAY_ALBEDO = [0.42, 0.4, 0.38];  // fresh ejecta (linear): immature regolith is ~2.5× the background

// Quicksilver (spec §3, §5 shading 3). Physical-ish; baked via glf.
export { HG_F0 } from './hgOptics';          // liquid Hg normal-incidence reflectance (≈ 0.78, neutral), from n + ik
export const ROUGH_LIQUID = 0.14;             // PLANET_TUNE.roughLiquid's default; below it a sharper mirror of black space reads as black glass
export const ROUGH_BOIL = 0.4;                // boiling breaks the mirror's coherence
export const SOLID_HG_ALBEDO = [0.52, 0.53, 0.55]; // frozen Hg: its sunlit diffuse (linear); the aether reaches it as a rough mirror (ROUGH_SOLID)
export const SPARKLE_CELLS = 700;             // facet cells around the equator
export const SPARKLE_DENSITY = 0.004;         // fraction of facets that can glint
export const SPARKLE_COS = 0.97;              // glint lobe: reflection within ~14° of the Sun
export const SPARKLE_GAIN = 3;
export const EMIT_RADIUS = 0.15;              // scene units — each element reflects as a compact source at its true apparent size
export const EMIT_MIN_SIN = 0.05;             // only keeps the lobe resolvable; was 0.6 (≥ 37°): a warm reflector-card wash
export const EMIT_HORIZON_SOFT = 0.1;         // an element below the local horizon is not reflected
export const SUN_SHOULDER = 3;                // linear; the Sun term rolls off softly instead of clipping
// The aether (spec amendment 2026-10-01): the moving element sky wrapping the planet on every side (aetherSky.js, 2026-10-05).
export const AETHER_NIGHT = 0.2;              // aether strength left on the night hemisphere
export const AETHER_DAY_LO = -0.15;           // dot(normal, Sun) where the night attenuation is full…
export const AETHER_DAY_HI = 0.25;            // …and where full day strength is reached
export const ROUGH_SOLID = 0.55;             // frozen Hg mirror roughness: polycrystalline, so the aether blurs into soft cold glows
export const SOLID_HG_SPECULAR = 0.5;         // frozen Hg reflects at this share of the liquid's Fresnel (grain boundaries scatter the rest)
export const NIGHT_TINT = [0.45, 0.58, 1.0];  // cold cast on the night side's aether: warm gas sinks to indigo / deep violet / dark cyan
export const AETHER_SHOULDER = 1;              // knee of the hue-preserving roll-off (Fresnel ≤ 1, so the display never clips a channel)
export const AETHER_PATH_WHITE = 0.3;          // how far the hottest sky structure pales toward white (0: pure hue; the old softbox core was ~1)
export const FRONT_EDGE = 0.12;               // transmutation front noise amplitude (in front units)
export const FRONT_SOFT = 0.03;               // front edge softness; must stay < FRONT_EDGE / 2
export const FRONT_NOISE_FREQ = 6;
export const PHASE_BLEND_K = 8;               // K either side of melt/boil for the phase blend

export const CAMERA_DIST = { desktop: 3.6, mobile: 4.6 };
export const CAMERA_FOV_DEG = { desktop: 42, mobile: 48 }; // vertical (three)

export const PLANET_TUNE = {
  exposure: 2.2,     // Sun irradiance multiplier at mean distance
  relief: 12,        // DEM vertical exaggeration (normals + shadows)
  nightFloor: 0.006, // faint albedo floor so the night limb is not a hole
  sunGlint: 120,     // liquid mirror: Sun-disc radiance gain (soft-shouldered; boil sheen ≈ 1, cooled pinpoint saturates)
  beadGlint: 4,      // droplets and the beads' resolved Sun lobe: × sunGlint; with the droplet glint AA, a crisp 2 px sparkle on the small beads
  beadSparkle: 1.0,  // Hg aether beads (hgBeadShader): peak of the guaranteed sub-pixel Sun glint, sRGB units before the 1.5 cap
  dustSparkle: 3.0,  // Hg glitter dust: peak of the wobble-gated glint × size weight (biggest specks ≈ 2.3 after Hg Fresnel), sRGB units before DUST_GLINT_MAX 3
  emitGain: 1.5,     // liquid mirror: element-emitter reflection gain
  aetherGain: 1.4,   // liquid mirror + frozen ambient: aether sky gain (re-tuned in the mirror-sky look round)
  aetherSilver: 0,   // desaturation toward silver (0: the mirror shows the gas at its own hue, 2026-10-03)
  neutralSky: 1,     // resting-mirror silver sky gain (0 = the quiet black mirror); author ruling 2026-10-07: on by default
  studioCrisp: 1,     // chrome studio (author 2026-10-08): hard-edged reflectors + razor horizon (0 = the soft look)
  studioKey: 4,       // reflector gain: over-unity (> ~2.4 passes the shoulder knee)
  studioSoftbox: 2,   // overhead softbox radiance (× aetherGain 1.4 ≈ 2.8 HDR): the chrome crown
  studioDome: 0,      // smooth ambient dome: OFF (author 2026-10-08: it read as grey clay in motion)
  neutralNebula: 0,  // resting mirror: 0 = studio (option B, ruled 2026-10-07), 1 = baked neutral nebula, between = mix (spec 2026-10-08)
  aetherFloor: 0.2,     // lit element flows never fall below this × their colour (umbra, worst phase) — aetherLight.js
  aetherPenumbra: 0.08, // half-width of the planet shadow cylinder's soft edge, scene units (planet radius 0.75)
  streakGain: 0.05,  // filament shutter (s): length beyond the core = on-screen speed × this; fluid ~355 px/s → ~9× width (live sweep 2026-10-06)
  filWidth: 2.2,     // filament core width, CSS px at GAS_Z_REF (× the pixel ratio; ±25 % per particle, floored at GAS_PX_FLOOR)
  filAlpha: 4,       // filament alpha × this, on the element's own per-particle alpha (fire embers: × FIRE_EMBER_GAIN too)
  fogAlpha: 0.7,     // fog role (the old sprite, the old count) alpha × this: dimmer, so the additive threads read (look 2026-10-06)
  maskFreq: 2.5,     // lane mask frequency in the flows' label space
  maskSharp: 3,      // lane ridge sharpness (higher = thinner filaments)
  maskDepth: 0.3,    // filaments only: 0 = no mask, 1 = everything off-ridge is carved away (threads: a light along-lane breath)
  airFilGain: 3,     // air filaments only: extra alpha × this on top of filAlpha (air threads read faint in the fog; Task 7e)
  filHalo: 2.5,      // soft threads §1: filament quad width × this (the Gaussian tail; length caps stay on the core width)
  filEdgeDesat: 0.45, // §4: filament edges fall toward their own luminance by this
  filCoreLift: 0.15,  // §4: filament core lifts toward white by this
  filWidthVar: 0.35, // §2: a pinched stretch draws at (1 - this) × the core width (alpha ÷ the factor: light conserved)
  filWarp: 1,        // §3: path domain-warp amplitude × this (per-flow amplitude FLUID_FIL_WARP / AIR_FIL_WARP)
  filFray: 0.5,      // §2: a frayed stretch draws at (1 + this) × the core width (author 2026-10-07: 2 beaded the threads; the fog carries the body)
  emberSize: 1.75,   // fire embers only: width × this (the body untouched; stretch cap FIRE_EMBER_STRETCH kept; Task 8b)
  emberGain: 1.75,   // fire embers only: alpha × this on top of filAlpha × FIRE_EMBER_GAIN (Task 8b)
  earthStreakGain: 5, // earth filaments only: shutter × this; settling dust ~32 px/s p50 → aspect p50 ~4.8 (was 1.75); cap FIL_ASPECT; Task 8b
  rayGain: 1.5,      // fresh crater-ray brightness (scar map G channel); 1.5 tuned 2026-10-02 (Task 7: 2+ flattens rays into a blob)
  modeGain: 1,       // body-mode + spin-bulge amplitude (the bead's wobble)
  waveGain: 1,       // capillary ripple slope
  roilGain: 1,       // boil-zone bubble-pop slope (mercuryRoil.POP_AMP × this)
  exoGain: 4,        // sodium tail + Hg vapour haze brightness
  roughLiquid: ROUGH_LIQUID, // liquid mirror roughness (Sun + emitter lobes; the aether sky keeps full detail up to SKY_ROUGH_SHARP)
  meniscus: 1,       // melt-front bead rim: 0 = the old soft wipe, 1 = full non-wetting rim (mercuryMeniscus.js)
  meniscusW: 0.02,   // rim width in radians of arc (floored at MENISCUS_MIN_PX on screen)
  breakOmega: 7.5,   // phase 5: breakup threshold, rad/s on screen (Σ ≈ 0.20 there; the true fission branch is ~11.5)
  breakGain: 1,      // tongue length at full excess, × TONGUE_MAX_R
  dropDrag: 8,       // aether drag γ on flying drops, 1/s (sets how far a fling travels)
  dropCohesion: 0.1,  // bead–bead pull (units³/s² per DROP_V_REF of volume): how readily drops find each other
  dropDrift: 14,     // wished return time, s (capped by refreeze − MERGE_MARGIN_S; the pull is solved to meet it)
  hyperOrbit: 3,     // phase 6: orbital period at the old surface, s: sets the pull, so the turns of the disc (V4: 3 passes the gate)
};
