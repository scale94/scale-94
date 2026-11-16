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

// ── geometry of the loop ────────────────────────────────────────────────────
const N = 200;

function parseCubics(d) {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number);
  const segs = [];
  let cur = [nums[0], nums[1]];
  for (let i = 2; i + 5 < nums.length + 0; i += 6) {
    const [c1x, c1y, c2x, c2y, x, y] = nums.slice(i, i + 6);
    segs.push([cur, [c1x, c1y], [c2x, c2y], [x, y]]);
    cur = [x, y];
  }
  return segs;
}

function sample([p0, p1, p2, p3]) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

function segIntersect(a, b, c, d) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

describe('SolGlyph geometry', () => {
  const { container } = render(<SolGlyph className="x" />);
  const circle = container.querySelector('circle');
  const cx = +circle.getAttribute('cx');
  const cy = +circle.getAttribute('cy');
  const r = +circle.getAttribute('r');
  const segs = parseCubics(container.querySelector('path').getAttribute('d'));
  const [A, B] = segs.map(sample);

  it('the arch is two cubic segments', () => {
    expect(segs.length).toBe(2);
  });

  it('the two legs cross each other away from the shared joint', () => {
    let hit = false;
    // Exclude the last piece of A against the first piece of B (the joint).
    for (let i = 0; i < A.length - 1 && !hit; i++) {
      for (let j = 0; j < B.length - 1; j++) {
        if (i === A.length - 2 && j === 0) continue;
        if (segIntersect(A[i], A[i + 1], B[j], B[j + 1])) { hit = true; break; }
      }
    }
    expect(hit).toBe(true);
  });

  it('both feet of the arch stand on the disc limb', () => {
    for (const p of [A[0], B[B.length - 1]]) {
      const dist = Math.hypot(p[0] - cx, p[1] - cy);
      expect(Math.abs(dist - r)).toBeLessThanOrEqual(0.3);
    }
  });

  it('the stroked path stays inside the 24 box', () => {
    for (const [x, y] of [...A, ...B]) {
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(23);
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y).toBeLessThanOrEqual(23);
    }
  });
});
