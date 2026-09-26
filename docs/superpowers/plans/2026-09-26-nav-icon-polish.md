# Nav Icon Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace four stock or Unicode nav glyphs (Surveillance, Ecocide, Transmission, Ledger) with bespoke SVG glyphs that draw what each tab does.

**Architecture:** Four small presentational components in `src/terminal/components/icons/`, each a `forwardRef` SVG written to lucide-react's grammar so it drops in where the lucide icon or text glyph was. `App.jsx` swaps them into both the desktop nav (`w-3 h-3`) and the mobile nav (`w-5 h-5`); button classes and colours are untouched, and the glyphs inherit colour through `currentColor`.

**Tech Stack:** React 18 + Vite, Tailwind, vitest + @testing-library/react, ESLint with a warnings ratchet.

**Spec:** `docs/superpowers/specs/2026-09-26-nav-icon-polish-design.md`

## Global Constraints

- SVG grammar for every glyph: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`, `className` and extra props forwarded, `React.forwardRef` + `displayName`.
- Legibility budget: at most 5 drawn elements (`path` + `circle`) per glyph, no filled shapes.
- Nav only, desktop and mobile. Do not touch in-tab glyphs: `ShieldAlert` in SurveillanceTab/PrivacyTab, `⌖` in TransmissionTab/InverseEngine/CouncilRing, `ᛟ` in KernelTab/ReliquaryView/EcocideTab, `Radio` in ArtTab/BskyTab.
- Do not move `AccretionIcon`, `CascadeIcon` or `NavButterflyIcon`. Tier 4 (Kernel/Privacy/Cryptography/Lunar) is out of scope.
- Lint: 0 errors, and the warning count must not rise. If it falls, lower `--max-warnings` in `package.json` to the new measured count, so the ratchet keeps ratcheting.
- The working tree carries ~140 pre-existing unrelated changes (baselines, snapshots, `.import-cache.json`). Stage only the files each task names. Never `git add -A` or `git commit -a`.
- Do not push. Pushing needs an explicit instruction from the user.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/components/icons/InterceptIcon.jsx` (create) | Surveillance glyph: the tap |
| `src/terminal/components/icons/SeraphineScaleIcon.jsx` (create) | Ecocide glyph: the world on the cradle beam |
| `src/terminal/components/icons/PacketIcon.jsx` (create) | Transmission glyph: a packet with a two-line slipstream |
| `src/terminal/components/icons/LedgerSealIcon.jsx` (create) | Ledger glyph: river, rules, seal |
| `src/terminal/components/icons/__tests__/navGlyphs.test.jsx` (create) | One parameterised contract test covering all four |
| `src/terminal/App.jsx` (modify) | Imports; 4 desktop + 4 mobile nav swaps |
| `src/terminal/components/CascadeIcon.jsx` (modify, comment only) | Drop stale "Hexagon / Leaf" neighbour names |
| `src/terminal/components/icons/ScentGlyph.jsx` (modify, comment only) | Drop the stale `<Radio>` neighbour name |
| `package.json` (maybe modify) | Lower `--max-warnings` if the count falls |

Deviation from spec §5: the spec says "one test file per glyph". The four glyphs share
one contract, so a single `describe.each` file asserts it once per glyph. The coverage
is the same, without four copy-pasted files. Step 1.6 amends the spec line to match.

---

### Task 1: The four glyph components

**Files:**
- Create: `src/terminal/components/icons/InterceptIcon.jsx`
- Create: `src/terminal/components/icons/SeraphineScaleIcon.jsx`
- Create: `src/terminal/components/icons/PacketIcon.jsx`
- Create: `src/terminal/components/icons/LedgerSealIcon.jsx`
- Test: `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`
- Modify: `docs/superpowers/specs/2026-09-26-nav-icon-polish-design.md` (§5 test-file line)

**Interfaces:**
- Consumes: nothing.
- Produces: four default exports, each `React.forwardRef(({ className, ...props }, ref) => <svg …/>)`, with `displayName` equal to the export name: `InterceptIcon`, `SeraphineScaleIcon`, `PacketIcon`, `LedgerSealIcon`. Usage: `<InterceptIcon className="w-3 h-3" />`.

