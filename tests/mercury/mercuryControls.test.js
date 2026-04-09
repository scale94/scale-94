import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MercuryControls from '../../src/terminal/mercury/MercuryControls';

const baseParams = {
  speed: 0.1, turbulence: 0.25, density: 8000,
  curlAmp: 0.02, tubeRadius: 0.32, chromatic: 0.0,
  flameWidth: 0.85, eruptStrength: 0.8,
  orbitalSpeed: 1.2, spread: 1.0,
};

describe('MercuryControls', () => {
  it('renders shared params for any active phase', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/speed/i)).toBeTruthy();
    expect(screen.getByText(/turbulence/i)).toBeTruthy();
    expect(screen.getByText(/density/i)).toBeTruthy();
  });

  it('renders fluid-specific params when fluid is active', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/curl amp/i)).toBeTruthy();
    expect(screen.getByText(/tube radius/i)).toBeTruthy();
    expect(screen.getByText(/chromatic/i)).toBeTruthy();
  });

  it('renders thermal-specific params when thermal is active', () => {
    render(<MercuryControls activePhase="thermal" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/flame width/i)).toBeTruthy();
    expect(screen.queryByText(/curl amp/i)).toBeNull();
  });

  it('renders earth-specific params when earth is active', () => {
    render(<MercuryControls activePhase="earth" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/eruption/i)).toBeTruthy();
    expect(screen.queryByText(/flame width/i)).toBeNull();
  });

  it('renders air-specific params when air is active', () => {
    render(<MercuryControls activePhase="air" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/orbital spd/i)).toBeTruthy();
    expect(screen.getByText(/spread/i)).toBeTruthy();
  });

  it('shows correct phase label', () => {
    render(<MercuryControls activePhase="thermal" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/thermal :: active/i)).toBeTruthy();
  });

  it('shows fps and particle count', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} fps={60} particleCount={10000} />);
    expect(screen.getByText(/60/)).toBeTruthy();
    expect(screen.getByText(/10,000/)).toBeTruthy();
  });
});
