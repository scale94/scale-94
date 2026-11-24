// Thin harness: SolTab's onSnap, captured through a stubbed useSolStar. No WebGL mounted.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { subscribe, _resetForTests as resetBus } from '../../../observatory/observatoryBus';
import { _resetCloudsForTests } from '../../sol/cloudStore';

let captured = null;
vi.mock('../../sol/useSolStar', () => ({
  useSolStar: (opts) => {
    captured = opts;
    return { uniforms: () => null, hud: () => ({ tensionG: 0 }), handlers: {} };
  },
}));
vi.mock('../../sol/SolCanvas', () => ({ default: () => null }));
vi.mock('../../sol/SolHud', () => ({ default: () => null }));

import SolTab from '../SolTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root; let events; let off;

beforeEach(() => {
  resetBus();
  _resetCloudsForTests();
  events = [];
  off = subscribe(e => events.push(e));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<SolTab />); });
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  off();
  resetBus();
  _resetCloudsForTests();
});

const releases = () => events.filter(e => e.category === 'gaze' && e.kind === 'sol_release');

describe('SolTab — release on the bus', () => {
  it('release_tags_hand_origin', () => {
    act(() => { captured.onSnap({ lat: 0, lon: 0, energyErg: 5e32, handedness: 'cw', origin: 'star', facing: false }); });
    act(() => { captured.onSnap({ lat: 0, lon: 0, energyErg: 7e32, handedness: 'ccw', origin: 'hand', facing: true }); });
    const r = releases();
    expect(r).toHaveLength(2);
    expect(r[0].payload).toEqual({ energyErg: 5e32, handedness: 'cw', hand: false });
    expect(r[1].payload).toEqual({ energyErg: 7e32, handedness: 'ccw', hand: true });
  });
});
