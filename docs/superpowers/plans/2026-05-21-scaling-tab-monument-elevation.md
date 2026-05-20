# ScalingTab Monument Elevation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform three sections of `src/terminal/views/ScalingTab.jsx` so the project's load-bearing claims (the Seraphine white paper thesis and the Bibliography) read as canonical monuments rather than cards-among-cards, while the dense terminal substrate of the RUN COMMAND MANUAL stays intact (just lightly marked).

**Architecture:** Pure CSS + JSX edits inside one file. Add a small "monument" style toolkit (one keyframe + five utility classes) to the existing `<style>` block in `ScalingTab.jsx`, then rewrite three JSX subtrees to consume those classes. No new files, no new fonts to download (the existing `Geist Sans` woff2 at weight 900 is already loaded via `src/index.css` and is the best fallback in the declared font chain; Inter sits at the head of the chain for any browser that already has it cached). No changes to other components.

**Tech Stack:** React 18, Vite, Tailwind (existing utilities), inline CSS in component `<style>` block (matches the file's existing pattern of 60+ lines of scoped keyframes/classes). Verification via `npm run dev` on port 5173.

**Spec reference:** `docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md` (commits `3add385`, `c48e634`, `576a3a0` on `nightly-20260520`).

**File map:**
- Modify: `src/terminal/views/ScalingTab.jsx` (lines 2, 97–165, 220–265, 267–275, 524–554) — all five edits land in this one file. The spec calls for a "minimum invasion" approach and this file is already the natural home for ScalingTab-scoped styles.

**Visual verification model:** This is a typographic / chromatic change. There is no unit test that can prove "the thesis reads as a monument." Each task ends with a manual visual check via the Vite dev server (`npm run dev` → `http://localhost:5173/` → click `S` to enter the ScalingTab from boot, or `load scaling` from a running terminal). The verification steps are explicit about what to look for.

**Why not Geist Sans directly:** The spec's font chain is `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`. We are *not* downloading Inter — if the user's browser has it cached (common on dev/design machines) it renders Inter; otherwise the chain walks to the OS system font at weight 900 (San Francisco on macOS, Segoe UI on Windows, etc.). Geist Sans is *not* in the chain because the monument is supposed to read as a different typographic register from the rest of the project (Geist Sans is used for UI chrome). The chain's tail is heavier than bare `system-ui` so layout shift during font resolve is bounded. This matches the spec exactly — no deviation.

---

## Task 1: Add monument CSS infrastructure

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx:97-165` (the existing `<style>` block at the top of the component return)

**Purpose:** Define one new keyframe (`sc-monumentReveal`) and five utility classes (`.sc-monument-marker`, `.sc-monument-eyebrow`, `.sc-monument-display`, `.sc-monument-display--emphasis`, `.sc-monument-accent`, `.sc-monument-subtitle`) so the three JSX rewrites in Tasks 2–4 can consume them without repeating inline styles.

- [ ] **Step 1: Read the current style block to confirm the insertion point**

Run:
```bash
sed -n '160,170p' F:/scale_9.4/src/terminal/views/ScalingTab.jsx
```
Expected: Line 164 ends with `.living-note { animation: sc-livingNote 800ms cubic-bezier(0.16,1,0.3,1) forwards; }` and line 165 is the closing `\`}</style>`. The new CSS goes immediately before line 165's closing backtick.

- [ ] **Step 2: Add the monument CSS block**

In `src/terminal/views/ScalingTab.jsx`, find this exact text near line 164:

```jsx
        .living-note { animation: sc-livingNote 800ms cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
```

Replace it with:

```jsx
        .living-note { animation: sc-livingNote 800ms cubic-bezier(0.16,1,0.3,1) forwards; }

        /* ── Monument pattern (Fade-Doctrine compliant) ──────────────────────
           Modernist typography moments for the project's load-bearing claims.
           Two-gold monochrome: #e8d28a (luminous, body) + #d4a82a (deep, emphasis).
           No pure white anywhere. No spin, no breath, no color cycle.
           Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md
           ──────────────────────────────────────────────────────────────────── */
        @keyframes sc-monumentReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .sc-monument-marker {
          font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 10px;
          color: #d4a82a;
          letter-spacing: 0.35em;
          text-transform: uppercase;
        }
        .sc-monument-eyebrow,
        .sc-monument-subtitle {
          font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 10px;
          color: rgba(6, 182, 212, 0.6);
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }
        .sc-monument-display {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.028em;
          text-wrap: balance;
          color: #e8d28a;
        }
        .sc-monument-display--thesis  { font-size: clamp(28px, 4.2vw, 52px); }
        .sc-monument-display--heading { font-size: clamp(36px, 5.5vw, 68px); }
        .sc-monument-display--emphasis { color: #d4a82a; }
        .sc-monument-accent {
          height: 2px;
          width: 80px;
          background: #d4a82a;
          border: 0;
        }
      `}</style>
