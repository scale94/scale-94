# Ecocide — Seraphine's Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four PROTECTION_PROTOCOL levers distinct per-lever identities (seal/breathe/grow/knit) and a two-stage collective payoff — Seraphine's scale that levels, then opens its Eye — while wiring NATIVE_BIODIV into the engine as bloom-gated resilience.

**Architecture:** The collapse integrator is left untouched tick-for-tick; NATIVE_BIODIV adds one multiplicative damping term on the existing `damage`. Two focused components are extracted from the 1295-line `EcocideTab.jsx`: `ProtectionLevers` (four pointer-driven identity sliders) and `SeraphineScale` (an absolute overlay in the hero — a beam that rotates by `deadFrac` and an Eye that mounts only during bloom). No new rAF loop: both ride the existing 10 Hz `mapState` re-render; CSS transitions interpolate to 60 fps.

**Tech Stack:** React (hooks, function components), Vite, inline styles + co-located CSS for `@keyframes`, Vitest + jsdom + @testing-library/react, SVG.

## Global Constraints

- **Do NOT alter the collapse integrator's velocity.** With all four levers at 0, `deriveFracs(stepVitalityHybrid(...).v).deadFrac` must reproduce `main` tick-for-tick. Only add a multiplicative term that is 1 when `nativeBio === 0`.
- **Greenwash invariant is sacred.** Protection must heal nothing while growth is high. The degrowth `gate` already enforces this on healing; the new resilience term must be gated on **earned bloom** (`max(0, prevV)`), so it is 0 on any never-bloomed world.
- **Perf-first (option C).** No new `requestAnimationFrame` loop. The world-map SVG stays upright — never transform the 177 country cells. Beam = one composited `transform: rotate`. Eye is unmounted entirely when `bloomFrac <= 0.02`. No `feGaussianBlur`, no `backdrop-filter`, no continuous `filter:` animations (respect the recent mobile repaint-cost work). Halo = one CSS `radial-gradient`.
- **Honor `prefers-reduced-motion: reduce`** — pause lever animations, freeze the beam transition.
- **Keep the existing pointer engine.** Sliders are custom pointer-event tracks (0..1), NOT native `<input type="range">` (the current code works on iPad; native range regresses touch + aesthetic).
- **Palette (ecocide olive-green, verbatim):** `TOXICITY_CAP #5a8ac0`, `SANCTUARY #5fbf3a`, `RESTORATION #3fd06a`, `NATIVE_BIODIV #7fe08a`, beam base `#7ab800`, fulcrum `#3a5008`, dead-track `#0a1400`.
- **Vitest syntax** (`import { describe, it, expect } from 'vitest'`, `.toBe()` / `.toBeCloseTo()` / `.toBeGreaterThan()`). Engine tests live in `src/terminal/lib/__tests__/`.
- **Do not push.** Merge to local `main` only on explicit user command (standing rule).

---

### Task 1: Engine — NATIVE_BIODIV bloom-gated resilience

**Files:**
- Modify: `src/terminal/lib/ecocideEngine.js` (ECO_TUNING block ~L11-34; `stepVitalityHybrid` ~L100-125)
- Test: `src/terminal/lib/__tests__/ecocideEngine.test.js`

**Interfaces:**
- Consumes: existing `stepVitalityHybrid(prevV, levers, dt)` where `levers = { growth, toxicityCap, sanctuary, restoration }`, returns `{ v, extraction, damage, healing, gate }`.
- Produces: same signature, now accepting `levers.nativeBio` (default 0) and a new `ECO_TUNING.RESILIENCE_STRENGTH`. Return shape unchanged. `nativeBio` defaults to 0 so existing callers/tests are unaffected until Task 4 passes it.

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/lib/__tests__/ecocideEngine.test.js`:

```js
import { stepVitalityHybrid, ECO_TUNING } from '../ecocideEngine';

