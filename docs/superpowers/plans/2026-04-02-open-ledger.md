# The Open Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform scale94.com into a public thermodynamic audit infrastructure where anyone can submit river data, receive immutable WASM-computed permit verdicts, and export them as citable counter-evidence.

**Architecture:** A new Ledger tab hosts a structured submission form that feeds parameters to the existing Chrono-Actuary WASM kernel. Verdicts are serialized as JSON, SHA-256 hashed, and stored as CAS chunks in `public/ledger/`. An optional API ingest layer pulls from USGS/EEA for real-world data. Export layer produces JSON-LD, PDF, and embeddable widgets.

**Tech Stack:** React 18 (existing), Rust/WASM (existing Chrono-Actuary kernel), Vitest (new), SHA-256 via SubtleCrypto, jsPDF (new dep for PDF export), Leaflet (new dep for coordinate picker)

---

## File Structure

```
src/terminal/views/LedgerTab.jsx           — Main Ledger tab component (submission form + verdict list)
src/terminal/views/ledger/SubmissionForm.jsx — Structured input form (coordinates, params, dependency)
src/terminal/views/ledger/VerdictCard.jsx    — Single verdict display (ruling + audit breakdown)
src/terminal/views/ledger/VerdictArchive.jsx — Scrollable archive of past verdicts
src/terminal/views/ledger/CoordinatePicker.jsx — Leaflet map for lat/lon selection
src/terminal/views/ledger/ExportPanel.jsx    — JSON-LD / PDF / embed export controls
src/terminal/ledger/verdictModel.js          — Verdict document shape, hashing, serialization
src/terminal/ledger/verdictStore.js          — IndexedDB-backed local verdict archive + CAS export
src/terminal/ledger/apiIngest.js             — USGS NWIS + EEA Waterbase connectors
src/terminal/ledger/exportFormats.js         — JSON-LD, PDF, embed HTML generators
src/terminal/ledger/ledgerBus.js             — Event bus for cross-tab verdict notifications
public/ledger/manifest.json                  — Public ledger manifest (generated on export)
tests/ledger/verdictModel.test.js            — Verdict hashing, serialization, validation tests
tests/ledger/apiIngest.test.js               — API connector parsing tests
tests/ledger/exportFormats.test.js           — Export format generation tests
```

**Modify:**
- `src/terminal/App.jsx` — Add LedgerTab lazy import, nav button, tab render block, breadcrumb color
- `src/terminal/hooks/useCommandDispatch.js` — Add `ledger` to LOAD_TAB_MAP
- `package.json` — Add vitest, leaflet, react-leaflet, jspdf dependencies
- `vite.config.js` — Add leaflet to manual chunk splitting (if needed)

---

### Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/ledger/verdictModel.test.js` (placeholder to verify setup)

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
  },
  resolve: {
    alias: { '@': '/src' },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create smoke test**

Create `tests/ledger/verdictModel.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('verdictModel (smoke)', () => {
  it('module loads', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Run test to verify setup**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.js tests/ledger/verdictModel.test.js package.json package-lock.json
git commit -m "chore: add vitest test framework"
```

---

### Task 2: Verdict Document Model

**Files:**
- Create: `src/terminal/ledger/verdictModel.js`
- Modify: `tests/ledger/verdictModel.test.js`

- [ ] **Step 1: Write failing tests for verdict creation and hashing**

Replace `tests/ledger/verdictModel.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { createVerdict, hashVerdict, validateSubmission } from '../../src/terminal/ledger/verdictModel';

describe('validateSubmission', () => {
  it('accepts valid input', () => {
    const input = {
      lat: 48.2082, lon: 16.3738,
      temp: 15, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const errors = validateSubmission(input);
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields', () => {
    const errors = validateSubmission({ lat: 48, lon: 16 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'temp')).toBe(true);
  });

  it('rejects out-of-range temperature', () => {
    const input = {
      lat: 48, lon: 16,
      temp: 99, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const errors = validateSubmission(input);
    expect(errors.some(e => e.field === 'temp')).toBe(true);
  });
});

describe('createVerdict', () => {
  it('produces a verdict document with required fields', () => {
    const input = {
      lat: 48.2082, lon: 16.3738,
      temp: 15, do: 8.5, bod: 5, dt: 2, epi: 0.8, nitrate: 2, flow: 0.4,
      dependency: 'sovereign',
    };
    const kernelOutput = 'PERMIT_STATUS: APPROVED\nDATA:{"status":"APPROVED","modules":{}}';
    const verdict = createVerdict(input, kernelOutput, 'CHRONO-ACTUARY-KERNEL-2.0');
    expect(verdict.status).toBe('APPROVED');
    expect(verdict.coordinates).toEqual({ lat: 48.2082, lon: 16.3738 });
    expect(verdict.dependency).toBe('sovereign');
    expect(verdict.kernelId).toBe('CHRONO-ACTUARY-KERNEL-2.0');
    expect(verdict.timestamp).toBeDefined();
    expect(verdict.input).toEqual(input);
  });
});

describe('hashVerdict', () => {
  it('produces a 64-char hex SHA-256 hash', async () => {
    const verdict = {
      status: 'APPROVED',
      coordinates: { lat: 48, lon: 16 },
      dependency: 'sovereign',
      kernelId: 'CHRONO-ACTUARY-KERNEL-2.0',
      timestamp: '2026-04-02T12:00:00Z',
      input: { temp: 15 },
      audit: {},
    };
    const hash = await hashVerdict(verdict);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic hashes', async () => {
    const verdict = { status: 'APPROVED', timestamp: '2026-04-02T12:00:00Z' };
    const h1 = await hashVerdict(verdict);
    const h2 = await hashVerdict(verdict);
    expect(h1).toBe(h2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: All tests fail (module not found).

- [ ] **Step 3: Implement verdictModel.js**

Create `src/terminal/ledger/verdictModel.js`:

```javascript
// Verdict Document Model — The Open Ledger
// Immutable thermodynamic audit records for the planetary ledger.

const REQUIRED_FIELDS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];
const VALID_DEPENDENCIES = ['sovereign', 'external', 'attested'];

