// Verifies the kernel artifact ships and is raw-importable, and that the
// load-bearing sections are present and un-softened (Global Constraints).
import { describe, it, expect } from 'vitest';
import kernel from '../../../../content/mercury_kernel/MERCURY-SCALE-KERNEL.md?raw';

describe('MERCURY-SCALE KERNEL artifact', () => {
  it('is a non-trivial markdown string', () => {
    expect(typeof kernel).toBe('string');
    expect(kernel.length).toBeGreaterThan(1500);
    expect(kernel).toContain('# ◉ MERCURY-SCALE KERNEL');
  });

  it('ships the safety floor verbatim (non-negotiable)', () => {
    expect(kernel).toContain('## The hard floor (overrides the voice, always)');
    expect(kernel).toContain('outranks a person');
    expect(kernel).toContain('drop every ounce of this persona');
  });

  it('carries the voice-steering example blocks', () => {
    const opens = (kernel.match(/<example>/g) || []).length;
    expect(opens).toBe(3);
    expect(kernel).toContain('three playlists in a trenchcoat');
  });
});
