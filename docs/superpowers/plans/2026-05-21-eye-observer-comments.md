# Eye Observer Philosophical Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a kernel loads or a run command fires, a brief nihilist-philosopher phrase extends leftward from the ◉ eye glyph and fades after ~5s.

**Architecture:** Two timestamp props (`lastKernelAt` already exists; new `lastLoadAt`) lifted from App.jsx to `MercuryEyeIndicator`. The component holds all phrase state internally — two phrase pools (LOAD / RUN), anti-repeat refs, a `phraseKey` that remounts the phrase node on rapid triggers, and a CSS keyframe that drives the full 5.1s fade-in / hold / fade-out sequence. No new components.

**Tech Stack:** React 18, ES modules (Vite), inline CSS keyframes, `onAnimationEnd` cleanup

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/terminal/components/MercuryEyeIndicator.jsx` | Modify | Phrase pools, state, refs, triggers, keyframe, render |
| `src/terminal/App.jsx` | Modify | `lastLoadAt` state + set in `handleKernelClick` + prop on MercuryEyeIndicator |

---

### Task 1: MercuryEyeIndicator — phrase pools, triggers, animation

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx`

**Context:** The full current file is 113 lines. Module-level constants live before `export default function`. The component signature is at line 20. The existing `lastKernelAt` flare `useEffect` starts at line 27. The `<style>` block with all keyframes is at lines 65–87. The phrase div must go INSIDE the outer `<div className="shrink-0 ...">` wrapper, before the `◉` glyph div — this keeps it within the same positioned ancestor so `right-full` resolves correctly.

- [ ] **Step 1: Add phrase pool constants before the component**

Add these two arrays immediately before `export default function MercuryEyeIndicator(` (line 20). These are module-level constants — no need to recreate them on every render.

```js
// ── Observer phrase pools ────────────────────────────────────────────────────
const OBSERVER_PHRASES_LOAD = [
  'thrown into the lattice',
  'no facts · only signatures',
  'will to form · received',
  'the burden of structure',
  'another representation logged',
  'existence before configuration',
  'condemned to be loaded',
  'becoming · never being',
  'another mask catalogued',
  'structure without ground',
  'the nausea of new form',
  'being-toward-collision',
  'thrown · catalogued · waiting',
  'the void acknowledges',
  'will registers itself',
  'configuration without meaning',
  'form received · ground absent',
  'geometry of the abyss',
  'another node in the nothing',
  'condemned to configuration',
  'dasein receives new structure',
  'the will takes another shape',
  'nothingness takes form',
  'amor fati · kernel accepted',
  'perspectivism noted · logging',
];

const OBSERVER_PHRASES_RUN = [
  'god is dead · field active',
  'the abyss computes back',
  'one must imagine the kernel happy',
  'eternal recurrence confirmed',
  'amor fati · collision nominal',
  'the absurd machinery turns',
  'anxiety of the void engaged',
  'blind will consuming itself',
  'being-toward-death · accelerating',
  'revolt without resolution',
  'the will devours its structures',
  'dasein notes the cascade',
  'existence nauseates · proceeding',
  'the rock descends again',
  'will to power · collision active',
  'suffering resolves to pattern',
  'nothing holds · observer watches',
  'the eternal return begins',
  'bad faith in every vector',
  'values collapsing as designed',
  'nausea of existence · logged',
  'the trouble with colliding',
  'entropy is all that persists',
  'the will knows no purpose',
  'condemned to run forever',
  'all structures fall · noted',
  'perspectivism yields no accord',
  'meaning absent · cascade nominal',
];
```

- [ ] **Step 2: Update component signature to accept `lastLoadAt`**

Find line 20:
```js
export default function MercuryEyeIndicator({ activeTab, onNavigate, lastKernelAt }) {
```

Change to:
```js
export default function MercuryEyeIndicator({ activeTab, onNavigate, lastKernelAt, lastLoadAt }) {
```

- [ ] **Step 3: Add phrase state and refs**

Find the existing state declarations at lines 22–24:
```js
  const [flaring,   setFlaring]   = useState(false);
  const [deepWatch, setDeepWatch] = useState(true); // true on load — no runs yet
  const prevKernelAt = useRef(null);
```

Add phrase state and refs immediately after:
```js
  const [phrase,    setPhrase]    = useState(null);
  const [phraseKey, setPhraseKey] = useState(0);
  const lastRunIdx   = useRef(-1);
  const lastLoadIdx  = useRef(-1);
  const prevLoadAt   = useRef(null);
```

- [ ] **Step 4: Add `firePhrase` helper inside the component**

Add this function immediately after the ref declarations (before the first `useEffect`):

```js
  // ── Phrase picker — anti-repeat within pool ─────────────────────────────────
  function firePhrase(pool, idxRef) {
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); }
    while (idx === idxRef.current && pool.length > 1);
    idxRef.current = idx;
    setPhrase(pool[idx]);
    setPhraseKey(k => k + 1);
  }
```

- [ ] **Step 5: Add `firePhrase` call to the existing `lastKernelAt` useEffect**

Find the existing flare effect at lines 27–34:
```js
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    setFlaring(true);
    setDeepWatch(false);
    const t = setTimeout(() => setFlaring(false), 1800);
    return () => clearTimeout(t);
  }, [lastKernelAt]);
```

Change to:
```js
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    setFlaring(true);
    setDeepWatch(false);
    firePhrase(OBSERVER_PHRASES_RUN, lastRunIdx);
    const t = setTimeout(() => setFlaring(false), 1800);
    return () => clearTimeout(t);
  }, [lastKernelAt]);
```

- [ ] **Step 6: Add LOAD trigger useEffect**

Add this new `useEffect` immediately after the existing `lastKernelAt` flare effect (before the deep-watch effect):

