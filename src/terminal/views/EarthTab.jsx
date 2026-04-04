import { Suspense, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import EarthScene from '../earth/EarthScene';
import EarthControls from '../earth/EarthControls';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  speed:         0.08,
  turbulence:    0.25,
  eruptStrength: 0.8,
  density:       isMobile ? 4000 : 10000,
};

export default function EarthTab() {
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
        @keyframes ea-titleReveal {
          0%   { opacity: 0; filter: brightness(4) blur(8px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(2) blur(2px); letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1) blur(0);   letter-spacing: 0.05em; }
        }
        @keyframes ea-energyLine { from { width: 0; } to { width: 100%; } }
        @keyframes ea-rumble {
          0%, 100% { opacity: 0.04; }
          30%      { opacity: 0.11; }
          70%      { opacity: 0.07; }
        }
        @keyframes ea-proseReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
        }
      `}</style>

      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
          style={{
            background: 'linear-gradient(90deg, #d97706, #b45309, #92400e, #78350f)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'ea-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          Geological Sediment Dynamics
        </h2>
        <div
          className="text-[9px] font-mono text-amber-600/40 uppercase tracking-[0.2em] mt-1"
          style={{ animation: 'ea-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          Tectonic Stratification // Crystal Geode Boundary // Lithospheric Mass Cascade
        </div>

        <div className="mt-4 relative h-[1px]">
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '1px',
            background: 'linear-gradient(90deg, rgba(180,83,9,0.7), rgba(146,64,14,0.3), transparent)',
            animation: 'ea-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
          }} />
          <div style={{
            position: 'absolute', left: 0, top: '-2px', width: '70px', height: '4px',
            background: 'linear-gradient(90deg, rgba(217,119,6,0.5), transparent)',
            filter: 'blur(3px)',
            animation: 'ea-rumble 3.2s 1.5s ease-in-out infinite both',
          }} />
        </div>

        <p
          className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl mt-3"
          style={{ animation: 'ea-proseReveal 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          GPU-driven geological particle simulation. 10,000 individual grains spanning
          the full lithospheric spectrum — chalk surface to obsidian mantle — inside a
          crystalline icosahedron geode boundary. Mass-stratified buoyancy with slow
          tectonic turbulence and 10% volcanic eruption fraction. Ars Electronica 2027.
        </p>

        <div className="border-b border-amber-900/25 pb-4 mb-6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div>
          <EarthControls
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
            background: '#060402',
            touchAction: 'none',
          }}
        >
          <Canvas
            camera={{ position: isMobile ? [0, 0.3, 5.0] : [-1.6, 0.8, 3.8], fov: 50 }}
            dpr={dpr}
            gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <EarthScene
                isMobile={isMobile}
                speed={params.speed}
                turbulence={params.turbulence}
                eruptStrength={params.eruptStrength}
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
