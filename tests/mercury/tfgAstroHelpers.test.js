import { describe, it, expect } from 'vitest';
import {
  PLANET_MAP, PLANET_COLORS,
  parseAstroOutput, getRuler,
} from '../../src/terminal/mercury/tfgAstroHelpers';

describe('PLANET_MAP', () => {
  it('maps Hg #80 to Mercury', () => expect(PLANET_MAP[80]).toBe('Mercury'));
  it('maps Au #79 to Sun',     () => expect(PLANET_MAP[79]).toBe('Sun'));
  it('maps Ag #47 to Moon',    () => expect(PLANET_MAP[47]).toBe('Moon'));
  it('maps Fe #26 to Mars',    () => expect(PLANET_MAP[26]).toBe('Mars'));
  it('maps Cu #29 to Venus',   () => expect(PLANET_MAP[29]).toBe('Venus'));
  it('maps Sn #50 to Jupiter', () => expect(PLANET_MAP[50]).toBe('Jupiter'));
  it('maps Pb #82 to Saturn',  () => expect(PLANET_MAP[82]).toBe('Saturn'));
  it('maps U  #92 to Uranus',  () => expect(PLANET_MAP[92]).toBe('Uranus'));
  it('maps Np #93 to Neptune', () => expect(PLANET_MAP[93]).toBe('Neptune'));
  it('maps Pu #94 to Pluto',   () => expect(PLANET_MAP[94]).toBe('Pluto'));
  it('has exactly 10 entries', () => expect(Object.keys(PLANET_MAP)).toHaveLength(10));
});

describe('PLANET_COLORS', () => {
  it('Hg #80 is silver (#c0c0c0)', () => expect(PLANET_COLORS[80]).toBe('#c0c0c0'));
  it('Au #79 is gold (#f59e0b)',   () => expect(PLANET_COLORS[79]).toBe('#f59e0b'));
  it('has same keys as PLANET_MAP', () => {
    expect(Object.keys(PLANET_COLORS).map(Number).sort((a,b)=>a-b))
      .toEqual(Object.keys(PLANET_MAP).map(Number).sort((a,b)=>a-b));
  });
});

describe('parseAstroOutput', () => {
  const RAW = [
    'Mercury\nsign:Taurus\ndegree:14\nretrograde:false\naspect:Conjunct Sun (orb 3°)\n',
    'Venus\nsign:Aries\ndegree:5\nretrograde:false\naspect:\u2014\n',
    'Sun\nsign:Taurus\ndegree:11\nretrograde:false\naspect:Conjunct Mercury (orb 3°)\n',
    'Mars\nsign:Gemini\ndegree:22\nretrograde:false\naspect:\u2014\n',
    'Jupiter\nsign:Taurus\ndegree:8\nretrograde:false\naspect:\u2014\n',
    'Saturn\nsign:Pisces\ndegree:1\nretrograde:false\naspect:\u2014\n',
    'Uranus\nsign:Taurus\ndegree:20\nretrograde:false\naspect:\u2014\n',
    'Neptune\nsign:Pisces\ndegree:25\nretrograde:false\naspect:\u2014\n',
    'Pluto\nsign:Aquarius\ndegree:29\nretrograde:false\naspect:\u2014\n',
    'Moon\nsign:Cancer\ndegree:12\nretrograde:false\naspect:\u2014\n',
  ].join('---\n');

  it('returns 10 planet keys', () => {
    expect(Object.keys(parseAstroOutput(RAW))).toHaveLength(10);
  });

  it('parses Mercury correctly', () => {
    expect(parseAstroOutput(RAW).Mercury).toMatchObject({
      sign: 'Taurus', degree: 14, retrograde: false, aspect: 'Conjunct Sun (orb 3°)',
    });
  });

  it('parses degree as number', () => {
    expect(typeof parseAstroOutput(RAW).Moon.degree).toBe('number');
  });

  it('parses retrograde:true correctly', () => {
    const raw = 'Mercury\nsign:Virgo\ndegree:5\nretrograde:true\naspect:\u2014\n';
    expect(parseAstroOutput(raw).Mercury.retrograde).toBe(true);
  });
});

describe('getRuler', () => {
  it('f-block → Neptune',  () => expect(getRuler({ group: null, block: 'f' })).toBe('Neptune'));
  it('group 1 → Moon',     () => expect(getRuler({ group: 1,    block: 's' })).toBe('Moon'));
  it('group 2 → Moon',     () => expect(getRuler({ group: 2,    block: 's' })).toBe('Moon'));
  it('group 3 → Saturn',   () => expect(getRuler({ group: 3,    block: 'd' })).toBe('Saturn'));
  it('group 6 → Mars',     () => expect(getRuler({ group: 6,    block: 'd' })).toBe('Mars'));
  it('group 9 → Venus',    () => expect(getRuler({ group: 9,    block: 'd' })).toBe('Venus'));
  it('group 11 → Sun',     () => expect(getRuler({ group: 11,   block: 'd' })).toBe('Sun'));
  it('group 13 → Mercury', () => expect(getRuler({ group: 13,   block: 'p' })).toBe('Mercury'));
  it('group 17 → Jupiter', () => expect(getRuler({ group: 17,   block: 'p' })).toBe('Jupiter'));
});
