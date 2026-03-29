import React, { useState, useMemo } from 'react';
import HackerText from '../components/HackerText';
import { normalizeQuery } from '../../lib/normalize';

/**
 * TransmissionTab — fiction / signal archive
 *
 * Animations:
 *   tx-scanline   — one-shot phosphor bar sweeps top→bottom on mount
 *   tx-waveScroll — oscilloscope sine wave scrolls continuously behind timeline
 *   tx-glitch     — title slice-glitch on hover (clip-path + translate)
 *   tx-sigBars    — signal strength bars (deterministic per story)
 */

// ── Wave math ─────────────────────────────────────────────────────────────────
// Double-width (1600) path scrolls via CSS translateX — seamless loop at -800px
const makeWave = (w = 1600, cy = 30, amp = 9, periods = 6) => {
  const step = 4;
  let d = `M 0 ${cy}`;
  for (let x = step; x <= w; x += step) {
    const y = cy + amp * Math.sin((x / w) * periods * Math.PI * 2);
    d += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
  }
  return d;
};

// y on the half-width (800) version of the same wave — for dot positioning
const waveY = (x, cy = 30, amp = 9, periods = 6, w = 800) =>
  cy + amp * Math.sin((x / w) * periods * Math.PI * 2);

// Deterministic signal bar count 1–5 from story id + index
const sigBars = (id = '', i = 0) =>
  ((id.charCodeAt(0) || 65) + (id.charCodeAt(1) || 0) + i * 7) % 5 + 1;

