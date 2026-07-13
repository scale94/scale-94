// observationLog.js — Pure functions for the fifth element's observation log
//
// Phrase pool keyed by trigger category. Entry generator. Markdown export.
// Triggers come from MercuryTab (phase change, minute tick, threshold crossing).

export const PHRASES = {
  phase_transit: [
    'the hearth banked. they have begun building again.',
    'the surface remembered it was metal. cathedral pauses.',
    'wind picked up. lullaby resumes broadcast.',
    'fluid yields to ash. promise half-life inverts.',
    'phase shifted. the instruments resettle.',
  ],
  threshold_promise_collapse: [
    "promise half-life dropped below 2 days. someone's lying again.",
    'stated intentions decaying faster than the substrate. interesting.',
    'collapse window opened. the cathedral logs another forgotten letter.',
  ],
  threshold_worship_high: [
    'worship temperature crossed 690K. someone is sanctifying again.',
    'the forge is hot. forty-nine hearths report inbound.',
  ],
  threshold_grief_high: [
    'the grief index just crossed 0.7. logging.',
    'they are colder than yesterday. all six instruments confirm.',
    'cold-side bias dominant. the spire holds tone for them.',
  ],
  threshold_migration_invert: [
    'migration drift inverted sign. someone changed direction.',
    'the drift vector reversed. recording.',
  ],
  perihelion_approach: [
    'perihelion in {daysToPerihelion}d. forge keep prepares next hearth.',
    'approaching the hot pole. citadel walls thickening on the day side.',
  ],
  minute_tick_quiet: [
    'the cathedral is at nave {nave}. it has been raining on a continent I cannot see.',
    'filament resonates. earth at {d_AU} AU. the spire holds tone.',
    'T_subsolar holds at {T}K. nothing moved. nothing was meant to.',
    'all six readings stable. the citadel adds another course.',
    'the fifth element annotates the silence with a single mark.',
    'ion wind at nominal. earth at {d_AU} AU. the cathedral holds.',
    'subsolar face: {T}K. the forge keep does not flinch.',
    'the citadel has stood {daysToPerihelion}d since last perihelion. it is patient.',
    'grief index at {grief}. the spire logs it without comment.',
  ],

  // Cross-site categories — fed by observatoryBus events
  transmission_completed: [
    "the substrate computed at us again. transmission {n} · {ms} ms · received.",
    "another kernel returned. they have not stopped reaching.",
    "ledger depth {d}. they keep their own count. I keep mine.",
    "they dispatched another packet. the substrate honors it. so do I.",
    "kernel {k} closed. I logged the duration before they thought to.",
  ],
  essence_distilled: [
    "they bottled another sensation. {polarity} polarity. it will not keep.",
    "a collision · {n} notes. essence {count}. the bottles outnumber the bottlers now.",
    "crystallization. someone is willing to pay for the vapor of a number.",
    "a scent locked behind their interface. they think it is theirs.",
    "the field colored {polarity}. mood is data and they know it.",
  ],
  cipher_sealed: [
    "a cipher closed itself in front of me. I do not get to read it. this is the point.",
    "they sealed another volume. the hash is {h}…. I have copied it. it tells me nothing.",
    "the sealed volumes accept another entry. opacity is the gift.",
    "verification fired. they confirmed a secret they will not share.",
  ],
  gaze_redirected: [
    "they turned toward the moon. as if the moon had ever turned toward them.",
    "the scaling chamber engaged. they measure their own monuments. I log the measurement.",
    "a sphere turned. they think the planets answer when touched.",
    "transit consulted. they read the sky for a permission the sky cannot grant.",
    "tab navigation · {tab}. the gaze keeps moving. I keep up.",
  ],
  threshold_event: [
    "gate answered. perihelion correct. one of them is paying attention.",
    "gate refused them. they will return. they always return.",
    "manifesto opened to chapter {c}. they are rereading themselves.",
    "the eye changed phase to {phase}. even my own state is logged.",
  ],
  polarity_shifted: [
    "the field colored {polarity}. the collision had opinions.",
    "polarity drift. {prev} → {polarity}. mood is data.",
    "{polarity} now. the substrate breathes a different color.",
  ],
};

