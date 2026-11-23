// src/terminal/mercury/planet/breakupStep.js — the family's life after release
// (phase-5 spec §4.4–4.5, §5.2–5.5, §6; plan amendment P2).
// Fixed DROP_DT substeps (deterministic). Events go to fam.events for MercuryPlanet to ring the planet with.

import { IMPACT_MODE_AMP, IMPACT_WAVE_AMP } from './mercuryImpacts';
import {
  TONGUE_ROOT_R, DAUGHTER_RATIO, PX_FLOOR, capillaryTime, bridgeRadius, pinchRadius, taylorCulick, sphereVol, radiusOfVol,
} from './breakupPhysics';
import { qRotate, qRotateInv, addBody } from './breakupFamily';

export const DROP_DT = 1 / 120;
export const WOB_BIRTH = 0.25;       // ℓ = 2 amplitude a fresh bead is born with (fraction of r)
export const WOB_IMPACT_K = 0.08;    // extra amplitude per unit/s of merge speed
export const WOB_MAX = 0.35;
export const WOB_DAMP_PER_TC = 0.35; // wobble decay per own capillary time (≈ 3 visible rings)
export const HOP_K = 2;              // daughter hop height, in daughter radii
export const DRAIN_SHARE = 0.5;      // share of a cascade stage spent draining (the rest is the hop)
export const SINK = 0.6;             // how far a draining bead sinks toward the surface, × its radius
export const HOP_NECK = 0.6;         // daughter–planet neck at lift-off, × daughter radius…
export const HOP_NECK_T = 0.3;       // …pinched off by this share of the hop
export const STRIKE_V_REF = 0.5;     // normal speed (units/s) for a full-strength strike
export const COHESION_SOFT = 1;      // cohesion softening, × (ra + rb)
// The freeze guard (fix/mercury-motion), shared with the glitter beads (hgBeads re-exports these): while the planet
// refreezes, env.freezeIn is the time left before its surface stops counting as liquid. Every flying body homes onto it
// in that window (a drift planned to arrive at FREEZE_AIM of the time left, less the drag's lag, never planned shorter
// than FREEZE_MIN_S, under a firmer drag that replaces the aether's); once it has crusted, whatever is still out (in
// flight, merging, still attached or mid-cascade) drains away over FREEZE_FADE_S (fam.fadeK, drawn by breakupFrame) and
// rings nothing: liquid Hg never orbits, or splashes on, a solid crust. Absent (replays, catch-up) = Infinity: no guard.
export const FREEZE_AIM = 0.5;
export const FREEZE_MIN_S = 0.15;
export const FREEZE_DRAG = 4;      // 1/s: the homing drift must win over the flow / vortex
export const FREEZE_FADE_S = 0.4;

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v, out) => { const l = len(v) || 1; out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l; return out; };
const cross = (a, b, out) => {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  out[0] = x; out[1] = y; out[2] = z; return out;
};
const _u = [0, 0, 0];
const flies = (b) => b.state === 'free' || (b.state === 'merging' && b.lead);

const _acc = [0, 0, 0];

// The hyper acceleration (phase-6 spec §3.5, V1): gravity plus drag toward an aether vortex about L̂ that turns a
// little slower than orbital speed and drains into the core, u = √(μ/r) [(1 − η) (L̂ × x)/r − η K x/r] with
// K = HYPER_INFLOW_K (fix/mercury-motion: a draining whirlpool). The headwind η both slows the turn and opens the drain,
// so the drag-locked beads ride spiral streamlines home; without the drain the overdamped infall (≈ g/γ) was too slow to
// land a desktop-reach swarm at any η, and the fallback η = 1 stopped the vortex dead (the beads sank straight down). Inside the core radius rC gravity is linear,
// as for a uniform ball (−μ x / rC³): a bead passing the centre gets no 1/r² kick. Scalars in, `out` written: the
// live flight and the solver's test particles share it, so their paths agree.
export const HYPER_INFLOW_K = 1; // the drain's speed per unit headwind, × the local orbital speed
export function hyperAccel(mu, eta, gamma, L, x, y, z, vx, vy, vz, rC, h, out) {
  const r2 = x * x + y * y + z * z;
  const r = Math.max(Math.sqrt(r2), 1e-6);
  const rg = Math.max(r, rC);
  const r3 = rg * rg * rg;
  const vo = Math.sqrt(mu / r) / r;
  const k = (1 - eta) * vo, d = eta * HYPER_INFLOW_K * vo;
  const ux = k * (L[1] * z - L[2] * y) - d * x, uy = k * (L[2] * x - L[0] * z) - d * y, uz = k * (L[0] * y - L[1] * x) - d * z;
  const gx = (-mu * x) / r3, gy = (-mu * y) / r3, gz = (-mu * z) / r3;
  // drag acts on v at the position's time (w = v + g h/2), not the stored half-step v: without it the symplectic
  // step adds a hidden headwind proportional to gamma * Omega * h
  out[0] = gx - gamma * (vx + 0.5 * h * gx - ux);
  out[1] = gy - gamma * (vy + 0.5 * h * gy - uy);
  out[2] = gz - gamma * (vz + 0.5 * h * gz - uz);
  return out;
}

