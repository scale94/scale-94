# KernelTab Animation Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two GPU-composited CSS animations to KernelTab: white-flash entry on every tty0 log line, and instant-cyan-snap → green-settle on kernel completion.

**Architecture:** Two new `@keyframes` blocks added to KernelTab's inline `<style>` tag. One `style` prop added to log entry `div`. One new React state (`completedKernels` Set) drives a conditional `animation` + `className` on kernel `li` elements. No new files, no new dependencies.

**Tech Stack:** React 18, Vitest + @testing-library/react, CSS animations (GPU compositor only)

---

## File Map

| File | Change |
|------|--------|
| `src/terminal/views/KernelTab.jsx` | Add `completedKernels` state; update `loadingKernel` effect; add `style` to log div; add conditional `animation`+`className` to kernel `li`; add 2 keyframes |
| `tests/KernelTab.animations.test.js` | New test file — log flash + completion pulse assertions |

---

## Task 1: Test scaffolding

**Files:**
- Create: `tests/KernelTab.animations.test.js`

- [ ] **Step 1: Create the test file with canvas + rAF mocks**

```js
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import KernelTab from '../src/terminal/views/KernelTab';

// Canvas mock — JSDOM has no 2D context; return a silent Proxy
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () =>
    new Proxy({}, { get: () => () => {} });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

const KERNELS = [
  { id: 'k1', name: 'SARG_METRIC',    desc: 'convergence engine' },
  { id: 'k2', name: 'BONE_FUSION',    desc: 'tensor convergence' },
];

const LOGS = [
  { time: '14:03:01', msg: 'kernel::sarg_metric booting', rust: false },
  { time: '14:03:02', msg: 'SOMA-4 WASM runtime attached', rust: true  },
];

function makeProps(overrides = {}) {
  return {
    kernelBuilds:        KERNELS,
    kernelAxioms:        [],
    visibleLogs:         LOGS,
    loadingKernel:       null,
    handleKernelClick:   () => {},
    appendSystemLog:     () => {},
    onCommandInputChange:() => {},
    onCommandKeyDown:    () => {},
    mobileAutoRun:       () => {},
    bootDone:            true,
    ...overrides,
  };
}

describe('KernelTab animations', () => {
  // Tests added in Tasks 2 and 3
});
```

- [ ] **Step 2: Run the empty test suite to confirm it passes with no errors**

```bash
cd "F:\scale_9.4\.claude\worktrees\optimistic-robinson-8bb618" && npx vitest run tests/KernelTab.animations.test.js
```

Expected: `0 tests`, no errors. If canvas errors appear, confirm the `beforeAll` mock ran.

- [ ] **Step 3: Commit scaffolding**

```bash
git add tests/KernelTab.animations.test.js
git commit -m "test(kernel): scaffold KernelTab animation test file"
```

---

## Task 2: Log line flash — red → green

**Files:**
- Modify: `tests/KernelTab.animations.test.js`
- Modify: `src/terminal/views/KernelTab.jsx`

### 2a — Failing test

- [ ] **Step 1: Add the failing test inside `describe('KernelTab animations', ...)`**

```js
it('applies sk-logFlashIn animation to every log entry div', () => {
  render(<KernelTab {...makeProps()} />);

  // Each log line renders as a div containing the timestamp + message.
  // Find them by their log message text, then walk up to the colored div.
  const logLine1 = screen.getByText(/kernel::sarg_metric booting/).closest('div[style]');
  const logLine2 = screen.getByText(/SOMA-4 WASM runtime attached/).closest('div[style]');

  expect(logLine1.style.animation).toContain('sk-logFlashIn');
  expect(logLine2.style.animation).toContain('sk-logFlashIn');
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
npx vitest run tests/KernelTab.animations.test.js
```

Expected failure: `expect(received).toContain('sk-logFlashIn')` — the style is currently empty.

### 2b — Implementation

- [ ] **Step 3: Add `sk-logFlashIn` keyframe to the inline `<style>` block in KernelTab.jsx**

