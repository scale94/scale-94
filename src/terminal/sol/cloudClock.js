// cloudClock.js — a cloud's whole life from the wall clock. Pure: a cloud and
// `now` in, a status out. Nothing advances a cloud; time does, so a cloud
// moves and lands whether or not the page is open.
//
// A stored cloud is { id, launchedAt, energyErg, transitMs, handedness, origin, witnessed }.

import {
  transitMs as transitFor, speedKmS, stormNt as stormNtFor, stormMs as stormMsFor,
  couples, L1_KM, MERCURY_FRACTION,
} from './solPhysics';

/** A new cloud launched at `now`; its transit follows from its energy. */
export function makeCloud({ energyErg, handedness, origin }, now, id) {
  return {
    id: String(id),
    launchedAt: now,
    energyErg,
    transitMs: Math.round(transitFor(energyErg)),
    handedness,
    origin,
    witnessed: false,
  };
}

/**
 * The cloud's state at `now`. A clock behind the launch (or a non-finite one)
 * is read as the launch moment, so nothing is ever negative or NaN.
 * The orientation is unknown (null) until the upstream monitor reads it at
 * L1; a northward cloud has no storm and goes straight from flight to landed.
 */
export function cloudStatus(cloud, now) {
  const t0 = cloud.launchedAt;
  const transit = cloud.transitMs;
  const t = Number.isFinite(now) && now > t0 ? now : t0;

  const arrivalAt = t0 + transit;
  const mercuryAt = t0 + MERCURY_FRACTION * transit;
  const leadMs = (L1_KM / speedKmS(transit)) * 1000;
  const readAt = Math.max(t0, arrivalAt - leadMs);

  const coupledRule = couples(cloud.handedness);
  const read = t >= readAt;
  const orientation = read ? (coupledRule ? 'southward' : 'northward') : null;
  const coupled = read ? coupledRule : null;
  const stormNt = read && coupledRule ? stormNtFor(cloud.energyErg) : null;
  const stormEndAt = coupledRule ? arrivalAt + stormMsFor(cloud.energyErg) : null;

  const arrived = t >= arrivalAt;
  let phase = 'flight';
  if (arrived) phase = coupledRule && t < stormEndAt ? 'storm' : 'landed';

  const storm01 = phase === 'storm' ? (t - arrivalAt) / (stormEndAt - arrivalAt) : null;

  let fate = null;
  if (phase === 'storm') fate = 'coupled';
  else if (phase === 'landed') {
    if (!coupledRule) fate = 'passed';
    else fate = cloud.witnessed ? 'coupled' : 'unwitnessed';
  }

  return {
    phase,
    progress01: arrived ? 1 : (t - t0) / transit,
    etaMs: arrived ? 0 : arrivalAt - t,
    arrivalAt,
    mercuryAt,
    readAt,
    stormEndAt,
    mercuryPassed: t >= mercuryAt,
    orientation,
    coupled,
    stormNt,
    storm01,
    fate,
  };
}
