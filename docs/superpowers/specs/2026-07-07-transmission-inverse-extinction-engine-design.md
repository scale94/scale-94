# TRANSMISSION — Inverse Extinction Engine (Design)

**Date:** 2026-07-07
**Status:** Approved approach A (lexicon inversion engine, client-only). Ecocide loop included per recommendation — flagged for user confirmation at spec review.

## Purpose

Extend the TRANSMISSION tab (currently the fiction/signal archive) with a live
**Inverse Extinction Engine**: a client-side harvester that searches the Bluesky
network for low-visibility, high-signal posts — decentralized ecology, mutual
aid, open-source local tech — and inverts the attention economy's math. Instead
of rewarding virality, the engine weights posts by *inverse* engagement: the
quieter the signal, the louder it counts. The aggregate **Healing Index** feeds
back into the THERMODYNAMIC ELEGANCE // ECOCIDE tab, nudging GROWTH_MANDATE
down and lifting SARG biosphere coherence — closing the loop the grand vision
doc calls the platform's moral anchor.

## Hard constraints

1. **Zero GraphTracks calls.** GraphTracks (`api.graphtracks.com`) remains
   exclusively the BSKY tab's top-posts panel. The engine uses only the free
   public Bluesky AppView, unauthenticated. *(Amended 2026-07-08: the search
   endpoint lives on `api.bsky.app` — the CDN mirror `public.api.bsky.app`
   returns 403 for the `searchPosts` lexicon. Both are Bluesky's free public
   AppView surface; profile/trending calls in the BSKY tab stay on
   `public.api.bsky.app`.)*
2. **Bounded API footprint.** Max 3 `searchPosts` calls per harvest; max one
   harvest per client per 8-hour TTL window. Cache-first render.
3. **No backend.** Static Vite site; everything runs in the browser.
4. **Respect for post authors.** Display text + handle + timestamp + link to
   the original post (same pattern as the trending-topic links). No image
   rehosting, no embedding beyond text.

## Architecture

```
[PROBE ROTATION] ──► [searchPosts ×3] ──► [SUBTHRESHOLD FILTER] ──► [LEXICON SCORER]
 (deterministic        (public AppView,     (engagement < cap:        (healing vs sickness
  8h window)            sort=latest)         keep the ignored)         + inverse-virality)
                                                        │
        localStorage cache (8h TTL) ◄───────────────────┤
                                                        ▼
 [TRANSMISSION UI] ◄── HEALING INDEX / SICKNESS CAP ──► [healingSignal bus] ──► [ECOCIDE TAB]
  (bandwidth gauge,                                      (localStorage +          (GROWTH_MANDATE
   signal cards)                                          pub/sub)                 offset, SARG lift)
```

### New files

| File | Role |
|---|---|
| `src/terminal/lib/inverseEngine.js` | Pure pipeline: probe rotation, subthreshold filter, lexicon scoring, index math. Also the fetch + cache orchestration. |
| `src/terminal/lib/healingSignal.js` | Tiny persistence + pub/sub bus for the Healing Index (localStorage key + in-memory listeners). |
| `src/terminal/hooks/useInverseEngine.js` | React hook: cache-first load, harvest trigger, state for the UI. |
| `src/terminal/views/transmission/InverseEngine.jsx` | The engine section rendered inside TransmissionTab above the fiction archive. |
| `src/terminal/lib/__tests__/inverseEngine.test.js` | Vitest unit tests for the pure pipeline functions. |

### Modified files

- `src/terminal/views/TransmissionTab.jsx` — renders `<InverseEngine />` above
  the oscilloscope timeline / archive grid. No prop changes; the section is
  self-contained via the hook.
- `src/terminal/views/EcocideTab.jsx` — subscribes to the healing signal bus;
  applies the GROWTH_MANDATE offset and SARG healing term (details below).

## 1. Harvest layer

**Probe manifest.** A curated list of 12 query strings grouped into 4 rotation
groups of 3, e.g.:

- Group 0: `"mutual aid"`, `"community garden"`, `"repair cafe"`
- Group 1: `"watershed restoration"`, `"rewilding"`, `"seed library"`
- Group 2: `"community solar"`, `"library of things"`, `"open source ecology"`
- Group 3: `"permaculture"`, `"community land trust"`, `"tool library"`

Final strings tuned during implementation; the list is a plain exported const
so curation is a one-line edit.

**Rotation.** `groupIndex = Math.floor(Date.now() / TTL_MS) % 4` — deterministic,
so all visitors in the same 8h window fire the same probes (cache-friendly,
predictable load).

**Fetch.** For each of the 3 probes in the active group:
`GET https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=<probe>&sort=latest&limit=25&lang=en`
(fired in parallel; each response ≤ 25 posts). Failures per-probe are tolerated —
the harvest proceeds with whatever returned.

**Cache.** localStorage key `scale94_inverse_engine`:

```js
{
  version: 1,
  harvestedAt: <epoch ms>,
  probesUsed: [...],
  signals: [ { uri, handle, displayName, text, createdAt,
               likes, reposts, replies,
               healingScore, sicknessScore, weight, contribution } ],
  healingIndex: 0–100,
  sicknessCap: 0–1,
  bandwidth: 0–100,
}
```

On tab open: cache fresh (< 8h) → render, **zero network**. Stale or absent →
render stale data immediately (with STALE badge) and harvest in background;
swap in results when done.

## 2. Inversion pipeline (pure functions)

