import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['MOUNTING VOLUMES',          'OK'],
  ['LOADING SOMA_KERNEL_V5.5',  'OK'],
  ['ESTABLISHING SECURE CONN',  'OK'],
  ['DECRYPTING ARCHIVES',       'OK'],
  ['INTEGRITY CHECK',           'PASS'],
];

const BootSequence = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // A double requestAnimationFrame ensures the browser paints the initial 0deg state
    // before we apply the 720deg target. This guarantees the CSS transition fires flawlessly.
    let frame2;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        setMounted(true);
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black font-mono flex items-center justify-center p-4 overflow-hidden relative">
      
      <style>{`
        /* CRITICAL FIX: Renamed all keyframes from 'bs-' to 'sk-'. 
           In production, Vite loads your global index.css LAST. If your old 
           infinite spin keyframes were still in index.css, they were overwriting 
           these inline styles! Changing the names breaks the conflict.
        */
        @keyframes sk-cpuGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(57,255,20,0.5)); }
          50%     { filter: drop-shadow(0 0 16px rgba(57,255,20,1)) drop-shadow(0 0 32px rgba(57,255,20,0.4)); }
        }
        @keyframes sk-titleReveal {
          from { opacity: 0; transform: translateY(-10px); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0);     filter: blur(0); }
        }
        @keyframes sk-glitch {
          0%  { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(0); }
          20% { text-shadow:  3px 0 #ff00ff,-3px 0 #00ffff; transform: translate(-2px, 1px); }
          40% { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; transform: translate(2px,-1px); }
          60% { text-shadow:  1px 0 #ff00ff,-1px 0 #00ffff; transform: translate(0); }
          80% { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(1px, 2px); }
          100%{ text-shadow: none;                           transform: translate(0); }
        }
        @keyframes sk-lineIn {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sk-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes sk-scan {
          0%   { top: -4%; }
          100% { top: 104%; }
        }
        @keyframes sk-flicker {
          0%,94%,96%,98%,100% { opacity: 1; }
          95%  { opacity: 0.7; }
          97%  { opacity: 0.85; }
        }
        @keyframes sk-glow {
          0%,100% { box-shadow: 0 0 12px rgba(6,182,212,0.35), 0 0 40px rgba(217,70,239,0.12); }
          50%     { box-shadow: 0 0 28px rgba(6,182,212,0.7),  0 0 80px rgba(217,70,239,0.3);  }
        }
        @keyframes sk-active {
          0%,100% { color: #39ff14; text-shadow: 0 0 8px #39ff14; }
          50%     { color: #00ffaa; text-shadow: 0 0 20px #00ffaa; }
        }
        @keyframes sk-gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes sk-cardFade {
          0%, 65% { opacity: 1; filter: blur(0px); }
          100%    { opacity: 0; filter: blur(4px); }
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
        animation: 'sk-scan 0.9s linear infinite',
      }} />

      {/* Outer wrapper for flicker effect */}
      <div className="max-w-lg w-full relative z-10" style={{ animation: 'sk-flicker 2s linear forwards' }}>
        
        {/* Inner wrapper handles the linear fade out matching your 3.1s timeout */}
        <div style={{ animation: 'sk-cardFade 3.1s linear forwards' }}>
          
          {/* Glowing gradient border */}
          <div style={{
            padding: '1.5px',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.6), rgba(217,70,239,0.5), rgba(6,182,212,0.6))',
            borderRadius: '3px',
            animation: 'sk-glow 0.8s ease-in-out infinite',
          }}>
            <div className="bg-black px-6 py-7 md:px-10 md:py-9 rounded-sm">

              {/* Top micro status row */}
              <div className="flex justify-between items-center mb-6 text-[9px] tracking-widest">
                <span className="text-cyan-900/70">SYS::BOOT_SEQUENCE</span>
                <span className="text-fuchsia-900/70">NODE::scale-9.4</span>
              </div>

              {/* Title block */}
              <div className="flex items-center gap-4" style={{ animation: 'sk-titleReveal 0.35s ease-out forwards' }}>

                {/* SPIN FIX: We ditched @keyframes for the spin completely. 
                    It is now a pure state-driven CSS transition. It is immune to CSS purgers and keyframe overrides. */}
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: '2.75rem',
                    height: '2.75rem',
                    transform: mounted ? 'rotate(720deg)' : 'rotate(0deg)',
                    transition: 'transform 2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <Cpu
                    className="text-[#39ff14] w-full h-full"
                    style={{ animation: 'sk-cpuGlow 1.2s ease-in-out 0.4s infinite' }}
                  />
                </div>

                <div>
                  <div
                    className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-cyan-300 to-cyan-500"
                    style={{
                      backgroundSize: '200% auto',
                      animation: 'sk-glitch 0.25s steps(1) 0.45s 5 forwards, sk-gradient-x 2s ease forwards'
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
                    style={{ opacity: 0, animation: `sk-lineIn 0.18s ease-out ${200 + i * 290}ms forwards` }}
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
                      animation: 'sk-progress 2.1s cubic-bezier(0.4,0,0.2,1) 0.2s forwards',
                      background: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                      boxShadow: '0 0 10px rgba(6,182,212,0.9)',
                    }}
                  />
                </div>
              </div>

              {/* Final active status — appears at 1.6 s */}
              <div
                className="text-xs font-black tracking-widest"
                style={{
                  opacity: 0,
                  color: '#39ff14',
                  animation: 'sk-lineIn 0.2s ease-out 1.6s forwards, sk-active 0.35s ease-in-out 1.8s infinite',
                }}
              >
                {'>'} scale_9.4 ACTIVE :: ALL SYSTEMS OPERATIONAL
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BootSequence);