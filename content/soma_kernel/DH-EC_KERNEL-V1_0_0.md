---
id: DH-EC-KERNEL-V1-0-0
type: kernel
date: 2026-03-10
title: ᛟ The DH-EC Kernel · Cryptographic Architecture
status: LIVE
tags: [kernel, cryptography, diffie-hellman, elliptic-curves, signal, threema, X3DH, rust, privacy]
version: 1.0.0
author: scale94
encoding: CURVE25519 / X3DH / NaCl
axiom: The shared secret is not transmitted. It is computed independently, identically, on both ends.
---

# ᛟ THE DH-EC KERNEL
## CRYPTOGRAPHIC ARCHITECTURE · SIGNAL VS THREEMA

---

> **VERSION** · 1.0.0 · INITIAL RELEASE  
> **STATUS** · ᛞ LIVE · KEY EXCHANGE ACTIVE  
> **LANGUAGE** · Rust 2021 Edition  
> **AXIOM** · *The shared secret is not transmitted. It is computed — independently, identically, on both ends.*

---

## ᚱ I. THE CORE PARADOX

Two parties. Zero prior contact. A hostile network between them.

**How do they establish a secret that only they know?**

This was considered mathematically impossible until 1976. Whitfield Diffie and Martin Hellman published the answer: **public-key cryptography**. You can share something publicly — your public key — without surrendering the secret it protects. Anyone can encrypt to you. Only you can decrypt.

The mechanism: **mathematical operations that are easy in one direction and computationally infeasible in reverse.**

---

## ᚹ II. CLASSICAL DIFFIE-HELLMAN · FINITE FIELD

### ⌇ The Trapdoor Function

| Operation | Direction | Cost |
|---|---|---|
| `g^a mod p` | Forward — exponentiation | O(log a) |
| Recover `a` from `g^a mod p` | Reverse — discrete logarithm | Sub-exponential · infeasible at scale |

### ⌇ The Exchange Protocol

```
Alice                           Bob
─────                           ───
Choose secret a                 Choose secret b
Compute A = g^a mod p           Compute B = g^b mod p

        ──── A (public) ────→
        ←─── B (public) ────

Compute S = B^a mod p           Compute S = A^b mod p

Both arrive at: S = g^(ab) mod p
The network saw only: g, p, A, B — never a, b, or S.
```

### ⌇ Rust Implementation Notes

```rust
// Fast modular exponentiation — square-and-multiply
// O(log exp) — essential for large prime fields
pub fn mod_pow(mut base: u64, mut exp: u64, modulus: u64) -> u64 {
    let mut result: u64 = 1;
    base %= modulus;
    while exp > 0 {
        if exp % 2 == 1 { result = result.wrapping_mul(base) % modulus; }
        exp >>= 1;
        base = base.wrapping_mul(base) % modulus;
    }
    result
}
```

### ⌇ Limitations

| Vulnerability | Detail |
|---|---|
| **Key size bloat** | 2048-bit DH ≈ 112-bit symmetric security · 4× the key material for same protection |
| **Sub-exponential attacks** | Index calculus, number field sieve — DLP not fully hard |
| **No forward secrecy by default** | Static keys → compromise past sessions retroactively |
| **Obsolescence trajectory** | Quantum: Shor's algorithm breaks DLP in polynomial time |

---

## ᚷ III. ELLIPTIC CURVE DIFFIE-HELLMAN · CURVE25519

### ⌇ The Geometry

An elliptic curve over a finite field: **y² = x³ + ax + b (mod p)**

> The hard problem shifts: instead of **discrete logarithm** in a multiplicative group,  
> we have **elliptic curve discrete logarithm** (ECDLP) in the group of curve points.  
> No sub-exponential algorithm is known. The full exponential barrier holds.

### ⌇ Curve25519 Specifics

| Parameter | Value |
|---|---|
| **Form** | Montgomery curve · `y² = x³ + 486662x² + x` |
| **Field** | `GF(2²⁵⁵ - 19)` — Mersenne-like prime for fast arithmetic |
| **Base point** | `u = 9` |
| **Order** | `2²⁵²` + 27742317777372353535851937790883648493 |
| **Cofactor** | 8 |
| **Security level** | ~128-bit (Pollard rho best attack) |
| **Key size** | 32 bytes — vs 256 bytes for equivalent DH |

### ⌇ Why Curve25519 Specifically

