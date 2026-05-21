# Eye Observer Philosophical Comments

**Date:** 2026-05-21
**Branch:** `main`
**Status:** Spec — approved
**Scope:** When a kernel is loaded or a run command is executed, a brief philosophical phrase appears extending leftward from the ◉ eye glyph and fades after ~5s.

---

## Problem

The ◉ eye animates (breathes, flares, deep-watches) but never speaks. The observer is always watching — it should occasionally comment. Each kernel load or run is a moment of meaning; the alien architect should acknowledge it in its own register.

## Goals

1. **Phrase on kernel load.** When `handleNeuralLink` fires in App.jsx, a phrase from the LOAD pool appears near the eye.
2. **Phrase on kernel run.** When `lastKernelAt` updates (existing signal), a phrase from the RUN pool appears near the eye.
3. **High phrase volume.** ~25 LOAD phrases + ~28 RUN phrases. Nihilist/existentialist register (Nietzsche, Schopenhauer, Sartre, Heidegger, Cioran, Camus). Lowercase, 3–6 words, terminal cadence.
4. **Anti-repeat.** Never shows the same phrase back-to-back within a pool.
5. **No new components.** All changes inside `MercuryEyeIndicator.jsx` + minimal App.jsx wiring.

## Non-Goals

- No phrase on tab switch or any event other than kernel load/run
- No phrase queuing — if a second trigger fires during a phrase, the animation restarts on the new phrase (key remount)
- No phrase on mobile (eye is already hidden on mobile via `hidden md:flex`)
- No persistence — phrase never survives a page reload

---

## Architecture

### Data Flow

```
App.jsx
  handleNeuralLink()      → setLastLoadAt(Date.now())
  lastLoadAt state        → prop to MercuryEyeIndicator
  lastKernelAt state      → prop to MercuryEyeIndicator (already exists)
```

`MercuryEyeIndicator` holds all phrase state internally. App.jsx only provides the two timestamps.

### New Prop: `lastLoadAt`

`lastKernelAt` already covers RUN. `lastLoadAt` is a new `useState(null)` in App.jsx, set inside `handleNeuralLink`, passed directly to `MercuryEyeIndicator`. No threading through ScalingTab needed.

---

## Visual Spec

**Position:** Absolutely positioned to the LEFT of the ◉ glyph, right-edge flush with the eye's left boundary, 8px gap (`pr-2`). Vertically centered (`top-1/2 -translate-y-1/2`). Text-aligned right — phrase reads leftward from the eye like a whisper into the room.

```
[ god is dead · field active ] ◉
                                ↑ right-flush, 8px gap
```

**Typography:**
- `font-mono text-[9px] tracking-[0.12em]`
- Color: `rgba(232,210,138,0.65)` — Fade Doctrine gold, slightly dimmer than the idle eye
- `whitespace: nowrap` — single line always

**Animation — `@keyframes mei-phrase`:**

```css
@keyframes mei-phrase {
  0%   { opacity: 0; transform: translateX(5px) translateY(-50%); }
  6%   { opacity: 1; transform: translateX(0)   translateY(-50%); }
  78%  { opacity: 1; transform: translateX(0)   translateY(-50%); }
  100% { opacity: 0; transform: translateX(0)   translateY(-50%); }
}
```

Total: `5.1s ease forwards`. Breakdown: ~0.3s fade-in + slide, ~4s hold, ~0.8s fade-out.

**Cleanup:** `onAnimationEnd` calls `setPhrase(null)` — removes node from DOM after fade completes. No timer needed.

**Rapid triggers:** `phraseKey` increments on each `firePhrase` call. `key={phraseKey}` on the phrase div forces React to remount the node → animation restarts cleanly on the new phrase.

---

## Phrase Pools

Both arrays defined as module-level constants in `MercuryEyeIndicator.jsx`.

### `OBSERVER_PHRASES_LOAD` (~25 phrases)

Observer notices a new kernel arriving — contemplative, receptive.

```js
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
```

### `OBSERVER_PHRASES_RUN` (~28 phrases)

Execution has begun — active, entropic, the machinery of meaninglessness turns.

```js
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

---

## State + Logic

### New state in `MercuryEyeIndicator`

```js
const [phrase, setPhrase]       = useState(null);
const [phraseKey, setPhraseKey] = useState(0);

const lastRunIdx  = useRef(-1);
const lastLoadIdx = useRef(-1);
const prevLoadAt  = useRef(null);
```

### `firePhrase` helper (defined inside component)

```js
function firePhrase(pool, idxRef) {
  let idx;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (idx === idxRef.current && pool.length > 1);
  idxRef.current = idx;
  setPhrase(pool[idx]);
  setPhraseKey(k => k + 1);
}
```

### RUN trigger — added to existing `lastKernelAt` useEffect

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

### LOAD trigger — new useEffect

```js
useEffect(() => {
  if (!lastLoadAt || lastLoadAt === prevLoadAt.current) return;
  prevLoadAt.current = lastLoadAt;
  firePhrase(OBSERVER_PHRASES_LOAD, lastLoadIdx);
}, [lastLoadAt]);
```

### Phrase render (inside component return, inside the outer wrapper div)

```jsx
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
```

The `@keyframes mei-phrase` block is added to the existing `<style>` tag inside the component.

---

## App.jsx Changes

**New state:**
```js
const [lastLoadAt, setLastLoadAt] = useState(null);
```
Added after `lastKernelAt` state.

**Set on kernel load** — inside `handleNeuralLink`:
```js
setLastLoadAt(Date.now());
```

**Pass to MercuryEyeIndicator:**
```jsx
<MercuryEyeIndicator
  activeTab={activeTab}
  onNavigate={() => handleNav('~/system/mercury', 'mercury')}
  lastKernelAt={lastKernelAt}
  lastLoadAt={lastLoadAt}
/>
```

---

## Files Affected

| File | Status | Change |
|---|---|---|
| `src/terminal/components/MercuryEyeIndicator.jsx` | Modify | Phrase pools, state, refs, triggers, render, keyframe |
| `src/terminal/App.jsx` | Modify | `lastLoadAt` state + set in `handleNeuralLink` + prop on MercuryEyeIndicator |

---

## Edge Cases

| Case | Behavior |
|---|---|
| Rapid back-to-back runs | `phraseKey` increments → node remounts → animation restarts on new phrase |
| Load fires while run phrase is showing | Same remount mechanism — new phrase replaces old |
| Same phrase picked twice | `do-while` anti-repeat prevents back-to-back repeat within a pool |
| `lastLoadAt` prop absent | `useEffect` guard `if (!lastLoadAt)` — no phrase, no throw |
| Mobile | Eye is `hidden md:flex` — phrase div inside eye wrapper, never rendered on mobile |
| First load, no run yet | Both `prevKernelAt` and `prevLoadAt` are null → guards fire correctly on first update |
