// src/terminal/quintessence/__tests__/reliquaryView.test.jsx — the schematic
// names its readers (registry spec §4: every slot annotated individually).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReliquaryView from '../ReliquaryView';
import { _resetSpineForTests, setTrend, reconcileScent } from '../spineStore';
import { sealScentForTests } from './scentFixture';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

beforeEach(() => {
  _resetSpineForTests();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<ReliquaryView />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
});

describe('ReliquaryView — the faculty roster on the schematic', () => {
  it('annotates every slot with its reading discipline, filled or awaiting', () => {
    const text = container.textContent;
    expect(text).toContain('read by ⟨SEMIOTICS⟩');                       // narcos_payload
    expect(text).toContain('read by ⟨PHILOSOPHY⟩');                      // council_pair
    expect(text).toContain('read by ⟨CHEMISTRY ⇄ ALCHEMY⟩');             // pirarucu
    expect(text).toContain('read by ⟨ASTRONOMY ⇄ ASTROLOGY⟩');           // entropy_lock
    expect(text).toContain('read by ⟨COGNITIVE SCIENCE ⇄ MYTHOLOGY⟩');   // daemon
    expect(text).toContain('read by ⟨RELIGIOUS STUDIES⟩');               // house_ciphers
    expect(text).toContain('read by ⟨AESTHETICS⟩');                      // house_essences
    expect(text).toContain('read by ⟨SOCIOLOGY⟩');                       // house_ecocide + privacy + surveillance
    expect(text).toContain('read by ⟨HISTORY⟩');                         // mummy·transmission + house_ledger
  });

  it('the sealed accord is a slot of its own, read by CHEMISTRY ⇄ ALCHEMY beside the dryness', () => {
    const text = container.textContent;
    expect(text).toContain('sealed accord · scent');
    expect(text.match(/read by ⟨CHEMISTRY ⇄ ALCHEMY⟩/g)).toHaveLength(2); // pirarucu, sealed_accord
    expect(text).toContain('no accord sealed');
  });

  it('a sealed accord shows its card name; an orphaned one does not', async () => {
    await act(async () => { sealScentForTests(); });
    expect(container.textContent).toContain('Fixture Accord');
    await act(async () => { reconcileScent(null); });
    expect(container.textContent).not.toContain('Fixture Accord');
    expect(container.textContent).toContain('seal orphaned — the key evaporated');
  });

  it('multi-slot owners annotate each owned slot individually', () => {
    const matches = container.textContent.match(/read by ⟨SOCIOLOGY⟩/g);
    expect(matches).toHaveLength(3); // ecocide, privacy, surveillance
    expect(container.textContent.match(/read by ⟨HISTORY⟩/g)).toHaveLength(2); // mummy·transmission, ledger
  });

  it('the chaos house appears with its reader', () => {
    const text = container.textContent;
    expect(text).toContain('house: chaos');
    expect(text.match(/read by ⟨AESTHETICS⟩/g)).toHaveLength(2); // essences + art
  });

  it('the chaos slot shows the waiting testimony: sphere r and Δr pre-compile', () => {
    _resetForTests();
    emit('gaze', 'art_regime', { r: 3.72, lyapunov: 0.021, regime: 'CHAOS' });
    setTrend({ label: 'degrowth', velocity: 0.9 });   // engine r = trendToPressure(0.9) = 3.88
    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    const r2 = createRoot(c2);
    act(() => { r2.render(<ReliquaryView />); });
    const text = c2.textContent;
    expect(text).toContain('sphere r 3.72');
    expect(text).toContain('Δr -0.16');   // 3.72 - 3.88 = -0.16
    act(() => { r2.unmount(); });
    c2.remove();
  });

  it('a witnessed sphere with no trend shows the r with no Δr suffix', () => {
    _resetForTests();
    emit('gaze', 'art_regime', { r: 3.72, lyapunov: 0.021, regime: 'CHAOS' });
    const c3 = document.createElement('div');
    document.body.appendChild(c3);
    const r3 = createRoot(c3);
    act(() => { r3.render(<ReliquaryView />); });
    const text = c3.textContent;
    expect(text).toContain('sphere r 3.72');
    expect(text).not.toContain('Δr');
    act(() => { r3.unmount(); });
    c3.remove();
  });
});

// ── scent-aether P3 Task 6: the opened vial on the reliquary ────────────────
import { STORAGE_KEY } from '../sealedArtifact';
import { buildAccordFormula } from '../../scent/accordFormula';
import { TYPE_NAMES } from '../../scent/formulaEngine';
import { REAL_ACCORD, RAMP_SALT, ENVELOPE_META } from '../../scent/__tests__/accordFixture';
import { expectEveryNumberFromFormula } from '../../scent/__tests__/formulaNumbers';
import { LAYER_HEX } from '../../mercury/AccordReveal';

