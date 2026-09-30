import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// RiverPulse draws on a 2D canvas, which jsdom does not have.
vi.mock('../RiverPulse', () => ({ default: () => null }));

import SubmissionForm from '../SubmissionForm';
import { ALL_AUDIT_PRESETS } from '../../../ledger/auditPresets';

afterEach(cleanup);

describe('SubmissionForm presets', () => {
  it('offers all nine presets, in order', () => {
    render(<SubmissionForm onSubmit={() => {}} loading={false} />);
    const labels = ALL_AUDIT_PRESETS.map((p) => p.label);
    expect(labels).toEqual(['MERCURY', 'GERMANY', 'USA', 'BRAZIL', 'NORTH KOREA', 'YANGTZE', 'GANGES', 'CITARUM', 'DANUBE']);
    const row = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => labels.includes(t));
    expect(row).toEqual(labels);
  });
});

describe('SubmissionForm draft', () => {
  it('reports every valid edit as numeric params and freezes on invalid ones', () => {
    const onDraftChange = vi.fn();
    const { container } = render(<SubmissionForm onSubmit={() => {}} loading={false} onDraftChange={onDraftChange} />);
    expect(onDraftChange).not.toHaveBeenCalled();                    // an empty form is not a draft
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'danube');
    fireEvent.click(screen.getByText('DANUBE'));
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      lat: p.lat, lon: p.lon, temp: p.temp, do: p.do, bod: p.bod, dt: p.dt, epi: p.epi, nitrate: p.nitrate, flow: p.flow,
    }));
    const calls = onDraftChange.mock.calls.length;
    const bod = container.querySelector('[data-field="bod"] input');
    fireEvent.change(bod, { target: { value: '500' } });              // out of range: the ghost freezes
    fireEvent.change(bod, { target: { value: '' } });                 // blank: still frozen
    expect(onDraftChange).toHaveBeenCalledTimes(calls);
    fireEvent.change(bod, { target: { value: '4' } });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ bod: 4 }));
    const n = onDraftChange.mock.calls.length;
    fireEvent.change(container.querySelector('[data-field="lat"] input'), { target: { value: '95' } });
    expect(onDraftChange).toHaveBeenCalledTimes(n);
  });
});
