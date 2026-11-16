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
// The hold ends on: pointer up, pointer cancel, lost capture, or a snap of
// the held region (threshold crossed while stirring, or inside stepStar).
// After a snap the rest of that drag does nothing.

import { useRef } from 'react';
import { createStar, stepStar, applyStir, grab, release, regionTurns, MAX_REGIONS } from './regions';
import { createCamera, orbitDrag, stepCamera, pick, viewNormal, STAR_RADIUS_NDC } from './solCamera';
import { stirDelta } from './stir';
import { tensionG, facesCamera, TENSION_QUIET_G, TENSION_SNAP_G } from './solPhysics';

const ROT_LON = 0;
const TO_CAMERA = [0, 0, 1];
const fin = (v) => (Number.isFinite(v) ? v : 0);
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);

function validRect(r) {
  return r && Number.isFinite(r.left) && Number.isFinite(r.top) && r.width > 0 && r.height > 0;
}

function createSolStar(onSnapRef, getRectRef) {
  const star = createStar(Math.random);
  const cam = createCamera();

  // Pointer state. mode: null (no pointer) | 'stir' | 'orbit' | 'spent' (snapped mid-drag).
  let pointerId = null;
  let mode = null;
  let heldId = null;
  let rect = null;
  let prev = null;

  const pos = new Float32Array(MAX_REGIONS * 3);
  const twist = new Float32Array(MAX_REGIONS);
  const tension = new Float32Array(MAX_REGIONS);

  const findRegion = (id) => (id == null ? null : star.regions.find((r) => r.id === id) || null);

  function emit(ev) {
    if (!ev) return;
    const facing = facesCamera(viewNormal(cam, ev.lat, ev.lon, ROT_LON), TO_CAMERA);
    onSnapRef.current?.({ ...ev, facing });
  }

  function endHoldBySnap() {
    heldId = null;
    if (mode === 'stir') mode = 'spent';
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
    if (id != null && findRegion(id)) emit(release(star, id));
  }

  const handlers = {
    onPointerDown(e) {
      if (pointerId != null) return;              // only the first pointer stirs
      if (e.button != null && e.button !== 0) return;
      const r = getRectRef.current ? getRectRef.current() : e.currentTarget?.getBoundingClientRect?.();
      if (!validRect(r)) return;
      rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      const p = local(e);
      if (!p) return;
      pointerId = e.pointerId;
      try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      prev = p;
      const hit = pick(cam, p.x, p.y, rect.width, rect.height, ROT_LON);
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
        heldId = grab(star, hit.lat, hit.lon);
        mode = 'stir';
      } else {
        heldId = null;
        mode = 'orbit';
      }
    },

    onPointerMove(e) {
      if (pointerId == null || e.pointerId !== pointerId) return;
      const p = local(e);
      if (!p) return;
      if (mode === 'orbit') {
        orbitDrag(cam, p.x - prev.x, p.y - prev.y, Math.min(rect.width, rect.height));
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
    },

    onPointerUp(e) { endPointer(e, { releaseCapture: true }); },
    onPointerCancel(e) { endPointer(e, { releaseCapture: true }); },
    onLostPointerCapture(e) { endPointer(e, { releaseCapture: false }); },
  };

  function frame(dtSeconds) {
    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    if (dt === 0) return;
    stepCamera(cam, dt);
    const events = stepStar(star, dt);
    for (const ev of events) {
      if (ev.regionId === heldId) endHoldBySnap();
      emit(ev);
    }
    if (heldId != null && !findRegion(heldId)) endHoldBySnap();
  }

  const signedStarWinding = (r) => (r.lat >= 0 ? -r.starTurns : r.starTurns);
  const tension01 = (r) =>
    clamp01((tensionG(regionTurns(r)) - TENSION_QUIET_G) / (TENSION_SNAP_G - TENSION_QUIET_G));

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
      twist[i] = fin(fin(r.handTurns) + fin(signedStarWinding(r)));
      tension[i] = fin(tension01(r));
    }
    return {
      uCamYaw: fin(cam.yaw),
      uCamPitch: fin(cam.pitch),
      uRotLon: ROT_LON,
      uStarRadius: STAR_RADIUS_NDC,
      uRegionCount: n,
      uRegionPos: pos,
      uRegionTwist: twist,
      uRegionTension: tension,
    };
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
 * @param {{ onSnap?: (e: object) => void, getRect?: () => DOMRect }} [opts]
 */
export function useSolStar({ onSnap, getRect } = {}) {
  const onSnapRef = useRef(onSnap);
  const getRectRef = useRef(getRect);
  onSnapRef.current = onSnap;
  getRectRef.current = getRect;
  const apiRef = useRef(null);
  if (apiRef.current === null) apiRef.current = createSolStar(onSnapRef, getRectRef);
  return apiRef.current;
}
