//! FIPS 203 / FIPS 204 known-answer gate for the aether seal (scent-aether P2, Task 1).
//!
//! Runs the NIST ACVP-Server vectors (commit 65370b8, see
//! tests/vectors/acvp-65370b8/SOURCE.md) against the exact crate versions
//! pinned in Cargo.toml: ml-kem =0.2.3 (ML-KEM-768) and ml-dsa =0.1.0-rc.7
//! (ML-DSA-65). Every labelled primitive in /SCENT and /CRYPTOGRAPHY follows
//! what passes here.
//!
//! Each test filters its groups by `parameterSet` and asserts the case count
//! it actually ran, so a bad filter can never pass vacuously.
#![allow(deprecated)] // ACVP sigGen/keyGen carry the FIPS 204 expanded sk encoding

use ml_dsa::{
    EncodedSignature, EncodedVerifyingKey, ExpandedSigningKey, KeyGen, MlDsa65, Signature,
    SigningKey, VerifyingKey, B32 as DsaB32,
};
use ml_kem::kem::Decapsulate;
use ml_kem::{
    Ciphertext, Encoded, EncodedSizeUser, EncapsulateDeterministic, KemCore, MlKem768, B32,
};
use serde_json::Value;

type DK = <MlKem768 as KemCore>::DecapsulationKey;
type EK = <MlKem768 as KemCore>::EncapsulationKey;

fn load(name: &str) -> Value {
    let path = format!("{}/tests/vectors/acvp-65370b8/{name}.json", env!("CARGO_MANIFEST_DIR"));
    let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    serde_json::from_str(&raw).expect("vector JSON")
}

fn hx(v: &Value, field: &str) -> Vec<u8> {
    let s = v[field].as_str().unwrap_or_else(|| panic!("missing hex field {field}"));
    hex::decode(s).unwrap_or_else(|e| panic!("{field}: {e}"))
}

/// Groups of one parameter set, optionally narrowed by a predicate on the group.
fn groups<'a>(file: &'a Value, set: &str) -> Vec<&'a Value> {
    file["testGroups"]
        .as_array()
        .expect("testGroups")
        .iter()
        .filter(|g| g["parameterSet"] == set)
        .collect()
}

fn tests_of(g: &Value) -> &Vec<Value> {
    g["tests"].as_array().expect("tests")
}

fn report(name: &str, ran: usize, expected: usize) {
    println!("{name}: {ran} cases");
    assert_eq!(ran, expected, "{name}: ran {ran} cases, expected {expected}");
}

// ── FIPS 204: ML-DSA-65 ─────────────────────────────────────────────────────

#[test]
fn mldsa65_keygen_kat() {
    let f = load("ML-DSA-keyGen");
    let mut ran = 0;
    for g in groups(&f, "ML-DSA-65") {
        for t in tests_of(g) {
            let seed = DsaB32::try_from(&hx(t, "seed")[..]).unwrap();
            let kp = MlDsa65::from_seed(&seed);
            assert_eq!(kp.verifying_key().encode().as_slice(), &hx(t, "pk")[..], "tc {} pk", t["tcId"]);
            assert_eq!(kp.signing_key().to_expanded().as_slice(), &hx(t, "sk")[..], "tc {} sk", t["tcId"]);
            ran += 1;
        }
    }
    report("mldsa65_keygen_kat", ran, 25);
}

#[test]
fn mldsa65_siggen_kat() {
    let f = load("ML-DSA-sigGen");
    let mut ran = 0;
    for g in groups(&f, "ML-DSA-65") {
        let deterministic = g["deterministic"].as_bool().expect("deterministic flag");
        for t in tests_of(g) {
            let sk_enc = ExpandedSigningKey::<MlDsa65>::try_from(&hx(t, "sk")[..]).unwrap();
            let sk = SigningKey::<MlDsa65>::from_expanded(&sk_enc);
            // FIPS 204 Algorithm 2: the deterministic variant uses rnd = {0}^32.
            let rnd = if deterministic {
                DsaB32::default()
            } else {
                DsaB32::try_from(&hx(t, "rnd")[..]).unwrap()
            };
            let msg = hx(t, "message");
            let sig = sk.sign_internal(&[&msg], &rnd);
            assert_eq!(sig.encode().as_slice(), &hx(t, "signature")[..], "tc {} signature", t["tcId"]);
            ran += 1;
        }
    }
    report("mldsa65_siggen_kat", ran, 20);
}

