// protectionProtocol.js — the four PROTECTION_PROTOCOL levers' shared facts: their UI accent
// colours (the lever rows draw with these; the masthead eye's rim mixes them) and the growth
// gate above which they lock out. One source, so the eye can never drift from the UI.

export const LEVER_KEYS = ['toxicityCap', 'sanctuary', 'restoration', 'nativeBio'];

export const LEVER_ACCENTS = {
  toxicityCap: '#5a8ac0',
  sanctuary:   '#5fbf3a',
  restoration: '#3fd06a',
  nativeBio:   '#7fe08a',
};

export const LEVER_GATE = 3.0;   // % growth: at or above, the protections are inert

export const hexRgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const RGB = Object.fromEntries(LEVER_KEYS.map((k) => [k, hexRgb(LEVER_ACCENTS[k])]));

// levers { key: 0..1 } -> { w: mean pull 0..1, col: value-weighted accent mix (null if none) }.
export function protocolRim(levers) {
  let sum = 0;
  const col = [0, 0, 0];
  for (const k of LEVER_KEYS) {
    const v = Math.min(1, Math.max(0, Number.isFinite(levers?.[k]) ? levers[k] : 0));
    sum += v;
    for (let i = 0; i < 3; i++) col[i] += RGB[k][i] * v;
  }
  if (sum <= 0) return { w: 0, col: null };
  return { w: sum / LEVER_KEYS.length, col: col.map((c) => c / sum) };
}