describe('NATIVE_BIODIV resilience — bloom-gated relapse buffer', () => {
  const DT = 0.1;

  it('exposes a modest RESILIENCE_STRENGTH', () => {
    expect(ECO_TUNING.RESILIENCE_STRENGTH).toBeGreaterThan(0);
    expect(ECO_TUNING.RESILIENCE_STRENGTH).toBeLessThanOrEqual(0.5);
  });

  it('greenwash invariant: nativeBio does nothing on a never-bloomed world', () => {
    const prevV = -0.2;               // collapsing, no earned bloom
    const growth = 4.5;               // high extraction, gate closed
    const base = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0, nativeBio: 0 }, DT);
    const maxed = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0, nativeBio: 1 }, DT);
    expect(maxed.v).toBe(base.v);     // identical to the last float
  });

  it('buffers relapse on an established bloom: nativeBio slows the drop', () => {
    const prevV = 0.6;                // substantial earned bloom
    const growth = 5.0;               // re-raised growth forces relapse
    const base = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0, nativeBio: 0 }, DT);
    const buffered = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0, nativeBio: 1 }, DT);
    expect(buffered.v).toBeGreaterThan(base.v);
  });

  it('regression: nativeBio defaulting to 0 matches an omitted key exactly', () => {
    // Guards the default: with nativeBio 0 (or absent) resilience === 1, so the
    // collapse step is identical to main. Pre-existing stepVitalityHybrid tests
    // remain the byte-for-byte pin on main's collapse velocity.
    const prevV = -0.3;
    const growth = 3.0;
    const withField  = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0, nativeBio: 0 }, DT);
    const withoutKey = stepVitalityHybrid(prevV, { growth, toxicityCap: 0, sanctuary: 0, restoration: 0 }, DT); // nativeBio omitted
    expect(withField.v).toBe(withoutKey.v);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js -t "NATIVE_BIODIV resilience"`
Expected: FAIL — `ECO_TUNING.RESILIENCE_STRENGTH` is `undefined`; relapse-buffer test fails (no damping).

- [ ] **Step 3: Add the tuning constant**

In `src/terminal/lib/ecocideEngine.js`, inside the `ECO_TUNING = Object.freeze({ ... })` block, add after `K_HEAL_JS`:

```js
  // NATIVE_BIODIV — diversity resilience. Damps damage in proportion to
  // earned bloom (max(0, prevV)); 0 on any never-bloomed world, so the
  // greenwash invariant holds. Stabilizer, not a second bloom driver.
  RESILIENCE_STRENGTH: 0.3,
```

- [ ] **Step 4: Apply the resilience term in `stepVitalityHybrid`**

Change the destructure line (currently `const { growth, toxicityCap = 0, sanctuary = 0, restoration = 0 } = levers;`) to include `nativeBio`:

```js
  const { growth, toxicityCap = 0, sanctuary = 0, restoration = 0, nativeBio = 0 } = levers;
```

Then, where `damage` is computed and used (currently `const damage = Math.max(0, extraction * ECO_TUNING.K_DAMAGE_JS * toxThrottle - regeneration) * dt;` … `let v = prevV - damage + heal;`), insert the resilience damping between them:

```js
  const damage = Math.max(0, extraction * ECO_TUNING.K_DAMAGE_JS * toxThrottle - regeneration) * dt;

  // NATIVE_BIODIV resilience — gated on earned bloom, not on the growth gate.
  // A world you already healed re-collapses more slowly; a never-bloomed world
  // (prevV <= 0) gets resilience === 1, so nativeBio changes nothing there.
  const bloomFrac   = Math.max(0, prevV);
  const resilience  = 1 - ECO_TUNING.RESILIENCE_STRENGTH * nativeBio * bloomFrac;
  const dampedDamage = damage * resilience;

  const recovery = growth < ECO_TUNING.RECOVERY_GROWTH
    ? ECO_TUNING.RECOVERY_RATE * (1.0 - df) * dt : 0;

  const healing = healingPower(gate, sanctuary, restoration);
  const heal    = ECO_TUNING.K_HEAL_JS * healing * dt;

  let v = prevV - dampedDamage + heal;
