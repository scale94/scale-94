# Scent as Aether — P0 (Untangle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the perfume card, domain table and manifest out of `LatentCollider.jsx` into pure modules, pinned byte-for-byte to today's output, then retire the perfume shop end to end.

**Architecture:**
- Extraction uses a characterization pin. First temporarily export the functions from the monolith and snapshot their output. Then move them to `src/terminal/collider/` and point the same tests at the new module. The snapshots must pass unchanged, never with `-u`.
- Shop retirement deletes the client order and redeem paths, the four `api/transmute` routes, the Discord interactions route, the redeem bot and their tests.
- The manifest `.md` download stays, as a plain download button.

**Tech Stack:** React 18 + Vite, Vitest (jsdom), ESLint, Vercel serverless (deleted parts only).

**Spec:** `docs/superpowers/specs/2026-11-27-scent-aether-design.md` (P0 = §12 first bullet, §11)

## Global Constraints

- **No visible change except the shop's removal.** Card, chamber, sovereign view and manifest content stay the same. The only snapshot allowed to change is the manifest's LIVING SIGNATURE case, which is deleted in Task 3.
- **Never run `vitest -u`** on the parity snapshots after Task 1 / Task 2 step 2 has created them.
- New modules in `src/terminal/collider/` contain no React, no DOM and no GL (the `colliderPhases.js` discipline).
- `CAS_REGISTRY`, `buildEncryptedFormula` and the M4 labels move **unchanged**. Fixing them belongs to P1. Don't fix them here.
- Lint gate: `npm run lint` (max warnings 143) must still pass. Remove every import that a deletion leaves unused.
- Branch: `feature/scent-aether-p0`, cut from `main` at `1a11a917` or later. Commit per task. **Never push.** The author pushes.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Out of scope for the agent; these are the author's manual steps, listed in Task 4:** Vercel env vars, the KV store, the Discord application, and the running bot process.

## Review Focus

1. **Second collision after a download.** Crystallize, download the manifest, then pick a new pair. The download button must reappear: `manifestState` resets when `card.id` changes. Pinned in Task 3 by the browser check, step 6.
2. **Crystallize when `buildTesseractProfile` throws** (for example no `crypto.subtle`). `CrystallizeCard` must still render, with no register or threshold block left behind. Pinned in Task 3 by the structural test (`CrystallizeCard` has no `onRegister` prop).
3. **Planet / extended domains (id ≥ 32)** through `buildPerfumeCard` and the manifest. Pinned by a planet-domain fixture in Task 1 and Task 2.
4. **Sovereign view after acquire removal.** `redactCard` must still drive the redacted card display. Pinned in Task 3 by the browser check, step 6, toggling sovereign view.
5. **Stale clients after deploy.** The service worker never intercepts `/api/**` (`public/sw.js:69`), so an old cached tab calling a deleted route gets a 404 that its own code already swallows. No new code is needed. Task 4's SW test keeps asserting that `/api/**` is network-only, using the surviving routes.

---

### Task 1: Extract the domain table and the perfume card, with parity pins

**Files:**
- Create: `src/terminal/collider/domains.js`
- Create: `src/terminal/collider/perfumeCard.js`
- Modify: `src/terminal/views/LatentCollider.jsx`
  - lines 310–421: domain arrays, `ALL_DOMAINS`, `domainById`
  - lines 605–872: `PERF_NOTES`, `CAS_REGISTRY`, `_pickNote`, `FAMILY_INTERFERENCE`, `lookupInterference`, `buildPerfumeCard`, `generateAccordHash`, `buildEncryptedFormula`, `buildTesseractProfile`
- Test: `src/terminal/collider/__tests__/perfumeCard.parity.test.js`, plus its `__snapshots__/` file
- Test fixtures: `src/terminal/collider/__tests__/fixtures.js`, which exports `FIXTURES`. Task 2 reuses it.

**Interfaces:**
- Produces, from `collider/domains.js` (moved verbatim):
  - `DOMAINS`, `ELEM_DOMAINS`, `PHIL_MATH_DOMAINS`, `LIFE_HUM_DOMAINS`, `COGN_SYNTH_DOMAINS`, `FSK_DOMAINS`, `PLANET_DOMAINS`, `ALL_DOMAINS`
  - `domainById(id: number) → {id, name, short, hue, …} | undefined`
