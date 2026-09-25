// Reduced motion must not strand the ring in FIRING: without the rAF flight,
// a fire still has to reach SYNTHESIZED with the exact record (and ledger /
// bus trail) that the animated path produces for the same pair and ordinal.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useCouncilCollider } from '../useCouncilCollider';
import { councilLedger } from '../councilLedger';
import { councilBus } from '../councilBus';
import { SIXTEEN_MINDS } from '../../../data/sixteenMinds';

// Module-level constant: the hook requires a referentially stable `seated`.
const SEATED = SIXTEEN_MINDS.map((m, i) => ({ ...m, angle: i * 22.5, hue: `hsl(${i * 22}, 80%, 60%)` }));
const MIND_A = SEATED[2];
const MIND_B = SEATED[11];
const FIXED_NOW = 1_790_000_000_000;

let rafQueue;
let rafId;
let busEvents;

function stubEnvironment({ reducedMotion }) {
  window.matchMedia = vi.fn(() => ({
    matches: reducedMotion, media: '(prefers-reduced-motion: reduce)',
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }));
  window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ isIntersecting: true }]); }
    disconnect() {}
  };
  window.ResizeObserver = class { observe() {} disconnect() {} };
  // jsdom has no 2D context; every canvas call is a no-op.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => new Proxy({}, { get: () => () => {}, set: () => true }),
  );
  rafQueue = new Map();
  rafId = 0;
  window.requestAnimationFrame = vi.fn((cb) => { rafQueue.set(++rafId, cb); return rafId; });
  window.cancelAnimationFrame = vi.fn((id) => { rafQueue.delete(id); });
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
}

// Run every queued frame at timestamp `now` (frames re-queue themselves).
function frame(now) {
  const due = [...rafQueue.values()];
  rafQueue.clear();
  act(() => { due.forEach(cb => cb(now)); });
}

function mountCollider() {
  const handle = { current: null };
  function Host() {
    const collider = useCouncilCollider({ seated: SEATED, enabled: true });
    handle.current = collider;
    return <canvas ref={collider.canvasRef} />;
  }
  render(<Host />);
  return handle;
}

function armAndFire(handle) {
  act(() => { handle.current.onNodeClick(MIND_A); });
  act(() => { handle.current.onNodeClick(MIND_B); });
}

// Animated reference run. The pair is fired before the first frame so the
// user cycle takes ordinal 0 (no ambient cycle consumes it first).
function animatedRun() {
  stubEnvironment({ reducedMotion: false });
  const handle = mountCollider();
  armAndFire(handle);
  expect(handle.current.mode).toBe('FIRING');
  frame(0);      // IDLE → INFALL (user cycle)
  frame(4000);   // all particles in (max delay 900 + T_INFALL 2600) → FLASH
  frame(4400);   // T_FLASH 380 elapsed → EJECT
  frame(5600);   // T_EJECT 1100 elapsed → synthesis gate opens
  return snapshot(handle);
}

function snapshot(handle) {
  return {
    mode: handle.current.mode,
    record: handle.current.synthesisRecord,
    lastCollision: handle.current.lastCollision,
    activePairIds: handle.current.activePairIds,
    ledger: JSON.stringify(councilLedger.list()),
    bus: JSON.stringify(busEvents),
  };
}

function resetStores() {
  localStorage.clear();
  councilLedger._resetForTests();
  councilBus._resetForTests();
  busEvents = [];
  councilBus.on(e => busEvents.push(e));
}

describe('useCouncilCollider under prefers-reduced-motion', () => {
  beforeEach(resetStores);
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('animated reference run reaches SYNTHESIZED at ordinal 0', () => {
    const ref = animatedRun();
    expect(ref.mode).toBe('SYNTHESIZED');
    expect(ref.record.ordinal).toBe(0);
  });

  it('a reduced-motion fire reaches SYNTHESIZED without a single animation frame', () => {
    stubEnvironment({ reducedMotion: true });
    const handle = mountCollider();
    armAndFire(handle);
    expect(handle.current.mode).toBe('SYNTHESIZED');
    expect(handle.current.synthesisRecord).not.toBeNull();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('produces a byte-identical record, ledger and bus trail to the animated run', () => {
    const ref = animatedRun();
    cleanup();
    vi.restoreAllMocks();
    resetStores();

    stubEnvironment({ reducedMotion: true });
    const handle = mountCollider();
    armAndFire(handle);
    const got = snapshot(handle);

    expect(got.mode).toBe('SYNTHESIZED');
    expect(JSON.stringify(got.record)).toBe(JSON.stringify(ref.record));
    expect(got.ledger).toBe(ref.ledger);
    expect(got.bus).toBe(ref.bus);
    expect(got.lastCollision).toEqual(ref.lastCollision);
    expect(got.activePairIds).toEqual(ref.activePairIds);
  });

  it('releases the input lock: reset then a second fire synthesizes at ordinal 1', () => {
    stubEnvironment({ reducedMotion: true });
    const handle = mountCollider();
    armAndFire(handle);
    expect(handle.current.synthesisRecord.ordinal).toBe(0);
    act(() => { handle.current.reset(); });
    expect(handle.current.mode).toBe('AMBIENT');
    armAndFire(handle);
    expect(handle.current.mode).toBe('SYNTHESIZED');
    expect(handle.current.synthesisRecord.ordinal).toBe(1);
  });
});
