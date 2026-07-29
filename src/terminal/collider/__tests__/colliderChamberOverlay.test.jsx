import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ColliderChamber from '../ColliderChamber';

const base = {
  phase: 'colliding', hueA: 280, hueB: 120, selA: true, selB: true,
  beams: null, phaseStartedAt: 0, labelA: 'THERMO', labelB: 'CRYPTO',
};

describe('ColliderChamber DOM overlay', () => {
  it('renders the metrics readouts as text, not canvas pixels', () => {
    render(<ColliderChamber {...base} metrics={{ cosine: 0.8123, angle: 35.7, novelty: 0.42 }} />);
    expect(screen.getByText('cos(θ) = 0.8123')).toBeInTheDocument();
    expect(screen.getByText('θ = 35.7°')).toBeInTheDocument();
    expect(screen.getByText('NOVELTY 42%')).toBeInTheDocument();
  });

  it('renders the beamline domain labels only for selected domains', () => {
    render(<ColliderChamber {...base} selB={false} metrics={null} />);
    expect(screen.getByText('THERMO')).toBeInTheDocument();
    expect(screen.queryByText('CRYPTO')).toBeNull();
  });

  it('hides the metrics block entirely when there are none', () => {
    render(<ColliderChamber {...base} metrics={null} />);
    expect(screen.queryByText(/cos\(θ\)/)).toBeNull();
  });

  it('is inert to pointer events', () => {
    // Spec §7: nothing under the overlay is interactive, and a stray drag
    // must not land on a text node instead of the chamber.
    const { container } = render(<ColliderChamber {...base} metrics={null} />);
    const overlay = container.querySelector('[data-chamber-overlay]');
    expect(overlay).not.toBeNull();
    expect(overlay.className).toContain('pointer-events-none');
  });

  it('drives the novelty bar width from the metric', () => {
    const { container } = render(
      <ColliderChamber {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.42 }} />
    );
    expect(container.querySelector('[data-novelty-fill]').style.width).toBe('42%');
  });

  it('falls back to a static field when there is no WebGL context', () => {
    // Spec §4.2 / backlog #10. jsdom's canvas returns null for 'webgl2', so
    // this is the default path here -- which is precisely why the assertion
    // has to be explicit rather than assumed.
    const { container } = render(<ColliderChamber {...base} metrics={null} />);
    const wrap = container.querySelector('[data-chamber-renderer]');
    expect(wrap.dataset.chamberRenderer).toBe('fallback');
    expect(container.querySelector('canvas')).toBeNull();
    // The readouts must survive the fallback -- they are DOM, not GL.
    expect(container.querySelector('[data-chamber-overlay]')).not.toBeNull();
  });

  it('places each readout at its converted canvas coordinate', () => {
    // Canvas fillText y is a BASELINE; CSS top is the box top. These are the
    // old coordinates minus the font ascent. The bar came from a fillRect and
    // needs no conversion. Locked numerically because an 8px drift here is
    // invisible to every other test in this file.
    const { container } = render(
      <ColliderChamber {...base} metrics={{ cosine: 0.5, angle: 60, novelty: 0.42 }} />
    );
    const tops = [...container.querySelectorAll('[data-chamber-overlay] [style*="top"]')]
      .map(el => el.style.top);
    expect(tops).toContain('95px');   // domain label
    expect(tops).toContain('40px');   // NOVELTY label
    expect(tops).toContain('50px');   // novelty bar (fillRect origin, unconverted)
    expect(tops).toContain('201px');  // cos(theta)
    expect(tops).toContain('209px');  // theta, held above its 213px conversion
  });
});