```

Leave `recovery`, the `if (v < 0 && recovery > 0)` clamp, the `DEAD_CEIL` clamp, and the `return { v, extraction, damage, healing, gate }` exactly as they are. (Return still reports raw `damage`, not `dampedDamage` — the HUD readouts are unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/terminal/lib/__tests__/ecocideEngine.test.js`
Expected: PASS — all new tests green, all pre-existing ecocideEngine tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lib/ecocideEngine.js src/terminal/lib/__tests__/ecocideEngine.test.js
git commit -m "feat(ecocide): NATIVE_BIODIV bloom-gated resilience term"
```

---

### Task 2: ProtectionLevers component — four identity sliders

**Files:**
- Create: `src/terminal/views/ecocide/ProtectionLevers.jsx`
- Create: `src/terminal/views/ecocide/ProtectionLevers.css`
- Test: `src/terminal/views/ecocide/__tests__/ProtectionLevers.test.jsx`

**Interfaces:**
- Produces: `export function ProtectionLevers({ levers, isGated, onChange })`.
  - `levers`: `{ toxicityCap, sanctuary, restoration, nativeBio }`, each 0..1.
  - `isGated`: boolean — when true, levers are dormant (desaturated, animations paused, pointer disabled).
  - `onChange(key, value)`: `key` ∈ `'toxicityCap'|'sanctuary'|'restoration'|'nativeBio'`, `value` 0..1.
  - Container element carries `data-testid="protection-levers"` and class `is-gated` when `isGated`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/views/ecocide/__tests__/ProtectionLevers.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectionLevers } from '../ProtectionLevers';

const LEVERS = { toxicityCap: 0.6, sanctuary: 0.45, restoration: 0.7, nativeBio: 0.35 };

describe('ProtectionLevers', () => {
  it('renders all four identity levers with their labels', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('TOXICITY_CAP')).toBeTruthy();
    expect(screen.getByText('SANCTUARY')).toBeTruthy();
    expect(screen.getByText('RESTORATION')).toBeTruthy();
    expect(screen.getByText('NATIVE_BIODIV')).toBeTruthy();
  });

  it('shows each lever value as a rounded 0-100 readout', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('60')).toBeTruthy();  // toxicityCap
    expect(screen.getByText('70')).toBeTruthy();  // restoration
  });

  it('marks the container gated when isGated is true', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={true} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).toContain('is-gated');
  });

  it('is not gated when isGated is false', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).not.toContain('is-gated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/views/ecocide/__tests__/ProtectionLevers.test.jsx`
Expected: FAIL — cannot resolve `../ProtectionLevers`.

- [ ] **Step 3: Write the CSS (keyframes + static structure)**

Create `src/terminal/views/ecocide/ProtectionLevers.css`. No `backdrop-filter`, no continuous `filter:` animations — transform/opacity/background-position only:

