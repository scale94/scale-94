import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import OceanHud from '../OceanHud';
import { SEAL_FLARE_MS } from '../clockEase';
import { GHOST_COLOR, GHOST_DASH, HUD_TITLE, LEGEND_NOTES, MODE_LABEL, PROBE_HINT, PROBE_NOTE, PRESET_COLOR } from '../hudFormat';

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

  it('draws a DO_MIN tick across the course where a site has one', () => {
    const withTick = [{ ...SITES[1], tick: { lon: 0, lat: 0, angleDeg: -90 } }, SITES[0]];
    const { container } = hud({ sites: withTick });
    const ticks = container.querySelectorAll('[data-hud="domin-tick"]');
    expect(ticks).toHaveLength(1);
    expect(ticks[0].getAttribute('data-tick')).toBe('h1');
    expect(ticks[0].style.left).toBe('50%');
    expect(ticks[0].style.top).toBe('50%');
    expect(ticks[0].style.transform).toBe('translate(-50%, -50%) rotate(-90deg)');
    expect(ticks[0].style.height).toBe('7px');
    expect(ticks[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('draws no DO_MIN ticks on a compact HUD (the ring tooltip carries DO_MIN); desktop draws one per course', () => {
    const withTicks = [
      { ...SITES[0], tick: { lon: -89.5, lat: 29.3, angleDeg: 45 } },
      { ...SITES[1], tick: { lon: 121, lat: 31.2, angleDeg: -90 } },
    ];
    const compact = hud({ sites: withTicks, compact: true });
    expect(compact.container.querySelectorAll('[data-hud="domin-tick"]')).toHaveLength(0);
    compact.unmount();
    const desk = hud({ sites: withTicks });
    expect(desk.container.querySelectorAll('[data-hud="domin-tick"]')).toHaveLength(2);
  });

  it('thins the ring of a course shorter than the ring (1 px); a long course keeps the normal stroke', () => {
    const sized = [
      { ...SITES[0], courseCssPx: 3.3 },                            // Mississippi-like: inside the 8 px ring
      { ...SITES[1], courseCssPx: 55 },                             // Danube-like: well outside it
      { ...SITES[1], id: 'h9', courseCssPx: null },                 // unknown length: normal
    ];
    const { container } = hud({ sites: sized });
    const border = (id) => container.querySelector(`[data-site="${id}"] span`).style.borderWidth;
    expect(border('preset:usa')).toBe('1px');
    expect(border('h1')).toBe('1.5px');
    expect(border('h9')).toBe('1.5px');
    // The latest ring is 12 px across on desktop: a 10 px course is inside it.
    const latest = hud({ sites: [{ ...SITES[1], courseCssPx: 10 }], latestHash: 'h1' });
    expect(latest.container.querySelector('[data-site="h1"] span').style.borderWidth).toBe('1px');
    const latestLong = hud({ sites: [{ ...SITES[1], courseCssPx: 13 }], latestHash: 'h1' });
    expect(latestLong.container.querySelector('[data-site="h1"] span').style.borderWidth).toBe('2px');
    // No ring has a fill that could dim the parcels under it.
    for (const b of container.querySelectorAll('[data-site]')) {
      expect(b.style.background).toBe('transparent');
      expect(b.querySelector('span').style.background).toBe('');
    }
  });

  it('stacks the DO_MIN ticks above the ring buttons on desktop (after them in DOM order)', () => {
    const withTick = [{ ...SITES[1], tick: { lon: 0, lat: 0, angleDeg: -90 } }, SITES[0]];
    const { container } = hud({ sites: withTick });
    const tick = container.querySelector('[data-hud="domin-tick"]');
    for (const ring of container.querySelectorAll('[data-site]')) {
      expect(ring.compareDocumentPosition(tick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(tick.style.zIndex).toBe('');   // same stacking context: DOM order decides
  });

  it('draws the ghost dashed and labelled PROVISIONAL; sealed lines stay solid', () => {
    const ghost = { id: 'ghost', kind: 'ghost', name: 'Ghost site', status: null, color: GHOST_COLOR,
      site: [114.3, 30.59], snap: [121.5, 30.5], snapKm: 700, dischargeM3s: 42, doMin: 3, rkm: 0 };
    const { container, q } = hud({ sites: [...SITES, ghost] });
    expect(q('ghost-label').textContent).toBe('PROVISIONAL');
    expect(container.querySelector('[data-site="ghost"] span').style.borderStyle).toBe('dashed');
    expect(container.querySelector('[data-site="h1"] span').style.borderStyle).toBe('solid');
    expect(container.querySelector('line[data-line="ghost"]').getAttribute('stroke-dasharray')).toBe('4 3');
    expect(container.querySelector('line[data-line="h1"]').getAttribute('stroke-dasharray')).toBeNull();
  });

  it('places the PROVISIONAL label inside the hero and off other rings', () => {
    const ghostAt = (site) => ({ id: 'ghost', kind: 'ghost', name: 'Ghost site', status: null, color: GHOST_COLOR,
      site, snap: site, snapKm: 0, dischargeM3s: 42, doMin: 3, rkm: 0 });
    const size = { width: 1024, height: 512 };
    // Open water: right of the ring, on its line.
    const open = hud({ ...size, sites: [...SITES, ghostAt([-30, -30])] });
    let label = open.q('ghost-label');
    expect(label.getAttribute('data-side')).toBe('right');
    expect(label.style.left).toContain('11px');
    expect(label.style.right).toBe('');
    expect(label.style.top).toBe(`${((90 + 30) / 180) * 100}%`);
    open.unmount();
    // Near the right edge (x = 990 px): flipped left, its right edge 11 px left of the ring.
    const edge = hud({ ...size, sites: [...SITES, ghostAt([(990 / 1024) * 360 - 180, -30])] });
    label = edge.q('ghost-label');
    expect(label.getAttribute('data-side')).toBe('left');
    expect(label.style.left).toBe('');
    expect(label.style.right).toContain('11px');
    edge.unmount();
    // Beside another ring (Wuhan ghost, Yangtze-mouth ring 20 px east): nudged a ring diameter.
    const yangtze = { ...SITES[0], id: 'preset:yangtze', site: [121.515, 31.3925] };
    const near = hud({ ...size, sites: [yangtze, ghostAt([114.3, 30.59])] });
    label = near.q('ghost-label');
    expect(label.getAttribute('data-side')).toBe('right');
    expect(label.style.top).toMatch(/\+ 16px\)$/);
    near.unmount();
    // Without a hero size (no measurements): the default placement.
    const unsized = hud({ sites: [yangtze, ghostAt([114.3, 30.59])] });
    expect(unsized.q('ghost-label').getAttribute('data-side')).toBe('right');
    expect(unsized.q('ghost-label').style.top).toBe(`${((90 - 30.59) / 180) * 100}%`);
  });

  it('while sealing: the line keeps the ghost dashes and a solid stroke closes them behind the flare', () => {
    const { container } = hud({ sealId: 'h1', width: 1024, height: 512 });
    const lines = [...container.querySelectorAll('line[data-line="h1"]')];
    expect(lines).toHaveLength(2);
    const [dash, close] = lines;
    for (const l of lines) {
      expect(l.getAttribute('data-sealing')).toBe('true');
      // Same geometry, starting at the audit site: the flare's start end (riverStage.writeFlare, frac 0 = course[0]).
      expect(Number(l.getAttribute('x1'))).toBeCloseTo(120.6 + 180, 9);
      expect(Number(l.getAttribute('y1'))).toBeCloseTo(90 - 31.3, 9);
      expect(Number(l.getAttribute('x2'))).toBeCloseTo(122.1 + 180, 9);
      expect(Number(l.getAttribute('y2'))).toBeCloseTo(90 - 31.0, 9);
    }
    expect(dash.getAttribute('stroke-dasharray')).toBe(GHOST_DASH);
    expect(dash.style.animation).toBe('');
    expect(dash.style.animationName).toBe('');
    // L = the line's on-screen length (non-scaling stroke: Chrome dashes in css px).
    const L = Math.hypot(((122.1 - 120.6) / 360) * 1024, ((31.3 - 31.0) / 180) * 512);
    const [a, b] = close.getAttribute('stroke-dasharray').split(' ').map(Number);
    expect(a).toBeCloseTo(L, 3);
    expect(b).toBeCloseTo(L, 3);
    // The flare's clock: SEAL_FLARE_MS, linear in time (frac = elapsed / SEAL_FLARE_MS) and in
    // position (a verdict course is one straight segment), played forwards once.
    expect(close.style.animationName).toBe('ocean-seal-close');
    expect(close.style.animationDuration).toBe(`${SEAL_FLARE_MS}ms`);
    expect(close.style.animationTimingFunction).toBe('linear');
    expect(close.style.animationDirection).toBe('normal');
    expect(close.style.animationIterationCount).toBe('1');
    expect(close.style.animationFillMode).toBe('both');
    // Offset L → 0 with dasharray L L reveals from x1 (the site) towards x2 (the mouth).
    const css = container.querySelector('style').textContent.replace(/\s+/g, ' ');
    const m = css.match(/@keyframes ocean-seal-close \{ from \{ stroke-dashoffset: ([\d.]+)px; \} to \{ stroke-dashoffset: 0px?; \} \}/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeCloseTo(L, 3);
    expect(css).not.toContain('ocean-seal-dash');
  });

  it('under reduced motion the sealed line is one solid line with no animation; after the seal, the normal line', () => {
    const still = hud({ sealId: 'h1', reducedMotion: true, width: 1024, height: 512 });
    let lines = still.container.querySelectorAll('line[data-line="h1"]');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('stroke-dasharray')).toBeNull();
    expect(lines[0].style.animation).toBe('');
    expect(lines[0].style.animationName).toBe('');
    still.unmount();
    const after = hud({ sealId: null, width: 1024, height: 512 });
    lines = after.container.querySelectorAll('line[data-line="h1"]');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('stroke-dasharray')).toBeNull();
    expect(lines[0].getAttribute('data-sealing')).toBeNull();
    expect(lines[0].style.animation).toBe('');
    expect(lines[0].style.animationName).toBe('');
  });

  it('is one tab stop: arrow keys, Home and End rove between the rings', () => {
    const { container } = hud();
    expect(screen.getByRole('group', { name: 'Audit sites' })).toBeTruthy();
    const rings = [...container.querySelectorAll('[data-site]')];
    expect(rings.map((r) => r.tabIndex)).toEqual([0, -1]);
    rings[0].focus();
    fireEvent.keyDown(rings[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rings[1]);
    expect(rings.map((r) => r.tabIndex)).toEqual([-1, 0]);
    fireEvent.keyDown(rings[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rings[0]);
    fireEvent.keyDown(rings[0], { key: 'End' });
    expect(document.activeElement).toBe(rings[1]);
    fireEvent.keyDown(rings[1], { key: 'Home' });
    expect(document.activeElement).toBe(rings[0]);
  });

  it('gives the notes toggle one stable label, its state, and what it controls', () => {
    const { q } = hud({ compact: true });
    const toggle = q('notes-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Legend notes');
    fireEvent.click(toggle);
    expect(q('notes-toggle').getAttribute('aria-label')).toBe('Legend notes');
    expect(q('notes-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(q('notes').id).toBeTruthy();
    expect(q('notes-toggle').getAttribute('aria-controls')).toBe(q('notes').id);
  });
  it('leaves modified arrows to the browser (Alt+Arrow is history)', () => {
    const { container } = hud();
    const rings = [...container.querySelectorAll('[data-site]')];
    rings[0].focus();
    const notPrevented = fireEvent.keyDown(rings[0], { key: 'ArrowRight', altKey: true });
    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(rings[0]);
    expect(rings.map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it('keeps exactly one tab stop when the sites shrink under the roved ring', () => {
    const three = [...SITES, { ...SITES[1], id: 'h2', name: 'Third' }];
    const { container, rerender } = hud({ sites: three });
    const rings = [...container.querySelectorAll('[data-site]')];
    rings[0].focus();
    fireEvent.keyDown(rings[0], { key: 'End' });
    expect(rings.map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
    rerender(<OceanHud daysPerSecond={9} onCycleCompression={() => {}} sites={SITES} verdicts={[{ status: 'REJECTED' }]} />);
    const after = [...container.querySelectorAll('[data-site]')];
    expect(after.filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });
});
