// A collision that throws must say so — never fall back to IDLE with both
// domains still lit (author's live test, OSTROM × Cu, P3 fix pass).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

const wasmMock = vi.fn();
vi.mock('../../../wasm/wasmSingleton', () => ({ loadWasm: (...a) => wasmMock(...a) }));

import LatentCollider, { colliderBus } from '../../views/LatentCollider';
import { loadWasmNode } from '../../../../tests/helpers/loadWasmNode.js';

const tile = (root, short) => [...root.querySelectorAll('button, [role="button"], div')]
  .filter((e) => (e.textContent || '').trim().toUpperCase().startsWith(short) && e.querySelectorAll('*').length < 12)
  .sort((x, y) => x.querySelectorAll('*').length - y.querySelectorAll('*').length)[0];

beforeEach(() => { vi.useFakeTimers(); wasmMock.mockReset(); Element.prototype.scrollIntoView = () => {}; }); // jsdom has no scrollIntoView
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function collide(root, a, b) {
  act(() => { tile(root, a).click(); });
  act(() => { tile(root, b).click(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
}

describe('LatentCollider — a collision that fails is named', () => {
  it('smoke: mounts and shows the idle prompt', () => {
    const { container } = render(<LatentCollider />);
    expect(container.textContent.toUpperCase()).toContain('SELECT TWO DOMAINS TO COLLIDE');
    expect(tile(container, 'OSTROM')).toBeTruthy();
    expect(tile(container, 'CU')).toBeTruthy();
  });

  // the domain grid button whose label is exactly `short`
  const gridButton = (root, short) => [...root.querySelectorAll('button[title]')]
    .find((b) => (b.querySelector('.font-bold')?.textContent ?? '').toUpperCase() === short);
  const lit = (root, short) => gridButton(root, short).className.includes('border-fuchsia-500/60');

  it('the kernel fails to load: the chamber names it, and both domains go dark', async () => {
    wasmMock.mockRejectedValue(new Error('LinkError: import object field mismatch'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<LatentCollider />);
    await collide(container, 'OSTROM', 'CU');
    const failed = container.querySelector('[data-testid="collision-failed"]');
    expect(failed?.textContent).toBe('COLLISION DID NOT RUN — the kernel did not load');
    expect(lit(container, 'OSTROM')).toBe(false);
    expect(lit(container, 'CU')).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('a fresh pick clears the failure line', async () => {
    wasmMock.mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<LatentCollider />);
    await collide(container, 'OSTROM', 'CU');
    act(() => { tile(container, 'ATTN').click(); });
    expect(container.querySelector('[data-testid="collision-failed"]')).toBeNull();
    expect(lit(container, 'ATTN')).toBe(true);
    err.mockRestore();
  });

  it('a throwing collider-bus listener never aborts the collision', async () => {
    const real = loadWasmNode();
    wasmMock.mockResolvedValue(real);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = colliderBus.on((d) => { if (d.type === 'CHIMERA_SYNTHESIS') throw new Error('a decorative listener broke'); });
    const { container } = render(<LatentCollider />);
    await collide(container, 'OSTROM', 'CU');
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(container.querySelector('[data-testid="collision-failed"]')).toBeNull();
    expect(container.textContent.toUpperCase()).not.toContain('SELECT TWO DOMAINS TO COLLIDE');
    expect(lit(container, 'OSTROM')).toBe(true);
    expect(err.mock.calls.some((c) => String(c[0]).includes('[COLLIDER BUS]'))).toBe(true);
    off();
    err.mockRestore();
  });
});
