// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness, with the HUD overlay (OceanHud). The sim
// runs inside onInit/draw; the ledger is never written. Sources = the ambient
// presets plus every archived verdict (straight-line course to its snapped
// ocean cell). Without float render targets (or if a sim program fails to
// build) it draws the static coastline only; without WebGL2 it says so.
//
// Lifecycle:
// - Size changes resize the canvas in place (hostRef.resize). The host is
//   built once per GL context, never per size: a rebuild would loseContext()
//   on dispose, and the next getContext() on the same canvas returns that
//   dead context (CouncilField pattern).
// - A lost context suspends drawing. On restore the canvas is remounted
//   (key = generation) and the host rebuilt; the ocean restarts from T+0,
//   because its state lived in GPU memory.
// - Reduced motion: no running loop. The warm-up (800 steps, 16 per frame) starts once sourcesReady and chains its own frames; then one frame is held and repainted only on demand (resize, new source, ghost), never idled.
// - Probe: a 1-texel float readback of the state, at most every
//   PROBE_INTERVAL_MS of frame time; mouse hover on desktop, tap elsewhere
//   (a touch that moves TAP_SLOP_PX or more is a scroll and does not probe).
// - Ghost: the form draft as a provisional source, written into the source texture by row bands (never a full upload, never a warm-up reset); dashed and labelled PROVISIONAL in the HUD.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { createParticleLayer } from '../../../ledger/ocean/gpu/particleLayer';
import {
  prepareRiver, fillParticles, advanceParcelPhase, GHOST_ALPHA, PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE,
} from '../../../ledger/ocean/riverStage';
import { packSources, packSourceRows, sourceRowBands } from '../../../ledger/ocean/gpu/gpuData';
import { verdictSources, buildSource, ghostSourceSpec } from '../../../ledger/ocean/sources';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';
import OceanHud from './OceanHud';
import {
  COMPACT_BELOW_PX, DEFAULT_COMPRESSION, PARTICLE_PX, PROBE_INTERVAL_MS, PROBE_TAP_HOLD_MS,
  describeSites, formatProbe, nextCompression, pickSite, pointerToLonLat,
} from './hudFormat';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };
const NO_VERDICTS = [];
const TAP_SLOP_PX = 8; // a touch that moves further is a scroll, not a probe tap

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