```css
.pl-wrap { display:flex; flex-direction:column; gap:8px; }
.pl-row { display:flex; align-items:center; gap:10px; transition:opacity .4s, filter .4s; }
.pl-label { flex-shrink:0; width:110px; font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
.pl-track { flex:1; height:22px; position:relative; background:#0a1400; border-radius:2px; overflow:hidden; cursor:pointer; touch-action:none; user-select:none; }
.pl-val { width:26px; text-align:right; flex-shrink:0; font-size:11px; font-weight:800; }

/* gated: dormant, paused, uninteractive */
.pl-wrap.is-gated .pl-row { opacity:.4; filter:grayscale(100%); }
.pl-wrap.is-gated .pl-track { pointer-events:none; cursor:not-allowed; }
.pl-wrap.is-gated * { animation-play-state:paused !important; }

/* one-shot ignition flare when the gate opens */
.pl-wrap.pl-ignite .pl-row { animation:pl-flare .8s ease-out 1; }
@keyframes pl-flare { 0%{filter:brightness(1);} 45%{filter:brightness(1.7);} 100%{filter:brightness(1);} }

/* SEAL — churning poison sealed behind a membrane */
.pl-tox-poison { position:absolute; inset:0; background:linear-gradient(90deg,#3a0a2a,#5a1a0a,#2a0a3a,#5a1a0a,#3a0a2a); background-size:200% 100%; animation:pl-toxchurn 3.4s linear infinite; opacity:.85; }
@keyframes pl-toxchurn { to { background-position:200% 0; } }
.pl-tox-membrane { position:absolute; top:0; bottom:0; left:0; background:linear-gradient(90deg,rgba(90,138,192,.34),rgba(90,138,192,.22)); border-right:1.5px solid #7fb0e0; box-shadow:inset 0 0 12px rgba(120,170,220,.25); animation:pl-membwob 4.5s ease-in-out infinite; }
@keyframes pl-membwob { 0%,100%{ transform:translateX(0);} 50%{ transform:translateX(1.5px);} }

/* BREATHE — slow respiration (opacity, not filter) + exhaling ring */
.pl-sanc-fill { position:absolute; top:0; bottom:0; left:0; background:linear-gradient(90deg,#1a4a10,#5fbf3a); border-radius:2px; animation:pl-breathe 5.2s ease-in-out infinite; }
@keyframes pl-breathe { 0%,100%{ opacity:.78; box-shadow:0 0 4px #5fbf3a44;} 50%{ opacity:1; box-shadow:0 0 14px #5fbf3a99;} }
.pl-sanc-ring { position:absolute; top:50%; width:10px; height:10px; border:1px solid #5fbf3a; border-radius:50%; transform:translate(-50%,-50%); animation:pl-sancring 5.2s ease-out infinite; }
@keyframes pl-sancring { 0%{ transform:translate(-50%,-50%) scale(.4); opacity:.9;} 70%,100%{ transform:translate(-50%,-50%) scale(3.2); opacity:0;} }

/* GROW — eager sprouting tendrils (stroke-dashoffset) */
.pl-rest-fill { position:absolute; top:0; bottom:0; left:0; overflow:hidden; border-radius:2px; background:linear-gradient(90deg,#0a3a12,#3fd06a); }
.pl-rest-svg { position:absolute; inset:0; width:100%; height:100%; }
.pl-rest-svg path { stroke:#9fffb0; stroke-width:1; fill:none; stroke-dasharray:40; stroke-dashoffset:40; opacity:.75; animation:pl-sprout 2.6s ease-out infinite; }
.pl-rest-svg path:nth-child(2){animation-delay:.5s;} .pl-rest-svg path:nth-child(3){animation-delay:1s;} .pl-rest-svg path:nth-child(4){animation-delay:1.6s;}
@keyframes pl-sprout { 0%{ stroke-dashoffset:40; opacity:0;} 25%{opacity:.85;} 100%{ stroke-dashoffset:0; opacity:0;} }

/* KNIT — crystalline mesh, nodes stepping */
.pl-nat-fill { position:absolute; top:0; bottom:0; left:0; overflow:hidden; border-radius:2px; background:linear-gradient(90deg,#123a1a,rgba(127,224,138,.18)); }
.pl-nat-svg { position:absolute; inset:0; width:100%; height:100%; }
.pl-nat-svg line { stroke:#7fe08a; stroke-width:.6; opacity:.35; }
.pl-nat-svg circle { fill:#aef0b8; animation:pl-node 3.2s ease-in-out infinite; }
@keyframes pl-node { 0%,100%{ opacity:.25;} 50%{ opacity:1;} }

@media (prefers-reduced-motion: reduce) {
  .pl-wrap * { animation:none !important; }
}
```

- [ ] **Step 4: Write the component**

Create `src/terminal/views/ecocide/ProtectionLevers.jsx`:

```jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import './ProtectionLevers.css';

// Shared pointer engine — custom track works on iPad (native range does not).
function useLeverPointer(onChange, disabled) {
  const trackRef = useRef(null);
  const valueFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);
  const handlePointer = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    onChange(valueFromEvent(e));
    const move = (me) => { me.preventDefault(); onChange(valueFromEvent(me)); };
    const up   = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
  }, [disabled, onChange, valueFromEvent]);
  return { trackRef, handlePointer };
}

function LeverRow({ label, color, value, disabled, onChange, children }) {
  const { trackRef, handlePointer } = useLeverPointer(onChange, disabled);
  const pct = value * 100;
  return (
    <div className="pl-row">
      <span className="pl-label" style={{ color }}>{label}</span>
      <div className="pl-track" ref={trackRef} onPointerDown={handlePointer}>
        {children(pct)}
      </div>
      <span className="pl-val" style={{ color }}>{Math.round(pct)}</span>
    </div>
  );
}

const TENDRILS = 'M20 22 Q30 12 44 6 M55 22 Q60 10 72 4 M90 22 Q98 13 110 5 M120 22 Q126 9 134 3';
const MESH_LINES = [[10,4,30,18],[30,18,50,4],[50,4,70,18],[10,18,30,4],[30,4,50,18],[50,18,70,4]];
const MESH_NODES = [[10,4],[30,18],[50,4],[70,18],[30,4],[50,18]];

export function ProtectionLevers({ levers, isGated, onChange }) {
  const [ignite, setIgnite] = useState(false);
  const prevGated = useRef(isGated);
  useEffect(() => {
    if (prevGated.current && !isGated) {        // gate just opened → ignite once
      setIgnite(true);
      const t = setTimeout(() => setIgnite(false), 800);
      return () => clearTimeout(t);
    }
    prevGated.current = isGated;
  }, [isGated]);

  const wrapClass = `pl-wrap${isGated ? ' is-gated' : ''}${ignite ? ' pl-ignite' : ''}`;

  return (
    <div className={wrapClass} data-testid="protection-levers">
      <LeverRow label="TOXICITY_CAP" color="#5a8ac0" value={levers.toxicityCap} disabled={isGated} onChange={(v) => onChange('toxicityCap', v)}>
        {(pct) => (<>
          <div className="pl-tox-poison" />
          <div className="pl-tox-membrane" style={{ width: `${pct}%` }} />
        </>)}
      </LeverRow>

      <LeverRow label="SANCTUARY" color="#5fbf3a" value={levers.sanctuary} disabled={isGated} onChange={(v) => onChange('sanctuary', v)}>
        {(pct) => (<>
          <div className="pl-sanc-fill" style={{ width: `${pct}%` }} />
          <div className="pl-sanc-ring" style={{ left: `${pct}%` }} />
        </>)}
      </LeverRow>

      <LeverRow label="RESTORATION" color="#3fd06a" value={levers.restoration} disabled={isGated} onChange={(v) => onChange('restoration', v)}>
        {(pct) => (
          <div className="pl-rest-fill" style={{ width: `${pct}%` }}>
            <svg className="pl-rest-svg" viewBox="0 0 200 22" preserveAspectRatio="none">
              {TENDRILS.split('M').filter(Boolean).map((seg, i) => <path key={i} d={`M${seg}`} />)}
            </svg>
          </div>
        )}
      </LeverRow>

      <LeverRow label="NATIVE_BIODIV" color="#7fe08a" value={levers.nativeBio} disabled={isGated} onChange={(v) => onChange('nativeBio', v)}>
        {(pct) => (
          <div className="pl-nat-fill" style={{ width: `${pct}%` }}>
            <svg className="pl-nat-svg" viewBox="0 0 200 22" preserveAspectRatio="none">
              {MESH_LINES.map(([x1,y1,x2,y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
              {MESH_NODES.map(([cx,cy], i) => <circle key={i} cx={cx} cy={cy} r="1" style={{ animationDelay: `${i * 0.4}s` }} />)}
            </svg>
          </div>
        )}
      </LeverRow>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/views/ecocide/__tests__/ProtectionLevers.test.jsx`
