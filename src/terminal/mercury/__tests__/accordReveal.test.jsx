// The reveal at the altar (spec §8, C over B). Fake timers drive the injected
// clock and frame callback; the schedule itself is pinned in revealSchedule.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AccordReveal, { LAYER_HEX, GOLD_HEX } from '../AccordReveal';
import { buildReveal } from '../revealSchedule';
import { buildAccordFormula } from '../../scent/accordFormula';
import { REAL_ACCORD, RAMP_SALT, ENVELOPE_META } from '../../scent/__tests__/accordFixture';
import { expectEveryNumberFromFormula } from '../../scent/__tests__/formulaNumbers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FORMULA = buildAccordFormula(
  { baseAccord: REAL_ACCORD, salt: RAMP_SALT() },
  { element: 'EARTH', phase: 'SMOKE DISSOLUTION', periphery: { sol: { lastReleaseErg: 3.2e31, inFlight: [], landings: [] }, art: { lyapunov: 0.3 } } },
  ENVELOPE_META,
);
const BYTES = Uint8Array.from({ length: ENVELOPE_META.aeadBytes }, (_, i) => (i * 131 + 7) % 256);
const TOTAL = buildReveal({ formula: FORMULA, aeadBytes: BYTES }).totalMs;

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

let container; let root; let onDone; let reduced;

function mount(props = {}) {
  act(() => {
    root.render(<AccordReveal formula={FORMULA} aeadBytes={BYTES} onDone={onDone}
      now={() => Date.now()} raf={(cb) => setTimeout(cb, 16)} cancelRaf={(id) => clearTimeout(id)} {...props} />);
  });
}
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  window.matchMedia = vi.fn((q) => ({ matches: q.includes('reduce') ? reduced : false, media: q, addEventListener() {}, removeEventListener() {} }));
  onDone = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('AccordReveal', () => {
  it('the header is the envelope line with the real byte counts', () => {
    mount();
    const h = container.querySelector('[data-testid="reveal-header"]');
    expect(h.textContent).toBe(`ENVELOPE · ML-KEM-768 CT (${ENVELOPE_META.ctBytes} B) · AES-256-GCM · ${ENVELOPE_META.aeadBytes} B`);
  });

  it('runs to the end and calls onDone once', () => {
    mount();
    advance(TOTAL - 50);
    expect(onDone).not.toHaveBeenCalled();
    advance(200);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(2000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('rows: name … grams, grams never wrap, the name truncates, CAS + stock on a second line', () => {
    mount(); advance(TOTAL + 100);
    const rows = [...container.querySelectorAll('[data-testid="reveal-row"]')];
    const small = FORMULA.batches.small;
    expect(rows.length).toBe(small.rows.length);
    for (const el of rows) {
      const r = small.rows.find((x) => x.materialId === el.dataset.material);
      const name = el.querySelector('[data-part="name"]');
      const grams = el.querySelector('[data-part="grams"]');
      const leader = el.querySelector('[data-part="leader"]');
      expect(name.textContent).toBe(r.name);
      expect(grams.textContent).toBe(`${r.grams.toFixed(2)} g`);
      expect(grams.className).toContain('whitespace-nowrap');
      expect(grams.className).toContain('shrink-0');
      expect(name.className).toContain('truncate');
      expect(name.className).toContain('min-w-0');
      expect(leader.className).toContain('flex-1');
      expect(leader.className).toContain('border-dotted');
      expect(el.querySelector('[data-part="meta"]').textContent).toContain(r.cas);
    }
  });

  it('layer colours are exact', () => {
    mount(); advance(TOTAL + 100);
    for (const el of container.querySelectorAll('[data-testid="reveal-row"]')) {
      expect(el.querySelector('[data-part="name"]').style.color).toBe(rgb(LAYER_HEX[el.dataset.layer]));
    }
    expect(LAYER_HEX).toEqual({ top: '#6cc6d4', heart: '#d98a46', base: '#c8a556' });
  });

  it('no white at rest; gold only on FORMULA lines', () => {
    mount(); advance(TOTAL + 100);
    for (const el of container.querySelectorAll('*')) {
      const c = el.style.color;
      expect(['rgb(255, 255, 255)', 'white', '#fff', '#ffffff']).not.toContain(c);
      expect(el.className?.includes?.('text-white')).toBeFalsy();
      if (c === rgb(GOLD_HEX)) expect(el.textContent).toMatch(/FORMULA/);
    }
    expect(GOLD_HEX).toBe('#fcd34d');
  });

  it('mid-reveal, a landing row flashes white on its grams only, then snaps', () => {
    const r = buildReveal({ formula: FORMULA, aeadBytes: BYTES });
    const s = r.steps.find((x) => x.kind === 'row');
    mount();
    advance(s.flashAt + 20);
    const flashing = [...container.querySelectorAll('[data-flash="on"]')];
    expect(flashing.length).toBeGreaterThan(0);
    for (const el of flashing) {
      expect(el.style.color).toBe('rgb(255, 255, 255)');
      expect(el.textContent.length).toBeLessThanOrEqual(4);
      expect(el.closest('[data-part="grams"]')).toBeTruthy();
    }
    advance(120);
    for (const el of container.querySelectorAll('[data-flash="on"]')) expect(el.closest('[data-testid="reveal-row"]').dataset.material).not.toBe(s.materialId);
  });

  it('unresolved characters come from the ciphertext slice', () => {
    const r = buildReveal({ formula: FORMULA, aeadBytes: BYTES });
    const s = r.steps.find((x) => x.kind === 'row');
    mount();
    advance(s.at + 10);
    const el = container.querySelector(`[data-material="${s.materialId}"]`);
    const shown = el.querySelector('[data-part="name"]').textContent + el.querySelector('[data-part="grams"]').textContent;
    const pending = el.querySelector('[data-part="name"] [data-resolved="no"]')?.textContent ?? '';
    expect(pending.length).toBeGreaterThan(0);
    expect(s.bytesHex).toContain(pending.slice(0, Math.min(4, pending.length)));
    expect(shown.length).toBe((s.name + s.value).length);
  });

  it('reduced motion: the end state at once, no flash', () => {
    reduced = true;
    mount();
    advance(16);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('[data-flash="on"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="reveal-row"]').length).toBe(FORMULA.batches.small.rows.length);
  });

  it('Esc skips to the end', () => {
    mount(); advance(500);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    advance(16);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a 400 ms hold skips to the end; a tap does not', () => {
    mount(); advance(300);
    const box = container.querySelector('[data-testid="accord-reveal"]');
    act(() => { box.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    advance(150);
    act(() => { box.dispatchEvent(new MouseEvent('pointerup', { bubbles: true })); });
    advance(16);
    expect(onDone).not.toHaveBeenCalled();
    act(() => { box.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    advance(420);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // Review Focus 4
  it('every number on screen at the end is in the formula', () => {
    mount(); advance(TOTAL + 100);
    expectEveryNumberFromFormula(container.textContent, FORMULA);
  });

  it('announces notes politely, never every character', () => {
    mount(); advance(TOTAL + 100);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live.textContent).toBe('FORMULA MODULATED');
    expect(container.querySelectorAll('[aria-live]').length).toBe(1);
  });
});
