import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import { OCEAN_GRID, DT_DAYS } from '../../../../ledger/ocean/grid';
import { diffusionSchedule, EDDY_DIFFUSIVITY_KM2_DAY } from '../../../../ledger/ocean/referenceStep';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME } from '../oceanDriver';
import { MODE_LABEL } from '../hudFormat';
import LedgerOcean from '../LedgerOcean';

const FRAME_MS = 16;
const FLOAT = ['EXT_color_buffer_float'];
const WARM_FRAMES = Math.ceil(REDUCED_MOTION_DAYS / DT_DAYS / WARMUP_STEPS_PER_FRAME);

let rec = null;
afterEach(() => {
  cleanup();
  rec?.restore();
  rec = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const count = (name) => rec.log.filter((e) => e[0] === name).length;
// One composite paint = one uRes upload (no sim program has uRes).
const paints = () => rec.log.filter(([n, loc]) => n === 'uniform2f' && /:uRes$/.test(String(loc))).length;
const reduceMotion = () => vi.stubGlobal('matchMedia', (q) => ({
  matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {},
}));

// Fake rAF/performance/timers on one clock, the recording GL stub, and a
// frame pump. Every frame is FRAME_MS of wall time.
function mountLive(ui, { extensions = FLOAT } = {}) {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'],
  });
  rec = installRecordingGL({ version: 2, extensions });
  const out = render(ui);
  const frames = (n) => {
    for (let f = 0; f < n; f++) act(() => { vi.advanceTimersByTime(FRAME_MS); });
  };
  return { ...out, frames };
}

describe('LedgerOcean', () => {
  it('runs the GPU ocean when float targets exist', () => {
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByLabelText(/Ledger ocean/)).toBeTruthy();
    expect(screen.queryByText(MODE_LABEL.static)).toBeNull();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(true);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('falls back to a static coastline without float targets', () => {
    rec = installRecordingGL({ version: 2 });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL.static)).toBeTruthy();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(false);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('says so when there is no WebGL2 at all', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL.unsupported)).toBeTruthy();
  });

  it('falls back to the static coastline, with nothing leaked, when a sim program fails to build', () => {
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    let links = 0;
    // link 1 = the host's display program; 2..6 = the five sim programs. Fail the 3rd sim program.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 4; };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText(MODE_LABEL['static-shader'])).toBeTruthy();
    expect(screen.queryByText(MODE_LABEL.unsupported)).toBeNull();
    expect(count('createProgram')).toBe(count('deleteProgram') + 1);
    expect(count('createFramebuffer')).toBe(count('deleteFramebuffer'));
    expect(count('createTexture')).toBe(count('deleteTexture') + 2);
    expect(count('drawArrays')).toBe(1);
  });
});

describe('LedgerOcean lifecycle', () => {
  it('steps the sim on the frame loop by wall time, not frame count', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    const drawsAtMount = count('drawArrays');
    const FRAMES = 60;
    m.frames(FRAMES);
    const clock = createStepClock();
    let expected = 0;
    for (let f = 0; f < FRAMES; f++) expected += clock.advance(Math.min(FRAME_MS / 1000, 0.05) * 1000, 9);
    expect(expected).toBeGreaterThanOrEqual(30);
    expect(days).toHaveLength(FRAMES + 1);            // mount draw + one per frame
    expect(days.at(-1)).toBeCloseTo(expected * DT_DAYS, 9);
    const { sub } = diffusionSchedule(OCEAN_GRID, DT_DAYS, EDDY_DIFFUSIVITY_KM2_DAY);
    // Each step: advect, correct, final, `sub` diffusion passes, react. Plus one composite per frame.
    expect(count('drawArrays') - drawsAtMount).toBe(expected * (4 + sub) + FRAMES);
    expect(paints()).toBe(FRAMES + 1);
  });

  it('resizes in place: no teardown, no lost context, no second program build', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const programsAtMount = count('createProgram');
    m.rerender(<LedgerOcean width={300} height={150} />);
    m.frames(2);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    expect(count('loseContext')).toBe(0);
    expect(count('createProgram')).toBe(programsAtMount);
    expect(canvas.width).toBe(300);   // jsdom devicePixelRatio = 1
    expect(canvas.height).toBe(150);
    expect(rec.log).toContainEqual(['viewport', 0, 0, 300, 150]);
    expect(screen.queryByText(MODE_LABEL.unsupported)).toBeNull();
  });

  it('suspends on a lost context and rebuilds on a fresh canvas when it is restored', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const first = screen.getByLabelText(/Ledger ocean/);
    const programs = count('createProgram');
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => { first.dispatchEvent(lost); });
    expect(lost.defaultPrevented).toBe(true);          // required for the browser to ever restore
    expect(screen.getByText(MODE_LABEL.lost)).toBeTruthy();
    const drawsWhileLost = count('drawArrays');
    m.frames(5);
    expect(count('drawArrays')).toBe(drawsWhileLost);   // nothing is drawn into a dead context
    act(() => { first.dispatchEvent(new Event('webglcontextrestored')); });
    const second = screen.getByLabelText(/Ledger ocean/);
    expect(second).not.toBe(first);
    expect(count('createProgram')).toBe(2 * programs);
    expect(screen.queryByText(MODE_LABEL.lost)).toBeNull();
    m.frames(2);
    expect(count('drawArrays')).toBeGreaterThan(drawsWhileLost);
  });

  it('spreads the reduced-motion warm-up over frames and paints once it is settled', () => {
    reduceMotion();
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    expect(days[0]).toBeCloseTo(WARMUP_STEPS_PER_FRAME * DT_DAYS, 9); // the mount draw ran one chunk
    expect(paints()).toBe(0);
    m.frames(WARM_FRAMES + 5);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(paints()).toBe(1);
    m.frames(10);
    expect(paints()).toBe(1);                                         // held: no repaint without a reason
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
  });

  it('repaints a held reduced-motion frame once after a resize', () => {
    reduceMotion();
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    m.rerender(<LedgerOcean width={300} height={150} />);
    m.frames(3);
    expect(paints()).toBe(2);
  });
});
