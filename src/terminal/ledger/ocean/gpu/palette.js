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

// River-stage parcel colours: the composite's crimson / amber / green (the
// legend swatches, spec �1). ref: concentration at which a channel reaches
// 1 - 1/e of its colour � river concentrations are ~1e3x the ocean's, so these
// are not OCEAN_EXPOSURE's refs. deficitDim: brightness a fully deoxygenated
// parcel loses (deficit is absence of light). minAlpha: a clean parcel stays
// faintly visible.
export const RIVER_PALETTE = {
  crimson: [1, 0.09, 0.2],
  amber: [1, 0.62, 0],
  green: [0.22, 1, 0.08],
  ref: [2, 10, 10],
  deficitDim: 0.8,
  minAlpha: 0.25,
};
