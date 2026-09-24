import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import ColliderChamber from '../ColliderChamber';

const props = {
  phase: 'result', hueA: 280, hueB: 120, selA: true, selB: true, beams: null,
  phaseStartedAt: 0, labelA: 'MYCEL', labelB: 'P',
  metrics: { cosine: -0.0026, angle: 90.1, novelty: 0.13 },
};

// jsdom has no layout, so this pins the layout contract instead. The θ row
// used to be hand-placed at top: H/2+99 with an inherited 15px line box: it ran
// 5px past the 220px chamber (overflow-hidden clipped its descenders and the
// degree sign) and overlapped the cos row, which sat only 8px above it.
describe('ColliderChamber cos(θ) / θ readout', () => {
  it('stacks both rows in one bottom-anchored block with a fixed line box', () => {
    const { getByText } = render(<ColliderChamber {...props} />);
    const cos = getByText('cos(θ) = -0.0026');
    const theta = getByText('θ = 90.1°');
    const block = cos.parentElement;
    expect(theta.parentElement).toBe(block);
    expect(block.hasAttribute('data-chamber-readout')).toBe(true);

    const bottom = parseFloat(block.style.bottom);
    const lineH = parseFloat(block.style.lineHeight);
    expect(bottom).toBeGreaterThanOrEqual(4);
    expect(lineH).toBeGreaterThanOrEqual(12);
    expect(block.style.top).toBe('');
    for (const row of [cos, theta]) expect(row.style.top).toBe('');
  });
});