Expected: PASS — all four render/gated tests green.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ecocide/ProtectionLevers.jsx src/terminal/views/ecocide/ProtectionLevers.css src/terminal/views/ecocide/__tests__/ProtectionLevers.test.jsx
git commit -m "feat(ecocide): ProtectionLevers — four identity sliders (seal/breathe/grow/knit)"
```

---

### Task 3: SeraphineScale component — beam cradle + Eye + halo

**Files:**
- Create: `src/terminal/views/ecocide/SeraphineScale.jsx`
- Create: `src/terminal/views/ecocide/SeraphineScale.css`
- Test: `src/terminal/views/ecocide/__tests__/SeraphineScale.test.jsx`

**Interfaces:**
- Produces: `export default function SeraphineScale({ deadFrac, bloomFrac })`.
  - `deadFrac` 0..~0.98 → beam tilt (rotate `deadFrac * MAX_TILT_DEG`, capped at 1). `deadFrac` already equals `max(0,-vitality)` in `mapState`, so no over-tip is possible.
  - `bloomFrac` 0..1 → grace. The Eye (`data-testid="seraphine-eye"`) renders only when `bloomFrac > 0.02`; halo opacity + iris scale track `bloomFrac`.
  - Renders as an `absolute inset-0 pointer-events-none` overlay meant to sit inside the hero's existing `position:relative` container. Beam group carries `data-testid="seraphine-beam"`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/views/ecocide/__tests__/SeraphineScale.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeraphineScale from '../SeraphineScale';

describe('SeraphineScale', () => {
  it('does not mount the Eye during pure collapse (bloomFrac <= 0.02)', () => {
    render(<SeraphineScale deadFrac={0.7} bloomFrac={0} />);
    expect(screen.queryByTestId('seraphine-eye')).toBeNull();
  });

  it('mounts the Eye once bloom crosses the threshold', () => {
    render(<SeraphineScale deadFrac={0} bloomFrac={0.5} />);
    expect(screen.queryByTestId('seraphine-eye')).not.toBeNull();
  });

  it('rotates the beam in proportion to deadFrac', () => {
    render(<SeraphineScale deadFrac={0.5} bloomFrac={0} />);
    const beam = screen.getByTestId('seraphine-beam');
    // 0.5 * 10deg = 5deg
    expect(beam.getAttribute('style')).toContain('rotate(5deg)');
  });

  it('holds the beam level at homeostasis / bloom (deadFrac 0)', () => {
    render(<SeraphineScale deadFrac={0} bloomFrac={0.3} />);
    const beam = screen.getByTestId('seraphine-beam');
    expect(beam.getAttribute('style')).toContain('rotate(0deg)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/views/ecocide/__tests__/SeraphineScale.test.jsx`
Expected: FAIL — cannot resolve `../SeraphineScale`.

- [ ] **Step 3: Write the CSS**

Create `src/terminal/views/ecocide/SeraphineScale.css` (no blur filters; halo is a radial-gradient):

```css
.ss-overlay { position:absolute; inset:0; pointer-events:none; z-index:5; }

.ss-beam { position:absolute; left:50%; bottom:9%; width:56%; max-width:420px; transform-origin:center bottom; transition:transform .3s cubic-bezier(0.16,1,0.3,1); will-change:transform; }
.ss-beam svg { width:100%; height:auto; display:block; }

.ss-eye { position:absolute; left:50%; top:5%; transform:translateX(-50%); width:64px; height:40px; transition:opacity .3s ease-out; will-change:opacity; }
.ss-eye svg { width:100%; height:100%; overflow:visible; }
.ss-eye .ss-lid { fill:#000; transition:transform .3s ease-out; transform-origin:center; }
.ss-eye .ss-iris { fill:#7fe08a; transition:transform .3s ease-out; transform-origin:center; }
.ss-halo { position:absolute; left:50%; top:2%; transform:translateX(-50%); width:150px; height:60px; background:radial-gradient(ellipse at 50% 100%, rgba(127,224,138,.30), rgba(127,224,138,0) 70%); transition:opacity .3s ease-out; }

@media (prefers-reduced-motion: reduce) {
  .ss-beam, .ss-eye, .ss-eye .ss-lid, .ss-eye .ss-iris, .ss-halo { transition:none; }
}
```

- [ ] **Step 4: Write the component**

Create `src/terminal/views/ecocide/SeraphineScale.jsx`:

