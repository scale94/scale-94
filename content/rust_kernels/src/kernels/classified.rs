// kernels/classified.rs — Post-Quantum Cryptography Kernel
// Scale 9.4 // Ars Electronica 2027
//
// Implements FIPS 203 compliant ML-KEM-768 key encapsulation.
// Mathematical core: Module Learning With Errors (MLWE) problem
//
//   A·s + e = t  (mod q)
//
//   where A ∈ ℤq^(k×k) is a public matrix, s ∈ ℤq^k is the secret vector,
//   e ∈ ℤq^k is a small error term, and t ∈ ℤq^k is the public key component.
//   q = 3329, k = 3 (for ML-KEM-768).
//
// Security: 192-bit classical / 128-bit post-quantum (NIST Category 3)
//
// Key sizes (ML-KEM-768):
//   Encapsulation key (public)  : 1184 bytes
//   Decapsulation key (private) : 2400 bytes
//   Ciphertext                  : 1088 bytes
//   Shared secret               :   32 bytes
//
// Exports:
//   classified_params()         → autocomplete hint array
//   run_classified(reveal: u32) → full KEM round-trip log

use wasm_bindgen::prelude::*;
use ml_kem::{KemCore, MlKem768};
use ml_kem::kem::Encapsulate;
use rand_core::OsRng;

/// Autocomplete hint: single [reveal:0|1] parameter
#[wasm_bindgen]
pub fn classified_params() -> js_sys::Array {
    js_sys::Array::of1(&JsValue::from_str("[reveal:0|1]"))
}

/// Run a full ML-KEM-768 KEM round-trip and format as system kernel log.
///
/// `reveal`:
///   0 → decapsulation key (private) is redacted in output  [default]
///   1 → private key is printed in full (WARNING display)
///
/// The function always:
///   1. Generates a fresh keypair via OS entropy
///   2. Encapsulates a shared secret (simulates sender)
///   3. Displays public key, ciphertext, and derived shared secret
///   4. Conditionally displays the private decapsulation key
#[wasm_bindgen]
pub fn run_classified(reveal: u32) -> String {
    let mut logs = String::new();

    logs.push_str("[SYS] INITIALIZING ML-KEM-768 ENCLAVE\n");
    logs.push_str("[SYS] ALGORITHM   : FIPS 203 — MODULE-LATTICE KEY ENCAPSULATION\n");
    logs.push_str("[SYS] SECURITY     : 192-BIT CLASSICAL // 128-BIT QUANTUM (NIST CAT-3)\n");
    logs.push_str("[SYS] PROBLEM      : MLWE — A·s + e = t (mod q=3329, k=3)\n");
    logs.push_str("[SYS] GENERATING ENTROPY — OS_RNG SEED ACQUIRED\n\n");

    // ── Key generation ────────────────────────────────────────────────────────
    // generate() takes an RNG and returns (EncapsulationKey, DecapsulationKey).
    // No Result wrapping — pure math with guaranteed entropy from OsRng.
    let (ek, dk) = MlKem768::generate(&mut OsRng);

    // ── Encapsulation key (public) ────────────────────────────────────────────
    let ek_hex = hex::encode(ek.as_bytes());
    logs.push_str(&format!(
        "[OK] ENCAPSULATION KEY (PUBLIC)  [{} bytes]\n",
        ek.as_bytes().len()
    ));
    push_hex_block(&mut logs, &ek_hex.to_uppercase());
    logs.push('\n');

    // ── Decapsulation key (private) — reveal-gated ───────────────────────────
    logs.push_str(&format!(
        "[OK] DECAPSULATION KEY (PRIVATE) [{} bytes]\n",
        dk.as_bytes().len()
    ));
    if reveal != 0 {
        let dk_hex = hex::encode(dk.as_bytes());
        logs.push_str("[WARN] PRIVATE KEY EXPOSED IN SYSTEM KERNEL LOGS — PROCEED WITH CAUTION\n");
        push_hex_block(&mut logs, &dk_hex.to_uppercase());
    } else {
        logs.push_str("[SEC] STATUS: REDACTED — USE --reveal 1 TO OVERRIDE\n");
        logs.push_str("      ████████████████████████████████████████████████████████████████\n");
        logs.push_str("      ████████████████████████████████████████████████████████████████\n");
        logs.push_str("      ████████████████████████████████████████████████████████████████\n");
        logs.push_str("      ████████████████████████████████████████████████████████████████\n");
    }
    logs.push('\n');

    // ── Encapsulation: generate shared secret + ciphertext ───────────────────
    // ek.encapsulate(rng) → Result<(Ciphertext, SharedKey), _>
    // Encapsulate trait must be in scope (see import above).
    let (ciphertext, shared_key) = match ek.encapsulate(&mut OsRng) {
        Ok(pair) => pair,
        Err(_)   => return "[ERR] KERNEL PANIC — ENCAPSULATION FAILURE\n".to_string(),
    };

    let ct_hex = hex::encode(ciphertext.as_bytes());
    logs.push_str(&format!(
        "[OK] CIPHERTEXT (ENCAPSULATED)   [{} bytes]\n",
        ciphertext.as_bytes().len()
    ));
    push_hex_block(&mut logs, &ct_hex.to_uppercase());
    logs.push('\n');

    // ── Shared secret ─────────────────────────────────────────────────────────
    // SharedKey is a 32-byte value derived from the MLWE trapdoor.
    // Both sender (via encapsulate) and recipient (via decapsulate) derive
    // the identical value — this is what makes KEM a key *agreement* protocol.
    let ss_hex = hex::encode(shared_key.as_ref());
    logs.push_str("[OK] SHARED SECRET (DERIVED)     [32 bytes]\n");
    logs.push_str(&format!("      {}\n\n", ss_hex.to_uppercase()));

    // ── Digest ────────────────────────────────────────────────────────────────
    logs.push_str("[SYS] MLWE LATTICE CONSTRUCTED: A·s + e = t (mod q)\n");
    logs.push_str(&format!(
        "[SYS] KEY_SIZES: ek={}B  dk={}B  ct={}B  ss=32B\n",
        ek.as_bytes().len(),
        dk.as_bytes().len(),
        ciphertext.as_bytes().len(),
    ));
    logs.push_str("[SYS] KERNEL ROUTINE COMPLETE.\n");

    logs
}

/// Format a hex string as 64-character lines with 6-space left indent.
/// Hex is always valid ASCII — str::from_utf8 on a hex chunk is infallible.
fn push_hex_block(logs: &mut String, hex_str: &str) {
    for chunk in hex_str.as_bytes().chunks(64) {
        logs.push_str("      ");
        logs.push_str(std::str::from_utf8(chunk).unwrap_or(""));
        logs.push('\n');
    }
}
