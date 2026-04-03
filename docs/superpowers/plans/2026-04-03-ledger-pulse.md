# Ledger Pulse — Live River Visualization & Audit Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Ledger tab from a static form into a living, breathing visualization where every parameter input drives real-time animations, and audit results display rich structured data instead of raw text with zeros.

**Architecture:** Three layers — (1) a kernel output parser that extracts structured module verdicts from the WASM text output, (2) a real-time canvas visualization (`RiverPulse`) that responds to form input as the user types, (3) enhanced display components that show parsed audit data with animated severity indicators. All new code is pure React + Canvas2D, no new dependencies.

**Tech Stack:** React 18, Canvas2D, CSS keyframe animations, existing WASM kernel (unchanged)

---

## Root Cause: The "0s" Bug

The WASM kernel (`run_chrono_actuary`) returns a rich text string with `PERMIT: [GRANTED]` etc. The `createVerdict` function tries to match `DATA:{...}` JSON (line 42 of `verdictModel.js`), but the kernel never outputs that format — it outputs formatted text. So `verdict.audit` is always `{}` (empty object).

The "ton of 0s" the user sees is the Fiscal Ledger section of the ruling text:
```
DO_DEBT:                    0 EUR
THERMAL_DEBT:               0 EUR
NUTRIENT_DEBT:              0 EUR
FLOOD_LIABILITY:            0 EUR
ECO_TOTAL:                  0 EUR
```
These are 0 because safe parameter values produce no ecological debt. The display shows the raw text with no visual hierarchy — just a wall of zeros.

