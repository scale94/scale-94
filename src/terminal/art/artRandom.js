// artRandom.js — the sphere's own random stream.
//
// WHY THE PIECE OWNS ITS RANDOMNESS INSTEAD OF USING Math.random.
//
// The draw loop makes stochastic DECISIONS, not just stochastic decorations:
// `artRandom() < 0.15` gates a particle burst, `artRandom() > fil.strength`
// drops a filament, `artRandom() < 0.0025` injects energy into a node. Those
// decide which edges exist. Feed them a stream that something else is also
// drawing from and the world stops being a function of the simulation.
//
// Something else was. three.js calls Math.random() for every object UUID, from
// the same global stream, and it does so at a rate that depends on when
// render targets are reallocated — which is a real browser task, not a frame.
// MEASURED, post-step-5 task 3: four captures of one build were bit-identical
// through all five normal states and then produced THREE DIFFERENT WORLDS at
// `immersive-off`, at identical rotation, identical sphere radius, identical
// buffer sizes and an identical layer census. The edge COUNT moved — 128, then
// 129 — because a threshold above had flipped. Giving every rAF callback the
// same stream offset (a diagnostic in scripts/determinism.mjs) collapsed the
// four runs back to one world at every state, which is what identified this.
//
// scripts/determinism.mjs had already written the diagnosis down, in a comment,
// as the thing it could not fix from outside: "The app should own a private
// RNG, but a parity gate must not require rewriting the thing it measures."
// This is the app owning one.
//
// WHAT THIS DOES NOT CHANGE. In the browser the seed comes from Math.random()
// at mount, so the world still differs on every page load exactly as it did
// before. Nothing about the piece's behaviour is more fixed than it was; what
// changes is that the world now depends only on the simulation and its seed,
// and not on when the GPU layer happened to allocate an object. For an install
// that has to run unattended for months, that is worth having on its own terms,
// quite apart from making the capture harness able to repeat itself.

// mulberry32 — the same generator scripts/determinism.mjs uses for the global
// shim, deliberately, so a value drawn here and a value drawn there are the
// same kind of number and neither reads as the odd one out.
// Seeded from Math.random at module load, so the piece opens on a different
// world every page load exactly as it always has. Only the dev-only harness
// reset ever pins it.
let s = (Math.random() * 0x100000000) >>> 0;

// Deliberately the same value scripts/determinism.mjs seeds its global shim
// with. The app used to draw from that shim, first in the frame, so this is the
// sequence the captured world has always been built from — and every probe in
// scripts/artPresence.mjs is tuned to the world it produces. Choosing a
// different constant here changes the world for no reason and costs four
// presence checks; that was measured, not guessed.
export const ART_SEED = 0x9E3779B9;

// Reseed the stream. Called with a constant by the dev-only harness reset, so a
// capture starts from a known offset, and with Math.random() at mount in every
// other case, so the piece is as varied as it ever was.
export function seedArtRandom(seed) {
  s = (seed >>> 0) || 0x9e3779b9;
}

export function artRandom() {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