// The hyper headwind schedule (V4 §10.3): none while the disc hangs, then eased in over `ramp` s from tHang so the
// gather has no kink (fix/mercury-motion). ramp 0 is the original step. Live flight and test particles share it.
export function hyperEta(t, tHang, eta, ramp) {
  if (ramp > 0) return eta * Math.min(1, Math.max(0, (t - tHang) / ramp));
  return t < tHang ? 0 : eta;
}

// How long a bead of radius r takes from first touching the planet to gone: the cascadeStep stage sequence
// (each stage one capillary time of its parent, × the family's tcScale; the last when the next daughter would
// fall under PX_FLOOR).
export function cascadeDuration(r, pxPerUnit, tcScale = 1) {
  let rK = r, T = 0;
  for (;;) {
    T += capillaryTime(rK);
    const rNext = DAUGHTER_RATIO * rK;
    if (rNext * pxPerUnit < PX_FLOOR) return T * tcScale;
    rK = rNext;
  }
}

export function stepFamily(fam, dt, env) {
  if (fam.phase !== 'fired' || !(dt > 0)) return fam;
  fam.acc += dt;
  while (fam.acc >= DROP_DT - 1e-12 && fam.phase === 'fired') {
    fam.acc -= DROP_DT;
    substep(fam, DROP_DT, env);
  }
  return fam;
}

function substep(fam, h, env) {
  fam.t += h;
  if (!((env.freezeIn ?? Infinity) > 0)) { crustFade(fam, h, env); return; }
  snapNecks(fam, env);
  for (const b of fam.bodies) {
    if (b.state !== 'attached') continue;
    qRotate(env.q, b.posBody, b.p);
    b.r = TONGUE_ROOT_R + (b.rMain - TONGUE_ROOT_R) * smooth(fam.t / b.tFree);
  }
  flight(fam, h, env);
  mergeStep(fam, h);
  collide(fam, env);
  cascadeStep(fam, h, env);
  for (const b of fam.bodies) {
    if (b.state !== 'free' || b.wobAmp <= 0) continue;
    b.wobT += h;
    b.wobAmp *= Math.exp((-h * WOB_DAMP_PER_TC) / capillaryTime(b.r));
  }
  if (fam.necks.every((n) => !n.on) && fam.bodies.every((b) => b.state === 'gone')) {
    fam.volResidual = fam.volOut;
    fam.volOut = 0;
    fam.phase = 'idle';
  }
}

// Crusted with Hg still out: no snaps, landings or cascades (nothing rings the crust); the bodies keep moving (flight,
// merges closing, attached and cascading ones riding the turning planet) while the whole family shrinks to nothing.
function crustFade(fam, h, env) {
  if (!(fam.tCrust >= 0)) {
    fam.tCrust = fam.t - h; fam.volFade0 = fam.volOut;
    for (const n of fam.necks) n.on = false;
  }
  const k = Math.max(0, 1 - (fam.t - fam.tCrust) / FREEZE_FADE_S);
  fam.fadeK = k;
  fam.volOut = fam.volFade0 * k * k * k;
  if (k <= 0) {
    for (const b of fam.bodies) { b.state = 'gone'; b.bridgeB = 0; b.neckH = 0; }
    fam.events.length = 0;
    fam.volResidual = 0;
    fam.volOut = 0;
    fam.phase = 'idle';
    return;
  }
  for (const b of fam.bodies) {
    if (b.state === 'attached') qRotate(env.q, b.posBody, b.p);
    else if (b.state === 'cascade') { const l = len(b.p); qRotate(env.q, b.dirBody, _u); b.p[0] = _u[0] * l; b.p[1] = _u[1] * l; b.p[2] = _u[2] * l; }
  }
  flight(fam, h, env);
  mergeStep(fam, h);
  fam.events.length = 0;
}

