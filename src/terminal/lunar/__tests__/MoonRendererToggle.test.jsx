import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import MoonRendererToggle, {
  MOON_RENDERER_KEY, readRenderer, writeRenderer, ScotopicMeter,
} from '../MoonRendererToggle';

afterEach(() => { localStorage.clear(); cleanup(); });

describe('MoonRendererToggle', () => {
  it('defaults to shader when nothing is stored', () => {
    expect(readRenderer()).toBe('shader');
  });

  it('round-trips through localStorage', () => {
    writeRenderer('canvas');
    expect(localStorage.getItem(MOON_RENDERER_KEY)).toBe('canvas');
    expect(readRenderer()).toBe('canvas');
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(MOON_RENDERER_KEY, 'banana');
    expect(readRenderer()).toBe('shader');
  });

  it('survives localStorage throwing', () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    expect(() => writeRenderer('canvas')).not.toThrow();
    Storage.prototype.setItem = real;
  });

  it('calls onChange with the other renderer when clicked', () => {
    let got = null;
    const { getByRole } = render(
      <MoonRendererToggle value="shader" onChange={(v) => { got = v; }} />
    );
    fireEvent.click(getByRole('button'));
    expect(got).toBe('canvas');
  });
});

describe('ScotopicMeter', () => {
  it('renders the SCOTOPIC label', () => {
    const { getByText } = render(<ScotopicMeter adapt={0.4} />);
    expect(getByText(/SCOTOPIC/i)).toBeTruthy();
  });

  it('shows the adapt value to three places', () => {
    const { getByText } = render(<ScotopicMeter adapt={0.4} />);
    expect(getByText('0.400')).toBeTruthy();
  });

  it('clamps a value above one', () => {
    const { container } = render(<ScotopicMeter adapt={3} />);
    const fill = container.querySelector('[style*="width"]');
    expect(fill.style.width).toBe('100%');
  });
});
