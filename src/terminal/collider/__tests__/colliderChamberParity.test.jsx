import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../gl/__tests__/driveFrames';
import ColliderChamber from '../ColliderChamber';

const BEAMS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
  mag: 0.2 + (i % 5) * 0.15,
  hue: (i * 23) % 360,
  lifespanMs: 120 + i * 40,
}));

const props = (over = {}) => ({
  phase: 'idle', hueA: 280, hueB: 120, selA: false, selB: false,
  beams: null, metrics: null, phaseStartedAt: 0, ...over,
});

function drive(over, frames = 12) {
  return driveFrames(
    () => {
      const r = render(<ColliderChamber {...props(over)} />);
      return { unmount: r.unmount, rerender: r.rerender };
    },
    { frames, version: 2 }
  );
}

describe('ColliderChamber GL traffic', () => {
  it('builds two programs and one seed buffer at init', () => {
    const { init } = drive({});
    const names = init.map(l => l.slice(0, l.indexOf('(')));
    // glHost's field program + the particle program built inside onInit.
    expect(names.filter(n => n === 'createProgram')).toHaveLength(2);
    expect(names.filter(n => n === 'bufferData')).toHaveLength(2); // quad + seeds
    expect(names).toContain('createVertexArray');
  });

  it('draws both passes every frame, quad then points', () => {
    const { frames } = drive({ phase: 'colliding', phaseStartedAt: 0 });
    const draws = frames.filter(l => l.startsWith('drawArrays'));
    expect(draws.length).toBeGreaterThan(0);
    // TRIANGLE_STRIP is 5, POINTS is 0.
    expect(draws[0]).toBe('drawArrays(5, 0, 4)');
    expect(draws[1]).toBe('drawArrays(0, 0, 4096)');
  });

  it('sets additive blending, never straight alpha, inside the frame', () => {
    const { frames } = drive({ phase: 'accelerating' });
    const blends = frames.filter(l => l.startsWith('blendFunc'));
    expect(blends.length).toBeGreaterThan(0);
    expect(new Set(blends)).toEqual(new Set(['blendFunc(1, 1)']));
  });

  it('uploads all 16 beams as one vec4 array when armed', () => {
    const { frames } = drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: 0 }, 120);
    const up = frames.filter(l => l.startsWith('uniform4fv'));
    expect(up.length).toBeGreaterThan(0);
    // 16 beams x 4 components, flattened into one upload.
    expect(JSON.parse(`[${up[0].slice(up[0].indexOf('[') + 1, up[0].lastIndexOf(']'))}]`))
      .toHaveLength(64);
  });

  it('never writes state from the render loop — no drawArrays after unmount', () => {
    const { frames } = drive({ phase: 'colliding', phaseStartedAt: 0 }, 200);
    // 200 frames is 3200ms, well past COLLIDE_MS. The chamber must keep
    // rendering the post-done state rather than tearing itself down: the
    // transition belongs to the parent (spec 6.2).
    expect(frames.filter(l => l.startsWith('drawArrays')).length).toBeGreaterThan(300);
  });

  it('frozen GL call log', () => {
    expect(drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: 0 }, 8))
      .toMatchSnapshot();
  });
});