Additionally, the Langelier module in AuditCascade always shows `— LSI` with a 0% bar because `lsi` is never in the user form (it's hardcoded as 0.1 in `LedgerTab.jsx:155`).

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/terminal/ledger/verdictModel.js` | Add `parseKernelOutput()`, wire into `createVerdict` |
| Create | `src/terminal/views/ledger/RiverPulse.jsx` | Real-time canvas visualization driven by form params |
| Create | `src/terminal/views/ledger/severityEngine.js` | Shared severity math for RiverPulse + form indicators |
| Modify | `src/terminal/views/ledger/SubmissionForm.jsx` | Add RiverPulse + live severity dots on inputs |
| Modify | `src/terminal/views/ledger/AuditCascade.jsx` | Show parsed module signals + computed values |
| Modify | `src/terminal/views/ledger/VerdictCard.jsx` | Show all 7 params + 5 module status indicators |
| Modify | `tests/ledger/verdictModel.test.js` | Tests for parseKernelOutput |

---

### Task 1: Severity Engine — shared math for all visualizations

**Files:**
- Create: `src/terminal/views/ledger/severityEngine.js`
- Test: `tests/ledger/severityEngine.test.js`

This module provides continuous 0→1 severity values and discrete severity levels for all 7 parameters. Used by RiverPulse, form indicators, and AuditCascade.

- [ ] **Step 1: Write the test file**

Create `tests/ledger/severityEngine.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { paramSeverity, discreteSeverity, aggregateHealth } from '../../src/terminal/views/ledger/severityEngine';

describe('paramSeverity', () => {
  it('returns 0 for null/undefined/NaN', () => {
    expect(paramSeverity('do', null)).toBe(0);
    expect(paramSeverity('do', undefined)).toBe(0);
    expect(paramSeverity('do', NaN)).toBe(0);
  });

  it('DO: high value = low severity (healthier)', () => {
    expect(paramSeverity('do', 14)).toBeLessThan(0.1);
    expect(paramSeverity('do', 2)).toBeGreaterThan(0.7);
  });

  it('flow: high value = low severity (healthier)', () => {
    expect(paramSeverity('flow', 80)).toBeLessThan(0.2);
    expect(paramSeverity('flow', 5)).toBeGreaterThan(0.7);
  });

  it('temp: high value = high severity', () => {
    expect(paramSeverity('temp', 5)).toBeLessThan(0.3);
    expect(paramSeverity('temp', 40)).toBeGreaterThan(0.7);
  });

  it('bod: high value = high severity', () => {
    expect(paramSeverity('bod', 2)).toBeLessThan(0.2);
    expect(paramSeverity('bod', 80)).toBeGreaterThan(0.7);
  });
});

describe('discreteSeverity', () => {
  it('maps continuous to safe/stress/critical', () => {
    expect(discreteSeverity(0.2)).toBe('safe');
    expect(discreteSeverity(0.55)).toBe('stress');
    expect(discreteSeverity(0.85)).toBe('critical');
  });
});

describe('aggregateHealth', () => {
  it('returns 100 for all-safe params', () => {
    const safe = { temp: 10, do: 12, bod: 2, dt: 1, epi: 0.5, nitrate: 1, flow: 60 };
    expect(aggregateHealth(safe)).toBeGreaterThan(70);
  });

  it('returns low score for critical params', () => {
    const bad = { temp: 40, do: 1, bod: 80, dt: 10, epi: 15, nitrate: 80, flow: 2 };
    expect(aggregateHealth(bad)).toBeLessThan(30);
  });

  it('returns 50 for empty params', () => {
    expect(aggregateHealth({})).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ledger/severityEngine.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/terminal/views/ledger/severityEngine.js`:

```javascript
// severityEngine.js — continuous severity math for all Ledger visualizations
// Severity: 0 = perfectly safe, 1 = maximally critical
// Used by: RiverPulse, SubmissionForm severity dots, AuditCascade

import { PARAM_RANGES } from '../../ledger/verdictModel';

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Params where HIGHER value = HEALTHIER (inverted severity)
const INVERTED = new Set(['do', 'flow']);

// Per-parameter safe ceilings (value at which severity ≈ 1.0)
// Tuned to match the Rust kernel's threshold logic
const CEILINGS = {
  temp:    45,
  do:      14,   // inverted: severity = 1 - v/14
  bod:     60,
  dt:      10,
  epi:     8,
  nitrate: 50,
  flow:    60,   // inverted: severity = 1 - v/60
};

export function paramSeverity(key, value) {
  if (value === null || value === undefined || isNaN(Number(value))) return 0;
  const v = Number(value);
  const ceil = CEILINGS[key];
  if (!ceil) return 0;

  if (INVERTED.has(key)) {
    return Math.max(0, Math.min(1, 1 - v / ceil));
  }
  return Math.max(0, Math.min(1, v / ceil));
}

export function discreteSeverity(continuous) {
  if (continuous < 0.4) return 'safe';
  if (continuous < 0.7) return 'stress';
  return 'critical';
}

export function aggregateHealth(params) {
  let sum = 0;
  let count = 0;
  for (const key of PARAM_KEYS) {
    const v = params[key];
    if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) {
      sum += paramSeverity(key, Number(v));
      count++;
    }
  }
  if (count === 0) return 50; // neutral when no data
  const avgSeverity = sum / count;
  return Math.round(100 * (1 - avgSeverity));
}

export { PARAM_KEYS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ledger/severityEngine.test.js`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ledger/severityEngine.js tests/ledger/severityEngine.test.js
git commit -m "feat(ledger): severity engine — shared continuous severity math for visualizations"
```

---

### Task 2: Parse kernel output into structured audit data

**Files:**
- Modify: `src/terminal/ledger/verdictModel.js`
- Modify: `tests/ledger/verdictModel.test.js`

Extract module statuses, signals, and computed values from the kernel's text output so downstream components can render them visually instead of showing raw text with zeros.

- [ ] **Step 1: Add test for parseKernelOutput**

Append to `tests/ledger/verdictModel.test.js`:

```javascript
import { parseKernelOutput } from '../src/terminal/ledger/verdictModel';

describe('parseKernelOutput', () => {
  const SAMPLE_OUTPUT = `ᛟ CHRONO-ACTUARY v2.0.0 // BOOT_OK
OFFICE OF THE RIVER SOVEREIGN · DEEP-TIME AUDIT BUREAU

── MODULE 01 · DISSOLVED OXYGEN LEDGER ────────────────────
TEMP: 15.0°C  DO_SAT: 10.08 mg/L  DO_MIN: 7.23 mg/L
K_d: 0.2300/day  K_r: 0.4000/day  T_CRIT: 2.41 days
STATUS: INFLATION_WARNING  [⚠ AMBER]

── MODULE 02 · THERMAL RENT ────────────────────────────────
ΔT_PROJECT: +2.0°C  BOD×Q10: ×1.149  LICENSE: 30 yr
EOL_CLIMATE: +1.80°C (IPCC RCP8.5)  EOL_TOTAL: +3.80°C
STATUS: THERMAL_STRESS  [⚠ AMBER]

── MODULE 03 · NUTRIENT DEBT ───────────────────────────────
EPI: 0.800  →  WITHIN_CAPACITY  [✓ GREEN]
NITRATE-N: 2.00 mg/L  →  MESOTROPHIC  [✓ GREEN]

── MODULE 04 · HYDRAULIC SOVEREIGNTY ──────────────────────
FLOW_RATIO: 0.400 Q/Qmean  STATUS: VIABLE_HABITAT  [⚠ AMBER]

── MODULE 05 · LANGELIER SATURATION INDEX ──────────────────
LSI: 0.100  STATUS: CARBONATE_EQUILIBRIUM  [✓ GREEN]

── FISCAL LEDGER ───────────────────────────────────────────
HUMAN_PROFIT:         1000000 EUR
DO_DEBT:                    0 EUR
THERMAL_DEBT:          160000 EUR
NUTRIENT_DEBT:              0 EUR
FLOOD_LIABILITY:            0 EUR
ECO_TOTAL:             160000 EUR
NPV_TRUE:        SOLVENT  +840000 EUR

── RULING ──────────────────────────────────────────────────
Approved with binding mitigation schedule. Non-compliance triggers automatic downgrade to REJECTED. The Sovereign monitors.
PERMIT: [CONDITIONAL]

SOURCE: content/rust_kernels/src/kernels/chrono_actuary.rs`;

  it('extracts 5 module statuses', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.modules).toHaveLength(5);
    expect(parsed.modules[0].signal).toBe('AMBER');
    expect(parsed.modules[1].signal).toBe('AMBER');
    expect(parsed.modules[2].signal).toBe('GREEN');
    expect(parsed.modules[3].signal).toBe('AMBER');
    expect(parsed.modules[4].signal).toBe('GREEN');
  });

  it('extracts computed values', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.modules[0].values.DO_MIN).toBeCloseTo(7.23);
    expect(parsed.modules[0].values.DO_SAT).toBeCloseTo(10.08);
  });

  it('extracts fiscal data', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.fiscal.ECO_TOTAL).toBe(160000);
    expect(parsed.fiscal.HUMAN_PROFIT).toBe(1000000);
  });

  it('extracts permit code', () => {
    const parsed = parseKernelOutput(SAMPLE_OUTPUT);
    expect(parsed.permit).toBe('CONDITIONAL');
  });

  it('returns empty structure for garbage input', () => {
    const parsed = parseKernelOutput('nothing useful');
    expect(parsed.modules).toHaveLength(0);
    expect(parsed.permit).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ledger/verdictModel.test.js`
Expected: FAIL — parseKernelOutput is not exported

- [ ] **Step 3: Implement parseKernelOutput and wire into createVerdict**

Add to `src/terminal/ledger/verdictModel.js`, after the existing `PARAM_RANGES` export and before `validateSubmission`:

```javascript
// ── Kernel output parser ─────────────────────────────────────────────────────
// Extracts structured module data from the CHRONO-ACTUARY text output.
// This replaces the broken DATA:{} JSON match that always returned {}.

const SIGNAL_RE = /\[([\u2713\u2717\u26a0\u16c9][\u16c9]?\s*(GREEN|AMBER|RED|VETO|EMERGENCY))\]/;
const MODULE_HEADERS = [
  { key: 'do_ledger',   pattern: /MODULE 01.*DISSOLVED OXYGEN/  },
  { key: 'thermal',     pattern: /MODULE 02.*THERMAL RENT/      },
  { key: 'nutrient',    pattern: /MODULE 03.*NUTRIENT DEBT/     },
  { key: 'hydraulic',   pattern: /MODULE 04.*HYDRAULIC/         },
  { key: 'langelier',   pattern: /MODULE 05.*LANGELIER/         },
];

const MODULE_LABELS = {
  do_ledger: 'DISSOLVED OXYGEN',
  thermal:   'THERMAL RENT',
  nutrient:  'NUTRIENT DEBT',
  hydraulic: 'HYDRAULIC SOVEREIGNTY',
  langelier: 'LANGELIER INDEX',
};

export function parseKernelOutput(text) {
  if (!text || typeof text !== 'string') {
    return { modules: [], fiscal: {}, permit: 'UNKNOWN', ruling: '' };
  }

  const lines = text.split('\n');
  const modules = [];

  // Split into module sections
  for (let mi = 0; mi < MODULE_HEADERS.length; mi++) {
    const { key, pattern } = MODULE_HEADERS[mi];
    const startIdx = lines.findIndex(l => pattern.test(l));
    if (startIdx === -1) continue;

    // Find end: next MODULE header or FISCAL/RULING header
    let endIdx = lines.length;
    for (let j = startIdx + 1; j < lines.length; j++) {
      if (/^──\s*MODULE\s+\d|^──\s*FISCAL|^──\s*RULING/.test(lines[j])) {
        endIdx = j;
        break;
      }
    }

    const section = lines.slice(startIdx, endIdx).join('\n');

    // Extract signal (GREEN/AMBER/RED/VETO/EMERGENCY)
    let signal = 'UNKNOWN';
    const sigMatch = section.match(SIGNAL_RE);
    if (sigMatch) signal = sigMatch[2];

    // Extract status name
    let status = '';
    const statusMatch = section.match(/STATUS:\s*(\S+)/);
    const arrowMatch = section.match(/→\s+(\S+)/);
    if (statusMatch) status = statusMatch[1];
    else if (arrowMatch) status = arrowMatch[1];

    // Extract numeric values (KEY: value pattern)
    const values = {};
    const numericRe = /([A-Z_]+):\s+([-+]?\d+\.?\d*)/g;
    let m;
    while ((m = numericRe.exec(section)) !== null) {
      values[m[1]] = parseFloat(m[2]);
    }

    modules.push({ key, label: MODULE_LABELS[key], signal, status, values });
  }

  // Extract fiscal data
  const fiscal = {};
  const fiscalRe = /([A-Z_]+):\s+([-+]?\d[\d,]*)\s*EUR/g;
  let fm;
  while ((fm = fiscalRe.exec(text)) !== null) {
    fiscal[fm[1]] = parseInt(fm[2].replace(/,/g, ''), 10);
  }

  // Extract permit
  let permit = 'UNKNOWN';
  const permitMatch = text.match(/PERMIT:\s*\[(\w+)]/);
  if (permitMatch) permit = permitMatch[1];

  // Extract ruling text
  let ruling = '';
  const rulingIdx = lines.findIndex(l => /^──\s*RULING/.test(l));
  if (rulingIdx !== -1) {
    const rulingLines = [];
    for (let i = rulingIdx + 1; i < lines.length; i++) {
      if (/^PERMIT:/.test(lines[i])) break;
      if (lines[i].trim()) rulingLines.push(lines[i].trim());
    }
    ruling = rulingLines.join(' ');
  }

  return { modules, fiscal, permit, ruling };
}
```

Then modify the existing `createVerdict` function — replace the `DATA:{...}` matching block (lines 42-49) and the audit assignment:

Replace the entire body of `createVerdict` with:

```javascript
export function createVerdict(input, kernelOutput, kernelId) {
  const parsed = parseKernelOutput(kernelOutput);

  // Map kernel permit codes to display statuses
  const STATUS_MAP = {
    GRANTED:        'APPROVED',
    APPROVED:       'APPROVED',
    CONDITIONAL:    'CONDITIONAL',
    DEFERRED:       'CONDITIONAL',
    REJECTED:       'REJECTED',
    EMERGENCY_VETO: 'EMERGENCY_VETO',
  };
  const status = STATUS_MAP[parsed.permit] || parsed.permit;

  return {
    status,
    coordinates: { lat: input.lat, lon: input.lon },
    dependency: input.dependency || 'sovereign',
    kernelId,
    timestamp: new Date().toISOString(),
    input: { ...input },
    audit: parsed,
    ruling: kernelOutput.split('\n').filter(l => !l.startsWith('DATA:')).join('\n'),
  };
}
```

- [ ] **Step 4: Run all verdictModel tests**

Run: `npx vitest run tests/ledger/verdictModel.test.js`
Expected: all tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/verdictModel.js tests/ledger/verdictModel.test.js
git commit -m "feat(ledger): parse kernel output into structured audit data — fixes 0s display"
```

---

### Task 3: RiverPulse — real-time canvas visualization

**Files:**
- Create: `src/terminal/views/ledger/RiverPulse.jsx`

The hero feature. A canvas visualization that sits above the parameter inputs in the form and reacts in real-time as the user types values. Renders:

1. **Central health orb** — aggregate health score (0-100), pulsating, color shifts from teal→amber→red
2. **7 radial arcs** — one per parameter, arranged in a semicircle, length = severity, color = severity
3. **Pulse rings** — expand outward from center, speed increases with stress
4. **Floating particles** — drift outward, density increases with severity
5. **Parameter labels** — small text labels near each arc

- [ ] **Step 1: Create RiverPulse.jsx**

Create `src/terminal/views/ledger/RiverPulse.jsx`:

```jsx
// RiverPulse.jsx — Real-time thermodynamic health visualization
// Renders a radial "pulse" display driven by the 7 audit parameters.
// Every value change triggers smooth animated transitions.

import { useEffect, useRef, useCallback } from 'react';
import { paramSeverity, discreteSeverity, aggregateHealth, PARAM_KEYS } from './severityEngine';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

// Arc layout: 7 arcs spread across top semicircle
const ARC_SPREAD = Math.PI * 0.85;  // total spread angle
const ARC_GAP = ARC_SPREAD / 6;     // gap between arcs
const ARC_START = Math.PI + (Math.PI - ARC_SPREAD) / 2; // start from left

const LABELS = {
  temp: 'TEMP', do: 'DO', bod: 'BOD', dt: 'DT',
  epi: 'EPI', nitrate: 'NO3', flow: 'FLOW',
};

const SEV_COLORS = {
  safe:     { r: 20,  g: 184, b: 166 },  // teal
  stress:   { r: 245, g: 158, b: 11  },  // amber
  critical: { r: 239, g: 68,  b: 68  },  // red
};

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function severityColor(sev) {
  if (sev < 0.4) {
    const t = sev / 0.4;
    return lerpColor(SEV_COLORS.safe, SEV_COLORS.stress, t * 0.3);
  }
  if (sev < 0.7) {
    const t = (sev - 0.4) / 0.3;
    return lerpColor(SEV_COLORS.safe, SEV_COLORS.stress, 0.3 + t * 0.7);
  }
  const t = (sev - 0.7) / 0.3;
  return lerpColor(SEV_COLORS.stress, SEV_COLORS.critical, t);
}

function rgba({ r, g, b }, a) {
  return `rgba(${r},${g},${b},${a})`;
}

// ── Particle pool ──────────────────────────────────────────────────────────
const MAX_PARTICLES = 60;
function createParticles() {
  return {
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    vx: new Float32Array(MAX_PARTICLES),
    vy: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES),
    maxLife: new Float32Array(MAX_PARTICLES),
    size: new Float32Array(MAX_PARTICLES),
    head: 0,
  };
}

function emitParticle(pool, cx, cy, severity) {
  const i = pool.head % MAX_PARTICLES;
  pool.head++;
  const angle = Math.random() * TAU;
  const speed = 0.3 + severity * 0.8 + Math.random() * 0.5;
  pool.x[i] = cx;
  pool.y[i] = cy;
  pool.vx[i] = Math.cos(angle) * speed;
  pool.vy[i] = Math.sin(angle) * speed;
  pool.life[i] = 0;
  pool.maxLife[i] = 60 + Math.random() * 80;
  pool.size[i] = 0.5 + Math.random() * 1.5;
}

function stepParticles(pool) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.life[i] >= pool.maxLife[i]) continue;
    pool.life[i]++;
    pool.x[i] += pool.vx[i];
    pool.y[i] += pool.vy[i];
    pool.vx[i] *= 0.99;
    pool.vy[i] *= 0.99;
  }
}

function drawParticles(ctx, pool, color) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.life[i] >= pool.maxLife[i]) continue;
    const t = pool.life[i] / pool.maxLife[i];
    const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.7;
    const sz = pool.size[i] * (1 - t * 0.5);
    ctx.beginPath();
    ctx.arc(pool.x[i], pool.y[i], sz, 0, TAU);
    ctx.fillStyle = rgba(color, alpha * 0.6);
    ctx.fill();
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RiverPulse({ params = {} }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const particlePool = useRef(createParticles());

  // Smoothed values for animation (lerp toward target)
  const smoothed = useRef(PARAM_KEYS.map(() => 0));
  const targetSev = useRef(PARAM_KEYS.map(() => 0));
  const smoothHealth = useRef(50);

  // Update targets when params change
  useEffect(() => {
    PARAM_KEYS.forEach((key, i) => {
      targetSev.current[i] = paramSeverity(key, params[key]);
    });
  }, [params.temp, params.do, params.bod, params.dt, params.epi, params.nitrate, params.flow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pool = particlePool.current;

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width || 600;
      const h = 180;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function frame() {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h * 0.92; // center near bottom (arcs go up)
      const baseR = Math.min(w, h) * 0.32;
      const f = frameRef.current++;

      ctx.clearRect(0, 0, w, h);

      // ── Lerp smoothed values toward targets ──
      for (let i = 0; i < PARAM_KEYS.length; i++) {
        smoothed.current[i] += (targetSev.current[i] - smoothed.current[i]) * 0.04;
      }
      const health = aggregateHealth(params);
      smoothHealth.current += (health - smoothHealth.current) * 0.03;
      const sh = smoothHealth.current;
      const avgSev = 1 - sh / 100;
      const coreColor = severityColor(avgSev);

      // ── Background radial glow ──
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.5);
      bgGrad.addColorStop(0, rgba(coreColor, 0.06 + avgSev * 0.04));
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Pulse rings ──
      const pulseSpeed = 0.015 + avgSev * 0.025;
      for (let ring = 0; ring < 3; ring++) {
        const phase = ((f * pulseSpeed + ring * 0.33) % 1);
        const rr = baseR * 0.3 + phase * baseR * 1.8;
        const alpha = (1 - phase) * (0.08 + avgSev * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, Math.PI, TAU, false);
        ctx.strokeStyle = rgba(coreColor, alpha);
        ctx.lineWidth = 1.5 * (1 - phase);
        ctx.stroke();
      }

      // ── 7 parameter arcs ──
      for (let i = 0; i < PARAM_KEYS.length; i++) {
        const sev = smoothed.current[i];
        const color = severityColor(sev);
        const angle = ARC_START + i * ARC_GAP;
        const arcLen = 0.06 + sev * 0.08; // arc angular length
        const r = baseR + 8;

        // Track arc (dim)
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - arcLen, angle + arcLen, false);
        ctx.strokeStyle = rgba(color, 0.08);
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Fill arc (bright, proportional to severity)
        const fillLen = arcLen * Math.max(0.08, sev);
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - fillLen, angle + fillLen, false);
        ctx.strokeStyle = rgba(color, 0.4 + sev * 0.5);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glow
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - fillLen, angle + fillLen, false);
        ctx.strokeStyle = rgba(color, 0.1 + sev * 0.15);
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Label
        const labelR = baseR + 28;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(color, 0.5 + sev * 0.4);
        ctx.fillText(LABELS[PARAM_KEYS[i]], lx, ly);
      }

      // ── Central health orb ──
      const orbR = 18 + Math.sin(f * 0.03) * 2;
      // Outer glow
      const orbGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 3);
      orbGlow.addColorStop(0, rgba(coreColor, 0.15));
      orbGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR * 3, 0, TAU);
      ctx.fill();

      // Core
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
      orbGrad.addColorStop(0, rgba(coreColor, 0.9));
      orbGrad.addColorStop(0.7, rgba(coreColor, 0.4));
      orbGrad.addColorStop(1, rgba(coreColor, 0.1));
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, TAU);
      ctx.fill();

      // Health number
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.85);
      ctx.fillText(Math.round(sh), cx, cy - 1);

      // ── Particles ──
      if (f % Math.max(2, Math.round(12 - avgSev * 10)) === 0) {
        emitParticle(pool, cx, cy, avgSev);
      }
      stepParticles(pool);
      drawParticles(ctx, pool, coreColor);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []); // animation loop runs once, reads refs

  return (
    <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '8px' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {/* Subtle bottom fade into form */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '30px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

The component is canvas-based and visual — no unit test. Run the dev server and navigate to the Ledger tab (wired in Task 4) to see it render. Check browser console for errors.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/ledger/RiverPulse.jsx
git commit -m "feat(ledger): RiverPulse — real-time canvas health visualization driven by form input"
```

---

### Task 4: Wire RiverPulse + severity dots into SubmissionForm

**Files:**
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`

Add the RiverPulse visualization above the parameter inputs, and add small animated severity dots next to each parameter input field.

- [ ] **Step 1: Add imports and severity dot component**

At the top of `SubmissionForm.jsx`, add imports after the existing ones:

```javascript
import RiverPulse from './RiverPulse';
import { paramSeverity, discreteSeverity } from './severityEngine';
```

- [ ] **Step 2: Add SeverityDot inline component**

Add this before the `export default function SubmissionForm` line:

```javascript
const SEV_DOT_COLORS = {
  safe:     '#14b8a6',
  stress:   '#f59e0b',
  critical: '#ef4444',
};

const SEV_DOT_STYLES = `
@keyframes sev-dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.4); opacity: 1; }
}
`;

function SeverityDot({ paramKey, value }) {
  const sev = paramSeverity(paramKey, value);
  const level = discreteSeverity(sev);
  const color = SEV_DOT_COLORS[level];
  const hasValue = value !== '' && value !== undefined && value !== null;

  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: hasValue ? color : 'rgba(107,114,128,0.3)',
        boxShadow: hasValue && sev > 0.3 ? `0 0 6px ${color}88` : 'none',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        animation: hasValue && sev > 0.5 ? 'sev-dot-pulse 1.5s ease-in-out infinite' : 'none',
        marginLeft: '6px',
        verticalAlign: 'middle',
      }}
    />
  );
}
```

