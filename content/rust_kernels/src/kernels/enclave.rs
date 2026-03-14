// kernels/enclave.rs — Post-Quantum Enclave: ML-KEM-768 + AES-256-GCM
//
// Real key encapsulation and authenticated encryption — not a demo.
// Users generate a persistent keypair, then seal and open messages
// using the standard KEM/DEM pattern:
//
//   SEAL:  ML-KEM-768 encapsulate(ek) → shared_secret → AES-256-GCM encrypt
//   OPEN:  ML-KEM-768 decapsulate(dk, ct) → shared_secret → AES-256-GCM decrypt
//
// Sealed format (binary, hex-encoded for terminal transport):
//   [1088B  ML-KEM-768 ciphertext]
//   [12B    AES-256-GCM nonce (OsRng)]
//   [N+16B  AES-256-GCM ciphertext + auth tag]
//
// Key sizes (FIPS 203, ML-KEM-768, NIST Category 3):
//   Encapsulation key (public)  : 1184 bytes
//   Decapsulation key (private) : 2400 bytes
//   Ciphertext (KEM)            : 1088 bytes
//   Shared secret               :   32 bytes
//
// Architecture: The typed keypair is stored in WASM linear memory via
// thread_local! so we never need to reconstruct Rust types from raw bytes
// (avoids hybrid_array version conflicts across the crate graph).
//
// References:
//   - FIPS 203 (2024): Module-Lattice-Based Key-Encapsulation Mechanism Standard
//   - SP 800-227 (2025): Recommendations for KEM-then-DEM Hybrid Encryption
//
// SOMA-9.4 · ARS ELECTRONICA 2027

use std::fmt::Write;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use ml_kem::{KemCore, MlKem768, MlKem768Params, EncodedSizeUser};
use ml_kem::kem::{Encapsulate, Decapsulate};
use aes_gcm::aead::{Aead, KeyInit};
use rand_core::{OsRng, RngCore};
use zeroize::Zeroize;

const EK_LEN: usize = 1184;
const DK_LEN: usize = 2400;
const CT_LEN: usize = 1088;
const NONCE_LEN: usize = 12;

// ── Keypair storage in WASM linear memory ────────────────────────────────────
// thread_local! is safe in WASM (single-threaded). The typed keypair is stored
// here so seal/open can use the native Rust types without byte reconstruction.
//
// We use MlKem768Params (the raw parameter set) as the type argument, NOT
// MlKem768 (= Kem<MlKem768Params>), because only MlKem768Params satisfies
// the ParameterSet → KemParams trait chain required by EncapsulationKey<P>.

thread_local! {
    static STORED_EK: RefCell<Option<ml_kem::kem::EncapsulationKey<MlKem768Params>>> =
        RefCell::new(None);
    static STORED_DK: RefCell<Option<ml_kem::kem::DecapsulationKey<MlKem768Params>>> =
        RefCell::new(None);
}

fn push_hex_block(out: &mut String, hex_str: &str) {
    for chunk in hex_str.as_bytes().chunks(64) {
        out.push_str("      ");
        out.push_str(std::str::from_utf8(chunk).unwrap_or(""));
        out.push('\n');
    }
}

// ── KEYGEN ───────────────────────────────────────────────────────────────────

/// Generate an ML-KEM-768 keypair. Stores the typed keypair in WASM memory
/// for subsequent seal/open calls. Returns formatted log + DATA: JSON with
/// hex-encoded ek (public) and dk (private).
#[wasm_bindgen]
pub fn enclave_keygen() -> String {
    let mut out = String::with_capacity(8000);

    writeln!(out, "ENCLAVE v1.0 // ML-KEM-768 + AES-256-GCM").unwrap();
    writeln!(out, "KEYGEN: Post-Quantum Key Encapsulation Mechanism").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  ALGORITHM   : FIPS 203 — ML-KEM-768 (NIST Category 3)").unwrap();
    writeln!(out, "  SECURITY    : 192-bit classical / 128-bit post-quantum").unwrap();
    writeln!(out, "  PROBLEM     : MLWE — A·s + e = t (mod q=3329, k=3)").unwrap();
    writeln!(out, "  ENTROPY     : crypto.getRandomValues() via OsRng").unwrap();
    writeln!(out, "").unwrap();

    // Generate keypair — typed objects stay in Rust, only bytes cross boundary
    let (dk, ek) = MlKem768::generate(&mut OsRng);
    let ek_bytes = ek.as_bytes().to_vec();
    let dk_bytes = dk.as_bytes().to_vec();
    let ek_hex = hex::encode(&ek_bytes).to_uppercase();
    let dk_hex = hex::encode(&dk_bytes).to_uppercase();

    writeln!(out, "  [OK] ENCAPSULATION KEY (PUBLIC)  [{} bytes]", EK_LEN).unwrap();
    push_hex_block(&mut out, &ek_hex);
    writeln!(out).unwrap();

    writeln!(out, "  [OK] DECAPSULATION KEY (PRIVATE) [{} bytes]", DK_LEN).unwrap();
    writeln!(out, "  [SEC] Stored in WASM linear memory — required for 'open'").unwrap();
    push_hex_block(&mut out, &dk_hex);
    writeln!(out).unwrap();

    // Store typed keypair
    STORED_EK.with(|cell| {
        *cell.borrow_mut() = Some(ek);
    });
    STORED_DK.with(|cell| {
        *cell.borrow_mut() = Some(dk);
    });

    writeln!(out, "  KEYGEN COMPLETE — keypair stored in WASM session").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  WARNING: Keys exist ONLY in this browser session.").unwrap();
    writeln!(out, "  Refreshing the page or closing the tab DESTROYS the private key.").unwrap();
    writeln!(out, "  Sealed data encrypted with this key CANNOT be recovered without it.").unwrap();
    writeln!(out, "  There is no key backup, no recovery, no server-side copy.").unwrap();
    writeln!(out, "").unwrap();
    writeln!(out, "  Use: seal <message>   to encrypt with the public key").unwrap();
    writeln!(out, "  Use: open <hex_blob>  to decrypt with the private key").unwrap();

    // DATA: suffix for frontend state
    write!(out, "\nDATA:{{\"ek\":\"{}\",\"dk\":\"{}\"}}", ek_hex, dk_hex).unwrap();

    out
}