- Produces, from `collider/perfumeCard.js` (moved verbatim; signatures unchanged):
  - `PERF_NOTES`, `CAS_REGISTRY`, `FAMILY_INTERFERENCE`
  - `lookupInterference(domA: string, domB: string) → object | null`
  - `buildPerfumeCard(domA: number, domB: number, result) → card`
  - `generateAccordHash(card, accord, domA, domB) → Promise<string>` (64 hex characters)
  - `buildEncryptedFormula(card, accord) → {ciphertext, casEntries, specificGravity, flashPoint, macDays, dilutionRatio}`
  - `buildTesseractProfile(card, accord, domA, domB, result) → Promise<{hash, publicProfile, encryptedFormula, dims, viability}>`
- `perfumeCard.js` imports `domainById` from `./domains.js`.
- `LatentCollider.jsx` imports what it still uses from both modules. `DOMAIN_SPHERE_MAP`, `domainRgb` and all UI stay in the view.

- [ ] **Step 1: Temporarily export the originals**

  Append to the end of `LatentCollider.jsx`:

  `export { ALL_DOMAINS, domainById, buildPerfumeCard, generateAccordHash, buildEncryptedFormula, buildTesseractProfile, lookupInterference };`

- [ ] **Step 2: Write the parity test against the original location and record the snapshots**

  ```js
  // src/terminal/collider/__tests__/perfumeCard.parity.test.js
  import { describe, it, expect } from 'vitest';
  import * as M from '../../views/LatentCollider.jsx'; // Step 5 repoints this to ../perfumeCard.js + ../domains.js

  // Fixtures cover: an interference pair, novelty > 0.55 (third heart note),
  // animalic base (animalicIntensity > 0.45), the woody-base branch (polarity > 0.65),
  // each concentration tier (sillage 0.8 / 0.6 / 0.4 / 0.1), a missing accord
  // (defaults path), and a planet domain (id >= 32).
  import { FIXTURES } from './fixtures.js';
  // fixtures.js: export const FIXTURES = [ /* 7 { name, domA, domB, result } literals, built by hand
     from the field list in buildPerfumeCard / buildTesseractProfile:
     result.accord.{dominant:{id}, animalicIntensity, polarity, sillage, fixation,
     persists, nodeClass:{id}, polarityClass:{label}, evapCurve, cleanRoom,
     sovereignty}, result.{novelty, chimeraName, convergence, divergence,
     paradoxes, viability}. Domain ids: pick from ALL_DOMAINS, including one
     PLANET_DOMAINS id. */ ];

  describe('perfume card parity (P0 pin)', () => {
    it.each(FIXTURES)('$name: buildPerfumeCard', ({ domA, domB, result }) => {
      expect(M.buildPerfumeCard(domA, domB, result)).toMatchSnapshot();
    });
    it.each(FIXTURES)('$name: generateAccordHash', async ({ domA, domB, result }) => {
      const card = M.buildPerfumeCard(domA, domB, result);
      const h = await M.generateAccordHash(card, result.accord, domA, domB);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
      expect(h).toMatchSnapshot();
    });
    it.each(FIXTURES)('$name: buildTesseractProfile', async ({ domA, domB, result }) => {
      const card = M.buildPerfumeCard(domA, domB, result);
      expect(await M.buildTesseractProfile(card, result.accord, domA, domB, result)).toMatchSnapshot();
    });
    it('domain table shape', () => {
      expect(M.ALL_DOMAINS.map(d => [d.id, d.short, d.hue])).toMatchSnapshot();
    });
  });
  ```

- [ ] **Step 3: Run the test to create the snapshots from the original code**

  Run: `npx vitest run src/terminal/collider/__tests__/perfumeCard.parity.test.js`

  Expected: PASS, with "N snapshots written". Commit the snapshot file in step 7.

  If importing the `.jsx` view fails under jsdom (for example a GL or WASM import at module scope), stub that module with `vi.mock(...)` in this test file only. Never edit the view to make it importable.

- [ ] **Step 4: Move the code**

  Cut the listed blocks into `domains.js` and `perfumeCard.js` with `export` added. Then delete the temporary export line from step 1, and import from the new modules in `LatentCollider.jsx`.

