# Gate + Possession Sequence — Design Spec

**Date:** 2026-05-19
**Project:** scale94.com / Mercury Terminal
**Submission context:** Ars Electronica readiness

## Purpose

Replace the passive landing experience with a gated first-contact ritual. The site greets every new session with a single philosophical prompt. The user's answer determines whether they receive a curated micro-tour of the site (pass), or watch their terminal be possessed by hostile WASM execution for 60 seconds (fail). The mechanic is the artwork's introduction to itself — it asserts that this site is not a portfolio to browse but an environment with stakes.

## Success criteria

- A first-time visitor sees the gate within 1 second of page load.
- Answering the prompt within ~5 keystrokes feels frictionless; no nested forms or modals to click through.
- A successful answer produces an unmistakably "I am being shown around" feeling. The visitor learns the site exists, has tabs, has WASM kernels, and has a manifesto — without having to discover any of it.
- A failed answer is cinematic. The visitor watches the terminal run commands they did not type for 60 seconds. They cannot interact with the terminal during this window, but they CAN still navigate the rest of the site (the infection is local to the terminal infrastructure, not the page).
- The gate fires only once per browser session (`sessionStorage`-gated). Reloading inside an active possession does NOT extend the timer.
- The mechanic degrades gracefully on mobile: touch users get the same prompt with a virtual keyboard, the same possession sequence, the same recovery.

## Out of scope

- The Tesseract tutorial, LatentCollider Phase 2, mobile parity audit, autocomplete enhancements, and performance audit are tracked separately. This spec is scoped to the gate + tour + possession sequence only.
- The gate is NOT a captcha or anti-bot measure. It is artwork; bots are welcome.
- No analytics, telemetry, or A/B variants of the prompt. One prompt, one set of answers.

## The prompt

**Text:** `from perihelion, growth reads as ___`

**Accepted answers (case- and whitespace-insensitive after trimming):**
- `noise` (canonical)
- `decay`
- `dying`

**Failure conditions (all route to possession):**
- Submitting any string not in the accepted list.
- Pressing Escape.
- Submitting an empty string.

**No second chance.** One attempt per session. This is by design — the architect does not negotiate.

## Architecture

### Components

```
src/terminal/
├─ components/
│  └─ GateOverlay.jsx          ← full-viewport prompt overlay
├─ hooks/
│  ├─ usePhantomTyper.js       ← shared: programmatically types into terminal input
│  ├─ useTourSequence.js       ← on pass: curated phantom commands
│  └─ usePossessionSequence.js ← on fail: 60s of hostile commands
└─ App.jsx                     ← wires gate state into existing terminal
```

### State machine

```
[mount]
  │
  ▼
[check sessionStorage['scale94.gate']]
  │
  ├─ 'passed' or 'failed' ──► [IDLE, no gate]
  │
  └─ unset ──► [GATE_OPEN]
                 │
                 ├─ correct answer ──► [storage: 'passed'] ──► [TOUR] ──► [IDLE]
                 │
                 └─ wrong/escape/empty ─► [storage: 'failed'] ──► [POSSESSION (60s)] ──► [IDLE]
```

`TOUR` and `POSSESSION` are both interruptible-but-not-by-the-user:
- TOUR cancels on the user's first real keystroke into the terminal (i.e. they've taken the wheel).
- POSSESSION cannot be cancelled. It runs its full 60 seconds.

### GateOverlay.jsx

- Mounts above all other terminal UI when `gateState === 'open'`.
- Layout: full viewport, `bg-black/95`, centered single-line text in `Geist Mono`, ~36px.
- Renders: the prompt text + a blinking input field with terminal-style caret. No "Submit" button. Enter submits.
- Existing CRT scanline overlay (`.crt-overlay`) remains visible behind it — the gate is layered into the same environment, not a separate page.
- Esc → fail. Click outside the input → input regains focus (no dismiss). The overlay traps focus until answered.
- On unmount: 300ms fade. The site behind it was always rendering — fade reveals it.

### usePhantomTyper.js

