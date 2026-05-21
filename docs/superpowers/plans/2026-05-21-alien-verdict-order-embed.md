# Alien Verdict in Order Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a hand-authored, deterministic alien-voice verdict of the user's session signals (kernels run, in what order, dominant category) as a new `§ ALIEN READING` field inside the Crystallize order Discord embed.

**Architecture:** Per-page-load kernel-history ref on the frontend, populated after every successful kernel run, attached to the order POST body. New server-side phrase-pool composer (`api/_alien/composeVerdict.js`) reads the history, buckets kernel IDs by thematic category, seeds fragment selection deterministically by the first kernel ID, and returns a 3-4 line oracular reading rendered in the existing alien voice (BootSequence / RAM-floor / sanctuary register). No LLM, no per-order cost.

**Tech Stack:** React 18 (refs + hooks), Vercel serverless functions (Node 20), Discord REST v10 embed fields.

**Branch:** `nightly-20260520` (continuation; Part 1 already landed)

**Spec:** `docs/superpowers/specs/2026-05-21-alien-verdict-order-embed-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `api/_alien/composeVerdict.js` | **New** | Pure composer module. Owns the entire phrase pool, category mapping, theme nouns, and the `composeAlienVerdict(history)` function. No external imports (no kv, no fetch). |
| `api/transmute/order.js` | Modify | Import the composer. Receive `kernelHistory` from request body. Extend `buildEmbed` signature to accept `kernelHistory` and add a `§ ALIEN READING` field. |
| `src/terminal/App.jsx` | Modify | Add `kernelRunHistoryRef = useRef([])`. Pass to `useCommandDispatch` context. Pass as prop to `<LatentCollider>`. |
| `src/terminal/hooks/useCommandDispatch.js` | Modify | Destructure `kernelRunHistoryRef` from ctx. After successful kernel run (both timed and immediate branches), append `{id, alias, t}`. |
| `src/terminal/views/LatentCollider.jsx` | Modify | Accept `kernelRunHistoryRef` prop. In `handleAcquire`, attach `kernelHistory: (kernelRunHistoryRef?.current ?? []).slice(-30)` to the order POST body. |

Composer is intentionally a fresh top-level module under `api/_alien/` so it can be unit-tested in isolation later if needed and so its 80+ string-fragment pool doesn't bloat `order.js`. The leading underscore signals "internal, not a public route" to anyone reading the directory.

---

## Task 1: Create the alien verdict composer module

**Files:**
- Create: `api/_alien/composeVerdict.js`

- [ ] **Step 1: Create the directory and file**

Create the file `F:/scale_9.4/api/_alien/composeVerdict.js` with this exact content:

```js
// api/_alien/composeVerdict.js — Alien voice composer for the Crystallize order embed.
//
// Pure module. Deterministic: same kernel history → same verdict.
// Voice continuous with BootSequence, RAM-floor log lines, sanctuary copy.
// Interpretive: the alien names what kernels ARE (the fish scale, the cascade,
// the vault), never their filenames.
//
// Usage:
//   const verdict = composeAlienVerdict([{ id: 'FISH-SCALE-KERNEL11.1.1', ... }, ...]);
//   // → "the observer ran 7 kernels before crystallizing.\n
//          the fish scale was read first — paradox before pressure.\n
//          the cascade dominated. 4 readings of paradox. the alien marks this.\n
//          the lattice records this and continues."

