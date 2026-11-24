// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// The Observer eye at the masthead's left edge, on every tab. The observer is
// always watching, not just when you visit Mercury.
//
// It renders observerStore (spec §5.7–§5.9): the snapshot (flash, glance,
// whisper, ignition, seal) resolves to the eye's state via resolveEyeState;
// impulses (bus/spine reactions) become imperative kick()s, the crescendo a
// detonate(). The kernel flare is the store's KICK.miosis impulse.
//
// One phrase slot right of the eye: the existentialist lines on kernel
// load/run (amber) and the whispers (pale silver-violet). A kernel phrase
// preempts a showing whisper: the visitor's own act wins.
//
// Telemetry: edge/eye_phase {phase: silver|aether|charging|crescendo|sealed}
// on change, deferred out of render. edge/eye_whisper {target} is the store's (showWhisper).
// Suppression: handled by parent (boot / sanctuary / breach).

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { emit as emitObs } from '../../observatory/observatoryBus';
import ObserverEye from './ObserverEye';
import { getSpine, subscribeSpine } from '../quintessence/spineStore';
import { getObserver, subscribeObserver, subscribeImpulse, CRESCENDO_MS } from '../quintessence/observerStore';
import { resolveEyeState } from './resolveEyeState';

const PHRASE_COLOR  = 'rgba(232,210,138,0.65)';
const WHISPER_COLOR = 'rgba(200,196,232,0.75)';

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

