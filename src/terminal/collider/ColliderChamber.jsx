// ColliderChamber.jsx — the WebGL collision chamber.
//
// Two passes into one canvas. Pass 1 is glHost's fullscreen quad running the
// field shader; pass 2 is 4096 gl.POINTS running the particle shader from a
// static seed buffer built in onInit. Both blend additively.
//
// This component RENDERS. It does not own the phase graph and it never writes
// state from draw() -- the parent decides when colliding becomes result (spec
// section 6.2), so the chamber stays correct even when the loop never runs
// (prefers-reduced-motion, a suspended-rAF preview pane).

import React, { useRef, useState, useEffect } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { buildProgram } from '../gl/glHost';
import { buildParticleSeeds, PARTICLE_COUNT } from './particleSeeds';
import { phaseTiming, PHASE_ID } from './colliderPhases';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './fieldShader';
import { PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS } from './particleShader';

const CHAMBER_H = 220;
const CONTEXT_OPTIONS = {
  alpha: true, premultipliedAlpha: true, antialias: false,
  depth: false, stencil: false, powerPreference: 'low-power',
};

export default function ColliderChamber({
  phase, hueA, hueB, selA, selB, beams, metrics, phaseStartedAt,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [supported, setSupported] = useState(true);

  const particleRef = useRef({ prog: null, vao: null, buf: null, U: null });
  const beamBufRef = useRef(new Float32Array(64));
  // The host is built before the wrapper can be measured, so it starts at a
  // placeholder width and the ResizeObserver below corrects it on its first
  // (synchronous-on-observe) callback, via resize() rather than a rebuild.
  const sizeRef = useRef({ w: 900, h: CHAMBER_H });

  // Live props for the loop, so draw() never re-runs the mount effect.
  const propsRef = useRef({ phase, hueA, hueB, selA, selB, beams, phaseStartedAt });

  const paint = (host, tsec) => {
    const { gl, U } = host;
    const p = propsRef.current;
    const P = particleRef.current;
    const { w, h } = sizeRef.current;

    const elapsed = p.phaseStartedAt == null ? 0 : Math.max(0, tsec * 1000 - p.phaseStartedAt);
    const T = phaseTiming(p.phase, elapsed);
    const phaseId = PHASE_ID[p.phase] ?? 0;
    const phaseT = elapsed / 1000;
    const h01a = ((p.hueA % 360) + 360) % 360 / 360;
    const h01b = ((p.hueB % 360) + 360) % 360 / 360;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE);

    // ── pass 1: field ──
    gl.useProgram(host.prog);
    gl.bindVertexArray(host.vao);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uPhase, phaseId);
    gl.uniform1f(U.uPhaseT, phaseT);
    gl.uniform2f(U.uHue, h01a, h01b);
    gl.uniform2f(U.uSel, p.selA ? 1 : 0, p.selB ? 1 : 0);
    gl.uniform4f(U.uBurst, T.ring1, T.ring2, T.flash, T.metrics);
    gl.uniform1f(U.uBeamT, p.beams ? T.beamT : -1);
    if (p.beams) {
      const b = beamBufRef.current;
      for (let i = 0; i < 16; i++) {
        const s = p.beams[i];
        b[i * 4 + 0] = s ? s.angle : 0;
        b[i * 4 + 1] = s ? s.mag : 0;
        b[i * 4 + 2] = s ? (((s.hue % 360) + 360) % 360) / 360 : 0;
        b[i * 4 + 3] = s ? s.lifespanMs / 1000 : 1;
      }
      gl.uniform4fv(U.uBeams, b);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ── pass 2: particles ──
    gl.useProgram(P.prog);
    gl.bindVertexArray(P.vao);
    gl.uniform2f(P.U.uRes, w, h);
    gl.uniform1f(P.U.uPhase, phaseId);
    gl.uniform1f(P.U.uPhaseT, phaseT);
    gl.uniform2f(P.U.uHue, h01a, h01b);
    gl.uniform1f(P.U.uEase, T.ease);
    gl.uniform4f(P.U.uGates, T.sparkGate, T.jetGate, T.chimeraGate, T.vaporGate);
    gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
  };

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'straight',      // host enables BLEND; paint() sets ONE,ONE per frame
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: sizeRef.current.w || 900, h: CHAMBER_H },
    setStyleSize: false,    // the canvas is sized by CSS (absolute inset-0)
    label: 'colliderChamber',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    dtClamp: 0.1,
    seedLast: 'zero',
    initialDraw: false,
    haltOnReducedMotion: true,
    onUnsupported: () => setSupported(false),

    onInit(gl) {
      const prog = buildProgram(gl, PARTICLE_VS, PARTICLE_FS, {
        strategy: 'lunar', label: 'colliderParticles',
      });
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, buildParticleSeeds(PARTICLE_COUNT), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of PARTICLE_UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
      particleRef.current = { prog, vao, buf, U };
      // No trailing viewport/useProgram restore -- glHost does both
      // immediately after onInit returns for strategy 'lunar'.
    },

    onDispose(gl) {
      const P = particleRef.current;
      if (P.prog) gl.deleteProgram(P.prog);
      if (P.buf) gl.deleteBuffer(P.buf);
      if (P.vao) gl.deleteVertexArray(P.vao);
      particleRef.current = { prog: null, vao: null, buf: null, U: null };
    },

    draw(host, { tsec }) { paint(host, tsec); },

    // Under prefers-reduced-motion the loop never starts, so this is the only
    // frame the chamber ever paints. It still shows the correct phase.
    onSnap(host) { paint(host, (propsRef.current.phaseStartedAt || 0) / 1000); },

    deps: [],
  });

  // Props sync. Declared AFTER useShaderCanvas so the hook has populated its
  // snap ref by the time this first runs — the ordering the phase-1 migration
  // established (see the phase-2 backlog's "Already measured and locked" note).
  //
  // The snap() call is load-bearing, not decoration: useShaderCanvas only
  // *arms* onSnap, it never invokes it. Under prefers-reduced-motion the loop
  // never starts and initialDraw is false, so without this line the chamber
  // would paint nothing, ever. Outside reduced motion snap() is a no-op.
  useEffect(() => {
    propsRef.current = { phase, hueA, hueB, selA, selB, beams, phaseStartedAt };
    snap();
  }, [phase, hueA, hueB, selA, selB, beams, phaseStartedAt, snap]);

  // Width is fluid; height is fixed. Resize without rebuilding the programs.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (!w || w === sizeRef.current.w) return;
      sizeRef.current = { w, h: CHAMBER_H };
      hostRef.current?.resize(w, CHAMBER_H);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full border border-fuchsia-900/30 bg-black/60 rounded-lg overflow-hidden"
      style={{ height: CHAMBER_H, animation: 'sc-borderBreath 8s ease-in-out infinite' }}
      data-chamber-renderer={supported ? 'webgl' : 'fallback'}
    >
      {supported
        ? <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        : <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-950/40 via-black to-cyan-950/40" />}
    </div>
  );
}
