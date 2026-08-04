import { describe, it, expect } from 'vitest';
import {
  fireAlphaFor, nodeLabelState, clusterLabelState, fireExpired,
  FIRE_EXPIRY, CLUSTER_LABEL_MIN_Z,
} from '../artLabels';

const projected = { sx: 100, sy: 200, scale: 1, depth: 0.5 };
const node = { id: 'n1', label: 'KERNEL', energy: 0 };

describe('fireAlphaFor', () => {
  it('is silent before the stagger delay elapses', () => {
    // neighbours at index 1 wait 0.08 + 1*0.025 = 0.105s
    expect(fireAlphaFor({ elapsed: 0.05, isSeed: false, index: 1 })).toBe(0);
  });

  it('gives the seed no delay', () => {
    expect(fireAlphaFor({ elapsed: 0.001, isSeed: true, index: 0 })).toBeGreaterThan(0);
  });

  it('eases in over the first 0.35s', () => {
    const half = fireAlphaFor({ elapsed: 0.175, isSeed: true, index: 0 });
    expect(half).toBeCloseTo(0.5 * 0.95, 5);
  });

  it('holds at full between 0.35s and 2.5s', () => {
    expect(fireAlphaFor({ elapsed: 1.0, isSeed: true, index: 0 })).toBeCloseTo(0.95, 5);
  });

  it('scales neighbours below the seed', () => {
    expect(fireAlphaFor({ elapsed: 1.0, isSeed: false, index: 0 })).toBeCloseTo(0.80, 5);
  });

  it('fades out between 2.5s and 3.5s and is zero after', () => {
    expect(fireAlphaFor({ elapsed: 3.0, isSeed: true, index: 0 })).toBeCloseTo(0.5 * 0.95, 5);
    expect(fireAlphaFor({ elapsed: 3.6, isSeed: true, index: 0 })).toBe(0);
  });
});

describe('fireExpired', () => {
  it('expires past 3.8s', () => {
    expect(FIRE_EXPIRY).toBe(3.8);
    expect(fireExpired(3.7)).toBe(false);
    expect(fireExpired(3.9)).toBe(true);
  });
});

describe('nodeLabelState', () => {
  const base = {
    node, projected, index: 0, isHovered: false,
    fired: null, elapsed: 0, depthAlpha: 1, radius: 6,
  };

  it('returns null when no visibility source is active', () => {
    expect(nodeLabelState(base)).toBeNull();
  });

  it('shows on hover at 0.92 alpha and full font weight', () => {
    const s = nodeLabelState({ ...base, isHovered: true });
    expect(s.alpha).toBeCloseTo(0.92, 5);
    expect(s.fontSize).toBe(10);
    expect(s.text).toBe('KERNEL');
  });

  it('shows on high energy above the 0.45 threshold', () => {
    expect(nodeLabelState({ ...base, node: { ...node, energy: 0.45 } })).toBeNull();
    const s = nodeLabelState({ ...base, node: { ...node, energy: 0.9 } });
    expect(s).not.toBeNull();
    expect(s.fontSize).toBe(8);
  });

  it('suppresses the energy source behind the sphere', () => {
    const behind = { ...projected, depth: -0.5 };
    expect(nodeLabelState({
      ...base, node: { ...node, energy: 0.9 }, projected: behind,
    })).toBeNull();
  });

  it('positions above the node by its radius plus 4', () => {
    const s = nodeLabelState({ ...base, isHovered: true });
    expect(s.x).toBe(100);
    expect(s.y).toBe(200 - 6 - 4);
  });

  it('scales the font by the projected scale', () => {
    const s = nodeLabelState({
      ...base, isHovered: true, projected: { ...projected, scale: 2 },
    });
    expect(s.fontSize).toBe(20);
  });

  it('takes the brightest of the competing sources', () => {
    // hover 0.92 beats energy 0.9*0.8 = 0.72
    const s = nodeLabelState({
      ...base, isHovered: true, node: { ...node, energy: 0.9 },
    });
    expect(s.alpha).toBeCloseTo(0.92, 5);
  });

  it('dims non-hover labels to 0.82 of their alpha', () => {
    const s = nodeLabelState({ ...base, node: { ...node, energy: 1.0 } });
    expect(s.alpha).toBeCloseTo(1.0 * 0.80 * 0.82, 5);
  });

  it('shows a fired neighbour via the cascade', () => {
    const fired = { seedId: 'other', neighborIds: new Set(['n1']) };
    const s = nodeLabelState({ ...base, fired, elapsed: 1.0 });
    expect(s).not.toBeNull();
    expect(s.fontSize).toBe(9);
  });

  it('ignores nodes outside the fired neighbour set', () => {
    const fired = { seedId: 'other', neighborIds: new Set(['somethingelse']) };
    expect(nodeLabelState({ ...base, fired, elapsed: 1.0 })).toBeNull();
  });

  it('applies depth alpha to the fire source', () => {
    const fired = { seedId: 'n1', neighborIds: new Set(['n1']) };
    const lit = nodeLabelState({ ...base, fired, elapsed: 1.0, depthAlpha: 1 });
    const dim = nodeLabelState({ ...base, fired, elapsed: 1.0, depthAlpha: 0.5 });
    expect(dim.alpha).toBeCloseTo(lit.alpha * 0.5, 5);
  });
});

describe('clusterLabelState', () => {
  it('hides labels on the back face', () => {
    expect(CLUSTER_LABEL_MIN_Z).toBe(-0.2);
    expect(clusterLabelState({ rz: -0.3, projected, text: 'eco' })).toBeNull();
  });

  it('uppercases and scales alpha by rz', () => {
    const s = clusterLabelState({ rz: 0.5, projected, text: 'eco' });
    expect(s.text).toBe('ECO');
    expect(s.alpha).toBeCloseTo(0.5 * 0.12, 5);
    expect(s.fontSize).toBe(9);
  });

  it('floors alpha at zero within the visible band', () => {
    const s = clusterLabelState({ rz: -0.1, projected, text: 'eco' });
    expect(s.alpha).toBe(0);
  });

  it('offsets upward by 52 times the projected scale', () => {
    const s = clusterLabelState({
      rz: 0.5, projected: { ...projected, scale: 0.5 }, text: 'eco',
    });
    expect(s.y).toBe(200 - 26);
  });
});
