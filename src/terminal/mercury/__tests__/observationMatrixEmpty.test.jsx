import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import ObservationMatrix from '../ObservationMatrix';
import { CATEGORY_TABS } from '../../tabLabels';

const mercury = {
  heliocentricDistanceAU: 0.387, subsolarTempK: 700, daysToNextPerihelion: 40, earthMercuryDistanceAU: 0.9,
};
const instruments = ['PROMISE HALF-LIFE', 'WORSHIP TEMPERATURE', 'GRIEF INDEX', 'ATTENTION VISCOSITY', 'FORGETTING FLUX']
  .map(label => ({ label, value: 1, unit: '' }));

function setup() {
  const onNavigate = vi.fn();
  const utils = render(
    <ObservationMatrix mercury={mercury} instruments={instruments} activePhase="fluid" onNavigate={onNavigate} />,
  );
  const chip = (name) => [...utils.container.querySelectorAll('button')].find(b => b.textContent === name);
  const emptyLink = () => utils.container.querySelector('button[aria-label*="open /"]');
  return { ...utils, onNavigate, chip, emptyLink };
}

describe('ObservationMatrix empty state', () => {
  afterEach(cleanup);

  it('ALL and MERCURY never render a navigating empty state', () => {
    // The mount tick logs one MERCURY entry, so those two views are populated;
    // the empty state with a link must exist only under the category chips.
    const { chip, emptyLink, onNavigate } = setup();
    expect(emptyLink()).toBeNull();
    fireEvent.click(chip('MERCURY'));
    expect(emptyLink()).toBeNull();
    fireEvent.click(chip('ALL'));
    expect(emptyLink()).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
    // and the mapping itself has no entry for them, so an empty ALL can't link either
    expect(CATEGORY_TABS.ALL).toBeUndefined();
    expect(CATEGORY_TABS.MERCURY).toBeUndefined();
  });

  it('EDGE shows → open /ACCRETION and clicking opens the internal manifesto tab', () => {
    const { chip, emptyLink, onNavigate } = setup();
    fireEvent.click(chip('EDGE'));
    const link = emptyLink();
    expect(link.textContent).toContain('open /ACCRETION');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('manifesto');
  });

  it('every other category opens its own tab, labelled with the current name', () => {
    const labels = { TRANSMISSIONS: '/TRANSMISSION', ESSENCES: '/SCENT', CIPHERS: '/CRYPTOGRAPHY', GAZE: '/LUNAR' };
    for (const [cat, label] of Object.entries(labels)) {
      const { chip, emptyLink, onNavigate, unmount } = setup();
      fireEvent.click(chip(cat));
      expect(emptyLink().textContent).toContain(`open ${label}`);
      fireEvent.click(emptyLink());
      expect(onNavigate).toHaveBeenCalledWith(CATEGORY_TABS[cat]);
      unmount();
    }
  });
});