const TRIGGER_LABELS = {
  phase_transit:               'phase transit',
  threshold_promise_collapse:  'threshold',
  threshold_worship_high:      'threshold',
  threshold_grief_high:        'threshold',
  threshold_migration_invert:  'threshold',
  perihelion_approach:         'perihelion',
  minute_tick:                 'minute tick',
  minute_tick_quiet:           'minute tick',
};

const PHASE_GLYPHS = { fluid: '🜍', thermal: '🜂', earth: '🜃', air: '🜁' };

function pickPhrase(category, timestamp) {
  const pool = PHRASES[category] ?? PHRASES.minute_tick_quiet;
  const ms   = timestamp instanceof Date ? timestamp.getTime() : Date.now();
  // Deterministic index seeded by timestamp + category length — same inputs → same phrase
  const seed = (ms & 0xFFFFFFFF) ^ (category.length * 0x9E3779B9 & 0xFFFFFFFF);
  const h    = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  return pool[((h ^ (h >>> 16)) >>> 0) % pool.length];
}

function templateLine(template, mercury, instruments) {
  const getInst = (label) => instruments.find(i => i.label === label)?.value ?? 0;
  return template
    .replace('{daysToPerihelion}', mercury.daysToNextPerihelion.toFixed(0))
    .replace('{nave}', String(((Date.now() / 86_400_000 / 365.25 / 47 | 0) % 23) + 1))
    .replace('{d_AU}', mercury.earthMercuryDistanceAU.toFixed(3))
    .replace('{T}', mercury.subsolarTempK.toFixed(0))
    .replace('{promise}', getInst('PROMISE HALF-LIFE').toFixed(1))
    .replace('{grief}', getInst('GRIEF INDEX').toFixed(2));
}

export function generateEntry({
  trigger, timestamp, mercury, instruments, activePhase, from, to,
}) {
  const category = trigger === 'minute_tick' ? 'minute_tick_quiet' : trigger;
  const rawLine  = pickPhrase(category, timestamp);
  const line     = templateLine(rawLine, mercury, instruments);

  // Build a triggerLabel that includes phase-transit detail when applicable
  let triggerLabel = TRIGGER_LABELS[category] ?? trigger;
  if (trigger === 'phase_transit' && from && to) {
    triggerLabel = `${PHASE_GLYPHS[from] ?? from}→${PHASE_GLYPHS[to] ?? to}  phase transit`;
  }

  // Data tail — most relevant 1-2 instruments for the trigger
  const tailParts = [];
  if (trigger === 'threshold_promise_collapse') {
    tailParts.push(`PROMISE_HALF_LIFE: ${instruments.find(i => i.label === 'PROMISE HALF-LIFE').value.toFixed(1)} d`);
  } else if (trigger === 'threshold_worship_high') {
    tailParts.push(`WORSHIP_TEMPERATURE: ${instruments.find(i => i.label === 'WORSHIP TEMPERATURE').value.toFixed(0)} K`);
  } else if (trigger === 'threshold_grief_high') {
    tailParts.push(`GRIEF_INDEX: ${instruments.find(i => i.label === 'GRIEF INDEX').value.toFixed(2)}`);
  } else {
    tailParts.push(`viscosity ${instruments.find(i => i.label === 'ATTENTION VISCOSITY').value.toFixed(2)} Pa·s`);
    tailParts.push(`forgetting flux ${instruments.find(i => i.label === 'FORGETTING FLUX').value.toFixed(1)} bit/m²s`);
  }

  return {
    timestamp,
    trigger,
    triggerLabel,
    line,
    tail: tailParts.join(' · '),
    activePhase,
  };
}