// ── SEAL (encrypt) ───────────────────────────────────────────────────────────

/// Encrypt a plaintext message using ML-KEM-768 + AES-256-GCM.
/// Uses the encapsulation key from the most recent `enclave_keygen()` call.
/// Returns formatted log + DATA: JSON with the hex-encoded sealed blob.
#[wasm_bindgen]
pub fn enclave_seal(plaintext: &str) -> String {
    let mut out = String::with_capacity(4000);

    writeln!(out, "ENCLAVE SEAL // ML-KEM-768 + AES-256-GCM").unwrap();
    writeln!(out, "").unwrap();

    if plaintext.is_empty() {
        writeln!(out, "  [ERR] No plaintext provided. Usage: seal <message>").unwrap();
        return out;
    }

    // Read stored encapsulation key
    let encap_result = STORED_EK.with(|cell| {
        let borrow = cell.borrow();
        if let Some(ref ek) = *borrow {
            // Encapsulate using the typed key — no byte reconstruction needed
            ek.encapsulate(&mut OsRng).ok()
        } else {
            None
        }
    });

    let (kem_ct, mut shared_secret) = match encap_result {
        Some(pair) => pair,
        None => {
            writeln!(out, "  [ERR] No encapsulation key in session.").unwrap();
            writeln!(out, "  Run: keygen   to generate a keypair first.").unwrap();
            return out;
        }
    };

    let kem_ct_bytes: &[u8] = kem_ct.as_ref();
    writeln!(out, "  [OK] Encapsulation key loaded from session").unwrap();
    writeln!(out, "  [OK] Plaintext: {} bytes", plaintext.len()).unwrap();
    writeln!(out, "  [OK] ML-KEM encapsulated: ct={} bytes, ss=32 bytes", kem_ct_bytes.len()).unwrap();

    // AES-256-GCM encrypt with the shared secret as key
    let cipher = match aes_gcm::Aes256Gcm::new_from_slice(shared_secret.as_ref()) {
        Ok(c) => c,
        Err(_) => {
            writeln!(out, "  [ERR] AES-256-GCM key init failed").unwrap();
            return out;
        }
    };

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = aes_gcm::Nonce::from_slice(&nonce_bytes);

    let aes_ct = match cipher.encrypt(nonce, plaintext.as_bytes()) {
        Ok(ct) => ct,
        Err(_) => {
            writeln!(out, "  [ERR] AES-256-GCM encryption failed").unwrap();
            return out;
        }
    };

    writeln!(out, "  [OK] AES-256-GCM: nonce=12 bytes, ct+tag={} bytes", aes_ct.len()).unwrap();

    // Zeroize shared secret
    AsMut::<[u8]>::as_mut(&mut shared_secret).zeroize();

    // Pack sealed blob: kem_ct (1088) || nonce (12) || aes_ct+tag
    let mut sealed = Vec::with_capacity(CT_LEN + NONCE_LEN + aes_ct.len());
    sealed.extend_from_slice(kem_ct_bytes);
    sealed.extend_from_slice(&nonce_bytes);
    sealed.extend_from_slice(&aes_ct);

    let sealed_hex = hex::encode(&sealed).to_uppercase();
    let total = sealed.len();

    writeln!(out).unwrap();
    writeln!(out, "  SEALED BLOB [{} bytes = {} KEM + {} nonce + {} AEAD]",
        total, CT_LEN, NONCE_LEN, aes_ct.len()).unwrap();
    push_hex_block(&mut out, &sealed_hex);
    writeln!(out).unwrap();
    writeln!(out, "  SEAL COMPLETE — use 'open <blob>' with the private key to decrypt").unwrap();
    writeln!(out, "  WARNING: If you lose this session, the sealed data is unrecoverable.").unwrap();

    // DATA: suffix
    write!(out, "\nDATA:{{\"sealed\":\"{}\",\"size\":{}}}", sealed_hex, total).unwrap();

    out
}

