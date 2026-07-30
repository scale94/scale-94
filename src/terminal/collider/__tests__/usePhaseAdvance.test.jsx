import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, act, screen } from '@testing-library/react';
import { usePhaseAdvance } from '../usePhaseAdvance';
import { COLLIDE_MS } from '../colliderPhases';

// A host that mirrors how LatentCollider will use the hook.
function Host({ startPhase = 'idle' }) {
  const [phase, setPhase] = useState(startPhase);
  const [startedAt, setStartedAt] = useState(0);
  usePhaseAdvance(phase, startedAt, () => setPhase('result'));
  return (
    <>
      <div data-testid="phase">{phase}</div>
      <button onClick={() => { setPhase('colliding'); setStartedAt(performance.now()); }}>fire</button>
      <button onClick={() => { setPhase('idle'); setStartedAt(performance.now()); }}>reset</button>
    </>
  );
}

const phase = () => screen.getByTestId('phase').textContent;

describe('usePhaseAdvance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('advances colliding -> result with zero frames rendered', () => {
    // The defect this exists for: the old transition fired from inside the
    // Canvas2D draw loop. Under prefers-reduced-motion the loop never starts,
    // so the result card never appeared. No rAF is faked here at all -- if
    // this passes, the transition genuinely does not depend on rendering.
    render(<Host />);
    act(() => { screen.getByText('fire').click(); });
    expect(phase()).toBe('colliding');

    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 1); });
    expect(phase()).toBe('colliding');

    act(() => { vi.advanceTimersByTime(1); });
    expect(phase()).toBe('result');
  });

  it('cancels a pending advance when the phase changes first', () => {
    render(<Host />);
    act(() => { screen.getByText('fire').click(); });
    act(() => { vi.advanceTimersByTime(COLLIDE_MS / 2); });
    act(() => { screen.getByText('reset').click(); });
    act(() => { vi.advanceTimersByTime(COLLIDE_MS * 3); });
    expect(phase()).toBe('idle');
  });

  it('never schedules for a phase that has no timed exit', () => {
    for (const p of ['idle', 'selecting', 'accelerating', 'result']) {
      const spy = vi.spyOn(globalThis, 'setTimeout');
      const { unmount } = render(<Host startPhase={p} />);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
      unmount();
    }
  });

  it('cancels on unmount so a stale advance cannot fire', () => {
    const onAdvance = vi.fn();
    function Bare() { usePhaseAdvance('colliding', 0, onAdvance); return null; }
    const { unmount } = render(<Bare />);
    unmount();
    act(() => { vi.advanceTimersByTime(COLLIDE_MS * 2); });
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('re-arms when the same phase restarts with a new timestamp', () => {
    // A second collision fired without leaving 'colliding' must reset the
    // clock, not inherit the first one's remaining time.
    const onAdvance = vi.fn();
    function Bare({ at }) { usePhaseAdvance('colliding', at, onAdvance); return null; }
    const { rerender } = render(<Bare at={0} />);
    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 100); });  // t=2400, 100ms left
    // The restart carries the CURRENT clock, the way the component captures
    // performance.now() at the transition. A stale literal here would leave
    // almost no time on the new timer and the assertion below would be vacuous.
    const restartAt = performance.now();                       // 2400
    rerender(<Bare at={restartAt} />);
    act(() => { vi.advanceTimersByTime(COLLIDE_MS - 100); });  // t=4800, fires at 4900
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });               // t=5000
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not extend the collision when the parent re-renders mid-flight', () => {
    const onAdvance = vi.fn();
    function Bare({ tick }) { usePhaseAdvance('colliding', 0, onAdvance); return null; }
    const { rerender } = render(<Bare tick={0} />);
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<Bare tick={1} />);   // same phase, same startedAt: must not re-arm
    act(() => { vi.advanceTimersByTime(500); });
    expect(onAdvance).toHaveBeenCalledTimes(1);  // fires at 2500, not 4500
  });
});
