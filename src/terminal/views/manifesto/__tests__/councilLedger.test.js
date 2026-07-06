import { describe, it, expect, beforeEach, vi } from 'vitest';
import { councilLedger, LEDGER_KEY, LEDGER_CAP } from '../councilLedger';

const armEvent = (dimIndex) => ({ v: 1, kind: 'EVENT', event: 'ARM', ts: Date.now(), subject: { kind: 'mind', dimIndex } });
const synthRecord = (id, ordinal) => ({
  v: 1, kind: 'SYNTHESIS', id, ts: Date.now(), ordinal,
  pair: [{ kind: 'mind', dimIndex: 0, anchorName: 'Donella Meadows' }, { kind: 'mind', dimIndex: 4, anchorName: 'Nicholas Georgescu-Roegen' }],
  profiles: [Array(16).fill(0.1), Array(16).fill(0.2)],
  metrics: { cosine: 0.5, novelty: 0.5, energies: { social: 1, bio: 1 }, trajectory: 'CEILING', dominantDim: 4 },
  sections: { sharedGround: {}, frontier: {}, angles: [], openQuestions: [], sanctuaries: [], seeds: [] },
  directive: 'd', line: 'l',
});

describe('councilLedger', () => {
  beforeEach(() => {
    localStorage.clear();
    councilLedger._resetForTests();
  });

  it('appends and lists records in order', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    const all = councilLedger.list();
    expect(all).toHaveLength(2);
    expect(all[0].kind).toBe('EVENT');
    expect(all[1].kind).toBe('SYNTHESIS');
  });

  it('list() returns copies — mutating a listed record does not alter the store', () => {
    councilLedger.append(synthRecord('s1', 0));
    const rec = councilLedger.list()[0];
    rec.directive = 'HACKED';
    expect(councilLedger.list()[0].directive).toBe('d');
  });

  it('filters by kind and returns latest', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    councilLedger.append(armEvent(2));
    expect(councilLedger.list({ kind: 'SYNTHESIS' })).toHaveLength(1);
    expect(councilLedger.latest().event).toBe('ARM');
    expect(councilLedger.latest('SYNTHESIS').id).toBe('s1');
  });

  it('caps at LEDGER_CAP with oldest-first eviction', () => {
    for (let i = 0; i < LEDGER_CAP + 10; i++) councilLedger.append(armEvent(i % 16));
    expect(councilLedger.list()).toHaveLength(LEDGER_CAP);
  });

  it('persists to localStorage under LEDGER_KEY and rehydrates on fresh instance', () => {
    councilLedger.append(synthRecord('s1', 0));
    expect(localStorage.getItem(LEDGER_KEY)).toBeTruthy();
    councilLedger._resetForTests({ keepStorage: true });
    expect(councilLedger.list()).toHaveLength(1);
    expect(councilLedger.list()[0].id).toBe('s1');
  });

  it('degrades silently when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => councilLedger.append(armEvent(0))).not.toThrow();
    expect(councilLedger.list()).toHaveLength(1); // in-memory still works
    spy.mockRestore();
  });

  it('notifies subscribers on append', () => {
    const seen = [];
    const off = councilLedger.subscribe(r => seen.push(r.kind));
    councilLedger.append(armEvent(0));
    off();
    councilLedger.append(armEvent(1));
    expect(seen).toEqual(['EVENT']);
  });

  it('deriveUiState: trailing SYNTHESIS (no later ARM/RESET) → SYNTHESIZED with record', () => {
    councilLedger.append(armEvent(0));
    councilLedger.append(synthRecord('s1', 0));
    const st = councilLedger.deriveUiState();
    expect(st.mode).toBe('SYNTHESIZED');
    expect(st.record.id).toBe('s1');
  });

  it('deriveUiState: trailing ARM → ARMED with subject; RESET → AMBIENT; empty → AMBIENT', () => {
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
    councilLedger.append(armEvent(7));
    expect(councilLedger.deriveUiState()).toEqual({ mode: 'ARMED', armed: { kind: 'mind', dimIndex: 7 }, record: null });
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'RESET', ts: Date.now(), subject: null });
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
  });

  it('deriveUiState: FIRE events are transitional — walk-back skips them', () => {
    councilLedger.append(armEvent(5));
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'FIRE', ts: Date.now(), subject: { kind: 'pair', dims: [5, 9] } });
    // Reload mid-flight lands on the prior decisive state (ARMED), not FIRING.
    expect(councilLedger.deriveUiState()).toEqual({ mode: 'ARMED', armed: { kind: 'mind', dimIndex: 5 }, record: null });
  });

  it('deriveUiState: DISARM after ARM → AMBIENT', () => {
    councilLedger.append(armEvent(3));
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: 3 } });
    expect(councilLedger.deriveUiState().mode).toBe('AMBIENT');
  });
});