- [ ] **Step 1.1: Write the failing test**

Create `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import InterceptIcon from '../InterceptIcon';
import SeraphineScaleIcon from '../SeraphineScaleIcon';
import PacketIcon from '../PacketIcon';
import LedgerSealIcon from '../LedgerSealIcon';

// The nav-glyph contract (spec 2026-09-26 §1, §5): each glyph is a drop-in for
// a lucide icon, and stays legible at w-3 h-3. The budget is asserted rather
// than commented, so detail creep fails CI instead of blurring the nav.
describe.each([
  ['InterceptIcon', InterceptIcon],
  ['SeraphineScaleIcon', SeraphineScaleIcon],
  ['PacketIcon', PacketIcon],
  ['LedgerSealIcon', LedgerSealIcon],
])('%s', (name, Glyph) => {
  it('renders one svg that forwards className, like a lucide icon', () => {
    const { container } = render(<Glyph className="w-3 h-3" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
    expect(svgs[0].getAttribute('class')).toBe('w-3 h-3');
    expect(svgs[0].getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svgs[0].getAttribute('stroke')).toBe('currentColor');
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('forwards a ref to the svg element', () => {
    const ref = React.createRef();
    render(<Glyph ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current.tagName.toLowerCase()).toBe('svg');
  });

  it('is legible at 12px: at most 5 drawn elements, nothing filled', () => {
    const { container } = render(<Glyph />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('fill')).toBe('none');
    const drawn = svg.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(5);
    drawn.forEach((el) => {
      const fill = el.getAttribute('fill');
      expect(fill === null || fill === 'none').toBe(true);
    });
  });

  it('carries its own name for React devtools', () => {
    expect(Glyph.displayName).toBe(name);
  });
});
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/components/icons/__tests__/navGlyphs.test.jsx`
Expected: FAIL. The imports fail to resolve (`Failed to resolve import "../InterceptIcon"`).

- [ ] **Step 1.3: Write the four components**

Create `src/terminal/components/icons/InterceptIcon.jsx`:

```jsx
// InterceptIcon.jsx — the SURVEILLANCE nav glyph.
//
// The tap: a packet's route runs through an intercept node and still
// arrives, while a copy of it drops away to where it is kept. That is what
// the tab's intercept lattice does to every route the laws in force touch.
// The old `ShieldAlert` said "warning"; this tab is about interception.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const InterceptIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the route in */}
    <path d="M2 9h7" />
    {/* the route out: the packet still arrives */}
    <path d="M15 9h7" />
    {/* the intercept node */}
    <circle cx="12" cy="9" r="3" />
    {/* the tapped copy, dropping away */}
    <path d="M12 12v7" />
    {/* where the copy is kept */}
    <path d="M8.5 21h7" />
  </svg>
));

InterceptIcon.displayName = 'InterceptIcon';

export default InterceptIcon;
```

Create `src/terminal/components/icons/SeraphineScaleIcon.jsx`:

```jsx
// SeraphineScaleIcon.jsx — the ECOCIDE nav glyph.
//
// Seraphine's Scale: the world resting on the curved beam that cradles it,
// the same sagging-curve family SeraphineScale.jsx draws over the map. The
// beam tips at collapse and holds level through bloom. The old `Leaf` was
// the green cliché the tab's degrowth gate argues against.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const SeraphineScaleIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the world */}
    <circle cx="12" cy="10" r="6.5" />
    {/* the cradle beam */}
    <path d="M2 18.5Q12 22 22 18.5" />
  </svg>
));

SeraphineScaleIcon.displayName = 'SeraphineScaleIcon';

export default SeraphineScaleIcon;
```

Create `src/terminal/components/icons/PacketIcon.jsx`:

