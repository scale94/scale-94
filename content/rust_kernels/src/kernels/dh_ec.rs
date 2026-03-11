// kernels/dh_ec.rs — DH-EC Cryptographic Architecture Kernel (scale94)
//
// Classical Diffie-Hellman (finite field) · ECDH Curve25519
// Signal X3DH (Extended Triple Diffie-Hellman) · Threema NaCl box
// Cryptographic comparison engine v1.0.0
//
// Additional Cargo.toml dependencies required:
//   x25519-dalek  = { version = "2.0", features = ["static_secrets"] }
//   sha2          = "0.10"
//   hkdf          = "0.12"
//   rand_core     = { version = "0.6", features = ["getrandom"] }
//   getrandom     = { version = "0.2", features = ["js"] }

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;
use rand_core::{OsRng, RngCore};
use sha2::Sha256;
use hkdf::Hkdf;

// ─── Inline hex encoder ───────────────────────────────────────────────────────
// Avoids the `hex` crate dependency; identical output to hex::encode().
#[inline]
fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(DIGITS[(b >> 4) as usize] as char);
        s.push(DIGITS[(b & 0xf) as usize] as char);
    }
    s
}

// ─── I. Classical Diffie-Hellman (finite field, 64-bit Mersenne prime) ────────

/// Fast modular exponentiation — square-and-multiply O(log exp).
fn mod_pow(mut base: u64, mut exp: u64, modulus: u64) -> u64 {
    if modulus == 1 { return 0; }
    let mut result: u64 = 1;
    base %= modulus;
    while exp > 0 {
        if exp & 1 == 1 { result = result.wrapping_mul(base) % modulus; }
        exp >>= 1;
        base = base.wrapping_mul(base) % modulus;
    }
    result
}

struct ClassicalDH {
    prime:       u64,
    generator:   u64,
    private_key: u64,
    pub_key:     u64,
}

impl ClassicalDH {
    /// M31 Mersenne prime (2³¹−1). Production minimum: RFC 3526 Group 14 (2048-bit).
    fn new() -> Self {
        let prime:     u64 = 2_147_483_647; // M31 — Mersenne prime 2^31 − 1
        let generator: u64 = 7;
        let mut buf = [0u8; 8];
        OsRng.fill_bytes(&mut buf);
        // Private key in [2, p−2]
        let private_key = 2 + (u64::from_be_bytes(buf) % (prime - 4));
        let pub_key     = mod_pow(generator, private_key, prime);
        ClassicalDH { prime, generator, private_key, pub_key }
    }
    fn compute_shared(&self, peer: u64) -> u64 {
        mod_pow(peer, self.private_key, self.prime)
    }
    fn derive_key(&self, secret: u64) -> [u8; 32] {
        use sha2::Digest;
        let mut h = Sha256::new();
        h.update(secret.to_be_bytes());
        h.finalize().into()
    }
}

impl Drop for ClassicalDH {
    fn drop(&mut self) { self.private_key = 0; }
}

// ─── II. Elliptic Curve Diffie-Hellman — Curve25519 ──────────────────────────

struct ECParty {
    secret: x25519_dalek::StaticSecret,
    public: x25519_dalek::PublicKey,
}

impl ECParty {
    fn new() -> Self {
        let secret = x25519_dalek::StaticSecret::random_from_rng(OsRng);
        let public = x25519_dalek::PublicKey::from(&secret);
        ECParty { secret, public }
    }
    fn ecdh(&self, peer: &x25519_dalek::PublicKey) -> x25519_dalek::SharedSecret {
        self.secret.diffie_hellman(peer)
    }
    fn derive_session_key(&self, shared: &x25519_dalek::SharedSecret, info: &[u8]) -> [u8; 32] {
        let hk = Hkdf::<Sha256>::new(Some(b"scale94-dh-ec-kernel-v1"), shared.as_bytes());
        let mut okm = [0u8; 32];
        let _ = hk.expand(info, &mut okm);
        okm
    }
}

// ─── III. Signal X3DH key bundle ──────────────────────────────────────────────

struct X3DHBundle {
    identity_key:    ECParty,   // IK — long-term, permanent
    signed_prekey:   ECParty,   // SPK — medium-term, rotated weekly/monthly
    one_time_prekey: ECParty,   // OPK — single-use, consumed on first message
}

impl X3DHBundle {
    fn new() -> Self {
        X3DHBundle {
            identity_key:    ECParty::new(),
            signed_prekey:   ECParty::new(),
            one_time_prekey: ECParty::new(),
        }
    }
}

