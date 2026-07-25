import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useReadingWitness from '../useReadingWitness';

// A fake scroll container whose innerText and scroll geometry we control.
function makeEl({ words = 40, scrollable = true } = {}) {
  const listeners = {};
  const el = {
    innerText: Array.from({ length: words }, (_, i) => `w${i}`).join(' '),
    clientHeight: 500,
    scrollHeight: scrollable ? 2000 : 400, // scrollable => overflows
    scrollTop: 0,
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    _fire: (t) => (listeners[t] || []).forEach((fn) => fn()),
  };
  return el;
}

function setFocus(visible, focused) {
  Object.defineProperty(document, 'visibilityState', { value: visible ? 'visible' : 'hidden', configurable: true });
  vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
}

beforeEach(() => { vi.useFakeTimers(); setFocus(true, true); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// Read one kernel to completion: scroll to bottom + accrue enough active seconds.
function readToBottom(el, seconds) {
  el.scrollTop = el.scrollHeight - el.clientHeight; // at bottom
  act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });       // genuine scrolling
  act(() => { vi.advanceTimersByTime(seconds * 1000); });               // active dwell
}

describe('useReadingWitness', () => {
  const required = ['K1', 'K2'];

  it('fires once after all required kernels are read', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 }); // requiredSeconds(40) = (40/200)*60*0.55 = 6.6s
    const mainRef = { current: el };
    let article = { id: 'K1' };
    const { rerender } = renderHook(
      ({ a }) => useReadingWitness({ mainRef, selectedArticle: a, activeTab: 'kernel', requiredArticleIds: required, onWitnessed }),
      { initialProps: { a: article } }
    );

    readToBottom(el, 8);
    expect(onWitnessed).not.toHaveBeenCalled(); // K2 still unread

    article = { id: 'K2' };
    rerender({ a: article });
    readToBottom(el, 8);

    expect(onWitnessed).toHaveBeenCalledTimes(1);

    // Keep reading — must not fire again.
    readToBottom(el, 8);
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('does not accrue while the tab is hidden/blurred', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });
    setFocus(false, false);                          // away
    act(() => { vi.advanceTimersByTime(60_000); });  // a full minute away
    expect(onWitnessed).not.toHaveBeenCalled();

    setFocus(true, true);                            // back
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('ignores reads while another tab is active', () => {
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'lunar', requiredArticleIds: ['K1'], onWitnessed }));
    readToBottom(el, 20);
    expect(onWitnessed).not.toHaveBeenCalled();
  });
});
