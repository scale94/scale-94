import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { DEFAULT_MASS } from '../domainMass';
import { driveFrames } from '../../gl/__tests__/driveFrames';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

const HALF = ['EXT_color_buffer_float'];
const BEAMS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
  mag: 0.2 + (i % 5) * 0.15,
  hue: (i * 23) % 360,
  lifespanMs: 120 + i * 40,
}));

const props = (over = {}) => ({
  phase: 'idle', hueA: 280, hueB: 120, selA: false, selB: false, massA: 0.2, massB: 0.7,
  beams: null, metrics: null, phaseStartedAt: 0, ...over,
});

function drive(over, frames = 12, extensions = HALF) {
  return driveFrames(
    () => {
      const r = render(<ColliderChamber {...props(over)} />);
      return { unmount: r.unmount, rerender: r.rerender };
    },
    { frames, version: 2, extensions }
  );
}
const names = (lines) => lines.map((l) => l.slice(0, l.indexOf('(')));

describe('ColliderChamber GL traffic', () => {
  it('builds four programs, three buffers and two instanced VAOs at init', () => {
    const n = names(drive({}).init);
    expect(n.filter((x) => x === 'createProgram')).toHaveLength(4); // field, streak, cage, composite
    expect(n.filter((x) => x === 'bufferData')).toHaveLength(3);    // quad, seeds, cage instances
    expect(n.filter((x) => x === 'vertexAttribDivisor')).toHaveLength(2);
  });

  it('allocates a half-float accumulator when the extension exists', () => {
    const { init } = drive({});
    expect(init).toContain('getExtension("EXT_color_buffer_float")');
    expect(init.some((l) => l.startsWith('texImage2D(') && l.includes(`${0x881a}`) && l.includes(`${0x140b}`)))
      .toBe(true);
    expect(names(init)).toContain('createFramebuffer');
  });

  it('falls back to screen blending with no framebuffer when it does not', () => {
    const { init, frames } = drive({ phase: 'accelerating' }, 12, []);
    expect(names(init)).not.toContain('createFramebuffer');
    const blends = frames.filter((l) => l.startsWith('blendFunc'));
    expect(new Set(blends)).toEqual(new Set([`blendFunc(1, ${0x0301})`]));
    expect(frames.some((l) => l.startsWith('bindFramebuffer'))).toBe(false);
  });

  it('half-float frame: field, streaks, cage into the accumulator, then one composite', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 2);
    expect(frames.filter((l) => l.startsWith('drawArrays')).slice(0, 4)).toEqual([
      'drawArrays(5, 0, 4)',
      'drawArraysInstanced(5, 0, 4, 4096)',
      'drawArraysInstanced(5, 0, 4, 60)',
      'drawArrays(5, 0, 4)',
    ]);
  });

  it('colour passes keep accumulator alpha; the composite runs unblended', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 2);
    expect(frames).toContain('blendFuncSeparate(1, 1, 0, 1)');
    const firstDisable = frames.indexOf(`disable(${0x0be2})`);
    const composites = frames.map((l, i) => (l === 'drawArrays(5, 0, 4)' ? i : -1)).filter((i) => i >= 0);
    expect(firstDisable).toBeGreaterThan(-1);
    expect(firstDisable).toBeLessThan(composites[1]); // [0] is the field, [1] the composite
  });

  it('unbinds the accumulator from TEXTURE0 after the composite draw', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 2);
    const draws = frames.map((l, i) => (l === 'drawArrays(5, 0, 4)' ? i : -1)).filter((i) => i >= 0);
    const composite = draws[1]; // [0] is the field
    const nextFrame = frames.indexOf('clear(16384)', composite);
    const tail = frames.slice(composite + 1, nextFrame < 0 ? undefined : nextFrame);
    expect(tail).toContain(`bindTexture(${0x0de1}, null)`);
  });

  it('skips the cage draw once the cage window has closed', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: -1000 }, 4);
    expect(frames).not.toContain('drawArraysInstanced(5, 0, 4, 60)');
  });

  it('uploads all 16 beams as one vec4 array', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS }, 4);
    const up = frames.filter((l) => l.startsWith('uniform4fv') && l.includes(':uBeams"'));
    expect(up.length).toBeGreaterThan(0);
    expect(JSON.parse(`[${up[0].slice(up[0].indexOf('[') + 1, up[0].lastIndexOf(']'))}]`)).toHaveLength(64);
  });

  it('renders past COLLIDE_MS without advancing the phase itself', () => {
    // The render loop may READ state and must never write it.
    const { frames } = drive({ phase: 'colliding' }, 200, []);
    const phases = frames
      .filter((l) => l.startsWith('uniform1f(') && l.includes(':uPhase"'))
      .map((l) => Number(l.slice(l.lastIndexOf(',') + 1, l.lastIndexOf(')'))));
    expect(phases.length).toBeGreaterThan(100);
    expect(new Set(phases)).toEqual(new Set([3]));
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(200); // one field pass a frame
  });

  it('runs the ambient clock through colliding -> result without resetting it', () => {
    // uPhaseT restarts with the phase; uTime is the loop's absolute clock.
    const P = (over) => <ColliderChamber {...props({ phase: 'colliding', ...over })} />;
    const { frames } = driveFrames(
      () => {
        const r = render(P({}));
        return { unmount: r.unmount, rerender: r.rerender };
      },
      { frames: 40, version: 2, extensions: HALF, rerenders: [{ at: 20, element: P({ phase: 'result', phaseStartedAt: 320 }) }] }
    );
    const val = (l) => Number(l.slice(l.lastIndexOf(',') + 1, l.lastIndexOf(')')));
    const series = (u) => frames.filter((l) => l.startsWith('uniform1f(') && l.includes(`:${u}"`)).map(val);
    const time = series('uTime');
    const phaseT = series('uPhaseT').filter((_, i) => i % 2 === 0); // field's upload; streak repeats it
    const phaseId = series('uPhase').filter((_, i) => i % 2 === 0);
    expect(time.length).toBe(phaseT.length);
    const cut = phaseId.indexOf(4);
    expect(cut).toBeGreaterThan(0);                 // the phase really changed mid-run...
    expect(phaseT[cut]).toBeLessThan(phaseT[cut - 1]); // ...and the phase clock restarted
    expect(time[cut]).toBeGreaterThan(time[cut - 1]);  // the ambient clock did not
    for (let i = 1; i < time.length; i++) expect(time[i]).toBeGreaterThanOrEqual(time[i - 1]);
    expect(time[time.length - 1]).toBeGreaterThan(0.5);
  });

  it('frozen GL call log', () => {
    expect(drive({ phase: 'colliding', beams: BEAMS, selA: true, selB: true }, 8)).toMatchSnapshot();
  });

  it('paints a settled frame under reduced motion: rings, no shock', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const rec = installRecordingGL({ version: 2 });
    try {
      render(<ColliderChamber {...props({ phase: 'colliding' })} />);
      const shock = rec.log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uShock'));
      expect(shock.length).toBeGreaterThan(0);
      for (const e of shock) expect(e[3]).toBe(0);
      const rings = rec.log.filter((e) => e[0] === 'uniform3fv' && String(e[1]).endsWith(':uRingA'));
      expect(rings[rings.length - 1][2][0]).toBeGreaterThan(0.3);
    } finally {
      rec.restore();
      vi.unstubAllGlobals();
    }
  });
});

