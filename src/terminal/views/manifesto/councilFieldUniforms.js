// src/terminal/views/manifesto/councilFieldUniforms.js
// Collider state → accretion-field uniforms (field spec §5, §6), plus the JS
// mirrors of the GLSL infall arm and jet head that pin them to the 2D loop.
// Pure: reads sim/ui snapshots, never writes them.

import { polarToXY } from './councilRingMath';
import { COLLIDER_TIMING } from './useCouncilCollider';
import { flowLayers } from './councilMatter';

const CX = 320, CY = 320, R_SEAT = 220;
const VIEW_X0 = -170, VIEW_W = 980, VIEW_H = 640;
const FOUNDATION_COLOR = '#FF0088';
const PHASE_MS = {
  INFALL: COLLIDER_TIMING.T_INFALL,
  FLASH: COLLIDER_TIMING.T_FLASH,
  EJECT: COLLIDER_TIMING.T_EJECT,
  COOLDOWN: COLLIDER_TIMING.T_COOLDOWN,
};
const FLIGHT = new Set(['INFALL', 'FLASH', 'EJECT', 'COOLDOWN']);

export const UI_MODE = { AMBIENT: 0, ARMED: 1, FIRING: 2, SYNTHESIZED: 3 };
export const ANIM_PHASE = { IDLE: 0, INFALL: 1, FLASH: 2, EJECT: 3, COOLDOWN: 4 };
export const AMBIENT_INTENSITY = 0.4;
export const SPIRAL_DEG = (0.9 * 180) / Math.PI; // SPIRAL_GAIN in degrees
export const DELAY_MAX = 900;  // ms: the 2D loop's largest particle delay
export const WOBBLE_DEG = 7;   // the 2D loop's particle wobble is ±14/2 degrees
export const ARM_POINTS = 25;  // polyline points per infall arm (24 segments)

// Arm polylines in viewBox units, filled in place (never reallocated) and
// uploaded as u_armA / u_armB. Rewritten only during INFALL.
const ARM_A = new Float32Array(2 * ARM_POINTS);
const ARM_B = new Float32Array(2 * ARM_POINTS);

export const toRing = (x, y) => [(x - VIEW_X0) / VIEW_W, 1 - y / VIEW_H];

export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
}

const seatXY = (mind) => polarToXY(mind.angle, R_SEAT, CX, CY);
const byDim = (seated, d) => seated.find((m) => m.dimIndex === d) ?? null;

