// artProbe.test.js — sphere anchoring for the `query <text>` probe.
//
// queryProject ranks against the full 272-node corpus, but the sphere only
// carries the 31 curated SPHERE_NODES. Without an anchor map the probe marker
// has no position to render at whenever the top matches are all off-sphere —
// which is the common case, not the edge case.

import { describe, it, expect } from 'vitest';
import {
  SPHERE_NODES, SPHERE_ANCHOR, probeAnchors, queryProject,
} from '../artGraph';
import { NODES, NODE_IDX, FEATURES, cosineSim } from '../../data/nodeFeatures';

const SPHERE_IDS = new Set(SPHERE_NODES.map(n => n.id));

// Queries whose top-4 corpus matches contain no sphere node at all.
const OFF_SPHERE_QUERIES = [
  'crystalline entropy', 'ecology collapse', 'language grammar',
  'perfume', 'consciousness', 'reaction diffusion pattern',
];

describe('SPHERE_ANCHOR', () => {
  it('maps every corpus node onto a node that is actually on the sphere', () => {
    for (const n of NODES) {
      expect(SPHERE_IDS.has(SPHERE_ANCHOR[n.id]), `${n.id} -> ${SPHERE_ANCHOR[n.id]}`).toBe(true);
    }
  });

  it('anchors each sphere node to itself', () => {
    for (const n of SPHERE_NODES) expect(SPHERE_ANCHOR[n.id]).toBe(n.id);
  });

  it('picks the nearest sphere node in the same 16D space the ranking uses', () => {
    // Spot-check against a brute-force recompute rather than hardcoded pairs.
    const brute = (id) => {
      const f = FEATURES[NODE_IDX[id]] ?? [];
      let bestId = null, bestSim = -Infinity;
      for (const s of SPHERE_NODES) {
        const c = cosineSim(f, FEATURES[NODE_IDX[s.id]] ?? []);
        if (c > bestSim) { bestSim = c; bestId = s.id; }
      }
      return bestId;
    };
    for (const id of ['thanatos', 'crispr', 'deixis', 'dead_internet']) {
      expect(SPHERE_ANCHOR[id]).toBe(brute(id));
    }
  });

  it('returns undefined for an unknown id rather than a bogus anchor', () => {
    expect(SPHERE_ANCHOR.not_a_node).toBeUndefined();
  });
});

describe('probeAnchors', () => {
  it('merges matches that share an anchor and sums their weight', () => {
    const anchors = probeAnchors([
      { id: 'deixis',      sim: 0.5 },   // -> pragmatic
      { id: 'glossopoeia', sim: 0.3 },   // -> pragmatic
      { id: 'soma_plus',   sim: 0.2 },   // -> itself
    ]);
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toMatchObject({ id: 'pragmatic', weight: 0.8 });
    expect(anchors[0].sources).toEqual(['deixis', 'glossopoeia']);
    expect(anchors[1]).toMatchObject({ id: 'soma_plus', weight: 0.2, sources: ['soma_plus'] });
  });

  it('orders anchors by descending weight', () => {
    const anchors = probeAnchors([
      { id: 'soma_plus', sim: 0.2 },
      { id: 'deixis',    sim: 0.9 },
    ]);
    expect(anchors.map(a => a.id)).toEqual(['pragmatic', 'soma_plus']);
  });

  it('honours topN, considering only that many matches', () => {
    const sims = [
      { id: 'soma_plus', sim: 0.9 },
      { id: 'deixis',    sim: 0.8 },
      { id: 'thanatos',  sim: 0.7 },
    ];
    expect(probeAnchors(sims, 2).map(a => a.id)).toEqual(['soma_plus', 'pragmatic']);
  });

  it('drops non-positive and unknown matches', () => {
    expect(probeAnchors([
      { id: 'soma_plus',  sim: 0 },
      { id: 'not_a_node', sim: 0.5 },
      { id: 'deixis',     sim: -0.1 },
    ])).toEqual([]);
  });

  it('tolerates an empty or missing list', () => {
    expect(probeAnchors([])).toEqual([]);
    expect(probeAnchors(undefined)).toEqual([]);
  });
});

describe('queryProject', () => {
  it('gives every ranked row its sphere anchor', () => {
    const { similarities } = queryProject('crystalline entropy');
    for (const s of similarities) expect(SPHERE_IDS.has(s.anchor)).toBe(true);
  });

  it('always yields a renderable anchor set — the bug this fixes', () => {
    for (const q of OFF_SPHERE_QUERIES) {
      const result = queryProject(q);
      // Precondition: this query really is one the old code could not draw.
      const top4 = result.similarities.slice(0, 4);
      expect(top4.some(s => SPHERE_IDS.has(s.id)), `${q} was expected to be off-sphere`).toBe(false);
      // The probe still has somewhere to go.
      expect(result.anchors.length).toBeGreaterThan(0);
      expect(result.anchors.reduce((sum, a) => sum + a.weight, 0)).toBeGreaterThan(1e-12);
      for (const a of result.anchors) expect(SPHERE_IDS.has(a.id)).toBe(true);
    }
  });

  it('anchors a query whose matches are already on the sphere to those nodes', () => {
    const { anchors } = queryProject('post-quantum key');
    expect(anchors.map(a => a.id)).toEqual(expect.arrayContaining(['classified', 'pqhash', 'dh_ec']));
  });

  it('carries a label for each anchor so the panel can name it', () => {
    for (const a of queryProject('consciousness').anchors) {
      expect(a.label).toBe(SPHERE_NODES.find(n => n.id === a.id).label);
    }
  });
});
