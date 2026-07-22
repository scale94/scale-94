// src/terminal/mercury/QuintessenceAltar.jsx — the altar (spec §4).
// Four elements · one click · the quintessence compiles. The nebula ignites
// only when the deliberate spine exists; otherwise absences are named.
import { useEffect, useReducer, useRef, useState } from 'react';
import { getSpine, setElement, missingVertebrae, subscribeSpine } from '../quintessence/spineStore';
import { snapshotPeriphery } from '../quintessence/periphery';
import { witnessEngine, trendToPressure } from '../quintessence/engineWitness';
import { compileKernel } from '../quintessence/compileKernel';
import { holdVolatile } from '../quintessence/volatileHold';
import { STORAGE_KEY } from '../quintessence/sealedArtifact';
import { drynessFor } from '../data/lunarAccords';
import { getTotals, subscribe as subscribeBus } from '../../observatory/observatoryBus';
import ElementSeal from './ElementSeal';
import SpineMirror from './SpineMirror';
import { useHoldToSeal } from './useHoldToSeal';

// Keystone (guidance spec §0): each element IS a house. Seal hue = house tab hue.
const ELEMENTS = [
  { id: 'FIRE',  sigil: '△', house: 'art',          tint: [255, 176, 32],  note: 'boson · force · the mask drops'   },
  { id: 'AIR',   sigil: '🜁', house: 'transmission', tint: [168, 85, 247],  note: 'boson · carrier · the mask drops' },
  { id: 'EARTH', sigil: '🜃', house: 'ecocide',      tint: [122, 184, 0],   note: 'fermion · structure · armor held' },
  { id: 'WATER', sigil: '▽', house: 'ledger',       tint: [20, 184, 166],  note: 'fermion · matter · armor held'    },
];

const STAGES = ['SPINE READ', 'PERIPHERY WITNESSED', 'ENGINE FIRED', 'HASH PRECIPITATED', 'VERDICT', 'SEALED'];

