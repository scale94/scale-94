# TRANSMISSION Inverse Extinction Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the TRANSMISSION tab with a client-side engine that harvests low-engagement ecological/mutual-aid posts from the free public Bluesky AppView, scores them with inverse-virality math into a Healing Index, and feeds that index into the Ecocide tab (GROWTH_MANDATE offset + SARG lift).

**Architecture:** Pure inversion pipeline + fetch/cache orchestration in `src/terminal/lib/inverseEngine.js`; a councilBus-style pub/sub with localStorage persistence in `src/terminal/lib/healingSignal.js`; a thin React hook; a UI section mounted inside TransmissionTab; two small injections into EcocideTab's 10 Hz tick. Zero GraphTracks calls — only `public.api.bsky.app` (unauthenticated), max 3 calls per 8-hour window per client, cache-first.

**Tech Stack:** React 19 + Vite (existing), vitest + jsdom (existing config picks up `src/**/__tests__/**/*.test.js`), localStorage, public Bluesky AppView `app.bsky.feed.searchPosts`.

**Spec:** `docs/superpowers/specs/2026-07-07-transmission-inverse-extinction-engine-design.md`

**Codebase context for the engineer:**
- This is an art-project terminal site. Tabs live in `src/terminal/views/`. Idioms: dense inline styles, tiny uppercase tracking-widest labels, per-tab accent color (TRANSMISSION = fuchsia `#d946ef`).
- Pub/sub pattern to follow: `src/terminal/views/manifesto/councilBus.js`.
- localStorage safety pattern to follow: `writeLatticeState` in `src/terminal/hooks/useEcologicalRam.js` (try/catch, silent no-op).
- Run tests: `npm test` (vitest run). Run a single file: `npx vitest run src/terminal/lib/__tests__/inverseEngine.test.js`. Lint: `npm run lint`.
- Windows machine, PowerShell. All paths below are relative to repo root `F:\scale_9.4`.

---

### Task 1: Inversion pipeline — pure functions

**Files:**
- Create: `src/terminal/lib/inverseEngine.js`
- Test: `src/terminal/lib/__tests__/inverseEngine.test.js`

- [ ] **Step 1: Write the failing tests for the pure pipeline**

Create `src/terminal/lib/__tests__/inverseEngine.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ENGINE_TUNING, PROBE_GROUPS, HEALING_LEXICON,
  lexiconScore, sicknessScore, inverseViralityWeight, scorePost,
  subthresholdFilter, healingIndex, sicknessCap, bandwidth,
  activeProbeGroup, healingGrowthOffset, healingSargLift, postUrl,
} from '../inverseEngine';

const NOW = Date.parse('2026-07-07T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 24 * 3600 * 1000).toISOString();

const post = (over = {}) => ({
  uri: 'at://did:plc:abc/app.bsky.feed.post/3k1',
  handle: 'gardener.bsky.social',
  displayName: 'Gardener',
  text: 'Our seed library is open — free seeds and mutual aid for neighbors',
  createdAt: daysAgo(2),
  likes: 2, reposts: 0, replies: 1,
  ...over,
});

describe('lexicon matcher', () => {
  it('sums weights of matched terms, once per term, case-insensitive', () => {
    expect(lexiconScore('MUTUAL AID and more mutual aid', { 'mutual aid': 3 })).toBe(3);
    expect(lexiconScore('repair and rewild', { repair: 2, rewild: 3 })).toBe(5);
  });
  it('requires word boundaries — no substring matches', () => {
    expect(lexiconScore('freedom', { free: 1 })).toBe(0);
    expect(lexiconScore('shared repairing', { share: 1, repair: 2 })).toBe(0);
  });
  it('returns 0 for empty/missing text', () => {
    expect(lexiconScore('', { free: 1 })).toBe(0);
    expect(lexiconScore(null, { free: 1 })).toBe(0);
  });
});

describe('sickness scoring', () => {
  it('adds ALL-CAPS ratio penalty on shouty posts', () => {
    const shouty = 'EVERYTHING IS FALLING APART AND NOBODY CARES AT ALL';
    expect(sicknessScore(shouty)).toBeGreaterThanOrEqual(2);
  });
  it('adds exclamation penalty at 3+ marks', () => {
    const calm = sicknessScore('a quiet note about tea');
    const excl = sicknessScore('a quiet note about tea!!!');
    expect(excl).toBe(calm + 1);
  });
  it('scores panic lexicon terms', () => {
    expect(sicknessScore('total outrage, we are doomed')).toBeGreaterThan(0);
  });
});

describe('inverse-virality weight', () => {
  it('weights zero-engagement posts highest', () => {
    expect(inverseViralityWeight(0, 0)).toBeCloseTo(1 / Math.log(2), 4);
  });
  it('decreases monotonically with engagement', () => {
    expect(inverseViralityWeight(0, 0)).toBeGreaterThan(inverseViralityWeight(10, 14));
  });
});

describe('scorePost', () => {
  it('contribution = max(0, healing − sickness) × weight', () => {
    const s = scorePost(post());
    expect(s.contribution).toBeCloseTo(
      Math.max(0, s.healingScore - s.sicknessScore) * s.weight, 6);
    expect(s.healingScore).toBeGreaterThan(0);
  });
  it('never yields negative contribution', () => {
    const s = scorePost(post({ text: 'OUTRAGE!!! PANIC!!! DOOMED!!!' }));
    expect(s.contribution).toBe(0);
  });
});

describe('subthresholdFilter', () => {
  it('drops posts above the engagement cap — the inversion', () => {
    const loud = post({ uri: 'at://x/app.bsky.feed.post/loud', likes: 500, reposts: 40 });
    expect(subthresholdFilter([post(), loud], NOW)).toHaveLength(1);
  });
  it('keeps posts exactly at the cap', () => {
    const atCap = post({ likes: ENGINE_TUNING.SUBTHRESHOLD_MAX, reposts: 0 });
    expect(subthresholdFilter([atCap], NOW)).toHaveLength(1);
  });
  it('drops posts older than 14 days or with no createdAt', () => {
    expect(subthresholdFilter([post({ createdAt: daysAgo(20) })], NOW)).toHaveLength(0);
    expect(subthresholdFilter([post({ createdAt: null })], NOW)).toHaveLength(0);
  });
  it('keeps at most 2 posts per author', () => {
    const posts = [1, 2, 3].map(i => post({ uri: `at://x/app.bsky.feed.post/${i}` }));
    expect(subthresholdFilter(posts, NOW)).toHaveLength(2);
  });
});

