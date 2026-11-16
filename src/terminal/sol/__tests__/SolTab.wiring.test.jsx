// SolTab wiring: a snap reaches the effects, the shake and the HUD.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, screen } from '@testing-library/react';

const captured = {};

vi.mock('../useSolStar', () => ({
  useSolStar: ({ onSnap } = {}) => {
    captured.onSnap = onSnap;
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

vi.mock('../SolCanvas', () => ({
  default: (props) => {
    captured.effects = props.effects;
    captured.onFrame = props.onFrame;
    return <canvas data-testid="sol-canvas" />;
  },
}));

const { default: SolTab } = await import('../../views/SolTab');

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
});
