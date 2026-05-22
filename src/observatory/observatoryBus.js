// ── observatoryBus ───────────────────────────────────────────────────────────
// Tiny event bus the Mercury Terminal listens to. Every site feature that wants
// the alien to see it imports { emit } and calls it at the moment of the event.
// No React, no deps. Listeners are a Set; totals are a flat reducer; journal is
// a ring buffer capped at 256.
//
// Categories: transmissions · essences · ciphers · gaze · edge
// (the alien's poetic taxonomy — see registryCategories.js)

const listeners = new Set();
let journal = [];
const JOURNAL_MAX = 256;

function makeTotals() {
  return {
    transmissions: { count: 0, ledgerDepth: 0, last: null, lastTs: 0 },
    essences:      { count: 0, crystallized: 0, polarity: null, last: null, lastTs: 0 },
    ciphers:       { sealed: 0, verifies: 0, unlocks: 0, last: null, lastTs: 0 },
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, last: null, lastTs: 0 },
    edge:          { gate: 'UNANSWERED', eye: 'idle', manifestoChapter: null, last: null, lastTs: 0 },
  };
}
let totals = makeTotals();

export function emit(category, kind, payload = {}) {
  const ts  = Date.now();
  const evt = { ts, category, kind, payload };
  journal.push(evt);
  if (journal.length > JOURNAL_MAX) journal = journal.slice(journal.length - JOURNAL_MAX);
  updateTotals(evt);
  listeners.forEach(fn => {
    try { fn(evt); } catch (_) { /* a noisy subscriber must not break the bus */ }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJournal() { return journal.slice(); }
export function getTotals()  { return totals; }

// Test-only — never call from production code.
export function _resetForTests() {
  listeners.clear();
  journal = [];
  totals = makeTotals();
}

function updateTotals(evt) {
  const t = totals[evt.category];
  if (!t) return;
  t.last   = evt;
  t.lastTs = evt.ts;
  switch (evt.category) {
    case 'transmissions':
      if (evt.kind === 'kernel_completed') t.count++;
      if (evt.kind === 'ledger_appended')
        t.ledgerDepth = evt.payload.depth ?? t.ledgerDepth + 1;
      break;
    case 'essences':
      if (evt.kind === 'collision_fired') {
        t.count++;
        if (evt.payload.polarity) t.polarity = evt.payload.polarity;
      }
      if (evt.kind === 'crystallized')     t.crystallized++;
      if (evt.kind === 'polarity_shifted') t.polarity = evt.payload.polarity ?? t.polarity;
      break;
    case 'ciphers':
      if (evt.kind === 'cipher_sealed') t.sealed++;
      if (evt.kind === 'verify')        t.verifies++;
      if (evt.kind === 'unlock')        t.unlocks++;
      break;
    case 'gaze':
      if (evt.kind === 'sphere_clicked') t.sphereClicks++;
      if (evt.kind === 'lunar_read')     t.lastLunar     = evt.payload;
      if (evt.kind === 'scaling_visit')  t.lastScaling   = evt.payload;
      break;
    case 'edge':
      if (evt.kind === 'gate_answered')    t.gate             = evt.payload.result;
      if (evt.kind === 'eye_phase')        t.eye              = evt.payload.phase;
      if (evt.kind === 'manifesto_opened') t.manifestoChapter = evt.payload.chapter;
      break;
  }
}
