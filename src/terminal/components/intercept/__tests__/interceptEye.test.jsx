// interceptEye.test.jsx — the intercept session drives the masthead eye: lock on the first
// input, a trace per send, release on reset / unmount. Headings only, nothing stored.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInterceptSession } from '../useInterceptSession';
import { subscribeImpulse, _resetObserverForTests } from '../../../quintessence/observerStore';

const NO_LAWS = [];   // stable: the session's send effect depends on `laws`
let imps, off;
beforeEach(() => {
  vi.useFakeTimers();
  _resetObserverForTests();
  imps = [];
  off = subscribeImpulse((i) => imps.push(i));
});
afterEach(() => { off?.(); vi.useRealTimers(); });

describe('intercept session -> eye', () => {
  it('locks_on_first_input_traces_the_send_and_releases_on_reset', () => {
    const { result, unmount } = renderHook(() => useInterceptSession(NO_LAWS));
    act(() => { result.current.activate('AU'); });
    expect(imps.map((i) => i.piece)).toEqual(['surveillance.lock']);
    act(() => { result.current.activate('US'); });
    const trace = imps.find((i) => i.piece === 'surveillance.trace');
    expect(trace).toBeTruthy();
    expect(trace.data.heads.length).toBe(result.current.path.length - 1);
    trace.data.heads.forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(1, 6));
    expect(JSON.stringify(trace.data)).not.toMatch(/AU|US|australia/i);   // headings only
    act(() => { result.current.activate('AU'); });                          // the source again: reset
    expect(imps.at(-1).piece).toBe('surveillance.release');
    unmount();
    expect(imps.at(-1).piece).toBe('surveillance.release');
  });
});