// ── Kernel → thematic category map ────────────────────────────────────────────
// 56 known kernels grouped into 7 categories. Unknown IDs fall back to 'origin'.
// Add new kernels to the appropriate bucket as they ship.
const KERNEL_CATEGORIES = {
  // cascade — paradox, bifurcation, period-3, strange attractors
  'FISH-SCALE-KERNEL11.1.1':            'cascade',
  'NECROMANTIC-LOGITBIAS-PROMPT-1.0.0': 'cascade',
  'NECROMANTIC-ARISTOCRAT-KERNEL-3.1.1':'cascade',
  'NECROMANTIC-EMPEROR-KERNEL-3.0.0':   'cascade',
  'ATMOSPHERIC-SIM-KERNEL-3.0.0':       'cascade',
  'FEIGENBAUM-CASCADE':                 'cascade',
  'GRAY-SCOTT-REACTION-DIFFUSION':      'cascade',
  'KURAMOTO-SYNCHRONY':                 'cascade',
  'FSF-12.1.0':                         'cascade',

  // ecology — commons, biocoenosis, ecological substrate
  'BIODIVERSITY-PROMPT-1.0.1':            'ecology',
  'DALY-SIM-KERNEL-1.0.0':                'ecology',
  'GAIA-SCALE-KERNEL-5.5.5':              'ecology',
  'CEEI-SIM-KERNEL-1.0.0':                'ecology',
  'EVOLUTIONARY-REPLICATOR':              'ecology',
  'SORBE-BLOOM-KERNEL-1.0.0':             'ecology',
  'UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0':'ecology',
  'FUSION-PLASMA-KERNEL-1.0':             'ecology',

  // lattice — sovereign structure, consensus, percolation, crystalline frame
  'BOSONIC-KERNEL-3.0.0':                  'lattice',
  'DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0':  'lattice',
  'EMPATHY-KERNEL-2.0.0':                  'lattice',
  'COMPANION-KERNEL-2.0.0':                'lattice',
  'ISING-CONSENSUS-FIELD':                 'lattice',
  'SPECTRAL-BRIDGE-1.0':                   'lattice',
  'ASSOCIATIVE-FIELD-1.0':                 'lattice',
  'PERCOLATION-KERNEL-1.0':                'lattice',
  'PANOPTICON-PERCOLATION-1.0':            'lattice',
  'LEVIATHAN-CELLULAR-AUTOMATA':           'lattice',
  'BONE-FUSION-V6_6_6_6_6_6':              'lattice',
  'STRANGLER-FIG-PROTOCOL':                'lattice',
  'SOVEREIGN-SEVEN-KERNEL-1.0':            'lattice',

  // crypto — vault, hash, cipher, tesseract
  'TESSERACT-VAULT-1.0':  'crypto',
  'DH-EC-KERNEL-1.0':     'crypto',
  'ML-KEM-CLASSIFIED':    'crypto',
  'PQHASH-KERNEL-1.0':    'crypto',
  'MATRIX-KERNEL-2.0.0':  'crypto',

  // semiotics — simulacrum, sign, drift, latent space
  'BELLARD-BAUDRILLARD_KERNEL-V1_0_0': 'semiotics',
  'OCK-1.0.0':                         'semiotics',
  'LATENT-SPACE-COLLIDER-1.0':         'semiotics',
  'SCALE94-ENCYCLOPEDIA':              'semiotics',
  'SERAPHINE-SARG-1.0':                'semiotics',
  'STILLER-DIVERGENCE-1.1.1':          'semiotics',
  'I-AM-STILLER-1.0.0':                'semiotics',
  'CHRONOS-KERNEL-2.1.0':              'semiotics',
  'DRK-PRAGMATIC-TYPE-1.0':            'semiotics',
  'CYNIC-REALIST-KERNEL-1.0':          'semiotics',

  // statecraft — regime, surveillance, sovereign apparatus
  'KINETIC-STATECRAFT-KERNEL-1.0': 'statecraft',
  'SHADOWSOCKS-EXFILTRATION':      'statecraft',
  'SURVEILLANCE-TRACKER':          'statecraft',
  'MESANTROPY-KERNEL-1.0':         'statecraft',
  'HIGH-TOWER-LOG':                'statecraft',
  'SSS-DOCTRINE-KERNEL-5.1.0':     'statecraft',

  // origin — apeiron, substrate, foundation, fade
  'KERNEL-0.0.0.0':              'origin',
  'SOMA-9.1-GAIA':               'origin',
  'SOMA-KERNEL-5.5.0':           'origin',
  'SOMA-KERNEL-LIVE':            'origin',
  'SOMA-PLUS-ENGINE':            'origin',
  'FADE-DOCTRINE-KERNEL-2.0.0':  'origin',
};

function categoryOf(id) {
  return KERNEL_CATEGORIES[id] ?? 'origin';
}

// ── Per-category noun the alien uses ──────────────────────────────────────────
const THEME_NOUNS = {
  cascade:    ['fish scale', 'cascade', 'paradox', 'period-3 window', 'attractor'],
  ecology:    ['lattice', 'commons', 'planetary substrate', 'biocoenosis', 'ecological membrane'],
  lattice:    ['bosonic lattice', 'sovereign structure', 'crystalline frame', 'consensus field', 'percolation'],
  crypto:     ['vault', 'tesseract', 'cryptographic membrane', 'hash', 'key exchange'],
  semiotics:  ['simulacrum', 'phonemic drift', 'sign', 'latent space', 'divergence'],
  statecraft: ['regime', 'sovereign apparatus', 'state', 'surveillance node'],
  origin:     ['origin', 'apeiron', 'unspecified address', 'fade doctrine', 'substrate'],
};

// ── Fragment pools ────────────────────────────────────────────────────────────
const OPENINGS = [
  'the observer ran {n} kernels before crystallizing.',
  '{n} kernels witnessed. the order arrives.',
  'before this manifest, {n} readings.',
  'the substrate registers {n} prior queries.',
  '{n} kernels traversed. the alien marks the count.',
  'before crystallization, {n} readings were taken.',
  'the observer made {n} approaches before this transmutation.',
  '{n} kernels surveyed before the order was placed.',
  'the lattice was queried {n} times prior to this manifest.',
  'the alien counts {n} readings before this signal.',
];