```jsx
// PacketIcon.jsx — the TRANSMISSION nav glyph.
//
// A packet in flight: one diamond heading out, with a split slipstream
// behind it. The tab is a dispatch pipeline (the inverse-extinction
// harvest, telemetry sent onward), so the glyph is directional, not
// broadcast. It replaces the desktop `⌖` text and the mobile `Radio`, which
// never matched. Two wake lines, not three: a longer middle line made the
// wake converge into a fast-forward chevron at 12px.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const PacketIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the split slipstream */}
    <path d="M2 9h7" />
    <path d="M2 15h7" />
    {/* the packet, heading out */}
    <path d="M17 6.5l5.5 5.5-5.5 5.5-5.5-5.5z" />
  </svg>
));

PacketIcon.displayName = 'PacketIcon';

export default PacketIcon;
```

Create `src/terminal/components/icons/LedgerSealIcon.jsx`:

```jsx
// LedgerSealIcon.jsx — the LEDGER nav glyph.
//
// A river written into the ledger: the site a visitor submits, flowing over
// ruled lines, and the newest entry, short and still being written, with
// its verdict's seal pressed into the gap beside it. It replaces the `ᛟ`
// text glyph, which rendered in whatever font the browser picked, so its
// weight never matched the bar. ᛟ stays in-tab as the axiomatic-law marker.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const LedgerSealIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the river */}
    <path d="M3 6q2.25-3.5 4.5 0t4.5 0t4.5 0t4.5 0" />
    {/* a ruled ledger line */}
    <path d="M3 12h18" />
    {/* the newest entry, still being written */}
    <path d="M3 19h9" />
    {/* its seal */}
    <circle cx="18.5" cy="19" r="2.5" />
  </svg>
));

LedgerSealIcon.displayName = 'LedgerSealIcon';

export default LedgerSealIcon;
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/components/icons/__tests__/navGlyphs.test.jsx`
Expected: PASS, 16 tests (4 glyphs × 4 cases).

Also re-run the neighbouring glyph test to confirm the directory is still green:
Run: `npx vitest run src/terminal/components/icons`
Expected: PASS (navGlyphs 16 + ScentGlyph 2).

- [ ] **Step 1.5: Lint the new files**

Run: `npx eslint src/terminal/components/icons --ext js,jsx`
Expected: no errors and no warnings.

- [ ] **Step 1.6: Amend the spec's test-file line**

In `docs/superpowers/specs/2026-09-26-nav-icon-polish-design.md` §5, replace:

```
- **Unit, one test file per glyph** in `src/terminal/components/icons/__tests__/`,
  following `ScentGlyph.test.jsx`:
```

with:

```
- **Unit, one parameterised test** (`describe.each` over the four glyphs) in
  `src/terminal/components/icons/__tests__/navGlyphs.test.jsx`, following
  `ScentGlyph.test.jsx`:
```

- [ ] **Step 1.7: Commit**

