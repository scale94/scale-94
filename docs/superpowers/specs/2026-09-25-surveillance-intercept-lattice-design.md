# /SURVEILLANCE — The Intercept Lattice (phase 1)

**Date:** 2026-09-25 · **Branch:** `feature/surveillance-inversion` · **Status:** design approved, not built

## Why

Every flagship tab turns an abstract idea into a physical system you can act on:
/ECOCIDE is a thermodynamic balance, /ACCRETION is curved spacetime. /SURVEILLANCE
is still a catalogue: a score, a dot map, 44 cards. Surveillance in reality is
dynamic, adversarial and topological. Phase 1 turns the tab into a network you
send a packet through, while the laws in force act on it.

## Decisions (locked in brainstorm)

| # | Decision | Chosen | Rejected |
|---|---|---|---|
| 1 | Core system | Intercept lattice (routing topology + enforcement ratchet) | freedom hull first; all four ideas phased |
| 2 | Geography | Jurisdiction graph over a ghost of the existing world outline | real cable globe (licence + implied tap sites); pure topology |
| 3 | Visitor interaction | Pick source + destination, bend the route like a rubber band | hand-steered packet; watch-only |
| 4 | Ratchet | Legislative time: detents over the real `legislationStatus` | severity threshold; per-law toggles |
| 5 | Law cards | Linked ledger below the lattice | node dossier drawer; two-view toggle |
| 6 | Rendering | Hybrid: WebGL field (shared GL harness) + SVG interaction layer | all-WebGL; Canvas2D/SVG only |
| 7 | Trunks | Follow real **country-level** connectivity (rule in §4), not freely stylized | free stylization (would make the readout an editorial fiction) |

