// useSolStar.js — the star's simulation and the hand, held entirely in refs.
//
// Owns one star (regions.js), one camera (solCamera.js) and the pointer. The
// canvas calls frame(dt) and uniforms() from its draw loop; the pointer
// handlers go on the canvas. Nothing here sets React state, per frame or per
// move: the returned object is created once and is stable for the hook's life.
//
// Frames: the star frame is NON-rotating. regions.js advances each region's
// lon by omega(lat) itself, and the shader drifts the plasma at the same
// omega(lat), so rotLon is always 0 here.
//
// The hold ends on: pointer up, pointer cancel, lost capture, pointer leave
// when capture could not be taken, or a snap of the held region (threshold
// crossed while stirring, or inside stepStar). After a snap the rest of that
// drag does nothing. The canvas rect is re-read on every move, so a scroll or
// resize mid-drag does not offset the pointer maths.
//
// Reduced motion: the frame loop does not run (the harness halts it). The
// star neither winds nor turns itself (selfWind off, and each step's
// rotation is undone, matching the shader's frozen plasma). Each pointer move
// of a stir steps the simulation by the wall-clock time since the previous
// event of that drag (clamped to 0.05 s), applies the stir, then asks for one
// redraw; an orbit drag moves the camera with no coast.

import { useRef } from 'react';
import { createStar, stepStar, applyStir, grab, release, regionTurns, MAX_REGIONS } from './regions';
import { createCamera, orbitDrag, stepCamera, pick, viewNormal, STAR_RADIUS_NDC } from './solCamera';
import { stirDelta } from './stir';
import { tensionG, facesCamera, TENSION_QUIET_G, TENSION_SNAP_G } from './solPhysics';

const ROT_LON = 0;
const RM_DT_MAX = 0.05;   // s; the most one pointer event may step under reduced motion
const TO_CAMERA = [0, 0, 1];
const fin = (v) => (Number.isFinite(v) ? v : 0);
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

function validRect(r) {
  return r && Number.isFinite(r.left) && Number.isFinite(r.top) && r.width > 0 && r.height > 0;
}

