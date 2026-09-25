import { describe, it, expect } from 'vitest';
import laws from './fixtures/legislation-sealed-2026-03-09.json';
import {
  NODES, NODE_IDS, EU_MEMBERS, TRUNKS, STEPS, NOW_STEP, TAPS,
  nodeName, neighbors, trunkIndex, lawNodes, lawTaps, lawsInForce,
  challengedFires, lawsFiring, tapsAt, nodeLoad, tickStates,
} from '../interceptLattice';

describe('intercept lattice model (spec §2–§5)', () => {
  it('has 11 country nodes and no EU node', () => {
    expect(NODES).toHaveLength(11);
    expect(NODE_IDS).not.toContain('EU');
  });

  it('maps every corpus law to at least one node', () => {
    for (const law of laws) expect(lawNodes(law).length).toBeGreaterThan(0);
  });

  it('fans the five EU laws out to exactly the six member nodes', () => {
    const eu = laws.filter((l) => l.location === 'EU');
    expect(eu).toHaveLength(5);
    for (const law of eu) expect(lawNodes(law)).toEqual(['IE', 'FR', 'BE', 'NL', 'DE', 'SE']);
    expect(EU_MEMBERS).not.toContain('UK');
  });

  it('has 22 distinct trunks between known nodes, no self-loops', () => {
    expect(TRUNKS).toHaveLength(22);
    const keys = TRUNKS.map(([a, b]) => [a, b].sort().join('-'));
    expect(new Set(keys).size).toBe(22);
    for (const [a, b] of TRUNKS) {
      expect(NODE_IDS).toContain(a);
      expect(NODE_IDS).toContain(b);
      expect(a).not.toBe(b);
    }
  });

  it('reaches every node from every node', () => {
    for (const start of NODE_IDS) {
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) for (const n of neighbors(queue.shift())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
      expect(seen.size).toBe(11);
    }
  });

  it('has no direct Canada–New Zealand trunk (spec §4)', () => {
    expect(trunkIndex('CA', 'NZ')).toBe(-1);
    expect(trunkIndex('CA', 'US')).toBe(trunkIndex('US', 'CA'));
    expect(trunkIndex('US', 'CA')).toBe(0);
  });

  it('counts laws in force per detent: 0 / 18 / 28 / 30 / 34 / 44', () => {
    expect(STEPS.map((_, i) => lawsInForce(laws, i).length)).toEqual([0, 18, 28, 30, 34, 44]);
    expect(STEPS[NOW_STEP].id).toBe('now');
    expect(STEPS.map((s) => s.id)).toEqual(['before', 'active', 'implementing', 'now', 'upheld', 'proposed']);
  });

  it('gives every law a tap type and matches the corpus tag counts', () => {
    for (const law of laws) expect(lawTaps(law).length).toBeGreaterThan(0);
    const counts = Object.fromEntries(TAPS.map((t) => [t.key, laws.filter((l) => l.tags.includes(t.tag)).length]));
    expect(counts).toEqual({ scan: 8, backdoor: 8, retain: 16, traffic: 9, digitalId: 18, age: 9, biometric: 21, worker: 14 });
    expect(TAPS.map((t) => t.word)).toEqual(['seen', 'read', 'kept', 'traced', 'named', 'proven', 'measured', 'watched']);
  });

  it('fires CHALLENGED laws deterministically, and not in lockstep', () => {
    const challenged = laws.filter((l) => l.legislationStatus === 'CHALLENGED').map((l) => l.id);
    expect(challenged).toHaveLength(4);
    const pattern = (id) => Array.from({ length: 16 }, (_, s) => (challengedFires(id, s) ? 1 : 0)).join('');
    for (const id of challenged) {
      expect(pattern(id)).toMatch(/0/);
      expect(pattern(id)).toMatch(/1/);
    }
    expect(new Set(challenged.map(pattern)).size).toBeGreaterThan(1);
    expect(pattern('LAW-CA-2025-C2-001')).toBe('1110010010101011');
    expect(pattern('LAW-EU-2025-CHAT-001')).toBe('0101011100010101');
    expect(pattern('LAW-IE-2011-PSC')).toBe('1111110111011001');
    expect(pattern('LAW-US-2025-STATE-001')).toBe('0101000101100111');
  });

  it('adds only the firing CHALLENGED laws, and only at now', () => {
    for (let seq = 0; seq < 8; seq++) {
      const n = lawsFiring(laws, NOW_STEP, seq).length;
      expect(n).toBeGreaterThanOrEqual(30);
      expect(n).toBeLessThanOrEqual(34);
      expect(lawsFiring(laws, 2, seq)).toHaveLength(28);
      expect(lawsFiring(laws, 4, seq)).toHaveLength(34);
    }
  });

  it('groups the taps in force at a node', () => {
    expect(Object.keys(tapsAt('UK', lawsInForce(laws, NOW_STEP)))).toEqual(
      ['scan', 'backdoor', 'retain', 'traffic', 'digitalId', 'age', 'worker'],
    );
    expect(tapsAt('CA', [])).toEqual({});
  });

  it('sums severity squared per node', () => {
    expect(nodeLoad('UK', lawsInForce(laws, NOW_STEP))).toBe(57);
    expect(nodeLoad('SE', laws)).toBe(143);
    expect(nodeLoad('NZ', [])).toBe(0);
  });

  it('marks ticks steady, flickering or absent', () => {
    expect(tickStates('CA', laws, NOW_STEP)).toEqual([null, 'flicker', 'flicker', null, 'on', null, 'on', 'flicker']);
    expect(tickStates('UK', laws, NOW_STEP)).toEqual(['on', 'on', 'on', 'on', 'on', 'on', null, 'on']);
    expect(tickStates('CA', laws, 0)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('names nodes in lowercase', () => {
    expect(nodeName('NZ')).toBe('new zealand');
    expect(nodeName('UK')).toBe('united kingdom');
  });
});