- [ ] **Step 5: Repoint the test**

  Replace the import with:

  ```js
  import * as D from '../domains.js';
  import * as P from '../perfumeCard.js';
  const M = { ...D, ...P };
  ```

- [ ] **Step 6: Run the parity test, the full suite and lint**

  Run: `npx vitest run src/terminal/collider && npm test && npm run lint`

  Expected: PASS, with **0 snapshots written, 0 updated, 0 obsolete**.

- [ ] **Step 7: Commit**

  `refactor(collider): extract domain table and perfume card into pure modules`

---

### Task 2: Extract the manifest generator, with parity pins

**Files:**
- Create: `src/terminal/collider/manifest.js`
- Modify: `src/terminal/views/LatentCollider.jsx` (`generateManifestMarkdown`, currently about line 897; after Task 1 it is the block beginning `// ── Tesseract Manifest`)
- Test: `src/terminal/collider/__tests__/manifest.parity.test.js`

**Interfaces:**
- Consumes: `buildPerfumeCard`, `buildTesseractProfile` (Task 1).
- Produces: `generateManifestMarkdown(card, tesseract, living = null, result = null, narrative = null) → string`, moved verbatim. Its only impurity is `new Date()` for the `COMPILED` line.

- [ ] **Step 1: Temporarily export `generateManifestMarkdown` from `LatentCollider.jsx`**

- [ ] **Step 2: Write the parity test and record the snapshots from the original**

  ```js
  // manifest.parity.test.js
  // Freeze time so the COMPILED line is stable:
  //   vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-27T12:00:00Z'))
  // Reuse Task 1's FIXTURES (export them from a shared __tests__/fixtures.js).
  // Cases (each expect(md).toMatchSnapshot()):
  //   'no living, full result + narrative'
  //     narrative = { archetype, archetypeSigma, sanctuaries: [1 entry],
  //                   meta: {interference, catalysis, resonanceFreq, turbulence},
  //                   decayArc: [2 phases] }
  //   'no living, null result + null narrative'   (all the '—' fallbacks)
  //   'planet domain fixture'
  //   'LIVING case'   (living = { layer, slotIdx, newNote, oldNote, editionEntropy, witnessHash })
  //                    This one is deleted in Task 3.
  ```

  Run: `npx vitest run src/terminal/collider/__tests__/manifest.parity.test.js`

  Expected: PASS, snapshots written.

- [ ] **Step 3: Move `generateManifestMarkdown` into `collider/manifest.js`**

  Import it in the view, remove the temporary export, and repoint the test import.

- [ ] **Step 4: Run the parity test, the full suite and lint**

  Run: `npx vitest run src/terminal/collider && npm test && npm run lint`

  Expected: PASS, with 0 snapshots written, updated or obsolete.

- [ ] **Step 5: Commit**

  `refactor(collider): extract the manifest generator into a pure module`

---

