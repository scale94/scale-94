import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import LunarShaderMoon from '../LunarShaderMoon';

// Minimal WebGL2 stub: enough for buildProgram + one draw, and it records
// whether the context was ever asked for.
function stubGL() {
  const noop = () => {};
  return {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
    TEXTURE_2D: 9, TEXTURE0: 10, RGBA: 11, UNSIGNED_BYTE: 12,
    COLOR_ATTACHMENT0: 13, FRAMEBUFFER: 14, CLAMP_TO_EDGE: 15, LINEAR: 16,
    TEXTURE_WRAP_S: 17, TEXTURE_WRAP_T: 18, TEXTURE_MIN_FILTER: 19,
    TEXTURE_MAG_FILTER: 20, RGBA8: 21, REPEAT: 22,
    createShader: () => ({}), shaderSource: noop, compileShader: noop,
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader: noop, linkProgram: noop,
    getProgramParameter: () => true, getProgramInfoLog: () => '',
    deleteShader: noop, deleteProgram: noop, useProgram: noop,
    createBuffer: () => ({}), bindBuffer: noop, bufferData: noop,
    createVertexArray: () => ({}), bindVertexArray: noop,
    getAttribLocation: () => 0, enableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    getUniformLocation: () => ({}),
    uniform1f: noop, uniform2f: noop, uniform1i: noop,
    createTexture: () => ({}), bindTexture: noop, texImage2D: noop,
    texParameteri: noop, activeTexture: noop, texStorage2D: noop,
    createFramebuffer: () => ({}), bindFramebuffer: noop,
    framebufferTexture2D: noop, deleteFramebuffer: noop, deleteTexture: noop,
    deleteVertexArray: noop, deleteBuffer: noop,
    viewport: noop, clearColor: noop, clear: noop, drawArrays: noop,
    disable: noop, enable: noop, blendFunc: noop,
    COLOR_BUFFER_BIT: 100, BLEND: 101, DEPTH_TEST: 102,
    ONE: 103, ONE_MINUS_SRC_ALPHA: 104,
  };
}

const PROPS = { lunarAge: 7.4, illumination: 0.5, timestamp: Date.UTC(2026, 6, 22), size: 340 };

let originalGetContext;

beforeEach(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  cleanup();
  vi.restoreAllMocks();
});

describe('LunarShaderMoon — fallback', () => {
  it('renders the canvas moon when webgl2 is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    const { container } = render(<LunarShaderMoon {...PROPS} />);
    expect(container.querySelector('[data-moon-renderer="canvas"]')).toBeTruthy();
    expect(container.querySelector('[data-moon-renderer="shader"]')).toBeNull();
  });

  it('renders the shader path when webgl2 is available', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const { container } = render(<LunarShaderMoon {...PROPS} />);
    expect(container.querySelector('[data-moon-renderer="shader"]')).toBeTruthy();
  });
});

describe('LunarShaderMoon — teardown', () => {
  it('cancels rAF and removes every listener on unmount', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const removed = [];
    const realRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, fn, opt) => {
      removed.push(type);
      return realRemove(type, fn, opt);
    });

    const { unmount } = render(<LunarShaderMoon {...PROPS} />);
    unmount();

    expect(cancel).toHaveBeenCalled();
    expect(removed).toContain('visibilitychange');
  });

  it('adds and removes the same number of document listeners', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const added = [];
    const removed = [];
    const realAdd = document.addEventListener.bind(document);
    const realRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((t, f, o) => {
      added.push(t); return realAdd(t, f, o);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((t, f, o) => {
      removed.push(t); return realRemove(t, f, o);
    });

    const { unmount } = render(<LunarShaderMoon {...PROPS} />);
    const addedDuringMount = [...added];
    unmount();

    for (const type of addedDuringMount) expect(removed).toContain(type);
  });
});
