// ColliderChamber.jsx — the WebGL stereochemical collision chamber.
//
// Four programs into one canvas (spec 2026-09-24):
//   field     — glHost's fullscreen quad: grid, zone, crosshair, beamlines,
//               the diamond shock, the glint, the Schlieren fronts
//   streak    — 4096 instanced ribbons: idle drift, ingress pinch, needles
//   cage      — 60 instanced ribbons: the truncated-octahedron cage
//   composite — max-channel knee out of the half-float accumulator
// With EXT_color_buffer_float the first three add into an RGBA16F target and
// the composite resolves it; without, they screen-blend straight into the
// canvas and the composite is skipped (spec §3.3).
//
// This component RENDERS. It does not own the phase graph and it never writes
// state from draw() -- the parent decides when colliding becomes result, so
// the chamber stays correct when the loop never runs (reduced motion, a
// suspended-rAF preview pane).

import React, { useRef, useState, useEffect } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { buildProgram } from '../gl/glHost';
import { buildParticleSeeds, PARTICLE_COUNT } from './particleSeeds';
import {
  PHASE_ID, MODES, GEOMETRY,
  createTiming, timingInto, modeFrequency, ringThreeWeight, mixHue01, snapMsFor,
} from './colliderPhases.js';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './fieldShader.js';
import { STREAK_VS, STREAK_UNIFORMS } from './streakShader.js';
import { CAGE_VS, CAGE_UNIFORMS } from './cageShader.js';
import { RIBBON_FS } from './ribbonShader.js';
import { COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from './compositeShader.js';
import { buildCageInstances, cageRestFlat, CAGE_INSTANCE_COUNT } from './cageTopology.js';
import { createAccumTarget, resizeAccumTarget, deleteAccumTarget } from './accumTarget.js';
import { DEFAULT_MASS } from './domainMass.js';

const CHAMBER_H = 220;
const CONTEXT_OPTIONS = {
  alpha: true, premultipliedAlpha: true, antialias: false,
  depth: false, stencil: false, powerPreference: 'low-power',
};

const hue01 = (h) => ((((h % 360) + 360) % 360) / 360);
const massOr = (m) => (Number.isFinite(m) ? Math.min(1, Math.max(0, m)) : DEFAULT_MASS);

function harvest(gl, prog, names) {
  const U = {};
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);
  return U;
}

// Everything paintChamber reads. Built once per mount; mutated only by the
// props effect, onInit/onDispose, the resize observer and the scrub hook --
// never allocated per frame.
function createChamberCtx() {
  return {
    props: { phase: 'idle', selA: false, selB: false, phaseStartedAt: null },
    derived: {
      h01a: 0, h01b: 0, hMix: 0,
      massA: DEFAULT_MASS, massB: DEFAULT_MASS, mBar: DEFAULT_MASS,
      locusX: 0, spin: 1, modeF: new Float32Array(4), ring3W: 0,
    },
    timing: createTiming(),
    ringA: new Float32Array(3),
    beamBuf: new Float32Array(64),
    size: { w: 900, h: CHAMBER_H },
    streak: { prog: null, vao: null, buf: null, U: null },
    cage: { prog: null, vao: null, buf: null, U: null },
    comp: { prog: null, U: null },
    accum: { mode: 'screen', fbo: null, tex: null, w: 0, h: 0 },
    scrub: null,
  };
}

