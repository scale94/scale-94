// artSphereIndex.test.js — the two coordinate spaces, made explicit.
//
// ArtTab holds node data in TWO index spaces that are easy to confuse because
// both are "an index into an array of nodes":
//
//   corpus space — NODE_IDX[id] -> position in the 272-entry NODES array.
//                  FEATURES, Hopfield activations and perturbField all live here.
//   sphere  space — position in the ~31-entry live sphere array (SPHERE_NODES
//                  plus any bifurcation children appended at runtime). The draw
//                  loop's `nodes` and `proj` arrays live here.
//
// Indexing a sphere-space array with a corpus-space index throws: most corpus
// indices are past the end of the ~31-entry array, so `nodes[si].energy` reads
// a property of undefined. The draw loop re-schedules its rAF before the try
// block, so the page survives — and that is what makes it nasty. It throws at
// the same point on every frame, so every layer drawn after that point is
// silently dropped for as long as the state persists. Measured on the manual
// fusion ring: ~200-500 exceptions per lock, all particles gone, and the DOM
// labels frozen in place while the sphere keeps rotating beneath them.
// This has now happened twice (the `query` probe, then the manual-fusion ring),
// so the lookup gets a name.

import { describe, it, expect } from 'vitest';
import { SPHERE_NODES, sphereIndexOf } from '../artGraph';
import { NODE_IDX } from '../../data/nodeFeatures';

// Stand-in for the draw loop's live array: the curated sphere set, plus a
// runtime bifurcation child of the kind chimera injection appends.
const liveNodes = () => [
  ...SPHERE_NODES.map(n => ({ ...n, energy: 0.5 })),
  { id: 'chimera_1723', label: 'chimera', cluster: 'synth', energy: 0.9 },
];

describe('sphereIndexOf', () => {
  it('finds a node by identity in the live sphere array', () => {
    const nodes = liveNodes();
    for (let i = 0; i < nodes.length; i++) {
      expect(sphereIndexOf(nodes, nodes[i].id)).toBe(i);
    }
  });

  it('finds runtime-appended nodes that are not in SPHERE_NODES at all', () => {
    const nodes = liveNodes();
    expect(sphereIndexOf(nodes, 'chimera_1723')).toBe(nodes.length - 1);
  });

  it('returns -1 for a corpus node that is not on the sphere', () => {
    // 'thanatos' is one of the 241 corpus nodes with no sphere position.
    expect(NODE_IDX.thanatos).toBeGreaterThanOrEqual(0);
    expect(sphereIndexOf(liveNodes(), 'thanatos')).toBe(-1);
  });

  it('returns -1 for a missing id rather than throwing', () => {
    const nodes = liveNodes();
    expect(sphereIndexOf(nodes, undefined)).toBe(-1);
    expect(sphereIndexOf(nodes, null)).toBe(-1);
    expect(sphereIndexOf(nodes, 'not_a_node')).toBe(-1);
    expect(sphereIndexOf(null, 'kuramoto')).toBe(-1);
  });

  it('never agrees with NODE_IDX often enough to be substituted for it', () => {
    // The regression lock. Before the fix the fusion ring used NODE_IDX[id] to
    // index the sphere array. Measure what that actually does to all 31 nodes:
    // most are out of bounds (a per-frame TypeError in the draw loop), some land
    // on the wrong node, and only a handful are accidentally right.
    const nodes = liveNodes();
    let outOfBounds = 0, wrongNode = 0, accidentallyRight = 0;
    for (const n of SPHERE_NODES) {
      const corpusIdx = NODE_IDX[n.id];
      const sphereIdx = sphereIndexOf(nodes, n.id);
      expect(nodes[sphereIdx].id).toBe(n.id);          // the named lookup is always right
      if (nodes[corpusIdx] === undefined)          outOfBounds++;
      else if (nodes[corpusIdx].id !== n.id)       wrongNode++;
      else                                         accidentallyRight++;
    }
    expect(outOfBounds).toBeGreaterThan(0);
    expect(outOfBounds + wrongNode).toBeGreaterThan(accidentallyRight);
    expect(accidentallyRight).toBeLessThan(SPHERE_NODES.length);
  });
});
