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

// ── CAS registry — maps note names to CAS numbers for encrypted formula ──────
export const CAS_REGISTRY = {
  'Bergamot': '8007-75-8', 'Neroli': '8016-38-4', 'Lemon Verbena': '8024-12-2',
  'Yuzu': '61788-56-5', 'Pink Grapefruit': '8016-20-4', 'Bitter Orange': '68916-04-1',
  'Violet Leaf': '8024-08-6', 'Aldehydes': '112-31-2', 'Green Tea': '84650-60-2',
  'Cucumber Accord': '80-71-7', 'Water Lotus': '8002-44-0', 'Ozone': '10028-15-6',
  'Black Pepper': '8006-82-4', 'Cardamom': '8000-66-6', 'Ginger': '8007-08-7',
  'Elemi': '9000-75-3', 'Coriander Seed': '8008-52-4', 'Nutmeg': '8008-45-5',
  'Petitgrain': '8014-17-3', 'Neroli Bigarade': '72968-50-4', 'Peach Blossom': '104-67-6',
  'Lychee Rose': '106-24-1', 'Osmanthus': '68917-05-5', 'Tiare': '8006-80-2',
  'Juniper Berry': '8012-91-7', 'Pink Pepper': '68650-39-5', 'Carrot Seed': '8015-88-1',
  'Basil Grand Vert': '8015-73-4', 'Artemisia': '8022-37-5', 'Cistus': '8016-26-0',
  'Marine Accord': '67634-15-5', 'Sea Salt': '7647-14-5', 'Calone': '28940-11-6',
  'Ozone Crystal': '10028-15-6', 'Arctic Moss': '90028-67-4', 'Dew Accord': '80-71-7',
  'Aldehydic Musk': '81-14-1', 'Ambrette Seed': '8015-62-1', 'Orris Root': '8002-73-1',
  'Castoreum Tincture': '8023-83-4', 'Hyraceum': '68916-97-2', 'Galbanum': '9000-72-0',
  'Elemi Resin': '9000-75-3', 'Frankincense Essence': '8016-36-2',
  'Labdanum Tincture': '8016-26-0', 'Opoponax': '9000-78-6', 'Benzoin': '9000-05-9',
  'Jasmine Sambac': '8022-96-6', 'Orange Blossom Absolute': '8016-38-4',
  'Magnolia': '8007-71-0', 'Mimosa': '8031-03-6', 'Cyclamen': '103-95-7', 'Heliotrope': '120-57-0',
  'Iris': '8002-73-1', 'Violet Absolute': '8024-08-6', 'White Tea Accord': '84650-60-2',
  'Peony': '8002-09-3', 'Lily of the Valley': '8000-48-4', 'Muguet': '80-54-6',
  'Rose Absolute': '8007-01-0', 'Cinnamon Bark': '8015-91-6', 'Clove Bud': '8000-34-8',
  'Saffron': '8024-02-0', 'Oud Rose': '8016-38-4', 'Pepper Heart': '8006-82-4',
  'Rose de Mai': '8007-01-0', 'Jasmine Absolute': '8022-96-6',
  'Ylang-Ylang Extra': '8006-81-3', 'Iris Pallida': '55066-56-3',
  'Tuberose': '8024-05-3', 'Gardenia': '68917-05-5',
  'Geranium Bourbon': '8000-46-2', 'Vetiver Haiti': '8016-96-4',
  'Cedarwood Atlas': '8000-27-9', 'Sandalwood Mysore': '8006-87-9',
  'Guaiac Wood': '8016-23-7', 'Birch': '8001-88-5',
  'Water Iris': '8002-73-1', 'Sea Lily Accord': '8000-48-4',
  'Blue Lotus': '8002-44-0', 'Aquatic Jasmine': '8022-96-6',
  'Kelp Extract': '90028-67-4', 'Seaweed': '90028-67-4',
  'Honey Absolute': '8028-66-8', 'Beeswax Absolute': '8012-89-3',
  'Civet Accord': '68916-26-7', 'Costus Root': '8023-88-9',
  'Ambrette Heart': '8015-62-1', 'Oakmoss': '9000-50-4',
  'Labdanum Absolute': '8016-26-0', 'Olibanum': '8016-36-2',
  'Myrrh Heart': '9000-45-7', 'Benzoin Absolute': '9000-05-9',
  'Styrax Levant': '8024-01-9',
  'Tonka Bean': '8046-22-8', 'White Musk': '81-14-1', 'Benzoin Siam': '9000-73-1',
  'Amber Accord': '8007-35-0', 'Hedione HC': '24851-98-7', 'Cashmeran': '33704-61-9',
  'White Cedar': '8000-27-9', 'White Musk Crystal': '81-14-1',
  'Driftwood': '8000-27-9', 'Sandalwood': '8006-87-9', 'Ambroxide': '6790-58-5',
  'Black Oud': '68951-36-0', 'Tobacco Absolute': '8037-19-2',
  'Labdanum': '8016-26-0', 'Leather Accord': '8001-88-5', 'Dark Amber': '8007-35-0',
  'Castoreum': '8023-83-4',
  'Australian Sandalwood': '8006-87-9', 'Vanilla Absolute': '8024-06-4',
  'Muskmallow': '8015-62-1', 'Tonka': '8046-22-8',
  'Patchouli Heart': '8014-09-3', 'Oakmoss Absolute': '9000-50-4',
  'Vetiver Bourbon': '8016-96-4', 'Birch Tar': '8001-88-5',
  'Iso E Super': '54464-57-2', 'Cedarwood': '8000-27-9',
  'Sea Amber': '8007-35-0', 'Salt Cedar': '8000-27-9',
  'Ambergris Tincture': '8038-65-1', 'Musk Absolute': '81-14-1',
  'Civet Absolute': '68916-26-7', 'Oud Kyara': '68951-36-0', 'Deer Musk': '541-91-3',
  'Frankincense Hojari': '8016-36-2', 'Myrrh Resinoid': '9000-45-7',
  'Opoponax Resin': '9000-78-6', 'Dark Patchouli': '8014-09-3',
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

  const sil  = acc?.sillage  ?? 0.5;
  const fix  = acc?.fixation ?? 0.5;
  const pers = acc?.persists ?? false;

  return {
    name: (interference
      ? `${interference.prefix} ${heartNotes[0]} Chimera`
      : (result.chimeraName || `${dA.short} × ${dB.short}`))
        .replace(/[^\w\s×·]/g, '').trim().toUpperCase().slice(0, 42),
    id: `${domA}-${domB}-${Math.round(hA + hB)}`,
    conc:
      sil > 0.72 ? 'EXTRAIT DE PARFUM' : sil > 0.50 ? 'EAU DE PARFUM' :
      sil > 0.28 ? 'EAU DE TOILETTE'   : 'EAU DE COLOGNE',
    concPct:
      sil > 0.72 ? '22–30%' : sil > 0.50 ? '15–20%' : sil > 0.28 ? '8–14%' : '2–6%',
    longevity:
      pers && fix > 0.75 ? '14–20 hours' : pers ? '10–14 hours' :
      fix > 0.55         ? '6–10 hours'  : '3–6 hours',
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

export function buildEncryptedFormula(card, accord) {
  const allNotes = [...card.topNotes, ...card.heartNotes, ...card.baseNotes];
  const sil = accord?.sillage ?? 0.5;
  const fix = accord?.fixation ?? 0.5;
  const evap = accord?.evapCurve || [0.33, 0.33, 0.34];

  const casEntries = allNotes.map((note, i) => ({
    note,
    cas: CAS_REGISTRY[note] || '00000-00-0',
    pct: +(((i < 2 ? evap[0] : i < 5 ? evap[1] : evap[2]) / (i < 2 ? 2 : 3)) * 100).toFixed(2),
    mg:  +(((i < 2 ? evap[0] : i < 5 ? evap[1] : evap[2]) / (i < 2 ? 2 : 3)) * 450).toFixed(1),
  }));

  const specificGravity = +(0.82 + sil * 0.14).toFixed(4);
  const flashPoint = +(48 + (1 - evap[0]) * 35).toFixed(1);
  const macDays = Math.round(14 + fix * 56);

  // Serialize as hex — simulated AES-256-GCM ciphertext
  const raw = JSON.stringify({ cas: casEntries, sg: specificGravity, fp: flashPoint, mac: macDays });
  const hexPayload = Array.from(new TextEncoder().encode(raw))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    ciphertext: hexPayload,
    casEntries,
    specificGravity,
    flashPoint,
    macDays,
    dilutionRatio: +(sil * 0.28 + 0.02).toFixed(4),
  };
}

export async function buildTesseractProfile(card, accord, domA, domB, result) {
  const hash = await generateAccordHash(card, accord, domA, domB);
  const encryptedFormula = buildEncryptedFormula(card, accord);
  return {
    hash,
    publicProfile: {
      hash,
      name: card.name,
      conc: card.conc,
      concPct: card.concPct,
      topNotes: card.topNotes,
      heartNotes: card.heartNotes,
      baseNotes: card.baseNotes,
      dom: card.dom,
      sec: card.sec,
      nodeClass: card.nodeClass,
      polLabel: card.polLabel,
      longevity: card.longevity,
      evap: card.evap,
    },
    encryptedFormula,
    dims: result ? {
      convergence: result.convergence || [],
      divergence:  result.divergence  || [],
      paradoxes:   result.paradoxes   || [],
    } : null,
    viability: result?.viability ?? 5,
  };
}
