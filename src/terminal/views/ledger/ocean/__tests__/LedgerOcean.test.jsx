import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import { OCEAN_GRID, DT_DAYS } from '../../../../ledger/ocean/grid';
import { diffusionSchedule, EDDY_DIFFUSIVITY_KM2_DAY } from '../../../../ledger/ocean/referenceStep';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME } from '../oceanDriver';
import { MODE_LABEL, PROBE_HINT, PROBE_TAP_HOLD_MS, formatClock } from '../hudFormat';
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

const V = {
  hash: 'h1', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 },
  input: { temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42, siteName: 'Test site' },
};
const RECT = { left: 0, top: 0, width: 512, height: 256, right: 512, bottom: 256, x: 0, y: 0 };
const oceanCanvas = () => {
  const c = screen.getByLabelText(/Ledger ocean/);
  c.getBoundingClientRect = () => RECT;
  return c;
};

describe('LedgerOcean HUD integration', () => {
  it('writes the sim clock and the frame monitor', () => {
    const days = [];
    // Desktop width: the frame monitor is not shown below COMPACT_BELOW_PX.
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={(d) => days.push(d)} />);
    m.frames(30);
    expect(m.container.querySelector('[data-hud="clock"]').textContent).toBe(formatClock(days.at(-1)));
    expect(days.at(-1)).toBeGreaterThan(0);
    expect(m.container.querySelector('[data-hud="frame"]').textContent).toBe('Δt 16.0 ms · 63 Hz');
  });

  it('probes the hovered cell with a 1-px float readback', () => {
    // Desktop width (the hint is not shown below COMPACT_BELOW_PX); the probe
    // maps through the mocked 512×256 bounding rect.
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    rec.gl.readPixels = (...a) => { rec.log.push(['readPixels', ...a.slice(0, 6)]); a[6].set([0.02, 0.14, 0.8, 0.3]); };
    const canvas = oceanCanvas();
    act(() => { fireEvent.pointerMove(canvas, { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    m.frames(1);
    expect(rec.log).toContainEqual(['readPixels', 256, 128, 1, 1, rec.gl.RGBA, rec.gl.FLOAT]);
    expect(screen.getByText('0.0°N 0.0°E · ΔT 0.02 °C · BOD 0.14 · NO₃ 0.80 · DO↓ 0.30 mg/L')).toBeTruthy();
    act(() => { fireEvent.pointerLeave(canvas, { pointerType: 'mouse' }); });
    expect(screen.getByText(PROBE_HINT)).toBeTruthy();
  });

  it('reads the probe at most every 100 ms of frame time', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    act(() => { fireEvent.pointerMove(oceanCanvas(), { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    const before = count('readPixels');
    m.frames(60); // 960 ms
    const reads = count('readPixels') - before;
    expect(reads).toBeGreaterThanOrEqual(8);
    expect(reads).toBeLessThanOrEqual(10);
  });

  it('probes on tap and clears the readout after the hold time', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    act(() => { fireEvent.pointerDown(canvas, { pointerType: 'touch', clientX: 180, clientY: 90 }); });
    m.frames(1);
    expect(screen.getByText(/^0\.0°N 0\.0°E · ΔT/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(PROBE_TAP_HOLD_MS); });
    expect(screen.queryByText(/^0\.0°N 0\.0°E/)).toBeNull();
  });

  it('cycles time compression 9 → 30 d/s and the sim follows', () => {
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    m.frames(5);
    const button = screen.getByRole('button', { name: /Time compression/ });
    expect(button.textContent).toBe('1 s = 9 d');
    act(() => { fireEvent.click(button); });
    expect(button.textContent).toBe('1 s = 30 d');
    const d0 = days.at(-1);
    m.frames(20); // 0.32 s × 30 d/s = 9.6 d (9 d/s would give 2.9 d)
    expect(days.at(-1) - d0).toBeGreaterThanOrEqual(9.25);
    expect(days.at(-1) - d0).toBeLessThanOrEqual(10);
  });

  it('adds an archived verdict as a source once, and rings its site', () => {
    const m = mountLive(<LedgerOcean width={512} height={256} />);
    const uploads = count('texImage2D');
    m.frames(2);
    expect(count('texImage2D')).toBe(uploads);
    m.rerender(<LedgerOcean width={512} height={256} verdicts={[V]} latestHash="h1" />);
    m.frames(1);
    expect(count('texImage2D')).toBe(uploads + 1);
    m.frames(3);
    expect(count('texImage2D')).toBe(uploads + 1);
    expect(m.container.querySelector('[data-site="h1"]')).toBeTruthy();
    expect(m.container.querySelectorAll('[data-site^="preset:"]')).toHaveLength(5);
  });

  it('re-settles a reduced-motion ocean when a verdict adds a source', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={onFrame} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    m.rerender(<LedgerOcean width={512} height={256} onFrame={onFrame} verdicts={[V]} />);
    m.frames(WARM_FRAMES + 2);
    expect(days.at(-1)).toBeCloseTo(2 * REDUCED_MOTION_DAYS, 9);
    expect(paints()).toBe(2);
  });
});