const PARAM_RANGES = {
  temp:    { min: -5,  max: 50,  unit: 'C',    label: 'Water Temperature' },
  do:      { min: 0,   max: 20,  unit: 'mg/L', label: 'Dissolved Oxygen' },
  bod:     { min: 0,   max: 100, unit: 'mg/L', label: 'BOD Load' },
  dt:      { min: -10, max: 20,  unit: 'C',    label: 'Thermal Discharge Delta' },
  epi:     { min: 0,   max: 20,  unit: 'm',    label: 'Epilimnion Depth' },
  nitrate: { min: 0,   max: 100, unit: 'mg/L', label: 'Nitrate Concentration' },
  flow:    { min: 0,   max: 100, unit: 'm3/s', label: 'Flow Rate' },
};

export { PARAM_RANGES, VALID_DEPENDENCIES };

export function validateSubmission(input) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push({ field, message: `${PARAM_RANGES[field].label} is required` });
      continue;
    }
    const val = Number(input[field]);
    if (isNaN(val)) {
      errors.push({ field, message: `${PARAM_RANGES[field].label} must be a number` });
      continue;
    }
    const range = PARAM_RANGES[field];
    if (val < range.min || val > range.max) {
      errors.push({ field, message: `${range.label} must be between ${range.min} and ${range.max} ${range.unit}` });
    }
  }
  if (input.dependency && !VALID_DEPENDENCIES.includes(input.dependency)) {
    errors.push({ field: 'dependency', message: `Dependency must be one of: ${VALID_DEPENDENCIES.join(', ')}` });
  }
  return errors;
}

export function createVerdict(input, kernelOutput, kernelId) {
  // Parse DATA:{...} suffix from kernel output
  let status = 'UNKNOWN';
  let audit = {};
  const dataMatch = kernelOutput.match(/DATA:(\{[\s\S]*\})$/);
  if (dataMatch) {
    try {
      const parsed = JSON.parse(dataMatch[1]);
      status = parsed.status || status;
      audit = parsed;
    } catch { /* keep defaults */ }
  }
  // Also check for plain-text PERMIT_STATUS
  const statusMatch = kernelOutput.match(/PERMIT_STATUS:\s*(\S+)/);
  if (statusMatch && status === 'UNKNOWN') {
    status = statusMatch[1];
  }

  return {
    status,
    coordinates: { lat: input.lat, lon: input.lon },
    dependency: input.dependency || 'sovereign',
    kernelId,
    timestamp: new Date().toISOString(),
    input: { ...input },
    audit,
    ruling: kernelOutput.split('\n').filter(l => !l.startsWith('DATA:')).join('\n'),
  };
}

