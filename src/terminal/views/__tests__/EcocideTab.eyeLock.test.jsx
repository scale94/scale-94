import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../../wasm/wasmSingleton', () => ({ loadWasm: () => Promise.resolve({}) }));
// Count lock / unlock calls; the lock itself is covered in ecocideEye.test.js.
const calls = { lock: 0, unlock: 0 };
vi.mock('../ecocide/ecocideEye', async (orig) => ({
  ...(await orig()),
  lockEcocideEye: () => { calls.lock++; return () => { calls.unlock++; }; },
}));

import EcocideTab from '../EcocideTab';

const TRACK_RECT = { left: 0, top: 0, right: 200, bottom: 4, width: 200, height: 4, x: 0, y: 0 };

describe('EcocideTab — the masthead eye lock', () => {
  afterEach(() => { calls.lock = 0; calls.unlock = 0; });

  it('locks on open, lets go on reset, re-locks on the next touch, lets go on exit', async () => {
    const { unmount, container } = render(<EcocideTab />);
    expect(calls).toEqual({ lock: 1, unlock: 0 });

    await act(async () => { fireEvent.click(screen.getByText('[RESET_SIMULATION]')); });
    expect(calls).toEqual({ lock: 1, unlock: 1 });

    const track = [...container.querySelectorAll('div')].find((d) => d.style.touchAction === 'none');
    track.getBoundingClientRect = () => TRACK_RECT;
    fireEvent.pointerDown(track, { clientX: 70 });
    fireEvent.pointerUp(window);
    expect(calls).toEqual({ lock: 2, unlock: 1 });

    unmount();
    expect(calls).toEqual({ lock: 2, unlock: 2 });
  });
});
