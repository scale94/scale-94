import { describe, it, expect } from 'vitest';
import { normalizeGateAnswer, isAcceptedAnswer, ACCEPTED_ANSWERS, GATE_PROMPT } from '../src/terminal/lib/gateAnswers';

describe('gateAnswers', () => {
  it('exports the prompt text', () => {
    expect(GATE_PROMPT).toBe('from perihelion, growth reads as ___');
  });

  it('exports the accepted set', () => {
    expect(ACCEPTED_ANSWERS).toEqual(['noise', 'decay', 'dying']);
  });

  describe('normalizeGateAnswer', () => {
    it('lowercases', () => expect(normalizeGateAnswer('NOISE')).toBe('noise'));
    it('trims whitespace', () => expect(normalizeGateAnswer('  decay  ')).toBe('decay'));
    it('collapses inner whitespace to single space', () => expect(normalizeGateAnswer('dy ing')).toBe('dy ing'));
    it('handles null/undefined', () => {
      expect(normalizeGateAnswer(null)).toBe('');
      expect(normalizeGateAnswer(undefined)).toBe('');
    });
  });

  describe('isAcceptedAnswer', () => {
    it('accepts canonical "noise"', () => expect(isAcceptedAnswer('noise')).toBe(true));
    it('accepts canonical "decay"', () => expect(isAcceptedAnswer('decay')).toBe(true));
    it('accepts canonical "dying"', () => expect(isAcceptedAnswer('dying')).toBe(true));
    it('accepts uppercase NOISE', () => expect(isAcceptedAnswer('NOISE')).toBe(true));
    it('accepts whitespace-padded " decay "', () => expect(isAcceptedAnswer(' decay ')).toBe(true));
    it('rejects empty string', () => expect(isAcceptedAnswer('')).toBe(false));
    it('rejects null', () => expect(isAcceptedAnswer(null)).toBe(false));
    it('rejects "growth"', () => expect(isAcceptedAnswer('growth')).toBe(false));
    it('rejects partial match "noi"', () => expect(isAcceptedAnswer('noi')).toBe(false));
  });
});
