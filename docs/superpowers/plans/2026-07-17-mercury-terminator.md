# Mercury Terminator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the kernel-tab hero corner's placeholder chrome (dot-sphere, fake sparkline, two static pills) with a WebGL quicksilver Mercury whose day/night terminator is a live gauge of compile state, plus a living legend line.

**Architecture:** Three units with clean boundaries — a pure `frontier.js` (totals→fractions + legend copy, unit-tested), a `useCompileFrontier` hook (subscribes to the observatory bus, tracks sunrise flares), and a `MercuryTerminator.jsx` WebGL component modeled on the existing `ObserverEye.jsx`. `KernelTab.jsx` wires them in on desktop and deletes the retired chrome.

**Tech Stack:** React (hooks), raw WebGL (no react-three-fiber), Vitest, `@testing-library/react`, existing `observatoryBus`.

## Global Constraints

- Test runner: `npm test` (`vitest run`); watch: `npm run test:watch`. Tests colocate in `__tests__/`, import from `'vitest'`.
- Lint: `npm run lint` runs eslint with `--max-warnings 0` — **no unused imports/vars may remain** (removing the pills means removing the now-unused `Shield` import).
- Rendering: **raw WebGL, modeled on `src/terminal/components/ObserverEye.jsx`**. Do NOT introduce react-three-fiber for this object.
- The terminator is a **gauge, not a cycle** — its position is set by compile state; only the surface sheen animates on a timer.
- **Session-scoped**: reads live `observatoryBus` totals; no localStorage; resets to night on reload.
- **Desktop-exclusive**: the mobile 120px dot-sphere (`sphereCanvasMobileRef`) stays untouched. Both status pills are removed on **both** platforms.
- Two-stage mapping invariant: `run ≤ loaded` always, so `day ≤ twilight` always.
- Legend copy is **first-draft, user-tunable** (doctrine lines are always first-draft in this project).
- `N` (corpus size) = `kernelBuilds.length`, already a prop on `KernelTab`.

---

### Task 1: Pure frontier module

**Files:**
- Create: `src/terminal/components/frontier.js`
- Test: `src/terminal/components/__tests__/frontier.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `ease(x: number): number` — concave easing, clamped, `ease(0)=0`, `ease(1)=1`.
  - `frontierFromTotals(totals, N): { twilight: number, day: number, loaded: number, run: number }`
  - `legendLine({ loaded: number, run: number }): string`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/components/__tests__/frontier.test.js
import { describe, it, expect } from 'vitest';
import { ease, frontierFromTotals, legendLine } from '../frontier';

const totals = (kernelsLoaded = {}, ranAliases = {}) => ({
  transmissions: { kernelsLoaded, ranAliases },
});

describe('ease — concave, clamped', () => {
  it('anchors at 0 and 1', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
  it('is concave: small input lifts disproportionately', () => {
    expect(ease(0.25)).toBeCloseTo(0.5, 5);   // sqrt
    expect(ease(0.1)).toBeGreaterThan(0.1);
  });
  it('clamps out-of-range input', () => {
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe('frontierFromTotals', () => {
  it('empty totals → pure night', () => {
    expect(frontierFromTotals(totals(), 16)).toEqual({ twilight: 0, day: 0, loaded: 0, run: 0 });
  });
  it('N<=0 guard → night, never divides by zero', () => {
    expect(frontierFromTotals(totals({ a: 1 }), 0)).toEqual({ twilight: 0, day: 0, loaded: 1, run: 0 });
  });
  it('counts distinct loaded/run and eases the fractions', () => {
    const r = frontierFromTotals(totals({ a: 1, b: 2, c: 1, d: 1 }, ), 16); // 4 loaded, 0 run
    expect(r.loaded).toBe(4);
    expect(r.run).toBe(0);
    expect(r.twilight).toBeCloseTo(0.5, 5);   // sqrt(4/16)
    expect(r.day).toBe(0);
  });
  it('maintains day <= twilight invariant', () => {
    const r = frontierFromTotals(totals({ a: 1, b: 1, c: 1, d: 1 }, { a: 1 }), 16); // 4 loaded, 1 run
    expect(r.day).toBeLessThanOrEqual(r.twilight);
    expect(r.day).toBeCloseTo(0.25, 5);        // sqrt(1/16)
  });
  it('tolerates missing sub-objects', () => {
    expect(frontierFromTotals({}, 16)).toEqual({ twilight: 0, day: 0, loaded: 0, run: 0 });
  });
});

describe('legendLine — the lure', () => {
  it('night when nothing loaded', () => {
    expect(legendLine({ loaded: 0, run: 0 })).toBe('☿ night · no theory yet compiled');
  });
  it('dawn when loaded but not run', () => {
    expect(legendLine({ loaded: 7, run: 0 })).toBe('☿ dawn · 7 loaded, not yet real');
  });
  it('daylight once something has run', () => {
    expect(legendLine({ loaded: 7, run: 3 })).toBe('☿ daylight · 3 burned into knowledge');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/frontier.test.js`
