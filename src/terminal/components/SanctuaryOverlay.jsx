// ── SanctuaryOverlay ─────────────────────────────────────────────────────────
// Period-3 window: a still center inside the chaotic terminal.
//
// Visual grammar deliberately *outside* the site's own palette (cyan/fuchsia/
// green) — sanctuary lives at the boundary of the system's visual grammar.
// Pure black field, one breath-cycle dot, one fading line. Any keypress or
// click returns to the terminal.
//
// Trigger paths:
//   1. Hidden command — type `sanctuary` or `run sanctuary` (no autocomplete)
//   2. Lattice offer — when RAM first hits the floor, a system-log line tells
//      the user the command exists (see useEcologicalRam.js)
//
// Polish notes (for the submission video):
//   • 1.2s fade-in on the void — black should *arrive*, not switch
//   • 6s breath cycle on the dot — slow enough to feel like respiration
//   • The line resolves over 3s through letterspacing+blur so it reads as
//     emerging from the void rather than being typed in
//   • The "press any key" hint appears very late (~8s) and very faintly —
//     a juror lingering in the still center should not be rushed out

import React, { useEffect } from 'react';

export default function SanctuaryOverlay({ onClose }) {
  useEffect(() => {
    const handleExit = () => onClose();
    // Defer attaching listeners by one frame so the keystroke or click that
    // *triggered* the command doesn't immediately close the overlay.
    const id = requestAnimationFrame(() => {
      window.addEventListener('keydown', handleExit);
      window.addEventListener('mousedown', handleExit);
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', handleExit);
      window.removeEventListener('mousedown', handleExit);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center cursor-default select-none"
      style={{ animation: 'sanctuary-enter 1.2s ease-out forwards' }}
      role="dialog"
      aria-label="Sanctuary"
    >
      <style>{`
        @keyframes sanctuary-enter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sanctuary-breath {
          0%, 100% { transform: scale(1);   opacity: 0.30; filter: blur(0.5px); }
          50%      { transform: scale(1.55); opacity: 0.85; filter: blur(0); }
        }
        @keyframes sanctuary-line {
          0%   { opacity: 0;    letter-spacing: 0.55em; filter: blur(10px); }
          60%  { opacity: 0.45;                          filter: blur(0); }
          100% { opacity: 0.32; letter-spacing: 0.22em;  filter: blur(0); }
        }
        @keyframes sanctuary-hint {
          0%, 75% { opacity: 0; }
          100%    { opacity: 0.14; }
        }
      `}</style>

      <div className="relative flex flex-col items-center gap-14">
        {/* the breath */}
        <div
          className="w-2.5 h-2.5 rounded-full bg-white"
          style={{ animation: 'sanctuary-breath 6s ease-in-out infinite' }}
        />
        {/* the line */}
        <div
          className="text-[10px] sm:text-[11px] font-mono uppercase text-white tracking-[0.22em] text-center px-6"
          style={{ animation: 'sanctuary-line 3s ease-out 1.2s both' }}
        >
          PERIOD-3 WINDOW :: the chaos has a still center
        </div>
      </div>

      {/* return hint — appears very late, very faint */}
      <div
        className="absolute bottom-6 text-[9px] font-mono uppercase text-white tracking-widest"
        style={{ animation: 'sanctuary-hint 8s ease-out forwards' }}
      >
        [ press any key to return ]
      </div>
    </div>
  );
}
