# Manifesto Chapter Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking any chapter arc on the Mandala opens a fixed right-side panel with animated, staggered text revealing the full chapter content.

**Architecture:** New `ChapterPanel.jsx` handles all rendering and animation via CSS transitions driven by a `visible` state flag flipped on next frame. `Mandala.jsx` gets a `selectedChapter` state and a one-line `onClick` on the existing wedge paths. The ChapterPanel owns its own backdrop and Escape handler.

**Tech Stack:** React, CSS transitions (no animation library), `@testing-library/react`, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/terminal/views/manifesto/ChapterPanel.jsx` | **Create** | Slide-in drawer, staggered animations, dismiss logic |
| `src/terminal/views/manifesto/Mandala.jsx` | **Modify** | `selectedChapter` state, wedge onClick, blur, Escape, render panel |
| `tests/ChapterPanel.test.js` | **Create** | Render content, dismiss interactions |

---

## Task 1: Create ChapterPanel.jsx with tests

**Files:**
- Create: `src/terminal/views/manifesto/ChapterPanel.jsx`
- Test: `tests/ChapterPanel.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/ChapterPanel.test.js`:

```js
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import '@testing-library/jest-dom';
import ChapterPanel from '../src/terminal/views/manifesto/ChapterPanel';

const CHAPTER = {
  id: 'substrate',
  number: '§1',
  title: 'THE SUBSTRATE',
  epigraph: '34 kernels. Each one a .rs file compiled to WebAssembly.',
  opening: 'First sentence here. Second sentence here. Third sentence.',
};