// ── OPEN (decrypt) ───────────────────────────────────────────────────────────

/// Decrypt a sealed blob using the decapsulation key from the most recent
/// `enclave_keygen()` call.
/// `sealed_hex` — hex-encoded sealed blob (kem_ct || nonce || aes_ct+tag)
/// Returns formatted log + DATA: JSON with the recovered plaintext.
#[wasm_bindgen]
pub fn enclave_open(sealed_hex: &str) -> String {
    let mut out = String::with_capacity(2000);

    writeln!(out, "ENCLAVE OPEN // ML-KEM-768 + AES-256-GCM").unwrap();
    writeln!(out, "").unwrap();

    // Decode sealed blob
    let sealed = match hex::decode(sealed_hex.trim()) {
        Ok(b) => b,
        Err(e) => {
            writeln!(out, "  [ERR] Hex decode failed: {}", e).unwrap();
            return out;
        }
    };

    // Minimum: 1088 (KEM ct) + 12 (nonce) + 16 (GCM tag) = 1116 bytes
    if sealed.len() < CT_LEN + NONCE_LEN + 16 {
        writeln!(out, "  [ERR] Sealed blob too short: {} bytes (min {})",
            sealed.len(), CT_LEN + NONCE_LEN + 16).unwrap();
        return out;
    }

    // Unpack
    let kem_ct_bytes = &sealed[..CT_LEN];
    let nonce_bytes  = &sealed[CT_LEN..CT_LEN + NONCE_LEN];
    let aes_ct       = &sealed[CT_LEN + NONCE_LEN..];

    writeln!(out, "  [OK] Sealed blob: {} bytes (KEM={}, nonce={}, AEAD={})",
        sealed.len(), CT_LEN, NONCE_LEN, aes_ct.len()).unwrap();

    // Decapsulate using the stored typed DecapsulationKey
    let decap_result = STORED_DK.with(|cell| {
        let borrow = cell.borrow();
        if let Some(ref dk) = *borrow {
            // Convert raw bytes → typed ciphertext via GenericArray/Encoded
            use ml_kem::array::Array;
            let ct_array: Array<u8, _> = kem_ct_bytes.try_into().unwrap();
            dk.decapsulate(&ct_array).ok()
        } else {
            None
        }
    });

    let mut shared_secret = match decap_result {
        Some(ss) => ss,
        None => {
            writeln!(out, "  [ERR] Decapsulation failed.").unwrap();
            writeln!(out, "  Possible causes:").unwrap();
            writeln!(out, "    - No keypair in session (run: keygen)").unwrap();
            writeln!(out, "    - Sealed blob was encrypted with a different public key").unwrap();
            writeln!(out, "    - Corrupted ciphertext").unwrap();
            return out;
        }
    };

    writeln!(out, "  [OK] Decapsulation key loaded from session").unwrap();
    writeln!(out, "  [OK] ML-KEM decapsulated: shared secret recovered (32 bytes)").unwrap();

    // AES-256-GCM decrypt
    let cipher = match aes_gcm::Aes256Gcm::new_from_slice(shared_secret.as_ref()) {
        Ok(c) => c,
        Err(_) => {
            writeln!(out, "  [ERR] AES-256-GCM key init failed").unwrap();
            return out;
        }
    };

    let nonce = aes_gcm::Nonce::from_slice(nonce_bytes);

    let plaintext_bytes = match cipher.decrypt(nonce, aes_ct) {
        Ok(pt) => pt,
        Err(_) => {
            AsMut::<[u8]>::as_mut(&mut shared_secret).zeroize();
            writeln!(out, "  [ERR] AES-256-GCM decryption failed — auth tag mismatch").unwrap();
            writeln!(out, "  Possible causes: wrong key, corrupted blob, or tampered ciphertext").unwrap();
            return out;
        }
    };

    // Zeroize shared secret
    AsMut::<[u8]>::as_mut(&mut shared_secret).zeroize();

    let plaintext = String::from_utf8_lossy(&plaintext_bytes);
    writeln!(out, "  [OK] AES-256-GCM decrypted: {} bytes plaintext", plaintext_bytes.len()).unwrap();
    writeln!(out).unwrap();
    writeln!(out, "  ── PLAINTEXT ─────────────────────────────────").unwrap();
    writeln!(out, "  {}", plaintext).unwrap();
    writeln!(out, "  ──────────────────────────────────────────────").unwrap();
    writeln!(out).unwrap();
    writeln!(out, "  OPEN COMPLETE — ephemeral key material zeroized").unwrap();

    // DATA: suffix — escape the plaintext for JSON
    let escaped: String = plaintext.chars().map(|c| match c {
        '"'  => "\\\"".to_string(),
        '\\' => "\\\\".to_string(),
        '\n' => "\\n".to_string(),
        '\r' => "\\r".to_string(),
        c    => c.to_string(),
    }).collect();

    write!(out, "\nDATA:{{\"plaintext\":\"{}\",\"size\":{}}}", escaped, plaintext_bytes.len()).unwrap();

    out
}
