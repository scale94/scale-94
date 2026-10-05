// src/terminal/mercury/planet/hgBeads.js — liquid Hg beads in the aether (aether spec §3): sources, motion, sinks.
// Pure (no three). Sources: an ambient trickle off the sunlit liquid surface (the planet's slow loss to space,
// × boiling), fling bursts tangential to the spin, splashes at liquid visitor impacts. Motion: gravity toward
// the planet + drag toward the ACTIVE element's flow velocity (flung beads fly free first, FLING_FREE_T). Sinks: life (fade), fire (evaporation), re-entry
// (merge), the cap (oldest first). Preallocated typed arrays; nothing allocates per frame. Upload: position + (radius, alpha, glint gate).

import { mulberry32 } from './aetherLobes';
import { SUN_DIR_WORLD } from './planetFrame';

export const DUST_R = Object.freeze([0.0015, 0.006]);  // scene units: ~0.4–1.5 px at the fitted desktop camera
export const PEARL_R = Object.freeze([0.012, 0.02]);   // ~3–5 px: the rare solid silver bead
export const PEARL_P = 0.05;                            // share of spawns that are pearls
export const AMBIENT_RATE = 18;   // beads/s off the sunlit surface → ~AMBIENT_RATE · BEAD_LIFE alive (× tier rateScale)
export const BOIL_GAIN = 4;       // boiling multiplies the trickle by (1 + BOIL_GAIN · coverage)
export const BEAD_LIFE = 8;       // s
export const BEAD_FADE = 1.5;     // s of fade-OUT before BEAD_LIFE (the fade-in is the 0.15 s ramp in stepBeads)
export const BEAD_ESCAPE_R = 4;   // × coreR: beyond this a bead has left the scene for good (flings never return)
export const G_BEAD = 0.12;       // GM in scene units: escape speed at r 0.75 ≈ 0.57
export const DRAG = 1.5;          // 1/s toward the active element's flow velocity
export const EVAP_RATE = 0.004;   // radius loss per second in fire
export const FLING_N = 48;
export const SPLASH_N = 6;
export const FLING_GAIN = 1.1;    // × (ω × r) at release
export const FLING_V_MAX = 2.25;  // launch speed cap (scene units/s): readable arcs, not instant escapes
export const FLING_FREE_T = 0.5;   // s: a flung bead flies free (no drag), then eases into the flow: drag × (1 − e^(−age/T))
export const FLING_RADIAL = 0.25;  // outward launch kick (scene units/s): the spray peels off the surface
// The glint gate (spec §2 + amendment): a free droplet rings in its l=2 and l=3 shape modes
// (Rayleigh: f ∝ √(l(l−1)(l+2)) · r^−1.5, ratio √(30/8) ≈ 1.94), and an ejected droplet tumbles, so its
// wobble axis precesses and the Sun's image swings in and out of reach. 1.94 alone nearly phase-locks
// (CV 0.01, a metronome); the tumble envelope breaks it (min CV 0.44 over 60 beads). Rates are scaled
// for legibility, not physical (real droplets this size ring far faster).
export const WOBBLE_HZ_REF = 0.8;  // at WOBBLE_R_REF
export const WOBBLE_R_REF = 0.012;
export const WOBBLE_HZ_MIN = 0.5;
export const WOBBLE_HZ_MAX = 5;    // dust lives at the clamp: a shimmer, not a strobe
export const WOBBLE_RATIO = Math.sqrt(30 / 8);
export const TUMBLE_E = 0.6;       // tumble envelope depth
export const TUMBLE_K = Object.freeze([0.15, 0.3]); // tumble rate as a fraction of the wobble rate
export const WOBBLE_K = 3;         // spark sharpness: dark ~90 % of the time

export function wobbleHz(r) {
  const hz = WOBBLE_HZ_REF * (WOBBLE_R_REF / Math.max(r, 1e-6)) ** 1.5;
  return Math.min(WOBBLE_HZ_MAX, Math.max(WOBBLE_HZ_MIN, hz));
}

export function wobbleGate(r, age, ph2, ph3, ph4, tumble) {
  const wt = 2 * Math.PI * wobbleHz(r) * age;
  const s = (0.6 * Math.sin(wt + ph2) + 0.4 * Math.sin(WOBBLE_RATIO * wt + ph3))
    * (1 - TUMBLE_E + TUMBLE_E * Math.sin(tumble * wt + ph4));
  return s > 0 ? s ** WOBBLE_K : 0;
}
const AMBIENT_V = [0.15, 0.35];   // launch speed range (scene units/s), along the surface normal
const SPLASH_V = 0.35;
const SUN_MIN = 0.2;              // ambient sources: dot(normal, Sun) above this