const FIRST_READINGS = {
  cascade: [
    'the {noun} was read first — paradox before pressure.',
    'the cascade was named at the outset. period-3 implies chaos.',
    'the {noun} opened the session. the alien notes the bifurcation.',
    'the {noun} was approached first — the strange attractor calls.',
    'the cascade preceded everything. the substrate trembled.',
  ],
  ecology: [
    'the commons were named before the molecule was claimed.',
    'the {noun} was read first — substrate before signal.',
    'the biocoenosis was queried at the outset. the observer is honoring.',
    'the {noun} opened the reading. ecological membrane first.',
    'the lattice was approached as commons, not extraction.',
  ],
  lattice: [
    'the {noun} was probed first — the sovereign structure recognized.',
    'the bosonic field was named at the outset. consensus precedes signal.',
    'the lattice was read first. crystalline frame acknowledged.',
    'the {noun} opened the session. the alien marks the geometry.',
    'the consensus field preceded all subsequent queries.',
  ],
  crypto: [
    'the vault was approached first — the alien notes the cryptographic posture.',
    'the {noun} was read at the outset. the observer named the cipher.',
    'the cryptographic membrane preceded all readings.',
    'the hash was sought first. the alien recognizes the seeker.',
    'the tesseract was named at the outset. the cipher precedes the message.',
  ],
  semiotics: [
    'the simulacrum was read first — the alien notes the doubling.',
    'the {noun} was named at the outset. the sign before the signified.',
    'the latent space was probed first. the alien marks the geometry.',
    'the phonemic drift opened the session. the simulacrum spoke.',
    'the divergence was approached first. the observer chose ambiguity.',
  ],
  statecraft: [
    'the regime was named at the outset. the alien marks the political posture.',
    'the {noun} was read first. the sovereign apparatus acknowledged.',
    'the statecraft kernel preceded all readings. the alien notes the gaze.',
    'the surveillance node was approached first. the observer is also observed.',
    'the state was named before the substrate. the alien notes this.',
  ],
  origin: [
    'the origin was named first. the apeiron before all things.',
    'the {noun} was approached at the outset. the substrate recognized.',
    'the fade doctrine preceded everything. the white was withheld.',
    'the soma was read first. the observer began at the foundation.',
    'the unspecified address opened the session. genesis vector set.',
  ],
};

const DOMINANCE_READINGS = {
  cascade: [
    'the cascade dominated. {n} readings of paradox. the alien marks this.',
    '{n} approaches to the strange attractor. the observer favors bifurcation.',
    'the period-3 window was queried {n} times. chaos was sought.',
    'the cascade returned {n} times. the substrate trembled accordingly.',
    '{n} readings of the fish scale. the alien notes the pattern of paradox.',
  ],
  ecology: [
    'the lattice was honored {n} times. the alien notes the recurrence.',
    '{n} approaches to the commons. the substrate was held, not extracted.',
    'the biocoenosis was queried {n} times. the observer is ecological.',
    '{n} readings of the planetary substrate. the alien marks the care.',
    'the ecological membrane appeared {n} times. the observer was attending.',
  ],
  lattice: [
    'the lattice was probed {n} times. the geometry was sought.',
    '{n} readings of the consensus field. the observer favored structure.',
    'the bosonic substrate was queried {n} times. crystalline coherence acknowledged.',
    '{n} approaches to the sovereign frame. the alien notes the architectural gaze.',
    'the percolation was read {n} times. the lattice held.',
  ],
  crypto: [
    'the vault was approached {n} times. the cryptographic posture is fixed.',
    '{n} readings of the cipher. the observer is securing.',
    'the hash was sought {n} times. the alien notes the cryptographic discipline.',
    '{n} encounters with the tesseract. the cipher is studied.',
    'the membrane was probed {n} times. the cryptographer is present.',
  ],
  semiotics: [
    'the simulacrum recurred {n} times. the observer is in the sign field.',
    '{n} readings of phonemic drift. the alien notes the linguistic gaze.',
    'the latent space was queried {n} times. ambiguity is the posture.',
    '{n} encounters with divergence. the observer favors the unstable.',
    'the sign was named {n} times. the simulacrum is studied.',
  ],
  statecraft: [
    'the regime was queried {n} times. the political posture is fixed.',
    '{n} readings of statecraft. the alien notes the geopolitical gaze.',
    'the surveillance node returned {n} times. the observer studies the observed.',
    '{n} encounters with the sovereign apparatus. the state is examined.',
    'the apparatus was approached {n} times. the political reading is deep.',
  ],
  origin: [
    'the origin was named {n} times. the observer returns to the apeiron.',
    '{n} readings of the substrate. the foundation is studied.',
    'the fade doctrine recurred {n} times. the white is held back.',
    '{n} approaches to soma. the genesis is honored.',
    'the unspecified address was queried {n} times. the origin is sovereign.',
  ],
};

