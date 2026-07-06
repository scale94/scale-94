// SKS §2 Ledger Archive — append-only, versioned, immutable, self-contained
// records for every interactive Council event and computed synthesis.
// SKS §3 Zero State Leaks — deriveUiState() is the single source of truth the
// tab rehydrates from; component state is a cache of this ledger, never the
// other way around. localStorage failures degrade silently to in-memory.

export const LEDGER_KEY = 'scale94.council.ledger.v1';
export const LEDGER_CAP = 256;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(log) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(log));
  } catch {
    // quota / privacy mode — in-memory log remains authoritative for the session
  }
}

const deepCopy = (x) => JSON.parse(JSON.stringify(x));

export const councilLedger = {
  _log: loadFromStorage(),
  _listeners: [],

  append(record) {
    this._log.push(deepCopy(record)); // immutable: store owns its copy
    if (this._log.length > LEDGER_CAP) this._log.splice(0, this._log.length - LEDGER_CAP);
    saveToStorage(this._log);
    this._listeners.forEach(fn => fn(deepCopy(record)));
  },

  list(filter) {
    let out = this._log;
    if (filter?.kind) out = out.filter(r => r.kind === filter.kind);
    return out.map(deepCopy);
  },

  latest(kind) {
    for (let i = this._log.length - 1; i >= 0; i--) {
      if (!kind || this._log[i].kind === kind) return deepCopy(this._log[i]);
    }
    return null;
  },

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },

  // SKS §3 — derive the tab's persistent UI state from the ledger head.
  // Walk backward: the first decisive entry wins.
  //   SYNTHESIS            → SYNTHESIZED (restore pair + panel)
  //   EVENT ARM            → ARMED (restore armed mind)
  //   EVENT RESET/DISARM   → AMBIENT
  deriveUiState() {
    for (let i = this._log.length - 1; i >= 0; i--) {
      const r = this._log[i];
      if (r.kind === 'SYNTHESIS') return { mode: 'SYNTHESIZED', armed: null, record: deepCopy(r) };
      if (r.kind === 'EVENT') {
        if (r.event === 'ARM') return { mode: 'ARMED', armed: deepCopy(r.subject), record: null };
        if (r.event === 'RESET' || r.event === 'DISARM') return { mode: 'AMBIENT', armed: null, record: null };
        // FIRE events are transitional — keep walking back
      }
    }
    return { mode: 'AMBIENT', armed: null, record: null };
  },

  _resetForTests(opts = {}) {
    this._listeners = [];
    this._log = opts.keepStorage ? loadFromStorage() : [];
    if (!opts.keepStorage) saveToStorage(this._log);
  },
};
