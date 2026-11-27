// revealSchedule.js — the reveal at the altar, as a timeline (spec §8; P3 rulings 8–9).
// Pure: no React, DOM, GL, WASM or WebCrypto. The component only renders frameAt().
//
// C over B: poetry condenses into chemistry over the real ciphertext bytes.
//   header → ACCORD UNSEALED → for each poetic note: the note, then its material
//   rows → the modulators sign their lines → FORMULA MODULATED
//
// Every row resolves left → right out of its own slice of aead_ct, the
// AES-256-GCM ciphertext that held the accord: row i of n takes bytes
// [⌊i·L/n⌋, ⌊(i+1)·L/n⌋). A note's rows land together, and their grams flash
// white for FLASH_MS once: one flash onset per note group, groups ≥ 350 ms
// apart, so no 1 s window ever holds more than 3 onsets (WCAG 2.3.1).
// Reduced motion: everything at t = 0, no flash.

export const FLASH_MS = 80;
export const MAX_FLASHES_PER_S = 3;
const GROUP_MIN_MS = Math.ceil(1000 / MAX_FLASHES_PER_S) + 17; // 350
const GROUP_MAX_MS = 560;
const GROUP_BUDGET_MS = 3600;
const HEADER_MS = 300;
const STAGE_MS = 250;
const LAND_MS = 300;          // a group's rows land this long after its note
const ROW_LEAD_MS = 80;       // first row starts this long after its note
const ROW_STAGGER_MS = 70;    // spread of row starts within a group
const MOD_MIN_MS = 80;
const MOD_MAX_MS = 300;
const TARGET_TOTAL_MS = 6000;
const TAIL_MS = 200;
const FLASH_CHARS = 4;

const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');

/** The batch the reveal shows: small (decision 11) unless it is infeasible. */
export function revealBatchOf(formula) {
  const b = formula?.batches;
  if (b?.small?.state === 'ok') return b.small;
  if (b?.large?.state === 'ok') return b.large;
  return null;
}

export function buildReveal({ formula, aeadBytes, reducedMotion = false }) {
  const e = formula.envelope;
  const header = `ENVELOPE · ${e.kem} CT (${e.ctBytes} B) · ${e.aead} · ${e.aeadBytes} B`;
  const batch = revealBatchOf(formula);
  const byId = new Map((batch?.rows ?? []).map((r) => [r.materialId, r]));

  // Group the rows under the note that first names them.
  const shown = new Set();
  const groups = [];
  for (const n of formula.notes ?? []) {
    const items = [];
    for (const { materialId } of n.materials) {
      const row = byId.get(materialId);
      if (!row) continue;                       // dropped by the engine: its DROP line says so
      if (shown.has(materialId)) items.push({ kind: 'ref', row });
      else { shown.add(materialId); items.push({ kind: 'row', row }); }
    }
    groups.push({ note: n.note, layer: n.cardLayer, items });
  }

  const totalRows = groups.reduce((k, g) => k + g.items.filter((x) => x.kind === 'row').length, 0);
  const L = aeadBytes?.length ?? 0;
  const sliceFor = (i) => toHex(aeadBytes.subarray(Math.floor((i * L) / totalRows), Math.floor(((i + 1) * L) / totalRows)));

  const steps = [];
  const at = (t) => (reducedMotion ? 0 : t);
  steps.push({ kind: 'header', text: header, at: 0 });
  steps.push({ kind: 'stage', text: 'ACCORD UNSEALED', at: at(HEADER_MS) });

  const spacing = Math.min(GROUP_MAX_MS, Math.max(GROUP_MIN_MS, GROUP_BUDGET_MS / Math.max(1, groups.length)));
  let t = HEADER_MS + STAGE_MS;
  let rowIndex = 0;
  for (const g of groups) {
    steps.push({ kind: 'note', text: g.note, layer: g.layer, at: at(t) });
    const land = t + LAND_MS;
    g.items.forEach((item, j) => {
      const start = t + ROW_LEAD_MS + Math.floor((j * ROW_STAGGER_MS) / Math.max(1, g.items.length));
      const r = item.row;
      if (item.kind === 'ref') {
        steps.push({ kind: 'ref', materialId: r.materialId, name: r.name, layer: r.layer, text: `↳ ${r.name} (above)`, at: at(start) });
        return;
      }
      const value = `${r.grams.toFixed(2)} g`;
      steps.push({
        kind: 'row', materialId: r.materialId, name: r.name, value, layer: r.layer, cas: r.cas, stock: r.stock,
        bytesHex: sliceFor(rowIndex++),
        at: at(start),
        sweepMs: reducedMotion ? 0 : land - start,
        flashAt: reducedMotion ? null : land,
        flashChars: Math.min(FLASH_CHARS, value.length),
      });
    });
    t += spacing;
  }

  const mods = batch
    ? batch.log
    : [`FORMULA INFEASIBLE — ${formula.batches?.small?.reason ?? formula.batches?.large?.reason ?? 'no batch compiled'}`];
  const modMs = Math.min(MOD_MAX_MS, Math.max(MOD_MIN_MS, (TARGET_TOTAL_MS - t - STAGE_MS - TAIL_MS) / Math.max(1, mods.length)));
  for (const line of mods) {
    steps.push({ kind: 'mod', text: line, at: at(t) });
    t += modMs;
  }
  if (batch) {
    steps.push({ kind: 'stage', text: 'FORMULA MODULATED', at: at(t) });
    t += STAGE_MS;
  }
  return { header, steps, totalMs: reducedMotion ? 0 : Math.round(t + TAIL_MS - STAGE_MS) };
}

/** Per-step state at time t (ms since the reveal began). */
export function frameAt(reveal, t) {
  const out = new Map();
  for (const s of reveal.steps) {
    const shown = t >= s.at;
    const flashing = s.flashAt != null && t >= s.flashAt && t < s.flashAt + FLASH_MS;
    if (s.kind !== 'row') { out.set(s, { shown, flashing }); continue; }
    const full = s.name + s.value;
    const p = !shown ? 0 : s.sweepMs === 0 ? 1 : Math.min(1, (t - s.at) / s.sweepMs);
    const resolvedChars = Math.floor(full.length * p);
    let chars = full.slice(0, resolvedChars);
    for (let i = resolvedChars; i < full.length; i++) chars += s.bytesHex ? s.bytesHex[i % s.bytesHex.length] : '·';
    out.set(s, { shown, flashing, resolvedChars, chars });
  }
  return out;
}
