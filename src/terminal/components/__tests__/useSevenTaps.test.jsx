import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSevenTaps } from '../useSevenTaps';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, api;
function Probe({ onSingleTap, onUnlock }) {
  api = useSevenTaps({ onSingleTap, onUnlock });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.useRealTimers();
});

function mount(cbs) { act(() => { root.render(<Probe {...cbs} />); }); }
function tap() { act(() => { api.onTap(); }); }

describe('useSevenTaps', () => {
  it('single tap navigates after the settle, never unlocks', () => {
    const onSingleTap = vi.fn(), onUnlock = vi.fn();
    mount({ onSingleTap, onUnlock });
    tap();
    expect(onSingleTap).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(280); });
    expect(onSingleTap).toHaveBeenCalledTimes(1);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('seven rapid taps unlock and do NOT navigate', () => {
    const onSingleTap = vi.fn(), onUnlock = vi.fn();
    mount({ onSingleTap, onUnlock });
    for (let i = 0; i < 7; i++) tap();
    expect(onUnlock).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(500); });
    expect(onSingleTap).not.toHaveBeenCalled();
    expect(api.toast).toMatchObject({ text: '☿ compiled fairytale castle on mercury', bright: true });
  });

  it('countdown copy is exact at 3..6 taps', () => {
    mount({});
    tap(); tap();                       // n=2, no toast
    expect(api.toast).toBeNull();
    tap(); expect(api.toast.text).toBe('4 · the surface is thinning');   // n=3
    tap(); expect(api.toast.text).toBe('3 · past the theme layer');      // n=4
    tap(); expect(api.toast.text).toBe('2 · the god caste ends here');   // n=5
    tap(); expect(api.toast.text).toBe('1 · one tap from bare metal');   // n=6
  });

  it('abandoned 3-tap burst never navigates or unlocks', () => {
    const onSingleTap = vi.fn(), onUnlock = vi.fn();
    mount({ onSingleTap, onUnlock });
    tap(); tap(); tap();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onSingleTap).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('taps outside the 3s window do not accumulate to unlock', () => {
    const onUnlock = vi.fn();
    mount({ onUnlock });
    for (let i = 0; i < 4; i++) tap();
    act(() => { vi.advanceTimersByTime(3100); });   // window expires
    for (let i = 0; i < 4; i++) tap();
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