```jsx
import './SeraphineScale.css';

const MAX_TILT_DEG = 10;

export default function SeraphineScale({ deadFrac = 0, bloomFrac = 0 }) {
  const tilt  = Math.min(Math.max(deadFrac, 0), 1);   // == max(0,-vitality), capped
  const grace = Math.min(Math.max(bloomFrac, 0), 1);
  const showEye = grace > 0.02;

  // Beam base green lifts toward superbloom green as grace rises.
  const beamStroke = grace > 0 ? '#7fe08a' : '#7ab800';

  return (
    <div className="ss-overlay">
      {/* whisper of halo, behind the Eye */}
      {showEye && <div className="ss-halo" style={{ opacity: grace }} />}

      {/* the Eye — mounts only during bloom */}
      {showEye && (
        <div className="ss-eye" data-testid="seraphine-eye" style={{ opacity: Math.min(grace * 1.5, 1) }}>
          <svg viewBox="0 0 64 40">
            <ellipse cx="32" cy="20" rx="24" ry="13" fill="none" stroke="#3a5a08" strokeWidth="1" />
            <circle className="ss-iris" cx="32" cy="20" r="6.5" style={{ transform: `scale(${0.5 + grace * 0.5})` }} />
            {/* lid retracts (scaleY → 0) as grace opens the eye */}
            <rect className="ss-lid" x="6" y="5" width="52" height="30" style={{ transform: `scaleY(${1 - Math.min(grace, 1)})` }} />
          </svg>
        </div>
      )}

      {/* the beam — one composited rotation; cradles the sphere base */}
      <div className="ss-beam" data-testid="seraphine-beam" style={{ transform: `translateX(-50%) rotate(${tilt * MAX_TILT_DEG}deg)` }}>
        <svg viewBox="0 0 400 40">
          <path d="M 10 12 Q 200 34 390 12" fill="none" stroke={beamStroke} strokeWidth="2" style={{ transition: 'stroke .6s ease' }} />
          <polygon points="192,34 208,34 200,22" fill="#3a5008" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/views/ecocide/__tests__/SeraphineScale.test.jsx`
Expected: PASS — Eye mount gating + beam rotation tests green.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ecocide/SeraphineScale.jsx src/terminal/views/ecocide/SeraphineScale.css src/terminal/views/ecocide/__tests__/SeraphineScale.test.jsx
git commit -m "feat(ecocide): SeraphineScale — beam cradle + witnessing Eye + halo"
```

---

### Task 4: Integrate ProtectionLevers + wire NATIVE_BIODIV into the engine call

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx` — the `stepVitalityHybrid` call (~L398-406), the PROTECTION_PROTOCOL render block (~L1123-1135), the `ProtocolSlider` definition (~L282-310), imports (~L38-47).

**Interfaces:**
- Consumes: `ProtectionLevers` from Task 2; `stepVitalityHybrid` accepting `nativeBio` from Task 1.
- Produces: no new exports. `nativeBio` now feeds the simulation; the four levers render via the new component.

- [ ] **Step 1: Wire `nativeBio` into the simulation tick**

In `src/terminal/views/EcocideTab.jsx`, the `stepVitalityHybrid` call currently reads:

```jsx
      const stepped = stepVitalityHybrid(vitalityRef.current, {
        growth:      gr,
        toxicityCap: toxicityCapRef.current,
        sanctuary:   sanctuaryRef.current,
        restoration: restorationRef.current,
      }, WASM_DT);
```

Add the `nativeBio` line:

```jsx
      const stepped = stepVitalityHybrid(vitalityRef.current, {
        growth:      gr,
        toxicityCap: toxicityCapRef.current,
        sanctuary:   sanctuaryRef.current,
        restoration: restorationRef.current,
        nativeBio:   nativeBioRef.current,
      }, WASM_DT);
```

- [ ] **Step 2: Import ProtectionLevers**

Near the other view imports at the top of `EcocideTab.jsx` (after the `stepVitalityHybrid` import line), add:

```jsx
import { ProtectionLevers } from './ecocide/ProtectionLevers';
```

- [ ] **Step 3: Replace the four ProtocolSlider rows with ProtectionLevers**

In the PROTECTION_PROTOCOL block, replace the four `<ProtocolSlider ... />` lines (inside `{protocolOpen && (...)}`, after the GATE CLOSED note) with:

```jsx
            <ProtectionLevers
              levers={{ toxicityCap, sanctuary, restoration, nativeBio }}
              isGated={growthRate >= 3.0}
              onChange={(key, val) => {
                if (key === 'toxicityCap')      setToxicityCap(val);
                else if (key === 'sanctuary')   setSanctuary(val);
                else if (key === 'restoration') setRestoration(val);
                else if (key === 'nativeBio')   setNativeBio(val);
              }}
            />
```

Leave the surrounding collapsible button, the `GATE CLOSED` note, and the `● armed` indicator untouched.

- [ ] **Step 4: Delete the now-unused ProtocolSlider definition**