Expected: FAIL — `Failed to resolve import '../frontier'` / functions not defined.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/components/frontier.js
// ── Compile frontier ─────────────────────────────────────────────────────────
// Pure geometry + copy for the Mercury terminator (spec 2026-07-17). The day/night
// frontier is a GAUGE of compile state: distinct kernels loaded push Mercury into
// twilight; distinct kernels that actually ran burn it to full day.

// Concave easing so a few loads read dramatically — no viewer loads all ~43 kernels,
// so ~4-5 loads must visibly dawn the planet. Tunable; sqrt is the starting curve.
export function ease(x) {
  const c = Math.max(0, Math.min(1, x));
  return Math.sqrt(c);
}

export function frontierFromTotals(totals, N) {
  const t = totals?.transmissions ?? {};
  const loaded = Object.keys(t.kernelsLoaded ?? {}).length;
  const run    = Object.keys(t.ranAliases ?? {}).length;
  if (!N || N <= 0) return { twilight: 0, day: 0, loaded, run };
  const twilight = ease(loaded / N);
  const day      = ease(Math.min(run, loaded) / N); // enforce run ≤ loaded invariant
  return { twilight, day, loaded, run };
}

// The legend is a lure, not a manual: it names where meaning lives (the kernels),
// never hands it over. First-draft copy — tune freely.
export function legendLine({ loaded, run }) {
  if (run > 0)    return `☿ daylight · ${run} burned into knowledge`;
  if (loaded > 0) return `☿ dawn · ${loaded} loaded, not yet real`;
  return '☿ night · no theory yet compiled';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/frontier.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/frontier.js src/terminal/components/__tests__/frontier.test.js
git commit -m "feat(mercury): pure compile-frontier math + legend copy"
```

---

### Task 2: useCompileFrontier hook

**Files:**
- Create: `src/terminal/components/useCompileFrontier.js`
- Test: `src/terminal/components/__tests__/useCompileFrontier.test.jsx`

**Interfaces:**
- Consumes: `frontierFromTotals` (Task 1); `subscribe`, `getTotals`, `emit`, `_resetForTests` from `../../observatory/observatoryBus`.
- Produces: `useCompileFrontier(N): { twilight, day, loaded, run, flare }` where `flare = { kind: 'load' | 'run', ts: number } | null`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/terminal/components/__tests__/useCompileFrontier.test.jsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompileFrontier } from '../useCompileFrontier';
import { emit, _resetForTests } from '../../../observatory/observatoryBus';

beforeEach(() => _resetForTests());
afterEach(() => _resetForTests());

describe('useCompileFrontier', () => {
  it('starts at night with no events', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    expect(result.current).toMatchObject({ twilight: 0, day: 0, loaded: 0, run: 0, flare: null });
  });

  it('a kernel_loaded event advances twilight and sets a load flare', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('transmissions', 'kernel_loaded', { kernelId: 'BOSONIC-KERNEL-3.0.0' }));
    expect(result.current.loaded).toBe(1);
    expect(result.current.twilight).toBeGreaterThan(0);
    expect(result.current.day).toBe(0);
    expect(result.current.flare).toMatchObject({ kind: 'load' });
    expect(typeof result.current.flare.ts).toBe('number');
  });

  it('a kernel_completed event advances day and sets a run flare', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('transmissions', 'kernel_loaded', { kernelId: 'bosonic' }));
    act(() => emit('transmissions', 'kernel_completed', { kernelId: 'bosonic' }));
    expect(result.current.run).toBe(1);
    expect(result.current.day).toBeGreaterThan(0);
    expect(result.current.flare).toMatchObject({ kind: 'run' });
  });

  it('ignores non-transmissions events', () => {
    const { result } = renderHook(() => useCompileFrontier(16));
    act(() => emit('gaze', 'sphere_clicked', {}));
    expect(result.current.flare).toBe(null);
    expect(result.current.loaded).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/useCompileFrontier.test.jsx`
Expected: FAIL — cannot resolve `../useCompileFrontier`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/components/useCompileFrontier.js
// ── useCompileFrontier ───────────────────────────────────────────────────────
// Bridges the observatory bus to the Mercury terminator. Recomputes the frontier
// from live totals on every kernel load/run, and exposes a one-shot `flare` (the
// sunrise sweep) tagged load(cyan) vs run(gold). All bus wiring lives here so the
// shader component stays a pure renderer.
import { useEffect, useState } from 'react';
import { subscribe, getTotals } from '../../observatory/observatoryBus';
import { frontierFromTotals } from './frontier';

export function useCompileFrontier(N) {
  const [frontier, setFrontier] = useState(() => frontierFromTotals(getTotals(), N));
  const [flare, setFlare] = useState(null);

  useEffect(() => {
    // Re-read on mount / N change in case events fired before subscribe.
    setFrontier(frontierFromTotals(getTotals(), N));
    return subscribe((evt) => {
      if (evt.category !== 'transmissions') return;
      if (evt.kind === 'kernel_loaded' || evt.kind === 'kernel_completed') {
        setFrontier(frontierFromTotals(getTotals(), N));
        setFlare({ kind: evt.kind === 'kernel_completed' ? 'run' : 'load', ts: evt.ts });
      }
    });
  }, [N]);

  return { ...frontier, flare };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/useCompileFrontier.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/useCompileFrontier.js src/terminal/components/__tests__/useCompileFrontier.test.jsx
git commit -m "feat(mercury): useCompileFrontier hook — bus → frontier + flares"
```

---

### Task 3: MercuryTerminator WebGL component

**Files:**
- Create: `src/terminal/components/MercuryTerminator.jsx`
- Test: `src/terminal/components/__tests__/MercuryTerminator.test.jsx`
- Reference (read, do not edit): `src/terminal/components/ObserverEye.jsx`

**Interfaces:**
- Consumes: numeric props only — pure renderer, no bus knowledge.
- Produces: `<MercuryTerminator twilight={0..1} day={0..1} flare={{kind,ts}|null} size={180} onClick={fn} title="…" />`

**Note on testing:** jsdom has no WebGL, so `getContext('webgl')` returns `null`. The component must guard that (like ObserverEye) and still render its DOM. The unit test is a smoke test (renders a canvas, does not throw); the real judgment is the browser verification in Task 4.

- [ ] **Step 1: Write the failing test**

```jsx
// src/terminal/components/__tests__/MercuryTerminator.test.jsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MercuryTerminator from '../MercuryTerminator';

describe('MercuryTerminator', () => {
  it('renders a canvas without throwing when WebGL is unavailable (jsdom)', () => {
    const { container } = render(
      <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('wires onClick and title', () => {
    let clicked = false;
    const { container, getByTitle } = render(
      <MercuryTerminator twilight={0} day={0} flare={null} size={120}
        onClick={() => { clicked = true; }} title="☿ mercury" />
    );
    expect(getByTitle('☿ mercury')).toBeTruthy();
    container.querySelector('[role="button"]').click();
    expect(clicked).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/MercuryTerminator.test.jsx`
Expected: FAIL — cannot resolve `../MercuryTerminator`.

- [ ] **Step 3: Write the implementation**

```jsx
// src/terminal/components/MercuryTerminator.jsx
// ── MercuryTerminator ────────────────────────────────────────────────────────
// A quicksilver Mercury whose day/night terminator is a GAUGE of compile state
// (spec 2026-07-17). Distinct kernels loaded push the night→twilight frontier;
// distinct kernels run push twilight→full-day. The surface sheen animates on a
// timer (ambient life); the terminator position is meaning, not rotation.
//
// Skeleton mirrors ObserverEye.jsx: full-quad fragment shader, rAF + 40ms watchdog
// (survives suspended-rAF preview panes), DPR sizing, WEBGL_lose_context cleanup,
// reduced-motion snap. Colours echo the eye: cyan/violet twilight, gold/lime day.
import { useEffect, useRef } from 'react';

const CYAN = [0.32, 0.70, 0.95];
const GOLD = [1.0, 0.78, 0.15];

const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
const FS = [
  'precision highp float;varying vec2 v;',
  'uniform float u_t,u_tw,u_day,u_bloom;uniform vec3 u_flareCol;',
  'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.5);return fract(p.x*p.y);}',
  'float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
  ' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
  ' return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
  'float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(.8,.6,-.6,.8);',
  ' for(int i=0;i<5;i++){s+=a*vn(p);p=m*p*2.0;a*=.5;}return s;}',
  'void main(){',
  ' vec2 uv=v;',
  ' float r=length(uv);',
  ' if(r>1.0){',
  '  float halo=smoothstep(1.28,1.0,r)*(0.04+u_bloom*0.32);',
  '  gl_FragColor=vec4(u_flareCol*halo,halo);return;',
  ' }',
  ' float nz=sqrt(max(0.0,1.0-r*r));',
  ' vec3 n=vec3(uv,nz);',
  ' float lon=n.x*0.96+n.y*0.10;',                 // vertical great-circle, slight tilt
  ' float w=0.12;',
  ' float twMask =smoothstep(-w,w,lon+(2.0*u_tw -1.0));',
  ' float dayMask=smoothstep(-w,w,lon+(2.0*u_day-1.0));',
  ' vec2 sp=n.xy*2.4;',
  ' float sheen =fbm(sp+vec2(u_t*0.05,-u_t*0.04));',
  ' float sheen2=fbm(sp*1.8+vec2(2.0)+u_t*0.03);',
  ' vec3 nightCol=vec3(0.05,0.06,0.10);',
  ' vec3 twCol=mix(vec3(0.22,0.55,0.85),vec3(0.42,0.32,0.78),sheen);',
  ' vec3 dayCol=mix(vec3(1.00,0.84,0.0),vec3(0.48,0.72,0.0),sheen2);',
  ' vec3 col=mix(nightCol,twCol,twMask);',
  ' col=mix(col,dayCol,dayMask);',
  ' float spec=pow(0.5+0.5*sin(6.2831*sheen+u_t*0.6),3.0);',
  ' col+=spec*0.18*(0.2+twMask)*vec3(0.80,0.85,0.90);',   // quicksilver specular band
  ' col*=0.55+0.45*nz;',                                   // limb darkening (roundness)
  ' float key=pow(max(0.0,dot(normalize(n),normalize(vec3(-0.4,0.4,0.8)))),2.0);',
  ' col+=key*0.10*(0.3+dayMask);',
  ' col+=u_bloom*0.25*u_flareCol*(0.4+dayMask);',          // transient sunrise bloom
  ' float rim=smoothstep(0.86,1.0,r);',
  ' col+=rim*0.06*u_flareCol;',
  ' float a=smoothstep(1.0,0.985,r);',
  ' gl_FragColor=vec4(col,a);',
  '}'].join('\n');

export default function MercuryTerminator({ twilight = 0, day = 0, flare = null, size = 180, onClick, title, className = '', ariaLabel }) {
  const canvasRef = useRef(null);
  const twRef = useRef(twilight);
  const dayRef = useRef(day);
  const flareRef = useRef(flare);
  const snapRef = useRef(null);
  useEffect(() => {
    twRef.current = twilight; dayRef.current = day; flareRef.current = flare;
    snapRef.current?.();
  }, [twilight, day, flare]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * DPR);
    canvas.height = Math.round(size * DPR);
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) return;

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && import.meta.env?.DEV) {
        console.error('[MercuryTerminator] shader', gl.getShaderInfoLog(s));
      }
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const al = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['u_t','u_tw','u_day','u_bloom','u_flareCol'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const lerp = (a, b, t) => a + (b - a) * t;
    const cur = { tw: twRef.current, day: dayRef.current, bloom: 0, col: CYAN.slice(), lastFlareTs: 0 };

    function render(tsec) {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, tsec);
      gl.uniform1f(U.u_tw, cur.tw);
      gl.uniform1f(U.u_day, cur.day);
      gl.uniform1f(U.u_bloom, cur.bloom);
      gl.uniform3fv(U.u_flareCol, new Float32Array(cur.col));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, wd = 0, running = false, last = performance.now();

    function frame(now) {
      clearTimeout(wd);
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const e = 1 - Math.pow(0.004, dt);
      cur.tw  = lerp(cur.tw,  twRef.current,  e);
      cur.day = lerp(cur.day, dayRef.current, e);
      const f = flareRef.current;
      if (f && f.ts !== cur.lastFlareTs) {
        cur.lastFlareTs = f.ts;
        cur.bloom = 1;
        cur.col = (f.kind === 'run' ? GOLD : CYAN).slice();
      }
      cur.bloom = lerp(cur.bloom, 0, 1 - Math.pow(0.02, dt)); // ~1.5s decay
      render(now / 1000);
      schedule();
    }
    function schedule() {
      raf = requestAnimationFrame(frame);
      wd = setTimeout(() => { cancelAnimationFrame(raf); frame(performance.now()); }, 40);
    }
    function play() { if (running || reduce) return; running = true; last = performance.now(); schedule(); }
    function stop() { running = false; cancelAnimationFrame(raf); clearTimeout(wd); }

    render(0);
    if (!reduce) play();

    // Reduced motion: no swirl, but a state change still snaps the frontier.
    snapRef.current = () => {
      if (!reduce) return;
      cur.tw = twRef.current; cur.day = dayRef.current; cur.bloom = 0;
      render(0);
    };

    return () => {
      stop();
      snapRef.current = null;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    };
  }, [size]);

  return (
    <div
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      title={title}
      style={{ width: size, height: size, position: 'relative', display: 'grid', placeItems: 'center', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/MercuryTerminator.test.jsx`
Expected: PASS (smoke + onClick/title).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/MercuryTerminator.jsx src/terminal/components/__tests__/MercuryTerminator.test.jsx
git commit -m "feat(mercury): MercuryTerminator WebGL component (ObserverEye pattern)"
```

---

### Task 4: Wire into KernelTab + delete retired chrome

**Files:**
- Modify: `src/terminal/views/KernelTab.jsx`

**Interfaces:**
- Consumes: `MercuryTerminator` (Task 3), `useCompileFrontier` (Task 2), `legendLine` (Task 1).
- Produces: the rendered desktop hero corner; no exports change.

**Reference — current relevant lines (numbers approximate; match on content):**
- L3: `import { Database, GitBranch, Shield, Cpu } from 'lucide-react';`
- L138-173: `useLyapunovSparkline` definition
- L222: `const sphereCanvasRef = useRef(null); // desktop`
- L224: `const sparklineCanvasRef = useRef(null);`
- L227: `useMiniSphere(sphereCanvasRef, sphereFireRef);`
- L229: `useLyapunovSparkline(sparklineCanvasRef);`
- L602-605: mobile sphere canvas (KEEP)
- L607-615: mobile pills block (DELETE)
- L616-628: desktop block (sphere canvas + pills → REPLACE)

- [ ] **Step 1: Add imports**

At the top of `src/terminal/views/KernelTab.jsx`, after the existing imports (below the `import { loadSealedArtifact … }` line), add:

```jsx
import MercuryTerminator from '../components/MercuryTerminator';
import { useCompileFrontier } from '../components/useCompileFrontier';
import { legendLine } from '../components/frontier';
```

- [ ] **Step 2: Delete the fake sparkline hook**

Delete the entire `useLyapunovSparkline` function (the block from the `// ── Lyapunov sparkline canvas ──` comment through its closing `}` — currently L138-173).

- [ ] **Step 3: Delete retired refs and hook calls**

Delete these lines:
```jsx
const sphereCanvasRef        = useRef(null); // desktop
```
```jsx
const sparklineCanvasRef     = useRef(null);
```
```jsx
useMiniSphere(sphereCanvasRef,       sphereFireRef);
```
```jsx
useLyapunovSparkline(sparklineCanvasRef);
```
Keep `sphereCanvasMobileRef`, `useMiniSphere(sphereCanvasMobileRef, sphereFireRef)`, `sphereFireRef`.

- [ ] **Step 4: Add the frontier hook near the other hero refs**

Immediately after the `useMiniSphere(sphereCanvasMobileRef, sphereFireRef);` line, add:

```jsx
const { twilight, day, loaded, run, flare } = useCompileFrontier(kernelBuilds.length);
```

- [ ] **Step 5: Delete the mobile pills block**

Delete the mobile badges block (the `{/* Mobile badges … */}` `<div className="flex items-center gap-2 mt-2 flex-wrap md:hidden">…</div>` containing the operational + leviathan pills — currently L607-615). The mobile sphere canvas above it stays.

- [ ] **Step 6: Replace the desktop block**

Replace the desktop block (currently):

```jsx
{/* Desktop: sphere on top, badges below */}
<div className="hidden md:flex flex-col items-end gap-2 shrink-0">
  <canvas ref={sphereCanvasRef} width={180} height={180} style={{ width: 180, height: 180 }} />
  <div className="flex items-center gap-3 flex-wrap justify-end">
    <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,1)]"></div> operational
      <canvas ref={sparklineCanvasRef} width={120} height={24} className="ml-2" style={{ width: 120, height: 24 }} />
    </div>
    <div className="flex items-center gap-2 text-xs border border-[#39ff14]/30 px-3 py-1 bg-green-900/10 text-[#39ff14] rounded-sm shadow-[0_0_6px_rgba(57,255,20,0.15)]">
      <Shield className="w-3 h-3" /> leviathan: active
    </div>
  </div>
</div>
```

with:

```jsx
{/* Desktop: Mercury — the compile frontier — over its living legend line */}
<div className="hidden md:flex flex-col items-end gap-2 shrink-0">
  <MercuryTerminator
    twilight={twilight}
    day={day}
    flare={flare}
    size={180}
    onClick={toMercury}
    title="☿ mercury — the compile frontier"
    ariaLabel="Mercury — the compile frontier; click to open Mercury"
  />
  <div className="font-mono text-[10px] tracking-[0.15em] text-right select-none"
       style={{ color: 'rgba(232,210,138,0.55)' }}>
    {legendLine({ loaded, run })}
  </div>
</div>
```

- [ ] **Step 7: Remove the now-unused `Shield` import**

If `Shield` is no longer referenced anywhere in the file (it was only in the two pills), change L3 to drop it:

```jsx
import { Database, GitBranch, Cpu } from 'lucide-react';
```

Verify first: `git grep -n "Shield" src/terminal/views/KernelTab.jsx` should return no matches after the pill deletions. If it still matches, leave the import.

- [ ] **Step 8: Run the full test suite + lint**

Run: `npm test`
Expected: PASS (existing suite + the three new test files).

Run: `npm run lint`
Expected: no errors, no warnings (confirms no unused `Shield`/refs remain).

- [ ] **Step 9: Browser verification (the real judgment)**

Start the dev server and drive it (this project judges shaders live, not from mocks):

1. `preview_start` with the dev server; open the kernel tab landing page.
2. On cold load, confirm Mercury renders **night** (deep indigo body) and the legend reads `☿ night · no theory yet compiled`.
3. Click a kernel's `[load]` in `active_modules` → confirm a **cyan dawn bloom** sweeps and the legend flips to `☿ dawn · 1 loaded, not yet real`.
4. Click `[run]` on a loaded kernel → confirm a **gold daylight burst** and legend `☿ daylight · 1 burned into knowledge`.
5. Confirm the nav `ObserverEye` (masthead) is unaffected — two distinct objects, no lockstep.
6. `read_console_messages` — no shader-compile or runtime errors.
7. `resize_window` to mobile preset → confirm the 120px dot-sphere still renders and **no pills** appear.
8. `computer {action: "screenshot"}` of the desktop corner for the palette judgment (silver/gold Mercury over the now-pill-less corner, against the cyan/green neighborhood).

If the palette or terminator softness needs tuning, adjust the shader constants in `MercuryTerminator.jsx` (`w` softness, the twilight/day colour vec3s, bloom magnitudes) and the easing curve in `frontier.js` (`ease`), then re-verify from step 2.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/views/KernelTab.jsx
git commit -m "feat(mercury): wire Mercury terminator into kernel hero; retire sparkline + pills"
```

---

## Self-Review

**Spec coverage:**
- §2 gauge-not-cycle → Task 3 shader (terminator from uniforms, only sheen uses `u_t`). ✓
- §3 two-stage mapping + easing + N guard → Task 1. ✓
- §4 fresh-dawn (session-scoped totals) + sunrise flares → Task 2 (bus reads) + Task 3 (bloom). ✓
- §5 living legend line → Task 1 `legendLine` + Task 4 Step 6. ✓
- §6 three units → Tasks 1/2/3; ObserverEye pattern → Task 3. ✓
- §7 raw WebGL, no r3f → Global Constraints + Task 3. ✓
- §8 KernelTab removals/additions → Task 4 (all listed). ✓
- §9 mobile dot-sphere kept, pills removed both platforms → Task 4 Steps 3/5. ✓
- §10 unit + browser tests → Tasks 1-3 unit, Task 4 Step 9 browser. ✓
- §11 non-goals respected (no persistence, no r3f, no nav-eye change, no mobile shader). ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; browser tuning is an explicit iterate-in-place step, not a placeholder. ✓

**Type consistency:** `frontierFromTotals → {twilight,day,loaded,run}` consumed identically by the hook; hook returns `{twilight,day,loaded,run,flare}` consumed by Task 4; `MercuryTerminator` props `{twilight,day,flare,size,onClick,title,ariaLabel}` match Task 4 usage; `flare={kind,ts}` produced by hook, compared by `flare.ts` in the component. ✓
