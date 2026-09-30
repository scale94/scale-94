import { describe, it, expect } from 'vitest';
import { isUnlocatedRecord, isNullIslandInput, UNLOCATED_LABEL } from '../coordinates';
import { isUnlocated, UNLOCATED_LABEL as SOURCES_LABEL } from '../ocean/sources';
import { isNullIsland } from '../../views/ledger/draft';

describe('coordinates: the one 0°, 0° rule', () => {
  it('a stored record is UNLOCATED only at exact numeric 0, 0', () => {
    expect(isUnlocatedRecord({ lat: 0, lon: 0 })).toBe(true);
    expect(isUnlocatedRecord({ lat: -0, lon: 0 })).toBe(true);
    expect(isUnlocatedRecord({ lat: '0', lon: '0' })).toBe(false);
    expect(isUnlocatedRecord({ lat: 0, lon: 0.0001 })).toBe(false);
    expect(isUnlocatedRecord(undefined)).toBe(false);
  });

  it('form input coerces typed strings, and blank is not 0', () => {
    expect(isNullIslandInput('0', '-0')).toBe(true);
    expect(isNullIslandInput(' 0.0 ', 0)).toBe(true);
    expect(isNullIslandInput('', '0')).toBe(false);
    expect(isNullIslandInput('  ', '  ')).toBe(false);
    expect(isNullIslandInput('0', '0.5')).toBe(false);
  });

  it('the ocean and the form use these very functions', () => {
    expect(isUnlocated).toBe(isUnlocatedRecord);
    expect(isNullIsland).toBe(isNullIslandInput);
    expect(SOURCES_LABEL).toBe(UNLOCATED_LABEL);
    expect(UNLOCATED_LABEL).toBe('UNLOCATED');
  });
});