describe('healing index + sickness cap + bandwidth', () => {
  it('is 0 for an empty corpus and saturates below 100', () => {
    expect(healingIndex([])).toBe(0);
    const many = Array.from({ length: 200 }, () => ({ contribution: 5 }));
    const H = healingIndex(many);
    expect(H).toBeGreaterThan(99);
    expect(H).toBeLessThanOrEqual(100);
  });
  it('grows monotonically with contributions', () => {
    const a = healingIndex([{ contribution: 3 }]);
    const b = healingIndex([{ contribution: 3 }, { contribution: 3 }]);
    expect(b).toBeGreaterThan(a);
  });
  it('sicknessCap = fraction of posts where sickness beats healing', () => {
    const corpus = [
      { sicknessScore: 5, healingScore: 1 },
      { sicknessScore: 0, healingScore: 3 },
      { sicknessScore: 0, healingScore: 2 },
      { sicknessScore: 4, healingScore: 0 },
    ];
    expect(sicknessCap(corpus)).toBeCloseTo(0.5, 6);
    expect(sicknessCap([])).toBe(0);
  });
  it('bandwidth throttles H by the sickness cap', () => {
    expect(bandwidth(80, 0)).toBe(80);
    expect(bandwidth(80, 1)).toBeCloseTo(40, 6);
  });
});

describe('probe rotation', () => {
  it('is deterministic per 8h window and cycles all 4 groups', () => {
    expect(activeProbeGroup(0)).toEqual(PROBE_GROUPS[0]);
    expect(activeProbeGroup(ENGINE_TUNING.TTL_MS)).toEqual(PROBE_GROUPS[1]);
    expect(activeProbeGroup(4 * ENGINE_TUNING.TTL_MS)).toEqual(PROBE_GROUPS[0]);
  });
  it('fires exactly 3 probes per group', () => {
    for (const g of PROBE_GROUPS) expect(g).toHaveLength(3);
  });
});

describe('ecocide injection math', () => {
  it('growth offset: 0 at H=0, 0.5pp at H=100, clamped outside range', () => {
    expect(healingGrowthOffset(0)).toBe(0);
    expect(healingGrowthOffset(100)).toBeCloseTo(0.5, 6);
    expect(healingGrowthOffset(50)).toBeCloseTo(0.25, 6);
    expect(healingGrowthOffset(150)).toBeCloseTo(0.5, 6);
    expect(healingGrowthOffset(-10)).toBe(0);
  });
  it('SARG lift: +15% max, ceiling 10, identity at H=0', () => {
    expect(healingSargLift(5, 0)).toBe(5);
    expect(healingSargLift(5, 100)).toBeCloseTo(5.75, 6);
    expect(healingSargLift(10, 100)).toBe(10);
  });
});

describe('postUrl', () => {
  it('builds the bsky.app profile/post URL from the at:// uri rkey', () => {
    expect(postUrl(post())).toBe('https://bsky.app/profile/gardener.bsky.social/post/3k1');
  });
});