```

- [ ] **Step 3: Visual sanity check — confirm no regression**

Run:
```bash
npm run dev
```
Open `http://localhost:5173/`. Pass through the boot/gate (or `reset_gate` then refresh if needed) and load the Scaling tab. **Expected:** The tab still renders exactly as before. The CSS additions only define classes that aren't yet consumed; visual output is unchanged. If the page errors or the existing animations break, the edit corrupted the style block — revert and re-do.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling-monument): add monument CSS toolkit

One keyframe (sc-monumentReveal, 1.5s opacity fade) and five utility
classes (sc-monument-marker, --eyebrow, --display with --thesis/--heading
size variants and --emphasis colour variant, --accent line, --subtitle).
Two-gold monochrome (#e8d28a body, #d4a82a emphasis). Inter font chain
with explicit fallbacks per spec.

No JSX consumers yet — that lands in Tasks 2-4.

Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md"
```

---

## Task 2: Transform the White Paper thesis into a monument

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx:220-265` (the Seraphine White Paper section)

**Purpose:** Strip the bordered fuchsia card. Replace with the bare monument structure: section marker → attribution eyebrow → three-line display (last line emphasis) → accent line → substrate subtitle → unchanged body terminal copy → gold "READ PAPER" button.

- [ ] **Step 1: Locate the exact current block**

Run:
```bash
sed -n '220,265p' F:/scale_9.4/src/terminal/views/ScalingTab.jsx
```
Expected: First line is `      {/* ── Seraphine-8.8.8.8.8.8.8.8 White Paper ── */}`, last line is `      </div>`.

- [ ] **Step 2: Replace the section**

In `src/terminal/views/ScalingTab.jsx`, find this exact block (lines 220–265):

```jsx
      {/* ── Seraphine-8.8.8.8.8.8.8.8 White Paper ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.65s forwards' }}
      >
        <div className="border border-fuchsia-500/40 bg-black/60 p-8 rounded-lg hover:border-fuchsia-400/70 transition-all group relative overflow-hidden max-w-2xl mx-auto"
          style={{ animation: 'sc-borderBreath 7s ease-in-out 1s infinite' }}
        >
          <div className="absolute top-0 right-0 bg-fuchsia-500/10 text-fuchsia-400 text-[9px] font-bold px-3 py-1.5 uppercase tracking-wider border-l border-b border-fuchsia-500/30">
            WHITE PAPER · ARS ELECTRONICA 2027
          </div>

          <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Cpu className="w-3 h-3" /> SERAPHINE-8.8.8.8.8.8.8.8 · FADE_DOCTRINE · MERCURY TERMINAL
          </div>

          <h3 className="text-xl font-bold mb-5 leading-tight tracking-tight" style={{ opacity: 0, animation: 'sc-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) 1.3s both, sc-headColorAlt 11s ease-in-out 0.5s infinite' }}>
            The most compelling analogy<br />has the weakest geometry.
          </h3>

          <div className="space-y-3 mb-6">
            <p className="text-sm text-[#39ff14]/90 leading-relaxed">
              Three cross-domain analogy pairs. Feature vectors from primary literature. Cosine similarity measured in 16 dimensions.
              The pair with the strongest narrative — Bouligand rotation ↔ ML-KEM-768 — scores <span className="text-fuchsia-400 font-bold">0.611</span>.
              The pair that resists every intuitive description — twisted bilayer graphene ↔ cognitive flow — scores <span className="text-cyan-400 font-bold">0.863</span>.
            </p>
            <p className="text-sm text-cyan-400/60 leading-relaxed font-mono">
              Narrative compellingness and geometric similarity are negatively correlated.<br />
              This is the result. This is the architecture that found it.
            </p>
          </div>

          <div className="flex items-center gap-6 text-[10px] font-mono text-cyan-600/50 mb-6">
            <span>Seraphine SARG · Lindblad decoherence</span>
            <span className="text-fuchsia-600/40">·</span>
            <span>Bone Fusion v7.7.7.7.7.7.7 · Bouligand 36° + Magic Angle 1.1°</span>
          </div>

          <button
            onClick={() => loadKernel && loadKernel('FADE-DOCTRINE-KERNEL-2.0.0')}
            className="flex items-center gap-2 text-xs font-bold text-fuchsia-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-fuchsia-200"
          >
            <ChevronRight className="w-4 h-4" /> READ PAPER
          </button>
        </div>
      </div>
```

Replace it with:

```jsx
      {/* ── § · The Thesis (Seraphine White Paper Monument) ──
          Spec: 2026-05-21-scaling-tab-monument-elevation-design.md
          Card chrome removed. Display sentence is Inter Black 900 across
          three lines; last line "weakest geometry." in #d4a82a emphasis.
          Attribution eyebrow above (document attribution); substrate subtitle
          below accent line (signature). Body + CTA in terminal palette. */}
      <div
        className="border-t border-cyan-900/30 max-w-3xl mx-auto"
        style={{
          opacity: 0,
          paddingTop: '80px',
          marginBottom: '48px',
          animation: 'sc-monumentReveal 1.5s ease-out 0.65s forwards',
        }}
      >
        <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · the thesis</div>
        <div className="sc-monument-eyebrow" style={{ marginBottom: '28px' }}>white paper · ars electronica 2027</div>

        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '6px' }}>The most compelling</div>
        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '6px' }}>analogy has the</div>
        <div className="sc-monument-display sc-monument-display--thesis sc-monument-display--emphasis" style={{ marginBottom: '24px' }}>weakest geometry.</div>

        <div className="sc-monument-accent" style={{ marginBottom: '22px' }} />

        <div className="sc-monument-subtitle" style={{ marginBottom: '20px' }}>Seraphine-8.8.8.8.8.8.8.8 · Fade Doctrine · Mercury Terminal</div>

        <div className="space-y-3 mb-6">
          <p className="text-sm text-[#39ff14]/90 leading-relaxed">
            Three cross-domain analogy pairs. Feature vectors from primary literature. Cosine similarity measured in 16 dimensions.
            The pair with the strongest narrative — Bouligand rotation ↔ ML-KEM-768 — scores <span className="text-fuchsia-400 font-bold">0.611</span>.
            The pair that resists every intuitive description — twisted bilayer graphene ↔ cognitive flow — scores <span className="text-cyan-400 font-bold">0.863</span>.
          </p>
          <p className="text-sm text-cyan-400/60 leading-relaxed font-mono">
            Narrative compellingness and geometric similarity are negatively correlated.<br />
            This is the result. This is the architecture that found it.
          </p>
        </div>

        <div className="flex items-center gap-6 text-[10px] font-mono text-cyan-600/50 mb-6">
          <span>Seraphine SARG · Lindblad decoherence</span>
          <span style={{ color: 'rgba(212,168,42,0.4)' }}>·</span>
          <span>Bone Fusion v7.7.7.7.7.7.7 · Bouligand 36° + Magic Angle 1.1°</span>
        </div>

        <button
          onClick={() => loadKernel && loadKernel('FADE-DOCTRINE-KERNEL-2.0.0')}
          className="flex items-center gap-2 text-xs font-mono font-bold transition-transform cursor-pointer hover:translate-x-1"
          style={{ color: '#d4a82a', letterSpacing: '0.1em' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#e8d28a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#d4a82a'; }}
        >
          <ChevronRight className="w-4 h-4" /> READ PAPER
        </button>
      </div>
```

Notes on what changed:
- Outer wrapper: kept `border-t border-cyan-900/30` (preserves the section separator from above) and `max-w-3xl mx-auto` (widened slightly from `max-w-2xl` to accommodate the larger display type). `pt-8 mb-8` replaced with inline `paddingTop: 80px; marginBottom: 48px` per spec breathing rules.
- Animation: `sc-cardReveal 0.6s ... forwards` → `sc-monumentReveal 1.5s ease-out 0.65s forwards`. Same delay (0.65s) so the section arrival timing relative to other sections is preserved; only the keyframe and duration change.
- Inner card removed entirely (border, bg, rounded-lg, breath animation, hover state).
- Corner stamp removed; "WHITE PAPER · ARS ELECTRONICA 2027" now sits in the attribution eyebrow above the display.
- Old `<Cpu />` icon line removed; Seraphine signature moves below the accent line as the substrate subtitle (no icon).
- Old `<h3>` with `sc-headColorAlt` infinite colour cycle removed; replaced with three `<div>`s using monument display classes. The fuchsia-pink "geometry" emphasis becomes deep gold `#d4a82a`.
- Fuchsia separator dot `·` between SARG and Bone Fusion footer recoloured to a low-opacity gold tint so the terminal-mono footer line doesn't read as a fuchsia callback to the deleted card.
- "READ PAPER" button: was fuchsia → now deep gold (`#d4a82a`), with hover deepening to luminous gold (`#e8d28a`). Added `font-mono` and explicit `letterSpacing` for the terminal-CTA register.

- [ ] **Step 3: Visual verification**

Run (if dev server isn't already running):
```bash
npm run dev
```
Reload `http://localhost:5173/`, navigate to the Scaling tab.

**What to look for:**
1. The thesis section sits below the LatentCollider and Architect Thesis card, separated by the cyan border-t.
2. No fuchsia card. No corner stamp. No animated colour-cycling thesis sentence.
3. Top of section: tiny gold mono "§ · THE THESIS" with wide letter-spacing.
4. Below that: tiny cyan mono "WHITE PAPER · ARS ELECTRONICA 2027".
5. Then three lines of massive heavy gold display type:
   - "The most compelling" (luminous gold)
   - "analogy has the" (luminous gold)
   - "weakest geometry." (deeper gold — visibly darker than the first two)
6. A short horizontal gold bar (~80px) below the display.
7. Below that: tiny cyan mono "Seraphine-8.8.8.8.8.8.8.8 · Fade Doctrine · Mercury Terminal".
8. The green/cyan paragraph body is unchanged.
9. The READ PAPER button is gold (not fuchsia); hover brightens it.
10. On mount, the whole section fades in over ~1.5s with NO vertical motion, NO blur, NO colour cycle.

If any of those fail, do not proceed — diagnose the regression. Most likely cause: a class name mismatch with what was defined in Task 1.

- [ ] **Step 4: Test at narrow width**

In Chrome DevTools, toggle device toolbar (Ctrl+Shift+M) and test at:
- 320px wide: thesis should break naturally; `text-wrap: balance` will redistribute. Display drops to clamp() minimum (28px) — still reads as monument.
- 768px (tablet): display sits mid-range (~32px).
- 1280px (desktop): display at maximum (52px).

Expected: At every width, the three thesis lines remain visually distinct from the body terminal copy. No horizontal scroll. No text clipping.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling-monument): elevate Seraphine thesis to monument

Strip the bordered fuchsia card. Thesis sentence becomes the monument:
three-line Inter Black 900 display, last line in #d4a82a emphasis,
80px gold accent line, substrate subtitle below.

- Card chrome removed (border, bg, rounded-lg, breath animation)
- Corner stamp replaced with attribution eyebrow above display
- Cpu icon removed; Seraphine signature moves below accent line
- Animated colour-cycling h3 → still three-line display
- READ PAPER button: fuchsia → gold (with hover deepen)
- Footer separator dot recoloured to gold tint
- Animation: sc-cardReveal → sc-monumentReveal (1.5s opacity fade,
  no transform/blur/colour)
- Outer width: max-w-2xl → max-w-3xl to accommodate display type
- Section breathing: pt-8 mb-8 → pt-80px mb-48px per spec

Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md"
```

---

## Task 3: Add § marker above RUN COMMAND MANUAL

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx:267-275` (the RUN COMMAND MANUAL section header)

**Purpose:** Add one line — the section marker — above the existing terminal heading. No other change to this section. The spec is explicit that this is *not* a monument moment; the marker alone supplies the rhythmic anchor between the thesis monument above and the bibliography monument below.

- [ ] **Step 1: Locate the exact current header**

Run:
```bash
sed -n '267,275p' F:/scale_9.4/src/terminal/views/ScalingTab.jsx
```
Expected: First line is the comment `{/* ── RUN COMMAND MANUAL V2.2 ── */}`, contains a `<div className="mb-5">` wrapper around the title.

- [ ] **Step 2: Insert the marker**

In `src/terminal/views/ScalingTab.jsx`, find this exact text:

```jsx
        <div className="mb-5">
          <div className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-1" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.45s both, sc-headColor 9s ease-in-out 3s infinite' }}>RUN COMMAND MANUAL V2.2</div>
          <div className="text-[10px] text-fuchsia-500/60 font-mono uppercase tracking-widest">// WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL</div>
        </div>
```

Replace it with:

```jsx
        <div className="mb-5">
          <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · the kernels</div>
          <div className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-1" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.45s both, sc-headColor 9s ease-in-out 3s infinite' }}>RUN COMMAND MANUAL V2.2</div>
          <div className="text-[10px] text-fuchsia-500/60 font-mono uppercase tracking-widest">// WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL</div>
        </div>
```

- [ ] **Step 3: Visual verification**

Reload `http://localhost:5173/` Scaling tab.

**What to look for:**
1. Above "RUN COMMAND MANUAL V2.2" (which still has its existing animated colour-cycle head), a single new line: tiny gold mono "§ · THE KERNELS" with wide letter-spacing.
2. The marker uses the same visual treatment as the markers in the thesis above and (after Task 4) the bibliography below — same colour, same size, same tracking.
3. The animated colour-cycling "RUN COMMAND MANUAL V2.2" heading still works (still cycles colour).
4. The fuchsia subtitle "// WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL" is unchanged.
5. The 6 kernel grid cards below are completely untouched.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling-monument): add § · the kernels marker above RUN COMMAND MANUAL