Locate the `<style>` block (around line 327). Add after the existing `sk-logSlideUp` keyframe (around line 427):

```css
@keyframes sk-logFlashIn {
  0%   { opacity: 0; filter: brightness(8); }
  12%  { opacity: 1; filter: brightness(5); }
  100% { opacity: 1; filter: brightness(1); }
}
```

In the JSX, find the string literal in the `<style>` tag and add the new keyframe after `sk-logSlideUp`:

```jsx
      @keyframes sk-logSlideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes sk-logFlashIn {
        0%   { opacity: 0; filter: brightness(8); }
        12%  { opacity: 1; filter: brightness(5); }
        100% { opacity: 1; filter: brightness(1); }
      }
```

- [ ] **Step 4: Add the `style` prop to the log entry `div` (around line 770)**

Find:
```jsx
{visibleLogs.map((l, i) => (
  <div key={`${l.time}-${i}`} className={`mb-1 break-words ${l.rust ? 'text-emerald-400' : 'text-[#39ff14]'}`}>
```

Replace with:
```jsx
{visibleLogs.map((l, i) => (
  <div
    key={`${l.time}-${i}`}
    className={`mb-1 break-words ${l.rust ? 'text-emerald-400' : 'text-[#39ff14]'}`}
    style={{ animation: 'sk-logFlashIn 280ms ease-out both' }}
  >
```

- [ ] **Step 5: Run test — confirm GREEN**

```bash
npx vitest run tests/KernelTab.animations.test.js
```

