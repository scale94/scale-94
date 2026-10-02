// src/terminal/mercury/planet/planetQuality.js — what each device class can afford
// (phase-4 spec §3). A tier is a shader variant (its loop counts are compile-time
// consts) plus a DPR cap. Fixed per device class, never switched at runtime (D3);
// ?tier= overrides it for HUD sessions. The phone column is set from the author's
// phone HUD (checkpoint 1), not guessed.
// drop: the phase-5 droplet field's caps (spec §7.7).
// The pop rings' size is not a tier axis: it depends on the live canvas, not the device class,
// so MercuryPlanet sizes it from the screen (mercuryRoil.popZoom → uPopZoom) on mount and resize.

import { SHADOW_STEPS } from './planetLook';
import { IMPULSE_SLOTS, SHAPE_ITERS } from './mercuryWaves';

export const TIERS = Object.freeze({
  full: Object.freeze({ dprMax: 2, rippleSlots: IMPULSE_SLOTS, shadowSteps: SHADOW_STEPS, roil: 'pops', exoSteps: 16, shapeIters: SHAPE_ITERS, drop: Object.freeze({ bodies: 12, necks: 10, bridges: 12, steps: 48, satellites: true }) }),
  // Measured 2026-10-01 OnePlus 9 Pro (Adreno 660), canvas 492x450 DPR 1.5: drag p50 55-67 / p95 115-130 ms.
  // Root cause was not this tier: 4 hidden transmission-glass meshes drew the scene 9x per frame
  // (removed 56a241a9; author 2026-10-02: "locked at 60 fps"). The interim cut (shapeIters 1,
  // rippleSlots 2) is restored to full liquid detail; re-measure pending.
  phone: Object.freeze({ dprMax: 1.5, rippleSlots: 4, shadowSteps: 6, roil: 'pops', exoSteps: 8, shapeIters: SHAPE_ITERS, drop: Object.freeze({ bodies: 8, necks: 6, bridges: 8, steps: 32, satellites: true }) }),
  lite: Object.freeze({ dprMax: 1, rippleSlots: 2, shadowSteps: 0, roil: 'noise', exoSteps: 0, shapeIters: 1, drop: Object.freeze({ bodies: 6, necks: 4, bridges: 6, steps: 24, satellites: false }) }),
});
export const TIER_NAMES = Object.keys(TIERS);

function param(search, key) {
  try { return new URLSearchParams(search ?? '').get(key); } catch { return null; }
}

export function pickTier({ isMobile = false, search = '' } = {}) {
  const forced = param(search, 'tier');
  if (forced && Object.hasOwn(TIERS, forced)) return forced;
  return isMobile ? 'phone' : 'full';
}

export const calmOverride = (search = '') => param(search, 'calm') === '1';
// ?perf=1 samples and writes the overlay at 4 Hz; ?perf=2 samples the same but writes once per 2 s
// (to compare hitch rates with the HUD's own DOM write mostly removed).
export const perfHudMode = (search = '') => {
  const v = param(search, 'perf');
  return v === '1' ? 1 : v === '2' ? 2 : 0;
};
export const perfHudOn = (search = '') => perfHudMode(search) > 0;

function slotStrength(frame, i) {
  return Math.abs(frame.mode[3 * i]) + Math.abs(frame.mode[3 * i + 1]) + Math.abs(frame.mode[3 * i + 2])
    + Math.abs(frame.wave[2 * i + 1]);
}

// Impulse slots ordered strongest first, so a tier whose shader draws only k slots
// draws the k that show. Stable insertion sort into a preallocated out; allocates nothing.
export function impulseOrder(frame, n, out) {
  for (let i = 0; i < n; i++) {
    const s = slotStrength(frame, i);
    let j = i;
    while (j > 0 && slotStrength(frame, out[j - 1]) < s) { out[j] = out[j - 1]; j--; }
    out[j] = i;
  }
  return out;
}