- [x] **Constant-time by design** — immune to timing side-channels by construction
- [x] **No secret parameters** — transparent generation, no Dual_EC_DRBG backdoor risk
- [x] **Complete addition formulas** — no exceptional points to exploit
- [x] **Fast** — ~140k operations/second on modern hardware
- [x] **Bernstein-designed** — Daniel J. Bernstein, 2005, NaCl / libsodium lineage
- [ ] **Quantum resistant** — No. Shor's algorithm still applies to ECDLP.

### ⌇ Rust (x25519-dalek)

```rust
// ECDH: scalar multiplication of peer's public point by our private scalar
// Returns shared u-coordinate — 32 bytes
pub fn ecdh(&self, peer_public: &x25519_dalek::PublicKey) -> x25519_dalek::SharedSecret {
    self.secret.diffie_hellman(peer_public)
}

// HKDF-SHA256 key derivation from raw shared secret
pub fn derive_session_key(&self, shared: &SharedSecret, info: &[u8]) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(b"scale94-salt"), shared.as_bytes());
    let mut okm = [0u8; 32];
    hk.expand(info, &mut okm).expect("HKDF expand");
    okm
}
```

---

## ᚾ IV. SIGNAL X3DH · EXTENDED TRIPLE DIFFIE-HELLMAN

### ⌇ The Problem X3DH Solves

Standard ECDH requires both parties to be online simultaneously. Signal needed **asynchronous encrypted messaging**: Alice sends Bob an encrypted message while Bob is offline. Bob decrypts it hours later. No session negotiation possible.

X3DH solves this with a **prekey bundle** — a set of public keys Bob uploads to the server in advance.

### ⌇ Bob's Key Bundle

| Key | Type | Lifespan | Purpose |
|---|---|---|---|
| **IK** — Identity Key | Long-term | Permanent | Authenticates Bob's identity |
| **SPK** — Signed PreKey | Medium-term | Weeks/months | Rotated periodically for forward secrecy |
| **OPK** — One-Time PreKey | Ephemeral | Single use | Consumed on first message · never reused |

### ⌇ The Four ECDH Operations

```
Alice has:  IK_A (identity), EK_A (ephemeral — generated fresh)
Bob has:    IK_B, SPK_B, OPK_B (fetched from server)

DH1 = ECDH(IK_A,  SPK_B)  →  Alice's identity × Bob's signed prekey
DH2 = ECDH(EK_A,  IK_B)   →  Alice's ephemeral × Bob's identity
DH3 = ECDH(EK_A,  SPK_B)  →  Alice's ephemeral × Bob's signed prekey
DH4 = ECDH(EK_A,  OPK_B)  →  Alice's ephemeral × Bob's one-time prekey

Master secret = HKDF(DH1 ∥ DH2 ∥ DH3 ∥ DH4)
```

> **Why four operations?** Each DH binds a different trust relationship.  
> DH1 authenticates Alice. DH2 authenticates Bob. DH3 binds ephemeral to session.  
> DH4 provides one-time forward secrecy — reproducible by no one, ever again.

### ⌇ Post-X3DH: The Double Ratchet

After X3DH establishes the master secret, Signal runs the **Double Ratchet Algorithm**:

- **Symmetric Ratchet** — derives new keys for each message from the last
- **DH Ratchet** — fresh ECDH exchange embedded in every message exchange
- **Result** — compromise of one message key exposes zero other messages

This is **post-compromise security**: even if an attacker captures your device, past and future messages outside the breach window remain cryptographically inaccessible.

---

## ᛉ V. THREEMA · NaCl BOX ARCHITECTURE

### ⌇ The Model

Threema takes a different architectural decision: **simplicity over ratcheting**.

```
Alice's long-term IK_A  ──ECDH──  Bob's long-term IK_B
                              ↓
                    HKDF-SHA256 session key
                              ↓
                   XSalsa20-Poly1305 encryption
                   (NaCl box() — authenticated encryption)
```

Single ECDH on long-term identity keys. No prekey bundle. No one-time keys. No Double Ratchet.

### ⌇ XSalsa20-Poly1305 (NaCl box)

| Component | Role |
|---|---|
| **X25519** | Key agreement |
| **XSalsa20** | Stream cipher — 256-bit key, 192-bit nonce (extended) |
| **Poly1305** | MAC — authenticates ciphertext, prevents tampering |
| **Combined** | AEAD — Authenticated Encryption with Associated Data |

