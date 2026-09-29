// oceanGpu.js — the Ledger ocean on WebGL2. One step = BFECC (advect,
// correct, final) + diffusion substeps + react/inject, matching
// referenceStep.step() pass for pass. React-free so the parity probe can
// drive it directly. Texture units: 0 = state/src, 1 = static, 2 = rows,
// 3 = fwd/corr/sources.

import { buildProgram } from '../../../gl/glHost';
import {
  probeFloatTargets, createFloatTexture, createFloatTarget, createPingPong,
  disposeTarget, readTarget, uploadFloatTexture,
} from '../../../gl/pingPong';
import { DT_DAYS } from '../grid';
import { TAU_T_DAYS, TAU_N_DAYS } from '../kinetics';
import { EDDY_DIFFUSIVITY_KM2_DAY, diffusionSchedule } from '../referenceStep';
import { SIM_VS, SIM_PROGRAMS, SHARED_UNIFORMS } from './shaders';

const UNIT = { src: 0, static: 1, rows: 2, aux: 3 };
const SAMPLER_UNITS = { uSrc: UNIT.src, uState: UNIT.src, uFwd: UNIT.aux, uCorr: UNIT.aux, uSources: UNIT.aux };

export function createOceanGpu(gl, {
  grid, staticData, rowData, vao,
  diffusivity = EDDY_DIFFUSIVITY_KM2_DAY,
  dtDays = DT_DAYS,
}) {
  if (!probeFloatTargets(gl)) return null;
  const { nx, ny, n } = grid;

  const staticTex = createFloatTexture(gl, nx, ny, staticData);
  const rowsTex = createFloatTexture(gl, ny, 2, rowData);
  const sourcesTex = createFloatTexture(gl, nx, ny, new Float32Array(n * 4));
  const state = createPingPong(gl, nx, ny, new Float32Array(n * 4));
  const fwd = createFloatTarget(gl, nx, ny);
  const corr = createFloatTarget(gl, nx, ny);
  const textures = [staticTex, rowsTex, sourcesTex];
  const P = {};
  // One release path for construction failure and for dispose(): programs,
  // ping-pong, scratch targets, then the plain textures.
  const release = () => {
    for (const { prog } of Object.values(P)) gl.deleteProgram(prog);
    state?.dispose();
    disposeTarget(gl, fwd);
    disposeTarget(gl, corr);
    for (const t of textures) gl.deleteTexture(t);
  };
  if (!state || !fwd || !corr) {
    release();
    return null;
  }

  try {
    for (const [name, def] of Object.entries(SIM_PROGRAMS)) {
      const prog = buildProgram(gl, SIM_VS, def.fs, { label: `ocean:${name}` });
      const U = {};
      for (const u of [...SHARED_UNIFORMS, ...def.uniforms]) U[u] = gl.getUniformLocation(prog, u);
      gl.useProgram(prog);
      gl.uniform1i(U.uStatic, UNIT.static);
      gl.uniform1i(U.uRows, UNIT.rows);
      gl.uniform2f(U.uGrid, nx, ny);
      gl.uniform1f(U.uCellKm, grid.cellKm);
      for (const u of def.uniforms) if (u in SAMPLER_UNITS) gl.uniform1i(U[u], SAMPLER_UNITS[u]);
      P[name] = { prog, U };
    }
  } catch (err) {
    // A program that fails mid-loop must not strand the 7 textures, 4
    // framebuffers and the programs already built. buildProgram has already
    // deleted the failed program itself.
    release();
    throw err;
  }
  gl.useProgram(P.react.prog);
  gl.uniform1f(P.react.U.uTauT, TAU_T_DAYS);
  gl.uniform1f(P.react.U.uTauN, TAU_N_DAYS);

  const sched = diffusionSchedule(grid, dtDays, diffusivity);

  const bind = (unit, tex) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  };
  const draw = (target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    step({ reactions = true } = {}) {
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, nx, ny);
      bind(UNIT.static, staticTex);
      bind(UNIT.rows, rowsTex);

      gl.useProgram(P.advect.prog);
      gl.uniform1f(P.advect.U.uDt, dtDays);
      bind(UNIT.aux, sourcesTex);
      bind(UNIT.src, state.read.tex);
      draw(fwd);

      gl.useProgram(P.correct.prog);
      gl.uniform1f(P.correct.U.uDt, dtDays);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, fwd.tex);
      draw(corr);

      gl.useProgram(P.final.prog);
      gl.uniform1f(P.final.U.uDt, dtDays);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, corr.tex);
      draw(state.write);
      state.swap();

      if (sched.sub > 0) {
        gl.useProgram(P.diffuse.prog);
        gl.uniform1f(P.diffuse.U.uD, diffusivity);
        gl.uniform1f(P.diffuse.U.uH, sched.h);
        bind(UNIT.aux, sourcesTex);
        for (let s = 0; s < sched.sub; s++) {
          bind(UNIT.src, state.read.tex);
          draw(state.write);
          state.swap();
        }
      }

      gl.useProgram(P.react.prog);
      gl.uniform1f(P.react.U.uDt, dtDays);
      gl.uniform1f(P.react.U.uReact, reactions ? 1 : 0);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, sourcesTex);
      draw(state.write);
      state.swap();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    setState(data) {
      uploadFloatTexture(gl, state.read.tex, nx, ny, data);
    },
    setSources(data) {
      uploadFloatTexture(gl, sourcesTex, nx, ny, data);
    },
    readState() {
      return readTarget(gl, state.read);
    },
    stateTexture() {
      return state.read.tex;
    },
    staticTexture() {
      return staticTex;
    },
    dispose() {
      release();
    },
  };
}
