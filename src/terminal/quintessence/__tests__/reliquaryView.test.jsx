// src/terminal/quintessence/__tests__/reliquaryView.test.jsx — the schematic
// names its readers (registry spec §4: every slot annotated individually).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReliquaryView from '../ReliquaryView';
import { _resetSpineForTests } from '../spineStore';

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

  it('multi-slot owners annotate each owned slot individually', () => {
    const matches = container.textContent.match(/read by ⟨SOCIOLOGY⟩/g);
    expect(matches).toHaveLength(3); // ecocide, privacy, surveillance
    expect(container.textContent.match(/read by ⟨HISTORY⟩/g)).toHaveLength(2); // mummy·transmission, ledger
  });

  it('the art house appears with its reader', () => {
    const text = container.textContent;
    expect(text).toContain('house: art');
    expect(text.match(/read by ⟨AESTHETICS⟩/g)).toHaveLength(2); // essences + art
  });
});
