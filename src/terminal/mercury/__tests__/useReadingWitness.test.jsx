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

  it('does not accrue while the tab is hidden/blurred (pauses, does not reset)', () => {
    // requiredSeconds(40) = 6.6s. Below-threshold pre-hide progress (5s) must
    // survive the hidden window; only a small remainder (2.5s) is needed after
    // returning. A buggy reset-on-blur implementation would need the full 6.6s
    // again after returning and would fail the final assertion.
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40 });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });
    act(() => { vi.advanceTimersByTime(5_000); });   // below-threshold active dwell, still visible+focused
    expect(onWitnessed).not.toHaveBeenCalled();

    setFocus(false, false);                          // away
    act(() => { vi.advanceTimersByTime(60_000); });  // a full minute away — must not accrue
    expect(onWitnessed).not.toHaveBeenCalled();

    setFocus(true, true);                            // back
    act(() => { vi.advanceTimersByTime(2_500); });   // small remainder: 5s + 2.5s = 7.5s > 6.6s, but 2.5s alone < 6.6s
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

  it('credits a short article that fits without scrolling (waives the scroll-event floor) on time alone', () => {
    // scrollable: false => scrollHeight <= clientHeight + slop, i.e. nothing to
    // scroll. reachedBottom must be auto-true and the MIN_SCROLL_EVENTS floor
    // waived so time-alone can still satisfy isAbsorbed — no scroll events are
    // ever fired in this test.
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 40, scrollable: false });
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    // requiredSeconds(40) = 6.6s; activeSeconds accrues in whole-second ticks,
    // so give a full-second margin past the threshold. No scroll events fired.
    act(() => { vi.advanceTimersByTime(7_000); });
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('does not latch a too-easy threshold from an early typing-reveal undercount', () => {
    // The article prose reveals via a typing animation: innerText starts tiny and
    // grows. A measure-once implementation locks requiredSeconds from the first
    // (tiny) reading and never re-measures, making the threshold trivially small.
    // The fix must track the MAXIMUM word count seen and re-derive the threshold.
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 3 }); // tiny initial "typed so far" body
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    // Typing animation finishes: the real body is 200 words.
    // requiredSeconds(200) = (200/200)*60*0.55 = 33s.
    el.innerText = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');

    // Genuine scrolling to the bottom.
    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });

    // Advance well past the stale 3-word threshold (~0.5s) but far below the real
    // 33s threshold for 200 words.
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(onWitnessed).not.toHaveBeenCalled();

    // Advance past the real threshold.
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('does not permanently waive scroll-to-bottom when the pane grows past the viewport after mount', () => {
    // At mount, the typing-reveal content is tiny and the pane fits without
    // overflowing (scrollHeight <= clientHeight + slop). A buggy implementation
    // latches reachedBottom=true forever at that moment. The real article grows
    // past the viewport once typing finishes, so a genuine scroll to the bottom
    // must still be required — the waiver must be re-evaluated against live
    // geometry, not a stale mount-time snapshot.
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 3 });
    el.clientHeight = 500;
    el.scrollHeight = 400; // fits at mount
    const mainRef = { current: el };
    renderHook(() => useReadingWitness({ mainRef, selectedArticle: { id: 'K1' }, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }));

    // Typing animation finishes: the real body is 200 words and now overflows.
    // requiredSeconds(200) = (200/200)*60*0.55 = 33s.
    el.innerText = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
    el.scrollHeight = 2000;

    // Advance well past the real 33s threshold WITHOUT ever scrolling.
    act(() => { vi.advanceTimersByTime(40_000); });
    expect(onWitnessed).not.toHaveBeenCalled();

    // Now genuinely scroll to the bottom.
    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });

    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });

  it('does not complete a kernel from the transient reveal-fits window on remount (carried-over activeSeconds bypass)', () => {
    // Regression for the mount-calls-runAbsorption bug: statsRef persists across
    // navigation (App-lifetime, keyed by article id). A reader can accrue >=
    // threshold activeSeconds on a scrollable article WITHOUT ever reaching the
    // bottom (fits stays false throughout, since scrollHeight > clientHeight the
    // whole time) — must not complete. Then on REOPEN of the same id, the pane is
    // briefly small again (typing-reveal), so the live `fits` waiver is
    // transiently true. If mount ran the full absorption check, the carried-over
    // activeSeconds (already past threshold) would complete the kernel through
    // that transient window without a real scroll-to-bottom ever happening. Mount
    // must only measure; completion may only come from onScroll or the interval.
    const onWitnessed = vi.fn();
    const el = makeEl({ words: 200, scrollable: true }); // requiredSeconds(200) = 33s
    const mainRef = { current: el };
    let article = { id: 'K1' };
    const { rerender } = renderHook(
      ({ a }) => useReadingWitness({ mainRef, selectedArticle: a, activeTab: 'kernel', requiredArticleIds: ['K1'], onWitnessed }),
      { initialProps: { a: article } }
    );

    // Accrue past threshold WITHOUT scrolling to the bottom. scrollHeight (2000)
    // stays > clientHeight (500) throughout, so `fits` is false the whole time —
    // must not complete.
    act(() => { vi.advanceTimersByTime(35_000); });
    expect(onWitnessed).not.toHaveBeenCalled();

    // Simulate leaving the article (toggle to a different/no article)...
    article = null;
    rerender({ a: article });

    // ...then reopening the SAME id while its content is briefly small again
    // (typing-reveal on remount). scrolledBottom is still false; carried-over
    // activeSeconds (35s) is already past the 33s threshold for this article.
    el.scrollHeight = 400; // fits at this instant: clientHeight 500 + slop 24
    article = { id: 'K1' };
    rerender({ a: article });

    // The remount must NOT complete the kernel via the transient fits + carried
    // time — it may only measure.
    expect(onWitnessed).not.toHaveBeenCalled();

    // Now the real content settles back past the viewport and a genuine
    // scroll-to-bottom happens — only now may it complete.
    el.scrollHeight = 2000;
    el.scrollTop = el.scrollHeight - el.clientHeight;
    act(() => { for (let i = 0; i < 5; i++) el._fire('scroll'); });

    expect(onWitnessed).toHaveBeenCalledTimes(1);
  });
});
