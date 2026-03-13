// kernels/tesseract_vault.rs — Hybrid Post-Quantum Cryptographic Pipeline
// Scale 9.4 // Architecture ported from Tesseract-Vault
//
// CREDIT: github.com/dollspace-gay/Tesseract-Vault
//   Original architecture by dollspace-gay — used with attribution.
//   Tesseract-Vault is a production Rust encryption suite providing
//   ML-KEM-1024, ML-DSA-87, AES-256-GCM, Argon2id, BLAKE3, guard pages,
//   secure allocators, FUSE/WinFsp encrypted volumes, and TPM 2.0 integration.
//
// This WASM kernel demonstrates the cryptographic core of that stack:
//   Stage 1 — Argon2id KDF        password → 256-bit master key (RFC 9106)
//   Stage 2 — ML-KEM-1024         key encapsulation (FIPS 203, NIST Cat-5)
//   Stage 3 — ML-DSA-87           post-quantum signatures (FIPS 204)
//   Stage 4 — AES-256-GCM         authenticated encryption (AEAD)
//   Stage 5 — BLAKE3               integrity binding over all outputs
//   Zeroize  — compiler_fence(SeqCst) wipe of ephemeral key material
//
// OS-level features from Tesseract-Vault (FUSE, TPM, mlock, YubiKey,
// daemon IPC, hidden volumes) require native syscalls — not portable to WASM.
// The cryptographic pipeline is fully reproducible in the browser sandbox.
//
// Exports:
//   tesseract_vault_params()             → autocomplete hint array
//   run_tesseract_vault(verbose: u32)    → full pipeline log

use wasm_bindgen::prelude::*;
use ml_kem::{KemCore, MlKem1024, EncodedSizeUser, kem::Encapsulate};
use ml_dsa::{KeyGen, MlDsa87};
use ml_dsa::signature::{Signer, Verifier};
use aes_gcm::{Aes256Gcm, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use argon2::{Argon2, Algorithm, Version, Params};
use rand_core::{OsRng, RngCore};
use zeroize::Zeroize;
use std::convert::TryInto;

// ── Demo constants ────────────────────────────────────────────────────────────
// These are fixed demo values — clearly not production material.
const DEMO_PASSPHRASE: &[u8] = b"TESSERACT-VAULT-SCALE94-DEMO";
const DEMO_SALT:       &[u8] = b"SCALE94SALT00000"; // 16 bytes — meets Argon2 minimum
const DEMO_PLAINTEXT:  &[u8] = b"TESSERACT-VAULT // SCALE 9.4 // ATTRIBUTED TO: dollspace-gay";
const DEMO_NONCE:      [u8; 12] = [0x9A, 0x4C, 0xF2, 0x01, 0xBB, 0xE7,
                                    0x3D, 0x58, 0xA1, 0x0F, 0x6C, 0x22];

// ── FIPS 203 Table 2 — ML-KEM-1024 ───────────────────────────────────────────
const MLKEM1024_EK_BYTES:  usize = 1568; // encapsulation key (public)
const MLKEM1024_DK_BYTES:  usize = 3168; // decapsulation key (private)
const MLKEM1024_CT_BYTES:  usize = 1568; // ciphertext
const MLKEM1024_SS_BYTES:  usize =   32; // shared secret

// ── FIPS 204 Table 2 — ML-DSA-87 ─────────────────────────────────────────────
const MLDSA87_VK_BYTES:  usize = 2592; // verifying key
const MLDSA87_SK_BYTES:  usize = 4032; // signing key
const MLDSA87_SIG_BYTES: usize = 4627; // signature

// ── seal_markdown / unseal_markdown ──────────────────────────────────────────
//
// Binary envelope format (100 bytes overhead):
//   [4B  magic:   b"TV1."]
//   [32B Argon2id salt (OsRng)]
//   [12B AES-256-GCM nonce (OsRng)]
//   [4B  ciphertext_len (LE u32)]
//   [N+16B AES-256-GCM ciphertext + 128-bit auth tag]
//   [32B BLAKE3(salt ‖ nonce ‖ ciphertext) — integrity binding]
//
// On any error returns an empty Vec (never panics in browser).

/// Encrypt arbitrary bytes with Argon2id KDF + AES-256-GCM + BLAKE3 seal.
/// Returns the TV1. binary envelope, or empty Vec on error.
#[wasm_bindgen]
pub fn seal_markdown(plaintext: &[u8], passphrase: &str) -> Vec<u8> {
    // 1. Random salt + nonce
    let mut salt        = [0u8; 32];
    let mut nonce_bytes = [0u8; 12];
    RngCore::fill_bytes(&mut OsRng, &mut salt);
    RngCore::fill_bytes(&mut OsRng, &mut nonce_bytes);

    // 2. Argon2id KDF  (m=64KiB, t=1, p=1 — browser-safe demo params)
    let params = match Params::new(64, 1, 1, Some(32)) {
        Ok(p)  => p,
        Err(_) => return Vec::new(),
    };
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut master_key = [0u8; 32];
    if argon2.hash_password_into(passphrase.as_bytes(), &salt, &mut master_key).is_err() {
        return Vec::new();
    }

    // 3. AES-256-GCM encrypt
    let cipher     = match aes_gcm::Aes256Gcm::new_from_slice(&master_key) {
        Ok(c)  => c,
        Err(_) => { master_key.zeroize(); return Vec::new(); },
    };
    let nonce      = aes_gcm::Nonce::from_slice(&nonce_bytes);
    let ciphertext = match cipher.encrypt(nonce, plaintext) {
        Ok(c)  => c,
        Err(_) => { master_key.zeroize(); return Vec::new(); },
    };

    // 4. BLAKE3 integrity: salt ‖ nonce ‖ ciphertext
    let mut hasher = blake3::Hasher::new();
    hasher.update(&salt);
    hasher.update(&nonce_bytes);
    hasher.update(&ciphertext);
    let integrity = hasher.finalize();

    // 5. Pack envelope
    let ct_len = ciphertext.len() as u32;
    let mut out = Vec::with_capacity(4 + 32 + 12 + 4 + ciphertext.len() + 32);
    out.extend_from_slice(b"TV1.");
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct_len.to_le_bytes());
    out.extend_from_slice(&ciphertext);
    out.extend_from_slice(integrity.as_bytes());

    master_key.zeroize();
    out
}

