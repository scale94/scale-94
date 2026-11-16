// SolCanvas.jsx — the star on the shared shader harness.
//
// Owns: the canvas, its size (follows its container, like CouncilField), the
// shader clock, the quality path and the uniform upload. The simulation and
// the hand live in useSolStar; this component only calls star.frame(dt) and
// star.uniforms() from the draw loop and wires star.handlers onto the canvas.
// An optional onFrame(dt) runs once per frame right after star.frame(dt);
// `effects` is read live through a ref (a stable object mutated in place is
// expected).
//
// uTime is the SIMULATED clock (the sum of the dt handed to star.frame), not
// the wall clock: regions.js moves each region by omega(lat) * dt and the
// shader drifts the plasma by omega(lat) * uTime, so the two must share one
// clock or the regions slide off their plasma. It survives host rebuilds.
//
// Reduced motion (the `reducedMotion` prop; the caller reads the media query
// and follows its changes): the harness does not run the loop; uStill = 1
// freezes everything in the shader that moves on its own; onReady hands the
// caller a requestDraw() that paints one frame on demand (coalesced to one
// per animation frame). A change of the flag rebuilds the host on the same
// canvas, so the context is NOT lost on dispose (the program, buffer and VAO
// are still deleted by glHost).
//
// Quality (quality.js): 1 or 0.5, chosen at mount from the viewport width;
// after a 0.4 s warm-up, the typical frame time (mean without the slowest
// 10%) of the next running second can lower it to 0.5 once, never back. 0.5
// also renders the canvas at 0.75 of the pixel ratio.
//
// Size: the backing store is ALWAYS the canvas's CSS box x the chosen pixel
// ratio. It is set inside every host build (onInit, before the first frame,
// so the harness's pixelSize placeholder is never painted), again by the
// ResizeObserver and after the quality drop, and, if the box was still zero
// when the host was built, by the first draw that finds a real box.

import React, { useCallback, useEffect, useRef } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { QUAD_VS, SOL_FS, SOL_UNIFORMS } from './solShader';
import {
  chooseQuality, pixelRatioFor, typicalFrameMs, QUALITY_FULL, WARMUP_S, MEASURE_S,
} from './quality';

const CONTEXT_OPTIONS = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
};

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const ZERO3 = [0, 0, 0];
const NO_EFFECTS = Object.freeze({});
const vec3Of = (v) => (Array.isArray(v) || ArrayBuffer.isView(v) ? v : ZERO3);
const viewportWidth = () => (typeof window !== 'undefined' ? window.innerWidth : NaN);
const deviceDpr = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

/** Backing-store size for the canvas's CSS box at a quality, or null while the box is empty. */
function targetSize(el, quality) {
  const w = el?.clientWidth;
  const h = el?.clientHeight;
  if (!(w > 0) || !(h > 0)) return null;
  const ratio = pixelRatioFor({ quality, viewportWidth: viewportWidth(), dpr: deviceDpr() });
  return { w: Math.max(1, Math.round(w * ratio)), h: Math.max(1, Math.round(h * ratio)) };
}

// The shader build time is logged once per page load, not per host rebuild.
// The flag lives on the window, so a Vite hot update that re-evaluates this
// module does not log again.
const LOG_FLAG = '__solShaderBuildLogged';