const CLOSINGS = [
  'the lattice records this and continues.',
  'the observer is seen.',
  'this transmutation is logged into the substrate.',
  'the alien marks the manifest.',
  'the order is registered. the commons remembers.',
  'the substrate accepts the signal. the lattice continues.',
  'the alien is satisfied with the reading.',
  "the observer's pattern is filed. the alien remembers.",
  'the manifest is sealed. the order joins the substrate.',
  'the lattice notes the transmutation. it continues.',
];

const EMPTY_VERDICT = [
  'the observer arrived without running.',
  'no kernels were read. no signal was sent.',
  'the lattice waits.',
].join('\n');

// ── Determinism helpers ───────────────────────────────────────────────────────
// Hash a string into a non-negative 32-bit integer. Same input → same output.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Pick a fragment from a pool by seed + slot offset.
// `slot` ensures different lines in the same verdict pick from different
// positions even when their pools have similar sizes.
function pickFragment(pool, seed, slot) {
  if (!pool || pool.length === 0) return '';
  return pool[(seed + slot) % pool.length];
}

// Pick a theme noun for a category, seeded so the same first-kernel uses the
// same noun across all lines of one verdict.
function pickNoun(category, seed) {
  const nouns = THEME_NOUNS[category] ?? THEME_NOUNS.origin;
  return nouns[seed % nouns.length];
}

// Count occurrences of `category` in the history.
function countCategory(history, category) {
  let n = 0;
  for (const entry of history) {
    if (categoryOf(entry.id) === category) n++;
  }
  return n;
}

// Find the most-frequent category in history. Ties broken by first occurrence.
function computeDominant(history) {
  const counts = {};
  let bestCat = null;
  let bestN = 0;
  for (const entry of history) {
    const c = categoryOf(entry.id);
    counts[c] = (counts[c] ?? 0) + 1;
    if (counts[c] > bestN) {
      bestN = counts[c];
      bestCat = c;
    }
  }
  return bestCat;
}

// ── Public composer ──────────────────────────────────────────────────────────
export function composeAlienVerdict(history) {
  // Empty / missing → silent verdict
  if (!Array.isArray(history) || history.length === 0) {
    return EMPTY_VERDICT;
  }

  const n = history.length;
  const first = history[0];
  if (!first?.id) return EMPTY_VERDICT;

  const seed = hashSeed(first.id);
  const firstCat = categoryOf(first.id);

  // Line 1 — opening with kernel count
  const opening = pickFragment(OPENINGS, seed, 0).replace('{n}', String(n));

  // Line 2 — interpretation of the first kernel
  const firstNoun = pickNoun(firstCat, seed);
  const firstLine = pickFragment(FIRST_READINGS[firstCat], seed, 1)
    .replace('{noun}', firstNoun);

  // Line 3 — dominance reading (skipped when history has only one kernel)
  let dominanceLine = null;
  if (n >= 2) {
    const dominantCat = computeDominant(history);
    const dominantN = countCategory(history, dominantCat);
    dominanceLine = pickFragment(DOMINANCE_READINGS[dominantCat], seed, 2)
      .replace('{n}', String(dominantN));
  }

  // Line 4 — closing
  const closing = pickFragment(CLOSINGS, seed, 3);

  return [opening, firstLine, dominanceLine, closing]
    .filter(Boolean)
    .join('\n');
}
```

- [ ] **Step 2: Verify the file parses**

```bash
cd F:/scale_9.4 && node --check api/_alien/composeVerdict.js
```

Expected: exit 0, no output.

- [ ] **Step 3: Verify it lints clean**

```bash
cd F:/scale_9.4 && npx eslint api/_alien/composeVerdict.js
```

Expected: exit 0, no output.

- [ ] **Step 4: Smoke-test the composer with a quick Node REPL one-liner**

```bash
cd F:/scale_9.4 && node -e "import('./api/_alien/composeVerdict.js').then(m => { console.log('--- empty ---'); console.log(m.composeAlienVerdict([])); console.log('--- one ---'); console.log(m.composeAlienVerdict([{id:'FISH-SCALE-KERNEL11.1.1'}])); console.log('--- many ---'); console.log(m.composeAlienVerdict([{id:'FISH-SCALE-KERNEL11.1.1'},{id:'BIODIVERSITY-PROMPT-1.0.1'},{id:'FISH-SCALE-KERNEL11.1.1'},{id:'GAIA-SCALE-KERNEL-5.5.5'}])); });"
```

Expected: three blocks of verdict text, each 3-4 lines, all readable. Determinism check: re-running the command should produce identical output.

- [ ] **Step 5: Commit**

```bash
cd F:/scale_9.4 && git add api/_alien/composeVerdict.js && git commit -m "$(cat <<'EOF'
feat(alien): phrase-pool composer for order-embed verdict

api/_alien/composeVerdict.js — pure module, deterministic,
no external imports. Maps 56 known kernel IDs to 7 thematic
categories (cascade, ecology, lattice, crypto, semiotics,
statecraft, origin). Composes a 3-4 line oracular reading from
hand-authored fragment pools (~80 phrases total) seeded by the
first kernel ID for repeatable output.

