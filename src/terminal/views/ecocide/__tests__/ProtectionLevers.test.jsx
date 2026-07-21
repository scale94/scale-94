import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectionLevers } from '../ProtectionLevers';

const LEVERS = { toxicityCap: 0.6, sanctuary: 0.45, restoration: 0.7, nativeBio: 0.35 };

describe('ProtectionLevers', () => {
  it('renders all four identity levers with their labels', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('TOXICITY_CAP')).toBeTruthy();
    expect(screen.getByText('SANCTUARY')).toBeTruthy();
    expect(screen.getByText('RESTORATION')).toBeTruthy();
    expect(screen.getByText('NATIVE_BIODIV')).toBeTruthy();
  });

  it('shows each lever value as a rounded 0-100 readout', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    expect(screen.getByText('60')).toBeTruthy();  // toxicityCap
    expect(screen.getByText('70')).toBeTruthy();  // restoration
  });

  it('marks the container gated when isGated is true', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={true} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).toContain('is-gated');
  });

  it('is not gated when isGated is false', () => {
    render(<ProtectionLevers levers={LEVERS} isGated={false} onChange={() => {}} />);
    const el = screen.getByTestId('protection-levers');
    expect(el.className).not.toContain('is-gated');
  });
});
