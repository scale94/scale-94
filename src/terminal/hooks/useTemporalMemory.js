// useTemporalMemory.js — Temporal memory / history recording for the sphere graph.
//
// Records sphere state snapshots at a configurable interval and exposes
// timeline scrubbing (playback) so the sphere can replay recorded history
// instead of running live physics.
//
// Ring buffer of up to 600 snapshots (~5 min at 30 fps, sampling every 30 frames).
// Node positions and energies stored as compact Float32Arrays to minimize GC pressure.

import { useRef, useCallback } from 'react';

const MAX_SNAPSHOTS       = 600;
const DEFAULT_SAMPLE_RATE = 30;  // record every N frames
const NODE_COUNT          = 31;  // base node count

// ── Snapshot layout ──────────────────────────────────────────────────
// Each snapshot is a plain object held in the ring buffer.  Positions
// and energies use pre-allocated Float32Arrays that are *copied into*
// on each record call so we never retain references to live sim arrays.

function createEmptySnapshot() {
  return {
    frame:           0,
    timestamp:       0,
    positions:       new Float32Array(NODE_COUNT * 3),  // x,y,z packed
    energies:        new Float32Array(NODE_COUNT),
    activeEdges:     null,   // [[aId, bId], ...]
    phaseRegime:     null,   // 'STABLE' | 'PERIOD_2' | etc.
    r:               0,
    lyapunov:        0,
    hopfieldEnergy:  0,
    nodeCount:       NODE_COUNT,
  };
}

// ── Ring buffer ──────────────────────────────────────────────────────

function createRingBuffer(capacity) {
  const slots = [];
  for (let i = 0; i < capacity; i++) slots.push(createEmptySnapshot());
  return {
    slots,
    head:  0,   // next write index
    count: 0,   // how many valid snapshots
    capacity,
  };
}

function ringWrite(ring, writeFn) {
  // writeFn receives the pre-allocated snapshot object and fills it in-place
  writeFn(ring.slots[ring.head]);
  ring.head = (ring.head + 1) % ring.capacity;
  if (ring.count < ring.capacity) ring.count++;
}

