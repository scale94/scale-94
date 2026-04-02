import { describe, it, expect } from 'vitest';
import { parseUSGSResponse, parseEEAResponse } from '../../src/terminal/ledger/apiIngest';

describe('parseUSGSResponse', () => {
  it('extracts temperature and DO from USGS NWIS JSON', () => {
    const mockResponse = {
      value: {
        timeSeries: [
          {
            variable: { variableCode: [{ value: '00010' }] },
            values: [{ value: [{ value: '22.3', dateTime: '2026-04-01T12:00:00' }] }],
          },
          {
            variable: { variableCode: [{ value: '00300' }] },
            values: [{ value: [{ value: '7.2', dateTime: '2026-04-01T12:00:00' }] }],
          },
        ],
      },
    };
    const params = parseUSGSResponse(mockResponse);
    expect(params.temp).toBe(22.3);
    expect(params.do).toBe(7.2);
  });

  it('returns null for missing parameters', () => {
    const params = parseUSGSResponse({ value: { timeSeries: [] } });
    expect(params.temp).toBeNull();
  });
});

describe('parseEEAResponse', () => {
  it('extracts parameters from EEA Waterbase format', () => {
    const mockRecords = [
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'Water temperature', resultObservedValue: 18.5 },
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'Dissolved oxygen', resultObservedValue: 6.8 },
      { parameterWaterBodyCategory: 'RW', observedPropertyDeterminandLabel: 'BOD5', resultObservedValue: 4.2 },
    ];
    const params = parseEEAResponse(mockRecords);
    expect(params.temp).toBe(18.5);
    expect(params.do).toBe(6.8);
    expect(params.bod).toBe(4.2);
  });
});
