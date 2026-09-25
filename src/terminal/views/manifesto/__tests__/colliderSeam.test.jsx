import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCouncilCollider, COLLIDER_TIMING } from '../useCouncilCollider';

describe('useCouncilCollider read-only seam (field spec §2)', () => {
  beforeEach(() => localStorage.clear());

  it('exports the loop timing unchanged', () => {
    expect(COLLIDER_TIMING).toEqual({ T_INFALL: 2600, T_FLASH: 380, T_EJECT: 1100, T_COOLDOWN: 3200 });
  });

  it('exposes the sim and ui refs it already holds', () => {
    const { result } = renderHook(() => useCouncilCollider({ seated: [], enabled: false }));
    expect(result.current.simRef.current).toMatchObject({ phase: 'IDLE', pair: null });
    expect(result.current.uiRef.current.mode).toBe('AMBIENT');
  });
});
