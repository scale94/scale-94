# NIST ACVP known-answer vectors: ML-KEM-768 (FIPS 203) and ML-DSA-65 (FIPS 204)

- **Source:** https://github.com/usnistgov/ACVP-Server, commit `65370b8`. That's the commit the `ml-dsa` crate's own test README cites. Each file is the `internalProjection.json` (inputs plus expected outputs) from the directory below.
- **Fetched:** 2026-11-27 from `https://raw.githubusercontent.com/usnistgov/ACVP-Server/65370b8/<path>`.
- **Filter:** each file is the original JSON with `testGroups` kept only where `parameterSet` is `ML-DSA-65` or `ML-KEM-768`. Nothing else is changed: no group or test fields are edited, removed or reordered. It's re-serialised with 1-space indent.
- **SHA-256** is of the *unfiltered* download, so anyone can re-fetch and re-filter to check.
- **Used by:** `content/rust_kernels/tests/fips_kat.rs` (`cargo test --test fips_kat`).

| File | Upstream path | SHA-256 (unfiltered) | Groups kept |
|---|---|---|---|
| `ML-DSA-keyGen.json` | `gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json` | `2313cda283d8e7ebd196c04a211c30fd9c471f99ae7e1af844e75683071a4043` | tg2 ML-DSA-65 ×25 |
| `ML-DSA-sigGen.json` | `gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json` | `f4004278e7dcf0ddaaad3dcef06dd2445ec8b488e546cc376e1b9bcdfd9802de` | tg3 ML-DSA-65 det ×10, tg4 ML-DSA-65 hedged ×10 |
| `ML-DSA-sigVer.json` | `gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json` | `033a8b8a5f45d7a9b158b493efa5502a1fa697b00ee66037e11d84d5a30ab93a` | tg2 ML-DSA-65 ×15 |
| `ML-KEM-keyGen.json` | `gen-val/json-files/ML-KEM-keyGen-FIPS203/internalProjection.json` | `0fdca41ed30f49c828af80c73a6424ece3accc1e3430ae14492363aaadeb0e48` | tg2 ML-KEM-768 ×25 |
| `ML-KEM-encapDecap.json` | `gen-val/json-files/ML-KEM-encapDecap-FIPS203/internalProjection.json` | `4b5afd6c7075b1ffebc099a70dcf907b189daadd42921223127732e3ec83c333` | tg2 ML-KEM-768 encapsulation ×25, tg5 ML-KEM-768 decapsulation ×10 |
## Gate verdict (2026-11-27)

`cargo test --test fips_kat`: **6/6 pass** on `ml-kem =0.2.3` and `ml-dsa =0.1.0-rc.7`. That's 25 ML-DSA-65 keyGen, 20 sigGen (10 deterministic, 10 hedged), 15 sigVer (valid and invalid), 25 ML-KEM-768 keyGen, 25 encapsulation and 10 decapsulation (including implicit rejection).

A mutation check (one hex digit flipped in an expected field of each file) fails all 6 tests. ML-DSA-65 is confirmed: no fallback to 87, and the labels say 65.
