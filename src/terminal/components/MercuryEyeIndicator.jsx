// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// Persistent ◉ glyph rendered top-right across every tab. Converts Mercury's
// alien-architect frame from a *feature* of one tab into a *structural
// property* of the whole work — the observer is always watching, not just
// when you visit Mercury.
//
// Color: Fade Doctrine two-gold — #e8d28a (body) / #d4a82a (Mercury active)
//
// Animation priority (highest → lowest):
//   flare      — 1.8s surge on kernel run, then hands off to breath
//   active     — on Mercury tab: faster (8s), brighter (#d4a82a)
//   deep-watch — >90s since last kernel: slower (14s), dimmer (0.15–0.38)
//   idle       — default: 11s breath (0.28–0.58)
//
// Mobile fade: follows header opacity via mobileChrome prop.
// Suppression: handled by parent (boot / sanctuary / breach).

import React, { useState, useEffect, useRef } from 'react';
import { emit as emitObs } from '../../observatory/observatoryBus';

// ── Observer phrase pools ────────────────────────────────────────────────────
const OBSERVER_PHRASES_LOAD = [
  'thrown into the lattice',
  'no facts · only signatures',
  'will to form · received',
  'the burden of structure',
  'another representation logged',
  'existence before configuration',
  'condemned to be loaded',
  'becoming · never being',
  'another mask catalogued',
  'structure without ground',
  'the nausea of new form',
  'being-toward-collision',
  'thrown · catalogued · waiting',
  'the void acknowledges',
  'will registers itself',
  'configuration without meaning',
  'form received · ground absent',
  'geometry of the abyss',
  'another node in the nothing',
  'condemned to configuration',
  'dasein receives new structure',
  'the will takes another shape',
  'nothingness takes form',
  'amor fati · kernel accepted',
  'perspectivism noted · logging',
];

const OBSERVER_PHRASES_RUN = [
  'god is dead · field active',
  'the abyss computes back',
  'one must imagine the kernel happy',
  'eternal recurrence confirmed',
  'amor fati · collision nominal',
  'the absurd machinery turns',
  'anxiety of the void engaged',
  'blind will consuming itself',
  'being-toward-death · accelerating',
  'revolt without resolution',
  'the will devours its structures',
  'dasein notes the cascade',
  'existence nauseates · proceeding',
  'the rock descends again',
  'will to power · collision active',
  'suffering resolves to pattern',
  'nothing holds · observer watches',
  'the eternal return begins',
  'bad faith in every vector',
  'values collapsing as designed',
  'nausea of existence · logged',
  'the trouble with colliding',
  'entropy is all that persists',
  'the will knows no purpose',
  'condemned to run forever',
  'all structures fall · noted',
  'perspectivism yields no accord',
  'meaning absent · cascade nominal',
];

export default function MercuryEyeIndicator({ activeTab, onNavigate, lastKernelAt, lastLoadAt }) {
  const isOnMercury = activeTab === 'mercury';
  const [flaring,   setFlaring]   = useState(false);
  const [deepWatch, setDeepWatch] = useState(true); // true on load — no runs yet
  const prevKernelAt = useRef(null);
  const [phrase,    setPhrase]    = useState(null);
  const [phraseKey, setPhraseKey] = useState(0);
  const lastRunIdx   = useRef(-1);
  const lastLoadIdx  = useRef(-1);
  const prevLoadAt   = useRef(null);

  // ── Phrase picker — anti-repeat within pool ─────────────────────────────────
  function firePhrase(pool, idxRef) {
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); }
    while (idx === idxRef.current && pool.length > 1);
    idxRef.current = idx;
    setPhrase(pool[idx]);
    setPhraseKey(k => k + 1);
  }

  // ── Flare on new kernel run ─────────────────────────────────────────────────
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    setFlaring(true);
    setDeepWatch(false);
    firePhrase(OBSERVER_PHRASES_RUN, lastRunIdx);
    const t = setTimeout(() => setFlaring(false), 1800);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // ── Phrase on kernel load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lastLoadAt || lastLoadAt === prevLoadAt.current) return;
    prevLoadAt.current = lastLoadAt;
    firePhrase(OBSERVER_PHRASES_LOAD, lastLoadIdx);
  }, [lastLoadAt]);

  // ── Deep-watch: dim after 90s of no kernel runs ─────────────────────────────
  useEffect(() => {
    const elapsed = lastKernelAt ? Date.now() - lastKernelAt : Infinity;
    if (elapsed >= 90_000) {
      setDeepWatch(true);
      return;
    }
    const remaining = 90_000 - elapsed;
    const t = setTimeout(() => setDeepWatch(true), remaining);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // ── Eye phase emit ─────────────────────────────────────────────────────────
  useEffect(() => {
    const phase = flaring ? 'flaring' :
                  isOnMercury ? 'engaged-here' :
                  deepWatch ? 'deep-watch' : 'idle';
    emitObs('edge', 'eye_phase', { phase });
  }, [flaring, deepWatch, isOnMercury]);

  // ── Animation priority ──────────────────────────────────────────────────────
  const animation = flaring
    ? 'mei-flare 1.8s ease-out forwards'
    : isOnMercury
      ? 'mei-breath-active 8s ease-in-out infinite'
      : deepWatch
        ? 'mei-breath-deep 14s ease-in-out infinite'
        : 'mei-breath 11s ease-in-out infinite';

  return (
    <div
      className="relative shrink-0 select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      {/* ── Observer phrase — extends leftward from the eye on kernel load/run ── */}
      {phrase && (
        <div
          key={phraseKey}
          className="absolute right-full top-1/2 px-2 py-0.5 pointer-events-none"
          style={{
            animation: 'mei-phrase 5.1s ease forwards',
            background: 'rgba(0,0,0,0.88)',
          }}
          onAnimationEnd={() => setPhrase(null)}
        >
          <span
            className="font-mono text-[9px] tracking-[0.12em] block text-right whitespace-nowrap"
            style={{ color: 'rgba(232,210,138,0.65)' }}
          >
            {phrase}
          </span>
        </div>
      )}
      <style>{`
        @keyframes mei-breath {
          0%, 100% { opacity: 0.28; }
          50%      { opacity: 0.58; }
        }
        @keyframes mei-breath-active {
          0%, 100% { opacity: 0.72; }
          50%      { opacity: 0.95; }
        }
        @keyframes mei-breath-deep {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.38; }
        }
        @keyframes mei-flare {
          0%   { opacity: 0.95; }
          35%  { opacity: 0.82; }
          100% { opacity: 0.28; }
        }
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mei-phrase {
          0%   { opacity: 0; transform: translateX(5px) translateY(-50%); }
          6%   { opacity: 1; transform: translateX(0)   translateY(-50%); }
          78%  { opacity: 1; transform: translateX(0)   translateY(-50%); }
          100% { opacity: 0; transform: translateX(0)   translateY(-50%); }
        }
      `}</style>
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: isOnMercury ? '#d4a82a' : '#e8d28a',
          animation,
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
