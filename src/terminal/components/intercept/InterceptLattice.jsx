// InterceptLattice.jsx — /SURVEILLANCE's hero: a jurisdiction lattice the
// visitor sends a packet through while the laws in force act on it
// (docs/superpowers/specs/2026-09-25-surveillance-intercept-lattice-design.md).
// Map ghost at the bottom, the WebGL field in the middle, the SVG overlay on top.

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import WorldMap from '../WorldMap';
import InterceptField from './InterceptField';
import InterceptOverlay from './InterceptOverlay';
import { useInterceptSession, KEPT_CAP, WORD_MS } from './useInterceptSession';
import { createFieldBuffers, fillStatic, fillScene } from './interceptFieldUniforms';
import { nodeXY } from './interceptGeometry';
import {
  NODE_IDS, STEPS, lawNodes, lawsInForce, nodeLoad, tickStates, familyReadout, formatCount,
} from '../../lib/interceptLattice';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STYLE = `
  @keyframes iv-word { 0% { opacity: 0; } 8% { opacity: 1; } 70% { opacity: 0.9; } 100% { opacity: 0; } }
  @keyframes iv-flicker { 0%, 100% { opacity: 0.2; } 18% { opacity: 0.9; } 22% { opacity: 0.25; } 57% { opacity: 0.75; } 63% { opacity: 0.2; } }
  @keyframes iv-pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
  .iv-word { animation: iv-word ${WORD_MS}ms linear forwards; }
  .iv-flicker { animation: iv-flicker 2.6s steps(1, end) infinite; }
  .iv-pulse { animation: iv-pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .iv-flicker, .iv-pulse { animation: none; } }
`;

const NO_LAWS = [];

export default function InterceptLattice({ laws = NO_LAWS, highlightLaw = null, onNodeSelect }) {
  const s = useInterceptSession(laws);
  const [glLive, setGlLive] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);

  const sceneRef = useRef(null);
  if (!sceneRef.current) {
    sceneRef.current = createFieldBuffers();
    fillStatic(sceneRef.current, nodeXY);
  }

  const inForce = useMemo(() => lawsInForce(laws, s.step), [laws, s.step]);
  const loadScale = useMemo(() => Math.max(1, ...NODE_IDS.map((n) => nodeLoad(n, laws))), [laws]);
  const loads = useMemo(
    () => Object.fromEntries(NODE_IDS.map((n) => [n, nodeLoad(n, inForce) / loadScale])),
    [inForce, loadScale],
  );
  const ticks = useMemo(
    () => Object.fromEntries(NODE_IDS.map((n) => [n, tickStates(n, laws, s.step)])),
    [laws, s.step],
  );
  const readout = useMemo(() => familyReadout(laws, s.step), [laws, s.step]);
  const highlight = useMemo(() => new Set(highlightLaw ? lawNodes(highlightLaw) : []), [highlightLaw]);

  const { kept, traced } = s;
  // Layout effect: it must fill the buffer before the child InterceptField's
  // passive snap() repaints under reduced motion, or that frame lags a detent.
  useLayoutEffect(() => {
    fillScene(sceneRef.current, {
      loads,
      kept: Object.fromEntries(Object.entries(kept).map(([id, n]) => [id, n / KEPT_CAP])),
      traced: new Set(traced),
    });
  }, [loads, kept, traced]);
  const sceneVersion = `${s.step}:${Object.values(kept).join(',')}:${traced.length}`;

  const activate = (id, opts) => {
    const r = s.activate(id, opts);
    if (r) onNodeSelect?.(r === 'reset' ? null : id);
  };

  return (
    <section className="mb-6 border border-orange-900/20 bg-black/30 rounded-sm p-3" aria-label="intercept lattice">
      <style>{STYLE}</style>
      <div className="relative w-full" style={{ aspectRatio: '2 / 1' }}>
        <div className="absolute inset-0 opacity-60">
          <WorldMap palette="orange" height="100%" scanDur={9} />
        </div>
        <InterceptField sceneRef={sceneRef} packetRef={s.packetRef} sceneVersion={sceneVersion} onLiveChange={setGlLive} />
        <InterceptOverlay
          path={s.path} src={s.src} dst={s.dst} waypoints={s.waypoints}
          ticks={ticks} words={s.words} hop={s.hop}
          showBead={!glLive || reducedMotion} showFallbackGlow={!glLive}
          loads={loads} kept={kept} keptCap={KEPT_CAP}
          marks={s.marks} traced={traced}
          highlight={highlight} euHighlight={highlightLaw?.location === 'EU'}
          onActivate={activate}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <input
          type="range" min={0} max={STEPS.length - 1} step={1} value={s.step}
          onChange={(e) => s.setStep(Number(e.target.value))}
          aria-label="legislative time" aria-valuetext={STEPS[s.step].id}
          className="w-full accent-orange-500 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-mono lowercase">
          {STEPS.map((st, i) => (
            <span key={st.id} className={i === s.step ? 'text-orange-300' : 'text-orange-400/35'}>{st.id}</span>
          ))}
        </div>
      </div>

      <div data-testid="lattice-readout" className="mt-2 text-[10px] font-mono lowercase text-orange-300/80 tabular-nums">
        {`in force ${inForce.length} / ${laws.length} · unread ${formatCount(readout.unread)} · unkept ${formatCount(readout.unkept)} · unnamed ${formatCount(readout.unnamed)}`}
      </div>
      <p data-testid="fate-line" aria-live="polite" className="mt-2 text-[11px] font-mono lowercase text-orange-200/90 min-h-[1.25rem]">
        {s.fate || 'choose where it leaves · then where it lands'}
      </p>
      <p className="mt-1 text-[9px] font-mono lowercase text-orange-400/35">
        each word marks what the law permits, not what happened · within this corpus · country-level connectivity, not cable routes
      </p>
    </section>
  );
}
