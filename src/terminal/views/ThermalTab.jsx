import { Suspense, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import ThermalScene from '../thermal/ThermalScene';
import ThermalControls from '../thermal/ThermalControls';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  speed:      0.13,
  turbulence: 0.40,
  flameWidth: 0.85,
  density:    isMobile ? 4000 : 10000,
};

export default function ThermalTab() {
  const [params, setParams]     = useState(DEFAULT_PARAMS);
  const [fps,    setFps]        = useState(0);
  const dpr = useMemo(() => isMobile ? [1, 1.5] : [1, 2], []);

  // Debounce density changes so buffer rebuild isn't thrashed
  const [liveDensity, setLiveDensity] = useState(params.density);
  const densityTimer = useMemo(() => ({ current: null }), []);
  const handleParamsChange = useCallback((next) => {
    setParams(next);
    if (next.density !== params.density) {
      clearTimeout(densityTimer.current);
      densityTimer.current = setTimeout(() => setLiveDensity(next.density), 200);
    }
  }, [params.density, densityTimer]);

  // Adaptive quality: auto-reduce particles if mobile FPS < 30
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
      {/* ── CSS Animations ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes th-titleReveal {
          0%   { opacity: 0; filter: brightness(5) blur(10px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(3)  blur(2px);  letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1)  blur(0);    letter-spacing: 0.05em; }
        }
        @keyframes th-energyLine {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes th-emberPulse {
          0%, 100% { opacity: 0.05; transform: scaleX(1);   }
          50%      { opacity: 0.14; transform: scaleX(1.04); }
        }
        @keyframes th-proseReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(2px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0);   }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
          style={{
            background: 'linear-gradient(90deg, #fb923c, #f97316, #ef4444, #dc2626)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'th-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          Thermal Convection Dynamics
        </h2>
        <div
          className="text-[9px] font-mono text-orange-500/40 uppercase tracking-[0.2em] mt-1"
          style={{ animation: 'th-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          Incandescent Buoyancy // Möbius Hearth // Blackbody Radiation Palette
        </div>

        {/* Ember line */}
        <div className="mt-4 relative h-[1px]">
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '1px',
            background: 'linear-gradient(90deg, rgba(249,115,22,0.7), rgba(239,68,68,0.3), transparent)',
            animation: 'th-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
          }} />
          <div style={{
            position: 'absolute', left: 0, top: '-2px', width: '90px', height: '5px',
            background: 'linear-gradient(90deg, rgba(251,146,60,0.6), transparent)',
            filter: 'blur(3px)',
            animation: 'th-emberPulse 2.4s 1.5s ease-in-out infinite both',
          }} />
        </div>

        <p
          className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl mt-3"
          style={{ animation: 'th-proseReveal 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          GPU-driven incandescent particle simulation. 10,000 individual points spanning
          the full blackbody radiation spectrum (6500 K plasma → 1200 K ember) inside a
          refractive smoked-glass Möbius boundary. Curl-noise turbulent convection with
          tapered cone buoyancy and 15% ember fly-off fraction. Ars Electronica 2027.
        </p>

        <div className="border-b border-orange-900/25 pb-4 mb-6" />
      </div>

      {/* ── Main: Controls + Canvas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: Controls */}
        <div>
          <ThermalControls
            params={params}
            onChange={handleParamsChange}
            fps={fps}
            particleCount={Math.round(liveDensity)}
          />
        </div>

        {/* Right: 3D Canvas */}
        <div
          className="w-full rounded-sm overflow-hidden"
          style={{
            height: isMobile
              ? 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))'
              : 'calc(100svh - 260px)',
            minHeight: '300px',
            background: '#080300',
            touchAction: 'none',
          }}
        >
          <Canvas
            camera={{ position: [0, 0.6, 4.8], fov: 52 }}
            dpr={dpr}
            gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
          >
            <Suspense fallback={null}>
              <ThermalScene
                isMobile={isMobile}
                speed={params.speed}
                turbulence={params.turbulence}
                flameWidth={params.flameWidth}
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
