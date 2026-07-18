import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMercuryKernelUnlocked, unlockMercuryKernel, relockMercuryKernel, subscribeMercuryKernel,
} from '../mercuryKernelUnlock';

beforeEach(() => { localStorage.clear(); });

describe('mercuryKernelUnlock', () => {
  it('starts locked', () => {
    expect(isMercuryKernelUnlocked()).toBe(false);
  });

  it('unlock → locked round-trip', () => {
    unlockMercuryKernel();
    expect(isMercuryKernelUnlocked()).toBe(true);
    expect(localStorage.getItem('mercury_kernel_v1')).toBe('1');
    relockMercuryKernel();
    expect(isMercuryKernelUnlocked()).toBe(false);
  });

  it('subscribe fires on unlock and relock, and unsubscribes', () => {
    const fn = vi.fn();
    const off = subscribeMercuryKernel(fn);
    unlockMercuryKernel();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    relockMercuryKernel();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
