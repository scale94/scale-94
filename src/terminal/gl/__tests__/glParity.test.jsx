// glParity.test.jsx — the compliance gate for the harness extraction.
//
// `frames` is held to byte-equality: that is where visual regressions live.
// `init` is expected to diff during migration; a reviewer must read the diff
// and confirm every moved call is order-independent.
//
// NEVER run this file with -u. A failing snapshot is a finding.
//
// ── Known gaps: code paths these snapshots do NOT gate ──────────────────────
// A green run here is evidence for the paths listed in each CASE's comment
// below, and nothing else. In particular:
//
//   - `prefers-reduced-motion` branches in all three components. jsdom has no
//     `matchMedia`, so `window.matchMedia?.(...)` is falsy and `reduce` is
//     always false — the reduced-motion snap-instead-of-ease code in
//     ObserverEye and MercuryTerminator, and any reduced-motion branch in
//     LunarShaderMoon, never runs under this harness.
//   - `LunarShaderMoon`'s 30fps `isAtRest` idle-throttle skip. Its case drives
//     60 ticks and gets 60 draws — the throttle that skips a draw when the
//     scene has settled never fires here, so that skip path is unexercised.
//   - Anything gated on a *second* mid-run prop transition beyond the one each
//     case below scripts (e.g. a third ObserverEye state, or a twilight/day
//     change while a retrograde excursion is still in flight) is likewise
//     unexercised — one transition per case proves the ordinary easing path
//     runs at all, not that every transition sequence is safe.
//   - `LunarShaderMoon` never gets a mid-run prop change in this file at all
//     (its case is single-render, matching what Task 2 originally shipped, and
//     is intentionally left that way — see the ObserverEye/MercuryTerminator
//     cases below for what a mid-run transition looks like). Measured by
//     mechanically counting distinct values per uniform across its 60-frame
//     `frames` snapshot: `uAge`, `uIllum`, `uRadius`, `uLibration` and
//     `uSurface` each take exactly 1 distinct value, because they are read
//     straight from props/derived-from-props every frame with no easing at
//     all (`lunarAge`, `illumination`, `timestamp` never change) — a real
//     prop-change path exists in the component but is entirely unexercised
//     here. `uPurkinje` is hardcoded to the literal `1.0` in the component
//     itself (not read from any prop or state), so it is expected to be flat
//     regardless of what this harness drives — not a coverage gap.
//   - `MercuryTerminator`'s `u_flareCol`: the CYAN→GOLD swap happens once, on
//     the very first frame-loop tick (before that frame's own render call),
//     so within the `frames` snapshot alone `u_flareCol` shows 1 distinct
//     value (GOLD) for all 400 frames — the CYAN value only ever appears in
//     `init`. The swap itself is exercised (confirmed by inspecting `init`),
//     just not visible as "more than one value" inside `frames`.
//
// After the mid-run transitions added below, mechanically counting distinct
// values per uniform in the regenerated `.snap` gives (frames snapshot only):
//   MercuryTerminator: u_t 400, u_bloom 400, u_tw 355, u_day 297, u_retro 272,
//     u_flareCol 1 (see above, expected).
//   ObserverEye: u_t 60, c0/c1/c2 60, u_focus 60, u_gaze 60, u_pulse 60,
//     u_speed 31, u_irid 31 — both previously-frozen channels now genuinely
//     ease after the frame-30 state transition.
//   LunarShaderMoon (unchanged case): uAdapt 60, uTime 60, uAge/uIllum/
//     uRadius/uLibration/uSurface/uPurkinje 1 each (see above).
//
// These gaps are real for Tasks 6-8: passing this file is not proof the
// harness extraction preserves behavior for any of the above.

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
    // twilight/day only ever seed `cur` at mount, and since props never change
    // within a single render, the plain lerp toward twRef.current/dayRef.current
    // (MercuryTerminator.jsx ~133-134) is a self-lerp unless something else
    // moves the ref. Arming both `flare` and `retrograde` with .ts !== 0 on the
    // very first frame exercises the bloom decay, the u_flareCol swap, and the
    // retrogradeCurve excursion (u_retro). RETROGRADE_MS is 5200ms (~325
    // frames at 16ms/frame); the arc completes and cur.retroStart resets to 0
    // around frame 326, after which u_tw/u_day/u_retro would go flat again —
    // UNLESS the ordinary prop-driven easing path also runs. To prove that
    // path (distinct from the retrograde one-shot), a scripted rerender at
    // frame 350 — well after the excursion completes — changes twilight/day to
    // new values while re-passing the *same* flare/retrograde tokens (same
    // .ts, so neither re-arms). The remaining 50 frames then show cur.tw/day
    // easing toward the new targets via the plain lerp alone, with no
    // retrograde curve in flight to mask it.
    frames: 400,
    element: (
      <MercuryTerminator
        twilight={0.3}
        day={0.1}
        flare={{ ts: 1, kind: 'run' }}
        retrograde={{ ts: 1 }}
        size={180}
      />
    ),
    rerenders: [
      {
        at: 350,
        element: (
          <MercuryTerminator
            twilight={0.6}
            day={0.5}
            flare={{ ts: 1, kind: 'run' }}
            retrograde={{ ts: 1 }}
            size={180}
          />
        ),
      },
    ],
  },
  {
    name: 'ObserverEye',
    version: 1,
    // state="leaning" + tint makes the colour target come from deriveCols(tint)
    // while `cur` seeds from STATES.leaning.cols, so c0/c1/c2 actually lerp.
    // A gaze prop different from STATES.leaning.gaze moves u_gaze. constrict
    // exercises the Math.max(tgt.focus, constrict) branch on u_focus. pulse
    // stays truthy so u_pulse keeps its existing (already-covered) motion.
    //
    // u_speed and u_irid are the one remaining gap: both read
    // `lerp(cur.x, tgt.x, e)` where `cur.x` seeds from STATES.leaning and the
    // target is also STATES.leaning (speed 0.11, irid 0) for as long as
    // `state` never changes — a self-lerp, frozen for the whole run. A
    // scripted rerender at frame 30 flips `state` to "resting", the only
    // STATES entry with irid=1 (vs. every other entry's 0) and a different
    // speed (0.05 vs 0.11), so both channels genuinely ease for the back half
    // of the run. gaze/constrict/pulse are re-passed unchanged so their
    // already-covered motion isn't disturbed by the transition.
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
    rerenders: [
      {
        at: 30,
        element: (
          <ObserverEye
            state="resting"
            size={28}
            tint={[255, 90, 30]}
            gaze={[0.4, -0.25]}
            constrict={0.5}
            pulse
          />
        ),
      },
    ],
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
      driveFrames(() => {
        const { unmount, rerender } = render(c.element);
        return { unmount, rerender };
      }, {
        version: c.version,
        ...(c.frames ? { frames: c.frames } : {}),
        ...(c.rerenders ? { rerenders: c.rerenders } : {}),
      });

    it('init sequence is unchanged', () => {
      expect(run().init.join('\n')).toMatchSnapshot();
    });

    it('frame loop is unchanged', () => {
      expect(run().frames.join('\n')).toMatchSnapshot();
    });
  });
}
