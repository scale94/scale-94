import { describe, it, expect } from 'vitest';
import { buildTimeline, packetAt, HOP_MS, INSPECT_MS, GATE_MS, FADE_MS } from '../interceptPacket';

const XY = { A: [0, 0], B: [100, 0], C: [100, 50] };
const xyOf = (id) => XY[id];
const EVENTS = [
  { phase: 'source', hop: 0, node: 'A', key: 'scan', word: 'seen' },
  { phase: 'transit', hop: 1, node: 'B', key: 'retain', word: 'kept' },
  { phase: 'destination', hop: 2, node: 'C', key: 'age', word: 'proven' },
];

describe('packet timeline (spec §5)', () => {
  const tl = buildTimeline(['A', 'B', 'C'], EVENTS, xyOf);

  it('dwells for inspection, travels one HOP_MS per trunk, holds at the gate', () => {
    expect([HOP_MS, INSPECT_MS, GATE_MS, FADE_MS]).toEqual([700, 450, 500, 400]);
    expect(tl.srcDwell).toBe(450);
    expect(tl.travel).toBe(1400);
    expect(tl.gate).toBe(500);
    expect(tl.durationMs).toBe(2350);
    expect(tl.hopTimes).toEqual([450, 1150, 1850]);
  });

  it('cues each word when the packet reaches its node', () => {
    expect(tl.cues).toEqual([
      { t: 0, node: 'A', key: 'scan', word: 'seen' },
      { t: 1150, node: 'B', key: 'retain', word: 'kept' },
      { t: 1850, node: 'C', key: 'age', word: 'proven' },
    ]);
  });

  it('leaves open during inspection, then travels sealed with eased hops', () => {
    expect(packetAt(tl, 0)).toEqual({ x: 0, y: 0, alive: 1, open: 1 });
    expect(packetAt(tl, 800)).toEqual({ x: 50, y: 0, alive: 1, open: 0 });
    expect(packetAt(tl, 1150)).toEqual({ x: 100, y: 0, alive: 1, open: 0 });
    expect(packetAt(tl, 1500)).toEqual({ x: 100, y: 25, alive: 1, open: 0 });
  });

  it('waits at the gate, then fades out', () => {
    expect(packetAt(tl, 2349)).toEqual({ x: 100, y: 50, alive: 1, open: 0 });
    expect(packetAt(tl, 2550)).toEqual({ x: 100, y: 50, alive: 0.5, open: 0 });
    expect(packetAt(tl, 2750)).toEqual({ x: 100, y: 50, alive: 0, open: 0 });
  });

  it('skips the dwell and gate when nothing fires there', () => {
    const quiet = buildTimeline(['A', 'B'], [], xyOf);
    expect(quiet.durationMs).toBe(700);
    expect(quiet.open).toBe(false);
    expect(packetAt(quiet, 0)).toEqual({ x: 0, y: 0, alive: 1, open: 0 });
  });

  it('marks named and measured packets', () => {
    const marked = buildTimeline(['A', 'B'], [
      { phase: 'source', hop: 0, node: 'A', key: 'digitalId', word: 'named' },
      { phase: 'source', hop: 0, node: 'A', key: 'biometric', word: 'measured' },
    ], xyOf);
    expect([marked.named, marked.measured]).toEqual([true, true]);
  });

  it('has no packet for a route that goes nowhere', () => {
    expect(packetAt(buildTimeline(['A'], [], xyOf), 0)).toBeNull();
    expect(packetAt(null, 0)).toBeNull();
  });
});