describe('ChapterPanel', () => {
  it('renders chapter number, title and epigraph', () => {
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={() => {}} />);
    expect(screen.getByText('§1')).toBeInTheDocument();
    expect(screen.getByText('THE SUBSTRATE')).toBeInTheDocument();
    expect(screen.getByText(CHAPTER.epigraph)).toBeInTheDocument();
  });

  it('renders all opening sentences', () => {
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={() => {}} />);
    expect(screen.getByText(/First sentence here/)).toBeInTheDocument();
    expect(screen.getByText(/Second sentence here/)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('chapter-panel-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('chapter-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run — confirm FAIL**

```
npm test
```

Expected: `Cannot find module '../src/terminal/views/manifesto/ChapterPanel'`

- [ ] **Step 3: Create `src/terminal/views/manifesto/ChapterPanel.jsx`**

```jsx
import { useState, useEffect } from 'react';

// Split opening text into sentences for staggered animation.
// Splits on ". " but keeps the period with the preceding sentence.
function splitSentences(text) {
  const parts = text.split(/(?<=\.)\s+/);
  return parts.filter(Boolean);
}

export default function ChapterPanel({ chapter, chapterIndex, onClose }) {
  const [visible, setVisible] = useState(false);

  // Next-frame flip triggers CSS transitions.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape key dismiss.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hue    = (chapterIndex * 60) % 360;
  const accent = `hsl(${hue}, 70%, 60%)`;
  const sentences = splitSentences(chapter.opening);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="chapter-panel-backdrop"
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     40,
          background: 'rgba(0,0,0,0.55)',
          opacity:    visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      'min(480px, 100vw)',
          zIndex:     50,
          background: '#04040a',
          borderLeft: `1px solid ${accent}33`,
          overflowY:  'auto',
          padding:    '40px 32px',
          transform:  visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Close button */}
        <button
          data-testid="chapter-panel-close"
          onClick={onClose}
          style={{
            position:   'absolute',
            top:        16,
            right:      16,
            background: 'none',
            border:     'none',
            color:      accent,
            fontSize:   18,
            cursor:     'pointer',
            opacity:    0.7,
            lineHeight: 1,
          }}
          aria-label="Close chapter"
        >
          ✕
        </button>

        {/* Chapter number */}
        <div
          style={{
            fontFamily:    'monospace',
            fontSize:      11,
            fontWeight:    700,
            color:         accent,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom:  8,
            opacity:       visible ? 1 : 0,
            transform:     visible ? 'translateY(0)' : 'translateY(8px)',
            transition:    'opacity 400ms 50ms, transform 400ms 50ms',
          }}
        >
          {chapter.number}
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily:    'monospace',
            fontSize:      22,
            fontWeight:    700,
            color:         '#e0e0e0',
            letterSpacing: '0.04em',
            margin:        '0 0 24px 0',
            opacity:       visible ? 1 : 0,
            transform:     visible ? 'translateY(0)' : 'translateY(12px)',
            transition:    'opacity 400ms 120ms, transform 400ms 120ms',
          }}
        >
          {chapter.title}
        </h2>

        {/* Gradient rule */}
        <div
          style={{
            height:     1,
            background: `linear-gradient(90deg, ${accent}66, transparent)`,
            marginBottom: 20,
            opacity:    visible ? 1 : 0,
            transition: 'opacity 400ms 180ms',
          }}
        />

        {/* Epigraph */}
        <blockquote
          style={{
            margin:      '0 0 24px 0',
            paddingLeft: 12,
            borderLeft:  `2px solid ${accent}44`,
            fontFamily:  'monospace',
            fontSize:    13,
            fontStyle:   'italic',
            color:       accent,
            opacity:     visible ? 1 : 0,
            transition:  'opacity 400ms 220ms',
          }}
        >
          {chapter.epigraph}
        </blockquote>

        {/* Body — staggered sentences */}
        <p
          style={{
            fontFamily:  'monospace',
            fontSize:    13,
            lineHeight:  1.9,
            color:       '#9ca3af',
            margin:      0,
          }}
        >
          {sentences.map((s, i) => (
            <span
              key={i}
              style={{
                opacity:    visible ? 1 : 0,
                transition: `opacity 500ms ${260 + i * 50}ms`,
              }}
            >
              {s}{i < sentences.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```
npm test
```

Expected: all 5 tests in `ChapterPanel.test.js` pass.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/ChapterPanel.jsx tests/ChapterPanel.test.js
git commit -m "feat(manifesto): ChapterPanel slide-in drawer with staggered animations"
```

---

## Task 2: Wire ChapterPanel into Mandala.jsx

**Files:**
- Modify: `src/terminal/views/manifesto/Mandala.jsx`

Read the file before starting. All edits below use exact old→new strings.

- [ ] **Step 1: Add ChapterPanel import** — add after the last import line (after `import BeaconCard from './BeaconCard';`):

```js
import ChapterPanel from './ChapterPanel';
```

- [ ] **Step 2: Add selectedChapter state** — add after `const [readBeacons, setReadBeacons] = useState(() => new Set());`:

```js
  const [selectedChapter, setSelectedChapter] = useState(null);
  // shape: { chapter: chapterObject, index: number } | null
```

- [ ] **Step 3: Add Escape handler for selectedChapter** — add after the existing Escape `useEffect` block (after line `}, [selected]);`):

```js
  // Esc also closes chapter panel.
  useEffect(() => {
    if (!selectedChapter) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedChapter(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedChapter]);
```

- [ ] **Step 4: Extend blur filter to include selectedChapter** — replace:

```js
            filter: selected ? 'blur(3px) brightness(0.4)' : 'none',
```

With:

```js
            filter: (selected || selectedChapter) ? 'blur(3px) brightness(0.4)' : 'none',
```

- [ ] **Step 5: Add onClick to chapter wedge paths** — replace:

```jsx
                <path
                  key={w.id}
                  d={wedgePath(w.startAngle, w.endAngle, R)}
                  fill={w.fill}
                  stroke="none"
                  opacity={isHovered ? 2.2 : 1}
                  onMouseEnter={() => setHover({ type: 'chapter', data: CHAPTER_BY_ID[w.id] })}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                />
```

With:

```jsx
                <path
                  key={w.id}
                  d={wedgePath(w.startAngle, w.endAngle, R)}
                  fill={w.fill}
                  stroke="none"
                  opacity={isHovered ? 2.2 : 1}
                  onMouseEnter={() => setHover({ type: 'chapter', data: CHAPTER_BY_ID[w.id] })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelectedChapter({ chapter: CHAPTER_BY_ID[w.id], index: i })}
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                />
```

- [ ] **Step 6: Render ChapterPanel** — replace the closing `</div>` at the very end of the return (after the `{selected && (...)}` block):

```jsx
      {selected && (
        <>
          {/* Click-outside overlay. */}
          <div
            className="absolute inset-0"
            style={{ zIndex: 30 }}
            onClick={closeSelected}
          />
          <BeaconCard
            beacon={selected}
            onClose={closeSelected}
            isMobile={isMobile}
          />
        </>
      )}
    </div>
```

With:

```jsx
      {selected && (
        <>
          {/* Click-outside overlay. */}
          <div
            className="absolute inset-0"
            style={{ zIndex: 30 }}
            onClick={closeSelected}
          />
          <BeaconCard
            beacon={selected}
            onClose={closeSelected}
            isMobile={isMobile}
          />
        </>
      )}

      {selectedChapter && (
        <ChapterPanel
          chapter={selectedChapter.chapter}
          chapterIndex={selectedChapter.index}
          onClose={() => setSelectedChapter(null)}
        />
      )}
    </div>
```

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/manifesto/Mandala.jsx
git commit -m "feat(manifesto): wire ChapterPanel into Mandala — wedge click opens chapter"
```

---

## Task 3: Visual test in browser

**No code changes — verification only.**

- [ ] **Step 1: Start dev server**

```
npm run dev
```

Open http://localhost:5173 and navigate to the Manifesto tab.

- [ ] **Step 2: Confirm chapter wedges are clickable**

Hover a chapter arc — it should brighten (existing behavior). Click it — the rest of the mandala should blur+dim and the panel should slide in from the right.

- [ ] **Step 3: Verify animation sequence**

The panel slide-in should be visible (~350ms). Inside, the chapter number appears first, then title, then the gradient rule, then the epigraph, then body sentences one by one (~50ms stagger each). None of these should pop in instantly.

- [ ] **Step 4: Verify accent color per chapter**

Click each of the 6 chapter arcs in turn. The panel border, chapter number, epigraph, and close button should each reflect the chapter's hue:
- §1 SUBSTRATE → red (hue 0°)
- §2 FEATURE SPACE → yellow (hue 60°)
- §3 BONE FUSION → green (hue 120°)
- §4 SARG → cyan (hue 180°)
- §5 FADE → blue (hue 240°)
- §8 ENCLAVE → magenta (hue 300°)

- [ ] **Step 5: Verify dismiss methods**

For any open panel: (a) click the `✕` button, (b) click the dark backdrop, (c) press Escape. All three should close the panel smoothly (slide out is instant — CSS transition only applies on enter; that's acceptable).

- [ ] **Step 6: Verify beacon cards still work**

Click a beacon node (the colored dots) — BeaconCard should open as before, unaffected by the chapter panel changes.

- [ ] **Step 7: Final commit if corrections needed**

```bash
git add src/terminal/views/manifesto/ChapterPanel.jsx src/terminal/views/manifesto/Mandala.jsx
git commit -m "fix(manifesto): visual test corrections"
```
