import React, { useRef } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { usePhaseJump } from '../usePhaseJump';
import { repAgeForPhase } from '../phaseJump';

// Deterministic rAF: capture callbacks in a Map keyed by id, drive them by hand.
let rafMap;
let rafId;
let nowVal;

function flush(ms) {
  nowVal += ms;
  const cbs = [...rafMap.values()];
  rafMap.clear();
  cbs.forEach(cb => cb(nowVal));
}

function setReducedMotion(matches) {
  vi.stubGlobal('matchMedia', (q) => ({
    matches, media: q, addEventListener() {}, removeEventListener() {},
  }));
}

// Faithful harness: setScrubAge updates currentAgeRef, exactly as React state →
// currentAge → the ref does in LunarTab. This is required for the self-cancel
// check to behave correctly — a spy that left the ref stale would look like a
// permanent external divergence and abort every tween on frame 2.
function Harness({ hookRef, onSet, startAge }) {
  const currentAgeRef = useRef(startAge);
  const setScrubAge = React.useCallback((v) => {
    currentAgeRef.current = v;
    onSet(v);
  }, [onSet]);
  hookRef.current = usePhaseJump({ setScrubAge, currentAgeRef });
  hookRef.ageRef = currentAgeRef;   // exposed so a test can simulate a drag
  return null;
}

beforeEach(() => {
  rafMap = new Map();
  rafId = 0;
  nowVal = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafId += 1; rafMap.set(rafId, cb); return rafId; });
  vi.stubGlobal('cancelAnimationFrame', (id) => { rafMap.delete(id); });
  vi.spyOn(performance, 'now').mockImplementation(() => nowVal);
  setReducedMotion(false);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('usePhaseJump — tween', () => {
  it('eases toward the target and lands exactly on it', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });   // target ~14.765
    act(() => { flush(0); });                   // first frame, t=0
    expect(onSet.mock.calls[0][0]).toBeCloseTo(0, 1); // starts at the start age

    act(() => { flush(400); });                 // midway, t=0.5
    const mid = onSet.mock.calls.at(-1)[0];
    expect(mid).toBeGreaterThan(1);             // moved off the start
    expect(mid).toBeLessThan(repAgeForPhase('full')); // not yet arrived — proves it tweens

    act(() => { flush(400); });                 // t=1
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(repAgeForPhase('full'), 6); // lands exactly
  });

  it('takes the shortest wrapped path (new from day 27 waxes forward past the seam)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={27} />);

    act(() => { hookRef.current('new'); });     // target 0
    act(() => { flush(0); flush(400); });       // partway
    const mid = onSet.mock.calls.at(-1)[0];
    // Forward from 27 crosses the 29.53 seam: the value should be > 27 or wrapped
    // to a small age — never drifting down toward 14 (which would be backward).
    expect(mid > 27 || mid < 3).toBe(true);
    act(() => { flush(400); });
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(0, 6);
  });
});

describe('usePhaseJump — reduced motion', () => {
  it('snaps to the target with no rAF when reduced motion is set', () => {
    setReducedMotion(true);
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    expect(onSet).toHaveBeenCalledTimes(1);
    expect(onSet).toHaveBeenCalledWith(repAgeForPhase('full'));
    expect(rafMap.size).toBe(0);   // no animation scheduled
  });
});

describe('usePhaseJump — retarget, external cancel, cleanup', () => {
  it('retargets from the current position when clicked mid-tween', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });    // heading to ~14.765
    act(() => { flush(0); flush(400); });        // partway there
    act(() => { hookRef.current('new'); });      // change target to 0
    act(() => { flush(0); flush(400); flush(400); });
    expect(onSet.mock.calls.at(-1)[0]).toBeCloseTo(0, 6); // ended at new, not full
  });

  it('aborts when scrubAge is changed externally (a manual drag)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    act(() => { flush(0); flush(200); });
    const callsBeforeDrag = onSet.mock.calls.length;
    // Simulate a drag writing scrubAge directly, diverging from the tween's value:
    act(() => { hookRef.ageRef.current = 25; });
    act(() => { flush(200); flush(200); flush(200); });
    // The tween saw the divergence and stopped touching scrubAge:
    expect(onSet.mock.calls.length).toBe(callsBeforeDrag);
  });

  it('cancels the rAF on unmount (no setter calls after)', () => {
    const onSet = vi.fn();
    const hookRef = { current: null };
    const { unmount } = render(<Harness hookRef={hookRef} onSet={onSet} startAge={0} />);

    act(() => { hookRef.current('full'); });
    act(() => { flush(0); });
    const callsBefore = onSet.mock.calls.length;
    unmount();
    act(() => { flush(400); flush(400); });
    expect(onSet.mock.calls.length).toBe(callsBefore); // frozen after unmount
  });
});