function createSolStar(onSnapRef, getRectRef, optsRef) {
  const star = createStar(Math.random);
  const cam = createCamera();

  // Pointer state. mode: null (no pointer) | 'stir' | 'orbit' | 'spent' (snapped mid-drag).
  let pointerId = null;
  let mode = null;
  let heldId = null;
  let rect = null;
  let prev = null;
  let captured = false;     // pointer capture taken; if not, pointerleave ends the hold
  let lastT = null;         // reduced motion: wall clock (ms) of the previous event of this drag

  const pos = new Float32Array(MAX_REGIONS * 3);
  const twist = new Float32Array(MAX_REGIONS);
  const tension = new Float32Array(MAX_REGIONS);

  const findRegion = (id) => (id == null ? null : star.regions.find((r) => r.id === id) || null);
  const reduced = () => !!optsRef.current.reducedMotion;
  const requestDraw = () => optsRef.current.requestDraw?.();
  const nowMs = () => {
    const f = optsRef.current.now;
    const t = typeof f === 'function' ? f() : performance.now();
    return Number.isFinite(t) ? t : null;
  };

  function emit(ev) {
    if (!ev) return;
    const facing = facesCamera(viewNormal(cam, ev.lat, ev.lon, ROT_LON), TO_CAMERA);
    onSnapRef.current?.({ ...ev, facing });
  }

  function endHoldBySnap() {
    heldId = null;
    if (mode === 'stir') mode = 'spent';
  }

  function readRect(e) {
    const r = getRectRef.current ? getRectRef.current() : e?.currentTarget?.getBoundingClientRect?.();
    if (!validRect(r)) return false;
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    return true;
  }

  // One simulation step. Under reduced motion the star does not wind itself
  // and does not turn: regions.js always moves lon by omega(lat) dt, so that
  // rotation is undone here (the shader's plasma is frozen too).
  function step(dt) {
    let events;
    if (reduced()) {
      const regs = star.regions.slice();
      const lons = regs.map((r) => r.lon);
      events = stepStar(star, dt, { selfWind: false });
      for (let i = 0; i < regs.length; i++) regs[i].lon = lons[i];
    } else {
      events = stepStar(star, dt);
    }
    for (const ev of events) {
      if (ev.regionId === heldId) endHoldBySnap();
      emit(ev);
    }
    if (heldId != null && !findRegion(heldId)) endHoldBySnap();
  }

  function local(e) {
    if (!rect) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  // Screen position (canvas px) of a region, riding with rotation and orbit.
  function regionScreen(r) {
    const n = viewNormal(cam, r.lat, r.lon, ROT_LON);
    const radius = (STAR_RADIUS_NDC * Math.min(rect.width, rect.height)) / 2;
    return { x: rect.width / 2 + n[0] * radius, y: rect.height / 2 - n[1] * radius };
  }

  function endPointer(e, { releaseCapture }) {
    if (pointerId == null || e?.pointerId !== pointerId) return;
    if (releaseCapture) {
      try { e.currentTarget?.releasePointerCapture?.(pointerId); } catch { /* already released */ }
    }
    const id = heldId;
    pointerId = null;
    mode = null;
    heldId = null;
    prev = null;
    captured = false;
    lastT = null;
    if (id != null && findRegion(id)) emit(release(star, id));
    if (reduced()) requestDraw();
  }

  const handlers = {
    onPointerDown(e) {
      if (pointerId != null) return;              // only the first pointer stirs
      if (e.button != null && e.button !== 0) return;
      if (!readRect(e)) return;
      const p = local(e);
      if (!p) return;
      pointerId = e.pointerId;
      captured = false;
      try {
        const t = e.currentTarget;
        if (t?.setPointerCapture) {
          t.setPointerCapture(e.pointerId);
          captured = typeof t.hasPointerCapture === 'function' ? !!t.hasPointerCapture(e.pointerId) : true;
        }
      } catch { captured = false; /* not capturable: pointerleave ends the hold */ }
      prev = p;
      lastT = reduced() ? nowMs() : null;
      const hit = pick(cam, p.x, p.y, rect.width, rect.height, ROT_LON);
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
        heldId = grab(star, hit.lat, hit.lon);
        mode = 'stir';
      } else {
        heldId = null;
        mode = 'orbit';
      }
      if (reduced()) requestDraw();
    },

    onPointerMove(e) {
      if (pointerId == null || e.pointerId !== pointerId) return;
      readRect(e);                                   // a scroll or resize mid-drag moves the canvas
      const p = local(e);
      if (!p) return;
      const rm = reduced();
      if (rm && mode === 'stir') {
        // the pointer is the clock: step by the time since the last event
        const t = nowMs();
        const dt = t != null && lastT != null ? Math.min(Math.max((t - lastT) / 1000, 0), RM_DT_MAX) : 0;
        lastT = t;
        if (dt > 0) step(dt);
      }
      if (mode === 'orbit') {
        orbitDrag(cam, p.x - prev.x, p.y - prev.y, Math.min(rect.width, rect.height));
        if (rm) { cam.yawVel = 0; cam.pitchVel = 0; }   // no coast: nothing moves on its own
      } else if (mode === 'stir') {
        const r = findRegion(heldId);
        if (!r) {
          endHoldBySnap();
        } else {
          const d = stirDelta(prev, p, regionScreen(r));
          if (d !== 0) {
            const ev = applyStir(star, heldId, d);
            if (ev) { endHoldBySnap(); emit(ev); }
          }
        }
      }
      prev = p;
      if (rm) requestDraw();
    },

    onPointerUp(e) { endPointer(e, { releaseCapture: true }); },
    onPointerCancel(e) { endPointer(e, { releaseCapture: true }); },
    onLostPointerCapture(e) { endPointer(e, { releaseCapture: false }); },
    // Only when capture could not be taken: otherwise the canvas keeps the
    // pointer outside its box and up/cancel/lost-capture end the hold.
    onPointerLeave(e) { if (!captured) endPointer(e, { releaseCapture: false }); },
  };

  function frame(dtSeconds) {
    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    if (dt === 0) return;
    stepCamera(cam, dt);
    step(dt);
  }

  const tension01 = (r) =>
    clamp01((tensionG(regionTurns(r)) - TENSION_QUIET_G) / (TENSION_SNAP_G - TENSION_QUIET_G));

  // One object, refilled in place every call (no per-frame allocation).
  const out = {
    uCamYaw: 0,
    uCamPitch: 0,
    uRotLon: ROT_LON,
    uStarRadius: STAR_RADIUS_NDC,
    uRegionCount: 0,
    uRegionPos: pos,
    uRegionTwist: twist,
    uRegionTension: tension,
  };

  function uniforms() {
    const regions = star.regions;
    const n = Math.min(regions.length, MAX_REGIONS);
    pos.fill(0);
    twist.fill(0);
    tension.fill(0);
    for (let i = 0; i < n; i++) {
      const r = regions[i];
      const lat = fin(r.lat);
      const lon = fin(r.lon);
      const cl = Math.cos(lat);
      pos[i * 3] = cl * Math.sin(lon);
      pos[i * 3 + 1] = Math.sin(lat);
      pos[i * 3 + 2] = cl * Math.cos(lon);
      // The swirl is the hand's signature only: the star's own winding shows
      // through tension (pores, arch), never as a spiral.
      twist[i] = fin(r.handTurns);
      tension[i] = fin(tension01(r));
    }
    out.uCamYaw = fin(cam.yaw);
    out.uCamPitch = fin(cam.pitch);
    out.uRegionCount = n;
    return out;
  }

  function hud() {
    const held = findRegion(heldId);
    if (held) return { tensionG: fin(tensionG(regionTurns(held))) };
    let best = 0;
    for (const r of star.regions) best = Math.max(best, fin(regionTurns(r)));
    return { tensionG: tensionG(best) };
  }

  return {
    frame,
    uniforms,
    handlers,
    hud,
    // Inspection for tests and DEV tooling; not part of the drawing contract.
    _debug: () => ({ star, cam }),
  };
}

/**
 * @param {{
 *   onSnap?: (e: object) => void,
 *   getRect?: () => DOMRect,
 *   reducedMotion?: boolean,
 *   requestDraw?: () => void,
 *   now?: () => number,
 * }} [opts] `now` is the wall clock in ms (injectable for tests).
 */
export function useSolStar({ onSnap, getRect, reducedMotion = false, requestDraw, now } = {}) {
  const onSnapRef = useRef(onSnap);
  const getRectRef = useRef(getRect);
  const optsRef = useRef({ reducedMotion, requestDraw, now });
  onSnapRef.current = onSnap;
  getRectRef.current = getRect;
  optsRef.current = { reducedMotion, requestDraw, now };
  const apiRef = useRef(null);
  if (apiRef.current === null) apiRef.current = createSolStar(onSnapRef, getRectRef, optsRef);
  return apiRef.current;
}
