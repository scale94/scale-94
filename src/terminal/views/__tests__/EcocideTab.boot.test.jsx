import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// The shared kernel bundle refuses to load — a cold cache, an offline gallery
// machine, a browser that will not instantiate the .wasm.
vi.mock('../../../wasm/wasmSingleton', () => ({
  loadWasm: () => Promise.reject(new Error('wasm unavailable')),
}));

import EcocideTab from '../EcocideTab';

async function runSeconds(seconds) {
  await act(async () => { vi.advanceTimersByTime(seconds * 1000); });
}

describe('EcocideTab — boot', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Nothing in the ecocide simulation reads the WASM module — the collapse
  // integrator is plain JS. A failed load must not brick the tab.
  it('runs the simulation even when the kernel bundle fails to load', async () => {
    render(<EcocideTab />);
    expect(screen.getByText(/SARG = 10\.00/)).toBeTruthy();

    await runSeconds(8);

    expect(screen.queryByText(/SARG = 10\.00/)).toBeNull();
  });
});