/// Signal X3DH session initiation — four ECDH operations → HKDF-SHA256.
/// Returns (master_secret_32, trace_string).
fn x3dh_initiate(alice: &X3DHBundle, bob: &X3DHBundle) -> ([u8; 32], &'static str) {
    let ek = ECParty::new(); // Alice's ephemeral key — fresh per session

    // DH1: Alice IK  × Bob SPK  → authenticates Alice to Bob's signed prekey
    // DH2: Alice EK  × Bob IK   → authenticates Bob's long-term identity
    // DH3: Alice EK  × Bob SPK  → binds ephemeral key to Bob's medium-term key
    // DH4: Alice EK  × Bob OPK  → one-time forward secrecy (never reproducible)
    let dh1 = alice.identity_key.ecdh(&bob.signed_prekey.public);
    let dh2 = ek.ecdh(&bob.identity_key.public);
    let dh3 = ek.ecdh(&bob.signed_prekey.public);
    let dh4 = ek.ecdh(&bob.one_time_prekey.public);

    // KDF input: DH1 ∥ DH2 ∥ DH3 ∥ DH4 (128 bytes, stack-allocated)
    let mut ikm = [0u8; 128];
    ikm[  0.. 32].copy_from_slice(dh1.as_bytes());
    ikm[ 32.. 64].copy_from_slice(dh2.as_bytes());
    ikm[ 64.. 96].copy_from_slice(dh3.as_bytes());
    ikm[ 96..128].copy_from_slice(dh4.as_bytes());

    let hk = Hkdf::<Sha256>::new(Some(b"x3dh-signal-v1"), &ikm);
    let mut master = [0u8; 32];
    let _ = hk.expand(b"signal-session-key", &mut master);

    (master, "DH1(IK_A×SPK_B) ∥ DH2(EK_A×IK_B) ∥ DH3(EK_A×SPK_B) ∥ DH4(EK_A×OPK_B) → HKDF-SHA256")
}

// ─── IV. Threema NaCl box architecture ───────────────────────────────────────

/// Threema: single ECDH on long-term identity keys → HKDF → XSalsa20-Poly1305.
/// No ephemeral keys. No one-time prekeys. No Double Ratchet.
fn threema_exchange(alice_id: &ECParty, bob_id: &ECParty) -> ([u8; 32], &'static str) {
    let shared = alice_id.ecdh(&bob_id.public);
    let hk = Hkdf::<Sha256>::new(Some(b"threema-nacl-v1"), shared.as_bytes());
    let mut key = [0u8; 32];
    let _ = hk.expand(b"threema-session-key", &mut key);
    (key, "ECDH(IK_A×IK_B) → HKDF-SHA256 → XSalsa20-Poly1305 (NaCl box)")
}

// ─── WASM export ──────────────────────────────────────────────────────────────

