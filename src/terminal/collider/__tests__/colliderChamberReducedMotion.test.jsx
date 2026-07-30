import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

describe('ColliderChamber under prefers-reduced-motion', () => {
  let rec;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    rec = installRecordingGL({ version: 2 });
  });
  afterEach(() => { rec.restore(); vi.unstubAllGlobals(); });

  it('paints exactly one static frame and never starts the loop', () => {
    render(<ColliderChamber
      phase="colliding" hueA={280} hueB={120} selA selB
      beams={null} metrics={null} phaseStartedAt={0} labelA={null} labelB={null}
    />);
    const draws = rec.log.filter(e => e[0] === 'drawArrays');
    // onSnap paints both passes once. Anything more means the loop ran.
    expect(draws).toHaveLength(2);
    expect(draws[0][1]).toBe(0x0005); // TRIANGLE_STRIP
    expect(draws[1][1]).toBe(0x0000); // POINTS
  });

  it('still shows the phase it was given', () => {
    render(<ColliderChamber
      phase="colliding" hueA={280} hueB={120} selA selB
      beams={null} metrics={{ cosine: 0.5, angle: 60, novelty: 0.4 }}
      phaseStartedAt={0} labelA={null} labelB={null}
    />);
    // The static frame must carry the real phase id, not the idle default --
    // otherwise reduced-motion users see an empty chamber next to a filled
    // result card.
    const phaseUploads = rec.log.filter(e => e[0] === 'uniform1f' && String(e[1]).endsWith('uPhase'));
    expect(phaseUploads.some(e => e[2] === 3)).toBe(true); // PHASE_ID.colliding
  });
});
