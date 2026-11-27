# SOMA Kernel — v1.1.1

**Status:** ᛞ GOLD STABLE
**Deployment:** Live via Vercel
**Classification:** Browser-native post-quantum simulation OS

This release marks the successful integration of three major subsystems:

- Rust → WASM Post-Quantum Cryptography Bridge
- High-Fidelity WebGL Visualization Layer
- Explainable AI (XAI) Associative Tensor Engine

The system now operates as a self-documenting cryptographic simulation environment inside the browser sandbox.

---

## Layer 3.3.3 — Infrastructure & Post-Quantum Bridge

### Hardware Stabilization

Resolved repeated system crashes:

- `0x0000001e` — Access Violation

Root cause identified as Ryzen 5800X3D undervolt transient instability during heavy Number Theoretic Transform (NTT) workloads triggered by PQC computations.

**Resolution:** Restored stable voltage envelope. Verified system stability under sustained PQC load.

---

### FIPS 203 Implementation

Successfully compiled the ML-KEM-768 module to WebAssembly. The browser client now performs native post-quantum key generation.

```
Rust PQC module
    ↓
wasm-pack build
    ↓
WASM runtime in browser
```

---

### Binary Materialization

Verified entropy pool and payload generation via `OsRng`.

| Key Type | Size |
|---|---|
| Encapsulation Key (EK) | 1184 bytes |
| Decapsulation Key (DK) | 2400 bytes |

Full ML-KEM pipeline confirmed operational.

---

## Layer 4.4.4.4 — DOM Physics & Event Overrides

### Mobile Scroll Subjugation

Critical UX friction identified: React's `onTouchMove` failed to block native scrolling during entropy generation.

**Cause:** Modern mobile browsers default to passive event listeners, preventing `preventDefault()`.

**Resolution:** Bypassed React's synthetic event system entirely. Implemented:

```css
touch-action: none;
```

Reinforced with a native DOM listener:

```js
addEventListener("touchmove", handler, { passive: false })
```

**Effect:** Full scroll suppression, stable entropy capture surface, mobile interaction restored.

---

## Layer 5.5.5.5.5 — XAI Tensor Engine

### "Fade Doctrine" Interface

Replaced unstable graph visualizers with a deterministic canvas orbital sphere.

- Stable frame timing
- Reduced cognitive noise
- Clearer relational visualization

---

### Explainable Reasoning Layer

Integrated a large context window LLM to power the `<TerminalReadout />` component. This module exposes internal reasoning from the Rust engine in real time.

---

### Vector Calculus Transparency

Associative node linking now displays its full mathematical basis.

**Example connection:** `Ecology ↔ Macro-Health`

Displayed computation — cosine similarity:

```
A · B = Σ (Aᵢ * Bᵢ)
```

Where A and B are 16-dimensional feature vectors. The dot product explains the associative tensor relationship.

This converts the system from a black-box model into an Explainable AI interface.

---

## Layer 6.6.6 — SCENT: The Shop Is Retired

### Shop and Living Accord Removed

The /SCENT perfume shop is retired. The order flow, the production threshold, redemption, the Discord order buttons and the Living Accord redeem bot are gone, along with `/api/transmute/*`, `/api/discord/interactions` and `bot/`. The collision chamber, the perfume card and the sovereign view are unchanged, and the manifest download remains.

---

## Layer 7.7.7 — SCENT: Honest Chemistry

### The Kit, the Engine, the Vault Payload Removed

Anything on /SCENT that read like a lab measurement is now calculated from cited data or cut. The invented concentration, wear time, evaporation timings, flash point, density, maceration and the fake encrypted formula (with its CAS registry) are gone from the card, the manifest and the view. The vault payload stays removed until P2 brings a real ML-KEM-768 / ML-DSA-65 seal, and the Tesseract badge reads UNSEALED until then.

`src/terminal/scent/` is a pure formula engine. It takes a card's notes through the note interpretation into a cited 38-material kit (57 bottles: neat, 10%, 1% and 0.1% stocks, crystals for solids). It weighs a 7.00 g or 10.00 g batch on a 0.01 g scale: element strength ±0.5 pt, layer bands, the /SOL tilt, the /CHAOS drift, and IFRA Category 4 limits checked after all modulation and rounding, summed by standard across every row that carries a substance. A tiny dose of a solid with only a 1% stock that would overfill the bottle is weighed as 0.05 g of crystals instead, and logged. Nothing in it runs at the altar yet (P3).

---

## Layer 8.8.8 — SCENT: The Identity and the Seal

### One Post-Quantum Identity, a Real Seal, the Fourth Vertebra

Crystallize now seals for real. Each visitor holds one identity: an ML-KEM-768 keypair (FIPS 203) that seals, and an ML-DSA-65 keypair (FIPS 204) kept for the dossier signature. The secret halves are wrapped with AES-256-GCM under a non-extractable key in IndexedDB, or held in memory and labelled VOLATILE when storage is unavailable.

At crystallize, the card's base accord and a fresh 32-byte chaos salt are sealed under that identity: ML-KEM-768 encapsulation, a BLAKE3 `derive_key` ("scale94 scent accord seal v1"), then AES-256-GCM. Only the ciphertext envelope reaches the spine. /SCENT is the fourth vertebra: only a real envelope marks it, and a seal whose key has gone from this device reads `SEAL ORPHANED — the key evaporated`. The Tesseract badge names the seal that ran, or why none did.

/CRYPTOGRAPHY gains an identity panel: the fingerprint (SHA-256(ek‖pk), first 16 bytes), an Argon2id backup (m = 64 MiB, t = 3, p = 4, RFC 9106 §4 option 2), restore and rotate. Its keygen demo calls the structured `mlkem768_keygen` export instead of reading keys out of a log.

The primitives are new structured Rust/WASM exports. They are checked against the NIST ACVP known-answer vectors (ML-KEM-768 and ML-DSA-65; `ml-kem =0.2.3`, `ml-dsa =0.1.0-rc.7`, both pinned exactly), and every secret buffer is zeroized. The altar arms only with a sealed accord; P3 is what makes ignite read it.

---

## Deployment Metrics

**Platform:** Vercel
**Pipeline:** `git push origin main`

Build system reused cache layers for Rust + React compilation.
**Deployment time:** 18 seconds

---

## System Classification

SOMA v1.1.1 is no longer a conventional web application. It functions as a browser-native post-quantum enclave combining:

- PQC cryptographic primitives
- Deterministic visualization
- Explainable tensor reasoning
- Semantic terminal interface

The platform operates as a mathematical oracle for conceptual simulation — a system where cryptographic operations become legible events, and associative reasoning is shown, not hidden.

---

**SYSTEM STATE: GOLD STABLE**
**ARS ELECTRONICA PATHWAY: OPEN**
