import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProtectionLevers } from '../ProtectionLevers';

const LEVERS = { toxicityCap: 0.6, sanctuary: 0.45, restoration: 0.7, nativeBio: 0.35 };

// jsdom gives every element a zero-width rect, which makes the lever's pointer
// math divide by zero. Give the track a real width.
const TRACK_RECT = { left: 0, top: 0, right: 200, bottom: 22, width: 200, height: 22, x: 0, y: 0 };

function grabTrack(label) {
  const track = screen.getByText(label).closest('.pl-row').querySelector('.pl-track');
  track.getBoundingClientRect = () => TRACK_RECT;
  return track;
}

describe('ProtectionLevers', () => {
  it('renders all four identity levers with their labels', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('TOXICITY_CAP')).toBeTruthy();
    expect(screen.getByText('SANCTUARY')).toBeTruthy();
    expect(screen.getByText('RESTORATION')).toBeTruthy();
    expect(screen.getByText('NATIVE_BIODIV')).toBeTruthy();
  });

  it('shows each lever value as a rounded 0-100 readout', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('60')).toBeTruthy();  // toxicityCap
    expect(screen.getByText('70')).toBeTruthy();  // restoration
  });

  it('marks the container gated when isGated is true', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={true} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).toContain('is-gated');
  });

  it('is not gated when isGated is false', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).not.toContain('is-gated');
  });

  it('tracks the pointer while dragging a lever', () => {
    const onChange = vi.fn();
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={onChange} />);

    fireEvent.pointerDown(grabTrack('SANCTUARY'), { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 150 });

    expect(onChange).toHaveBeenLastCalledWith('sanctuary', 0.75);
  });

  it('stops tracking the pointer once the drag ends', () => {
    const onChange = vi.fn();
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={onChange} />);

    fireEvent.pointerDown(grabTrack('SANCTUARY'), { clientX: 100 });
    fireEvent.pointerUp(window);
    onChange.mockClear();
    fireEvent.pointerMove(window, { clientX: 150 });

    expect(onChange).not.toHaveBeenCalled();
  });

  // Switching tabs mid-drag unmounts the levers. The window listeners must go
  // with them — otherwise every later pointer move dereferences a detached ref
  // and throws for the rest of the session.
  it('releases its window pointer listeners when unmounted mid-drag', () => {
    const onChange = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={onChange} />);

    fireEvent.pointerDown(grabTrack('RESTORATION'), { clientX: 100 });
    const added = addSpy.mock.calls.filter(([t]) => t.startsWith('pointer'));
    expect(added.length).toBeGreaterThan(0);

    unmount();

    const removed = removeSpy.mock.calls.filter(([t]) => t.startsWith('pointer'));
    for (const [type, fn] of added) {
      expect(removed.some(([t, f]) => t === type && f === fn)).toBe(true);
    }

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
