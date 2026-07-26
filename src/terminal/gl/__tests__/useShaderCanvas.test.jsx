import React, { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';
import { useShaderCanvas } from '../useShaderCanvas';

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
});
