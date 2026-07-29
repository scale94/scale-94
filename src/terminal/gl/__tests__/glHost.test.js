import { describe, it, expect, vi } from 'vitest';
import { createRecordingGL } from './recordingGL';
import { createShaderHost } from '../glHost';

function canvasWith(gl) {
  return { getContext: () => gl, style: {}, width: 0, height: 0 };
}

const BASE = { vs: 'VS', fs: 'FS', uniforms: ['u_a'], pixelSize: 100 };

describe('createShaderHost', () => {
  it('returns null when the context is unavailable', () => {
    const canvas = { getContext: () => null, style: {} };
    expect(createShaderHost(canvas, { ...BASE, strategy: 'legacy' })).toBeNull();
  });

  it('sizes the backing store by DPR, clamped to 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(canvas, { ...BASE, version: 1, strategy: 'legacy' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
    vi.unstubAllGlobals();
  });

  it('writes style size only when asked', () => {
    const a = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(a, { ...BASE, version: 1, strategy: 'legacy' });
    expect(a.style.width).toBeUndefined();

    const b = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(b, { ...BASE, version: 1, strategy: 'legacy', setStyleSize: true });
    expect(b.style.width).toBe('100px');
  });

  it('harvests uniform locations into a keyed map', () => {
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    const host = createShaderHost(canvas, {
      ...BASE, version: 1, strategy: 'legacy', uniforms: ['u_a', 'u_b'],
    });
    // recordingGL tags uniform locations as `uniform:<programTag>:<name>` (see
    // recordingGL.js getUniformLocation) so the tag carries a program-id
    // segment, not just the bare name — assert on the structure that
    // actually matters here: each entry is keyed by its uniform name.
    // program:0 is deterministic here: a fresh recording stub tags its first
    // tag-consuming call `program:0`, and createProgram() is that first call
    // for strategy 'legacy'. Assert the exact tag, not a wildcard-program
    // regex — a regex would still pass if an extra tag-consuming call were
    // accidentally inserted before createProgram(), which is exactly the
    // defect class this test exists to catch.
    expect(host.U.u_a.__tag).toBe('uniform:program:0:u_a');
    expect(host.U.u_b.__tag).toBe('uniform:program:0:u_b');
  });

  it("legacy strategy creates the program before compiling and never deletes shaders", () => {
    const gl = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createProgram')).toBeLessThan(names.indexOf('createShader'));
    expect(names).not.toContain('deleteShader');
    expect(names).not.toContain('getProgramParameter');
  });

  it('lunar strategy compiles first, deletes shaders, and checks link status', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createShader')).toBeLessThan(names.indexOf('createProgram'));
    expect(names).toContain('deleteShader');
    expect(names).toContain('getProgramParameter');
  });

  it('lunar strategy throws with the driver log on compile failure', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getShaderParameter = () => false;
    gl.getShaderInfoLog = () => 'BOOM';
    expect(() =>
      createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar', label: 'moon' })
    ).toThrow(/moon.*BOOM/s);
  });

  it('legacy strategy survives compile failure and returns a host', () => {
    const gl = createRecordingGL({ version: 1 });
    gl.getShaderParameter = () => false;
    const host = createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    expect(host).not.toBeNull();
  });

  it('uses a VAO at version 2 and a bare attribute at version 1', () => {
    const v2 = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(v2), { ...BASE, version: 2, strategy: 'lunar' });
    expect(v2.__log.map(e => e[0])).toContain('createVertexArray');

    const v1 = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(v1), { ...BASE, version: 1, strategy: 'legacy' });
    expect(v1.__log.map(e => e[0])).toContain('getAttribLocation');
  });

  // The 12 tests above only ever inspect the *build* phase (compile/link
  // order, shader deletion, VAO vs bare attribute). None of them pin down
  // the relative order of the later uniform-harvest and blend-state groups,
  // so all-green here was never evidence against a bug in that phase —
  // which is exactly the class of bug Finding 1 found (legacy emitted
  // blend before uniforms; the live components and the frozen glParity
  // snapshot require uniforms before blend). These two tests assert the
  // full ordered call-name sequence for each strategy so that phase can't
  // silently reorder again.
  //
  // The expected sequences are derived from the *live* component source and
  // the committed glParity snapshot, not from glHost's current output:
  //   - legacy: MercuryTerminator.jsx / ObserverEye.jsx inline setup +
  //     glParity.test.jsx.snap lines ~4460-4487 (MercuryTerminator init) —
  //     createProgram → [compile VS, attach] → [compile FS, attach] →
  //     linkProgram → useProgram → buffer/attrib setup →
  //     getUniformLocation × N → enable(BLEND) → blendFunc → viewport.
  //   - lunar: LunarShaderMoon.jsx uniform harvest (uRadius…uLibration) +
  //     glParity.test.jsx.snap lines ~787-853 (LunarShaderMoon init) —
  //     [compile VS] → [compile FS] → createProgram → attach × 2 →
  //     linkProgram → deleteShader × 2 → getProgramParameter → viewport →
  //     VAO/buffer/attrib setup → viewport → useProgram →
  //     enable(BLEND) → blendFunc → getUniformLocation × N.
  it('legacy strategy: full ordered GL call sequence for a representative config', () => {
    const gl = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(gl), {
      ...BASE, version: 1, strategy: 'legacy', uniforms: ['u_a', 'u_b'],
    });
    const names = gl.__log.map(e => e[0]);
    expect(names).toEqual([
      'createProgram',
      'createShader', 'shaderSource', 'compileShader', 'getShaderParameter', 'attachShader',
      'createShader', 'shaderSource', 'compileShader', 'getShaderParameter', 'attachShader',
      'linkProgram',
      'useProgram',
      'createBuffer', 'bindBuffer', 'bufferData',
      'getAttribLocation', 'enableVertexAttribArray', 'vertexAttribPointer',
      'getUniformLocation', 'getUniformLocation',
      'enable', 'blendFunc',
      'viewport',
    ]);
  });

  it('lunar strategy: full ordered GL call sequence for a representative config', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar', uniforms: ['u_a', 'u_b'],
    });
    const names = gl.__log.map(e => e[0]);
    expect(names).toEqual([
      'createShader', 'shaderSource', 'compileShader', 'getShaderParameter',
      'createShader', 'shaderSource', 'compileShader', 'getShaderParameter',
      'createProgram', 'attachShader', 'attachShader',
      'linkProgram',
      'deleteShader', 'deleteShader',
      'getProgramParameter',
      'viewport',
      'createVertexArray', 'bindVertexArray',
      'createBuffer', 'bindBuffer', 'bufferData',
      'enableVertexAttribArray', 'vertexAttribPointer',
      'viewport', 'useProgram',
      'enable', 'blendFunc',
      'getUniformLocation', 'getUniformLocation',
    ]);
  });

  it('runs onInit after quad setup and before main-program activation', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onInit: () => { gl.__log.push(['MARK']); },
    });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('bufferData')).toBeLessThan(names.indexOf('MARK'));
    expect(names.indexOf('MARK')).toBeLessThan(names.lastIndexOf('useProgram'));
  });

  it('calls onDispose before deleting the program', () => {
    const gl = createRecordingGL({ version: 2 });
    const host = createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onDispose: (g) => g.deleteTexture({ __tag: 'texture:x' }),
    });
    host.dispose();
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('deleteTexture')).toBeLessThan(names.indexOf('deleteProgram'));
  });

  it('dispose calls loseContext only when asked', () => {
    const on = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(on), { ...BASE, version: 1, strategy: 'legacy' }).dispose();
    expect(on.__log.map(e => e[0])).toContain('loseContext');

    const off = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(off), {
      ...BASE, version: 2, strategy: 'lunar', loseContextOnDispose: false,
    }).dispose();
    expect(off.__log.map(e => e[0])).not.toContain('loseContext');
  });

  it('accepts a rectangular pixelSize and sizes both axes independently', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const canvas = canvasWith(createRecordingGL({ version: 2 }));
    createShaderHost(canvas, {
      ...BASE, version: 2, strategy: 'lunar', pixelSize: { w: 900, h: 220 },
    });
    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(440);
    vi.unstubAllGlobals();
  });

  it('writes a rectangular style size when asked', () => {
    const canvas = canvasWith(createRecordingGL({ version: 2 }));
    createShaderHost(canvas, {
      ...BASE, version: 2, strategy: 'lunar',
      pixelSize: { w: 900, h: 220 }, setStyleSize: true,
    });
    expect(canvas.style.width).toBe('900px');
    expect(canvas.style.height).toBe('220px');
  });
});
