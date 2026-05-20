// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// Persistent ◉ glyph rendered top-right across every tab. Converts Mercury's
// alien-architect frame from a *feature* of one tab into a *structural
// property* of the whole work — the observer is always watching, not just
// when you visit Mercury.
//
// Visual register:
//   • Amber/gold (#FFD700) — matches the seraphine boot palette
//   • Slow breath cycle (~11s) — subliminal presence, never demands attention
//   • On Mercury tab itself: brighter palette + faster (~8s) cycle, signaling
//     "engaged here" rather than "watching from elsewhere"
//   • Click → navigates to Mercury (the place where the observation is most
//     explicit)
//
// Suppression rules (handled by parent):
//   • Hidden during BootSequence (the eye hasn't engaged yet)
//   • Hidden during Sanctuary (the still center is *outside* observation)
//   • Hidden during Breach (the player is acting, not being observed)
//
// The glyph deliberately does NOT track mouse position or react to user input
// beyond click — it's the *architect's* eye, not a security camera. The
// observer is patient and continuous, not surveillant.

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
          0%, 100% { opacity: 0.30; text-shadow: 0 0 6px rgba(255,215,0,0.22); }
          50%      { opacity: 0.62; text-shadow: 0 0 14px rgba(255,215,0,0.55), 0 0 4px rgba(255,215,0,0.4); }
        }
        @keyframes mei-breath-active {
          0%, 100% { opacity: 0.78; text-shadow: 0 0 18px rgba(255,215,0,0.7), 0 0 6px rgba(255,215,0,0.45); }
          50%      { opacity: 1;    text-shadow: 0 0 30px rgba(255,215,0,0.95), 0 0 10px rgba(255,215,0,0.7); }
        }
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: '#FFD700',
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
          style={{ color: 'rgba(255,215,0,0.75)' }}>
          OBSERVER :: alien architect
        </div>
        <div className="text-[8px] font-mono whitespace-nowrap text-right mt-0.5"
          style={{ color: 'rgba(255,215,0,0.4)' }}>
          {isOnMercury ? 'engaged here · 9.4.castle' : 'click → mercury'}
        </div>
      </div>
    </div>
  );
}
