// SolTab wiring: a snap reaches the effects, the shake and the HUD.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, screen } from '@testing-library/react';

const captured = {};

vi.mock('../useSolStar', () => ({
  useSolStar: ({ onSnap, reducedMotion, requestDraw } = {}) => {
    captured.onSnap = onSnap;
    captured.hookReducedMotion = reducedMotion;
    captured.hookRequestDraw = requestDraw;
    if (!captured.star) {
      captured.star = {
        frame: () => {},
        uniforms: () => ({ uCamYaw: 0, uCamPitch: 0, uRotLon: 0 }),
        handlers: {},
        hud: () => ({ tensionG: 1234.4 }),
      };
    }
    return captured.star;
  },
}));

vi.mock('../SolCanvas', () => {
  function MockSolCanvas(props) {
    captured.effects = props.effects;
    captured.onFrame = props.onFrame;
    captured.canvasReducedMotion = props.reducedMotion;
    const { onReady } = props;
    React.useEffect(() => {
      if (!captured.requestDraw) captured.requestDraw = vi.fn();
      onReady?.({ requestDraw: captured.requestDraw });
    }, [onReady]);
    return <canvas data-testid="sol-canvas" />;
  }
  return { default: MockSolCanvas };
});

const { default: SolTab } = await import('../../views/SolTab');

// A controllable prefers-reduced-motion query with change listeners.
function mockReducedMotion(initial) {
  const listeners = new Set();
  const mql = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_t, f) => listeners.add(f),
    removeEventListener: (_t, f) => listeners.delete(f),
  };
  const original = window.matchMedia;
  window.matchMedia = () => mql;
  return {
    set(v) { mql.matches = v; for (const f of [...listeners]) f({ matches: v }); },
    listeners,
    restore() { window.matchMedia = original; },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  for (const k of Object.keys(captured)) delete captured[k];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const SNAP = { regionId: 1, lat: 0, lon: 0, turns: 6, energyErg: 5e32, handedness: 'cw', origin: 'hand' };

describe('SolTab wiring', () => {
  it('polls tension into the HUD as an integer', () => {
    render(<SolTab />);
    act(() => { vi.advanceTimersByTime(150); });
    expect(screen.getByTestId('sol-hud').textContent).toContain('1234 G');
    expect(screen.getByTestId('sol-hud').textContent).not.toContain('erg');
  });

  it('a facing snap: halo runs, the wrapper shakes, the HUD shows the release and the light line for 20 s', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { captured.onFrame(0.05); });
    expect(captured.effects.uHalo).toBeGreaterThan(0);
    expect(captured.effects.uPlume).toBe(0);
    expect(captured.effects.uFlash).toBeGreaterThan(0);
    const wrap = screen.getByTestId('sol-canvas').parentElement;
    expect(wrap.style.transform).toContain('translate3d');
    const hud = screen.getByTestId('sol-hud');
    expect(hud.textContent).toContain('5.0e32 erg');
    expect(hud.textContent).toContain('LIGHT · 8 min 19 s OLD');

    act(() => { captured.onFrame(1.0); });
    expect(wrap.style.transform).toBe('');
    act(() => { vi.advanceTimersByTime(19000); });
    expect(hud.textContent).toContain('8 min 19 s');
    act(() => { vi.advanceTimersByTime(1100); });
    expect(hud.textContent).not.toContain('8 min 19 s');
    expect(hud.textContent).toContain('5.0e32 erg');
  });

  it('a limb snap runs the plume, along the view normal', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, lon: Math.PI / 2, facing: false }); });
    act(() => { captured.onFrame(0.3); });
    expect(captured.effects.uPlume).toBeGreaterThan(0);
    expect(captured.effects.uHalo).toBe(0);
    expect(captured.effects.uPlumeDir[0]).toBeGreaterThan(0.9);
  });

  describe('reduced motion', () => {
    let rm;
    afterEach(() => rm?.restore());

    it('reaches the hook and the canvas, and follows the OS setting live', () => {
      rm = mockReducedMotion(false);
      render(<SolTab />);
      expect(captured.hookReducedMotion).toBe(false);
      expect(captured.canvasReducedMotion).toBe(false);
      act(() => rm.set(true));
      expect(captured.hookReducedMotion).toBe(true);
      expect(captured.canvasReducedMotion).toBe(true);
      act(() => rm.set(false));
      expect(captured.hookReducedMotion).toBe(false);
    });

    it('a snap is one still frame, no shake, held 1.2 s then cleared; the hook draws through the canvas', () => {
      rm = mockReducedMotion(true);
      render(<SolTab />);
      captured.hookRequestDraw();
      expect(captured.requestDraw).toHaveBeenCalledTimes(1);
      captured.requestDraw.mockClear();
      act(() => { captured.onSnap({ ...SNAP, facing: true }); });
      expect(captured.effects.uFlash).toBeGreaterThan(0.5);
      expect(captured.effects.uHalo).toBe(0.35);
      expect(captured.effects.uShock).toBe(0.4);
      expect(captured.effects.uPlume).toBe(0);
      expect(Array.from(captured.effects.shake)).toEqual([0, 0]);
      expect(captured.requestDraw).toHaveBeenCalled();
      const wrap = screen.getByTestId('sol-canvas').parentElement;
      expect(wrap.style.transform).toBe('');
      const hud = screen.getByTestId('sol-hud');
      expect(hud.textContent).toContain('5.0e32 erg');
      expect(hud.textContent).toContain('8 min 19 s');
      captured.requestDraw.mockClear();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(captured.effects.uHalo).toBe(0.35);
      // a newer snap restarts the hold
      act(() => { captured.onSnap({ ...SNAP, lon: Math.PI / 2, facing: false }); });
      act(() => { vi.advanceTimersByTime(1000); });
      expect(captured.effects.uPlume).toBe(0.35);
      captured.requestDraw.mockClear();
      act(() => { vi.advanceTimersByTime(300); });
      for (const k of ['uFlash', 'uShock', 'uPlume', 'uHalo']) expect(captured.effects[k]).toBe(0);
      expect(captured.requestDraw).toHaveBeenCalledTimes(1);
    });

    it('unmount leaves no timer or media listener behind', () => {
      rm = mockReducedMotion(true);
      const { unmount } = render(<SolTab />);
      act(() => { captured.onSnap({ ...SNAP, facing: true }); });
      expect(rm.listeners.size).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      expect(rm.listeners.size).toBe(0);
    });
  });

  it('a pane hidden mid-shake clears the offset', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { captured.onFrame(0.05); });
    const wrap = screen.getByTestId('sol-canvas').parentElement;
    expect(wrap.style.transform).toContain('translate3d');
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(wrap.style.transform).toBe('');
    } finally {
      delete document.hidden;
      if (desc) Object.defineProperty(Document.prototype, 'hidden', desc);
    }
  });
});
