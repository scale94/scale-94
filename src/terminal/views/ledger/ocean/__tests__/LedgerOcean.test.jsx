import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import { OCEAN_GRID, DT_DAYS } from '../../../../ledger/ocean/grid';
import { diffusionSchedule, EDDY_DIFFUSIVITY_KM2_DAY } from '../../../../ledger/ocean/referenceStep';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME } from '../oceanDriver';
import { MODE_LABEL, PARTICLE_PX, PROBE_HINT, PROBE_TAP_HOLD_MS, formatClock, describeSites } from '../hudFormat';
import { verdictSources, buildSource, ghostSourceSpec, SPLAT_SIGMA_CELLS } from '../../../../ledger/ocean/sources';
import { packSourceRows } from '../../../../ledger/ocean/gpu/gpuData';
import { getOceanWorld } from '../../../../ledger/ocean/oceanWorld';
import {
  prepareRiver, fillParticles, PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE, MIN_CYCLE_S,
} from '../../../../ledger/ocean/riverStage';
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
const quads = () => rec.log.filter((e) => e[0] === 'drawArrays' && e[1] === rec.gl.TRIANGLE_STRIP).length;
const pointDraws = () => rec.log.filter((e) => e[0] === 'drawArrays' && e[1] === rec.gl.POINTS);
const particleUploads = () => rec.log.filter((e) => e[0] === 'bufferData' && Array.isArray(e[2]) && e[2].length > 8);
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
    const drawsAtMount = quads();
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
    expect(quads() - drawsAtMount).toBe(expected * (4 + sub) + FRAMES);
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
    act(() => { fireEvent.pointerUp(canvas, { pointerType: 'touch', clientX: 180, clientY: 90 }); });
    m.frames(1);
    expect(screen.getByText(/^0\.0°N 0\.0°E · ΔT/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(PROBE_TAP_HOLD_MS); });
    expect(screen.queryByText(/^0\.0°N 0\.0°E/)).toBeNull();
  });

  it('does not probe a touch that moves (a scroll starting on the hero)', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    const before = count('readPixels');
    act(() => { fireEvent.pointerDown(canvas, { pointerType: 'touch', clientX: 180, clientY: 90 }); });
    m.frames(1);
    act(() => { fireEvent.pointerUp(canvas, { pointerType: 'touch', clientX: 180, clientY: 130 }); });
    m.frames(3);
    expect(count('readPixels')).toBe(before);
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
    expect(m.container.querySelectorAll('[data-site^="preset:"]')).toHaveLength(9);
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

  // Compact (360 px): rings take no pointer events; a tap within 6 px of a
  // ring centre opens its tooltip, anything further probes and dismisses.
  const tap = (canvas, x, y, pointerType = 'touch') => {
    act(() => { fireEvent.pointerDown(canvas, { pointerType, clientX: x, clientY: y }); });
    act(() => { fireEvent.pointerUp(canvas, { pointerType, clientX: x, clientY: y }); });
  };
  const ringPx = (container, id, w, h) => {
    const b = container.querySelector(`[data-site="${id}"]`);
    return [(parseFloat(b.style.left) / 100) * w, (parseFloat(b.style.top) / 100) * h];
  };
  // The first point exactly 8 px from (x, y) on a 360×180 canvas (1 px per
  // degree) that is an ocean cell, so the probe does a readback.
  const waterAt8px = (x, y) => {
    const { grid, mask } = getOceanWorld();
    for (let a = 0; a < 360; a += 15) {
      const px = x + 8 * Math.cos((a * Math.PI) / 180);
      const py = y + 8 * Math.sin((a * Math.PI) / 180);
      const { i, j } = grid.lonLatToCell(-180 + px, 90 - py);
      if (!mask.land[grid.idx(i, j)]) return [px, py];
    }
    return null;
  };

  it('on a phone, a tap at a ring centre opens its tooltip and does not probe', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    const [x, y] = ringPx(m.container, 'preset:usa', 360, 180);
    const before = count('readPixels');
    tap(canvas, x, y);
    m.frames(3);
    expect(m.container.querySelector('[data-hud="tooltip"]').textContent).toContain('AMBIENT PRESET');
    expect(m.container.querySelector('[data-hud="tooltip"]').textContent).toContain('Mississippi');
    expect(count('readPixels')).toBe(before);
    expect(m.container.querySelector('[data-hud="probe"]')).toBeNull();
  });

  it('on a phone, a tap 8 px from a ring probes with a readback and dismisses an open tooltip', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    const [x, y] = ringPx(m.container, 'preset:usa', 360, 180);
    tap(canvas, x, y);
    expect(m.container.querySelector('[data-hud="tooltip"]')).toBeTruthy();
    const off = waterAt8px(x, y);
    expect(off).not.toBeNull();
    const before = count('readPixels');
    tap(canvas, off[0], off[1]);
    m.frames(1);
    expect(m.container.querySelector('[data-hud="tooltip"]')).toBeNull();
    expect(count('readPixels')).toBe(before + 1);
    expect(m.container.querySelector('[data-hud="probe"]').textContent).toMatch(/°N .*°W · /);
  });

  it('on a phone, a mouse click at a ring centre also opens its tooltip', () => {
    const m = mountLive(<LedgerOcean width={360} height={180} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 360, height: 180, right: 360, bottom: 180 });
    const [x, y] = ringPx(m.container, 'preset:usa', 360, 180);
    tap(canvas, x, y, 'mouse');
    expect(m.container.querySelector('[data-hud="tooltip"]').textContent).toContain('AMBIENT PRESET');
  });

  it('on desktop, the rings take pointer events and a canvas tap near one only probes', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    const canvas = screen.getByLabelText(/Ledger ocean/);
    canvas.getBoundingClientRect = () => ({ ...RECT, width: 1024, height: 512, right: 1024, bottom: 512 });
    expect(m.container.querySelector('[data-site="preset:usa"]').style.pointerEvents).toBe('auto');
    const [x, y] = ringPx(m.container, 'preset:usa', 1024, 512);
    tap(canvas, x, y);
    m.frames(1);
    expect(m.container.querySelector('[data-hud="tooltip"]')).toBeNull();
    // The site is inland (New Orleans): the probe reads LAND, but it probed.
    expect(m.container.querySelector('[data-hud="probe"]').textContent).toMatch(/°N .*°W · LAND$/);
  });

  it('stops asking for frames once the reduced-motion ocean is settled', () => {
    reduceMotion();
    const days = [];
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={(d) => days.push(d)} />);
    m.frames(WARM_FRAMES + 5);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(days).toHaveLength(WARM_FRAMES);          // mount chunk + one frame per remaining chunk, no idling
    m.frames(30);
    expect(days).toHaveLength(WARM_FRAMES);
  });

  it('probes a held reduced-motion ocean on demand', () => {
    reduceMotion();
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.frames(WARM_FRAMES + 2);
    rec.gl.readPixels = (...a) => { rec.log.push(['readPixels', ...a.slice(0, 6)]); a[6].set([0.02, 0.14, 0.8, 0.3]); };
    act(() => { fireEvent.pointerMove(oceanCanvas(), { pointerType: 'mouse', clientX: 256, clientY: 128 }); });
    m.frames(1);
    expect(count('readPixels')).toBe(1);
    expect(screen.getByText(/ΔT 0\.02 °C/)).toBeTruthy();
  });

  it('holds the reduced-motion warm-up until the archive has loaded, then warms once', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={512} height={256} onFrame={onFrame} sourcesReady={false} />);
    m.frames(10);
    expect(days.every((d) => d === 0)).toBe(true);
    expect(paints()).toBe(0);
    m.rerender(<LedgerOcean width={512} height={256} onFrame={onFrame} sourcesReady verdicts={[V]} />);
    m.frames(WARM_FRAMES + 2);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);   // T+ 200 d with the archive, not 400
    expect(paints()).toBe(1);
  });
});

