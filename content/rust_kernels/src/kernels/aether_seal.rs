// kernels/aether_seal.rs — the scent-aether seal primitives (spec §5.2).
// Scale 9.4
//
// Structured exports only (no log strings), for identityVault.js and accordSeal.js:
//
//   mlkem768_keygen()                 → { ek: Uint8Array(1184), dk: Uint8Array(2400) }   FIPS 203
//   mlkem768_encaps(ek)               → { ct: Uint8Array(1088), ss: Uint8Array(32) }
//   mlkem768_decaps(dk, ct)           → Uint8Array(32)  (implicit rejection on a bad ct)
//   mldsa65_keygen()                  → { pk: Uint8Array(1952), sk: Uint8Array(32) }     FIPS 204
//                                        sk is the 32-byte KeyGen seed ξ (Algorithm 1 input)
//   mldsa65_sign(sk, msg)             → Uint8Array(3309)  hedged ML-DSA.Sign, ctx = ""
//   mldsa65_verify(pk, msg, sig)      → bool              ML-DSA.Verify, ctx = ""
//   blake3_derive_key(context, ikm)   → Uint8Array(32)
//   argon2id_derive_key(pass, salt16) → Uint8Array(32)    m=64 MiB · t=3 · p=4 (RFC 9106 §4 option 2)
//   aether_seal_params()              → the parameter record the labels read
//
// Known-answer tests: tests/fips_kat.rs (NIST ACVP, ml-kem =0.2.3, ml-dsa =0.1.0-rc.7).
// Secrets cross the boundary by value (Vec<u8>) so this side can wipe its copy.
// Rust-owned secret inputs and intermediates are Zeroizing. What is returned to
// JS (dk, sk, ss, derived keys) is a copy in a JS Uint8Array that the JS callers
// fill(0) once used; a returned Vec<u8>'s staging buffer in WASM linear memory is
// freed by wasm-bindgen without a wipe. Wrong-length input is an Err, never a panic.

use wasm_bindgen::prelude::*;
use argon2::{Algorithm, Argon2, Params, Version};
use ml_dsa::{EncodedSignature, EncodedVerifyingKey, KeyGen, MlDsa65, Signature, VerifyingKey};
use ml_kem::kem::{Decapsulate, Encapsulate};
use ml_kem::{Ciphertext, Encoded, EncodedSizeUser, KemCore, MlKem768};
use rand_core::OsRng;
use zeroize::{Zeroize, Zeroizing};

type Dk = <MlKem768 as KemCore>::DecapsulationKey;
type Ek = <MlKem768 as KemCore>::EncapsulationKey;

pub const MLKEM768_EK_BYTES: usize = 1184;
pub const MLKEM768_DK_BYTES: usize = 2400;
pub const MLKEM768_CT_BYTES: usize = 1088;
pub const MLDSA65_PK_BYTES: usize = 1952;
pub const MLDSA65_SIG_BYTES: usize = 3309;
pub const ARGON2_M_KIB: u32 = 65_536;
pub const ARGON2_T: u32 = 3;
pub const ARGON2_P: u32 = 4;
pub const ARGON2_SALT_BYTES: usize = 16;
pub const MLKEM_CRATE: &str = "0.2.3";
pub const MLDSA_CRATE: &str = "0.1.0-rc.7";

pub(crate) struct KemPair { pub ek: Vec<u8>, pub dk: Zeroizing<Vec<u8>> }
pub(crate) struct KemEnc  { pub ct: Vec<u8>, pub ss: Zeroizing<Vec<u8>> }
pub(crate) struct DsaPair { pub pk: Vec<u8>, pub sk: Zeroizing<Vec<u8>> }

type R<T> = Result<T, &'static str>;

// ── ML-KEM-768 ──────────────────────────────────────────────────────────────

pub(crate) fn mlkem_keygen_inner() -> KemPair {
    let (dk, ek) = MlKem768::generate(&mut OsRng);
    KemPair { ek: ek.as_bytes().to_vec(), dk: Zeroizing::new(dk.as_bytes().to_vec()) }
}

