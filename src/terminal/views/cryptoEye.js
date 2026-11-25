// cryptoEye.js — /CRYPTOGRAPHY's entropy drag -> the masthead eye, live (eyeDrive channels).
// Called every frame from the EntropyGrid's own loop, poked on every cell the pointer hits.
// From the first bit on, the eye takes the amber cryptographic palette and a block lattice,
// both growing with the pool (0 -> TARGET_BITS); a chaotic scramble rides the pointer's
// activity. A pause holds the charge (the palette + lattice stay; only the chaos calms).
// When the pool saturates the grid unmounts, the drive lapses quietly (no back-spin), and
// the keygen hold ('crypto.keygen', observerStore.notifyCrypto) takes the eye from there.

import { drivePalette, driveShape, driveSpin } from '../components/eyeDrive';
import { SHAPE } from '../components/observerEyeShader';
import { CRYPTO_COLS } from '../components/eyeReactions';

const ACT_TAU = 0.25;       // s, how fast the pointer's activity calms after the last hit
const ACT_PER_HIT = 0.35;   // activity added by one hit (cells come fast while dragging)

export function createCryptoEyeFeed() {
  return { act: 0, clock: 0, last: null };
}

// A cell was hit (visited or not: the drag itself is the energy).
export function pokeCryptoEye(mem) {
  mem.act = Math.min(1.5, mem.act + ACT_PER_HIT);
}

// progress: bits / target (0..1); nowMs: performance.now(). Returns whether it drove.
export function feedCryptoEye(progress, nowMs, mem) {
  const dt = mem.last == null ? 0 : Math.min(0.1, Math.max(0, (nowMs - mem.last) / 1000));
  mem.last = nowMs;
  mem.act *= Math.exp(-dt / ACT_TAU);
  const p = Math.min(1, Math.max(0, progress || 0));
  if (p <= 0) return false;                                       // nothing collected yet
  const a = Math.min(1, mem.act);
  mem.clock += dt * (3 + 11 * a);                                  // blocks re-deal faster while dragging
  drivePalette(CRYPTO_COLS[0], CRYPTO_COLS[1], CRYPTO_COLS[2], { w: 0.25 + 0.75 * p, quiet: true });
  driveShape(SHAPE.cipher, Math.min(1, 0.35 + p), a * (0.35 + 0.65 * p), mem.clock, 0.55 * p);
  driveSpin(1.6 * a);
  return true;
}
