import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['MOUNTING VOLUMES',          'OK'],
  ['LOADING SOMA_KERNEL_V5.5',  'OK'],
  ['ESTABLISHING SECURE CONN',  'OK'],
  ['DECRYPTING ARCHIVES',       'OK'],
  ['INTEGRITY CHECK',           'PASS'],
];

// React.memo — BootSequence has no props, so it NEVER re-renders from parent
// App.jsx state changes (useSystemLog, etc.).  This is critical: any re-render
// that touches an element's `animation` style — even with the same value — can
// reset the running CSS animation in some browsers.
const BootSequence = () => {
  // phase 0 = spinning window (0–2 s)
  // phase 1 = fading window  (2–3 s) — set by a JS timer, NOT by a CSS keyframe
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 2000);
    return () => clearTimeout(t);   // cleanup handles React.StrictMode double-mount
  }, []);

  return (
    <div className="min-h-screen bg-black font-mono flex items-center justify-center p-4 overflow-hidden relative">
      {/* All bs-* keyframes live in index.css — never in a JSX <style> tag,
          which React can re-inject on re-renders and reset running animations. */}

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

      {/* Whole-frame card wrapper.
          The fade is a CSS *transition* triggered by a JS state change — NOT a
          @keyframes animation — so it cannot be accidentally reset by React. */}
      <div
        className="max-w-lg w-full relative z-10"
        style={{
          opacity: phase === 0 ? 1 : 0,
          transition: 'opacity 1s linear',
        }}
      >

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
              <Cpu
                className="shrink-0 text-[#39ff14]"
                style={{
                  width: '2.75rem', height: '2.75rem',
                  // Phase 0: 2 full rotations in 2 s (ease-out, holds at 720° via forwards) + glow
                  // Phase 1: spin dropped — glow continues while card fades out
                  animation: phase === 0
                    ? 'bs-cpuSpin 2s ease-out forwards, bs-cpuGlow 1.2s ease-in-out 0.4s infinite'
                    : 'bs-cpuGlow 1.2s ease-in-out 0.4s infinite',
                }}
              />
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

            {/* Boot lines — staggered 200 ms apart, all visible well before the 2 s mark */}
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

            {/* Progress bar — fills over ~2 s */}
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

            {/* Final active status — appears at 1.6 s, 0.4 s before the fade begins */}
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
