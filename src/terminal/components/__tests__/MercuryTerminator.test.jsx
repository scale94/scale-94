import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MercuryTerminator from '../MercuryTerminator';

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
});
