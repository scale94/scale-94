// SolTab and the cloud store: facing snaps launch clouds; statuses follow the wall clock.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, screen } from '@testing-library/react';
import { getClouds, launchCloud, _resetCloudsForTests } from '../cloudStore';

const captured = {};

vi.mock('../useSolStar', () => ({
  useSolStar: ({ onSnap } = {}) => {
    captured.onSnap = onSnap;
    if (!captured.star) {
      captured.star = {
        frame: () => {},
        uniforms: () => ({ uCamYaw: 0, uCamPitch: 0, uRotLon: 0 }),
        handlers: {},
        hud: () => ({ tensionG: 300 }),
      };
    }
    return captured.star;
  },
}));

vi.mock('../SolCanvas', () => {
  function MockSolCanvas(props) {
    captured.effects = props.effects;
    captured.onFrame = props.onFrame;
    return <canvas data-testid="sol-canvas" />;
  }
  return { default: MockSolCanvas };
});

const { default: SolTab } = await import('../../views/SolTab');

const H = 3600e3;
const T0 = Date.UTC(2026, 10, 17, 12, 0, 0);
const SNAP = { regionId: 1, lat: 0, lon: 0, turns: 6, energyErg: 5e32, handedness: 'cw', origin: 'hand' };

const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  _resetCloudsForTests();
  for (const k of Object.keys(captured)) delete captured[k];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.visibilityState;
  delete document.hidden;
});

describe('SolTab clouds', () => {
  it('a facing snap launches one cloud and shows it in flight, unread', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    expect(getClouds()).toHaveLength(1);
    expect(getClouds()[0]).toMatchObject({ energyErg: 5e32, handedness: 'cw', origin: 'hand', launchedAt: T0 });
    const rows = screen.getAllByTestId('sol-cloud');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('17:36:00');
    expect(rows[0].textContent).toContain('unread');
  });

  it('a snap that does not face the viewer launches nothing', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: false }); });
    expect(getClouds()).toHaveLength(0);
    expect(screen.queryAllByTestId('sol-cloud')).toHaveLength(0);
  });

  it('the eta counts down once a second', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('sol-cloud').textContent).toContain('17:35:57');
  });

  it('returning to the page re-reads the wall clock: 20 h later the cloud has landed', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, handedness: 'ccw', facing: true }); });
    act(() => {
      setVisibility('hidden');
      vi.setSystemTime(T0 + 20 * H);
      setVisibility('visible');
    });
    expect(screen.queryAllByTestId('sol-cloud')).toHaveLength(0);
    expect(screen.getAllByTestId('sol-landing').map((n) => n.textContent))
      .toEqual(['arrived · northward · passed']);
  });

  it('clouds already in the store show on mount, and a passed landing adds no aurora', () => {
    launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'star' }, T0 - 100 * H);
    render(<SolTab />);
    expect(screen.getAllByTestId('sol-landing')).toHaveLength(1);
    expect(captured.effects.uAurora || 0).toBe(0);
  });

  it('a storm in progress raises the aurora smoothly and is witnessed while visible', () => {
    // a strong southward cloud, 6 h into its 12 h storm
    const c = launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, T0 - (17.6 + 6) * H);
    setVisibility('visible');
    render(<SolTab />);
    expect(getClouds()[0].witnessed).toBe(true);
    expect(screen.getAllByTestId('sol-landing')[0].textContent).toBe('arrived · southward · coupled · −1200 nT');
    act(() => { captured.onFrame(1 / 60); });
    const early = captured.effects.uAurora;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.05);
    act(() => { for (let i = 0; i < 60 * 20; i++) captured.onFrame(1 / 60); });
    expect(captured.effects.uAurora).toBeCloseTo(1, 3);
    expect(captured.effects.uAuroraRed).toBeCloseTo(1, 3);
    expect(c.id).toBe(getClouds()[0].id);
  });

  it('a storm on a hidden page is not witnessed', () => {
    launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, T0 - (17.6 + 6) * H);
    setVisibility('hidden');
    render(<SolTab />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(getClouds()[0].witnessed).toBe(false);
    act(() => { setVisibility('visible'); });
    expect(getClouds()[0].witnessed).toBe(true);
  });

  it('a storm closed while away lands unwitnessed, with no aurora', () => {
    launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, T0 - 40 * H);
    render(<SolTab />);
    act(() => { for (let i = 0; i < 600; i++) captured.onFrame(1 / 60); });
    expect(captured.effects.uAurora).toBe(0);
    expect(screen.getByTestId('sol-landing').textContent).toBe('arrived · unwitnessed');
  });

  it('shows at most the three newest landings', () => {
    for (let i = 0; i < 5; i++) {
      launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'hand' }, T0 - (100 + i) * H);
    }
    render(<SolTab />);
    expect(screen.getAllByTestId('sol-landing')).toHaveLength(3);
  });
});
