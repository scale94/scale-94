import React, { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['MOUNTING VOLUMES',          'OK'],
  ['LOADING SOMA_KERNEL_V5.5',  'OK'],
  ['ESTABLISHING SECURE CONN',  'OK'],
  ['DECRYPTING ARCHIVES',       'OK'],
  ['INTEGRITY CHECK',           'PASS'],
];

// ease-out cubic — reaches 100% in exactly `duration` ms
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// React.memo — no props, so parent App re-renders can never touch this tree.
const BootSequence = () => {
  const cpuRef  = useRef(null); // wrapper div — spin target
  const cardRef = useRef(null); // card wrapper — fade target

  useEffect(() => {
    //  0 ms → 2000 ms   : CPU spins 720° (ease-out)
    //  2000 ms → 3000 ms: card fades opacity 1 → 0 (linear)
    const SPIN_MS       = 2000;
    const FADE_START_MS = 2000;
    const FADE_MS       = 1000;
    
    let startTime = null;
    let raf;

    const tick = (now) => {
      // FIX: Capture startTime on the exact millisecond the browser paints the first frame.
      // This prevents the animation from instantly skipping to the end in production builds.
      if (!startTime) startTime = now;
      const elapsed = now - startTime;

      // CPU spin
      const spinT = Math.min(elapsed / SPIN_MS, 1);
      if (cpuRef.current) {
        cpuRef.current.style.transform = `rotate(${easeOut(spinT) * 720}deg)`;
      }

      // Card fade (starts at 2 s)
      if (elapsed >= FADE_START_MS && cardRef.current) {
        const fadeT = Math.min((elapsed - FADE_START_MS) / FADE_MS, 1);
        cardRef.current.style.opacity = String(1 - fadeT);
      }

      // Stop the loop once both animations are complete (at 3 s)
      if (elapsed < FADE_START_MS + FADE_MS) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen bg-black font-mono flex items-center justify-center p-4 overflow-hidden relative">
      
      {/* Injecting the keyframes via React guarantees they are rendered at runtime. 
        This completely prevents PostCSS/Tailwind from purging or mis-ordering them in production. 
      */}
      <style>{`
        @keyframes bs-cpuGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(57,255,20,0.5)); }
          50%     { filter: drop-shadow(0 0 16px rgba(57,255,20,1)) drop-shadow(0 0 32px rgba(57,255,20,0.4)); }
        }
        @keyframes bs-titleReveal {
          from { opacity: 0; transform: translateY(-10px); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0);     filter: blur(0); }
        }
        @keyframes bs-glitch {
          0%  { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(0); }
          20% { text-shadow:  3px 0 #ff00ff,-3px 0 #00ffff; transform: translate(-2px, 1px); }
          40% { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; transform: translate(2px,-1px); }
          60% { text-shadow:  1px 0 #ff00ff,-1px 0 #00ffff; transform: translate(0); }
          80% { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(1px, 2px); }
          100%{ text-shadow: none;                           transform: translate(0); }
        }
        @keyframes bs-lineIn {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bs-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes bs-scan {
          0%   { top: -4%; }
          100% { top: 104%; }
        }
        @keyframes bs-glow {
          0%,100% { box-shadow: 0 0 12px rgba(6,182,212,0.35), 0 0 40px rgba(217,70,239,0.12); }
          50%     { box-shadow: 0 0 28px rgba(6,182,212,0.7),  0 0 80px rgba(217,70,239,0.3);  }
        }
        @keyframes bs-active {
          0%,100% { color: #39ff14; text-shadow: 0 0 8px #39ff14; }
          50%     { color: #00ffaa; text-shadow: 0 0 20px #00ffaa; }
        }
        @keyframes bs-gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>

      {/* Static CRT scanlines texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
      }} />

      {/* Moving scanline beam */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '3px', zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(transparent, rgba(6,182,212,0.5), transparent)',
        animation: 'bs-scan 0.9s linear infinite',
      }} />

      {/* Card wrapper — opacity driven by JS rAF */}
      <div ref={cardRef} className="max-w-lg w-full relative z-10">

        {/* Glowing gradient border */}
        <div style={{
          padding: '1.5px',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.6), rgba(217,70,239,0.5), rgba(6,182,212,0.6))',
          borderRadius: '3px',
          animation: 'bs-glow 0.8s ease-in-out infinite',
        }}>
          <div className="bg-black px-6 py-7 md:px-10 md:py-9 rounded-sm">

            {/* Top micro status row */}
            <div className="flex justify-between items-center mb-6 text-[9px] tracking-widest">
              <span className="text-cyan-900/70">SYS::BOOT_SEQUENCE</span>
              <span className="text-fuchsia-900/70">NODE::scale-9.4</span>
            </div>

            {/* Title block */}
            <div className="flex items-center gap-4" style={{ animation: 'bs-titleReveal 0.35s ease-out forwards' }}>

              {/* CPU spin wrapper — plain HTML div so transform-origin:50% 50% is
                  reliable cross-browser. transform is written directly to el.style
                  by the rAF loop; React never sees it so reconciliation can't reset it. */}
              <div
                ref={cpuRef}
                className="shrink-0"
                style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  animation: 'bs-cpuGlow 1.2s ease-in-out 0.4s infinite',
                }}
              >
                <Cpu
                  className="text-[#39ff14]"
                  style={{ width: '2.75rem', height: '2.75rem' }}
                />
              </div>

              <div>
                <div
                  className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-cyan-300 to-cyan-500"
                  style={{
                    backgroundSize: '200% auto',
                    animation: 'bs-glitch 0.25s steps(1) 0.45s 5 forwards, bs-gradient-x 3s ease forwards'
                  }}
                >
                  SOMA_KERNEL
                </div>
                <div className="text-fuchsia-500 text-xs font-bold tracking-[0.25em] mt-2 uppercase">
                  v5.5 &nbsp;//&nbsp; FISH_SCALE_NECROMANCER
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-cyan-900/40 my-5" />

            {/* Boot lines — staggered, all visible by ~1.4 s */}
            <div className="space-y-2 text-xs font-bold mb-6">
              {BOOT_LINES.map(([label, status], i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-cyan-500"
                  style={{ opacity: 0, animation: `bs-lineIn 0.18s ease-out ${200 + i * 290}ms forwards` }}
                >
                  <span>
                    <span className="text-fuchsia-500 mr-1">{'>'}</span>
                    {label}
                    <span className="text-cyan-900/60">...</span>
                  </span>
                  <span className="text-[#39ff14] ml-6 tracking-widest">[{status}]</span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="h-[2px] bg-cyan-950 w-full rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: 0,
                    animation: 'bs-progress 2.1s cubic-bezier(0.4,0,0.2,1) 0.2s forwards',
                    background: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                    boxShadow: '0 0 10px rgba(6,182,212,0.9)',
                  }}
                />
              </div>
            </div>

            {/* Final active status — appears at 1.6 s, 0.4 s before the fade */}
            <div
              className="text-xs font-black tracking-widest"
              style={{
                opacity: 0,
                color: '#39ff14',
                animation: 'bs-lineIn 0.2s ease-out 1.6s forwards, bs-active 0.35s ease-in-out 1.8s infinite',
              }}
            >
              {'>'} scale_9.4 ACTIVE :: ALL SYSTEMS OPERATIONAL
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BootSequence);