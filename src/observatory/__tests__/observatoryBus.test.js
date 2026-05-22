import { describe, it, expect, beforeEach } from 'vitest';
import { emit, subscribe, getTotals, getJournal, _resetForTests } from '../observatoryBus';

describe('observatoryBus', () => {
  beforeEach(() => { _resetForTests(); });

  it('subscribers receive emitted events', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', { kernelId: 'foo', durationMs: 100 });
    expect(received).toHaveLength(1);
    expect(received[0].category).toBe('transmissions');
    expect(received[0].kind).toBe('kernel_completed');
    expect(received[0].payload.kernelId).toBe('foo');
    expect(typeof received[0].ts).toBe('number');
    unsub();
  });

  it('unsubscribe stops further deliveries', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    unsub();
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(0);
  });

  it('totals.transmissions accumulates kernel_completed', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'a', durationMs: 10 });
    emit('transmissions', 'kernel_completed', { kernelId: 'b', durationMs: 20 });
    expect(getTotals().transmissions.count).toBe(2);
    expect(getTotals().transmissions.last.payload.kernelId).toBe('b');
  });

  it('totals.transmissions.ledgerDepth tracks ledger_appended payload depth', () => {
    emit('transmissions', 'ledger_appended', { depth: 5 });
    emit('transmissions', 'ledger_appended', { depth: 6 });
    expect(getTotals().transmissions.ledgerDepth).toBe(6);
  });

  it('totals.essences tracks collisions, polarity, crystallized separately', () => {
    emit('essences', 'collision_fired', { polarity: 'LUNAR', noteCount: 4 });
    emit('essences', 'collision_fired', { polarity: 'SOLAR', noteCount: 3 });
    emit('essences', 'crystallized',    { });
    emit('essences', 'polarity_shifted',{ polarity: 'CHAOTIC' });
    const t = getTotals().essences;
    expect(t.count).toBe(2);
    expect(t.crystallized).toBe(1);
    expect(t.polarity).toBe('CHAOTIC');
  });

  it('totals.ciphers tracks sealed / verifies / unlocks', () => {
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'verify', {});
    emit('ciphers', 'unlock', {});
    const t = getTotals().ciphers;
    expect(t.sealed).toBe(2);
    expect(t.verifies).toBe(1);
    expect(t.unlocks).toBe(1);
  });

  it('totals.gaze tracks sphereClicks and last events', () => {
    emit('gaze', 'sphere_clicked', { sphere: 'TFG' });
    emit('gaze', 'lunar_read', { phase: 'waxing crescent', illum: 0.23 });
    expect(getTotals().gaze.sphereClicks).toBe(1);
    expect(getTotals().gaze.lastLunar.phase).toBe('waxing crescent');
  });

  it('totals.edge tracks gate, eye, manifesto chapter', () => {
    emit('edge', 'gate_answered', { result: 'BLESSED' });
    emit('edge', 'eye_phase', { phase: 'engaged-here' });
    emit('edge', 'manifesto_opened', { chapter: 7 });
    const t = getTotals().edge;
    expect(t.gate).toBe('BLESSED');
    expect(t.eye).toBe('engaged-here');
    expect(t.manifestoChapter).toBe(7);
  });

  it('journal caps at 256 entries', () => {
    for (let i = 0; i < 300; i++) emit('transmissions', 'kernel_completed', { i });
    const journal = getJournal();
    expect(journal.length).toBe(256);
    expect(journal[0].payload.i).toBe(44);
    expect(journal[255].payload.i).toBe(299);
  });

  it('a throwing subscriber does not prevent other subscribers from receiving', () => {
    const received = [];
    subscribe(() => { throw new Error('boom'); });
    subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(1);
  });

  it('emit on unknown category is a no-op for totals but still goes to subscribers and journal', () => {
    const received = [];
    subscribe(evt => received.push(evt));
    emit('phantom', 'something', { x: 1 });
    expect(received).toHaveLength(1);
    expect(getJournal()).toHaveLength(1);
  });
});
