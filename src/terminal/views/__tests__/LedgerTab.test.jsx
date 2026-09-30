import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  oceanProps: [],
  INPUT: { lat: 31.3, lon: 120.6, siteName: 'Test site', temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42 },
}));

vi.mock('../ledger/ocean/LedgerOcean', async () => {
  const { createElement } = await import('react');
  return { default: (props) => { h.oceanProps.push(props); return createElement('div', { 'data-testid': 'ocean-stub' }); } };
});
vi.mock('../ledger/SubmissionForm', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    default: ({ onSubmit, onDraftChange }) => createElement(Fragment, null,
      createElement('button', { type: 'button', onClick: () => onSubmit(h.INPUT) }, 'stub-submit'),
      createElement('button', {
        type: 'button',
        onClick: () => { onDraftChange?.({ ...h.INPUT, bod: 1 }); onDraftChange?.(h.INPUT); },
      }, 'stub-draft'),
    ),
  };
});
vi.mock('../ledger/AuditCascade', async () => {
  const { createElement } = await import('react');
  return { default: ({ onComplete }) => createElement('button', { type: 'button', onClick: () => onComplete() }, 'stub-complete') };
});
vi.mock('../../ledger/verdictStore', () => ({
  getAllVerdicts: vi.fn(async () => []),
  getVerdictCount: vi.fn(async () => 0),
  storeVerdict: vi.fn(async (v) => ({ ...v, hash: 'h-new' })),
}));
vi.mock('../../../wasm/wasmSingleton', () => ({
  loadWasm: async () => ({ run_chrono_actuary: () => 'RULING' }),
}));
vi.mock('../../../observatory/observatoryBus', () => ({ emit: vi.fn() }));

import LedgerTab from '../LedgerTab';
import { ledgerBus } from '../../ledger/ledgerBus';
import { getAllVerdicts } from '../../ledger/verdictStore';
import { emit as emitObs } from '../../../observatory/observatoryBus';

describe('LedgerTab — ocean hero (phase 3a)', () => {
  beforeEach(() => { h.oceanProps.length = 0; });

  it('renders the ocean in the hero slot at 2:1 with the v2.0 header, and no eclipse', async () => {
    render(<LedgerTab />);
    expect(screen.getByTestId('ocean-stub')).toBeTruthy();
    const last = h.oceanProps.at(-1);
    expect(last.width).toBeGreaterThan(0);
    expect(last.height).toBe(Math.round(last.width / 2));
    expect(screen.getByText('The Open Ledger')).toBeTruthy();
    expect(screen.getByText('v2.0')).toBeTruthy();
    expect(screen.getByText('HYDROLOGICAL AUDIT & OUTFALL DISPERSION')).toBeTruthy();
    expect(screen.getByText(/The equations are the authority\./)).toBeTruthy();
    expect(screen.getByText('Every verdict drains somewhere. The ocean keeps the account.')).toBeTruthy();
    expect(document.head.innerHTML).not.toMatch(/lt-eclipse/);
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts).toEqual([]));
  });

  it('hands the sealed verdict to the ocean on cascade completion and keeps both emits', async () => {
    const busSpy = vi.spyOn(ledgerBus, 'emit');
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-submit'));
    const complete = await screen.findByText('stub-complete');
    act(() => { fireEvent.click(complete); });
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts.map((v) => v.hash)).toEqual(['h-new']));
    expect(h.oceanProps.at(-1).latestHash).toBe('h-new');
    expect(busSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'VERDICT_ISSUED', verdict: expect.objectContaining({ hash: 'h-new' }),
    }));
    expect(emitObs).toHaveBeenCalledWith('transmissions', 'verdict_issued', expect.objectContaining({ verdict: expect.any(String) }));
    busSpy.mockRestore();
  });

  it('passes the SAME verdicts reference to the ocean across unrelated re-renders', async () => {
    render(<LedgerTab />);
    await waitFor(() => expect(h.oceanProps.length).toBeGreaterThan(0));
    // let the initial load (setVerdicts) settle
    await act(async () => { await Promise.resolve(); });
    const settled = h.oceanProps.at(-1).verdicts;
    const rendersBefore = h.oceanProps.length;
    // unrelated state changes: loading, cascadeVerdict, cascadeVisible
    fireEvent.click(screen.getByText('stub-submit'));
    await screen.findByText('stub-complete');
    expect(h.oceanProps.length).toBeGreaterThan(rendersBefore);
    for (const p of h.oceanProps.slice(rendersBefore)) expect(p.verdicts).toBe(settled);
    expect(h.oceanProps.at(-1).verdicts).toBe(settled);
  });

  it('marks the ocean sources ready only together with the loaded archive', async () => {
    const V0 = { hash: 'h-old', status: 'APPROVED', coordinates: { lat: 31.3, lon: 120.6 }, input: h.INPUT };
    getAllVerdicts.mockResolvedValueOnce([V0]);
    render(<LedgerTab />);
    await waitFor(() => expect(h.oceanProps.at(-1).sourcesReady).toBe(true));
    for (const p of h.oceanProps) if (p.sourcesReady) expect(p.verdicts).toEqual([V0]);
    expect(h.oceanProps.some((p) => p.sourcesReady === false)).toBe(true);
  });

  it('hands the latest valid draft to the ocean as the ghost, and clears it for the archive view', async () => {
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-draft'));
    await waitFor(() => expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT));
    fireEvent.click(screen.getByText(/Verdict Archive/));
    expect(h.oceanProps.at(-1).ghost).toBeNull();
    fireEvent.click(screen.getByText('Submit Audit'));
    expect(h.oceanProps.at(-1).ghost).toBeNull();                    // the remounted form is not a draft
  });

  it('keeps the ghost while the kernel rules, and drops it when the verdict seals', async () => {
    render(<LedgerTab />);
    fireEvent.click(screen.getByText('stub-draft'));
    await waitFor(() => expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT));
    fireEvent.click(screen.getByText('stub-submit'));
    const complete = await screen.findByText('stub-complete');
    expect(h.oceanProps.at(-1).ghost).toEqual(h.INPUT);
    act(() => { fireEvent.click(complete); });
    await waitFor(() => expect(h.oceanProps.at(-1).verdicts.map((v) => v.hash)).toEqual(['h-new']));
    expect(h.oceanProps.at(-1).ghost).toBeNull();
    fireEvent.click(await screen.findByText('Submit Audit'));
    expect(h.oceanProps.at(-1).ghost).toBeNull();                    // the draft state itself was cleared, not just hidden
  });
});
