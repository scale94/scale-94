// src/terminal/mercury/mercuryTuning.js — the live console tuning rig.
//
// TUNE is the single source of truth for the elemental mirror's tunable
// constants. Production reads it exactly like the old hard-coded literals
// (the values below ARE the shipped constants); the dev-only console rig
// mutates it and the env re-reads it every frame, so pokes are authoritative
// and never fight the frame loop.
//
// Dev console usage (rig registers only when import.meta.env.DEV):
//   __mercuryTune.set('chromaGain', 0.8)     // element loudness in the world
//   __mercuryTune.set('duckActive', 0.03)    // cloud parting depth
//   __mercuryTune.elements.thermal.horizonHeight = 0.1  // per-element data, live
//   __mercuryTune.get()                      // current values
//   __mercuryTune.export()                   // formatted block to hand to Sophie

import { ELEMENTS, NEUTRAL_NIGHT } from './elements';

export const TUNE = {
  // MercuryEnvironment fragment-shader gains (fed to uniforms per frame)
  chromaGain:   0.6,   // element chroma riding the horizon band — 0.85 blows the idle
                       // drop into a glowing lamp (CDP-verified); metal dies past ~0.7
  floorGain:    1.15,  // multiplier on the never-drains luminance floor vec3(0.065,0.065,0.100)
  stratumGain:  0.12,  // below-horizon ground glow
  blobGain:     1.0,   // multiplier on the two element blobs (b1 0.25, b3 0.15)
  moonGain:     1.4,   // multiplier on the HDR moon disc + halo — crisp specular landmark
  breatheSpeed: 0.35,
  breatheAmp:   0.12,
  horizonLift:  0.0,   // global offset added to the per-element horizonHeight

  // usePhaseTransition cloud parting (the clouds part for the mirror).
  // Geometry (condensation) does the clearing now; opacity is an accent —
  // per-sprite alpha fights overlap logarithmically (coverage ~ 1-(1-a)^N)
  // and can never empty the sky alone.
  duckActive:   0.10,  // active phase's cloud opacity during the beats
  duckGhost:    0.03,  // ghost phases' opacity during the beats

  // Nebula condensation (the breath): pos *= 1 - c^2 in the flow shaders.
  condenseBite:     1.0,  // max contraction; 0 disables live from the rig
  condenseSizeBite: 0.6,  // sprite slimming en route into the drop
};

const KNOBS = Object.keys(TUNE);

// Called from MercuryEnvironment (dev only). Idempotent; re-registers on HMR.
export function registerTuningRig() {
  if (typeof window === 'undefined') return;
  window.__mercuryTune = {
    set(knob, value) {
      if (!KNOBS.includes(knob)) return `unknown knob — one of: ${KNOBS.join(', ')}`;
      TUNE[knob] = value;
      return `${knob} = ${value}`;
    },
    get: () => ({ ...TUNE }),
    // Per-element data (horizonHeight, color hex) — live, resolveEnvState
    // re-reads it every frame. Color pokes take effect on next transition
    // blend or immediately at idle.
    elements: ELEMENTS,
    neutral: NEUTRAL_NIGHT,
    export() {
      const lines = KNOBS.map(k => `  ${k}: ${JSON.stringify(TUNE[k])},`).join('\n');
      const els = Object.entries(ELEMENTS)
        .map(([p, e]) => `  ${p}: { element: '${e.element}', color: '${e.color}', horizonHeight: ${e.horizonHeight} },`)
        .join('\n');
      const block = `--- COMMITTED CONSTANTS (hand this block to Sophie) ---\n` +
        `TUNE = {\n${lines}\n}\n` +
        `ELEMENTS = {\n${els}\n}\n` +
        `NEUTRAL_NIGHT.color = '${NEUTRAL_NIGHT.color}'`;
      console.log(block);
      return block;
    },
  };
}
