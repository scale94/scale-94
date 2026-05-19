import { describe, it, expect } from 'vitest';
import { normalizeGateAnswer, isAcceptedAnswer, ACCEPTED_ANSWERS, GATE_PROMPT } from '../src/terminal/lib/gateAnswers';

describe('gateAnswers', () => {
  it('exports the prompt text', () => {
    expect(GATE_PROMPT).toBe('from perihelion, growth reads as ___');
  });

  it('exports the accepted set', () => {
    expect(ACCEPTED_ANSWERS).toEqual(['bargain']);
  });

  describe('normalizeGateAnswer', () => {
    it('lowercases', () => expect(normalizeGateAnswer('BARGAIN')).toBe('bargain'));
    it('trims whitespace', () => expect(normalizeGateAnswer('  bargain  ')).toBe('bargain'));
    it('handles null/undefined', () => {
      expect(normalizeGateAnswer(null)).toBe('');
      expect(normalizeGateAnswer(undefined)).toBe('');
    });
  });

  describe('isAcceptedAnswer', () => {
    it('accepts canonical "bargain"', () => expect(isAcceptedAnswer('bargain')).toBe(true));
    it('accepts uppercase BARGAIN', () => expect(isAcceptedAnswer('BARGAIN')).toBe(true));
    it('accepts whitespace-padded " bargain "', () => expect(isAcceptedAnswer(' bargain ')).toBe(true));
    it('rejects empty string', () => expect(isAcceptedAnswer('')).toBe(false));
    it('rejects null', () => expect(isAcceptedAnswer(null)).toBe(false));
    it('rejects "growth"', () => expect(isAcceptedAnswer('growth')).toBe(false));
    it('rejects retired "noise"', () => expect(isAcceptedAnswer('noise')).toBe(false));
    it('rejects retired "decay"', () => expect(isAcceptedAnswer('decay')).toBe(false));
    it('rejects partial match "barg"', () => expect(isAcceptedAnswer('barg')).toBe(false));
  });
});