const G = { lat: 30.59, lon: 114.3, siteName: 'Ghost site', temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42 };
const subUploads = () => rec.log.filter((e) => e[0] === 'texSubImage2D');
const fullUploads = () => rec.log.filter((e) => e[0] === 'texImage2D' && e[4] === 512 && e[5] === 256).length;
const SPLAT_ROWS = 2 * Math.ceil(3 * SPLAT_SIGMA_CELLS) + 1;

describe('LedgerOcean ghost', () => {
  it('writes the ghost into the source texture by row bands, never by a full upload', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.frames(2);
    const full = fullUploads();
    const { grid, mask, ambientSourceData } = getOceanWorld();
    m.rerender(<LedgerOcean width={1024} height={512} ghost={G} />);
    m.frames(1);
    const first = subUploads();
    expect(first.length).toBeGreaterThan(0);
    const ghostSrc = buildSource(ghostSourceSpec(G), grid, mask);
    let rows = 0;
    for (const e of first) {
      const [, , level, x, y, w, h] = e;
      expect([level, x, w]).toEqual([0, 0, 512]);
      rows += h;
      expect(e[9]).toEqual(Array.from(packSourceRows(grid, mask.land, ambientSourceData, [ghostSrc], y, h)));
    }
    expect(rows).toBeLessThanOrEqual(SPLAT_ROWS);
    expect(fullUploads()).toBe(full);
    expect(m.container.querySelector('[data-site="ghost"]')).toBeTruthy();

    // Moving the ghost rewrites its old and new rows; clearing it restores the permanent rows.
    const moved = { ...G, lat: 22.3, lon: 113.9 };
    m.rerender(<LedgerOcean width={1024} height={512} ghost={moved} />);
    m.frames(1);
    const afterMove = subUploads().length;
    expect(afterMove).toBeGreaterThan(first.length);
    m.rerender(<LedgerOcean width={1024} height={512} ghost={null} />);
    m.frames(1);
    const cleared = subUploads().slice(afterMove);
    expect(cleared.length).toBeGreaterThan(0);
    for (const e of cleared) {
      const y = e[4];
      const h = e[6];
      expect(e[9]).toEqual(Array.from(ambientSourceData.slice(y * 512 * 4, (y + h) * 512 * 4)));
    }
    expect(fullUploads()).toBe(full);
    expect(m.container.querySelector('[data-site="ghost"]')).toBeNull();
  });

  it('never restarts a held reduced-motion warm-up', () => {
    reduceMotion();
    const days = [];
    const onFrame = (d) => days.push(d);
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={onFrame} />);
    m.frames(WARM_FRAMES + 2);
    expect(paints()).toBe(1);
    const full = fullUploads();
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} ghost={G} />);
    m.frames(3);
    m.rerender(<LedgerOcean width={1024} height={512} onFrame={onFrame} ghost={{ ...G, bod: 30 }} />);
    m.frames(3);
    expect(days.at(-1)).toBeCloseTo(REDUCED_MOTION_DAYS, 9);
    expect(fullUploads()).toBe(full);
    expect(subUploads().length).toBeGreaterThan(0);
    expect(paints()).toBe(3);   // the held frame repaints once per ghost change (its parcels), no more
  });

  it('re-adds the ghost after a full upload of the permanent sources', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} ghost={G} />);
    m.frames(1);
    m.rerender(<LedgerOcean width={1024} height={512} ghost={G} verdicts={[V]} />);
    m.frames(1);
    const lastFull = rec.log.findLastIndex((e) => e[0] === 'texImage2D' && e[4] === 512 && e[5] === 256);
    const lastSub = rec.log.findLastIndex((e) => e[0] === 'texSubImage2D');
    expect(lastSub).toBeGreaterThan(lastFull);
  });
});


