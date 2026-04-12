// Planet–element mappings and output parsing for TFG sphere astrology layer.

export const PLANET_MAP = {
  80: 'Mercury',  // Hg — alchemical Mercury
  79: 'Sun',      // Au — Gold
  47: 'Moon',     // Ag — Silver
  26: 'Mars',     // Fe — Iron
  29: 'Venus',    // Cu — Copper
  50: 'Jupiter',  // Sn — Tin
  82: 'Saturn',   // Pb — Lead
  92: 'Uranus',   // U  — Uranium
  93: 'Neptune',  // Np — Neptunium
  94: 'Pluto',    // Pu — Plutonium
};

export const PLANET_COLORS = {
  80: '#c0c0c0',  // Mercury — silver
  79: '#f59e0b',  // Sun — amber-gold
  47: '#e8e8f0',  // Moon — white-silver
  26: '#ef4444',  // Mars — red
  29: '#22c55e',  // Venus — green
  50: '#8b5cf6',  // Jupiter — purple
  82: '#78716c',  // Saturn — grey-brown
  92: '#06b6d4',  // Uranus — cyan
  93: '#3b82f6',  // Neptune — deep blue
  94: '#dc2626',  // Pluto — dark red
};

// Parse run_astro() text → { PlanetName: { sign, degree, retrograde, aspect } }
export function parseAstroOutput(raw) {
  const result = {};
  const blocks = raw.split('---\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 5) continue;
    const name       = lines[0].trim();
    const sign       = lines[1].replace('sign:', '').trim();
    const degree     = parseFloat(lines[2].replace('degree:', ''));
    const retrograde = lines[3].replace('retrograde:', '').trim() === 'true';
    const aspect     = lines[4].replace('aspect:', '').trim();
    result[name] = { sign, degree, retrograde, aspect };
  }
  return result;
}

// Ruling planet for non-planetary elements, by periodic group
export function getRuler(element) {
  const { group, block } = element;
  if (block === 'f' || group === null) return 'Neptune';
  if (group <= 2)   return 'Moon';
  if (group <= 5)   return 'Saturn';
  if (group <= 8)   return 'Mars';
  if (group <= 10)  return 'Venus';
  if (group === 11) return 'Sun';
  if (group <= 14)  return 'Mercury';
  return 'Jupiter';
}
