// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// Persistent ◉ glyph rendered top-right across every tab. Converts Mercury's
// alien-architect frame from a *feature* of one tab into a *structural
// property* of the whole work — the observer is always watching, not just
// when you visit Mercury.
//
// Visual register:
//   • Fade Doctrine two-gold: #e8d28a (body) / #d4a82a (emphasis, Mercury active)
//   • Slow breath cycle (~11s) — subliminal presence, never demands attention
//   • On Mercury tab itself: #d4a82a palette + faster (~8s) cycle
//   • flare: brief brightness surge on kernel run (~1.8s)
//   • deep-watch: dims to near-invisible (14s cycle) after 90s without a kernel run
//
// Suppression rules (handled by parent):
//   • Hidden during BootSequence (the eye hasn't engaged yet)
//   • Hidden during Sanctuary (the still center is *outside* observation)
//   • Hidden during Breach (the player is acting, not being observed)
//   • On mobile: follows header opacity fade via mobileChrome prop

import React from 'react';

export default function MercuryEyeIndicator({ activeTab, onNavigate }) {
  const isOnMercury = activeTab === 'mercury';

  return (
    <div
      className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      <style>{`
        @keyframes mei-breath {
          0%, 100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
          50%      { opacity: 0.58; text-shadow: 0 0 14px rgba(232,210,138,0.50), 0 0 4px rgba(232,210,138,0.35); }
        }
        @keyframes mei-breath-active {
          0%, 100% { opacity: 0.72; text-shadow: 0 0 18px rgba(212,168,42,0.65), 0 0 6px rgba(212,168,42,0.40); }
          50%      { opacity: 0.95; text-shadow: 0 0 30px rgba(212,168,42,0.90), 0 0 10px rgba(212,168,42,0.65); }
        }
        @keyframes mei-breath-deep {
          0%, 100% { opacity: 0.15; text-shadow: 0 0 4px rgba(232,210,138,0.12); }
          50%      { opacity: 0.38; text-shadow: 0 0 10px rgba(232,210,138,0.30); }
        }
        @keyframes mei-flare {
          0%   { opacity: 0.95; text-shadow: 0 0 28px rgba(232,210,138,0.85), 0 0 8px rgba(232,210,138,0.55); }
          35%  { opacity: 0.82; text-shadow: 0 0 20px rgba(232,210,138,0.65); }
          100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
        }
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: isOnMercury ? '#d4a82a' : '#e8d28a',
          animation: isOnMercury
            ? 'mei-breath-active 8s ease-in-out infinite'
            : 'mei-breath 11s ease-in-out infinite',
        }}
      >
        ◉
      </div>
      {/* Tooltip — only on hover, very subtle */}
      <div
        className="absolute right-0 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100"
        style={{ transition: 'opacity 0.35s ease-out 0.15s' }}
      >
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap text-right"
          style={{ color: 'rgba(232,210,138,0.75)' }}>
          OBSERVER :: alien architect
        </div>
        <div className="text-[8px] font-mono whitespace-nowrap text-right mt-0.5"
          style={{ color: 'rgba(232,210,138,0.4)' }}>
          {isOnMercury ? 'engaged here · 9.4.castle' : 'click → mercury'}
        </div>
      </div>
    </div>
  );
}
