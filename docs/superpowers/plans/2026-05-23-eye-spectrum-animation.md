# Eye Spectrum Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ◉ eye's hardcoded gold color with a phase-aware full-spectrum CSS animation that cycles through all 13 nav item colors.

**Architecture:** All changes are in one file — `MercuryEyeIndicator.jsx`. The existing `<style>` block gains three new `@keyframes` for spectrum color cycling. The four existing opacity keyframes are stripped of `text-shadow` (which the spectrum keyframes now own). The `animation` variable is updated to run two simultaneous CSS animations per phase: one for color+glow, one for opacity. No JS logic changes.

**Tech Stack:** React, CSS keyframe animations, inline style string composition.

---

### Task 1: Strip `text-shadow` from opacity keyframes

The four existing keyframes mix `opacity` and `text-shadow`. After this step they control only `opacity` — the new spectrum keyframes will own color and glow.

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx:176-203`

- [ ] **Step 1: Replace the four existing keyframes inside the `<style>` block**

Find lines 176–203 (the `<style>` tag content). Replace the four keyframe blocks with these opacity-only versions:

```css
@keyframes mei-breath {
  0%, 100% { opacity: 0.28; }
  50%      { opacity: 0.58; }
}
@keyframes mei-breath-active {
  0%, 100% { opacity: 0.72; }
  50%      { opacity: 0.95; }
}
@keyframes mei-breath-deep {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.38; }
}
@keyframes mei-flare {
  0%   { opacity: 0.95; }
  35%  { opacity: 0.82; }
  100% { opacity: 0.28; }
}
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
```

- [ ] **Step 2: Verify the app still renders**

Run the dev server (`npm run dev` or equivalent) and confirm the ◉ glyph is visible. It will be gold/static for now — that is expected.

---

### Task 2: Add three spectrum `@keyframes` blocks

Three variants — idle (52s), active (8s), deep-watch (120s) — each cycling through the same 13 nav colors with hue-matched glows scaled to the phase's brightness.

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx:176` (insert before `mei-breath`)

- [ ] **Step 1: Insert the three spectrum keyframes into the `<style>` block**

Add these three blocks at the top of the `<style>` string, before `@keyframes mei-breath`:

```css
@keyframes mei-spectrum-idle {
  0%   { color: #06b6d4; text-shadow: 0 0 14px rgba(6,182,212,0.55),   0 0 4px rgba(6,182,212,0.3); }
  8%   { color: #38bdf8; text-shadow: 0 0 14px rgba(56,189,248,0.55),  0 0 4px rgba(56,189,248,0.3); }
  17%  { color: #a78bfa; text-shadow: 0 0 14px rgba(167,139,250,0.55), 0 0 4px rgba(167,139,250,0.3); }
  25%  { color: #c084fc; text-shadow: 0 0 14px rgba(192,132,252,0.55), 0 0 4px rgba(192,132,252,0.3); }
  33%  { color: #d946ef; text-shadow: 0 0 14px rgba(217,70,239,0.55),  0 0 4px rgba(217,70,239,0.3); }
  38%  { color: #fb7185; text-shadow: 0 0 14px rgba(251,113,133,0.55), 0 0 4px rgba(251,113,133,0.3); }
  43%  { color: #ef4444; text-shadow: 0 0 14px rgba(239,68,68,0.55),   0 0 4px rgba(239,68,68,0.3); }
  48%  { color: #f97316; text-shadow: 0 0 14px rgba(249,115,22,0.55),  0 0 4px rgba(249,115,22,0.3); }
  56%  { color: #FFD700; text-shadow: 0 0 14px rgba(255,215,0,0.55),   0 0 4px rgba(255,215,0,0.3); }
  65%  { color: #7ab800; text-shadow: 0 0 14px rgba(122,184,0,0.55),   0 0 4px rgba(122,184,0,0.3); }
  75%  { color: #a78bfa; text-shadow: 0 0 14px rgba(167,139,250,0.55), 0 0 4px rgba(167,139,250,0.3); }
  85%  { color: #c0c0c0; text-shadow: 0 0 14px rgba(192,192,192,0.45), 0 0 4px rgba(192,192,192,0.3); }
  93%  { color: #14b8a6; text-shadow: 0 0 14px rgba(20,184,166,0.55),  0 0 4px rgba(20,184,166,0.3); }
  100% { color: #06b6d4; text-shadow: 0 0 14px rgba(6,182,212,0.55),   0 0 4px rgba(6,182,212,0.3); }
}
@keyframes mei-spectrum-active {
  0%   { color: #06b6d4; text-shadow: 0 0 28px rgba(6,182,212,0.90),   0 0 10px rgba(6,182,212,0.6); }
  8%   { color: #38bdf8; text-shadow: 0 0 28px rgba(56,189,248,0.90),  0 0 10px rgba(56,189,248,0.6); }
  17%  { color: #a78bfa; text-shadow: 0 0 28px rgba(167,139,250,0.90), 0 0 10px rgba(167,139,250,0.6); }
  25%  { color: #c084fc; text-shadow: 0 0 28px rgba(192,132,252,0.90), 0 0 10px rgba(192,132,252,0.6); }
  33%  { color: #d946ef; text-shadow: 0 0 28px rgba(217,70,239,0.90),  0 0 10px rgba(217,70,239,0.6); }
  38%  { color: #fb7185; text-shadow: 0 0 28px rgba(251,113,133,0.90), 0 0 10px rgba(251,113,133,0.6); }
  43%  { color: #ef4444; text-shadow: 0 0 28px rgba(239,68,68,0.90),   0 0 10px rgba(239,68,68,0.6); }
  48%  { color: #f97316; text-shadow: 0 0 28px rgba(249,115,22,0.90),  0 0 10px rgba(249,115,22,0.6); }
  56%  { color: #FFD700; text-shadow: 0 0 28px rgba(255,215,0,0.90),   0 0 10px rgba(255,215,0,0.6); }
  65%  { color: #7ab800; text-shadow: 0 0 28px rgba(122,184,0,0.90),   0 0 10px rgba(122,184,0,0.6); }
  75%  { color: #a78bfa; text-shadow: 0 0 28px rgba(167,139,250,0.90), 0 0 10px rgba(167,139,250,0.6); }
  85%  { color: #c0c0c0; text-shadow: 0 0 28px rgba(192,192,192,0.80), 0 0 10px rgba(192,192,192,0.6); }
  93%  { color: #14b8a6; text-shadow: 0 0 28px rgba(20,184,166,0.90),  0 0 10px rgba(20,184,166,0.6); }
  100% { color: #06b6d4; text-shadow: 0 0 28px rgba(6,182,212,0.90),   0 0 10px rgba(6,182,212,0.6); }
}
@keyframes mei-spectrum-deep {
  0%   { color: #06b6d4; text-shadow: 0 0 6px rgba(6,182,212,0.22); }
  8%   { color: #38bdf8; text-shadow: 0 0 6px rgba(56,189,248,0.22); }
  17%  { color: #a78bfa; text-shadow: 0 0 6px rgba(167,139,250,0.22); }
  25%  { color: #c084fc; text-shadow: 0 0 6px rgba(192,132,252,0.22); }
  33%  { color: #d946ef; text-shadow: 0 0 6px rgba(217,70,239,0.22); }
  38%  { color: #fb7185; text-shadow: 0 0 6px rgba(251,113,133,0.22); }
  43%  { color: #ef4444; text-shadow: 0 0 6px rgba(239,68,68,0.22); }
  48%  { color: #f97316; text-shadow: 0 0 6px rgba(249,115,22,0.22); }
  56%  { color: #FFD700; text-shadow: 0 0 6px rgba(255,215,0,0.22); }
  65%  { color: #7ab800; text-shadow: 0 0 6px rgba(122,184,0,0.22); }
  75%  { color: #a78bfa; text-shadow: 0 0 6px rgba(167,139,250,0.22); }
  85%  { color: #c0c0c0; text-shadow: 0 0 6px rgba(192,192,192,0.18); }
  93%  { color: #14b8a6; text-shadow: 0 0 6px rgba(20,184,166,0.22); }
  100% { color: #06b6d4; text-shadow: 0 0 6px rgba(6,182,212,0.22); }
}
```

