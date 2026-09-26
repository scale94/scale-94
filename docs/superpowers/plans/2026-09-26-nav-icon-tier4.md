# Nav Icon Tier 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last four stock lucide nav icons (Kernel `Cpu`, Privacy `Lock`, Cryptography `KeyRound`, Lunar `Moon`) with bespoke SVG glyphs that draw what each tab does.

**Architecture:** Four presentational `forwardRef` SVG components in `src/terminal/components/icons/`, cloned from the shape of `InterceptIcon.jsx` (tiers 1–3). They are added to the existing parameterised contract test, then swapped into both navs in `App.jsx`. After the swap `App.jsx` imports nothing from `lucide-react`.

**Tech Stack:** React 18 + Vite, Tailwind, vitest + @testing-library/react, ESLint with a warnings ratchet.

**Spec:** `docs/superpowers/specs/2026-09-26-nav-icon-tier4-design.md`

## Global Constraints

- SVG grammar for every glyph: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`, `className` and extra props forwarded, `React.forwardRef` + `displayName`.
- Legibility budget: at most 5 drawn elements (`path` + `circle`) per glyph, no filled shapes.
- The ONE sanctioned exception: in `EarthshineMoonIcon`, the earthshine `<path>` carries `strokeWidth="1"` and `opacity="0.55"` on the path itself. Do not normalise it to 2px.
- Geometry is copied verbatim from spec §1. No rounding, no "simplifying".
- Button classes and colours in `App.jsx` stay exactly as they are.
- Out of scope: in-tab lucide uses (PrivacyTab etc.), the BSKY butterfly, and tiers 1–3 glyphs.
- Lint: 0 errors, and the warning count must not rise (ratchet `--max-warnings 143` in `package.json`). If it falls, lower the ratchet to the new measured count.
- The working tree carries ~140 pre-existing unrelated changes. Stage only the files each task names, by path. Never `git add -A`, `git add .`, `git commit -a`, `git stash`, or `git checkout -- <file>`.
- Do not push.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/components/icons/KernelCoreIcon.jsx` (create) | Kernel: pinned frame with a diamond die |
| `src/terminal/components/icons/AirgapIcon.jsx` (create) | Privacy: airgap enclave |
| `src/terminal/components/icons/LatticeIcon.jsx` (create) | Cryptography: hidden lattice point |
| `src/terminal/components/icons/EarthshineMoonIcon.jsx` (create) | Lunar: waxing crescent with an earthshine limb |
| `src/terminal/components/icons/__tests__/navGlyphs.test.jsx` (modify) | Add the four to `describe.each` |
| `src/terminal/App.jsx` (modify) | Remove the lucide import; add 4 imports; 4 desktop + 4 mobile swaps |
| `src/terminal/components/CascadeIcon.jsx` (modify, comment only) | Neighbour-agnostic comment |
| `src/terminal/components/icons/ScentGlyph.jsx` (modify, comment only) | Neighbour-agnostic comment |
| `package.json` (maybe modify) | Lower the ratchet if the warning count falls |

Task 3 (the live check) is run by the controller with the headless CDP script, not by a subagent.

---

### Task 1: The four tier-4 glyph components

