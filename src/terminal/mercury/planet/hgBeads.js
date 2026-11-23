// src/terminal/mercury/planet/hgBeads.js — liquid Hg beads in the aether (aether spec §3): sources, motion, sinks.
// Pure (no three). Sources: an ambient trickle off the sunlit liquid surface (the planet's slow loss to space,
// × boiling), fling bursts tangential to the spin, splashes at liquid visitor impacts. Motion: gravity toward
// the planet + drag toward the ACTIVE element's flow velocity (flung beads fly free first, FLING_FREE_T, then the
// flow they ease into also drifts them home at FLING_RETURN_V, and they live until they land: FLING_LIFE is a cap).
// Sinks: life (fade), fire (evaporation), re-entry (contact is reported in hits; a bead drawn as a body then coalesces
// over its capillary time, anchored to the planet, a glint-only speck merges at once), the cap (oldest first; only flings and splashes
// evict, the ambient trickle waits for room). Preallocated typed arrays; nothing allocates per frame.
// Upload: position + (radius, alpha, glint gate).

import { mulberry32 } from './prng';
import { SUN_DIR_WORLD } from './planetFrame';
import { DROP_V_REF, qRotate, qRotateInv } from './breakupFamily';
import { STRIKE_V_REF, SINK, FREEZE_AIM, FREEZE_MIN_S, FREEZE_DRAG, FREEZE_FADE_S } from './breakupStep';
import { sphereVol, capillaryTime } from './breakupPhysics';

export const DUST_R = Object.freeze([0.0015, 0.006]);  // scene units: ~0.4–1.5 px at the fitted desktop camera
export const PEARL_R = Object.freeze([0.012, 0.02]);   // ~3–5 px: the rare solid silver bead
export const PEARL_P = 0.05;                            // share of spawns that are pearls
export const AMBIENT_RATE = 18;   // beads/s off the sunlit surface → ~AMBIENT_RATE · BEAD_LIFE alive (× tier rateScale)
export const BOIL_GAIN = 4;       // boiling multiplies the trickle by (1 + BOIL_GAIN · coverage)
export const BEAD_LIFE = 8;       // s
export const BEAD_FADE = 1.5;     // s of fade-OUT before BEAD_LIFE (the fade-in is the 0.15 s ramp in stepBeads)
// A bead is drawn as a mirror body from 2 px across (hgBeadShader kPearl); below that it is a glint only. Coalescence
// follows what is drawn, not the spawn class (dust renders as visible pearls on a large or high-dpr canvas).
export const BEAD_BODY_PX = 1;     // rendered radius, px
export const BEAD_SHAPE_MARGIN = 1.12; // × coreR: past this (|p| − r) the live surface (SHAPE_MAX + BULGE_MAX) can't reach a bead
export const BEAD_ESCAPE_R = 4;   // × coreR: beyond this a bead has left the scene for good (a safety cull: every element brings a fling home inside it)
export const G_BEAD = 0.12;       // GM in scene units: escape speed at r 0.75 ≈ 0.57
export const DRAG = 1.5;          // 1/s toward the active element's flow velocity
export const EVAP_RATE = 0.004;   // radius loss per second in fire
export const FLING_N = 48;
export const SPLASH_N = 6;
export const FLING_GAIN = 1.1;    // × (ω × r) at release
export const FLING_V_MAX = 2.25;  // launch speed cap (scene units/s): readable arcs, not instant escapes
export const FLING_FREE_T = 0.5;   // s: a flung bead flies free (no drag), then eases into the flow: drag × (1 − e^(−age/T))
// fix/mercury-motion: in a still aether the drag braked a flung bead to rest far out (G_BEAD's terminal speed there is
// ≈ 0.01–0.03 u/s) and BEAD_LIFE faded it in space. A flung bead's flow carries this inward drift on top of the element's,
// so it arcs out ballistic, then comes home (spiralling with air/fluid: the drift carries the swirl's centrifugal lead),
// and it is not faded before FLING_LIFE.
export const FLING_RETURN_V = 0.35; // u/s toward the planet
export const FLING_LIFE = 16;       // s: the safety cap for a flung bead (≫ its ~3–6 s trip home)
// The freeze guard (fix/mercury-motion): while the planet refreezes, ctx.freezeIn is the time left before its surface
// stops counting as liquid. Airborne beads home onto it in that window (a drift planned to arrive at FREEZE_AIM of the
// time left, less the drag's lag, never planned shorter than FREEZE_MIN_S, under a firmer drag); once it has crusted,
// any still airborne fade out.
export { FREEZE_AIM, FREEZE_MIN_S, FREEZE_DRAG, FREEZE_FADE_S }; // one guard for the beads and the family (breakupStep)
export const FLING_RADIAL = 0.25;  // outward launch kick (scene units/s): the spray peels off the surface
// The glint gate (spec §2 + amendment): a free droplet rings in its l=2 and l=3 shape modes
// (Rayleigh: f ∝ √(l(l−1)(l+2)) · r^−1.5, ratio √(30/8) ≈ 1.94), and an ejected droplet tumbles, so its
// wobble axis precesses and the Sun's image swings in and out of reach. 1.94 alone nearly phase-locks
// (CV 0.01, a metronome); the tumble envelope breaks it (min CV >= 0.47 over seeded dust beads, see test).
// The wobble phase is INTEGRATED per bead (b.wph += 2π·wobbleHz(r)·dt): evaporation shrinks r so the wobble
// quickens, but never past WOBBLE_HZ_MAX. Rates are scaled for legibility, not physical (real droplets this
// size ring far faster).
export const WOBBLE_HZ_REF = 0.8;  // at WOBBLE_R_REF
export const WOBBLE_R_REF = 0.012;
export const WOBBLE_HZ_MIN = 0.5;
export const WOBBLE_HZ_MAX = 5;    // dust lives at the clamp: a shimmer, not a strobe
export const WOBBLE_RATIO = Math.sqrt(30 / 8);
export const TUMBLE_E = 0.6;       // tumble envelope depth
export const TUMBLE_K = Object.freeze([0.15, 0.3]); // tumble rate as a fraction of the wobble rate
export const WOBBLE_K = 1.5;       // spark sharpness: lit ~22 % of the time, ~63 ms per spark (look round 2, author; was 3: ~10 %, too sparse)

