import React, { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['mounting hilbert space',           'ok'],
  ['loading seraphine_v7.7.7.7.7.7.7', 'ok'],
  ['quantum coherence: lindblad',      'active'],
  ['establishing secure conn',         'ok'],
  ['density matrix: integrity',        'pass'],
];

// Black ink drops — positioned relative to the yellow card.
// Clustered at corners, edges, and near-edges so the text center stays clear.
// [left%, top%, width(px), height(px), border-radius, delay(ms)]
const INK_DROPS = [
  // corners
  { l: '-1%',  t: '-2%',  w: 22, h: 15, r: '40% 60% 55% 45% / 50% 45% 60% 50%', d: 270 },
  { l: '97%',  t: '-1%',  w: 18, h: 20, r: '55% 45% 40% 60% / 45% 55% 50% 50%', d: 300 },
  { l: '-2%',  t: '93%',  w: 20, h: 14, r: '60% 40% 50% 50% / 55% 45% 55% 45%', d: 340 },
  { l: '96%',  t: '91%',  w: 16, h: 18, r: '45% 55% 60% 40% / 50% 55% 45% 50%', d: 285 },
  // top/bottom edges
  { l: '44%',  t: '-3%',  w: 14, h: 11, r: '50% 50% 45% 55% / 60% 40% 55% 45%', d: 315 },
  { l: '52%',  t: '96%',  w: 12, h: 16, r: '55% 45% 50% 50% / 45% 55% 50% 55%', d: 395 },
  // left/right edges
  { l: '-3%',  t: '46%',  w: 16, h: 11, r: '40% 60% 55% 45% / 50% 50% 45% 55%', d: 255 },
  { l: '98%',  t: '43%',  w: 18, h: 13, r: '60% 40% 45% 55% / 55% 45% 60% 40%', d: 330 },
  // scattered near corners (inside card, not center)
  { l: '7%',   t: '11%',  w: 9,  h: 11, r: '55% 45% 40% 60% / 45% 55% 50% 50%', d: 370 },
  { l: '87%',  t: '14%',  w: 11, h: 8,  r: '45% 55% 60% 40% / 55% 45% 50% 50%', d: 295 },
  { l: '10%',  t: '83%',  w: 10, h: 13, r: '60% 40% 55% 45% / 50% 55% 45% 50%', d: 425 },
  { l: '89%',  t: '80%',  w: 13, h: 10, r: '50% 50% 40% 60% / 45% 50% 55% 50%', d: 265 },
];

// Cubic ease-out: fast start → smooth deceleration → clean stop
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const BootSequence = ({ onDone }) => {
  const squareRef = useRef(null);
  const cardRef   = useRef(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const SPIN_MS       = 2000;
    const FADE_START_MS = 3800;
    const DONE_MS       = 5000;
    const EXIT_DURATION = DONE_MS - FADE_START_MS; // 1200ms

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
          // Exit phase: continue spinning + shrink to zero simultaneously
          const exitT     = Math.min((elapsed - FADE_START_MS) / EXIT_DURATION, 1);
          const exitScale = 1 - easeOut(exitT);
          const exitDeg   = baseDeg + easeOut(exitT) * 360;
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
        className="w-[340px] md:w-[400px] aspect-square relative flex items-stretch"
        style={{ transition: 'none' }}
      >
        {/* Yellow square — spins 720° over 2s on boot */}
        <div ref={squareRef} className="relative overflow-visible px-6 py-7 md:px-8 md:py-8 w-full"
          style={{ background: '#FFD700' }}
        >

          {/* Ink drops — z-0, appear on yellow before text stamps in */}
          {INK_DROPS.map((p, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.l, top: p.t,
                width:  p.w,
                height: p.h,
                background: '#000',
                borderRadius: p.r,
                transform: 'translate(-50%, -50%) scale(0)',
                opacity: 0,
                zIndex: 0,
                animation: `bs-inkDrop 0.35s cubic-bezier(0.22,1,0.36,1) ${p.d}ms forwards`,
              }}
            />
          ))}

          {/* Content — z-10, above ink drops */}
          <div className="relative" style={{ zIndex: 10 }}>

            {/* Micro status row */}
            <div className="flex justify-between items-center mb-6 text-[9px] tracking-widest" style={{ color: 'rgba(0,0,0,0.4)' }}>
              <span>sys::boot_sequence</span>
              <span>node::scale-9.4</span>
            </div>

            {/* Branding block */}
            <div
              className="flex items-center gap-4"
              style={{ opacity: 0, animation: 'bs-stamp 0.5s cubic-bezier(0.22,1,0.36,1) 0.55s forwards' }}
            >
              <div
                className="shrink-0 flex items-center justify-center"
                style={{ width: '2.75rem', height: '2.75rem' }}
              >
                <Cpu className="w-full h-full" style={{ color: '#000' }} />
              </div>

              <div>
                <div className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: '#000' }}>
                  seraphine
                </div>
                <div className="text-xs font-black tracking-[0.18em] mt-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
                  7.7.7.7.7.7.7-rust kernel
                </div>
              </div>
            </div>

            <div className="border-t my-5" style={{ borderColor: 'rgba(0,0,0,0.2)' }} />

            {/* Boot lines */}
            <div className="space-y-2 text-xs font-bold mb-6">
              {BOOT_LINES.map(([label, status], i) => (
                <div
                  key={i}
                  className="flex justify-between items-center"
                  style={{
                    opacity: 0,
                    color: 'rgba(0,0,0,0.65)',
                    animation: `bs-lineIn 0.18s ease-out ${200 + i * 290}ms forwards`,
                  }}
                >
                  <span>
                    <span className="mr-1" style={{ color: '#000' }}>{'>'}</span>
                    {label}
                    <span style={{ color: 'rgba(0,0,0,0.25)' }}>...</span>
                  </span>
                  <span className="ml-6 tracking-widest font-black" style={{ color: '#000' }}>[{status}]</span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="h-[2px] w-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.15)' }}>
                <div
                  className="h-full"
                  style={{
                    width: '0%',
                    animation: 'bs-progress 3.6s cubic-bezier(0.4,0,0.2,1) 0.2s forwards',
                    background: '#000',
                  }}
                />
              </div>
            </div>

            {/* Final status */}
            <div
              className="text-xs font-black tracking-widest"
              style={{
                opacity: 0,
                color: '#000',
                animation: 'bs-lineIn 0.2s ease-out 3.4s forwards, bs-activeBlack 0.35s ease-in-out 3.5s infinite',
              }}
            >
              {'>'} seraphine_v7.7.7.7.7.7.7 // sarg :: all systems quantum
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BootSequence);