```bash
git add src/terminal/components/icons/InterceptIcon.jsx src/terminal/components/icons/SeraphineScaleIcon.jsx src/terminal/components/icons/PacketIcon.jsx src/terminal/components/icons/LedgerSealIcon.jsx src/terminal/components/icons/__tests__/navGlyphs.test.jsx docs/superpowers/specs/2026-09-26-nav-icon-polish-design.md
git commit -m "feat(nav): four bespoke nav glyphs — intercept, Seraphine's scale, packet, ledger seal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the glyphs into both navs, and clean up

**Files:**
- Modify: `src/terminal/App.jsx` (line 12 import; ~16 imports block; desktop nav lines ~1148, 1154, 1160, 1167; mobile nav lines ~1401, 1410, 1419, 1423)
- Modify: `src/terminal/components/CascadeIcon.jsx:9` (comment)
- Modify: `src/terminal/components/icons/ScentGlyph.jsx:6` (comment)
- Maybe modify: `package.json:9` (`--max-warnings`)

**Interfaces:**
- Consumes: the four default exports from Task 1 (`InterceptIcon`, `SeraphineScaleIcon`, `PacketIcon`, `LedgerSealIcon`), each taking `className`.
- Produces: nothing new for later tasks. Task 3 inspects the rendered navs.

- [ ] **Step 2.1: Measure the lint baseline**

Run: `npx eslint . --ext js,jsx --report-unused-disable-directives 2>&1 | tail -3`
Expected: a summary line like `✖ N problems (0 errors, W warnings)`. Record W. W must be ≤ the `--max-warnings` value in `package.json`.

- [ ] **Step 2.2: Swap the imports**

In `src/terminal/App.jsx`, replace line 12:

```jsx
import { Hexagon, Cpu, Lock, ShieldAlert, KeyRound, Radio, Leaf, Moon } from 'lucide-react';
```

with:

```jsx
import { Cpu, Lock, KeyRound, Moon } from 'lucide-react';
```

and directly after the existing line `import ScentGlyph from './components/icons/ScentGlyph';` add:

```jsx
import InterceptIcon from './components/icons/InterceptIcon';
import SeraphineScaleIcon from './components/icons/SeraphineScaleIcon';
import PacketIcon from './components/icons/PacketIcon';
import LedgerSealIcon from './components/icons/LedgerSealIcon';
```

- [ ] **Step 2.3: Swap the desktop nav glyphs (`w-3 h-3`)**

Four exact-string replacements in `src/terminal/App.jsx`. Each old string occurs once.

Transmission (~line 1148):
- old: `` `}>⌖ /Transmission</button> ``
- new: `` `}><PacketIcon className="w-3 h-3" /> /Transmission</button> ``

Surveillance (~line 1154):
- old: `<ShieldAlert className="w-3 h-3" /> /Surveillance</button>`
- new: `<InterceptIcon className="w-3 h-3" /> /Surveillance</button>`

Ecocide (~line 1160):
- old: `<Leaf className="w-3 h-3" /> /Ecocide</button>`
- new: `<SeraphineScaleIcon className="w-3 h-3" /> /Ecocide</button>`

Ledger (~line 1167):
- old: `<span style={{ fontSize: 12, lineHeight: 1 }}>ᛟ</span> /Ledger`
- new: `<LedgerSealIcon className="w-3 h-3" /> /Ledger`

The Transmission button has no flex layout, because it only ever held a text glyph. Without flex, the SVG sits on the text baseline and rides high. On the same line (~1148), make one more exact replacement, matching its neighbours:
- old: ``px-2 py-1 transition-all duration-300 uppercase rounded-sm whitespace-nowrap${beat('transmission')}``
- new: ``px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('transmission')}``

- [ ] **Step 2.4: Swap the mobile nav glyphs (`w-5 h-5`)**

In `src/terminal/App.jsx` mobile nav:
- `<Radio className="w-5 h-5" />` → `<PacketIcon className="w-5 h-5" />` (~line 1401)
- `<ShieldAlert className="w-5 h-5" />` → `<InterceptIcon className="w-5 h-5" />` (~line 1410)
- `<Leaf className="w-5 h-5" />` → `<SeraphineScaleIcon className="w-5 h-5" />` (~line 1419)
- `<span style={{ fontSize: 24, lineHeight: 1 }}>ᛟ</span></button>` → `<LedgerSealIcon className="w-5 h-5" /></button>` (~line 1423)

- [ ] **Step 2.5: Confirm nothing stale is left in App.jsx**

Run: `grep -n "ShieldAlert\|<Radio\|<Leaf\|Hexagon\|ᛟ\|⌖" src/terminal/App.jsx`
Expected: no output. If a hit remains, it is either a missed swap (fix it) or an in-tab/non-nav use (leave it and note it in the task report).

- [ ] **Step 2.6: Fix the two stale neighbour comments**

`src/terminal/components/CascadeIcon.jsx:9`:
- old: `// currentColor) so it sits flush beside Hexagon / Leaf / Lock / KeyRound`
- new: `// currentColor) so it sits flush beside Lock / KeyRound / Moon`

`src/terminal/components/icons/ScentGlyph.jsx:6`:
- old: `// this sits correctly beside <Lock>, <Radio> and <Moon> in the same nav row.`
- new: `// this sits correctly beside <Lock>, <KeyRound> and <Moon> in the same nav row.`

