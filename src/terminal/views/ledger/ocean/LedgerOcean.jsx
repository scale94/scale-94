// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness. The sim runs inside onInit/draw; the
// ledger is never written. Without float render targets (or if a sim program
// fails to build) it draws the static coastline only; without WebGL2 it says so.
//
// Lifecycle:
// - Size changes resize the canvas in place (hostRef.resize). The host is
//   built once per GL context, never per size: a rebuild would loseContext()
//   on dispose, and the next getContext() on the same canvas returns that
//   dead context (CouncilField pattern).
// - A lost context suspends drawing. On restore the canvas is remounted
//   (key = generation) and the host rebuilt; the ocean restarts from T+0,
//   because its state lived in GPU memory.
// - Reduced motion: the warm-up is spread over frames (nothing is painted
//   meanwhile), then one frame is held and repainted only when resized.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';
import { MODE_LABEL } from './hudFormat';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };

function paint({ gl, prog, U, vao }, grid, tex, sim, tsec) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(prog);
  gl.bindVertexArray(vao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sim ? sim.stateTexture() : tex.zero);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, tex.static);
  gl.uniform1i(U.uState, 0);
  gl.uniform1i(U.uStatic, 1);
  gl.uniform2f(U.uGrid, grid.nx, grid.ny);
  gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.uTime, tsec);
  const { ref, gain, rim, aberration } = OCEAN_EXPOSURE;
  gl.uniform4f(U.uRef, ref[0], ref[1], ref[2], ref[3]);
  gl.uniform4f(U.uGain, gain[0], gain[1], gain[2], gain[3]);
  gl.uniform1f(U.uRim, rim);
  gl.uniform1f(U.uAberration, aberration);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function LedgerOcean({ width, height, daysPerSecond = 9, onFrame = null }) {
  const canvasRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const lostRef = useRef(false);
  const warmRef = useRef(false);
  const dirtyRef = useRef(true);
  const sizeRef = useRef({ width, height });
  const dpsRef = useRef(daysPerSecond);
  dpsRef.current = daysPerSecond;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'static-shader' | 'unsupported' | 'lost'
  const [generation, setGeneration] = useState(0);

  const { hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    strategy: 'lunar',
    vs: SIM_VS,
    fs: COMPOSITE_FS,
    uniforms: COMPOSITE_UNIFORMS,
    pixelSize: { w: width, h: height },
    setStyleSize: true,
    blend: 'none',
    contextOptions: CONTEXT_OPTIONS,
    label: 'LedgerOcean',
    trackVisibility: true,
    // The loop must run under reduced motion: it carries the spread warm-up,
    // then idles (draw returns without painting) until a resize.
    haltOnReducedMotion: false,
    onInit: (gl, { vao }) => {
      const { grid } = world;
      lostRef.current = false;
      warmRef.current = false;
      dirtyRef.current = true;
      let sim = null;
      let failed = false;
      try {
        sim = createOceanGpu(gl, { grid, staticData: world.staticData, rowData: world.rowData, vao });
      } catch (err) {
        // createOceanGpu has released everything it built; the host itself
        // (display program + quad) is fine, so draw the static coastline.
        console.error(err);
        failed = true;
      }
      if (sim) {
        sim.setSources(world.ambientSourceData);
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
    onDispose: (gl) => {
      simRef.current?.dispose();
      if (texRef.current?.zero) {
        gl.deleteTexture(texRef.current.zero);
        gl.deleteTexture(texRef.current.static);
      }
      simRef.current = null;
      driverRef.current = null;
      texRef.current = null;
    },
    draw: (host, { dt, tsec, hidden, reducedMotion }) => {
      if (lostRef.current) return;
      const driver = driverRef.current;
      let paintNow = true;
      if (reducedMotion) {
        if (driver && !warmRef.current) {
          warmRef.current = driver.warmupChunk(REDUCED_MOTION_DAYS);
          paintNow = warmRef.current;
        } else {
          paintNow = dirtyRef.current;
        }
      } else if (driver && !hidden) {
        driver.advance(dt, dpsRef.current);
      }
      if (paintNow) {
        paint(host, world.grid, texRef.current, simRef.current, tsec);
        dirtyRef.current = false;
      }
      onFrameRef.current?.(driver ? driver.simDays() : 0);
    },
    onUnsupported: () => setMode('unsupported'),
    deps: [generation],
  });

  // Resize in place. Skips the mount pass (the host was just built at this
  // size): assigning canvas.width clears the drawing buffer even when the
  // value is unchanged.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (sizeRef.current.width === width && sizeRef.current.height === height) return;
    sizeRef.current = { width, height };
    host.resize(width, height);
    dirtyRef.current = true;
  }, [hostRef, width, height]);

  // Context loss (GPU reset, driver eviction, too many contexts). The listener
  // must preventDefault() or the browser never fires webglcontextrestored.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onLost = (e) => {
      e.preventDefault();
      lostRef.current = true;
      setMode('lost');
    };
    const onRestored = () => {
      setMode('live');
      setGeneration((g) => g + 1);
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);
    return () => {
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [generation]);

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        key={generation}
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height }}
      />
      {mode !== 'live' && (
        <div
          style={{ position: 'absolute', left: 8, bottom: 6, font: '9px monospace', letterSpacing: '0.2em', color: 'rgba(20,184,166,0.55)' }}
        >
          {MODE_LABEL[mode]}
        </div>
      )}
    </div>
  );
}
