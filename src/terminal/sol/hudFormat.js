// hudFormat.js — the HUD's words and numbers (kept out of SolHud.jsx so the
// component file exports only the component).

import { FORGE_TABLE } from './forge';

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

export const MESSENGER_LABEL = {
  neutrinos: 'NEUTRINOS', light: 'LIGHT', protons: 'PROTONS', cloud: 'CLOUD', core: 'CORE LIGHT',
};

/** 172026 -> "CE 172 026" (groups of three joined by U+2009). */
export function formatYear(y) {
  const digits = String(Math.round(Number.isFinite(y) ? y : 0));
  return `CE ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

/** Local wall-clock HH:MM:SS. */
export function formatClock(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** One messenger's value, one line. A reading exists only once it has arrived. */
export function messengerValue(m) {
  const r = m.reading;
  if (m.key === 'core') return `surfaces ${formatYear(m.arrivesYear)}`;
  if (m.key === 'cloud') {
    if (!m.arrived) return `${formatEta(m.etaMs)} · ${r?.orientation || 'unread'}`;
    return landingLine({ fate: r?.fate, nT: r?.nT });
  }
  if (!m.arrived) return formatEta(m.etaMs);
  if (m.key === 'neutrinos') return 'arrived · undetected';
  if (m.key === 'light') {
    const s = Math.round(r?.ageS ?? 0);
    return `arrived · ${Math.floor(s / 60)} min ${s % 60} s old · ${r?.xray}`;
  }
  return `arrived · ${r?.s}`;
}

/** The selected id if it still exists, else the newest cloud's id, else null. */
export function pickStackId(clouds, selectedId) {
  if (selectedId != null && clouds.some((c) => c.id === selectedId)) return selectedId;
  let best = null;
  for (const c of clouds) if (best === null || c.launchedAt > best.launchedAt) best = c;
  return best ? best.id : null;
}

/** 7.82e10 -> "7.8e10 kg" (2 significant figures); non-positive or non-finite -> "—". */
export function formatKg(kg) {
  if (!Number.isFinite(kg) || kg <= 0) return '—';
  return `${formatErg(kg)} kg`;
}

/** The five FORGE rows in table order. Au is symbol and Z only: dark, empty, forever. */
export function forgeRows(ledger) {
  return FORGE_TABLE.map(({ symbol, z, role }) => {
    const label = role === 'spent' ? 'spent' : String(z);
    if (role === null) return { symbol, z, label, value: '', year: null, dark: true };
    const kg = ledger ? ledger[symbol] : undefined;
    const yearOf = symbol === 'C' ? ledger?.cYear : symbol === 'O' ? ledger?.oYear : null;
    return {
      symbol, z, label, value: formatKg(kg),
      year: role === 'dated' && Number.isFinite(yearOf) ? formatYear(yearOf) : null,
      dark: false,
    };
  });
}

export const HUD_VIEW_KEY = 'sol_hud_view_v1';

export function readHudView() {
  try {
    return localStorage.getItem(HUD_VIEW_KEY) === 'forge' ? 'forge' : 'clocks';
  } catch {
    return 'clocks';
  }
}

export function writeHudView(v) {
  try { localStorage.setItem(HUD_VIEW_KEY, v === 'forge' ? 'forge' : 'clocks'); } catch { /* volatile */ }
}
