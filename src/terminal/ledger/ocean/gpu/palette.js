// palette.js — composite exposure, tuned by eye with the user (Task 8).
// ref: concentration at which a channel's log exposure reaches ln 2 × gain.
// Channels: ΔT (°C), BOD, NO₃, deficit (mg/L). Measured after ~450 sim days:
// ΔT lives ~1 cell around a mouth (e-folds in 3 d), 3.5e-4..1.3e-2 there, so
// its ref sits far below BOD's to make the heat core read crimson.
export const OCEAN_EXPOSURE = {
  ref: [3e-5, 1e-3, 2e-3, 0.01],
  gain: [0.95, 0.38, 0.35, 0.7],
  rim: 1.4,
  aberration: 0.35,
};