const FORMULA = buildAccordFormula(
  { baseAccord: REAL_ACCORD, salt: RAMP_SALT() },
  { element: 'EARTH', phase: 'SMOKE DISSOLUTION', periphery: { sol: { lastReleaseErg: 3.2e31, inFlight: [], landings: [] }, art: { lyapunov: 0.3 } } },
  ENVELOPE_META,
);
const ART = (formula) => ({
  source: '// KERNEL OF QUINTESSENCE :: test source',
  hash: 'ab'.repeat(32),
  meta: { compiledAt: '2026-11-27T12:00:00.000Z', element: 'EARTH', verdict: 'PLOMO' },
  ...(formula ? { formula } : {}),
});
function showSealed(artifact) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(artifact));
  act(() => { root.render(<ReliquaryView key={Math.random()} />); });
}
const bench = () => container.querySelector('[data-testid="formula-bench"]');
const rowEls = () => [...container.querySelectorAll('[data-testid="bench-row"]')];

describe('ReliquaryView — the opened vial (scent-aether P3)', () => {
  it('a legacy kernel (no formula) reads "// sealed before the aether"; the source view is unchanged', () => {
    showSealed(ART(null));
    expect(container.querySelector('[data-testid="reliquary-sealed"]')).toBeTruthy();
    expect(container.textContent).toContain('// sealed before the aether');
    expect(bench()).toBeNull();
    expect(container.querySelector('pre').textContent).toBe('// KERNEL OF QUINTESSENCE :: test source');
  });

  it('header, rows, top-up and split render from the small batch', () => {
    showSealed(ART(FORMULA));
    const s = FORMULA.batches.small;
    const text = bench().textContent;
    expect(text).toContain(`FORMULA · ${TYPE_NAMES.EARTH} · ${s.actualPct.toFixed(2)}% concentrate`);
    expect(rowEls().length).toBe(s.rows.length);
    for (const el of rowEls()) {
      const r = s.rows.find((x) => x.materialId === el.dataset.material);
      expect(el.querySelector('[data-part="name"]').textContent).toBe(r.name);
      expect(el.querySelector('[data-part="grams"]').textContent).toBe(`${r.grams.toFixed(2)} g`);
      expect(el.querySelector('[data-part="meta"]').textContent).toContain(r.cas);
      expect(el.querySelector('[data-part="name"]').style.color).not.toBe('');
      expect(el.dataset.layer).toBe(r.layer);
    }
    expect(text).toContain(`ethanol top-up ${s.alcoholGrams.toFixed(2)} g`);
    expect(text).toContain(`top ${s.weighedSplit.top.toFixed(1)}% · heart ${s.weighedSplit.heart.toFixed(1)}% · base ${s.weighedSplit.base.toFixed(1)}%`);
  });

  it('rows are grouped top, heart, base', () => {
    showSealed(ART(FORMULA));
    const order = { top: 0, heart: 1, base: 2 };
    const layers = rowEls().map((el) => order[el.dataset.layer]);
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
    expect(Object.keys(LAYER_HEX)).toEqual(['top', 'heart', 'base']);
  });

  it('the batch toggle switches every gram to the large batch', () => {
    showSealed(ART(FORMULA));
    const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent === '10.00 g / 15 ml');
    expect(toggle).toBeTruthy();
    act(() => { toggle.click(); });
    const l = FORMULA.batches.large;
    expect(rowEls().length).toBe(l.rows.length);
    for (const el of rowEls()) {
      const r = l.rows.find((x) => x.materialId === el.dataset.material);
      expect(el.querySelector('[data-part="grams"]').textContent).toBe(`${r.grams.toFixed(2)} g`);
    }
    expect(bench().textContent).toContain(`ethanol top-up ${l.alcoholGrams.toFixed(2)} g`);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows every note → material mapping, the modulation log, IFRA results and the envelope line', () => {
    showSealed(ART(FORMULA));
    const text = bench().textContent;
    for (const n of FORMULA.notes) expect(text).toContain(n.note);
    for (const line of FORMULA.batches.small.log) expect(text).toContain(line);
    expect(container.querySelectorAll('[data-testid="bench-ifra"]').length).toBe(FORMULA.batches.small.ifra.length);
    expect(text).toContain(`opened at this compile · ML-KEM-768 ct ${ENVELOPE_META.ctBytes} B · BLAKE3-derive_key · AES-256-GCM ${ENVELOPE_META.aeadBytes} B`);
  });

  it('an infeasible batch is named, with no rows for it', () => {
    const inf = { state: 'infeasible', reason: 'accord has no top row', batch: { grams: 7, vialMl: 10 } };
    showSealed(ART({ ...FORMULA, batches: { ...FORMULA.batches, small: inf } }));
    expect(bench().textContent).toContain('FORMULA INFEASIBLE AT 7.00 g — accord has no top row');
    expect(rowEls().length).toBe(0);
  });

  // Review Focus 4
  it('every number in the bench is in the formula', () => {
    showSealed(ART(FORMULA));
    expectEveryNumberFromFormula(bench().textContent, FORMULA);
  });

  it('no white at rest in the bench', () => {
    showSealed(ART(FORMULA));
    for (const el of bench().querySelectorAll('*')) {
      expect(['rgb(255, 255, 255)', 'white']).not.toContain(el.style.color);
      expect(String(el.className)).not.toMatch(/text-white|text-zinc-50\b|text-neutral-50\b/);
    }
  });
});
