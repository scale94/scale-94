# Scent as Aether — sealed accord → quintessence formula (design)

Date: 2026-11-27 · Status: **APPROVED** by the author, 2026-11-27 · Closes audit **M4** (and makes **M5** moot)

## 1. Intent

Two tabs sit apart from the artwork. `/CRYPTOGRAPHY` makes keys that do nothing, and `/SCENT` carried a perfume shop nobody wanted. This feature joins both to the Quintessence Altar on `/MERCURY`:

- At `/SCENT`, **crystallize** seals the collision's base accord under the visitor's own post-quantum identity.
- Only the **Kernel of Quintessence compile** opens it. The spine then modulates it into a **physically mixable fragrance formula**: real materials, CAS numbers, IFRA-checked doses, gram weights.
- The visitor takes it home as a signed, self-contained `.html` dossier.

Scent is the Aether, the fifth element. The formula is decrypted twice over, mystically (poetry condenses into chemistry) and cryptographically (the ciphertext bytes resolve into gram lines). The irony is deliberate and never stated: post-quantum exactness wrapped around something as subjective as smell. One person's transcendence is another's Victorian railway station.

Audience: Ars Electronica jurors, who start fresh sessions, mostly on desktop; and casual visitors on phones.

## 2. Goals, non-goals, anti-goals

**Goals**
- Real cryptography only. Every label in every artifact names the primitive that actually ran.
- A formula someone can genuinely compound, at home or from one on-site exhibition kit.
- `/SCENT` becomes the required fourth spine mark.
- `/CRYPTOGRAPHY` gains real actions: identity, backup/restore/rotate, and verifying a dossier.
- Pure-JS / thin-host split. No new serverless routes. 100% client-side.
- `LatentCollider.jsx` shrinks rather than grows.

**Non-goals**
- Selling anything. The shop is retired (§11).
- `/BSKY` and `/ACCRETION` shaping the chemistry. They keep shaping the kernel text only.
- X25519 hybrid KEM.
- A server-held copy of anything.

**Anti-goals** (failure even if it works)
- Any cipher, hash, density, flash-point, longevity or probability claim that isn't computed or cited.
- Conceptual maths dressed in physical units.
- Humour that obscures a safety fact.
- White as a resting colour.
- A formula that overflows its vial, goes negative on alcohol, or exceeds an IFRA limit.

## 3. Locked decisions (author rulings, 2026-11-26/27)

1. Retire the shop and order flow entirely.
2. `/SCENT` is a **required fourth mark**. The Eye compass and the altar's spine mirror lead visitors there.
3. Crystallize **is** the sealing moment.
4. **One identity per visitor:** ML-KEM-768 (FIPS 203) + ML-DSA-65 (FIPS 204). No X25519.
5. The key is derived with **BLAKE3 `derive_key`**. It is already compiled into the crate, so the label stays true.
6. `SEAL ORPHANED — the key evaporated` when the key is lost. Rotation orphans the old seal the same way.
7. **Fixed kit of ~36 materials** (about 44 bottles including weaker trace stocks), for home and on-site use.
8. **Measured by weight**, to 0.01 g. Drop counts appear only as a clearly marked approximation.
9. Stock dilutions: liquids that are safe to handle neat stay neat; viscous bases at 50%; solids and high-impact materials at 10% / 1%. Stocks are diluted in ethanol only.
10. **Minimum weighable dose 0.05 g**, with automatic stepping to a weaker stock.
11. Default batch **7.00 g for a 10 ml atomiser**; second option 10.00 g / 15 ml.
12. "Poetry on the card, chemistry in the seal." Poetic notes map to real materials.
13. Every honesty-sweep fix (§10), plus the governing rule: *anything that reads like a lab measurement is either calculated from cited data or cut; conceptual maths never uses physical units.*
14. Reveal: **C with B's real bytes underneath** (§8).
15. Dossier: **B, bench sheet then archive** (§9). Sans + mono, no serif, no white resting text.
16. Disclaimer in a dry Viennese voice (*Wiener Schmäh*). Safety facts stay plain and unmissable.
17. **Opened vial.** The compile is the unsealing. The decrypted formula is stored in plain text on the compiled artifact (`quintessence_kernel_v1`) and is never re-sealed at rest. A seal broken once, for real.
18. Signing at ignite. Only a real envelope fills the fourth mark. Pre-feature kernels render `// sealed before the aether`. Poetic notes keep their names, with every note → material mapping shown (§6).