// mobileChrome is the masthead's visibility (spec §5.8). App feeds it to the store
// (setChromeVisible), which holds whispers while it is hidden; the eye itself needs nothing from it.
export default function MercuryEyeIndicator({ activeTab, onNavigate, lastKernelAt, lastLoadAt, mobileChrome: _mobileChrome }) {
  const isOnMercury = activeTab === 'mercury';
  const eyeRef = useRef(null);
  const [slot, setSlot] = useState(null);       // { text, whisper, key } | null
  const slotKey      = useRef(0);
  const lastRunIdx   = useRef(-1);
  const lastLoadIdx  = useRef(-1);
  const prevKernelAt = useRef(null);
  const prevLoadAt   = useRef(null);
  const [spine, setSpine] = useState(getSpine);
  const [crescendo, setCrescendo] = useState(false);
  const obs = useSyncExternalStore(subscribeObserver, getObserver);

  useEffect(() => subscribeSpine(setSpine), []);

  // ── Impulses → the eye's imperative handle (no re-render) ───────────────────
  useEffect(() => {
    let crescendoTimer = 0;
    const off = subscribeImpulse((imp) => {
      if (imp.tier === 'crescendo' || imp.kind === 0) {
        eyeRef.current?.detonate();
        setCrescendo(true);
        clearTimeout(crescendoTimer);
        crescendoTimer = setTimeout(() => setCrescendo(false), CRESCENDO_MS);
        return;
      }
      eyeRef.current?.kick({ kind: imp.kind, tint: imp.tint, tint2: imp.tint2, dir: imp.dir, durationMs: imp.durationMs });
    });
    return () => { off(); clearTimeout(crescendoTimer); };
  }, []);

  // ── Phrase picker — anti-repeat within pool ─────────────────────────────────
  function firePhrase(pool, idxRef) {
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); }
    while (idx === idxRef.current && pool.length > 1);
    idxRef.current = idx;
    setSlot({ text: pool[idx], whisper: false, key: ++slotKey.current });
  }

  // ── Phrase on kernel run / load (takes the slot from a showing whisper) ─────
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    firePhrase(OBSERVER_PHRASES_RUN, lastRunIdx);
  }, [lastKernelAt]);

  useEffect(() => {
    if (!lastLoadAt || lastLoadAt === prevLoadAt.current) return;
    prevLoadAt.current = lastLoadAt;
    firePhrase(OBSERVER_PHRASES_LOAD, lastLoadIdx);
  }, [lastLoadAt]);

  // ── Whisper → the phrase slot, once per id (the store keeps it spent) ───────
  // The store emits edge/eye_whisper itself (spec §5.9), so a remount never re-logs it.
  const whisper = obs.whisper;
  const prevWhisperId = useRef(null);
  useEffect(() => {
    if (!whisper || whisper.id === prevWhisperId.current) return;
    prevWhisperId.current = whisper.id;
    setSlot({ text: whisper.text, whisper: true, key: ++slotKey.current });
  }, [whisper]);

  const { state: eyeState, tint, gaze, pulse, thread, shimmer, baseline } = resolveEyeState({
    spine, sealed: obs.sealed, igniting: obs.igniting, remarkedSinceSeal: obs.remarkedSinceSeal,
    flash: obs.flash, glance: obs.glance,
  });

  // ── Eye phase emit (on change only, deferred out of render) ─────────────────
  const phase = crescendo ? 'crescendo'
    : obs.igniting ? 'charging'
    : obs.sealed && baseline === 'silver' ? 'sealed'
    : baseline;
  const prevPhase = useRef(null);
  useEffect(() => {
    if (phase === prevPhase.current) return;
    prevPhase.current = phase;
    setTimeout(() => emitObs('edge', 'eye_phase', { phase }), 0);   // no cleanup: every change is logged
  }, [phase]);

  return (
    <div
      className="relative shrink-0 select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ COMPILE YOUR DENIAL"
    >
      {/* ── Observer phrase — extends rightward from the eye on kernel load/run
          (the eye is the masthead's left edge now; leftward would run off-screen) ── */}
      {slot && (
        <div
          key={slot.key}
          className="absolute left-full top-1/2 px-2 py-0.5 pointer-events-none"
          style={{
            animation: `mei-phrase ${slot.whisper ? '6s' : '5.1s'} ease forwards`,
            background: 'rgba(0,0,0,0.88)',
          }}
          onAnimationEnd={() => setSlot(null)}
        >
          <span
            className="font-mono text-[9px] tracking-[0.12em] block text-left whitespace-nowrap"
            style={{ color: slot.whisper ? WHISPER_COLOR : PHRASE_COLOR }}
          >
            {slot.text}
          </span>
        </div>
      )}
      <style>{`
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mei-phrase {
          0%   { opacity: 0; transform: translateX(-5px) translateY(-50%); }
          6%   { opacity: 1; transform: translateX(0)   translateY(-50%); }
          78%  { opacity: 1; transform: translateX(0)   translateY(-50%); }
          100% { opacity: 0; transform: translateX(0)   translateY(-50%); }
        }
      `}</style>
      {/* The living eye — WebGL nebula pupil in a hexagon lens. */}
      <ObserverEye
        ref={eyeRef}
        state={eyeState}
        tint={tint}
        gaze={gaze}
        pulse={pulse}
        thread={thread}
        shimmer={shimmer}
        size={64}
        className="transition-transform duration-300 group-hover:scale-110"
      />
      {/* Tooltip — only on hover, very subtle. Pulled up under the hex's lower
          taper so both lines stay inside the h-24 masthead (top-full + margin
          used to clip at the header's bottom edge); left-anchored since the eye
          now sits at the masthead's left edge. */}
      <div
        className="absolute left-0 top-full -mt-4 pointer-events-none opacity-0 group-hover:opacity-100"
        style={{ transition: 'opacity 0.35s ease-out 0.15s' }}
      >
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap text-left"
          style={{ color: 'rgba(232,210,138,0.75)' }}>
          ◉ COMPILE YOUR DENIAL
        </div>
        <div className="text-[8px] font-mono whitespace-nowrap text-left mt-0.5"
          style={{ color: 'rgba(232,210,138,0.4)' }}>
          {isOnMercury ? 'engaged here · 9.4.castle' : 'click → mercury'}
        </div>
      </div>
    </div>
  );
}