- [ ] **Step 3: Inject severity dot styles**

Inside the `SubmissionForm` component return, add at the very top (as first child of the outer `<div>`):

```jsx
<style>{SEV_DOT_STYLES}</style>
```

- [ ] **Step 4: Add RiverPulse above parameters section**

Inside SubmissionForm's return JSX, add the RiverPulse component just before the `{/* Parameters */}` comment/section (before the `<div>` with text "Audit Parameters"):

```jsx
{/* River Pulse — live parameter visualization */}
<RiverPulse params={form} />
```

- [ ] **Step 5: Add SeverityDot to each parameter input label**

In the parameter grid `.map()` callback, modify the `<label>` element. Replace:

```jsx
<label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">
  {range.label} <span className="text-gray-600">({range.unit})</span>
</label>
```

With:

```jsx
<label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">
  {range.label} <span className="text-gray-600">({range.unit})</span>
  <SeverityDot paramKey={key} value={form[key]} />
</label>
```

- [ ] **Step 6: Verify visually**

Run dev server. Navigate to Ledger → Submit Audit. Type values into parameter fields. Confirm:
- RiverPulse canvas appears above params, arcs animate as you type
- Severity dots appear next to each label, change color with value
- Performance is smooth (60fps)

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/ledger/SubmissionForm.jsx
git commit -m "feat(ledger): wire RiverPulse + severity dots into submission form"
```

---

### Task 5: Enhanced AuditCascade with parsed module signals

**Files:**
- Modify: `src/terminal/views/ledger/AuditCascade.jsx`

Show the actual module signals (GREEN/AMBER/RED/VETO/EMERGENCY) from the parsed kernel output alongside the existing animated bars. This replaces the input-only display with real computed results.

- [ ] **Step 1: Add signal badge rendering**

In `AuditCascade.jsx`, add a mapping from parsed module keys to the MODULES array. Add this after the existing `MODULES` array (line 9):

```javascript
// Map parsed audit module keys to cascade module indices
const MODULE_KEY_MAP = {
  do_ledger: 0,
  thermal:   1,
  nutrient:  2,
  hydraulic: 3,
  langelier: 4,
};