export default function LedgerOcean({
  width,
  height,
  daysPerSecond = DEFAULT_COMPRESSION,
  verdicts = NO_VERDICTS,
  latestHash = null,
  sourcesReady = true,
  ghost = null,
  onFrame = null, // (simDays, displayDays): step-clock days, and the wall-time interpolated display days
}) {
  const canvasRef = useRef(null);
  const hudRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [dps, setDps] = useState(daysPerSecond);
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'static-shader' | 'unsupported' | 'lost'
  const [generation, setGeneration] = useState(0);

  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const uploadedRef = useRef(null);
  const ghostUploadedRef = useRef(null);
  const lostRef = useRef(false);
  const warmRef = useRef(false);
  const dirtyRef = useRef(true);
  const particlesRef = useRef(null);
  const fillRef = useRef({ rivers: null, n: 0 });
  const rafRef = useRef(0);
  const drawRef = useRef(null);
  const requestFrameRef = useRef(() => {});
  const readyRef = useRef(sourcesReady);
  readyRef.current = sourcesReady;
  const phaseRef = useRef(new Map());   // river id → parcel phase (survives ghost edits)
  const lastDisplayRef = useRef(0);
  const sizeRef = useRef({ width, height });
  const probeRef = useRef(null);
  const probeAtRef = useRef(-Infinity);
  const tapTimerRef = useRef(0);
  const tapStartRef = useRef(null);
  const dpsRef = useRef(dps);
  dpsRef.current = dps;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const userSources = useMemo(() => verdictSources(verdicts, world.grid, world.mask), [world, verdicts]);
  const sources = useMemo(() => [...world.sources, ...userSources], [world, userSources]);
  const sourceData = useMemo(
    () => (userSources.length ? packSources(world.grid, world.mask.land, sources) : world.ambientSourceData),
    [world, sources, userSources],
  );
  // The ghost (spec §3, §4 Form): the unsubmitted draft as a provisional
  // source. It never joins `sources`/`sourceData` — that path re-uploads the
  // whole 2 MB source texture and restarts a reduced-motion warm-up. `draw`
  // writes it into the source texture by row bands instead.
  const ghostSource = useMemo(
    () => (ghost ? buildSource(ghostSourceSpec(ghost), world.grid, world.mask) : null),
    [world, ghost],
  );
  const ghostRef = useRef(ghostSource);
  ghostRef.current = ghostSource;
  const sites = useMemo(
    () => describeSites(ghostSource ? [...sources, ghostSource] : sources, verdicts, ghost),
    [sources, verdicts, ghostSource, ghost],
  );
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const compactRef = useRef(width < COMPACT_BELOW_PX);
  compactRef.current = width < COMPACT_BELOW_PX;
  const sourceDataRef = useRef(sourceData);
  sourceDataRef.current = sourceData;

  // River stage: one prepared river per source with a course to walk.
  const riverBuf = useMemo(() => {
    const rivers = sources.map((s) => prepareRiver(s));
    if (ghostSource) rivers.push(prepareRiver(ghostSource, { alpha: GHOST_ALPHA }));
    const drawn = rivers.filter(Boolean);
    return { rivers: drawn, buf: new Float32Array((drawn.length * PARTICLES_PER_RIVER + 1) * FLOATS_PER_PARTICLE) };
  }, [sources, ghostSource]);
  const riverBufRef = useRef(riverBuf);
  riverBufRef.current = riverBuf;

  const readProbe = (now, sim) => {
    const p = probeRef.current;
    if (!p) return;
    // Throttled. A held reduced-motion ocean has no loop, so ask for the frame
    // that will read it (a no-op while the loop runs).
    if (now - probeAtRef.current < PROBE_INTERVAL_MS) {
      requestFrameRef.current();
      return;
    }
    probeAtRef.current = now;
    const land = !!world.mask.land[p.k];
    const v = land || !sim ? null : sim.readCell(p.i, p.j);
    hudRef.current?.setProbe(formatProbe(p.lon, p.lat, v, land));
  };

  // River stage (spec §3): PARTICLES_PER_RIVER parcels per river, positions and
  // colours from the exact kinetics, drawn as GL points over the composite.
  // Re-filled whenever display time moves (every live frame: parcels glide
  // between steps) or the river set changes; a held frame redraws the buffer.
  const drawParticles = (gl) => {
    const layer = particlesRef.current;
    const driver = driverRef.current;
    if (!layer || !driver) return;
    const { rivers, buf } = riverBufRef.current;
    // Glide: phases advance with display days (step clock + its wall-time
    // remainder), slowed to ≥ MIN_CYCLE_S per course at the chosen compression.
    const disp = driver.displayDays();
    const dD = disp - lastDisplayRef.current;
    lastDisplayRef.current = disp;
    const phases = phaseRef.current;
    if (dD > 0) {
      for (const r of rivers) phases.set(r.id, advanceParcelPhase(phases.get(r.id) ?? 0, dD, r.travelDays, dpsRef.current));
    }
    const fill = fillRef.current;
    if (dD > 0 || rivers !== fill.rivers) {
      const n = fillParticles(rivers, rivers.map((r) => phases.get(r.id) ?? 0), buf);
      layer.upload(buf, n);
      fillRef.current = { rivers, n };
    }
    const scale = gl.canvas.width / Math.max(1, sizeRef.current.width);
    layer.draw(0, fillRef.current.n, PARTICLE_PX * scale);
  };

  const draw = (host, { now, dt, tsec, hidden, reducedMotion: rm }) => {
    if (lostRef.current) return;
    const sim = simRef.current;
    const driver = driverRef.current;
    if (sim && uploadedRef.current !== sourceDataRef.current) {
      sim.setSources(sourceDataRef.current);
      uploadedRef.current = sourceDataRef.current;
      ghostUploadedRef.current = null; // the full upload holds permanent sources only
      if (rm) {
        driver.resetWarmup();
        warmRef.current = false;
      }
    }
    // Ghost: rewrite only the rows its old and new splats touch (≤ 11 each),
    // from the permanent rows plus the new ghost. No warm-up reset.
    if (sim && ghostUploadedRef.current !== ghostRef.current) {
      const prev = ghostUploadedRef.current;
      const next = ghostRef.current;
      const extra = next ? [next] : [];
      for (const [j0, rows] of sourceRowBands(world.grid, prev ? prev.cells : [], next ? next.cells : [])) {
        sim.setSourceRows(j0, rows, packSourceRows(world.grid, world.mask.land, sourceDataRef.current, extra, j0, rows));
      }
      ghostUploadedRef.current = next;
    }
    let paintNow = true;
    if (rm) {
      if (driver && !warmRef.current) {
        // The warm-up waits for the archive (sourcesReady), so the held clock
        // reads one warm-up with every source in it; then it chains frames.
        if (readyRef.current) {
          warmRef.current = driver.warmupChunk(REDUCED_MOTION_DAYS);
          if (!warmRef.current) requestFrameRef.current();
        }
        paintNow = warmRef.current;
      } else {
        paintNow = dirtyRef.current;
      }
    } else if (driver && !hidden) {
      driver.advance(dt, dpsRef.current);
    }
    readProbe(now, sim);
    if (paintNow) {
      paint(host, world.grid, texRef.current, sim, tsec);
      drawParticles(host.gl);
      dirtyRef.current = false;
    }
    const simDays = driver ? driver.simDays() : 0;
    hudRef.current?.setFrame({ simDays, frameMs: driver ? driver.frameMs() : 0, now });
    onFrameRef.current?.(simDays, driver ? driver.displayDays() : 0);
  };
  drawRef.current = draw;

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
    // Reduced motion: no running loop. The mount draw starts the warm-up and
    // requestFrame chains it; after that frames come only on demand (resize,
    // new source, ghost, probe, archive ready), so a held ocean costs nothing.
    haltOnReducedMotion: true,
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
        sim.setSources(sourceDataRef.current);
        uploadedRef.current = sourceDataRef.current;
        ghostUploadedRef.current = null;
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
        fillRef.current = { rivers: null, n: 0 };
        lastDisplayRef.current = 0; // a new driver starts at T+0
        try {
          particlesRef.current = createParticleLayer(gl);
        } catch (err) {
          // The river stage draws over the ocean; without it the sim runs on.
          console.error(err);
          particlesRef.current = null;
        }
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode(failed ? 'static-shader' : 'static');
      }
    },
    onDispose: (gl) => {
      particlesRef.current?.dispose();
      particlesRef.current = null;
      simRef.current?.dispose();
      if (texRef.current?.zero) {
        gl.deleteTexture(texRef.current.zero);
        gl.deleteTexture(texRef.current.static);
      }
      simRef.current = null;
      driverRef.current = null;
      texRef.current = null;
      uploadedRef.current = null;
      ghostUploadedRef.current = null;
    },
    draw,
    onUnsupported: () => setMode('unsupported'),
    deps: [generation],
  });

  // One frame on demand under reduced motion (at most one pending); a no-op
  // while the loop runs.
  const requestFrame = useCallback(() => {
    if (!reducedMotion || rafRef.current) return;
    rafRef.current = requestAnimationFrame((t) => {
      rafRef.current = 0;
      const host = hostRef.current;
      if (host) drawRef.current(host, { now: t, dt: 0, tsec: t / 1000, hidden: document.hidden, reducedMotion: true });
    });
  }, [reducedMotion, hostRef]);
  requestFrameRef.current = requestFrame;

  useEffect(() => {
    const raf = rafRef; // alias: no ref-in-cleanup lint warning (count must stay ≤ 137)
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, []);

  // A new source set, or the archive arriving, needs a frame under reduced motion.
  useEffect(() => {
    requestFrameRef.current();
  }, [sourceData, sourcesReady]);

  // A ghost change needs its band upload, and a held reduced-motion frame
  // repaints once to show its parcels.
  useEffect(() => {
    dirtyRef.current = true;
    requestFrameRef.current();
  }, [ghostSource]);

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
    requestFrameRef.current();
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

  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  const probeAt = useCallback((clientX, clientY) => {
    const el = canvasRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const p = pointerToLonLat(clientX - r.left, clientY - r.top, r.width, r.height);
    if (!p) return false;
    const { i, j } = world.grid.lonLatToCell(p.lon, p.lat);
    probeRef.current = { ...p, i, j, k: world.grid.idx(i, j) };
    return true;
  }, [world]);

  const clearProbe = useCallback(() => {
    probeRef.current = null;
    hudRef.current?.setProbe(null);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (e.pointerType !== 'mouse') return;
    if (!probeAt(e.clientX, e.clientY)) clearProbe();
    else requestFrameRef.current();
  }, [probeAt, clearProbe]);

  const onPointerLeave = useCallback((e) => {
    if (e.pointerType === 'mouse') clearProbe();
  }, [clearProbe]);

  // Touch/pen: probe on a tap only, committed on pointerup, so a scroll that
  // starts on the hero does not probe.
  const onPointerDown = useCallback((e) => {
    if (e.pointerType !== 'mouse') tapStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Compact: the rings take no pointer events; a tap (or click) within
  // RING_TAP_RADIUS_PX of a ring centre opens the nearest ring's tooltip.
  // Dismissal is OceanHud's: any pointerdown closes an open compact tooltip,
  // before this pointerup can reopen one. Returns whether a ring was hit.
  const pickRing = useCallback((clientX, clientY) => {
    const el = canvasRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const id = pickSite(sitesRef.current, clientX - r.left, clientY - r.top, r.width, r.height);
    if (id === null) return false;
    hudRef.current?.openSite(id);
    return true;
  }, []);

  const onPointerUp = useCallback((e) => {
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (e.pointerType === 'mouse') {
      if (compactRef.current) pickRing(e.clientX, e.clientY);
      return;
    }
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= TAP_SLOP_PX) return;
    if (compactRef.current && pickRing(e.clientX, e.clientY)) return;
    if (!probeAt(e.clientX, e.clientY)) return;
    requestFrameRef.current();
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(clearProbe, PROBE_TAP_HOLD_MS);
  }, [probeAt, clearProbe, pickRing]);

  const cycleCompression = useCallback(() => setDps((d) => nextCompression(d)), []);

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        key={generation}
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height, touchAction: 'manipulation' }}
      />
      <OceanHud
        ref={hudRef}
        compact={width < COMPACT_BELOW_PX}
        mode={mode}
        reducedMotion={reducedMotion}
        daysPerSecond={dps}
        onCycleCompression={cycleCompression}
        sites={sites}
        latestHash={latestHash}
        verdicts={verdicts}
      />
    </div>
  );
}
