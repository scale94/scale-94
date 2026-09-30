// Drag on the canvas → the angular velocity the body is gripped toward
// (mercuryBody.stepBody). Screen y grows downward: dragging down spins about +X,
// which carries the front surface down; dragging right spins about +Y, carrying
// it right.

export const DRAG_RAD_PER_HEIGHT = 2.5; // a full-canvas-height drag turns the body 2.5 rad
export const POINTER_HOLD_MS = 60; // no move for this long = holding still
export const MIN_POINTER_DT_S = 1 / 240;

const ZERO = Object.freeze([0, 0, 0]);

export function pointerOmega(dxPx, dyPx, dtS, heightPx) {
  const k = (DRAG_RAD_PER_HEIGHT / Math.max(heightPx, 1)) / Math.max(dtS, MIN_POINTER_DT_S);
  return [dyPx * k, dxPx * k, 0];
}

export function createDragTracker() {
  const s = { dragging: false, x: 0, y: 0, tMs: 0, lastMoveMs: 0, omega: ZERO };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, x, y, tMs, lastMoveMs: tMs, omega: ZERO });
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.omega = pointerOmega(x - s.x, y - s.y, (tMs - s.tMs) / 1000, heightPx);
      Object.assign(s, { x, y, tMs, lastMoveMs: tMs });
    },
    up() {
      s.dragging = false;
      s.omega = ZERO;
    },
    sample(nowMs) {
      const held = nowMs - s.lastMoveMs > POINTER_HOLD_MS;
      return { dragging: s.dragging, omegaPtr: s.dragging && !held ? [...s.omega] : [0, 0, 0] };
    },
  };
}