**Subthreshold filter.** Keep posts where
`likeCount + repostCount ≤ SUBTHRESHOLD_MAX` (initial value **24**). Also drop
posts older than 14 days and posts by the same author beyond the 2nd
(dedupe: max 2 signals per handle per harvest).

**Lexicon scoring.** Two exported weighted term maps:

- `HEALING_LEXICON` — restoration/commons vocabulary (`mutual aid: 3`,
  `restore: 2`, `commons: 2`, `cooperative: 2`, `rewild: 3`, `solidarity: 2`,
  `permaculture: 2`, `watershed: 2`, `repair: 2`, `share/free/open source: 1`, …).
- `SICKNESS_LEXICON` — panic/outrage/engagement-bait markers (`collapse: 2`,
  `outrage: 2`, `terrifying: 2`, `everyone needs to see this: 3`, plus an
  ALL-CAPS ratio penalty and excessive-exclamation penalty).

Matching is case-insensitive with word boundaries. Per post:
`healingScore = Σ healing weights`, `sicknessScore = Σ sickness weights`.

**Inverse-virality weight.** `w = 1 / Math.log(2 + likes + reposts)`
(engagement 0 → ≈1.44; engagement 24 → ≈0.31). The inversion made literal.

**Post contribution.** `c = max(0, healingScore − sicknessScore) × w`

**Healing Index.** Saturating aggregate over the harvest corpus:
`H = 100 × (1 − e^(−Σc / K))`, with tuning constant `K = 12`. Smooth 0–100,
no cliff, more quiet-healing posts asymptotically approach 100.

**Sickness Cap.** `S = (posts with sicknessScore > healingScore) / totalKept`,
in [0, 1]. The displayed **transmission bandwidth** is throttled by it:
`B = H × (1 − 0.5 × S)`. When the corpus is saturated with panic, the engine
visibly narrows its own pipe.

All constants (`SUBTHRESHOLD_MAX`, `K`, TTL, throttle factor) live in one
exported `ENGINE_TUNING` object.

## 3. Healing signal bus

`healingSignal.js` exposes:

- `publishHealing({ healingIndex, bandwidth, harvestedAt })` — writes
  localStorage key `scale94_healing_signal` and notifies in-memory subscribers.
- `readHealing()` — returns last value or `null`.
- `subscribeHealing(fn)` — pub/sub for live tabs; returns unsubscribe.

Signals older than **24h** are treated as expired (`readHealing()` returns
null) so a dead harvest can't permanently prop up the biosphere.

## 4. Ecocide injection (flagged: confirm at review)

EcocideTab reads the bus on mount and subscribes for live updates.

- **GROWTH_MANDATE offset.** `offset = 0.5 × (H / 100)` percentage points,
  subtracted from the slider's effective mandate (clamped ≥ 0). Rendered
  beside the slider as `[TRANSMISSION_OFFSET −0.37%]` in the transmission
  fuchsia so its origin is legible. The user's slider position is untouched —
  only the effective rate applied to the simulation changes.
- **SARG healing term.** `SARG' = min(10, SARG × (1 + 0.15 × H / 100))` applied
  at the end of `computeSARG`. At H = 100 that's a +15% coherence lift —
  enough to visibly pull a borderline score out of the red, never enough to
  mask a genuinely violated paradox set. When no signal exists (expired/null),
  both terms are zero and the tab behaves exactly as today.

## 5. TRANSMISSION UI

New section `INVERSE_EXTINCTION_ENGINE // SUBTHRESHOLD HARVEST` rendered above
the oscilloscope timeline, in the tab's existing fuchsia CRT idiom:

- **Bandwidth gauge** — horizontal meter showing B (throttled index), with H
  and the Sickness Cap called out; label shifts by band (e.g. `SIGNAL: FAINT /
  CARRIER / STRONG / COHERENT`).
- **Signal cards** — top ~8 posts by contribution: text, `@handle`, relative
  timestamp, healing score, inverse-virality weight, engagement count, link
  out to the original post on bsky.app. Styled like the archive cards but
  visually marked LIVE.
- **Harvest status line** — cache age, next harvest window, probes used, and
  the API-respect note (`public AppView only · GraphTracks untouched`) — the
  restraint policy is itself part of the display.

## Error handling

- All probes fail / offline → keep rendering last cache with `STALE` badge.
- No cache at all → idle state: `[ SIGNAL BELOW THRESHOLD — AWAITING HARVEST
  WINDOW ]`; a manual `RETRY HARVEST` button appears. Fiction archive is never
  affected.
- Malformed post objects are skipped defensively (optional chaining, same
  style as BskyTab's response handling).
- localStorage quota/private-mode failures no-op silently (same pattern as
  `useEcologicalRam`'s `writeLatticeState`).

## Testing

- **Unit (vitest):** subthreshold filter, dedupe, lexicon matcher (word
  boundaries, caps penalty), inverse-virality weight, contribution, Healing
  Index saturation, Sickness Cap throttle, probe rotation determinism, cache
  TTL logic, healing-signal expiry. Fixtures: a dozen synthetic posts spanning
  quiet-healing, loud-healing, panic, and neutral.
- **Manual (preview):** live harvest against the real AppView, cache-first
  reload behavior, stale/idle states (via devtools localStorage edits), and
  the Ecocide offset rendering with a seeded healing signal.

## Out of scope (later phases)

- TESSERACT signing-speed / planetary-RAM modulation by the Healing Index.
- WASM/latent-space semantic scoring (approach C) as a kernel upgrade.
- Feed-generator sources (approach B) as additional probe types.
- Any server-side or scheduled harvesting.
