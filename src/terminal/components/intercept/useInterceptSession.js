// useInterceptSession.js — the visitor's side of the lattice: which route,
// which moment in legislative time, what the last packet went through.
// All state is component-local and dies with the tab (spec §1, §7) — nothing
// reaches storage, the network, the spine or the panopticon store.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NOW_STEP, route, lawsFiring, packetFate, fateLine, trunkIndex,
} from '../../lib/interceptLattice';
import { buildTimeline } from '../../lib/interceptPacket';
import { nodeXY } from './interceptGeometry';

export const KEPT_CAP = 12;
export const WORD_MS = 1600;

const clearTimers = (ref) => {
  ref.current.forEach(clearTimeout);
  ref.current = [];
};

export function useInterceptSession(laws) {
  const [step, setStep] = useState(NOW_STEP);
  const [src, setSrc] = useState(null);
  const [dst, setDst] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [fate, setFate] = useState('');
  const [words, setWords] = useState([]);
  const [hop, setHop] = useState(null);
  const [marks, setMarks] = useState({ read: [], watch: null });
  const [traced, setTraced] = useState([]);
  const [kept, setKept] = useState({});
  const seqRef = useRef(0);
  const wordIdRef = useRef(0);
  const timersRef = useRef([]);
  const packetRef = useRef(null);

  useEffect(() => () => clearTimers(timersRef), []);

  const path = useMemo(() => (src && dst ? route(src, dst, waypoints) : null), [src, dst, waypoints]);

  // Every change of route, detent or corpus is a new send (spec §5).
  useEffect(() => {
    clearTimers(timersRef);
    setWords((w) => (w.length ? [] : w));
    if (!path || path.length < 2) {
      packetRef.current = null;
      setFate('');
      setHop(null);
      setMarks({ read: [], watch: null });
      return;
    }
    seqRef.current += 1;
    const events = packetFate(path, lawsFiring(laws, step, seqRef.current));
    setFate(fateLine(path, events));
    setMarks({
      read: [...new Set(events.filter((e) => e.key === 'backdoor').map((e) => e.node))],
      watch: events.some((e) => e.key === 'worker') ? path[0] : null,
    });

    const keptNodes = [...new Set(events.filter((e) => e.key === 'retain').map((e) => e.node))];
    if (keptNodes.length) {
      setKept((k) => {
        const next = { ...k };
        for (const id of keptNodes) next[id] = Math.min(KEPT_CAP, (next[id] ?? 0) + 1);
        return next;
      });
    }
    const tracedIdx = [];
    for (const e of events) {
      if (e.key !== 'traffic') continue;
      for (const other of [path[e.hop - 1], path[e.hop + 1]]) {
        const i = other ? trunkIndex(e.node, other) : -1;
        if (i >= 0) tracedIdx.push(i);
      }
    }
    if (tracedIdx.length) setTraced((t) => [...new Set([...t, ...tracedIdx])]);

    const tl = buildTimeline(path, events, nodeXY);
    packetRef.current = { timeline: tl, start: performance.now() };
    setHop(0);
    tl.hopTimes.forEach((t, h) => {
      if (h > 0) timersRef.current.push(setTimeout(() => setHop(h), t));
    });
    for (const cue of tl.cues) {
      wordIdRef.current += 1;
      const id = wordIdRef.current;
      timersRef.current.push(setTimeout(() => setWords((w) => [...w, { id, node: cue.node, word: cue.word, key: cue.key }]), cue.t));
      timersRef.current.push(setTimeout(() => setWords((w) => w.filter((x) => x.id !== id)), cue.t + WORD_MS));
    }
  }, [path, step, laws]);

  // First click picks the source, second the destination; a bend adds a
  // waypoint; clicking the source again clears the route (spec §9).
  const activate = useCallback((id, { bend = false } = {}) => {
    if (!src) { setSrc(id); return 'src'; }
    if (id === src) { setSrc(null); setDst(null); setWaypoints([]); return 'reset'; }
    if (!dst) { setDst(id); return 'dst'; }
    if (bend) {
      if (id === dst || waypoints.includes(id)) return null;
      setWaypoints((w) => [...w, id]);
      return 'bend';
    }
    setSrc(id); setDst(null); setWaypoints([]);
    return 'src';
  }, [src, dst, waypoints]);

  return { step, setStep, src, dst, waypoints, path, activate, fate, words, hop, marks, traced, kept, packetRef };
}
