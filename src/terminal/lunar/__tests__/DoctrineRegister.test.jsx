import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DoctrineRegister from '../DoctrineRegister';
import { compileLunarDoctrine } from '../compileLunarDoctrine';

const PLANET_DATA = {
  Sun:     { glyph: '☉', color: '#f59e0b' },
  Moon:    { glyph: '☽', color: '#e8e8f0' },
  Mercury: { glyph: '☿', color: '#c0c0c0' },
  Saturn:  { glyph: '♄', color: '#a8a29e' },
};
const ASPECT_GLYPH = { Conjunct: '⊕', Sextile: '⚹', Square: '□', Trine: '△', Opposite: '☍' };

function readingAt(over = {}) {
  return compileLunarDoctrine({
    age: 0.4, illumination: 0.01, phaseId: 'new', currentAccord: 'DARK INCUBATION',
    transits: [], planets: {}, spine: null, ...over,
  });
}

function renderAt(over) {
  return render(
    <DoctrineRegister reading={readingAt(over)} planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
  );
}

describe('DoctrineRegister', () => {
  it('renders the triad, the directive and the kernel name', () => {
    const r = readingAt();
    renderAt();
    expect(screen.getByText(/DOCTRINE REGISTER/i)).toBeTruthy();
    expect(screen.getByText(r.kernel)).toBeTruthy();
    expect(screen.getByText(r.plato)).toBeTruthy();
    expect(screen.getByText(r.promo)).toBeTruthy();
    expect(screen.getByText(r.paradox)).toBeTruthy();
    expect(screen.getByText(r.directive)).toBeTruthy();
    expect(screen.getByText(r.axis)).toBeTruthy();
  });

  it('shows provenance: illumination, day, dryness', () => {
    const r = readingAt({ currentAccord: 'MINERAL STILLNESS' });
    renderAt({ currentAccord: 'MINERAL STILLNESS' });
    expect(screen.getByText(new RegExp(`moon ${(r.provenance.illumination * 100).toFixed(1)}%`))).toBeTruthy();
    expect(screen.getByText(/dryness 96/)).toBeTruthy();
    expect(screen.getByText(/day 0\.4/)).toBeTruthy();
  });

  it('renders the spine coda', () => {
    const r = readingAt();
    renderAt();
    expect(screen.getByText(r.coda)).toBeTruthy();
  });

  it('names the aspect that selected the lens, with glyphs', () => {
    renderAt({ transits: [{ p1: 'Mercury', p2: 'Saturn', aspect: 'Square', orb: 1.2 }] });
    expect(screen.getByText(/☿/)).toBeTruthy();
    expect(screen.getByText(/♄/)).toBeTruthy();
    expect(screen.getByText(/orb 1\.2°/)).toBeTruthy();
  });

  it('marks a synthesised aspect so the reading never looks like it invented a transit', () => {
    renderAt();
    expect(screen.getByText(/elongation/i)).toBeTruthy();
  });

  it('shows the chaos cross-link only under the hudelschublade lens', () => {
    renderAt();                                                  // new moon → hudelschublade
    expect(screen.getByText(/house: chaos/i)).toBeTruthy();
    cleanup();                                                   // RTL queries hit document.body by default;
                                                                   // without this the first render leaks into the next assertion.

    const { queryByText } = render(
      <DoctrineRegister
        reading={readingAt({ age: 22.0, phaseId: 'last-quarter', currentAccord: 'MINERAL STILLNESS' })}
        planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
    );
    expect(queryByText(/house: chaos/i)).toBeNull();
  });

  it('renders nothing rather than crashing when the reading is absent', () => {
    const { container } = render(
      <DoctrineRegister reading={null} planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
    );
    expect(container.firstChild).toBeNull();
  });
});