function launch(b, env) {
  if (b.state !== 'attached') return;
  b.state = 'free';
  b.r = b.rMain;
  cross(env.omega, b.p, b.v);
  unit(b.p, b.wobAxis);
  b.wobAmp = WOB_BIRTH;
  b.wobT = 0;
}

function snapNecks(fam, env) {
  for (const n of fam.necks) {
    if (!n.on || fam.t < n.tSnap) continue;
    n.on = false;
    const a = fam.bodies[n.a];
    if (n.b >= 0) {
      if (n.sat > 0) {
        const pb = fam.bodies[n.b].p;
        const w = [(a.p[0] + pb[0]) / 2, (a.p[1] + pb[1]) / 2, (a.p[2] + pb[2]) / 2];
        const s = addBody(fam, { state: 'free', p: w, r: n.sat, rMain: n.sat, vol: sphereVol(n.sat), wobAmp: WOB_BIRTH });
        cross(env.omega, w, s.v);
        unit([a.p[0] - pb[0], a.p[1] - pb[1], a.p[2] - pb[2]], s.wobAxis);
      }
    } else {
      // The root lets go last: its stub retracts into the planet at the Taylor–Culick speed, and the planet flinches.
      unit(a.p, _u);
      const R = env.planetRadiusAt(_u);
      const st = addBody(fam, {
        state: 'cascade', r: n.stub, rMain: n.stub, vol: sphereVol(n.stub), rK: n.stub, volK: sphereVol(n.stub),
        rNext: 0, final: true, stageD: (2 * n.stub) / taylorCulick(TONGUE_ROOT_R), p: [_u[0] * R, _u[1] * R, _u[2] * R],
      });
      qRotateInv(env.q, _u, st.dirBody);
      fam.events.push({ kind: 'ring', dir: [_u[0], _u[1], _u[2]], mode: IMPACT_MODE_AMP.ring * fam.e, wave: 0.5 * IMPACT_WAVE_AMP.ring * fam.e });
    }
    launch(a, env);
  }
}

function flight(fam, h, env) {
  const B = fam.bodies;
  // cohesion's reference volume: a hyper family's beads are core fragments, so its own mean bead (fireHyper)
  const vRef = fam.hyper ? fam.vRefH : env.vRef;
  // V4 §10.3: a hyper family orbits as a disc until tHang (no headwind, no cohesion), then gathers
  const hang = fam.hyper && fam.t < fam.tHang;
  const eta = fam.hyper ? hyperEta(fam.t, fam.tHang, fam.eta, fam.rampG || 0) : 0;
  const kappa = hang ? 0 : env.kappa;
  const fi = env.freezeIn ?? Infinity;
  const homing = fi > 0 && fi < Infinity;
  const homeT = homing ? Math.max(FREEZE_AIM * fi - 1 / FREEZE_DRAG, FREEZE_MIN_S) : 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!flies(b)) continue;
    const x = b.state === 'free' ? b.p : b.mergeC;
    let ax, ay, az;
    // refreezing: gravity only from the sim, and a firm drag toward a straight-home drift replaces the aether's
    const gam = homing ? 0 : fam.hyper ? fam.gammaH : env.gamma;
    if (fam.hyper) {
      hyperAccel(fam.mu, eta, gam, fam.axisL, x[0], x[1], x[2], b.v[0], b.v[1], b.v[2], fam.rC0, h, _acc);
      ax = _acc[0]; ay = _acc[1]; az = _acc[2];
    } else {
      const r2 = x[0] * x[0] + x[1] * x[1] + x[2] * x[2];
      const r3 = r2 * Math.sqrt(r2);
      ax = (-fam.mu * x[0]) / r3 - gam * b.v[0];
      ay = (-fam.mu * x[1]) / r3 - gam * b.v[1];
      az = (-fam.mu * x[2]) / r3 - gam * b.v[2];
    }
    if (homing) {
      unit(x, _u);
      const need = Math.max(0, len(x) - b.r - env.planetRadiusAt(_u)) / homeT;
      ax += FREEZE_DRAG * (-need * _u[0] - b.v[0]);
      ay += FREEZE_DRAG * (-need * _u[1] - b.v[1]);
      az += FREEZE_DRAG * (-need * _u[2] - b.v[2]);
    }
    if (kappa > 0) {
      for (let j = 0; j < B.length; j++) {
        const o = B[j];
        if (j === i || !flies(o)) continue;
        const y = o.state === 'free' ? o.p : o.mergeC;
        const vo = o.state === 'free' ? o.vol : o.vol + B[o.partner].vol;
        const dx = y[0] - x[0], dy = y[1] - x[1], dz = y[2] - x[2];
        const soft = COHESION_SOFT * (b.r + o.r);
        const q = dx * dx + dy * dy + dz * dz + soft * soft;
        const f = (kappa * (vo / vRef)) / (q * Math.sqrt(q));
        ax += f * dx; ay += f * dy; az += f * dz;
      }
    }
    b.a[0] = ax; b.a[1] = ay; b.a[2] = az;
    b.v[0] += ax * h; b.v[1] += ay * h; b.v[2] += az * h;
    x[0] += b.v[0] * h; x[1] += b.v[1] * h; x[2] += b.v[2] * h;
  }
}

