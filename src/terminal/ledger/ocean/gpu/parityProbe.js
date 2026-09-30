// parityProbe.js — runs the CPU oracle and the GPU runner side by side in a
// real browser and compares their states. Dev-only (ledger-ocean-probe.html).

import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { bakeCurrents } from '../streamFunction';
import { createOceanContext, step } from '../referenceStep';
import { ambientSources } from '../sources';
import { packStatic, packRows, packSources } from './gpuData';
import { createOceanGpu } from './oceanGpu';
import { syntheticWorld, uniformVelocity, blob } from '../__tests__/syntheticWorld';

const TOL_FIRST = 1e-5;
const TOL_LAST = 2e-4;
const FLOOR = 1e-3;

function compare(grid, cpu, gpu, tol) {
  const channels = [];
  let ok = true;
  for (let c = 0; c < 4; c++) {
    let maxAbsCpu = 0;
    let maxDiff = 0;
    let at = -1;
    for (let k = 0; k < grid.n; k++) {
      const a = cpu[k * 4 + c];
      const d = Math.abs(a - gpu[k * 4 + c]);
      maxAbsCpu = Math.max(maxAbsCpu, Math.abs(a));
      if (!(d <= maxDiff)) { maxDiff = d; at = k; }
    }
    const pass = maxDiff <= tol * Math.max(maxAbsCpu, FLOOR);
    ok = ok && pass;
    const i = at % grid.nx;
    const j = (at - i) / grid.nx;
    channels.push({ maxAbsCpu, maxDiff, at: at < 0 ? null : { i, j, lon: grid.lonOf(i), lat: grid.latOf(j) }, pass });
  }
  return { ok, channels };
}

function quad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function runCase({ name, grid, mask, vel, init, sources, steps, diffusivity, reactions = true }) {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) throw new Error('no webgl2');
  const gpu = createOceanGpu(gl, {
    grid, staticData: packStatic(grid, mask.land, vel), rowData: packRows(grid), vao: quad(gl), diffusivity,
  });
  if (!gpu) throw new Error('no float render targets');
  gpu.setState(init);
  gpu.setSources(packSources(grid, mask.land, sources));
  const ctx = createOceanContext(grid, mask.land, vel);
  const cpu = Float32Array.from(init);
  const results = [];
  for (let s = 1; s <= steps; s++) {
    step(ctx, cpu, { sources, diffusivity, reactions });
    gpu.step({ reactions });
    if (s === 1 || s === steps) {
      results.push({ step: s, ...compare(grid, cpu, gpu.readState(), s === 1 ? TOL_FIRST : TOL_LAST) });
    }
  }
  gpu.dispose();
  return { name, ok: results.every((r) => r.ok), results };
}

function syntheticCase() {
  const { grid, mask } = syntheticWorld();
  const { vel } = bakeCurrents(grid, mask, {
    cells: [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }],
    acc: null,
  });
  const init = blob(grid, mask.land, 30, 16, 6, 1);
  for (let j = 13; j <= 17; j++) for (let i = 34; i <= 38; i++) init[grid.idx(i, j) * 4 + 2] = 1;
  const sources = [{ cells: [{ k: grid.idx(38, 15), f: 0.5 }], conc: [1, 2, 3, 4] }];
  return runCase({ name: 'synthetic 64x32 vortex + island, D=5e4', grid, mask, vel, init, sources, steps: 60, diffusivity: 5e4 });
}

// Date-line seam: a blob straddling i = 0 / nx-1 carried across it by a
// uniform zonal flow (Courant ≈ 0.4 at the equator, 40 steps ≈ 16 cells), in
// both directions so wrapI's negative and >= nx branches both carry material.
// One cell's deficit starts far above DO_sat so the guard's cap is exercised,
// and reactions are off so the cap is not masked by the exact sag step.
function seamCase(u, ci) {
  const { grid, mask } = syntheticWorld();
  const vel = uniformVelocity(grid, u, 0);
  const init = blob(grid, mask.land, ci, 16, 6, 1);
  init[grid.idx(grid.wrapI(ci), 16) * 4 + 3] = 50;
  return runCase({
    name: `synthetic seam u=${u} km/d from i=${ci}, deficit seed 50, no reactions`,
    grid, mask, vel, init, sources: [], steps: 40, diffusivity: 5e4, reactions: false,
  });
}

function realCase() {
  const grid = OCEAN_GRID;
  const mask = buildLandMask(grid);
  const { vel } = bakeCurrents(grid, mask);
  const sources = ambientSources(grid, mask);
  return runCase({
    name: 'real 512x256, nine preset sources', grid, mask, vel,
    init: new Float32Array(grid.n * 4), sources, steps: 40, diffusivity: undefined,
  });
}

export async function runParity() {
  const cases = [syntheticCase(), seamCase(1000, 61), seamCase(-1000, 2), realCase()];
  return { ok: cases.every((c) => c.ok), cases };
}