describe('ColliderChamber accumulator and mass props', () => {
  it.each([
    [HALF, 'half-float'],
    [[], 'screen'],
  ])('reports data-chamber-accum for extensions %j as %s', (extensions, mode) => {
    const rec = installRecordingGL({ version: 2, extensions });
    try {
      const { container } = render(<ColliderChamber {...props()} />);
      expect(container.querySelector('[data-chamber-renderer]').dataset.chamberAccum).toBe(mode);
    } finally {
      rec.restore();
    }
  });

  it.each([
    [NaN, 0.7, [DEFAULT_MASS, 0.7]],
    [undefined, NaN, [DEFAULT_MASS, DEFAULT_MASS]],
    [0.3, undefined, [0.3, DEFAULT_MASS]],
  ])('uploads DEFAULT_MASS for a non-finite mass (massA %s, massB %s)', (massA, massB, want) => {
    expect(DEFAULT_MASS).toBe(0.5);
    const { frames } = drive({ phase: 'accelerating', massA, massB }, 2);
    const up = frames.filter((l) => l.startsWith('uniform2f(') && l.includes(':uMass"'));
    expect(up.length).toBeGreaterThan(0);
    for (const l of up) expect(JSON.parse(`[${l.slice(l.indexOf(',') + 1, -1)}]`)).toEqual(want);
  });
});
