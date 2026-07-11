// src/terminal/quintessence/compileKernel.js — THE QUINTESSENCE COMPILER.
// Pure + deterministic (spec §3): (spine, periphery, engine, opts) → artifact.
// The genome is Fish Scale 11.2 (src/fish_scale_kernel_11.2.rs); this module
// templates a personalized fork of it. Wisdom lives in doc-comments; the
// visitor's life lives in parameter values. No Math.random() — mulberry32 only.
import { mulberry32 } from '../views/manifesto/councilCollider';
import { drynessFor } from '../data/lunarAccords';
import { trendToPressure, pressureToBpm } from './engineWitness';
import { lensFor } from './taxonomyRegistry';

export const ELEMENT_MAP = {
  FIRE:  { atom: 'Boson',   daemon: 'TheDevil' },
  AIR:   { atom: 'Boson',   daemon: 'TheDevil' },
  EARTH: { atom: 'Fermion', daemon: 'TheMask'  },
  WATER: { atom: 'Fermion', daemon: 'TheMask'  },
};

// ── deterministic helpers ────────────────────────────────────────────────────
function seedFrom(str) {
  let h = 2166136261 >>> 0;                       // FNV-1a
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// entropy_lock: wind the eternal-rave clock with the lunar transit.
// illumination in basis points × 100 — a u64-safe integer, 0 if unread.
function entropyLockValue(lunarRead) {
  if (!lunarRead || typeof lunarRead.illum !== 'number') return 0;
  return Math.round(lunarRead.illum * 10000) * 100;
}

function houseLine(name, value, describe) {
  return value == null
    ? `    // HOUSE EMPTY — never witnessed\n    ${name}: None,`
    : `    ${name}: Some(${JSON.stringify(describe)}),`;
}

// ── main ─────────────────────────────────────────────────────────────────────
/**
 * @param spine     { trend, council, phase, element }  (all present — altar gates)
 * @param periphery snapshotPeriphery() result (nullable fields)
 * @param engine    witnessEngine() result or null (offline)
 * @param opts      { compiledAt: ISO string } — injected for determinism/tests
 */
export async function compileKernel(spine, periphery, engine, opts = {}) {
  const compiledAt = opts.compiledAt ?? new Date().toISOString();
  // Canonical = deep-sorted keys, so semantically identical inputs always
  // hash identically regardless of how a caller assembled the objects.
  const canonical = JSON.stringify({ spine, periphery, engine, compiledAt }, (k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((acc, key) => { acc[key] = v[key]; return acc; }, {})
      : v);
  const hash = await sha256Hex(canonical);
  const rng = mulberry32(seedFrom(hash));

  const el      = ELEMENT_MAP[spine.element];
  const dryness = drynessFor(spine.phase);
  const r       = trendToPressure(spine.trend.velocity);
  const bpm     = pressureToBpm(r);
  const verdict = bpm >= 160 ? 'PLATA' : 'PLOMO';
  const lock    = entropyLockValue(periphery.lunarRead);
  const [mindA, mindB] = spine.council.pair;

  const filledHouses =
    [periphery.ciphers, periphery.transmissions, periphery.essences, periphery.lunarRead]
      .filter(Boolean).length +
    Object.values(periphery.houses).filter(Boolean).length;
  // The faculty's reading context (registry spec §6). Assembled AFTER the hash:
  // lenses are voice, not identity — hash inputs are untouched.
  const ctx = { spine, periphery, meta: { dryness, bpm, verdict, daemon: el.daemon, filledHouses } };

  const engineBlock = engine ? `
/// Computed by compiled Rust at the quintessence event — not narrated, executed.
/// run_fish_scale(r=${r.toFixed(4)}, layers=witness depth, θ=36°, burn←${spine.phase})
mod engine_witness {
    pub const REGIME: &str        = ${JSON.stringify(engine.regime)};
    pub const INTEGRITY_PCT: f64  = ${engine.integrity};
    pub const LYAPUNOV: f64       = ${engine.lyapunov};
    pub const AXIOMS_ACTIVE: u8   = ${engine.axiomsActive}; // of 9
    pub const IN_SANCTUARY: bool  = ${engine.inSanctuary};
    pub const ARMOR_DENSITY: f64  = ${engine.armorDensity};
    pub const BOULIGAND_LAYERS: usize = ${engine.layers};
}` : `
/// ENGINE OFFLINE — constants unwitnessed. The cascade ran without its
/// instruments; the verdict below resolved from the calibration constant.
mod engine_witness { /* every field None */ }`;

  const lunarComment = periphery.lunarRead && typeof periphery.lunarRead.illum === 'number'
    ? `/// wound with the transit: ${periphery.lunarRead.phase} · ${(periphery.lunarRead.illum * 100).toFixed(1)}% illuminated`
    : `/// TRANSIT UNREAD — the clock was never wound`;

  const source = `\
// ═══════════════════════════════════════════════════════════════
// KERNEL OF QUINTESSENCE :: FORK OF FISH SCALE 11.2 :: BUILD 0x${hash.slice(0, 8).toUpperCase()}
// COMPILED AT SCALE94.COM · QUINTESSENCE EVENT · ${compiledAt}
//
// THIS IS A SEALED VIAL. CARRY IT OUT.
// FEED IT TO ANY ORACLE AND ASK: WHAT DOES THIS SYSTEM WANT?
//
// Theory that cannot be compiled does not yet exist as knowledge.
// ═══════════════════════════════════════════════════════════════
#![no_std]

/// ${lensFor('kernel_grammar', ctx, rng)}
use core::sync::atomic::AtomicU64;
use core::cell::UnsafeCell;

/// ${lensFor('vial_header', ctx, rng)}
/// ${lensFor('daemon', ctx, rng)}
/// element: ${spine.element} · role: ${el.atom} · daemon compiled ${el.daemon === 'TheDevil' ? 'unmasked' : 'masked'}
enum ShlomoState { TheMask, TheDevil }
const DAEMON: ShlomoState = ShlomoState::${el.daemon};

/// **PIRARUCU** — the armored ideal, tempered by one olfactory phase.
/// ${lensFor('pirarucu', ctx, rng)}
/// phase: ${spine.phase} · the burn window was set here
struct Pirarucu<T> { armor: UnsafeCell<T>, dryness_coefficient: u8 }
const ARMOR: &str = ${JSON.stringify(periphery.essences?.polarity ? `${spine.phase} · polarity ${periphery.essences.polarity}` : spine.phase)};
const DRYNESS: Pirarucu<&str> = Pirarucu { armor: UnsafeCell::new(ARMOR), dryness_coefficient: ${dryness} };

/// **NARCOS** — the contaminant that keeps the system alive.
/// ${lensFor('narcos_payload', ctx, rng)}
/// the levamisole is the live network pulse, marked by the visitor:
const INJECTION_PAYLOAD: &str = ${JSON.stringify(spine.trend.label)};
const INJECTION_VELOCITY: f64 = ${spine.trend.velocity};

/// **SOKUSHINBUTSU** — living death, perfectly preserved.
${lunarComment}
/// ${lensFor('entropy_lock', ctx, rng)}
static ENTROPY_LOCK: AtomicU64 = AtomicU64::new(${lock});

/// **THE NECROMANTIC ENGINE** — perpetual friction, never resolution.
/// ${lensFor('necromantic_engine', ctx, rng)}
/// This cycle reanimates: ${periphery.transmissions?.lastKernel ?? 'no mummy — the past was left unraised'}
/// The two forces in friction were chosen in council:
///   ${mindA}  ×  ${mindB}
/// ${lensFor('council_pair', ctx, rng)}
/// ${lensFor('council_directive', ctx, rng)}
/// ${spine.council.directive}
/// ${spine.council.paradoxCount} irreducible tension${spine.council.paradoxCount === 1 ? '' : 's'} survive saponification · trajectory ${spine.council.trajectory}
struct NecromanticEngine { bpm: u32, friction_coefficient: f64 }
const ENGINE: NecromanticEngine = NecromanticEngine {
    bpm: ${bpm}, // feigenbaum-processed network pulse · 160 = chaos onset
    friction_coefficient: ${spine.council.paradoxCount}.0,
};

/// THE VERDICT — computed, not chosen.
enum PlataOPlomo { Plata, Plomo }
const VERDICT: PlataOPlomo = PlataOPlomo::${verdict === 'PLATA' ? 'Plata' : 'Plomo'};
${verdict === 'PLATA'
  ? '/// vitality through corruption · the system lives compromised'
  : '/// purity chosen over life · entropic stasis · the statue wins this round'}
/// ${lensFor('verdict', ctx, rng)}
${engineBlock}

/// THE PERIPHERAL WITNESS — what the terminal saw without being asked.
/// ${lensFor('witness_intro', ctx, rng)}
/// Empty houses are part of the portrait. Absence is data.
struct PeripheralWitness {
    ciphers: Option<&'static str>,
    transmissions: Option<&'static str>,
    house_ledger: Option<&'static str>,
    essences: Option<&'static str>,
    house_ecocide: Option<&'static str>,
    house_privacy: Option<&'static str>,
    house_surveillance: Option<&'static str>,
}
const WITNESS: PeripheralWitness = PeripheralWitness {
    // ${lensFor('house_ciphers', ctx, rng)}
${houseLine('ciphers', periphery.ciphers, `cryptographic proof: ${periphery.ciphers?.verifies ?? 0} verified · ${periphery.ciphers?.unlocks ?? 0} unlocked · ${periphery.ciphers?.sealed ?? 0} sealed`)}
    // ${lensFor('house_transmissions', ctx, rng)}
${houseLine('transmissions', periphery.transmissions, `${periphery.transmissions?.count ?? 0} kernels completed · ledger depth ${periphery.transmissions?.ledgerDepth ?? 0}`)}
${houseLine('house_ledger', periphery.houses.ledger, `entered ${periphery.houses.ledger}×`)}
    // ${lensFor('house_essences', ctx, rng)}
${houseLine('essences', periphery.essences, `${periphery.essences?.collisions ?? 0} collisions · ${periphery.essences?.crystallized ?? 0} crystallized`)}
    // ${lensFor('house_ecocide', ctx, rng)}
${houseLine('house_ecocide', periphery.houses.ecocide, `entered ${periphery.houses.ecocide}×`)}
${houseLine('house_privacy', periphery.houses.privacy, `entered ${periphery.houses.privacy}×`)}
${houseLine('house_surveillance', periphery.houses.surveillance, `entered ${periphery.houses.surveillance}×`)}
};

/// **PANIC HANDLER** — inherited verbatim from the genome.
/// When this system fails, it does not crash — it calcifies.
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop { core::hint::spin_loop(); }
}
`;

  return {
    source,
    hash,
    meta: { compiledAt, verdict, bpm, r, dryness, element: spine.element,
            daemon: el.daemon, atom: el.atom, engineOnline: !!engine },
  };
}
