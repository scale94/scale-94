import React, { useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';

// Eleven system modules — every nav tab boots in sequence.
// Entropy is the threat. Crystalline is the lock. Zero white fade.
// Drama arc: modules load → entropy spikes → crystalline lock → kernel apex → deep modules arm.
const AXIOMS = [
  { name: 'manifesto',      field: 'doctrine',     status: 'ok',        variant: 'normal'      },
  { name: 'scaling',        field: 'growth',       status: 'ok',        variant: 'normal'      },
  { name: 'privacy',        field: 'locked',       status: 'ok',        variant: 'normal'      },
  { name: 'transmission',   field: 'signal',       status: 'ok',        variant: 'normal'      },
  { name: 'entropy',        field: 'threat',       status: 'contained', variant: 'threat'      },
  { name: 'crystalline',    field: 'phase',        status: 'locked',    variant: 'crystalline' },
  { name: '7.7.7.7.7.7.7', field: 'kernel',       status: 'active',    variant: 'apex'        },
  { name: 'panopticon',     field: 'surveillance', status: 'indexed',   variant: 'normal'      },
  { name: 'bsky',           field: 'social',       status: 'online',    variant: 'normal'      },
  { name: 'pqc_enclave',    field: 'cryptography', status: 'armed',     variant: 'normal'      },
  { name: 'feigenbaum_fade', field: 'chaos',        status: 'rendering', variant: 'normal'      },
];

// 180ms base, 200ms between each axiom — keeps last line-in at ~2180ms, well before fade
const axiomDelay = (i) => 180 + i * 200;

// Doctrine rainbow — 11 stops, tracks clockwise perimeter fill:
// top (magenta→gold) · right (gold→spring) · bottom (spring→deep-blue) · left (deep-blue→hot-pink)
const DOCTRINE_RAINBOW = [
  '#FF0088', //  0 magenta    — top-left       (manifesto)
  '#FF4400', //  1 red-orange — top-mid        (scaling)
  '#FFD700', //  2 gold       — top/right jxn  (privacy)
  '#88FF00', //  3 yellow-lime — right-upper   (transmission)
  '#00FFAA', //  4 spring     — right/btm jxn  (entropy)
  '#00EEFF', //  5 bright-cyan — bottom-mid    (crystalline)
  '#0088FF', //  6 sky-blue   — bottom-left    (7.7.7.7.7.7.7)
  '#0033FF', //  7 deep-blue  — btm/left jxn   (panopticon)
  '#4400FF', //  8 indigo     — left-mid        (bsky)
  '#AA00FF', //  9 violet     — left-upper      (pqc_enclave)
  '#FF00CC', // 10 hot-pink   — left-top        (fade_doctrine)
];

// Status tag pop delays — 300ms cadence keeps all 11 pops inside the 3600ms perimeter arc
// Last pop: 300 + 10×300 = 3300ms  ← 500ms before perimeter completes at 3800ms
const popDelay = (i) => 300 + i * 300;

// Cubic ease-out: fast start → smooth deceleration → clean stop
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const BootSequence = ({ onDone }) => {
  const squareRef = useRef(null);
  const cardRef   = useRef(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Frame color tracks the most recently rendered status tag — drives border + glow
  const [frameColor, setFrameColor] = useState('#FFD700');

  useEffect(() => {
    const timers = AXIOMS.map((_, i) => (
      setTimeout(() => setFrameColor(DOCTRINE_RAINBOW[i]), popDelay(i))
    ));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const SPIN_MS         = 2000;
    const FADE_START_MS   = 3800;
    const COLLAPSE_END_MS = 4250;             // card fully collapsed to singularity
    // ── OBSERVER beat ──────────────────────────────────────────────────────
    // After the seraphine card collapses to a point, the alien-architect
    // frame engages explicitly: the ◉ eye glyph blooms from the singularity,
    // pulses once, then hands off to the terminal. This is the last pre-
    // terminal frame the juror sees in a scrub-pass of the capture video —
    // it tells them WHO is observing the system before they meet it.
    const OBSERVER_START_MS = COLLAPSE_END_MS;  // glyph fade-in begins
    const DONE_MS           = 5800;             // total boot: ~5.8s
    const EXIT_DURATION     = COLLAPSE_END_MS - FADE_START_MS; // 450ms

    const t0 = performance.now();
    let raf;
    let tid;

    const tick = (now) => {
      const elapsed = now - t0;

      if (squareRef.current) {
        const spinT   = Math.min(elapsed / SPIN_MS, 1);
        const baseDeg = easeOut(spinT) * 720;

        if (elapsed < FADE_START_MS) {
          squareRef.current.style.transform = `rotate(${baseDeg}deg)`;
        } else if (elapsed < COLLAPSE_END_MS) {
          // Exit: ease-in collapse (accelerates into singularity — Blender S→0).
          const exitT     = Math.min((elapsed - FADE_START_MS) / EXIT_DURATION, 1);
          const exitScale = 1 - (exitT * exitT * exitT);   // ease-in cubic
          const exitDeg   = baseDeg + exitT * 180;          // slow final rotation
          squareRef.current.style.transform = `rotate(${exitDeg}deg) scale(${exitScale})`;
        } else {
          // After collapse: card stays at scale 0. The observer beat takes over
          // in its own DOM layer (rendered below, independent of squareRef).
          squareRef.current.style.transform = 'scale(0)';
        }
      }

      if (elapsed >= DONE_MS) {
        onDoneRef.current?.();
        return;
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
    <div className="fixed inset-0 z-[100] bg-black font-mono flex items-center justify-center p-4 overflow-hidden pointer-events-none">
      {/* ── OBSERVER beat — fires AFTER the seraphine card has collapsed.
          The ◉ eye glyph blooms from singularity, pulses once, hands off.
          Pure CSS animation timed to start at 4250ms (post-collapse) and
          settle by ~5500ms. The juror's last pre-terminal scrub-frame.    */}
      <style>{`
        @keyframes bs-observer-bloom {
          0%   { opacity: 0; transform: scale(0.1);  filter: blur(8px); }
          40%  { opacity: 1; transform: scale(1.18); filter: blur(0); }
          100% { opacity: 0.95; transform: scale(1); filter: blur(0); }
        }
        @keyframes bs-observer-pulse {
          0%, 100% { text-shadow: 0 0 18px rgba(255,215,0,0.45), 0 0 4px rgba(255,215,0,0.7); }
          50%      { text-shadow: 0 0 32px rgba(255,215,0,0.85), 0 0 8px rgba(255,215,0,0.95); }
        }
        @keyframes bs-observer-line {
          0%   { opacity: 0; letter-spacing: 0.55em; filter: blur(8px); }
          100% { opacity: 0.55; letter-spacing: 0.22em; filter: blur(0); }
        }
        @keyframes bs-observer-sub {
          0%, 50% { opacity: 0; }
          100%    { opacity: 0.35; }
        }
      `}</style>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5"
        style={{ pointerEvents: 'none' }}
      >
        {/* The eye glyph — emerges from where the card collapsed */}
        <div
          className="text-[64px] md:text-[80px] leading-none font-black"
          style={{
            color: '#FFD700',
            opacity: 0,
            animation: 'bs-observer-bloom 0.9s cubic-bezier(0.22,1,0.36,1) 4250ms forwards, bs-observer-pulse 1.6s ease-in-out 5150ms 1',
          }}
        >
          ◉
        </div>
        {/* Frame line */}
        <div
          className="text-[11px] md:text-[12px] font-black tracking-[0.22em] uppercase text-center px-6"
          style={{
            color: '#FFD700',
            opacity: 0,
            animation: 'bs-observer-line 0.7s ease-out 4750ms forwards',
          }}
        >
          ◉ OBSERVE
        </div>
        {/* Sub-line — the build string, very faint */}
        <div
          className="text-[9px] font-mono tracking-widest uppercase"
          style={{
            color: 'rgba(255,215,0,0.5)',
            opacity: 0,
            animation: 'bs-observer-sub 1.0s ease-out 5050ms forwards',
          }}
        >
          9.4.castle :: substrate visible
        </div>
      </div>

      <div
        ref={cardRef}
        className="w-[360px] md:w-[420px] relative flex items-stretch"
        style={{ transition: 'none' }}
      >
        {/* Terminal card — spins 720° as entropy resolves to crystalline.
            Border + glow track frameColor, which updates at each axiom pop. */}
        <div
          ref={squareRef}
          className="relative px-6 py-7 md:px-8 md:py-8 w-full overflow-hidden"
          style={{
            background:   '#000',
            borderWidth:  '1px',
            borderStyle:  'solid',
            borderColor:  `${frameColor}38`,
            boxShadow:    `0 0 18px ${frameColor}44, 0 0 56px ${frameColor}18`,
            transition:   'border-color 0.35s ease, box-shadow 0.35s ease',
          }}
        >
          {/* Rainbow perimeter — fills clockwise: top → right → bottom → left
              Each edge takes 900ms; total 3600ms, completes at FADE_START_MS */}
          {/* Top: magenta → red → orange → gold */}
          <span style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, #FF0088, #FF3300, #FF8C00, #FFD700)',
            transformOrigin: 'left', transform: 'scaleX(0)',
            animation: 'bs-edge-x 900ms ease-out 200ms forwards',
            zIndex: 20,
          }} />
          {/* Right: gold → lime → cyan */}
          <span style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 2,
            background: 'linear-gradient(180deg, #FFD700, #AAFF00, #00FFAA)',
            transformOrigin: 'top', transform: 'scaleY(0)',
            animation: 'bs-edge-y 900ms ease-out 1100ms forwards',
            zIndex: 20,
          }} />
          {/* Bottom: cyan → blue — grows right-to-left */}
          <span style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(270deg, #00FFAA, #00AAFF, #0044FF)',
            transformOrigin: 'right', transform: 'scaleX(0)',
            animation: 'bs-edge-x 900ms ease-out 2000ms forwards',
            zIndex: 20,
          }} />
          {/* Left: blue → violet → magenta — grows bottom-to-top */}
          <span style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 2,
            background: 'linear-gradient(0deg, #0044FF, #7700FF, #FF0088)',
            transformOrigin: 'bottom', transform: 'scaleY(0)',
            animation: 'bs-edge-y 900ms ease-out 2900ms forwards',
            zIndex: 20,
          }} />

          {/* Micro status row */}
          <div className="flex justify-between items-center mb-5 text-[9px] tracking-widest" style={{ color: 'rgba(255,215,0,0.3)' }}>
            <span>sys::boot_sequence</span>
            <span>node::scale-9.4</span>
          </div>

          {/* Branding block — stamps in */}
          <div
            className="flex items-center gap-4 mb-5"
            style={{ opacity: 0, animation: 'bs-stamp 0.5s cubic-bezier(0.22,1,0.36,1) 0.55s forwards' }}
          >
            <div className="shrink-0 flex items-center justify-center" style={{ width: '2.5rem', height: '2.5rem' }}>
              <Cpu
                className="w-full h-full"
                style={{ color: '#FF8C00', animation: 'bs-cpuGlow 2s ease-in-out 1s infinite' }}
              />
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: '#FFD700' }}>
                seraphine
              </div>
              <div className="text-xs font-black tracking-[0.18em] mt-1" style={{ color: 'rgba(255,215,0,0.5)' }}>
                7.7.7.7.7.7.7-rust kernel
              </div>
            </div>
          </div>

          <div className="border-t mb-4" style={{ borderColor: 'rgba(255,215,0,0.12)' }} />

          {/* Kernel axioms — the fade doctrine loading */}
          <div className="space-y-[5px] text-[11px] font-bold mb-5">
            {AXIOMS.map(({ name, field, status, variant }, i) => {
              const isThreat      = variant === 'threat';
              const isCrystalline = variant === 'crystalline';
              const isApex        = variant === 'apex';

              const arcColor = DOCTRINE_RAINBOW[i % DOCTRINE_RAINBOW.length];

              // Line text — dim version of the arc color for that axiom
              const lineColor = isThreat ? 'rgba(255,107,0,0.7)'
                              : `${arcColor}99`;   // 60% opacity via hex suffix

              // Status tag — full arc color (no white — zero white fade doctrine)
              const statusColor = arcColor;

              // Prompt — arc color at 80% opacity
              const promptColor = isThreat ? '#FF6B00' : `${arcColor}CC`;

              // Line animation — crystalline gets white-flash lock, entropy flickers.
              // Normal lines rotate through three depth variants (far/mid/near) so
              // the sequence feels like data packets arriving at different distances
              // rather than identical stamps: heavier transmissions from further out.
              const lineVariants = [
                ['bs-lineIn-far',  '0.26s'],  // 0, 3, 6, 9  — heavy packet, far
                ['bs-lineIn',      '0.18s'],  // 1, 4, 7, 10 — standard
                ['bs-lineIn-near', '0.13s'],  // 2, 5, 8     — light telemetry, close
              ];
              const [lineKf, lineDur] = lineVariants[i % 3];
              const animation = isCrystalline
                ? `bs-crystalline-lock 0.55s ease-out ${axiomDelay(i)}ms forwards`
                : isThreat
                ? `bs-entropy-in 0.28s ease-out ${axiomDelay(i)}ms forwards`
                : `${lineKf} ${lineDur} ease-out ${axiomDelay(i)}ms forwards`;

              // Status tag pop — 300ms cadence, decoupled from line slide,
              // aligned with rainbow perimeter arc progress across 3600ms.
              // Only normal/apex get the separate pop; threat/crystalline
              // are already unified with their line animations.
              const statusPopDelay = popDelay(i);
              const statusAnim    = (!isThreat && !isCrystalline)
                ? `bs-statusPop 0.38s cubic-bezier(0.22,1,0.36,1) ${statusPopDelay}ms forwards`
                : undefined;

              return (
                <div
                  key={name}
                  className="flex justify-between items-center"
                  style={{ opacity: 0, color: lineColor, animation }}
                >
                  <span className="flex items-center gap-[5px]">
                    <span style={{ color: promptColor }}>{'>'}</span>
                    <span className="tracking-wide">{name}</span>
                    <span style={{ color: `${arcColor}30`, fontSize: '9px', letterSpacing: '0.05em' }}>::{field}</span>
                  </span>
                  <span
                    className="tracking-widest font-black text-[10px]"
                    style={{
                      color:     statusColor,
                      opacity:   statusAnim ? 0 : undefined,
                      animation: statusAnim,
                    }}
                  >
                    [{status}]
                  </span>
                </div>
              );
            })}
          </div>

          {/* Doctrine line — the culmination */}
          <div
            className="text-[10px] font-black tracking-widest"
            style={{
              opacity: 0,
              animation: 'bs-lineIn 0.2s ease-out 3.4s forwards, bs-active 0.35s ease-in-out 3.5s infinite',
            }}
          >
            {'>'} zero white fade :: crystalline invariance locked
          </div>

        </div>
      </div>
    </div>
  );
};

export default React.memo(BootSequence);
