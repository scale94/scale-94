import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MercuryTapToast from '../MercuryTapToast';

// Note: the onAnimationEnd→onDone wiring is a one-line declarative prop; React 19
// + jsdom does not deliver a synthetic `animationend` through event delegation, so
// that path is proven visually in the browser pass (the toast fades and clears),
// not asserted here. These tests cover what unit-tests reliably: render + branch.

afterEach(() => cleanup());

describe('MercuryTapToast', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(<MercuryTapToast toast={null} onDone={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('renders the toast text', () => {
    const { container } = render(
      <MercuryTapToast toast={{ key: 1, text: 'past the theme layer', bright: false }} onDone={() => {}} />,
    );
    expect(container.textContent).toContain('past the theme layer');
  });

  it('bright unlock toast gets a glow the dim countdown does not', () => {
    const dim = render(<MercuryTapToast toast={{ key: 1, text: 'x', bright: false }} onDone={() => {}} />);
    const dimSpan = dim.container.querySelector('[data-tap-toast] span');
    expect(dimSpan.style.textShadow).toBe('');
    cleanup();

    const bright = render(<MercuryTapToast toast={{ key: 2, text: 'y', bright: true }} onDone={() => {}} />);
    const brightSpan = bright.container.querySelector('[data-tap-toast] span');
    expect(brightSpan.style.textShadow).toContain('232,210,138');
  });
});
