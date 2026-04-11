import { describe, it, expect } from 'vitest';
import { MANIFESTO_CHAPTERS } from '../../src/terminal/data/manifestoChapters';
import { MANDALA_SECTOR_ORDER } from '../../src/terminal/views/manifesto/MandalaGeometry';
import { MANIFESTO_BEACONS } from '../../src/terminal/data/manifestoBeacons';
import { NODES, NODE_IDX } from '../../src/terminal/data/nodeFeatures';
import { CHAPTER_BY_ID } from '../../src/terminal/data/manifestoChapters';

describe('MANIFESTO_CHAPTERS', () => {
  it('has exactly 6 chapters', () => {
    expect(MANIFESTO_CHAPTERS).toHaveLength(6);
  });

  it('every chapter has required fields', () => {
    for (const ch of MANIFESTO_CHAPTERS) {
      expect(typeof ch.id).toBe('string');
      expect(typeof ch.number).toBe('string');
      expect(typeof ch.title).toBe('string');
      expect(Array.isArray(ch.sectors)).toBe(true);
      expect(typeof ch.epigraph).toBe('string');
      expect(typeof ch.opening).toBe('string');
    }
  });

  it('all chapter sectors are valid mandala sectors', () => {
    for (const ch of MANIFESTO_CHAPTERS) {
      for (const s of ch.sectors) {
        expect(MANDALA_SECTOR_ORDER).toContain(s);
      }
    }
  });

  it('chapter sectors collectively cover all 16 mandala sectors exactly once', () => {
    const covered = MANIFESTO_CHAPTERS.flatMap(ch => ch.sectors);
    expect(covered).toHaveLength(16);
    expect(new Set(covered).size).toBe(16);
    for (const s of MANDALA_SECTOR_ORDER) {
      expect(covered).toContain(s);
    }
  });

  it('chapter sectors appear in MANDALA_SECTOR_ORDER contiguously per chapter', () => {
    let cursor = 0;
    for (const ch of MANIFESTO_CHAPTERS) {
      const expected = MANDALA_SECTOR_ORDER.slice(cursor, cursor + ch.sectors.length);
      expect(ch.sectors).toEqual(expected);
      cursor += ch.sectors.length;
    }
  });
});

describe('MANIFESTO_BEACONS', () => {
  it('has at least 30 beacons', () => {
    expect(MANIFESTO_BEACONS.length).toBeGreaterThanOrEqual(30);
  });

  it('every beacon resolves to a real NODES entry', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(NODE_IDX[b.nodeId]).toBeDefined();
    }
  });

  it('every beacon has a valid chapter id', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(CHAPTER_BY_ID[b.chapter]).toBeDefined();
    }
  });

  it('every beacon has a non-empty quote', () => {
    for (const b of MANIFESTO_BEACONS) {
      expect(typeof b.quote).toBe('string');
      expect(b.quote.length).toBeGreaterThan(5);
    }
  });

  it('no duplicate beacon node ids', () => {
    const ids = MANIFESTO_BEACONS.map(b => b.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every chapter has at least 2 beacons', () => {
    const counts = {};
    for (const b of MANIFESTO_BEACONS) {
      counts[b.chapter] = (counts[b.chapter] || 0) + 1;
    }
    for (const chId of Object.keys(CHAPTER_BY_ID)) {
      expect(counts[chId] || 0).toBeGreaterThanOrEqual(2);
    }
  });
});
