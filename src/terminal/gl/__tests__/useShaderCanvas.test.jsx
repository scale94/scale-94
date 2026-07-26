import React, { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';
import { useShaderCanvas } from '../useShaderCanvas';

// Order-recording spies for the teardown-ordering test below. These wrap the
// real createShaderHost/createFrameLoop (delegating to the actual
// implementation) and just append to `callOrder` whenever `dispose`/`stop`
// run, so every test in this file is unaffected functionally — only the one
// test that reads `callOrder` cares that the entries exist.
const { callOrder } = vi.hoisted(() => ({ callOrder: [] }));

vi.mock('../glHost', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createShaderHost: (...args) => {
      const host = actual.createShaderHost(...args);
      if (!host) return host;
      return {
        ...host,
        dispose: (...a) => {
          callOrder.push('dispose');
          return host.dispose(...a);
        },
      };
    },
  };
});

vi.mock('../frameLoop', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createFrameLoop: (...args) => {
      const loop = actual.createFrameLoop(...args);
      return {
        ...loop,
        stop: (...a) => {
          callOrder.push('stop');
          return loop.stop(...a);
        },
      };
    },
  };
});

afterEach(cleanup);

function Probe({ onReady, ...opts }) {
  const ref = useRef(null);
  const api = useShaderCanvas(ref, {
    version: 1, strategy: 'legacy', vs: 'VS', fs: 'FS',
    uniforms: ['u_t'], pixelSize: 64,
    draw: () => {}, deps: [],
    ...opts,
  });
  onReady?.(api);
  return <canvas ref={ref} />;
}

describe('useShaderCanvas', () => {
  it('calls onUnsupported and never draws when there is no context', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    const onUnsupported = vi.fn();
    const draw = vi.fn();
    render(<Probe onUnsupported={onUnsupported} draw={draw} />);
    expect(onUnsupported).toHaveBeenCalledOnce();
    expect(draw).not.toHaveBeenCalled();
    HTMLCanvasElement.prototype.getContext = original;
  });

  it('calls onUnsupported and never draws when createShaderHost throws (lunar compile failure)', () => {
    const rec = installRecordingGL({ version: 2 });
    const original = rec.gl.getShaderParameter;
    rec.gl.getShaderParameter = () => false; // simulate a driver compile failure
    const onUnsupported = vi.fn();
    const draw = vi.fn();
    render(<Probe strategy="lunar" version={2} onUnsupported={onUnsupported} draw={draw} />);
    expect(onUnsupported).toHaveBeenCalledOnce();
    expect(draw).not.toHaveBeenCalled();
    rec.gl.getShaderParameter = original;
    rec.restore();
  });

  it('draws once synchronously at tsec 0 when initialDraw is set', () => {
    const rec = installRecordingGL({ version: 1 });
    const seen = [];
    render(<Probe initialDraw draw={(_h, f) => seen.push(f.tsec)} />);
    expect(seen).toEqual([0]);
    rec.restore();
  });

  it('does not draw synchronously when initialDraw is false', () => {
    const rec = installRecordingGL({ version: 1 });
    const draw = vi.fn();
    render(<Probe initialDraw={false} draw={draw} />);
    expect(draw).not.toHaveBeenCalled();
    rec.restore();
  });

  it('disposes the host on unmount', () => {
    const rec = installRecordingGL({ version: 1 });
    const { unmount } = render(<Probe />);
    unmount();
    expect(rec.log.map(e => e[0])).toContain('deleteProgram');
    expect(rec.log.map(e => e[0])).toContain('loseContext');
    rec.restore();
  });

  it('snap() invokes onSnap only under reduced motion', () => {
    const rec = installRecordingGL({ version: 1 });
    const onSnap = vi.fn();
    let api;
    // jsdom does not implement matchMedia at all, so it must exist as a
    // function before vi.spyOn can wrap it.
    if (typeof window.matchMedia !== 'function') window.matchMedia = () => ({ matches: false });
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    render(<Probe onSnap={onSnap} onReady={(a) => { api = a; }} />);
    api.snap();
    expect(onSnap).not.toHaveBeenCalled();

    window.matchMedia.mockReturnValue({ matches: true });
    cleanup();
    render(<Probe onSnap={onSnap} onReady={(a) => { api = a; }} />);
    api.snap();
    expect(onSnap).toHaveBeenCalledOnce();

    window.matchMedia.mockRestore();
    rec.restore();
  });

  it('stops the loop before disposing the host on unmount (teardown order)', () => {
    // Falsifiable: swapping the two lines in the cleanup (dispose before
    // stop) makes this test fail while every other test in this file still
    // passes — that gap is exactly why this test exists.
    const rec = installRecordingGL({ version: 1 });
    const { unmount } = render(<Probe />);
    callOrder.length = 0; // drop mount-time noise; only the unmount order matters here
    unmount();
    expect(callOrder).toEqual(['stop', 'dispose']);
    rec.restore();
  });

  it('rebuilds the host when deps change', () => {
    const rec = installRecordingGL({ version: 1 });
    const draw = vi.fn();
    const { rerender } = render(<Probe draw={draw} deps={[1]} />);
    const programsAfterMount = rec.log.filter((e) => e[0] === 'createProgram').length;
    expect(programsAfterMount).toBe(1);
    expect(rec.log.map((e) => e[0])).not.toContain('deleteProgram');

    rerender(<Probe draw={draw} deps={[2]} />);

    // The old host must be torn down and a distinct new one built — not
    // reused — when deps changes.
    expect(rec.log.filter((e) => e[0] === 'deleteProgram').length).toBe(1);
    expect(rec.log.filter((e) => e[0] === 'createProgram').length).toBe(2);

    rerender(<Probe draw={draw} deps={[2]} />);

    // Re-rendering with the SAME deps value must not rebuild.
    expect(rec.log.filter((e) => e[0] === 'deleteProgram').length).toBe(1);
    expect(rec.log.filter((e) => e[0] === 'createProgram').length).toBe(2);

    rec.restore();
  });
});