pub(crate) fn mlkem_encaps_inner(ek: &[u8]) -> R<KemEnc> {
    let enc = Encoded::<Ek>::try_from(ek).map_err(|_| "ML-KEM-768 ek must be 1184 bytes")?;
    let ek = Ek::from_bytes(&enc);
    let (ct, ss) = ek.encapsulate(&mut OsRng).map_err(|_| "ML-KEM-768 encapsulation failed")?;
    Ok(KemEnc { ct: ct.to_vec(), ss: Zeroizing::new(ss.to_vec()) })
}

pub(crate) fn mlkem_decaps_inner(dk: &[u8], ct: &[u8]) -> R<Zeroizing<Vec<u8>>> {
    let ct = Ciphertext::<MlKem768>::try_from(ct).map_err(|_| "ML-KEM-768 ct must be 1088 bytes")?;
    let mut enc = Encoded::<Dk>::try_from(dk).map_err(|_| "ML-KEM-768 dk must be 2400 bytes")?;
    let dk = Dk::from_bytes(&enc); // ml-kem `zeroize` feature wipes this on drop
    enc.as_mut_slice().zeroize();
    let ss = dk.decapsulate(&ct).map_err(|_| "ML-KEM-768 decapsulation failed")?;
    Ok(Zeroizing::new(ss.to_vec()))
}

// ── ML-DSA-65 ───────────────────────────────────────────────────────────────

fn seed_from(sk: &[u8]) -> R<ml_dsa::B32> {
    ml_dsa::B32::try_from(sk).map_err(|_| "ML-DSA-65 sk (seed) must be 32 bytes")
}

pub(crate) fn mldsa_keygen_inner() -> DsaPair {
    let mut seed = Zeroizing::new([0u8; 32]);
    getrandom::getrandom(&mut seed[..]).expect("getrandom");
    let kp = MlDsa65::from_seed(&ml_dsa::B32::from(*seed));
    DsaPair { pk: kp.verifying_key().encode().to_vec(), sk: Zeroizing::new(seed.to_vec()) }
}

/// FIPS 204 Algorithm 2 (ML-DSA.Sign): M' = 0x00 ‖ |ctx| ‖ ctx ‖ M with ctx = "",
/// then Sign_internal(sk, M', rnd).
pub(crate) fn mldsa_sign_with_rnd(sk: &[u8], msg: &[u8], rnd: &[u8; 32]) -> R<Vec<u8>> {
    let kp = MlDsa65::from_seed(&seed_from(sk)?);
    let sig = kp.signing_key().sign_internal(&[&[0u8, 0u8], msg], &ml_dsa::B32::from(*rnd));
    Ok(sig.encode().to_vec())
}

pub(crate) fn mldsa_sign_inner(sk: &[u8], msg: &[u8]) -> R<Vec<u8>> {
    let mut rnd = Zeroizing::new([0u8; 32]);
    getrandom::getrandom(&mut rnd[..]).map_err(|_| "getrandom failed")?;
    mldsa_sign_with_rnd(sk, msg, &rnd)
}

pub(crate) fn mldsa_verify_inner(pk: &[u8], msg: &[u8], sig: &[u8]) -> R<bool> {
    let pk = EncodedVerifyingKey::<MlDsa65>::try_from(pk).map_err(|_| "ML-DSA-65 pk must be 1952 bytes")?;
    let sig = EncodedSignature::<MlDsa65>::try_from(sig).map_err(|_| "ML-DSA-65 signature must be 3309 bytes")?;
    let vk = VerifyingKey::<MlDsa65>::decode(&pk);
    Ok(Signature::<MlDsa65>::decode(&sig).is_some_and(|s| vk.verify_with_context(msg, &[], &s)))
}

// ── BLAKE3 / Argon2id ───────────────────────────────────────────────────────

pub(crate) fn blake3_derive_inner(context: &str, ikm: &[u8]) -> [u8; 32] {
    blake3::derive_key(context, ikm)
}

pub(crate) fn argon2id_inner(passphrase: &[u8], salt: &[u8]) -> R<Zeroizing<[u8; 32]>> {
    if salt.len() != ARGON2_SALT_BYTES { return Err("Argon2id salt must be 16 bytes"); }
    let params = Params::new(ARGON2_M_KIB, ARGON2_T, ARGON2_P, Some(32)).map_err(|_| "Argon2id params")?;
    let mut out = Zeroizing::new([0u8; 32]);
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(passphrase, salt, &mut out[..])
        .map_err(|_| "Argon2id derivation failed")?;
    Ok(out)
}

