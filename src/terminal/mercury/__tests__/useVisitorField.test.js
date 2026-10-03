import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import useVisitorField from '../useVisitorField';
import { HG_MIRROR_UNIFORMS } from '../planet/hgMirrorGlsl';
import { createVisitorFrame } from '../planet/visitorFrame';

const planetMaterial = { uniforms: Object.fromEntries(['uCoreR', ...HG_MIRROR_UNIFORMS].map((n) => [n, { value: 0 }])) };

describe('useVisitorField upload', () => {
  it('idle frame hides the mesh and uploads nothing; a live frame shows it and sets uVisN', () => {
    const { result } = renderHook(() => useVisitorField({ planetMaterial }));
    const f = result.current;
    f.upload(createVisitorFrame(), 1, 0.01); // no mesh yet: a no-op
    const mesh = { visible: true };
    f.meshRef.current = mesh;
    const frame = createVisitorFrame();
    f.upload(frame, 1, 0.01);
    expect(mesh.visible).toBe(false);
    expect(f.material.uniforms.uVisN.value).toBe(0);
    frame.visible = true; frame.n = 1; frame.vis.set([1, 2, 3, 0.5]); frame.rect.set([-0.5, -0.5, 0.5, 0.5]);
    f.upload(frame, 2, 0.02);
    expect(mesh.visible).toBe(true);
    expect(f.material.uniforms.uVisN.value).toBe(1);
    expect(f.material.uniforms.uVis.value[0]).toEqual(new THREE.Vector4(1, 2, 3, 0.5));
    expect(f.material.uniforms.uTime.value).toBe(2);
    expect(f.material.uniforms.uCoreR).toBe(planetMaterial.uniforms.uCoreR);
  });
});
