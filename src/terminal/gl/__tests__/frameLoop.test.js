import { describe, it, expect, vi } from 'vitest';
import { createFrameLoop } from '../frameLoop';

function harness(opts = {}) {
  let t = 1000;
  const queue = [];
  const raf = (cb) => { queue.push(cb); return queue.length; };
  const caf = vi.fn();
  const frames = [];
  const loop = createFrameLoop({
    onFrame: (now, dt, ctx) => frames.push({ now, dt, ...ctx }),
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: null,
    now: () => t,
    raf,
    caf,
    ...opts,
  });
  const tick = (ms = 16) => {
    t += ms;
    const cb = queue.shift();
    if (cb) cb(t);
  };
  return { loop, frames, tick, queue, caf, advance: (ms) => { t += ms; } };
}

describe('createFrameLoop', () => {
  it('does not invoke onFrame before start', () => {
    const h = harness();
    expect(h.frames).toHaveLength(0);
  });

  it('invokes onFrame once per tick after start', () => {
    const h = harness();
    h.loop.start();
    h.tick(); h.tick();
    expect(h.frames).toHaveLength(2);
  });

  it('clamps dt to dtClamp', () => {
    const h = harness({ dtClamp: 0.05 });
    h.loop.start();
    h.tick(5000);
    expect(h.frames[0].dt).toBe(0.05);
  });

  it("seedLast 'zero' makes the first dt exactly zero", () => {
    const h = harness({ seedLast: 'zero' });
    h.loop.start();
    h.tick(16);
    expect(h.frames[0].dt).toBe(0);
  });

  it("seedLast 'now' makes the first dt non-zero", () => {
    const h = harness({ seedLast: 'now' });
    h.loop.start();
    h.tick(16);
    expect(h.frames[0].dt).toBeGreaterThan(0);
  });

  // The constraint from the spec. The moon's idle throttle early-returns
  // before drawing; under bottom-scheduling that would starve the loop.
  it('schedules the next frame even when onFrame returns early', () => {
    const h = harness({ onFrame: () => { return; } });
    h.loop.start();
    h.tick();
    expect(h.queue).toHaveLength(1);
  });

  it('schedules the next frame even when onFrame throws', () => {
    const h = harness({ onFrame: () => { throw new Error('draw failed'); } });
    h.loop.start();
    expect(() => h.tick()).toThrow('draw failed');
    expect(h.queue).toHaveLength(1);
  });

  it('stop cancels a frame that is already queued', () => {
    const h = harness();
    h.loop.start();
    h.tick();
    h.loop.stop();
    expect(h.caf).toHaveBeenCalled();
    expect(h.loop.isRunning()).toBe(false);
    h.tick();
    expect(h.frames).toHaveLength(1);
  });

  it('start is idempotent', () => {
    const h = harness();
    h.loop.start(); h.loop.start();
    h.tick();
    expect(h.frames).toHaveLength(1);
  });

  it('does not start when reducedMotion and haltOnReducedMotion', () => {
    const h = harness({ reducedMotion: true, haltOnReducedMotion: true });
    h.loop.start();
    expect(h.loop.isRunning()).toBe(false);
    expect(h.queue).toHaveLength(0);
  });

  it('does start when reducedMotion but not halting', () => {
    const h = harness({ reducedMotion: true, haltOnReducedMotion: false });
    h.loop.start();
    expect(h.loop.isRunning()).toBe(true);
  });

  it('adds and removes a visibilitychange listener only when tracking', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');

    const off = harness({ trackVisibility: false });
    off.loop.start(); off.loop.stop();
    expect(add.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(0);

    const on = harness({ trackVisibility: true });
    on.loop.start();
    expect(add.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);
    on.loop.stop();
    expect(remove.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);

    add.mockRestore();
    remove.mockRestore();
  });

  it('arms a watchdog when watchdogMs is set', () => {
    vi.useFakeTimers();
    const set = vi.spyOn(globalThis, 'setTimeout');
    const h = harness({ watchdogMs: 40 });
    h.loop.start();
    expect(set.mock.calls.some(c => c[1] === 40)).toBe(true);
    h.loop.stop();
    set.mockRestore();
    vi.useRealTimers();
  });
});
