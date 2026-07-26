# Shared GL Harness — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated WebGL renderer skeleton out of `ObserverEye`, `MercuryTerminator`, and `LunarShaderMoon` into one shared harness, with zero behavior change, proved by GL call-log snapshots captured before the refactor begins.

**Architecture:** Two pure modules (`glHost.js` for context/program/quad/teardown, `frameLoop.js` for rAF/watchdog/reduced-motion/visibility) composed by a `useShaderCanvas` hook that owns the `useEffect`. Components keep their own JSX and their own per-frame easing, which moves verbatim into a `draw` callback. Every current divergence between the three renderers survives as a named flag; deleting those flags is phase 2, not this plan.

**Tech Stack:** React 18, Vite, Vitest + jsdom + @testing-library/react, WebGL1 and WebGL2, no new dependencies.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-26-shared-gl-harness-design.md`. Read it before Task 1.
- **Zero behavior change.** No shader source may be edited. No visual may change. If a change seems necessary, stop and ask — it belongs in phase 2.
- **Never run Vitest with `-u` / `--update` after Task 2.** Snapshots are the compliance gate. A failing snapshot is a finding, not a chore.
- **The frame loop always schedules the next rAF at the top of the frame, before invoking `onFrame`.** The moon's idle throttle early-returns before `drawArrays`; bottom-scheduling would starve the loop permanently.
- **Float determinism depends on `dt` being computed with the same operations in the same order as the code being replaced.** That is why dt policy is a flag, not something normalized away.
- New files live in `src/terminal/gl/`. Tests in `src/terminal/gl/__tests__/`.
- Test command: `npx vitest run <path>`. Full suite: `npx vitest run`. Baseline is 766 passing.
- Commit after every task. Do not squash.

## Two amendments to the spec

Both were found while mapping init sequences. The spec says "goldens byte-identical for all three"; that is achievable for the frame loop and **not** for init.

**1. Init order genuinely differs and cannot be unified without over-fitting.**
The eye builds its program, activates it, then sets up the quad. The moon builds its program, sizes the canvas, sets up the quad, runs a bake pass, and only then activates the main program. These are different sequences, not different values. Reproducing both byte-for-byte would mean parameterizing the entire setup order.

Resolution: snapshots are **split into `init` and `frames`**. The `frames` snapshot is held to byte-equality — that is where visual regressions live. The `init` snapshot is reviewed as a diff: the reviewer must read every moved call and confirm it is order-independent (a `getUniformLocation` moving relative to a `bindBuffer` is fine; a `viewport` moving before canvas sizing is not).

**2. `onError` widens into `strategy` and absorbs four correlated differences.**
Beyond throw-vs-warn, the two families also differ in build order (`createProgram` before vs. after compilation), whether `deleteShader` is called after attach (lunar yes, legacy no), and whether link status is checked at all (legacy no). These four always co-occur — they are two whole setup strategies, not four independent knobs.

Resolution: one flag `strategy: 'legacy' | 'lunar'`, documented as a bundle. The knob count stays at **13**; flag 4 is renamed and widened.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/gl/glHost.js` | Context creation, program build, fullscreen quad, uniform harvesting, DPR sizing, blend, teardown. No React, no rAF. |
| `src/terminal/gl/frameLoop.js` | rAF scheduling, watchdog, dt policy, reduced-motion policy, visibility tracking. No React, no GL. |
| `src/terminal/gl/useShaderCanvas.js` | Composes the two, owns the `useEffect`, returns `{ snap }`. |
| `src/terminal/gl/__tests__/recordingGL.js` | Stub GL covering both WebGL1 and WebGL2 call surfaces; records every call with tagged, human-readable arguments. |
| `src/terminal/gl/__tests__/driveFrames.js` | Fake-timer driver: mount, advance N frames deterministically, split the log into `init` and `frames`. |
| `src/terminal/gl/__tests__/glParity.test.jsx` | The compliance gate. One `init` and one `frames` snapshot per component. |
| `src/terminal/gl/__tests__/glHost.test.js` | Unit tests for `glHost`. |
| `src/terminal/gl/__tests__/frameLoop.test.js` | Unit tests for `frameLoop`, including the top-scheduling constraint. |
| `src/terminal/gl/__tests__/teardown.test.jsx` | Listener balance and dispose completeness, generalized to all three components. |
| `src/terminal/components/MercuryTerminator.jsx` | Modified: keeps shader source, JSX, easing; loses the effect skeleton. |
| `src/terminal/lunar/LunarShaderMoon.jsx` | Modified: same, plus bake pass moves into `onInit`. |
| `src/terminal/components/ObserverEye.jsx` | Modified: same, plus keeps its SVG lens wrapper. |
| `src/terminal/lunar/glContext.js` | Deleted in Task 7 once the moon no longer imports it. |

---

## Task 1: Recording GL stub and deterministic frame driver

**Files:**
- Create: `src/terminal/gl/__tests__/recordingGL.js`
- Create: `src/terminal/gl/__tests__/driveFrames.js`
- Test: `src/terminal/gl/__tests__/recordingGL.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createRecordingGL({ version }) → glStub` where `glStub.__log` is `Array<[string, ...args]>`
  - `installRecordingGL({ version }) → { log, restore }` — patches `HTMLCanvasElement.prototype.getContext`
  - `driveFrames(renderFn, { frames, stepMs, version }) → { init: string[], frames: string[] }`

The tagging is load-bearing. `getUniformLocation(prog, 'u_t')` must return `{ __tag: 'uniform:u_t' }` so a dropped or swapped uniform is visible in the log. Untagged object identities all serialize to `{}` and would hide exactly the bug this test exists to catch.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/gl/__tests__/recordingGL.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest';
import { createRecordingGL, installRecordingGL } from './recordingGL';

