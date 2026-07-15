import { describe, it, expect } from 'vitest';
import { doctrineFor, doctrineLogLines } from '../kernelDoctrines';

describe('kernelDoctrines', () => {
  it('the hopfield kernel carries the séance doctrine (spec §5 example)', () => {
    expect(doctrineFor('ASSOCIATIVE-FIELD-1.0'))
      .toBe('the cue is a summons · the basin is a séance · memory is a place the field falls into');
  });

  it('matches sphere kernels by registry-id substring', () => {
    expect(doctrineFor('FEIGENBAUM-CASCADE-1.0')).toBeTruthy();
    expect(doctrineFor('FSF-12.1.0')).toBe(doctrineFor('FEIGENBAUM-CASCADE-1.0'));
    expect(doctrineFor('FISH-SCALE-KERNEL11.1.1')).toBeTruthy(); // necromantic family
    expect(doctrineFor('SOMA-9.1-GAIA')).toBeTruthy();
    expect(doctrineFor('BIODIVERSITY-PROMPT-1.0.1')).toBeTruthy();
    expect(doctrineFor('LEVIATHAN')).toBeTruthy();
  });

  it('non-sphere kernels stay untranslated', () => {
    expect(doctrineFor('BELLARD-BAUDRILLARD_KERNEL-V1_0_0')).toBeNull();
    expect(doctrineFor('')).toBeNull();
    expect(doctrineFor(undefined)).toBeNull();
  });

  it('doctrineLogLines yields the two-line block, or nothing', () => {
    const lines = doctrineLogLines('ASSOCIATIVE-FIELD-1.0', '12:00:00');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ time: '12:00:00', msg: '  doctrine:', rust: true });
    expect(lines[1].msg).toContain('séance');
    expect(doctrineLogLines('BELLARD-BAUDRILLARD_KERNEL-V1_0_0', '12:00:00')).toEqual([]);
  });
});