describe('lexicon sanity', () => {
  it('healing lexicon recognises the probe themes', () => {
    for (const term of ['mutual aid', 'rewild', 'permaculture', 'seed library']) {
      expect(lexiconScore(`we love ${term} here`, HEALING_LEXICON)).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/lib/__tests__/inverseEngine.test.js`
Expected: FAIL — `Cannot find module '../inverseEngine'` (or equivalent resolve error).

- [ ] **Step 3: Implement the pure pipeline**

Create `src/terminal/lib/inverseEngine.js`:

```js
// ── Inverse Extinction Engine ─────────────────────────────────────────────────
// TRANSMISSION tab · subthreshold harvest + inversion pipeline.
//
// Harvests low-visibility, high-signal posts (ecology, mutual aid, local tech)
// from the FREE public Bluesky AppView and inverts the attention economy's
// math: each post is weighted by 1/log(2 + engagement) — the quieter the
// signal, the louder it counts. GraphTracks is never called; that key stays
// reserved for the BSKY tab's top-posts panel.

export const ENGINE_TUNING = {
  TTL_MS: 8 * 60 * 60 * 1000,        // one harvest per client per 8 h window
  SUBTHRESHOLD_MAX: 24,               // likes+reposts above this → attention economy already has it
  MAX_POST_AGE_MS: 14 * 24 * 60 * 60 * 1000,
  MAX_PER_AUTHOR: 2,
  SATURATION_K: 12,                   // healing index saturation constant
  SICKNESS_THROTTLE: 0.5,             // bandwidth = H · (1 − 0.5·S)
  PROBE_LIMIT: 25,                    // posts per searchPosts call
  SIGNAL_DISPLAY_COUNT: 8,
  GROWTH_OFFSET_MAX: 0.5,             // GROWTH_MANDATE pp reduction at H=100
  SARG_LIFT_MAX: 0.15,                // SARG coherence lift fraction at H=100
};

// 4 rotation groups × 3 probes. groupIndex = floor(now / TTL) % 4, so every
// visitor in the same 8 h window fires the same queries (cache-friendly load).
export const PROBE_GROUPS = [
  ['mutual aid', 'community garden', 'repair cafe'],
  ['watershed restoration', 'rewilding', 'seed library'],
  ['community solar', 'library of things', 'open source ecology'],
  ['permaculture', 'community land trust', 'tool library'],
];

export const HEALING_LEXICON = {
  'mutual aid': 3, 'seed library': 3, 'community garden': 3, 'food forest': 3,
  'tool library': 3, 'repair cafe': 3, 'land back': 3,
  rewild: 3, rewilding: 3,
  restore: 2, restoration: 2, commons: 2, cooperative: 2, solidarity: 2,
  permaculture: 2, watershed: 2, repair: 2, regenerative: 2, compost: 2,
  pollinator: 2, 'land trust': 2, 'community solar': 2, 'native plants': 2,
  mycelium: 2, agroforestry: 2,
  share: 1, free: 1, 'open source': 1, volunteer: 1, neighbors: 1,
  neighbours: 1, garden: 1, coop: 1, local: 1, library: 1,
};

export const SICKNESS_LEXICON = {
  'everyone needs to see this': 3, "you won't believe": 3,
  outrage: 2, terrifying: 2, horrifying: 2, panic: 2, doomed: 2,
  apocalypse: 2, catastrophe: 2, rage: 2, fury: 2, collapse: 2,
  'wake up': 2, disgusting: 2, unhinged: 2,
  viral: 1, destroy: 1, war: 1, slams: 1, destroys: 1,
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRegex = (term) => new RegExp(`\\b${escapeRe(term)}\\b`, 'i');

export function lexiconScore(text, lexicon) {
  if (!text) return 0;
  let score = 0;
  for (const [term, weight] of Object.entries(lexicon)) {
    if (termRegex(term).test(text)) score += weight;
  }
  return score;
}

export function sicknessScore(text) {
  if (!text) return 0;
  let score = lexiconScore(text, SICKNESS_LEXICON);
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  const caps = (text.match(/[A-Z]/g) || []).length;
  if (letters > 20 && caps / letters > 0.3) score += 2; // shouting
  if ((text.match(/!/g) || []).length >= 3) score += 1; // engagement-bait punctuation
  return score;
}

// The inversion made literal: engagement 0 → ≈1.44, engagement 24 → ≈0.31.
export const inverseViralityWeight = (likes, reposts) =>
  1 / Math.log(2 + (likes || 0) + (reposts || 0));

export function scorePost(post) {
  const healingScore = lexiconScore(post.text, HEALING_LEXICON);
  const sScore = sicknessScore(post.text);
  const weight = inverseViralityWeight(post.likes, post.reposts);
  const contribution = Math.max(0, healingScore - sScore) * weight;
  return { ...post, healingScore, sicknessScore: sScore, weight, contribution };
}

// Keep only what the attention economy discards: engagement ≤ cap, recent,
// max 2 signals per author.
export function subthresholdFilter(posts, now = Date.now()) {
  const kept = [];
  const perAuthor = {};
  for (const p of posts) {
    if (((p.likes || 0) + (p.reposts || 0)) > ENGINE_TUNING.SUBTHRESHOLD_MAX) continue;
    const ts = p.createdAt ? Date.parse(p.createdAt) : NaN;
    if (Number.isNaN(ts) || now - ts > ENGINE_TUNING.MAX_POST_AGE_MS) continue;
    perAuthor[p.handle] = (perAuthor[p.handle] || 0) + 1;
    if (perAuthor[p.handle] > ENGINE_TUNING.MAX_PER_AUTHOR) continue;
    kept.push(p);
  }
  return kept;
}

// H = 100·(1 − e^(−Σc/K)) — smooth 0→100 saturation, no cliffs.
export function healingIndex(scored) {
  const total = scored.reduce((s, p) => s + (p.contribution || 0), 0);
  return 100 * (1 - Math.exp(-total / ENGINE_TUNING.SATURATION_K));
}

// Fraction of the kept corpus where sickness beats healing.
export function sicknessCap(scored) {
  if (!scored.length) return 0;
  return scored.filter(p => p.sicknessScore > p.healingScore).length / scored.length;
}

export const bandwidth = (H, S) => H * (1 - ENGINE_TUNING.SICKNESS_THROTTLE * S);

export const activeProbeGroup = (now = Date.now()) =>
  PROBE_GROUPS[Math.floor(now / ENGINE_TUNING.TTL_MS) % PROBE_GROUPS.length];

// ── Ecocide injection math ────────────────────────────────────────────────────
const clampH = (H) => Math.max(0, Math.min(100, H || 0));

// Healing Index → GROWTH_MANDATE reduction in percentage points (max 0.5pp).
export const healingGrowthOffset = (H) =>
  ENGINE_TUNING.GROWTH_OFFSET_MAX * (clampH(H) / 100);

// Healing Index → SARG coherence lift (max +15%, hard ceiling 10). Enough to
// pull a borderline score out of the red, never enough to mask violated paradoxes.
export const healingSargLift = (sarg, H) =>
  Math.min(10, sarg * (1 + ENGINE_TUNING.SARG_LIFT_MAX * (clampH(H) / 100)));

// at://did:plc:xxx/app.bsky.feed.post/rkey → bsky.app permalink
export const postUrl = (signal) =>
  `https://bsky.app/profile/${signal.handle}/post/${signal.uri.split('/').pop()}`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/lib/__tests__/inverseEngine.test.js`
Expected: PASS, all tests green.

Note: if a lexicon-dependent assertion fails (e.g. the shouty-post test), fix the *implementation constant or test fixture*, not the formula — the formulas are spec.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/inverseEngine.js src/terminal/lib/__tests__/inverseEngine.test.js
git commit -m "feat(transmission): inverse extinction engine — pure inversion pipeline"
```

---

### Task 2: Harvest orchestration — parse, cache, fetch

**Files:**
- Modify: `src/terminal/lib/inverseEngine.js` (append)
- Test: `src/terminal/lib/__tests__/inverseEngine.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/lib/__tests__/inverseEngine.test.js` (add `beforeEach` to the existing vitest import, and add `parseSearchResponse, readEngineCache, writeEngineCache, ENGINE_STORAGE_KEY, harvest` to the existing `../inverseEngine` import):

```js
describe('parseSearchResponse', () => {
  const appViewJson = {
    posts: [{
      uri: 'at://did:plc:abc/app.bsky.feed.post/3k1',
      author: { handle: 'gardener.bsky.social', displayName: 'Gardener' },
      record: { text: 'seed library open', createdAt: '2026-07-05T10:00:00Z' },
      likeCount: 2, repostCount: 1, replyCount: 0,
      indexedAt: '2026-07-05T10:00:01Z',
    }, {
      uri: null, // malformed — must be skipped
      record: { text: 'ghost' },
    }],
  };
  it('maps AppView posts to signal shape, skipping malformed entries', () => {
    const parsed = parseSearchResponse(appViewJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      uri: 'at://did:plc:abc/app.bsky.feed.post/3k1',
      handle: 'gardener.bsky.social', displayName: 'Gardener',
      text: 'seed library open', createdAt: '2026-07-05T10:00:00Z',
      likes: 2, reposts: 1, replies: 0,
    });
  });
  it('returns [] for junk payloads', () => {
    expect(parseSearchResponse(null)).toEqual([]);
    expect(parseSearchResponse({})).toEqual([]);
  });
});

describe('engine cache', () => {
  beforeEach(() => localStorage.removeItem(ENGINE_STORAGE_KEY));
  it('round-trips and flags staleness by TTL', () => {
    writeEngineCache({ harvestedAt: NOW, signals: [], healingIndex: 40, sicknessCap: 0, bandwidth: 40, probesUsed: [] });
    expect(readEngineCache(NOW + 1000).stale).toBe(false);
    expect(readEngineCache(NOW + ENGINE_TUNING.TTL_MS + 1).stale).toBe(true);
  });
  it('returns null for absent, garbage, or wrong-version cache', () => {
    expect(readEngineCache(NOW)).toBeNull();
    localStorage.setItem(ENGINE_STORAGE_KEY, 'not json');
    expect(readEngineCache(NOW)).toBeNull();
    localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify({ version: 99, harvestedAt: NOW }));
    expect(readEngineCache(NOW)).toBeNull();
  });
});

describe('harvest', () => {
  const okResponse = (posts) => Promise.resolve({ ok: true, json: () => Promise.resolve({ posts }) });
  const appViewPost = (i, over = {}) => ({
    uri: `at://did:plc:abc/app.bsky.feed.post/${i}`,
    author: { handle: `author${i}.bsky.social`, displayName: `A${i}` },
    record: { text: 'community garden mutual aid day', createdAt: daysAgo(1) },
    likeCount: 1, repostCount: 0, replyCount: 0,
    ...over,
  });

  it('fires exactly 3 probe calls and aggregates a scored, sorted result', async () => {
    const calls = [];
    const fetchFn = (url) => { calls.push(url); return okResponse([appViewPost(calls.length)]); };
    const result = await harvest(fetchFn, NOW);
    expect(calls).toHaveLength(3);
    for (const url of calls) {
      expect(url).toContain('public.api.bsky.app/xrpc/app.bsky.feed.searchPosts');
      expect(url).toContain('sort=latest');
    }
    expect(result.signals.length).toBe(3);
    expect(result.healingIndex).toBeGreaterThan(0);
    expect(result.harvestedAt).toBe(NOW);
    expect(result.probesUsed).toEqual(activeProbeGroup(NOW));
    // sorted by contribution, descending
    const c = result.signals.map(s => s.contribution);
    expect([...c].sort((a, b) => b - a)).toEqual(c);
  });

  it('tolerates partial probe failure', async () => {
    let n = 0;
    const fetchFn = () => (++n === 2)
      ? Promise.reject(new Error('net down'))
      : okResponse([appViewPost(n)]);
    const result = await harvest(fetchFn, NOW);
    expect(result.signals.length).toBe(2);
  });

  it('throws when all probes fail (caller keeps stale cache)', async () => {
    const fetchFn = () => Promise.reject(new Error('offline'));
    await expect(harvest(fetchFn, NOW)).rejects.toThrow();
  });

  it('dedupes identical uris returned by overlapping probes', async () => {
    const fetchFn = () => okResponse([appViewPost(1)]);
    const result = await harvest(fetchFn, NOW);
    expect(result.signals.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/terminal/lib/__tests__/inverseEngine.test.js`
Expected: FAIL — `parseSearchResponse` etc. not exported. Task 1 tests still pass.

- [ ] **Step 3: Implement parse, cache, and harvest**

Append to `src/terminal/lib/inverseEngine.js`:

```js
// ── AppView response parsing ──────────────────────────────────────────────────
export function parseSearchResponse(json) {
  const posts = Array.isArray(json?.posts) ? json.posts : [];
  return posts
    .map(p => ({
      uri: p?.uri ?? null,
      handle: p?.author?.handle ?? '',
      displayName: p?.author?.displayName ?? '',
      text: p?.record?.text ?? '',
      createdAt: p?.record?.createdAt ?? p?.indexedAt ?? null,
      likes: p?.likeCount ?? 0,
      reposts: p?.repostCount ?? 0,
      replies: p?.replyCount ?? 0,
    }))
    .filter(p => p.uri && p.text);
}

// ── localStorage cache ────────────────────────────────────────────────────────
export const ENGINE_STORAGE_KEY = 'scale94_inverse_engine';

export function readEngineCache(now = Date.now()) {
  try {
    const raw = localStorage.getItem(ENGINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed.harvestedAt !== 'number') return null;
    return { ...parsed, stale: now - parsed.harvestedAt > ENGINE_TUNING.TTL_MS };
  } catch { return null; }
}

export function writeEngineCache(data) {
  try {
    localStorage.setItem(ENGINE_STORAGE_KEY, JSON.stringify({ version: 1, ...data }));
  } catch { /* quota or private mode — silently no-op */ }
}

// ── Harvest orchestration ─────────────────────────────────────────────────────
// The ONLY network surface of the engine: 3 unauthenticated searchPosts calls
// against the free public AppView. fetchFn is injectable for tests.
const SEARCH_BASE = 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts';

export async function harvest(fetchFn = fetch, now = Date.now()) {
  const probes = activeProbeGroup(now);
  const results = await Promise.allSettled(probes.map(q =>
    fetchFn(`${SEARCH_BASE}?q=${encodeURIComponent(q)}&sort=latest&limit=${ENGINE_TUNING.PROBE_LIMIT}&lang=en`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  ));
  if (results.every(r => r.status === 'rejected')) {
    throw new Error('all probes failed');
  }
  const rawPosts = results.flatMap(r => r.status === 'fulfilled' ? parseSearchResponse(r.value) : []);
  const seen = new Set();
  const unique = rawPosts.filter(p => !seen.has(p.uri) && seen.add(p.uri));
  const scored = subthresholdFilter(unique, now)
    .map(scorePost)
    .sort((a, b) => b.contribution - a.contribution);
  const H = healingIndex(scored);
  const S = sicknessCap(scored);
  return {
    harvestedAt: now,
    probesUsed: probes,
    signals: scored,
    healingIndex: H,
    sicknessCap: S,
    bandwidth: bandwidth(H, S),
  };
}
```

- [ ] **Step 4: Run the full engine test file**

Run: `npx vitest run src/terminal/lib/__tests__/inverseEngine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/inverseEngine.js src/terminal/lib/__tests__/inverseEngine.test.js
git commit -m "feat(transmission): harvest orchestration — parse, cache, 3-probe fetch"
```

---

### Task 3: Healing signal bus

**Files:**
- Create: `src/terminal/lib/healingSignal.js`
- Test: `src/terminal/lib/__tests__/healingSignal.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/lib/__tests__/healingSignal.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishHealing, readHealing, subscribeHealing,
  HEALING_STORAGE_KEY, HEALING_EXPIRY_MS, _resetHealingForTests,
} from '../healingSignal';

const NOW = Date.parse('2026-07-07T12:00:00Z');

describe('healingSignal', () => {
  beforeEach(() => _resetHealingForTests());

  it('publish → read round-trip keeps only the healing payload fields', () => {
    publishHealing({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW, signals: [{ big: 'blob' }] });
    const sig = readHealing(NOW + 1000);
    expect(sig).toEqual({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW });
  });

  it('expires after 24h — a dead harvest cannot prop up the biosphere', () => {
    publishHealing({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW });
    expect(readHealing(NOW + HEALING_EXPIRY_MS + 1)).toBeNull();
  });

  it('returns null for absent or garbage storage', () => {
    expect(readHealing(NOW)).toBeNull();
    localStorage.setItem(HEALING_STORAGE_KEY, '{broken');
    expect(readHealing(NOW)).toBeNull();
  });

  it('notifies live subscribers and honors unsubscribe', () => {
    const seen = [];
    const off = subscribeHealing(s => seen.push(s));
    publishHealing({ healingIndex: 10, bandwidth: 10, harvestedAt: NOW });
    off();
    publishHealing({ healingIndex: 20, bandwidth: 20, harvestedAt: NOW });
    expect(seen).toHaveLength(1);
    expect(seen[0].healingIndex).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/lib/__tests__/healingSignal.test.js`
Expected: FAIL — cannot resolve `../healingSignal`.

- [ ] **Step 3: Implement the bus**

Create `src/terminal/lib/healingSignal.js`:

```js
// Cross-tab healing signal — TRANSMISSION publishes, ECOCIDE subscribes.
// Same pub/sub shape as councilBus, plus localStorage persistence so the
// Ecocide tab can read the last harvest without TRANSMISSION ever mounting.
// No pending buffer needed: the signal is a scalar, latest-wins, and cold
// reads go through localStorage.

export const HEALING_STORAGE_KEY = 'scale94_healing_signal';
export const HEALING_EXPIRY_MS = 24 * 60 * 60 * 1000;

const listeners = [];

export function publishHealing({ healingIndex, bandwidth, harvestedAt }) {
  const payload = { healingIndex, bandwidth, harvestedAt };
  try {
    localStorage.setItem(HEALING_STORAGE_KEY, JSON.stringify(payload));
  } catch { /* quota or private mode — silently no-op */ }
  listeners.forEach(fn => fn(payload));
}

export function readHealing(now = Date.now()) {
  try {
    const raw = localStorage.getItem(HEALING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.healingIndex !== 'number' || typeof parsed?.harvestedAt !== 'number') return null;
    if (now - parsed.harvestedAt > HEALING_EXPIRY_MS) return null;
    return parsed;
  } catch { return null; }
}

export function subscribeHealing(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function _resetHealingForTests() {
  listeners.length = 0;
  try { localStorage.removeItem(HEALING_STORAGE_KEY); } catch { /* no-op */ }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/lib/__tests__/healingSignal.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/healingSignal.js src/terminal/lib/__tests__/healingSignal.test.js
git commit -m "feat(transmission): healing signal bus — persisted pub/sub with 24h expiry"
```

---

### Task 4: useInverseEngine hook

**Files:**
- Create: `src/terminal/hooks/useInverseEngine.js`

Thin glue over the tested lib — cache-first load, background harvest, publish. No unit test; verified via lint now and preview in Task 7.

- [ ] **Step 1: Implement the hook**

Create `src/terminal/hooks/useInverseEngine.js`:

```js
// ── useInverseEngine ──────────────────────────────────────────────────────────
// Cache-first driver for the Inverse Extinction Engine.
//   fresh cache  → render immediately, ZERO network this visit
//   stale cache  → render it (STALE badge) and harvest in the background
//   no cache     → harvest; on failure the UI shows the idle state
// status: 'idle' | 'harvesting' | 'live' | 'stale' | 'error'

import { useState, useEffect, useCallback, useRef } from 'react';
import { readEngineCache, writeEngineCache, harvest } from '../lib/inverseEngine';
import { publishHealing } from '../lib/healingSignal';

export function useInverseEngine() {
  const [state, setState] = useState(() => readEngineCache());
  const [status, setStatus] = useState('idle');
  const inFlightRef = useRef(false);

  const runHarvest = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus('harvesting');
    try {
      const result = await harvest();
      writeEngineCache(result);
      publishHealing(result);
      setState({ ...result, stale: false });
      setStatus('live');
    } catch {
      setStatus(readEngineCache() ? 'stale' : 'error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cached = readEngineCache();
    if (cached && !cached.stale) {
      // re-announce so live subscribers (Ecocide) warm up without a harvest
      publishHealing(cached);
      setStatus('live');
      return;
    }
    if (cached) setStatus('stale');
    runHarvest();
  }, [runHarvest]);

  return { state, status, runHarvest };
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean (zero warnings — the repo runs `--max-warnings 0`).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/hooks/useInverseEngine.js
git commit -m "feat(transmission): useInverseEngine hook — cache-first harvest driver"
```

---

### Task 5: InverseEngine UI section + TransmissionTab mount

**Files:**
- Create: `src/terminal/views/transmission/InverseEngine.jsx`
- Modify: `src/terminal/views/TransmissionTab.jsx` (import + mount after the header block, before the oscilloscope timeline)

- [ ] **Step 1: Create the section component**

Create `src/terminal/views/transmission/InverseEngine.jsx`. Stay in the tab's fuchsia CRT idiom (accent `#d946ef`, tiny tracking-widest labels, `border-fuchsia-900/30 bg-black/40` cards):

```jsx
import React from 'react';
import { useInverseEngine } from '../../hooks/useInverseEngine';
import { ENGINE_TUNING, postUrl } from '../../lib/inverseEngine';

// ── Inverse Extinction Engine — TRANSMISSION live section ────────────────────
// Subthreshold harvest display: bandwidth gauge, signal cards, harvest status.
// The API-restraint policy is part of the display: public AppView only,
// 3 probes per 8 h window, GraphTracks untouched.

const relTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const bandLabel = (b) =>
  b >= 75 ? 'COHERENT' : b >= 45 ? 'STRONG' : b >= 20 ? 'CARRIER' : 'FAINT';

const cacheAge = (harvestedAt) => {
  const h = Math.floor((Date.now() - harvestedAt) / 3600000);
  return h < 1 ? '<1h' : `${h}h`;
};

const InverseEngine = () => {
  const { state, status, runHarvest } = useInverseEngine();

  const H = state?.healingIndex ?? 0;
  const S = state?.sicknessCap ?? 0;
  const B = state?.bandwidth ?? 0;
  const signals = (state?.signals ?? []).slice(0, ENGINE_TUNING.SIGNAL_DISPLAY_COUNT);

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="text-[9px] font-bold tracking-[0.3em] text-fuchsia-400/50 uppercase mb-3 border-b border-fuchsia-900/20 pb-2 flex items-center gap-2">
        <span className="text-fuchsia-500/70" style={{ animation: 'tx-iconPulse 2.5s ease-in-out infinite', display: 'inline-block' }}>◉</span>
        INVERSE_EXTINCTION_ENGINE // SUBTHRESHOLD HARVEST
        <span className="ml-auto flex items-center gap-2 normal-case tracking-normal font-mono text-fuchsia-400/25">
          {status === 'harvesting' && <span className="animate-pulse text-fuchsia-400/60">HARVESTING…</span>}
          {status === 'stale' && <span className="text-amber-500/60">STALE</span>}
          {status === 'live' && <span className="text-fuchsia-400/50">LIVE</span>}
        </span>
      </div>

      {/* Idle / error state — no cache, nothing harvested */}
      {!state && (
        <div className="border border-fuchsia-900/25 bg-black/40 px-4 py-6 text-center">
          <div className="text-[10px] font-bold tracking-widest text-fuchsia-800 uppercase mb-3">
            [ SIGNAL BELOW THRESHOLD — AWAITING HARVEST WINDOW ]
          </div>
          {status === 'error' && (
            <button
              onClick={runHarvest}
              className="text-[9px] font-bold tracking-widest uppercase text-fuchsia-400/60 border border-fuchsia-900/40 px-3 py-1.5 hover:text-fuchsia-300 hover:border-fuchsia-500/40 transition-colors"
            >
              ⌖ RETRY HARVEST
            </button>
          )}
        </div>
      )}

      {state && (
        <>
          {/* Bandwidth gauge */}
          <div className="border border-fuchsia-900/25 bg-black/40 p-4 mb-4">
            <div className="flex items-center justify-between mb-2 text-[9px] font-bold tracking-widest uppercase">
              <span className="text-fuchsia-400/50">TRANSMISSION_BANDWIDTH</span>
              <span className="text-fuchsia-300/80 font-mono">
                {B.toFixed(1)} / 100 — SIGNAL: {bandLabel(B)}
              </span>
            </div>
            <div className="h-2 bg-fuchsia-950/30 relative overflow-hidden">
              {/* Healing index — full potential */}
              <div className="absolute inset-y-0 left-0 bg-fuchsia-900/40 transition-all duration-700"
                style={{ width: `${H}%` }} />
              {/* Throttled bandwidth — what the sickness cap lets through */}
              <div className="absolute inset-y-0 left-0 transition-all duration-700"
                style={{ width: `${B}%`, background: 'linear-gradient(90deg, #a21caf, #d946ef)', boxShadow: '0 0 10px rgba(217,70,239,0.5)' }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[8px] font-mono text-fuchsia-400/30 tracking-wider">
              <span>HEALING_INDEX {H.toFixed(1)}</span>
              <span className={S > 0.4 ? 'text-amber-500/60' : ''}>
                SICKNESS_CAP {(S * 100).toFixed(0)}% {S > 0 ? `· throttling −${(H - B).toFixed(1)}` : '· pipe fully open'}
              </span>
            </div>
          </div>

          {/* Signal cards */}
          {signals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {signals.map((s, i) => (
                <div key={s.uri}
                  className="border border-fuchsia-900/25 bg-black/40 p-4 hover:border-fuchsia-500/40 hover:bg-fuchsia-950/10 transition-all flex flex-col"
                  style={{ animation: `tx-cardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both` }}
                >
                  <div className="flex items-center justify-between mb-2 text-[9px] font-mono tracking-widest uppercase">
                    <span className="text-fuchsia-900">SUBTHRESHOLD_{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-fuchsia-400/25">{s.createdAt ? relTime(s.createdAt) : ''}</span>
                  </div>
                  <p className="text-[11px] text-fuchsia-200/60 leading-relaxed mb-3 flex-1 whitespace-pre-wrap">
                    {s.text}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-fuchsia-900/15 text-[9px] font-mono">
                    <span className="text-fuchsia-400/35 truncate">@{s.handle}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-fuchsia-400/25" title="healing score × inverse-virality weight">
                        ⌁{s.healingScore} ×{s.weight.toFixed(2)}
                      </span>
                      <span className="text-fuchsia-400/20">♡{s.likes} ⟳{s.reposts}</span>
                      <a href={postUrl(s)} target="_blank" rel="noreferrer"
                        className="text-fuchsia-400/40 hover:text-fuchsia-300 border border-fuchsia-900/30 hover:border-fuchsia-500/40 px-1.5 py-0.5 uppercase tracking-widest transition-all">
                        ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Harvest status line — the restraint policy is part of the display */}
          <div className="text-[8px] font-mono text-fuchsia-400/25 tracking-wider flex flex-wrap gap-x-4 gap-y-1">
            <span>HARVESTED {cacheAge(state.harvestedAt)} AGO</span>
            <span>PROBES: {(state.probesUsed ?? []).join(' · ')}</span>
            <span>NEXT WINDOW: {Math.max(0, Math.ceil((state.harvestedAt + ENGINE_TUNING.TTL_MS - Date.now()) / 3600000))}h</span>
            <span className="text-fuchsia-400/35">public AppView only · 3 calls / 8h · GraphTracks untouched</span>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(InverseEngine);
```

- [ ] **Step 2: Mount it in TransmissionTab**

Modify `src/terminal/views/TransmissionTab.jsx`:

Add the import after the existing imports (line 3):

```js
import InverseEngine from './transmission/InverseEngine';
```

Insert the mount directly after the header `</div>` that closes the search-filter block (currently line 182, just before the `{/* ── [2] OSCILLOSCOPE TIMELINE ...` comment):

```jsx
      {/* ── Inverse Extinction Engine — live subthreshold harvest ───────── */}
      <InverseEngine />
```

Note: `tx-iconPulse` and `tx-cardIn` keyframes are defined in TransmissionTab's `<style>` block and are global on this page, so InverseEngine can use them while mounted inside the tab.

- [ ] **Step 3: Lint + full test suite**

Run: `npm run lint && npm test`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/transmission/InverseEngine.jsx src/terminal/views/TransmissionTab.jsx
git commit -m "feat(transmission): inverse extinction engine UI — gauge, signal cards, status"
```

---

### Task 6: Ecocide injection — GROWTH_MANDATE offset + SARG lift

**Files:**
- Modify: `src/terminal/views/EcocideTab.jsx`

Behavior notes for the engineer (intentional, do not "fix"):
- The offset reduces the *effective* growth rate fed to the simulation and the mandate detector — the slider position itself never moves.
- Because the mandate detector reads the effective rate, a strong healing signal can push an engaged mandate below 2.0% and trigger the Double-Bind penalty. That is Layer 3.3.3's whole point: capital punishes degrowth even when healing enables it.
- With no signal (expired/absent), `readHealing()` returns null → healingIdx 0 → both terms are exactly zero → tab behaves precisely as today.

- [ ] **Step 1: Add imports**

In `src/terminal/views/EcocideTab.jsx`, after the existing imports at the top of the file, add:

```js
import { readHealing, subscribeHealing } from '../lib/healingSignal';
import { healingGrowthOffset, healingSargLift } from '../lib/inverseEngine';
```

- [ ] **Step 2: Add healing state + subscription**

Next to the existing `growthRateRef` block (currently lines 319–322: `const growthRateRef = useRef(2.5); ... useEffect(() => { growthRateRef.current = growthRate; }, [growthRate]);`), add:

```js
  // ── TRANSMISSION healing signal — Inverse Extinction Engine coupling ──────
  const [healingIdx, setHealingIdx] = useState(() => readHealing()?.healingIndex ?? 0);
  const healingRef = useRef(healingIdx);
  useEffect(() => { healingRef.current = healingIdx; }, [healingIdx]);
  useEffect(() => subscribeHealing(sig => setHealingIdx(sig?.healingIndex ?? 0)), []);
```

- [ ] **Step 3: Apply the growth offset in the tick**

In the 10 Hz tick (currently line 348), change:

```js
      const gr = growthRateRef.current;
```

to:

```js
      // Effective rate = slider − TRANSMISSION healing offset (slider untouched)
      const gr = Math.max(0, growthRateRef.current - healingGrowthOffset(healingRef.current));
```

- [ ] **Step 4: Apply the SARG lift**

Immediately after the SARG computation (currently line 435: `const sarg = computeSARG(phase, sargState);`), add:

```js
      // TRANSMISSION coupling: healing harvest lifts biosphere coherence (≤ +15%)
      sarg.sarg = healingSargLift(sarg.sarg, healingRef.current);
```

- [ ] **Step 5: Render the offset label beside the slider**

In the GROWTH_MANDATE slider row, after the `%` value `<span>` (currently ends line 999, `{growthRate.toFixed(1)}%` followed by `</span>`), add as the next sibling:

```jsx
          {healingIdx > 0 && (
            <span
              className="shrink-0 hidden sm:inline"
              title="Inverse Extinction Engine — healing harvest reduces the effective mandate"
              style={{ color: '#d946ef', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', opacity: 0.75 }}
            >
              [TRANSMISSION_OFFSET −{healingGrowthOffset(healingIdx).toFixed(2)}%]
            </span>
          )}
```

The fuchsia `#d946ef` is TRANSMISSION's accent — deliberately foreign inside this green tab so the offset's origin is legible.

- [ ] **Step 6: Lint + full test suite**

Run: `npm run lint && npm test`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/EcocideTab.jsx
git commit -m "feat(ecocide): transmission healing coupling — mandate offset + SARG lift"
```

---

### Task 7: End-to-end verification in preview

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open TRANSMISSION**

Use the preview tooling (`preview_start` with the vite dev config; the app serves on the configured port). Navigate to the TRANSMISSION tab.

- [ ] **Step 2: Verify live harvest**

- Console/network: exactly 3 requests to `public.api.bsky.app/xrpc/app.bsky.feed.searchPosts`, none to `api.graphtracks.com`.
- The section renders the bandwidth gauge with a nonzero Healing Index (assuming the live network returns matches) and up to 8 signal cards with working `↗` links to bsky.app.
- localStorage now contains `scale94_inverse_engine` and `scale94_healing_signal`.

- [ ] **Step 3: Verify cache-first behavior**

Reload the page, reopen TRANSMISSION: **zero** `searchPosts` requests (cache fresh), section renders instantly from cache, status shows LIVE.

- [ ] **Step 4: Verify stale + idle states**

- In devtools, set `scale94_inverse_engine.harvestedAt` back by 9 hours (edit the JSON) → reload → section shows cached data with STALE badge and fires one background harvest.
- Delete both localStorage keys and block network (devtools offline) → reload → idle state `[ SIGNAL BELOW THRESHOLD — AWAITING HARVEST WINDOW ]` with RETRY button; fiction archive below is unaffected.

- [ ] **Step 5: Verify the Ecocide coupling**

- With a healing signal present, open the ECOCIDE tab: the slider row shows `[TRANSMISSION_OFFSET −0.xx%]` and the simulation runs on the reduced effective rate.
- In devtools, set `scale94_healing_signal.harvestedAt` back by 25 hours → reload → offset label gone, tab behaves as before the feature.

- [ ] **Step 6: Final full gate**

Run: `npm run lint && npm test && npm run build`
Expected: all clean.

- [ ] **Step 7: Verify with the user before any push**

Per project rule: NO push without an explicit user push command. Present the preview evidence and stop.

---

## Self-review notes

- **Spec coverage:** harvest layer (Tasks 1–2), pipeline math (Task 1), cache (Task 2), bus + 24h expiry (Task 3), hook/cache-first (Task 4), UI incl. idle/stale/error and restraint line (Task 5), Ecocide injection incl. label (Task 6), manual verification incl. GraphTracks-zero check (Task 7). Out-of-scope items from the spec are not implemented anywhere. ✓
- **Types:** signal shape `{ uri, handle, displayName, text, createdAt, likes, reposts, replies, healingScore, sicknessScore, weight, contribution }` consistent across parse → filter → score → cache → UI; healing payload `{ healingIndex, bandwidth, harvestedAt }` consistent bus ↔ Ecocide. ✓
- **Line numbers** in EcocideTab/TransmissionTab references are as of commit `6304ce7`; the engineer should locate by the quoted code, not the number, if drift occurs.
