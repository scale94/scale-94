#!/usr/bin/env node
// dedup-builds.js — purge duplicate entries from the kernelBuilds.js inject zone.
//
// Context: a pre-dedup run of import-kernel.js injected entries for kernels that
// already existed in the hand-curated section (lines before @@INJECT_START@@).
// The current parseExistingArticleIds() logic prevents NEW duplicates, but the
// existing 90 duplicates need a one-time surgical removal.
//
// Strategy:
//   1. Collect all articleIds from the hand-curated section (before @@INJECT_START@@).
//   2. Parse inject-zone entries (between @@INJECT_START@@ and @@INJECT_END@@).
//   3. Keep only inject-zone entries whose articleId is NOT in hand-curated.
//   4. Rewrite the inject zone with the deduplicated set.

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const buildsPath = path.join(__dirname, '..', 'src/terminal/data/kernelBuilds.js');

const INJECT_START = '/* @@INJECT_START@@ */';
const INJECT_END   = '/* @@INJECT_END@@ */';

const src      = fs.readFileSync(buildsPath, 'utf8');
const startIdx = src.indexOf(INJECT_START);
const endIdx   = src.indexOf(INJECT_END);

if (startIdx === -1 || endIdx === -1) {
  console.error('Inject markers not found.');
  process.exit(1);
}

// ── Hand-curated articleIds (everything before @@INJECT_START@@) ──────────────
const handCuratedSection = src.slice(0, startIdx);
const handCuratedIds = new Set(
  [...handCuratedSection.matchAll(/articleId:\s*['"`]([^'"`\n]+)['"`]/g)].map(m => m[1])
);

// ── Inject-zone raw text → individual entry objects ───────────────────────────
const zoneRaw = src.slice(startIdx + INJECT_START.length, endIdx);

// Split on entry boundaries. Each entry is a JS object on one line like:
//   { id: "...", articleId: "...", name: "...", status: "...", desc: "..." },
// or across multiple lines (shouldn't happen with our generator, but handle it).
const entryMatches = [...zoneRaw.matchAll(/\{[^}]+\}/g)];

let kept    = 0;
let removed = 0;
const keptEntries = [];

for (const m of entryMatches) {
  const entry = m[0];
  const idMatch = entry.match(/articleId:\s*["'`]([^"'`\n]+)["'`]/);
  if (!idMatch) continue;
  const articleId = idMatch[1];

  if (handCuratedIds.has(articleId)) {
    removed++;
    console.log(`  Removed duplicate: ${articleId}`);
  } else {
    keptEntries.push(entry);
    kept++;
    console.log(`  Kept (net-new):    ${articleId}`);
  }
}

// ── Rewrite the inject zone ───────────────────────────────────────────────────
const newZone = keptEntries.length > 0
  ? '\n' + keptEntries.map(e => e.replace(/^\s*/, '  ')).join(',\n') + ',\n'
  : '\n';

const newSrc =
  src.slice(0, startIdx + INJECT_START.length) +
  newZone +
  src.slice(endIdx);

fs.writeFileSync(buildsPath, newSrc, 'utf8');

console.log(`\n  Done. Removed ${removed} duplicate(s), kept ${kept} net-new inject entry(s).`);
