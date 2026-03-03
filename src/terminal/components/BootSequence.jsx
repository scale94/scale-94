import React, { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['MOUNTING VOLUMES',          'OK'],
  ['LOADING SOMA_KERNEL_V5.5',  'OK'],
  ['ESTABLISHING SECURE CONN',  'OK'],
  ['DECRYPTING ARCHIVES',       'OK'],
  ['INTEGRITY CHECK',           'PASS'],
];

// Cubic ease-out: fast start → smooth deceleration → clean stop
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// BootSequence owns its entire timing contract.
// onDone fires exactly when the animation is complete — App.jsx doesn't need
// to know the duration, removing the "3000ms magic number in the wrong file" smell.
const BootSequence = ({ onDone }) => {
  // cpuRef  → div wrapper around <Cpu>  — JS writes transform directly (no CSS animation on spin)
  // cardRef → outer card wrapper        — JS writes opacity + blur for the fade
  const cpuRef   = useRef(null);
  const cardRef  = useRef(null);
  const onDoneRef = useRef(onDone); // stable ref so the rAF closure never goes stale
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const SPIN_MS       = 2000;  // CPU spins for exactly 2s → 720° (2 full rotations)
    const FADE_START_MS = 2000;  // fade kicks off the instant spin ends
    const FADE_MS       = 800;   // fade lasts 0.8s → done at 2.8s total
    const DONE_MS       = FADE_START_MS + FADE_MS + 200; // 3s: 200ms visual buffer before unmount
    const t0 = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - t0;

      // ── CPU SPIN ───────────────────────────────────────────────────────────
      // Uses a div wrapper (not the SVG) so transform-origin is always 50% 50%.
      // After 2s spinT clamps to 1 → holds at rotate(720deg) forever.
      if (cpuRef.current) {
        const spinT = Math.min(elapsed / SPIN_MS, 1);
        cpuRef.current.style.transform = `rotate(${easeOut(spinT) * 720}deg)`;
      }

      // ── CARD FADE ──────────────────────────────────────────────────────────
      // Starts at 2000ms, runs 800ms. Opacity + blur written directly — no CSS
      // transition involved, so React reconciliation can never reset it.
      if (elapsed >= FADE_START_MS && cardRef.current) {
        const fadeT = Math.min((elapsed - FADE_START_MS) / FADE_MS, 1);
        const eased = easeOut(fadeT);
        cardRef.current.style.opacity = String(1 - eased);
        cardRef.current.style.filter  = `blur(${eased * 8}px)`;
      }

      if (elapsed < DONE_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        // Animation fully complete — signal the parent to unmount us.
        // The timing contract lives here, not in App.jsx.
        onDoneRef.current?.();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    /*
     * fixed inset-0 z-[100] bg-black
     *   ↳ Covers the entire viewport, above everything, solid black background.
     *     App.jsx returns *only* <BootSequence /> during boot (not both layers),
     *     so there is nothing behind it — but bg-black guarantees a clean seal
     *     even if body background is white or unstyled.
     *
     * pointer-events-none
     *   ↳ Nothing is interactive during boot; this prevents any phantom click
     *     state from accumulating before the terminal mounts.
     */
    <div className="fixed inset-0 z-[100] bg-black font-mono flex items-center justify-center p-4 overflow-hidden pointer-events-none">
      <style>{`
        /* CPU icon green glow pulse — separate from spin so it runs independently */
        @keyframes bs-cpuGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(57,255,20,0.5)); }
          50%     { filter: drop-shadow(0 0 16px rgba(57,255,20,1)) drop-shadow(0 0 32px rgba(57,255,20,0.4)); }
        }
        /* Title reveal — blur + slide up on mount */
        @keyframes bs-titleReveal {
          from { opacity: 0; transform: translateY(-10px); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0);     filter: blur(0); }
        }
        /* Chromatic glitch on SOMA_KERNEL text */
        @keyframes bs-glitch {
          0%  { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(0); }
          20% { text-shadow:  3px 0 #ff00ff,-3px 0 #00ffff; transform: translate(-2px, 1px); }
          40% { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; transform: translate(2px,-1px); }
          60% { text-shadow:  1px 0 #ff00ff,-1px 0 #00ffff; transform: translate(0); }
          80% { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(1px, 2px); }
          100%{ text-shadow: none;                           transform: translate(0); }
        }
        /* Boot lines slide in from the left */
        @keyframes bs-lineIn {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        /* Progress bar fill */
        @keyframes bs-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        /* Moving CRT scanline beam */
        @keyframes bs-scan {
          0%   { top: -4%; }
          100% { top: 104%; }
        }
        /* Gradient border glow breathe */
        @keyframes bs-glow {
          0%,100% { box-shadow: 0 0 12px rgba(6,182,212,0.35), 0 0 40px rgba(217,70,239,0.12); }
          50%     { box-shadow: 0 0 28px rgba(6,182,212,0.7),  0 0 80px rgba(217,70,239,0.3); }
        }
        /* ACTIVE status pulse */
        @keyframes bs-active {
          0%,100% { color: #39ff14; text-shadow: 0 0 8px #39ff14; }
          50%     { color: #00ffaa; text-shadow: 0 0 20px #00ffaa; }
        }
        /* SOMA_KERNEL gradient shimmer */
        @keyframes bs-gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>

      {/* Static CRT scanlines overlay */}
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

      {/* ── CARD ── opacity + blur controlled by the rAF loop above */}
      <div ref={cardRef} className="max-w-lg w-full relative z-10">

        {/* Gradient border glow */}
        <div style={{
          padding: '1.5px',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.6), rgba(217,70,239,0.5), rgba(6,182,212,0.6))',
          borderRadius: '3px',
          animation: 'bs-glow 0.8s ease-in-out infinite',
        }}>
          <div className="bg-black px-6 py-7 md:px-10 md:py-9 rounded-sm border border-white/5">

            {/* Micro status row */}
            <div className="flex justify-between items-center mb-6 text-[9px] tracking-widest uppercase">
              <span className="text-cyan-900/70">SYS::BOOT_SEQUENCE</span>
              <span className="text-fuchsia-900/70">NODE::scale-9.4</span>
            </div>

            {/* Branding block */}
            <div className="flex items-center gap-4" style={{ animation: 'bs-titleReveal 0.35s ease-out forwards' }}>

              {/*
               * CPU spin wrapper — this is a plain <div>, NOT the SVG.
               * Plain divs always have transform-origin: 50% 50% so rotation
               * is perfectly centred. The JS rAF loop writes transform here.
               * The <Cpu> SVG inside gets only the glow animation.
               */}
              <div
                ref={cpuRef}
                className="shrink-0 flex items-center justify-center"
                style={{ width: '2.75rem', height: '2.75rem' }}
              >
                <Cpu
                  className="text-[#39ff14] w-full h-full"
                  style={{ animation: 'bs-cpuGlow 1.2s ease-in-out 0.4s infinite' }}
                />
              </div>

              <div>
                <div
                  className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-cyan-300 to-cyan-500"
                  style={{
                    backgroundSize: '200% auto',
                    // glitch fires 5× at 0.45s, gradient shifts over the full 3s window
                    animation: 'bs-glitch 0.25s steps(1) 0.45s 5 forwards, bs-gradient-x 3s ease forwards',
                  }}
                >
                  SOMA_KERNEL
                </div>
                <div className="text-fuchsia-500 text-xs font-bold tracking-[0.25em] mt-2 uppercase">
                  v5.5 &nbsp;//&nbsp; FISH_SCALE_NECROMANCER
                </div>
              </div>
            </div>

            <div className="border-t border-cyan-900/40 my-5" />

            {/* Boot lines — staggered every 290ms starting at 200ms */}
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

            {/* Progress bar — 2.1s fill, starts at 0.2s, completes at ~2.3s */}
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

            {/*
             * ACTIVE status — appears at 1.8s (right as progress bar nears end),
             * pulse loop starts at 2s. Visible for 0.2s before the card fade begins,
             * then fades with the rest of the card via the rAF opacity write.
             */}
            <div
              className="text-xs font-black tracking-widest"
              style={{
                opacity: 0,
                color: '#39ff14',
                animation: 'bs-lineIn 0.2s ease-out 1.8s forwards, bs-active 0.35s ease-in-out 2s infinite',
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
