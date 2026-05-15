import { describe, it, expect } from 'vitest';
import { computeLivingNote, LIVING_NOTE_POOL } from '../api/transmute/redeem.js';

const SAMPLE_CARD = {
  topNotes:   ['bergamot', 'neroli'],
  heartNotes: ['jasmine sambac', 'osmanthus', 'rose'],
  baseNotes:  ['vetiver', 'oud'],
  dom: 'floral',
};

describe('computeLivingNote', () => {
  it('returns deterministic output for same (discordId, accordHash)', () => {
    const a = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    const b = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(a).toEqual(b);
  });

  it('returns different output for different discordIds', () => {
    const a = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    const b = computeLivingNote('user-456', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(a).not.toEqual(b);
  });

  it('substitutes a note from the LIVING_NOTE_POOL', () => {
    const result = computeLivingNote('user-123', 'abc'.repeat(21) + 'd', SAMPLE_CARD);
    expect(['top', 'heart', 'base']).toContain(result.layer);
    expect(result.newNote).toBeTruthy();
    expect(result.editionEntropy).toMatch(/^[0-9a-f]{8}$/);
    expect(result.witnessHash).toMatch(/^[0-9a-f]+…[0-9a-f]+$/);
  });

  it('LIVING_NOTE_POOL has entries for all family-layer combos', () => {
    expect(LIVING_NOTE_POOL.FLORAL_heart.length).toBeGreaterThan(0);
    expect(LIVING_NOTE_POOL.CITRUS_top.length).toBeGreaterThan(0);
    expect(LIVING_NOTE_POOL._DEFAULT_heart.length).toBeGreaterThan(0);
  });
});