// One frame. Module-level and reads only ctx, so the loop, onSnap and the dev
// scrub hook all paint through the same function, which allocates nothing.
// clockS is the running loop's absolute time in seconds; onSnap and the scrub
// hook have no running clock and omit it, so their stills fall back to the
// phase-local time and stay pure functions of (phase, ms).
function paintChamber(host, elapsedMs, ctx, clockS) {
  const { gl, U } = host;
  const p = ctx.props;
  const D = ctx.derived;
  const S = ctx.streak;
  const C = ctx.cage;
  const K = ctx.comp;
  const A = ctx.accum;
  const phase = ctx.scrub ? ctx.scrub.phase : p.phase;
  const ms = ctx.scrub ? ctx.scrub.ms : elapsedMs;
  const T = timingInto(ctx.timing, phase, ms);
  const phaseId = PHASE_ID[phase] ?? 0;
  const phaseT = ms / 1000;
  const timeS = ctx.scrub || clockS === undefined ? phaseT : clockS;
  const { w, h } = ctx.size;
  const px = w > 0 ? gl.canvas.width / w : 1;
  const half = A.mode === 'half-float';

  if (half) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
    gl.viewport(0, 0, A.w, A.h);
  }
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  if (half) gl.blendFunc(gl.ONE, gl.ONE);
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);

  // ── field ──
  gl.useProgram(host.prog);
  gl.bindVertexArray(host.vao);
  gl.uniform2f(U.uRes, w, h);
  gl.uniform1f(U.uPx, px);
  gl.uniform1f(U.uPhase, phaseId);
  gl.uniform1f(U.uPhaseT, phaseT);
  gl.uniform1f(U.uTime, timeS);
  gl.uniform3f(U.uHue, D.h01a, D.h01b, D.hMix);
  gl.uniform2f(U.uSel, p.selA ? 1 : 0, p.selB ? 1 : 0);
  gl.uniform2f(U.uLocus, D.locusX, 0);
  gl.uniform2f(U.uShock, T.shockR, T.shockA);
  gl.uniform1f(U.uGlint, T.glint);
  gl.uniform3fv(U.uRingR, T.ringR);
  const ra = ctx.ringA;
  ra[0] = T.ringA[0];
  ra[1] = T.ringA[1];
  ra[2] = T.ringA[2] * D.ring3W;
  gl.uniform3fv(U.uRingA, ra);
  gl.uniform3fv(U.uRingP, T.ringP);
  gl.uniform1f(U.uDirect, half ? 0 : 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // ── streaks ──
  if (half) gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
  gl.useProgram(S.prog);
  gl.bindVertexArray(S.vao);
  gl.uniform2f(S.U.uRes, w, h);
  gl.uniform1f(S.U.uPx, px);
  gl.uniform1f(S.U.uPhase, phaseId);
  gl.uniform1f(S.U.uPhaseT, phaseT);
  gl.uniform2f(S.U.uHue, D.h01a, D.h01b);
  gl.uniform2f(S.U.uMass, D.massA, D.massB);
  gl.uniform2f(S.U.uAccel, T.progress, T.ease);
  gl.uniform2f(S.U.uLocus, D.locusX, 0);
  gl.uniform1f(S.U.uNeedleA, T.needleA);
  gl.uniform4fv(S.U.uBeams, ctx.beamBuf);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PARTICLE_COUNT);

  // ── cage ──
  if (T.cageT >= 0) {
    gl.useProgram(C.prog);
    gl.bindVertexArray(C.vao);
    gl.uniform2f(C.U.uRes, w, h);
    gl.uniform1f(C.U.uPx, px);
    gl.uniform2f(C.U.uLocus, D.locusX, 0);
    gl.uniform1f(C.U.uCageT, T.cageT);
    gl.uniform1f(C.U.uCageA, T.cageA);
    gl.uniform1f(C.U.uSquash, T.squash);
    gl.uniform4fv(C.U.uModeF, D.modeF);
    gl.uniform1f(C.U.uSpin, D.spin);
    gl.uniform3f(C.U.uHue3, D.h01a, D.h01b, D.hMix);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, CAGE_INSTANCE_COUNT);
  }

  // ── composite: knee + shadow coverage into the canvas ──
  if (half) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(K.prog);
    gl.bindVertexArray(host.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(K.U.uAccum, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, null); // never leave the render target bound for sampling
  }
}

// Dev-only: pin the painted phase and elapsed time so a contact sheet can be
// shot at exact instants (spec §8). Possible only because every frame is a
// pure function of (phase, ms). `import.meta.env.DEV` is written WITHOUT
// optional chaining so Vite replaces it with a literal and the production
// build folds this to null, taking the whole hook with it. Releasing
// (scrubPhase null) hands back to whoever paints normally: the loop's next
// frame, or -- with the loop halted -- snap(), the phase's settled instant.
const installScrub = import.meta.env.DEV
  ? (ctxRef, hostRef, snap) => {
    if (typeof window === 'undefined') return undefined;
    window.__scentScrub = (scrubPhase, ms) => {
      const ctx = ctxRef.current;
      ctx.scrub = scrubPhase == null ? null : { phase: scrubPhase, ms: Number.isFinite(ms) ? ms : 0 };
      const host = hostRef.current;
      if (!ctx.scrub) snap();
      else if (host) paintChamber(host, 0, ctx);
      return ctx.scrub;
    };
    return () => { delete window.__scentScrub; };
  }
  : null;

