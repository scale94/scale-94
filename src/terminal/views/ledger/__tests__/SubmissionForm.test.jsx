import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// RiverPulse draws on a 2D canvas, which jsdom does not have.
vi.mock('../RiverPulse', () => ({ default: () => null }));
// Leaflet is not needed: the mock reports a click on a wrapped world copy.
vi.mock('../CoordinatePicker', () => ({
  default: ({ onSelect }) => <button type="button" onClick={() => onSelect(52.52, 373.405)}>MOCK PICK</button>,
}));

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

describe('SubmissionForm coordinates at submit', () => {
  // jsdom has no scrollIntoView; the error path scrolls to the first bad field.
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
  afterEach(() => { delete Element.prototype.scrollIntoView; });

  const setup = (props = {}) => {
    const onSubmit = vi.fn();
    const utils = render(<SubmissionForm onSubmit={onSubmit} loading={false} {...props} />);
    fireEvent.click(screen.getByText('GERMANY'));
    const input = (f) => utils.container.querySelector(`[data-field="${f}"] input`);
    const type = (lat, lon) => {
      fireEvent.change(input('lat'), { target: { value: lat } });
      fireEvent.change(input('lon'), { target: { value: lon } });
    };
    const run = () => fireEvent.click(screen.getByText('RUN AUDIT'));
    const errorOf = (f) => utils.container.querySelector(`[data-field="${f}"] .text-red-400`)?.textContent;
    return { onSubmit, input, type, run, errorOf, ...utils };
  };

  it('submits Berlin as exactly 52.52 / 13.405', () => {
    const { onSubmit, type, run } = setup();
    type('52.52', '13.405');
    run();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({ lat: 52.52, lon: 13.405 }));
  });

  it('never submits a latitude past 90', () => {
    const { onSubmit, type, run, errorOf } = setup();
    type('95', '13.4');
    run();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorOf('lat')).toBe('Latitude must be between -90 and 90');
  });

  it('never submits an unwrapped longitude', () => {
    const { onSubmit, type, run, errorOf } = setup();
    type('52.52', '373.4');
    run();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorOf('lon')).toBe('Longitude must be between -180 and 180');
  });

  it('calls a comma decimal required (the number input reads it blank)', () => {
    const { onSubmit, type, run, errorOf } = setup();
    type('52,52', '13,405');
    run();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorOf('lat')).toBe('Latitude is required');
    expect(errorOf('lon')).toBe('Longitude is required');
  });

  it('refuses exactly 0°, 0°', () => {
    const { onSubmit, type, run, errorOf } = setup();
    type('0', '0');
    run();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorOf('lat')).toBe('0°, 0° is open ocean. Enter the river site.');
    type('0.5', '0');
    run();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('merges coordinate errors with the parameter errors', () => {
    const { onSubmit, input, type, run, errorOf } = setup();
    type('95', '13.4');
    fireEvent.change(input('bod'), { target: { value: '500' } });
    run();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(errorOf('lat')).toBe('Latitude must be between -90 and 90');
    expect(errorOf('bod')).toMatch(/must be between/);
  });

  it('wraps a map pick on a wrapped world copy into [-180, 180)', async () => {
    const { input } = setup();
    fireEvent.click(screen.getByText('[ + ] SELECT ON MAP'));
    fireEvent.click(await screen.findByText('MOCK PICK'));
    expect(input('lat').value).toBe('52.520000');
    expect(input('lon').value).toBe('13.405000');
  });

  it('does not pull a 0°, 0° prior entry into the form', () => {
    const legacy = { hash: 'h0', coordinates: { lat: 0, lon: 0 }, input: { siteName: '', bod: 7 }, timestamp: 0, status: 'REJECTED' };
    const { input, container } = setup({ verdicts: [legacy] });
    fireEvent.change(input('lat'), { target: { value: '52.52' } });
    fireEvent.change(input('lon'), { target: { value: '13.405' } });
    fireEvent.change(container.querySelector('select'), { target: { value: 'h0' } });
    expect(input('lat').value).toBe('52.52');
    expect(input('lon').value).toBe('13.405');
    expect(input('bod').value).toBe('7');          // the rest of the entry is still pulled
  });
});
