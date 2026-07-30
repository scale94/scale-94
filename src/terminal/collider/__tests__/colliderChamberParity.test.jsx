import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../gl/__tests__/driveFrames';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
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

  it('renders past COLLIDE_MS without advancing the phase itself', () => {
    // The branch's central rule: the render loop may READ state and must never
    // write it. The chamber is handed phase='colliding' and never handed
    // anything else, so if it were driving its own transition the uploaded
    // uPhase would change partway through. 200 frames is 3200ms, well past
    // COLLIDE_MS (2500) -- the phase must still be colliding on the last frame.
    const { frames } = drive({ phase: 'colliding', phaseStartedAt: 0 }, 200);
    const phases = frames
      .filter(l => l.startsWith('uniform1f(') && l.includes(':uPhase"'))
      .map(l => Number(l.slice(l.lastIndexOf(',') + 1, l.lastIndexOf(')'))));
    expect(phases.length).toBeGreaterThan(100);
    expect(new Set(phases)).toEqual(new Set([3]));   // PHASE_ID.colliding, never anything else
    expect(frames.filter(l => l.startsWith('drawArrays')).length).toBe(400);
  });

  it('frozen GL call log', () => {
    expect(drive({ phase: 'colliding', beams: BEAMS, phaseStartedAt: 0 }, 8))
      .toMatchSnapshot();
  });

  it('paints a settled frame under reduced motion, not the impact flash', () => {
    // onSnap's single frame is permanent when the loop is halted. At elapsed 0
    // the colliding phase is peak flash and peak shake -- a frozen white wash
    // is precisely what prefers-reduced-motion asks us not to render.
    vi.stubGlobal('matchMedia', () => ({
      matches: true, addEventListener() {}, removeEventListener() {},
    }));
    const rec = installRecordingGL({ version: 2 });
    try {
      render(<ColliderChamber {...props({ phase: 'colliding', phaseStartedAt: 0 })} />);
      const bursts = rec.log.filter(e => e[0] === 'uniform4f' && String(e[1]).endsWith('uBurst'));
      expect(bursts.length).toBeGreaterThan(0);
      // uBurst is (ring1, ring2, flash, metrics). flash must be 0 by now.
      for (const b of bursts) expect(b[4]).toBe(0);
    } finally {
      rec.restore();
      vi.unstubAllGlobals();
    }
  });
});
