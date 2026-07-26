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
    element: <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />,
  },
  {
    name: 'ObserverEye',
    version: 1,
    element: <ObserverEye state="armed" size={28} tint={null} pulse />,
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
      driveFrames(() => render(c.element).unmount, { version: c.version });

    it('init sequence is unchanged', () => {
      expect(run().init.join('\n')).toMatchSnapshot();
    });

    it('frame loop is unchanged', () => {
      expect(run().frames.join('\n')).toMatchSnapshot();
    });
  });
}