- [ ] **Step 2.7: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, with the same failures (if any) as `main`. If anything fails, check it with `git stash` against the pre-task state before blaming this change. The only new tests are the 16 from Task 1.

- [ ] **Step 2.8: Lint and adjust the ratchet**

Run: `npx eslint . --ext js,jsx --report-unused-disable-directives 2>&1 | tail -3`
Expected: 0 errors, and warnings W' ≤ W from Step 2.1. (Removing the unused `Hexagon` import likely drops one `no-unused-vars` warning.)
If W' < W, set `--max-warnings` in `package.json` line 9 to W'. Then run `npm run lint`.
Expected: exit 0.

- [ ] **Step 2.9: Build**

Run: `npx vite build 2>&1 | tail -5`
Expected: build succeeds, no unresolved-import errors.

- [ ] **Step 2.10: Commit**

```bash
git add src/terminal/App.jsx src/terminal/components/CascadeIcon.jsx src/terminal/components/icons/ScentGlyph.jsx
git add package.json   # only if Step 2.8 changed it
git commit -m "feat(nav): swap in the bespoke glyphs on desktop and mobile

Surveillance ShieldAlert -> InterceptIcon, Ecocide Leaf -> SeraphineScaleIcon,
Transmission ⌖/Radio -> PacketIcon (one glyph on both navs now), Ledger ᛟ text
-> LedgerSealIcon. Drops the unused Hexagon import.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Check `git diff --cached --stat` before committing: only the files listed above.

---

### Task 3: Live check at real size

**Files:** none changed unless a defect turns up. A defect fix gets its own commit in the file it touches.

**Interfaces:**
- Consumes: the wired navs from Task 2.
- Produces: screenshots for the user's eye judgment, which is the spec's pass condition.

- [ ] **Step 3.1: Start the dev server**

Use the `preview_start` tool with name `scale94-dev-5175`. Port 5174 belongs to another session's server; don't touch it.

- [ ] **Step 3.2: Wait out the boot reveal**

The app scales in from a collapsed state. Until `sys::boot_sequence` is gone plus about 2.6s, the nav measures at around 10×0 px. A hidden browser pane suspends rAF, so the reveal never finishes there. Keep the pane visible, or use the CDP recipe from the /SCENT GL collider memory (Chrome with `--enable-unsafe-swiftshader`).
Check with `javascript_tool`:

```js
JSON.stringify(document.querySelector('nav[aria-label="Main navigation"]').getBoundingClientRect())
```

Expected: width in the hundreds of px and height ≥ 20.

- [ ] **Step 3.3: Desktop screenshots**

1. With `resize_window` at a desktop width (≥ 1024), screenshot the nav with a non-affected tab active (for example Kernel), so all four new glyphs show in their inactive colours.
2. Click Transmission, Surveillance, Ecocide and Ledger in turn, and `zoom` on the nav after each click, so every new glyph is seen in its active state. Ledger's active state is a teal gradient with `text-black`. Confirm the seal and river show black on teal.

Pass: each glyph keeps its shape at 12px (the tap's node doesn't fill in, the seal ring stays open, the diamond stays distinct from the two wake lines), is vertically centred against its label, and reads as a sibling of Accretion and Chaos.

- [ ] **Step 3.4: Mobile screenshot**

`resize_window` preset `mobile` (375×812), reload, wait out the boot as in Step 3.2, then screenshot the bottom nav. Scroll it horizontally if needed to get Transmission, Surveillance, Ecocide and Ledger in view. Then `resize_window` preset `desktop` to reset.

Pass: the 20px glyphs are centred in their 56px cells, and the Ledger glyph matches its neighbours' visual weight. The old 24px `ᛟ` text ran heavier than they did.

- [ ] **Step 3.5: Report to the user**

Send the screenshots with one line per glyph: pass, or what looked off. The user makes the final by-eye call. Do not push and do not merge. Those decisions stay with the user.