// ── wasm-bindgen surface ────────────────────────────────────────────────────

fn bytes(b: &[u8]) -> JsValue { js_sys::Uint8Array::from(b).into() }

fn obj(fields: &[(&str, JsValue)]) -> Result<JsValue, JsError> {
    let o = js_sys::Object::new();
    for (k, v) in fields {
        js_sys::Reflect::set(&o, &JsValue::from_str(k), v).map_err(|_| JsError::new("Reflect::set"))?;
    }
    Ok(o.into())
}

#[wasm_bindgen]
pub fn mlkem768_keygen() -> Result<JsValue, JsError> {
    let kp = mlkem_keygen_inner();
    obj(&[("ek", bytes(&kp.ek)), ("dk", bytes(&kp.dk))])
}

#[wasm_bindgen]
pub fn mlkem768_encaps(ek: &[u8]) -> Result<JsValue, JsError> {
    let enc = mlkem_encaps_inner(ek).map_err(JsError::new)?;
    obj(&[("ct", bytes(&enc.ct)), ("ss", bytes(&enc.ss))])
}

#[wasm_bindgen]
pub fn mlkem768_decaps(dk: Vec<u8>, ct: &[u8]) -> Result<Vec<u8>, JsError> {
    let dk = Zeroizing::new(dk);
    Ok(mlkem_decaps_inner(&dk, ct).map_err(JsError::new)?.to_vec())
}

#[wasm_bindgen]
pub fn mldsa65_keygen() -> Result<JsValue, JsError> {
    let kp = mldsa_keygen_inner();
    obj(&[("pk", bytes(&kp.pk)), ("sk", bytes(&kp.sk))])
}

#[wasm_bindgen]
pub fn mldsa65_sign(sk: Vec<u8>, msg: &[u8]) -> Result<Vec<u8>, JsError> {
    let sk = Zeroizing::new(sk);
    mldsa_sign_inner(&sk, msg).map_err(JsError::new)
}

#[wasm_bindgen]
pub fn mldsa65_verify(pk: &[u8], msg: &[u8], sig: &[u8]) -> Result<bool, JsError> {
    mldsa_verify_inner(pk, msg, sig).map_err(JsError::new)
}

#[wasm_bindgen]
pub fn blake3_derive_key(context: &str, ikm: Vec<u8>) -> Vec<u8> {
    let ikm = Zeroizing::new(ikm);
    let k = Zeroizing::new(blake3_derive_inner(context, &ikm));
    k.to_vec()
}

#[wasm_bindgen]
pub fn argon2id_derive_key(passphrase: Vec<u8>, salt: &[u8]) -> Result<Vec<u8>, JsError> {
    let passphrase = Zeroizing::new(passphrase);
    Ok(argon2id_inner(&passphrase, salt).map_err(JsError::new)?.to_vec())
}

