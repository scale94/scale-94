// src/terminal/mercury/planet/airborneCatchUp.js — a hidden tab (or a long stall) skips real time. coolBody spends it on
// the planet's heat, so the planet may refreeze while away; the airborne Hg (the breakup / hyper family and the glitter
// beads) used to get only the clamped 0.1 s and came back orbiting a crust. Here it flies through the same skipped time,
// headless, so on return it has come home as it would have with the tab visible (return targets land before the
// refreeze by design). Past CATCHUP_MAX_S nothing is replayed: the family resets with its volume home, the beads clear.
// Pure (no three).

import { stepFamily } from './breakupStep';
import { finishMuSolver } from './breakupBudget';
import { createFamily } from './breakupFamily';
import { coreScale } from './hyperFling';
import { R_SCENE } from './planetLook';
import { stepBeads } from './hgBeads';

export const CATCHUP_MIN_S = 0.25; // skipped time under this is a slow frame, not an absence
export const CATCHUP_MAX_S = 20;   // ≥ any return target (refreeze-capped), so a replay always finishes the flight
const BEAD_CATCHUP_DT = 1 / 30;

// Returns the solver to keep (null after a reset). Events are dropped: their ripples would have died while away.
// crust: the planet came back crusted (coolBody runs the refreeze through the gap): whatever the replay did not bring
// home is cleared on the spot, volume home, rather than orbiting the rock until the live guard fades it.
export function catchUpFamily(fam, solver, env, seconds, crust = false) {
  if (fam.phase !== 'fired') return solver;
  if (seconds > CATCHUP_MAX_S) {
    Object.assign(fam, createFamily(fam.seed));
    return null;
  }
  if (solver && !solver.done) {
    finishMuSolver(solver);
    if (fam.hyper) fam.eta = solver.best; else fam.mu = solver.best;
  }
  // the core regrows as beads land: read its live size each substep (the caller's coreScale is a frame stale). No freeze
  // guard in the replay: the body has already cooled through the whole absence, so the guard would clear drops that
  // landed in time; whatever is still out after it the live guard (breakupStep, env.freezeIn) clears on the next frame.
  stepFamily(fam, seconds, { ...env, freezeIn: Infinity, planetRadiusAt: () => R_SCENE * coreScale(fam) });
  fam.events.length = 0;
  if (crust && fam.phase === 'fired') {
    Object.assign(fam, createFamily(fam.seed));
    return null;
  }
  return solver;
}

// crust: as catchUpFamily, the beads still out over a planet that came back crusted are cleared on the spot.
export function catchUpBeads(b, seconds, ctx, crust = false) {
  if (seconds > CATCHUP_MAX_S) { b.n = 0; b.nHits = 0; return b; }
  const ff = { ...ctx, liquid: false, freezeIn: Infinity }; // nothing new is shed while away; landings as for the family
  for (let t = 0; t < seconds; t += BEAD_CATCHUP_DT) stepBeads(b, Math.min(BEAD_CATCHUP_DT, seconds - t), ff);
  if (crust) b.n = 0;
  b.nHits = 0;
  return b;
}
