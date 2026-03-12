// kernels/pqhash.rs — Post-Quantum Hash Audit v1.0
//
// Evaluates classical vs post-quantum security margins for common hash
// algorithm families under Grover's search and the BHT collision algorithm.
//
// Parameters:
//   input_bits  — size of the preimage being hashed (e.g. 256.0 for a key)
//   hash_bits   — digest output size: 128 / 256 / 384 / 512
//   algorithm   — 0=SHA-256  1=SHA-3-256  2=BLAKE3  3=Argon2id
//   quantum_adv — quantum advantage era: 1.0=NISQ  2.0=fault-tolerant
//
// Security model (NIST SP 800-57 / NIST IR 8413):
//   classical preimage   : hash_bits
//   quantum preimage     : hash_bits / 2          (Grover 1996)
//   classical collision  : hash_bits / 2          (birthday paradox)
//   quantum collision    : hash_bits / 3          (Brassard-Høyer-Tapp 1998)
//   post-quantum level   : min(quantum_preimage, quantum_collision)

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

// ─── ALGORITHM TABLE ─────────────────────────────────────────────────────────

struct AlgoInfo {
    name:        &'static str,
    family:      &'static str,
    pqc_status:  &'static str,
    nist_note:   &'static str,
    memory_hard: bool,    // memory-hard (Argon2, bcrypt, scrypt)
}

const ALGORITHMS: [AlgoInfo; 4] = [
    AlgoInfo {
        name:        "SHA-256",
        family:      "Merkle–Damgård / Davies–Meyer",
        pqc_status:  "conditional",
        nist_note:   "NIST SP 800-57: requires 256-bit digest for 128-bit PQ security",
        memory_hard: false,
    },
    AlgoInfo {
        name:        "SHA-3-256",
        family:      "Keccak sponge (FIPS 202)",
        pqc_status:  "recommended",
        nist_note:   "NIST FIPS 202: sponge construction immune to length-extension; PQ-safe at 256+",
        memory_hard: false,
    },
    AlgoInfo {
        name:        "BLAKE3",
        family:      "Merkle tree / ARX permutation",
        pqc_status:  "recommended",
        nist_note:   "Extendable output; 256-bit mode gives 128-bit PQ preimage security",
        memory_hard: false,
    },
    AlgoInfo {
        name:        "Argon2id",
        family:      "Memory-Hard Function (PHC winner)",
        pqc_status:  "strong",
        nist_note:   "NIST SP 800-63B: memory-hardness raises quantum attack cost by memory factor",
        memory_hard: true,
    },
];

// ─── VERDICT ─────────────────────────────────────────────────────────────────

fn verdict(pq_bits: f64) -> &'static str {
    if pq_bits >= 128.0 { "QUANTUM_SAFE" }
    else if pq_bits >= 64.0 { "DEGRADED" }
    else { "BROKEN" }
}

fn verdict_symbol(pq_bits: f64) -> &'static str {
    if pq_bits >= 128.0 { "✓" }
    else if pq_bits >= 64.0 { "⚠" }
    else { "✗" }
}

// ─── GROVER SPEEDUP DESCRIPTION ──────────────────────────────────────────────
// Returns a human-readable order-of-magnitude for 2^(n/2) quantum speedup.

fn grover_speedup_label(hash_bits: f64) -> (&'static str, f64) {
    let exp = hash_bits / 2.0;
    let label = if exp >= 128.0      { "2^128 classical ops → 2^64 quantum ops" }
                else if exp >= 64.0  { "2^64 classical ops → 2^32 quantum ops"  }
                else if exp >= 32.0  { "2^32 classical ops → 2^16 quantum ops"  }
                else                 { "trivially broken in either model"        };
    (label, exp)
}