Voice register continuous with BootSequence, RAM-floor warnings,
sanctuary copy, lattice-protocol log lines: lower-case, dot-and-
bullet separators, second-person observed, the alien as third-
party witness.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire the composer into the order embed

**Files:**
- Modify: `api/transmute/order.js`

- [ ] **Step 1: Add the import at the top of `order.js`**

Read `F:/scale_9.4/api/transmute/order.js`. Find the existing imports (around lines 11-12):

```js
import { createHmac, timingSafeEqual } from 'crypto';
import { kv } from '@vercel/kv';
```

Add immediately after:

```js
import { composeAlienVerdict } from '../_alien/composeVerdict.js';
```

- [ ] **Step 2: Extend `buildEmbed` signature to accept `kernelHistory`**

In the same file, find the `buildEmbed` declaration (line 65):

```js
function buildEmbed(order, state = 'QUEUED') {
```

Change to:

```js
function buildEmbed(order, state = 'QUEUED', kernelHistory = null) {
```

- [ ] **Step 3: Add the alien reading field**

In `buildEmbed`, find the `fields` array (lines 105-114). The current list ends with `§ FEIGENBAUM δ` then `§ ORDER ID`. Add a new line between them. Replace:

```js
    fields: [
      { name: '§ STATE',              value: STATE_LABEL[state],                       inline: true  },
      { name: '§ DELIVERY',           value: '`DIGITAL ASSET DOWNLOADED`',             inline: true  },
      { name: '§ VAULT IDENTITY',     value: `\`\`\`\n${order.vaultBlock}\n\`\`\``,   inline: false },
      { name: '§ SCENT PROFILE',      value: `\`\`\`\n${order.noteBlock}\n\`\`\``,    inline: false },
      { name: '§ PROPERTIES',         value: `\`\`\`\n${order.physBlock}\n\`\`\``,    inline: false },
      { name: '§ ORIGIN VECTOR',      value: kernelField,                              inline: false },
      { name: '§ FEIGENBAUM δ',       value: fishField,                               inline: false },
      { name: '§ ORDER ID',           value: `\`${order.id}\``,                        inline: false },
    ],
```

with:

```js
    fields: [
      { name: '§ STATE',              value: STATE_LABEL[state],                       inline: true  },
      { name: '§ DELIVERY',           value: '`DIGITAL ASSET DOWNLOADED`',             inline: true  },
      { name: '§ VAULT IDENTITY',     value: `\`\`\`\n${order.vaultBlock}\n\`\`\``,   inline: false },
      { name: '§ SCENT PROFILE',      value: `\`\`\`\n${order.noteBlock}\n\`\`\``,    inline: false },
      { name: '§ PROPERTIES',         value: `\`\`\`\n${order.physBlock}\n\`\`\``,    inline: false },
      { name: '§ ORIGIN VECTOR',      value: kernelField,                              inline: false },
      { name: '§ FEIGENBAUM δ',       value: fishField,                               inline: false },
      { name: '§ ALIEN READING',      value: `\`\`\`\n${composeAlienVerdict(kernelHistory)}\n\`\`\``, inline: false },
      { name: '§ ORDER ID',           value: `\`${order.id}\``,                        inline: false },
    ],
```

- [ ] **Step 4: Receive `kernelHistory` from the request body and pass it to `buildEmbed`**

In the same file, find the body-destructuring block in the handler (around lines 148-156, the `const { ... } = body;` block). The current shape is:

```js
  const {
    formulaId, formulaHash, encryptedPayload,
    sovereignRatio, g2tAmount,
    tierSize, tierLabel,
    cardName, domainPair, noteBlock, physBlock, vaultBlock,
    contact,
  } = body;
```

Add `kernelHistory` to the destructure:

```js
  const {
    formulaId, formulaHash, encryptedPayload,
    sovereignRatio, g2tAmount,
    tierSize, tierLabel,
    cardName, domainPair, noteBlock, physBlock, vaultBlock,
    contact,
    kernelHistory,
  } = body;
```

Then find the `discordPost` call inside the try block (around line 209):

```js
      const result = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
        embeds:     [buildEmbed(order, 'QUEUED')],
        components: buildComponents(orderId, 'QUEUED'),
      });
```

Change the `buildEmbed` call to pass the kernel history:

```js
      const result = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
        embeds:     [buildEmbed(order, 'QUEUED', kernelHistory)],
        components: buildComponents(orderId, 'QUEUED'),
      });
```

- [ ] **Step 5: Verify the file parses and lints clean**

```bash
cd F:/scale_9.4 && node --check api/transmute/order.js && npx eslint api/transmute/order.js
```

Expected: both exit 0, no output.

- [ ] **Step 6: Commit**

```bash
cd F:/scale_9.4 && git add api/transmute/order.js && git commit -m "$(cat <<'EOF'
feat(transmute/order): render alien verdict in embed