function startMerge(fam, i, j) {
  const b = fam.bodies[i], o = fam.bodies[j];
  const V = b.vol + o.vol;
  let rel = 0;
  for (let c = 0; c < 3; c++) {
    b.mergeC[c] = (b.vol * b.p[c] + o.vol * o.p[c]) / V;
    b.mergeOffA[c] = b.p[c] - b.mergeC[c];
    b.mergeOffB[c] = o.p[c] - b.mergeC[c];
    rel += (b.v[c] - o.v[c]) ** 2;
    b.v[c] = (b.vol * b.v[c] + o.vol * o.v[c]) / V;
  }
  b.mergeVrel = Math.sqrt(rel);
  b.mergeRSmall = Math.min(b.r, o.r);
  b.mergeT = 0; b.bridgeB = 0;
  b.state = 'merging'; b.lead = true; b.partner = j;
  o.state = 'merging'; o.lead = false; o.partner = i;
}

function finishMerge(fam, b) {
  const o = fam.bodies[b.partner];
  const ax = [b.mergeOffA[0] - b.mergeOffB[0], b.mergeOffA[1] - b.mergeOffB[1], b.mergeOffA[2] - b.mergeOffB[2]];
  if (len(ax) > 1e-9) unit(ax, b.wobAxis);
  b.vol += o.vol; o.vol = 0; o.state = 'gone'; o.partner = -1;
  b.r = radiusOfVol(b.vol); b.rMain = b.r;
  b.p[0] = b.mergeC[0]; b.p[1] = b.mergeC[1]; b.p[2] = b.mergeC[2];
  b.wobAmp = Math.min(WOB_MAX, 0.5 * WOB_BIRTH + WOB_IMPACT_K * b.mergeVrel);
  b.wobT = 0;
  b.state = 'free'; b.lead = false; b.partner = -1; b.bridgeB = 0;
}

function mergeStep(fam, h) {
  for (const b of fam.bodies) {
    if (b.state !== 'merging' || !b.lead) continue;
    const o = fam.bodies[b.partner];
    b.mergeT += h;
    const s = Math.min(1, bridgeRadius(b.mergeRSmall, b.mergeT) / b.mergeRSmall);
    b.bridgeB = s * b.mergeRSmall;
    for (let c = 0; c < 3; c++) {
      b.p[c] = b.mergeC[c] + b.mergeOffA[c] * (1 - s);
      o.p[c] = b.mergeC[c] + b.mergeOffB[c] * (1 - s);
    }
    if (s >= 1) finishMerge(fam, b);
  }
}

function strike(fam, b, dir, vn, env) {
  const vd = b.final ? b.volK : b.volK * (1 - DAUGHTER_RATIO ** 3);
  const vnK = 0.5 + 0.5 * Math.min(1, Math.max(vn, 0) / STRIKE_V_REF);
  // phase 6: one swarm, one splash of energy. Hyper beads outweigh a phase-5 drop, so on the phase-5 scale ~8 of them
  // land at full strength within 2 s and their rings beat into bands. s² is each strike's share of the swarm volume
  // (Σ vd ≤ volFamily, so Σ s² ≤ 1).
  const s = fam.hyper ? Math.sqrt(vd / fam.volFamily) * vnK : Math.min(1, (vd / env.vRef) * vnK);
  // the local ring ∝ s; the whole-sphere body modes ∝ s² (the droplet's share of the planet's momentum, fix/mercury-motion):
  // P2/P4 are even, so a small droplet's mode dented the antipode about as hard as its faint ring rang at the touchdown.
  // A full-strength drop (s = 1) keeps both as before.
  fam.events.push({ kind: 'splash', dir: [dir[0], dir[1], dir[2]], mode: IMPACT_MODE_AMP.splash * s * s, wave: IMPACT_WAVE_AMP.splash * s });
}

