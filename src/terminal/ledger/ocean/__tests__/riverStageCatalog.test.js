import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { oceanSources } from '../sources';
import { prepareRiver } from '../riverStage';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

describe('river stage and the catalog', () => {
  it('draws no river-stage particles for a mouth-only catalog source', () => {
    const catalog = oceanSources(grid, mask).filter((s) => s.kind === 'catalog');
    expect(catalog).toHaveLength(13);
    for (const s of catalog) expect(prepareRiver(s), s.id).toBeNull();
  });

  it('still prepares every preset river', () => {
    const presets = oceanSources(grid, mask).filter((s) => s.kind === 'preset');
    expect(presets).toHaveLength(9);
    expect(presets.filter((s) => prepareRiver(s) !== null).length).toBeGreaterThan(0);
  });
});
