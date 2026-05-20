// observationLog.js — Pure functions for the alien's observation log
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
    'the alien architect annotates the silence with a single mark.',
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

let _lastPickIdx = -1;
function pickPhrase(category) {
  const pool = PHRASES[category] ?? PHRASES.minute_tick_quiet;
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); } while (pool.length > 1 && idx === _lastPickIdx);
  _lastPickIdx = idx;
  return pool[idx];
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
  const rawLine  = pickPhrase(category);
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
    `> alien architect · ${entries.length} entries · session ${fmtTime(sessionStart)} → ${fmtTime(now)}`,
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
    `*scale94 · mercury terminal · alien architect observation log*`,
  ].join('\n');
}