export default function QuintessenceAltar({ onDeposited, onNavigate }) {
  const [, force] = useReducer(x => x + 1, 0);
  const [stage, setStage] = useState(-1);          // -1 idle, 0..5 compiling, 6 done
  const [result, setResult] = useState(null);
  const alive = useRef(true);
  const igniting = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => subscribeSpine(force), []);

  // The seals remember (spec §5): wet = house visited, read live off the witness.
  const readVisited = () => {
    try { return { ...getTotals().gaze.tabsVisited }; } catch (_) { return {}; } // dead bus → all dry
  };
  const [visited, setVisited] = useState(readVisited);
  useEffect(() => subscribeBus(evt => {
    if (evt.category === 'gaze' && evt.kind === 'tab_navigated') setVisited(readVisited());
  }), []);

  const missing = missingVertebrae();
  const armed = missing.length === 0 && stage === -1;

  const hold = useHoldToSeal(elId => ignite(elId));
  const [confirming, setConfirming] = useState(null); // element id — keyboard path

  // Grid remount (stage back to -1): clear the hold latch. A completed hold
  // unmounts the grid before pointerup, so its click-swallow flag would
  // otherwise survive and eat the first click on the fresh grid.
  // (hold.reset is useCallback-stable; the hold wrapper object is not.)
  const holdReset = hold.reset;
  useEffect(() => { if (stage === -1) holdReset(); }, [stage, holdReset]);

  async function ignite(elementId) {
    if (!armed || igniting.current) return;
    // Spec §5.2: the reliquary holds one kernel at a time — recompile confirms.
    try {
      if (localStorage.getItem(STORAGE_KEY) &&
          !window.confirm('the reliquary holds one kernel · recompile and overwrite the seal?')) return;
    } catch (_) { /* no storage → nothing to overwrite */ }
    igniting.current = true;
    try {
      setElement(elementId);
      const spine = getSpine();
      const periphery = snapshotPeriphery();
      for (let s = 0; s < 3; s++) {
        setStage(s);
        await new Promise(r => setTimeout(r, 650));
        if (!alive.current) return;
      }
      const filledHouses = Object.values(periphery.houses).filter(Boolean).length
        + ['ciphers', 'transmissions', 'essences', 'lunarRead', 'art'].filter(k => periphery[k]).length
        + 4; // the four spine vertebrae themselves
      const engine = await witnessEngine({
        rPressure: trendToPressure(spine.trend.velocity),
        maxLayers: Math.max(4, filledHouses),
        burnSensitivity: Math.max(0.1, Math.min(2.0, drynessFor(spine.phase) / 50)),
      });
      if (!alive.current) return;
      for (let s = 3; s < 6; s++) {
        setStage(s);
        await new Promise(r => setTimeout(r, 650));
        if (!alive.current) return;
      }
      const artifact = await compileKernel(spine, periphery, engine);
      if (!alive.current) return;
      let volatile = false;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(artifact)); }
      catch (_) {
        volatile = true;
        // spec §7: storage refused the seal — hold the vial in memory so the
        // reliquary can still read it. Evaporates on reload, as VOLATILE must.
        holdVolatile({ ...artifact, meta: { ...artifact.meta, volatile: true } });
      }
      setResult(volatile ? { ...artifact, meta: { ...artifact.meta, volatile: true } } : artifact);
      setStage(6);
    } catch (err) {
      // The one link that can throw is compileKernel (crypto.subtle on a
      // non-secure origin). The altar must never brick: cool down, name nothing.
      if (import.meta.env?.DEV) console.debug('[quintessence] compile failed at the altar:', err);
      if (alive.current) { setResult(null); setStage(-1); }
    } finally {
      igniting.current = false;
    }
  }

  return (
    <div className="mt-8 border border-zinc-800/60 p-5" data-testid="quintessence-altar">
      <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-500 mb-1">
        ⌘ quintessence altar
      </div>
      <div className="text-[9px] font-mono text-zinc-600 mb-4 lowercase">
        four elements are bound to the earth · the fifth is compiled from your spine
      </div>

      {/* The mirror stays lit when armed: filling up and THEN arming is the payoff. */}
      {stage === -1 && <SpineMirror spine={getSpine()} armed={armed} onNavigate={onNavigate} />}

      {armed && (
        <div role="status" className="mt-3 text-[10px] font-mono tracking-[0.2em] text-amber-300/90 uppercase">
          [ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]
        </div>
      )}

      {stage === -1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {ELEMENTS.map(el => {
            const wet = (visited[el.house] || 0) > 0;
            return (
              <button key={el.id} type="button"
                data-wet={wet ? 'true' : 'false'}
                onPointerDown={(e) => { if (armed && e.button === 0) hold.start(el.id); }}
                onPointerUp={() => hold.cancel()}
                onPointerLeave={() => hold.cancel()}
                onPointerCancel={() => hold.cancel()}
                onContextMenu={() => hold.cancel()}
                onClick={() => { if (hold.consumedClick()) return; onNavigate?.(el.house); }}
                onKeyDown={(e) => {
                  if (armed && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setConfirming(el.id);
                  }
                }}
                className={`border p-4 text-center font-mono transition-colors cursor-pointer relative ${armed
                  ? 'border-amber-500/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20'
                  : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/30'}`}>
                <ElementSeal wet={wet} tint={el.tint} armed={armed}
                  holdProgress={hold.holding === el.id ? hold.progress : 0} size={72} />
                {hold.holding === el.id && (
                  <div className="absolute inset-x-0 bottom-0 h-[3px] bg-amber-400/80"
                    style={{ width: `${Math.round(hold.progress * 100)}%` }} />
                )}
                <div className="text-[11px] tracking-[0.3em] mt-2">{el.id}</div>
                {/* Hue = provenance (hue spec §3): the note wears the house hue
                    whether or not the altar is armed. Gold belongs to the
                    compile, not to an element that is merely available. */}
                <div className="text-[8px] mt-1 lowercase"
                  style={{ color: `rgba(${el.tint[0]},${el.tint[1]},${el.tint[2]},0.6)` }}>{el.note}</div>
              </button>
            );
          })}
        </div>
      )}

      {stage === -1 && confirming && (() => {
        const el = ELEMENTS.find(x => x.id === confirming);
        return (
          <div role="dialog" aria-label={`seal at ${el.id}?`}
            className="mt-3 border border-amber-500/40 p-3 font-mono text-[10px] tracking-[0.2em] uppercase flex items-center gap-4">
            <span className="text-amber-200">{el.sigil} {el.id} —</span>
            <button type="button" autoFocus
              onClick={() => { setConfirming(null); ignite(el.id); }}
              className="border border-amber-400/60 px-3 py-1 text-amber-200 hover:bg-amber-950/30">
              seal the kernel here
            </button>
            <button type="button"
              onClick={() => { setConfirming(null); onNavigate?.(el.house); }}
              className="text-zinc-400 hover:text-zinc-200 lowercase">
              walk the house →
            </button>
            <button type="button" onClick={() => setConfirming(null)}
              className="ml-auto text-zinc-600 hover:text-zinc-400 lowercase">esc</button>
          </div>
        );
      })()}

      {stage >= 0 && stage < 6 && (
        <div aria-live="polite" className="font-mono text-[10px] tracking-[0.25em] text-amber-300/90 uppercase py-6">
          {STAGES.slice(0, stage + 1).map(s => <div key={s} className="mb-1">✓ {s}</div>)}
        </div>
      )}

      {stage === 6 && result && (
        <div className="py-4">
          <div className="font-mono text-[11px] text-amber-200 tracking-[0.2em] uppercase mb-1">
            ◈ BUILD 0x{result.hash.slice(0, 8).toUpperCase()} · VERDICT {result.meta.verdict}
          </div>
          {result.meta.volatile && (
            <div className="font-mono text-[9px] text-red-400/70 tracking-[0.2em] uppercase mb-1">
              VOLATILE BUILD — will not survive reload
            </div>
          )}
          <button type="button" onClick={() => onDeposited?.()}
            className="mt-2 border border-amber-400/60 text-amber-200 font-mono text-[10px] tracking-[0.3em] uppercase px-4 py-2 hover:bg-amber-950/30">
            view the seal ↓
          </button>
          <button type="button" onClick={() => { setResult(null); setStage(-1); }}
            className="mt-2 ml-3 text-zinc-500 font-mono text-[9px] tracking-[0.25em] lowercase hover:text-zinc-300">
            the altar cools →
          </button>
        </div>
      )}
    </div>
  );
}
