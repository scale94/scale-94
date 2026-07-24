// LunarShaderMoon.jsx — WebGL2 host for the shader moon.
//
// Owns: the GL context, the rAF loop, the adaptation state, and the fallback.
// Owns no maths. Everything computable lives in lunarEphemeris.js and
// darkAdaptation.js so it can be tested without a GPU.

import React, { useEffect, useRef, useState } from 'react';
import { createGL, buildProgram } from './glContext';
import { QUAD_VS, MOON_FS, BAKE_FS, bakeSize } from './moonShader';
import { createAdaptState, stepAdapt, isAtRest } from './darkAdaptation';
import { libration, apparentRadiusScale } from './lunarEphemeris';
import LunarCanvas from './LunarCanvasMoon';

const REST_FRAME_MS = 1000 / 30;

export default function LunarShaderMoon({ lunarAge, illumination, timestamp, size = 340, onAdaptChange }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    const probe = document.createElement('canvas');
    return !!createGL(probe);
  });

  // Live props read by the rAF loop without re-running the effect.
  const propsRef = useRef({ lunarAge, illumination, timestamp, onAdaptChange });
  propsRef.current = { lunarAge, illumination, timestamp, onAdaptChange };

  useEffect(() => {
    if (!supported) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = createGL(canvas);
    if (!gl) { setSupported(false); return; }

    let prog;
    try {
      prog = buildProgram(gl, QUAD_VS, MOON_FS);
    } catch (err) {
      console.error(err);
      setSupported(false);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasPx = Math.round(size * 1.25);
    canvas.width = canvasPx * dpr;
    canvas.height = canvasPx * dpr;
    canvas.style.width = `${canvasPx}px`;
    canvas.style.height = `${canvasPx}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Fullscreen triangle strip. Location 0 is shared by both programs
    // (QUAD_VS declares `layout(location = 0) in vec2 aPos;`) so the same
    // VAO/buffer drives the bake pass and the render pass.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // ── Pass A: bake the selenographic surface, once ──
    const bakeProg = buildProgram(gl, QUAD_VS, BAKE_FS);
    const [bw, bh] = bakeSize();
    const surfaceTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);       // lon wraps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // lat does not

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surfaceTex, 0);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(bakeProg);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteProgram(bakeProg);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    // Premultiplied alpha -- the context was created with premultipliedAlpha.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const uRadius = gl.getUniformLocation(prog, 'uRadius');
    const uSurface = gl.getUniformLocation(prog, 'uSurface');
    const uAge = gl.getUniformLocation(prog, 'uAge');
    const uIllum = gl.getUniformLocation(prog, 'uIllum');
    const uAdapt = gl.getUniformLocation(prog, 'uAdapt');
    const uPurkinje = gl.getUniformLocation(prog, 'uPurkinje');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uLibration = gl.getUniformLocation(prog, 'uLibration');

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let adaptState = createAdaptState(illumination);
    let raf = 0;
    let hidden = document.hidden;
    let lastT = 0;
    let lastDraw = 0;
    let lastReport = 0;
    let lastReportedAdapt = -1;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = lastT ? Math.min((now - lastT) / 1000, 0.25) : 0;
      lastT = now;

      const live = propsRef.current;
      adaptState = stepAdapt(adaptState, {
        dt, illumination: live.illumination, hidden, reducedMotion,
      });

      if (now - lastReport > 100 && Math.abs(adaptState.adapt - lastReportedAdapt) > 1e-3) {
        lastReport = now;
        lastReportedAdapt = adaptState.adapt;
        const cb = propsRef.current.onAdaptChange;
        if (cb) cb(adaptState.adapt);
      }

      // 30fps idle throttle once adaptation has settled (spec section 9).
      if (isAtRest(adaptState, live.illumination) && now - lastDraw < REST_FRAME_MS) return;
      lastDraw = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const lib = libration(live.timestamp);
      gl.uniform2f(uLibration, lib.lon, lib.lat);
      // 0.78 is the disc's share of the canvas at mean distance; the ephemeris
      // scale carries the perigee-apogee swell on top of it.
      gl.uniform1f(uRadius, 0.78 * apparentRadiusScale(live.timestamp));
      gl.uniform1f(uAge, live.lunarAge);
      gl.uniform1f(uIllum, live.illumination);
      gl.uniform1f(uAdapt, adaptState.adapt);
      gl.uniform1f(uPurkinje, 1.0);   // author's call after review; 3.0 inverts
      // Frozen under reduced motion: stars stop twinkling. The dither pattern
      // going static with it is fine -- a fixed dither is still a dither.
      gl.uniform1f(uTime, reducedMotion ? 0 : now * 0.001);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
      gl.uniform1i(uSurface, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    raf = requestAnimationFrame(frame);

    function onVisibility() {
      hidden = document.hidden;
      if (!hidden) lastT = 0;   // do not bill the user for time spent away
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteTexture(surfaceTex);
    };
  }, [supported, size]);

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