const SIGNAL_COLORS = {
  GREEN:     '#22c55e',
  AMBER:     '#eab308',
  RED:       '#ef4444',
  VETO:      '#ef4444',
  EMERGENCY: '#dc2626',
  UNKNOWN:   '#6b7280',
};
```

- [ ] **Step 2: Extract parsed modules in the component**

Inside the `AuditCascade` component function, after `const input = verdict.input || {};` (line 224), add:

```javascript
const parsedModules = verdict.audit?.modules || [];

// Build a lookup: module index → parsed module data
const parsedByIdx = {};
for (const pm of parsedModules) {
  const idx = MODULE_KEY_MAP[pm.key];
  if (idx !== undefined) parsedByIdx[idx] = pm;
}
```

- [ ] **Step 3: Show signal badge + computed value in each module row**

In the module `.map()` callback, after the existing label `<span>` (around line 325), add a signal badge. Modify the top row `<div>` that contains label and value. Replace the entire top-row `<div>` (the flex container with label and value) with:

```jsx
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  }}
>
  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: '10px',
        color: 'rgba(156,163,175,0.7)',
        letterSpacing: '1px',
      }}
    >
      {mod.label}
    </span>
    {parsedByIdx[i] && (
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '8px',
          letterSpacing: '2px',
          color: SIGNAL_COLORS[parsedByIdx[i].signal] || SIGNAL_COLORS.UNKNOWN,
          opacity: verdictVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        {parsedByIdx[i].signal}
      </span>
    )}
  </span>
  <span
    style={{
      fontFamily: 'monospace',
      fontSize: '11px',
      color: colors.text,
      letterSpacing: '1px',
    }}
  >
    {value !== null
      ? `${Number.isInteger(value) ? value : value.toFixed(2)} ${mod.unit}`
      : '— ' + mod.unit}
  </span>
