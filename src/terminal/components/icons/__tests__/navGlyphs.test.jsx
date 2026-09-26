import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import InterceptIcon from '../InterceptIcon';
import SeraphineScaleIcon from '../SeraphineScaleIcon';
import PacketIcon from '../PacketIcon';
import LedgerSealIcon from '../LedgerSealIcon';
import KernelCoreIcon from '../KernelCoreIcon';
import AirgapIcon from '../AirgapIcon';
import LatticeIcon from '../LatticeIcon';
import EarthshineMoonIcon from '../EarthshineMoonIcon';

// The nav-glyph contract (spec 2026-09-26 §1, §5): each glyph is a drop-in for
// a lucide icon, and stays legible at w-3 h-3. The budget is asserted rather
// than commented, so detail creep fails CI instead of blurring the nav.
describe.each([
  ['InterceptIcon', InterceptIcon],
  ['SeraphineScaleIcon', SeraphineScaleIcon],
  ['PacketIcon', PacketIcon],
  ['LedgerSealIcon', LedgerSealIcon],
  ['KernelCoreIcon', KernelCoreIcon],
  ['AirgapIcon', AirgapIcon],
  ['LatticeIcon', LatticeIcon],
  ['EarthshineMoonIcon', EarthshineMoonIcon],
])('%s', (name, Glyph) => {
  it('renders one svg that forwards className, like a lucide icon', () => {
    const { container } = render(<Glyph className="w-3 h-3" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    expect(svgs[0].getAttribute('class')).toBe('w-3 h-3');
    expect(svgs[0].getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svgs[0].getAttribute('stroke')).toBe('currentColor');
    expect(svgs[0].getAttribute('stroke-width')).toBe('2');
    expect(svgs[0].getAttribute('stroke-linecap')).toBe('round');
    expect(svgs[0].getAttribute('stroke-linejoin')).toBe('round');
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards a ref to the svg element', () => {
    const ref = React.createRef();
    render(<Glyph ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current.tagName.toLowerCase()).toBe('svg');
  });

  it('is legible at 12px: at most 5 drawn elements, nothing filled', () => {
    const { container } = render(<Glyph />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('fill')).toBe('none');
    const drawn = svg.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(5);
    drawn.forEach((el) => {
      const fill = el.getAttribute('fill');
      expect(fill === null || fill === 'none').toBe(true);
    });
  });

  it('keeps every stroke at the svg-level 2px, except the sanctioned earthshine limb', () => {
    // Tier-4 spec §1: EarthshineMoonIcon's limb is 1px at 55% opacity on
    // purpose (at 2px the crescent reads as a full disc). Assert the exception
    // so it can't be "normalised", and so no other glyph grows a thin stroke.
    const { container } = render(<Glyph />);
    const svg = container.querySelector('svg');
    const overrides = [...svg.querySelectorAll('[stroke-width]')].filter((el) => el !== svg);
    if (name === 'EarthshineMoonIcon') {
      expect(overrides).toHaveLength(1);
      expect(overrides[0].getAttribute('stroke-width')).toBe('1');
      expect(overrides[0].getAttribute('opacity')).toBe('0.55');
    } else {
      expect(overrides).toHaveLength(0);
    }
  });

  it('carries its own name for React devtools', () => {
    expect(Glyph.displayName).toBe(name);
  });
});
