import { describe, it, expect } from 'vitest';
import {
  generateEntry, buildMarkdownLog, detectThresholds, PHRASES,
} from '../../src/terminal/mercury/observationLog';

const mockMercury = {
  heliocentricDistanceAU: 0.4,
  solarFluxWm2: 8500,
  subsolarTempK: 650,
  earthMercuryDistanceAU: 1.0,
  daysToNextPerihelion: 30,
  subsolarLongitudeDeg: 0,
};
const mockInstruments = [
  { label: 'PROMISE HALF-LIFE',   value: 4.2, unit: 'd'       },
  { label: 'ATTENTION VISCOSITY', value: 0.3, unit: 'Pa·s'    },
  { label: 'WORSHIP TEMPERATURE', value: 650, unit: 'K'       },
  { label: 'MIGRATION DRIFT',     value: 0.5, unit: 'σ'       },
  { label: 'GRIEF INDEX',         value: 0.4, unit: 'idx'     },
  { label: 'FORGETTING FLUX',     value: 1.0, unit: 'bit/m²·s'},
];

describe('PHRASES', () => {
  it('has entries for each trigger category', () => {
    expect(PHRASES.phase_transit.length).toBeGreaterThan(0);
    expect(PHRASES.minute_tick_quiet.length).toBeGreaterThan(0);
    expect(PHRASES.threshold_promise_collapse.length).toBeGreaterThan(0);
    expect(PHRASES.threshold_grief_high.length).toBeGreaterThan(0);
  });
});

describe('generateEntry', () => {
  it('returns an entry with timestamp, trigger, line, tail', () => {
    const e = generateEntry({
      trigger: 'minute_tick',
      timestamp: new Date('2026-05-20T14:46:08Z'),
      mercury: mockMercury,
      instruments: mockInstruments,
      activePhase: 'fluid',
    });
    expect(e).toHaveProperty('timestamp');
    expect(e).toHaveProperty('trigger');
    expect(e).toHaveProperty('triggerLabel');
    expect(e).toHaveProperty('line');
    expect(e).toHaveProperty('tail');
    expect(typeof e.line).toBe('string');
    expect(e.line.length).toBeGreaterThan(10);
  });

  it('phase transit entry references both phases', () => {
    const e = generateEntry({
      trigger: 'phase_transit',
      from: 'thermal',
      to: 'earth',
      timestamp: new Date(),
      mercury: mockMercury,
      instruments: mockInstruments,
      activePhase: 'earth',
    });
    expect(e.triggerLabel).toContain('phase transit');
  });

  it('is deterministic for the same timestamp + trigger', () => {
    const ts = new Date('2026-05-20T14:46:08Z');
    const a = generateEntry({ trigger: 'minute_tick', timestamp: ts, mercury: mockMercury, instruments: mockInstruments, activePhase: 'fluid' });
    const b = generateEntry({ trigger: 'minute_tick', timestamp: ts, mercury: mockMercury, instruments: mockInstruments, activePhase: 'fluid' });
    expect(a.line).toBe(b.line);
  });
});

describe('detectThresholds', () => {
  it('flags promise collapse', () => {
    const prev = [{ label: 'PROMISE HALF-LIFE', value: 2.5 }];
    const curr = [{ label: 'PROMISE HALF-LIFE', value: 1.5 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_promise_collapse');
  });

  it('flags worship high', () => {
    const prev = [{ label: 'WORSHIP TEMPERATURE', value: 680 }];
    const curr = [{ label: 'WORSHIP TEMPERATURE', value: 695 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_worship_high');
  });

  it('flags grief high', () => {
    const prev = [{ label: 'GRIEF INDEX', value: 0.65 }];
    const curr = [{ label: 'GRIEF INDEX', value: 0.75 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_grief_high');
  });

  it('returns empty array when nothing crossed', () => {
    const same = mockInstruments;
    expect(detectThresholds(same, same)).toEqual([]);
  });
});

describe('buildMarkdownLog', () => {
  it('returns a string with header, current state, and entries', () => {
    const entries = [{
      timestamp: new Date('2026-05-20T14:46:08Z'),
      trigger: 'minute_tick',
      triggerLabel: 'minute tick',
      line: 'the cathedral is at nave 14.',
      tail: 'viscosity 0.34 Pa·s',
    }];
    const md = buildMarkdownLog({
      entries, mercury: mockMercury, instruments: mockInstruments,
      activePhase: 'fluid', sessionStart: new Date('2026-05-20T14:30:00Z'),
    });
    expect(md).toContain('# MERCURY OBSERVATION LOG');
    expect(md).toContain('CURRENT INSTRUMENTS');
    expect(md).toContain('PROMISE HALF-LIFE');
    expect(md).toContain('the cathedral is at nave 14.');
    expect(md).toContain('scale94 · mercury terminal');
  });
});
