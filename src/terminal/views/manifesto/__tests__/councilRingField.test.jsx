import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { installRecordingGL } from '../../../gl/__tests__/recordingGL';
import CouncilRing from '../CouncilRing';

beforeEach(() => {
  localStorage.clear();
  // jsdom has neither; the collider gate reads both on mount.
  vi.stubGlobal('matchMedia', (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

// Not-live renders: no context at all, so jsdom does not print its
// "Not implemented: HTMLCanvasElement's getContext()" stderr.
function withoutGL(fn) {
  const noGL = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  try { fn(); } finally { noGL.mockRestore(); }
}

describe('CouncilRing × CouncilField (spec §3, §7.9)', () => {
  it('stacks the 2D canvas, the field canvas, then the SVG inside an isolated cell', () => withoutGL(() => {
    const { container } = render(<CouncilRing />);
    const cell = container.querySelector('svg[viewBox="-170 0 980 640"]').parentElement;
    expect(cell.style.isolation).toBe('isolate');
    expect([...cell.children].map((n) => n.tagName.toLowerCase())).toEqual(['canvas', 'canvas', 'svg']);
  }));

  it('keeps the ◉ glyph when WebGL2 is unavailable', () => withoutGL(() => {
    render(<CouncilRing />);
    expect(screen.getByText('◉')).toBeTruthy();
  }));

  it('hides the ◉ glyph once the field is live', async () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      render(<CouncilRing />);
      await waitFor(() => expect(screen.queryByText('◉')).toBeNull());
    } finally {
      rec.restore();
    }
  });
});
