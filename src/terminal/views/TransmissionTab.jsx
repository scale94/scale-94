import React, { useState, useMemo } from 'react';
import HackerText from '../components/HackerText';
import { normalizeQuery } from '../../lib/normalize';

/**
 * TransmissionTab
 *
 * Renders the fiction / signal archive. Every card runs through the same
 * Level 9 loadContent pipeline used by the kernel browser:
 *   onSelect(story) → App.handleTransmissionSelect → loadContent() → SIGNAL_INGEST_SUCCESS
 *
 * Props:
 *   stories       — array of article stubs (type: 'fiction')
 *   onSelect      — callback(story) that fires the loadContent pipeline
 *   loadingSignal — story.id currently being loaded, or null
 */
const TransmissionTab = ({ stories, onSelect, loadingSignal }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter signals using normalizeQuery — matches title, subtitle, and tags.
  // Same slug logic as the kernel browser and import pipeline.
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return stories;
    const q = normalizeQuery(searchQuery);
    return stories.filter(s =>
      normalizeQuery(s.title).includes(q) ||
      normalizeQuery(s.subtitle || '').includes(q) ||
      (s.tags && s.tags.some(t => normalizeQuery(t).includes(q)))
    );
  }, [stories, searchQuery]);

  return (
    <div className="animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes tx-snap {
          0%   { opacity: 0; letter-spacing: 0.5em; transform: translateY(8px) skewX(-2deg); filter: blur(3px); }
          45%  { opacity: 1; letter-spacing: 0.14em; transform: translateY(-2px) skewX(0); filter: blur(0); }
          70%  { letter-spacing: 0.12em; transform: translateY(1px); }
          100% { opacity: 1; letter-spacing: 0.1em;  transform: translateY(0); }
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
        .tx-card { transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s; }
        .tx-card:hover { box-shadow: 0 0 20px rgba(217,70,239,0.18), inset 0 0 30px rgba(217,70,239,0.04); }
        .tx-card:hover .tx-index { color: rgba(217,70,239,0.8) !important; }
      `}</style>
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
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-[10px] font-bold tracking-widest text-fuchsia-800 uppercase">
            {filtered.length} signal{filtered.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      {/* ── Signal grid ────────────────────────────────────────────────────── */}
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
                  {/* Index row */}
                  <div className="text-[10px] font-bold tracking-widest mb-4 uppercase flex justify-between items-center">
                    <span className="tx-index text-fuchsia-900 transition-colors">TRANSMISSION_{String(i + 1).padStart(2, '0')}</span>
                    <span className={`transition-colors ${isLoading ? 'text-fuchsia-400 animate-pulse' : 'text-fuchsia-800 group-hover:text-fuchsia-500'}`}>
                      {isLoading ? '▋' : '⌖'}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className={`text-[11pt] font-bold tracking-tight mb-2 leading-snug transition-colors ${isLoading ? 'text-white animate-pulse' : 'text-fuchsia-300 group-hover:text-white'}`}>
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

                  {/* Accent line — full width while loading, hover otherwise */}
                  <div className={`absolute bottom-0 left-0 h-[1px] bg-fuchsia-500 transition-all duration-500 ${isLoading ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer signal ───────────────────────────────────────────────────── */}
      <div className="mt-16 text-[10px] font-bold tracking-widest text-fuchsia-900/40 uppercase text-center">
        ⌖ signal received — scale94 transmission archive ⌖
      </div>
    </div>
  );
};

export default React.memo(TransmissionTab);