#[test]
fn mldsa65_sigver_kat() {
    let f = load("ML-DSA-sigVer");
    let (mut ran, mut passed, mut failed) = (0, 0, 0);
    for g in groups(&f, "ML-DSA-65") {
        let pk_enc = EncodedVerifyingKey::<MlDsa65>::try_from(&hx(g, "pk")[..]).unwrap();
        let vk = VerifyingKey::<MlDsa65>::decode(&pk_enc);
        for t in tests_of(g) {
            let expected = t["testPassed"].as_bool().expect("testPassed");
            let sig_bytes = hx(t, "signature");
            // A malformed encoding (e.g. too many hints) must decode to None and so not verify.
            let ok = EncodedSignature::<MlDsa65>::try_from(&sig_bytes[..])
                .ok()
                .and_then(|enc| Signature::<MlDsa65>::decode(&enc))
                .map(|sig| vk.verify_internal(&hx(t, "message"), &sig))
                .unwrap_or(false);
            assert_eq!(ok, expected, "tc {} ({})", t["tcId"], t["reason"]);
            if expected { passed += 1 } else { failed += 1 }
            ran += 1;
        }
    }
    report("mldsa65_sigver_kat", ran, 15);
    assert!(passed > 0 && failed > 0, "sigVer must exercise both outcomes ({passed} valid / {failed} invalid)");
}

// ── FIPS 203: ML-KEM-768 ────────────────────────────────────────────────────

#[test]
fn mlkem768_keygen_kat() {
    let f = load("ML-KEM-keyGen");
    let mut ran = 0;
    for g in groups(&f, "ML-KEM-768") {
        for t in tests_of(g) {
            let d = B32::try_from(&hx(t, "d")[..]).unwrap();
            let z = B32::try_from(&hx(t, "z")[..]).unwrap();
            let (dk, ek) = MlKem768::generate_deterministic(&d, &z);
            assert_eq!(ek.as_bytes().as_slice(), &hx(t, "ek")[..], "tc {} ek", t["tcId"]);
            assert_eq!(dk.as_bytes().as_slice(), &hx(t, "dk")[..], "tc {} dk", t["tcId"]);
            ran += 1;
        }
    }
    report("mlkem768_keygen_kat", ran, 25);
}

#[test]
fn mlkem768_encaps_kat() {
    let f = load("ML-KEM-encapDecap");
    let mut ran = 0;
    for g in groups(&f, "ML-KEM-768").into_iter().filter(|g| g["function"] == "encapsulation") {
        for t in tests_of(g) {
            let ek = EK::from_bytes(&Encoded::<EK>::try_from(&hx(t, "ek")[..]).unwrap());
            let m = B32::try_from(&hx(t, "m")[..]).unwrap();
            let (c, k) = ek.encapsulate_deterministic(&m).expect("encaps");
            assert_eq!(c.as_slice(), &hx(t, "c")[..], "tc {} c", t["tcId"]);
            assert_eq!(k.as_slice(), &hx(t, "k")[..], "tc {} k", t["tcId"]);
            ran += 1;
        }
    }
    report("mlkem768_encaps_kat", ran, 25);
}

#[test]
fn mlkem768_decaps_val() {
    let f = load("ML-KEM-encapDecap");
    let mut ran = 0;
    for g in groups(&f, "ML-KEM-768").into_iter().filter(|g| g["function"] == "decapsulation") {
        let dk = DK::from_bytes(&Encoded::<DK>::try_from(&hx(g, "dk")[..]).unwrap());
        for t in tests_of(g) {
            // Includes modified ciphertexts: FIPS 203 implicit rejection must yield the
            // vector's pseudo-random k, never an error.
            let c = Ciphertext::<MlKem768>::try_from(&hx(t, "c")[..]).unwrap();
            let k = dk.decapsulate(&c).expect("decaps");
            assert_eq!(k.as_slice(), &hx(t, "k")[..], "tc {} ({})", t["tcId"], t["reason"]);
            ran += 1;
        }
    }
    report("mlkem768_decaps_val", ran, 10);
}
