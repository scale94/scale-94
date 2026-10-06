import { describe, it, expect } from 'vitest';
import { precompileHidden } from '../precompileHidden';

const mk = (visible) => ({ visible });

describe('precompileHidden', () => {
  it('shows hidden objects during the call, leaves visible ones, restores afterwards', () => {
    const a = mk(false), b = mk(true), c = mk(false);
    const seen = [];
    const gl = { compileAsync: () => { seen.push([a.visible, b.visible, c.visible]); return Promise.resolve('ok'); } };
    precompileHidden(gl, {}, {}, [a, b, c]);
    expect(seen).toEqual([[true, true, true]]);
    expect([a.visible, b.visible, c.visible]).toEqual([false, true, false]);
  });
  it('restores even when compileAsync throws', () => {
    const a = mk(false);
    const gl = { compileAsync: () => { throw new Error('boom'); } };
    expect(() => precompileHidden(gl, {}, {}, [a])).toThrow('boom');
    expect(a.visible).toBe(false);
  });
  it('falls back to gl.compile when there is no compileAsync', async () => {
    const a = mk(false);
    let during = null;
    const gl = { compile: () => { during = a.visible; } };
    await expect(precompileHidden(gl, {}, {}, [a])).resolves.toBeUndefined();
    expect(during).toBe(true);
    expect(a.visible).toBe(false);
  });
  it('returns the compileAsync promise and tolerates null entries', async () => {
    const p = Promise.resolve('scene');
    const gl = { compileAsync: () => p };
    expect(precompileHidden(gl, {}, {}, [null, mk(false)])).toBe(p);
  });
});
