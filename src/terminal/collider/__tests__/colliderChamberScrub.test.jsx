import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { installRecordingGL } from '../../gl/__tests__/recordingGL';
import ColliderChamber from '../ColliderChamber';

describe('ColliderChamber dev scrub hook', () => {
  it('pins phase and elapsed, paints at once, and is removed on unmount', () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      const { unmount } = render(
        <ColliderChamber phase="idle" hueA={280} hueB={120} selA selB massA={0.3} massB={0.6}
          beams={null} metrics={null} phaseStartedAt={0} labelA={null} labelB={null} />
      );
      expect(typeof window.__scentScrub).toBe('function');

      const before = rec.log.length;
      let pinned;
      act(() => { pinned = window.__scentScrub('colliding', 300); });
      expect(pinned).toEqual({ phase: 'colliding', ms: 300 });
      const after = rec.log.slice(before);
      const cageT = after.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uCageT'));
      expect(cageT).toHaveLength(1);
      expect(cageT[0][2]).toBeCloseTo(0.3, 6);
      expect(after.some((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uPhase') && e[2] === 3)).toBe(true);
      // No running clock under scrub: the ambient clock is the pinned instant.
      const time = after.filter((e) => e[0] === 'uniform1f' && String(e[1]).endsWith(':uTime'));
      expect(time).toHaveLength(1);
      expect(time[0][2]).toBeCloseTo(0.3, 6);

      act(() => { expect(window.__scentScrub(null)).toBeNull(); });
      unmount();
      expect(window.__scentScrub).toBeUndefined();
    } finally {
      rec.restore();
    }
  });
});
