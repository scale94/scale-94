// draft.js — the audit form as a provisional ocean source (spec §4 Form).
// validDraft: the form's numeric params when every field is present, numeric,
// in PARAM_RANGES and on the globe; else null (the ghost freezes at its last
// valid state). createFrameCoalescer: at most one delivery per animation
// frame, carrying the latest value.

import { PARAM_RANGES, validateSubmission } from '../../ledger/verdictModel';

const blank = (v) => v === '' || v === undefined || v === null;

export function validDraft(form) {
  if (blank(form.lat) || blank(form.lon)) return null;
  for (const key of Object.keys(PARAM_RANGES)) if (blank(form[key])) return null;
  const lat = Number(form.lat);
  const lon = Number(form.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
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