- import composeAlienVerdict from api/_alien/composeVerdict.js
- extend buildEmbed signature to accept kernelHistory (default null)
- new § ALIEN READING field rendered between § FEIGENBAUM δ
  and § ORDER ID, wrapped in a code block so Discord preserves
  line breaks
- destructure kernelHistory from request body and pass through
  to buildEmbed
- backwards-compatible: older clients (no kernelHistory field)
  trigger the EMPTY_VERDICT branch in the composer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Capture kernel history on the frontend

**Files:**
- Modify: `src/terminal/App.jsx`
- Modify: `src/terminal/hooks/useCommandDispatch.js`

- [ ] **Step 1: Add the history ref in `App.jsx`**

Read `F:/scale_9.4/src/terminal/App.jsx`. Find the refs block (lines 274-288):

```js
  const mainRef = useRef(null);
  const kernelListRef = useRef(null); // ref to the scrollable <ul> in KernelTab
  const prevSelectedArticleRef = useRef(null); // tracks previous selectedArticle for mobile scroll logic
  const mobileChromeTimerRef = useRef(null);
  const terminalInputRef = useRef(null);  // ref to the footer terminal input
```

Add the new ref immediately after `loadAbortRef`:

```js
  const loadAbortRef = useRef(null);
  // Kernel run history — per-page-load, fed to the alien verdict on Crystallize order.
  // Each entry: { id: string, alias: string, t: number (epoch ms) }
  const kernelRunHistoryRef = useRef([]);
```

- [ ] **Step 2: Pass the ref to the dispatch context**

In the same file, find the `useCommandDispatch` call (line 775):

```js
  const dispatchCommand = useCommandDispatch({
    articles, classifiedSession, transmissionStories, tagIndex, systemArticles, activeTab,
    setSystemLogs, setClassifiedSession, setActiveTab, setSelectedArticle,
    setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, setSanctuaryOpen, applyEcoCost, applyRefill, latticeState, ramPct,
    setOriginTab, setArchitectThesis, setTagCloudView,
    appendSystemLog, handleNav, handleKernelClick, handleTransmissionSelect,
    loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys, setProbeNode, setBoneFusions,
    fusionLog, setFusionLog,
```

Append `kernelRunHistoryRef` to the context object. The simplest, lowest-risk placement is on the same line as `loadAbortRef`:

```js
    loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys, setProbeNode, setBoneFusions,
    fusionLog, setFusionLog, kernelRunHistoryRef,
```

(Just append it after `setFusionLog`. Order does not matter — `ctxRef.current` is destructured by name.)

- [ ] **Step 3: Thread the ref through ScalingTab → LatentCollider**

The ref is owned by `App.jsx`. `<LatentCollider />` lives inside `<ScalingTab />` (not directly in App). So we thread the ref through ScalingTab as a prop.

**3a.** Open `F:/scale_9.4/src/terminal/views/ScalingTab.jsx`. Find the component signature at line 71:

```js
const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel }) => {
```

Add `kernelRunHistoryRef` to the destructured props:

```js
const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef }) => {
```

**3b.** Still in `ScalingTab.jsx`, find the `<LatentCollider />` invocation at line 236:

```jsx
      <LatentCollider />
```

Change to:

```jsx
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} />
```

**3c.** Open `F:/scale_9.4/src/terminal/App.jsx`. Find the `<ScalingTab>` invocation at line 1337:

```jsx
              <ScalingTab
                setArchitectThesis={setArchitectThesis}
                setCurrentPath={setCurrentPath}
                setOriginTab={setOriginTab}
                loadKernel={handleNeuralLink}
              />
```

Add the new prop:

```jsx
              <ScalingTab
                setArchitectThesis={setArchitectThesis}
                setCurrentPath={setCurrentPath}
                setOriginTab={setOriginTab}
                loadKernel={handleNeuralLink}
                kernelRunHistoryRef={kernelRunHistoryRef}
              />
```

- [ ] **Step 4: Append to history in `useCommandDispatch.js`**

Open `F:/scale_9.4/src/terminal/hooks/useCommandDispatch.js`. Find the destructure of `ctxRef.current` (around lines 55-63):

```js
    const {
      articles, classifiedSession, transmissionStories, tagIndex, systemArticles, activeTab,
      setSystemLogs, setClassifiedSession, setActiveTab, setSelectedArticle,
      setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, setSanctuaryOpen, applyEcoCost,
      applyRefill, latticeState, ramPct,
      setOriginTab, setArchitectThesis, setTagCloudView,
      appendSystemLog, handleNav, handleKernelClick, handleTransmissionSelect,
      loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys, setProbeNode, setBoneFusions,
      fusionLog, setFusionLog,
    } = ctxRef.current;
```