export function readFieldUniforms(sim, ui, seated, pointer, nowMs) {
  const f = flowLayers(nowMs / 1000);
  const u = {
    time: nowMs / 1000,
    uiMode: UI_MODE[ui.mode] ?? UI_MODE.AMBIENT,
    animPhase: ANIM_PHASE.IDLE,
    phaseT: 0,
    phaseMs: 0,
    seatA: [0, 0], seatB: [0, 0],
    colorA: [0, 0, 0], colorB: [0, 0, 0],
    pointer: pointer ? toRing(pointer.x, pointer.y) : [0, 0],
    pointerLive: pointer ? 1 : 0,
    intensity: 0,
    eject: [0, 0, 0], ejectColor: [0, 0, 0],
    flow: [f.tau0, f.tau1, f.seed0, f.seed1],
    flowW: f.w0,
    armA: ARM_A, armB: ARM_B,
    armProg: [0, 0],
  };

  let seatVA = null, seatVB = null; // viewBox seat positions of the pair
  const setPair = (mA, mB) => {
    const a = seatXY(mA), b = seatXY(mB);
    seatVA = a;
    seatVB = b;
    u.seatA = toRing(a.x, a.y);
    u.seatB = toRing(b.x, b.y);
    u.colorA = hexToLinear(mA.hue);
    u.colorB = hexToLinear(mB.hue);
  };
  const setAnim = () => {
    u.animPhase = ANIM_PHASE[sim.phase] ?? ANIM_PHASE.IDLE;
    const dur = PHASE_MS[sim.phase];
    u.phaseMs = dur ? nowMs - sim.t0 : 0;
    u.phaseT = dur ? Math.min(1, Math.max(0, (nowMs - sim.t0) / dur)) : 0;
    if (sim.product) {
      u.eject = [
        ((sim.product.angle - 90) * Math.PI) / 180,
        sim.product.targetR,
        sim.product.color === FOUNDATION_COLOR ? -1 : 1,
      ];
      u.ejectColor = hexToLinear(sim.product.color);
    }
    if (u.animPhase === ANIM_PHASE.INFALL) {
      const [trail, lead] = armProgress(u.phaseMs);
      u.armProg = [trail, lead];
      fillInfallArm(ARM_A, seatAngleFromXY(seatVA.x, seatVA.y), trail, lead);
      fillInfallArm(ARM_B, seatAngleFromXY(seatVB.x, seatVB.y), trail, lead);
    }
  };
  const simPair = sim.pair ? [seated[sim.pair[0]], seated[sim.pair[1]]] : null;
  // The collider never clears sim.isUser, so after SYNTHESIZED → ARMED →
  // FIRING the sim still holds the previous user pair until the loop starts
  // the new cycle. A user sim counts only when it carries the minds ui.pair
  // names. Ordered: the collider stages ui.pair [dA, dB] as seat indexes
  // [idx(dA), idx(dB)] and spawns sim.pair in that order.
  const userSim = sim.isUser && simPair && ui.pair
    && simPair[0]?.dimIndex === ui.pair[0] && simPair[1]?.dimIndex === ui.pair[1];

  // §6 rule 1 — the filament belongs to the armed mind; in-flight ambient
  // collisions stay 2D-only.
  if (ui.mode === 'ARMED') {
    const m = byDim(seated, ui.armedDim);
    if (!m) return u;
    setPair(m, m);
    if (pointer) u.seatB = u.pointer;
    u.intensity = 1;
    return u;
  }

  // §6 rule 2 — a user flight drives dynamics; an ambient cycle still in the
  // air under FIRING shows the user's pair as a static bridge instead.
  if (ui.mode === 'FIRING') {
    if (userSim) {
      setPair(...simPair);
      setAnim();
    } else {
      const [dA, dB] = ui.pair ?? [];
      const mA = byDim(seated, dA), mB = byDim(seated, dB);
      if (!mA || !mB) return u;
      setPair(mA, mB);
    }
    u.intensity = 1;
    return u;
  }

  // Plan amendment 5 — SYNTHESIZED rests without a bridge; only the user
  // cycle's cooldown carries through so the disk boost can relax.
  if (ui.mode === 'SYNTHESIZED') {
    if (userSim && sim.phase === 'COOLDOWN') {
      setPair(...simPair);
      setAnim();
      u.intensity = 1;
    }
    return u;
  }

  // §6 rules 3–4 — AMBIENT: flight phases at ambient intensity, else off.
  if (simPair && FLIGHT.has(sim.phase)) {
    setPair(...simPair);
    setAnim();
    u.intensity = AMBIENT_INTENSITY;
  }
  return u;
}

// ── JS mirrors of the GLSL geometry (tested against the 2D loop) ───────────

export const seatAngleFromXY = (x, y) => (Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90;

// Writes the arm point at `prog` into out[i], out[i + 1] (allocation-free core).
function writeArmPoint(out, i, seatAngleDeg, prog) {
  const r = R_SEAT * (1 - prog ** 3);
  const th = seatAngleDeg + SPIRAL_DEG * (1 - r / R_SEAT);
  const rad = ((th - 90) * Math.PI) / 180;
  out[i] = CX + r * Math.cos(rad);
  out[i + 1] = CY + r * Math.sin(rad);
}

export function infallArmPoint(seatAngleDeg, prog) {
  const pt = [0, 0];
  writeArmPoint(pt, 0, seatAngleDeg, prog);
  return { x: pt[0], y: pt[1] };
}

// Arm progress window (trail, lead), exactly as the shader's infallArm() had
// it: the lead particle starts at once, the last one DELAY_MAX ms later.
export function armProgress(phaseMs) {
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  return [clamp01((phaseMs - DELAY_MAX) / PHASE_MS.INFALL), clamp01(phaseMs / PHASE_MS.INFALL)];
}

// ARM_POINTS points evenly spaced in progress from trail to lead, the same
// mix(trail, lead, k / 24) the shader loop used.
export function fillInfallArm(out, seatAngleDeg, trail, lead) {
  const n = ARM_POINTS - 1;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    writeArmPoint(out, 2 * k, seatAngleDeg, trail * (1 - t) + lead * t);
  }
}

export function jetHead(eject, phaseT) {
  const L = eject[1] * (1 - (1 - phaseT) ** 3);
  return { x: CX + L * Math.cos(eject[0]), y: CY + L * Math.sin(eject[0]) };
}
