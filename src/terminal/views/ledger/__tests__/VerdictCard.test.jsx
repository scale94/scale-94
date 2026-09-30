import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import VerdictCard from '../VerdictCard';

afterEach(cleanup);

const verdict = (coordinates) => ({
  hash: 'a'.repeat(64), status: 'REJECTED', dependency: 'sovereign', timestamp: '2026-04-02T21:00:00Z', coordinates,
  input: { temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42, siteName: 'Test site' },
});

describe('VerdictCard coordinates', () => {
  it('marks a 0°, 0° legacy verdict UNLOCATED and keeps it in the archive', () => {
    const { container } = render(<VerdictCard verdict={verdict({ lat: 0, lon: 0 })} onExport={() => {}} />);
    const mark = container.querySelector('[data-coords="unlocated"]');
    expect(mark).toBeTruthy();
    expect(mark.textContent).toBe('UNLOCATED');
    expect(container.textContent).not.toContain('0.0000, 0.0000');
    expect(container.textContent).toContain('REJECTED');                 // the record is still listed
    expect(container.textContent).toContain('Test site');
  });

  it('shows normal coordinates otherwise, including a true 0.5°, 0°', () => {
    const berlin = render(<VerdictCard verdict={verdict({ lat: 52.52, lon: 13.405 })} onExport={() => {}} />);
    expect(berlin.container.textContent).toContain('52.5200, 13.4050');
    expect(berlin.container.querySelector('[data-coords="unlocated"]')).toBeNull();
    berlin.unmount();
    const near = render(<VerdictCard verdict={verdict({ lat: 0.5, lon: 0 })} onExport={() => {}} />);
    expect(near.container.textContent).toContain('0.5000, 0.0000');
    expect(near.container.textContent).not.toContain('UNLOCATED');
  });
});
