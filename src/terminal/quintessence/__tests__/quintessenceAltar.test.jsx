// src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx — the gate (spec §9).
// Component smoke tests only: the altar names its absences and arms when the
// spine completes. No compile-flow simulation (timers + wasm not worth mocking).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import QuintessenceAltar from '../../mercury/QuintessenceAltar';
import { setTrend, setCouncil, setPhase, _resetSpineForTests } from '../spineStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ELEMENT_IDS = ['FIRE', 'AIR', 'EARTH', 'WATER'];

let container = null;
let root = null;

function elementButtons() {
  return [...container.querySelectorAll('button')]
    .filter(b => ELEMENT_IDS.some(id => b.textContent.includes(id)));
}

beforeEach(() => {
  _resetSpineForTests();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<QuintessenceAltar />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
});

describe('QuintessenceAltar — the gate', () => {
  it('empty spine: names all three missing vertebrae and dims the four elements', () => {
    const text = container.textContent;
    expect(text).toContain('SPINE INCOMPLETE');
    expect(text).toContain('NO TREND MARKED');
    expect(text).toContain('NO COUNCIL COLLISION');
    expect(text).toContain('NO PHASE COMPILED');

    const buttons = elementButtons();
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b.disabled).toBe(true);
  });

  it('completed spine: the gate text dissolves and the elements arm — subscription-driven, no remount', () => {
    act(() => {
      setTrend({ label: 'degrowth', velocity: 0.9 });
      setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'test directive', trajectory: 'FOUNDATION', paradoxCount: 2 });
      setPhase('SMOKE DISSOLUTION');
    });

    expect(container.textContent).not.toContain('SPINE INCOMPLETE');

    const buttons = elementButtons();
    expect(buttons).toHaveLength(4);
    for (const b of buttons) expect(b.disabled).toBe(false);
  });
});
