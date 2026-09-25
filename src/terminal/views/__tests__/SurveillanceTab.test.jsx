import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';

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
