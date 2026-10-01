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

// Quicksilver (spec §3, §5 shading 3). Physical-ish; baked via glf.
export const HG_F0 = [0.76, 0.77, 0.78];      // liquid Hg normal-incidence reflectance, near-neutral
export const ROUGH_LIQUID = 0.14;             // never lower: a sharper mirror of black space is black glass
export const ROUGH_BOIL = 0.4;                // boiling breaks the mirror's coherence
export const SOLID_HG_ALBEDO = [0.52, 0.53, 0.55]; // frozen Hg: matte crystalline silver (linear)
export const SPARKLE_CELLS = 700;             // facet cells around the equator
export const SPARKLE_DENSITY = 0.004;         // fraction of facets that can glint
export const SPARKLE_COS = 0.97;              // glint lobe: reflection within ~14° of the Sun
export const SPARKLE_GAIN = 3;
export const EMIT_RADIUS = 0.5;               // scene units — each element reflects as a soft area light
export const EMIT_MIN_SIN = 0.6;              // element reflections ≥ ~37° wide: they wash the liquid, not rim it
export const EMIT_HORIZON_SOFT = 0.1;         // an element below the local horizon is not reflected
export const SUN_SHOULDER = 3;                // linear; the Sun term rolls off softly instead of clipping
// The aether (spec amendment 2026-10-01): soft lobes wrapping the planet on every side.
export const AETHER_NIGHT = 0.2;              // aether strength left on the night hemisphere
export const AETHER_DAY_LO = -0.15;           // dot(normal, Sun) where the night attenuation is full…
export const AETHER_DAY_HI = 0.25;            // …and where full day strength is reached
export const AETHER_DIFFUSE = 0.35;           // frozen Hg's matte response to the aether
export const NIGHT_TINT = [0.62, 0.68, 1.0];  // cold indigo cast on the night side's aether
export const FRONT_EDGE = 0.12;               // transmutation front noise amplitude (in front units)
export const FRONT_SOFT = 0.03;               // front edge softness; must stay < FRONT_EDGE / 2
export const FRONT_NOISE_FREQ = 6;
export const PHASE_BLEND_K = 8;               // K either side of melt/boil for the phase blend

export const CAMERA_DIST = { desktop: 3.6, mobile: 4.6 };

export const PLANET_TUNE = {
  exposure: 2.2,     // Sun irradiance multiplier at mean distance
  relief: 12,        // DEM vertical exaggeration (normals + shadows)
  nightFloor: 0.006, // faint albedo floor so the night limb is not a hole
  sunGlint: 120,     // liquid mirror: Sun-disc radiance gain (soft-shouldered; boil sheen ≈ 1, cooled pinpoint saturates)
  emitGain: 1.5,     // liquid mirror: element-emitter reflection gain
  aetherGain: 1.0,   // liquid mirror + frozen ambient: aether envelope gain
  aetherSinW: 0.68,  // aether lobe width (sin of the angular radius); lower = tighter lobes, darker gaps between them
  aetherSilver: 0,   // 0 = lobes carry full aether colour; 1 = neutral silver (luminance only); between = tinted silver
};