describe('recordingGL', () => {
  it('records calls in order with tagged handles', () => {
    const gl = createRecordingGL({ version: 1 });
    const p = gl.createProgram();
    const u = gl.getUniformLocation(p, 'u_time');
    gl.uniform1f(u, 0.5);
    expect(gl.__log).toEqual([
      ['createProgram'],
      ['getUniformLocation', 'program:0', 'u_time'],
      ['uniform1f', 'uniform:u_time', 0.5],
    ]);
  });

  it('hashes shader source instead of inlining it', () => {
    const gl = createRecordingGL({ version: 1 });
    const s = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(s, 'void main(){}');
    const entry = gl.__log.find(e => e[0] === 'shaderSource');
    expect(entry[2]).toMatch(/^src:13:[0-9a-f]{8}$/);
  });

  it('expands typed arrays to plain arrays', () => {
    const gl = createRecordingGL({ version: 1 });
    gl.uniform3fv({ __tag: 'uniform:c0' }, new Float32Array([1, 0, 0.5]));
    expect(gl.__log[0]).toEqual(['uniform3fv', 'uniform:c0', [1, 0, 0.5]]);
  });

  it('exposes webgl2-only methods only at version 2', () => {
    expect(createRecordingGL({ version: 1 }).createVertexArray).toBeUndefined();
    expect(createRecordingGL({ version: 2 }).createVertexArray).toBeTypeOf('function');
  });

  it('installRecordingGL intercepts the requested context type', () => {
    const { log, restore } = installRecordingGL({ version: 2 });
    const gl = document.createElement('canvas').getContext('webgl2');
    gl.createProgram();
    expect(log).toEqual([['createProgram']]);
    restore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGL.test.js`
Expected: FAIL — `Failed to resolve import "./recordingGL"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/gl/__tests__/recordingGL.js`:

```js
// recordingGL.js — a stub WebGL context that records every call.
//
// Handles are tagged so the log is readable and, more importantly, so a
// swapped or dropped uniform is visible. An untagged {} serialises the same
// for every uniform, which would hide the exact class of bug these snapshots
// exist to catch.

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const CONSTANTS = {
  VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88e4, FLOAT: 0x1406,
  TRIANGLE_STRIP: 0x0005, COLOR_BUFFER_BIT: 0x4000,
  BLEND: 0x0be2, DEPTH_TEST: 0x0b71,
  SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303, ONE: 1,
  TEXTURE_2D: 0x0de1, TEXTURE0: 0x84c0, RGBA: 0x1908, RGBA8: 0x8058,
  UNSIGNED_BYTE: 0x1401, LINEAR: 0x2601, REPEAT: 0x2901,
  CLAMP_TO_EDGE: 0x812f,
  TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
  FRAMEBUFFER: 0x8d40, COLOR_ATTACHMENT0: 0x8ce0,
};

const V1_METHODS = [
  'createShader', 'shaderSource', 'compileShader', 'getShaderParameter',
  'getShaderInfoLog', 'deleteShader',
  'createProgram', 'attachShader', 'linkProgram', 'getProgramParameter',
  'getProgramInfoLog', 'deleteProgram', 'useProgram',
  'createBuffer', 'bindBuffer', 'bufferData', 'deleteBuffer',
  'getAttribLocation', 'enableVertexAttribArray', 'vertexAttribPointer',
  'getUniformLocation',
  'uniform1f', 'uniform1i', 'uniform2f', 'uniform2fv', 'uniform3fv',
  'enable', 'disable', 'blendFunc', 'viewport',
  'clearColor', 'clear', 'drawArrays',
  'createTexture', 'bindTexture', 'texImage2D', 'texParameteri',
  'activeTexture', 'deleteTexture',
  'createFramebuffer', 'bindFramebuffer', 'framebufferTexture2D',
  'deleteFramebuffer',
  'getExtension',
];

const V2_ONLY = ['createVertexArray', 'bindVertexArray', 'deleteVertexArray', 'texStorage2D'];

export function createRecordingGL({ version = 2 } = {}) {
  const log = [];
  let seq = 0;
  const gl = { ...CONSTANTS, __log: log, __version: version };

  const tag = (kind) => ({ __tag: `${kind}:${seq++}` });

  const norm = (v) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'object') {
      if (v.__tag) return v.__tag;
      if (ArrayBuffer.isView(v)) return Array.from(v);
      return '<obj>';
    }
    return v;
  };

  const methods = version === 2 ? [...V1_METHODS, ...V2_ONLY] : V1_METHODS;
  for (const name of methods) {
    gl[name] = (...args) => { log.push([name, ...args.map(norm)]); };
  }

  // Overrides: anything that must return a usable value.
  gl.createShader   = (type) => { log.push(['createShader', type]); return tag('shader'); };
  gl.createProgram  = () => { log.push(['createProgram']); return tag('program'); };
  gl.createBuffer   = () => { log.push(['createBuffer']); return tag('buffer'); };
  gl.createTexture  = () => { log.push(['createTexture']); return tag('texture'); };
  gl.createFramebuffer = () => { log.push(['createFramebuffer']); return tag('fbo'); };
  gl.getAttribLocation = (p, n) => { log.push(['getAttribLocation', norm(p), n]); return 0; };
  gl.getUniformLocation = (p, n) => {
    log.push(['getUniformLocation', norm(p), n]);
    return { __tag: `uniform:${n}` };
  };
  gl.getShaderParameter  = (s, p) => { log.push(['getShaderParameter', norm(s), p]); return true; };
  gl.getProgramParameter = (p, k) => { log.push(['getProgramParameter', norm(p), k]); return true; };
  gl.getShaderInfoLog  = (s) => { log.push(['getShaderInfoLog', norm(s)]); return ''; };
  gl.getProgramInfoLog = (p) => { log.push(['getProgramInfoLog', norm(p)]); return ''; };
  gl.shaderSource = (s, src) => {
    log.push(['shaderSource', norm(s), `src:${src.length}:${fnv1a(src)}`]);
  };
  gl.getExtension = (name) => {
    log.push(['getExtension', name]);
    return name === 'WEBGL_lose_context'
      ? { loseContext: () => log.push(['loseContext']) }
      : null;
  };
  if (version === 2) {
    gl.createVertexArray = () => { log.push(['createVertexArray']); return tag('vao'); };
  }

  return gl;
}

export function installRecordingGL({ version = 2 } = {}) {
  const gl = createRecordingGL({ version });
  const original = HTMLCanvasElement.prototype.getContext;
  const wanted = version === 2 ? 'webgl2' : 'webgl';
  HTMLCanvasElement.prototype.getContext = function (type) {
    return type === wanted ? gl : null;
  };
  return {
    gl,
    log: gl.__log,
    restore() { HTMLCanvasElement.prototype.getContext = original; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGL.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the frame driver**

Create `src/terminal/gl/__tests__/driveFrames.js`:

```js
// driveFrames.js — deterministic replay of a component's GL traffic.
//
// Uses fake timers so rAF, performance.now and setTimeout all advance off one
// clock. Splits the log at the first drawArrays: everything before it is the
// init sequence, everything from it on is the frame loop.

import { vi } from 'vitest';
import { installRecordingGL } from './recordingGL';

export const FRAME_MS = 16;
export const DEFAULT_FRAMES = 60;

export function driveFrames(mount, { frames = DEFAULT_FRAMES, version = 1 } = {}) {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance',
             'setTimeout', 'clearTimeout', 'Date'],
  });
  const rec = installRecordingGL({ version });
  let unmount = () => {};
  try {
    unmount = mount();
    const initEnd = rec.log.length;
    for (let i = 0; i < frames; i++) vi.advanceTimersByTime(FRAME_MS);
    const all = rec.log.map(serialiseEntry);
    return { init: all.slice(0, initEnd), frames: all.slice(initEnd) };
  } finally {
    unmount();
    rec.restore();
    vi.useRealTimers();
  }
}

function serialiseEntry(entry) {
  const [name, ...args] = entry;
  return `${name}(${args.map(a => JSON.stringify(a)).join(', ')})`;
}
```

- [ ] **Step 6: Verify the driver is deterministic**

Append to `src/terminal/gl/__tests__/recordingGL.test.js`:

```js
import { render } from '@testing-library/react';
import { driveFrames } from './driveFrames';
import MercuryTerminator from '../../components/MercuryTerminator';

describe('driveFrames', () => {
  it('produces a non-empty, byte-identical log across two runs', () => {
    const mount = () => {
      const { unmount } = render(
        <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />
      );
      return unmount;
    };
    const a = driveFrames(mount, { version: 1 });
    const b = driveFrames(mount, { version: 1 });
    expect(a.init.length).toBeGreaterThan(10);
    expect(a.frames.length).toBeGreaterThan(10);
    expect(b).toEqual(a);
  });
});
```

Rename the file to `.jsx` (`recordingGL.test.jsx`) since it now contains JSX, and delete the old `.js`.

- [ ] **Step 7: Run and confirm**

Run: `npx vitest run src/terminal/gl/__tests__/recordingGL.test.jsx`
Expected: PASS, 6 tests.

If `a.frames.length` is 0, the fake-timer config is not driving rAF. Fix that here — every later task depends on it. Do not proceed with a driver that produces an empty frame log.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/gl/__tests__/recordingGL.js src/terminal/gl/__tests__/driveFrames.js src/terminal/gl/__tests__/recordingGL.test.jsx
git commit -m "test(gl): recording GL stub and deterministic frame driver"
```

---

## Task 2: Capture the pre-refactor snapshots

This task must land **before any harness code exists**. Its entire value is that the snapshots describe the current behavior, not the new behavior.

**Files:**
- Create: `src/terminal/gl/__tests__/glParity.test.jsx`
- Create (generated): `src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap`

**Interfaces:**
- Consumes: `driveFrames` from Task 1.
- Produces: the committed snapshot file that Tasks 6, 7 and 8 must satisfy.

- [ ] **Step 1: Write the parity test**

Create `src/terminal/gl/__tests__/glParity.test.jsx`:

```jsx
// glParity.test.jsx — the compliance gate for the harness extraction.
//
// `frames` is held to byte-equality: that is where visual regressions live.
// `init` is expected to diff during migration; a reviewer must read the diff
// and confirm every moved call is order-independent.
//
// NEVER run this file with -u. A failing snapshot is a finding.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { driveFrames } from './driveFrames';

import MercuryTerminator from '../../components/MercuryTerminator';
import ObserverEye from '../../components/ObserverEye';
import LunarShaderMoon from '../../lunar/LunarShaderMoon';

afterEach(cleanup);

const CASES = [
  {
    name: 'MercuryTerminator',
    version: 1,
    element: <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />,
  },
  {
    name: 'ObserverEye',
    version: 1,
    element: <ObserverEye state="armed" size={28} tint={null} pulse />,
  },
  {
    name: 'LunarShaderMoon',
    version: 2,
    element: (
      <LunarShaderMoon
        lunarAge={7.4}
        illumination={0.5}
        timestamp={Date.UTC(2026, 6, 22)}
        size={340}
      />
    ),
  },
];

for (const c of CASES) {
  describe(`GL parity — ${c.name}`, () => {
    const run = () =>
      driveFrames(() => render(c.element).unmount, { version: c.version });

    it('init sequence is unchanged', () => {
      expect(run().init.join('\n')).toMatchSnapshot();
    });

    it('frame loop is unchanged', () => {
      expect(run().frames.join('\n')).toMatchSnapshot();
    });
  });
}
```

- [ ] **Step 2: Generate the snapshots**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`
Expected: PASS, 6 tests, with `6 snapshots written`.

- [ ] **Step 3: Read the snapshots before trusting them**

Open `src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap` and confirm by eye:

- Each `frame loop` snapshot contains repeated `clearColor`/`clear`/`uniform*`/`drawArrays` cycles. If a frames snapshot is empty, the driver is broken — go back to Task 1.
- The `MercuryTerminator` uniform names include `u_t`, `u_tw`, `u_day`, `u_bloom`, `u_flareCol`, `u_retro`.
- The `ObserverEye` uniform names include `c0`, `c1`, `c2`, `u_gaze`, `u_focus`.
- The `LunarShaderMoon` init contains `createVertexArray`, a `bindFramebuffer` bake pass, and `deleteFramebuffer`.
- Float uniform values change between successive frames (the easing is moving, not settled).

If any of those is wrong, the snapshot is worthless as a gate. Fix it now.

- [ ] **Step 4: Confirm the full suite still passes**

Run: `npx vitest run`
Expected: 772 passed (766 baseline + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/gl/__tests__/glParity.test.jsx src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap
git commit -m "test(gl): capture pre-refactor GL call-log snapshots for all three renderers"
```

---

## Task 3: `glHost.js`

**Files:**
- Create: `src/terminal/gl/glHost.js`
- Test: `src/terminal/gl/__tests__/glHost.test.js`

**Interfaces:**
- Consumes: `createRecordingGL` from Task 1.
- Produces:

```js
createShaderHost(canvas, {
  version,               // 1 | 2
  contextOptions,        // object, passed straight to getContext
  vs, fs,                // shader source strings
  uniforms,              // string[]
  pixelSize,             // number, CSS px, square
  setStyleSize,          // bool, default false
  blend,                 // 'straight' | 'premultiplied' | null
  loseContextOnDispose,  // bool, default true
  strategy,              // 'legacy' | 'lunar'
  onInit,                // (gl, refs) => void, optional
  onDispose,             // (gl) => void, optional — runs before deleteProgram
  label,                 // string, used in error messages
}) → { gl, prog, U, vao, buf, dispose() } | null
```

`onDispose` exists because a component can own GL resources the host never
created — the moon's baked surface texture is the only current case. It runs
first so the component can free its own objects while the program is still
alive.

`strategy` bundles four correlated differences:

| | `'legacy'` (eye, terminator) | `'lunar'` (moon) |
|---|---|---|
| Build order | `createProgram` first, then compile each shader inline as it is attached | compile both, then `createProgram` |
| `deleteShader` after attach | no | yes |
| Link status checked | no | yes |
| On compile failure | `console.error` in DEV, continue with the broken program | throw with the driver info log |

`onInit` runs at the same point under both strategies — after quad setup,
before main-program activation. Only the moon uses it for GL work; the eye and
terminator use it to reset their easing state so a `size` change rebuilds the
host and the animation state together, as the current effect does.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/gl/__tests__/glHost.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createRecordingGL } from './recordingGL';
import { createShaderHost } from '../glHost';

function canvasWith(gl) {
  return { getContext: () => gl, style: {}, width: 0, height: 0 };
}

const BASE = { vs: 'VS', fs: 'FS', uniforms: ['u_a'], pixelSize: 100 };

describe('createShaderHost', () => {
  it('returns null when the context is unavailable', () => {
    const canvas = { getContext: () => null, style: {} };
    expect(createShaderHost(canvas, { ...BASE, strategy: 'legacy' })).toBeNull();
  });

  it('sizes the backing store by DPR, clamped to 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(canvas, { ...BASE, version: 1, strategy: 'legacy' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
    vi.unstubAllGlobals();
  });

  it('writes style size only when asked', () => {
    const a = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(a, { ...BASE, version: 1, strategy: 'legacy' });
    expect(a.style.width).toBeUndefined();

    const b = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(b, { ...BASE, version: 1, strategy: 'legacy', setStyleSize: true });
    expect(b.style.width).toBe('100px');
  });

  it('harvests uniform locations into a keyed map', () => {
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    const host = createShaderHost(canvas, {
      ...BASE, version: 1, strategy: 'legacy', uniforms: ['u_a', 'u_b'],
    });
    expect(host.U.u_a).toEqual({ __tag: 'uniform:u_a' });
    expect(host.U.u_b).toEqual({ __tag: 'uniform:u_b' });
  });

  it("legacy strategy creates the program before compiling and never deletes shaders", () => {
    const gl = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createProgram')).toBeLessThan(names.indexOf('createShader'));
    expect(names).not.toContain('deleteShader');
    expect(names).not.toContain('getProgramParameter');
  });

  it('lunar strategy compiles first, deletes shaders, and checks link status', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createShader')).toBeLessThan(names.indexOf('createProgram'));
    expect(names).toContain('deleteShader');
    expect(names).toContain('getProgramParameter');
  });

  it('lunar strategy throws with the driver log on compile failure', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getShaderParameter = () => false;
    gl.getShaderInfoLog = () => 'BOOM';
    expect(() =>
      createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar', label: 'moon' })
    ).toThrow(/moon.*BOOM/s);
  });

  it('legacy strategy survives compile failure and returns a host', () => {
    const gl = createRecordingGL({ version: 1 });
    gl.getShaderParameter = () => false;
    const host = createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    expect(host).not.toBeNull();
  });

  it('uses a VAO at version 2 and a bare attribute at version 1', () => {
    const v2 = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(v2), { ...BASE, version: 2, strategy: 'lunar' });
    expect(v2.__log.map(e => e[0])).toContain('createVertexArray');

    const v1 = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(v1), { ...BASE, version: 1, strategy: 'legacy' });
    expect(v1.__log.map(e => e[0])).toContain('getAttribLocation');
  });

  it('runs onInit after quad setup and before main-program activation', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onInit: () => { gl.__log.push(['MARK']); },
    });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('bufferData')).toBeLessThan(names.indexOf('MARK'));
    expect(names.indexOf('MARK')).toBeLessThan(names.lastIndexOf('useProgram'));
  });

  it('calls onDispose before deleting the program', () => {
    const gl = createRecordingGL({ version: 2 });
    const host = createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onDispose: (g) => g.deleteTexture({ __tag: 'texture:x' }),
    });
    host.dispose();
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('deleteTexture')).toBeLessThan(names.indexOf('deleteProgram'));
  });

  it('dispose calls loseContext only when asked', () => {
    const on = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(on), { ...BASE, version: 1, strategy: 'legacy' }).dispose();
    expect(on.__log.map(e => e[0])).toContain('loseContext');

    const off = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(off), {
      ...BASE, version: 2, strategy: 'lunar', loseContextOnDispose: false,
    }).dispose();
    expect(off.__log.map(e => e[0])).not.toContain('loseContext');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: FAIL — `Failed to resolve import "../glHost"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/gl/glHost.js`:

```js
// glHost.js — the shared WebGL setup and teardown for every fullscreen-quad
// fragment shader in the terminal.
//
// Owns: context creation, program build, the quad, uniform harvesting, DPR
// sizing, blend state, teardown. Owns no animation and no maths.
//
// `strategy` selects between the two setup sequences that exist in the
// codebase today. It bundles four differences that always co-occur: build
// order, whether shaders are deleted after attach, whether link status is
// checked, and whether a compile failure throws or warns. Phase 2 deletes
// 'legacy'. See docs/superpowers/specs/2026-07-26-shared-gl-harness-design.md.

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

function compile(gl, type, src, { strategy, label }) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
  if (!ok) {
    const log = gl.getShaderInfoLog(sh);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    if (strategy === 'lunar') {
      gl.deleteShader(sh);
      throw new Error(`[${label}] ${kind} shader failed to compile:\n${log}`);
    }
    if (import.meta.env?.DEV) console.error(`[${label}] shader`, log);
  }
  return sh;
}

function buildLegacy(gl, vs, fs, label) {
  // createProgram first, each shader compiled inline as it is attached —
  // preserves ObserverEye/MercuryTerminator call order exactly.
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs, { strategy: 'legacy', label }));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs, { strategy: 'legacy', label }));
  gl.linkProgram(prog);
  return prog;
}

function buildLunar(gl, vsSrc, fsSrc, label) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, { strategy: 'lunar', label });
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, { strategy: 'lunar', label });
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`[${label}] program failed to link:\n${log}`);
  }
  return prog;
}

