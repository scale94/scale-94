# Lattice Protocol — RAM-Wipe Easter Egg & `re$$ill` Cheat

**Date:** 2026-05-18
**Status:** Approved for implementation
**Scope:** New game mechanic layered on top of the existing ecological RAM model in `src/terminal/hooks/useEcologicalRam.js`; one new command (`run re$$ill`) added to `src/terminal/hooks/useCommandDispatch.js`.

---

## Premise

Of the dozens of runnable kernels in the registry, **three** are mathematically grounded ecological commons primitives. The Lattice Protocol enshrines them as the only safe `run` targets: every other `run X` instantly empties the planetary RAM to 0%. A player who identifies all three in their first 3 attempts unlocks a permanent terminal cheat: `run re$$ill`, which refills RAM to 100% on a 60-second cooldown.

The mechanic doubles as the project's argument: extraction collapses the commons; only the kernels rooted in real ecological math honor it.

## The Safe Trio

Selected for "actual math and science" per user directive — published peer-reviewed frameworks, not project lore:

| Kernel | Delta | Foundation |
|---|---|---|
| `daly` | +22 | Herman Daly's steady-state thermodynamic economics (1973, 1996) |
| `biodiversity` | +20 | Shannon-Wiener entropy `H = −Σ pᵢ ln(pᵢ)` (1949) |
| `replicator` | +16 | Maynard Smith replicator dynamics + Ostrom commons game theory (1982, 1990) |

**Alias resolution:** all aliases of a safe kernel count as that kernel. From the existing `ECOLOGICAL_DELTA_MAP`:
- `daly` cluster: `daly`, `ecological`, `entropy_econ`, `daly_rules`, `daly_thermo`
- `biodiversity` cluster: `biodiversity`, `biocoenosis`, `species`, `shannon_ecology`, `ecology`
- `replicator` cluster: `replicator`, `ostrom_game`, `commons`, `evolutionary`, `cooperate`, `altruist`, `gametheory`

Built once at module init as `SAFE_ALIAS_TO_KERNEL: Record<alias, 'daly'|'biodiversity'|'replicator'>`.

## Game State

All persisted to `localStorage` under key `scale94_lattice_protocol`:

```ts
{
  attemptCount: number;              // 0..3, then locked
  foundSafes: ('daly'|'biodiversity'|'replicator')[];  // serialized Set
  unlocked: boolean;                  // true once foundSafes.length === 3 within attemptCount ≤ 3
  failed: boolean;                    // true once attemptCount === 3 && !unlocked
  lastRefillAt: number;               // ms timestamp; 0 if never used
  hintSeen: boolean;                  // boot-hint sentinel
}
```

Default (no localStorage entry): all zero/empty/false.

## Game Flow

The hook exports an enhanced `applyRamDelta(alias)`. On every call:

### Branch 1 — `unlocked || failed` (game over)

Apply normal ecological delta. Restore the 5% floor as the lower bound. The lattice doctrine resumes; no further attempt tracking. Existing flavor/threshold lines fire as today.

### Branch 2 — game active (`!unlocked && !failed`)

Classify alias:

**Safe kernel hit:**
1. Apply normal recharge (`+22 / +20 / +16` per existing delta map).
2. Add the kernel's canonical name to `foundSafes` (no-op if already present — running `daly` twice doesn't double-count, but still burns an attempt).
3. Increment `attemptCount`.
4. Emit log line: `[LATTICE:HONORED] :: <KERNEL> registered · <N> of 3 found · <M> attempts remaining`.
5. Check terminal:
   - If `foundSafes.size === 3`: set `unlocked = true`, emit `[RE$$ILL:UNLOCKED] :: cryptographic key bound to local node · 'run re$$ill' now available · cooldown 60s`.
   - Else if `attemptCount === 3 && foundSafes.size < 3`: set `failed = true`, emit `[LATTICE:SILENT] :: protocol window closed · re$$ill key sealed · the alien remembers`.

**Non-safe kernel hit:**
1. Override delta — wipe `ramPct` to `0` (bypass the 5% floor for this one wipe).
2. Increment `attemptCount`.
3. Emit log line: `[LATTICE:ZEROED] :: extractive compute detected · planetary commons collapsed · <M> attempts remaining`.
4. Check terminal:
   - If `attemptCount === 3 && foundSafes.size < 3`: set `failed = true`, emit `[LATTICE:SILENT]` line above.
   - (Cannot unlock from a non-safe — only safes contribute to `foundSafes`.)

In both sub-branches, the existing threshold lines (`[RAM:EXHAUSTED]`, `[LATTICE:FLOOR]`, etc.) are suppressed during the active game — replaced by `[LATTICE:*]` lines. After the game ends, they resume.

## `run re$$ill` — the Cheat

