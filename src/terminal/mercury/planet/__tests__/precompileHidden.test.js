import { describe, it, expect, vi } from 'vitest';
import { precompileHidden, waitProgramsReady } from '../precompileHidden';

const mk = (visible) => ({ visible });
// a renderer stub: compile() returns the material set (three r15x+), properties.get() the per-material record
const mkGl = (records, onCompile) => ({
  compile: () => { onCompile?.(); return new Set(records.keys()); },
  properties: { get: (m) => records.get(m) },
});

describe('precompileHidden', () => {
  it('shows hidden objects during the compile, leaves visible ones, restores afterwards', () => {
    const a = mk(false), b = mk(true), c = mk(false);
    const seen = [];
    precompileHidden(mkGl(new Map(), () => seen.push([a.visible, b.visible, c.visible])), {}, {}, [a, b, c]);
    expect(seen).toEqual([[true, true, true]]);
    expect([a.visible, b.visible, c.visible]).toEqual([false, true, false]);
  });
  it('restores even when compile throws', () => {
    const a = mk(false);
    const gl = { compile: () => { throw new Error('boom'); } };
    expect(() => precompileHidden(gl, {}, {}, [a])).toThrow('boom');
    expect(a.visible).toBe(false);
  });
  it('tolerates null entries and a compile() that returns nothing (older three)', async () => {
    const gl = { compile: () => undefined };
    await expect(precompileHidden(gl, {}, {}, [null, mk(false)])).resolves.toBeUndefined();
  });
  it('never calls three compileAsync (its poller dereferences a missing program on HMR: isReady of undefined)', () => {
    const compileAsync = vi.fn();
    precompileHidden({ ...mkGl(new Map()), compileAsync }, {}, {}, []);
    expect(compileAsync).not.toHaveBeenCalled();
  });
});

describe('waitProgramsReady', () => {
  it('resolves once every program reports ready', async () => {
    vi.useFakeTimers();
    let ready = false;
    const m = {};
    const gl = mkGl(new Map([[m, { currentProgram: { isReady: () => ready } }]]));
    let done = false;
    waitProgramsReady(gl, gl.compile()).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(50);
    expect(done).toBe(false);
    ready = true;
    await vi.advanceTimersByTimeAsync(20);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
  it('a material torn down mid-poll (no record / no program, e.g. a hot swap) is dropped, never thrown on', async () => {
    vi.useFakeTimers();
    const gone = {}, noProg = {}, throws = {};
    const records = new Map([[gone, undefined], [noProg, { currentProgram: undefined }], [throws, { currentProgram: { isReady: () => { throw new Error('lost context'); } } }]]);
    const gl = mkGl(records);
    const p = waitProgramsReady(gl, gl.compile());
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
