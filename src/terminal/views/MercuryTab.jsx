import { useState, useCallback, useMemo, useEffect, useRef, useReducer } from 'react';
import MercuryCanvas    from '../mercury/MercuryCanvas';
import MercuryControls  from '../mercury/MercuryControls';
import MercuryFireworks from '../mercury/MercuryFireworks';
import InstrumentsPanel       from '../mercury/InstrumentsPanel';
import CastleGrid             from '../mercury/CastleGrid';
import CosmosRegistry         from '../mercury/CosmosRegistry';
import ObservationMatrix      from '../mercury/ObservationMatrix';
import QuintessenceAltar       from '../mercury/QuintessenceAltar';
import ReliquaryView          from '../quintessence/ReliquaryView';
import { loadSealedArtifact } from '../quintessence/sealedArtifact';
import { useMercuryState }    from '../mercury/useMercuryState';
import { computeInstruments } from '../mercury/instruments';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  speed:        0.1,
  turbulence:   0.25,
  density:      isMobile ? 600 : 1200,
  // Fluid-specific
  curlAmp:      0.02,
  tubeRadius:   0.32,
  chromatic:    0.0,
  // Thermal-specific
  flameWidth:   0.85,
  // Earth-specific
  eruptStrength: 0.8,
  // Air-specific
  orbitalSpeed: 1.2,
  spread:       1.0,
};