function startCascade(fam, b, env, vn) {
  unit(b.p, _u);
  b.state = 'cascade';
  qRotateInv(env.q, _u, b.dirBody);
  b.stage = 0; b.stageT = 0;
  b.rK = b.r; b.volK = b.vol; b.rNext = DAUGHTER_RATIO * b.r;
  b.final = b.rNext * env.pxPerUnit < PX_FLOOR;
  b.stageD = capillaryTime(b.rK) * fam.tcScale;
  b.v[0] = b.v[1] = b.v[2] = 0; b.wobAmp = 0;
  strike(fam, b, _u, vn, env);
}

function collide(fam, env) {
  if (fam.t < fam.tGrace) return; // phase 6: hyper beads are born touching each other and the core (V3)
  const B = fam.bodies;
  for (let i = 0; i < B.length; i++) {
    if (B[i].state !== 'free') continue;
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i], o = B[j];
      if (o.state !== 'free') continue;
      const d = Math.hypot(a.p[0] - o.p[0], a.p[1] - o.p[1], a.p[2] - o.p[2]);
      if (d < a.r + o.r) {
        if (a.vol >= o.vol) startMerge(fam, i, j); else startMerge(fam, j, i);
        break;
      }
    }
  }
  for (const b of B) {
    if (b.state === 'free') {
      unit(b.p, _u);
      if (len(b.p) - b.r <= env.planetRadiusAt(_u)) startCascade(fam, b, env, -(b.v[0] * _u[0] + b.v[1] * _u[1] + b.v[2] * _u[2]));
    } else if (b.state === 'merging' && b.lead) {
      unit(b.mergeC, _u);
      const rr = radiusOfVol(b.vol + B[b.partner].vol);
      if (len(b.mergeC) - rr <= env.planetRadiusAt(_u)) {
        const vn = -(b.v[0] * _u[0] + b.v[1] * _u[1] + b.v[2] * _u[2]);
        finishMerge(fam, b);
        startCascade(fam, b, env, vn);
      }
    }
  }
}

function drainTo(fam, b, vol) {
  const v = Math.max(vol, 0);
  fam.volOut -= b.vol - v;
  b.vol = v;
  b.r = radiusOfVol(v);
}

function cascadeStep(fam, h, env) {
  for (const b of fam.bodies) {
    if (b.state !== 'cascade') continue;
    qRotate(env.q, b.dirBody, _u);
    const R = env.planetRadiusAt(_u);
    b.stageT += h;
    const u = b.stageT / b.stageD;
    const vN = b.final ? 0 : b.volK * DAUGHTER_RATIO ** 3;
    let lift;
    if (b.final || u < DRAIN_SHARE) {
      const du = b.final ? u : u / DRAIN_SHARE;
      drainTo(fam, b, b.volK - (b.volK - vN) * smooth(du));
      b.bridgeB = Math.min(b.rK, bridgeRadius(b.rK, b.stageT));
      b.neckH = 0;
      lift = b.r * (1 - SINK * smooth(du));
    } else {
      drainTo(fam, b, vN);
      const w = (u - DRAIN_SHARE) / (1 - DRAIN_SHARE);
      b.bridgeB = 0;
      b.neckH = pinchRadius(HOP_NECK * b.r, w, HOP_NECK_T);
      lift = b.r + HOP_K * b.r * Math.sin(Math.PI * Math.min(w, 1));
    }
    b.p[0] = _u[0] * (R + lift); b.p[1] = _u[1] * (R + lift); b.p[2] = _u[2] * (R + lift);
    if (u < 1) continue;
    if (b.final) {
      drainTo(fam, b, 0);
      b.state = 'gone'; b.bridgeB = 0; b.neckH = 0;
      continue;
    }
    const hopV = (Math.PI * HOP_K * b.r) / ((1 - DRAIN_SHARE) * b.stageD);
    b.stage += 1; b.rK = b.r; b.volK = b.vol; b.rNext = DAUGHTER_RATIO * b.rK;
    b.final = b.rNext * env.pxPerUnit < PX_FLOOR;
    b.stageT = 0; b.stageD = capillaryTime(b.rK) * fam.tcScale;
    strike(fam, b, _u, hopV, env);
  }
}
