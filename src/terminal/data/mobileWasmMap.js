// mobileWasmMap.js
// Maps kernelBuild.id → most topically relevant WASM run alias for mobile auto-run.
// Ordered from most specific to most general. Falls back to 'soma91' (system banner).

export function resolveWasmAlias(kernelId) {
  const id = kernelId.toUpperCase();

  // ── Direct / near-direct matches ───────────────────────────────────────────
  if (id.includes('DALY'))                                           return 'daly';
  if (id.includes('CEEI') || id.includes('ALLOCATION-ENGINE'))      return 'ceei';
  if (id.includes('SOMA-PLUS') || id.includes('SOMA_PLUS'))         return 'soma_plus';
  if (id.includes('STRANGLER'))                                      return 'strangler';
  if (id.includes('SURVEILLANCE') || id.includes('PANOPTICON'))     return 'surveillance';
  if (id.includes('KURAMOTO'))                                       return 'kuramoto';
  if (id.includes('FEIGENBAUM') || id.includes('BIFURCATION'))      return 'feigenbaum';
  if (id.includes('CHRONO') || id.includes('ACTUARY'))              return 'chrono';
  if (id.includes('CYNIC-REALIST') || id.includes('CYNIC_REALIST')) return 'cynic_realist';

  // ── Fusion / plasma / nuclear ───────────────────────────────────────────────
  if (id.includes('FUSION') || id.includes('PLASMA') || id.includes('NFDK') || id.includes('NUCLEAR')) return 'fusion';

  // ── Crypto / cryptographic ──────────────────────────────────────────────────
  if (id.includes('TESSERACT') || id.includes('TESSERACT-VAULT'))           return 'tesseract';
  if (id.includes('DH-EC') || id.includes('DH_EC') || id.includes('PQHASH') || id.includes('QUANTUM-HASH') || id.includes('HASH-AUDIT')) return 'pqhash';
  if (id.includes('SHADOWSOCKS') || id.includes('SK-1.0'))          return 'surveillance';

  // ── Phonemic / linguistic / keyboard / memory ────────────────────────────────
  if (id.includes('BELLARD') || id.includes('BAUDRILLARD') || id.includes('BBK') ||
      id.includes('PHONEMIC') || id.includes('LINGUISTIC') || id.includes('COLEMAK') ||
      id.includes('MOZART') || id.includes('CUSTOM-KEYB') || id.includes('CIGAR')) return 'phonemic';

  // ── Atmospheric / thermosphere / climate / entropy ───────────────────────────
  if (id.includes('ATMOSPHERIC') || id.includes('THERMOSPHERE') ||
      id.includes('SORBE') || id.includes('THERMODYNAMIC-BLOOM'))   return 'atmospheric';

  // ── Reaction-diffusion / Gray-Scott / Turing ────────────────────────────────
  if (id.includes('REACTION-DIFFUSION') || id.includes('SRDK') ||
      id.includes('GRAYSCOTT') || id.includes('GRAY-SCOTT') ||
      id.includes('SCOTT-REACTION'))                                 return 'grayscott';

  // ── Ising / consensus / phase transition / opinion ──────────────────────────
  if (id.includes('ISING') || id.includes('CONSENSUS') || id.includes('SCALE-KERNEL-FRAMEWORK') ||
      id.includes('SCALE-OPTIMIZATION') || id.includes('SSS-'))     return 'ising';

  // ── Bosonic / quantum / lattice ──────────────────────────────────────────────
  if (id.includes('BOSONIC') || id.includes('QUANTUM') || id.includes('NQAM') ||
      id.includes('MATRIX-KERNEL') || id.includes('AT-1.0') || id.includes('QR-1.0')) return 'bosonic';

  // ── Seraphine / Sophie / reasoning ──────────────────────────────────────────
  if (id.includes('SERAPHINE') || id.includes('SARG') || id.includes('SOPHIE')) return 'seraphine';

  // ── Geopolitical / kinetic / defense / statecraft ────────────────────────────
  if (id.includes('GEOPOLITICAL') || id.includes('KINETIC') ||
      id.includes('DEFENSE') || id.includes('GREENLAND') ||
      id.includes('ISENGARD') || id.includes('GDPDW') ||
      id.includes('SOVEREIGN-KERNEL'))                               return 'geopolitical';

  // ── Leviathan / V-cache / cellular automata ──────────────────────────────────
  if (id.includes('LEVIATHAN') || id.includes('VCACHE') || id.includes('V-CACHE')) return 'leviathan';

  // ── Replicator / evolutionary / decay / scarcity ────────────────────────────
  if (id.includes('REPLICATOR') || id.includes('PASSALUS') || id.includes('EVOLUTIONARY')) return 'replicator';

  // ── Necromantic / Fish Scale / entropic stasis ───────────────────────────────
  if (id.includes('NECRO') || id.includes('FISH') || id.startsWith('FSK') ||
      id.startsWith('FSQ') || id.startsWith('FSX') ||
      id.includes('SCALING-CUBE') || id.includes('GLITCH-SCALE') ||
      id.includes('NEK-'))                                           return 'necromantic';

  // ── Biodiversity / biocoenosis / mycelial / ecology ─────────────────────────
  if (id.includes('BIODIVERSITY') || id.includes('BIOCOENOSIS') ||
      id.includes('MYCELIAL') || id.includes('FLORA') ||
      id.includes('UNDERGROUND-THERMO') || id.startsWith('UTK'))    return 'biocoenosis';

  // ── Pragmatic / DRK / focus / nocturnal / tectonic ──────────────────────────
  if (id.includes('PRAGMATIC') || id.includes('DRK') ||
      id.includes('FOCUS') || id.includes('HYPERFOCUS') ||
      id.includes('NOCTURNAL') || id.includes('TECTONIC') ||
      id.includes('COMPANION') || id.includes('TAMAM') ||
      id.includes('LITHIUM'))                                        return 'pragmatic';

  // ── AI ethics / identity / persona / violet ─────────────────────────────────
  if (id.includes('AI-ETHICS') || id.includes('HIGH-TOWER') ||
      id.includes('VIOLET') || id.includes('EMPATHY') ||
      id.includes('LINE-PICASSO') || id.includes('MM-3.3') ||
      id.includes('LLM-OPTIMIZED') || id.includes('FLUORESCENT'))   return 'cynic_realist';

  // ── Chrono adjacent / river / ecological audit ───────────────────────────────
  if (id.includes('CHRO-') || id.includes('RIVER') || id.includes('AQUA')) return 'chrono';

  // ── Feigenbaum adjacent / scale-y / tenfold ─────────────────────────────────
  if (id.includes('SCALE-Y') || id.includes('TENFOLD') || id.includes('SYK')) return 'feigenbaum';

  // ── SOMA builds ──────────────────────────────────────────────────────────────
  if (id.includes('SOMA'))                                           return 'soma_kernel';

  // ── Default: system banner ───────────────────────────────────────────────────
  return 'soma91';
}
