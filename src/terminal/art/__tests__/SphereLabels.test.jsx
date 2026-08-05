import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import SphereLabels from '../SphereLabels';

const label = (over = {}) => ({
  key: 'node:n1', text: 'KERNEL', x: 100, y: 200,
  alpha: 0.5, fontSize: 9, color: 'rgb(255,0,0)', ...over,
});

function mount() {
  const ref = createRef();
  const { container } = render(<SphereLabels ref={ref} />);
  return { ref, host: container.firstChild };
}

describe('SphereLabels', () => {
  it('never intercepts pointer events', () => {
    const { host } = mount();
    expect(host.style.pointerEvents).toBe('none');
  });

  it('creates one span per label with position, font, color and opacity applied', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    const spans = host.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('KERNEL');
    expect(spans[0].style.left).toBe('100px');
    expect(spans[0].style.top).toBe('200px');
    expect(spans[0].style.opacity).toBe('0.5');
    expect(spans[0].style.color).toBe('rgb(255, 0, 0)');
    expect(spans[0].style.font).toContain('9px');
    expect(spans[0].style.font).toContain('monospace');
  });

  it('positions the baseline to match canvas fillText, not the box bottom', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    const span = host.querySelector('span');
    expect(span.style.lineHeight).toBe('1');
    expect(span.style.transform).toBe('translate(-50%, calc(-100% + 0.21em))');
  });

  it('reuses the same element across updates for a stable key', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    const first = host.querySelector('span');
    ref.current.update([label({ x: 300, alpha: 0.9 })]);
    const second = host.querySelector('span');
    expect(second).toBe(first);              // reused, not recreated
    expect(second.style.left).toBe('300px');
    expect(second.style.opacity).toBe('0.9');
  });

  it('removes elements whose labels disappear', () => {
    const { ref, host } = mount();
    ref.current.update([label(), label({ key: 'node:n2', text: 'OTHER' })]);
    expect(host.querySelectorAll('span')).toHaveLength(2);
    ref.current.update([label()]);
    const spans = host.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('KERNEL');
  });

  it('clears everything when handed an empty set', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    ref.current.update([]);
    expect(host.querySelectorAll('span')).toHaveLength(0);
  });

  it('survives being called before paint with no labels', () => {
    const { ref, host } = mount();
    expect(() => ref.current.update([])).not.toThrow();
    expect(host.querySelectorAll('span')).toHaveLength(0);
  });

  it('empties the pool and removes spans from the document on unmount', () => {
    const ref = createRef();
    const { container, unmount } = render(<SphereLabels ref={ref} />);
    const host = container.firstChild;
    ref.current.update([label(), label({ key: 'node:n2', text: 'OTHER' })]);
    expect(host.querySelectorAll('span')).toHaveLength(2);
    const spans = Array.from(host.querySelectorAll('span'));
    unmount();
    expect(document.body.contains(host)).toBe(false);
    spans.forEach(span => expect(document.body.contains(span)).toBe(false));
  });
});
