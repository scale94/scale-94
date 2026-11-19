// SolTab and the cloud store: facing snaps launch clouds; statuses follow the wall clock.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, screen, fireEvent } from '@testing-library/react';
import { getClouds, launchCloud, _resetCloudsForTests, STORAGE_KEY } from '../cloudStore';
import { formatClock } from '../hudFormat';

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
  it('a facing snap launches one cloud and shows its stack: neutrinos and light at 00:08:19', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    expect(getClouds()).toHaveLength(1);
    expect(getClouds()[0]).toMatchObject({ energyErg: 5e32, handedness: 'cw', origin: 'hand', launchedAt: T0 });
    const rows = screen.getAllByTestId('sol-stack-row');
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain('NEUTRINOS');
    expect(rows[0].textContent).toContain('00:08:19');
    expect(rows[1].textContent).toContain('LIGHT');
    expect(rows[1].textContent).toContain('00:08:19');
    expect(rows[3].textContent).toContain('17:36:00');
    expect(rows[3].textContent).toContain('unread');
    expect(screen.queryAllByTestId('sol-cloud')).toHaveLength(0);   // the stacked cloud is not also a compact row
  });

  it('after 499 s the light has arrived', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { vi.advanceTimersByTime(499000); });
    const rows = screen.getAllByTestId('sol-stack-row');
    expect(rows[1].textContent).toContain('arrived · 8 min 19 s old');
  });

  it('a snap that does not face the viewer launches nothing and shows no stack', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: false }); });
    expect(getClouds()).toHaveLength(0);
    expect(screen.queryAllByTestId('sol-cloud')).toHaveLength(0);
    expect(screen.queryAllByTestId('sol-stack-row')).toHaveLength(0);
  });

  it('the eta counts down once a second', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('17:35:57');
  });

  it('other clouds in flight are compact rows; clicking one stacks it', () => {
    render(<SolTab />);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });
    act(() => { vi.advanceTimersByTime(60000); });
    act(() => { captured.onSnap({ ...SNAP, handedness: 'ccw', facing: true }); });
    // the newest is stacked, the older one is a compact row
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('17:36:00');
    const compact = screen.getAllByTestId('sol-cloud');
    expect(compact).toHaveLength(1);
    expect(compact[0].tagName).toBe('BUTTON');
    expect(compact[0].textContent).toContain('17:35:00');
    act(() => { fireEvent.click(compact[0]); });
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('17:35:00');
    expect(screen.getAllByTestId('sol-cloud')[0].textContent).toContain('17:36:00');
  });

  it('a manual selection holds until the next launch, which takes the stack', () => {
    render(<SolTab />);
    const header = () => screen.getByTestId('sol-stack').firstChild.textContent;
    const clock = (t) => formatClock(t);
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });                       // A at T0
    act(() => { vi.advanceTimersByTime(60000); });
    act(() => { captured.onSnap({ ...SNAP, handedness: 'ccw', facing: true }); });    // B at T0+60 s
    expect(header()).toContain(clock(T0 + 60000));
    act(() => { fireEvent.click(screen.getAllByTestId('sol-cloud')[0]); });           // select A
    expect(header()).toContain(clock(T0));
    act(() => { vi.advanceTimersByTime(60000); });
    expect(header()).toContain(clock(T0));                                            // still A
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });                       // C at T0+120 s
    expect(header()).toContain(clock(T0 + 120000));
  });

  it('a selected cloud that vanishes from the store falls back to the newest, no crash', () => {
    render(<SolTab />);
    const header = () => screen.getByTestId('sol-stack').firstChild.textContent;
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });                       // A
    act(() => { vi.advanceTimersByTime(60000); });
    act(() => { captured.onSnap({ ...SNAP, facing: true }); });                       // B
    act(() => { fireEvent.click(screen.getAllByTestId('sol-cloud')[0]); });           // select A
    expect(header()).toContain(formatClock(T0));
    const onlyB = getClouds().filter((c) => c.launchedAt !== T0);
    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ clouds: onlyB }));
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));       // another tab dropped A
    });
    expect(screen.getAllByTestId('sol-stack-row')).toHaveLength(5);
    expect(header()).toContain(formatClock(T0 + 60000));
    expect(screen.queryAllByTestId('sol-cloud')).toHaveLength(0);
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
    expect(screen.queryAllByTestId('sol-landing')).toHaveLength(0);
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('arrived · northward · passed');
  });

  it('clouds already in the store show on mount, and a passed landing adds no aurora', () => {
    launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'star' }, T0 - 100 * H);
    render(<SolTab />);
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('arrived');
    expect(captured.effects.uAurora || 0).toBe(0);
  });

  it('a storm in progress raises the aurora smoothly and is witnessed while visible', () => {
    // a strong southward cloud, 6 h into its 12 h storm
    const c = launchCloud({ energyErg: 5e32, handedness: 'cw', origin: 'hand' }, T0 - (17.6 + 6) * H);
    setVisibility('visible');
    render(<SolTab />);
    expect(getClouds()[0].witnessed).toBe(true);
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toBe('CLOUD' + 'arrived · southward · coupled · −1200 nT');
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
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toBe('CLOUD' + 'arrived · unwitnessed');
  });

  it('the stacked landed cloud is not also listed as a landing line', () => {
    launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'hand' }, T0 - 200 * H);
    launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'hand' }, T0 - 100 * H);
    render(<SolTab />);
    // the newest (stacked) lands in the CLOUD row; only the older one is a line
    expect(screen.getAllByTestId('sol-landing')).toHaveLength(1);
    expect(screen.getAllByTestId('sol-stack-row')[3].textContent).toContain('arrived');
  });

  it('shows at most the three newest landings', () => {
    for (let i = 0; i < 5; i++) {
      launchCloud({ energyErg: 5e32, handedness: 'ccw', origin: 'hand' }, T0 - (100 + i) * H);
    }
    render(<SolTab />);
    expect(screen.getAllByTestId('sol-landing')).toHaveLength(3);
  });
});
