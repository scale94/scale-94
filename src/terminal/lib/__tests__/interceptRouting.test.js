import { describe, it, expect } from 'vitest';
import laws from './fixtures/legislation-sealed-2026-03-09.json';
import {
  NOW_STEP, STEPS, lawsInForce, route, packetFate, fateLine, familyReadout, formatCount,
} from '../interceptLattice';

describe('routing (spec §3, §4)', () => {
  it('takes the fewest hops: Canada reaches New Zealand only through the US', () => {
    expect(route('CA', 'NZ')).toEqual(['CA', 'US', 'NZ']);
  });

  it('breaks hop ties by geography, keeping European routes in Europe', () => {
    expect(route('UK', 'DE')).toEqual(['UK', 'NL', 'DE']);
    expect(route('IE', 'SE')).toEqual(['IE', 'FR', 'DE', 'SE']);
  });

  it('bends through waypoints in order', () => {
    expect(route('CA', 'NZ', ['AU'])).toEqual(['CA', 'US', 'AU', 'NZ']);
    expect(route('UK', 'AU', ['DE'])).toEqual(['UK', 'NL', 'DE', 'US', 'AU']);
  });

  it('handles a zero-length route and unknown nodes', () => {
    expect(route('CA', 'CA')).toEqual(['CA']);
    expect(route('CA', 'XX')).toBeNull();
  });
});

describe('packet fate (spec §5, §6)', () => {
  const ukAu = route('UK', 'AU');
  const events = packetFate(ukAu, lawsInForce(laws, NOW_STEP));

  it('places each tap where the spec says it fires', () => {
    expect(events.map((e) => [e.phase, e.hop, e.node, e.key])).toEqual([
      ['source', 0, 'UK', 'scan'],
      ['source', 0, 'UK', 'digitalId'],
      ['source', 0, 'UK', 'worker'],
      ['transit', 0, 'UK', 'backdoor'],
      ['transit', 0, 'UK', 'retain'],
      ['transit', 0, 'UK', 'traffic'],
      ['transit', 1, 'US', 'retain'],
      ['transit', 2, 'AU', 'backdoor'],
      ['transit', 2, 'AU', 'retain'],
      ['destination', 2, 'AU', 'age'],
    ]);
  });

  it('carries the law ids behind each word', () => {
    expect(events[0].lawIds).toEqual(['LAW-UK-2023-OSA-001']);
  });

  it('writes the fate line in the lattice voice', () => {
    expect(fateLine(ukAu, events)).toBe(
      'united kingdom → australia · 2 hops · seen, named, watched before leaving · read at united kingdom, australia · kept at united kingdom, united states, australia · traced at united kingdom · proven on arrival',
    );
  });

  it('lets a packet arrive unseen before any law is in force', () => {
    const p = route('CA', 'NZ');
    expect(fateLine(p, packetFate(p, lawsInForce(laws, 0)))).toBe('canada → new zealand · 2 hops · arrived. unseen.');
  });

  it('marks the same crossing once every proposal passes', () => {
    const p = route('CA', 'NZ');
    expect(fateLine(p, packetFate(p, lawsInForce(laws, 5)))).toBe(
      'canada → new zealand · 2 hops · seen, named, measured, watched before leaving · read at canada, united states · kept at canada, united states · traced at canada',
    );
  });

  it('returns nothing for a route that goes nowhere', () => {
    expect(packetFate(['CA'], laws)).toEqual([]);
    expect(fateLine(['CA'], [])).toBe('');
  });
});

describe('family readout (spec §6 table)', () => {
  it('pins the unread / unkept / unnamed counts per detent', () => {
    expect(STEPS.map((_, i) => familyReadout(laws, i))).toEqual([
      { unread: 55, unkept: 55, unnamed: 55 },
      { unread: 3, unkept: 6, unnamed: 18 },
      { unread: 1, unkept: 0, unnamed: 0 },
      { unread: 1, unkept: 0, unnamed: 0 },
      { unread: 0, unkept: 0, unnamed: 0 },
      { unread: 0, unkept: 0, unnamed: 0 },
    ]);
  });

  it('formats zero as none', () => {
    expect(formatCount(0)).toBe('none');
    expect(formatCount(18)).toBe('18');
  });
});
