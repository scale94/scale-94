import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

const base = {
  hueA: 280, hueB: 120, selA: true, selB: true, massA: 0.3, massB: 0.6,
  beams: null, metrics: null, phaseStartedAt: 0, labelA: null, labelB: null,
};

describe('ColliderChamber under prefers-reduced-motion', () => {
  let rec;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    rec = installRecordingGL({ version: 2 });
  });
  afterEach(() => { rec.restore(); vi.unstubAllGlobals(); });

  it('paints exactly one static frame and never starts the loop', () => {
    render(<ColliderChamber phase="colliding" {...base} />);
    // Snap at 1300ms: the cage window is closed, so field + streaks only.
    const quads = rec.log.filter((e) => e[0] === 'drawArrays');
    const inst = rec.log.filter((e) => e[0] === 'drawArraysInstanced');
    expect(quads).toHaveLength(1);
    expect(quads[0][1]).toBe(0x0005);
    expect(inst).toHaveLength(1);
    expect(inst[0][4]).toBe(4096);
  });

  it('still shows the phase it was given', () => {
    render(<ColliderChamber phase="colliding" {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.4 }} />);
    const phaseUploads = rec.log.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith('uPhase'));
    expect(phaseUploads.some((e) => e[2] === 3)).toBe(true);
  });

  it('freezes accelerating fully pinched', () => {
    render(<ColliderChamber phase="accelerating" {...base} />);
    const accel = rec.log.filter((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uAccel'));
    expect(accel.length).toBeGreaterThan(0);
    expect(accel[accel.length - 1].slice(2)).toEqual([1, 1]);
  });

  it('resolves the half-float accumulator through the composite in the snap', () => {
    rec.restore();
    rec = installRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    render(<ColliderChamber phase="colliding" {...base} />);
    const comp = rec.log.find((e) => e[0] === 'getUniformLocation' && e[2] === 'uAccum')[1];
    const use = rec.log.findIndex((e) => e[0] === 'useProgram' && e[1] === comp);
    expect(use).toBeGreaterThan(-1);
    const next = rec.log.slice(use + 1);
    const draw = next.findIndex((e) => e[0] === 'drawArrays');
    expect(draw).toBeGreaterThan(-1);
    expect(next.slice(0, draw).some((e) => e[0] === 'useProgram')).toBe(false); // still the composite
    // ...into the canvas: the last framebuffer bound before it is the default.
    const fbos = rec.log.slice(0, use).filter((e) => e[0] === 'bindFramebuffer');
    expect(fbos.length).toBeGreaterThan(1);
    expect(fbos[fbos.length - 1]).toEqual(['bindFramebuffer', 0x8d40, null]);
  });

  it('repaints after a resize, since resizing the canvas clears it', () => {
    // jsdom has no ResizeObserver: capture the chamber's callback instead.
    let fire = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb) { fire = cb; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<ColliderChamber phase="colliding" {...base} />);
    expect(typeof fire).toBe('function');
    const wrap = container.querySelector('[data-chamber-renderer]');
    Object.defineProperty(wrap, 'clientWidth', { configurable: true, value: 640 });
    const before = rec.log.length;
    fire([]);
    const after = rec.log.slice(before);
    const resized = after.findIndex((e) => e[0] === 'viewport');
    expect(resized).toBeGreaterThan(-1);
    const fieldDraw = after.findIndex((e, i) => i > resized && e[0] === 'drawArrays' && e[1] === 0x0005);
    expect(fieldDraw).toBeGreaterThan(resized);
    expect(after.some((e) => e[0] === 'uniform2f' && String(e[1]).endsWith(':uRes') && e[2] === 640)).toBe(true);
  });
});
