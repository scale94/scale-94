---
id: TESSERACT-VAULT-1.0
type: "kernel_doc"
date: "2026-03-13"
status: "LIVE"
title: "TESSERACT-VAULT 1.0 // HYBRID POST-QUANTUM CRYPTOGRAPHIC PIPELINE"
---

## Commands

```
run tesseract                         — standard run (truncated key output)
run tesseract --verbose 1             — full 32-byte hex for all key material
run vault                             — alias
run blake3                            — alias
run argon2                            — alias
run pqc_pipeline                      — alias
run tesseract --verbose 1             — full master_key + shared_secret + BLAKE3 hash
```

---

## Attribution

Architecture ported from **[Tesseract-Vault](https://github.com/dollspace-gay/Tesseract-Vault)** by **dollspace-gay**.

Tesseract-Vault is a production-grade Rust encryption suite: ML-KEM-1024, ML-DSA-87, AES-256-GCM, Argon2id, BLAKE3, guard pages, secure allocators, FUSE/WinFsp encrypted volumes, and TPM 2.0 integration. The repo was kindly provided and the cryptographic core has been adapted here as a WASM kernel — the pipeline runs entirely in the browser sandbox. OS-level features (FUSE, TPM, mlock, YubiKey, daemon IPC, hidden volumes) require native syscalls and are not portable to WASM.

---

## Overview

`TESSERACT-VAULT-1.0` is a 5-stage hybrid post-quantum cryptographic pipeline compiled to WASM. It executes the full cryptographic core of the Tesseract-Vault architecture:

| Stage | Algorithm | Standard | Purpose |
| :---- | :-------- | :------- | :------ |
| 1 | Argon2id KDF | RFC 9106 | Password → 256-bit master key |
| 2 | ML-KEM-1024 | FIPS 203 | Key encapsulation (NIST Cat-5) |
| 3 | ML-DSA-87 | FIPS 204 | Post-quantum signatures |
| 4 | AES-256-GCM | NIST AEAD | Authenticated encryption |
| 5 | BLAKE3 | — | Integrity binding across all stages |
| Z | Zeroize | — | compiler_fence(SeqCst) — ephemeral wipe |

---

## Stage 1 — Argon2id Key Derivation (RFC 9106)

Argon2id is the NIST/IETF-recommended password-hashing function. It is a hybrid of Argon2i (data-independent, side-channel resistant) and Argon2d (data-dependent, GPU-hard). The `id` variant runs Argon2i for the first half of memory passes and Argon2d for the second — making it resistant to both side-channel attacks and brute-force GPU attacks.

Demo parameters: `m=64 KiB, t=1, p=1` — these are intentionally weak for browser-safe execution. Production deployments use `m≥64MB, t≥3`.

Output: a 256-bit `master_key` that feeds directly into Stage 4 (AES-256-GCM).

---

## Stage 2 — ML-KEM-1024 (FIPS 203, NIST Category 5)

ML-KEM-1024 (formerly CRYSTALS-Kyber) is NIST's standardised post-quantum Key Encapsulation Mechanism. Security is based on the **Module Learning With Errors (MLWE)** problem: given a matrix `A·s + e = t (mod q=3329, k=4)`, recovering `s` is computationally infeasible for both classical and quantum adversaries.

| Parameter | Size |
| :-------- | ---: |
| Encapsulation key (public) | 1568 bytes |
| Decapsulation key (private) | 3168 bytes |
| Ciphertext | 1568 bytes |
| Shared secret | 32 bytes |

The kernel performs a full encapsulation/decapsulation round-trip, verifying that `encap(dk, ek)` and `decap(dk, ct)` produce identical shared secrets.

---

## Stage 3 — ML-DSA-87 (FIPS 204, NIST Category 5)

ML-DSA-87 (formerly CRYSTALS-Dilithium) is NIST's post-quantum digital signature standard. Security is based on **Module-SIS hardness** with Fiat-Shamir with Aborts. The kernel signs the KEM ciphertext from Stage 2 — attesting that the encapsulation is authentic.

| Parameter | Size |
| :-------- | ---: |
| Verifying key | 2592 bytes |
| Signing key | 4032 bytes |
| Signature | 4627 bytes |

The signature is verified inline: `VERIFY: PASS ✓` confirms the post-quantum signature round-trip.

---

## Stage 4 — AES-256-GCM Authenticated Encryption

AES-256-GCM is an AEAD (Authenticated Encryption with Associated Data) scheme. The master key from Stage 1 (Argon2id) is used as the AES key — this binds the KDF output directly to the symmetric encryption layer. The 128-bit GCM authentication tag provides integrity verification; any ciphertext modification causes decryption to fail.

---

## Stage 5 — BLAKE3 Integrity Binding

BLAKE3 hashes the concatenation of: `master_key ‖ ek[:32] ‖ ct[:32] ‖ gcm_ciphertext`. This binds all pipeline stages into a single integrity hash — any modification to any stage's output changes the BLAKE3 digest, detectable by the recipient.

---

## Zeroize Layer

After pipeline completion, `master_key` and `dsa_seed` are explicitly zeroed using the `zeroize` crate. A `compiler_fence(SeqCst)` ensures the wipe is not elided by LLVM optimisations. WASM linear memory residue is cleared to 0 bytes — the same pattern used by the Tesseract-Vault production stack for guard pages and secure allocators.

---

## Why Post-Quantum

Classical key exchange (ECDH/RSA) is broken by Shor's algorithm running on a sufficiently large quantum computer. NIST's post-quantum standards (FIPS 203, 204) were finalised in 2024 after a multi-year competition. ML-KEM and ML-DSA are both Category 5 — meaning breaking them requires more than `2^256` quantum operations — the highest security level in the NIST taxonomy.

This kernel is a demonstration of the full hybrid stack: classical password hardening (Argon2id) + post-quantum KEM (ML-KEM-1024) + post-quantum signatures (ML-DSA-87) + authenticated symmetric encryption (AES-256-GCM) + integrity hash (BLAKE3). The combination is hardened against both present-day adversaries and future quantum threats.

---

*Architecture: [github.com/dollspace-gay/Tesseract-Vault](https://github.com/dollspace-gay/Tesseract-Vault) · Credit: dollspace-gay · WASM port: Scale 9.4 · FIPS 203 · FIPS 204 · RFC 9106*
