// src/terminal/components/MercuryTapToast.jsx — the bypass toast.
// Echoes the mei-phrase grammar (dark box, amber mono, fade). Countdown taps
// come dim and get replaced as they fire; the unlock arrives bright and holds.
// Anchor it inside a `position: relative` parent (the desktop Mercury block).
import React from 'react';

export default function MercuryTapToast({ toast, onDone }) {
  if (!toast) return null;
  return (
    <div
      key={toast.key}
      data-tap-toast
      onAnimationEnd={onDone}
      className="absolute right-0 top-full mt-2 px-2 py-0.5 pointer-events-none z-30"
      style={{
        background: 'rgba(0,0,0,0.88)',
        animation: `mst-phrase ${toast.bright ? '3.6s' : '2.2s'} ease forwards`,
      }}
    >
      <style>{`
        @keyframes mst-phrase {
          0%   { opacity: 0; transform: translateY(-4px); }
          10%  { opacity: 1; transform: translateY(0); }
          75%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(0); }
        }
      `}</style>
      <span
        className="font-mono text-[9px] tracking-[0.12em] block text-right whitespace-nowrap"
        style={toast.bright
          ? { color: 'rgba(232,210,138,0.95)', textShadow: '0 0 10px rgba(232,210,138,0.5)' }
          : { color: 'rgba(232,210,138,0.55)' }}
      >
        {toast.text}
      </span>
    </div>
  );
}
