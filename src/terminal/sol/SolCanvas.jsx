// SolCanvas.jsx — the star on the shared shader harness.
//
// Owns: the canvas, its size (follows its container, like CouncilField), the
// shader clock and the uniform upload. The simulation and the hand live in
// useSolStar; this component only calls star.frame(dt) and star.uniforms()
// from the draw loop and wires star.handlers onto the canvas. An optional
// onFrame(dt) runs once per frame right after star.frame(dt); `effects` is
// read live through a ref (a stable object mutated in place is expected).
//
// uTime is the SIMULATED clock (the sum of the dt handed to star.frame), not
// the wall clock: regions.js moves each region by omega(lat) * dt and the
// shader drifts the plasma by omega(lat) * uTime, so the two must share one
// clock or the regions slide off their plasma.

import React, { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { QUAD_VS, SOL_FS, SOL_UNIFORMS } from './solShader';

const CONTEXT_OPTIONS = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
};

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const ZERO3 = [0, 0, 0];
const vec3Of = (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? v : ZERO3);

function paint(gl, U, u, eff, time) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.uTime, time);
  gl.uniform1f(U.uCamYaw, u.uCamYaw);
  gl.uniform1f(U.uCamPitch, u.uCamPitch);
  gl.uniform1f(U.uRotLon, u.uRotLon);
  gl.uniform1f(U.uStarRadius, u.uStarRadius);
  gl.uniform1i(U.uRegionCount, u.uRegionCount);
  gl.uniform3fv(U.uRegionPos, u.uRegionPos);
  gl.uniform1fv(U.uRegionTwist, u.uRegionTwist);
  gl.uniform1fv(U.uRegionTension, u.uRegionTension);

  const e = eff || {};
  const fp = vec3Of(e.uFlashPos);
  const pd = vec3Of(e.uPlumeDir);
  gl.uniform3f(U.uFlashPos, fin(fp[0]), fin(fp[1]), fin(fp[2]));
  gl.uniform1f(U.uFlash, fin(e.uFlash));
  gl.uniform1f(U.uShock, fin(e.uShock));
  gl.uniform3f(U.uPlumeDir, fin(pd[0]), fin(pd[1]), fin(pd[2]));
  gl.uniform1f(U.uPlume, fin(e.uPlume));
  gl.uniform1f(U.uHalo, fin(e.uHalo));
  gl.uniform1f(U.uAurora, fin(e.uAurora));
  gl.uniform1f(U.uAuroraRed, fin(e.uAuroraRed));
  gl.uniform1f(U.uStill, fin(e.uStill));
  gl.uniform1f(U.uQuality, fin(e.uQuality, 1));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function SolCanvas({ star, effects, onFrame }) {
  const canvasRef = useRef(null);
  const starRef = useRef(star);
  const effectsRef = useRef(effects);
  const onFrameRef = useRef(onFrame);
  const timeRef = useRef(0);
  const visibleRef = useRef(true);
  const buildStartRef = useRef(0);
  starRef.current = star;
  effectsRef.current = effects;
  onFrameRef.current = onFrame;

  // Declared before useShaderCanvas so it runs first: stamps the start of the
  // host build, which onInit (called right after compile + link) reads.
  useEffect(() => {
    buildStartRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }, []);

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: QUAD_VS,
    fs: SOL_FS,
    uniforms: SOL_UNIFORMS,
    pixelSize: { w: 800, h: 600 }, // corrected by the ResizeObserver below
    setStyleSize: false,
    label: 'solShader',
    loseContextOnDispose: true,
    dtClamp: 0.05,
    trackVisibility: true,
    haltOnReducedMotion: true,

    onInit() {
      timeRef.current = 0;
      if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
        const ms = performance.now() - buildStartRef.current;
        console.info('[sol] shader build ms', Math.round(ms));
      }
    },

    draw(host, { dt }) {
      if (!visibleRef.current) return;
      const s = starRef.current;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      s.frame(step);
      // Same clock as the star: snap envelopes step here, after any snap the
      // star just emitted, and before the effects are uploaded.
      onFrameRef.current?.(step);
      timeRef.current += step;
      paint(host.gl, host.U, s.uniforms(), effectsRef.current, timeRef.current);
    },

    // Reduced motion: the loop never starts; repaint the still star on demand.
    onSnap(host) {
      paint(host.gl, host.U, starRef.current.uniforms(), effectsRef.current, timeRef.current);
    },

    deps: [],
  });

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

  // Off-screen (scrolled away): neither simulate nor draw.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visibleRef.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const h = star.handlers;
  return (
    <canvas
      ref={canvasRef}
      data-testid="sol-canvas"
      onPointerDown={h.onPointerDown}
      onPointerMove={h.onPointerMove}
      onPointerUp={h.onPointerUp}
      onPointerCancel={h.onPointerCancel}
      onLostPointerCapture={h.onLostPointerCapture}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
    />
  );
}