export function createShaderHost(canvas, {
  version = 1,
  contextOptions = {},
  vs,
  fs,
  uniforms = [],
  pixelSize,
  setStyleSize = false,
  blend = 'straight',
  loseContextOnDispose = true,
  strategy = 'legacy',
  onInit = null,
  onDispose = null,
  label = 'glHost',
}) {
  const gl = canvas.getContext(version === 2 ? 'webgl2' : 'webgl', contextOptions);
  if (!gl) return null;

  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(pixelSize * dpr);
  canvas.height = Math.round(pixelSize * dpr);
  if (setStyleSize) {
    canvas.style.width = `${pixelSize}px`;
    canvas.style.height = `${pixelSize}px`;
  }

  let prog;
  let vao = null;
  let buf = null;

  if (strategy === 'legacy') {
    prog = buildLegacy(gl, vs, fs, label);
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const al = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  } else {
    prog = buildLunar(gl, vs, fs, label);
    gl.viewport(0, 0, canvas.width, canvas.height);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  if (onInit) onInit(gl, { prog, vao, buf, canvas });

  if (strategy === 'lunar') {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);
  }

  if (blend === 'straight') {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  } else if (blend === 'premultiplied') {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  const U = {};
  for (const name of uniforms) U[name] = gl.getUniformLocation(prog, name);

  if (strategy === 'legacy') gl.viewport(0, 0, canvas.width, canvas.height);

  return {
    gl,
    prog,
    U,
    vao,
    buf,
    dispose() {
      // Component-owned objects first, while the program is still alive.
      if (onDispose) onDispose(gl);
      gl.deleteProgram(prog);
      if (buf) gl.deleteBuffer(buf);
      if (vao) gl.deleteVertexArray(vao);
      if (loseContextOnDispose) {
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/gl/__tests__/glHost.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Confirm the parity snapshots are untouched**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`
Expected: PASS, 6 tests, `6 snapshots passed`. No component has been modified yet, so any failure here means Task 1 or 2 was non-deterministic. Stop and fix it.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/glHost.js src/terminal/gl/__tests__/glHost.test.js
git commit -m "feat(gl): glHost — shared context, program build, quad and teardown"
```

---

## Task 4: `frameLoop.js`

**Files:**
- Create: `src/terminal/gl/frameLoop.js`
- Test: `src/terminal/gl/__tests__/frameLoop.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:

```js
createFrameLoop({
  onFrame,          // (now, dt, { hidden }) => void
  dtClamp,          // number, seconds — 0.05 (legacy) or 0.25 (lunar)
  seedLast,         // 'now' | 'zero' — first-frame dt policy
  watchdogMs,       // number | null
  trackVisibility,  // bool
  haltOnReducedMotion, // bool
  reducedMotion,    // bool, injected so tests need no matchMedia
  now, raf, caf,    // injectable, default to performance/window
}) → { start(), stop(), isRunning() }
```

The scheduling constraint from the spec is enforced here and has its own test. `seedLast: 'now'` reproduces the eye and terminator (first `dt` is small but non-zero); `'zero'` reproduces the moon (first `dt` is exactly `0`).

- [ ] **Step 1: Write the failing test**

Create `src/terminal/gl/__tests__/frameLoop.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createFrameLoop } from '../frameLoop';

function harness(opts = {}) {
  let t = 1000;
  const queue = [];
  const raf = (cb) => { queue.push(cb); return queue.length; };
  const caf = vi.fn();
  const frames = [];
  const loop = createFrameLoop({
    onFrame: (now, dt, ctx) => frames.push({ now, dt, ...ctx }),
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: null,
    now: () => t,
    raf,
    caf,
    ...opts,
  });
  const tick = (ms = 16) => {
    t += ms;
    const cb = queue.shift();
    if (cb) cb(t);
  };
  return { loop, frames, tick, queue, caf, advance: (ms) => { t += ms; } };
}

describe('createFrameLoop', () => {
  it('does not invoke onFrame before start', () => {
    const h = harness();
    expect(h.frames).toHaveLength(0);
  });

  it('invokes onFrame once per tick after start', () => {
    const h = harness();
    h.loop.start();
    h.tick(); h.tick();
    expect(h.frames).toHaveLength(2);
  });

  it('clamps dt to dtClamp', () => {
    const h = harness({ dtClamp: 0.05 });
    h.loop.start();
    h.tick(5000);
    expect(h.frames[0].dt).toBe(0.05);
  });

  it("seedLast 'zero' makes the first dt exactly zero", () => {
    const h = harness({ seedLast: 'zero' });
    h.loop.start();
    h.tick(16);
    expect(h.frames[0].dt).toBe(0);
  });

  it("seedLast 'now' makes the first dt non-zero", () => {
    const h = harness({ seedLast: 'now' });
    h.loop.start();
    h.tick(16);
    expect(h.frames[0].dt).toBeGreaterThan(0);
  });

  // The constraint from the spec. The moon's idle throttle early-returns
  // before drawing; under bottom-scheduling that would starve the loop.
  it('schedules the next frame even when onFrame returns early', () => {
    const h = harness({ onFrame: () => { return; } });
    h.loop.start();
    h.tick();
    expect(h.queue).toHaveLength(1);
  });

  it('schedules the next frame even when onFrame throws', () => {
    const h = harness({ onFrame: () => { throw new Error('draw failed'); } });
    h.loop.start();
    expect(() => h.tick()).toThrow('draw failed');
    expect(h.queue).toHaveLength(1);
  });

  it('stop cancels a frame that is already queued', () => {
    const h = harness();
    h.loop.start();
    h.tick();
    h.loop.stop();
    expect(h.caf).toHaveBeenCalled();
    expect(h.loop.isRunning()).toBe(false);
    h.tick();
    expect(h.frames).toHaveLength(1);
  });

  it('start is idempotent', () => {
    const h = harness();
    h.loop.start(); h.loop.start();
    h.tick();
    expect(h.frames).toHaveLength(1);
  });

  it('does not start when reducedMotion and haltOnReducedMotion', () => {
    const h = harness({ reducedMotion: true, haltOnReducedMotion: true });
    h.loop.start();
    expect(h.loop.isRunning()).toBe(false);
    expect(h.queue).toHaveLength(0);
  });

  it('does start when reducedMotion but not halting', () => {
    const h = harness({ reducedMotion: true, haltOnReducedMotion: false });
    h.loop.start();
    expect(h.loop.isRunning()).toBe(true);
  });

  it('adds and removes a visibilitychange listener only when tracking', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');

    const off = harness({ trackVisibility: false });
    off.loop.start(); off.loop.stop();
    expect(add.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(0);

    const on = harness({ trackVisibility: true });
    on.loop.start();
    expect(add.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);
    on.loop.stop();
    expect(remove.mock.calls.filter(c => c[0] === 'visibilitychange')).toHaveLength(1);

    add.mockRestore();
    remove.mockRestore();
  });

  it('arms a watchdog when watchdogMs is set', () => {
    vi.useFakeTimers();
    const set = vi.spyOn(globalThis, 'setTimeout');
    const h = harness({ watchdogMs: 40 });
    h.loop.start();
    expect(set.mock.calls.some(c => c[1] === 40)).toBe(true);
    h.loop.stop();
    set.mockRestore();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/frameLoop.test.js`
Expected: FAIL — `Failed to resolve import "../frameLoop"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/gl/frameLoop.js`:

```js
// frameLoop.js — the shared animation loop for the terminal's shaders.
//
// Owns: rAF scheduling, the watchdog, dt policy, reduced-motion policy and
// optional visibility tracking. Owns no GL and no React.
//
// HARD CONSTRAINT: the next frame is scheduled at the TOP of the frame, before
// onFrame runs. LunarShaderMoon's idle throttle early-returns before drawing;
// scheduling at the bottom would starve the loop the first time it fired, and
// the GL call-log snapshots cannot catch that because rAF is not a GL call.

export function createFrameLoop({
  onFrame,
  dtClamp = 0.05,
  seedLast = 'now',
  watchdogMs = null,
  trackVisibility = false,
  haltOnReducedMotion = false,
  reducedMotion = false,
  now = () => performance.now(),
  raf = (cb) => requestAnimationFrame(cb),
  caf = (id) => cancelAnimationFrame(id),
}) {
  let rafId = 0;
  let wdId = 0;
  let running = false;
  let last = 0;
  let hidden = typeof document !== 'undefined' ? document.hidden : false;

  function onVisibility() {
    hidden = document.hidden;
    if (!hidden) last = seedLast === 'zero' ? 0 : now();
  }

  function schedule() {
    rafId = raf(frame);
    if (watchdogMs != null) {
      wdId = setTimeout(() => { caf(rafId); frame(now()); }, watchdogMs);
    }
  }

  function frame(t) {
    if (watchdogMs != null) clearTimeout(wdId);
    if (!running) return;
    schedule();                                  // top-scheduling — see header
    // seedLast 'now' seeds `last` at start(), so the first frame takes the
    // Math.min branch. seedLast 'zero' leaves it 0, so the first dt is 0.
    const dt = last ? Math.min((t - last) / 1000, dtClamp) : 0;
    last = t;
    onFrame(t, dt, { hidden });
  }

  return {
    start() {
      if (running) return;
      if (reducedMotion && haltOnReducedMotion) return;
      running = true;
      last = seedLast === 'zero' ? 0 : now();
      if (trackVisibility) document.addEventListener('visibilitychange', onVisibility);
      schedule();
    },
    stop() {
      if (!running) return;
      running = false;
      caf(rafId);
      if (watchdogMs != null) clearTimeout(wdId);
      if (trackVisibility) document.removeEventListener('visibilitychange', onVisibility);
    },
    isRunning() { return running; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/gl/__tests__/frameLoop.test.js`
Expected: PASS, 13 tests.

The `seedLast: 'now'` first-frame case is the subtle one: `last` is seeded to the clock at `start()`, so the first frame's `dt` is the gap between `start()` and the first tick, which matches how `ObserverEye.play()` behaves today. If that test fails, do not weaken it — the dt path is what the parity snapshots depend on.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/gl/frameLoop.js src/terminal/gl/__tests__/frameLoop.test.js
git commit -m "feat(gl): frameLoop — rAF, watchdog, dt policy, top-scheduling constraint"
```

---

## Task 5: `useShaderCanvas.js`

**Files:**
- Create: `src/terminal/gl/useShaderCanvas.js`
- Test: `src/terminal/gl/__tests__/useShaderCanvas.test.jsx`

**Interfaces:**
- Consumes: `createShaderHost` (Task 3), `createFrameLoop` (Task 4).
- Produces:

```js
useShaderCanvas(canvasRef, {
  ...hostOptions,       // everything createShaderHost accepts except `canvas`
  draw,                 // (host, { now, dt, tsec, hidden }) => void
  initialDraw,          // bool — synchronous draw at tsec 0 before the loop starts
  dtClamp, seedLast, watchdogMs, trackVisibility, haltOnReducedMotion,
  onSnap,               // (host) => void, called under reduced motion
  onUnsupported,        // () => void, called when the host is null
  deps,                 // effect dependency array
}) → { snap() }
```

`reducedMotion` is read from `matchMedia` inside the hook, not passed in.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/gl/__tests__/useShaderCanvas.test.jsx`:

```jsx
import React, { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';
import { useShaderCanvas } from '../useShaderCanvas';

afterEach(cleanup);

function Probe({ onReady, ...opts }) {
  const ref = useRef(null);
  const api = useShaderCanvas(ref, {
    version: 1, strategy: 'legacy', vs: 'VS', fs: 'FS',
    uniforms: ['u_t'], pixelSize: 64,
    draw: () => {}, deps: [],
    ...opts,
  });
  onReady?.(api);
  return <canvas ref={ref} />;
}

describe('useShaderCanvas', () => {
  it('calls onUnsupported and never draws when there is no context', () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => null;
    const onUnsupported = vi.fn();
    const draw = vi.fn();
    render(<Probe onUnsupported={onUnsupported} draw={draw} />);
    expect(onUnsupported).toHaveBeenCalledOnce();
    expect(draw).not.toHaveBeenCalled();
    HTMLCanvasElement.prototype.getContext = original;
  });

  it('draws once synchronously at tsec 0 when initialDraw is set', () => {
    const rec = installRecordingGL({ version: 1 });
    const seen = [];
    render(<Probe initialDraw draw={(_h, f) => seen.push(f.tsec)} />);
    expect(seen).toEqual([0]);
    rec.restore();
  });

  it('does not draw synchronously when initialDraw is false', () => {
    const rec = installRecordingGL({ version: 1 });
    const draw = vi.fn();
    render(<Probe initialDraw={false} draw={draw} />);
    expect(draw).not.toHaveBeenCalled();
    rec.restore();
  });

  it('disposes the host on unmount', () => {
    const rec = installRecordingGL({ version: 1 });
    const { unmount } = render(<Probe />);
    unmount();
    expect(rec.log.map(e => e[0])).toContain('deleteProgram');
    expect(rec.log.map(e => e[0])).toContain('loseContext');
    rec.restore();
  });

  it('snap() invokes onSnap only under reduced motion', () => {
    const rec = installRecordingGL({ version: 1 });
    const onSnap = vi.fn();
    let api;
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false });
    render(<Probe onSnap={onSnap} onReady={(a) => { api = a; }} />);
    api.snap();
    expect(onSnap).not.toHaveBeenCalled();

    window.matchMedia.mockReturnValue({ matches: true });
    cleanup();
    render(<Probe onSnap={onSnap} onReady={(a) => { api = a; }} />);
    api.snap();
    expect(onSnap).toHaveBeenCalledOnce();

    window.matchMedia.mockRestore();
    rec.restore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/useShaderCanvas.test.jsx`
Expected: FAIL — `Failed to resolve import "../useShaderCanvas"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/gl/useShaderCanvas.js`:

```js
// useShaderCanvas.js — the React seam over glHost + frameLoop.
//
// Owns the effect: build the host, run the optional init pass, optionally
// paint one synchronous frame, start the loop, tear everything down. Owns no
// GL state and no per-frame maths — the component supplies `draw`.

import { useEffect, useRef } from 'react';
import { createShaderHost } from './glHost';
import { createFrameLoop } from './frameLoop';

export function useShaderCanvas(canvasRef, {
  draw,
  initialDraw = true,
  dtClamp = 0.05,
  seedLast = 'now',
  watchdogMs = 40,
  trackVisibility = false,
  haltOnReducedMotion = true,
  onSnap = null,
  onUnsupported = null,
  deps = [],
  ...hostOptions
}) {
  const snapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let host;
    try {
      host = createShaderHost(canvas, hostOptions);
    } catch (err) {
      console.error(err);
      onUnsupported?.();
      return undefined;
    }
    if (!host) {
      onUnsupported?.();
      return undefined;
    }

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (initialDraw) draw(host, { now: 0, dt: 0, tsec: 0, hidden: false, reducedMotion });

    const loop = createFrameLoop({
      onFrame: (now, dt, ctx) =>
        draw(host, { now, dt, tsec: now / 1000, hidden: ctx.hidden, reducedMotion }),
      dtClamp, seedLast, watchdogMs, trackVisibility,
      haltOnReducedMotion, reducedMotion,
    });
    loop.start();

    snapRef.current = reducedMotion && onSnap ? () => onSnap(host) : null;

    return () => {
      loop.stop();
      snapRef.current = null;
      host.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { snap: () => snapRef.current?.() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/gl/__tests__/useShaderCanvas.test.jsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm nothing else moved**

Run: `npx vitest run`
Expected: all green, snapshots unchanged. No component has been touched yet.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/useShaderCanvas.js src/terminal/gl/__tests__/useShaderCanvas.test.jsx
git commit -m "feat(gl): useShaderCanvas — the React seam over glHost and frameLoop"
```

---

## Task 6: Migrate `MercuryTerminator`

First migration: simplest component, and its GL path has no coverage today.

**Files:**
- Modify: `src/terminal/components/MercuryTerminator.jsx:77-189` (the effect only)

**Interfaces:**
- Consumes: `useShaderCanvas` (Task 5).
- Produces: nothing new. The component's props and exports are unchanged.

**Configuration for this component** — read off the current code, do not guess:

| Option | Value |
|---|---|
| `version` | `1` |
| `contextOptions` | `{ alpha: true, premultipliedAlpha: false, antialias: true }` |
| `strategy` | `'legacy'` |
| `blend` | `'straight'` |
| `pixelSize` | `size` |
| `setStyleSize` | `false` |
| `loseContextOnDispose` | `true` |
| `uniforms` | `['u_t','u_tw','u_day','u_bloom','u_flareCol','u_retro']` |
| `dtClamp` | `0.05` |
| `seedLast` | `'now'` |
| `watchdogMs` | `40` |
| `trackVisibility` | `false` |
| `haltOnReducedMotion` | `true` |
| `initialDraw` | `true` |

- [ ] **Step 1: Replace the effect**

In `src/terminal/components/MercuryTerminator.jsx`, delete the entire second `useEffect` (lines 77–189) and replace it with the block below. Keep `VS`, `FS`, `CYAN`, `GOLD`, the props-sync effect, and the JSX exactly as they are.

```jsx
  const curRef = useRef(null);
  const { snap } = useShaderCanvas(canvasRef, {
    version: 1,
    contextOptions: { alpha: true, premultipliedAlpha: false, antialias: true },
    strategy: 'legacy',
    blend: 'straight',
    vs: VS,
    fs: FS,
    uniforms: ['u_t', 'u_tw', 'u_day', 'u_bloom', 'u_flareCol', 'u_retro'],
    pixelSize: size,
    label: 'MercuryTerminator',
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: 40,
    haltOnReducedMotion: true,
    initialDraw: true,
    deps: [size],

    // Today's effect recreates `cur` every time it re-runs. onInit fires on the
    // same schedule, so the easing state and the GL host are rebuilt together.
    onInit() {
      curRef.current = {
        tw: twRef.current, day: dayRef.current, bloom: 0, col: CYAN.slice(),
        lastFlareTs: 0, retroTs: 0, retroStart: 0, retroTint: 0,
      };
    },

    draw(host, { dt, tsec, now, reducedMotion }) {
      const { gl, U } = host;
      const cur = curRef.current;
      const lerp = (a, b, t) => a + (b - a) * t;

      if (dt > 0) {
        const e = 1 - Math.pow(0.004, dt);
        cur.tw = lerp(cur.tw, twRef.current, e);
        cur.day = lerp(cur.day, dayRef.current, e);
        const f = flareRef.current;
        if (f && f.ts !== cur.lastFlareTs) {
          cur.lastFlareTs = f.ts;
          cur.bloom = 1;
          cur.col = (f.kind === 'run' ? GOLD : CYAN).slice();
        }
        cur.bloom = lerp(cur.bloom, 0, 1 - Math.pow(0.02, dt)); // ~1.5s decay
        // Retrograde event: a new token arms a one-shot double-sunrise. While
        // it runs the terminator follows base + curve delta, then re-attaches
        // to the true tw/day. Under reduced motion the loop never runs, so an
        // earned token is left set with no visible event — known, phase 2.
        const r = retroRef.current;
        if (r && r.ts !== cur.retroTs && !reducedMotion) { cur.retroTs = r.ts; cur.retroStart = now; }
        if (cur.retroStart) {
          const p = (now - cur.retroStart) / RETROGRADE_MS;
          if (p >= 1) { cur.retroStart = 0; cur.retroTint = 0; doneRef.current?.(); }
          else {
            const { delta, tint } = retrogradeCurve(p);
            cur.tw = Math.max(0, Math.min(1, twRef.current + delta));
            cur.day = Math.max(0, Math.min(1, dayRef.current + delta));
            cur.retroTint = tint;
          }
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, tsec);
      gl.uniform1f(U.u_tw, cur.tw);
      gl.uniform1f(U.u_day, cur.day);
      gl.uniform1f(U.u_bloom, cur.bloom);
      gl.uniform3fv(U.u_flareCol, new Float32Array(cur.col));
      gl.uniform1f(U.u_retro, cur.retroTint);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    onSnap(host) {
      const cur = curRef.current;
      if (!cur) return;
      cur.tw = twRef.current; cur.day = dayRef.current; cur.bloom = 0;
      const { gl, U } = host;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, 0);
      gl.uniform1f(U.u_tw, cur.tw);
      gl.uniform1f(U.u_day, cur.day);
      gl.uniform1f(U.u_bloom, cur.bloom);
      gl.uniform3fv(U.u_flareCol, new Float32Array(cur.col));
      gl.uniform1f(U.u_retro, cur.retroTint);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  });
```

Add the import at the top:

```js
import { useShaderCanvas } from '../gl/useShaderCanvas';
```

Change the props-sync effect's last line from `snapRef.current?.();` to `snap();`, and delete the now-unused `snapRef` declaration.

The `if (dt > 0)` guard preserves the existing `render(0)` behavior: the current code paints one frame at `tsec = 0` without stepping any easing.

- [ ] **Step 2: Run the parity snapshot**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx -t MercuryTerminator`
Expected: the `frame loop` snapshot PASSES byte-for-byte. The `init sequence` snapshot may FAIL.

- [ ] **Step 3: Adjudicate the init diff**

If `frame loop` fails: something in the draw path changed. Do not update the snapshot. Diff the two logs, find the differing call, and fix the component.

If only `init sequence` fails: read the diff call by call. Every difference must be a reordering of order-independent setup (`getUniformLocation` relative to `bindBuffer`, for example). These are **not** acceptable and mean a bug:
- `viewport` before the canvas is sized
- a missing or extra `getUniformLocation`
- a changed `blendFunc`
- a different `shaderSource` hash

Once every moved call is confirmed order-independent, accept the new init snapshot with a **targeted** update, and record the adjudication in the commit message:

```bash
npx vitest run src/terminal/gl/__tests__/glParity.test.jsx -t "MercuryTerminator init" -u
```

- [ ] **Step 4: Run the component's own tests and the full suite**

Run: `npx vitest run src/terminal/components/__tests__/MercuryTerminator.test.jsx`
Expected: PASS, 4 tests.

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/MercuryTerminator.jsx src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap
git commit -m "refactor(gl): MercuryTerminator onto the shared harness

Frame-loop GL call log byte-identical. Init snapshot reordering
adjudicated: <list the moved calls here>."
```

---

## Task 7: Migrate `LunarShaderMoon`

Second, not last: this is the stress case. If the harness API is wrong, it shows here, and there is one migration to redo rather than two.

**Files:**
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx:28-169`
- Delete: `src/terminal/lunar/glContext.js`
- Modify: `src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx` (import path only, if it references `glContext`)

**Interfaces:**
- Consumes: `useShaderCanvas` (Task 5).
- Produces: nothing new. Props and exports unchanged.

**Configuration:**

| Option | Value |
|---|---|
| `version` | `2` |
| `contextOptions` | `{ alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }` |
| `strategy` | `'lunar'` |
| `blend` | `'premultiplied'` |
| `pixelSize` | `Math.round(size * 1.25)` |
| `setStyleSize` | `true` |
| `loseContextOnDispose` | `false` (preserved divergence — phase 2 flips it) |
| `uniforms` | `['uRadius','uSurface','uAge','uIllum','uAdapt','uPurkinje','uTime','uLibration']` |
| `dtClamp` | `0.25` |
| `seedLast` | `'zero'` |
| `watchdogMs` | `null` (preserved divergence — phase 2 adds it) |
| `trackVisibility` | `true` |
| `haltOnReducedMotion` | `false` |
| `initialDraw` | `false` |

- [ ] **Step 1: Move the bake pass into `onInit`**

The bake pass becomes the `onInit` callback. It receives `(gl, { prog, vao, buf, canvas })` and runs after quad setup, before main-program activation — exactly where it sits today.

```js
    onInit(gl, { vao, canvas }) {
      const bakeProg = buildBakeProgram(gl);   // local helper, see step 2
      const [bw, bh] = bakeSize();
      surfaceTexRef.current = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);        // lon wraps
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // lat does not

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surfaceTexRef.current, 0);
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(bakeProg);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteProgram(bakeProg);
    },
```

`glHost` restores `viewport` to the canvas and calls `useProgram(prog)` after `onInit` returns, so the two trailing lines of the current bake block are no longer the component's job.

- [ ] **Step 2: Add the local bake-program helper**

`glContext.js` is being deleted, so the bake pass needs its own build. Add to `LunarShaderMoon.jsx`:

```js
// The bake pass builds a second program against the same context. It uses the
// same strict policy glContext.js used: a silently-null program renders black,
// which is indistinguishable from the suspended-rAF trap.
function buildBakeProgram(gl) {
  const mk = (type, src, kind) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`[moonShader] ${kind} shader failed to compile:\n${log}`);
    }
    return sh;
  };
  const vs = mk(gl.VERTEX_SHADER, QUAD_VS, 'vertex');
  const fs = mk(gl.FRAGMENT_SHADER, BAKE_FS, 'fragment');
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`[moonShader] program failed to link:\n${log}`);
  }
  return prog;
}
```

- [ ] **Step 3: Move the frame body into `draw`**

Keep the 30fps idle throttle inside `draw` — it is a draw-body concern, not a loop concern, and `frameLoop`'s top-scheduling is what makes the early return safe.

```js
    draw(host, { now, dt, hidden, reducedMotion }) {
      const { gl, U } = host;
      const live = propsRef.current;
      adaptRef.current = stepAdapt(adaptRef.current, {
        dt, illumination: live.illumination, hidden, reducedMotion,
      });
      const adaptState = adaptRef.current;

      if (now - reportRef.current.at > 100 &&
          Math.abs(adaptState.adapt - reportRef.current.value) > 1e-3) {
        reportRef.current = { at: now, value: adaptState.adapt };
        propsRef.current.onAdaptChange?.(adaptState.adapt);
      }

      // 30fps idle throttle once adaptation has settled (spec section 9).
      if (isAtRest(adaptState, live.illumination) && now - lastDrawRef.current < REST_FRAME_MS) return;
      lastDrawRef.current = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const lib = libration(live.timestamp);
      gl.uniform2f(U.uLibration, lib.lon, lib.lat);
      gl.uniform1f(U.uRadius, 0.78 * apparentRadiusScale(live.timestamp));
      gl.uniform1f(U.uAge, live.lunarAge);
      gl.uniform1f(U.uIllum, live.illumination);
      gl.uniform1f(U.uAdapt, adaptState.adapt);
      gl.uniform1f(U.uPurkinje, 1.0);   // author's call after review; 3.0 inverts
      gl.uniform1f(U.uTime, reducedMotion ? 0 : now * 0.001);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexRef.current);
      gl.uniform1i(U.uSurface, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
```

Declare the refs alongside `propsRef`:

```js
  const surfaceTexRef = useRef(null);
  const adaptRef = useRef(null);
  const lastDrawRef = useRef(0);
  const reportRef = useRef({ at: 0, value: -1 });
```

and reset the adaptation state in `onInit`'s first line:

```js
      adaptRef.current = createAdaptState(propsRef.current.illumination);
      lastDrawRef.current = 0;
      reportRef.current = { at: 0, value: -1 };
```

- [ ] **Step 4: Wire `onUnsupported`, `onDispose`, and delete the old effect**

```js
    onUnsupported: () => setSupported(false),
    onDispose(gl) { if (surfaceTexRef.current) gl.deleteTexture(surfaceTexRef.current); },
    deps: [supported, size],
```

The baked surface texture is created by the component, not the host, so the
host cannot free it — that is what `onDispose` (Task 3) is for.

The `useState` support probe at the top of the component stays as-is. Delete the old `useEffect` entirely, and delete the `import { createGL, buildProgram } from './glContext';` line.

- [ ] **Step 5: Run the parity snapshot**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx -t LunarShaderMoon`
Expected: `frame loop` PASSES byte-for-byte. `init sequence` may fail — adjudicate exactly as in Task 6 Step 3.

The moon's init has the most moving parts. Pay specific attention to: the bake `viewport(0,0,bw,bh)` must still precede the bake `drawArrays`; the canvas `viewport` must be restored before the first frame; `deleteFramebuffer` and `deleteProgram(bakeProg)` must both still be present.

- [ ] **Step 6: Verify the throttle does not starve the loop**

This is the trap the snapshots cannot see. Add to `src/terminal/gl/__tests__/glParity.test.jsx`:

```jsx
it('LunarShaderMoon keeps animating after its idle throttle engages', () => {
  const long = driveFrames(
    () => render(CASES[2].element).unmount,
    { version: 2, frames: 400 },
  );
  const draws = long.frames.filter(l => l.startsWith('drawArrays')).length;
  // Throttled to 30fps, 400 frames at 16ms must still yield well over 100
  // draws. A starved loop yields a handful and then nothing.
  expect(draws).toBeGreaterThan(100);
});
```

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`
Expected: PASS.

- [ ] **Step 7: Run the moon's own tests and the full suite**

Run: `npx vitest run src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx`
Expected: PASS, 4 tests. The fallback tests still work because `onUnsupported` drives the same `setSupported(false)`.

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 8: Delete `glContext.js` and commit**

```bash
git rm src/terminal/lunar/glContext.js
git add -A
git commit -m "refactor(gl): LunarShaderMoon onto the shared harness; drop glContext

Bake pass moves into onInit. Idle throttle stays in the draw body and is
now covered by a starvation test the GL snapshots cannot provide.
Init snapshot reordering adjudicated: <list the moved calls here>."
```

---

## Task 8: Migrate `ObserverEye`

**Files:**
- Modify: `src/terminal/components/ObserverEye.jsx:93-202` (the effect only)

**Interfaces:**
- Consumes: `useShaderCanvas` (Task 5).
- Produces: nothing new.

**Configuration:** identical to `MercuryTerminator` (Task 6) except:

| Option | Value |
|---|---|
| `pixelSize` | `size` |
| `uniforms` | `['u_t','u_focus','u_irid','u_speed','u_pulse','c0','c1','c2','u_gaze']` |
| `label` | `'ObserverEye'` |

Note the canvas backing store is sized from `size`, while the *displayed* canvas is `size * (lens ? 0.58 : 0.94)` in the JSX. That mismatch exists today. Do not fix it here — it is a phase 2 item.

- [ ] **Step 1: Replace the effect**

Keep `STATES`, `deriveCols`, `VS`, `FS`, the props-sync effect and all JSX. Replace the second `useEffect` with:

```jsx
  const curRef = useRef(null);
  const { snap } = useShaderCanvas(canvasRef, {
    version: 1,
    contextOptions: { alpha: true, premultipliedAlpha: false, antialias: true },
    strategy: 'legacy',
    blend: 'straight',
    vs: VS,
    fs: FS,
    uniforms: ['u_t', 'u_focus', 'u_irid', 'u_speed', 'u_pulse', 'c0', 'c1', 'c2', 'u_gaze'],
    pixelSize: size,
    label: 'ObserverEye',
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: 40,
    haltOnReducedMotion: true,
    initialDraw: true,
    deps: [size],

    // Today's effect recreates `cur` every time it re-runs. onInit fires on the
    // same schedule, so the easing state and the GL host are rebuilt together.
    onInit() {
      const start = STATES[stateRef.current] || STATES.resting;
      curRef.current = {
        cols: start.cols.map(c => c.slice()),
        speed: start.speed, focus: start.focus, irid: start.irid,
        gaze: start.gaze.slice(), pulse: 0,
      };
    },

    draw(host, { dt, tsec }) {
      const { gl, U } = host;
      const cur = curRef.current;
      const lerp = (a, b, t) => a + (b - a) * t;

      if (dt > 0) {
        const tgt = STATES[stateRef.current] || STATES.resting;
        const tCols = (stateRef.current === 'leaning' && tintRef.current)
          ? deriveCols(tintRef.current) : tgt.cols;
        const tGaze = gazeRef.current || tgt.gaze;
        const e = 1 - Math.pow(0.004, dt);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          cur.cols[i][j] = lerp(cur.cols[i][j], tCols[i][j], e);
        }
        cur.speed = lerp(cur.speed, tgt.speed, e);
        const focusTarget = constrictRef.current != null
          ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
        cur.focus = lerp(cur.focus, focusTarget, e);
        cur.irid = lerp(cur.irid, tgt.irid, e);
        cur.pulse = lerp(cur.pulse, pulseRef.current ? 1 : 0, e);
        cur.gaze[0] = lerp(cur.gaze[0], tGaze[0], e);
        cur.gaze[1] = lerp(cur.gaze[1], tGaze[1], e);
      }

      const nrm = c => new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, tsec);
      gl.uniform1f(U.u_focus, cur.focus);
      gl.uniform1f(U.u_irid, cur.irid);
      gl.uniform1f(U.u_speed, cur.speed);
      gl.uniform1f(U.u_pulse, cur.pulse);
      gl.uniform3fv(U.c0, nrm(cur.cols[0]));
      gl.uniform3fv(U.c1, nrm(cur.cols[1]));
      gl.uniform3fv(U.c2, nrm(cur.cols[2]));
      gl.uniform2fv(U.u_gaze, new Float32Array(cur.gaze));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    onSnap(host) {
      // Reduced motion: no swirl, but a state change still locks in its colour.
      const cur = curRef.current;
      if (!cur) return;
      const tgt = STATES[stateRef.current] || STATES.resting;
      const tCols = (stateRef.current === 'leaning' && tintRef.current)
        ? deriveCols(tintRef.current) : tgt.cols;
      const tGaze = gazeRef.current || tgt.gaze;
      cur.cols = tCols.map(c => c.slice());
      cur.speed = tgt.speed;
      cur.focus = constrictRef.current != null
        ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
      cur.irid = tgt.irid;
      cur.pulse = pulseRef.current ? 1 : 0;
      cur.gaze = tGaze.slice();

      const nrm = c => new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]);
      const { gl, U } = host;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, 0);
      gl.uniform1f(U.u_focus, cur.focus);
      gl.uniform1f(U.u_irid, cur.irid);
      gl.uniform1f(U.u_speed, cur.speed);
      gl.uniform1f(U.u_pulse, cur.pulse);
      gl.uniform3fv(U.c0, nrm(cur.cols[0]));
      gl.uniform3fv(U.c1, nrm(cur.cols[1]));
      gl.uniform3fv(U.c2, nrm(cur.cols[2]));
      gl.uniform2fv(U.u_gaze, new Float32Array(cur.gaze));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  });
```

Add `import { useShaderCanvas } from '../gl/useShaderCanvas';`, change `snapRef.current?.()` in the props-sync effect to `snap()`, and delete the `snapRef` declaration.

- [ ] **Step 2: Run the parity snapshot**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx -t ObserverEye`
Expected: `frame loop` PASSES byte-for-byte. Adjudicate any `init sequence` diff exactly as in Task 6 Step 3.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/components/ObserverEye.jsx src/terminal/gl/__tests__/__snapshots__/glParity.test.jsx.snap
git commit -m "refactor(gl): ObserverEye onto the shared harness

Frame-loop GL call log byte-identical. Init snapshot reordering
adjudicated: <list the moved calls here>."
```

---

## Task 9: Generalize teardown coverage and write the phase 2 backlog

**Files:**
- Create: `src/terminal/gl/__tests__/teardown.test.jsx`
- Create: `docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md`

**Interfaces:**
- Consumes: `installRecordingGL` (Task 1).
- Produces: the phase 2 work list.

- [ ] **Step 1: Write the teardown test**

The moon has listener-balance tests today; the eye and terminator have none. Generalize.

```jsx
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { installRecordingGL } from './recordingGL';

import MercuryTerminator from '../../components/MercuryTerminator';
import ObserverEye from '../../components/ObserverEye';
import LunarShaderMoon from '../../lunar/LunarShaderMoon';

afterEach(cleanup);

const CASES = [
  { name: 'MercuryTerminator', version: 1, loses: true,
    el: <MercuryTerminator twilight={0.3} day={0.1} size={180} /> },
  { name: 'ObserverEye', version: 1, loses: true,
    el: <ObserverEye state="armed" size={28} /> },
  { name: 'LunarShaderMoon', version: 2, loses: false,
    el: <LunarShaderMoon lunarAge={7.4} illumination={0.5}
          timestamp={Date.UTC(2026, 6, 22)} size={340} /> },
];

for (const c of CASES) {
  describe(`teardown — ${c.name}`, () => {
    it('removes every document listener it added', () => {
      const rec = installRecordingGL({ version: c.version });
      const added = [];
      const removed = [];
      const realAdd = document.addEventListener.bind(document);
      const realRemove = document.removeEventListener.bind(document);
      vi.spyOn(document, 'addEventListener').mockImplementation((t, f, o) => {
        added.push(t); return realAdd(t, f, o);
      });
      vi.spyOn(document, 'removeEventListener').mockImplementation((t, f, o) => {
        removed.push(t); return realRemove(t, f, o);
      });

      const { unmount } = render(c.el);
      const during = [...added];
      unmount();
      for (const t of during) expect(removed).toContain(t);

      vi.restoreAllMocks();
      rec.restore();
    });

    it('deletes its GL program on unmount', () => {
      const rec = installRecordingGL({ version: c.version });
      render(c.el).unmount();
      expect(rec.log.map(e => e[0])).toContain('deleteProgram');
      rec.restore();
    });

    // Preserved phase 1 divergence: the moon does NOT release its context.
    // Phase 2 flips loseContextOnDispose to true and this expectation inverts.
    it(`${c.loses ? 'releases' : 'does not release'} the GL context`, () => {
      const rec = installRecordingGL({ version: c.version });
      render(c.el).unmount();
      const names = rec.log.map(e => e[0]);
      expect(names.includes('loseContext')).toBe(c.loses);
      rec.restore();
    });
  });
}
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/terminal/gl/__tests__/teardown.test.jsx`
Expected: PASS, 9 tests.

The third test **documents a known defect rather than asserting correctness** — that is deliberate, and the comment says so. When phase 2 flips the flag, this test flips with it and the moon's leak is provably gone.

- [ ] **Step 3: Write the phase 2 backlog**

Create `docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md`, one section per flag, each stating: the current divergence, which value should win, what breaks if it changes, and which test flips.

Required entries, one per flag:

1. `strategy` — collapse `'legacy'` into `'lunar'`. Real compile/link error surfacing for the eye and terminator. Highest value: `'legacy'` currently renders black on a shader error, indistinguishable from the rAF trap.
2. `watchdogMs` — give the moon `40`. Makes it screenshot-able from a suspended-rAF preview pane. Flips nothing; adds capability.
3. `loseContextOnDispose` — give the moon `true`. Flips the third assertion in `teardown.test.jsx`.
4. `reducedMotion` policy — pick `'halt'` or `'run'` for all three. Resolving `'halt'` also fixes the documented retrograde-token-left-set defect in `MercuryTerminator`.
5. `dtClamp` / `seedLast` — pick one dt policy. Pure drift, no design intent behind `0.05` vs `0.25`.
6. `initialDraw` — decide whether a synchronous first paint is wanted. Forcing the moon's loop-only behavior onto the eye risks a one-frame blank on slow mounts.
7. `version` / `contextOptions` / `blend` — decide whether WebGL2 + premultiplied is the house standard.
8. `setStyleSize` — unify how the canvas is sized. Related: the eye's backing store is `size` while its displayed canvas is `size * 0.58`.
9. `trackVisibility` — decide whether all three should pause work when the tab is hidden.
10. `onInit` / `onUnsupported` — keep; these are genuine capability hooks, not drift. Give the eye and terminator a fallback.
11. Extract the eye's and terminator's easing into pure tested modules, matching `lunarEphemeris.js` / `darkAdaptation.js`.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all green. Record the final count in the commit message.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/gl/__tests__/teardown.test.jsx docs/superpowers/specs/2026-07-26-shared-gl-harness-phase2-backlog.md
git commit -m "test(gl): generalize teardown coverage; write the phase 2 backlog"
```

---

## Final verification

Before declaring phase 1 done:

- [ ] `npx vitest run` — all green, no snapshot written or updated in this run.
- [ ] `git log --oneline` shows the golden-capture commit strictly before every harness commit.
- [ ] Every `init sequence` snapshot diff in the history has an adjudication list in its commit message.
- [ ] Author's own look on the live site: the eye in the masthead across its five states, the terminator on the Mercury tab (including a retrograde play), and the moon on the Lunar tab (including a phase-glyph jump).

The last item is the real gate. The snapshots prove the GL traffic is unchanged; only the author's eye proves the site still looks right.
