import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// drei's MeshTransmissionMaterial renders the whole scene into its own FBO every frame,
// even when its mesh is visible={false} (backside: twice). Four hidden glass meshes in the
// Mercury canvas cost 8 extra full-scene renders per frame (measured in headless Chrome
// 2026-10-02: 9 gl.render calls per rAF). The planet canvas must never mount them.
const src = readFileSync(resolve(__dirname, '../MercuryCanvas.jsx'), 'utf8');

describe('MercuryCanvas', () => {
  it('mounts no transmission-glass meshes (each one re-renders the scene every frame)', () => {
    for (const name of ['GlassKnot', 'GlassHearth', 'CrystalGeode', 'AtmoShell', 'MeshTransmissionMaterial']) {
      expect(src, name).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});
