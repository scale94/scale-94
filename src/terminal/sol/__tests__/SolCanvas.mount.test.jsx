// SolCanvas mounts on the shared harness without a GPU (recording GL stub).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, renderHook, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import SolCanvas from '../SolCanvas';
import { useSolStar } from '../useSolStar';
import { SOL_FS, SOL_UNIFORMS, OMEGA_POLE_K } from '../solShader';
import { omega, OMEGA_EQ } from '../regions';
import { glf } from '../../gl/glf';

afterEach(cleanup);

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
});