- [ ] **Step 2: Verify the app still renders without console errors**

HMR should apply the keyframe additions without a full reload. Check the browser console for CSS parse errors. The eye will still show the old single animation at this point.

---

### Task 3: Wire up dual animations and remove hardcoded color

Update the `animation` variable to run two simultaneous CSS animations per phase, and remove the hardcoded gold `color` from the glyph's inline style.

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx:141-147` (animation variable)
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx:205-213` (glyph div style prop)

- [ ] **Step 1: Replace the `animation` variable (lines 141–147)**

Find this block:

```js
const animation = flaring
  ? 'mei-flare 1.8s ease-out forwards'
  : isOnMercury
    ? 'mei-breath-active 8s ease-in-out infinite'
    : deepWatch
      ? 'mei-breath-deep 14s ease-in-out infinite'
      : 'mei-breath 11s ease-in-out infinite';
```

Replace with:

```js
const animation = flaring
  ? 'mei-spectrum-idle 52s linear infinite, mei-flare 1.8s ease-out forwards'
  : isOnMercury
    ? 'mei-spectrum-active 8s linear infinite, mei-breath-active 8s ease-in-out infinite'
    : deepWatch
      ? 'mei-spectrum-deep 120s linear infinite, mei-breath-deep 14s ease-in-out infinite'
      : 'mei-spectrum-idle 52s linear infinite, mei-breath 11s ease-in-out infinite';
```

- [ ] **Step 2: Update the glyph div style prop (lines 205–213)**

Find this div:

```jsx
<div
  className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
  style={{
    color: isOnMercury ? '#d4a82a' : '#e8d28a',
    animation,
  }}
>
  ◉
</div>
```

Replace with:

```jsx
<div
  className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
  style={{
    color: '#06b6d4',
    animation,
  }}
>
  ◉
</div>
```

The `color: '#06b6d4'` is the pre-animation fallback only — CSS animations override inline styles while running, so the spectrum animation immediately takes over.

- [ ] **Step 3: Visually verify in the browser**

With the dev server running, observe the ◉ glyph in the top-right nav:

- **Idle state:** Eye slowly cycles through all 13 colors over ~52s. Opacity breathes 0.28→0.58.
- **Mercury tab active:** Cycle speeds up to ~8s, glow becomes vivid. Opacity 0.72→0.95.
- **Deep-watch (>90s without kernel run):** Cycle slows to 120s, glow minimal. Opacity 0.15→0.38.
- **Kernel run (flare):** 1.8s opacity surge, spectrum-idle color continues underneath.

If you cannot wait 90s for deep-watch, temporarily change `90_000` to `5000` in the `useEffect` on line 122 to verify, then revert.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/components/MercuryEyeIndicator.jsx
git commit -m "feat(eye): full nav-spectrum color fade — phase-aware 13-color cycle"
```
