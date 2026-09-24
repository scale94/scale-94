// Prints the beam mass of each of the 16 grid domains, computed exactly as
// LatentCollider does (spec §5.1), lightest first. Used to pick the heavy x
// heavy and volatile x volatile eye-check pairs.
//
//   node scripts/_scentMass.mjs
import { readFileSync } from 'node:fs';
import { FEATURES, NODE_IDX } from '../src/terminal/data/nodeFeatures.js';
import { buildDomainMass } from '../src/terminal/collider/domainMass.js';

const src = readFileSync(new URL('../src/terminal/views/LatentCollider.jsx', import.meta.url), 'utf8');
const block = (start) => src.slice(src.indexOf(start), src.indexOf('];', src.indexOf(start)));
const nodeIds = [...block('const DOMAIN_SPHERE_MAP').matchAll(/nodeId: '([^']+)'/g)].map((m) => m[1]);
const domains = [...block('const DOMAINS = [').matchAll(/id: (\d+),\s+name: '([^']+)'/g)]
  .map((m) => ({ id: Number(m[1]), name: m[2] }));
const mass = buildDomainMass(nodeIds, NODE_IDX, FEATURES);
for (const d of domains.sort((a, b) => mass[a.id] - mass[b.id])) {
  console.log(mass[d.id].toFixed(3), d.name);
}
