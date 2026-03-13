import React, { useEffect, useRef, useState } from 'react';
import { Cpu } from 'lucide-react';

// Seven kernel axioms — the fade doctrine enacted as boot sequence.
// Entropy is the threat. Crystalline is the lock. Zero white fade.
const AXIOMS = [
  { name: 'transmute',      field: 'production', status: 'ok',        variant: 'normal'      },
  { name: 'sustain',        field: 'ecology',    status: 'ok',        variant: 'normal'      },
  { name: 'integrity',      field: 'structure',  status: 'ok',        variant: 'normal'      },
  { name: 'entropy',        field: 'threat',     status: 'contained', variant: 'threat'      },
  { name: 'sovereignty',    field: 'freedom',    status: 'ok',        variant: 'normal'      },
  { name: 'crystalline',    field: 'phase',      status: 'locked',    variant: 'crystalline' },
  { name: '7.7.7.7.7.7.7', field: 'kernel',     status: 'active',    variant: 'apex'        },
];

// 180ms base, 220ms between each axiom
const axiomDelay = (i) => 180 + i * 220;

// Doctrine rainbow — matches perimeter fill arc clockwise
const DOCTRINE_RAINBOW = ['#FF0088','#FF4400','#FF8C00','#FFD700','#AAFF00','#00FFAA','#00AAFF'];

// Status tag pop delays — 500ms cadence aligned with perimeter arc
const popDelay = (i) => 350 + i * 500;

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
    const SPIN_MS       = 2000;
    const FADE_START_MS = 3800;
    const DONE_MS       = 4250;               // fast collapse — 450ms exit window
    const EXIT_DURATION = DONE_MS - FADE_START_MS; // 450ms

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
        } else {
          // Exit: ease-in collapse (accelerates into singularity — Blender S→0).
          const exitT     = Math.min((elapsed - FADE_START_MS) / EXIT_DURATION, 1);
          const exitScale = 1 - (exitT * exitT * exitT);   // ease-in cubic
          const exitDeg   = baseDeg + exitT * 180;          // slow final rotation
          squareRef.current.style.transform = `rotate(${exitDeg}deg) scale(${exitScale})`;
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

              // Status tag — full arc color (overridden for crystalline white-flash)
              const statusColor = isCrystalline ? '#ffffff' : arcColor;

              // Prompt — arc color at 80% opacity
              const promptColor = isThreat ? '#FF6B00' : `${arcColor}CC`;

              // Line animation — crystalline gets white-flash lock, entropy flickers
              const animation = isCrystalline
                ? `bs-crystalline-lock 0.55s ease-out ${axiomDelay(i)}ms forwards`
                : isThreat
                ? `bs-entropy-in 0.28s ease-out ${axiomDelay(i)}ms forwards`
                : `bs-lineIn 0.18s ease-out ${axiomDelay(i)}ms forwards`;

              // Status tag pop — ~500ms cadence, decoupled from line slide,
              // aligned with rainbow perimeter arc progress across 3600ms.
              // Only normal/apex get the separate pop; threat/crystalline
              // are already unified with their line animations.
              const popDelay      = 350 + i * 500; // 350, 850, 1350, 1850, 2350, 2850, 3350ms
              const statusAnim    = (!isThreat && !isCrystalline)
                ? `bs-statusPop 0.38s cubic-bezier(0.22,1,0.36,1) ${popDelay}ms forwards`
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
