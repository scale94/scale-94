// src/terminal/quintessence/ReliquaryView.jsx — the reliquary (spec §5).
// Pre-compile: monument + live schematic of the unfinished kernel.
// Post-compile: the sealed artifact, full code view, copy vial.
import { useEffect, useReducer, useRef, useState } from 'react';
import { getSpine, subscribeSpine, missingVertebrae } from './spineStore';
import { snapshotPeriphery } from './periphery';
import { heldVolatile } from './volatileHold';
import { subscribe as subscribeBus } from '../../observatory/observatoryBus';
import { STORAGE_KEY } from '../mercury/QuintessenceAltar';

const MONUMENT_CSS = `
/* ── Monument pattern (Fade-Doctrine compliant) ──────────────────────
   Modernist typography moments for the project's load-bearing claims.
   Two-gold monochrome: #e8d28a (luminous, body) + #d4a82a (deep, emphasis).
   No pure white anywhere. No spin, no breath, no color cycle.
   Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md
   ──────────────────────────────────────────────────────────────────── */
@keyframes sc-monumentReveal {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.sc-monument-marker {
  font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  color: #d4a82a;
  letter-spacing: 0.35em;
  text-transform: uppercase;
}
.sc-monument-eyebrow,
.sc-monument-subtitle {
  font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  color: rgba(6, 182, 212, 0.6);
  letter-spacing: 0.25em;
  text-transform: uppercase;
}
.sc-monument-display {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.028em;
  text-wrap: balance;
  color: #e8d28a;
}
.sc-monument-display--thesis  { font-size: clamp(28px, 4.2vw, 52px); }
.sc-monument-display--heading { font-size: clamp(36px, 5.5vw, 68px); }
.sc-monument-display--emphasis { color: #d4a82a; }
.sc-monument-accent {
  height: 2px;
  width: 80px;
  background: #d4a82a;
  border: 0;
}
`;

function loadArtifact() {
  // The volatile hold first: it can only exist in THIS session, so when present
  // it is always the most recent compile (covers quota-exceeded recompiles over
  // an older persisted seal). Otherwise the sealed vial from storage (spec §7).
  const held = heldVolatile();
  if (held) return held;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* unwitnessed */ }
  return null;
}

const slot = (label, filled, preview) => ({ label, filled, preview });

export default function ReliquaryView() {
  const [, force] = useReducer(x => x + 1, 0);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => subscribeSpine(force), []);
  useEffect(() => subscribeBus(force), []);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const artifact = loadArtifact();

  if (artifact) {
    const copyVial = async () => {
      try {
        await navigator.clipboard.writeText(artifact.source);
        setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
      }
      catch (_) { /* clipboard denied — the pre below remains selectable */ }
    };
    return (
      <div className="max-w-5xl mx-auto mt-8" data-testid="reliquary-sealed">
        <style>{MONUMENT_CSS}</style>
        <div className="sc-monument-eyebrow mb-2">the reliquary · one kernel at a time</div>
        <div className="font-mono text-[10px] text-amber-300/80 tracking-[0.15em] mb-4 break-all">
          ◈ SEAL sha256:{artifact.hash} · {artifact.meta.compiledAt} · {artifact.meta.element}
        </div>
        {artifact.meta.volatile && (
          <div className="font-mono text-[9px] text-red-400/70 tracking-[0.2em] uppercase mb-2">
            VOLATILE BUILD — will not survive reload
          </div>
        )}
        <button type="button" onClick={copyVial}
          className="mb-4 border border-amber-400/60 text-amber-200 font-mono text-[10px] tracking-[0.3em] uppercase px-4 py-2 hover:bg-amber-950/30">
          {copied ? '◈ vial copied' : 'copy the vial →'}
        </button>
        <pre className="border border-zinc-800 bg-black/70 p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-emerald-300/90 whitespace-pre">
          {artifact.source}
        </pre>
        <div className="mt-3 font-mono text-[8px] text-zinc-600 lowercase">
          genome: fish_scale_kernel_11.2 · the parent · every kernel is a fork of one master prompt
        </div>
      </div>
    );
  }

  // ── pre-compile: the live schematic ─────────────────────────────────────
  const spine = getSpine();
  const p = snapshotPeriphery();
  const slots = [
    slot('narcos payload · bsky trend',       !!spine.trend,   spine.trend?.label),
    slot('friction pair · council',           !!spine.council, spine.council?.pair?.join(' × ')),
    slot('dryness · olfactory phase',         !!spine.phase,   spine.phase),
    slot('entropy_lock · lunar transit',      !!p.lunarRead,   p.lunarRead ? `${p.lunarRead.phase}` : null),
    slot('mummy · transmission',              !!p.transmissions, p.transmissions?.lastKernel),
    slot('daemon · element',                  !!spine.element, spine.element),
    slot('house: ciphers',                    !!p.ciphers,     p.ciphers && `${p.ciphers.verifies} verified`),
    slot('house: essences',                   !!p.essences,    p.essences && `${p.essences.collisions} collisions`),
    slot('house: ecocide',                    !!p.houses.ecocide, p.houses.ecocide && `entered ${p.houses.ecocide}×`),
    slot('house: ledger',                     !!p.houses.ledger, p.houses.ledger && `entered ${p.houses.ledger}×`),
    slot('house: privacy',                    !!p.houses.privacy, p.houses.privacy && `entered ${p.houses.privacy}×`),
    slot('house: surveillance',               !!p.houses.surveillance, p.houses.surveillance && `entered ${p.houses.surveillance}×`),
  ];
  const missing = missingVertebrae();

  return (
    <div className="max-w-5xl mx-auto mt-8" data-testid="reliquary-schematic">
      <style>{MONUMENT_CSS}</style>
      {/* Monument — the axiom's only home (spec §5.1) */}
      <div className="mb-10">
        <div className="sc-monument-marker mb-3">ᛟ axiomatic law Ⅰ</div>
        <h2 className="sc-monument-display sc-monument-display--thesis">
          THEORY THAT CANNOT BE COMPILED<br />
          <span className="sc-monument-display--emphasis">DOES NOT YET EXIST AS KNOWLEDGE</span>
        </h2>
        <hr className="sc-monument-accent mt-4" />
      </div>

      <div className="sc-monument-eyebrow mb-4">
        the reliquary · your kernel is uncompiled · {missing.length === 0 ? 'the altar waits on mercury' : missing.join(' · ').toLowerCase()}
      </div>

      <div className="font-mono text-[11px] leading-relaxed border border-zinc-800/70 bg-black/60 p-5">
        <div className="text-zinc-500 mb-3">{'// KERNEL OF QUINTESSENCE :: awaiting quintessence event'}</div>
        {slots.map(s => (
          <div key={s.label} className="flex gap-3 mb-1">
            <span className={s.filled ? 'text-amber-300' : 'text-zinc-700'}>
              {s.filled ? `Some(${s.preview})` : 'None'}
            </span>
            <span className="text-zinc-600">{'// ' + s.label}{!s.filled && ' · awaiting witness'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
