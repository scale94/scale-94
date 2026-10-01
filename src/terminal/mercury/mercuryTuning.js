// src/terminal/mercury/mercuryTuning.js — the live console tuning rig.
//
// TUNE holds the cloud-parting and condensation knobs. The planet's look knobs,
// the aether included, are PLANET_TUNE. Nothing reads an environment any more:
// the dev-only console rig mutates these objects and the frame loop re-reads
// them every frame, so pokes are authoritative and never fight it.
//
// Dev console usage (rig registers only when import.meta.env.DEV):
//   __mercuryTune.set('duckActive', 0.08)     // cloud parting depth
//   __mercuryTune.planet.relief = 8               // planet look, live
//   __mercuryTune.elements.thermal.horizonHeight = 0.1  // per-element data, live
//   __mercuryTune.get()                      // current values
//   __mercuryTune.export()                   // formatted block to hand to Sophie

import { ELEMENTS, NEUTRAL_NIGHT } from './elements';
import { PLANET_TUNE } from './planet/planetLook';

export const TUNE = {
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

// Dev-only overrides the frame loop reads (probes): a fixed instant for the ephemeris.
export const DEV_OVERRIDES = { dateMs: null };

const KNOBS = Object.keys(TUNE);

// Called from MercuryPlanet (dev only). Idempotent; re-registers on HMR.
export function registerTuningRig() {
  if (typeof window === 'undefined') return;
  window.__mercuryTune = {
    set(knob, value) {
      if (!KNOBS.includes(knob)) return `unknown knob — one of: ${KNOBS.join(', ')}`;
      TUNE[knob] = value;
      return `${knob} = ${value}`;
    },
    // Pin the ephemeris to an instant (ms since epoch), or null for now. Probes sweep the tail with it.
    dateOverride(ms) { DEV_OVERRIDES.dateMs = ms ?? null; return `date = ${ms == null ? 'now' : new Date(ms).toISOString()}`; },
    get: () => ({ ...TUNE }),
    // Per-element data (horizonHeight, color hex). Poking element colours does
    // not reach the mirror: EMIT_COLORS is captured at load.
    elements: ELEMENTS,
    neutral: NEUTRAL_NIGHT,
    // Planet look (aether knobs included) — live, MercuryPlanet re-reads it every frame.
    planet: PLANET_TUNE,
    export() {
      const lines = KNOBS.map(k => `  ${k}: ${JSON.stringify(TUNE[k])},`).join('\n');
      const els = Object.entries(ELEMENTS)
        .map(([p, e]) => `  ${p}: { element: '${e.element}', color: '${e.color}', horizonHeight: ${e.horizonHeight} },`)
        .join('\n');
      const planet = Object.entries(PLANET_TUNE)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
      const block = `--- COMMITTED CONSTANTS (hand this block to Sophie) ---\n` +
        `TUNE = {\n${lines}\n}\n` +
        `ELEMENTS = {\n${els}\n}\n` +
        `NEUTRAL_NIGHT.color = '${NEUTRAL_NIGHT.color}'\n` +
        `PLANET_TUNE = {\n${planet}\n}`;
      console.log(block);
      return block;
    },
  };
}