export function wobbleHz(r) {
  const hz = WOBBLE_HZ_REF * (WOBBLE_R_REF / Math.max(r, 1e-6)) ** 1.5;
  return Math.min(WOBBLE_HZ_MAX, Math.max(WOBBLE_HZ_MIN, hz));
}

export function wobbleGate(wt, ph2, ph3, ph4, tumble) {
  const s = (0.6 * Math.sin(wt + ph2) + 0.4 * Math.sin(WOBBLE_RATIO * wt + ph3))
    * (1 - TUMBLE_E + TUMBLE_E * Math.sin(tumble * wt + ph4));
  return s > 0 ? s ** WOBBLE_K : 0;
}
const AMBIENT_V = [0.15, 0.35];   // launch speed range (scene units/s), along the surface normal
const SPLASH_V = 0.35;
const SUN_MIN = 0.2;              // ambient sources: dot(normal, Sun) above this

export const HIT_STRIDE = 6;
// hits[h + 5]: how a touchdown may ripple. 0 a refreeze-homing landing, 1 a trickle / splash bead, 2 a flung bead. Only a
// flung bead ripples (it is the author's gesture); the trickle and the splash spray land silent (fix/mercury-motion: a
// short-hop trickle pearl lost in the bright reflection rang a ripple from nothing), so an idle melted planet is calm.
export const HIT_SILENT = 0, HIT_TRICKLE = 1, HIT_FLUNG = 2;
// fix/mercury-pearl-ripples (author 2026-11-23): a big trickle pearl sinking into the mirror with no ring broke the
// physics. A trickle / splash pearl rings when the eye can see it land: drawn whole by the bead shader (≥ this many
// drawing-buffer px across: its kPearl reaches 1 at vPx 4) and touching down on the camera-facing cap. Every such pearl
// rings (no shared budget, no strongest-of-frame): the old budget handed the ring to whichever bead landed first, often
// one lost in the glare, so the ring read as displaced from the pearl being watched. Dust stays silent (pearlStrike 0).
export const PEARL_RING_MIN_PX = 4;
export const pearlDrawnWhole = (r, pxPerUnit) => 2 * r * pxPerUnit >= PEARL_RING_MIN_PX;
// R·d (d a unit world dir, planet at the origin) is on the cap a camera at c sees iff d·c > R.
export const facesCamera = (dx, dy, dz, cx, cy, cz, R) => dx * cx + dy * cy + dz * cz > R;
export function trickleRings(hits, h, pxPerUnit, cx, cy, cz, R) {
  return hits[h + 5] === HIT_TRICKLE && pearlDrawnWhole(hits[h + 3], pxPerUnit)
    && facesCamera(hits[h], hits[h + 1], hits[h + 2], cx, cy, cz, R);
}
export function createBeads(cap, seed = 0x6867) {
  return {
    cap, n: 0, acc: 0, rng: mulberry32(seed),
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3),
    r: new Float32Array(cap), age: new Float32Array(cap), free: new Uint8Array(cap),
    ph2: new Float32Array(cap), ph3: new Float32Array(cap), ph4: new Float32Array(cap), tumble: new Float32Array(cap), wph: new Float32Array(cap),
    outPos: new Float32Array(cap * 3), outBead: new Float32Array(cap * 3),
    // this step's touchdowns: (world dir xyz, radius, inward normal speed, HIT_* kind) × nHits, HIT_STRIDE apart.
    // The caller ripples flung pearls only (HIT_FLUNG); a refreeze-homing landing is HIT_SILENT
    hits: new Float32Array(cap * HIT_STRIDE), nHits: 0,
    // coalescence: time left / total (0 = airborne), radius at contact, contact direction in the body frame
    mt: new Float32Array(cap), mD: new Float32Array(cap), r0: new Float32Array(cap), dB: new Float32Array(cap * 3),
    cut: new Float32Array(cap), // the age at which a bead caught airborne over a crust is gone (Infinity: not cut)
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
  b.r[i] = r; b.age[i] = 0; b.free[i] = 0; b.wph[i] = 0; b.mt[i] = 0; b.mD[i] = 0; b.cut[i] = Infinity;
  b.ph2[i] = 2 * Math.PI * b.rng(); b.ph3[i] = 2 * Math.PI * b.rng(); b.ph4[i] = 2 * Math.PI * b.rng();
  b.tumble[i] = TUMBLE_K[0] + (TUMBLE_K[1] - TUMBLE_K[0]) * b.rng();
  return i;
}

