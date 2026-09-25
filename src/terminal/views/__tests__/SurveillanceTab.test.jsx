import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';
import { setPanopticonCorpus } from '../../lib/panopticon';

vi.mock('../../lib/panopticon', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, setPanopticonCorpus: vi.fn(real.setPanopticonCorpus) };
});

const renderTab = () => render(<SurveillanceTab legislationArticles={laws} onOpenLaw={() => {}} />);
const cards = () => screen.queryAllByTestId('law-card');

describe('SurveillanceTab ledger (spec §2 bug, §8)', () => {
  it('shows all 44 laws and the sealed index of 61', () => {
    renderTab();
    expect(cards()).toHaveLength(44);
    expect(screen.getByTestId('panopticon-score').textContent).toBe('61');
  });

  it.each([
    ['Encryption Backdoor', 8], ['Data Retention', 16], ['Traffic Retention', 9],
    ['Platform Mandated Scanning', 8], ['Digital Id', 18], ['Age Verification', 9],
    ['Biometric Collection', 21], ['Worker Surveillance', 14],
  ])('filters category %s to %i laws', (tag, n) => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: tag } });
    expect(cards()).toHaveLength(n);
  });

  it.each([['UK', 4], ['US', 6], ['AU', 4], ['SE', 9], ['DE', 8], ['NZ', 3], ['EU', 5]])(
    'filters region %s to %i laws (EU laws count for members)',
    (region, n) => {
      renderTab();
      fireEvent.change(screen.getByLabelText(/region/i), { target: { value: region } });
      expect(cards()).toHaveLength(n);
    },
  );

  it('renders the subtitle and the surveillance tags on a card', () => {
    renderTab();
    expect(screen.getByText('Telecommunications and Other Legislation Amendment (Assistance and Access) Act 2018')).toBeTruthy();
    const tola = cards().find((c) => c.textContent.includes('ASSISTANCE AND ACCESS ACT (TOLA)'));
    expect(tola.textContent).toContain('Encryption Backdoor');
  });

  it('says the corpus is sealed, not live', () => {
    renderTab();
    expect(screen.getByText(/sealed 2026-03-09/i)).toBeTruthy();
    expect(screen.queryByText('INDEXING ACTIVE')).toBeNull();
  });
});

describe('SurveillanceTab lattice + linked ledger (spec §1, §8)', () => {
  it('puts the lattice above the ledger and drops the old stats row', () => {
    renderTab();
    expect(screen.getByRole('region', { name: 'intercept lattice' })).toBeTruthy();
    expect(screen.queryByText('Critical 5/5')).toBeNull();
  });

  it('lights a hovered card’s nodes on the lattice', () => {
    const { container } = renderTab();
    const dsa = cards().find((c) => c.textContent.includes('DIGITAL SERVICES ACT'));
    fireEvent.mouseEnter(dsa);
    const lit = [...container.querySelectorAll('[data-node][data-highlight="true"]')].map((n) => n.getAttribute('data-node'));
    expect(lit.sort()).toEqual(['BE', 'DE', 'FR', 'IE', 'NL', 'SE']);
    fireEvent.mouseLeave(dsa);
    expect(container.querySelectorAll('[data-node][data-highlight="true"]')).toHaveLength(0);
  });

  it('filters the ledger to the node last touched, and back to all on reset', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /^united kingdom/ }));
    expect(screen.getByLabelText(/region/i).value).toBe('UK');
    expect(cards()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /^united kingdom/ }));
    expect(screen.getByLabelText(/region/i).value).toBe('ALL');
    expect(cards()).toHaveLength(44);
  });

  it('never registers a corpus or writes storage, and keeps the sealed index', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderTab();
    fireEvent.change(screen.getByLabelText('legislative time'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /^canada/ }));
    fireEvent.click(screen.getByRole('button', { name: /^new zealand/ }));
    expect(setPanopticonCorpus).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('panopticon-score').textContent).toBe('61');
    setItem.mockRestore();
  });
});
