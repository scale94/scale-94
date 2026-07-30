// LunarShaderMoon.jsx — WebGL2 host for the shader moon.
//
// Owns: the adaptation state, the bake-pass program, and the Canvas2D
// fallback. The GL context, program build, quad, uniform harvesting, DPR
// sizing, blend state, and the rAF loop itself live in the shared harness
// (../gl/useShaderCanvas). Owns no maths beyond that — everything computable
// lives in lunarEphemeris.js and darkAdaptation.js so it can be tested
// without a GPU.

import React, { useRef, useState } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { buildProgram } from '../gl/glHost';
import { QUAD_VS, MOON_FS, BAKE_FS, bakeSize } from './moonShader';
import { createAdaptState, stepAdapt, isAtRest } from './darkAdaptation';
import { libration, apparentRadiusScale } from './lunarEphemeris';
import LunarCanvas from './LunarCanvasMoon';

const REST_FRAME_MS = 1000 / 30;

const CONTEXT_OPTIONS = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
};

export default function LunarShaderMoon({ lunarAge, illumination, timestamp, size = 340, onAdaptChange }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    const probe = document.createElement('canvas');
    return !!probe.getContext('webgl2', CONTEXT_OPTIONS);
  });

  const surfaceTexRef = useRef(null);
  const adaptRef = useRef(null);
  const lastDrawRef = useRef(0);
  const reportRef = useRef({ at: 0, value: -1 });

  // Live props read by the rAF loop without re-running the effect.
  const propsRef = useRef({ lunarAge, illumination, timestamp, onAdaptChange });

  useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: QUAD_VS,
    fs: MOON_FS,
    uniforms: ['uRadius', 'uSurface', 'uAge', 'uIllum', 'uAdapt', 'uPurkinje', 'uTime', 'uLibration'],
    pixelSize: Math.round(size * 1.25),
    setStyleSize: true,
    loseContextOnDispose: false, // preserved divergence — phase 2 flips it
    label: 'moonShader',
    dtClamp: 0.25,
    seedLast: 'zero',
    watchdogMs: null, // preserved divergence — phase 2 adds it
    trackVisibility: true,
    haltOnReducedMotion: false,
    initialDraw: false,

    onInit(gl, { vao, canvas }) {
      adaptRef.current = createAdaptState(propsRef.current.illumination);
      lastDrawRef.current = 0;
      reportRef.current = { at: 0, value: -1 };

      // ── Pass A: bake the selenographic surface, once ──
      const bakeProg = buildProgram(gl, QUAD_VS, BAKE_FS, { strategy: 'lunar', label: 'moonShader' });
      const [bw, bh] = bakeSize();
      surfaceTexRef.current = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);        // lon wraps
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // lat does not

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surfaceTexRef.current, 0);
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(bakeProg);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteProgram(bakeProg);
      // NOTE: no trailing viewport restore / useProgram(prog) here — glHost
      // does both immediately after onInit returns for strategy 'lunar'.
    },

    draw(host, { now, dt, hidden, reducedMotion }) {
      const { gl, U } = host;
      const live = propsRef.current;
      adaptRef.current = stepAdapt(adaptRef.current, {
        dt, illumination: live.illumination, hidden, reducedMotion,
      });
      const adaptState = adaptRef.current;

      if (now - reportRef.current.at > 100 &&
          Math.abs(adaptState.adapt - reportRef.current.value) > 1e-3) {
        reportRef.current = { at: now, value: adaptState.adapt };
        propsRef.current.onAdaptChange?.(adaptState.adapt);
      }

      // 30fps idle throttle once adaptation has settled (spec section 9).
      if (isAtRest(adaptState, live.illumination) && now - lastDrawRef.current < REST_FRAME_MS) return;
      lastDrawRef.current = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const lib = libration(live.timestamp);
      gl.uniform2f(U.uLibration, lib.lon, lib.lat);
      // 0.78 is the disc's share of the canvas at mean distance; the ephemeris
      // scale carries the perigee-apogee swell on top of it.
      gl.uniform1f(U.uRadius, 0.78 * apparentRadiusScale(live.timestamp));
      gl.uniform1f(U.uAge, live.lunarAge);
      gl.uniform1f(U.uIllum, live.illumination);
      gl.uniform1f(U.uAdapt, adaptState.adapt);
      gl.uniform1f(U.uPurkinje, 1.0);   // author's call after review; 3.0 inverts
      // Frozen under reduced motion: stars stop twinkling. The dither pattern
      // going static with it is fine -- a fixed dither is still a dither.
      gl.uniform1f(U.uTime, reducedMotion ? 0 : now * 0.001);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexRef.current);
      gl.uniform1i(U.uSurface, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    onUnsupported: () => setSupported(false),
    onDispose(gl) { if (surfaceTexRef.current) gl.deleteTexture(surfaceTexRef.current); },
    deps: [supported, size],
  });

  propsRef.current = { lunarAge, illumination, timestamp, onAdaptChange };

  if (!supported) {
    return (
      <div data-moon-renderer="canvas" className="w-full flex justify-center">
        <LunarCanvas lunarAge={lunarAge} />
      </div>
    );
  }

  return (
    <div data-moon-renderer="shader" className="w-full flex justify-center -my-8">
      <canvas ref={canvasRef} />
    </div>
  );
}
