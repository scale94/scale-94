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
