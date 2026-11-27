import { domainById } from './domains.js';

// ── Perfume note library ──────────────────────────────────────────────────────
export const PERF_NOTES = {
  top: {
    citrus:   ['Bergamot','Neroli','Lemon Verbena','Yuzu','Pink Grapefruit','Bitter Orange'],
    fresh:    ['Violet Leaf','Aldehydes','Green Tea','Cucumber Accord','Water Lotus','Ozone'],
    spicy:    ['Black Pepper','Cardamom','Ginger','Elemi','Coriander Seed','Nutmeg'],
    floral:   ['Petitgrain','Neroli Bigarade','Peach Blossom','Lychee Rose','Osmanthus','Tiare'],
    woody:    ['Juniper Berry','Pink Pepper','Carrot Seed','Basil Grand Vert','Artemisia','Cistus'],
    oceanic:  ['Marine Accord','Sea Salt','Calone','Ozone Crystal','Arctic Moss','Dew Accord'],
    animalic: ['Aldehydic Musk','Ambrette Seed','Orris Root','Castoreum Tincture','Hyraceum','Galbanum'],
    resinous: ['Elemi Resin','Frankincense Essence','Galbanum','Labdanum Tincture','Opoponax','Benzoin'],
  },
  heart: {
    citrus:   ['Jasmine Sambac','Orange Blossom Absolute','Magnolia','Mimosa','Cyclamen','Heliotrope'],
    fresh:    ['Iris','Violet Absolute','White Tea Accord','Peony','Lily of the Valley','Muguet'],
    spicy:    ['Rose Absolute','Cinnamon Bark','Clove Bud','Saffron','Oud Rose','Pepper Heart'],
    floral:   ['Rose de Mai','Jasmine Absolute','Ylang-Ylang Extra','Iris Pallida','Tuberose','Gardenia'],
    woody:    ['Geranium Bourbon','Vetiver Haiti','Cedarwood Atlas','Sandalwood Mysore','Guaiac Wood','Birch'],
    oceanic:  ['Water Iris','Sea Lily Accord','Blue Lotus','Aquatic Jasmine','Kelp Extract','Seaweed'],
    animalic: ['Honey Absolute','Beeswax Absolute','Civet Accord','Costus Root','Ambrette Heart','Oakmoss'],
    resinous: ['Labdanum Absolute','Olibanum','Myrrh Heart','Benzoin Absolute','Styrax Levant','Elemi'],
  },
  base: {
    citrus:   ['Tonka Bean','White Musk','Benzoin Siam','Amber Accord','Hedione HC','Cashmeran'],
    fresh:    ['White Cedar','Cashmeran','White Musk Crystal','Driftwood','Sandalwood','Ambroxide'],
    spicy:    ['Black Oud','Tobacco Absolute','Labdanum','Leather Accord','Dark Amber','Castoreum'],
    floral:   ['Benzoin Siam','Australian Sandalwood','White Musk','Vanilla Absolute','Muskmallow','Tonka'],
    woody:    ['Patchouli Heart','Oakmoss Absolute','Vetiver Bourbon','Birch Tar','Iso E Super','Cedarwood'],
    oceanic:  ['Driftwood','Sea Amber','White Musk','Cashmeran','Ambroxide','Salt Cedar'],
    animalic: ['Ambergris Tincture','Musk Absolute','Civet Absolute','Castoreum','Oud Kyara','Deer Musk'],
    resinous: ['Frankincense Hojari','Myrrh Resinoid','Benzoin','Opoponax Resin','Dark Patchouli','Labdanum'],
  },
};

// Deterministic note picker — stable per domain pair, no runtime randomness
const _pickNote = (arr, hA, hB, seed) =>
  arr[Math.abs(Math.floor(hA * 7 + hB * 3 + seed)) % arr.length];

// ── Family interference patterns ────────────────────────────────────────────
// When two olfactory families collide, the chimera takes a named "interference"
// identity instead of a generic combination. Heart-note picker biases toward
// the interference vocabulary if those notes exist in PERF_NOTES.

export const FAMILY_INTERFERENCE = {
  'citrus|woody':     { label: 'SMOKED',       prefix: 'Smoked',       notesBias: ['lapsang','cade','birch tar','smoked vetiver'] },
  'floral|animalic':  { label: 'SENSUAL',      prefix: 'Sensual',      notesBias: ['indole','civet','hyrax','jasmine sambac'] },
  'fresh|woody':      { label: 'GEOLOGICAL',   prefix: 'Geological',   notesBias: ['wet basalt','salt aerosol','flint','iodine'] },
  'floral|fresh':     { label: 'ROMANTIC',     prefix: 'Romantic',     notesBias: ['galbanum','mimosa','oakmoss','rose centifolia'] },
  'animalic|woody':   { label: 'ARCHAIC',      prefix: 'Archaic',      notesBias: ['labdanum','hyrax','tar musk','ambergris'] },
  'animalic|spicy':   { label: 'SUBTERRANEAN', prefix: 'Subterranean', notesBias: ['petrichor','geosmin','wet stone','musk seed'] },
  'citrus|oceanic':   { label: 'MARINE',       prefix: 'Marine',       notesBias: ['sea spray','calone','grapefruit zest','aldehyde'] },
};