Single new line above the existing terminal heading, using the shared
sc-monument-marker class. The kernel section is deliberately NOT
a monument — the marker alone supplies the rhythmic anchor between the
thesis monument and the bibliography monument bracketing it.

Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md"
```

---

## Task 4: Transform the Bibliography header into a monument

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx:524-554` (the Bibliography section opening)

**Purpose:** Strip the bordered amber card. Replace the BookOpen-iconed animated header with the monument structure: section marker → single-word display ("Bibliography") → accent line → substrate subtitle (kernel count). The 56-citation grid and the closing footer line stay exactly as they are.

- [ ] **Step 1: Locate the exact current header**

Run:
```bash
sed -n '520,555p' F:/scale_9.4/src/terminal/views/ScalingTab.jsx
```
Expected: Starts with the `{/* ── Bibliography ... */}` comment, ends after the closing footer line and closing `</div>`.

- [ ] **Step 2: Replace the section opening**

In `src/terminal/views/ScalingTab.jsx`, find this exact text:

```jsx
          {/* ── Bibliography (primary literature per kernel) ─────────────────
              The point isn't a comprehensive bibliography — it's making the
              rigorous lineage visible. Academic jurors will scan this section
              and immediately see the work is sourced, not vibes.            */}
          <div className="border border-amber-900/20 bg-black/30 p-4 rounded-lg md:col-span-2"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.55s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-amber-900/20 flex items-center justify-between"
              style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 2.1s both, sc-headColor 11s ease-in-out 9s infinite' }}>
              <span className="flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> BIBLIOGRAPHY &amp; PRIMARY LITERATURE
              </span>
              <span className="text-[9px] text-amber-700/40 font-normal normal-case tracking-normal">
                {KERNEL_CITATIONS.length} kernels · short-form refs
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
```