function remove(b, i) {
  const last = --b.n;
  if (i === last) return;
  for (let c = 0; c < 3; c++) { b.pos[3 * i + c] = b.pos[3 * last + c]; b.vel[3 * i + c] = b.vel[3 * last + c]; b.dB[3 * i + c] = b.dB[3 * last + c]; }
  b.mt[i] = b.mt[last]; b.mD[i] = b.mD[last]; b.r0[i] = b.r0[last]; b.cut[i] = b.cut[last];
  b.r[i] = b.r[last]; b.age[i] = b.age[last]; b.free[i] = b.free[last];
  b.ph2[i] = b.ph2[last]; b.ph3[i] = b.ph3[last]; b.ph4[i] = b.ph4[last]; b.tumble[i] = b.tumble[last]; b.wph[i] = b.wph[last];
}

// Glitter dust, skewed small, with a rare pearl (spec §1).
export function beadRadius(rng) {
  if (rng() < PEARL_P) return PEARL_R[0] + (PEARL_R[1] - PEARL_R[0]) * rng();
  const u = rng();
  return DUST_R[0] + (DUST_R[1] - DUST_R[0]) * u * u;
}
const radius = (b) => beadRadius(b.rng);

export function spawnFling(b, omega, coreR, n = FLING_N) {
  n = Math.min(n, b.cap);
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

// A touchdown's ripple strength on the phase-5 splash scale (0..1): pearls only (dust merges silently). Energy share,
// not volume share: amplitude ∝ √(m v²), as the hyper swarm's strike splits one splash (breakupStep.strike). A pearl is
// 1.6–7 % of a phase-5 drop by volume, so a linear share would be an invisible ring. No floor: a floor on every visible
// bead buzzed the liquid nonstop (author 2026-11-22). Only flung pearls are rung (hits flag).
export function pearlStrike(r, vn) {
  if (r < PEARL_R[0]) return 0;
  const vnK = 0.5 + 0.5 * Math.min(1, Math.max(vn, 0) / STRIKE_V_REF);
  return Math.min(1, Math.sqrt(sphereVol(r) / DROP_V_REF) * vnK);
}

const smooth = (u) => u * u * (3 - 2 * u);

const _dir = [0, 0, 0], _dB = [0, 0, 0];
const Q_ID = [0, 0, 0, 1];
export function stepBeads(b, dt, ctx) {
  // pxPerUnit 0 (headless default): every bead merges at contact, as before coalescence
  const { phase, coreR, calm, liquid, boil, rateScale = 1, planetRadiusAt = null, pxPerUnit = 0, q = Q_ID, freezeIn = Infinity } = ctx;
  const homing = freezeIn > 0 && freezeIn < Infinity, crust = !(freezeIn > 0);
  const ER2 = BEAD_ESCAPE_R * BEAD_ESCAPE_R * coreR * coreR;
  const nearR = BEAD_SHAPE_MARGIN * coreR;
  b.nHits = 0;
  if (!calm && liquid) {
    b.acc += AMBIENT_RATE * rateScale * (1 + BOIL_GAIN * boil) * dt;
    while (b.acc >= 1) { b.acc -= 1; if (b.n < b.cap) spawnAmbient(b, coreR); }
  }
  for (let i = b.n - 1; i >= 0; i--) {
    b.age[i] += dt;
    if (b.mD[i] > 0) { // coalescing: anchored to the turning planet, it drains and sinks like a drop's last cascade stage
      b.mt[i] -= dt;
      if (b.mt[i] <= 0) { remove(b, i); continue; }
      const u = smooth(Math.min(1, 1 - b.mt[i] / b.mD[i]));
      b.r[i] = b.r0[i] * Math.cbrt(1 - u);
      _dB[0] = b.dB[3 * i]; _dB[1] = b.dB[3 * i + 1]; _dB[2] = b.dB[3 * i + 2];
      qRotate(q, _dB, _dir);
      const R = (planetRadiusAt ? planetRadiusAt(_dir) : coreR) + b.r[i] * (1 - SINK * u);
      for (let c = 0; c < 3; c++) { b.pos[3 * i + c] = _dir[c] * R; b.vel[3 * i + c] = 0; }
      continue;
    }
    if (crust && b.cut[i] > b.age[i] + FREEZE_FADE_S) b.cut[i] = b.age[i] + FREEZE_FADE_S;
    if (!calm) {
      const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
      const r2 = x * x + y * y + z * z, rl = Math.sqrt(r2) || 1, g = G_BEAD / (r2 * rl);
      flowVel(phase, x, y, z, b.age[i]);
      let ret = 0;
      if (b.free[i]) {
        // drag-locked into a swirling flow, a bead needs v_t²/r of centripetal pull, and drag pays it with an outward drift
        // of ≈ v_t² / (r · DRAG): in air's rigid rotation that beat FLING_RETURN_V past r ≈ 0.8 and the swarm spiralled out
        // to BEAD_ESCAPE_R (popped mid-air). The drift carries that lead, so a flung bead swirls with the flow and comes home.
        const fr = (f[0] * x + f[1] * y + f[2] * z) / rl;
        const ft2 = Math.max(0, f[0] * f[0] + f[1] * f[1] + f[2] * f[2] - fr * fr);
        ret = FLING_RETURN_V + ft2 / (rl * DRAG);
      }
      let drag = b.free[i] ? DRAG * (1 - Math.exp(-b.age[i] / FLING_FREE_T)) : DRAG;
      if (homing) {
        const need = Math.max(0, rl - b.r[i] - coreR) / Math.max(FREEZE_AIM * freezeIn - 1 / FREEZE_DRAG, FREEZE_MIN_S);
        if (need > ret) ret = need;
        if (drag < FREEZE_DRAG) drag = FREEZE_DRAG;
      }
      if (ret > 0) { const k = ret / rl; f[0] -= k * x; f[1] -= k * y; f[2] -= k * z; }
      for (let c = 0; c < 3; c++) {
        const p = b.pos[3 * i + c];
        b.vel[3 * i + c] += (-g * p + drag * (f[c] - b.vel[3 * i + c])) * dt;
        b.pos[3 * i + c] += b.vel[3 * i + c] * dt;
      }
      if (phase === 'thermal') b.r[i] -= EVAP_RATE * dt;
      b.wph[i] += 2 * Math.PI * wobbleHz(b.r[i]) * dt;
    }
    const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
    const r2 = x * x + y * y + z * z;
    const escaped = r2 > ER2;
    // Touchdown: the bead's surface meets the live planet (bulge + ripples, via planetRadiusAt) while it falls inward;
    // a fresh spawn overlapping the surface on its way out is not one. The centre-inside test stays as the backstop.
    let landed = false;
    if (b.age[i] > 0.05) {
      const rl = Math.sqrt(r2) || 1e-9;
      const ux = x / rl, uy = y / rl, uz = z / rl;
      const vn = -(b.vel[3 * i] * ux + b.vel[3 * i + 1] * uy + b.vel[3 * i + 2] * uz);
      if (rl - b.r[i] <= nearR) {
        _dir[0] = ux; _dir[1] = uy; _dir[2] = uz;
        const R = planetRadiusAt ? planetRadiusAt(_dir) : coreR;
        landed = rl < R || (vn > 0 && rl - b.r[i] <= R);
      }
      if (landed) {
        const h = HIT_STRIDE * b.nHits++;
        b.hits[h] = ux; b.hits[h + 1] = uy; b.hits[h + 2] = uz; b.hits[h + 3] = b.r[i]; b.hits[h + 4] = Math.max(vn, 0);
        b.hits[h + 5] = homing ? HIT_SILENT : b.free[i] ? HIT_FLUNG : HIT_TRICKLE;
        if (b.r[i] * pxPerUnit >= BEAD_BODY_PX) {
          _dir[0] = ux; _dir[1] = uy; _dir[2] = uz;
          qRotateInv(q, _dir, _dB);
          b.dB[3 * i] = _dB[0]; b.dB[3 * i + 1] = _dB[1]; b.dB[3 * i + 2] = _dB[2];
          b.r0[i] = b.r[i]; b.mD[i] = b.mt[i] = capillaryTime(b.r[i]);
          continue;
        }
      }
    }
    if (landed || b.age[i] > Math.min(b.free[i] ? FLING_LIFE : BEAD_LIFE, b.cut[i]) || b.r[i] <= 0 || escaped) remove(b, i);
  }
  for (let i = 0; i < b.n; i++) {
    b.outPos[3 * i] = b.pos[3 * i]; b.outPos[3 * i + 1] = b.pos[3 * i + 1]; b.outPos[3 * i + 2] = b.pos[3 * i + 2];
    const life = b.free[i] ? FLING_LIFE : BEAD_LIFE;
    const a = b.cut[i] < life
      ? Math.min(1, b.age[i] / 0.15, (b.cut[i] - b.age[i]) / FREEZE_FADE_S)
      : Math.min(1, b.age[i] / 0.15, (life - b.age[i]) / BEAD_FADE);
    b.outBead[3 * i] = b.r[i]; b.outBead[3 * i + 1] = Math.max(0, a);
    b.outBead[3 * i + 2] = calm ? 0 : wobbleGate(b.wph[i], b.ph2[i], b.ph3[i], b.ph4[i], b.tumble[i]);
  }
  return b.n;
}
