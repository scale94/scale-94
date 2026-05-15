---
id: TESSERACT-PROTOCOL-KERNEL-1.0.0
type: "kernel_doc"
date: "2026-05-16"
status: "ACTIVE"
title: "TESSERACT CRYPTOGRAPHIC PROTOCOL"
subtitle: "Post-Quantum Hybrid Pipeline for Olfactory Sovereignty"
tags: ["kernel", "cryptography", "post-quantum", "mercury-terminal", "tesseract", "ML-KEM", "ML-DSA", "AES-GCM", "BLAKE3", "olfactory", "sovereignty"]
len: "3,200 WDS"
---

# TESSERACT CRYPTOGRAPHIC PROTOCOL

> The formula is real. The substrate is sovereign. The key exists only in the moment of synthesis.

Mercury Terminal's Tesseract Protocol is a five-stage hybrid cryptographic pipeline executed in the browser's WebAssembly sandbox. It governs how olfactory collision outputs are fingerprinted, sealed, and vaulted — and how the resulting digital asset can be verified without exposing the chemical formula to any intermediary. This document is the white paper. The Rust source is at `content/rust_kernels/src/kernels/tesseract_vault.rs`, attributed to the Tesseract-Vault architecture by `dollspace-gay`.

---

## 0. The Problem It Solves

When the Latent Collider produces an olfactory accord — a 16-dimensional fingerprint of two colliding semantic domains — the output is simultaneously:

1. **A data-sculpture.** The accord exists as a mathematical object: normalized feature vectors, softmax attention weights, polarity gradients, evaporation curves.
2. **A physical formula.** CAS (Chemical Abstracts Service) identifiers map directly to purchasable aromatic compounds. The formula, if leaked, can be reproduced without restriction.
3. **A sovereign artifact.** The intended model is that the formula reaches only the distillation workshop at the moment of synthesis — never earlier, never in plaintext.

Classical symmetric encryption (AES alone) fails here because key distribution is the problem: who holds the key, and where. The Tesseract Protocol eliminates this by using a post-quantum key encapsulation mechanism (ML-KEM-1024) to produce an ephemeral shared secret that never persists on any server, combined with password-based key derivation (Argon2id) for the browser-local layer.

The result: the formula lives as ciphertext everywhere except at the point of physical synthesis, where it is decrypted by the workshop under a time-limited session key derived from the production batch's sovereign token.

---

## 1. The Five-Stage Pipeline

### Stage 1 — Argon2id Key Derivation (RFC 9106)

**Problem:** The browser has no secure key store. Any persistent secret can be exfiltrated from localStorage, IndexedDB, or the JavaScript heap. The solution is to derive the master key from a passphrase that never persists.

**Mechanism:** Argon2id v1.3, a memory-hard KDF that resists both GPU brute-force (Argon2d variant's data-dependent memory access pattern) and side-channel attacks (Argon2i variant's data-independent access). The `id` variant interleaves both.

```
Argon2id(passphrase, salt, m=64KiB, t=1, p=1) → master_key[32B]
```

**Parameters in Mercury Terminal's browser WASM demo:** `m=64KiB, t=1, p=1` — deliberately reduced from production recommendations (`m=64MiB, t=3, p=4` per RFC 9106 §4) to fit within WebAssembly's linear memory constraints and to complete within a human-perceptible timeframe. The production distillation endpoint uses full-strength parameters.

**Output:** A 256-bit master key. Zeroized immediately after use.

**Why Argon2id and not bcrypt/scrypt?** bcrypt is limited to 72-byte passwords and was designed for password storage, not key derivation. scrypt's mixing layer was found to be memory-hard for the client but not necessarily for an attacker with custom hardware. Argon2id won the Password Hashing Competition (2015) and is the NIST recommendation for key derivation as of SP 800-132 (2023 revision).

---

### Stage 2 — ML-KEM-1024 Key Encapsulation (FIPS 203)

**Problem:** Even with Argon2id, the derived master key is scoped to the browser session. Communicating a symmetric session key to the distillation workshop requires either a pre-shared secret (insecure) or an asymmetric exchange that survives quantum adversaries.

