import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SolGlyph from '../SolGlyph';

describe('SolGlyph', () => {
  it('renders an svg that forwards className and is aria-hidden', () => {
    const { container } = render(<SolGlyph className="w-3 h-3" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toBe('w-3 h-3');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('fill')).toBe('none');
  });

  it('is legible at 12px: at most three strokes', () => {
    const { container } = render(<SolGlyph className="x" />);
    const strokes = container.querySelectorAll('path, circle, line');
    expect(strokes.length).toBeLessThanOrEqual(3);
  });
});
