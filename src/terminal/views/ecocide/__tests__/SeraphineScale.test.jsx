import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeraphineScale from '../SeraphineScale';

describe('SeraphineScale', () => {
  it('does not mount the Eye during pure collapse (bloomFrac <= 0.02)', () => {
    render(<SeraphineScale deadFrac={0.7} bloomFrac={0} />);
    expect(screen.queryByTestId('seraphine-eye')).toBeNull();
  });

  it('mounts the Eye once bloom crosses the threshold', () => {
    render(<SeraphineScale deadFrac={0} bloomFrac={0.5} />);
    expect(screen.queryByTestId('seraphine-eye')).not.toBeNull();
  });

  it('rotates the beam in proportion to deadFrac', () => {
    render(<SeraphineScale deadFrac={0.5} bloomFrac={0} />);
    const beam = screen.getByTestId('seraphine-beam');
    // 0.5 * 10deg = 5deg
    expect(beam.getAttribute('style')).toContain('rotate(5deg)');
  });

  it('holds the beam level at homeostasis / bloom (deadFrac 0)', () => {
    render(<SeraphineScale deadFrac={0} bloomFrac={0.3} />);
    const beam = screen.getByTestId('seraphine-beam');
    expect(beam.getAttribute('style')).toContain('rotate(0deg)');
  });
});