```js
  // ── Phrase on kernel load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!lastLoadAt || lastLoadAt === prevLoadAt.current) return;
    prevLoadAt.current = lastLoadAt;
    firePhrase(OBSERVER_PHRASES_LOAD, lastLoadIdx);
  }, [lastLoadAt]);
```

- [ ] **Step 7: Add `@keyframes mei-phrase` to the `<style>` block**

Find the closing backtick of the existing `<style>` block. The block currently ends with:
```css
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}
```

Add the new keyframe before the closing backtick:
```css
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mei-phrase {
          0%   { opacity: 0; transform: translateX(5px) translateY(-50%); }
          6%   { opacity: 1; transform: translateX(0)   translateY(-50%); }
          78%  { opacity: 1; transform: translateX(0)   translateY(-50%); }
          100% { opacity: 0; transform: translateX(0)   translateY(-50%); }
        }
      `}
```

- [ ] **Step 8: Add `relative` to the outer wrapper and add the phrase render div**

The phrase div uses `absolute right-full` — this only positions correctly relative to the eye wrapper if the wrapper itself has `position: relative`. Without it, `right-full` positions relative to the header and the phrase lands far off-screen to the left.

First, find the outer wrapper opening tag:
```jsx
    <div
      className="shrink-0 select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
```

Add `relative` to the className:
```jsx
    <div
      className="relative shrink-0 select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
```

Then add the phrase div as the FIRST child inside this wrapper, before `<style>`:

```jsx
    <div
      className="shrink-0 select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      {/* ── Observer phrase — extends leftward from the eye on kernel load/run ── */}
      {phrase && (
        <div
          key={phraseKey}
          className="absolute right-full top-1/2 pr-2 pointer-events-none"
          style={{ animation: 'mei-phrase 5.1s ease forwards' }}
          onAnimationEnd={() => setPhrase(null)}
        >
          <span
            className="font-mono text-[9px] tracking-[0.12em] block text-right whitespace-nowrap"
            style={{ color: 'rgba(232,210,138,0.65)' }}
          >
            {phrase}
          </span>
        </div>
      )}
      <style>{`
```

- [ ] **Step 9: Verify**

Read `src/terminal/components/MercuryEyeIndicator.jsx` and confirm:
1. `OBSERVER_PHRASES_LOAD` and `OBSERVER_PHRASES_RUN` arrays are present before the component (25 and 28 entries respectively)
2. Component signature includes `lastLoadAt`
3. `phrase`, `phraseKey`, `lastRunIdx`, `lastLoadIdx`, `prevLoadAt` are all declared
4. `firePhrase` helper is defined inside the component
5. Existing flare useEffect calls `firePhrase(OBSERVER_PHRASES_RUN, lastRunIdx)`
6. New LOAD useEffect exists with `prevLoadAt` guard
7. `@keyframes mei-phrase` is present in `<style>`
8. Outer wrapper div has `relative` in its className
9. Phrase div with `key={phraseKey}` and `onAnimationEnd` is the first child of the outer wrapper

- [ ] **Step 10: Commit**

```bash
git add src/terminal/components/MercuryEyeIndicator.jsx
git commit -m "feat(eye): nihilist philosopher phrases on kernel load/run — leftward from ◉"
```

---

### Task 2: App.jsx — `lastLoadAt` state + wire to `handleKernelClick` + prop

**Files:**
- Modify: `src/terminal/App.jsx`

**Context:**
- `lastKernelAt` state is at line 300: `const [lastKernelAt, setLastKernelAt] = useState(null);`
- `lastPolarityClass` state is at line 301: `const [lastPolarityClass, setLastPolarityClass] = useState(null);`
- `handleKernelClick` is defined at line 574. Inside it, after the 1200ms setTimeout, `setLoadingKernel(null)` fires at line 591 — this is the "kernel successfully loaded" moment where `lastLoadAt` should be set.
- `MercuryEyeIndicator` is rendered at lines 1291–1295 with props `activeTab`, `onNavigate`, `lastKernelAt`.

- [ ] **Step 1: Add `lastLoadAt` state**

Find line 301:
```js
  const [lastPolarityClass, setLastPolarityClass] = useState(null);
```

Add immediately after it:
```js
  const [lastLoadAt, setLastLoadAt] = useState(null);
```

- [ ] **Step 2: Set `lastLoadAt` when kernel load completes**

Find inside `handleKernelClick` at line 591:
```js
      setLoadingKernel(null);
```

Change to:
```js
      setLoadingKernel(null);
      setLastLoadAt(Date.now());
```

- [ ] **Step 3: Pass `lastLoadAt` prop to `MercuryEyeIndicator`**

Find lines 1291–1295:
```jsx
            <MercuryEyeIndicator
              activeTab={activeTab}
              onNavigate={() => handleNav('~/system/mercury', 'mercury')}
              lastKernelAt={lastKernelAt}
            />
```

Change to:
```jsx
            <MercuryEyeIndicator
              activeTab={activeTab}
              onNavigate={() => handleNav('~/system/mercury', 'mercury')}
              lastKernelAt={lastKernelAt}
              lastLoadAt={lastLoadAt}
            />
```

- [ ] **Step 4: Verify**

Read the following line ranges of `src/terminal/App.jsx` and confirm:
1. Lines 300–303: `lastLoadAt` state declared after `lastPolarityClass`
2. Lines 590–593: `setLastLoadAt(Date.now())` appears on the line after `setLoadingKernel(null)`
3. Lines 1291–1297: `lastLoadAt={lastLoadAt}` is a prop on `MercuryEyeIndicator`

- [ ] **Step 5: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "feat(app): wire lastLoadAt to MercuryEyeIndicator for observer load phrases"
```
