import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';
import { setPanopticonCorpus } from '../../lib/panopticon';

vi.mock('../../lib/panopticon', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, setPanopticonCorpus: vi.fn(real.setPanopticonCorpus) };
});

const renderTab = (props = {}) => render(<SurveillanceTab legislationArticles={laws} onOpenLaw={() => {}} {...props} />);
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

  it('drops the highlight when the hovered card is filtered out from under it', () => {
    const { container } = renderTab();
    const dsa = cards().find((c) => c.textContent.includes('DIGITAL SERVICES ACT'));
    fireEvent.mouseEnter(dsa);
    expect(container.querySelectorAll('[data-node][data-highlight="true"]').length).toBeGreaterThan(0);
    // Region select changes (e.g. via keyboard) while the mouse never leaves the card —
    // the card unmounts without a mouseleave, so the highlight must be derived, not sticky.
    fireEvent.change(screen.getByLabelText(/region/i), { target: { value: 'UK' } });
    expect(cards().some((c) => c.textContent.includes('DIGITAL SERVICES ACT'))).toBe(false);
    expect(container.querySelectorAll('[data-node][data-highlight="true"]')).toHaveLength(0);
  });
});

describe('SurveillanceTab law cards keyboard activation', () => {
  it('opens the card on Enter and Space, and ignores key repeat', () => {
    const onOpenLaw = vi.fn();
    render(<SurveillanceTab legislationArticles={laws} onOpenLaw={onOpenLaw} />);
    const card = cards()[0];

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpenLaw).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpenLaw).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(card, { key: 'Enter', repeat: true });
    expect(onOpenLaw).toHaveBeenCalledTimes(2);
  });
});

describe('SurveillanceTab privacy drawer', () => {
  it('shows a privacy button and no drawer by default', () => {
    renderTab({ privacyOpen: false });
    expect(screen.getByRole('button', { name: /privacy protocol/i })).toBeTruthy();
    expect(screen.queryByTestId('privacy-drawer')).toBeNull();
  });
  it('asks to open when the button is pressed', () => {
    const onChange = vi.fn();
    renderTab({ privacyOpen: false, onPrivacyOpenChange: onChange });
    fireEvent.click(screen.getByRole('button', { name: /privacy protocol/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('renders the privacy panel inside the drawer when open', async () => {
    renderTab({ privacyOpen: true, systemArticles: { 'PRIVACY-PROTOCOL': { content: 'x' } } });
    const drawer = await screen.findByTestId('privacy-drawer');
    // the lazy panel itself, not only the wrapper
    await waitFor(() => expect(drawer.textContent).toContain('LOG: PRIVACY-PROTOCOL'));
  });
});

describe('SurveillanceTab privacy focus token', () => {
  const btn = () => screen.getByRole('button', { name: /privacy protocol/i });
  it('scrolls the button into view when the token changes, once, and not on click or initial render', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    const onHandled = vi.fn();
    const onChange = vi.fn();
    const { rerender } = renderTab({ onPrivacyOpenChange: onChange, onPrivacyFocusHandled: onHandled });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(btn());
    expect(spy).not.toHaveBeenCalled();
    rerender(<SurveillanceTab legislationArticles={laws} onOpenLaw={() => {}} privacyFocusToken={1} onPrivacyFocusHandled={onHandled} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.instances[0]).toBe(btn());
    expect(spy.mock.calls[0][0]).toMatchObject({ block: 'start' });
    expect(onHandled).toHaveBeenCalledTimes(1);
  });
  it('scrolls smoothly, or instantly under reduced motion', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    const original = window.matchMedia;
    try {
      window.matchMedia = (q) => ({ matches: q.includes('reduce'), media: q });
      renderTab({ privacyFocusToken: 1 });
      expect(spy.mock.calls[0][0]).toMatchObject({ behavior: 'auto' });
      cleanup();
      window.matchMedia = (q) => ({ matches: false, media: q });
      renderTab({ privacyFocusToken: 2 });
      expect(spy.mock.calls[1][0]).toMatchObject({ behavior: 'smooth' });
    } finally {
      window.matchMedia = original;
    }
  });
  it('scrolls on mount when the token is already set (tab mounted by the nav change)', () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    renderTab({ privacyFocusToken: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
