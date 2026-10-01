// Drag on the canvas → the angular velocity the body is gripped toward
// (mercuryBody.stepBody). Screen y grows downward: dragging down spins about +X,
// which carries the front surface down; dragging right spins about +Y, carrying
// it right.

export const DRAG_RAD_PER_HEIGHT = 2.5; // a full-canvas-height drag turns the body 2.5 rad
export const POINTER_HOLD_MS = 60; // no move for this long = holding still
export const MIN_POINTER_DT_S = 1 / 1000; // only guards identical timestamps
export const VELOCITY_WINDOW_MS = 12; // pointer speed is measured over at least this long, so it does not depend on the event rate

const ZERO = Object.freeze([0, 0, 0]);

export function pointerOmega(dxPx, dyPx, dtS, heightPx) {
  const k = (DRAG_RAD_PER_HEIGHT / Math.max(heightPx, 1)) / Math.max(dtS, MIN_POINTER_DT_S);
  return [dyPx * k, dxPx * k, 0];
}

export function createDragTracker() {
  // wx/wy/wT: where and when the current velocity window started.
  const s = { dragging: false, wx: 0, wy: 0, wT: 0, lastMoveMs: 0, omega: ZERO, nx: 0, ny: 0, aimed: false, released: false };
  // One result object, refilled every sample() so the render loop allocates nothing.
  const result = { dragging: false, omegaPtr: [0, 0, 0], ndc: [0, 0], aimed: false, released: false };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, wx: x, wy: y, wT: tMs, lastMoveMs: tMs, omega: ZERO });
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.lastMoveMs = tMs;
      if (tMs - s.wT < VELOCITY_WINDOW_MS) return;
      s.omega = pointerOmega(x - s.wx, y - s.wy, (tMs - s.wT) / 1000, heightPx);
      Object.assign(s, { wx: x, wy: y, wT: tMs });
    },
    // Where the pointer is, in normalised device coordinates (for the drag point on the bead).
    aim(nx, ny) {
      s.nx = nx;
      s.ny = ny;
      s.aimed = true;
    },
    up() {
      if (s.dragging) s.released = true;
      s.dragging = false;
      s.omega = ZERO;
    },
    sample(nowMs) {
      const live = s.dragging && nowMs - s.lastMoveMs <= POINTER_HOLD_MS;
      result.dragging = s.dragging;
      result.omegaPtr[0] = live ? s.omega[0] : 0;
      result.omegaPtr[1] = live ? s.omega[1] : 0;
      result.omegaPtr[2] = live ? s.omega[2] : 0;
      result.ndc[0] = s.nx;
      result.ndc[1] = s.ny;
      result.aimed = s.aimed;
      result.released = s.released;
      s.released = false;
      return result;
    },
  };
}