function ringGet(ring, index) {
  if (index < 0 || index >= ring.count) return null;
  // oldest lives at (head - count + capacity) % capacity
  const start = (ring.head - ring.count + ring.capacity) % ring.capacity;
  return ring.slots[(start + index) % ring.capacity];
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useTemporalMemory({ sampleRate = DEFAULT_SAMPLE_RATE } = {}) {
  const memoryRef      = useRef(null);
  const isRecording    = useRef(true);
  const isPlayback     = useRef(false);
  const playbackFrame  = useRef(0);
  const playbackSpeed  = useRef(1);
  const _frameAccum    = useRef(0);   // fractional frame accumulator for sub-1x speeds
  const _sampleCounter = useRef(0);

  // Lazily initialise ring buffer (avoids allocation on every render)
  if (memoryRef.current === null) {
    memoryRef.current = createRingBuffer(MAX_SNAPSHOTS);
  }

  // ── Record ───────────────────────────────────────────────────────
  // Called every RAF frame.  Only actually stores a snapshot every
  // `sampleRate` frames to keep the buffer manageable.
  //
  // Arguments follow the existing hook convention:
  //   stateRef     — from useSomaGraph   { current: { nodes, frame } }
  //   edgeStateRef — from useKineticEdges { current: EdgeState[] }
  //   fieldRef     — ref to latest associative field data (or null)

  const recordSnapshot = useCallback((stateRef, edgeStateRef, fieldRef) => {
    if (!isRecording.current || isPlayback.current) return;

    _sampleCounter.current++;
    if (_sampleCounter.current < sampleRate) return;
    _sampleCounter.current = 0;

    const state = stateRef?.current;
    if (!state) return;

    const ring  = memoryRef.current;
    const nodes = state.nodes;
    const edges = edgeStateRef?.current;
    const field = fieldRef?.current ?? fieldRef;  // accept ref or plain value

    ringWrite(ring, (snap) => {
      snap.frame     = state.frame;
      snap.timestamp = performance.now();

      // Pack positions — handle both base nodes and bifurcation children
      const nCount = Math.min(nodes.length, NODE_COUNT);
      snap.nodeCount = nodes.length;  // may exceed NODE_COUNT if bifurcation children exist

      // Resize typed arrays if the node population grew past the initial allocation
      if (nodes.length * 3 > snap.positions.length) {
        snap.positions = new Float32Array(nodes.length * 3);
        snap.energies  = new Float32Array(nodes.length);
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const o = i * 3;
        snap.positions[o]     = n.x;
        snap.positions[o + 1] = n.y;
        snap.positions[o + 2] = n.z;
        snap.energies[i]      = n.energy;
      }

      // Active edges — only store [aId, bId] pairs where overwrite or pulse > 0
      if (edges) {
        snap.activeEdges = [];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (e.pulse > 0 || e.overwrite) {
            snap.activeEdges.push([e.aId, e.bId]);
          }
        }
      } else {
        snap.activeEdges = [];
      }

      // Associative field metadata
      if (field) {
        snap.phaseRegime    = field.regime  ?? field.phaseRegime ?? null;
        snap.r              = field.r       ?? 0;
        snap.lyapunov       = field.lyapunov ?? field.lambda     ?? 0;
        snap.hopfieldEnergy = field.energy  ?? field.hopfieldEnergy ?? 0;
      } else {
        snap.phaseRegime    = null;
        snap.r              = 0;
        snap.lyapunov       = 0;
        snap.hopfieldEnergy = 0;
      }
    });
  }, [sampleRate]);

  // ── Playback controls ────────────────────────────────────────────

  const startPlayback = useCallback(() => {
    isPlayback.current = true;
    isRecording.current = false;
    _frameAccum.current = 0;
  }, []);

  const stopPlayback = useCallback(() => {
    isPlayback.current = false;
    isRecording.current = true;
    _frameAccum.current = 0;
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlayback.current) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [startPlayback, stopPlayback]);

  // Seek to normalised position [0, 1]
  const seekTo = useCallback((normalizedPosition) => {
    const ring = memoryRef.current;
    if (!ring || ring.count === 0) return;
    const clamped = Math.max(0, Math.min(1, normalizedPosition));
    playbackFrame.current = Math.round(clamped * (ring.count - 1));
  }, []);

  const getSnapshot = useCallback((index) => {
    return ringGet(memoryRef.current, index);
  }, []);

  const getSnapshotCount = useCallback(() => {
    return memoryRef.current ? memoryRef.current.count : 0;
  }, []);

  const setPlaybackSpeed = useCallback((speed) => {
    // Clamp to allowed set: 0.5, 1, 2, 4 (or any positive number)
    playbackSpeed.current = Math.max(0.25, Math.min(8, speed));
    _frameAccum.current = 0;
  }, []);

  // ── Timeline export ──────────────────────────────────────────────
  // Serialise all valid snapshots to JSON for score / session export.

  const exportTimeline = useCallback(() => {
    const ring = memoryRef.current;
    if (!ring || ring.count === 0) return '[]';

    const out = [];
    for (let i = 0; i < ring.count; i++) {
      const snap = ringGet(ring, i);
      out.push({
        frame:          snap.frame,
        timestamp:      snap.timestamp,
        positions:      Array.from(snap.positions.subarray(0, snap.nodeCount * 3)),
        energies:       Array.from(snap.energies.subarray(0, snap.nodeCount)),
        activeEdges:    snap.activeEdges,
        phaseRegime:    snap.phaseRegime,
        r:              snap.r,
        lyapunov:       snap.lyapunov,
        hopfieldEnergy: snap.hopfieldEnergy,
        nodeCount:      snap.nodeCount,
      });
    }
    return JSON.stringify(out);
  }, []);

  // ── Return ───────────────────────────────────────────────────────

  return {
    memoryRef,
    recordSnapshot,
    isRecording,
    isPlayback,
    playbackFrame,
    startPlayback,
    stopPlayback,
    togglePlayback,
    seekTo,
    getSnapshot,
    getSnapshotCount,
    playbackSpeed,
    setPlaybackSpeed,
    exportTimeline,
  };
}