export default function ColliderChamber({
  phase, hueA, hueB, selA, selB, massA, massB, beams, metrics, phaseStartedAt, labelA, labelB,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const ctxRef = useRef(null);
  if (ctxRef.current === null) ctxRef.current = createChamberCtx();
  const [supported, setSupported] = useState(true);
  const [accumMode, setAccumMode] = useState(null);

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'straight',      // host enables BLEND; paintChamber sets the funcs per pass
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: ctxRef.current.size.w || 900, h: CHAMBER_H },
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

    onInit(gl, { canvas }) {
      const ctx = ctxRef.current;

      const sProg = buildProgram(gl, STREAK_VS, RIBBON_FS, { strategy: 'lunar', label: 'colliderStreaks' });
      const sVao = gl.createVertexArray();
      gl.bindVertexArray(sVao);
      const sBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buildParticleSeeds(PARTICLE_COUNT), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 1);
      ctx.streak = { prog: sProg, vao: sVao, buf: sBuf, U: harvest(gl, sProg, STREAK_UNIFORMS) };

      const cProg = buildProgram(gl, CAGE_VS, RIBBON_FS, { strategy: 'lunar', label: 'colliderCage' });
      const cVao = gl.createVertexArray();
      gl.bindVertexArray(cVao);
      const cBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buildCageInstances(), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 1);
      const cU = harvest(gl, cProg, CAGE_UNIFORMS);
      gl.useProgram(cProg);
      gl.uniform3fv(cU.uRest, cageRestFlat()); // constant: uploaded once, kept by the program
      ctx.cage = { prog: cProg, vao: cVao, buf: cBuf, U: cU };

      const kProg = buildProgram(gl, COMPOSITE_VS, COMPOSITE_FS, { strategy: 'lunar', label: 'colliderComposite' });
      ctx.comp = { prog: kProg, U: harvest(gl, kProg, COMPOSITE_UNIFORMS) };

      gl.bindVertexArray(null);
      ctx.accum = createAccumTarget(gl, canvas.width, canvas.height);
      setAccumMode(ctx.accum.mode);
      // No trailing viewport/useProgram restore -- glHost does both
      // immediately after onInit returns for strategy 'lunar'.
    },

    onDispose(gl) {
      const ctx = ctxRef.current;
      for (const P of [ctx.streak, ctx.cage]) {
        if (P.prog) gl.deleteProgram(P.prog);
        if (P.buf) gl.deleteBuffer(P.buf);
        if (P.vao) gl.deleteVertexArray(P.vao);
      }
      if (ctx.comp.prog) gl.deleteProgram(ctx.comp.prog);
      deleteAccumTarget(gl, ctx.accum);
      ctx.streak = { prog: null, vao: null, buf: null, U: null };
      ctx.cage = { prog: null, vao: null, buf: null, U: null };
      ctx.comp = { prog: null, U: null };
    },

    draw(host, { tsec }) {
      const ctx = ctxRef.current;
      const started = ctx.props.phaseStartedAt;
      const elapsed = started == null ? 0 : Math.max(0, tsec * 1000 - started);
      paintChamber(host, elapsed, ctx, tsec);
    },

    // Under prefers-reduced-motion the loop never starts, so this is the only
    // frame ever painted: the settled instant for the phase (spec §7).
    onSnap(host) {
      const ctx = ctxRef.current;
      paintChamber(host, snapMsFor(ctx.props.phase), ctx);
    },

    deps: [],
  });

  // Props sync. Declared AFTER useShaderCanvas so the hook has populated its
  // snap ref by the time this first runs. The snap() call is load-bearing:
  // under reduced motion nothing else ever paints.
  useEffect(() => {
    const ctx = ctxRef.current;
    ctx.props = { phase, selA, selB, phaseStartedAt };
    const D = ctx.derived;
    D.h01a = hue01(hueA);
    D.h01b = hue01(hueB);
    D.hMix = mixHue01(D.h01a, D.h01b);
    D.massA = massOr(massA);
    D.massB = massOr(massB);
    D.mBar = 0.5 * (D.massA + D.massB);
    D.locusX = GEOMETRY.LOCUS_PX_PER_MASS * (D.massA - D.massB); // lands toward the lighter beam
    D.spin = D.massA - D.massB < 0 ? -1 : 1;
    for (let k = 0; k < 4; k++) D.modeF[k] = modeFrequency(MODES[k].f0, D.mBar);
    D.ring3W = ringThreeWeight(D.mBar);
    const b = ctx.beamBuf;
    for (let i = 0; i < 16; i++) {
      const s = beams ? beams[i] : null;
      b[i * 4 + 0] = s ? s.angle : 0;
      b[i * 4 + 1] = s ? s.mag : 0;
      b[i * 4 + 2] = s ? hue01(s.hue) : 0;
      b[i * 4 + 3] = 0;
    }
    snap();
  }, [phase, hueA, hueB, selA, selB, massA, massB, beams, phaseStartedAt, snap]);

  // Width is fluid; height is fixed. Resize without rebuilding the programs;
  // the accumulator follows the backing store here and only here.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const ctx = ctxRef.current;
      const w = el.clientWidth;
      if (!w || w === ctx.size.w) return;
      ctx.size = { w, h: CHAMBER_H };
      const host = hostRef.current;
      if (!host) return;
      host.resize(w, CHAMBER_H);
      resizeAccumTarget(host.gl, ctx.accum, host.gl.canvas.width, host.gl.canvas.height);
      // Setting canvas.width cleared the buffer. The loop repaints next
      // frame; under reduced motion nothing would, so repaint the still.
      // snap() is a no-op when the loop runs.
      snap();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef, snap]);

  useEffect(() => (installScrub ? installScrub(ctxRef, hostRef, snap) : undefined), [hostRef, snap]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full border border-fuchsia-900/30 bg-black/60 rounded-lg overflow-hidden"
      style={{ height: CHAMBER_H, animation: 'sc-borderBreath 8s ease-in-out infinite' }}
      data-chamber-renderer={supported ? 'webgl' : 'fallback'}
      data-chamber-accum={accumMode ?? undefined}
    >
      {supported
        ? <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        : <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-950/40 via-black to-cyan-950/40" />}

      {/* Readouts. These were fillText into the canvas; DOM is crisper and
          WebGL is bad at text. Font family deliberately differs from the old
          `9px monospace` -- that was the browser's generic mono, not the
          project's stack (spec §7). Positions match the old canvas coords. */}
      <div
        data-chamber-overlay
        className="absolute inset-0 pointer-events-none select-none font-mono"
        style={{ fontFamily: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace" }}
      >
        {selA && labelA && (
          <div className="absolute text-[9px]" style={{ left: 8, top: CHAMBER_H / 2 - 15, color: `hsla(${hueA},80%,70%,0.6)` }}>{labelA}</div>
        )}
        {selB && labelB && (
          <div className="absolute text-[9px]" style={{ right: 8, top: CHAMBER_H / 2 - 15, color: `hsla(${hueB},80%,70%,0.6)` }}>{labelB}</div>
        )}
        {metrics && (
          <>
            <div className="absolute left-0 right-0 text-center text-[8px]" style={{ top: CHAMBER_H / 2 - 70, color: 'rgba(217,70,239,0.6)' }}>
              NOVELTY {(metrics.novelty * 100).toFixed(0)}%
            </div>
            <div className="absolute" style={{ left: '50%', marginLeft: -60, top: CHAMBER_H / 2 - 60, width: 120, height: 4, background: 'rgba(255,255,255,0.1)' }}>
              <div
                data-novelty-fill
                style={{
                  width: `${(metrics.novelty * 100).toFixed(0)}%`,
                  height: '100%',
                  background: 'hsla(280,70%,60%,0.8)',
                  transition: 'width 400ms cubic-bezier(0.16,1,0.3,1)',
                }}
              />
            </div>
            {/* Canvas fillText positioned by BASELINE; CSS top positions the
                box top, so each of these is the old baseline minus the font's
                ascent (~0.8em). The novelty bar above came from a fillRect,
                which was already a top — hence no adjustment there. The theta
                row is held 4px above its converted value because the original
                drew its baseline at y=221 inside a 220px canvas, clipping its
                own descenders. */}
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 91, color: 'rgba(6,182,212,0.7)' }}>
              cos(θ) = {metrics.cosine.toFixed(4)}
            </div>
            <div className="absolute left-0 right-0 text-center text-[10px]" style={{ top: CHAMBER_H / 2 + 99, color: 'rgba(6,182,212,0.7)' }}>
              θ = {metrics.angle.toFixed(1)}°
            </div>
          </>
        )}
      </div>
    </div>
  );
}
