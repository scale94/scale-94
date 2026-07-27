import { describe, it, expect, vi } from 'vitest';
import { createFrameLoop } from '../frameLoop';

function harness(opts = {}) {
  // startAt lets a test start the fake clock at exactly 0 — the case that
  // exposed the seedLast:'now' bug (performance.now() really is 0 at mount
  // under vi.useFakeTimers()) — without disturbing every other test, which
  // relies on the default 1000 start.
  const { startAt = 1000, ...rest } = opts;
  let t = startAt;
  let nextRafId = 0;
  const queue = [];
  // ids are a monotonic counter, independent of queue length, so tests can
  // assert caf() receives the actual id that was pending — not just "some id".
  const raf = vi.fn((cb) => { queue.push(cb); return ++nextRafId; });
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
    ...rest,
  });
  const tick = (ms = 16) => {
    t += ms;
    const cb = queue.shift();
    if (cb) cb(t);
  };
  return { loop, frames, tick, queue, caf, raf, advance: (ms) => { t += ms; } };
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

  // Regression: under vi.useFakeTimers(), performance.now() is exactly 0 the
  // first time it's read after mount — the real environment glParity.test.jsx
  // runs in. `last` used to double as its own "seeded?" flag via truthiness,
  // so a seedLast:'now' loop seeded with last=0 was indistinguishable from
  // "not yet seeded" and silently reported dt=0 on its first real tick
  // instead of ~1 frame, skipping an easing step. `seeded` must be tracked
  // independently of `last`'s value.
  it("seedLast 'now' first dt is non-zero even when the clock starts at exactly 0", () => {
    const h = harness({ seedLast: 'now', startAt: 0 });
    h.loop.start();
    h.tick(16);
    expect(h.frames[0].dt).toBeGreaterThan(0);
    expect(h.frames[0].dt).toBeCloseTo(0.016, 2);
  });

  // The constraint from the spec. The moon's idle throttle early-returns
  // before drawing; under bottom-scheduling that would starve the loop.
  // A plain `return;` inside onFrame only exits onFrame's own body — it
  // doesn't unwind through frame(), so it can't distinguish top- from
  // bottom-scheduling. Instead observe the queue from inside the callback,
  // which only sees length 1 if schedule() already ran before onFrame did.
  it('schedules the next frame before onFrame runs', () => {
    let queueLenDuringCallback;
    const h = harness({ onFrame: () => { queueLenDuringCallback = h.queue.length; } });
    h.loop.start();
    h.tick();
    expect(queueLenDuringCallback).toBe(1);
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

  // This is the mechanism that keeps a component rendering when a surface
  // suppresses rAF while still compositing (embedded preview panes report
  // `hidden` forever). Prove it by never running the queued rAF callback
  // ourselves and advancing only real timers.
  it('watchdog drives the frame when rAF never runs', () => {
    vi.useFakeTimers();
    const h = harness({ watchdogMs: 40 });
    h.loop.start();
    expect(h.frames).toHaveLength(0);
    vi.advanceTimersByTime(41);
    expect(h.frames).toHaveLength(1);
    h.loop.stop();
    vi.useRealTimers();
  });

  it('caf is called with the actual pending rAF id', () => {
    const h = harness();
    h.loop.start();
    h.tick();
    const pendingId = h.raf.mock.results[h.raf.mock.results.length - 1].value;
    h.loop.stop();
    expect(h.caf).toHaveBeenCalledWith(pendingId);
  });

  it('stop is idempotent (no double cancel, no double listener removal)', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const h = harness({ trackVisibility: true });
    h.loop.start();
    h.tick();
    h.loop.stop();
    expect(h.caf).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);

    h.loop.stop();
    expect(h.caf).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);

    remove.mockRestore();
  });

  it('visibilitychange reaches onFrame and reseeds last on becoming visible', () => {
    const h = harness({ trackVisibility: true, seedLast: 'now', dtClamp: 100 });
    try {
      h.loop.start();
      h.tick(16);
      expect(h.frames[0].hidden).toBe(false);

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      h.tick(5000); // simulate 5s elapsed while hidden
      expect(h.frames[h.frames.length - 1].hidden).toBe(true);

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      h.tick(16);
      // If `last` had not been reseeded on becoming visible, dt here would
      // reflect the ~5s spent hidden instead of just this 16ms tick.
      expect(h.frames[h.frames.length - 1].hidden).toBe(false);
      expect(h.frames[h.frames.length - 1].dt).toBeCloseTo(0.016, 2);
    } finally {
      h.loop.stop();
      delete document.hidden;
    }
  });

  // Same mechanism as the test above, but for the 'zero' policy — this is
  // LunarShaderMoon's actual production path, and until now it was verified
  // only by reading onVisibility's branch in frameLoop.js. 'zero' means "do
  // not bill the user for time spent away": onVisibility resets `last` to 0
  // and `seeded` to false on becoming visible again, so the very next frame
  // reports dt === 0 (the unseeded value), never the real elapsed gap.
  it("visibilitychange with seedLast 'zero' reseeds to unseeded (dt 0) on resume, not the elapsed gap", () => {
    const h = harness({ trackVisibility: true, seedLast: 'zero', dtClamp: 100 });
    try {
      h.loop.start();
      h.tick(16);
      expect(h.frames[0].dt).toBe(0); // seedLast 'zero' — first frame is always unseeded

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      h.tick(5000); // simulate 5s elapsed while hidden
      expect(h.frames[h.frames.length - 1].hidden).toBe(true);

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      h.tick(16);
      // If onVisibility had not reseeded to unseeded, dt here would reflect
      // the ~5s spent hidden (clamped to dtClamp: 100) instead of exactly 0.
      expect(h.frames[h.frames.length - 1].hidden).toBe(false);
      expect(h.frames[h.frames.length - 1].dt).toBe(0);
    } finally {
      h.loop.stop();
      delete document.hidden;
    }
  });
});