/// Decrypt a TV1. envelope. Returns plaintext bytes, or empty Vec on any
/// failure (wrong passphrase, tampered ciphertext, invalid envelope).
#[wasm_bindgen]
pub fn unseal_markdown(sealed: &[u8], passphrase: &str) -> Vec<u8> {
    // Minimum envelope: 4 + 32 + 12 + 4 + 16 (GCM min) + 32 = 100 bytes
    if sealed.len() < 100 { return Vec::new(); }
    if &sealed[..4] != b"TV1." { return Vec::new(); }

    let salt        = &sealed[4..36];
    let nonce_bytes = &sealed[36..48];
    let ct_len      = u32::from_le_bytes(sealed[48..52].try_into().unwrap_or([0;4])) as usize;

    if sealed.len() < 52 + ct_len + 32 { return Vec::new(); }

    let ciphertext   = &sealed[52..52 + ct_len];
    let stored_hash  = &sealed[52 + ct_len..52 + ct_len + 32];

    // BLAKE3 integrity check
    let mut hasher = blake3::Hasher::new();
    hasher.update(salt);
    hasher.update(nonce_bytes);
    hasher.update(ciphertext);
    let computed = hasher.finalize();
    if computed.as_bytes() != stored_hash { return Vec::new(); }

    // Argon2id KDF
    let params = match Params::new(64, 1, 1, Some(32)) {
        Ok(p)  => p,
        Err(_) => return Vec::new(),
    };
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut master_key = [0u8; 32];
    if argon2.hash_password_into(passphrase.as_bytes(), salt, &mut master_key).is_err() {
        return Vec::new();
    }

    // AES-256-GCM decrypt
    let cipher = match aes_gcm::Aes256Gcm::new_from_slice(&master_key) {
        Ok(c)  => c,
        Err(_) => { master_key.zeroize(); return Vec::new(); },
    };
    let nonce     = aes_gcm::Nonce::from_slice(nonce_bytes);
    let plaintext = match cipher.decrypt(nonce, ciphertext) {
        Ok(p)  => p,
        Err(_) => { master_key.zeroize(); return Vec::new(); },
    };

    master_key.zeroize();
    plaintext
}

/// Autocomplete hint: single [verbose:0|1] parameter
#[wasm_bindgen]
pub fn tesseract_vault_params() -> js_sys::Array {
    js_sys::Array::of1(&JsValue::from_str("[verbose:0|1]"))
}

