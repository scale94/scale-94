# Scent as Aether — P2 (The Identity and the Seal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each visitor one real post-quantum identity, and make crystallize seal the base accord under it.
- ML-KEM-768 + ML-DSA-65 + BLAKE3 + Argon2id exports in Rust/WASM, each with known-answer tests
- `identityVault.js` (IndexedDB + WebCrypto) and `accordSeal.js` (the envelope)
- `/SCENT` becomes the fourth spine mark, with named orphaned and insecure-origin states
- `/CRYPTOGRAPHY` gains an identity panel (fingerprint, backup, restore, rotate)
- M4 closes for real

**Architecture:**
- The Rust exports live in one new kernel file and touch no existing export.
- JS splits into pure modules (envelope maths, canonical JSON, mark state) and thin bridges (WASM calls, WebCrypto, IndexedDB). Every bridge takes its dependencies as arguments, so tests can run the **real WASM** in Node, never a mocked primitive.
- Nothing in P2 runs at the altar. P3 unseals in `ignite()`; P4 signs. P2 only ships `mldsa65_*` as tested exports (plus the identity's ML-DSA keypair) so P4 has nothing left to add in Rust.

**Tech Stack:** Rust (ml-kem 0.2.3, ml-dsa 0.1.0-rc.7, blake3, argon2, zeroize, wasm-bindgen) → wasm-pack `--target web`; React 18 + Vite; Vitest (jsdom); ESLint.

**Spec:** `docs/superpowers/specs/2026-11-27-scent-aether-design.md` (P2 = §12 third bullet; §3 decisions 3–6, §5.2, §5.3, §6.1–6.6, §6.8, §10, §13).

## Global Constraints

- Spec §2 goal: *Real cryptography only. Every label in every artifact names the primitive that actually ran.*
- Spec decision 13: *anything that reads like a lab measurement is either calculated from cited data or cut.* For crypto this means no byte count, parameter or security claim on screen unless it came from the code path that ran.
- Identity: **ML-KEM-768 (FIPS 203) + ML-DSA-65 (FIPS 204). No X25519.** If Task 1's gate fails on every version, it's ML-DSA-87 everywhere, and every label says 87.
- KDF context string, exact: `scale94 scent accord seal v1`.
- Envelope fields, exact (spec §5.2): `{v:1, kem:'ML-KEM-768', kdf:'BLAKE3-derive_key', aead:'AES-256-GCM', fp, ct, nonce, aead_ct}`, binary fields base64. The nonce is 96 random bits. AAD = envelope version + fingerprint.
- `seal_markdown` and `DEMO_SALT` are never called by anything in this feature.
- Unseal never throws through to the UI. It returns a typed state.
- **An unsealed card never fills the fourth mark.** Only a real envelope does.
- Orphan copy, exact: `SEAL ORPHANED — the key evaporated`.
- Missing-mark copy, exact: `NO ACCORD SEALED`, appended **fourth** by `missingVertebrae()`.
- Fourth vertebra: `key:'scent'`, `tab:'scaling'`, `label:'scent'`, tint `[217, 70, 239]`, `field:'sealed accord'`, `house:'the scent house'`, preview = `cardName`.
- Event changes: `essences/crystallized` `kind` → `'accord_sealed'`; the `ciphers` bus gets `cipher_sealed`.
- No new serverless routes. 100% client-side. No server copy of anything.
- New pure modules contain no React, DOM, GL, WASM or WebCrypto; bridges contain no React.
- Lint gate: `npm run lint` (max warnings 143) passes.
- Snapshots: never `vitest -u` except where a task names the file and the allowed-change list. The report includes the full `.snap` diff.
- Branch `feature/scent-aether-p2`, cut from `feature/scent-aether-p1` at `b80af449`. Commit per task. **Never push.** The author pushes.
- Leave `.import-cache.json`, `baseline/` and `docs/superpowers/research/` untracked.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings in this plan (for the author's review before execution)

1. **The gate covers both crates.** The spec's gate names ML-DSA-65. Task 1 also runs the FIPS 203 ML-KEM-768 vectors, because every seal depends on ML-KEM, and `ml-kem` is pinned the same way. Vectors are the NIST ACVP-Server `internalProjection.json` files at commit `65370b8` (the commit the `ml-dsa` crate cites), filtered to the 65/768 groups and committed with their source SHA-256.
2. **Exact pins.** `ml-dsa = "=0.1.0-rc.7"`, `ml-kem = "=0.2.3"`. Today `Cargo.toml` asks for `0.1.0-rc.5` while the lockfile has moved to rc.7. A prerelease range can move under us; the labels have to follow the version that was tested.
3. **The ML-DSA secret is the 32-byte seed ξ** (FIPS 204 Algorithm 1 input), not the 4,032-byte expanded key. It's what the crate's own PKCS#8 encoding stores, it's 126× smaller to wrap and back up, and `from_seed` is the tested KeyGen path. The ML-KEM `dk` stays the 2,400-byte encoded key, because `ml-kem 0.2.3` has no public from-seed constructor outside its `deterministic` feature.
4. **Fingerprint = first 16 bytes of SHA-256(ek ‖ pk)**, shown as 8 groups of 4 hex characters. It's computed with WebCrypto `digest`, because no BLAKE3 hash export is in the spec's list and one isn't needed. Labelled `FP · SHA-256(ek‖pk)[0..16]`.
5. **Backup KDF: Argon2id, m = 65,536 KiB (64 MiB), t = 3, p = 4, 16-byte random salt, 32-byte output.** This is RFC 9106 §4's second recommended option, the one for memory-constrained settings. It runs single-threaded in WASM, so p = 4 costs wall time, not threads. Task 2 measures the time; if it's over 5 s on the author's phone, the author rules. The label states exactly `Argon2id · m=64 MiB · t=3 · p=4 · RFC 9106 §4 option 2`. New export `argon2id_derive_key`, because `seal_markdown` is off limits.
6. **Orphaning is decided at boot, not per read.** `missingVertebrae()` stays synchronous for its six readers. When the identity loads, and after a rotate or restore, `reconcileScent(currentFp)` compares `spine.scent.fp` and writes `orphaned: true` on a mismatch or a missing identity. An orphaned scent counts as missing, and its missing-line reads `SEAL ORPHANED — the key evaporated` in place of `NO ACCORD SEALED`. Rotation uses the same line (spec §13 leaves the wording to the builder; one line is easier to read than two).
7. **Insecure origin wording: `UNSEALED — this origin has no WebCrypto`.** It replaces P1's static `UNSEALED` badge whenever no envelope was made. When a seal succeeds, the badge reads `SEALED · ML-KEM-768 · FP xxxx xxxx`.
8. **Per-seal uniqueness line** (closing P1 ruling 4): the manifest gains `SEAL         ML-KEM-768 encapsulation + 32-byte chaos salt, both fresh per seal`. It's a statement of what runs, not a probability.
9. **The M3 WASM hash pin has not landed** (audit report M3, still open). P2 doesn't take it on. The spec makes it conditional ("if it has landed").

## Review Focus

1. **Tampered envelope bytes** (any one byte of `ct`, `nonce`, `aead_ct` or `fp` flipped) must return `{state:'tampered'}`, never a throw or garbage plaintext. Pinned in Task 4 for each field.
2. **A spine restored from localStorage whose identity is gone** (IndexedDB cleared, or another device) must show the orphaned line, not a filled mark. Pinned in Task 5 (`reconcileScent(null)`).
3. **A wrong passphrase or a truncated backup file on restore** must leave the current identity untouched and return a named error. Pinned in Task 3.
4. **Double-click on crystallize** (two concurrent first seals) must not create two identities. `getOrCreateIdentity()` dedupes in-flight creation. Pinned in Task 3.
5. **Storage unavailable** (private mode, IndexedDB throws on open) gives the in-memory identity labelled `VOLATILE IDENTITY — will not survive reload`, and the seal still works. Pinned in Task 3.

---

### Task 1: The FIPS 203/204 known-answer gate

**Files:**
- Modify: `content/rust_kernels/Cargo.toml` (exact pins; dev-deps `serde` with `derive`, `serde_json` std, `hex` with `serde`; dev-dep `ml-kem` with feature `deterministic`)
- Create: `content/rust_kernels/tests/vectors/acvp-65370b8/{ML-DSA-keyGen,ML-DSA-sigGen,ML-DSA-sigVer,ML-KEM-keyGen,ML-KEM-encapDecap}.json` (65/768 groups only)
- Create: `content/rust_kernels/tests/vectors/acvp-65370b8/SOURCE.md` (URL, commit, SHA-256 of each unfiltered download, the filter used)
- Create: `content/rust_kernels/tests/fips_kat.rs`

**Interfaces:**
- Produces: a gate verdict that Task 2 reads: **ML-DSA-65 passes on version X**, or **fallback to 87**. It's recorded in `SOURCE.md` and the commit message.

- [ ] **Step 1: Pin and filter.** Set the exact pins (ruling 2), run `cargo update -p ml-dsa -p ml-kem --precise` as needed, and confirm `Cargo.lock` is unchanged apart from dev-deps. Filter the downloaded ACVP files to `parameterSet ∈ {ML-DSA-65, ML-KEM-768}`, keeping the original JSON structure. Write `SOURCE.md`.
- [ ] **Step 2: Write the tests in `tests/fips_kat.rs`.** Every group is filtered by `parameterSet`, and every test asserts it ran at least one case, so a filter mistake can't pass vacuously.
  - `mldsa65_keygen_kat`: `MlDsa65::from_seed(seed)`. Its encoded verifying key == `pk` and its expanded signing key == `sk` (all 25).
  - `mldsa65_siggen_kat`: for each case, signing key from the expanded `sk`, `sign_internal(&[message], rnd)` with `rnd = [0; 32]` when `deterministic` is true. The encoded signature == `signature` (all 20).
  - `mldsa65_sigver_kat`: `verify_internal(message, sig)` == `testPassed` (all 15, true and false cases both present).
  - `mlkem768_keygen_kat`: `MlKem768::generate_deterministic(d, z)`. The encoded `ek`/`dk` match (all 25).
  - `mlkem768_encaps_kat`: `encapsulate_deterministic(m)` on `ek` gives `c` and `k` (all 25).
  - `mlkem768_decaps_val`: decapsulating `c` with the group `dk` gives `k`, including implicit-rejection cases (all 10).
- [ ] **Step 3: Run** `cargo test --test fips_kat` in `content/rust_kernels`. Expected: 6 tests pass, and the per-test case counts printed with `--nocapture` read 25/20/15/25/25/10.
- [ ] **Step 4: If an ML-DSA test fails,** try the later ml-dsa prereleases in turn (`cargo search ml-dsa`, then pin and rerun). If none passes, record the fallback to ML-DSA-87 and swap the test to the 87 groups (re-filter the vectors). Stop and report either way before Task 2: this changes labels everywhere.
- [ ] **Step 5: Confirm the WASM build still compiles:** `cargo build --release --target wasm32-unknown-unknown` (the `deterministic` feature must not leak into it: `cargo tree -e features -p ml-kem --target wasm32-unknown-unknown` shows no `deterministic`).
- [ ] **Step 6: Commit** `test(rust): FIPS 203/204 known-answer gate for ML-KEM-768 and ML-DSA-65; exact crate pins`

### Task 2: Rust exports and the WASM rebuild

**Files:**
- Create: `content/rust_kernels/src/kernels/aether_seal.rs`
- Modify: `content/rust_kernels/src/kernels/mod.rs` (register the module)
- Regenerated by `npm run rust:import`: `public/wasm/*`, `src/wasm/scale94_kernels.{js,d.ts}`, `src/wasm/wasm.generated.js`
- Create: `tests/helpers/loadWasmNode.js` (`initSync({ module: fs.readFileSync('public/wasm/scale94_kernels_bg.wasm') })`, returns the module)
- Test: `content/rust_kernels/src/kernels/aether_seal.rs` (`#[cfg(test)]`), `tests/aetherSealWasm.test.js`

**Interfaces:**
- Produces (wasm-bindgen; every `Vec<u8>` arrives as `Uint8Array`; errors are `JsError`):
  - `mlkem768_keygen() → { ek: Uint8Array(1184), dk: Uint8Array(2400) }`
  - `mlkem768_encaps(ek) → { ct: Uint8Array(1088), ss: Uint8Array(32) }`
  - `mlkem768_decaps(dk, ct) → Uint8Array(32)`
  - `mldsa65_keygen() → { pk: Uint8Array(1952), sk: Uint8Array(32) }` (sk = seed ξ, ruling 3)
  - `mldsa65_sign(sk, msg) → Uint8Array(3309)` (hedged, empty context, FIPS 204 Algorithm 2)
  - `mldsa65_verify(pk, msg, sig) → bool`
  - `blake3_derive_key(context: &str, ikm) → Uint8Array(32)`
  - `argon2id_derive_key(passphrase: &[u8], salt: &[u8]) → Uint8Array(32)` with the ruling 5 parameters hard-coded
  - `aether_seal_params() → { mlkem: 'ML-KEM-768', mldsa: 'ML-DSA-65', mldsa_crate: '0.1.0-rc.7', mlkem_crate: '0.2.3', argon2: { m_kib: 65536, t: 3, p: 4 } }`. Labels read this; they never hard-code it.

- [ ] **Step 1: Write the Rust unit tests:** round trips (encaps→decaps gives equal ss; sign→verify true; one flipped bit in the message or signature gives false); wrong-length input → `Err` (not a panic) for every byte argument; `blake3_derive_key` equals `blake3::derive_key` for a fixed input; `argon2id_derive_key` equals the `argon2` crate with the same params on a fixed input (a self-consistency check that pins the parameters, not a KAT; the RFC 9106 §5.3 vector uses secret/ad, which this export doesn't take).
- [ ] **Step 2: Run** `cargo test aether_seal`. Expected: fails (module missing).
- [ ] **Step 3: Implement** `aether_seal.rs`: `OsRng` via the existing `getrandom/js`; `Zeroizing<…>` for dk, ss, the seed, derived keys and the passphrase copy; build return objects with `js_sys::Object` + `Reflect::set`. Under `cfg(not(target_arch = "wasm32"))` the testable inner functions return plain structs.
- [ ] **Step 4: Run** `cargo test` (all, including `fips_kat`). Expected: pass.
- [ ] **Step 5: Rebuild:** `npm run rust:import`. Expected: wasm-pack succeeds, and `src/wasm/scale94_kernels.d.ts` lists all nine exports.
- [ ] **Step 6: Write `tests/aetherSealWasm.test.js`** against the real binary through `loadWasmNode()`: the lengths in the Interfaces block; encaps/decaps agree; sign/verify round trip and a tamper gives false; `aether_seal_params()` deep-equals the block above; `argon2id_derive_key` time is logged (`console.info`) for the report.
- [ ] **Step 7: Run** `npx vitest run tests/aetherSealWasm.test.js tests/wasmRegistry.test.js`. Expected: pass. Report the Argon2id time.
- [ ] **Step 8: Commit** `feat(rust): ML-KEM-768 / ML-DSA-65 / BLAKE3 / Argon2id exports for the aether seal; WASM rebuilt`

### Task 3: `identityVault.js`

**Files:**
- Create: `src/terminal/lib/identityVault.js`
- Create: `src/terminal/lib/identityStore.idb.js` (the IndexedDB adapter: `get(key)`, `put(key, value)`, `delete(key)`, store `scale94_identity_v1`)
- Test: `src/terminal/lib/__tests__/identityVault.test.js`

**Interfaces:**
- Consumes: Task 2 exports (`mlkem768_keygen`, `mldsa65_keygen`, `argon2id_derive_key`, `aether_seal_params`).
- Produces:
  - `createIdentityVault({ wasm, subtle, getRandomValues, store, now }) → vault`. `store` is the adapter above or any object with that shape; `null` means volatile.
  - `vault.getOrCreateIdentity() → Promise<Identity>`; in-flight creation is deduped.
  - `vault.getIdentityIfExists() → Promise<Identity|null>` (never creates; used by boot reconcile)
  - `vault.unwrapSecrets(identity) → Promise<{ dk: Uint8Array, sk: Uint8Array }>`
  - `vault.exportBackup(passphrase) → Promise<Uint8Array>` (JSON bytes: `{ v:1, kdf:{alg:'Argon2id', m_kib, t, p, salt}, aead:'AES-256-GCM', nonce, ct }`; plaintext = `{ ek, dk, pk, sk, createdAt }`, binary fields base64)
  - `vault.importBackup(bytes, passphrase) → Promise<{ ok:true, identity } | { ok:false, reason:'bad-passphrase'|'malformed' }>`
  - `vault.rotate() → Promise<Identity>` (replaces the identity; the caller reconciles the spine)
  - `Identity = { ek, pk, fp: string, createdAt: number, volatile: boolean }`. The wrapped secrets stay inside the vault record.
  - `fingerprint(ek, pk, subtle) → Promise<string>` (ruling 4; exported pure-ish helper)
  - `VOLATILE_LABEL = 'VOLATILE IDENTITY — will not survive reload'`
- The record stores `wrapKey` as a non-extractable AES-256-GCM `CryptoKey` (`extractable: false`), `dk`/`sk` wrapped with AES-GCM under it, each with its own 96-bit nonce.

- [ ] **Step 1: Write the failing tests** (real WASM via `loadWasmNode`, Node `crypto.webcrypto.subtle`, an in-memory `store`):
  - `creates once, then returns the same fp`
  - `two concurrent getOrCreateIdentity calls produce one identity` (Review Focus 4)
  - `the stored record holds no raw dk or sk bytes` (scan every `Uint8Array` in the record for the unwrapped secrets; the wrapKey is a CryptoKey with `extractable === false`)
  - `backup → import into a fresh vault gives the same fp and working secrets` (decaps a ct made against the original ek)
  - `wrong passphrase → {ok:false, reason:'bad-passphrase'}; current identity unchanged` and `truncated bytes → 'malformed'` (Review Focus 3)
  - `rotate changes fp`
  - `store.get throws → volatile identity, volatile:true, still seals` (Review Focus 5)
  - `backup kdf params equal aether_seal_params().argon2`
- [ ] **Step 2: Run** `npx vitest run src/terminal/lib/__tests__/identityVault.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `identityVault.js` and `identityStore.idb.js` (thin promise wrapper over `indexedDB.open`; a failure to open → `null`, i.e. volatile).
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(crypto): identity vault — one ML-KEM-768 + ML-DSA-65 identity per visitor, wrapped at rest, Argon2id backups`

### Task 4: `accordSeal.js` and the chaos salt

**Files:**
- Create: `src/terminal/lib/accordSeal.js`
- Create: `src/terminal/lib/canonicalJson.js` (pure: sorted keys, no whitespace, rejects non-finite numbers)
- Modify: `src/terminal/scent/baseAccord.js` (add `drawChaosSalt(getRandomValues) → Uint8Array(32)`; it stays pure because the RNG is injected)
- Test: `src/terminal/lib/__tests__/accordSeal.test.js`, `src/terminal/lib/__tests__/canonicalJson.test.js`, `src/terminal/scent/__tests__/baseAccord.test.js` (extend)

**Interfaces:**
- Consumes: `vault.getOrCreateIdentity`, `vault.unwrapSecrets`, Task 2's `mlkem768_encaps/decaps`, `blake3_derive_key`.
- Produces:
  - `KDF_CONTEXT = 'scale94 scent accord seal v1'`
  - `sealAccord({ baseAccord, salt }, identity, { wasm, subtle, getRandomValues }) → Promise<Envelope>`
  - `unsealAccord(envelope, identity|null, { wasm, subtle, unwrapSecrets }) → Promise<UnsealResult>`
  - `UnsealResult = { state:'ok', baseAccord, salt } | { state:'orphaned' } | { state:'tampered' } | { state:'malformed' } | { state:'no-webcrypto' }`
  - `Envelope` exactly as in Global Constraints; `aad = utf8("v1|" + fp)`
  - `envelopeSizes(envelope) → { ct: 1088, aead: n }` (bytes decoded, for P3's header line)

- [ ] **Step 1: Write the failing tests:**
  - canonical JSON: key order doesn't change the output; `NaN`/`Infinity` throw; it round trips the fixture base accord.
  - `drawChaosSalt` returns 32 bytes from the injected RNG.
  - `seal → unseal gives the same baseAccord and salt`
  - `two seals of the same accord differ in ct, nonce and aead_ct`
  - `envelope has exactly the spec's eight fields, with the exact string values`
  - `flipping one byte in ct / nonce / aead_ct → tampered`, and `changing fp → tampered` (AAD) (Review Focus 1)
  - `identity null → orphaned`; `identity.fp !== envelope.fp → orphaned`
  - `garbage base64 or a missing field → malformed`; `subtle undefined → no-webcrypto`
  - `unseal never rejects` (`expect(...).resolves` across every bad input above)
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** `ss` and `k` are imported as a raw AES-GCM key and never kept; the `dk` from `unwrapSecrets` is zeroed (`fill(0)`) after decaps.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit** `feat(scent): accord seal — ML-KEM-768 → BLAKE3 derive_key → AES-256-GCM envelope; fresh 32-byte chaos salt`

### Task 5: The fourth vertebra

**Files:**
- Modify: `src/terminal/quintessence/spineStore.js` (`scent` field; `setScent`; `reconcileScent`; the fourth missing line)
- Modify: `src/terminal/quintessence/vertebrae.js` (fourth entry)
- Modify the readers: `src/terminal/components/resolveEyeState.js`, `src/terminal/mercury/SpineMirror.jsx`, `src/terminal/quintessence/observerStore.js`, `src/terminal/mercury/QuintessenceAltar.jsx`, `src/terminal/quintessence/ReliquaryView.jsx`, `src/terminal/views/KernelTab.jsx` (its own list at :95–99 gains `scent`, five entries; the comment at :100 is updated)
- Note: `KernelTab.jsx:101` arms the altar on `missingVertebrae().length === 0`, so from this task on the altar needs a sealed accord to ignite. That's the spec's "required fourth mark". P3 is what makes ignite read it.
- Test: `spineStore.test.js`, `vertebrae.test.js`, plus each reader's existing test file (extend; create one only where none exists)

**Interfaces:**
- Produces:
  - `setScent({ envelope, cardName, sealedAt, fp })`: throws unless `envelope.v === 1 && envelope.kem === 'ML-KEM-768'` and `fp === envelope.fp`
  - `reconcileScent(currentFp: string|null)`: sets `scent.orphaned = true` on a mismatch or `null`, clears it on a match, no-op without a scent
  - `missingVertebrae()` → fourth entry `'NO ACCORD SEALED'`, or `'SEAL ORPHANED — the key evaporated'` when `scent.orphaned`
  - `isScentMarked(spine) → boolean` (`!!spine.scent?.envelope && !spine.scent.orphaned`), exported from `vertebrae.js`; every reader uses it instead of `!!spine.scent`

- [ ] **Step 1: Write the failing tests:** `emptySpine` has `scent: null`; `missingVertebrae()` on an empty spine has length 4 with `'NO ACCORD SEALED'` last; `setScent` rejects a non-envelope (Global Constraints: an unsealed card never fills the mark); `reconcileScent(null)` on a sealed spine → orphaned line, `isScentMarked` false (Review Focus 2); `reconcileScent(sameFp)` clears it; `VERTEBRAE[3]` deep-equals the Global Constraints values; `VERTEBRAE` order matches `missingVertebrae()` order; one test per reader asserting it shows four (KernelTab: five) marks.
- [ ] **Step 2: Run** `npx vitest run src/terminal/quintessence src/terminal/components src/terminal/mercury src/terminal/views`. Expected: the new tests fail.
- [ ] **Step 3: Implement** the store, the vertebra and every reader. Find any reader the spec missed with `rg -n "VERTEBRAE|missingVertebrae|spine\.(trend|council|phase)" src`; each hit is either updated or listed in the report as order-independent.
- [ ] **Step 4: Run** the full `npm test`. Expected: PASS, with no snapshot written.
- [ ] **Step 5: Commit** `feat(spine): /SCENT becomes the fourth vertebra; orphaned seals named, never marked`

### Task 6: Crystallize seals

**Files:**
- Create: `src/terminal/lib/sealAccordForSpine.js` (the host bridge: builds the base accord, draws the salt, gets or creates the identity, seals, `setScent`)
- Create: `src/terminal/lib/aetherRuntime.js` (lazily builds the one shared vault from `loadWasm()`, `globalThis.crypto`, `identityStore.idb.js`; exports `getVault()`, and `reconcileSpineAtBoot()`, which calls `reconcileScent(fp|null)`)
- Modify: `src/terminal/views/LatentCollider.jsx` (`handleCrystallize`; badge at :2617; event kind; `cipher_sealed`)
- Modify: `src/terminal/App.jsx` (call `reconcileSpineAtBoot()` once after mount; failures are logged, never thrown)
- Modify: `src/terminal/collider/manifest.js` (ruling 8 line)
- Test: `src/terminal/lib/__tests__/sealAccordForSpine.test.js`; extend `src/terminal/collider/__tests__/honesty.test.js` and the manifest parity file

**Interfaces:**
- Consumes: `buildBaseAccord`, `drawChaosSalt`, the note mapping and the kit (P1), `sealAccord` (Task 4), `setScent` (Task 5).
- Produces: `sealAccordForSpine(card, result, deps) → Promise<{ state:'sealed', fp, sizes } | { state:'unsealed', reason:'no-webcrypto'|'wasm-unavailable'|'error' }>`. It never throws.

- [ ] **Step 1: Write the failing tests:** sealed → `getSpine().scent.envelope` unseals (via `unsealAccord`) to the same base accord; `subtle` missing → `unsealed/no-webcrypto` and the spine scent is untouched; `loadWasm` rejects → `unsealed/wasm-unavailable`. Honesty test: the badge source contains `SEALED · ` and `UNSEALED — this origin has no WebCrypto`, and no longer contains a bare `>UNSEALED<` (replacing the P1 assertion at `honesty.test.js:190`); `kind: 'accord_sealed'` is present and `'order_placed'` is gone; `cipher_sealed` is emitted and the `TODO(phase-b)` line is gone.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** In `handleCrystallize`, the seal runs after the card is set, so the card always shows; the badge state comes from the result; the existing Tesseract and sovereignty block is unchanged.
- [ ] **Step 4: Snapshot:** `npx vitest run -u src/terminal/collider/__tests__/manifest.parity.test.js` only. Allowed change: the single `SEAL` line from ruling 8. Paste the `.snap` diff in the report.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(scent): crystallize seals the base accord under the visitor's identity; accord_sealed + cipher_sealed`

### Task 7: `/CRYPTOGRAPHY` identity panel

**Files:**
- Create: `src/terminal/views/cryptography/IdentityPanel.jsx`
- Modify: `src/terminal/views/ClassifiedTab.jsx` (mount the panel; replace `parseKeysFromLog` at :681–700 and its `run_classified(1)` call with `mlkem768_keygen()`; key byte labels at :26–27 read from the returned lengths)
- Test: `src/terminal/views/__tests__/IdentityPanel.test.jsx`, plus extend the ClassifiedTab test if one exists

**Interfaces:**
- Consumes: `getVault()`, `reconcileSpineAtBoot()` (Task 6), `VOLATILE_LABEL` (Task 3), `aether_seal_params()` (Task 2).
- Produces the UI: fingerprint (`FP · SHA-256(ek‖pk)[0..16]`); `BACKUP` (passphrase field, at least 12 characters, downloads `scale94-identity-<fp8>.json`, label = ruling 5 text built from `aether_seal_params()`); `RESTORE` (file + passphrase, then reconcile); `ROTATE` (two-step confirm whose warning reads `Rotating orphans the sealed accord. SEAL ORPHANED — the key evaporated.`, then reconcile); `VOLATILE_LABEL` shown when `identity.volatile`.

- [ ] **Step 1: Write the failing tests** (Testing Library, a vault stub that records calls): fp renders in 8 groups; a backup under 12 characters is disabled; a restore with `reason:'bad-passphrase'` shows `WRONG PASSPHRASE — identity unchanged`; rotate needs two clicks and then calls `reconcileSpineAtBoot`; the volatile label renders; `ClassifiedTab.jsx` source no longer contains `ENCAPSULATION KEY (PUBLIC)` parsing.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Colour follows the tab's orange; no white at rest (spec §2 anti-goal).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cryptography): identity panel — fingerprint, Argon2id backup, restore, rotate; keygen via mlkem768_keygen`

### Task 8: M4 closure, docs and the milestone gate

**Files:**
- Modify: `CHANGELOG.md` (one entry), `docs/ARCHITECTURE.md` (crypto exports, identity vault, fourth vertebra)
- Modify: `.superpowers/security-audit-report.md` (git-ignored): M4 → closed (scent-aether P2), with the commit range

- [ ] **Step 1: Gate:** `cargo test` (in `content/rust_kernels`), `npm test`, `npm run lint`, `npm run build`. Expected: all pass. Report test counts and the lint warning count.
- [ ] **Step 2: Browser check** (preview server, `/SCENT` → crystallize): the badge reads `SEALED · ML-KEM-768 · FP …`; the spine shows four marks with scent filled; clear IndexedDB only, reload → the orphaned line; `/CRYPTOGRAPHY` backup → rotate → restore brings back the original fp and clears the orphan. Screenshot each state.
- [ ] **Step 3: Write the docs.**
- [ ] **Step 4: Commit** `docs(scent): P2 changelog and architecture; M4 closed`
