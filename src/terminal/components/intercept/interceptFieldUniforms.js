// Preallocated uniform buffers for the intercept field. Filled in place — no
// per-frame allocation, and the recording GL stub logs typed arrays by value.

import { NODES, TRUNKS } from '../../lib/interceptLattice';

export const N_TRUNKS = TRUNKS.length;
export const N_NODES = NODES.length;

export function createFieldBuffers() {
  return {
    trunks: new Float32Array(N_TRUNKS * 4),     // x1, y1, x2, y2
    trunkState: new Float32Array(N_TRUNKS * 2), // heat, traced
    nodes: new Float32Array(N_NODES * 4),       // x, y, load, kept
    packet: new Float32Array(4),                // x, y, alive, open
    marks: new Float32Array(2),                 // named, measured
  };
}

export function fillStatic(buf, xyOf) {
  TRUNKS.forEach(([a, b], i) => {
    const [x1, y1] = xyOf(a);
    const [x2, y2] = xyOf(b);
    buf.trunks.set([x1, y1, x2, y2], i * 4);
  });
  NODES.forEach((n, i) => {
    const [x, y] = xyOf(n.id);
    buf.nodes[i * 4] = x;
    buf.nodes[i * 4 + 1] = y;
  });
}

export function fillScene(buf, { loads = {}, kept = {}, traced = new Set() } = {}) {
  NODES.forEach((n, i) => {
    buf.nodes[i * 4 + 2] = loads[n.id] ?? 0;
    buf.nodes[i * 4 + 3] = kept[n.id] ?? 0;
  });
  TRUNKS.forEach(([a, b], i) => {
    buf.trunkState[i * 2] = Math.max(loads[a] ?? 0, loads[b] ?? 0);
    buf.trunkState[i * 2 + 1] = traced.has(i) ? 1 : 0;
  });
}

export function fillPacket(buf, state, timeline) {
  if (!state || state.alive <= 0) {
    buf.packet.fill(0);
    buf.marks.fill(0);
    return;
  }
  buf.packet[0] = state.x;
  buf.packet[1] = state.y;
  buf.packet[2] = state.alive;
  buf.packet[3] = state.open;
  buf.marks[0] = timeline?.named ? 1 : 0;
  buf.marks[1] = timeline?.measured ? 1 : 0;
}
