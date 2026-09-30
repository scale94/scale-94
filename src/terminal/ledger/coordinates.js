// coordinates.js — the ledger's one definition of 0°, 0°.
//
// For the ledger's first hours a blank coordinate was stored as Number('') = 0,
// so exactly 0°, 0° means "no site given", never the Gulf of Guinea. Two
// readings of that one rule, deliberately different in what they accept:
//
// - isUnlocatedRecord(coords): a STORED verdict's coordinates. Exact numbers
//   only (user ruling): the submit path stores Number() values, so a record is
//   UNLOCATED only at numeric 0, 0. It keeps its hash and its place in the
//   archive; it is never a source, ring or plume.
// - isNullIslandInput(lat, lon): FORM input (strings as typed). Coerces, so
//   '0', '-0' and '0.0' all count; blank is not 0 (blank is "required", a
//   separate error). Refused at submit and by the ghost's validDraft.
//
// Pure: imports nothing, so the ocean (which must never reach the ledger's
// store or bus) and the views can both depend on it.

export const UNLOCATED_LABEL = 'UNLOCATED';

export function isUnlocatedRecord(coordinates) {
  return !!coordinates && coordinates.lat === 0 && coordinates.lon === 0;
}

const blank = (v) => v === undefined || v === null || (typeof v === 'string' ? v.trim() === '' : v === '');

export function isNullIslandInput(lat, lon) {
  return !blank(lat) && !blank(lon) && Number(lat) === 0 && Number(lon) === 0;
}
