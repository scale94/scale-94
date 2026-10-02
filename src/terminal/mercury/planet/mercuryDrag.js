// Drag on the canvas → the angular velocity the body is gripped toward
// (mercuryBody.stepBody). Screen y grows downward: dragging down spins about +X,
// which carries the front surface down; dragging right spins about +Y, carrying
// it right.

export const DRAG_RAD_PER_HEIGHT = 2.5; // a full-canvas-height drag turns the body 2.5 rad
export const POINTER_HOLD_MS = 60; // no move for this long = holding still
export const MIN_POINTER_DT_S = 1 / 1000; // only guards identical timestamps
export const VELOCITY_WINDOW_MS = 12; // pointer speed is measured over at least this long, so it does not depend on the event rate
export const PTR_WINDOW_MS = 60; // phase 6: the release pointer ω is the displacement over this long before release
const RING = 64;                 // move samples kept for it (a 1 kHz pointer still spans the window)

const ZERO = Object.freeze([0, 0, 0]);

export function pointerOmega(dxPx, dyPx, dtS, heightPx) {
  const k = (DRAG_RAD_PER_HEIGHT / Math.max(heightPx, 1)) / Math.max(dtS, MIN_POINTER_DT_S);
  return [dyPx * k, dxPx * k, 0];
}

export function createDragTracker() {
  // wx/wy/wT: where and when the current velocity window started.
  const s = { dragging: false, wx: 0, wy: 0, wT: 0, lastMoveMs: 0, omega: ZERO, nx: 0, ny: 0, aimed: false, released: false, heightPx: 1, releaseOmega: 0 };
  // The last RING pointer samples (preallocated ring) for the release pointer ω.
  const ring = { x: new Float64Array(RING), y: new Float64Array(RING), t: new Float64Array(RING), n: 0, head: 0 };
  const push = (x, y, tMs) => {
    ring.x[ring.head] = x; ring.y[ring.head] = y; ring.t[ring.head] = tMs;
    ring.head = (ring.head + 1) % RING;
    ring.n = Math.min(ring.n + 1, RING);
  };
  // |pointer ω| from the oldest sample inside PTR_WINDOW_MS of the newest one to the newest one.
  const releaseOmegaOf = (upMs) => {
    if (ring.n < 2 || upMs - s.lastMoveMs > POINTER_HOLD_MS) return 0;
    const iN = (ring.head - 1 + RING) % RING;
    let iO = iN;
    for (let k = 1; k < ring.n; k++) {
      const i = (ring.head - 1 - k + 2 * RING) % RING;
      if (ring.t[iN] - ring.t[i] > PTR_WINDOW_MS) break;
      iO = i;
    }
    if (iO === iN) return 0;
    const w = pointerOmega(ring.x[iN] - ring.x[iO], ring.y[iN] - ring.y[iO], (ring.t[iN] - ring.t[iO]) / 1000, s.heightPx);
    return Math.hypot(w[0], w[1]);
  };
  // One result object, refilled every sample() so the render loop allocates nothing.
  const result = { dragging: false, omegaPtr: [0, 0, 0], ndc: [0, 0], aimed: false, released: false, releaseOmegaPtr: 0 };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, wx: x, wy: y, wT: tMs, lastMoveMs: tMs, omega: ZERO, releaseOmega: 0 });
      ring.n = 0; ring.head = 0;
      push(x, y, tMs);
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.lastMoveMs = tMs;
      s.heightPx = heightPx;
      push(x, y, tMs);
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
    up(tMs = s.lastMoveMs) {
      if (s.dragging) {
        s.released = true;
        s.releaseOmega = releaseOmegaOf(tMs);
      }
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
      result.releaseOmegaPtr = s.released ? s.releaseOmega : 0;
      s.released = false;
      return result;
    },
  };
}
