// interceptPacket.js — the packet's timeline: when it leaves, where it is at
// any moment, and when each word fires (spec §5). Pure; positions are in map
// units (the 800 × 400 WorldMap viewBox).

export const HOP_MS = 700;       // one trunk
export const INSPECT_MS = 450;   // dwell at the source when anything fires before leaving
export const GATE_MS = 500;      // hold at the destination for 'proven'
export const FADE_MS = 400;      // the bead fades out after arrival

const smooth = (f) => f * f * (3 - 2 * f);

export function buildTimeline(path, events, xyOf) {
  const pts = (path ?? []).map(xyOf);
  const srcDwell = events.some((e) => e.phase === 'source') ? INSPECT_MS : 0;
  const travel = Math.max(0, pts.length - 1) * HOP_MS;
  const gate = events.some((e) => e.phase === 'destination' && e.key === 'age') ? GATE_MS : 0;
  const cueAt = (e) => {
    if (e.phase === 'source') return 0;
    if (e.phase === 'destination') return srcDwell + travel;
    return srcDwell + e.hop * HOP_MS;
  };
  return {
    pts,
    srcDwell,
    travel,
    gate,
    durationMs: srcDwell + travel + gate,
    cues: events.map((e) => ({ t: cueAt(e), node: e.node, key: e.key, word: e.word })),
    hopTimes: pts.map((_, h) => srcDwell + h * HOP_MS),
    open: events.some((e) => e.phase === 'source' && e.key === 'scan'),
    named: events.some((e) => e.key === 'digitalId'),
    measured: events.some((e) => e.key === 'biometric'),
  };
}

// → { x, y, alive (0..1), open (0|1) } or null when there is no packet.
export function packetAt(tl, ms) {
  if (!tl || tl.pts.length < 2) return null;
  const last = tl.pts[tl.pts.length - 1];
  if (ms >= tl.durationMs) {
    const alive = Math.max(0, 1 - (ms - tl.durationMs) / FADE_MS);
    return { x: last[0], y: last[1], alive, open: 0 };
  }
  const t = ms - tl.srcDwell;
  if (t <= 0) return { x: tl.pts[0][0], y: tl.pts[0][1], alive: 1, open: tl.open ? 1 : 0 };
  const hopF = Math.min(t / HOP_MS, tl.pts.length - 1);
  const i = Math.min(Math.floor(hopF), tl.pts.length - 2);
  const f = smooth(hopF - i);
  const [x0, y0] = tl.pts[i];
  const [x1, y1] = tl.pts[i + 1];
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, alive: 1, open: 0 };
}
