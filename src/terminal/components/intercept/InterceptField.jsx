// InterceptField.jsx — the felt layer of the intercept lattice (spec §3, §7).
// Reads its scene and packet through refs and never writes them. With no
// WebGL2, or a shader that fails to build, it owns no GL and reports
// not-live; the SVG overlay then draws the fallback.

import { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../../gl/useShaderCanvas';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './interceptFieldShader';
import { fillPacket } from './interceptFieldUniforms';
import { packetAt } from '../../lib/interceptPacket';

const CONTEXT_OPTIONS = { alpha: true, premultipliedAlpha: true, antialias: false };

function paint(gl, U, buf, tsec) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.u_resolution, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.u_time, tsec);
  gl.uniform4fv(U.u_trunks, buf.trunks);
  gl.uniform2fv(U.u_trunkState, buf.trunkState);
  gl.uniform4fv(U.u_nodes, buf.nodes);
  gl.uniform4fv(U.u_packet, buf.packet);
  gl.uniform2fv(U.u_marks, buf.marks);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function InterceptField({ sceneRef, packetRef, sceneVersion, onLiveChange }) {
  const canvasRef = useRef(null);
  const visibleRef = useRef(true);

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: 800, h: 400 }, // corrected by the ResizeObserver below
    setStyleSize: false,
    label: 'interceptField',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    initialDraw: false,
    haltOnReducedMotion: true,

    // Off-screen: skip the pass and keep the last frame (frameLoop has already
    // scheduled the next one, so an early return never stalls the loop).
    // Packet time reads performance.now() — the same clock the session stamps
    // `start` with — never the rAF timestamp, whose origin can differ.
    draw(host, { now }) {
      if (!visibleRef.current) return;
      const buf = sceneRef.current;
      const pk = packetRef.current;
      const state = pk ? packetAt(pk.timeline, performance.now() - pk.start) : null;
      fillPacket(buf, state, pk ? pk.timeline : null);
      paint(host.gl, host.U, buf, now / 1000);
    },

    // Reduced motion: the loop never starts; this static frame is repainted on
    // demand. The SVG overlay carries the packet (spec §9).
    onSnap(host) {
      const buf = sceneRef.current;
      fillPacket(buf, null, null);
      paint(host.gl, host.U, buf, 0);
    },

    deps: [],
  });

  // Declared after useShaderCanvas: its effect has already built (or failed
  // to build) the host. A lost context leaves a dead canvas: report not-live.
  useEffect(() => {
    onLiveChange?.(hostRef.current != null);
    const el = canvasRef.current;
    if (!el) return undefined;
    const onLost = () => onLiveChange?.(false);
    el.addEventListener('webglcontextlost', onLost);
    return () => el.removeEventListener('webglcontextlost', onLost);
  }, [hostRef, onLiveChange]);

  // A scene change is a repaint demand under reduced motion; snap() is a
  // no-op while the loop runs.
  useEffect(() => { snap(); }, [sceneVersion, snap]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const host = hostRef.current;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!host || !w || !h) return;
      host.resize(w, h);
      snap(); // setting canvas.width cleared the buffer
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef, snap]);

  // Not document.hidden: embedded preview panes report hidden forever.
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
      data-testid="intercept-field"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'screen' }}
    />
  );
}
