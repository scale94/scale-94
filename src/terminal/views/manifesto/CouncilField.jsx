// CouncilField.jsx — the read-only accretion-field layer under the Council Ring SVG
// (docs/superpowers/specs/2026-09-25-council-field-accretion-design.md).
// It reads collider state through refs and never writes it. With no WebGL2,
// or a shader that fails to build, it owns no GL and reports not-live; the
// ring then behaves exactly as before.

import { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../../gl/useShaderCanvas';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './councilFieldShader';
import { geodesicTables, N_B, N_PHI, N_D } from './councilGeodesics';
import { matterTexture, MATTER_N } from './councilMatter';
import { readFieldUniforms } from './councilFieldUniforms';

const CONTEXT_OPTIONS = { alpha: true, premultipliedAlpha: true, antialias: false };

function makeTexture(gl, unit, w, h, internal, format, type, data, wrap) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}

// Scalar uniform forms only: no per-frame allocation, and the recording
// stub logs every value (it prints plain arrays as "<obj>").
function paint(gl, U, u, lensD) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.u_resolution, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.u_time, u.time);
  gl.uniform1i(U.u_ui_mode, u.uiMode);
  gl.uniform1i(U.u_anim_phase, u.animPhase);
  gl.uniform1f(U.u_phase_t, u.phaseT);
  gl.uniform1f(U.u_phase_ms, u.phaseMs);
  gl.uniform2f(U.u_seatA, u.seatA[0], u.seatA[1]);
  gl.uniform2f(U.u_seatB, u.seatB[0], u.seatB[1]);
  gl.uniform3f(U.u_colorA, u.colorA[0], u.colorA[1], u.colorA[2]);
  gl.uniform3f(U.u_colorB, u.colorB[0], u.colorB[1], u.colorB[2]);
  gl.uniform2f(U.u_pointer, u.pointer[0], u.pointer[1]);
  gl.uniform1f(U.u_pointer_live, u.pointerLive);
  gl.uniform1f(U.u_intensity, u.intensity);
  gl.uniform3f(U.u_eject, u.eject[0], u.eject[1], u.eject[2]);
  gl.uniform3f(U.u_eject_color, u.ejectColor[0], u.ejectColor[1], u.ejectColor[2]);
  gl.uniform4f(U.u_flow, u.flow[0], u.flow[1], u.flow[2], u.flow[3]);
  gl.uniform1f(U.u_flow_w, u.flowW);
  gl.uniform1f(U.u_lens_d, lensD);
  gl.uniform1i(U.u_geodesic, 0);
  gl.uniform1i(U.u_deflect, 1);
  gl.uniform1i(U.u_matter, 2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function CouncilField({ simRef, uiRef, seated, pointerRef, mode, onLiveChange }) {
  const canvasRef = useRef(null);
  const texRef = useRef([]);
  const lensRef = useRef(0);
  const visibleRef = useRef(true);

  // `seated` is captured once (deps: []). CouncilRing memoizes it with [] deps,
  // which the collider already depends on, so it is referentially stable.
  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: 980, h: 640 }, // corrected by the ResizeObserver below
    setStyleSize: false,
    label: 'councilField',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    initialDraw: false,
    haltOnReducedMotion: true,

    onInit(gl) {
      const { geodesic, deflect, lensD } = geodesicTables();
      lensRef.current = lensD;
      texRef.current = [
        makeTexture(gl, 0, N_PHI, N_B, gl.R16F, gl.RED, gl.FLOAT, geodesic, gl.CLAMP_TO_EDGE),
        makeTexture(gl, 1, N_D, 1, gl.R16F, gl.RED, gl.FLOAT, deflect, gl.CLAMP_TO_EDGE),
        makeTexture(gl, 2, MATTER_N, MATTER_N, gl.R8, gl.RED, gl.UNSIGNED_BYTE, matterTexture(), gl.REPEAT),
      ];
    },

    onDispose(gl) {
      for (const t of texRef.current) gl.deleteTexture(t);
      texRef.current = [];
    },

    // Off-screen: skip the pass and keep the last frame. frameLoop schedules
    // the next frame (and re-arms its watchdog) before calling draw, so an
    // early return never stalls or trips the loop.
    draw(host, { now }) {
      if (!visibleRef.current) return;
      const u = readFieldUniforms(simRef.current, uiRef.current, seated, pointerRef.current, now);
      paint(host.gl, host.U, u, lensRef.current);
    },

    // Reduced motion: the loop never starts, so this is the only frame.
    onSnap(host) {
      const u = readFieldUniforms(simRef.current, uiRef.current, seated, pointerRef.current, performance.now());
      paint(host.gl, host.U, u, lensRef.current);
    },

    deps: [],
  });

  // Declared after useShaderCanvas: its effect has already built (or failed
  // to build) the host by the time this runs.
  useEffect(() => {
    onLiveChange?.(hostRef.current != null);
  }, [hostRef, onLiveChange]);

  // Reduced motion repaints only on demand; a UI-mode change is such a demand.
  // snap() is a no-op while the loop runs.
  useEffect(() => { snap(); }, [mode, snap]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const host = hostRef.current;
      const w = el.clientWidth, h = el.clientHeight;
      if (!host || !w || !h) return;
      host.resize(w, h);
      snap(); // setting canvas.width cleared the buffer
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef, snap]);

  // Not document.hidden: embedded preview panes report hidden forever. With
  // no IntersectionObserver the field stays visible.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visibleRef.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="council-field"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
