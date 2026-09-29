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
  it('on mobile shows the colour key and a notes toggle, and reveals every note verbatim only when toggled', () => {
    const { q } = hud({ compact: true });
    const toggle = q('notes-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.style.pointerEvents).toBe('auto');
    for (const s of ['ΔT', 'BOD', 'NO₃', 'DO↓']) expect(q('legend').textContent).toContain(s);
    expect(q('legend-key').style.whiteSpace).toBe('nowrap');
    for (const note of LEGEND_NOTES) expect(q('legend').textContent).not.toContain(note);
    expect(q('notes')).toBeNull();
    fireEvent.click(toggle);
    expect(q('notes-toggle').getAttribute('aria-expanded')).toBe('true');
    for (const note of LEGEND_NOTES) expect(q('notes').textContent).toContain(note);
    expect(q('summary').textContent).toBe('1 VERDICT RECORDED  ·  1 REJECTED');
    fireEvent.click(q('notes-toggle'));
    expect(q('notes-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(q('notes')).toBeNull();
    for (const note of LEGEND_NOTES) expect(q('legend').textContent).not.toContain(note);
  });

  it('keeps the desktop legend notes always visible, with no toggle', () => {
    const { q } = hud();
    expect(q('notes-toggle')).toBeNull();
    for (const note of LEGEND_NOTES) expect(q('legend').textContent).toContain(note);
  });

  it('stacks the tooltip above the legend on mobile, opaque, wrapping within a max width', () => {
    const { container, q } = hud({ compact: true });
    fireEvent.click(container.querySelector('[data-site="preset:usa"]'));
    const tip = q('tooltip');
    const legendBox = q('legend').parentElement;
    // After the legend in document order, and on a higher z-index.
    expect(legendBox.compareDocumentPosition(tip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(Number(tip.style.zIndex)).toBeGreaterThan(Number(legendBox.style.zIndex || 0));
    expect(tip.style.background).toBe('rgb(0, 0, 0)');
    expect(tip.style.maxWidth).not.toBe('');
    expect(tip.style.whiteSpace).toBe('normal');
  });

  it('keeps the desktop tooltip look (translucent, one line per row) but above the legend', () => {
    const { container, q } = hud();
    fireEvent.click(container.querySelector('[data-site="preset:usa"]'));
    const tip = q('tooltip');
    expect(tip.style.background).toBe('rgba(0, 0, 0, 0.9)');
    expect(tip.style.whiteSpace).toBe('nowrap');
    expect(tip.style.maxWidth).toBe('');
    expect(Number(tip.style.zIndex)).toBeGreaterThan(Number(q('legend').parentElement.style.zIndex || 0));
  });

  it('shrinks the ring hit target to the drawn ring on mobile; desktop keeps 16 px', () => {
    const compact = hud({ compact: true });
    const cRing = compact.container.querySelector('[data-site="h1"]');
    expect(cRing.style.width).toBe('10px');
    expect(cRing.style.height).toBe('10px');
    compact.unmount();
    const desk = hud();
    const dRing = desk.container.querySelector('[data-site="h1"]');
    expect(dRing.style.width).toBe('16px');
    expect(dRing.style.height).toBe('16px');
  });

  it('on mobile the rings take no pointer events but stay keyboard-focusable; desktop rings do', () => {
    const compact = hud({ compact: true });
    const cRing = compact.container.querySelector('[data-site="h1"]');
    expect(cRing.style.pointerEvents).toBe('none');
    expect(cRing.tagName).toBe('BUTTON');
    fireEvent.focus(cRing);
    expect(compact.q('tooltip').textContent).toContain('Test site');
    fireEvent.blur(cRing);
    expect(compact.q('tooltip')).toBeNull();
    compact.unmount();
    const desk = hud();
    expect(desk.container.querySelector('[data-site="h1"]').style.pointerEvents).toBe('auto');
  });

  it('opens and dismisses a site tooltip through the imperative handle', () => {
    const { ref, q } = hud({ compact: true });
    act(() => ref.current.openSite('preset:usa'));
    expect(q('tooltip').textContent).toContain('AMBIENT PRESET');
    act(() => ref.current.openSite(null));
    expect(q('tooltip')).toBeNull();
  });

  it('on mobile a press anywhere else (page, notes toggle) dismisses an open tooltip', () => {
    const { ref, q } = hud({ compact: true });
    act(() => ref.current.openSite('preset:usa'));
    fireEvent.pointerDown(document.body);
    expect(q('tooltip')).toBeNull();
    act(() => ref.current.openSite('h1'));
    fireEvent.pointerDown(q('notes-toggle'));
    expect(q('tooltip')).toBeNull();
  });

  it('on desktop a press elsewhere leaves a hovered tooltip to mouseleave/blur, as before', () => {
    const { container, q } = hud();
    fireEvent.mouseEnter(container.querySelector('[data-site="h1"]'));
    fireEvent.pointerDown(document.body);
    expect(q('tooltip')).toBeTruthy();
  });
});