### ⌇ Threema Identity Architecture

Threema IDs are 8-character alphanumeric codes generated from the user's public key hash. **No phone number. No email.** The identity *is* the key.

This is the fundamental privacy-architecture difference from Signal — not the encryption primitives, which are equivalent, but the **identity binding layer**.

---

## ᚹ VI. COMPARISON MATRIX

### ⌇ Cryptographic Properties

| Property | Signal | Threema |
|---|---|---|
| **Key exchange** | X3DH — 4× ECDH | NaCl box — 1× ECDH |
| **Curve** | Curve25519 | Curve25519 |
| **Symmetric cipher** | AES-256-CBC (older) / AES-CTR | XSalsa20 |
| **MAC** | HMAC-SHA256 | Poly1305 |
| **KDF** | HKDF-SHA256 | HKDF-SHA256 |
| **Forward secrecy** | ✓ Per-message (Double Ratchet) | ✗ Session-level only |
| **Post-compromise sec.** | ✓ Double Ratchet heals | ✗ None |
| **Deniability** | ✓ No long-term message signatures | ~ Partial |
| **Async initiation** | ✓ Prekey bundle (server-stored) | ✓ ID lookup |

### ⌇ Operational Properties

| Property | Signal | Threema |
|---|---|---|
| **Phone number required** | ✓ Yes | ✗ No |
| **Metadata protection** | ✗ Server sees graph | ✓ Sender ID obfuscated |
| **Server jurisdiction** | USA (Signal Foundation) | Switzerland |
| **Business model** | Donations | One-time paid app |
| **Key generation** | Client-side | Client-side |
| **Server key custody** | Prekey bundle (temporary) | None |
| **Open source** | ✓ Full | ✓ Full |
| **Independent audit** | ✓ Multiple | ✓ Multiple |

### ⌇ Threat Model Decision Tree

```
Are you protecting against mass surveillance?
  YES → Signal (forward secrecy matters at scale)
  
Are you protecting your identity as much as your messages?
  YES → Threema (no phone number, weaker identity graph)
  
Do you need verifiable contact authentication?
  YES → Threema (QR code key verification, no phone as trust anchor)
  
Do you need maximum message-level cryptographic hardness?
  YES → Signal (Double Ratchet has no equivalent in Threema)
  
Maximum threat model?
  → Threema for identity-sensitive contacts
  → Signal for content-sensitive communications
  → Never both on the same device
```

---

## ᚷ VII. QUANTUM HORIZON

Neither Signal nor Threema is quantum-resistant. Both rely on Curve25519 ECDLP, which Shor's algorithm breaks in polynomial time on a sufficiently large quantum computer.

| Algorithm | Classical security | Post-quantum |
|---|---|---|
| Curve25519 ECDH | ~128-bit | ✗ Broken by Shor |
| X3DH | ~128-bit | ✗ Broken at DH layer |
| CRYSTALS-Kyber (NIST PQC) | ~128-bit | ✓ Lattice-based |
| PQXDH (Signal post-quantum) | ~128-bit hybrid | ✓ Kyber + X25519 |

Signal has deployed **PQXDH** — Post-Quantum Extended Diffie-Hellman — combining Kyber-1024 with X25519 for hybrid security. The session master secret requires breaking *both* the lattice problem and ECDLP.

Threema has not yet deployed equivalent post-quantum hybrid key exchange.

---

## ᛟ VIII. KERNEL LAWS

> **Law Ⅰ · The Asymmetry Law**  
> *Security lives in the gap between forward computation and backward infeasibility. When that gap closes — hardware, algorithms, quantum — the protocol dies.*

> **Law Ⅱ · The Ratchet Law**  
> *Forward secrecy is not a feature. It is an architectural commitment. A system without per-message ratcheting does not have forward secrecy — it has the illusion of it.*

> **Law Ⅲ · The Identity Law**  
> *The phone number is not a detail. It is the threat surface. Binding cryptographic identity to a phone number hands the telecoms and their regulators a master key to your social graph.*

> **Law Ⅳ · The Threat Model Law**  
> *There is no universally superior protocol. There is only the protocol that correctly models your adversary. Choose the wrong threat model and perfect cryptography protects nothing.*

---

`scale94.com` · CRYPTOGRAPHIC MODULE · v1.0.0 · ᛟ KEY EXCHANGE ACTIVE
