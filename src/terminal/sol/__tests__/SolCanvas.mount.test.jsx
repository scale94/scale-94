// SolCanvas mounts on the shared harness without a GPU (recording GL stub).
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, renderHook, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import SolCanvas from '../SolCanvas';
import { useSolStar } from '../useSolStar';
import { SOL_FS, SOL_UNIFORMS, OMEGA_POLE_K } from '../solShader';
import { omega, OMEGA_EQ } from '../regions';
import { glf } from '../../gl/glf';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// The last value uploaded to a scalar uniform, by name.
const lastUniform = (log, name) => {
  const hits = log.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(`:${name}`));
  return hits.length ? hits[hits.length - 1][2] : undefined;
};

function stubRaf() {
  const q = [];
  vi.stubGlobal('requestAnimationFrame', (cb) => { q.push(cb); return q.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return { flush() { const cbs = q.splice(0); for (const cb of cbs) cb(16); } };
}

function withReducedMotion(fn) {
  if (typeof window.matchMedia !== 'function') window.matchMedia = () => ({ matches: false });
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true });
  try { return fn(); } finally { window.matchMedia = original; }
}

describe('SolCanvas mount', () => {
  it('mounts, compiles one program, draws exactly one frame under reduced motion, unmounts', () => {
    withReducedMotion(() => {
      const rec = installRecordingGL({ version: 2 });
      try {
        const { result } = renderHook(() => useSolStar());
        const { unmount } = render(<SolCanvas star={result.current} />);
        expect(rec.log.filter((e) => e[0] === 'createProgram')).toHaveLength(1);
        expect(rec.log.filter((e) => e[0] === 'linkProgram')).toHaveLength(1);
        expect(rec.log.filter((e) => e[0] === 'drawArrays')).toHaveLength(1);
        // every declared uniform is harvested
        const harvested = rec.log.filter((e) => e[0] === 'getUniformLocation').map((e) => e[2]);
        expect(harvested).toEqual(SOL_UNIFORMS);
        // no uploaded scalar or array value is NaN
        for (const e of rec.log) {
          if (!String(e[0]).startsWith('uniform')) continue;
          for (const v of e.slice(2).flat()) {
            if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
          }
        }
        expect(() => unmount()).not.toThrow();
        expect(rec.log.some((e) => e[0] === 'deleteProgram')).toBe(true);
      } finally {
        rec.restore();
      }
    });
  });

  it('the shader bakes the same differential rotation as regions.js', () => {
    expect(SOL_FS.startsWith('#version 300 es\n')).toBe(true);
    expect(SOL_FS).toContain(`const float OMEGA_EQ = ${glf(OMEGA_EQ)};`);
    expect(SOL_FS).toContain(`const float OMEGA_K = ${glf(OMEGA_POLE_K)};`);
    for (const lat of [0, 0.3, -0.7, 1.2]) {
      const s = Math.sin(lat);
      expect(OMEGA_EQ * (1 - OMEGA_POLE_K * s * s)).toBeCloseTo(omega(lat), 12);
    }
    for (const name of SOL_UNIFORMS) expect(SOL_FS).toContain(` ${name}`);
  });

  it('the shader reads uTime only through gT, which uStill freezes', () => {
    expect(SOL_FS.match(/\buTime\b/g)).toHaveLength(2); // the declaration and the gT line
    expect(SOL_FS).toContain('gT = uStill > 0.5 ? STILL_T : uTime;');
    // the reduced path really skips work: the 4th octave and the 2nd strand are branched out
    expect(SOL_FS).toContain('if (i == 3 && uQuality < Q_REDUCED) break;');
    expect(SOL_FS).toContain('if (strand2) {');
  });

  it('reduced motion: uploads uStill 1, hands out a coalesced on-demand draw, keeps the context on unmount', () => {
    withReducedMotion(() => {
      const raf = stubRaf();
      const rec = installRecordingGL({ version: 2 });
      try {
        const { result } = renderHook(() => useSolStar());
        let ready = null;
        const { unmount } = render(
          <SolCanvas star={result.current} reducedMotion onReady={(r) => { ready = r; }} />,
        );
        expect(lastUniform(rec.log, 'uStill')).toBe(1);
        expect(typeof ready?.requestDraw).toBe('function');
        const draws = () => rec.log.filter((e) => e[0] === 'drawArrays').length;
        const before = draws();
        ready.requestDraw();
        ready.requestDraw();
        raf.flush();
        expect(draws()).toBe(before + 1);
        unmount();
        expect(rec.log.some((e) => e[0] === 'loseContext')).toBe(false);
        for (const k of ['deleteProgram', 'deleteBuffer', 'deleteVertexArray']) {
          expect(rec.log.some((e) => e[0] === k)).toBe(true);
        }
      } finally {
        rec.restore();
      }
    });
  });

  it('a reduced-motion change rebuilds the host on the same live context', () => {
    stubRaf();
    const rec = installRecordingGL({ version: 2 });
    try {
      const { result } = renderHook(() => useSolStar());
      const { rerender } = render(<SolCanvas star={result.current} reducedMotion={false} />);
      expect(lastUniform(rec.log, 'uStill')).toBe(0);
      withReducedMotion(() => rerender(<SolCanvas star={result.current} reducedMotion />));
      expect(rec.log.filter((e) => e[0] === 'createProgram')).toHaveLength(2);
      expect(rec.log.some((e) => e[0] === 'loseContext')).toBe(false);
      expect(lastUniform(rec.log, 'uStill')).toBe(1);
    } finally {
      rec.restore();
    }
  });

  it('quality: full on a wide viewport, reduced on a phone-width one', () => {
    const w0 = window.innerWidth;
    try {
      for (const [width, want] of [[1280, 1], [375, 0.5]]) {
        window.innerWidth = width;
        withReducedMotion(() => {
          const rec = installRecordingGL({ version: 2 });
          try {
            const { result } = renderHook(() => useSolStar());
            const { unmount } = render(<SolCanvas star={result.current} reducedMotion />);
            expect(lastUniform(rec.log, 'uQuality')).toBe(want);
            unmount();
          } finally {
            rec.restore();
          }
        });
      }
    } finally {
      window.innerWidth = w0;
    }
  });

  describe('sizing: the buffer is the CSS box x the chosen ratio', () => {
    // jsdom lays nothing out: give the canvas a box, a viewport and a DPR.
    function withLayout({ boxW, boxH, innerW, dpr }, fn) {
      const proto = HTMLCanvasElement.prototype;
      const cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
      const ch = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
      Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => boxW });
      Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => boxH });
      const w0 = window.innerWidth;
      const d0 = window.devicePixelRatio;
      window.innerWidth = innerW;
      window.devicePixelRatio = dpr;
      try { return fn(); } finally {
        if (cw) Object.defineProperty(proto, 'clientWidth', cw); else delete proto.clientWidth;
        if (ch) Object.defineProperty(proto, 'clientHeight', ch); else delete proto.clientHeight;
        window.innerWidth = w0;
        window.devicePixelRatio = d0;
      }
    }
    const uRes = (log) => log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uRes')).map((e) => [e[2], e[3]]);
    const qualities = (log) => log.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uQuality')).map((e) => e[2]);

    it('at mount and after a rebuild, every frame is painted at the box size (never the placeholder)', () => {
      withLayout({ boxW: 948, boxH: 459, innerW: 1024, dpr: 1 }, () => {
        stubRaf();
        const rec = installRecordingGL({ version: 2 });
        try {
          const { result } = renderHook(() => useSolStar());
          let canvas;
          const { rerender } = withReducedMotion(() => render(<SolCanvas star={result.current} reducedMotion />));
          canvas = document.querySelector('[data-testid=sol-canvas]');
          expect([canvas.width, canvas.height]).toEqual([948, 459]);
          expect(uRes(rec.log).length).toBeGreaterThan(0);
          for (const r of uRes(rec.log)) expect(r).toEqual([948, 459]);
          rec.log.length = 0;
          rerender(<SolCanvas star={result.current} reducedMotion={false} />);   // host rebuild
          expect(rec.log.filter((e) => e[0] === 'createProgram')).toHaveLength(1);
          expect([canvas.width, canvas.height]).toEqual([948, 459]);
          for (const r of uRes(rec.log)) expect(r).toEqual([948, 459]);
        } finally {
          rec.restore();
        }
      });
    });

    it('a phone (375 wide, DPR 2) renders at 0.75 x the 1.5 cap', () => {
      withLayout({ boxW: 341, boxH: 485, innerW: 375, dpr: 2 }, () => {
        withReducedMotion(() => {
          const rec = installRecordingGL({ version: 2 });
          try {
            const { result } = renderHook(() => useSolStar());
            render(<SolCanvas star={result.current} reducedMotion />);
            const canvas = document.querySelector('[data-testid=sol-canvas]');
            expect([canvas.width, canvas.height]).toEqual([384, 546]);
            for (const r of uRes(rec.log)) expect(r).toEqual([384, 546]);
            expect(qualities(rec.log).every((q) => q === 0.5)).toBe(true);
          } finally {
            rec.restore();
          }
        });
      });
    });

    // Drives the real frame loop with a stubbed rAF and frame times in ms.
    function runFrames(rec, frameMs) {
      const q = [];
      vi.stubGlobal('requestAnimationFrame', (cb) => { q.push(cb); return q.length; });
      vi.stubGlobal('cancelAnimationFrame', () => {});
      const { result } = renderHook(() => useSolStar());
      const { unmount } = render(<SolCanvas star={result.current} />);
      let t = performance.now();
      for (const ms of frameMs) {
        t += ms;
        const cbs = q.splice(0);
        for (const cb of cbs) cb(t);
      }
      return { canvas: document.querySelector('[data-testid=sol-canvas]'), unmount };
    }

    it('a slow first second (25 ms frames) drops quality to 0.5 exactly once and shrinks the buffer', () => {
      withLayout({ boxW: 948, boxH: 459, innerW: 1024, dpr: 1 }, () => {
        const rec = installRecordingGL({ version: 2 });
        try {
          const { canvas, unmount } = runFrames(rec, Array(120).fill(25));   // 3 s
          const qs = qualities(rec.log);
          const flips = qs.filter((v, i) => i > 0 && v !== qs[i - 1]).length;
          expect(qs[0]).toBe(1);
          expect(qs[qs.length - 1]).toBe(0.5);
          expect(flips).toBe(1);
          // not before the warm-up plus the measured second (0.4 + 1 s = 56 frames of 25 ms)
          expect(qs.indexOf(0.5)).toBeGreaterThanOrEqual(56);
          expect([canvas.width, canvas.height]).toEqual([711, 344]);
          const res = uRes(rec.log);
          expect(res[res.length - 1]).toEqual([711, 344]);
          unmount();
        } finally {
          rec.restore();
        }
      });
    });

    it('mount jank (three 50 ms frames, then 8 ms) keeps full quality', () => {
      withLayout({ boxW: 948, boxH: 459, innerW: 1024, dpr: 1 }, () => {
        const rec = installRecordingGL({ version: 2 });
        try {
          const frames = [50, 50, 50, ...Array(300).fill(8)];
          for (let i = 0; i < 5; i++) frames[60 + i * 30] = 50;   // and five hitches in the measured second
          const { canvas, unmount } = runFrames(rec, frames);
          expect(qualities(rec.log).every((q) => q === 1)).toBe(true);
          expect([canvas.width, canvas.height]).toEqual([948, 459]);
          unmount();
        } finally {
          rec.restore();
        }
      });
    });
  });
});
