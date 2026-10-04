// src/terminal/mercury/planet/hgBeads.js — liquid Hg beads in the aether (aether spec §3): sources, motion, sinks.
// Pure (no three). Sources: an ambient trickle off the sunlit liquid surface (the planet's slow loss to space,
// × boiling), fling bursts tangential to the spin, splashes at liquid visitor impacts. Motion: gravity toward
// the planet + drag toward the ACTIVE element's flow velocity. Sinks: life (fade), fire (evaporation), re-entry
// (merge), the cap (oldest first). Preallocated typed arrays; nothing allocates per frame.

import { mulberry32 } from './aetherLobes';
import { SUN_DIR_WORLD } from './planetFrame';

export const BEAD_R_MIN = 0.004;  // scene units (~1 px at the fitted desktop camera)
export const BEAD_R_MAX = 0.012;  // ~3 px
export const AMBIENT_RATE = 6;    // beads/s off the sunlit surface → ~AMBIENT_RATE · BEAD_LIFE alive
export const BOIL_GAIN = 4;       // boiling multiplies the trickle by (1 + BOIL_GAIN · coverage)
export const BEAD_LIFE = 8;       // s
export const BEAD_FADE = 1.5;     // s of fade-in at birth and fade-out before BEAD_LIFE
export const G_BEAD = 0.12;       // GM in scene units: escape speed at r 0.75 ≈ 0.57
export const DRAG = 1.5;          // 1/s toward the active element's flow velocity
export const EVAP_RATE = 0.004;   // radius loss per second in fire
export const FLING_N = 24;
export const SPLASH_N = 6;
export const FLING_GAIN = 1.1;    // × (ω × r) at release
const AMBIENT_V = [0.15, 0.35];   // launch speed range (scene units/s), along the surface normal
const SPLASH_V = 0.35;
const SUN_MIN = 0.2;              // ambient sources: dot(normal, Sun) above this

export function createBeads(cap, seed = 0x6867) {
  return {
    cap, n: 0, acc: 0, rng: mulberry32(seed),
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3),
    r: new Float32Array(cap), age: new Float32Array(cap),
    outPos: new Float32Array(cap * 3), outBead: new Float32Array(cap * 2),
  };
}

function oldest(b) {
  let k = 0;
  for (let i = 1; i < b.n; i++) if (b.age[i] > b.age[k]) k = i;
  return k;
}

export function spawnBead(b, x, y, z, vx, vy, vz, r) {
  const i = b.n < b.cap ? b.n++ : oldest(b);
  b.pos[3 * i] = x; b.pos[3 * i + 1] = y; b.pos[3 * i + 2] = z;
  b.vel[3 * i] = vx; b.vel[3 * i + 1] = vy; b.vel[3 * i + 2] = vz;
  b.r[i] = r; b.age[i] = 0;
}

function remove(b, i) {
  const last = --b.n;
  if (i === last) return;
  for (let c = 0; c < 3; c++) { b.pos[3 * i + c] = b.pos[3 * last + c]; b.vel[3 * i + c] = b.vel[3 * last + c]; }
  b.r[i] = b.r[last]; b.age[i] = b.age[last];
}

const radius = (b) => BEAD_R_MIN + (BEAD_R_MAX - BEAD_R_MIN) * b.rng() * b.rng(); // skewed small

export function spawnFling(b, omega, coreR, n = FLING_N) {
  const w = Math.hypot(omega[0], omega[1], omega[2]);
  const ax = w > 1e-6 ? omega[0] / w : 0, ay = w > 1e-6 ? omega[1] / w : 1, az = w > 1e-6 ? omega[2] / w : 0;
  // u ⟂ axis (cross with the least-aligned world axis), v = axis × u
  let ux = 0, uy = 0, uz = 0;
  if (Math.abs(ay) < 0.9) { ux = az; uz = -ax; } else { uy = -az; uz = ay; } // axis × Y or axis × X
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const R = coreR * 1.02;
  for (let k = 0; k < n; k++) {
    const phi = b.rng() * 2 * Math.PI, c = Math.cos(phi), s = Math.sin(phi);
    const dx = ux * c + vx * s, dy = uy * c + vy * s, dz = uz * c + vz * s;
    const px = dx * R, py = dy * R, pz = dz * R;
    const wx = omega[0] * FLING_GAIN, wy = omega[1] * FLING_GAIN, wz = omega[2] * FLING_GAIN;
    spawnBead(b, px, py, pz, wy * pz - wz * py + dx * 0.1, wz * px - wx * pz + dy * 0.1, wx * py - wy * px + dz * 0.1, radius(b));
  }
}