export default function MercuryTab({ onNavigateTab }) {
  // The reliquary lives here now (spec §5, revised): the altar forges the seal
  // and it appears in place, below. sealNonce forces a re-read of the seal after
  // a compile; sealRef lets the altar scroll the fresh artifact into view.
  const [, bumpSeal] = useReducer(x => x + 1, 0);
  const sealRef = useRef(null);
  const sealedArtifact = loadSealedArtifact();
  const revealSeal = useCallback(() => {
    bumpSeal();
    requestAnimationFrame(() => sealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);
  const [params, setParams]           = useState(DEFAULT_PARAMS);
  const [activePhase, setActivePhase] = useState('fluid');
  const [fps, setFps]                 = useState(0);
  const [liveDensity, setLiveDensity] = useState(DEFAULT_PARAMS.density);
  const densityTimer = useMemo(() => ({ current: null }), []);
  const fireworksRef = useRef(null);
  const handleElementFired = useCallback((element, screenX, screenY) => {
    fireworksRef.current?.fire(element, screenX, screenY);
  }, []);

  // Debounce density changes to avoid buffer churn
  const handleParamsChange = useCallback((next) => {
    setParams(next);
    if (next.density !== params.density) {
      clearTimeout(densityTimer.current);
      densityTimer.current = setTimeout(() => setLiveDensity(next.density), 200);
    }
  }, [params.density, densityTimer]);

  // FPS-adaptive quality: auto-reduce density on mobile if sustained below 30fps
  const fpsAdaptive = useRef({ history: [], adjusted: false });
  useEffect(() => {
    if (!isMobile || fps === 0) return;
    const ad = fpsAdaptive.current;
    ad.history.push(fps);
    if (ad.history.length > 60) ad.history.shift();
    if (!ad.adjusted && ad.history.length >= 60) {
      const avg = ad.history.reduce((a, b) => a + b, 0) / ad.history.length;
      if (avg < 30) {
        ad.adjusted = true;
        setParams(p => {
          const reduced = Math.max(1000, Math.round(p.density * 0.75 / 500) * 500);
          setLiveDensity(reduced);
          return { ...p, density: reduced };
        });
      }
    }
  }, [fps]);

  const mergedParams = { ...params, density: liveDensity };

  const mercuryState = useMercuryState();
  const canvasState  = useMemo(
    () => ({ activePhase, fps, ...params, density: liveDensity }),
    [activePhase, fps, params, liveDensity],
  );
  const instruments  = useMemo(
    () => mercuryState ? computeInstruments(mercuryState, canvasState) : null,
    [mercuryState, canvasState],
  );

  return (
    <div className="max-w-[1800px] mx-auto" style={{ position: 'relative' }}>
      <MercuryFireworks ref={fireworksRef} />
      <style>{`
        @keyframes hg-titleReveal {
          0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(2) blur(1px); letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1) blur(0); letter-spacing: 0.05em; }
        }
        @keyframes hg-energyLine {
          from { width: 0; } to { width: 100%; }
        }
      `}</style>

      {/* Header — Mercury Terminal · vision statement */}
      <div className="mb-6">
        <div className="flex items-start gap-3 mb-2">
          {/* Eye architect glyph */}
          <span
            aria-hidden="true"
            style={{
              fontSize: 26,
              lineHeight: 1,
              color: 'rgba(192,192,192,0.4)',
              animation: 'hg-titleReveal 1s cubic-bezier(0.16,1,0.3,1) both',
              flexShrink: 0,
              marginTop: 3,
            }}
          >◉</span>
          <div>
            <h2
              className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
              style={{
                background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #a0a0a0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'hg-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
              }}
            >
              Mercury Terminal
            </h2>
            <div
              className="text-[9px] font-mono text-zinc-500/50 uppercase tracking-[0.2em] mt-0.5"
              style={{ animation: 'hg-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
            >
              {activePhase} :: phase active // perihelion precession // metallurgy of the present
            </div>
          </div>
        </div>

        {/* Mercury vision statement */}
        <div
          className="font-mono text-[8px] tracking-[0.12em] mb-1 leading-relaxed"
          style={{
            color: 'rgba(192,192,192,0.2)',
            animation: 'hg-titleReveal 0.8s 0.25s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// MERCURY`}</span>
          {' '}— building fairy tale castles on mercury · surveying from perihelion · holding up the mirror
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// EYE PROTOCOL`}</span>
          {' '}— the observer is the instrument · four elements · one surface · humanity reflected
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>{`// OBSERVATION LOOP`}</span>
          {' '}— outer cosmos × inner mirror · castles cast in real time · the log writes itself
        </div>

        <div className="mt-3 relative h-[1px]">
          <div
            style={{
              position: 'absolute', left: 0, top: 0, height: '1px',
              background: 'linear-gradient(90deg, rgba(192,192,192,0.6), rgba(192,192,192,0.1), transparent)',
              animation: 'hg-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}
          />
        </div>
        <div className="border-b border-gray-800/40 pb-4 mb-6" />
      </div>

      {/* Main: canvas is centerpiece — appears first on mobile, right column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Controls — order-last on mobile (below canvas), order-first on desktop (left sidebar) */}
        <div className="order-last lg:order-first">
          <MercuryControls
            activePhase={activePhase}
            params={mergedParams}
            onChange={handleParamsChange}
            fps={fps}
            particleCount={liveDensity}
          />
        </div>
        {/* Canvas — order-first on mobile so it's the first thing you see */}
        <div
          className="order-first lg:order-last w-full rounded-sm overflow-hidden"
          style={{
            height: isMobile
              ? 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))'
              : 'calc(100svh - 260px)',
            minHeight: '300px',
            background: '#000',
            touchAction: 'none',
          }}
        >
          <MercuryCanvas
            params={mergedParams}
            sargScore={1.0}
            onPhaseChange={setActivePhase}
            onFps={setFps}
            onElementFired={handleElementFired}
          />
        </div>
      </div>

      {/* §A — Six observation instruments */}
      <InstrumentsPanel
        mercury={mercuryState}
        canvas={canvasState}
      />

      {/* §B — Four fairy-tale castles */}
      <CastleGrid
        activePhase={activePhase}
        mercury={mercuryState}
        canvas={canvasState}
      />

      {/* §B.5 — The Quintessence Altar (spec §4): the compile trigger */}
      <QuintessenceAltar onDeposited={revealSeal} onNavigate={onNavigateTab} />

      {/* The seal itself — the forged artifact appears here, in place, once a
       * quintessence has been compiled (spec §5, revised: the reliquary lives on
       * Mercury). The uncompiled schematic stays on the kernel tab's /dev/tty0. */}
      {sealedArtifact && (
        <div ref={sealRef} className="mt-4 border-t border-amber-900/20 pt-2">
          <ReliquaryView />
        </div>
      )}

      {/* §D — Cosmos Registry (the fifth element's taxonomy of the whole site) */}
      <CosmosRegistry />

      {/* §C — Live observation log */}
      <ObservationMatrix
        mercury={mercuryState}
        instruments={instruments}
        activePhase={activePhase}
      />

      {/* Footer — mock-discipline citations */}
      <div className="mt-8 pt-4 border-t border-zinc-600/[0.03] text-[7px] font-mono text-zinc-700 leading-relaxed max-w-4xl">
        <p>
          MERCURY TERMINAL v2.0 — sub-solar temperature derived from
          T = ((1−α)·S₀·(1/r²)/εσ)<sup>¼</sup> with Bond albedo α=0.142, emissivity ε=0.95.
          Orbital elements: J2000 epoch, Meeus <i>Astronomical Algorithms</i> 2nd ed. ch.32.
          Mercury rotation: 3:2 spin-orbit resonance (Pettengill &amp; Dyce 1965).
          Solar constant S₀=1361 W/m² (Kopp &amp; Lean 2011).
        </p>
        <p className="mt-2 text-zinc-700/70">
          {`// observation log compiled by the architect from perihelion · cathedral · forge · citadel · spire`}
          <br />
          {`// all instruments cross-referenced against the fifth element's own apocrypha · which refuses citation`}
        </p>
      </div>
    </div>
  );
}
