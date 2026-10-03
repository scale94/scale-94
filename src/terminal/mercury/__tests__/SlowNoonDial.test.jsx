// src/terminal/mercury/__tests__/SlowNoonDial.test.jsx — THE SLOW NOON dial geometry and render.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SlowNoonDial from '../SlowNoonDial';
import { DIAL, LOUPE, dialXY, loupeXY } from '../slowNoonDialGeometry';
import { DEV_OVERRIDES } from '../mercuryTuning';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('dial geometry', () => {
  it('noon at the top, dawn left, dusk right, midnight bottom', () => {
    const r = 0.38;
    const [nx, ny] = dialXY(12, r), [dx, dy] = dialXY(6, r), [ex, ey] = dialXY(18, r), [mx, my] = dialXY(0, r);
    expect(nx).toBeCloseTo(DIAL.c, 9); expect(ny).toBeLessThan(DIAL.c);
    expect(dx).toBeLessThan(DIAL.c); expect(dy).toBeCloseTo(DIAL.c, 9);
    expect(ex).toBeGreaterThan(DIAL.c); expect(ey).toBeCloseTo(DIAL.c, 9);
    expect(mx).toBeCloseTo(DIAL.c, 9); expect(my).toBeGreaterThan(DIAL.c);
  });

  it('radius grows with distance from the Sun', () => {
    const near = DIAL.c - dialXY(12, 0.31)[1], far = DIAL.c - dialXY(12, 0.46)[1];
    expect(far).toBeGreaterThan(near);
    expect(DIAL.c - dialXY(12, DIAL.rMinAU)[1]).toBeCloseTo(DIAL.rIn, 9);
  });

  it('the loupe centres on perihelion and magnifies the hour angle x22', () => {
    const peri = { hour: 10.85, rAU: 0.3075 };
    expect(loupeXY(peri, peri)).toEqual([LOUPE.x, LOUPE.y]);
    const [x] = loupeXY({ hour: 10.85 + 1 / 15, rAU: 0.3075 }, peri); // +1 degree of hour angle
    expect(x - LOUPE.x).toBeCloseTo(LOUPE.degPx, 9);
  });
});

describe('SlowNoonDial render', () => {
  let container, root;
  beforeEach(() => {
    DEV_OVERRIDES.dateMs = Date.UTC(2026, 9, 3, 12);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    DEV_OVERRIDES.dateMs = null;
  });

  it('shows the name and the three readouts for 2026-10-03', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    const text = container.textContent;
    expect(text).toContain('THE SLOW NOON');
    expect(text).toContain('06:12 · DAWN AT CALORIS');
    expect(text).toContain("SUN 0.461 AU · 2.2× EARTH'S SKY · APPROACHING");
    expect(text).toContain('SUN STANDS IN 34 d · MORNING AT PERIHELION');
  });

  it('dims the hand while Caloris is on the far side', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    expect(container.querySelector('[data-slow-noon-hand]').getAttribute('opacity')).toBe('0.35');
  });

  it('draws two perihelion rings and a loupe', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    expect(container.querySelectorAll('[data-slow-noon-peri]').length).toBe(2);
    expect(container.querySelector('[data-slow-noon-loupe] path')).not.toBeNull();
  });
});
