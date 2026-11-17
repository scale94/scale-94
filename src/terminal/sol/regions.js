// /SOL active regions: self-winding, hand winding, slip, snap. Pure simulation:
// no DOM, no timers, randomness only through the rng argument.
import {
  TURNS_TO_SNAP, MIN_SNAP_TURNS, SLIP_TAU_S, energyErg, hemisphereHandedness,
} from './solPhysics.js';

export const MAX_REGIONS = 6;
export const STAR_REGIONS = 4;
export const SELF_WIND_TURNS_PER_S = 0.005; // tune: one region self-snaps in ~20 min
export const OMEGA_EQ = 0.02;               // rad/s at the equator, tune
export const GRAB_RADIUS_RAD = 0.25;

const DEG = Math.PI / 180;

const finiteOr0 = (x) => (Number.isFinite(x) ? x : 0);

/** Angular rate (rad/s) at a latitude: equator 25 d, pole 34 d. */
export function omega(latRad) {
  const s = Math.sin(latRad);
  return OMEGA_EQ * (1 - 0.265 * s * s);
}

/** Wrap a star state around a region list; nextId keeps ids unique for its life. */
export function makeStar(regions) {
  let max = 0;
  for (const r of regions) if (r.id > max) max = r.id;
  return { regions, nextId: max + 1 };
}

export function createStar(rng) {
  const regions = [];
  const lon0 = rng() * 2 * Math.PI;
  for (let i = 0; i < STAR_REGIONS; i++) {
    const hemi = rng() < 0.5 ? -1 : 1;
    const lat = hemi * (8 + rng() * 27) * DEG;
    // evenly spread with jitter, so longitudes are distinct
    const lon = lon0 + (i + (rng() - 0.5) * 0.5) * (2 * Math.PI / STAR_REGIONS);
    // staggered: slot i of STAR_REGIONS, jittered inside its slot, always < TURNS_TO_SNAP
    const starTurns = ((i + rng() * 0.9) / STAR_REGIONS) * TURNS_TO_SNAP;
    regions.push({ id: i + 1, lat, lon, starTurns, handTurns: 0, held: false, born: 'star' });
  }
  return makeStar(regions);
}

export function regionTurns(r) {
  return r.starTurns + Math.abs(r.handTurns);
}

function snapRegion(star, r) {
  const turns = regionTurns(r);
  const handDriven = Math.abs(r.handTurns) >= MIN_SNAP_TURNS;
  const event = {
    regionId: r.id,
    lat: r.lat,
    lon: r.lon,
    turns,
    energyErg: energyErg(turns),
    handedness: handDriven ? (r.handTurns > 0 ? 'cw' : 'ccw') : hemisphereHandedness(r.lat),
    origin: handDriven ? 'hand' : 'star',
  };
  r.starTurns = 0;
  r.handTurns = 0;
  r.held = false;
  if (r.born === 'hand') star.regions = star.regions.filter((x) => x !== r);
  return event;
}

// selfWind: false stops the star winding itself; turn: false stops the
// differential rotation (reduced motion: the plasma is frozen, so regions
// must not slide, and a snap's lon is where the region is drawn).
export function stepStar(star, dtSeconds, { selfWind = true, turn = true } = {}) {
  const dt = finiteOr0(dtSeconds);
  const events = [];
  if (dt <= 0) return events;
  const decay = Math.exp(-dt / SLIP_TAU_S);
  for (const r of [...star.regions]) {
    if (turn) r.lon += omega(r.lat) * dt;
    if (selfWind) r.starTurns += SELF_WIND_TURNS_PER_S * dt;
    if (!r.held) r.handTurns *= decay;
    if (regionTurns(r) >= TURNS_TO_SNAP) events.push(snapRegion(star, r));
  }
  return events;
}

export function applyStir(star, regionId, turns) {
  const r = star.regions.find((x) => x.id === regionId);
  if (!r) return null;
  r.handTurns += finiteOr0(turns);
  return regionTurns(r) >= TURNS_TO_SNAP ? snapRegion(star, r) : null;
}

function angleBetween(latA, lonA, latB, lonB) {
  const c = Math.sin(latA) * Math.sin(latB) + Math.cos(latA) * Math.cos(latB) * Math.cos(lonA - lonB);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

// Holds the region within GRAB_RADIUS_RAD of (lat, lon), else seeds a new
// hand-born one there. Returns its id, or null for a non-finite point.
// At the cap the least-wound unheld hand region is evicted; the "take the
// nearest" fallback is for hand-built states only (a real star has
// STAR_REGIONS < MAX_REGIONS - 1, so with one hand held there is always a
// hand region to evict). Snaps and evictions REASSIGN star.regions: callers
// re-read it every frame.
export function grab(star, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let near = null;
  let nearAngle = Infinity;
  for (const r of star.regions) {
    const a = angleBetween(lat, lon, r.lat, r.lon);
    if (a < nearAngle) { nearAngle = a; near = r; }
  }
  if (near && nearAngle <= GRAB_RADIUS_RAD) {
    near.held = true;
    return near.id;
  }
  if (star.regions.length >= MAX_REGIONS) {
    let evict = null;
    for (const r of star.regions) {
      if (r.born !== 'hand' || r.held) continue;
      if (!evict || regionTurns(r) < regionTurns(evict)) evict = r;
    }
    if (!evict) {
      // every slot is a star region or held: take the nearest rather than exceed the cap
      near.held = true;
      return near.id;
    }
    star.regions = star.regions.filter((r) => r !== evict);
  }
  const region = {
    id: star.nextId++, lat, lon, starTurns: 0, handTurns: 0, held: true, born: 'hand',
  };
  star.regions.push(region);
  return region.id;
}

export function release(star, regionId) {
  const r = star.regions.find((x) => x.id === regionId);
  if (!r) return null;
  r.held = false;
  return Math.abs(r.handTurns) >= MIN_SNAP_TURNS ? snapRegion(star, r) : null;
}
