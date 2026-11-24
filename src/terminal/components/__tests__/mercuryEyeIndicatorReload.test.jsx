// mercuryEyeIndicatorReload.test.jsx — a sealed reload against the REAL observerStore.
// The armed spine plus a stored seal must read `sealed` on the very first render: the
// store is not started yet (the boot sequence runs first), so its first snapshot has
// to know the seal by itself, or the eye flashes Aether and logs a false `aether`.
import React, { forwardRef } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const eye = vi.hoisted(() => ({ states: [] }));
vi.mock('../ObserverEye', () => ({
  default: forwardRef(function ObserverEyeStub(props) {
    eye.states.push(props.state);
    return <div data-eye-stub="" />;
  }),
}));

import MercuryEyeIndicator from '../MercuryEyeIndicator';
import { _resetObserverForTests } from '../../quintessence/observerStore';
import { setTrend, setCouncil, setPhase, _resetSpineForTests } from '../../quintessence/spineStore';
import { STORAGE_KEY } from '../../quintessence/sealedArtifact';
import { _resetVolatileForTests } from '../../quintessence/volatileHold';
import { subscribe, _resetForTests as _resetBusForTests } from '../../../observatory/observatoryBus';
import { LUNAR_ACCORDS } from '../../data/lunarAccords';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  _resetBusForTests();
  _resetSpineForTests();
  _resetVolatileForTests();
  _resetObserverForTests();
  eye.states = [];
});
afterEach(() => {
  cleanup();
  _resetObserverForTests();
  _resetSpineForTests();
  _resetBusForTests();
  vi.useRealTimers();
});

describe('MercuryEyeIndicator — sealed reload', () => {
  it('first eye_phase is sealed (no aether) and the eye never renders aether', () => {
    setTrend({ label: 'x', velocity: 0.5 });
    setCouncil({ pair: ['a', 'b'], directive: 'd', trajectory: 't', paradoxCount: 1 });
    setPhase(LUNAR_ACCORDS[0].accord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'old' }));
    _resetObserverForTests();                       // a reload: the store module is fresh
    const phases = [];
    const off = subscribe(e => { if (e.kind === 'eye_phase') phases.push(e.payload.phase); });
    render(<MercuryEyeIndicator activeTab="kernel" onNavigate={() => {}} lastKernelAt={null} lastLoadAt={null} mobileChrome />);
    act(() => { vi.advanceTimersByTime(0); });
    off();
    expect(phases).toEqual(['sealed']);
    expect(eye.states).not.toContain('aether');
    expect(eye.states[0]).toBe('resting');
  });
});