</div>
```

- [ ] **Step 4: Show ruling summary instead of raw text**

Replace the ruling `<pre>` block (lines 441-451) with a version that shows the parsed ruling if available:

```jsx
{(verdict.audit?.ruling || verdict.ruling) && (
  <div
    className="ac-ruling"
    style={{ '--ac-ruling-delay': '300ms' }}
  >
    <pre
      style={{
        fontFamily: 'monospace',
        fontSize: '10px',
        color: 'rgba(156,163,175,0.6)',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        margin: 0,
        maxHeight: '80px',
        overflow: 'hidden',
        maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
      }}
    >
      {verdict.audit?.ruling
        ? verdict.audit.ruling
        : verdict.ruling?.trim().slice(0, 240)}
    </pre>
  </div>
)}
```

- [ ] **Step 5: Verify visually**

Run dev server. Submit an audit. Confirm:
- Module signal badges (GREEN/AMBER/RED) appear next to module labels during cascade
- Signal badges fade in when verdict reveals
- Ruling shows clean summary text, not raw output with zeros

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ledger/AuditCascade.jsx
git commit -m "feat(ledger): show parsed module signals + clean ruling in audit cascade"
```

---

### Task 6: Enhanced VerdictCard with all parameters + module indicators

**Files:**
- Modify: `src/terminal/views/ledger/VerdictCard.jsx`

