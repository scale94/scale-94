# Manifesto Chapter Panel — Design Spec
**Date**: 2026-04-14
**Feature**: Click chapter arc → animated slide-in reading panel
**Location**: `src/terminal/views/manifesto/`

---

## Overview

Clicking any chapter wedge on the Mandala opens a fixed right-side drawer showing the chapter's full readable content. The panel slides in with staggered text animations. The mandala dims behind it. Dismisses via backdrop click, close button, or Escape.

---

## New File — `ChapterPanel.jsx`

Fixed right drawer. Receives `chapter` (object from `MANIFESTO_CHAPTERS`), `chapterIndex` (0–5), and `onClose` callback.

### Layout
- `position: fixed`, right edge, full height, `width: min(480px, 100vw)`
- Background: `#04040a`, border-left `1px solid {accentColor}33`
- Scrollable (`overflowY: auto`), padding `40px 32px`
- Z-index 50 (above mandala)
- Close button `✕` top-right

### Backdrop
- `position: fixed`, `inset: 0`, z-index 40
- `background: rgba(0,0,0,0.5)`, click → `onClose`
- Fades in: `opacity 0 → 1`, `200ms ease`

### Accent color
- `hsl((chapterIndex * 60) % 360, 70%, 60%)` — matches existing wedge fill hues

### Enter animation sequence (CSS transitions, driven by `visible` state)
All elements start `opacity: 0`, transition to `opacity: 1` on mount (next-frame `visible = true`):

| Element | Transition delay | Other |
|---|---|---|
| Backdrop | 0ms | opacity only |
| Chapter number (`§1`) | 50ms | + `translateY(8px → 0)` |
| Title | 120ms | + `translateY(12px → 0)` |
| Gradient rule | 180ms | opacity only |
| Epigraph (blockquote) | 220ms | opacity only |
| Body sentences | 260ms + `i * 50ms` each | opacity only, split on `. ` |

### Content
```
{chapter.number}          ← e.g. "§3.3.3" — accent color, monospace, tracking
{chapter.title}           ← large, white, monospace bold
────────────────          ← gradient rule accent→transparent
"{chapter.epigraph}"     ← italic, accent color, left border
{chapter.opening}         ← body, grey (#9ca3af), staggered sentences
```

### Dismiss
- Click backdrop
- Click `✕` button
- Escape key (useEffect on mount)

---

## Modified File — `Mandala.jsx`

### State addition
```js
const [selectedChapter, setSelectedChapter] = useState(null);
// shape: { chapter: chapterObject, index: number } | null
```

### Wedge onClick
Add to each `<path>` in `chapterWedges.map`:
```jsx
onClick={() => setSelectedChapter({ chapter: CHAPTER_BY_ID[w.id], index: i })}
```

### Blur trigger
Change existing blur filter from `selected` to `selected || selectedChapter`:
```js
filter: (selected || selectedChapter) ? 'blur(3px) brightness(0.4)' : 'none',
```

### Escape key
Extend existing Escape `useEffect` (currently only closes beacon `selected`) to also close `selectedChapter`:
```js
const onKey = (e) => {
  if (e.key === 'Escape') { closeSelected(); setSelectedChapter(null); }
};
```

### Render ChapterPanel
Below the SVG, inside the container div:
```jsx
{selectedChapter && (
  <ChapterPanel
    chapter={selectedChapter.chapter}
    chapterIndex={selectedChapter.index}
    onClose={() => setSelectedChapter(null)}
  />
)}
```

---

## Files changed

| File | Action |
|---|---|
| `src/terminal/views/manifesto/ChapterPanel.jsx` | Create |
| `src/terminal/views/manifesto/Mandala.jsx` | Modify (~20 lines) |

---

## Out of scope
- Fetching additional text from `systemArticles` (use `chapter.opening` from JS data)
- Chapter-to-chapter navigation within the panel
- Mobile swipe-to-dismiss