// ── Component ─────────────────────────────────────────────────────────────────
const TransmissionTab = ({ stories, onSelect, loadingSignal }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    const q = normalizeQuery(searchQuery);
    return stories.filter(s =>
      normalizeQuery(s.title).includes(q) ||
      normalizeQuery(s.subtitle || '').includes(q) ||
      (s.tags && s.tags.some(t => normalizeQuery(t).includes(q)))
    );
  }, [stories, searchQuery]);

  // Pre-compute wave paths once
  const WAVE_SCROLL = useMemo(() => makeWave(1600, 30, 9, 6), []);
  const WAVE_DOT    = useMemo(() => makeWave(800,  30, 9, 3), []); // fewer periods for dot baseline

  return (
    <div className="animate-in fade-in duration-500 relative">

      {/* ── [1] ONE-SHOT SCANLINE SWEEP ──────────────────────────────────────
          A fuchsia phosphor bar descends the page once on mount, as if the
          terminal is locking onto the incoming signal frequency.            */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(217,70,239,0.95) 40%, rgba(255,255,255,0.6) 50%, rgba(217,70,239,0.95) 60%, transparent 100%)',
        boxShadow: '0 0 18px rgba(217,70,239,0.8), 0 0 48px rgba(217,70,239,0.25)',
        animation: 'tx-scanline 1.5s cubic-bezier(0.4,0,1,1) 0.15s forwards',
        pointerEvents: 'none',
        zIndex: 30,
      }} />

      {/* ── Keyframes + hover rules ───────────────────────────────────────── */}
      <style>{`
        @keyframes tx-snap {
          0%   { opacity: 0; letter-spacing: 0.5em; transform: translateY(8px) skewX(-2deg); filter: blur(3px); }
          45%  { opacity: 1; letter-spacing: 0.14em; transform: translateY(-2px) skewX(0); filter: blur(0); }
          70%  { letter-spacing: 0.12em; transform: translateY(1px); }
          100% { opacity: 1; letter-spacing: 0.1em; transform: translateY(0); }
        }
        @keyframes tx-iconPulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(217,70,239,0.6)); }
          50%       { filter: drop-shadow(0 0 14px rgba(217,70,239,1)) drop-shadow(0 0 28px rgba(217,70,239,0.35)); }
        }
        @keyframes tx-subReveal {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tx-cardIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* [1] Scanline — one-shot, sweeps top→bottom then disappears */
        @keyframes tx-scanline {
          0%   { top: -2px; opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        /* [2] Oscilloscope wave — scrolls left continuously */
        @keyframes tx-waveScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-800px); }
        }

        /* [3] Title glitch — clip-path slice corruption on hover */
        @keyframes tx-glitch {
          0%, 82%, 100% { transform: none; text-shadow: none; clip-path: none; }
          84% { transform: translate(-4px, 0); text-shadow: 3px 0 rgba(0,255,255,0.9); clip-path: inset(10% 0 72% 0); }
          86% { transform: translate(4px, 0);  text-shadow: -3px 0 rgba(217,70,239,1); clip-path: inset(65% 0 8% 0); }
          88% { transform: translate(-2px,0);  clip-path: inset(38% 0 42% 0); text-shadow: 1px 0 rgba(0,255,255,0.5); }
          90% { transform: none; clip-path: none; text-shadow: none; }
        }

        /* Signal dots glow on the oscilloscope */
        @keyframes tx-dotGlow {
          0%, 100% { filter: drop-shadow(0 0 3px rgba(217,70,239,0.8)); }
          50%       { filter: drop-shadow(0 0 9px rgba(217,70,239,1)) drop-shadow(0 0 18px rgba(217,70,239,0.4)); }
        }

        .tx-card { transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s; }
        .tx-card:hover {
          box-shadow: 0 0 20px rgba(217,70,239,0.18), inset 0 0 30px rgba(217,70,239,0.04);
        }
        .tx-card:hover .tx-index { color: rgba(217,70,239,0.8) !important; }

        /* [3] Glitch — only on non-disabled hover */
        .tx-card:not([disabled]):hover .tx-title {
          animation: tx-glitch 3.8s ease-in-out infinite;
        }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-10 border-b border-fuchsia-900/30 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-fuchsia-500 text-3xl shrink-0"
            style={{ animation: 'tx-iconPulse 2.5s ease-in-out infinite', lineHeight: 1 }}
            aria-hidden="true"
          >⌖</span>
          <h1
            className="text-4xl font-bold uppercase text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 40%, #a855f7 75%, #818cf8 100%)',
              animation: 'tx-snap 0.55s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          >TRANSMISSION</h1>
        </div>
        <p
          className="text-xs font-bold tracking-widest text-fuchsia-400/70 uppercase"
          style={{ opacity: 0, animation: 'tx-subReveal 0.4s ease 0.45s forwards' }}
        >
          SIGNAL / FICTION / DISPATCH — SCALE94 CREATIVE ARCHIVE
        </p>

        {/* Search filter */}
        <div className="mt-4 flex items-center gap-2 border border-fuchsia-900/40 bg-black/40 px-3 py-2 rounded-sm">
          <span className="text-fuchsia-700 text-xs" aria-hidden="true">⌖</span>
          <label htmlFor="transmission-search" className="sr-only">Filter transmissions</label>
          <input
            id="transmission-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="filter signals..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="bg-transparent border-none outline-none flex-grow text-fuchsia-400 placeholder-fuchsia-900/50 font-mono text-xs font-bold tracking-wider"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
              className="text-fuchsia-700 hover:text-fuchsia-400 text-xs font-bold tracking-widest transition-colors"
            >✕</button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-[10px] font-bold tracking-widest text-fuchsia-800 uppercase">
            {filtered.length} signal{filtered.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      {/* ── [2] OSCILLOSCOPE TIMELINE ─────────────────────────────────────────
          Phosphor-green/fuchsia CRT display. A sine wave scrolls left
          continuously. Signal dots sit on a separate static wave so their
          positions don't shift with the scroll.                              */}
      {filtered.length > 1 && (() => {
        const dated = filtered
          .map((s, idx) => ({ ...s, _idx: idx, _ts: s.date ? new Date(s.date).getTime() : 0 }))
          .filter(s => s._ts > 0)
          .sort((a, b) => a._ts - b._ts);
        if (dated.length < 2) return null;

        const minTs = dated[0]._ts;
        const maxTs = dated[dated.length - 1]._ts;
        const range = maxTs - minTs || 1;
        const PAD = 44;
        const W = 800, H = 72;

        return (
          <div className="mb-8">
            <div className="text-[9px] font-mono tracking-widest text-fuchsia-800 uppercase mb-2 flex items-center gap-2">
              <span style={{ animation: 'tx-iconPulse 1.8s ease-in-out infinite', display: 'inline-block' }}>◈</span>
              SIGNAL TIMELINE — {dated.length} TRANSMISSIONS INDEXED
            </div>

            {/* CRT display frame */}
            <div style={{
              background: 'rgba(10,0,18,0.92)',
              border: '1px solid rgba(217,70,239,0.2)',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 0 30px rgba(217,70,239,0.04), 0 0 12px rgba(217,70,239,0.06)',
            }}>
              {/* Subtle CRT scanlines overlay */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
              }} />

              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
                style={{ display: 'block' }}>
                <defs>
                  <clipPath id="tx-wave-clip">
                    <rect x="0" y="0" width={W} height={H} />
                  </clipPath>
                  {/* Phosphor glow filter for the wave */}
                  <filter id="tx-glow" x="-10%" y="-50%" width="120%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>

                {/* Scrolling ambient wave (background) */}
                <g clipPath="url(#tx-wave-clip)">
                  <g style={{ animation: 'tx-waveScroll 6s linear infinite' }}>
                    <path
                      d={WAVE_SCROLL}
                      fill="none"
                      stroke="rgba(217,70,239,0.12)"
                      strokeWidth="1"
                    />
                  </g>
                  {/* Second wave, offset by 800px — fills the gap during scroll */}
                  <g style={{ animation: 'tx-waveScroll 6s linear infinite', transform: 'translateX(800px)' }}>
                    <path
                      d={WAVE_SCROLL}
                      fill="none"
                      stroke="rgba(217,70,239,0.12)"
                      strokeWidth="1"
                    />
                  </g>
                </g>

                {/* Static dot-positioning wave (glowing, not scrolling) */}
                <path
                  d={WAVE_DOT}
                  fill="none"
                  stroke="rgba(217,70,239,0.35)"
                  strokeWidth="1.5"
                  filter="url(#tx-glow)"
                />

                {/* Horizontal axis */}
                <line x1={PAD} y1={H/2} x2={W - PAD} y2={H/2}
                  stroke="rgba(217,70,239,0.08)" strokeWidth="0.5" strokeDasharray="3,6" />

                {/* Signal pulse — travels the line left to right */}
                <circle r="3" fill="rgba(217,70,239,0.0)" stroke="none">
                  <animate attributeName="cx" values={`${PAD};${W-PAD}`} dur="4s" repeatCount="indefinite" />
                  <animate attributeName="cy" values={
                    Array.from({ length: 40 }, (_, i) => {
                      const x = PAD + (i / 39) * (W - PAD * 2);
                      return waveY(x, H/2, 9, 3).toFixed(1);
                    }).join(';')
                  } dur="4s" repeatCount="indefinite" calcMode="linear" />
                  <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.05;0.95;1" dur="4s" repeatCount="indefinite" />
                  <animate attributeName="r" values="2;4;2" dur="4s" repeatCount="indefinite" />
                </circle>

                {/* Story dots on the static wave */}
                {dated.map((s, i) => {
                  const x = PAD + ((s._ts - minTs) / range) * (W - PAD * 2);
                  const y = waveY(x, H/2, 9, 3);
                  return (
                    <g key={s.id} style={{ animation: 'tx-dotGlow 2.5s ease-in-out infinite', animationDelay: `${i * 0.4}s` }}>
                      {/* Outer glow ring */}
                      <circle cx={x} cy={y} r={9} fill="rgba(217,70,239,0.06)">
                        <animate attributeName="r" values="8;12;8" dur="2.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
                        <animate attributeName="opacity" values="0.06;0.02;0.06" dur="2.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
                      </circle>
                      {/* Core dot */}
                      <circle cx={x} cy={y} r={4} fill="rgba(217,70,239,0.75)" stroke="rgba(217,70,239,1)" strokeWidth="0.8">
                        <animate attributeName="r" values="4;5.5;4" dur="2.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
                      </circle>
                      {/* Vertical drop line to axis */}
                      <line x1={x} y1={y} x2={x} y2={H - 14}
                        stroke="rgba(217,70,239,0.15)" strokeWidth="0.5" strokeDasharray="2,3" />
                      {/* Date label */}
                      <text x={x} y={H - 4} textAnchor="middle"
                        fill="rgba(217,70,239,0.45)" fontSize="7" fontFamily="monospace">
                        {s.date?.slice(0, 7) || '?'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* ── Signal grid ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 text-cyan-900 font-bold tracking-widest uppercase text-xs">
          {searchQuery ? `[ NO MATCH: "${searchQuery}" ]` : '[ NO TRANSMISSIONS FOUND ]'}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
          role="list"
          aria-label="Transmission signals"
        >
          {filtered.map((story, i) => {
            const isLoading = loadingSignal === story.id;
            const isBlocked = loadingSignal !== null && !isLoading;
            const bars = sigBars(story.id, i);

            return (
              <div
                key={story.id}
                role="listitem"
                style={{ opacity: 0, animation: `tx-cardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s forwards` }}
              >
                <button
                  onClick={() => !isLoading && !isBlocked && onSelect(story)}
                  aria-label={`Load transmission: ${story.title}`}
                  aria-busy={isLoading}
                  disabled={isLoading || isBlocked}
                  className={`tx-card w-full text-left group border bg-black/40 p-6 rounded-sm relative overflow-hidden
                    ${isLoading
                      ? 'border-fuchsia-500/80 bg-fuchsia-950/30 cursor-wait'
                      : isBlocked
                        ? 'border-fuchsia-900/20 opacity-50 cursor-not-allowed'
                        : 'border-fuchsia-900/30 hover:border-fuchsia-500/70 hover:bg-fuchsia-950/20 cursor-pointer'
                    }`}
                >
                  {/* Index row + [4] signal strength bars */}
                  <div className="text-[10px] font-bold tracking-widest mb-4 uppercase flex justify-between items-center">
                    <span className="tx-index text-fuchsia-900 transition-colors">
                      TRANSMISSION_{String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-end gap-[2px]">
                      {/* [4] Signal strength — 5 bars, N lit per story */}
                      {[1,2,3,4,5].map(b => (
                        <div key={b} style={{
                          width: 3,
                          height: 3 + b * 2.5,
                          borderRadius: 1,
                          background: b <= bars
                            ? `rgba(217,70,239,${0.4 + b * 0.12})`
                            : 'rgba(217,70,239,0.08)',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                      <span className={`ml-2 transition-colors ${isLoading ? 'text-fuchsia-400 animate-pulse' : 'text-fuchsia-800 group-hover:text-fuchsia-500'}`}>
                        {isLoading ? '▋' : '⌖'}
                      </span>
                    </div>
                  </div>

                  {/* [3] Title — gets glitch animation on hover via .tx-title CSS rule */}
                  <h2 className={`tx-title text-[11pt] font-bold tracking-tight mb-2 leading-snug transition-colors ${isLoading ? 'text-white animate-pulse' : 'text-fuchsia-300 group-hover:text-white'}`}>
                    {story.title}
                  </h2>

                  {/* Subtitle */}
                  {story.subtitle && (
                    <p className="text-xs text-cyan-700 group-hover:text-cyan-500 transition-colors mb-5 leading-relaxed line-clamp-2">
                      {story.subtitle}
                    </p>
                  )}

                  {/* Meta footer */}
                  <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase border-t border-fuchsia-900/20 group-hover:border-fuchsia-900/50 pt-3 mt-3 transition-colors">
                    <span className="text-fuchsia-800 group-hover:text-fuchsia-500 transition-colors">
                      {story.date || 'UNDATED'}
                    </span>
                    <span className="text-cyan-900 group-hover:text-cyan-600 transition-colors">
                      {isLoading ? 'INGESTING...' : (story.readTime || '')}
                    </span>
                  </div>

                  {/* Accent line */}
                  <div className={`absolute bottom-0 left-0 h-[1px] bg-fuchsia-500 transition-all duration-500 ${isLoading ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="mt-16 text-[10px] font-bold tracking-widest text-fuchsia-900/40 uppercase text-center">
        ⌖ signal received — scale94 transmission archive ⌖
      </div>
    </div>
  );
};

export default React.memo(TransmissionTab);