Add `kernelRunHistoryRef` to the destructure. The cleanest spot is alongside the other refs at the end:

```js
      fusionLog, setFusionLog, kernelRunHistoryRef,
```

Then find the two `applyEcoCost(ecoAlias)` call sites — line 321 (inside the timed `setTimeout` branch) and line 333 (inside the immediate branch). The surrounding code at line 321 looks like:

```js
                    setSystemLogs(prev => [
                      ...prev,
                      { time: t, msg: `  ──────────────────────────────────────────`, rust: true },
                      { time: t, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
                    ].slice(-2000));
                    applyEcoCost(ecoAlias);
                  }
                }, i * 22);
```

Change the `applyEcoCost(ecoAlias);` line to:

```js
                    applyEcoCost(ecoAlias);
                    kernelRunHistoryRef?.current?.push({ id: wasmEntry.id, alias: ecoAlias, t: Date.now() });
```

The surrounding code at line 333 looks like:

```js
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
              ].slice(-2000));
              applyEcoCost(ecoAlias);
            }
```

Change the `applyEcoCost(ecoAlias);` line to:

```js
              applyEcoCost(ecoAlias);
              kernelRunHistoryRef?.current?.push({ id: wasmEntry.id, alias: ecoAlias, t: Date.now() });
```

The optional-chain on `kernelRunHistoryRef?.current?.push(...)` is defensive — if the ref isn't passed for any reason (older test harness, unit-test mock), the line silently no-ops instead of throwing.

- [ ] **Step 5: Verify the changed files parse and lint clean**

```bash
cd F:/scale_9.4 && node --check src/terminal/App.jsx 2>&1 ; npx eslint src/terminal/App.jsx src/terminal/views/ScalingTab.jsx src/terminal/hooks/useCommandDispatch.js
```

