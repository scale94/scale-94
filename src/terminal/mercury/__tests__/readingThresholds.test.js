import { describe, it, expect } from 'vitest';
import { countWords, requiredSeconds } from '../readingThresholds';

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('the quick brown fox')).toBe(4);
  });
  it('collapses irregular whitespace and newlines', () => {
    expect(countWords('  a\n\n b   c\t d ')).toBe(4);
  });
  it('returns 0 for empty / nullish', () => {
    expect(countWords('')).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });
});

describe('requiredSeconds', () => {
  it('is words / wpm * 60 * leniency', () => {
    // 200 words at 200 wpm = 1 min = 60s; * 0.55 leniency = 33s
    expect(requiredSeconds(200)).toBeCloseTo(33, 5);
  });
  it('honors overrides', () => {
    expect(requiredSeconds(100, { wpm: 100, leniency: 1 })).toBeCloseTo(60, 5);
  });
  it('returns 0 for non-positive words', () => {
    expect(requiredSeconds(0)).toBe(0);
    expect(requiredSeconds(-5)).toBe(0);
  });
});