export function lookupInterference(domA, domB) {
  if (!domA || !domB) return null;
  const key = [domA, domB].map(s => s.toLowerCase()).sort().join('|');
  return FAMILY_INTERFERENCE[key] || null;
}

export function buildPerfumeCard(domA, domB, result) {
  const dA  = domainById(domA);
  const dB  = domainById(domB);
  const acc = result.accord;
  const dom = acc?.dominant?.id || 'floral';
  const hA  = dA.hue;
  const hB  = dB.hue;

  const avg = (hA + hB) / 2;
  const sec =
    avg < 40  ? 'spicy'   : avg < 80  ? 'fresh'  :
    avg < 150 ? 'oceanic' : avg < 200 ? 'fresh'  :
    avg < 260 ? 'floral'  : avg < 300 ? 'woody'  :
    avg < 340 ? 'animalic': 'spicy';

  const pick = (fam, s) => _pickNote(PERF_NOTES.top[fam]   || PERF_NOTES.top.citrus,   hA, hB, s);
  const pickH = (fam, s) => _pickNote(PERF_NOTES.heart[fam] || PERF_NOTES.heart.floral, hA, hB, s);
  const pickB = (fam, s) => _pickNote(PERF_NOTES.base[fam]  || PERF_NOTES.base.woody,   hA, hB, s);

  const bFam = (acc?.animalicIntensity || 0) > 0.45 ? 'animalic'
    : (acc?.polarity || 0.5) > 0.65 ? 'woody' : dom;

  const topNotes   = [pick(dom, 0),   pick(sec, 13)];
  let heartNotes = [pickH(dom, 5),  pickH(sec, 19),
    ...(result.novelty > 0.55 ? [pickH('spicy', 31)] : [])];
  const baseNotes  = [pickB(bFam, 3), pickB(sec, 23)];

  // Apply interference bias — replace the second heart note with an interference
  // note IF such a note exists in any heart family pool.
  const interference = lookupInterference(dom, sec);
  if (interference) {
    const allHeartNotes = Object.values(PERF_NOTES.heart).flat();
    const biasMatches = interference.notesBias.filter(n => allHeartNotes.includes(n));
    if (biasMatches.length > 0) {
      const idx = Math.abs(Math.floor(hA * 5 + hB * 11)) % biasMatches.length;
      heartNotes[1] = biasMatches[idx];
    }
  }

  return {
    name: (interference
      ? `${interference.prefix} ${heartNotes[0]} Chimera`
      : (result.chimeraName || `${dA.short} × ${dB.short}`))
        .replace(/[^\w\s×·]/g, '').trim().toUpperCase().slice(0, 42),
    id: `${domA}-${domB}-${Math.round(hA + hB)}`,
    topNotes, heartNotes, baseNotes,
    dom, sec,
    hueA: hA, hueB: hB,
    nodeClass: acc?.nodeClass?.id        || 'RTA',
    polLabel:  acc?.polarityClass?.label || '',
    evap:      acc?.evapCurve            || [0.33, 0.33, 0.34],
    interference,
  };
}

// ── Tesseract Protocol — cryptographic identity layer ────────────────────────

export async function generateAccordHash(card, accord, domA, domB) {
  const canonical = JSON.stringify({
    d: [domA, domB],
    h: [card.hueA, card.hueB],
    n: [...card.topNotes, ...card.heartNotes, ...card.baseNotes],
    s: +(accord?.sillage ?? 0).toFixed(6),
    f: +(accord?.fixation ?? 0).toFixed(6),
    e: (accord?.evapCurve || [0.33, 0.33, 0.34]).map(v => +v.toFixed(6)),
    p: +(accord?.polarity ?? 0.5).toFixed(6),
    nc: accord?.nodeClass?.id || 'RTA',
    cs: +(accord?.cleanRoom ?? 0).toFixed(6),
    sv: +(accord?.sovereignty ?? 0).toFixed(6),
  });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// The vault payload (encrypted formula, CAS numbers, SG / flash point /
// maceration) was invented, not measured, so it is gone until P2 builds a real
// formula from cited data. What remains is honest: the SHA-256 of the accord,
// the collision's axes and its viability.
export async function buildTesseractProfile(card, accord, domA, domB, result) {
  const hash = await generateAccordHash(card, accord, domA, domB);
  return {
    hash,
    dims: result ? {
      convergence: result.convergence || [],
      divergence:  result.divergence  || [],
      paradoxes:   result.paradoxes   || [],
    } : null,
    viability: result?.viability ?? 5,
  };
}
