// observerEyeReducedMotionMount.test.jsx — locks the ObserverEye migration's
// one real (and correct) behavior change under prefers-reduced-motion.
//
// Pre-migration, ObserverEye declared its props-sync `useEffect` BEFORE the
// GL effect. React fires effects in declaration order on mount, so the
// snap-repaint ref was still unset when the props-sync effect ran — its
// snap() call was a guaranteed no-op, and the mount frame stayed whatever the
// raw STATES.<state> colour was.
//
// The migration (and the Task 7/8 declaration-order correction — see
// progress.md) put `useShaderCanvas(...)` above the props-sync effect in
// ObserverEye.jsx, so the harness's own effect runs first and populates
// `snapRef.current` before the props-sync effect's (unchanged) `snap()` call
// fires. That call now actually repaints — this time WITH the leaning-tint
// colour (`deriveCols(tint)`) instead of the raw `STATES.leaning` colour.
//
// This is a real, deliberate improvement kept on purpose (the suggested
// tab's hue now genuinely shows under reduced motion instead of generic
// leaning-cyan — see the real consumers at src/terminal/mercury/ElementSeal.jsx:34
// and src/terminal/components/MercuryEyeIndicator.jsx:273), but it is
// entirely invisible to glParity.test.jsx (jsdom has no matchMedia there, so
// `reduce` is always false) and deserves its own lock. The same divergence
// applies to gaze/constrict/pulse, not just tint — this test pins tint
// specifically because it is the one with an externally-visible colour to
// assert on.
//
// Measured (final review, fix wave item 1):
//   old ObserverEye: 1 draw at mount, c0 = STATES.leaning.cols[0]/255 = [56,189,248]/255
//   new ObserverEye: 2 draws at mount, c0 = [56,189,248]/255 then deriveCols(tint)[0]/255 = tint/255
//
// A test asserting only the draw count would pass even if the tint were
// silently dropped from the second draw — assert both.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';
import ObserverEye from '../../components/ObserverEye';

afterEach(cleanup);

// Replicates ObserverEye.jsx's own `nrm()` float32 conversion exactly, so the
// assertion can't drift from the component's own math via a hand-rounded
// decimal.
const asC0 = (c) => Array.from(new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]));

describe('ObserverEye — reduced-motion mount behavior (harness migration)', () => {
  it('draws twice at mount and the second draw carries the leaning tint, not the raw state colour', () => {
    // jsdom has no matchMedia at all; it must exist as a function before it
    // can be forced to report prefers-reduced-motion: reduce (same pattern
    // as useShaderCanvas.test.jsx:119).
    if (typeof window.matchMedia !== 'function') window.matchMedia = () => ({ matches: false });
    const original = window.matchMedia;
    window.matchMedia = () => ({ matches: true });

    const rec = installRecordingGL({ version: 1 });
    try {
      // The ElementSeal.jsx prop shape (src/terminal/mercury/ElementSeal.jsx:34):
      // state="leaning" plus tint/constrict/pulse — the exact combination the
      // divergence was measured against.
      render(
        <ObserverEye
          lens={false}
          state="leaning"
          tint={[255, 90, 30]}
          pulse
          constrict={0.58}
          size={72}
        />
      );

      const drawCount = rec.log.filter((e) => e[0] === 'drawArrays').length;
      const c0Calls = rec.log
        .filter((e) => e[0] === 'uniform3fv' && typeof e[1] === 'string' && e[1].endsWith(':c0'))
        .map((e) => e[2]);

      expect(drawCount).toBe(2);
      expect(c0Calls).toHaveLength(2);
      // onInit only ever seeds `cur` from the raw STATES entry — it never
      // consults tintRef — so the first (initialDraw) paint is always the
      // generic leaning cyan, tint or no tint.
      expect(c0Calls[0]).toEqual(asC0([56, 189, 248]));
      // The props-sync effect's snap() re-derives targets() from tintRef,
      // which deriveCols() maps straight through for its first channel.
      expect(c0Calls[1]).toEqual(asC0([255, 90, 30]));
    } finally {
      window.matchMedia = original;
      rec.restore();
    }
  });
});