## 4. Approaches considered

**Key model**
- (1) A separate hidden key for `/SCENT`: cheap, but leaves `/CRYPTOGRAPHY` meaningless. Rejected.
- (2) One ML-KEM identity: real, but `/CRYPTOGRAPHY` only manages keys.
- (3) **Chosen:** (2) plus ML-DSA signing and dossier verification. It's the only option where `/CRYPTOGRAPHY` does something a visitor wants, and it gives the take-home object a verifiable origin.

**Seal transport**
- `vaultSeal.js` (shop RSA key) can't work: only the server could open it. Deleted.
- `seal_markdown` (passphrase) has no ML-KEM and uses demo-strength Argon2.
- **Chosen:** new structured ML-KEM/ML-DSA/BLAKE3 WASM exports.

**Palette**
- An open palette of ~120 materials: about 3× the citation work and expensive to mix.
- **Chosen:** a fixed kit of ~36.

**Measurement**
- Drops only: ±30–50% error breaks the promise of precision.
- **Chosen:** weight.

**Reveal**
- A: two more ✓ stage lines.
- B: ciphertext dissolving into grams.
- C: poetry precipitating into chemistry.
- **Chosen:** C over B's real bytes.

**Dossier**
- A: monospace printout. It scrolls sideways on phones.
- **Chosen:** B, a responsive bench sheet with a print stylesheet.

**Monolith**
- Option one: add a single hook to `LatentCollider` now.
- **Chosen:** extract the pure layers first (P0). Deleting the shop is the largest single shrink.

## 5. Architecture

Pure modules (no React, no GL, no DOM, all Vitest-covered) plus thin hosts. All names below are proposals; the builder may rename them.

### 5.1 `/SCENT` side

- `src/terminal/collider/perfumeCard.js` (P0, extracted): `PERF_NOTES`, `_pickNote`, `FAMILY_INTERFERENCE`, `buildPerfumeCard`, `generateAccordHash`.
- `src/terminal/collider/manifest.js` (P0, extracted): the manifest generator, as a pure function.
- `src/terminal/scent/materials.js`: the kit table (§7.1). The row schema includes the citations.
- `src/terminal/scent/noteInterpretation.js`: each poetic note → one or more kit materials with relative parts. Every name in `PERF_NOTES` must map to something (tested).
- `src/terminal/scent/baseAccord.js`: card → base accord (materials and starting parts) plus a random 32-byte **chaos salt** drawn at seal time. Only the salt is non-deterministic, and that's what makes the seal non-theatrical.
- `CAS_REGISTRY` is **deleted**. CAS numbers live only in `materials.js`.

### 5.2 Cryptography

**Rust** (`content/rust_kernels/src/kernels/`, new exports; existing ones untouched):
- `mlkem768_keygen() → {ek, dk}`
- `mlkem768_encaps(ek) → {ct, ss}`
- `mlkem768_decaps(dk, ct) → ss`
- `mldsa65_keygen() → {pk, sk}`
- `mldsa65_sign(sk, msg) → sig`
- `mldsa65_verify(pk, msg, sig) → bool`
- `blake3_derive_key(context, ikm) → [u8; 32]`

Rules for all of them: structured return values only (no log parsing), secrets zeroized, and known-answer tests against the FIPS 203/204 vectors.