Replace the 4-metric grid with all 7 parameters, each with a severity dot. Add a row of 5 module status indicators showing the kernel verdict for each module.

- [ ] **Step 1: Add imports**

At the top of `VerdictCard.jsx`, add:

```javascript
import { PARAM_RANGES } from '../../ledger/verdictModel';
import { paramSeverity, discreteSeverity } from './severityEngine';
```

- [ ] **Step 2: Add module indicator constants**

After the existing `STATUS_BORDER` object, add:

```javascript
const SIGNAL_COLORS = {
  GREEN:     '#22c55e',
  AMBER:     '#eab308',
  RED:       '#ef4444',
  VETO:      '#ef4444',
  EMERGENCY: '#dc2626',
  UNKNOWN:   '#6b7280',
};

const MODULE_SHORT = ['O2', 'THERM', 'NUTR', 'FLOW', 'LSI'];

const SEV_DOT_COLORS = {
  safe:     '#14b8a6',
  stress:   '#f59e0b',
  critical: '#ef4444',
};
```

- [ ] **Step 3: Replace the 4-metric grid with full 7-parameter display**

Replace the `{/* Key metrics */}` section (the grid with TEMP/DO/BOD/DT) with:

```jsx
{/* Module status indicators */}
{verdict.audit?.modules?.length > 0 && (
  <div className="flex gap-3 mb-3">
    {verdict.audit.modules.map((mod, i) => (
      <div key={mod.key} className="flex items-center gap-1.5">
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: SIGNAL_COLORS[mod.signal] || SIGNAL_COLORS.UNKNOWN,
            boxShadow: `0 0 4px ${SIGNAL_COLORS[mod.signal] || SIGNAL_COLORS.UNKNOWN}66`,
          }}
        />
        <span className="text-[8px] font-mono text-gray-600 tracking-wider">
          {MODULE_SHORT[i] || mod.key}
        </span>
      </div>
    ))}
  </div>
)}

{/* All 7 parameters with severity indicators */}
<div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-3">
  {Object.entries(PARAM_RANGES).map(([key, range]) => {
    const val = verdict.input?.[key];
    const sev = paramSeverity(key, val);
    const level = discreteSeverity(sev);
    const dotColor = val !== undefined ? SEV_DOT_COLORS[level] : 'rgba(107,114,128,0.3)';
    return (
      <div key={key} className="text-center">
        <div className="text-[8px] font-mono text-gray-600 uppercase tracking-widest flex items-center justify-center gap-1">
          {key}
          <span style={{
            display: 'inline-block',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: dotColor,
          }} />
        </div>
        <div className="text-xs font-mono text-teal-300">
          {val !== undefined ? val : '—'}
          <span className="text-gray-600 text-[8px] ml-0.5">{range.unit}</span>
        </div>
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Verify visually**

Run dev server. Go to Ledger → Verdict Archive. Confirm:
- Module status dots (colored circles) appear for each module
- All 7 parameters display with severity dots
- Layout is clean on both mobile and desktop widths

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ledger/VerdictCard.jsx
git commit -m "feat(ledger): verdict card shows all 7 params + 5 module status indicators"
```