### Task 3: Retire the shop in the client

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`
- Modify: `src/terminal/collider/manifest.js` (drop `living`)
- Modify: `src/terminal/views/ScalingTab.jsx` (stop passing `kernelRunHistoryRef`; drop the `living-note` keyframes at lines 47–52)
- Modify: `src/terminal/App.jsx:1334` (stop passing `kernelRunHistoryRef` to `ScalingTab`; the ref itself stays, because `useCommandDispatch` uses it)
- Delete: `src/terminal/hooks/useOrderStatus.js`, `src/terminal/hooks/useProductionThreshold.js`, `src/terminal/hooks/__tests__/orderDispatch.test.js`, `src/terminal/lib/vaultSeal.js`
- Modify test: `src/terminal/collider/__tests__/manifest.parity.test.js` (delete the LIVING case and its snapshot entry)
- Create test: `src/terminal/collider/__tests__/shopRetired.test.js`

**Interfaces:**
- Consumes: `generateManifestMarkdown` (Task 2), which becomes `generateManifestMarkdown(card, tesseract, result = null, narrative = null) → string`. The `living` parameter and the `§ LIVING SIGNATURE` section are removed.
- Produces:
  - `LatentCollider({ onPolarity } = {})`, with no `kernelRunHistoryRef`.
  - `TesseractCard` without the props `acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus, living, onLivingRedeemed`.
  - `CrystallizeCard({ card })`.

**What is removed from `LatentCollider.jsx`:**
- Imports: `useProductionThreshold`, `useOrderStatus` and `recordDispatchedOrder`, `sealForVault`, and any of `runPreExecTheater`, `theaterDuration`, `CopySpan`, `transitTag` that become unused (lint will name them). `redactCard` stays if the sovereign view still uses it.
- Constants: `TESSERACT_PUB_KEY_B64`, `getTesseractPubKey`, `PRODUCTION_THRESHOLD`, `TIERS`.
- State: `living`, `acquired`, `acquiring`, `acquireLog`, `selectedTier`, `serverThreshold`, `orderStatus`, and every `setLiving` / `setAcquired` call in the reset paths.
- `handleAcquire` in full, plus the `ck_ids` read and the `living:${hash}` hydration in `handleCrystallize`.
- Components: `ContactForm`, `FULFILLMENT`, `FulfillmentBadge`, `RedeemInput`, the 7-click `vaultGlyphClicks` reveal, the acquire-log render block, and in `CrystallizeCard` the whole "Register interest" block.
- In `TesseractCard`, the acquire CTA is replaced by the download block below. Also removed: the threshold bar, `§ REQUEST DECRYPTION KEY` (which carries the author's contact details), the `Formula encrypted via RSA-OAEP-2048` footnote, and the living-note highlighting in the note list.

**Kept:** `handleCrystallize`'s card build, the `essences/crystallized` emit (its `kind: 'order_placed'` stays until P2), the sovereignty assessment and `publishAssessment`, the sovereign view toggle, and the `ShimmeringCipher` display (P1 handles its honesty).

- [ ] **Step 1: Write the structural test**

  ```js
  // shopRetired.test.js — reads source text with fs; no rendering
  // LatentCollider.jsx source must NOT contain any of:
  //   'fetch(', '/api/transmute', 'sealForVault', 'TESSERACT_PUB_KEY_B64', 'TIERS',
  //   'PRODUCTION_THRESHOLD', 'handleAcquire', 'RedeemInput', 'ContactForm',
  //   'FulfillmentBadge', 'ck_ids', 'living:', 'scale0097', 'onRegister',
  //   'kernelRunHistoryRef'
  // These files must not exist:
  //   src/terminal/lib/vaultSeal.js, src/terminal/hooks/useOrderStatus.js,
  //   src/terminal/hooks/useProductionThreshold.js
  // collider/manifest.js source must not contain 'LIVING SIGNATURE' or 'HS256'
  // LatentCollider.jsx source MUST still contain 'generateManifestMarkdown(' and
  //   "text/markdown" (the download survives)
  ```

- [ ] **Step 2: Run it**

  Run: `npx vitest run src/terminal/collider/__tests__/shopRetired.test.js`

  Expected: FAIL, listing the forbidden strings and files.

- [ ] **Step 3: Remove everything listed above, and put this download block in `TesseractCard`**

  The copy is fixed:
  - Idle button: `◈ DOWNLOAD MANIFEST`. Same gold pill styling as the old acquire button.
  - While compiling: `[COMPILING TESSERACT MANIFEST...]`, then `[DOWNLOADING]`.
  - After download: `◈ MANIFEST COMPILED`, with the button shown again so the visitor can download again.
  - `manifestState` resets to `null` whenever `card.id` changes.
  - `handleDownload` keeps the 850 ms beat and the filename `ECO_Sx_TRANSMUTATION_${Date.now()}.md`, calls `generateManifestMarkdown(fullCard, tesseract, result, narrative)`, and no longer calls `onRegister`.
  - The old explanatory paragraph and the footnote under the button are removed and not replaced.

- [ ] **Step 4: Delete the LIVING case from `manifest.parity.test.js`, and drop `living` from `manifest.js`**

  Delete the LIVING snapshot entry by hand from the `.snap` file. Don't use `-u`.

- [ ] **Step 5: Run the tests and lint**

  Run: `npm test && npm run lint`

  Expected:
  - PASS.
  - The remaining manifest snapshots are unchanged (0 written, 0 updated).
  - The `.snap` file has no obsolete entries.

- [ ] **Step 6: Browser check**

  Use the preview tools against this worktree's own dev server. Remember: the author's `:5176` serves the main checkout, not the worktree.

  On `/SCENT`:
  1. Pick two domains, run the collision, crystallize.
  2. The card shows with no register, threshold or decryption-key block.
  3. "◈ DOWNLOAD MANIFEST" downloads a `.md`. Check the network panel: no `/api/transmute` request.
  4. Toggle the sovereign view on and off: redaction still renders.
  5. Pick a new pair: the download button is back in its idle state.
  6. Console: no errors.
  7. Take a screenshot of the card for the author.

- [ ] **Step 7: Commit**

  `feat(scent): retire the shop in the client; manifest download stays`

---

### Task 4: Retire the shop on the server, then the docs

**Files:**
- Delete:
  - `api/transmute/order.js`, `api/transmute/redeem.js`, `api/transmute/status.js`, `api/transmute/threshold.js`
  - `api/_alien/composeVerdict.js` (only `order.js` imports it)
  - `api/discord/interactions.js` (handles order-embed buttons only)
  - `bot/` (the Living Accord redeem bot)
  - `tests/transmuteOrder.test.js`, `tests/redeem.test.js`, `tests/livingNote.test.js`, `tests/discordInteractions.test.js`
- Modify: `tests/serviceWorker.test.js:71-72`. Replace the two `/api/transmute/*` cases with `/api/classified/challenge`, so the network-only assertion still covers two `/api/` paths.
- Modify: `.env.example`
  - Remove the "Transmute orders", "Discord buttons", "Living Accord" and "Vercel KV" sections, and `RATE_LIMIT_SALT`.
  - Keep `ALLOWED_ORIGIN`, moved under "Classified routes", with its comment reduced to: classified routes read it and allow any origin while it is unset.
- Modify: `package.json` / lockfile. Run `npm uninstall @vercel/kv` only after `grep -rn "@vercel/kv" api src tests` returns nothing.
- Modify: `docs/ARCHITECTURE.md`
  - The `LatentCollider.jsx` line count in the §7 table; drop "Includes order and redemption networking".
  - §7.1: row F9 becomes "superseded: the vault and its routes were removed (scent-aether P0)".
  - The storage table: drop "order hashes and local counters".
  - Any route listing that names `/api/transmute/*` or `/api/discord/*`.
  - The `collider/` file count.
- Modify: `.superpowers/security-audit-report.md`
  - M5 status: "moot: `/api/transmute/*` deleted in scent-aether P0".
  - M4 status: "open, scheduled scent-aether P1 (relabel) / P2 (real seal)".
  - The §-table row 8 gets the same note.
- Modify: `CHANGELOG.md`, adding one entry: the shop and Living Accord are retired, and the manifest download remains.

**Interfaces:** none produced. This task only deletes things.

- [ ] **Step 1: Extend `shopRetired.test.js`**

  Assert that these don't exist: `api/transmute`, `api/discord/interactions.js`, `api/_alien/composeVerdict.js`, `bot`. Assert that `.env.example` doesn't contain `DISCORD_`, `KV_REST_API`, `RATE_LIMIT_SALT` or `SOVEREIGN`.

- [ ] **Step 2: Run it**

  Run: `npx vitest run src/terminal/collider/__tests__/shopRetired.test.js`

  Expected: FAIL.

- [ ] **Step 3: Make the deletions and edits listed above**

- [ ] **Step 4: Run the full gate**

  Run: `npm test && npm run lint && npm run build`

  Expected: everything passes, and the build has no unresolved-import errors. Then run `wc -l src/terminal/views/LatentCollider.jsx` and record the count in ARCHITECTURE.md. It should be about 3,000, down from 3,991.

- [ ] **Step 5: Commit**

  `chore(api): delete the transmute, discord and redeem routes and the bot; docs`

- [ ] **Step 6: Hand the author the manual steps (as text; do none of them)**

  1. Stop the running `bot/` process wherever it is hosted.
  2. In Vercel, delete the env vars `DISCORD_BOT_TOKEN`, `DISCORD_ORDER_CHANNEL_ID`, `RATE_LIMIT_SALT`, `DISCORD_APPLICATION_PUBLIC_KEY`, `DISCORD_SOVEREIGN_SECRET`, `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
  3. Detach or delete the KV store.
  4. Clear the Interactions Endpoint URL in the Discord Developer Portal.