**Files:**
- Create: `src/terminal/components/icons/KernelCoreIcon.jsx`
- Create: `src/terminal/components/icons/AirgapIcon.jsx`
- Create: `src/terminal/components/icons/LatticeIcon.jsx`
- Create: `src/terminal/components/icons/EarthshineMoonIcon.jsx`
- Modify: `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: four default exports, each `React.forwardRef(({ className, ...props }, ref) => <svg …/>)`, with `displayName` equal to the export name: `KernelCoreIcon`, `AirgapIcon`, `LatticeIcon`, `EarthshineMoonIcon`. Usage: `<KernelCoreIcon className="w-3 h-3" />`.

- [ ] **Step 1.1: Extend the failing test**

In `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`, after the line `import LedgerSealIcon from '../LedgerSealIcon';` add:

```jsx
import KernelCoreIcon from '../KernelCoreIcon';
import AirgapIcon from '../AirgapIcon';
import LatticeIcon from '../LatticeIcon';
import EarthshineMoonIcon from '../EarthshineMoonIcon';
```

and in the `describe.each([...])` array, after the entry `['LedgerSealIcon', LedgerSealIcon],` add:

```jsx
  ['KernelCoreIcon', KernelCoreIcon],
  ['AirgapIcon', AirgapIcon],
  ['LatticeIcon', LatticeIcon],
  ['EarthshineMoonIcon', EarthshineMoonIcon],
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/components/icons/__tests__/navGlyphs.test.jsx`
Expected: FAIL. One of the four new imports fails to resolve (e.g. `Failed to resolve import "../KernelCoreIcon"`).

- [ ] **Step 1.3: Write the four components**

Create `src/terminal/components/icons/KernelCoreIcon.jsx`:

```jsx
// KernelCoreIcon.jsx — the KERNEL nav glyph.
//
// A processor package with its bus pins, but the die at its centre is a
// diamond, not the generic square of every chip icon: this is the kernel
// that compiles the site's lore into running code, not any CPU. The old
// `Cpu` was that generic chip, stroke for stroke.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const KernelCoreIcon = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    {/* the package frame */}
    <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    {/* the diamond die */}
    <path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z" />
    {/* the bus pins, two per side */}
    <path d="M9 1.5v2.5M15 1.5v2.5M9 20v2.5M15 20v2.5M1.5 9h2.5M1.5 15h2.5M20 9h2.5M20 15h2.5" />
  </svg>
));

KernelCoreIcon.displayName = 'KernelCoreIcon';

export default KernelCoreIcon;
```

Create `src/terminal/components/icons/AirgapIcon.jsx`:

```jsx
// AirgapIcon.jsx — the PRIVACY nav glyph.
//
// The airgap enclave: a hexagonal wall broken by one physical gap, and
// inside it a sovereign node that nothing touches. The gap is honest (the
// tab discloses every vector that does reach the visitor), but it doesn't
// reach the node. The old `Lock` was a checkout-button padlock.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const AirgapIcon = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    {/* the enclave wall, broken on the right by the airgap */}
    <path d="M19.79 9.6V7.5L12 3 4.21 7.5v9L12 21l7.79-4.5v-2.1" />
    {/* the sovereign node, untouched */}
    <path d="M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" />
  </svg>
));

AirgapIcon.displayName = 'AirgapIcon';

export default AirgapIcon;
```

Create `src/terminal/components/icons/LatticeIcon.jsx`:

```jsx
// LatticeIcon.jsx — the CRYPTOGRAPHY nav glyph.
//
// The hidden lattice point: ML-KEM, the key-encapsulation scheme the tab
// runs, is lattice-based, and its secret is a point hidden in a lattice.
// Eight lattice points, and the ringed one at the centre. The old
// `KeyRound` was a door key, an odd emblem for post-quantum cryptography.
// The dots are zero-length subpaths that the round caps turn into points.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const LatticeIcon = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    {/* the lattice */}
    <path d="M5 5h0M12 5h0M19 5h0M5 12h0M19 12h0M5 19h0M12 19h0M19 19h0" />
    {/* the hidden point */}
    <path d="M12 12h0" />
    {/* the ring that marks it */}
    <circle cx="12" cy="12" r="3.5" />
  </svg>
));

LatticeIcon.displayName = 'LatticeIcon';

export default LatticeIcon;
```

Create `src/terminal/components/icons/EarthshineMoonIcon.jsx`:

```jsx
// EarthshineMoonIcon.jsx — the LUNAR nav glyph.
//
// A waxing crescent, lit on the right, with the rest of the disc drawn in
// earthshine: a faint 1px limb, so the glyph reads as a whole moon in
// transit rather than the weather-app crescent the old `Moon` was. The tab
// computes the true phase; this is the phase the glyph shows.
//
// The earthshine path is deliberately 1px at 55% opacity, the one stroke in
// the nav bar that is not 2px. At 2px it reads as a full disc and the
// crescent disappears. Do not normalise it.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const EarthshineMoonIcon = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    {/* the waxing crescent, lit on the right */}
    <path d="M12 3a9 9 0 0 1 0 18a5 9 0 0 0 0-18z" />
    {/* the dark limb, in earthshine */}
    <path d="M12 3a9 9 0 0 0 0 18" strokeWidth="1" opacity="0.55" />
  </svg>
));

