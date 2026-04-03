import { Suspense, useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import FluidScene from '../fluid/FluidScene';
import FluidControls from '../fluid/FluidControls';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  speed: 0.08,
  curlAmp: 0.02,
  density: isMobile ? 4000 : 10000,
  tubeRadius: 0.32,
  chromatic: 0.0,
};

export default function FluidTab() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [fps, setFps] = useState(0);
  const dpr = useMemo(() => isMobile ? [1, 1.5] : [1, 2], []);

  // Debounce density changes to avoid buffer thrash
  const [liveDensity, setLiveDensity] = useState(params.density);
  const densityTimer = useMemo(() => ({ current: null }), []);
  const handleParamsChange = useCallback((next) => {
    setParams(next);
    if (next.density !== params.density) {
      clearTimeout(densityTimer.current);
      densityTimer.current = setTimeout(() => setLiveDensity(next.density), 200);
    }
  }, [params.density, densityTimer]);

  return (
    <div className="max-w-[1800px] mx-auto">
      {/* ── CSS Animations ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes fd-titleReveal {
          0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(2) blur(1px); letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1) blur(0); letter-spacing: 0.05em; }
        }
        @keyframes fd-energyLine {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes fd-energyPulse {
          0%, 100% { opacity: 0.03; }
          50%      { opacity: 0.07; }
        }
        @keyframes fd-proseReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
          style={{
            background: 'linear-gradient(90deg, #818cf8, #c7d2fe, #6366f1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'fd-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          Bioluminescent Current Simulation
        </h2>
        <div
          className="text-[9px] font-mono text-indigo-500/40 uppercase tracking-[0.2em] mt-1"
          style={{ animation: 'fd-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          Deep-Ocean Signal Propagation // Toroidal Flow Topology
        </div>

        {/* Energy line */}
        <div className="mt-4 relative h-[1px]">
          <div
            style={{
              position: 'absolute', left: 0, top: 0, height: '1px',
              background: 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(99,102,241,0.1), transparent)',
              animation: 'fd-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}
          />
          <div
            style={{
              position: 'absolute', left: 0, top: '-1px', width: '60px', height: '3px',
              background: 'linear-gradient(90deg, rgba(99,102,241,0.4), transparent)',
              filter: 'blur(2px)',
              animation: 'fd-energyPulse 3s 1.5s ease-in-out infinite both',
            }}
          />
        </div>

        <p
          className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl mt-3"
          style={{ animation: 'fd-proseReveal 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          Particle-field simulation modeling bioluminescent signal propagation through
          a closed toroidal manifold. Curl-noise driven flow constrained to a trefoil
          knot boundary. Ars Electronica 2027.
        </p>

        <div className="border-b border-indigo-900/30 pb-4 mb-0" />
      </div>

      {/* ── Main: Controls + Canvas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: Controls */}
        <div>
          <FluidControls
            params={params}
            onChange={handleParamsChange}
            fps={fps}
            particleCount={Math.round(params.density)}
          />
        </div>

        {/* Right: 3D Canvas */}
        <div
          className="w-full rounded-sm overflow-hidden"
          style={{
            height: isMobile ? 'calc(100vh - 480px)' : 'calc(100vh - 260px)',
            minHeight: '300px',
            background: '#000000',
            touchAction: 'none',
          }}
        >
          <Canvas
            camera={{ position: [0, 0, 3.5], fov: 50 }}
            dpr={dpr}
            gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <FluidScene
                isMobile={isMobile}
                speed={params.speed}
                curlAmp={params.curlAmp}
                tubeRadius={params.tubeRadius}
                chromatic={params.chromatic}
                density={liveDensity}
                onFps={setFps}
              />
            </Suspense>
          </Canvas>
        </div>
      </div>
    </div>
  );
}
