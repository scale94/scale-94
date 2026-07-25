import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MercuryTerminator from '../MercuryTerminator';
import { RETROGRADE_MS } from '../retrogradeCurve';

describe('MercuryTerminator', () => {
  it('renders a canvas without throwing when WebGL is unavailable (jsdom)', () => {
    const { container } = render(
      <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('wires onClick and title', () => {
    let clicked = false;
    const { container, getByTitle } = render(
      <MercuryTerminator twilight={0} day={0} flare={null} size={120}
        onClick={() => { clicked = true; }} title="☿ mercury" />
    );
    expect(getByTitle('☿ mercury')).toBeTruthy();
    container.querySelector('[role="button"]').click();
    expect(clicked).toBe(true);
  });

  it('accepts a retrograde token without throwing (jsdom, no WebGL)', () => {
    expect(RETROGRADE_MS).toBeGreaterThan(0); // guards the dependency exists
    const { container, rerender } = render(
      <MercuryTerminator twilight={0.3} day={0.1} flare={null} retrograde={null} size={180} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    // Arming the event on a re-render must not throw when GL is unavailable.
    rerender(<MercuryTerminator twilight={0.3} day={0.1} flare={null} retrograde={{ ts: 123 }} size={180} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
