import React, { useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

const BOOT_LINES = [
  ['mounting hilbert space',           'ok'],
  ['loading seraphine_v7.7.7.7.7.7.7', 'ok'],
  ['quantum coherence: lindblad',      'active'],
  ['establishing secure conn',         'ok'],
  ['density matrix: integrity',        'pass'],
];

// Black ink pellets — organic shapes scattered like a shotgun blast.
// [left, top, width (px), height (px), border-radius, delay (ms)]
const INK_DROPS = [
  { l: '12%', t: '18%', w: 14, h: 11, r: '40% 60% 55% 45% / 50% 45% 60% 50%', d: 320 },
  { l: '86%', t: '14%', w: 18, h: 12, r: '55% 45% 40% 60% / 45% 55% 50% 50%', d: 280 },
  { l: '8%',  t: '72%', w: 10, h: 14, r: '60% 40% 50% 50% / 55% 45% 55% 45%', d: 450 },
  { l: '91%', t: '78%', w: 16, h: 10, r: '45% 55% 60% 40% / 50% 55% 45% 50%', d: 370 },
  { l: '22%', t: '88%', w: 12, h: 16, r: '50% 50% 45% 55% / 60% 40% 55% 45%', d: 410 },
  { l: '78%', t: '85%', w: 20, h: 10, r: '55% 45% 50% 50% / 45% 55% 50% 55%', d: 300 },
  { l: '48%', t: '5%',  w: 14, h: 18, r: '40% 60% 55% 45% / 50% 50% 45% 55%', d: 350 },
  { l: '3%',  t: '45%', w: 8,  h: 12, r: '60% 40% 45% 55% / 55% 45% 60% 40%', d: 490 },
  { l: '96%', t: '42%', w: 11, h: 8,  r: '45% 55% 60% 40% / 40% 60% 50% 50%', d: 260 },
  { l: '35%', t: '95%', w: 9,  h: 13, r: '55% 45% 40% 60% / 50% 50% 55% 45%', d: 430 },
  { l: '65%', t: '3%',  w: 13, h: 9,  r: '40% 60% 50% 50% / 45% 55% 40% 60%', d: 290 },
  { l: '18%', t: '6%',  w: 7,  h: 11, r: '55% 45% 55% 45% / 60% 40% 50% 50%', d: 480 },
];

// Cubic ease-out: fast start → smooth deceleration → clean stop
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const BootSequence = ({ onDone }) => {
  const cpuRef    = useRef(null);
  const cardRef   = useRef(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const SPIN_MS       = 2000;
    const FADE_START_MS = 3800;
    const DONE_MS       = 5000;

    const t0 = performance.now();
    let raf;
    let tid;

    const tick = (now) => {
      const elapsed = now - t0;

      if (cpuRef.current) {
        const spinT = Math.min(elapsed / SPIN_MS, 1);
        cpuRef.current.style.transform = `rotate(${easeOut(spinT) * 720}deg)`;
      }

      if (elapsed >= FADE_START_MS) {
        if (cardRef.current) {
          cardRef.current.style.opacity = '0';
          cardRef.current.style.filter  = 'blur(8px)';
        }
        tid = setTimeout(() => onDoneRef.current?.(), Math.max(DONE_MS - elapsed, 0));
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
    <div
      ref={cardRef}
      className="fixed inset-0 z-[100] font-mono flex items-center justify-center p-4 overflow-hidden pointer-events-none"
      style={{ background: '#FFD700', transition: 'opacity 1s ease-out, filter 1s ease-out' }}
    >
      {/* Ink drop splatter — scattered across the yellow field */}
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
            animation: `bs-inkDrop 0.35s cubic-bezier(0.22,1,0.36,1) ${p.d}ms forwards`,
          }}
        />
      ))}

      {/* Content — centered, above ink drops */}
      <div className="max-w-lg w-full relative z-10">

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
            ref={cpuRef}
            className="shrink-0 flex items-center justify-center"
            style={{ width: '2.75rem', height: '2.75rem' }}
          >
            <Cpu className="w-full h-full" style={{ color: '#000' }} />
          </div>

          <div>
            <div className="text-4xl md:text-5xl font-black tracking-tight leading-none" style={{ color: '#000' }}>
              seraphine
            </div>
            <div className="text-xs font-black tracking-[0.18em] mt-1" style={{ color: '#000', opacity: 0.55 }}>
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
                color: 'rgba(0,0,0,0.7)',
                animation: `bs-lineIn 0.18s ease-out ${200 + i * 290}ms forwards`,
              }}
            >
              <span>
                <span className="mr-1" style={{ color: '#000' }}>{'>'}</span>
                {label}
                <span style={{ color: 'rgba(0,0,0,0.3)' }}>...</span>
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
                width: 0,
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
  );
};

export default React.memo(BootSequence);
