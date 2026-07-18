import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEcologicalRam, ECOLOGICAL_DELTA_MAP } from '../../src/terminal/hooks/useEcologicalRam';

function setup() {
  const logs = [];
  const appendSystemLog = (entry) => { logs.push(entry); };
  const view = renderHook(() => useEcologicalRam({ appendSystemLog }));
  return { ...view, logs };
}

describe('useEcologicalRam — pure PF meter (post-riddle purge)', () => {
  it('starts full at 100', () => {
    const { result } = setup();
    expect(result.current.ramPct).toBe(100);
  });

  it('applies a numeric drain and clamps at the 5% floor', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta(-30); });
    expect(result.current.ramPct).toBe(70);
    act(() => { result.current.applyRamDelta(-90); }); // would be -20, clamps to floor
    expect(result.current.ramPct).toBe(5);
  });

  it('recharges on positive delta and clamps at the 100% ceiling', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta(-40); });
    expect(result.current.ramPct).toBe(60);
    act(() => { result.current.applyRamDelta(+80); }); // 140 → clamped to 100
    expect(result.current.ramPct).toBe(100);
  });

  it('resolves a harmful kernel alias to its damage delta WITHOUT zeroing the meter', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); }); // -55
    expect(result.current.ramPct).toBe(100 + ECOLOGICAL_DELTA_MAP.leviathan); // 45
    expect(logs.find(l => l.msg.includes('[LATTICE:ZEROED]'))).toBeUndefined();
  });

  it('recharges on a regenerative kernel alias', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta(-50); });
    act(() => { result.current.applyRamDelta('daly'); }); // +22
    expect(result.current.ramPct).toBe(50 + ECOLOGICAL_DELTA_MAP.daly); // 72
  });

  it('defaults unknown aliases to a mild -10 drain', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta('some_unmapped_kernel'); });
    expect(result.current.ramPct).toBe(90);
  });

  it('no longer exposes the retired lattice/re$$ill surface', () => {
    const { result } = setup();
    expect(result.current.applyRefill).toBeUndefined();
    expect(result.current.latticeState).toBeUndefined();
    expect(result.current.isRefillReady).toBeUndefined();
  });
});