Expected: PASS `applies sk-logFlashIn animation to every log entry div`

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/KernelTab.jsx tests/KernelTab.animations.test.js
git commit -m "feat(kernel): white-flash entry animation on tty0 log lines"
```

---

## Task 3: Kernel completion pulse — red → green

**Files:**
- Modify: `tests/KernelTab.animations.test.js`
- Modify: `src/terminal/views/KernelTab.jsx`

### 3a — Failing test

- [ ] **Step 1: Add the failing test**

```js
it('applies sk-completionPulse to a kernel card after loadingKernel clears', () => {
  const { rerender } = render(<KernelTab {...makeProps({ loadingKernel: 'k1' })} />);

  // Transition: loadingKernel clears — kernel k1 is now complete
  act(() => {
    rerender(<KernelTab {...makeProps({ loadingKernel: null })} />);
  });

  // The k1 list item should now carry the completion animation
  const k1Text  = screen.getByText('SARG_METRIC');
  const k1Li    = k1Text.closest('li');
  expect(k1Li.style.animation).toContain('sk-completionPulse');

  // k2 was never loaded — it must NOT have the completion animation
  const k2Text  = screen.getByText('BONE_FUSION');
  const k2Li    = k2Text.closest('li');
  expect(k2Li.style.animation).not.toContain('sk-completionPulse');
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
npx vitest run tests/KernelTab.animations.test.js
```

Expected: `expect(received).toContain('sk-completionPulse')` — state doesn't exist yet.

### 3b — Implementation

- [ ] **Step 3: Add `completedKernels` state near the other state declarations (around line 221)**

Find the block:
```jsx
const [isSpinning,  setIsSpinning]  = useState(false);
const [isStopping,  setIsStopping]  = useState(false);
const [isFading,    setIsFading]    = useState(false);
```

Add `completedKernels` after it:
```jsx
const [isSpinning,      setIsSpinning]      = useState(false);
const [isStopping,      setIsStopping]      = useState(false);
const [isFading,        setIsFading]        = useState(false);
const [completedKernels, setCompletedKernels] = useState(() => new Set());
```

- [ ] **Step 4: Record completion in the `loadingKernel` useEffect (around line 232)**

Find the existing `else if (prevKernelRef.current)` branch:
```jsx
    } else if (prevKernelRef.current) {
      // Signal stop — consumed by onAnimationIteration so the icon lands at 0°
      pendingStopRef.current = true;
      sphereFireRef.current = { ts: Date.now() };
```

Add `setCompletedKernels` as the first line of that branch:
```jsx
    } else if (prevKernelRef.current) {
      setCompletedKernels(prev => {
        const next = new Set(prev);
        next.add(prevKernelRef.current.id);
        return next;
      });
      // Signal stop — consumed by onAnimationIteration so the icon lands at 0°
      pendingStopRef.current = true;
      sphereFireRef.current = { ts: Date.now() };
```

- [ ] **Step 5: Add `sk-completionPulse` keyframe to the inline `<style>` block**

Add after the `sk-logFlashIn` keyframe added in Task 2:
```jsx
      @keyframes sk-completionPulse {
        0% {
          border-color: rgba(6,182,212,1);
          box-shadow: 0 0 22px rgba(6,182,212,0.5), inset 0 0 20px rgba(6,182,212,0.08);
        }
        100% {
          border-color: rgba(57,255,20,0.35);
          box-shadow: 0 0 6px rgba(57,255,20,0.12);
        }
      }
```

- [ ] **Step 6: Apply the animation + className to the kernel `li` (around line 643)**

Find the kernel list item. Currently it computes `isLoading` — add `isCompleted`:

```jsx
{kernelBuilds.map((kernel, idx) => {
  const isLoading   = loadingKernel === kernel.id;
  const isCompleted = completedKernels.has(kernel.id);
  return (
    <li
      key={kernel.id}
      onClick={() => { ... }}
      className={`flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 cursor-pointer p-2 pl-3 rounded transition-all group gap-2
        ${isLoading
          ? 'border-cyan-400/60 border-l-cyan-400/60 backdrop-blur-sm'
          : isCompleted
          ? 'border-green-500/35 border-l-green-500/35'
          : 'border-cyan-900/20 border-l-transparent hover:border-l-cyan-500/40 hover:bg-cyan-900/10'}`}
      style={{ animation: isLoading
        ? `sk-loadFlash 1.2s cubic-bezier(0.16,1,0.3,1) forwards, sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both`
        : isCompleted
        ? `sk-completionPulse 120ms linear forwards, sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both`
        : `sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both` }}
    >
```

- [ ] **Step 7: Run all tests — confirm full GREEN**

```bash
npx vitest run tests/KernelTab.animations.test.js
```

Expected: both tests PASS. Also run the full suite to check for regressions:

```bash
npx vitest run
```

Expected: all tests pass (including ChapterPanel, ledger, mercury suites).

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/KernelTab.jsx tests/KernelTab.animations.test.js
git commit -m "feat(kernel): instant cyan-snap → green-settle on kernel completion"
```

---

## Task 4: Open PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push origin HEAD
gh pr create --title "feat(kernel): log flash + completion pulse animations" --body "$(cat <<'EOF'
## Summary
- tty0 log lines: white-flash entry via \`sk-logFlashIn\` (brightness 8→1, 280ms). Doctrine-pure: white is transition only.
- Kernel completion: instant cyan border snap → 120ms linear settle to green. Electrical, not cinematic. Green border persists via \`animation-fill-mode: forwards\`.
- All effects GPU-composited (opacity, filter, border-color, box-shadow). Zero layout shifts.

## Test plan
- [x] \`sk-logFlashIn\` applied to all log entry divs
- [x] \`sk-completionPulse\` applied to completed kernel li, not to others
- [x] Full vitest suite passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Merge the PR**

```bash
gh pr merge --merge --auto
```

---

## Self-Review

**Spec coverage:**
- ✅ Log line entry: `sk-logFlashIn` keyframe + `style` prop on log div (Task 2)
- ✅ White flash → color resolve via `brightness(8)` (Task 2, Step 3)
- ✅ Kernel completion: instant cyan snap, 120ms linear, green settle (Task 3)
- ✅ `completedKernels` Set grows monotonically — border persists (Task 3, Step 4)
- ✅ Performance contract: only compositor properties animated

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `completedKernels` is a `Set` throughout — `new Set()`, `.has()`, and the updater all use the same type. `prevKernelRef.current.id` is the same string type as `kernel.id` in the map.