Replace it with:

```jsx
          {/* ── § · Primary Literature (Bibliography Monument) ──────────────
              Spec: 2026-05-21-scaling-tab-monument-elevation-design.md
              Card chrome and animated header removed. The word "Bibliography"
              IS the monument. Citations grid below is unchanged — its terminal
              density IS the rigor it claims.                                 */}
          <div className="md:col-span-2"
            style={{ opacity: 0, animation: 'sc-monumentReveal 1.5s ease-out 1.55s forwards' }}>

            {/* monument opening */}
            <div style={{ paddingTop: '80px', marginBottom: '48px' }}>
              <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · primary literature</div>
              <div className="sc-monument-display sc-monument-display--heading" style={{ marginBottom: '24px' }}>Bibliography</div>
              <div className="sc-monument-accent" style={{ marginBottom: '22px' }} />
              <div className="sc-monument-subtitle">{KERNEL_CITATIONS.length} kernels · canonical references</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
```

Notes on what changed:
- Outer wrapper: kept `md:col-span-2` (preserves the grid layout — bibliography spans both columns of the kernel-cards grid). Removed `border border-amber-900/20 bg-black/30 p-4 rounded-lg`.
- Animation: `sc-cardReveal 0.5s ... 1.55s forwards` → `sc-monumentReveal 1.5s ease-out 1.55s forwards`. Same delay; just the keyframe and duration change.
- Old header (`flex items-center justify-between` with BookOpen icon, animated `sc-headColor` cycle, and right-side "X kernels · short-form refs" count) replaced with monument structure inside a new wrapper div with 80px top breathing and 32px bottom breathing before the grid resumes.
- Kernel count: was "56 kernels · short-form refs" on the right side; now "{KERNEL_CITATIONS.length} kernels · canonical references" as the substrate subtitle below the accent line. "Short-form" → "canonical" because the word change positions the references as the project's canon rather than as a casual nod.
- The `<div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">` opening tag is preserved unchanged — the grid wrapping the citation list keeps the exact same classes.
- The 56-citation map and the closing `// "Original to Scale94 doctrine"...` footer below the grid are untouched (those lines are not in the find/replace range).

