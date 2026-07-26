// glParity.test.jsx — the compliance gate for the harness extraction.
//
// `frames` is held to byte-equality: that is where visual regressions live.
// `init` is expected to diff during migration; a reviewer must read the diff
// and confirm every moved call is order-independent.
//
// NEVER run this file with -u. A failing snapshot is a finding.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { driveFrames } from './driveFrames';

import MercuryTerminator from '../../components/MercuryTerminator';
import ObserverEye from '../../components/ObserverEye';
import LunarShaderMoon from '../../lunar/LunarShaderMoon';

afterEach(cleanup);

const CASES = [
  {
    name: 'MercuryTerminator',
    version: 1,
    // twilight/day only ever seed `cur` at mount (never re-eased from a prop
    // change within this single-render harness), so the one path that moves
    // u_tw/u_day/u_retro at all is the retrogradeCurve applied while a
    // retrograde one-shot is armed. Arming both `flare` and `retrograde` with
    // .ts !== 0 on the very first frame also exercises the bloom decay and
    // the u_flareCol swap. RETROGRADE_MS is 5200ms; at 16ms/frame the default
    // 60 frames (960ms) would only ever see the first ~18% of the curve, so
    // this case alone raises the frame count to run the excursion to
    // completion (p >= 1, cur.retroStart reset to 0) and a few frames past.
    frames: 340,
    element: (
      <MercuryTerminator
        twilight={0.3}
        day={0.1}
        flare={{ ts: 1, kind: 'run' }}
        retrograde={{ ts: 1 }}
        size={180}
      />
    ),
  },
  {
    name: 'ObserverEye',
    version: 1,
    // state="leaning" + tint makes the colour target come from deriveCols(tint)
    // while `cur` seeds from STATES.leaning.cols, so c0/c1/c2 actually lerp.
    // A gaze prop different from STATES.leaning.gaze moves u_gaze. constrict
    // exercises the Math.max(tgt.focus, constrict) branch on u_focus. pulse
    // stays truthy so u_pulse keeps its existing (already-covered) motion.
    element: (
      <ObserverEye
        state="leaning"
        size={28}
        tint={[255, 90, 30]}
        gaze={[0.4, -0.25]}
        constrict={0.5}
        pulse
      />
    ),
  },
  {
    name: 'LunarShaderMoon',
    version: 2,
    element: (
      <LunarShaderMoon
        lunarAge={7.4}
        illumination={0.5}
        timestamp={Date.UTC(2026, 6, 22)}
        size={340}
      />
    ),
  },
];

for (const c of CASES) {
  describe(`GL parity — ${c.name}`, () => {
    const run = () =>
      driveFrames(() => render(c.element).unmount, {
        version: c.version,
        ...(c.frames ? { frames: c.frames } : {}),
      });

    it('init sequence is unchanged', () => {
      expect(run().init.join('\n')).toMatchSnapshot();
    });

    it('frame loop is unchanged', () => {
      expect(run().frames.join('\n')).toMatchSnapshot();
    });
  });
}