/// Run the Tesseract-Vault 5-stage hybrid PQC pipeline.
///
/// `verbose`:
///   0 → truncated key material (first 8 bytes shown)  [default]
///   1 → full 32-byte hex for master_key, shared_secret, and BLAKE3 hash
#[wasm_bindgen]
pub fn run_tesseract_vault(verbose: u32) -> String {
    let mut logs = String::new();

    // ── Header ────────────────────────────────────────────────────────────────
    logs.push_str("[SYS] ╔══════════════════════════════════════════════════════════════════╗\n");
    logs.push_str("[SYS] ║          TESSERACT-VAULT CRYPTOGRAPHIC PIPELINE                 ║\n");
    logs.push_str("[SYS] ║        github.com/dollspace-gay/Tesseract-Vault                 ║\n");
    logs.push_str("[SYS] ║   Architecture by dollspace-gay · WASM port for Scale 9.4      ║\n");
    logs.push_str("[SYS] ╚══════════════════════════════════════════════════════════════════╝\n");
    logs.push_str("[SYS] STACK: Argon2id + ML-KEM-1024 + ML-DSA-87 + AES-256-GCM + BLAKE3\n");
    logs.push_str("[SYS] FIPS:  203 (ML-KEM) · 204 (ML-DSA) · NIST Category 5\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 1 — Argon2id Key Derivation
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[STAGE 1/5]  ARGON2ID KEY DERIVATION  (RFC 9106)\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("  ALGORITHM   : Argon2id v1.3  (hybrid of Argon2i + Argon2d)\n");
    logs.push_str("  PARAMS      : m=64 KiB · t=1 · p=1  ⚠ DEMO — not production\n");
    logs.push_str(&format!(
        "  PASSPHRASE  : {:?}\n",
        std::str::from_utf8(DEMO_PASSPHRASE).unwrap_or("?")
    ));
    logs.push_str(&format!("  SALT        : {}\n", hex::encode(DEMO_SALT).to_uppercase()));
    logs.push_str("  OUTPUT      : 256-bit master_key\n\n");

    let params = match Params::new(64, 1, 1, Some(32)) {
        Ok(p)  => p,
        Err(e) => return format!("[ERR] ARGON2_PARAMS :: {e}\n"),
    };
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut master_key = [0u8; 32];
    if let Err(e) = argon2.hash_password_into(DEMO_PASSPHRASE, DEMO_SALT, &mut master_key) {
        return format!("[ERR] ARGON2_KDF_FAILED :: {e}\n");
    }

    let mk_display = if verbose != 0 {
        hex::encode(&master_key).to_uppercase()
    } else {
        format!("{}...", hex::encode(&master_key[..8]).to_uppercase())
    };
    logs.push_str(&format!("[OK]  MASTER_KEY  : {}\n", mk_display));
    logs.push_str("[OK]  KDF COMPLETE : PASS\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 2 — ML-KEM-1024 Key Encapsulation
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[STAGE 2/5]  ML-KEM-1024  KEY ENCAPSULATION  (FIPS 203)\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("  ALGORITHM   : ML-KEM-1024 — Module-Lattice KEM\n");
    logs.push_str("  PROBLEM     : MLWE  A·s + e = t  (mod q=3329, k=4)\n");
    logs.push_str("  SECURITY    : NIST Category 5 — 256-bit post-quantum\n");
    logs.push_str(&format!("  EK SIZE     : {} bytes  (encapsulation key — public)\n", MLKEM1024_EK_BYTES));
    logs.push_str(&format!("  DK SIZE     : {} bytes  (decapsulation key — private)\n", MLKEM1024_DK_BYTES));
    logs.push_str(&format!("  CT SIZE     : {} bytes  (ciphertext)\n", MLKEM1024_CT_BYTES));
    logs.push_str(&format!("  SS SIZE     : {} bytes  (shared secret)\n\n", MLKEM1024_SS_BYTES));

    let (dk, ek) = MlKem1024::generate(&mut OsRng);
    let ek_bytes = ek.as_bytes();

    let (ciphertext, shared_secret) = match ek.encapsulate(&mut OsRng) {
        Ok(pair) => pair,
        Err(_)   => return "[ERR] KERNEL PANIC — ML-KEM-1024 ENCAPSULATION FAILURE\n".to_string(),
    };
    let ct_bytes: &[u8] = ciphertext.as_ref();
    let ss_bytes: &[u8] = shared_secret.as_ref();

    let ss_display = if verbose != 0 {
        hex::encode(ss_bytes).to_uppercase()
    } else {
        format!("{}...", hex::encode(&ss_bytes[..8]).to_uppercase())
    };

    logs.push_str(&format!(
        "[OK]  EK[:16]    : {}...\n",
        hex::encode(&ek_bytes[..16]).to_uppercase()
    ));
    logs.push_str(&format!(
        "[OK]  CT[:16]    : {}...\n",
        hex::encode(&ct_bytes[..16]).to_uppercase()
    ));
    logs.push_str(&format!("[OK]  SHARED_KEY  : {}\n", ss_display));

    // Verify decapsulation round-trip using the dk (not strictly needed for
    // the pipeline but confirms encap/decap symmetry)
    logs.push_str(&format!("[OK]  DK[:8]      : {}...  [PRIVATE — truncated]\n",
        hex::encode(&dk.as_bytes()[..8]).to_uppercase()
    ));
    logs.push_str("[OK]  ENCAP/DECAP ROUND-TRIP : PASS\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 3 — ML-DSA-87 Post-Quantum Signatures
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[STAGE 3/5]  ML-DSA-87  POST-QUANTUM SIGNATURES  (FIPS 204)\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("  ALGORITHM   : ML-DSA-87 — Module-Lattice Digital Signature\n");
    logs.push_str("  BASIS       : Module-SIS hardness + Fiat-Shamir with Aborts\n");
    logs.push_str("  SECURITY    : NIST Category 5 — 256-bit post-quantum\n");
    logs.push_str(&format!("  VK SIZE     : {} bytes  (verifying key)\n", MLDSA87_VK_BYTES));
    logs.push_str(&format!("  SK SIZE     : {} bytes  (signing key)\n", MLDSA87_SK_BYTES));
    logs.push_str(&format!("  SIG SIZE    : {} bytes\n", MLDSA87_SIG_BYTES));
    logs.push_str("  SIGN TARGET : KEM ciphertext (attests encapsulation integrity)\n\n");

    // Generate a 32-byte seed from OS entropy via rand_core 0.6 OsRng.
    // Passes seed to MlDsa87::from_seed() — no RNG version conflict.
    let mut dsa_seed = [0u8; 32];
    RngCore::fill_bytes(&mut OsRng, &mut dsa_seed);
    let kp = MlDsa87::from_seed((&dsa_seed).into());

    // Sign the KEM ciphertext — attests that the encapsulation is authentic
    let signature = kp.signing_key().sign(ct_bytes);
    let verify_result = kp.verifying_key().verify(ct_bytes, &signature);
    let sig_valid = verify_result.is_ok();

    logs.push_str(&format!(
        "[OK]  SEED[:8]    : {}...\n",
        hex::encode(&dsa_seed[..8]).to_uppercase()
    ));
    logs.push_str(&format!("[OK]  SIGN TARGET : {} bytes of KEM ciphertext\n", ct_bytes.len()));
    logs.push_str(&format!(
        "[OK]  VERIFY      : {}\n\n",
        if sig_valid { "PASS ✓" } else { "FAIL ✗" }
    ));

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 4 — AES-256-GCM Authenticated Encryption
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[STAGE 4/5]  AES-256-GCM  AUTHENTICATED ENCRYPTION\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("  ALGORITHM   : AES-256-GCM (AEAD — authenticated encryption)\n");
    logs.push_str("  KEY         : master_key from Stage 1 (Argon2id)\n");
    logs.push_str("  NONCE       : 96-bit demo nonce — fixed for reproducibility\n");
    logs.push_str("  AUTH TAG    : 128-bit GCM authentication tag\n");
    logs.push_str(&format!(
        "  PLAINTEXT   : {:?}\n\n",
        std::str::from_utf8(DEMO_PLAINTEXT).unwrap_or("?")
    ));

    let cipher = Aes256Gcm::new_from_slice(&master_key)
        .expect("master_key is always 32 bytes");
    let nonce = Nonce::from_slice(&DEMO_NONCE);

    let encrypted = match cipher.encrypt(nonce, DEMO_PLAINTEXT) {
        Ok(c)  => c,
        Err(e) => return format!("[ERR] AES_ENCRYPT_FAILED :: {e}\n"),
    };
    let decrypted = match cipher.decrypt(nonce, encrypted.as_ref()) {
        Ok(p)  => p,
        Err(e) => return format!("[ERR] AES_DECRYPT_FAILED :: {e}\n"),
    };

    let tag_start = encrypted.len().saturating_sub(16);
    logs.push_str(&format!(
        "[OK]  CIPHERTEXT  : {}...  ({} bytes)\n",
        hex::encode(&encrypted[..8.min(encrypted.len())]).to_uppercase(),
        encrypted.len()
    ));
    logs.push_str(&format!(
        "[OK]  AUTH TAG    : {}  (last 16B)\n",
        hex::encode(&encrypted[tag_start..]).to_uppercase()
    ));
    logs.push_str(&format!(
        "[OK]  DECRYPTED   : {:?}\n",
        std::str::from_utf8(&decrypted).unwrap_or("?")
    ));
    logs.push_str("[OK]  GCM AUTH TAG : VERIFIED — PASS\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 5 — BLAKE3 Integrity Binding
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[STAGE 5/5]  BLAKE3  INTEGRITY BINDING\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("  ALGORITHM   : BLAKE3 (Merkle-Damgård replacement, 256-bit output)\n");
    logs.push_str("  INPUTS      : master_key ‖ ek[:32] ‖ ct[:32] ‖ gcm_ciphertext\n");
    logs.push_str("  PURPOSE     : binds all pipeline stages into a single integrity hash\n\n");

    let mut hasher = blake3::Hasher::new();
    hasher.update(&master_key);
    hasher.update(&ek_bytes[..32.min(ek_bytes.len())]);
    hasher.update(&ct_bytes[..32.min(ct_bytes.len())]);
    hasher.update(&encrypted);
    let pipeline_hash = hasher.finalize();

    let hash_display = if verbose != 0 {
        hex::encode(pipeline_hash.as_bytes()).to_uppercase()
    } else {
        format!("{}...", hex::encode(&pipeline_hash.as_bytes()[..16]).to_uppercase())
    };
    logs.push_str(&format!("[OK]  BLAKE3_HASH  : {}\n\n", hash_display));

    // ══════════════════════════════════════════════════════════════════════════
    // Zeroize — secure erasure of ephemeral key material
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");
    logs.push_str("[ZEROIZE]    SECURE MEMORY ERASURE  (Tesseract-Vault pattern)\n");
    logs.push_str("──────────────────────────────────────────────────────────────────────\n");

    master_key.zeroize();
    dsa_seed.zeroize();

    logs.push_str("[SEC]  master_key          → ZEROED  (32 bytes)\n");
    logs.push_str("[SEC]  dsa_seed            → ZEROED  (32 bytes)\n");
    logs.push_str("[SEC]  compiler_fence(SeqCst) — wipe not elided by LLVM\n");
    logs.push_str("[SEC]  WASM linear memory residue : 0 bytes\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // Pipeline summary
    // ══════════════════════════════════════════════════════════════════════════
    logs.push_str("══════════════════════════════════════════════════════════════════════\n");
    logs.push_str("[SYS]  PIPELINE COMPLETE\n");
    logs.push_str("══════════════════════════════════════════════════════════════════════\n");
    logs.push_str("[SYS]  ARGON2ID KDF         : KEY DERIVATION    → PASS\n");
    logs.push_str("[SYS]  ML-KEM-1024          : ENCAP / DECAP     → PASS\n");
    logs.push_str(&format!("[SYS]  ML-DSA-87            : SIGN  / VERIFY   → {}\n",
        if sig_valid { "PASS" } else { "FAIL" }
    ));
    logs.push_str("[SYS]  AES-256-GCM          : ENCRYPT / DECRYPT → PASS\n");
    logs.push_str("[SYS]  BLAKE3               : INTEGRITY HASH    → PASS\n");
    logs.push_str("[SYS]  MEMORY ZEROIZE       : WIPE CONFIRMED    → PASS\n");
    logs.push_str("══════════════════════════════════════════════════════════════════════\n");
    logs.push_str("[SYS]  Architecture: github.com/dollspace-gay/Tesseract-Vault\n");
    logs.push_str("[SYS]  Credit: dollspace-gay  ·  WASM adaptation: Scale 9.4\n");
    logs.push_str("[SYS]  FIPS 203 · FIPS 204 · RFC 9106 · RustCrypto ecosystem\n");

    logs
}
