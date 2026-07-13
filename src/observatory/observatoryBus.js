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
    transmissions: { count: 0, ledgerDepth: 0, verdict: null, lastSignal: null, last: null, lastTs: 0 },
    essences:      { count: 0, crystallized: 0, polarity: null, lastAccord: null, last: null, lastTs: 0 },
    ciphers:       { sealed: 0, verifies: 0, unlocks: 0, last: null, lastTs: 0 },
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, tabsVisited: {}, art: null, lastEcocide: null, lastManifestoFragment: null, last: null, lastTs: 0 },
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

// gaze.art initializes lazily on the first art event, whatever kind arrives first.
function ensureArt(t) {
  if (!t.art) t.art = { resonances: 0, lastSim: null, bifurcations: 0, chimeras: 0,
                        lastR: null, lyapunov: null, regime: null,
                        selectedNode: null, resonancePair: null };
  return t.art;
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
      if (evt.kind === 'verdict_issued') t.verdict = evt.payload.verdict ?? t.verdict;
      if (evt.kind === 'signal_marked') t.lastSignal = evt.payload;
      break;
    case 'essences':
      if (evt.kind === 'collision_fired') {
        t.count++;
        if (evt.payload.polarity) t.polarity = evt.payload.polarity;
      }
      if (evt.kind === 'crystallized') {
        t.crystallized++;
        if (evt.payload.cardName) {
          t.lastAccord = { cardName: evt.payload.cardName, nodeIdA: evt.payload.nodeIdA ?? null,
                            nodeIdB: evt.payload.nodeIdB ?? null, vClass: evt.payload.vClass ?? null,
                            viability: evt.payload.viability ?? null, archetype: evt.payload.archetype ?? null };
        }
      }
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
      if (evt.kind === 'manifesto_fragment_marked') t.lastManifestoFragment = evt.payload;
      if (evt.kind === 'tab_navigated' && evt.payload.tab)
        t.tabsVisited[evt.payload.tab] = (t.tabsVisited[evt.payload.tab] || 0) + 1;
      if (evt.kind === 'art_resonance') {
        const a = ensureArt(t);
        a.resonances++;
        if (typeof evt.payload.sim === 'number') a.lastSim = evt.payload.sim;
        if (evt.payload.nodeA && evt.payload.nodeB)
          a.resonancePair = { nodeA: evt.payload.nodeA, nodeB: evt.payload.nodeB, topDim: evt.payload.topDim ?? null };
      }
      if (evt.kind === 'art_node_selected') {
        ensureArt(t).selectedNode = { id: evt.payload.nodeId, cluster: evt.payload.cluster ?? null, topDim: evt.payload.topDim ?? null };
      }
      if (evt.kind === 'art_bifurcation') ensureArt(t).bifurcations += evt.payload.count ?? 1;
      if (evt.kind === 'art_chimera')     ensureArt(t).chimeras++;
      if (evt.kind === 'art_regime') {
        const a = ensureArt(t);
        if (typeof evt.payload.r === 'number')        a.lastR    = evt.payload.r;
        if (typeof evt.payload.lyapunov === 'number') a.lyapunov = evt.payload.lyapunov;
        if (evt.payload.regime)                       a.regime   = evt.payload.regime;
      }
      if (evt.kind === 'ecocide_phase')   t.lastEcocide = evt.payload; // includes growthRate/mandateActive (spec: chaos/ecocide compile wiring)
      break;
    case 'edge':
      if (evt.kind === 'gate_answered')    t.gate             = evt.payload.result;
      if (evt.kind === 'eye_phase')        t.eye              = evt.payload.phase;
      if (evt.kind === 'manifesto_opened') t.manifestoChapter = evt.payload.chapter;
      break;
  }
}