Cut from this round: the statutory collider (the corpus has no EU Charter Art. 8 and
only ~264 words per law; it would be the site's third collider). Phase 2 is the freedom
hull (§11).

## 1. Hard invariant: the quintessence compile stays untouched

- Nothing on this branch writes to `src/terminal/lib/panopticon.js` or
  `src/terminal/lib/sovereignty.js`. `setPanopticonCorpus` is still called once by
  `App.jsx` with the full corpus, and by nothing else.
- The ratchet position, routes, packets and retention sediment live only in
  SurveillanceTab React state. None of it reaches the spine, the index store,
  localStorage or the network.
- The header's **61** stays as it is: it is the sealed corpus index over all 44 laws,
  the same number PrivacyTab and the sovereignty assessment read.
- The lattice does **not** reuse `computePanopticonIndex` for its own number. The
  formula is a mean (`Σsev² / (n·25)`), so over a subset "in force" it would *rise*
  when a mild law is repealed. The lattice reports route counts instead (§6).

## 2. Data facts this design rests on

Corpus: `public/kernel/legislation.<hash>.json`, 44 records, fields `id, title,
subtitle, severity, severityLabel, location, jurisdiction, legislationStatus, tags, …`.

- `legislationStatus`: ACTIVE 18 · IMPLEMENTING 10 · PASSED 2 · CHALLENGED 4 · PROPOSED 10.
- `location`: 11 countries + `EU` (5 laws). **EU is not a node.** EU laws apply to the
  six member nodes present: Germany, France, Sweden, Ireland, Netherlands, Belgium.
- Surveillance tags (every law carries at least one): Encryption Backdoor 8,
  Platform Mandated Scanning 8, Data Retention 16, Traffic Retention 9, Digital Id 18,
  Biometric Collection 21, Age Verification 9, Worker Surveillance 14.
- Upstream `grey-c0/legislation` was last pushed 2026-03-09 and is dormant. Treat the
  corpus as **sealed**, not live.

**Existing bug, fixed in this work:** `SurveillanceTab.jsx` reads `law.categories` and
`law.legalName`. Neither field exists (the data has `tags` and `subtitle`), so every
category filter returns zero results, and the subtitle and chips never render.

## 3. Architecture

```
src/terminal/lib/interceptLattice.js      pure logic — no React, no GL
src/terminal/components/InterceptLattice.jsx   WebGL field + SVG overlay
src/terminal/views/SurveillanceTab.jsx    composition: lattice → ratchet → ledger
```

**`interceptLattice.js`** (pure, fully unit-tested):

- `NODES`: 11 countries, positions from the existing `REGION_LONLAT` + `REGION_NUDGE`
  via `toMapXY`.
- `TRUNKS`: undirected country pairs (§4).
- `EU_MEMBERS`: the six member nodes.
- `STEPS`: the six detents (§5) → the set of statuses in force.
- `lawsInForce(laws, step)`: the laws whose status is in force at that step.
- `tapsAt(node, laws, step)`: the in-force laws at a node, including EU laws for
  member nodes, grouped by tap type.
- `route(src, dst, waypoints)`: fewest-hop path over `TRUNKS` through the ordered
  waypoints. Ties break on node order, so the result is deterministic.
- `packetFate(route, laws, step)`: an ordered list of `{node, word, lawId}` tap events,
  placed by the rules in §5.
- `familyReadout(laws, step)`: `{unread, unkept, unnamed}`, route counts per family
  (§6).
- `challengedFires(lawId, sendSeq)`: deterministic hash; whether a CHALLENGED law's tap
  fires on the n-th send at the *now* step.

**`InterceptLattice.jsx`**:

- The WebGL layer uses `useShaderCanvas` / `frameLoop` from `src/terminal/gl/`. It draws
  trunk glow, ambient traffic, tap blooms, the packet trail and retention afterimages.
  Uniform arrays are sized for 11 nodes and ≤ 32 trunks.
- The SVG layer draws the nodes (focusable), labels, tap ticks, the route filament and
  its drag handle, the EU membrane (a faint hull around the six members) and the
  packet fallback.
- It only reads from the pure module. It holds UI state, never corpus state.

## 4. Trunk rule

A trunk joins two nodes if they share **a land border, a direct submarine cable
landing between the two countries, or a connection that passes only through countries
outside the corpus**. It is coarse and defensible, and labelled in the UI as
*country-level connectivity, not cable routes*. Only the country pairs are recorded;
no cable data is copied.

Final list (22 trunks, verified during planning):

- Land: US–CA · FR–BE · FR–DE · BE–NL · BE–DE · NL–DE
- Transatlantic: US–UK · US–IE · US–FR · US–DE · US–NL (AC-1 lands in Germany and the
  Netherlands) · CA–UK · CA–IE (Hibernia Express: Halifax–Brean, Halifax–Cork)
- Intra-Europe: UK–IE · UK–FR · UK–BE · UK–NL · IE–FR · DE–SE (through Denmark,
  outside the corpus; the Germany–Sweden "Baltic Cable" is a power line, not data)
- Pacific: US–AU · US–NZ · AU–NZ

New Zealand's cables (Southern Cross, Hawaiki) land in Australia, Hawaii/US and Fiji,
none in Canada. So **Canada ↔ New Zealand must transit the US or Australia**.

Routing takes the fewest hops. Ties go to the geographically shorter path, so a UK →
Germany packet crosses the North Sea rather than the Atlantic twice. The CHALLENGED
flicker hash is fnv1a finished with the murmur3 mixer, because the fnv1a low bit alone
flips every law in lockstep on alternate sends.

## 5. Ratchet and taps

**Detents** (left → right). Moving left rewinds legislative time, so the most recent
laws drop out first:

| detent | in force |
|---|---|
| `before` | nothing |
| `active` | ACTIVE |
| `implementing` | + IMPLEMENTING |
| **`now`** (default) | + PASSED · CHALLENGED flicker |
| `upheld` | + CHALLENGED (steady) |
| `proposed` | + PROPOSED (all 44) |

- The slider is a real `<input type="range" min=0 max=5 step=1>`, styled.
- Moving between detents snaps crisply: taps switch on instantly, and warmth and bloom
  ease in over ~400 ms.
- **A detent change re-sends the current route**, so scrubbing compares the same
  packet's fate across time.

**Tap placement and words** (past participles, lowercase, one word at the node when the
tap fires):

| tag | fires at | visual | word |
|---|---|---|---|
| Platform Mandated Scanning | source (before sealing) and destination (after opening) | the bead leaves open and closes only after an inspection flash; the same flash on arrival | **seen** |
| Encryption Backdoor | every node on the route (transit + ends) | a faint twin peels off and orbits the node; the bead arrives untouched | **read** |
| Data Retention | every node on the route | a dim afterimage stays and builds up per send | **kept** |
| Traffic Retention | every hop through the node | that part of the filament stays traced | **traced** |
| Digital Id | source | a small glyph attaches to the bead | **named** |
| Age Verification | destination | the packet is held for a beat at the gate | **proven** |
| Biometric Collection | source | the bead takes on a slow pulse | **measured** |
| Worker Surveillance | source node | a faint ring closes around the origin | **watched** |

Legend line (always visible, low opacity): *each word marks what the law permits, not
what happened · within this corpus.*

## 6. Readouts

**Fate line** (under the lattice, `aria-live="polite"`):

```
london → canberra · 4 hops · seen before leaving · kept at london, ottawa · read at canberra
```

A packet with no events at all reads `arrived. unseen.`

**Family readout** (next to the ratchet): `unread 1 · unkept 1 · unnamed 0`. A zero
renders as `none`. Each count is the number of unordered node pairs (of 55) where at
least one sending direction has *some* route free of that family's taps:

- unread: no Encryption Backdoor on any route node, and no Scanning at either end
- unkept: no Data Retention or Traffic Retention on any route node
- unnamed (A→B): no Digital Id, Biometric or Worker Surveillance at A, and no Age
  Verification at B

Exact values on the final trunk graph (pinned in tests against the sealed corpus):

| detent | laws | unread | unkept | unnamed |
|---|---|---|---|---|
| before | 0 | 55 | 55 | 55 |
| active | 18 | 3 | 6 | 18 |
| implementing | 28 | 1 | none | none |
| now | 30 | 1 | none | none |
| upheld | 34 | none | none | none |
| proposed | 44 | none | none | none |

The single unread pair at `now` is Canada ↔ New Zealand, routed through the US. The
corpus gives the US no encryption-backdoor law, and scanning only counts at the ends.
When the four CHALLENGED laws are upheld, it closes.

Five Eyes membership is not in the corpus and is not encoded.

## 7. Field and motion

- Ambient beads flow along every trunk the whole time, in the smooth register of the
  strimer and wavefront work.
- Trunks with no taps sit cool (cyan/indigo). Palette warmth rises toward the tab's
  orange/red with the laws in force, so the colour comes from the data, not decoration.
- Node bloom ∝ Σsev² of the in-force laws at that node. Up to 8 tap ticks sit around
  the node ring at fixed angles, one per tap type.
- Onsets are crisp, motion is smooth. No strobe, no raster tearing on text, no sound in
  phase 1.
- Retention sediment is a per-node count capped at 12 (the ring saturates rather than
  growing). It exists in memory only and is cleared on unmount.

## 8. Ledger (the law cards)

- The grid stays below the lattice with its current card look.
- Hovering a card pulses its node(s) and highlights its tap tick. An EU card lights
  all six member nodes and the EU membrane.
- The ledger follows the node you last touched: each node click sets the region filter
  to that node (EU laws included for members). Clicking the source again resets the
  route and the filter to all. Clicking a card still calls `onOpenLaw`.
- The stats row folds into the lattice readout. Filters stay, compacted. The category
  filter now reads `tags`, and the subtitle line reads `subtitle`.
- Copy: `INDEXING ACTIVE` / `ACTIVE CORPUS` become an honest *sealed 2026-03-09*.
  The @grey-c0 / Navigators Guild attribution stays in full.

## 9. Accessibility, input, and fallbacks

- Nodes are reachable with Tab. Enter picks source, then destination. Shift+Enter
  adds a waypoint (the keyboard version of bending).
- Touch: tap nodes to pick them, and tap intermediate nodes to bend.
- Reduced motion: no ambient traffic, and the packet jumps hop to hop (the harness
  frame loop already exposes this).
- **No WebGL or context lost:** the SVG layer alone renders everything (static glow,
  the packet as an SVG circle). All interaction and the fate line still work.
- Hidden tab: the frame loop pauses (existing harness behaviour).
- Corpus not loaded: trunks render with nothing in force, and the existing
  *indexing* state shows below. A law whose location matches no node appears in the
  ledger only.

## 10. Testing

- **`interceptLattice.test.js`:**
  - laws in force per detent = 0 / 18 / 28 / 30 / 34 / 44;
  - EU fan-out to exactly the six members;
  - trunk symmetry, and that every node is reachable;
  - waypoint routing and deterministic tie-breaks;
  - tap placement (scanning at source, age verification at destination, backdoor and
    retention on every route node);
  - `challengedFires` is deterministic;
  - `familyReadout` pinned per detent after `TRUNKS` is verified.
- **Component tests:**
  - card hover lights its node;
  - keyboard source, destination and waypoint selection;
  - the fate line updates the aria-live text;
  - the category filter returns laws for every tag (regression for the §2 bug).
- **Compile invariant:** a spy asserts SurveillanceTab never calls
  `setPanopticonCorpus` and never writes storage. The existing panopticon and
  sovereignty suites, plus the full suite, pass unchanged.
- **GL:** capture the new shader's init + frames call log as snapshots **before**
  tuning it (the harness snapshot-first method).
- **Browser:** screenshot before diagnosing anything visual; mobile width check; one
  full crystallize run end to end before merge.

## 11. Out of scope for phase 1

- **Phase 2, the freedom hull:** a polyhedron whose faces are cut by the in-force tap
  families, driven by the same ratchet, as the lattice's readout.
- Audio (carrier tone, relay clicks).
- An exfiltration mode on the lattice (avoid turning whistleblowing into a win/lose
  score).
- Refreshing or forking the corpus beyond marking it sealed.
- Any link from the lattice to the quintessence spine.
