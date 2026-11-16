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
});
