// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness. The sim runs inside onInit/draw; the
// ledger is never written. Without float render targets it draws the static
// coastline only; without WebGL2 it says so.

import { useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };

export default function LedgerOcean({ width, height, daysPerSecond = 9, onFrame = null }) {
  const canvasRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const dpsRef = useRef(daysPerSecond);
  dpsRef.current = daysPerSecond;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'unsupported'

  useShaderCanvas(canvasRef, {
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
    onInit: (gl, { vao }) => {
      const { grid } = world;
      const sim = createOceanGpu(gl, { grid, staticData: world.staticData, rowData: world.rowData, vao });
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
        setMode('static');
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
      const { gl, prog, U, vao } = host;
      const sim = simRef.current;
      const driver = driverRef.current;
      if (driver) {
        if (reducedMotion) driver.warmupOnce(REDUCED_MOTION_DAYS);
        else if (!hidden) driver.advance(dt, dpsRef.current);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sim ? sim.stateTexture() : texRef.current.zero);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texRef.current.static);
      gl.uniform1i(U.uState, 0);
      gl.uniform1i(U.uStatic, 1);
      gl.uniform2f(U.uGrid, world.grid.nx, world.grid.ny);
      gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(U.uTime, tsec);
      const { ref, gain, rim, aberration } = OCEAN_EXPOSURE;
      gl.uniform4f(U.uRef, ref[0], ref[1], ref[2], ref[3]);
      gl.uniform4f(U.uGain, gain[0], gain[1], gain[2], gain[3]);
      gl.uniform1f(U.uRim, rim);
      gl.uniform1f(U.uAberration, aberration);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      onFrameRef.current?.(driver ? driver.simDays() : 0);
    },
    onUnsupported: () => setMode('unsupported'),
    deps: [width, height],
  });

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height }}
      />
      {mode !== 'live' && (
        <div
          style={{ position: 'absolute', left: 8, bottom: 6, font: '9px monospace', letterSpacing: '0.2em', color: 'rgba(20,184,166,0.55)' }}
        >
          {mode === 'static' ? 'STATIC · NO FLOAT TARGETS' : 'OCEAN UNAVAILABLE · NO WEBGL2'}
        </div>
      )}
    </div>
  );
}