#[wasm_bindgen]
pub fn aether_seal_params() -> Result<JsValue, JsError> {
    let argon = obj(&[
        ("m_kib", JsValue::from(ARGON2_M_KIB)),
        ("t", JsValue::from(ARGON2_T)),
        ("p", JsValue::from(ARGON2_P)),
    ])?;
    obj(&[
        ("mlkem", JsValue::from_str("ML-KEM-768")),
        ("mldsa", JsValue::from_str("ML-DSA-65")),
        ("mlkem_crate", JsValue::from_str(MLKEM_CRATE)),
        ("mldsa_crate", JsValue::from_str(MLDSA_CRATE)),
        ("argon2", argon),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mlkem768_round_trip_and_lengths() {
        let kp = mlkem_keygen_inner();
        assert_eq!((kp.ek.len(), kp.dk.len()), (MLKEM768_EK_BYTES, MLKEM768_DK_BYTES));
        let enc = mlkem_encaps_inner(&kp.ek).unwrap();
        assert_eq!((enc.ct.len(), enc.ss.len()), (MLKEM768_CT_BYTES, 32));
        let ss = mlkem_decaps_inner(&kp.dk, &enc.ct).unwrap();
        assert_eq!(&ss[..], &enc.ss[..]);
    }

    #[test]
    fn mlkem768_tampered_ct_yields_a_different_secret() {
        // FIPS 203 implicit rejection: no error, a pseudo-random key instead.
        let kp = mlkem_keygen_inner();
        let mut enc = mlkem_encaps_inner(&kp.ek).unwrap();
        enc.ct[0] ^= 1;
        assert_ne!(&mlkem_decaps_inner(&kp.dk, &enc.ct).unwrap()[..], &enc.ss[..]);
    }

    #[test]
    fn mlkem768_wrong_lengths_are_errors_not_panics() {
        let kp = mlkem_keygen_inner();
        assert!(mlkem_encaps_inner(&kp.ek[1..]).is_err());
        assert!(mlkem_decaps_inner(&kp.dk[1..], &[0u8; MLKEM768_CT_BYTES]).is_err());
        assert!(mlkem_decaps_inner(&kp.dk, &[0u8; MLKEM768_CT_BYTES - 1]).is_err());
    }

    #[test]
    fn mldsa65_round_trip_lengths_and_tamper() {
        let kp = mldsa_keygen_inner();
        assert_eq!((kp.pk.len(), kp.sk.len()), (MLDSA65_PK_BYTES, 32));
        let msg = b"scale94 aether";
        let sig = mldsa_sign_inner(&kp.sk, msg).unwrap();
        assert_eq!(sig.len(), MLDSA65_SIG_BYTES);
        assert!(mldsa_verify_inner(&kp.pk, msg, &sig).unwrap());
        assert!(!mldsa_verify_inner(&kp.pk, b"scale94 aethe!", &sig).unwrap());
        let mut bad = sig.clone();
        bad[100] ^= 1;
        assert!(!mldsa_verify_inner(&kp.pk, msg, &bad).unwrap());
    }

    #[test]
    fn mldsa65_sign_is_fips204_algorithm2_with_empty_context() {
        // With rnd = 0^32 the hedged path must equal the crate's own
        // ML-DSA.Sign deterministic variant over (M, ctx = "").
        let kp = mldsa_keygen_inner();
        let msg = b"one accord at a time";
        let ours = mldsa_sign_with_rnd(&kp.sk, msg, &[0u8; 32]).unwrap();
        let seed = ml_dsa::B32::try_from(&kp.sk[..]).unwrap();
        let theirs = MlDsa65::from_seed(&seed).signing_key().sign_deterministic(msg, &[]).unwrap();
        assert_eq!(&ours[..], theirs.encode().as_slice());
    }

    #[test]
    fn mldsa65_hedged_signatures_differ() {
        let kp = mldsa_keygen_inner();
        assert_ne!(mldsa_sign_inner(&kp.sk, b"m").unwrap(), mldsa_sign_inner(&kp.sk, b"m").unwrap());
    }

    #[test]
    fn mldsa65_wrong_lengths_are_errors_not_panics() {
        let kp = mldsa_keygen_inner();
        assert!(mldsa_sign_inner(&kp.sk[1..], b"m").is_err());
        let sig = mldsa_sign_inner(&kp.sk, b"m").unwrap();
        assert!(mldsa_verify_inner(&kp.pk[1..], b"m", &sig).is_err());
        assert!(mldsa_verify_inner(&kp.pk, b"m", &sig[1..]).is_err());
    }

    #[test]
    fn blake3_derive_key_matches_the_crate() {
        let ikm = [7u8; 32];
        assert_eq!(blake3_derive_inner("scale94 scent accord seal v1", &ikm), blake3::derive_key("scale94 scent accord seal v1", &ikm));
    }

    #[test]
    fn argon2id_pins_rfc9106_option_2() {
        // Self-consistency against the argon2 crate with the stated parameters:
        // pins m/t/p/len so a silent parameter change fails here.
        assert_eq!((ARGON2_M_KIB, ARGON2_T, ARGON2_P), (65_536, 3, 4));
        let salt = [9u8; 16];
        let ours = argon2id_inner(b"correct horse battery", &salt).unwrap();
        let params = Params::new(65_536, 3, 4, Some(32)).unwrap();
        let mut theirs = [0u8; 32];
        Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
            .hash_password_into(b"correct horse battery", &salt, &mut theirs)
            .unwrap();
        assert_eq!(&ours[..], &theirs[..]);
    }

    #[test]
    fn argon2id_requires_a_16_byte_salt() {
        assert!(argon2id_inner(b"pw", &[0u8; 15]).is_err());
        assert!(argon2id_inner(b"pw", &[0u8; 17]).is_err());
    }
}
