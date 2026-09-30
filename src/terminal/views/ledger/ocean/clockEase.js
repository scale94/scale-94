// clockEase.js — the seal's clock ease (spec §4 Seal). While AuditCascade
// runs, the ocean eases to a near-stop; after the flare it eases back. The
// factor is a smoothstep in WALL time, and the driver is fed its exact mean
// over each frame's interval (closed-form integral), so 60 Hz and 360 Hz
// frames accumulate identical simulated time. Nothing is frame-counted.

export const SEAL_EASE_MS = 600;
export const HOLD_FACTOR = 0.02;    // of the chosen compression: 9 d/s → 0.18 d/s
export const SEAL_FLARE_MS = 1200;  // wall time for the flare, site → mouth

const S1 = 0.5; // ∫₀¹ smoothstep

export function createClockEase({ durationMs = SEAL_EASE_MS, floor = HOLD_FACTOR } = {}) {
  let from = 1;
  let to = 1;
  let t0 = 0;
  let isHeld = false;
  const x = (t) => Math.min(1, Math.max(0, (t - t0) / durationMs));
  const value = (t) => (from === to ? to : from + (to - from) * x(t) * x(t) * (3 - 2 * x(t)));
  // G(t) = ∫_{t0}^{t} smoothstep(x(τ)) dτ, 0 before t0.
  const G = (t) => {
    if (t <= t0) return 0;
    if (t >= t0 + durationMs) return durationMs * S1 + (t - t0 - durationMs);
    const u = x(t);
    return durationMs * (u ** 3 - u ** 4 / 2);
  };
  return {
    hold(on, now) {
      if (on === isHeld) return;
      from = value(now);
      to = on ? floor : 1;
      t0 = now;
      isHeld = on;
    },
    held() {
      return isHeld;
    },
    value,
    meanFactor(a, b) {
      if (from === to) return to;
      if (!(b > a)) return value(b);
      return from + ((to - from) * (G(b) - G(a))) / (b - a);
    },
  };
}
