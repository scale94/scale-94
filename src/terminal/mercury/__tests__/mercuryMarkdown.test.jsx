import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderMercuryMarkdown } from '../mercuryMarkdown';

afterEach(() => cleanup());
const draw = (md) => render(<div>{renderMercuryMarkdown(md)}</div>).container;

describe('renderMercuryMarkdown', () => {
  it('renders ## as a heading with the text', () => {
    const c = draw('## The one law');
    const h = c.querySelector('h3');
    expect(h).not.toBeNull();
    expect(h.textContent).toContain('The one law');
  });

  it('renders bullets as list items with inline bold', () => {
    const c = draw('- **Have taste.** Prefer things.');
    expect(c.querySelector('li').textContent).toContain('Have taste.');
    expect(c.querySelector('strong').textContent).toBe('Have taste.');
  });

  it('renders an example block and tints Corpse/Wet lines', () => {
    const c = draw('<example>\nCorpse: dry line\nWet: wet line\n</example>');
    expect(c.textContent).toContain('Corpse: dry line');
    expect(c.textContent).toContain('Wet: wet line');
  });

  it('renders // lines as captions, not prose paragraphs', () => {
    const c = draw('// compiled off-altar');
    expect(c.textContent).toContain('// compiled off-altar');
    expect(c.querySelector('p')).toBeNull();
  });
});
