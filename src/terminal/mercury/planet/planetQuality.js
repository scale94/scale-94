// src/terminal/mercury/planet/planetQuality.js — what each device class can afford
// (phase-4 spec §3). A tier is a shader variant (its loop counts are compile-time
// consts) plus a DPR cap. Fixed per device class, never switched at runtime (D3);
// ?tier= overrides it for HUD sessions. The phone column is set from the author's
// phone HUD (checkpoint 1), not guessed.
// popRefTh is the pop rings' scale (mercuryRoil), a LOOK axis, not a cost: the boil cap sits
// PHASE_ANGLE_DEG off the view centre, foreshortened, and rings resolve only while
// WAVE_K_PEAK·pxArc·popScale ≲ 2π/5. full keeps POP_REF_TH (pxArc ≈ 0.0039 at 1920×1080 DPR 2);
// the phone halves it for its subsolar pxArc ≈ 0.0094–0.0102 (fewer, coarser crests); lite draws
// noise, not pops, and takes the phone's value so the column stays non-increasing.

import { SHADOW_STEPS } from './planetLook';
import { IMPULSE_SLOTS } from './mercuryWaves';
import { POP_REF_TH } from './mercuryRoil';

export const TIERS = Object.freeze({
  full: Object.freeze({ dprMax: 2, rippleSlots: IMPULSE_SLOTS, shadowSteps: SHADOW_STEPS, roil: 'pops', exoSteps: 16, popRefTh: POP_REF_TH }),
  phone: Object.freeze({ dprMax: 1.5, rippleSlots: 4, shadowSteps: 6, roil: 'pops', exoSteps: 8, popRefTh: 0.125 }),
  lite: Object.freeze({ dprMax: 1, rippleSlots: 2, shadowSteps: 0, roil: 'noise', exoSteps: 0, popRefTh: 0.125 }),
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
export const perfHudOn = (search = '') => param(search, 'perf') === '1';

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
