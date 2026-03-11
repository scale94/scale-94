import React, { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['MOUNTING VOLUMES',           'OK'],
  ['LOADING SOMA_KERNEL_9.1',    'OK'],
  ['GAIA BUILD: OSTROM PROTOCOL','ACTIVE'],
  ['ESTABLISHING SECURE CONN',   'OK'],
  ['INTEGRITY CHECK',            'PASS'],
];

// Cubic ease-out: fast start → smooth deceleration → clean stop
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// BootSequence owns its entire timing contract.
// onDone fires exactly when the animation is complete — App.jsx doesn't need
// to know the duration, removing the "3000ms magic number in the wrong file" smell.
const BootSequence = ({ onDone }) => {
  // cpuRef  → div wrapper around <Cpu>  — JS writes transform directly (no CSS animation on spin)
  // cardRef → outer card wrapper        — CSS transition handles the fade-out
  const cpuRef    = useRef(null);
  const cardRef   = useRef(null);
  const onDoneRef = useRef(onDone); // stable ref so closures never go stale
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const SPIN_MS       = 2000;  // CPU spins for exactly 2s → 720° (2 full rotations)
    const FADE_START_MS = 2800;  // 800ms dwell after spin ends — "ACTIVE" is fully visible
    const DONE_MS       = 4000;  // 2.8s + 1s CSS fade + 0.2s buffer = 4s total (+1s from original 3s)

    const t0 = performance.now();
    let raf;
    let tid; // timeout id for the unmount signal

    const tick = (now) => {
      const elapsed = now - t0;

      // ── CPU SPIN ──────────────────────────────────────────────────────────
      // Uses a div wrapper (not the SVG) so transform-origin is always 50% 50%.
      // After 2s spinT clamps to 1 → holds at rotate(720deg) forever.
      if (cpuRef.current) {
        const spinT = Math.min(elapsed / SPIN_MS, 1);
        cpuRef.current.style.transform = `rotate(${easeOut(spinT) * 720}deg)`;
      }

      // ── FADE TRIGGER ──────────────────────────────────────────────────────
      // Fires once at FADE_START_MS. Writing opacity: 0 onto a node that has
      // `transition: opacity 1s ease-out` triggers the browser's compositor —
      // no per-frame JS work needed. We hand off to setTimeout for the unmount
      // signal and stop the rAF loop entirely.
      if (elapsed >= FADE_START_MS) {
        if (cardRef.current) {
          cardRef.current.style.opacity = '0';
          cardRef.current.style.filter  = 'blur(8px)';
        }
        // Wait for the CSS transition to finish (plus the 200ms buffer) before
        // signalling the parent to unmount. Math.max guards against elapsed
        // overshooting DONE_MS on a slow frame.
        tid = setTimeout(() => onDoneRef.current?.(), Math.max(DONE_MS - elapsed, 0));
        return; // stop rAF — CSS transition + setTimeout own it from here
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tid);
    };
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
      {/* bs-* keyframes are defined globally in src/index.css → compiled into the
          production CSS bundle. No inline redefinition needed here.
          Scanlines are now owned by App.jsx at z-[101] — tied to bootSequence
          state so they're removed from the DOM the instant boot ends. */}

      {/*
       * ── CARD ──
       * transition: opacity 1s ease-out, filter 1s ease-out
       *   The rAF loop writes opacity='0' + filter='blur(8px)' exactly once at
       *   FADE_START_MS (2800ms). The browser's compositor handles the 1s
       *   interpolation — no per-frame JS writes during the fade.
       */}
      <div
        ref={cardRef}
        className="max-w-lg w-full relative z-10"
        style={{ transition: 'opacity 1s ease-out, filter 1s ease-out' }}
      >

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
                  SOMA_9.1
                </div>
                <div className="text-fuchsia-500 text-xs font-bold tracking-[0.25em] mt-2 uppercase">
                  GAIA BUILD &nbsp;//&nbsp; OSTROM_PROTOCOL
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
             * pulse loop starts at 2s. Fully visible for 0.8s before the card
             * fade begins at 2.8s, then fades with the rest of the card via the
             * CSS transition on the parent ref.
             */}
            <div
              className="text-xs font-black tracking-widest"
              style={{
                opacity: 0,
                color: '#39ff14',
                animation: 'bs-lineIn 0.2s ease-out 1.8s forwards, bs-active 0.35s ease-in-out 2s infinite',
              }}
            >
              {'>'} SOMA-9.1 // GAIA BUILD :: ALL SYSTEMS OPERATIONAL
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BootSequence);
