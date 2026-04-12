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

const SIGN_ORDER = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];

const ASPECT_DEFS = [
  { angle: 0,   orb: 8, name: 'Conjunct' },
  { angle: 60,  orb: 6, name: 'Sextile'  },
  { angle: 90,  orb: 7, name: 'Square'   },
  { angle: 120, orb: 8, name: 'Trine'    },
  { angle: 180, orb: 8, name: 'Opposite' },
];

// Convert zodiac sign + degree to ecliptic longitude 0–360
export function signDegreeToLon(sign, degree) {
  const idx = SIGN_ORDER.indexOf(sign);
  return idx < 0 ? 0 : idx * 30 + degree;
}

// Compute the tightest major aspect between two planetary positions.
// Returns { name, orb } or null if no major aspect within orb.
export function computeAspect(sign1, deg1, sign2, deg2) {
  const lon1 = signDegreeToLon(sign1, deg1);
  const lon2 = signDegreeToLon(sign2, deg2);
  let sep = Math.abs(lon1 - lon2) % 360;
  if (sep > 180) sep = 360 - sep;
  let best = null;
  for (const { angle, orb, name } of ASPECT_DEFS) {
    const diff = Math.abs(sep - angle);
    if (diff <= orb && (!best || diff < best.diff)) {
      best = { name, orb: diff.toFixed(0), diff };
    }
  }
  return best ? { name: best.name, orb: best.orb } : null;
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
