import { describe, it, expect, beforeEach } from 'vitest';
import { getGateState, setGateState, GATE_KEY } from '../src/terminal/lib/gateStorage';

describe('gateStorage', () => {
  beforeEach(() => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  it('exports the storage key', () => {
    expect(GATE_KEY).toBe('scale94.gate');
  });

  it('returns null when nothing is stored', () => {
    expect(getGateState()).toBeNull();
  });

  it('persists and reads "passed"', () => {
    setGateState('passed');
    expect(getGateState()).toBe('passed');
  });

  it('persists and reads "failed"', () => {
    setGateState('failed');
    expect(getGateState()).toBe('failed');
  });

  it('clears state when set to null', () => {
    setGateState('passed');
    setGateState(null);
    expect(getGateState()).toBeNull();
  });

  it('falls back to in-memory when sessionStorage throws', () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('blocked'); },
    });
    try {
      setGateState('passed');
      expect(getGateState()).toBe('passed');
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
