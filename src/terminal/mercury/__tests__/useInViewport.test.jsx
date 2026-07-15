// src/terminal/mercury/__tests__/useInViewport.test.jsx — viewport gating (spec §7).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useInViewport } from '../useInViewport';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class MockIO {
  constructor(cb) {
    MockIO.instances.push(this);
    this.cb = cb;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
  }
  fire(entry) {
    this.cb([entry]);
  }
}
MockIO.instances = [];

let container, root, api;

function Probe({ attach = true }) {
  const [ref, inView] = useInViewport();
  api = { ref, inView };
  return attach ? <div ref={ref} data-testid="probe" /> : null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  delete globalThis.IntersectionObserver;
  MockIO.instances = [];
});

describe('useInViewport', () => {
  it('no IntersectionObserver (jsdom default): inView stays true', () => {
    act(() => { root.render(<Probe />); });
    expect(api.inView).toBe(true);
  });

  it('node appears after mount: observer picks up the node once the ref attaches', () => {
    globalThis.IntersectionObserver = MockIO;
    act(() => { root.render(<Probe attach={false} />); });
    expect(api.inView).toBe(true);
    act(() => { root.render(<Probe attach={true} />); });
    const node = container.querySelector('[data-testid="probe"]');
    expect(node).not.toBeNull();
    expect(MockIO.instances.length).toBe(1);
    expect(MockIO.instances[0].observe).toHaveBeenCalledWith(node);
  });

  it('visibility flips: fires false then true', () => {
    globalThis.IntersectionObserver = MockIO;
    act(() => { root.render(<Probe />); });
    const io = MockIO.instances[0];
    act(() => { io.fire({ isIntersecting: false }); });
    expect(api.inView).toBe(false);
    act(() => { io.fire({ isIntersecting: true }); });
    expect(api.inView).toBe(true);
  });

  it('unmount disconnects the observer', () => {
    globalThis.IntersectionObserver = MockIO;
    act(() => { root.render(<Probe />); });
    const io = MockIO.instances[0];
    act(() => { root.unmount(); });
    expect(io.disconnect).toHaveBeenCalled();
  });
});
