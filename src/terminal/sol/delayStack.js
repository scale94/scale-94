// delayStack.js — five messengers of one flare, each with its own arrival on
// the true clock. Pure: a stored cloud and `now` in, five messengers out.
// A messenger's reading is null until its arrival moment; the HUD and the
// kernel never know more than the visitor. A non-finite `now`, or one before
// launch, is read as the launch moment (the same rule as cloudStatus).

import { cloudStatus } from './cloudClock';
import {
  LIGHT_DELAY_S, NEUTRINO_DELAY_S, CORE_PHOTON_YEARS,
  xrayClass, protonOnsetMs, protonPeakPfu, sScale,
} from './solPhysics';

/** UTC calendar year of an in-range epoch ms. */
export function yearOf(ms) {
  return new Date(ms).getUTCFullYear();
}

/** When the proton front reaches Earth: light delay plus the energy-set onset. */
export function protonsArriveAt(cloud) {
  return cloud.launchedAt + LIGHT_DELAY_S * 1000 + protonOnsetMs(cloud.energyErg);
}

/** The five messengers, in order: neutrinos, light, protons, cloud, core photon. */
export function messengers(cloud, now) {
  const t0 = cloud.launchedAt;
  const t = Number.isFinite(now) && now > t0 ? now : t0;
  const timed = (key, arrivesAt, readFn) => {
    const arrived = t >= arrivesAt;
    return {
      key,
      arrivesAt,
      arrivesYear: yearOf(arrivesAt),
      arrived,
      etaMs: Math.max(0, arrivesAt - t),
      reading: arrived ? readFn() : null,
    };
  };

  const st = cloudStatus(cloud, now);
  const cloudArrived = st.phase !== 'flight';
  const pfu = protonPeakPfu(cloud.energyErg);

  return [
    timed('neutrinos', t0 + NEUTRINO_DELAY_S * 1000, () => ({ detected: false })),
    timed('light', t0 + LIGHT_DELAY_S * 1000, () => ({ ageS: LIGHT_DELAY_S, xray: xrayClass(cloud.energyErg) })),
    timed('protons', protonsArriveAt(cloud), () => ({ pfu, s: sScale(pfu) })),
    {
      key: 'cloud',
      arrivesAt: st.arrivalAt,
      arrivesYear: yearOf(st.arrivalAt),
      arrived: cloudArrived,
      etaMs: st.etaMs,
      reading: {
        phase: st.phase,
        orientation: st.orientation,
        fate: st.fate,
        nT: st.stormNt != null && st.fate !== 'passed' ? st.stormNt : null,
      },
    },
    { key: 'core', arrivesAt: null, arrivesYear: yearOf(t0) + CORE_PHOTON_YEARS, arrived: false, etaMs: null, reading: null },
  ];
}
