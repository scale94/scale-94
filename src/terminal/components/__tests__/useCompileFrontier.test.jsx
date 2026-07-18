// src/terminal/components/__tests__/useCompileFrontier.test.jsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompileFrontier } from '../useCompileFrontier';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';

beforeEach(() => _resetForTests());
afterEach(() => _resetForTests());

describe('useCompileFrontier', () => {
  it('starts at night with no events', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    expect(result.current).toMatchObject({ twilight: 0, day: 0, loaded: 0, run: 0, flare: null });
  });

  it('a kernel_loaded event advances twilight and sets a load flare', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' }));
    expect(result.current.loaded).toBe(1);
    expect(result.current.twilight).toBeGreaterThan(0);
    expect(result.current.day).toBe(0);
    expect(result.current.flare).toMatchObject({ kind: 'load' });
    expect(typeof result.current.flare.ts).toBe('number');
  });

  it('a kernel_completed event advances day and sets a run flare', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('transmissions', 'kernel_loaded', { kernelId: 'bosonic' }));
    act(() => emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' }));
    expect(result.current.run).toBe(1);
    expect(result.current.day).toBeGreaterThan(0);
    expect(result.current.flare).toMatchObject({ kind: 'run' });
  });

  it('ignores non-transmissions events', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('gaze', 'sphere_clicked', {}));
    expect(result.current.flare).toBe(null);
    expect(result.current.loaded).toBe(0);
  });
});
