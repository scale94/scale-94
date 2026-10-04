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
// The aether (spec amendment 2026-10-01): soft lobes wrapping the planet on every side.
export const AETHER_NIGHT = 0.2;              // aether strength left on the night hemisphere
export const AETHER_DAY_LO = -0.15;           // dot(normal, Sun) where the night attenuation is full…
export const AETHER_DAY_HI = 0.25;            // …and where full day strength is reached
export const ROUGH_SOLID = 0.55;             // frozen Hg mirror roughness: polycrystalline, so the aether blurs into soft cold glows
export const SOLID_HG_SPECULAR = 0.5;         // frozen Hg reflects at this share of the liquid's Fresnel (grain boundaries scatter the rest)
export const NIGHT_TINT = [0.45, 0.58, 1.0];  // cold cast on the night side's aether: warm gas sinks to indigo / deep violet / dark cyan
export const AETHER_FRINGE_LO = 0.25;          // streak d² where the bright core starts giving way to the fringe…
export const AETHER_FRINGE_HI = 0.9;           // …and where the fringe is full aether colour
export const AETHER_SHOULDER = 1;              // knee of the hue-preserving roll-off (Fresnel ≤ 1, so the display never clips a channel)
export const AETHER_PATH_WHITE = 0.3;          // how far the hottest streak core pales toward white (0: pure hue; the old softbox core was ~1)
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
  emitGain: 1.5,     // liquid mirror: element-emitter reflection gain
  aetherGain: 1.4,   // liquid mirror + frozen ambient: aether envelope gain
  aetherSinW: 0.22,  // aether streak half-width across the flow (sin); lower = thinner streaks, more dark between
  aetherSilver: 0,   // desaturation toward silver (0: the mirror shows the gas at its own hue, 2026-10-03)
  aetherEdge: 2,     // streak profile exponent: 1 = soft Gaussian; higher = flatter core, more abrupt meniscus edge (3 read as flat stickers)
  aetherStretch: 1,  // 0 = round lobes; 1 = each streak at its own elongation (AETHER_SHAPES)
  aetherCurve: 2.5,  // falloff inside a streak: 0 = flat; higher = brighter centre, dimmer toward the meniscus edge (the volume)
  aetherCore: 3,     // streak core brightness × its own hue, into the hue-preserving roll-off + AETHER_PATH_WHITE
  aetherFloor: 0.2,     // lit element flows never fall below this × their colour (umbra, worst phase) — aetherLight.js
  aetherPenumbra: 0.08, // half-width of the planet shadow cylinder's soft edge, scene units (planet radius 0.75)
  rayGain: 1.5,      // fresh crater-ray brightness (scar map G channel); 1.5 tuned 2026-10-02 (Task 7: 2+ flattens rays into a blob)
  modeGain: 1,       // body-mode + spin-bulge amplitude (the bead's wobble)
  waveGain: 1,       // capillary ripple slope
  roilGain: 1,       // boil-zone bubble-pop slope (mercuryRoil.POP_AMP × this)
  exoGain: 4,        // sodium tail + Hg vapour haze brightness
  roughLiquid: ROUGH_LIQUID, // liquid mirror roughness (Sun + emitter lobes; the aether streaks are ~insensitive to it)
  meniscus: 1,       // melt-front bead rim: 0 = the old soft wipe, 1 = full non-wetting rim (mercuryMeniscus.js)
  meniscusW: 0.02,   // rim width in radians of arc (floored at MENISCUS_MIN_PX on screen)
  breakOmega: 7.5,   // phase 5: breakup threshold, rad/s on screen (Σ ≈ 0.20 there; the true fission branch is ~11.5)
  breakGain: 1,      // tongue length at full excess, × TONGUE_MAX_R
  dropDrag: 8,       // aether drag γ on flying drops, 1/s (sets how far a fling travels)
  dropCohesion: 0.1,  // bead–bead pull (units³/s² per DROP_V_REF of volume): how readily drops find each other
  dropDrift: 14,     // wished return time, s (capped by refreeze − MERGE_MARGIN_S; the pull is solved to meet it)
  hyperOrbit: 3,     // phase 6: orbital period at the old surface, s: sets the pull, so the turns of the disc (V4: 3 passes the gate)
};