describe('LedgerOcean river stage', () => {
  it('draws 256 parcels per river after each composite, filled from the exact kinetics at the display time', () => {
    const disp = [];
    const m = mountLive(<LedgerOcean width={1024} height={512} onFrame={(_d, dd) => disp.push(dd)} />);
    m.frames(5);
    const rivers = getOceanWorld().sources.map((s) => prepareRiver(s)).filter(Boolean);
    expect(rivers.length).toBeGreaterThanOrEqual(5);
    const n = rivers.length * PARTICLES_PER_RIVER;
    expect(pointDraws()).toHaveLength(paints());                 // one parcel draw per composite
    expect(pointDraws().at(-1)).toEqual(['drawArrays', rec.gl.POINTS, 0, n]);
    // Constant 9 d/s: each river's accumulated phase is D / max(T, MIN_CYCLE_S × 9).
    const D = disp.at(-1);
    expect(D).toBeGreaterThan(0);
    const expected = new Float32Array(n * FLOATS_PER_PARTICLE);
    fillParticles(rivers, rivers.map((r) => {
      const u = D / Math.max(r.travelDays, MIN_CYCLE_S * 9);
      return u - Math.floor(u);
    }), expected);
    const got = particleUploads().at(-1)[2];
    expect(got).toHaveLength(expected.length);
    got.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
    expect(rec.log).toContainEqual(['uniform1f', expect.stringMatching(/:uSize$/), PARTICLE_PX]);
  });

  it('glides between sim steps: parcels move every frame on wall time with no step taken', () => {
    const sim = [];
    const disp = [];
    const m = mountLive(
      <LedgerOcean width={1024} height={512} daysPerSecond={1} onFrame={(d, dd) => { sim.push(d); disp.push(dd); }} />,
    );
    const before = particleUploads().length;
    m.frames(10);   // 160 ms at 1 d/s = 0.16 d: no 0.25 d step yet
    expect(sim.at(-1)).toBe(0);
    expect(disp.at(-1)).toBeCloseTo(0.16, 9);
    const ups = particleUploads().slice(before);
    expect(ups).toHaveLength(10);                                // one re-fill per frame
    expect(ups[9][2][0]).not.toBe(ups[0][2][0]);                // parcel 0 has moved
    // At 1 d/s the Danube (T ≈ 23 d ≥ 6 s × 1 d/s) runs literal; short rivers are slowed.
    const rivers = getOceanWorld().sources.map((s) => prepareRiver(s)).filter(Boolean);
    const expected = new Float32Array(rivers.length * PARTICLES_PER_RIVER * FLOATS_PER_PARTICLE);
    fillParticles(rivers, rivers.map((r) => disp.at(-1) / Math.max(r.travelDays, MIN_CYCLE_S * 1)), expected);
    ups[9][2].forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
  });

  it('runs the ocean without parcels when the particle program fails to build', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'] });
    rec = installRecordingGL({ version: 2, extensions: FLOAT });
    let links = 0;
    // link 1 = display program, 2..6 = the five sim programs, 7 = particles.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 7; };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={1024} height={512} />);
    act(() => { vi.advanceTimersByTime(48); });
    expect(err).toHaveBeenCalled();
    expect(pointDraws()).toHaveLength(0);
    expect(quads()).toBeGreaterThan(1);                         // the sim still steps and paints
    expect(screen.queryByText(MODE_LABEL['static-shader'])).toBeNull();
    expect(count('createProgram') - count('deleteProgram')).toBe(6);
  });

  it('releases the parcel program, VAO and buffer on unmount', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} />);
    m.unmount();
    expect(count('deleteProgram')).toBe(count('createProgram'));
    expect(count('deleteVertexArray')).toBe(count('createVertexArray'));
    expect(count('deleteBuffer')).toBe(count('createBuffer'));
  });

  it('ticks the DO minimum on every drawn course', () => {
    const m = mountLive(<LedgerOcean width={1024} height={512} verdicts={[V]} />);
    const { grid, mask, sources } = getOceanWorld();
    const expected = describeSites([...sources, ...verdictSources([V], grid, mask)], [V]).filter((s) => s.tick);
    expect(expected.length).toBeGreaterThanOrEqual(10);
    expect(m.container.querySelectorAll('[data-hud="domin-tick"]')).toHaveLength(expected.length);
  });
});