Remove the entire `function ProtocolSlider({ ... }) { ... }` definition (~L282-310) and its `// ── ProtocolSlider …` banner comment. Leave `GrowthSlider` (still used for the growth mandate) in place.

- [ ] **Step 5: Verify the suite still passes**

Run: `npx vitest run`
Expected: PASS — full suite (581+) green; no references to the deleted `ProtocolSlider` remain.

- [ ] **Step 6: Browser-verify the levers + gate/ignite**

Start the dev server and open the Ecocide tab. Confirm: (a) with growth ≥ 3.0 the levers are dormant/desaturated and won't drag; (b) lowering growth below the gate ignites them (one-shot flare) and they become draggable; (c) the four identities animate distinctly (poison seals, sanctuary breathes, restoration sprouts, native knits); (d) dragging `NATIVE_BIODIV` on an already-bloomed world visibly slows relapse when growth is re-raised. Capture a screenshot of the active levers.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): wire NATIVE_BIODIV + swap PROTECTION_PROTOCOL to identity levers"
```

---

### Task 5: Mount SeraphineScale in the hero + final verification

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx` — the hero container (~L732, `<div className="relative w-full overflow-hidden" ...>`) and imports.

**Interfaces:**
- Consumes: `SeraphineScale` from Task 3; `mapState.deadFrac` and `mapState.bloomFrac` (already in state).
- Produces: the collective payoff overlay, live in the tab.

- [ ] **Step 1: Import SeraphineScale**

Near the `ProtectionLevers` import added in Task 4, add:

```jsx
import SeraphineScale from './ecocide/SeraphineScale';
```

- [ ] **Step 2: Mount the overlay inside the hero container**

The hero is the `position:relative` block that holds the world-map `<svg>`, the radial vignette, the paradox overlay, and the SARG readout. As the **last child** of that container (after the vignette div, before the container closes), add:

```jsx
        <SeraphineScale deadFrac={mapState.deadFrac} bloomFrac={mapState.bloomFrac} />
```

Do not wrap or move the existing map SVG — `SeraphineScale` is a sibling overlay (`absolute inset-0 pointer-events-none`), so the 177-cell layer stays upright and untouched.

- [ ] **Step 3: Verify the suite still passes**

Run: `npx vitest run`
Expected: PASS — full suite green.

- [ ] **Step 4: Browser-verify both directions**

With the dev server running on the Ecocide tab:
- **Collapse direction:** raise growth; confirm the beam tilts toward the collapse side as `deadFrac` rises, the map fractures as before (unchanged), and no Eye appears.
- **Heal direction:** tame growth below the gate, fund SANCTUARY + RESTORATION; confirm the beam swings to level as the world recovers, then the **Eye opens** with a whisper of halo once `bloomFrac > 0.02`, and pushing further into bloom holds the beam level (no reverse-tilt).
Capture a screenshot of the leveled beam + open Eye.

- [ ] **Step 5: Mobile-perf sanity pass**

In the browser devtools, throttle to a mobile profile and confirm during pure collapse (no bloom) there is **no** Eye in the DOM, the beam is a single transformed element, and there is no new `requestAnimationFrame` loop or SVG blur filter attributable to this feature. Confirm `prefers-reduced-motion` freezes the beam transition and lever animations.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): mount SeraphineScale overlay in the hero (perf-first, map upright)"
```

---

## Notes for the implementer

- **`nativeBio` state already exists** in `EcocideTab.jsx` (`const [nativeBio, setNativeBio] = useState(0.0)` and `nativeBioRef`, kept in sync via `useEffect`). Task 4 only needs to *pass* it — do not re-declare it.
- **`deadFrac`/`bloomFrac` are already in `mapState`** (set each 10 Hz tick). SeraphineScale needs no new state wiring — this is why there are no `deriveBeamTilt`/`deriveGraceLevel` exports: `deadFrac` already equals the tilt and `bloomFrac` already equals grace, so separate helpers would be dead code (YAGNI). Over-tip is structurally impossible because `deadFrac` and `bloomFrac` are the two mutually-exclusive halves of signed vitality.
- **Do not touch** the observatory `PHASE_NAME` contract, the collapse thresholds, or the double-bind / viral-timeline logic.
