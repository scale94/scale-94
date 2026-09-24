import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SixteenPanel from '../SixteenPanel';

const mind = {
  caste: 'sidelined', dimIndex: 8, dimName: 'spatial',
  anchorName: "D'Arcy Wentworth Thompson", era: '1860–1948',
  coreEquation: 'form = f(force)', epigraph: 'x', systemDirective: 'y', body: 'One. Two.',
};

describe('SixteenPanel', () => {
  // The app's <main> is a z-10 stacking context under a z-40 sticky header;
  // rendered in place, the fixed panel's top 96px sat beneath the header.
  it('portals out of its parent so the header cannot paint over it', () => {
    const { container } = render(<div id="host"><SixteenPanel mind={mind} onClose={vi.fn()} /></div>);
    const name = screen.getByRole('heading', { name: mind.anchorName });
    expect(container.contains(name)).toBe(false);
    expect(document.body.contains(name)).toBe(true);
  });

  it('lets long names wrap instead of overflowing', () => {
    render(<SixteenPanel mind={mind} onClose={vi.fn()} />);
    const name = screen.getByRole('heading', { name: mind.anchorName });
    expect(name.style.overflowWrap).toBe('anywhere');
  });
});