Shared utility. Takes a target `<input>` ref and a string, types it character-by-character at ~40ms/char, dispatches `input` events on each keystroke (so React's controlled-input value updates), and finally dispatches `KeyboardEvent('keydown', { key: 'Enter' })` to fire the dispatcher.

Returns `{ type(text), typeAndSubmit(text), cancel() }`. `cancel()` aborts an in-flight type. Used by both tour and possession.

### useTourSequence.js

On pass, schedules this sequence (with 2.5s gaps between commands for the user to read the output):

1. `mercury` — switches to Mercury tab; shows the architect's home.
2. `run bosonic` — fires a WASM kernel; shows the system computes things.
3. `art` — switches to Art tab; shows the visual canvas exists.
4. `ledger` — switches to Ledger tab; shows the audit layer.
5. `load fish_scale_kernel` — opens the manifesto-level article.

Each command is preceded by a system log line like `# the architect demonstrates :: mercury` (rendered with a comment prefix so it visually differs from real WASM output).

**Cancellation:** if the user's `keydown` event reaches the terminal input while the tour is running, the sequence calls `cancel()` on the phantom typer and the remaining queue is discarded. No "tour stopped" message — they took the wheel, the architect goes silent.

### usePossessionSequence.js

On fail, runs for exactly 60 seconds. While active:

- Terminal input gets `disabled={true}` + a `ring-1 ring-red-500/60` red border.
- Above the input, a small red strip appears: `⚠ TERMINAL COMPROMISED :: T-NN s` where NN counts down from 60.
- Every 0.8–1.5s (jittered uniformly), pick a random WASM kernel from `wasmRegistry` (excluding `vcache_burn` because of its 100k iteration cost — we want fast, frequent output, not one long-running kernel). Type `run <kernel.id>` via the phantom typer. The phantom typer assumes the input is empty between commands — possession only types when the previous command has cleared (the existing dispatcher clears `commandInput` on Enter, so this holds).
- Roughly every third command tick, append a red `INTRUSION_DETECTED ::` log line directly (not via the typer — these aren't commands, they're "system" noise). Lines are drawn at random from this pool:
  - `INTRUSION_DETECTED :: unprivileged execution from MERCURY_NODE`
  - `INTRUSION_DETECTED :: substrate access granted to non-local process`
  - `INTRUSION_DETECTED :: keyboard buffer redirected`
  - `INTRUSION_DETECTED :: exfiltrating kernel cache to perihelion`
  - `INTRUSION_DETECTED :: user attention captured`
- At T+60s exactly: append `EXFILTRATION COMPLETE :: substrate released` (green, not red), re-enable the input, remove the red border, remove the countdown strip.
- The session's gate state remains `'failed'` — no further gates this session.

**Navigation during possession:** unrestricted. The user can click any tab, scroll, even hover-trigger animations. Only the terminal input is locked. The bottom-strip terminal log is still scrollable; the user can read what was just exfiltrated from them.

**Reload during possession:** sessionStorage already has `'failed'`. Reload skips the gate, lands the user in IDLE state with no possession running. The dramatic moment was theirs to witness or skip — same as any film.

## Data persistence

```js
sessionStorage['scale94.gate'] = 'passed' | 'failed';
```

That's it. No timestamp, no count, no telemetry. Session-scoped — clears on tab close, persists across reloads within the same tab.

## Edge cases

| Case | Behaviour |
|---|---|
| User opens the site in two tabs simultaneously | Each tab has its own sessionStorage, so each tab gets the gate independently. Fine. |
| User reloads mid-possession | Gate state is already `'failed'`. No gate, no possession. They land in IDLE. The 60-second window was their one chance to watch. |
| User has JavaScript disabled | Site doesn't function at all (it's already WASM-driven). N/A. |
| User answers correctly with extra whitespace | Trimmed. Accepted. |
| User answers `NOISE` in all caps | Lowercased before compare. Accepted. |
| Mobile user with no keyboard until they tap input | Input is autofocused on mount; mobile keyboard appears. Standard behaviour. |
| Screen reader user | `<dialog role="dialog" aria-label="entry prompt">`. The prompt text is the dialog's accessible name. Failed answer states the failure ("substrate access denied — terminal compromised") via `aria-live="polite"`. |
| User refreshes during the tour | sessionStorage is `'passed'`. Reload skips the gate, no tour. They've already received their welcome. |

## Visual + audio notes

- No sound. The site has no audio currently and adding it for the gate would break the existing aesthetic.
- The red border during possession uses the existing `ef4444` palette from `ram-bar-critical`.
- The countdown strip uses `Geist Mono`, 11px, the same font/size as the existing system log lines.
- The `EXFILTRATION COMPLETE` line uses `#39ff14` (the site's existing positive-confirmation green).

## Testing strategy

Unit-level: not warranted — this is a single visual flow per session. Manual verification covers it.

Manual verification checklist (run in browser preview):
1. First load shows the gate within 1s.
2. Typing `noise` + Enter dismisses the gate, runs the 5-command tour in order, each command visibly executing.
3. Typing into the input during the tour cancels the remaining commands silently.
4. Refresh after passing: lands directly in IDLE, no gate.
5. Open new incognito tab: gate fires fresh.
6. Typing `wrong` + Enter dismisses the gate, terminal input becomes disabled with red border, countdown begins.
7. Random `run` commands fire approximately every 1s during possession; outputs appear in the system log.
8. Possession ends at exactly T+60s with the green release message; input re-enables.
9. Refresh during possession: lands in IDLE with no possession.
10. Mobile (responsive emulation): gate is legible, input is focused, virtual keyboard appears.

## Risks + mitigations

- **Risk:** Jurors find the failure state hostile and bounce.
  **Mitigation:** Navigation is unrestricted during possession. They can explore the rest of the site freely; only the terminal is locked. The 60-second window is short relative to a juror's typical viewing time.
- **Risk:** A user fails the gate, gets distracted, and returns to find a screaming terminal with no memory of triggering it.
  **Mitigation:** The countdown strip + red border make the cause-and-effect legible at a glance. The `EXFILTRATION COMPLETE` resolution makes it clear the window ends.
- **Risk:** Phantom typing collides with an existing in-flight command (e.g. user happened to be typing when tour starts).
  **Mitigation:** Tour only starts after gate dismissal, when the terminal input is empty. Possession disables the input before typing, so collision is impossible.
- **Risk:** sessionStorage is unavailable (Safari private mode, etc.).
  **Mitigation:** Try/catch around storage access; fall back to in-memory React state. Gate still works for the session; just doesn't survive reload. Acceptable.

## Open questions

None. Ready to plan.
