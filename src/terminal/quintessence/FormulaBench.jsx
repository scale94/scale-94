// FormulaBench.jsx — the opened vial on the reliquary (spec §3 decision 17; P3 Task 6).
// The decrypted formula, stored in plain text on the compiled artifact, laid out
// as a bench sheet: batch toggle, rows by layer, top-up, split, IFRA, the
// note → material mappings (spec §6.9) and the modulation log. Every number is
// read from the stored formula; nothing here computes chemistry.
import { useState } from 'react';
import { TYPE_NAMES } from '../scent/formulaEngine';
import { MATERIALS } from '../scent/materials';
import { LAYER_HEX, GOLD_HEX } from '../mercury/AccordReveal';

const ASH = '#a8a29e';
const MUTED = '#71717a';
const PRIMARY = '#d6d3d1';
const LAYERS = ['top', 'heart', 'base'];
const NAME_BY_ID = new Map(MATERIALS.map((m) => [m.id, m.name]));

const stockText = (stock) => (stock === 1 ? 'neat' : `${+(stock * 100).toFixed(4)}% stock`);
const batchLabel = (b) => `${b.grams.toFixed(2)} g / ${b.vialMl} ml`;

function Row({ r }) {
  const color = LAYER_HEX[r.layer] ?? ASH;
  return (
    <div data-testid="bench-row" data-material={r.materialId} data-layer={r.layer} className="mb-1" style={{ breakInside: 'avoid' }}>
      <div className="flex items-baseline min-w-0">
        <span data-part="name" className="truncate min-w-0" style={{ color }}>{r.name}</span>
        <span aria-hidden="true" className="flex-1 border-b border-dotted mx-1 min-w-[1rem]" style={{ borderColor: MUTED }} />
        <span data-part="grams" className="whitespace-nowrap shrink-0" style={{ color }}>{`${r.grams.toFixed(2)} g`}</span>
      </div>
      <div data-part="meta" className="text-[9px]" style={{ color: MUTED }}>CAS {r.cas} · {stockText(r.stock)}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-4">
      <div className="text-[9px] tracking-[0.25em] uppercase mb-1" style={{ color: MUTED }}>{title}</div>
      {children}
    </div>
  );
}

export default function FormulaBench({ formula }) {
  const names = Object.keys(formula.batches);
  const [pick, setPick] = useState(names.includes('small') ? 'small' : names[0]);
  const b = formula.batches[pick];
  const e = formula.envelope;

  return (
    <div data-testid="formula-bench" className="mb-6 border border-zinc-800/70 bg-black/60 p-5 font-mono text-[11px] leading-relaxed max-w-2xl">
      {b.state === 'ok' ? (
        <div className="tracking-[0.2em] uppercase" style={{ color: GOLD_HEX }}>
          FORMULA · {TYPE_NAMES[b.element]} · {b.actualPct.toFixed(2)}% concentrate
        </div>
      ) : (
        <div className="tracking-[0.2em] uppercase" style={{ color: ASH }}>FORMULA · {formula.modulators.element}</div>
      )}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="batch">
        {names.map((n) => {
          const bb = formula.batches[n];
          const on = n === pick;
          return (
            <button key={n} type="button" aria-pressed={on ? 'true' : 'false'} onClick={() => setPick(n)}
              className="border px-3 py-1 text-[10px] tracking-[0.15em]"
              style={{ color: on ? PRIMARY : MUTED, borderColor: on ? ASH : '#3f3f46' }}>
              {batchLabel(bb.batch)}
            </button>
          );
        })}
      </div>

      {b.state !== 'ok' ? (
        <div className="mt-4 text-rose-300/80">FORMULA INFEASIBLE AT {b.batch.grams.toFixed(2)} g — {b.reason}</div>
      ) : (
        <>
          {LAYERS.map((layer) => {
            const rows = b.rows.filter((r) => r.layer === layer);
            if (!rows.length) return null;
            return (
              <Section key={layer} title={layer}>
                {rows.map((r) => <Row key={r.materialId} r={r} />)}
              </Section>
            );
          })}
          <div className="mt-3" style={{ color: PRIMARY }}>ethanol top-up {b.alcoholGrams.toFixed(2)} g</div>
          <div style={{ color: ASH }}>
            weighed split · top {b.weighedSplit.top.toFixed(1)}% · heart {b.weighedSplit.heart.toFixed(1)}% · base {b.weighedSplit.base.toFixed(1)}%
          </div>

          <Section title="IFRA · fine fragrance">
            {b.ifra.map((c) => (
              <div key={c.standard ?? c.materialId} data-testid="bench-ifra" style={{ color: c.ok ? ASH : '#fda4af' }}>
                {c.ok ? '✓' : '✗'} {c.standard ?? NAME_BY_ID.get(c.materialId) ?? c.materialId} · {c.neatPct.toFixed(4)}% of {c.limitPct}%
              </div>
            ))}
          </Section>

          <Section title="what shaped it">
            {b.log.map((line) => <div key={line} style={{ color: ASH }}>{line}</div>)}
          </Section>
        </>
      )}

      <Section title="the card dreamed · the kit answered">
        {formula.notes.map((n) => (
          <div key={`${n.cardLayer}-${n.note}`} className="mb-0.5">
            <span className="font-sans" style={{ color: LAYER_HEX[n.cardLayer] ?? ASH }}>{n.note}</span>
            <span style={{ color: MUTED }}> → </span>
            <span style={{ color: ASH }}>
              {n.materials.map((m) => `${NAME_BY_ID.get(m.materialId) ?? m.materialId} ${(m.parts * 100).toFixed(0)}%`).join(' · ')}
            </span>
          </div>
        ))}
      </Section>

      <div className="mt-4 text-[9px] break-all" style={{ color: MUTED }}>
        opened at this compile · {e.kem} ct {e.ctBytes} B · {e.kdf} · {e.aead} {e.aeadBytes} B · fp {e.fp}
      </div>
    </div>
  );
}