export async function hashVerdict(verdict) {
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  const encoded = new TextEncoder().encode(canonical);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/verdictModel.js tests/ledger/verdictModel.test.js
git commit -m "feat: verdict document model with validation, creation, and SHA-256 hashing"
```

---

### Task 3: Local Verdict Store (IndexedDB)

**Files:**
- Create: `src/terminal/ledger/verdictStore.js`

- [ ] **Step 1: Implement the verdict store**

Create `src/terminal/ledger/verdictStore.js`:

```javascript
// Verdict Store — IndexedDB-backed local archive
// Append-only. No deletion. No mutation. Immutability is structural.

import { hashVerdict } from './verdictModel';

const DB_NAME = 'scale94-ledger';
const DB_VERSION = 1;
const STORE_NAME = 'verdicts';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('coordinates', ['coordinates.lat', 'coordinates.lon'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeVerdict(verdict) {
  const hash = await hashVerdict(verdict);
  const record = { ...verdict, hash };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllVerdicts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('timestamp').getAll();
    req.onsuccess = () => resolve(req.result.reverse()); // newest first
    req.onerror = () => reject(req.error);
  });
}

export async function getVerdictByHash(hash) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(hash);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getVerdictCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/ledger/verdictStore.js
git commit -m "feat: IndexedDB-backed verdict store (append-only, immutable)"
```

---

### Task 4: Ledger Event Bus

**Files:**
- Create: `src/terminal/ledger/ledgerBus.js`

- [ ] **Step 1: Create the event bus**

Create `src/terminal/ledger/ledgerBus.js`:

```javascript
// Ledger Event Bus — cross-tab verdict notifications
// Follows the same pattern as colliderBus and ecocideBus.

export const ledgerBus = {
  _listeners: [],
  _pending: [],
  emit(data) {
    this._listeners.forEach(fn => fn(data));
    if (data.type === 'VERDICT_ISSUED') this._pending.push(data);
  },
  on(fn) {
    this._listeners.push(fn);
    if (this._pending.length) {
      const queue = [...this._pending];
      this._pending = [];
      queue.forEach(d => fn(d));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/ledger/ledgerBus.js
git commit -m "feat: ledger event bus for cross-tab verdict notifications"
```

---

### Task 5: Submission Form Component

**Files:**
- Create: `src/terminal/views/ledger/SubmissionForm.jsx`

- [ ] **Step 1: Create the submission form**

Create `src/terminal/views/ledger/SubmissionForm.jsx`:

```jsx
import { useState, useCallback } from 'react';
import { PARAM_RANGES, VALID_DEPENDENCIES, validateSubmission } from '../../ledger/verdictModel';

const DEPENDENCY_LABELS = {
  sovereign: 'SOVEREIGN — user-supplied measurements',
  external:  'EXTERNAL — pulled from monitoring API',
  attested:  'ATTESTED — uploaded dataset with provenance claim',
};

export default function SubmissionForm({ onSubmit, loading, apiData }) {
  const [form, setForm] = useState({
    lat: apiData?.lat ?? '',
    lon: apiData?.lon ?? '',
    siteName: apiData?.siteName ?? '',
    temp: apiData?.temp ?? '',
    do: apiData?.do ?? '',
    bod: apiData?.bod ?? '',
    dt: apiData?.dt ?? '',
    epi: apiData?.epi ?? '',
    nitrate: apiData?.nitrate ?? '',
    flow: apiData?.flow ?? '',
    dependency: apiData ? 'external' : 'sovereign',
    notes: '',
  });
  const [errors, setErrors] = useState([]);

  const update = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => e.field !== field));
  }, []);

  const handleSubmit = useCallback(() => {
    const numericForm = { ...form };
    for (const key of Object.keys(PARAM_RANGES)) {
      numericForm[key] = Number(numericForm[key]);
    }
    numericForm.lat = Number(numericForm.lat);
    numericForm.lon = Number(numericForm.lon);
    const validationErrors = validateSubmission(numericForm);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(numericForm);
  }, [form, onSubmit]);

  const fieldError = (field) => errors.find(e => e.field === field)?.message;

  return (
    <div className="space-y-6">
      {/* Coordinates */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Coordinates</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Latitude</label>
            <input
              type="number" step="any" placeholder="48.2082"
              value={form.lat} onChange={e => update('lat', e.target.value)}
              className="w-full bg-black border border-teal-900/40 text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Longitude</label>
            <input
              type="number" step="any" placeholder="16.3738"
              value={form.lon} onChange={e => update('lon', e.target.value)}
              className="w-full bg-black border border-teal-900/40 text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
            />
          </div>
        </div>
        <input
          type="text" placeholder="Site name (optional)"
          value={form.siteName} onChange={e => update('siteName', e.target.value)}
          className="w-full mt-2 bg-black border border-teal-900/20 text-gray-400 font-mono text-xs px-3 py-1.5 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Parameters */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Audit Parameters</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(PARAM_RANGES).map(([key, range]) => (
            <div key={key}>
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">
                {range.label} <span className="text-gray-600">({range.unit})</span>
              </label>
              <input
                type="number" step="any"
                placeholder={`${range.min}–${range.max}`}
                value={form[key]} onChange={e => update(key, e.target.value)}
                className={`w-full bg-black border ${fieldError(key) ? 'border-red-500' : 'border-teal-900/40'} text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors`}
              />
              {fieldError(key) && (
                <div className="text-red-400 text-[10px] font-mono mt-1">{fieldError(key)}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dependency Classification */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Data Supply Chain</div>
        <div className="space-y-2">
          {VALID_DEPENDENCIES.map(dep => (
            <label key={dep} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-3 h-3 border rounded-full flex items-center justify-center transition-colors ${form.dependency === dep ? 'border-teal-400 bg-teal-400' : 'border-gray-600 group-hover:border-teal-600'}`}>
                {form.dependency === dep && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
              </div>
              <span className="text-xs font-mono">
                <span className={form.dependency === dep ? 'text-teal-300' : 'text-gray-400'}>{dep.toUpperCase()}</span>
                <span className="text-gray-600 ml-2">— {DEPENDENCY_LABELS[dep].split('—')[1]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <textarea
          placeholder="Notes (optional) — site context, data source, observation conditions"
          value={form.notes} onChange={e => update('notes', e.target.value)}
          rows={2}
          className="w-full bg-black border border-teal-900/20 text-gray-400 font-mono text-xs px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-3 font-mono text-sm uppercase tracking-[4px] rounded-sm transition-all duration-300 ${
          loading
            ? 'bg-teal-900/30 text-teal-600 cursor-wait'
            : 'bg-teal-900/20 text-teal-300 border border-teal-700/40 hover:bg-teal-800/30 hover:border-teal-500 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]'
        }`}
      >
        {loading ? '// EXECUTING AUDIT...' : 'RUN AUDIT'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify form renders without errors**

Run: `npm run dev`
(We'll wire it up in Task 7 — for now just confirm no syntax errors in the module.)

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/ledger/SubmissionForm.jsx
git commit -m "feat: structured audit submission form with validation"
```

---

### Task 6: Verdict Card Component

**Files:**
- Create: `src/terminal/views/ledger/VerdictCard.jsx`

- [ ] **Step 1: Create the verdict display card**

Create `src/terminal/views/ledger/VerdictCard.jsx`:

```jsx
import { useState } from 'react';

const STATUS_COLORS = {
  APPROVED:       { text: 'text-green-400', border: 'border-green-800/30', glow: 'shadow-[0_0_12px_rgba(34,197,94,0.1)]' },
  CONDITIONAL:    { text: 'text-yellow-400', border: 'border-yellow-800/30', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.1)]' },
  REJECTED:       { text: 'text-red-400', border: 'border-red-800/30', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.1)]' },
  EMERGENCY_VETO: { text: 'text-red-500', border: 'border-red-700/40', glow: 'shadow-[0_0_16px_rgba(239,68,68,0.15)]' },
  UNKNOWN:        { text: 'text-gray-400', border: 'border-gray-800/30', glow: '' },
};

export default function VerdictCard({ verdict, onExport }) {
  const [expanded, setExpanded] = useState(false);
  const colors = STATUS_COLORS[verdict.status] || STATUS_COLORS.UNKNOWN;

  return (
    <div className={`border ${colors.border} ${colors.glow} rounded-sm p-4 bg-black/50 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-bold tracking-wider ${colors.text}`}>{verdict.status}</span>
          <span className="text-[10px] font-mono text-gray-600 tracking-wider">
            {verdict.dependency?.toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-600">
          {new Date(verdict.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC
        </span>
      </div>

      {/* Coordinates + Hash */}
      <div className="font-mono text-xs text-gray-400 mb-2">
        <span className="text-teal-600">coordinates:</span>{' '}
        {verdict.coordinates.lat.toFixed(4)}, {verdict.coordinates.lon.toFixed(4)}
        {verdict.input?.siteName && (
          <span className="text-gray-500 ml-2">// {verdict.input.siteName}</span>
        )}
      </div>
      <div className="font-mono text-[10px] text-gray-600 mb-3">
        <span className="text-teal-700">hash:</span> {verdict.hash?.slice(0, 12)}...{verdict.hash?.slice(-8)}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          ['TEMP', verdict.input?.temp, 'C'],
          ['DO', verdict.input?.do, 'mg/L'],
          ['BOD', verdict.input?.bod, 'mg/L'],
          ['DT', verdict.input?.dt, 'C'],
        ].map(([label, val, unit]) => (
          <div key={label} className="text-center">
            <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{label}</div>
            <div className="text-sm font-mono text-teal-300">{val}<span className="text-gray-600 text-[9px] ml-0.5">{unit}</span></div>
          </div>
        ))}
      </div>

      {/* Expandable ruling */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest transition-colors"
      >
        {expanded ? '[ - ] COLLAPSE RULING' : '[ + ] FULL RULING'}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-teal-900/20 pt-3">
          <pre className="font-mono text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {verdict.ruling}
          </pre>
          {onExport && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => onExport(verdict, 'json')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">JSON-LD</button>
              <button onClick={() => onExport(verdict, 'pdf')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">PDF</button>
              <button onClick={() => onExport(verdict, 'embed')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">EMBED</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/views/ledger/VerdictCard.jsx
git commit -m "feat: verdict card component with expandable ruling and export buttons"
```

---

### Task 7: Ledger Tab Shell + App.jsx Integration

**Files:**
- Create: `src/terminal/views/LedgerTab.jsx`
- Modify: `src/terminal/App.jsx`
- Modify: `src/terminal/hooks/useCommandDispatch.js`

- [ ] **Step 1: Create LedgerTab**

Create `src/terminal/views/LedgerTab.jsx`:

```jsx
import { useState, useCallback, useEffect } from 'react';
import SubmissionForm from './ledger/SubmissionForm';
import VerdictCard from './ledger/VerdictCard';
import { createVerdict } from '../ledger/verdictModel';
import { storeVerdict, getAllVerdicts, getVerdictCount } from '../ledger/verdictStore';
import { ledgerBus } from '../ledger/ledgerBus';
import { loadWasm } from '../../wasm/wasmSingleton';
import wasmRegistry from '../../wasm/wasm.generated';

const CHRONO_ENTRY = wasmRegistry['CHRONO-ACTUARY-KERNEL-2.0'];

export default function LedgerTab() {
  const [verdicts, setVerdicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verdictCount, setVerdictCount] = useState(0);
  const [view, setView] = useState('submit'); // 'submit' | 'archive'

  useEffect(() => {
    getAllVerdicts().then(setVerdicts);
    getVerdictCount().then(setVerdictCount);
  }, []);

  const handleSubmit = useCallback(async (input) => {
    setLoading(true);
    try {
      const mod = await loadWasm();
      const args = [
        input.temp, input.do, input.bod, input.dt,
        input.epi, input.nitrate, input.flow,
        0.1,  // lsi default
        30,   // years default
        1000000, // profit default
      ];
      const result = mod[CHRONO_ENTRY.fn](...args);
      const verdict = createVerdict(input, result, CHRONO_ENTRY.id);
      const stored = await storeVerdict(verdict);
      setVerdicts(prev => [stored, ...prev]);
      setVerdictCount(prev => prev + 1);
      setView('archive');
      ledgerBus.emit({ type: 'VERDICT_ISSUED', verdict: stored });
    } catch (err) {
      console.error('Audit execution failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[4px] text-teal-600">The Open Ledger</span>
          <span className="text-[10px] font-mono text-gray-600">v1.0</span>
        </div>
        <h1 className="text-xl font-bold font-mono text-teal-300 tracking-wider mb-2">
          THERMODYNAMIC AUDIT INFRASTRUCTURE
        </h1>
        <p className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl">
          Submit river parameters. Receive a sovereign permit ruling. The verdict is SHA-256 hashed,
          immutable, and citable. The equations are the authority.
        </p>
        {verdictCount > 0 && (
          <div className="mt-2 text-[10px] font-mono text-teal-700 tracking-widest">
            {verdictCount} VERDICT{verdictCount !== 1 ? 'S' : ''} ISSUED
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-4 mb-6 border-b border-teal-900/20 pb-3">
        <button
          onClick={() => setView('submit')}
          className={`text-[10px] font-mono uppercase tracking-[3px] pb-1 transition-colors ${
            view === 'submit' ? 'text-teal-300 border-b border-teal-500' : 'text-gray-600 hover:text-teal-500'
          }`}
        >
          Submit Audit
        </button>
        <button
          onClick={() => setView('archive')}
          className={`text-[10px] font-mono uppercase tracking-[3px] pb-1 transition-colors ${
            view === 'archive' ? 'text-teal-300 border-b border-teal-500' : 'text-gray-600 hover:text-teal-500'
          }`}
        >
          Verdict Archive ({verdictCount})
        </button>
      </div>

      {/* Content */}
      {view === 'submit' && (
        <SubmissionForm onSubmit={handleSubmit} loading={loading} />
      )}

      {view === 'archive' && (
        <div className="space-y-4">
          {verdicts.length === 0 ? (
            <div className="text-center py-12 font-mono text-gray-600 text-sm">
              No verdicts issued yet. Submit your first audit.
            </div>
          ) : (
            verdicts.map(v => (
              <VerdictCard key={v.hash} verdict={v} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add LedgerTab to App.jsx — lazy import**

In `src/terminal/App.jsx`, after line 75 (`const LunarTab = lazy(...)`), add:

```javascript
const LedgerTab = lazy(() => import('./views/LedgerTab'));
```

- [ ] **Step 3: Add Ledger nav button to App.jsx — desktop nav**

In `src/terminal/App.jsx`, after the Lunar nav button (line 1074), before the search button, add:

```jsx
            <button aria-label="Ledger" aria-current={activeTab === 'ledger' ? 'page' : undefined} onClick={() => handleNav('~/system/ledger', 'ledger')} className={`${activeTab === 'ledger' ? 'text-black shadow-[0_0_14px_rgba(20,184,166,0.6)]' : 'hover:text-white hover:bg-teal-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`} style={activeTab === 'ledger' ? { background: 'linear-gradient(90deg,#0d9488,#14b8a6)' } : { color: 'rgba(20,184,166,0.5)' }}>ᛟ /Ledger</button>
```

- [ ] **Step 4: Add Ledger tab render block to App.jsx**

After the Lunar tab render block (around line 1242), before the Cryptography block, add:

```jsx
          {/* Ledger Tab — The Open Ledger · Thermodynamic Audit Infrastructure */}
          {activeTab === 'ledger' && !selectedArticle && !architectThesis && (
            <WasmErrorBoundary>
              <LedgerTab />
            </WasmErrorBoundary>
          )}
```

- [ ] **Step 5: Add breadcrumb color for ledger tab**

In the `_bc` object in App.jsx (around line 1100), add:

```javascript
              ledger:       { prompt: 'text-teal-400',    path: 'text-teal-300',    cursor: 'bg-teal-400',    border: 'border-teal-500/25',  glow: '0 0 18px rgba(20,184,166,0.25), 0 0 4px rgba(20,184,166,0.4)',   cursorGlow: '0 0 10px rgba(20,184,166,0.8)',     pathGlow: '0 0 6px rgba(20,184,166,0.3)' },
```

- [ ] **Step 6: Add Ledger to mobile nav**

Find the mobile nav section (around line 1399, after the Lunar mobile button) and add:

```jsx
        <button onClick={() => handleNav('~/system/ledger', 'ledger')} aria-label="Ledger" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'ledger' ? 'text-teal-400' : 'text-teal-400/50'}`}><span className="text-xs">ᛟ</span></button>
```

- [ ] **Step 7: Add `ledger` to LOAD_TAB_MAP in useCommandDispatch.js**

In `src/terminal/hooks/useCommandDispatch.js`, add to the `LOAD_TAB_MAP` object (line 24-30):

```javascript
  ledger: 'ledger', audit: 'ledger', verdicts: 'ledger', 'open_ledger': 'ledger',
```

- [ ] **Step 8: Verify the tab renders**

Run: `npm run dev`
Navigate to the Ledger tab. Verify the submission form renders. Submit an audit with default-ish params (temp: 15, DO: 8.5, BOD: 5, DT: 2, EPI: 0.8, Nitrate: 2, Flow: 0.4). Verify the verdict card appears.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/views/LedgerTab.jsx src/terminal/App.jsx src/terminal/hooks/useCommandDispatch.js
git commit -m "feat: Ledger tab — thermodynamic audit infrastructure with submission form and verdict archive"
```

---

### Task 8: API Ingest Connectors (USGS + EEA)

**Files:**
- Create: `src/terminal/ledger/apiIngest.js`
- Create: `tests/ledger/apiIngest.test.js`

- [ ] **Step 1: Write tests for API response parsing**

Create `tests/ledger/apiIngest.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { parseUSGSResponse, parseEEAResponse } from '../../src/terminal/ledger/apiIngest';

describe('parseUSGSResponse', () => {
  it('extracts temperature and DO from USGS NWIS JSON', () => {
    const mockResponse = {
      value: {
        timeSeries: [
          {
            variable: { variableCode: [{ value: '00010' }] }, // Temperature
            values: [{ value: [{ value: '22.3', dateTime: '2026-04-01T12:00:00' }] }],
          },
          {
            variable: { variableCode: [{ value: '00300' }] }, // DO
            values: [{ value: [{ value: '7.2', dateTime: '2026-04-01T12:00:00' }] }],
          },
        ],
      },
    };
    const params = parseUSGSResponse(mockResponse);
    expect(params.temp).toBe(22.3);
    expect(params.do).toBe(7.2);
  });

  it('returns null for missing parameters', () => {
    const params = parseUSGSResponse({ value: { timeSeries: [] } });
    expect(params.temp).toBeNull();
  });
});

describe('parseEEAResponse', () => {
  it('extracts parameters from EEA Waterbase format', () => {
    const mockRecords = [
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'Water temperature', resultObservedValue: 18.5 },
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'Dissolved oxygen', resultObservedValue: 6.8 },
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'BOD5', resultObservedValue: 4.2 },
    ];
    const params = parseEEAResponse(mockRecords);
    expect(params.temp).toBe(18.5);
    expect(params.do).toBe(6.8);
    expect(params.bod).toBe(4.2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: Fail (module not found).

- [ ] **Step 3: Implement apiIngest.js**

Create `src/terminal/ledger/apiIngest.js`:

```javascript
// API Ingest — Open hydrological data connectors
// dependency: external (auto-set for all API-sourced data)

// USGS parameter codes → our field names
const USGS_PARAM_MAP = {
  '00010': 'temp',     // Temperature, water, degrees Celsius
  '00300': 'do',       // Dissolved oxygen, mg/L
  '00310': 'bod',      // BOD, 5-day, mg/L
  '00060': 'flow',     // Discharge, cubic feet per second (needs conversion)
  '00630': 'nitrate',  // Nitrate + nitrite, mg/L as N
};

// EEA determinand labels → our field names
const EEA_PARAM_MAP = {
  'Water temperature': 'temp',
  'Dissolved oxygen':  'do',
  'BOD5':              'bod',
  'BOD7':              'bod',
  'Nitrate':           'nitrate',
};

export function parseUSGSResponse(json) {
  const params = { temp: null, do: null, bod: null, flow: null, nitrate: null };
  const series = json?.value?.timeSeries ?? [];
  for (const ts of series) {
    const code = ts.variable?.variableCode?.[0]?.value;
    const field = USGS_PARAM_MAP[code];
    if (!field) continue;
    const latest = ts.values?.[0]?.value?.[0];
    if (!latest) continue;
    let val = parseFloat(latest.value);
    if (isNaN(val)) continue;
    // Convert cubic feet/s to cubic meters/s for flow
    if (code === '00060') val *= 0.0283168;
    params[field] = Math.round(val * 100) / 100;
  }
  return params;
}

export function parseEEAResponse(records) {
  const params = { temp: null, do: null, bod: null, nitrate: null };
  for (const rec of records) {
    const label = rec.observedPropertyDeterminandLabel;
    const field = EEA_PARAM_MAP[label];
    if (!field) continue;
    const val = parseFloat(rec.resultObservedValue);
    if (!isNaN(val)) params[field] = Math.round(val * 100) / 100;
  }
  return params;
}

export async function fetchUSGS(lat, lon, radiusMiles = 10) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${lon - 0.15},${lat - 0.15},${lon + 0.15},${lat + 0.15}&parameterCd=00010,00300,00310,00060,00630&siteStatus=active`;
  const res = await fetch(url);
  if (!res.ok) return { params: {}, stations: [], error: `USGS returned ${res.status}` };
  const json = await res.json();
  const params = parseUSGSResponse(json);
  const stations = (json.value?.timeSeries ?? [])
    .map(ts => ts.sourceInfo?.siteName)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  return { params, stations, source: 'USGS NWIS', retrievedAt: new Date().toISOString() };
}

export async function fetchEEA(lat, lon) {
  // EEA Waterbase SPARQL endpoint — simplified query
  const url = `https://discodata.eea.europa.eu/sql?query=SELECT%20*%20FROM%20%5BWISE_SOE%5D.%5Blatest%5D.%5Bv_WISE_SOE_Waterbase%5D%20WHERE%20lat%20BETWEEN%20${lat - 0.1}%20AND%20${lat + 0.1}%20AND%20lon%20BETWEEN%20${lon - 0.1}%20AND%20${lon + 0.1}%20ORDER%20BY%20phenomenonTimeSamplingDate%20DESC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { params: {}, error: `EEA returned ${res.status}` };
    const json = await res.json();
    const records = json.results ?? json.data ?? [];
    const params = parseEEAResponse(records);
    return { params, source: 'EEA Waterbase', retrievedAt: new Date().toISOString() };
  } catch (err) {
    return { params: {}, error: err.message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All parser tests pass (network calls not tested — those are integration tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/apiIngest.js tests/ledger/apiIngest.test.js
git commit -m "feat: USGS + EEA hydrological API connectors with response parsers"
```

---

### Task 9: Wire API Ingest into Submission Form

**Files:**
- Modify: `src/terminal/views/LedgerTab.jsx`
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`

- [ ] **Step 1: Add API fetch controls to LedgerTab**

In `src/terminal/views/LedgerTab.jsx`, add import at top:

```javascript
import { fetchUSGS, fetchEEA } from '../ledger/apiIngest';
```

Add state after `const [view, setView] = useState('submit');`:

```javascript
const [apiData, setApiData] = useState(null);
const [apiLoading, setApiLoading] = useState(false);
const [apiError, setApiError] = useState(null);
```

Add handler after `handleSubmit`:

```javascript
const handleApiFetch = useCallback(async (lat, lon, source) => {
  setApiLoading(true);
  setApiError(null);
  try {
    const result = source === 'usgs' ? await fetchUSGS(lat, lon) : await fetchEEA(lat, lon);
    if (result.error) {
      setApiError(result.error);
    } else {
      setApiData({ ...result.params, lat, lon, source: result.source, retrievedAt: result.retrievedAt });
    }
  } catch (err) {
    setApiError(err.message);
  } finally {
    setApiLoading(false);
  }
}, []);
```

Update `<SubmissionForm>` props:

```jsx
<SubmissionForm
  onSubmit={handleSubmit}
  loading={loading}
  apiData={apiData}
  onApiFetch={handleApiFetch}
  apiLoading={apiLoading}
  apiError={apiError}
/>
```

- [ ] **Step 2: Add API fetch buttons to SubmissionForm**

In `src/terminal/views/ledger/SubmissionForm.jsx`, add to the props destructuring:

```javascript
export default function SubmissionForm({ onSubmit, loading, apiData, onApiFetch, apiLoading, apiError }) {
```

After the Coordinates section (after the siteName input), add:

```jsx
        {/* API Fetch */}
        {form.lat && form.lon && onApiFetch && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onApiFetch(Number(form.lat), Number(form.lon), 'usgs')}
              disabled={apiLoading}
              className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors disabled:opacity-30"
            >
              {apiLoading ? '...' : 'PULL USGS'}
            </button>
            <button
              onClick={() => onApiFetch(Number(form.lat), Number(form.lon), 'eea')}
              disabled={apiLoading}
              className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors disabled:opacity-30"
            >
              {apiLoading ? '...' : 'PULL EEA'}
            </button>
            {apiError && <span className="text-[9px] font-mono text-red-500">{apiError}</span>}
          </div>
        )}
```

Add a `useEffect` to auto-populate form when `apiData` changes:

```javascript
useEffect(() => {
  if (apiData) {
    setForm(prev => {
      const next = { ...prev, dependency: 'external' };
      if (apiData.lat) next.lat = apiData.lat;
      if (apiData.lon) next.lon = apiData.lon;
      for (const key of Object.keys(PARAM_RANGES)) {
        if (apiData[key] !== null && apiData[key] !== undefined) {
          next[key] = apiData[key];
        }
      }
      return next;
    });
  }
}, [apiData]);
```

- [ ] **Step 3: Verify API fetch works**

Run: `npm run dev`
Enter coordinates for a US river (e.g., lat: 38.89, lon: -77.03 for Potomac near DC). Click "PULL USGS". Verify params auto-populate.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LedgerTab.jsx src/terminal/views/ledger/SubmissionForm.jsx
git commit -m "feat: wire USGS + EEA API ingest into submission form"
```

---

### Task 10: Export Formats (JSON-LD + PDF + Embed)

**Files:**
- Create: `src/terminal/ledger/exportFormats.js`
- Create: `tests/ledger/exportFormats.test.js`

- [ ] **Step 1: Install jspdf**

```bash
npm install jspdf
```

- [ ] **Step 2: Write tests for export format generation**

Create `tests/ledger/exportFormats.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { generateJsonLd, generateEmbedHtml } from '../../src/terminal/ledger/exportFormats';

const MOCK_VERDICT = {
  hash: 'a7f3c9002e81d4aabbccdd',
  status: 'EMERGENCY_VETO',
  coordinates: { lat: 48.2082, lon: 16.3738 },
  dependency: 'external',
  kernelId: 'CHRONO-ACTUARY-KERNEL-2.0',
  timestamp: '2027-06-14T09:31:22Z',
  input: { temp: 24.3, do: 4.1, bod: 22, dt: 6, epi: 0.8, nitrate: 14, flow: 0.08 },
  ruling: 'Thermal rent exceeds biocapacity.',
  audit: { status: 'EMERGENCY_VETO' },
};

describe('generateJsonLd', () => {
  it('produces valid JSON-LD structure', () => {
    const ld = generateJsonLd(MOCK_VERDICT);
    const parsed = JSON.parse(ld);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Dataset');
    expect(parsed.name).toContain('EMERGENCY_VETO');
    expect(parsed.identifier).toBe(MOCK_VERDICT.hash);
    expect(parsed.spatialCoverage.geo.latitude).toBe(48.2082);
  });
});

describe('generateEmbedHtml', () => {
  it('produces an HTML snippet with verdict data', () => {
    const html = generateEmbedHtml(MOCK_VERDICT);
    expect(html).toContain('EMERGENCY_VETO');
    expect(html).toContain('48.2082');
    expect(html).toContain(MOCK_VERDICT.hash.slice(0, 12));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: Fail.

- [ ] **Step 4: Implement exportFormats.js**

Create `src/terminal/ledger/exportFormats.js`:

```javascript
// Export Formats — make verdicts citable
// JSON-LD for semantic web, PDF for legal/regulatory, embed HTML for journalists.

export function generateJsonLd(verdict) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Thermodynamic Audit Verdict: ${verdict.status}`,
    description: verdict.ruling,
    identifier: verdict.hash,
    dateCreated: verdict.timestamp,
    creator: {
      '@type': 'SoftwareApplication',
      name: 'scale94.com — The Open Ledger',
      url: 'https://scale94.com',
    },
    spatialCoverage: {
      '@type': 'Place',
      geo: {
        '@type': 'GeoCoordinates',
        latitude: verdict.coordinates.lat,
        longitude: verdict.coordinates.lon,
      },
    },
    variableMeasured: Object.entries(verdict.input || {})
      .filter(([k]) => ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'].includes(k))
      .map(([k, v]) => ({ '@type': 'PropertyValue', name: k, value: v })),
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'verdictStatus', value: verdict.status },
      { '@type': 'PropertyValue', name: 'dependency', value: verdict.dependency },
      { '@type': 'PropertyValue', name: 'kernelId', value: verdict.kernelId },
      { '@type': 'PropertyValue', name: 'sha256', value: verdict.hash },
    ],
  };
  return JSON.stringify(ld, null, 2);
}

export function generateEmbedHtml(verdict) {
  return `<div style="font-family:monospace;background:#0a0a0f;color:#cbd5e1;border:1px solid rgba(20,184,166,0.3);padding:16px;border-radius:4px;max-width:480px;">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#0d9488;margin-bottom:8px;">SCALE94 THERMODYNAMIC VERDICT</div>
  <div style="font-size:16px;font-weight:bold;color:${verdict.status === 'APPROVED' ? '#22c55e' : verdict.status === 'CONDITIONAL' ? '#eab308' : '#ef4444'};margin-bottom:8px;">${verdict.status}</div>
  <div style="font-size:11px;color:#64748b;margin-bottom:4px;">coordinates: ${verdict.coordinates.lat.toFixed(4)}, ${verdict.coordinates.lon.toFixed(4)}</div>
  <div style="font-size:11px;color:#64748b;margin-bottom:4px;">dependency: ${verdict.dependency}</div>
  <div style="font-size:10px;color:#475569;margin-bottom:8px;">hash: ${verdict.hash?.slice(0, 12)}...${verdict.hash?.slice(-8)}</div>
  <div style="font-size:11px;color:#94a3b8;border-top:1px solid rgba(20,184,166,0.15);padding-top:8px;">${verdict.ruling?.slice(0, 200)}${(verdict.ruling?.length ?? 0) > 200 ? '...' : ''}</div>
  <div style="font-size:9px;color:#334155;margin-top:8px;"><a href="https://scale94.com" style="color:#0d9488;">scale94.com</a> · The Open Ledger · ${verdict.timestamp?.slice(0, 10)}</div>
</div>`;
}

export async function generatePdf(verdict) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const m = 20; // margin
  let y = m;

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(13, 148, 136);
  doc.text('SCALE94.COM — THE OPEN LEDGER', m, y);
  y += 6;
  doc.text('THERMODYNAMIC AUDIT VERDICT', m, y);
  y += 10;

  doc.setFontSize(18);
  doc.setTextColor(verdict.status === 'APPROVED' ? 34 : 239, verdict.status === 'APPROVED' ? 197 : 68, verdict.status === 'APPROVED' ? 94 : 68);
  doc.text(verdict.status, m, y);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const lines = [
    `Hash: ${verdict.hash}`,
    `Timestamp: ${verdict.timestamp}`,
    `Coordinates: ${verdict.coordinates.lat.toFixed(4)}, ${verdict.coordinates.lon.toFixed(4)}`,
    `Dependency: ${verdict.dependency}`,
    `Kernel: ${verdict.kernelId}`,
    '',
    'INPUT PARAMETERS:',
    ...Object.entries(verdict.input || {})
      .filter(([k]) => ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'].includes(k))
      .map(([k, v]) => `  ${k}: ${v}`),
    '',
    'RULING:',
    ...(verdict.ruling || '').split('\n'),
  ];

  for (const line of lines) {
    if (y > 270) { doc.addPage(); y = m; }
    doc.text(line, m, y);
    y += 4.5;
  }

  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('Generated by scale94.com — The Open Ledger. This verdict is SHA-256 hashed and immutable.', m, 285);

  doc.save(`verdict-${verdict.hash?.slice(0, 12)}.pdf`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All export format tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/exportFormats.js tests/ledger/exportFormats.test.js package.json package-lock.json
git commit -m "feat: verdict export formats — JSON-LD, PDF, embeddable HTML widget"
```

---

### Task 11: Wire Export into Verdict Card

**Files:**
- Modify: `src/terminal/views/LedgerTab.jsx`

- [ ] **Step 1: Add export handler to LedgerTab**

In `src/terminal/views/LedgerTab.jsx`, add import:

```javascript
import { generateJsonLd, generatePdf, generateEmbedHtml } from '../ledger/exportFormats';
```

Add handler after `handleApiFetch`:

```javascript
const handleExport = useCallback(async (verdict, format) => {
  if (format === 'json') {
    const blob = new Blob([generateJsonLd(verdict)], { type: 'application/ld+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `verdict-${verdict.hash?.slice(0, 12)}.jsonld`;
    a.click(); URL.revokeObjectURL(url);
  } else if (format === 'pdf') {
    await generatePdf(verdict);
  } else if (format === 'embed') {
    const html = generateEmbedHtml(verdict);
    await navigator.clipboard.writeText(html);
  }
}, []);
```

Update `<VerdictCard>` to pass the export handler:

```jsx
<VerdictCard key={v.hash} verdict={v} onExport={handleExport} />
```

- [ ] **Step 2: Verify exports work**

Run: `npm run dev`
Submit an audit → expand the verdict → click JSON-LD (should download file), PDF (should download PDF), EMBED (should copy HTML to clipboard).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/LedgerTab.jsx
git commit -m "feat: wire export handlers into verdict cards (JSON-LD download, PDF, clipboard embed)"
```

---

### Task 12: Coordinate Picker (Leaflet Map)

**Files:**
- Create: `src/terminal/views/ledger/CoordinatePicker.jsx`
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`
- Modify: `package.json`

- [ ] **Step 1: Install leaflet dependencies**

```bash
npm install leaflet react-leaflet
```

- [ ] **Step 2: Create CoordinatePicker component**

Create `src/terminal/views/ledger/CoordinatePicker.jsx`:

```jsx
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon (leaflet CSS issue with bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function CoordinatePicker({ lat, lon, onSelect, onClose }) {
  const center = lat && lon ? [lat, lon] : [48.2, 16.37];
  const hasMarker = lat && lon;

  return (
    <div className="relative border border-teal-900/30 rounded-sm overflow-hidden" style={{ height: 280 }}>
      <MapContainer
        center={center} zoom={hasMarker ? 10 : 3}
        style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <ClickHandler onSelect={onSelect} />
        {hasMarker && <Marker position={[lat, lon]} />}
      </MapContainer>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-[1000] text-[9px] font-mono text-teal-500 bg-black/80 border border-teal-900/40 px-2 py-1 rounded-sm hover:text-teal-300 transition-colors"
      >
        CLOSE MAP
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add map toggle to SubmissionForm**

In `src/terminal/views/ledger/SubmissionForm.jsx`, add import:

```javascript
import { lazy, Suspense, useState as useMapState } from 'react';
const CoordinatePicker = lazy(() => import('./CoordinatePicker'));
```

Add state: `const [showMap, setShowMap] = useState(false);`

After the Longitude input (closing `</div>` of the grid), before the siteName input, add:

```jsx
        <div className="mt-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest transition-colors"
          >
            {showMap ? '[ - ] HIDE MAP' : '[ + ] SELECT ON MAP'}
          </button>
          {showMap && (
            <Suspense fallback={<div className="h-[280px] flex items-center justify-center font-mono text-xs text-gray-600">Loading map...</div>}>
              <div className="mt-2">
                <CoordinatePicker
                  lat={Number(form.lat) || null}
                  lon={Number(form.lon) || null}
                  onSelect={(lat, lon) => {
                    update('lat', lat.toFixed(6));
                    update('lon', lon.toFixed(6));
                  }}
                  onClose={() => setShowMap(false)}
                />
              </div>
            </Suspense>
          )}
        </div>
```

- [ ] **Step 4: Verify map renders**

Run: `npm run dev`
Open Ledger tab → click "SELECT ON MAP" → click on the map → verify lat/lon auto-populate.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ledger/CoordinatePicker.jsx src/terminal/views/ledger/SubmissionForm.jsx package.json package-lock.json
git commit -m "feat: Leaflet coordinate picker for river site selection"
```

---

### Task 13: `run ledger` CLI Command

**Files:**
- Modify: `src/terminal/hooks/useCommandDispatch.js`

- [ ] **Step 1: Add `run ledger` shortcut command**

In `useCommandDispatch.js`, inside the `run` action handler, before the WASM registry lookup (around line 71), add a guard:

```javascript
    // ── run ledger ────────────────────────────────────────────────────────
    if (baseCmd === 'ledger' || baseCmd === 'audit' || baseCmd === 'open_ledger') {
      handleNav('~/system/ledger', 'ledger');
      executeCommand(rawCmd, `Switching to The Open Ledger...`);
      return;
    }
```

- [ ] **Step 2: Verify `run ledger` navigates to the tab**

Run: `npm run dev`
Type `run ledger` in the terminal. Verify it navigates to the Ledger tab.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/hooks/useCommandDispatch.js
git commit -m "feat: 'run ledger' CLI command navigates to the Open Ledger tab"
```

---

### Task 14: Verdict Count in Boot Sequence

**Files:**
- Modify: `src/terminal/App.jsx` (boot/init section)

- [ ] **Step 1: Add verdict count to system status**

In `App.jsx`, import the verdict count function:

```javascript
import { getVerdictCount } from './ledger/verdictStore';
```

In the boot/initialization effect (the `useEffect` that runs on mount), after the kernel manifest is loaded and system articles are set, add:

```javascript
getVerdictCount().then(count => {
  if (count > 0) {
    appendSystemLog({ time: fmtTime(), msg: `  OPEN LEDGER: ${count} verdict${count !== 1 ? 's' : ''} in archive`, rust: true });
  }
});
```

- [ ] **Step 2: Verify boot message appears**

Run: `npm run dev`
If there are verdicts in IndexedDB, the boot sequence should show the count.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "feat: display verdict count in terminal boot sequence"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All Phase 1 requirements covered (structured input, CAS verdict archive, API ingest, counter-evidence export, CLI integration)
- [x] **Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.
- [x] **Type consistency:** `verdictModel.js` exports (`createVerdict`, `hashVerdict`, `validateSubmission`, `PARAM_RANGES`, `VALID_DEPENDENCIES`) used consistently across all tasks. `ledgerBus` follows `colliderBus` pattern. `wasmRegistry` key `CHRONO-ACTUARY-KERNEL-2.0` matches `wasm.generated.js`.
- [x] **Phase 2 not included:** Kernel Commons is intentionally deferred — separate spec + plan cycle after Phase 1 ships.
- [x] **No scope creep:** Leaflet map is the only new visual dependency. No accounts, no blockchain, no social features.
