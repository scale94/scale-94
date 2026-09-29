// palette.js — composite exposure. Starting values; Task 8's visual review
// with the user tunes them. ref: concentration at which a channel's log
// exposure reaches ln 2 × gain. Channels: ΔT (°C), BOD, NO₃, deficit (mg/L).
export const OCEAN_EXPOSURE = {
  ref: [0.005, 0.002, 0.01, 0.01],
  gain: [0.35, 0.35, 0.35, 0.6],
  rim: 1.0,
  aberration: 0.35,
};