- [ ] **Step 3: Visual verification**

Reload `http://localhost:5173/` Scaling tab. Scroll past the kernel cards to the bibliography.

**What to look for:**
1. No amber-bordered card around the bibliography. The bibliography breaks free of any container.
2. The kernel cards above and the bibliography below have a visible gap (~80px) between them — the breathing room separates monument from substrate.
3. Top of bibliography section:
   - Gold mono "§ · PRIMARY LITERATURE"
   - Single huge Inter Black 900 word "Bibliography" in luminous gold (`#e8d28a`)
   - 80px gold accent line
   - Cyan mono "56 KERNELS · CANONICAL REFERENCES" (or whatever the current `KERNEL_CITATIONS.length` evaluates to — should be 56)
4. The 2-column citation grid below is visually identical to before (fuchsia "run X" commands, cyan command labels, amber primary literature, dim cyan related work).
5. The closing footer line (`// "Original to Scale94 doctrine" denotes kernels native to the project...`) is unchanged.
6. The BookOpen icon is gone. The animated colour-cycle on the header is gone.
7. On mount/reveal, the section fades in over 1.5s with no transform.

- [ ] **Step 4: Test at narrow width**

Toggle device toolbar in DevTools. At 320px width:
- "Bibliography" word drops to clamp() minimum (36px) — still reads as monument heading.
- The 2-column citation grid collapses to 1 column (the `grid-cols-1 md:grid-cols-2` Tailwind rule handles this).

