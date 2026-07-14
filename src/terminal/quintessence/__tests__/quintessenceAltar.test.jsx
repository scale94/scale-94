// src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx — the living altar (spec §5–6).
// Smoke-level: wet/dry from the witness, click always navigates, the armed
// prompt names the gesture. No compile-flow simulation (timers + wasm not worth mocking).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import QuintessenceAltar from '../../mercury/QuintessenceAltar';
import { setTrend, setCouncil, setPhase, _resetSpineForTests } from '../spineStore';
import { emit, _resetForTests as resetBus } from '../../../observatory/observatoryBus';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ELEMENT_IDS = ['FIRE', 'AIR', 'EARTH', 'WATER'];

let container = null;
let root = null;
let onNavigate = null;

function sealButtons() {
  return [...container.querySelectorAll('button')]
    .filter(b => ELEMENT_IDS.some(id => b.textContent.includes(id)));
}
function sealFor(id) {
  return sealButtons().find(b => b.textContent.includes(id));
}
function completeSpine() {
  act(() => {
    setTrend({ label: 'degrowth', velocity: 0.9 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'test directive', trajectory: 'FOUNDATION', paradoxCount: 2 });
    setPhase('SMOKE DISSOLUTION');
  });
}

beforeEach(() => {
  _resetSpineForTests();
  resetBus();
  localStorage.clear();
  onNavigate = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<QuintessenceAltar onNavigate={onNavigate} />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
  resetBus();
});

describe('QuintessenceAltar — the living altar', () => {
  it('empty spine: names the missing vertebrae, but the seals are NEVER disabled', () => {
    const text = container.textContent;
    expect(text).toContain('SPINE INCOMPLETE');
    const seals = sealButtons();
    expect(seals).toHaveLength(4);
    for (const b of seals) expect(b.disabled).toBe(false);
  });

  it('click always navigates to the element house — never ignites', () => {
    act(() => { sealFor('FIRE').click(); });
    expect(onNavigate).toHaveBeenCalledWith('art');
    act(() => { sealFor('WATER').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ledger');
    act(() => { sealFor('AIR').click(); });
    expect(onNavigate).toHaveBeenCalledWith('transmission');
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });

  it('seals are dry until their house is visited, then wet (live via the bus)', () => {
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('false');
    act(() => { emit('gaze', 'tab_navigated', { tab: 'art' }); });
    expect(sealFor('FIRE').getAttribute('data-wet')).toBe('true');
    expect(sealFor('WATER').getAttribute('data-wet')).toBe('false');
  });

  it('armed altar: the prompt names the gesture, and click STILL navigates', () => {
    completeSpine();
    expect(container.textContent).toContain('ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL');
    expect(container.textContent).not.toContain('SPINE INCOMPLETE');
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });
});