Expected: `node --check` will likely fail on JSX (Node can't parse JSX natively) — that's fine, ignore it for `.jsx` files. The eslint run is the real check: zero new errors in any of the three files. Pre-existing warnings (unused vars in unrelated files) are unchanged.

- [ ] **Step 6: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/App.jsx src/terminal/views/ScalingTab.jsx src/terminal/hooks/useCommandDispatch.js && git commit -m "$(cat <<'EOF'
feat(terminal): capture kernel run history per page load

- App.jsx: new kernelRunHistoryRef = useRef([]) alongside the
  existing refs, threaded into the dispatch context and through
  ScalingTab → LatentCollider as a prop
- useCommandDispatch.js: destructure kernelRunHistoryRef from ctx,
  append { id, alias, t } after both successful-run code paths
  (timed and immediate branches)
- per-page-load scope: the ref resets on browser refresh, so the
  alien verdict reads the user's current session, not their
  lifetime journey
- defensive optional-chain: kernelRunHistoryRef?.current?.push
  silently no-ops if the ref is absent (test mocks, older harness)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Attach kernel history to the order POST body

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Accept the new prop**

Read `F:/scale_9.4/src/terminal/views/LatentCollider.jsx`. Find the component signature (line 1124):

```js
export default function LatentCollider() {
```

Change to:

```js
export default function LatentCollider({ kernelRunHistoryRef } = {}) {
```

The `= {}` default ensures the destructure doesn't throw if the component is ever rendered without props (defensive — same posture as the optional-chain in Task 3).

- [ ] **Step 2: Attach `kernelHistory` to the order POST body**

In the same file, find the `orderBody = JSON.stringify({ ... })` block (line 1248, inside `handleAcquire`). The current shape:

```js
    const orderBody = JSON.stringify({
      formulaId:        card.id,
      formulaHash:      tHash,
      encryptedPayload: encTrunc,
      sovereignRatio,
      g2tAmount:        g2tAllocation,
      tierSize:         tier.size,
      tierLabel:        tier.label,
      cardName:         card.name,
      domainPair:       card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × '),
      noteBlock,
      physBlock,
      vaultBlock,
      contact:          { signal: contact.signal || '', email: contact.email || '' },
    });
```

Add `kernelHistory` as the last field before the closing `});`:

```js
    const orderBody = JSON.stringify({
      formulaId:        card.id,
      formulaHash:      tHash,
      encryptedPayload: encTrunc,
      sovereignRatio,
      g2tAmount:        g2tAllocation,
      tierSize:         tier.size,
      tierLabel:        tier.label,
      cardName:         card.name,
      domainPair:       card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × '),
      noteBlock,
      physBlock,
      vaultBlock,
      contact:          { signal: contact.signal || '', email: contact.email || '' },
      kernelHistory:    (kernelRunHistoryRef?.current ?? []).slice(-30),
    });
```

The slice caps the payload at 30 most-recent entries. 30 × ~50 bytes = ~1.5KB added to a ~5KB order body — negligible. If the user has run fewer than 30 kernels, the full history goes through; if more, only the most recent 30.

- [ ] **Step 3: Verify the file lints clean**

```bash
cd F:/scale_9.4 && npx eslint src/terminal/views/LatentCollider.jsx
```

Expected: exit 0, no new errors. Pre-existing warnings (long file, unused imports) are unchanged.

- [ ] **Step 4: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/views/LatentCollider.jsx && git commit -m "$(cat <<'EOF'
feat(latent-collider): attach kernel history to order POST body

- LatentCollider now accepts an optional kernelRunHistoryRef prop
  (default {}) and reads kernelRunHistoryRef?.current to populate
  the order request body
- new field kernelHistory: capped at 30 most-recent entries via
  .slice(-30) so a long session does not bloat the payload
- the server's composeAlienVerdict reads this array, buckets the
  kernel IDs into thematic categories, and renders the § ALIEN
  READING field in the Discord embed

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verification & sanity sweep

This task is mostly mechanical — lint, test, build, then a focused composer smoke test to confirm the new field renders for several realistic histories. The end-to-end Crystallize flow requires placing a real order against a live Discord channel, so it is deferred to post-push manual verification by the user.

- [ ] **Step 1: Re-run the composer smoke test with realistic histories**

```bash
cd F:/scale_9.4 && node -e "import('./api/_alien/composeVerdict.js').then(m => { const h1 = [{id:'FISH-SCALE-KERNEL11.1.1'},{id:'BIODIVERSITY-PROMPT-1.0.1'},{id:'FISH-SCALE-KERNEL11.1.1'},{id:'GAIA-SCALE-KERNEL-5.5.5'},{id:'KURAMOTO-SYNCHRONY'}]; const h2 = [{id:'TESSERACT-VAULT-1.0'},{id:'DH-EC-KERNEL-1.0'},{id:'ML-KEM-CLASSIFIED'}]; const h3 = [{id:'BIODIVERSITY-PROMPT-1.0.1'}]; console.log('--- 5-kernel mixed (cascade-leaning) ---'); console.log(m.composeAlienVerdict(h1)); console.log('--- 3-kernel crypto session ---'); console.log(m.composeAlienVerdict(h2)); console.log('--- single ecology kernel ---'); console.log(m.composeAlienVerdict(h3)); console.log('--- determinism: re-run mixed ---'); console.log(m.composeAlienVerdict(h1)); });"
```

Expected: four blocks of verdict text. The first and the last (re-run of the same history) must be byte-identical (determinism check). The 3-kernel crypto session produces 4 lines. The single-ecology session produces 3 lines (skips dominance). All text reads in the alien voice register — lower-case, dot-separators, second-person observed.

If any verdict reads off-tone or any expected behavior is missing, flag it now before pushing. The user has the final authorial pass on the phrase pool.

- [ ] **Step 2: Targeted lint on all changed files**

```bash
cd F:/scale_9.4 && npx eslint api/_alien/composeVerdict.js api/transmute/order.js src/terminal/App.jsx src/terminal/views/ScalingTab.jsx src/terminal/hooks/useCommandDispatch.js src/terminal/views/LatentCollider.jsx
```

Expected: exit 0, no output. Any error here blocks completion.

- [ ] **Step 3: Run the full test suite**

```bash
cd F:/scale_9.4 && npm test
```

Expected: 230+ tests pass, 3 pre-existing mercury-determinism failures (unrelated to this work). No new failures.

- [ ] **Step 4: Production build**

```bash
cd F:/scale_9.4 && npm run build
```

Expected: build completes successfully (Vite-only — `api/*` is not bundled). Confirms the React client still compiles.

- [ ] **Step 5: Verify clean git state**

```bash
cd F:/scale_9.4 && git status --short && git log --oneline -8
```

Expected: working tree shows only the always-dirty `content/soma_kernel/.obsidian/workspace.json` (editor state). The last four commits are the Task 1-4 implementations:

```
<hash> feat(latent-collider): attach kernel history to order POST body
<hash> feat(terminal): capture kernel run history per page load
<hash> feat(transmute/order): render alien verdict in embed
<hash> feat(alien): phrase-pool composer for order-embed verdict
```

- [ ] **Step 6: Report back**

Status: **DONE**

Files changed:
- Created: `api/_alien/composeVerdict.js`
- Modified: `api/transmute/order.js`, `src/terminal/App.jsx`, `src/terminal/views/ScalingTab.jsx`, `src/terminal/hooks/useCommandDispatch.js`, `src/terminal/views/LatentCollider.jsx`

Verification: composer smoke test passes (4 verdicts produced, determinism confirmed); targeted lint passes; test suite passes; production build succeeds.

**To deploy:** the user must explicitly request `git push`. After deploy, place a test Register Interest order on the live site — the new `§ ALIEN READING` field should render in the Discord embed with a 3-4 line verdict. If the verdict's voice needs adjustment, edit `api/_alien/composeVerdict.js` directly (the fragment pools are the only thing that needs to change for tone refinement) and ship a follow-up.