export function createBeads(cap, seed = 0x6867) {
  return {
    cap, n: 0, acc: 0, rng: mulberry32(seed),
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3),
    r: new Float32Array(cap), age: new Float32Array(cap), free: new Uint8Array(cap),
    ph2: new Float32Array(cap), ph3: new Float32Array(cap), ph4: new Float32Array(cap), tumble: new Float32Array(cap),
    outPos: new Float32Array(cap * 3), outBead: new Float32Array(cap * 3),
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
  b.r[i] = r; b.age[i] = 0; b.free[i] = 0;
  b.ph2[i] = 2 * Math.PI * b.rng(); b.ph3[i] = 2 * Math.PI * b.rng(); b.ph4[i] = 2 * Math.PI * b.rng();
  b.tumble[i] = TUMBLE_K[0] + (TUMBLE_K[1] - TUMBLE_K[0]) * b.rng();
  return i;
}

function remove(b, i) {
  const last = --b.n;
  if (i === last) return;
  for (let c = 0; c < 3; c++) { b.pos[3 * i + c] = b.pos[3 * last + c]; b.vel[3 * i + c] = b.vel[3 * last + c]; }
  b.r[i] = b.r[last]; b.age[i] = b.age[last]; b.free[i] = b.free[last];
  b.ph2[i] = b.ph2[last]; b.ph3[i] = b.ph3[last]; b.ph4[i] = b.ph4[last]; b.tumble[i] = b.tumble[last];
}

// Glitter dust, skewed small, with a rare pearl (spec §1).
export function beadRadius(rng) {
  if (rng() < PEARL_P) return PEARL_R[0] + (PEARL_R[1] - PEARL_R[0]) * rng();
  const u = rng();
  return DUST_R[0] + (DUST_R[1] - DUST_R[0]) * u * u;
}
const radius = (b) => beadRadius(b.rng);

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
    let lx = wy * pz - wz * py + dx * FLING_RADIAL, ly = wz * px - wx * pz + dy * FLING_RADIAL, lz = wx * py - wy * px + dz * FLING_RADIAL;
    const sp = Math.hypot(lx, ly, lz);
    if (sp > FLING_V_MAX) { const k2 = FLING_V_MAX / sp; lx *= k2; ly *= k2; lz *= k2; }
    b.free[spawnBead(b, px, py, pz, lx, ly, lz, radius(b))] = 1;
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
  const { phase, coreR, calm, liquid, boil, rateScale = 1 } = ctx;
  const ER2 = BEAD_ESCAPE_R * BEAD_ESCAPE_R * coreR * coreR;
  if (!calm && liquid) {
    b.acc += AMBIENT_RATE * rateScale * (1 + BOIL_GAIN * boil) * dt;
    while (b.acc >= 1) { b.acc -= 1; spawnAmbient(b, coreR); }
  }
  for (let i = b.n - 1; i >= 0; i--) {
    b.age[i] += dt;
    if (!calm) {
      const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
      const r2 = x * x + y * y + z * z, rl = Math.sqrt(r2) || 1, g = G_BEAD / (r2 * rl);
      flowVel(phase, x, y, z, b.age[i]);
      const drag = b.free[i] ? DRAG * (1 - Math.exp(-b.age[i] / FLING_FREE_T)) : DRAG;
      for (let c = 0; c < 3; c++) {
        const p = b.pos[3 * i + c];
        b.vel[3 * i + c] += (-g * p + drag * (f[c] - b.vel[3 * i + c])) * dt;
        b.pos[3 * i + c] += b.vel[3 * i + c] * dt;
      }
      if (phase === 'thermal') b.r[i] -= EVAP_RATE * dt;
    }
    const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
    const inside = x * x + y * y + z * z < coreR * coreR;
    const escaped = x * x + y * y + z * z > ER2;
    if (b.age[i] > BEAD_LIFE || b.r[i] <= 0 || escaped || (inside && b.age[i] > 0.05)) remove(b, i);
  }
  for (let i = 0; i < b.n; i++) {
    b.outPos[3 * i] = b.pos[3 * i]; b.outPos[3 * i + 1] = b.pos[3 * i + 1]; b.outPos[3 * i + 2] = b.pos[3 * i + 2];
    const a = Math.min(1, b.age[i] / 0.15, (BEAD_LIFE - b.age[i]) / BEAD_FADE);
    b.outBead[3 * i] = b.r[i]; b.outBead[3 * i + 1] = Math.max(0, a);
    b.outBead[3 * i + 2] = wobbleGate(b.r[i], b.age[i], b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
  }
  return b.n;
}