// ─── MAIN KERNEL ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn run_pqhash_analysis(
    input_bits:  f64,
    hash_bits:   f64,
    algorithm:   f64,
    quantum_adv: f64,
) -> String {
    // ── clamp / normalise inputs ─────────────────────────────────────────────
    let h_bits    = hash_bits.clamp(64.0, 512.0);
    let algo_idx  = (algorithm as usize).clamp(0, 3);
    let q_adv     = quantum_adv.clamp(1.0, 4.0);
    let in_bits   = input_bits.clamp(64.0, 4096.0);

    // ── per-algorithm security metrics ───────────────────────────────────────
    // We evaluate all four algorithms at the user-supplied hash_bits size.
    // The selected algorithm also gets an extended focused report.

    struct Metrics {
        classical_preimage:   f64,
        quantum_preimage:     f64,
        classical_collision:  f64,
        quantum_collision:    f64,
        pq_security:          f64,    // min(quantum_preimage, quantum_collision)
    }

    let compute_metrics = |digest: f64, mem_hard: bool| -> Metrics {
        // memory-hardness adds a log2(memory_factor) bonus to quantum preimage
        // (conservative: assume 1 GB working set → 2^30 memory ops overhead)
        let mem_bonus = if mem_hard { 15.0 } else { 0.0 };

        let classical_preimage  = digest;
        let quantum_preimage    = (digest / 2.0 + mem_bonus) / q_adv;
        let classical_collision = digest / 2.0;
        let quantum_collision   = (digest / 3.0) / q_adv;
        let pq_security         = quantum_preimage.min(quantum_collision);

        Metrics { classical_preimage, quantum_preimage, classical_collision, quantum_collision, pq_security }
    };

    let selected    = &ALGORITHMS[algo_idx];
    let sel_metrics = compute_metrics(h_bits, selected.memory_hard);

    // ── build output ─────────────────────────────────────────────────────────
    let mut out = String::with_capacity(2800);

    let era_label = if q_adv <= 1.0 { "NISQ era (current hardware)" }
                    else if q_adv <= 1.5 { "early fault-tolerant" }
                    else { "fully fault-tolerant" };

    write!(out,
        "PQHASH_AUDIT v1.0 // SOMA-9.4\n\
         ══════════════════════════════════════════════════\n\
         input : {in_bits:.0} bits   digest : {h_bits:.0} bits\n\
         algo  : {algo_name}   quantum era : {era_label}\n\
         ──────────────────────────────────────────────────\n",
        in_bits   = in_bits,
        h_bits    = h_bits,
        algo_name = selected.name,
        era_label = era_label,
    ).unwrap();

    // ── comparison table ─────────────────────────────────────────────────────
    write!(out,
        "algorithm comparison at {h_bits:.0}-bit digest:\n\
         \n\
         {h:20}  {cl_pre:>8}  {q_pre:>7}  {cl_col:>8}  {q_col:>7}  {pq:>7}  {verd}\n\
         {sep}\n",
        h_bits = h_bits,
        h      = "algorithm",
        cl_pre = "cl-pre",
        q_pre  = "q-pre",
        cl_col = "cl-col",
        q_col  = "q-col",
        pq     = "pq-sec",
        verd   = "verdict",
        sep    = "─".repeat(74),
    ).unwrap();

    for algo in &ALGORITHMS {
        let m = compute_metrics(h_bits, algo.memory_hard);
        write!(out,
            "{name:20}  {cl_pre:>6.0}b   {q_pre:>5.0}b   {cl_col:>6.0}b   {q_col:>5.0}b   {pq:>5.0}b  {sym} {verd}\n",
            name   = algo.name,
            cl_pre = m.classical_preimage,
            q_pre  = m.quantum_preimage,
            cl_col = m.classical_collision,
            q_col  = m.quantum_collision,
            pq     = m.pq_security,
            sym    = verdict_symbol(m.pq_security),
            verd   = verdict(m.pq_security),
        ).unwrap();
    }

    // ── focused report on selected algorithm ─────────────────────────────────
    let (grover_label, grover_exp) = grover_speedup_label(h_bits);

    write!(out,
        "──────────────────────────────────────────────────\n\
         selected algorithm : {algo_name}\n\
         family             : {family}\n\
         pqc status         : {pqc_status}\n\
         ──────────────────────────────────────────────────\n\
         security analysis at {h_bits:.0}-bit digest:\n\
         \n\
           classical preimage resistance  : {cl_pre:.0} bits\n\
             → an attacker needs 2^{cl_pre:.0} hash evaluations to find a preimage\n\
           quantum preimage (Grover 1996) : {q_pre:.1} bits   [{q_era}]\n\
             → Grover halves the exponent: 2^{q_pre:.1} evaluations on a QC\n\
           classical collision (birthday) : {cl_col:.0} bits\n\
             → birthday paradox: 2^{cl_col:.0} evaluations to find a collision\n\
           quantum collision (BHT 1998)   : {q_col:.1} bits   [{q_era}]\n\
             → BHT reduces exponent by 1/3: 2^{q_col:.1} QC evaluations\n\
           post-quantum security level    : {pq:.1} bits\n\
             → governing bound: {pq_gov}\n\
         ──────────────────────────────────────────────────\n\
         grover speedup:\n\
           {grover_label}\n\
           QC saves 2^{grover_exp:.0} operations over classical brute-force\n\
         ──────────────────────────────────────────────────\n",
        algo_name   = selected.name,
        family      = selected.family,
        pqc_status  = selected.pqc_status,
        h_bits      = h_bits,
        cl_pre      = sel_metrics.classical_preimage,
        q_pre       = sel_metrics.quantum_preimage,
        cl_col      = sel_metrics.classical_collision,
        q_col       = sel_metrics.quantum_collision,
        pq          = sel_metrics.pq_security,
        q_era       = era_label,
        pq_gov      = if sel_metrics.quantum_preimage <= sel_metrics.quantum_collision
                        { "quantum preimage (Grover)" }
                      else
                        { "quantum collision (BHT)" },
        grover_label = grover_label,
        grover_exp   = grover_exp,
    ).unwrap();

    // ── minimum safe digest recommendation ───────────────────────────────────
    // Work backwards: need pq_security >= 128 bits → min digest.
    // For non-memory-hard: pq = min(digest/2, digest/3) / q_adv = digest/3/q_adv
    // So digest_min = 128 * 3 * q_adv (BHT governs when q_adv > 1).
    let digest_min_bht     = (128.0 * 3.0 * q_adv).ceil();
    let digest_min_grover  = (128.0 * 2.0 * q_adv).ceil();
    let digest_min         = digest_min_bht.max(digest_min_grover);
    let digest_practical   = if digest_min <= 256.0      { 256.0 }
                             else if digest_min <= 384.0  { 384.0 }
                             else                         { 512.0 };

    write!(out,
        "minimum safe digest for 128-bit post-quantum security:\n\
         \n\
           theoretical minimum  : {digest_min:.0} bits\n\
           practical standard   : {digest_practical:.0} bits  ({standard})\n\
           current digest       : {h_bits:.0} bits  → {current_ok}\n\
         ──────────────────────────────────────────────────\n\
         nist pqc context:\n\
           {nist_note}\n\
           NIST IR 8413 (2022): hash-based schemes (LMS, XMSS) provide\n\
           stateful post-quantum signatures using only hash security.\n\
           SHA-3 / SHAKE-256 recommended for all PQC auxiliary hashing.\n\
         ──────────────────────────────────────────────────\n\
         verdict : {sym} {verd}  ({pq:.1} bits post-quantum security)\n\
         SOURCE  : content/rust_kernels/src/kernels/pqhash.rs",
        digest_min       = digest_min,
        digest_practical = digest_practical,
        standard         = if digest_practical <= 256.0 { "SHA-3-256 / BLAKE3 / SHA-256" }
                           else if digest_practical <= 384.0 { "SHA-3-384 / SHA-384" }
                           else { "SHA-3-512 / SHA-512 / BLAKE3-512" },
        h_bits           = h_bits,
        current_ok       = if sel_metrics.pq_security >= 128.0 { "SUFFICIENT" }
                           else if sel_metrics.pq_security >= 64.0 { "MARGINAL — upgrade recommended" }
                           else { "INSUFFICIENT — upgrade required" },
        nist_note        = selected.nist_note,
        sym              = verdict_symbol(sel_metrics.pq_security),
        verd             = verdict(sel_metrics.pq_security),
        pq               = sel_metrics.pq_security,
    ).unwrap();

    out
}