New branch in `useCommandDispatch.js` inside the `if (action === 'run')` block, intercepted **before** the WASM registry lookup (so the dollar signs don't trip normalization):

```js
if (baseCmd === 're$$ill') {
  // 1. Locked check
  if (!latticeState.unlocked) {
    log(`COMMAND: ${rawCmd}`);
    logs(`  RE$$ILL_LOCKED :: cryptographic key not bound · find the 3 commons kernels in 3 attempts to unlock`);
    return;
  }
  // 2. Cooldown check
  const elapsed = Date.now() - latticeState.lastRefillAt;
  if (elapsed < 60_000) {
    const remaining = Math.ceil((60_000 - elapsed) / 1000);
    log(`COMMAND: ${rawCmd}`);
    logs(`  RE$$ILL_COOLDOWN :: ${remaining}s remaining · the lattice replenishes on geological time`);
    return;
  }
  // 3. Apply
  applyRefill();  // sets ramPct = 100, updates lastRefillAt
  log(`COMMAND: ${rawCmd}`);
  logs(
    `  RE$$ILL :: planetary RAM restored to 100%`,
    `  the cheat is honored · the cooldown begins · 60s until next refill`,
  );
  return;
}
```

`applyRefill()` is exposed from `useEcologicalRam` alongside `applyRamDelta`.

## Boot Hint

On hook mount, check `latticeState.hintSeen`. If false:
1. Append one ambient log line: `[LATTICE_PROTOCOL] :: 3 kernels honor the commons — find them in 3 attempts to unlock 're$$ill'`. (No count of the haystack — keeping it cryptic and avoiding registry-coupling.)
2. Set `hintSeen = true` and persist.

The hint never repeats. If the user has already unlocked or failed in a prior session, the hint is also suppressed (no point — game is over).

## Edge Cases

| Case | Behavior |
|---|---|
| User runs `daly` then `daly` again | Both count as attempts. `foundSafes` deduplicates. Second `daly` does NOT advance discovery — `[LATTICE:HONORED] :: DALY already registered · 2 of 3 found · 1 attempt remaining`. |
| User runs a pairwise collision (`run daly biodiversity`) | Handled by the existing twoTokens branch in `useCommandDispatch` BEFORE the alias lookup. Does NOT trigger game logic — collisions are not "running a kernel," they're conceptual analysis. No attempt burned. |
| User runs `breach` / `relic` / `ledger` | These bypass `applyRamDelta` entirely. No attempt burned. `breach` does call `applyEcoCost('breach')` — game logic treats `breach` as non-safe (wipe to 0, burn attempt). This is intentional: ICE penetration is extractive. |
| User runs an unknown kernel (`RUN_FAIL`) | No `applyRamDelta` call fires. No attempt burned. Fair. |
| User passively drains to 0 from entropy alone | The 30s passive drain still floors at 5% — entropy alone cannot end the game. Only player commands count as attempts. |
| `re$$ill` typed before unlock | `RE$$ILL_LOCKED` message; no state change, no attempt burned. |
| localStorage disabled / quota exceeded | Hook detects and falls back to in-memory state with a one-time `[LATTICE:NONPERSISTENT]` log. Game plays per-session only. |
| `failed` user clears localStorage | Game resets. Acceptable — this is an art project, not anti-cheat. |
| Multiple tabs open simultaneously | Last-write-wins on localStorage. Edge case accepted; no cross-tab sync. |

## Implementation Files

| File | Change |
|---|---|
| `src/terminal/hooks/useEcologicalRam.js` | Add `SAFE_ALIAS_TO_KERNEL` map, lattice state (useState + useEffect persistence), `applyRefill()`, branching logic inside `applyRamDelta()`, boot-hint effect. Export `latticeState` and `applyRefill` alongside existing returns. |
| `src/terminal/hooks/useCommandDispatch.js` | Add `re$$ill` branch at top of run handler. Add `latticeState` and `applyRefill` to destructured ctx. **Also remove the `if (opts?.eco)` gate** at lines 270 and 282 — see "Pre-existing eco gate" below. |
| `src/terminal/App.jsx` | Thread `latticeState` and `applyRefill` from `useEcologicalRam` into the `ctx` passed to `useCommandDispatch`. |

No new components. No new files. No CSS changes. Existing RAM bar and log surface handle all display.

## Pre-existing Eco Gate (Fixed In-Scope)

Discovered during planning: the existing dispatcher gates `applyEcoCost(ecoAlias)` behind `if (opts?.eco)` at [`useCommandDispatch.js:270`](src/terminal/hooks/useCommandDispatch.js:270) and `:282`. Only the mobile-auto-run path passes `{ eco: true }`; keyboard-typed runs (App.jsx:879) and several other callsites do not. This means desktop `run X` currently does not drain RAM at all — an existing bug masked because the RAM bar still shows passive entropy.

The Lattice Protocol cannot function with this gate in place: the player needs every keyboard run to participate. Fix: **remove both `if (opts?.eco)` conditions** so the eco hook fires unconditionally on every successful kernel run. This also fixes the latent bug. The `opts.eco` parameter remains in the signature (other callers may pass it for forward compatibility) but is no longer read.

## Out of Scope

- Cross-tab localStorage sync.
- Server-side leaderboard of who unlocked re$$ill.
- Resetting the game once failed (it's an art statement — failure is permanent by design).
- A UI badge showing "X of 3 found" outside the system log (the log is the surface).
- Animating the wipe-to-0 transition (existing RAM bar already handles arbitrary jumps).

## Success Criteria

1. Fresh user opens the terminal → sees one `[LATTICE_PROTOCOL]` hint line in system logs.
2. User runs `daly` → recharge fires, log shows `1 of 3 found · 2 attempts remaining`.
3. User runs `biodiversity` → `2 of 3 found · 1 attempt remaining`.
4. User runs `replicator` → `[RE$$ILL:UNLOCKED]` fires.
5. User runs `re$$ill` → RAM jumps to 100%, cooldown begins.
6. User runs `re$$ill` 5 seconds later → cooldown message, no refill.
7. Page reload → `unlocked` persists, `re$$ill` still works.
8. Alternative path: user runs `leviathan` first → RAM → 0%, `1 attempt remaining` ... `2 attempts` ... after 3 non-safes, `[LATTICE:SILENT]`, re$$ill permanently locked.
