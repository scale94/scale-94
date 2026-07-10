// src/terminal/mercury/QuintessenceAltar.jsx — the altar (spec §4).
// Four elements · one click · the quintessence compiles. The nebula ignites
// only when the deliberate spine exists; otherwise absences are named.
import { useEffect, useReducer, useRef, useState } from 'react';
import { getSpine, setElement, missingVertebrae, subscribeSpine } from '../quintessence/spineStore';
import { snapshotPeriphery } from '../quintessence/periphery';
import { witnessEngine, trendToPressure } from '../quintessence/engineWitness';
import { compileKernel } from '../quintessence/compileKernel';
import { drynessFor } from '../data/lunarAccords';

const ELEMENTS = [
  { id: 'FIRE',  sigil: '△', note: 'boson · force · the mask drops'   },
  { id: 'AIR',   sigil: '🜁', note: 'boson · carrier · the mask drops' },
  { id: 'EARTH', sigil: '🜃', note: 'fermion · structure · armor held' },
  { id: 'WATER', sigil: '▽', note: 'fermion · matter · armor held'    },
];

const STAGES = ['SPINE READ', 'PERIPHERY WITNESSED', 'ENGINE FIRED', 'HASH PRECIPITATED', 'VERDICT', 'SEALED'];
export const STORAGE_KEY = 'quintessence_kernel_v1';

export default function QuintessenceAltar({ onDeposited }) {
  const [, force] = useReducer(x => x + 1, 0);
  const [stage, setStage] = useState(-1);          // -1 idle, 0..5 compiling, 6 done
  const [result, setResult] = useState(null);
  const alive = useRef(true);
  const igniting = useRef(false);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => subscribeSpine(force), []);

  const missing = missingVertebrae();
  const armed = missing.length === 0 && stage === -1;

  async function ignite(elementId) {
    if (!armed || igniting.current) return;
    // Spec §5.2: the reliquary holds one kernel at a time — recompile confirms.
    try {
      if (localStorage.getItem(STORAGE_KEY) &&
          !window.confirm('the reliquary holds one kernel · recompile and overwrite the seal?')) return;
    } catch (_) { /* no storage → nothing to overwrite */ }
    igniting.current = true;
    setElement(elementId);
    const spine = getSpine();
    const periphery = snapshotPeriphery();
    for (let s = 0; s < 3; s++) {
      setStage(s);
      await new Promise(r => setTimeout(r, 650));
      if (!alive.current) return;
    }
    const filledHouses = Object.values(periphery.houses).filter(Boolean).length
      + ['ciphers', 'transmissions', 'essences', 'lunarRead'].filter(k => periphery[k]).length
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
    catch (_) { volatile = true; }
    setResult(volatile ? { ...artifact, meta: { ...artifact.meta, volatile: true } } : artifact);
    setStage(6);
    igniting.current = false;
  }

  return (
    <div className="mt-8 border border-zinc-800/60 p-5" data-testid="quintessence-altar">
      <div className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-500 mb-1">
        ⌘ quintessence altar
      </div>
      <div className="text-[9px] font-mono text-zinc-600 mb-4 lowercase">
        four elements are bound to the earth · the fifth is compiled from your spine
      </div>

      {stage === -1 && missing.length > 0 && (
        <div className="text-[10px] font-mono tracking-[0.2em] text-red-400/70 uppercase">
          SPINE INCOMPLETE · {missing.join(' · ')}
        </div>
      )}

      {stage === -1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {ELEMENTS.map(el => (
            <button key={el.id} type="button" disabled={!armed}
              onClick={() => ignite(el.id)}
              className={`border p-4 text-center font-mono transition-colors ${armed
                ? 'border-amber-500/40 text-amber-200 hover:border-amber-300 hover:bg-amber-950/20 cursor-pointer'
                : 'border-zinc-800 text-zinc-700 cursor-not-allowed'}`}>
              <div className="text-2xl mb-2">{el.sigil}</div>
              <div className="text-[11px] tracking-[0.3em]">{el.id}</div>
              <div className="text-[8px] text-zinc-500 mt-1 lowercase">{el.note}</div>
            </button>
          ))}
        </div>
      )}

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
            deposited in reliquary →
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
