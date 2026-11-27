// A failed WASM init must not poison the page: the next loadWasm() retries
// (P3 fix pass — a cached rejection broke every WASM-path collision for good).
import { it, expect, vi } from 'vitest';

let fail = true;
vi.mock('../src/wasm/scale94_kernels.js', () => ({
  default: vi.fn(async () => { if (fail) throw new Error('transient fetch failure'); }),
  marker: 'kernels',
}));
vi.mock('../src/wasm/wasm.generated', () => ({ default: {} }));

it('a failed init is retried on the next call', async () => {
  const { loadWasm } = await import('../src/wasm/wasmSingleton');
  await expect(loadWasm()).rejects.toThrow('transient fetch failure');
  fail = false;
  const mod = await loadWasm();
  expect(mod.marker).toBe('kernels');
  expect(await loadWasm()).toBe(mod);
});
