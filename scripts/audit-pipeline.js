#!/usr/bin/env node
// audit-pipeline.js — Level 13 registry audit
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// The runtime kernel index — whatever public/kernel/manifest.json points at.
const kernelDir  = path.join(root, 'public/kernel');
const manifest   = JSON.parse(fs.readFileSync(path.join(kernelDir, 'manifest.json'), 'utf8'));
const indexFile  = manifest.kernels;
const articles   = JSON.parse(fs.readFileSync(path.join(kernelDir, indexFile), 'utf8'));
const buildsSrc  = fs.readFileSync(path.join(root, 'src/terminal/data/kernelBuilds.js'), 'utf8');

const genIds = articles.map(a => a.id);

// articleIds in kernelBuilds.js (covers both hand-curated and inject zone)
const buildArticleIds = new Set(
  [...buildsSrc.matchAll(/articleId:\s*["'`]([^"'`\n]+)["'`]/g)].map(m => m[1])
);

const orphaned  = genIds.filter(id => !buildArticleIds.has(id));
const _covered  = genIds.filter(id =>  buildArticleIds.has(id));

// Type audit
const countType      = t => articles.filter(a => a.type === t).length;
const kernelDocCount = countType('kernel_doc');
const kernelCount    = countType('kernel');
const fictionCount   = countType('fiction');

// Duplicate articleId detection in kernelBuilds
const allBuildIds = [...buildsSrc.matchAll(/articleId:\s*["'`]([^"'`\n]+)["'`]/g)].map(m => m[1]);
const seen = new Map();
for (const id of allBuildIds) seen.set(id, (seen.get(id) || 0) + 1);
const duplicates = [...seen.entries()].filter(([, c]) => c > 1);

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   PIPELINE AUDIT — LEVEL 13              ║');
console.log('╚══════════════════════════════════════════╝\n');

console.log(`  ${indexFile.padEnd(22)} : ${genIds.length} entries`);
console.log(`  ${"kernelBuilds.js".padEnd(22)} : ${buildArticleIds.size} unique articleIds\n`);

console.log(`  Type distribution (in generated index):`);
console.log(`    kernel_doc : ${kernelDocCount}`);
console.log(`    kernel     : ${kernelCount}   ← TIER-2 BLIND SPOT (filter checks kernel_doc only)`);
console.log(`    fiction    : ${fictionCount}\n`);

if (orphaned.length === 0) {
  console.log(`  ✓ Zero orphans — every generated article has a kernelBuilds entry.`);
} else {
  console.log(`  ✗ ${orphaned.length} orphaned article(s) — in generated index but NOT in kernelBuilds:`);
  for (const id of orphaned) console.log(`    - ${id}`);
}

if (duplicates.length === 0) {
  console.log(`  ✓ Zero duplicate articleIds in kernelBuilds.js.`);
} else {
  console.log(`\n  ⚠ ${duplicates.length} duplicate articleId(s) in kernelBuilds.js (hand-curated + inject zone overlap):`);
  for (const [id, count] of duplicates) console.log(`    - ${id} (×${count})`);
}

console.log('');
