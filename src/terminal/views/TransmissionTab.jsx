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
      <div className="mb-10 border-b border-fuchsia-900/30 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-fuchsia-500 text-xl" aria-hidden="true">⌖</span>
          <h1 className="text-[13pt] font-bold tracking-widest text-fuchsia-400 uppercase">
            <HackerText text="TRANSMISSION" />
          </h1>
        </div>
        <p className="text-xs font-bold tracking-widest text-cyan-700 uppercase">
          signal / fiction / dispatch — scale94 creative archive
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
              >
                <button
                  onClick={() => !isLoading && !isBlocked && onSelect(story)}
                  aria-label={`Load transmission: ${story.title}`}
                  aria-busy={isLoading}
                  disabled={isLoading || isBlocked}
                  className={`w-full text-left group border bg-black/40 p-6 rounded-sm transition-all duration-300 relative overflow-hidden
                    ${isLoading
                      ? 'border-fuchsia-500/80 bg-fuchsia-950/30 cursor-wait'
                      : isBlocked
                        ? 'border-fuchsia-900/20 opacity-50 cursor-not-allowed'
                        : 'border-fuchsia-900/30 hover:border-fuchsia-500/60 hover:bg-fuchsia-950/20 cursor-pointer'
                    }`}
                >
                  {/* Index row */}
                  <div className="text-[10px] font-bold tracking-widest text-fuchsia-900 group-hover:text-fuchsia-600 transition-colors mb-4 uppercase flex justify-between items-center">
                    <span>TRANSMISSION_{String(i + 1).padStart(2, '0')}</span>
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
