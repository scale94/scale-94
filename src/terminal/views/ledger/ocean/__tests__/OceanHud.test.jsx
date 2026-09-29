import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import OceanHud from '../OceanHud';
import { HUD_TITLE, LEGEND_NOTES, MODE_LABEL, PROBE_HINT, PROBE_NOTE, PRESET_COLOR } from '../hudFormat';

const SITES = [
  { id: 'preset:usa', kind: 'preset', name: 'Lower Mississippi at New Orleans, USA', status: null, color: PRESET_COLOR,
    site: [-90.07, 29.95], snap: [-89.3, 29.0], snapKm: 12, dischargeM3s: 16570, doMin: 4.2, rkm: 0 },
  { id: 'h1', kind: 'verdict', name: 'Test site', status: 'REJECTED', color: '#ef4444',
    site: [120.6, 31.3], snap: [122.1, 31.0], snapKm: 140, dischargeM3s: 42, doMin: 3.1, rkm: 12 },
];
const hud = (props = {}) => {
  const ref = createRef();
  const out = render(
    <OceanHud ref={ref} daysPerSecond={9} onCycleCompression={() => {}} sites={SITES}
      verdicts={[{ status: 'REJECTED' }]} {...props} />,
  );
  return { ref, ...out, q: (k) => out.container.querySelector(`[data-hud="${k}"]`) };
};

describe('OceanHud', () => {
  it('lays out the full HUD on desktop', () => {
    const { q } = hud();
    expect(screen.getByText(HUD_TITLE)).toBeTruthy();
    expect(q('summary').textContent).toBe('1 VERDICT RECORDED  ·  1 REJECTED');
    for (const note of LEGEND_NOTES) expect(q('legend').textContent).toContain(note);
    for (const s of ['ΔT', 'BOD', 'NO₃', 'DO↓']) expect(q('legend').textContent).toContain(s);
    expect(q('probe').textContent).toBe(PROBE_HINT);
    expect(q('compression').textContent).toBe('1 s = 9 d');
    expect(q('frame')).toBeTruthy();
  });

  it('collapses on mobile to the clock top-left and the legend bottom-left', () => {
    const { q } = hud({ compact: true });
    expect(screen.queryByText(HUD_TITLE)).toBeNull();
    expect(q('summary')).toBeNull();
    expect(q('frame')).toBeNull();
    expect(q('probe')).toBeNull();
    expect(q('clock')).toBeTruthy();
    expect(q('compression')).toBeTruthy();
    expect(q('legend')).toBeTruthy();
  });

  it('shows a tapped probe in place of the legend on mobile, then gives the legend back', () => {
    const { ref, q } = hud({ compact: true });
    act(() => ref.current.setProbe('0.0°N 0.0°E · LAND'));
    expect(q('probe').textContent).toBe('0.0°N 0.0°E · LAND');
    expect(screen.getByText(PROBE_NOTE)).toBeTruthy();
    expect(q('legend')).toBeNull();
    act(() => ref.current.setProbe(null));
    expect(q('legend')).toBeTruthy();
  });

  it('writes the clock on every change but the frame monitor at most every 250 ms', () => {
    const { ref, q } = hud();
    act(() => ref.current.setFrame({ simDays: 1.25, frameMs: 16, now: 0 }));
    expect(q('clock').textContent).toBe('T+ 1.25 d');
    expect(q('frame').textContent).toBe('Δt 16.0 ms · 63 Hz');
    act(() => ref.current.setFrame({ simDays: 1.5, frameMs: 2.8, now: 100 }));
    expect(q('clock').textContent).toBe('T+ 1.50 d');
    expect(q('frame').textContent).toBe('Δt 16.0 ms · 63 Hz');
    act(() => ref.current.setFrame({ simDays: 1.5, frameMs: 2.8, now: 250 }));
    expect(q('frame').textContent).toBe('Δt 2.8 ms · 357 Hz');
  });

  it('cycles compression through its control', () => {
    const onCycle = vi.fn();
    hud({ onCycleCompression: onCycle });
    fireEvent.click(screen.getByRole('button', { name: /Time compression/ }));
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('rings each source site and shows its tooltip on hover and on tap', () => {
    const { container, q } = hud({ latestHash: 'h1' });
    const ring = container.querySelector('[data-site="h1"]');
    expect(ring.style.left.endsWith('%')).toBe(true);
    expect(parseFloat(ring.style.left)).toBeCloseTo(((120.6 + 180) / 360) * 100, 6);
    expect(parseFloat(ring.style.top)).toBeCloseTo(((90 - 31.3) / 180) * 100, 6);
    expect(container.querySelector('[data-site="preset:usa"]')).toBeTruthy();
    fireEvent.mouseEnter(ring);
    expect(q('tooltip').textContent).toContain('Q 42 m³/s · 0.25% OF MISSISSIPPI');
    expect(q('tooltip').textContent).toContain('SNAP 140 km TO OCEAN');
    fireEvent.mouseLeave(ring);
    expect(q('tooltip')).toBeNull();
    fireEvent.click(container.querySelector('[data-site="preset:usa"]'));
    expect(q('tooltip').textContent).toContain('AMBIENT PRESET');
  });

  it('keeps the tooltip up through a real tap or click (enter, focus, then click)', () => {
    const { container, q } = hud();
    const ring = container.querySelector('[data-site="h1"]');
    fireEvent.mouseEnter(ring);
    fireEvent.focus(ring);
    fireEvent.click(ring);
    expect(q('tooltip')).toBeTruthy();
    expect(q('tooltip').textContent).toContain('Test site');
    fireEvent.blur(ring);
    fireEvent.mouseLeave(ring);
    expect(q('tooltip')).toBeNull();
  });

  it('shows the mode label instead of the clock when the ocean is not live', () => {
    const { q } = hud({ mode: 'static' });
    expect(q('mode').textContent).toBe(MODE_LABEL.static);
    expect(q('clock')).toBeNull();
  });

  it('says the ocean is still under reduced motion and offers no compression control', () => {
    const { q } = hud({ reducedMotion: true });
    expect(q('clock')).toBeTruthy();
    expect(q('compression')).toBeNull();
    expect(screen.getByText(/STILL · REDUCED MOTION/)).toBeTruthy();
  });
});