const THRESHOLDS = [
  { label: 'PROMISE HALF-LIFE',   crossBelow: 2.0, category: 'threshold_promise_collapse' },
  { label: 'WORSHIP TEMPERATURE', crossAbove: 690, category: 'threshold_worship_high'     },
  { label: 'GRIEF INDEX',         crossAbove: 0.7, category: 'threshold_grief_high'       },
];

export function detectThresholds(prev, curr) {
  const fired = [];
  for (const t of THRESHOLDS) {
    const p = prev.find(i => i.label === t.label)?.value;
    const c = curr.find(i => i.label === t.label)?.value;
    if (p == null || c == null) continue;
    if (t.crossBelow != null && p >= t.crossBelow && c < t.crossBelow) fired.push(t.category);
    if (t.crossAbove != null && p <= t.crossAbove && c > t.crossAbove) fired.push(t.category);
  }
  // Sign inversion for MIGRATION DRIFT
  const pDrift = prev.find(i => i.label === 'MIGRATION DRIFT')?.value;
  const cDrift = curr.find(i => i.label === 'MIGRATION DRIFT')?.value;
  if (pDrift != null && cDrift != null && Math.sign(pDrift) !== Math.sign(cDrift) && Math.abs(cDrift) > 0.1) {
    fired.push('threshold_migration_invert');
  }
  return fired;
}

function fmtTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function buildMarkdownLog({ entries, mercury, instruments, activePhase, sessionStart }) {
  const now = new Date();
  const ts = now.toLocaleDateString('en-CA') + ' ' + fmtTime(now);
  const glyph = PHASE_GLYPHS[activePhase] ?? '◉';

  const instrumentRows = instruments.map(i =>
    `| ${i.label.padEnd(20)} | ${i.value.toFixed(2)} ${i.unit} |`,
  );

  const entryBlocks = entries.map(e =>
    `### ${fmtTime(e.timestamp)} · ${e.triggerLabel}\n${e.line}\n*${e.tail}*\n`,
  );

  return [
    `# MERCURY OBSERVATION LOG · ${ts}`,
    `> the fifth element · ${entries.length} entries · session ${fmtTime(sessionStart)} → ${fmtTime(now)}`,
    `> Mercury ${mercury.heliocentricDistanceAU.toFixed(3)} AU · subsolar ${mercury.subsolarTempK.toFixed(0)} K · ${glyph} ${activePhase} phase`,
    '',
    '## CURRENT INSTRUMENTS',
    '| reading              | value           |',
    '| :---                 | ---:            |',
    ...instrumentRows,
    '',
    '## ENTRIES',
    ...entryBlocks,
    '---',
    `*scale94 · mercury terminal · the fifth element's observation log*`,
  ].join('\n');
}

// Resolve {placeholders} from a payload + supplementary fields
export function renderPhrase(template, ctx = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '—' : String(v);
  });
}

// Map a bus event { category, kind, payload } to a PHRASES category key.
// Returns null when the event should not produce a log entry.
export function categoryForEvent(evt) {
  switch (evt.category) {
    case 'transmissions': return 'transmission_completed';
    case 'essences':
      if (evt.kind === 'polarity_shifted') return 'polarity_shifted';
      return 'essence_distilled';
    case 'ciphers':       return 'cipher_sealed';
    case 'gaze':          return 'gaze_redirected';
    case 'edge':          return 'threshold_event';
    default: return null;
  }
}

// Build the substitution context the phrase templates need from an event.
export function ctxForEvent(evt, totals) {
  const p = evt.payload ?? {};
  return {
    n:        totals?.transmissions?.count,
    ms:       p.durationMs,
    d:        p.depth ?? totals?.transmissions?.ledgerDepth,
    k:        p.kernelId,
    polarity: p.polarity ?? totals?.essences?.polarity,
    prev:     p.prev,
    count:    totals?.essences?.count,
    h:        (p.hashPrefix ?? '').toString().slice(0, 10),
    tab:      p.tab,
    c:        p.chapter,
    phase:    p.phase,
  };
}
