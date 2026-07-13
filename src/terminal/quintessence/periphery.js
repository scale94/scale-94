// src/terminal/quintessence/periphery.js — the ambient witness (spec §3.4).
// Reads observatoryBus totals + journal at compile time (the journal scan finds
// the last kernel_completed regardless of event order). null = empty house = Option::None.
// Never blocks, never throws: a dead bus compiles as an unwitnessed session.
import { getTotals, getJournal } from '../../observatory/observatoryBus';

const TRACKED_HOUSES = ['ecocide', 'ledger', 'privacy', 'surveillance'];

function lastCompletedKernel() {
  try {
    const journal = getJournal();
    for (let i = journal.length - 1; i >= 0; i--) {
      const e = journal[i];
      if (e.category === 'transmissions' && e.kind === 'kernel_completed' && e.payload?.kernelId)
        return e.payload.kernelId;
    }
  } catch (_) { /* unwitnessed */ }
  return null;
}

export function snapshotPeriphery() {
  let t;
  try { t = getTotals(); } catch (_) { t = null; }

  const c = t?.ciphers, tr = t?.transmissions, e = t?.essences, g = t?.gaze;

  const ciphersSeen = (c?.sealed || 0) + (c?.verifies || 0) + (c?.unlocks || 0) > 0;
  const transSeen   = (tr?.count || 0) + (tr?.ledgerDepth || 0) > 0 || !!tr?.lastSignal;
  const essSeen     = (e?.count || 0) + (e?.crystallized || 0) > 0;

  const houses = {};
  for (const h of TRACKED_HOUSES) {
    const n = g?.tabsVisited?.[h] || 0;
    houses[h] = n > 0 ? n : null;
  }

  return {
    ciphers: ciphersSeen
      ? { sealed: c.sealed, verifies: c.verifies, unlocks: c.unlocks } : null,
    transmissions: transSeen
      ? { count: tr.count, ledgerDepth: tr.ledgerDepth, lastKernel: lastCompletedKernel(), lastSignal: tr.lastSignal ?? null } : null,
    essences: essSeen
      ? { collisions: e.count, crystallized: e.crystallized, polarity: e.polarity ?? null, lastAccord: e.lastAccord ?? null } : null,
    lunarRead: g?.lastLunar
      ? { phase: g.lastLunar.phase ?? null, illum: g.lastLunar.illum ?? null } : null,
    houses,
    // Deep periphery (spec 2026-07-11): the four houses learn to speak.
    // art distinguishes "entered but never touched" (visits-only) from "never came" (null).
    art: g?.art
      ? { resonances: g.art.resonances || 0, lastSim: g.art.lastSim ?? null,
          bifurcations: g.art.bifurcations || 0, chimeras: g.art.chimeras || 0,
          lastR: g.art.lastR ?? null, lyapunov: g.art.lyapunov ?? null, regime: g.art.regime ?? null,
          selectedNode: g.art.selectedNode ?? null, resonancePair: g.art.resonancePair ?? null }
      : ((g?.tabsVisited?.art || 0) > 0 ? { visits: g.tabsVisited.art } : null),
    ecocideSim: g?.lastEcocide && g.lastEcocide.phase != null
      ? { phase: g.lastEcocide.phase,
          rift: typeof g.lastEcocide.metabolicRift === 'number' ? g.lastEcocide.metabolicRift : null,
          growthRate: typeof g.lastEcocide.growthRate === 'number' ? g.lastEcocide.growthRate : null,
          mandateActive: g.lastEcocide.mandateActive ?? null }
      : null,
    ledgerVerdict: tr?.verdict ?? null,
    manifestoFragment: g?.lastManifestoFragment ?? null,
  };
}
