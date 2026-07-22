import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// The tab loads the shared WASM module for its boot beat; nothing in the
// ecocide simulation reads it (the collapse integrator is plain JS).
vi.mock('../../../wasm/wasmSingleton', () => ({ loadWasm: () => Promise.resolve({}) }));

import EcocideTab from '../EcocideTab';

// jsdom gives every element a zero-width rect, which makes the lever's
// pointer math divide by zero. Give the tracks a real width.
const TRACK_RECT = { left: 0, top: 0, right: 200, bottom: 22, width: 200, height: 22, x: 0, y: 0 };

function armLever(label, fraction) {
  const row = screen.getByText(label).closest('.pl-row');
  const track = row.querySelector('.pl-track');
  track.getBoundingClientRect = () => TRACK_RECT;
  fireEvent.pointerDown(track, { clientX: TRACK_RECT.width * fraction });
  return row;
}

describe('EcocideTab — RESET_SIMULATION', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('disarms the protection levers so a reset world starts at homeostasis', async () => {
    render(<EcocideTab />);

    fireEvent.click(screen.getByText(/PROTECTION_PROTOCOL/));

    const row = armLever('RESTORATION', 1.0);
    expect(row.querySelector('.pl-val').textContent).toBe('100');

    await act(async () => { fireEvent.click(screen.getByText('[RESET_SIMULATION]')); });

    expect(row.querySelector('.pl-val').textContent).toBe('0');
  });

  it('clears the armed indicator on the collapsed protocol header', async () => {
    render(<EcocideTab />);

    const header = screen.getByText(/PROTECTION_PROTOCOL/);
    fireEvent.click(header);
    armLever('SANCTUARY', 0.8);
    fireEvent.click(header);
    expect(screen.queryByText('● armed')).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByText('[RESET_SIMULATION]')); });

    expect(screen.queryByText('● armed')).toBeNull();
  });
});