EarthshineMoonIcon.displayName = 'EarthshineMoonIcon';

export default EarthshineMoonIcon;
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/components/icons`
Expected: PASS, 34 tests (navGlyphs 8 glyphs × 4 = 32, plus ScentGlyph 2). Output must be free of React warnings.

- [ ] **Step 1.5: Lint the icons directory**

Run: `npx eslint src/terminal/components/icons --ext js,jsx`
Expected: no errors, no warnings.

- [ ] **Step 1.6: Commit**

Check `git diff --cached --stat` shows exactly these 5 files before committing.

```bash
git add src/terminal/components/icons/KernelCoreIcon.jsx src/terminal/components/icons/AirgapIcon.jsx src/terminal/components/icons/LatticeIcon.jsx src/terminal/components/icons/EarthshineMoonIcon.jsx src/terminal/components/icons/__tests__/navGlyphs.test.jsx
git commit -m "feat(nav): tier-4 glyphs: kernel core, airgap, lattice, earthshine moon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the tier-4 glyphs into both navs, and clean up

**Files:**
- Modify: `src/terminal/App.jsx` (line 12 lucide import; the icons import block after `import LedgerSealIcon …`; desktop nav ~1146, 1156, 1160, 1173; mobile nav ~1396, 1411, 1417, 1429)
- Modify: `src/terminal/components/CascadeIcon.jsx:9` (comment)
- Modify: `src/terminal/components/icons/ScentGlyph.jsx:6` (comment)
- Maybe modify: `package.json:9` (`--max-warnings`)

**Interfaces:**
- Consumes: the four default exports from Task 1 (`KernelCoreIcon`, `AirgapIcon`, `LatticeIcon`, `EarthshineMoonIcon`), each taking `className`.
- Produces: nothing new for later tasks.

- [ ] **Step 2.1: Measure the lint baseline**

Run: `npx eslint . --ext js,jsx --report-unused-disable-directives 2>&1 | tail -3`
Expected: `0 errors`, with W warnings. Record W (expected ≤ 143).

- [ ] **Step 2.2: Swap the imports**

In `src/terminal/App.jsx`, delete the whole line 12:

```jsx
import { Cpu, Lock, KeyRound, Moon } from 'lucide-react';
```

and directly after the existing line `import LedgerSealIcon from './components/icons/LedgerSealIcon';` add:

```jsx
import KernelCoreIcon from './components/icons/KernelCoreIcon';
import AirgapIcon from './components/icons/AirgapIcon';
import LatticeIcon from './components/icons/LatticeIcon';
import EarthshineMoonIcon from './components/icons/EarthshineMoonIcon';
```

- [ ] **Step 2.3: Swap the desktop nav glyphs (`w-3 h-3`)**

Exact-string replacements in `src/terminal/App.jsx`. Each old string occurs exactly once:

- `<Cpu className="w-3 h-3" /> /Kernel</button>` → `<KernelCoreIcon className="w-3 h-3" /> /Kernel</button>`
- `<Lock className="w-3 h-3" /> /Privacy</button>` → `<AirgapIcon className="w-3 h-3" /> /Privacy</button>`
- `<KeyRound className="w-3 h-3" /> /Cryptography</button>` → `<LatticeIcon className="w-3 h-3" /> /Cryptography</button>`
- `<Moon className="w-3 h-3" /> /Lunar</button>` → `<EarthshineMoonIcon className="w-3 h-3" /> /Lunar</button>`

- [ ] **Step 2.4: Swap the mobile nav glyphs (`w-5 h-5`)**

