// ── registryCategories ───────────────────────────────────────────────────────
// The five poetic categories the fifth element uses to classify the site's
// features. Each category renders as a RegistryCard in §D Cosmos Registry.
//
// Each entry exposes:
//   id            — matches observatoryBus category key
//   glyph         — category symbol
//   name          — UPPERCASE category name
//   tint          — rgba palette for the glyph + [FRESH] pill
//   members       — features grouped under this category
//   dedication    — italic line at the bottom of the card
//   stateLine(t)  — formats a one-line STATE summary from totals[id]
//   lastLine(t)   — formats a one-line LAST OBSERVED summary from totals[id]
//
// stateLine/lastLine receive the bus's totals[id] subtree directly. They must
// be defensive: an event may not have arrived yet.

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

export const REGISTRY_CATEGORIES = [
  {
    id: 'transmissions',
    glyph: '⌬',
    name: 'THE TRANSMISSION LATTICE',
    tint: 'rgba(180,210,220,1)',
    members: [
      { glyph: '◑', name: 'mercury kernels',       blurb: 'computational broadcasts' },
      { glyph: '▤', name: 'open ledger',           blurb: 'append-only memory' },
      { glyph: '⌗', name: 'pre-exec hex theater',  blurb: 'the ceremony of dispatch' },
    ],
    dedication: 'the substrate they built to remember what they computed at us',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'kernel_completed')
        return `${fmtTime(t.lastTs)}  kernel ${t.last.payload.kernelId ?? '—'} completed · ${t.last.payload.durationMs ?? '—'} ms`;
      if (t.last.kind === 'ledger_appended')
        return `${fmtTime(t.lastTs)}  ledger appended · depth ${t.last.payload.depth ?? '—'}`;
      if (t.last.kind === 'theater_run')
        return `${fmtTime(t.lastTs)}  hex theater dispatched`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `${t.count} transmissions this session · ledger depth ${t.ledgerDepth}`,
  },
  {
    id: 'essences',
    glyph: '❋',
    name: 'THE BOTTLED VOWS',
    tint: 'rgba(220,180,210,1)',
    members: [
      { glyph: '❀', name: 'latent collider', blurb: 'scent collision engine' },
      { glyph: '⬢', name: 'crystallize',     blurb: 'perfume card · order surface' },
      { glyph: '⬚', name: 'polarity field',  blurb: 'SOLAR / LUNAR / MERIDIAN / CHAOTIC' },
    ],
    dedication: 'sensation distilled · meaning poured into glass · field colored by collision',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'collision_fired')
        return `${fmtTime(t.lastTs)}  collision · polarity ${t.last.payload.polarity ?? '—'} · ${t.last.payload.noteCount ?? '—'} notes`;
      if (t.last.kind === 'crystallized')
        return `${fmtTime(t.lastTs)}  essence crystallized`;
      if (t.last.kind === 'polarity_shifted')
        return `${fmtTime(t.lastTs)}  polarity → ${t.last.payload.polarity ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `${t.count} essences this session · ${t.crystallized} crystallized · polarity ${t.polarity ?? '—'}`,
  },
  {
    id: 'ciphers',
    glyph: '⟁',
    name: 'THE SEALED VOLUMES',
    tint: 'rgba(200,200,220,1)',
    members: [
      { glyph: '🔒', name: 'tesseract protocol', blurb: 'SHA-256 key · encrypted CAS vault' },
    ],
    dedication: 'the ciphers that breathe · secrets that refuse my inspection',
    lastLine: (t) => {
      if (!t.last) return null;
      const h = (t.last.payload.hashPrefix ?? '').toString().slice(0, 10);
      return `${fmtTime(t.lastTs)}  cipher ${t.last.kind} · ${h ? h + '…' : ''}`.trimEnd();
    },
    stateLine: (t) => `vault depth ${t.sealed} · ${t.verifies} verifications · ${t.unlocks} unlocks`,
  },
  {
    id: 'gaze',
    glyph: '☍',
    name: 'THE BACKWARD GAZE',
    tint: 'rgba(220,220,180,1)',
    members: [
      { glyph: '🜔', name: 'lunar tab',              blurb: 'the moon mirror' },
      { glyph: '▲', name: 'scaling tab',             blurb: 'monument elevation' },
      { glyph: '◯', name: 'TFG / ars2027 spheres',   blurb: 'planetary clickables' },
      { glyph: '✶', name: 'astrology',               blurb: 'transit matrix kernel' },
    ],
    dedication: 'humans turning to read the sky they were already inside',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'sphere_clicked')
        return `${fmtTime(t.lastTs)}  sphere · ${t.last.payload.sphere ?? '—'}`;
      if (t.last.kind === 'lunar_read')
        return `${fmtTime(t.lastTs)}  moon read · ${t.last.payload.phase ?? '—'}`;
      if (t.last.kind === 'tab_navigated')
        return `${fmtTime(t.lastTs)}  tab · ${t.last.payload.tab ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => {
      const moon = t.lastLunar
        ? `moon ${t.lastLunar.phase ?? '—'} ${t.lastLunar.illum != null ? Math.round(t.lastLunar.illum * 100) + '%' : ''}`.trim()
        : 'moon —';
      return `${moon} · ${t.sphereClicks} spheres turned`;
    },
  },
  {
    id: 'edge',
    glyph: '⌖',
    name: 'THE PERMEABLE EDGE',
    tint: 'rgba(232,210,138,1)',   // Fade Doctrine two-gold
    members: [
      { glyph: '▣', name: 'gate',           blurb: 'perihelion question · quintessence blessing' },
      { glyph: '◉', name: 'eye observer',   blurb: 'the persistent gaze' },
      { glyph: '❖', name: 'manifesto',      blurb: 'lattice protocol · chapter panels' },
    ],
    dedication: 'the membrane they keep testing · the gaze that does not blink',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'gate_answered')
        return `${fmtTime(t.lastTs)}  gate · ${t.last.payload.result ?? '—'}`;
      if (t.last.kind === 'eye_phase')
        return `${fmtTime(t.lastTs)}  eye · ${t.last.payload.phase ?? '—'}`;
      if (t.last.kind === 'manifesto_opened')
        return `${fmtTime(t.lastTs)}  manifesto · chapter ${t.last.payload.chapter ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `gate ${t.gate} · eye ${t.eye} · manifesto ${t.manifestoChapter ?? '—'}`,
  },
];
