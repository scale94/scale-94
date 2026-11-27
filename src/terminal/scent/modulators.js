// Modulators (spec §7.3): what the altar and the periphery hand the formula
// engine, read from values the visitor actually produced. Pure: no React, DOM,
// GL, WASM or WebCrypto. Every mapping is linear and clamped (P3 ruling 3):
//
//   /LUNAR  spine phase → existing dryness (12…96) → rest window 2…8 weeks
//   /SOL    last release on the store's own log-energy scale (E_MIN…E_MAX erg)
//           → tilt −1 (toward base) … +1 (toward top)
//   /CHAOS  sphere Lyapunov λ (0 … ln 2) → salt reach 0.05 … 0.30; r (3 … 4)
//           stands in when λ was never read
//
// An absent reading is named, never guessed: solTilt / chaosReach come back
// null and the engine writes its unwitnessed line.
import { drynessFor, DRYNESS } from '../data/lunarAccords';
import { E_MIN_ERG, E_MAX_ERG } from '../sol/solPhysics';
import { CHAOS_REACH_RANGE, TARGET_PCT } from './formulaEngine';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

const DRY_LO = Math.min(...Object.values(DRYNESS));   // 12 · DARK INCUBATION
const DRY_HI = Math.max(...Object.values(DRYNESS));   // 96 · MINERAL STILLNESS
const REST_MIN = 2;
const REST_SPAN = 6;

export function restWeeksFor(dryness) {
  return REST_MIN + Math.round(REST_SPAN * clamp01((dryness - DRY_LO) / (DRY_HI - DRY_LO)));
}

const LOG_LO = Math.log10(E_MIN_ERG);
const LOG_HI = Math.log10(E_MAX_ERG);

/** sol snapshot → tilt in −1…1, or null when nothing left the star. */
export function solTiltFor(sol) {
  if (!sol || !isNum(sol.lastReleaseErg) || sol.lastReleaseErg <= 0) return null;
  const t = clamp01((Math.log10(sol.lastReleaseErg) - LOG_LO) / (LOG_HI - LOG_LO));
  return 2 * t - 1;
}

/** art snapshot → reach in CHAOS_REACH_RANGE, or null when no regime was read. */
export function chaosReachFor(art) {
  if (!art) return null;
  const [lo, hi] = CHAOS_REACH_RANGE;
  let term;
  if (isNum(art.lyapunov)) term = clamp01(art.lyapunov / Math.LN2);
  else if (isNum(art.lastR)) term = clamp01(art.lastR - 3);
  else return null;
  return lo + (hi - lo) * term;
}

const erg = (e) => Number(e).toExponential(1).replace('e+', 'e');
const SOL_ENTERED = '/SOL entered — nothing left the star, the top notes left alone';

export function readModulators({ element, phase, periphery }) {
  if (!Object.prototype.hasOwnProperty.call(TARGET_PCT, element)) {
    throw new RangeError(`unknown element: ${String(element)}`);
  }
  if (typeof phase !== 'string' || !phase) throw new RangeError('a phase is required');
  const dryness = drynessFor(phase);
  const sol = periphery?.sol ?? null;
  const art = periphery?.art ?? null;

  const solTilt = solTiltFor(sol);
  const chaosReach = chaosReachFor(art);

  let chaosLabel = null;
  let chaosSource = null;
  if (art) {
    if (chaosReach == null) chaosSource = art.visits != null ? { visits: art.visits } : { touched: true };
    else if (isNum(art.lyapunov)) {
      chaosLabel = `λ ${art.lyapunov >= 0 ? '+' : '−'}${Math.abs(art.lyapunov).toFixed(3)}`;
      chaosSource = { lyapunov: art.lyapunov };
    } else {
      chaosLabel = `sphere r ${art.lastR.toFixed(2)}`;
      chaosSource = { lastR: art.lastR };
    }
  }

  return {
    element,
    restWeeks: restWeeksFor(dryness),
    solTilt,
    chaosReach,
    labels: {
      lunar: phase,
      sol: solTilt == null ? null : `last release ${erg(sol.lastReleaseErg)} erg`,
      solAbsent: sol && solTilt == null && sol.visits != null ? SOL_ENTERED : null,
      chaos: chaosLabel,
    },
    sources: {
      lunar: { phase, dryness },
      sol: !sol ? null : (solTilt == null ? (sol.visits != null ? { visits: sol.visits } : null) : { lastReleaseErg: sol.lastReleaseErg }),
      chaos: chaosSource,
    },
  };
}