export function spawnSplash(b, dirW, coreR, n = SPLASH_N) {
  const R = coreR * 1.02;
  for (let k = 0; k < n; k++) {
    const j = () => (b.rng() - 0.5) * 0.3;
    spawnBead(b, dirW[0] * R, dirW[1] * R, dirW[2] * R,
      (dirW[0] + j()) * SPLASH_V, (dirW[1] + j()) * SPLASH_V, (dirW[2] + j()) * SPLASH_V, radius(b));
  }
}

function spawnAmbient(b, coreR) {
  let x, y, z, l;
  do { x = b.rng() * 2 - 1; y = b.rng() * 2 - 1; z = b.rng() * 2 - 1; l = Math.hypot(x, y, z); }
  while (l > 1 || l < 1e-3 || (x * SUN_DIR_WORLD[0] + y * SUN_DIR_WORLD[1] + z * SUN_DIR_WORLD[2]) / l < SUN_MIN);
  x /= l; y /= l; z /= l;
  const v = AMBIENT_V[0] + (AMBIENT_V[1] - AMBIENT_V[0]) * b.rng();
  spawnBead(b, x * coreR * 1.02, y * coreR * 1.02, z * coreR * 1.02, x * v, y * v, z * v, radius(b));
}

// The active element's flow velocity at p (scene units/s), written into f. A simplified mirror of each flow.
const f = [0, 0, 0];
function flowVel(phase, x, y, z, age) {
  f[0] = 0; f[1] = 0; f[2] = 0;
  if (phase === 'air') { f[0] = -0.8 * z; f[2] = 0.8 * x; }                       // orbit about +Y
  else if (phase === 'fluid') { f[0] = -0.4 * z; f[2] = 0.4 * x; f[1] = 0.25 * Math.sin(3 * Math.atan2(z, x) + age); } // swirl + undulation
  else if (phase === 'earth') { const l = Math.hypot(x, y, z) || 1; f[0] = 0.15 * x / l; f[1] = 0.15 * y / l; f[2] = 0.15 * z / l; } // lofted dust
  else if (phase === 'thermal') { f[1] = 0.4; }                                    // updraft
}

export function stepBeads(b, dt, ctx) {
  const { phase, coreR, calm, liquid, boil } = ctx;
  if (!calm && liquid) {
    b.acc += AMBIENT_RATE * (1 + BOIL_GAIN * boil) * dt;
    while (b.acc >= 1) { b.acc -= 1; spawnAmbient(b, coreR); }
  }
  for (let i = b.n - 1; i >= 0; i--) {
    b.age[i] += dt;
    if (!calm) {
      const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
      const r2 = x * x + y * y + z * z, rl = Math.sqrt(r2) || 1, g = G_BEAD / (r2 * rl);
      flowVel(phase, x, y, z, b.age[i]);
      for (let c = 0; c < 3; c++) {
        const p = b.pos[3 * i + c];
        b.vel[3 * i + c] += (-g * p + DRAG * (f[c] - b.vel[3 * i + c])) * dt;
        b.pos[3 * i + c] += b.vel[3 * i + c] * dt;
      }
      if (phase === 'thermal') b.r[i] -= EVAP_RATE * dt;
    }
    const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
    const inside = x * x + y * y + z * z < coreR * coreR;
    if (b.age[i] > BEAD_LIFE || b.r[i] <= 0 || (inside && b.age[i] > 0.05)) remove(b, i);
  }
  for (let i = 0; i < b.n; i++) {
    b.outPos[3 * i] = b.pos[3 * i]; b.outPos[3 * i + 1] = b.pos[3 * i + 1]; b.outPos[3 * i + 2] = b.pos[3 * i + 2];
    const a = Math.min(1, b.age[i] / 0.15, (BEAD_LIFE - b.age[i]) / BEAD_FADE);
    b.outBead[2 * i] = b.r[i]; b.outBead[2 * i + 1] = Math.max(0, a);
  }
  return b.n;
}
