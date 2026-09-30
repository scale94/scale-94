// draft.js — the audit form as a provisional ocean source (spec §4 Form).
// validDraft: the form's numeric params when every field is present, numeric,
// in PARAM_RANGES and on the globe, and not exactly 0°, 0°; else null (the
// ghost freezes at its last valid state). createFrameCoalescer: at most one
// delivery per animation frame, carrying the latest value.

import { PARAM_RANGES, validateSubmission } from '../../ledger/verdictModel';
import { isNullIslandInput } from '../../ledger/coordinates';

const blank = (v) => {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return v === '';
};

// The one coordinate rule, shared by the ghost (validDraft) and the submit
// path: blank → required, non-finite → not a number, |lat| > 90 or
// |lon| > 180 → out of range (the bounds themselves are on the globe).
const COORDS = [['lat', 'Latitude', 90], ['lon', 'Longitude', 180]];

export function coordErrors(form) {
  const errors = [];
  for (const [field, label, limit] of COORDS) {
    const v = form[field];
    if (blank(v)) {
      errors.push({ field, message: `${label} is required` });
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) errors.push({ field, message: `${label} must be a number` });
    else if (Math.abs(n) > limit) errors.push({ field, message: `${label} must be between -${limit} and ${limit}` });
  }
  return errors;
}

// Exactly 0°, 0°: the value a blank coordinate used to become. Refused at
// submit and by the ghost, and never copied from a prior entry. The rule is
// ledger/coordinates.js's form-input reading (it coerces typed strings).
export const NULL_ISLAND_MESSAGE = '0°, 0° is open ocean. Enter the river site.';

export const isNullIsland = isNullIslandInput;

export function validDraft(form) {
  if (coordErrors(form).length) return null;
  if (isNullIsland(form.lat, form.lon)) return null; // submit refuses it, so no ghost either
  for (const key of Object.keys(PARAM_RANGES)) if (blank(form[key])) return null;
  const lat = Number(form.lat);
  const lon = Number(form.lon);
  const out = { lat, lon, siteName: form.siteName ?? '' };
  for (const key of Object.keys(PARAM_RANGES)) out[key] = Number(form[key]);
  return validateSubmission(out).length ? null : out;
}

export function createFrameCoalescer(
  fn,
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
) {
  let id = 0;
  let latest;
  return {
    push(value) {
      latest = value;
      if (!id) {
        id = raf(() => {
          id = 0;
          fn(latest);
        });
      }
    },
    cancel() {
      if (id) caf(id);
      id = 0;
    },
  };
}
