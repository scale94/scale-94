import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../../../../ledger/ocean/grid';
import { buildLandMask } from '../../../../ledger/ocean/landMask';
import { oceanSources } from '../../../../ledger/ocean/sources';
import { describeSites, tooltipLines } from '../hudFormat';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

describe('describeSites for catalog sources', () => {
  const sites = describeSites(oceanSources(grid, mask));
  const amazon = sites.find((s) => s.id === 'catalog:amazon');

  it('names the river and measures outfall → snapped cell', () => {
    expect(amazon.kind).toBe('catalog');
    expect(amazon.name).toBe('AMAZON');
    expect(amazon.status).toBeNull();
    expect(amazon.snapKm).toBeGreaterThanOrEqual(0);
    expect(amazon.snapKm).toBeLessThan(100);
  });

  it('labels the tooltip an ambient river with its discharge', () => {
    const lines = tooltipLines(amazon);
    expect(lines[0]).toBe('AMAZON');
    expect(lines[1]).toBe('AMBIENT RIVER');
    expect(lines[2]).toBe('Q 209,000 m³/s');
  });

  it('describes all 22 ambient sources', () => {
    expect(sites).toHaveLength(22);
    expect(sites.filter((s) => s.kind === 'catalog')).toHaveLength(13);
  });
});
