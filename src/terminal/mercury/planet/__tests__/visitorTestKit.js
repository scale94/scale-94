// Shared by the visitor tests: a ctx at a node, and a fixed-step run that collects touchdowns.
import { createVisitorCtx, stepVisitors } from '../visitorSim';
import { ORBIT_NODES, nodeWorldPosition } from '../../orbitNodes';

export function ctxFor(phase, tempK = 400) {
  const ctx = createVisitorCtx();
  ctx.cam = [0, 0, 3.6]; ctx.tau = 1; ctx.dt = 1 / 60; ctx.tempOverrideK = tempK;
  const node = ORBIT_NODES.find((n) => n.phase === phase);
  const p = nodeWorldPosition(node.angle, 0);
  ctx.nodePos = [p[0], p[1], p[2]];
  return ctx;
}

export function runTo(buf, ctx, out, untilS) {
  const events = [];
  while (ctx.tS < untilS - 1e-9) {
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, out);
    for (let i = 0; i < out.nImpacts; i++) {
      const e = out.impacts[i];
      events.push({ ...e, dirBody: [...e.dirBody], dirWorld: [...e.dirWorld], at: ctx.tS });
    }
  }
  return events;
}
