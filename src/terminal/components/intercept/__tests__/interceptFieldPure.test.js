import { describe, it, expect } from 'vitest';
import { NODE_IDS, TRUNKS } from '../../../lib/interceptLattice';
import { nodeXY, convexHull, membranePath, EU_MEMBRANE_PATH } from '../interceptGeometry';
import { FIELD_UNIFORMS, FIELD_VS, FIELD_FS } from '../interceptFieldShader';
import {
  N_TRUNKS, N_NODES, createFieldBuffers, fillStatic, fillScene, fillPacket,
} from '../interceptFieldUniforms';

describe('intercept geometry', () => {
  it('places every node inside the 800 × 400 map', () => {
    for (const id of NODE_IDS) {
      const [x, y] = nodeXY(id);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(400);
    }
  });

  it('keeps hull corners and drops interior points', () => {
    const hull = convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual([5, 5]);
  });

  it('draws a closed, padded membrane', () => {
    const d = membranePath([[0, 0], [10, 0], [0, 10]], 2);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(EU_MEMBRANE_PATH.length).toBeGreaterThan(10);
  });
});

describe('intercept field shader', () => {
  it('is GLSL ES 3.00 and declares every harvested uniform', () => {
    expect(FIELD_VS.startsWith('#version 300 es')).toBe(true);
    expect(FIELD_FS.startsWith('#version 300 es')).toBe(true);
    expect(FIELD_UNIFORMS).toEqual(['u_resolution', 'u_time', 'u_trunks', 'u_trunkState', 'u_nodes', 'u_packet', 'u_marks']);
    for (const name of FIELD_UNIFORMS) expect(FIELD_FS).toMatch(new RegExp(`uniform \\w+ ${name}[\\[;]`));
  });

  it('sizes its arrays from the model', () => {
    expect(FIELD_FS).toContain(`uniform vec4 u_trunks[${TRUNKS.length}];`);
    expect(FIELD_FS).toContain(`uniform vec2 u_trunkState[${TRUNKS.length}];`);
    expect(FIELD_FS).toContain(`uniform vec4 u_nodes[${NODE_IDS.length}];`);
  });
});

describe('intercept field uniforms', () => {
  it('preallocates buffers sized to the model', () => {
    const b = createFieldBuffers();
    expect([N_TRUNKS, N_NODES]).toEqual([22, 11]);
    expect([b.trunks.length, b.trunkState.length, b.nodes.length, b.packet.length, b.marks.length]).toEqual([88, 44, 44, 4, 2]);
  });

  it('fills trunk endpoints and node positions from the projection', () => {
    const b = createFieldBuffers();
    fillStatic(b, nodeXY);
    const [a, c] = TRUNKS[0];
    expect(Array.from(b.trunks.slice(0, 4))).toEqual([...nodeXY(a), ...nodeXY(c)].map(Math.fround));
    expect(Array.from(b.nodes.slice(0, 2))).toEqual(nodeXY(NODE_IDS[0]).map(Math.fround));
  });

  it('heats a trunk by its hotter end and marks traced trunks', () => {
    const b = createFieldBuffers();
    fillScene(b, { loads: { US: 0.25, CA: 0.75 }, kept: { UK: 0.5 }, traced: new Set([0]) });
    expect(b.trunkState[0]).toBeCloseTo(0.75);
    expect(b.trunkState[1]).toBe(1);
    const uk = NODE_IDS.indexOf('UK');
    expect(b.nodes[uk * 4 + 3]).toBeCloseTo(0.5);
    expect(b.nodes[1 * 4 + 2]).toBeCloseTo(0.75);
  });

  it('writes the packet and its marks, and clears them when it is gone', () => {
    const b = createFieldBuffers();
    fillPacket(b, { x: 10, y: 20, alive: 1, open: 1 }, { named: true, measured: false });
    expect(Array.from(b.packet)).toEqual([10, 20, 1, 1]);
    expect(Array.from(b.marks)).toEqual([1, 0]);
    fillPacket(b, null, null);
    expect(Array.from(b.packet)).toEqual([0, 0, 0, 0]);
    expect(Array.from(b.marks)).toEqual([0, 0]);
  });
});
