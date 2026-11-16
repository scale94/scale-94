import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SolHud from '../SolHud';

afterEach(cleanup);

const hud = (props) =>
  render(<SolHud tensionG={300} lastReleaseErg={null} lightDelayVisible={false} clouds={[]} landings={[]} {...props} />);

describe('SolHud', () => {
  it('renders tension as an integer in G', () => {
    const { container } = hud({ tensionG: 4000 });
    expect(container.textContent).toContain('MAGNETIC TENSION');
    expect(container.textContent).toContain('4000 G');
  });

  it('rounds the tension', () => {
    const { container } = hud({ tensionG: 1234.6 });
    expect(container.textContent).toContain('1235 G');
  });

  it('renders the last release as mantissa e exponent erg', () => {
    const { container } = hud({ lastReleaseErg: 5e32 });
    expect(container.textContent).toContain('LAST RELEASE');
    expect(container.textContent).toContain('5.0e32 erg');
  });

  it('formats a small release too', () => {
    const { container } = hud({ lastReleaseErg: 1.234e29 });
    expect(container.textContent).toContain('1.2e29 erg');
  });

  it('shows the light line only while visible', () => {
    expect(hud({ lightDelayVisible: true }).container.textContent).toContain('LIGHT · 8 min 19 s OLD');
    cleanup();
    expect(hud({ lightDelayVisible: false }).container.textContent).not.toContain('8 min 19 s');
  });

  it('has no release row before the first snap', () => {
    const { container } = hud({ lastReleaseErg: null });
    expect(container.textContent).not.toContain('erg');
    expect(container.textContent).not.toContain('LAST RELEASE');
  });

  it('never explains itself', () => {
    const { container } = hud({ tensionG: 4000, lastReleaseErg: 5e32, lightDelayVisible: true });
    const text = container.textContent.toLowerCase();
    for (const w of ['civilization', 'grid', 'infrastructure']) expect(text).not.toContain(w);
  });
});
