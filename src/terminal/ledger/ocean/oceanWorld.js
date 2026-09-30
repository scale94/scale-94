// oceanWorld.js — the static ocean (grid, coastline, currents, packed GPU
// data, ambient preset and catalog sources), built once per session. The bake is ~0.3 s
// on a desktop; memoising keeps tab switches free.

import { OCEAN_GRID } from './grid';
import { buildLandMask } from './landMask';
import { bakeCurrents } from './streamFunction';
import { oceanSources } from './sources';
import { packStatic, packRows, packSources } from './gpu/gpuData';

let cached = null;

export function getOceanWorld() {
  if (cached) return cached;
  const grid = OCEAN_GRID;
  const mask = buildLandMask(grid);
  const { vel } = bakeCurrents(grid, mask);
  const sources = oceanSources(grid, mask);
  cached = {
    grid, mask, vel, sources,
    staticData: packStatic(grid, mask.land, vel),
    rowData: packRows(grid),
    ambientSourceData: packSources(grid, mask.land, sources),
  };
  return cached;
}