function paint(gl, U, u, eff, time, still, quality) {
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

  const e = eff || NO_EFFECTS;
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
  gl.uniform1f(U.uStill, still ? 1 : 0);
  gl.uniform1f(U.uQuality, fin(quality, QUALITY_FULL));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function SolCanvas({ star, effects, onFrame, reducedMotion = false, onReady }) {
  const canvasRef = useRef(null);
  const starRef = useRef(star);
  const effectsRef = useRef(effects);
  const onFrameRef = useRef(onFrame);
  const stillRef = useRef(!!reducedMotion);
  const onReadyRef = useRef(onReady);
  const timeRef = useRef(0);            // set once at first mount; kept across rebuilds
  const visibleRef = useRef(true);
  const buildStartRef = useRef(0);
  const qualityRef = useRef(null);
  if (qualityRef.current === null) qualityRef.current = chooseQuality({ viewportWidth: viewportWidth() });
  // first-second frame-time measurement: done, running time (s) since the
  // host was ready, measured frame times (ms) after the warm-up
  const measureRef = useRef({ done: qualityRef.current !== QUALITY_FULL, t: 0, samples: [] });
  const sizedRef = useRef(false);      // the buffer matches a real (non-empty) box
  starRef.current = star;
  effectsRef.current = effects;
  onFrameRef.current = onFrame;
  stillRef.current = !!reducedMotion;
  onReadyRef.current = onReady;

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
    pixelSize: { w: 800, h: 600 }, // placeholder only: onInit sizes the canvas before any frame
    setStyleSize: false,
    label: 'solShader',
    // The host is rebuilt on the same canvas when reduced motion changes (and
    // by a Vite hot update): a lost context would fail every later compile.
    loseContextOnDispose: false,
    dtClamp: 0.05,
    trackVisibility: true,
    haltOnReducedMotion: true,

    // Runs inside every host build, after the harness set the placeholder
    // size and before it restores the viewport from canvas.width/height and
    // paints the first frame.
    onInit(gl, { canvas }) {
      const size = targetSize(canvas, qualityRef.current);
      if (size) {
        canvas.width = size.w;
        canvas.height = size.h;
      }
      sizedRef.current = !!size;
      // a new host: the measurement (if still pending) restarts its warm-up
      const m = measureRef.current;
      if (!m.done) { m.t = 0; m.samples.length = 0; }
      if (typeof window !== 'undefined' && !window[LOG_FLAG]
          && import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
        window[LOG_FLAG] = true;
        const ms = performance.now() - buildStartRef.current;
        console.info('[sol] shader build ms', Math.round(ms));
      }
    },

    draw(host, { dt, hidden }) {
      if (!visibleRef.current) return;
      if (!sizedRef.current) sizeTo(host);
      const s = starRef.current;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      s.frame(step);
      // Same clock as the star: snap envelopes step here, after any snap the
      // star just emitted, and before the effects are uploaded.
      onFrameRef.current?.(step);
      timeRef.current += step;
      paint(host.gl, host.U, s.uniforms(), effectsRef.current, timeRef.current, stillRef.current, qualityRef.current);
      measure(step, hidden);
    },

    // Reduced motion: the loop never starts; repaint the still star on demand.
    onSnap(host) {
      if (!sizedRef.current) sizeTo(host);
      paint(host.gl, host.U, starRef.current.uniforms(), effectsRef.current, timeRef.current,
        stillRef.current, qualityRef.current);
    },

    deps: [!!reducedMotion],
  });

  // Backing store = CSS box x the quality's pixel ratio. Returns true when
  // the canvas size changed (which cleared its buffer). Never draws.
  function sizeTo(host) {
    const el = host?.gl?.canvas || canvasRef.current;
    const size = targetSize(el, qualityRef.current);
    sizedRef.current = !!size;
    if (!size || (el.width === size.w && el.height === size.h)) return false;
    el.width = size.w;
    el.height = size.h;
    host.gl.viewport(0, 0, size.w, size.h);
    return true;
  }

  // Resize from outside a draw: then repaint (a no-op unless reduced motion;
  // the running loop repaints on its own).
  const applySize = useCallback(() => {
    const host = hostRef.current;
    if (host && sizeTo(host)) snap();
  }, [hostRef, snap]); // sizeTo reads only refs

  // Quality can drop once: the first WARMUP_S of running frames after the host
  // is ready are discarded (tab fade, React commit, link jank), the next
  // MEASURE_S are reduced to a typical frame time. Hidden or zero-dt frames
  // are not counted (a hidden page's timers lie).
  function measure(step, hidden) {
    const m = measureRef.current;
    if (m.done || hidden || !(step > 0)) return;
    m.t += step;
    if (m.t <= WARMUP_S) return;
    m.samples.push(step * 1000);
    if (m.t < WARMUP_S + MEASURE_S) return;
    m.done = true;
    const q = chooseQuality({ viewportWidth: viewportWidth(), avgFrameMs: typicalFrameMs(m.samples) });
    m.samples = [];
    if (q < qualityRef.current) {
      qualityRef.current = q;
      applySize();
    }
  }

  // Belt and braces after every host build: onInit already sized the canvas
  // when its box was known.
  useEffect(() => { applySize(); }, [reducedMotion, applySize]);

  // On-demand drawing for the caller, coalesced to one draw per animation frame.
  useEffect(() => {
    let raf = 0;
    const requestDraw = () => {
      if (raf || typeof requestAnimationFrame !== 'function') return;
      raf = requestAnimationFrame(() => { raf = 0; snap(); });
    };
    onReadyRef.current?.({ requestDraw });
    return () => {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [snap]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => applySize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [applySize]);

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
      onPointerLeave={h.onPointerLeave}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
    />
  );
}
