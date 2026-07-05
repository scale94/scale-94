import { describe, it, expect, beforeEach } from 'vitest';
import { councilBus } from '../councilBus';

describe('councilBus', () => {
  beforeEach(() => councilBus._resetForTests());

  it('delivers events to live listeners', () => {
    const seen = [];
    const off = councilBus.on(e => seen.push(e));
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 0 });
    expect(seen).toHaveLength(1);
    off();
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 1 });
    expect(seen).toHaveLength(1);
  });

  it('buffers events with no listeners and flushes to the first subscriber', () => {
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 0 });
    councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: 1 });
    const seen = [];
    councilBus.on(e => seen.push(e));
    expect(seen.map(e => e.ordinal)).toEqual([0, 1]);
  });

  it('caps the pending buffer at 32 (ambient loop must not leak)', () => {
    for (let i = 0; i < 50; i++) councilBus.emit({ type: 'COUNCIL_COLLISION', ordinal: i });
    const seen = [];
    councilBus.on(e => seen.push(e));
    expect(seen).toHaveLength(32);
    expect(seen[0].ordinal).toBe(18); // oldest dropped
  });
});