Expected: No horizontal scroll, no clipping. The monument reads on phones.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling-monument): elevate Bibliography to monument

Strip the amber-bordered card. The word 'Bibliography' becomes the
monument: Inter Black 900 at clamp(36px..68px) in #e8d28a, gold accent
line, substrate subtitle below ('56 kernels · canonical references').

- Card chrome removed (border, bg, rounded-lg)
- Animated colour-cycle header gone
- BookOpen icon removed
- Right-side 'X kernels · short-form refs' → substrate subtitle below
  accent line, copy changed to 'canonical references'
- Animation: sc-cardReveal → sc-monumentReveal
- 80px top breathing separates monument from kernel cards above
- 56-citation grid and closing footer line UNCHANGED
- md:col-span-2 preserved (grid layout intact)

Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md"
```

---

## Task 5: Clean up unused imports + final visual QA

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx:2` (the lucide-react import line)

**Purpose:** After Tasks 2 and 4 removed the `<Cpu />` and `<BookOpen />` usages, those imports are dead. Remove them to keep the import line honest and shave a few bytes off the bundle. Then do a final end-to-end visual sweep of the whole ScalingTab to confirm the monument rhythm reads.

- [ ] **Step 1: Confirm Cpu and BookOpen are no longer used**

Run:
```bash
grep -n "Cpu\|BookOpen" F:/scale_9.4/src/terminal/views/ScalingTab.jsx
```
Expected: Only the `import` line on line 2 matches. If there are other references (e.g. in a section we didn't change), STOP — investigate and do not remove from the import.

- [ ] **Step 2: Remove the dead imports**

In `src/terminal/views/ScalingTab.jsx`, find this exact line:

```jsx
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText, Cpu, BookOpen } from 'lucide-react';
```

Replace with:

```jsx
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText } from 'lucide-react';
```

- [ ] **Step 3: Run the linter**

Run:
```bash
npm run lint
```
Expected: PASS. The ESLint config has `--max-warnings 0`, so any unused-import warning would fail the build. If lint complains about something unrelated that was already broken, note it and proceed — do not fix unrelated lint issues in this nightly.

- [ ] **Step 4: Run unit tests**

Run:
```bash
npm test
```
Expected: PASS. There are no tests for ScalingTab visual content, but tests cover other components that share helpers — if anything regressed, this surfaces it.

- [ ] **Step 5: Final end-to-end visual sweep**

In `npm run dev`, reload `http://localhost:5173/` from a hard refresh (Ctrl+Shift+R). Pass through gate/boot (or `reset_gate` then reload). Navigate to the Scaling tab.

Scroll through top to bottom. **Expected reading rhythm:**

1. **Header** (unchanged): `⬡ KERNEL_COMPILATION` with spinning hexagon + gradient text. ← terminal, animated, identity.
2. **LatentCollider** (unchanged): the hero.
3. **Architect Thesis card** (unchanged): small fuchsia-bordered card with `ARCHITECT_THESIS` + LOAD THESIS LOG.
4. **§ · The Thesis** (new monument): cyan border-t separator, 80px breathing, then gold marker → cyan attribution → 3-line gold display → gold accent line → cyan signature subtitle → terminal-green body → gold READ PAPER button.
5. **§ · The Kernels** (lightly marked): cyan border-t separator, then gold marker line, then unchanged "RUN COMMAND MANUAL V2.2" colour-cycle head with fuchsia subtitle, then 6 unchanged kernel grid cards.
6. **§ · Primary Literature** (new monument): 80px breathing inside the bibliography region, then gold marker → "Bibliography" display in gold → gold accent line → cyan kernel-count subtitle → unchanged 56-citation grid → unchanged closing footer.
7. **Transaction Module** (unchanged): BSKY / Signal / ETH cards.

**Doctrinal check:** Open browser DevTools, Search panel (Ctrl+F in DevTools), search the rendered DOM for `#fff`, `rgb(255, 255, 255)`, `rgba(255, 255, 255`, and `color: white`. Expected: **zero matches inside any monument section** (the two thesis monument and the bibliography monument). The header and other terminal sections may still contain whites that were there before this nightly — that's out of scope.

**Animation check:** On scroll-reveal of each monument, the fade is pure opacity over ~1.5s. No vertical motion. No blur clear. No colour cycle on any monument element. The non-monument sections (header, kernel grid cards) still animate as before.

**Mobile check:** Toggle DevTools device toolbar to iPhone SE (375×667). Scroll through. Each monument should remain legible:
- Thesis lines drop to ~28px display, still hold the rhythm
- "Bibliography" drops to ~36px display, still reads as heading
- Accent lines remain 80px wide (fixed, not percentage)
- No horizontal scroll

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "chore(scaling-monument): remove dead Cpu, BookOpen imports

Cpu was used in the thesis card (removed in Task 2 — Seraphine signature
now a substrate subtitle without an icon). BookOpen was used in the
bibliography card header (removed in Task 4 — Bibliography is now a
display word, no icon).

Lint and tests pass clean.

Closes: ScalingTab monument elevation per
docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md"
```

- [ ] **Step 7: Stop the dev server**

If `npm run dev` is still running, stop it (Ctrl+C in its terminal).

---

## Success criteria

After all five tasks land, when you reload `http://localhost:5173/` and visit the Scaling tab, all of the following must be true:

1. The thesis sentence ("The most compelling analogy has the weakest geometry.") reads as the project's load-bearing claim — visually distinct from every other section.
2. The word "Bibliography" announces a canon — visually distinct from every other section.
3. Both monuments are surrounded by the dense terminal substrate (LatentCollider, kernel grid, citation grid) — the substrate is not diminished; the monuments earn contrast by being rare.
4. No `#fff` or `rgba(255,255,255,*)` appears inside any monument section (Fade Doctrine compliance).
5. Header hexagon still spins; tab fade-in still works; kernel cards still reveal in cascade.
6. `npm run lint` passes. `npm test` passes.
7. Mobile (320–375px width): no horizontal scroll, monuments still legible.

## What this plan does NOT change

(For sanity — these stay exactly as they are):
- Header `KERNEL_COMPILATION` + spinning hexagon
- LatentCollider hero
- Architect Thesis small card (still fuchsia-bordered, still animated)
- The 6 kernel grid cards (Bone Fusion, Post-Quantum Crypto, Dynamical Systems, Interface + SARG, Volatile Semiotics, Ecological Economics)
- The 56-citation grid inside the bibliography (only the header above it changed)
- The closing footer line (`// "Original to Scale94 doctrine"...`)
- The Transaction Module (BSKY / Signal / ETH cards)
- Tab-level animations
- Any other tab (Mercury, Lunar, etc.)

## Push policy

**Do NOT push to origin** at the end of this plan. The user's hard rule: "Never push without explicit user push command. Verification approval ≠ push consent." After the final commit, report completion and wait for the explicit push command.