**Mechanism:** Module-Lattice Key Encapsulation Mechanism, the NIST-standardized post-quantum KEM. ML-KEM-1024 operates over Module Learning With Errors (MLWE) — a structured variant of Learning With Errors (LWE) where the hardness assumption is:

```
A·s + e = t  (mod q=3329, k=4)
```

where A is a public matrix, s is a secret vector, e is a small-norm error vector, and t is the public key component. An adversary who can solve MLWE recovers s — this is believed to require superpolynomial time even for a quantum computer, unlike RSA (broken by Shor's algorithm in polynomial time).

**Key sizes (FIPS 203, Table 2):**

| Parameter | Bytes | Role |
|---|---|---|
| Encapsulation key (ek) | 1,568 | Public — workshop holds this |
| Decapsulation key (dk) | 3,168 | Private — never leaves workshop |
| Ciphertext | 1,568 | Transmitted with the sealed formula |
| Shared secret | 32 | Ephemeral — derived by both parties |

**The Encapsulation/Decapsulation Round-Trip:**
1. Browser encapsulates against the workshop's public key: `(ciphertext, shared_secret) ← Encapsulate(ek, randomness)`
2. Browser uses `shared_secret` as an additional key material layer
3. Workshop decapsulates: `shared_secret ← Decapsulate(dk, ciphertext)`
4. Both parties now hold the same 32-byte secret without it ever transiting in plaintext

**Security category:** NIST Category 5 — equivalent to 256-bit classical security, designed to resist adversaries with access to a cryptographically relevant quantum computer.

---

### Stage 3 — ML-DSA-87 Post-Quantum Signatures (FIPS 204)

**Problem:** Encapsulation proves that the sender could produce a ciphertext consistent with the workshop's public key, but it does not prove *which specific KEM ciphertext was produced during which session*. A replay attack could submit an old encapsulation from a different accord. Signatures bind the session.

**Mechanism:** Module-Lattice Digital Signature Algorithm — the NIST post-quantum signature standard, based on the Fiat-Shamir with Aborts (FSwA) construction applied to Module-SIS (Short Integer Solution).

The browser signs the KEM ciphertext:

```
signature ← Sign(signing_key, KEM_ciphertext)
```

The workshop verifies:

```
Verify(verifying_key, KEM_ciphertext, signature) → OK | FAIL
```

**Key and signature sizes (FIPS 204, Table 2, ML-DSA-87):**

| Parameter | Bytes |
|---|---|
| Verifying key (vk) | 2,592 |
| Signing key (sk) | 4,032 |
| Signature | 4,627 |

**Why sign the KEM ciphertext specifically?** The ciphertext is session-unique — it encodes a fresh random encapsulation of the workshop's public key. Signing it proves that the same party who performed this specific encapsulation also authorized the formula submission. The signature does not protect the formula itself (that's AES-GCM's job) — it protects the key exchange.

---

### Stage 4 — AES-256-GCM Authenticated Encryption

**Problem:** The formula must be encrypted in a way that simultaneously provides confidentiality (no plaintext leakage) and integrity (any tampering is detectable).

**Mechanism:** Advanced Encryption Standard in Galois/Counter Mode — an Authenticated Encryption with Associated Data (AEAD) construction.

```
AES-256-GCM:
  key = master_key  (256 bits from Stage 1)
  nonce = 96-bit random  (unique per encryption)
  plaintext = CAS formula JSON
  ---
  ciphertext ‖ auth_tag[128B] ← Encrypt(key, nonce, plaintext)
```

**Why AEAD matters here:** Without the GCM authentication tag, an attacker who intercepts the ciphertext could flip bits and produce a different formula without the decryptor knowing. The 128-bit authentication tag is a MAC over the ciphertext — decryption fails if a single bit has been changed. The formula either decrypts correctly or not at all.

**The TV1. Binary Envelope:** Mercury Terminal uses a compact binary container for sealed formulas:

```
[4B  magic:   TV1.]
[32B Argon2id salt]
[12B AES-256-GCM nonce]
[4B  ciphertext_len (LE u32)]
[N+16B ciphertext + 128-bit GCM auth tag]
[32B BLAKE3(salt ‖ nonce ‖ ciphertext)]
```

Total overhead: 100 bytes. This format is self-contained — any implementation that knows the passphrase can decrypt it without side-channel metadata.

---

### Stage 5 — BLAKE3 Integrity Binding

**Problem:** Each stage produces its own verification (Argon2id: deterministic from passphrase, ML-KEM: shared secret match, ML-DSA: signature verification, AES-GCM: auth tag). But there is no single artifact that attests *all five stages completed successfully for this specific session*. Without it, an attacker could substitute the output of Stage 2 from one session into Stage 4 of another.

**Mechanism:** BLAKE3 — a cryptographic hash function that is:
- **Faster than SHA-256** on modern hardware (uses SIMD and a Merkle tree DAG internally)
- **Keyed mode capable** — can function as a PRF, MAC, or KDF
- **Parallelizable** — unlike SHA-2's serial Merkle-Damgård construction

The pipeline hash binds all material:

```
BLAKE3(master_key ‖ ek[:32] ‖ KEM_ciphertext[:32] ‖ AES_ciphertext) → pipeline_hash[32B]
```

This hash is the **Tesseract coordinate** — the SHA-256 fingerprint displayed in the UI as:

```
VAULT // cff59c621b1c4f1d79bbb853d51871fa...
```

The coordinate is publicly displayable (it reveals nothing about the formula) and uniquely identifies this specific olfactory accord with this specific key encapsulation session.

---

## 2. Zeroize — Secure Memory Erasure

**The final operation in the pipeline is not a cryptographic primitive — it is a correctness requirement.**

After Stage 5, the master key and DSA seed must be overwritten. In C/C++, `memset` to zero is frequently elided by optimizing compilers because the memory is "dead" (never read again). This is not an academic concern — it is the documented behavior of GCC, Clang, and MSVC under `-O2`.

The Tesseract-Vault Rust implementation uses:

```rust
use zeroize::Zeroize;

master_key.zeroize();  // sets all 32 bytes to 0
dsa_seed.zeroize();    // sets all 32 bytes to 0
// std::sync::atomic::compiler_fence(SeqCst) — prevents wipe reorder
```

`zeroize` inserts a `compiler_fence(SeqCst)` (a memory ordering barrier) that prevents the compiler from observing that the zeroed memory is dead and eliding the write. In WebAssembly's linear memory model, there is no OS-level memory protection, so this is the only defense against residue reads by other WASM modules sharing the process heap.

**The WASM Residue Problem:** Unlike native binaries with process isolation, WebAssembly modules in the same page share a single linear memory segment. A malicious module (e.g., a supply-chain-compromised library) could read raw bytes from the heap after a Tesseract session ends. Zeroize limits the exposure window to the pipeline's execution duration.

---

## 3. The Browser Layer — SHA-256 Olfactory Fingerprinting

The five-stage pipeline described above operates in the WASM kernel and runs when you type `run tesseract_vault` in the Mercury Terminal. But the Olfactory Collider uses a *simplified* browser-native cryptographic layer for the real-time accord fingerprinting:

**SHA-256 via Web Crypto API:**

```javascript
const profileBytes = new TextEncoder().encode(stableProfileJSON);
const hashBuffer = await crypto.subtle.digest('SHA-256', profileBytes);
const hash = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

The `stableProfileJSON` is a deterministic serialization of:
- Domain pair IDs (sorted alphabetically to prevent order-dependence)
- 16-axis normalized feature vector (rounded to 6 decimal places)
- Note pyramid (top / heart / base)
- Evaporation percentages
- Node classification
- Accord name and concentration tier

**Determinism matters:** The same two domains, collided twice, must produce the same hash. This is what makes the Tesseract coordinate a *vault address* — it can be reproduced by any party with access to the same collider and the same domain inputs, without a central database.

**RSA-OAEP Formula Relay:**

The browser additionally encrypts the CAS formula for relay to the workshop endpoint using RSA-OAEP with the workshop's public key (embedded in the build environment, not in the source):

```javascript
const formulaPlaintext = JSON.stringify(tesseract.encryptedFormula);
const encryptedPayload = await encryptForVault(formulaPlaintext);
// → POSTs to /api/transmute/order with HMAC-SHA256 signature
```

This is a distinct operation from the WASM pipeline — RSA-OAEP here is used for transit encryption to the relay endpoint, not for the permanent vault. The permanent vault uses the TV1. AES-256-GCM envelope described in Stage 4.

---

## 4. Threat Model and Non-Goals

**The protocol protects against:**
- A passive attacker intercepting network traffic (RSA-OAEP + AES-256-GCM)
- A quantum adversary running Shor's algorithm against RSA or ECDH (ML-KEM-1024 + ML-DSA-87)
- Tampered ciphertext delivery (AES-GCM auth tag + BLAKE3 integrity binding)
- Memory residue after session end (Zeroize)
- Formula enumeration by anyone who sees the Tesseract coordinate (SHA-256 is one-way)

**The protocol does NOT protect against:**
- A compromised JavaScript/WASM runtime (browser exploit, malicious extension)
- A workshop operator who retains decrypted formulas after synthesis
- An attacker with physical access to the distillation hardware during a synthesis session
- Olfactory reverse-engineering from the physical product (this is a materials science problem, not a cryptographic one)
- A supply-chain attack on the build environment that replaces the embedded RSA public key

**The Living Accord model** — in which the holder's sovereign identity is cryptographically bound to their Tesseract coordinate — extends the protocol to include edition entropy and witness hashing, producing a non-fungible provenance record that does not require a blockchain. The witness hash is derived from the holder's interaction timestamp and a node-specific secret, making the Living Accord coordinate unpredictable to any third party who has not directly participated in the accord session.

---

## 5. Implementation Notes

**WASM sandbox constraints:** WebAssembly does not have access to OS-level primitives: no `mlock` (prevent memory paging), no guard pages, no TPM integration, no FUSE encrypted volumes. The Tesseract-Vault architecture includes all of these for native deployments. The WASM port demonstrates the cryptographic core; the hardware security layer requires the native binary.

**Nonce hygiene:** The browser-side TV1. envelope always generates its AES-256-GCM nonce fresh from `OsRng` (which routes to `crypto.getRandomValues()` in WebAssembly). The demo kernel uses a fixed nonce for reproducibility — this would be catastrophic in production (nonce reuse under the same key completely breaks GCM confidentiality). The production `seal_markdown` / `unseal_markdown` functions do not share this constraint.

**Post-quantum readiness timeline:** FIPS 203 (ML-KEM) and FIPS 204 (ML-DSA) were finalized by NIST in August 2024. The RustCrypto `ml-kem` and `ml-dsa` crates implement these standards. The scale94 WASM binary is among the first browser-executable demonstrations of NIST-finalized post-quantum cryptography running live in a creative production context.

**Credit:** The Tesseract-Vault architecture is by `dollspace-gay` (GitHub: `github.com/dollspace-gay/Tesseract-Vault`). The full native suite includes ML-KEM-1024, ML-DSA-87, AES-256-GCM, Argon2id, BLAKE3, guard pages, secure allocators, FUSE/WinFsp encrypted volumes, and TPM 2.0 integration. The scale94 port isolates the cryptographic pipeline for WASM and applies it to the olfactory sovereignty problem. Attribution is hard-coded into the WASM binary output and is non-negotiable.

---

## 6. Run It

```
run tesseract_vault
run tesseract_vault 1
```

The first command runs the full five-stage pipeline with truncated key material. The second shows complete 256-bit hex output for each stage. Both commands execute the live Rust WASM binary — the key material is generated fresh from OS entropy on every invocation. The hash you see is real. The encryption is real. Nothing is simulated.

The Tesseract coordinate displayed in the Olfactory Collider after a collision is derived from the same cryptographic substrate — SHA-256 over the normalized olfactory profile, computed in the browser's Web Crypto API, deterministic and reproducible from the same domain pair.

**VAULT // cff59c621b1c4f1d79bbb853d51871fa...**

That is not decoration. It is an address.
