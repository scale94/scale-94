import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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
