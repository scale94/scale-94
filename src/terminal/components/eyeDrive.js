// eyeDrive.js — the masthead eye's live input channel (thematic pass, Phase 0c).
//
// Some reactions are continuous, not one-shot: the eye spins while Mercury spins,
// masks to the moon phase while it is scrubbed, stares while growth_mandate is
// cranked. A tab writes here on *user input only* (the agency filter is the
// tab's job); ObserverEye (driven) reads it every frame. No React, no bus
// traffic per frame: writes are plain field stores.
//
// Every channel is a hold: it stays live for HOLD_MS after its last write, then
// the eye eases it back out. A tab that unmounts mid-drive therefore lets go on
// its own; release() lets go at once.
//
//   driveSpin(v)               rad/s added to the swirl (signed; follows a planet/sun)
//   drivePalette(a, b, c?)     RGB 0..255 triples: the eye takes these colours over silver
//   driveGaze(x, y)            pupil offset, about ±0.25 reads as a clear look
//   driveMood(m)               -1 relaxed … 0 … +1 angry stare
//   driveShape(id, k, a, b)    SHAPE id from observerEyeShader, k 0..1, two params
//   release(name?)             drop one channel (or all) now

export const HOLD_MS = 280;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const channels = () => ({
  spin:    { at: -Infinity, v: 0 },
  palette: { at: -Infinity, cols: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
  gaze:    { at: -Infinity, x: 0, y: 0 },
  mood:    { at: -Infinity, m: 0 },
  shape:   { at: -Infinity, id: 0, k: 0, a: 0, b: 0 },
});

export const eyeDrive = channels();

const n = (x) => (Number.isFinite(x) ? x : 0);
const rgb = (src, dst) => {
  dst[0] = n(src[0]); dst[1] = n(src[1]); dst[2] = n(src[2]);
};

export function driveSpin(v) { const c = eyeDrive.spin; c.v = n(v); c.at = now(); }
export function drivePalette(a, b, c3 = null) {
  const p = eyeDrive.palette;
  rgb(a, p.cols[0]); rgb(b, p.cols[1]);
  if (c3) rgb(c3, p.cols[2]);
  else for (let i = 0; i < 3; i++) p.cols[2][i] = Math.round((n(a[i]) + n(b[i])) / 2 * 0.5 + 120);
  p.at = now();
}
export function driveGaze(x, y) { const c = eyeDrive.gaze; c.x = n(x); c.y = n(y); c.at = now(); }
export function driveMood(m) { const c = eyeDrive.mood; c.m = Math.max(-1, Math.min(1, n(m))); c.at = now(); }
export function driveShape(id, k, a = 0, b = 0) {
  const c = eyeDrive.shape; c.id = n(id); c.k = n(k); c.a = n(a); c.b = n(b); c.at = now();
}
export function release(name) {
  for (const key of name ? [name] : Object.keys(eyeDrive)) if (eyeDrive[key]) eyeDrive[key].at = -Infinity;
}

// Is a channel inside its hold at time t (ms, the performance clock)?
export const live = (ch, t) => t - ch.at <= HOLD_MS;
