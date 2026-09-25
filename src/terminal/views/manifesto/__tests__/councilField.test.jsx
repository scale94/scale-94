import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { driveFrames } from '../../../gl/__tests__/driveFrames';
import { installRecordingGL } from '../../../gl/__tests__/recordingGL';
import CouncilField from '../CouncilField';

const SEATED = [
  { dimIndex: 3, angle: 270, hue: '#FF0088' },
  { dimIndex: 9, angle: 90, hue: '#00FFAA' },
];
const FLASH = {
  sim: { phase: 'FLASH', t0: 0, pair: [0, 1], isUser: true, product: { angle: 90, targetR: 318, boundaryR: 290, color: '#00FFAA' } },
  ui: { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null },
};

function refs({ sim, ui }) {
  return {
    simRef: { current: { t0: 0, pair: null, product: null, ordinal: 0, particles: [], userPair: null, ...sim } },
    uiRef: { current: ui },
    pointerRef: { current: null },
  };
}

function drive(state = FLASH, frames = 3) {
  const r = refs(state);
  return driveFrames(() => {
    const out = render(
      <CouncilField {...r} seated={SEATED} mode={state.ui.mode} onLiveChange={() => {}} />,
    );
    return { unmount: out.unmount, rerender: out.rerender };
  }, { frames, version: 2 });
}

function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// Texture uploads serialise to megabytes; freeze them as length + hash.
const compact = (lines) => lines.map((l) => (l.length > 400 ? `${l.slice(0, l.indexOf('('))}(#${l.length}:${fnv(l)})` : l));

describe('CouncilField GL traffic (spec §8, §10.6)', () => {
  it('uploads two R16F lookup tables and one R8 matter texture at init', () => {
    const tex = drive().init.filter((l) => l.startsWith('texImage2D('));
    expect(tex).toHaveLength(3);
    expect(tex.filter((l) => l.startsWith(`texImage2D(${0x0de1}, 0, ${0x822d},`))).toHaveLength(2);
    expect(tex.filter((l) => l.startsWith(`texImage2D(${0x0de1}, 0, ${0x8229},`))).toHaveLength(1);
  });

  it('draws one full-screen pass per frame into a cleared transparent target', () => {
    const { frames } = drive();
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(3);
    expect(frames.filter((l) => l === 'clearColor(0, 0, 0, 0)')).toHaveLength(3);
  });

  it('binds the three samplers to units 0, 1, 2', () => {
    const { frames } = drive();
    expect(frames.some((l) => /^uniform1i\(".*:u_geodesic", 0\)$/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform1i\(".*:u_deflect", 1\)$/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform1i\(".*:u_matter", 2\)$/.test(l))).toBe(true);
  });

  it('draws nothing while the canvas is scrolled off-screen, and disconnects on unmount', () => {
    const observed = [];
    let disconnected = 0;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb) { this.cb = cb; }
      observe(el) { observed.push(el); this.cb([{ target: el, isIntersecting: false }], this); }
      disconnect() { disconnected += 1; }
    });
    try {
      const { frames } = drive();
      expect(observed).toHaveLength(1);
      expect(observed[0].dataset.testid).toBe('council-field');
      expect(frames.filter((l) => l.startsWith('drawArrays('))).toHaveLength(0);
      expect(disconnected).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('freezes the init + FLASH frame call log', () => {
    const { init, frames } = drive();
    expect({ init: compact(init), frames: compact(frames) }).toMatchSnapshot();
  });
});

describe('CouncilField liveness', () => {
  it('reports live when WebGL2 exists', () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      const spy = vi.fn();
      const r = refs(FLASH);
      const { unmount } = render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={spy} />);
      expect(spy).toHaveBeenLastCalledWith(true);
      unmount();
    } finally {
      rec.restore();
    }
  });

  it('reports not-live when the context is lost, and stops listening on unmount', () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      const spy = vi.fn();
      const r = refs(FLASH);
      const { getByTestId, unmount } = render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={spy} />);
      const canvas = getByTestId('council-field');
      expect(spy).toHaveBeenLastCalledWith(true);
      canvas.dispatchEvent(new Event('webglcontextlost'));
      expect(spy).toHaveBeenLastCalledWith(false);
      unmount();
      spy.mockClear();
      canvas.dispatchEvent(new Event('webglcontextlost'));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      rec.restore();
    }
  });

  it('paints the reduced-motion snap at t = 0 (spec §8)', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const rec = installRecordingGL({ version: 2 });
    try {
      const r = refs(FLASH);
      const { unmount } = render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={() => {}} />);
      const times = rec.log.filter(([name, loc]) => name === 'uniform1f' && /:u_time$/.test(loc?.__tag ?? loc));
      expect(times.length).toBeGreaterThan(0);
      for (const [, , value] of times) expect(value).toBe(0);
      unmount();
    } finally {
      rec.restore();
      vi.unstubAllGlobals();
    }
  });

  it('reports not-live, and owns no GL, when WebGL2 is unavailable', () => {
    const spy = vi.fn();
    const r = refs(FLASH);
    render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={spy} />);
    expect(spy).toHaveBeenLastCalledWith(false);
    expect(spy).not.toHaveBeenCalledWith(true);
  });
});
