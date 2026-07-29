import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ScentGlyph from '../ScentGlyph';

describe('ScentGlyph', () => {
  it('renders an svg that forwards className, like a lucide icon', () => {
    const { container } = render(<ScentGlyph className="w-3 h-3" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toBe('w-3 h-3');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('is legible at 12px: at most two stroked paths, no fills', () => {
    // Spec §3.1 — richer glyphs turn to mush at w-3 h-3. This is a design
    // constraint with teeth, so it is asserted rather than commented.
    const { container } = render(<ScentGlyph className="x" />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeLessThanOrEqual(2);
    expect(container.querySelector('svg').getAttribute('fill')).toBe('none');
  });
});