---

### Task 7: Integration polish — param reactivity fix

**Files:**
- Modify: `src/terminal/views/ledger/RiverPulse.jsx`

The RiverPulse `useEffect` dependency array uses individual `params.X` properties. This is correct for triggering target updates, but we also need to ensure the animation loop reads fresh `params` via ref to avoid stale closures.

- [ ] **Step 1: Add params ref for the animation loop**

In `RiverPulse.jsx`, add a params ref right after the existing refs:

```javascript
const paramsRef = useRef(params);
```

Then add a useEffect to keep it fresh:

```javascript
useEffect(() => { paramsRef.current = params; });
```

Then in the `frame()` function, change the `aggregateHealth` call from:

```javascript
const health = aggregateHealth(params);
```

To:

```javascript
const health = aggregateHealth(paramsRef.current);
```

- [ ] **Step 2: Run the dev server and test the full flow**

Full integration test:
1. Navigate to Ledger tab
2. See boot choreography (map, title, form slide in)
3. See RiverPulse canvas with neutral 50 score
4. Type `temp: 15` — see TEMP arc react, score change
5. Type `do: 12` — see DO arc light up green, score improve
6. Type `bod: 3, dt: 1, epi: 0.5, nitrate: 2, flow: 50` — all arcs green, health ~90+
7. Click RUN AUDIT — eclipse sweep + cascade animation with GREEN signals
8. Cascade resolves to APPROVED with glitch text
9. Particle burst at map location
10. Archive shows verdict with all 7 params + 5 green module dots
11. Now try critical values: `temp: 40, do: 1, bod: 80, dt: 10, epi: 15, nitrate: 80, flow: 2`
12. RiverPulse turns red, arcs flare, health drops to ~10
13. Submit → EMERGENCY_VETO or REJECTED with red cascade
14. Verdict card shows red module indicators

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/ledger/RiverPulse.jsx
git commit -m "fix(ledger): RiverPulse params ref for fresh reads in animation loop"
```

---

## Summary

| Task | Component | What it does |
|------|-----------|-------------|
| 1 | severityEngine.js | Shared continuous severity math |
| 2 | verdictModel.js | Parse kernel output → structured audit data |
| 3 | RiverPulse.jsx | Real-time canvas health visualization |
| 4 | SubmissionForm.jsx | Wire RiverPulse + severity dots into form |
| 5 | AuditCascade.jsx | Show parsed module signals |
| 6 | VerdictCard.jsx | All 7 params + module indicators |
| 7 | Integration polish | Params ref fix + full flow test |