**ML-DSA-65 gate (P2's first task):** the crate is the prerelease `ml-dsa 0.1.0-rc.7`, and today only ML-DSA-87 is used (`tesseract_vault.rs:28`). Before anything else in P2, run the FIPS 204 known-answer tests for ML-DSA-65 on this version.
- If they fail, pin a version where they pass.
- If no version passes, fall back to ML-DSA-87, which is already in use, and every label says 87. *(Builder-check call.)*

Labels follow whatever passes the tests.

`seal_markdown` is never reused for anything in this feature. It uses demo Argon2 parameters, and one code path uses a fixed `DEMO_SALT` (`tesseract_vault.rs:40`).

`ClassifiedTab`'s regex extraction of key hex from the `run_classified` log is replaced by `mlkem768_keygen`.

**`src/terminal/lib/identityVault.js`** (thin bridge, IndexedDB + WebCrypto):
- One identity record: `ek`, `pk` (both public), the wrapped `dk` and `sk`, a fingerprint, and the creation time.
- The wrapping key is a non-extractable AES-256-GCM `CryptoKey` stored in IndexedDB.
- Actions: `getOrCreateIdentity()`, `exportBackup(passphrase)`, `importBackup(file, passphrase)`, `rotate()`, `fingerprint()`.
- When IndexedDB is unavailable, the identity is held in memory and labelled `VOLATILE IDENTITY — will not survive reload`, mirroring the existing volatile build.

**Backup format:** the passphrase goes through Argon2id with real parameters, then AES-256-GCM. A new export may be needed, because `seal_markdown` uses demo parameters (64 KiB, t = 1). The label states the exact parameters.

**`src/terminal/lib/accordSeal.js`** (pure apart from the WASM/WebCrypto calls):
- **Seal:** `(baseAccord + salt, ek) → envelope`.
  - `ct, ss ← encaps(ek)`
  - `k ← blake3_derive_key("scale94 scent accord seal v1", ss)`
  - AES-256-GCM over the canonical JSON, with a random 96-bit nonce.
  - The additional authenticated data (AAD) is the envelope version plus the identity fingerprint.
- **Envelope:** `{v:1, kem:'ML-KEM-768', kdf:'BLAKE3-derive_key', aead:'AES-256-GCM', fp, ct, nonce, aead_ct}`, base64.
- **Unseal:** the reverse. An authentication failure or a missing key returns a typed state (§6.3); it never throws through to the UI.

### 5.3 Spine and altar

- **`spineStore`:** new field `scent` holding `{ envelope, cardName, sealedAt, fp }`, set by a new `setScent()`. `missingVertebrae()` appends `'NO ACCORD SEALED'` as the **fourth** entry. `emptySpine` gains `scent: null`.
- **`vertebrae.js`:** fourth entry. Proposed values:
  - `key: 'scent'`, `tab: 'scaling'` (the internal route id), `label: 'scent'`
  - tint = `NAV_TINTS.scaling`, fuchsia `[217, 70, 239]`. The file already pins that as the scent house's hue.
  - `field: 'sealed accord'`, `house: 'the scent house'`, preview = `cardName`
  - Every reader that depends on mark order is updated together, with tests:
    - `VERTEBRAE` readers: `components/resolveEyeState.js`, `mercury/SpineMirror.jsx`, `quintessence/observerStore.js`.
    - `missingVertebrae()` readers: `QuintessenceAltar.jsx`, `ReliquaryView.jsx`, `KernelTab.jsx`.
    - **Also** `KernelTab.jsx`'s own hard-coded mark list (lines 95–99, which already includes `element`). That list gains `scent`, making five there.
- **Crystallize** (`LatentCollider` host, a single call):
  - `sealAccordForSpine(card, result)` builds the base accord, gets or creates the identity, seals, then calls `setScent`.
  - The `essences/crystallized` event's `kind` becomes `'accord_sealed'` (was `'order_placed'`).
  - The `ciphers` bus gets `cipher_sealed`, closing the existing TODO.
- **Altar `ignite()`:** before `compileKernel`, it unseals the scent (async, in the host). `compileKernel` stays pure and receives the decrypted base accord as an argument. The formula engine runs inside the pure compile path. The artifact gains `formula` and `dossierPayload`.
- **Hash:** the compile hash still covers the spine, which now includes the envelope (the ciphertext), not the plaintext.

### 5.4 Formula engine: `src/terminal/scent/formulaEngine.js` (pure)

`(baseAccord, salt, modulators, batch) → formula`

The formula holds:
- per-material rows: stock, grams, neat %, layer, approximate drops
- the alcohol top-up
- the actual strength
- the layer split
- the rest window
- the modulation log, one line per source
- IFRA check results

Rules in §7.2. `src/terminal/scent/modulators.js` reads the inputs (§7.3).

### 5.5 Dossier and verification

**`src/terminal/scent/dossier.js`** (pure): `(artifact, signature, pk) → html string`.
- It includes `<script type="application/json" id="dossier-payload">`, inert data that is never executed, holding the **canonical signed payload**: formula, provenance, kernel hash, modulation log, compiled-at, fingerprint.
- The visible page is rendered from that payload.
- `.md` stays available as the raw secondary export, under the same honesty rules.

**Signing happens at ignite** (the reveal's `SIGNED` stage), not at export. The signature and `pk` are stored with the artifact, and the export only embeds them. This means a later rotation never leaves a stored formula unsignable, and export never needs the secret key. *(Builder-check call.)*

**`/CRYPTOGRAPHY` → "verify a dossier":**
- Takes a dropped or picked file, extracts the payload JSON, and verifies it.
- **It renders the verified payload itself**, never the surrounding HTML.
- It shows the signer's fingerprint and whether that is *your* identity.

**`/CRYPTOGRAPHY` → identity panel:** fingerprint, backup, restore, rotate (with an orphaning warning).

## 6. Visitor states and edge cases

1. **Fresh visitor:** the altar shows four absences. The Eye leads to the next one, `/SCENT` included.
2. **First crystallize:** the identity is created silently. If `/CRYPTOGRAPHY` was visited first and made one, that identity is reused.
3. **`SEAL ORPHANED — the key evaporated`:** the envelope exists but its key doesn't (site data cleared, or another device). The scent mark falls back to unmarked with this named state, and the visitor re-crystallizes. The same applies after a rotation, with wording of the builder's choosing.
4. **Recrystallize:** the new seal replaces `spine.scent`. One accord at a time, like one kernel.
5. **Restore on another device:** a deliberate import of the backup in `/CRYPTOGRAPHY`, never automatic.
6. **No WebCrypto (insecure origin):** crystallize still shows the card, but **an unsealed card never fills the fourth mark**. Only a real envelope does. The compile needs `crypto.subtle` anyway, so nothing is lost by this. The mark shows a named state, and the altar follows its existing rule: never brick, cool down. *(Builder-check call.)*
8. **Kernels sealed before this feature:** a stored artifact with no `formula` renders exactly as today. The reliquary treats a missing formula as an empty house, for example `// sealed before the aether`. A stored spine with no `scent` simply shows the fourth absence. No migration step. *(Builder-check call.)*
9. **Poetic notes with no real counterpart:** notes such as Deer Musk, Civet, Ozone, Sea Salt, Oud Kyara and the named accords stay on the card. Each maps to excluded-safe stand-ins (Deer Musk → synthetic macrocyclic musks, for example), which is how perfumery has always interpreted these notes. The dossier shows every note → material mapping, so the substitution is visible. `PERF_NOTES` is not rewritten, so P0's parity pins hold. *(Follows from locked decision 12.)*
7. **Optional readings absent:** named in the dossier, for example `/SOL unwitnessed — the sun left the top notes alone`. Never guessed.

## 7. Chemistry

### 7.1 The kit table (`materials.js`)

**Row fields:** `id`, `name`, `cas`, `layer` (top/heart/base), `role`, `stocks` (for example `[1.0]`, `[0.5]`, `[0.1, 0.01]`), `ifraCat4MaxPct` (on the neat finished product) or `null` when unrestricted, and `solubility` (solids only).

**Each row also carries `sources`,** with at least:
- `casSource` (for example ECHA, PubChem or the supplier's technical sheet, with URL and access date)
- `ifraSource` (IFRA Standard name, amendment number and URL), or a citation that the material is unrestricted
- `solubilitySource` (solids only)
- `densitySource` (only if density is ever used)

**Excluded:** anything IFRA-prohibited or subject to a purity specification, animal-derived or CITES-listed materials, ozone, inorganic salts, and named "accords" passed off as single materials.

**Tests fail the build if:**
- any row lacks a required source;
- any CAS number fails the CAS check-digit test;
- any poetic note maps to no material;
- any material appears twice.

Researching and citing the table is **its own task**. Values come from the sources, never from memory. The author signs off the final table.

### 7.2 Engine rules (all tested invariants)

**Layer bands** (shares of the concentrate): top 15–25%, heart 30–40%, base 40–55%. The split sums to exactly 100%.

**Element → target strength** (from the altar's `ELEMENT_MAP`):

| Element | Type | Concentrate in the finished bottle |
|---|---|---|
| AIR | Eau de Cologne | ~4% |
| WATER | Eau de Toilette | ~10% |
| EARTH | Eau de Parfum | ~18% |
| FIRE | Extrait | ~25% |

**Constraints:**
- The actual strength lands within ±0.5 percentage points of the target.
- Neat % in the finished bottle = grams × stock ÷ batch. It must be ≤ `ifraCat4MaxPct` for every material. This is checked **after** all modulation.
- Every weighed amount is ≥ 0.05 g. Below that, the engine steps to a weaker stock (neat → 10% → 1% → 0.1%; amended 2026-11-27 at the P1 sign-off so methyl octine carbonate, Cat 4 limit 0.010%, has a usable window); if no stock fits, the material drops out and the change is logged.
- Σ weighed stock grams ≤ batch weight, and the alcohol top-up is ≥ 0. Solvent carried in by the stocks counts towards the alcohol.
- The fill volume uses the worst-case density of 0.789 g/ml (ethanol): batch ÷ 0.789 ≤ 90% of the vial's nominal volume. That gives 7.00 g → 8.87 ml in a 10 ml vial, and 10.00 g → 12.67 ml in a 15 ml vial.
- Grams are rounded to 0.01 g, and the totals are recomputed from the rounded values.

### 7.3 Modulators

| Source | Effect | When absent |
|---|---|---|
| Altar element | Target strength (table above) | Not possible: the element is required at ignite |
| `/SOL` (periphery `sol`) | Tilts weight top ↔ base, within the layer bands | Named, no tilt |
| `/LUNAR` (spine phase → existing dryness) | Rest window, 2–8 weeks | Not possible: the phase is required |
| `/CHAOS` salt (sealed at `/SCENT`) | Bounded per-row micro-shifts, renormalized within the bands | Not possible: the salt is always sealed |
| `/CHAOS` periphery (`art`) | Optionally scales how far the salt's micro-shifts reach | Named, default reach |

Each modulation writes one line naming its source, for example `/LUNAR waning gibbous → 5 weeks in the dark`. The exact numeric mappings are the builder's call, inside the bands.

### 7.4 Safety block

These facts are always plain and unmissable:
- Highly flammable, with ethanol's flash point (about 13 °C) taken from a cited source.
- Gloves.
- Follow the working dilutions.
- Patch-test first.
- Keep away from eyes and children.
- Not a cosmetic product.

The *Wiener Schmäh* voice frames these facts and never replaces them. The author's drafts A and B are the starting point. Draft B's line "every CAS number and IFRA ceiling above is real" may ship only because §7.1's tests make it true.

## 8. The reveal at the altar (C over B)

**Sequence:** the existing stages run, then the accord unseals:
1. A muted envelope header comes first: `ENVELOPE · ML-KEM-768 CT (1088 B) · AES-256-GCM · n B`.
2. The poetic notes appear.
3. Each note condenses into its material rows. Each row resolves left → right out of **its own slice of the real ciphertext**.
4. The modulators sign their changes underneath.
5. Signing, then `◈ BUILD`.

Stage list additions: `ACCORD UNSEALED`, `FORMULA MODULATED`, `SIGNED`.

**Colour** (Fade Doctrine, tuned to the obsidian palette):

| Layer | Register | Colour |
|---|---|---|
| Top | Muted cyan | `#6cc6d4` |
| Heart | Muted orange | `#d98a46` |
| Base | Darker resolved amber | `#c8a556` |

Bright gold `#fcd34d` belongs **only** to the compile moment (`◈ BUILD`, `FORMULA` lines).

**The flash:**
- An ~80 ms white flash, on the few resolving characters only, snapping to the resting colour. Never held, never a soft opacity fade.
- Rows are paced so the page never exceeds 3 flashes per second (WCAG 2.3.1).
- `prefers-reduced-motion` gets an instant snap with no flash.

**Timing:** adds roughly 3–5 s to today's ~4 s. Holding again skips to the end.

**Narrow screens:** each row is `name … grams` with a flexing dotted leader. Grams never wrap; the name truncates first. CAS number and stock sit on a small second line.

## 9. The dossier (B)

- **File:** one self-contained `.html`. Inline CSS, **no JavaScript**, so it opens offline in the iPhone Files preview and in Android Chrome.
- **Fonts:** Geist Sans + Geist Mono, the site's own fonts, OFL-licensed, embedded as base64 `@font-face`.
  - The `.woff2` files are fetched from `/fonts/` at export time, so the JS bundle doesn't grow.
  - The dossier is about 200 KB.
  - Fallbacks: `system-ui, -apple-system, sans-serif` and `ui-monospace, Menlo, Consolas, monospace`.
  - **Export never breaks on fonts.** If a `/fonts/*.woff2` fetch fails or the visitor is offline, that `@font-face` is simply left out and the fallback stack applies (tested).
  - Sans for prose (title, accord, safety). Mono for headers, grams, CAS numbers, modulators and kernel source. No serif.
- **Screen colours:**
  - Obsidian background `#0b0b0f`.
  - Primary resting text is warm ash `#d6d3d1`, secondary `#a8a29e`, muted `#71717a`.
  - **No `#fff` anywhere on screen.**
  - Layer accents as in §8. Gold only on the build line.
- **Order:**
  1. Header: name, build, verdict, element, strength.
  2. The accord as the card dreamed it.
  3. The formula: batch, vial, rows, top-up, layer split.
  4. What shaped it.
  5. Safety block.
  6. `<details>` provenance: primitives, envelope, fingerprint, signature, `pk`.
  7. `<details>` kernel source.
- **Print stylesheet:**
  - Black ink on white.
  - All `<details>` sections forced open.
  - `break-inside: avoid` on material rows.
  - Bench tick-boxes (weighed / topped up / resting until ___).
  - "Save as PDF" is the PDF route.

## 10. Honesty sweep (all locked)

**Cut or replaced in the manifest/card:**
- Flash point: real cited ethanol value + "highly flammable".
- SG: cut.
- Longevity: cut.
- CONC % and LOADING: replaced by the element strength and computed concentrate %.
- Maceration: replaced by the `/LUNAR` rest window, labelled as a modulation.
- EVAP CURVE: cut. Replaced by the formula's real top/heart/base % (sums to 100%, tested).
- UI timing bars (`<15min / 4hr / days`): volatility-tier labels or "general guidance".
- `P(RECOLL) < 10⁻⁷⁷`: cut, replaced by a true per-seal uniqueness statement.
- `RSA-OAEP-2048 / BLAKE3 INTEGRITY BOUND`: replaced by the real primitives.
- `§ LIVING SIGNATURE … HS256 server-deterministic`: cut with the shop. ML-DSA replaces it.
- `SPACE 1536-dimensional`: becomes `16-D · expanded to 1536`.

**Kept** (computed conceptual maths, no physical units): COS(θ), novelty, coherence, post-saponification, viability, sanctuaries, cluster metrics, Feigenbaum arc.

## 11. Shop retirement

**Deleted:**
- `api/transmute/{order,redeem,status,threshold}.js`
- `src/terminal/lib/vaultSeal.js` and the embedded shop RSA public key
- `hooks/useOrderStatus.js` and `hooks/useProductionThreshold.js`
- `TIERS`, `PRODUCTION_THRESHOLD`, `ContactForm`, `RedeemInput`, `FulfillmentBadge`, the acquire/order/redeem state and handlers, and `living:*` hydration
- `tests/transmuteOrder.test.js`, `tests/redeem.test.js`, and the living-note test if it only covers redemption
- Any KV/env config that only these used, plus any `vercel.json` CSP or route entries that only these needed

**Kept:** crystallize, the panopticon/sovereignty assessment at seal, and the `essences` bus.

**Docs:** `docs/ARCHITECTURE.md` (§7.1 audit table, the line counts) and the audit report's M4/M5 status are updated.

## 12. Phases (each one ships on its own)

- **P0, untangle (no visible change except the shop's removal).**
  - Extract `perfumeCard.js` and `manifest.js`, with parity tests that pin the current output.
  - Retire the shop (§11).
  - `LatentCollider.jsx` shrinks substantially.
- **P1, honest chemistry.**
  - `materials.js` (cited), `noteInterpretation.js` and `formulaEngine.js`, with every invariant tested.
  - The honesty sweep (§10).
  - M4 closed provisionally: the formula block is relabelled `ENCODING — unencrypted preview` or removed until P2.
- **P2, the identity and the seal.**
  - Rust exports + WASM rebuild (plus the M3 hash pin if it has landed).
  - `identityVault.js`, `accordSeal.js`.
  - Crystallize seals; fourth mark; orphaned states.
  - `/CRYPTOGRAPHY` identity panel (fingerprint, backup, restore, rotate).
  - M4 closed for real.
- **P3, the altar.** Unseal in `ignite()`, modulators, the formula wired into the compile and artifact, the reveal (§8), the reliquary showing the formula.
- **P4, the dossier.** `dossier.js`, ML-DSA signing, Geist embedding, print stylesheet, the `/CRYPTOGRAPHY` verifier, `.md` secondary.

**Parallel track:** researching and citing the materials table (§7.1). It can start immediately. P1 can't finish without it.

## 13. Left to the builder

- Module and file names.
- The exact `/SOL` / `/CHAOS` / `/LUNAR` numeric mappings inside the bands.
- Note → material part ratios.
- The poetic wording of orphan and rotation states.
- Reveal pacing within the flash limit.
- The Argon2id backup parameters, with the label stating them.
- The envelope's byte layout (the fields in §5.2 are fixed).
- How the `/CRYPTOGRAPHY` verifier lays out the payload.