/// DH-EC Cryptographic Architecture Kernel.
///
/// mode:
///   0 = full comparison (all sections)
///   1 = Classical DH only
///   2 = Curve25519 ECDH only
///   3 = Signal X3DH only
///   4 = Threema NaCl only
///   5 = Comparison matrix only
///
/// show_details:
///   0 = compact (keys abbreviated to 16 hex chars)
///   1 = verbose (full 32-byte hex keys + analysis notes)
#[wasm_bindgen]
pub fn run_dh_ec_kernel(mode: f64, show_details: f64) -> String {
    let mode    = (mode as u32).min(5);
    let verbose = show_details as u32 != 0;

    let sep  = "══════════════════════════════════════════════════════════════════════";
    let dash = "──────────────────────────────────────────────────────────────────────";

    let mode_label = match mode {
        1 => "CLASSICAL_DH",
        2 => "CURVE25519",
        3 => "SIGNAL_X3DH",
        4 => "THREEMA_NaCl",
        5 => "MATRIX_ONLY",
        _ => "FULL_COMPARISON",
    };

    let mut out = String::with_capacity(4096);
    write!(out,
        "DH_EC_KERNEL v1.0.0 // SOMA-9.1\n\
         {sep}\n\
         CRYPTOGRAPHIC ARCHITECTURE COMPARISON\n\
         MODE: {mode_label}   DETAIL: {detail}\n\
         {sep}\n",
        sep = sep, mode_label = mode_label,
        detail = if verbose { "VERBOSE" } else { "COMPACT" },
    ).unwrap();

    // Helper to format a 32-byte key according to verbosity level
    let fmt_key = |bytes: &[u8; 32]| -> String {
        if verbose {
            to_hex(bytes)
        } else {
            format!("{}…", &to_hex(bytes)[..16])
        }
    };

    // ── I. Classical DH ──────────────────────────────────────────────────────
    if mode == 0 || mode == 1 {
        write!(out, "\nᚱ I. CLASSICAL DIFFIE-HELLMAN (FINITE FIELD)\n{dash}\n", dash = dash).unwrap();

        let alice = ClassicalDH::new();
        let bob   = ClassicalDH::new();
        let alice_s = alice.compute_shared(bob.pub_key);
        let bob_s   = bob.compute_shared(alice.pub_key);
        let matched = alice_s == bob_s;
        let derived = alice.derive_key(alice_s);

        write!(out,
            "  Prime (p):            {} (M31 — Mersenne 2³¹−1)\n\
               Generator (g):        {}\n\
             {dash}\n\
               Alice public key:     {}\n\
               Bob public key:       {}\n\
             {dash}\n\
               Alice shared secret:  {}\n\
               Bob shared secret:    {}\n\
               Secrets match:        {}\n\
             {dash}\n\
               Derived key (SHA256): {}\n",
            alice.prime, alice.generator,
            alice.pub_key, bob.pub_key,
            alice_s, bob_s,
            if matched { "✓ YES" } else { "✗ NO" },
            fmt_key(&derived),
            dash = dash,
        ).unwrap();

        if verbose {
            write!(out,
                "  Hard problem:         Discrete log in (Z/pZ)*\n\
                   Best attack:          Index calculus / number field sieve (sub-exponential)\n\
                   Key size:             2048-bit DH ≈ 112-bit symmetric security\n\
                   Forward secrecy:      Only if ephemeral keys used per session\n\
                   Quantum threat:       Shor's algorithm — polynomial time break\n",
            ).unwrap();
        }
    }

    // ── II. Curve25519 ECDH ──────────────────────────────────────────────────
    if mode == 0 || mode == 2 {
        write!(out, "\nᚹ II. ELLIPTIC CURVE DIFFIE-HELLMAN — CURVE25519\n{dash}\n", dash = dash).unwrap();

        let alice = ECParty::new();
        let bob   = ECParty::new();
        let alice_s = alice.ecdh(&bob.public);
        let bob_s   = bob.ecdh(&alice.public);
        let matched = alice_s.as_bytes() == bob_s.as_bytes();
        let sk = alice.derive_session_key(&alice_s, b"demo-session");

        write!(out,
            "  Curve:                X25519 (Montgomery y²=x³+486662x²+x, GF(2²⁵⁵−19))\n\
             {dash}\n\
               Alice public key:     {}\n\
               Bob public key:       {}\n\
             {dash}\n\
               Alice shared secret:  {}\n\
               Bob shared secret:    {}\n\
               Secrets match:        {}\n\
             {dash}\n\
               HKDF session key:     {}\n",
            fmt_key(alice.public.as_bytes()),
            fmt_key(bob.public.as_bytes()),
            fmt_key(alice_s.as_bytes()),
            fmt_key(bob_s.as_bytes()),
            if matched { "✓ YES" } else { "✗ NO" },
            fmt_key(&sk),
            dash = dash,
        ).unwrap();

        if verbose {
            write!(out,
                "  Hard problem:         ECDLP — best attack O(√p) Pollard rho (exponential)\n\
                   Security:             ~128-bit symmetric (vs 112-bit for 2048-bit DH)\n\
                   Key size:             32 bytes — 8× smaller than equivalent DH\n\
                   Side-channel:         Constant-time by construction (x25519-dalek)\n\
                   Quantum threat:       Shor's algorithm still applies to ECDLP\n",
            ).unwrap();
        }
    }

    // ── III. Signal X3DH ─────────────────────────────────────────────────────
    if mode == 0 || mode == 3 {
        write!(out, "\nᚷ III. SIGNAL X3DH — EXTENDED TRIPLE DIFFIE-HELLMAN\n{dash}\n", dash = dash).unwrap();

        let alice_b = X3DHBundle::new();
        let bob_b   = X3DHBundle::new();
        let (master, trace) = x3dh_initiate(&alice_b, &bob_b);

        write!(out,
            "  Protocol:             {trace}\n\
             {dash}\n\
               Master secret:        {master}\n",
            dash = dash, trace = trace,
            master = fmt_key(&master),
        ).unwrap();

        if verbose {
            write!(out,
                "  Bob's key bundle:\n\
                     IK  (identity):     {}  [permanent]\n\
                     SPK (signed prekey):{}  [weekly rotation]\n\
                     OPK (one-time):     {}  [consumed on first use]\n\
                 {dash}\n\
                 ─ Properties ──────────────────────────────────────────────────────────\n\
                   Forward secrecy:    ✓ Per-message (Double Ratchet post-X3DH)\n\
                   Async initiation:   ✓ Bob offline during session start\n\
                   Deniability:        ✓ No long-term signatures on messages\n\
                   Post-compromise:    ✓ Double Ratchet heals after key exposure\n\
                   Phone requirement:  ✗ Required (identity bound to phone number)\n\
                   Metadata:           ✗ Server sees sender/recipient/timestamp\n",
                to_hex(bob_b.identity_key.public.as_bytes()),
                to_hex(bob_b.signed_prekey.public.as_bytes()),
                to_hex(bob_b.one_time_prekey.public.as_bytes()),
                dash = dash,
            ).unwrap();
        }
    }

    // ── IV. Threema NaCl ─────────────────────────────────────────────────────
    if mode == 0 || mode == 4 {
        write!(out, "\nᚾ IV. THREEMA — NaCl BOX ARCHITECTURE\n{dash}\n", dash = dash).unwrap();

        let alice_t = ECParty::new();
        let bob_t   = ECParty::new();
        let (key, trace) = threema_exchange(&alice_t, &bob_t);

        write!(out,
            "  Protocol:             {trace}\n\
             {dash}\n\
               Session key:          {key}\n",
            dash = dash, trace = trace,
            key = fmt_key(&key),
        ).unwrap();

        if verbose {
            write!(out,
                "  Alice IK:             {}  [long-term]\n\
                   Bob IK:               {}  [long-term]\n\
                 {dash}\n\
                 ─ Properties ──────────────────────────────────────────────────────────\n\
                   Forward secrecy:    ✗ Long-term keys only — no per-session ephemeral\n\
                   Async initiation:   ✓ ID-based (Threema ID = public key hash)\n\
                   Phone requirement:  ✓ Not required — identity decoupled from phone\n\
                   Metadata:           ✓ Sender ID obfuscated in transit\n\
                   Server trust:       ✓ No server-side prekey custody\n\
                   Jurisdiction:       ✓ Switzerland (Threema GmbH, CH law)\n",
                to_hex(alice_t.public.as_bytes()),
                to_hex(bob_t.public.as_bytes()),
                dash = dash,
            ).unwrap();
        }
    }

    // ── V. Comparison matrix ─────────────────────────────────────────────────
    if mode == 0 || mode == 5 {
        let row = |out: &mut String, prop: &str, sig: &str, th: &str| {
            write!(out, "  {:<28} {:<24} {}\n", prop, sig, th).unwrap();
        };

        write!(out, "\nᛟ V. COMPARISON MATRIX\n{dash}\n", dash = dash).unwrap();
        row(&mut out, "PROPERTY", "SIGNAL", "THREEMA");
        write!(out, "  {}\n", dash).unwrap();
        row(&mut out, "Key exchange",        "X3DH — 4× ECDH",      "NaCl box — 1× ECDH");
        row(&mut out, "Curve",               "Curve25519",           "Curve25519");
        row(&mut out, "Symmetric cipher",    "AES-256-CBC / CTR",    "XSalsa20");
        row(&mut out, "MAC",                 "HMAC-SHA256",          "Poly1305");
        row(&mut out, "KDF",                 "HKDF-SHA256",          "HKDF-SHA256");
        row(&mut out, "Forward secrecy",     "✓ Per-message",        "✗ Session-level");
        row(&mut out, "Post-compromise sec.","✓ Double Ratchet",     "✗ None");
        row(&mut out, "Async initiation",    "✓ Prekey bundle",      "✓ ID-based");
        row(&mut out, "Phone required",      "✓ Yes",                "✗ No");
        row(&mut out, "Metadata protection", "✗ Partial",            "✓ Stronger");
        row(&mut out, "Deniability",         "✓ Full",               "~ Partial");
        row(&mut out, "Open source",         "✓ Full",               "✓ Full");
        row(&mut out, "Server location",     "USA (Signal Fdn)",     "Switzerland");
        row(&mut out, "Business model",      "Donations",            "Paid app");

        write!(out,
            "{sep}\n\
             VERDICT\n\
             {sep}\n\
             Signal:  X3DH + Double Ratchet — state-of-the-art forward secrecy.\n\
                      Weakness: phone number requirement + US jurisdiction.\n\n\
             Threema: Simpler NaCl architecture — no per-message forward secrecy.\n\
                      Wins on identity privacy (no phone), metadata protection,\n\
                      Swiss jurisdiction. NaCl is battle-tested and multiply audited.\n\n\
             Threat model determines choice:\n\
               Mass surveillance  → Signal (forward secrecy critical at scale)\n\
               Identity privacy   → Threema (no phone number)\n\
               Maximum threat     → Threema + Signal on separate devices\n\
             {sep}\n\
             SOURCE: content/rust_kernels/src/kernels/dh_ec.rs\n",
            sep = sep,
        ).unwrap();
    }

    out
}