Each old string occurs exactly once in `src/terminal/App.jsx`:

- `<Cpu className="w-5 h-5" />` → `<KernelCoreIcon className="w-5 h-5" />`
- `<Lock className="w-5 h-5" />` → `<AirgapIcon className="w-5 h-5" />`
- `<KeyRound className="w-5 h-5" />` → `<LatticeIcon className="w-5 h-5" />`
- `<Moon className="w-5 h-5" />` → `<EarthshineMoonIcon className="w-5 h-5" />`

- [ ] **Step 2.5: Confirm no lucide is left in App.jsx**

Run: `grep -n "lucide-react\|<Cpu\|<Lock\b\|<Lock \|<KeyRound\|<Moon" src/terminal/App.jsx`
Expected: no output.

- [ ] **Step 2.6: Make the two neighbour comments neighbour-agnostic**

`src/terminal/components/CascadeIcon.jsx:9`:
- old: `// currentColor) so it sits flush beside Lock / KeyRound / Moon`
- new: `// currentColor) so it sits flush beside the other nav glyphs`

`src/terminal/components/icons/ScentGlyph.jsx:6`:
- old: `// this sits correctly beside <Lock>, <KeyRound> and <Moon> in the same nav row.`
- new: `// this sits correctly beside the other glyphs in the same nav row.`

Read the lines around each edit and check that the sentence still reads correctly.

- [ ] **Step 2.7: Run the full test suite**

Run: `npx vitest run`
Expected: everything passes except the known pre-existing failure `src/terminal/art/__tests__/artComposite.test.js > compositeDpr > caps a coarse pointer at 1…` (expects 1, gets 1.5; not this branch's). If it has been fixed on this base, it will simply pass. If anything ELSE fails, do NOT `git stash` or `git checkout` to compare. Report the failing test names and output, and say whether the file imports `App.jsx` or anything this task touched.

- [ ] **Step 2.8: Lint and adjust the ratchet**

Run: `npx eslint . --ext js,jsx --report-unused-disable-directives 2>&1 | tail -3`
Expected: 0 errors, W' ≤ W. If W' < W, set `--max-warnings` in `package.json` line 9 to W'. Then run `npm run lint`.
Expected: exit 0.

- [ ] **Step 2.9: Build**

Run: `npx vite build 2>&1 | tail -5`
Expected: the build succeeds.

- [ ] **Step 2.10: Commit**

Check `git diff --cached --stat` shows only the files below.

```bash
git add src/terminal/App.jsx src/terminal/components/CascadeIcon.jsx src/terminal/components/icons/ScentGlyph.jsx
git add package.json   # only if Step 2.8 changed it
git commit -m "feat(nav): swap in the tier-4 glyphs; the nav bar is lucide-free

Kernel Cpu -> KernelCoreIcon, Privacy Lock -> AirgapIcon, Cryptography
KeyRound -> LatticeIcon, Lunar Moon -> EarthshineMoonIcon, on desktop and
mobile. Neighbour comments no longer name specific icons.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Live check at real size (controller)

- [ ] **Step 3.1:** `preview_start` name `scale94-dev-5175` (port 5174 belongs to another session).
- [ ] **Step 3.2:** Run the scratchpad `navshots.mjs` into a fresh output directory. It waits for the boot, holds a touch for the mobile nav, and waits for the mobile nav width to reach 375. Change its active-state loop to `['Kernel','Privacy','Cryptography','Lunar']`, and its centring probe to include those four. Kernel is active on load, so for Kernel's inactive state, click another tab first.
- [ ] **Step 3.3:** Read every screenshot. Pass, judged by eye at real size: the lattice dots survive at 12px; the earthshine limb is faint but present on desktop and clearly visible on mobile; the airgap stays open; the diamond die stays distinct from the frame; centring is ≤0.5px for all four.
- [ ] **Step 3.4:** `preview_stop`. Send the screenshots to the user with a one-line verdict per glyph. The user makes the final by-eye call. No push, no merge.
