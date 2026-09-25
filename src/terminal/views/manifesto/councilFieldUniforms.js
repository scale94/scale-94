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
  };

  const setPair = (mA, mB) => {
    const a = seatXY(mA), b = seatXY(mB);
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
  };
  const simPair = sim.pair ? [seated[sim.pair[0]], seated[sim.pair[1]]] : null;

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
    if (sim.isUser && simPair) {
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
    if (sim.isUser && simPair && sim.phase === 'COOLDOWN') {
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

export function infallArmPoint(seatAngleDeg, prog) {
  const r = R_SEAT * (1 - prog ** 3);
  const th = seatAngleDeg + SPIRAL_DEG * (1 - r / R_SEAT);
  const rad = ((th - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

export function jetHead(eject, phaseT) {
  const L = eject[1] * (1 - (1 - phaseT) ** 3);
  return { x: CX + L * Math.cos(eject[0]), y: CY + L * Math.sin(eject[0]) };
}
