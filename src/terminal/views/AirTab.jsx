import { Suspense, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import AirScene from '../air/AirScene';
import AirControls from '../air/AirControls';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  orbitalSpeed: 1.2,
  turbulence:   0.18,
  spread:       1.0,
  density:      isMobile ? 4000 : 10000,
};

export default function AirTab() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [fps,    setFps]    = useState(0);
  const dpr = useMemo(() => isMobile ? [1, 1.5] : [1, 2], []);

  const [liveDensity, setLiveDensity] = useState(params.density);
  const densityTimer = useMemo(() => ({ current: null }), []);
  const handleParamsChange = useCallback((next) => {
    setParams(next);
    if (next.density !== params.density) {
      clearTimeout(densityTimer.current);
      densityTimer.current = setTimeout(() => setLiveDensity(next.density), 200);
    }
  }, [params.density, densityTimer]);

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
          const reduced = Math.max(2000, Math.round(p.density * 0.75 / 500) * 500);
          setLiveDensity(reduced);
          return { ...p, density: reduced };
        });
      }
    }
  }, [fps]);

  return (
    <div className="max-w-[1800px] mx-auto">
      <style>{`
        @keyframes at-titleReveal {
          0%   { opacity: 0; filter: brightness(5) blur(10px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(2.5) blur(2px); letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1)   blur(0);   letter-spacing: 0.05em; }
        }
        @keyframes at-energyLine { from { width: 0; } to { width: 100%; } }
        @keyframes at-shimmer {
          0%, 100% { opacity: 0.04; }
          50%      { opacity: 0.12; }
        }
        @keyframes at-proseReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
        }
      `}</style>

      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
          style={{
            background: 'linear-gradient(90deg, #38bdf8, #0ea5e9, #0284c7, #7dd3fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'at-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          Atmospheric Vortex Dynamics
        </h2>
        <div
          className="text-[9px] font-mono text-sky-500/40 uppercase tracking-[0.2em] mt-1"
          style={{ animation: 'at-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          Cyclonic Helical Orbits // Atmospheric Shell // Ionospheric Plasma Layer
        </div>

        <div className="mt-4 relative h-[1px]">
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '1px',
            background: 'linear-gradient(90deg, rgba(56,189,248,0.7), rgba(14,165,233,0.25), transparent)',
            animation: 'at-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
          }} />
          <div style={{
            position: 'absolute', left: 0, top: '-2px', width: '80px', height: '4px',
            background: 'linear-gradient(90deg, rgba(125,211,252,0.5), transparent)',
            filter: 'blur(3px)',
            animation: 'at-shimmer 2.8s 1.5s ease-in-out infinite both',
          }} />
        </div>

        <p
          className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl mt-3"
          style={{ animation: 'at-proseReveal 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          GPU-driven atmospheric particle simulation. 10,000 individual molecules spanning
          the full atmospheric column — surface mist to ionospheric plasma — orbiting in
          contra-rotating helical layers inside a refractive atmospheric sphere. Altitude-
          stratified cyclonic mechanics with 8% ionospheric fast-layer fraction. Ars Electronica 2027.
        </p>

        <div className="border-b border-sky-900/25 pb-4 mb-6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div>
          <AirControls
            params={params}
            onChange={handleParamsChange}
            fps={fps}
            particleCount={Math.round(liveDensity)}
          />
        </div>

        <div
          className="w-full rounded-sm overflow-hidden"
          style={{
            height: isMobile
              ? 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))'
              : 'calc(100svh - 260px)',
            minHeight: '300px',
            background: '#010308',
            touchAction: 'none',
          }}
        >
          <Canvas
            camera={{ position: isMobile ? [0, 0.5, 5.5] : [0.5, 2.0, 4.8], fov: isMobile ? 52 : 52 }}
            dpr={dpr}
            gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <AirScene
                isMobile={isMobile}
                orbitalSpeed={params.orbitalSpeed}
                turbulence={params.turbulence}
                spread={params.spread}
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
