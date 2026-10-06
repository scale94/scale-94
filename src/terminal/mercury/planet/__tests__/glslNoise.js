// JS ports of the flows' GLSL noise, for geometry replicas in tests (not a test file itself).
// snoise = the Gustavson 3D simplex both ParticleFlow and AtmosphericFlow declare (mod 289 permute).
// curlFluid = ParticleFlow's curlNoise (e 0.1, × 0.5); curlAir = AtmosphericFlow's curlNoise (e 0.07, / 2e).

const fl = Math.floor;
const m289 = (x) => x - 289 * fl(x / 289);
const perm4 = (v) => v.map((x) => m289((x * 34 + 1) * x));
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function snoise(v) {
  const C0 = 1 / 6, C1 = 1 / 3;
  const s = (v[0] + v[1] + v[2]) * C1;
  let i = v.map((x) => fl(x + s));
  const t = (i[0] + i[1] + i[2]) * C0;
  const x0 = v.map((x, k) => x - i[k] + t);
  const g = [x0[1] <= x0[0] ? 1 : 0, x0[2] <= x0[1] ? 1 : 0, x0[0] <= x0[2] ? 1 : 0]; // step(x0.yzx, x0.xyz)
  const l = g.map((x) => 1 - x);
  const lz = [l[2], l[0], l[1]]; // l.zxy
  const i1 = g.map((x, k) => Math.min(x, lz[k]));
  const i2 = g.map((x, k) => Math.max(x, lz[k]));
  const x1 = x0.map((x, k) => x - i1[k] + C0);
  const x2 = x0.map((x, k) => x - i2[k] + C1);
  const x3 = x0.map((x) => x - 0.5);
  i = i.map(m289);
  let p = perm4([0, i1[2], i2[2], 1].map((x) => i[2] + x));
  p = perm4(p.map((x, k) => x + i[1] + [0, i1[1], i2[1], 1][k]));
  p = perm4(p.map((x, k) => x + i[0] + [0, i1[0], i2[0], 1][k]));
  const n_ = 1 / 7;
  const ns = [2 * n_, 0.5 * n_ - 1, n_]; // n_ * D.wyz - D.xzx, D = (0, 0.5, 1, 2)
  const j = p.map((x) => x - 49 * fl(x * ns[2] * ns[2]));
  const xq = j.map((x) => fl(x * ns[2]));
  const yq = j.map((x, k) => fl(x - 7 * xq[k]));
  const X = xq.map((x) => x * ns[0] + ns[1]);
  const Y = yq.map((y) => y * ns[0] + ns[1]);
  const h = X.map((x, k) => 1 - Math.abs(x) - Math.abs(Y[k]));
  const b0 = [X[0], X[1], Y[0], Y[1]], b1 = [X[2], X[3], Y[2], Y[3]];
  const s0 = b0.map((x) => fl(x) * 2 + 1), s1 = b1.map((x) => fl(x) * 2 + 1);
  const sh = h.map((x) => (x <= 0 ? -1 : 0));
  const a0 = [b0[0] + s0[0] * sh[0], b0[2] + s0[2] * sh[0], b0[1] + s0[1] * sh[1], b0[3] + s0[3] * sh[1]];
  const a1 = [b1[0] + s1[0] * sh[2], b1[2] + s1[2] * sh[2], b1[1] + s1[1] * sh[3], b1[3] + s1[3] * sh[3]];
  const P = [[a0[0], a0[1], h[0]], [a0[2], a0[3], h[1]], [a1[0], a1[1], h[2]], [a1[2], a1[3], h[3]]];
  const xs = [x0, x1, x2, x3];
  let r = 0;
  for (let k = 0; k < 4; k++) {
    const nrm = 1.79284291400159 - 0.85373472095314 * dot3(P[k], P[k]);
    const m = Math.max(0.6 - dot3(xs[k], xs[k]), 0);
    r += m * m * m * m * nrm * dot3(P[k], xs[k]);
  }
  return 42 * r;
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function curlFluid(p) {
  const e = 0.1;
  const n1 = snoise(add(p, [e, 0, 0])), n2 = snoise(add(p, [-e, 0, 0]));
  const n3 = snoise(add(p, [0, e, 0])), n4 = snoise(add(p, [0, -e, 0]));
  const n5 = snoise(add(p, [0, 0, e])), n6 = snoise(add(p, [0, 0, -e]));
  return [(n4 - n3) - (n6 - n5), (n6 - n5) - (n2 - n1), (n2 - n1) - (n4 - n3)].map((x) => x * 0.5);
}

export function curlAir(p) {
  const e = 0.07;
  const nx1 = snoise(add(p, [e, 0, 0])), nx2 = snoise(add(p, [-e, 0, 0]));
  const ny1 = snoise(add(p, [0, e, 0])), ny2 = snoise(add(p, [0, -e, 0]));
  const nz1 = snoise(add(p, [0, 0, e])), nz2 = snoise(add(p, [0, 0, -e]));
  return [(ny1 - ny2) - (nz1 - nz2), (nz1 - nz2) - (nx1 - nx2), (nx1 - nx2) - (ny1 - ny2)].map((x) => x / (2 * e));
}
