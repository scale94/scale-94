// hudFormat.js — the HUD's words and numbers (kept out of SolHud.jsx so the
// component file exports only the component).

import { LIGHT_DELAY_S } from './solPhysics';

const LIGHT_MIN = Math.floor(LIGHT_DELAY_S / 60);
const LIGHT_SEC = LIGHT_DELAY_S - LIGHT_MIN * 60;
export const LIGHT_LINE = `LIGHT · ${LIGHT_MIN} min ${LIGHT_SEC} s OLD`;

/** 5e32 -> "5.0e32"; one decimal of mantissa, rounding carried into the exponent. */
export function formatErg(erg) {
  return Number(erg).toExponential(1).replace('e+', 'e');
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Time to arrival as HH:MM:SS; seconds round up, so a cloud in flight never reads 00:00:00. */
export function formatEta(ms) {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(total % 60)}`;
}

/** One line per fate. U+2212 for the minus sign. */
export function landingLine({ fate, nT }) {
  if (fate === 'passed') return 'arrived · northward · passed';
  if (fate === 'unwitnessed') return 'arrived · unwitnessed';
  const n = Math.round(Math.abs(Number.isFinite(nT) ? nT : 0));
  return `arrived · southward · coupled · −${n} nT`;
}
