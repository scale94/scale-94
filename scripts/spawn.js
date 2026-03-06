/**
 * scripts/spawn.js — SOMA Kernel File Generator
 *
 * Usage:
 *   npm run spawn -- "My Kernel Title"
 *   npm run spawn -- "My Kernel Title" fiction
 *   npm run spawn -- "My Kernel Title" research
 *
 * Applies the DASH-UPPERCASE Handshake Rule to the filename.
 * Writes a pre-filled YAML frontmatter template to content/soma_kernel/.
 * Refuses to overwrite an existing file.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'content', 'soma_kernel');

// ─── DASH-UPPERCASE Handshake Rule ────────────────────────────────────────────
const toId = (s) =>
  s
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()[\]]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// ─── Args ─────────────────────────────────────────────────────────────────────
const [, , rawTitle, rawType = 'kernel'] = process.argv;

const VALID_TYPES = ['kernel', 'fiction', 'research', 'transmission'];

if (!rawTitle) {
  console.error('\nUsage: npm run spawn -- "My Kernel Title" [type]');
  console.error(`Types:  ${VALID_TYPES.join(' | ')}  (default: kernel)\n`);
  process.exit(1);
}

if (!VALID_TYPES.includes(rawType)) {
  console.error(`\nUnknown type "${rawType}". Valid types: ${VALID_TYPES.join(', ')}\n`);
  process.exit(1);
}

// ─── Build paths ──────────────────────────────────────────────────────────────
const id       = toId(rawTitle);
const filename = `${id}.md`;
const outPath  = join(CONTENT_DIR, filename);
const today    = new Date().toISOString().slice(0, 10);

// ─── Collision guard ──────────────────────────────────────────────────────────
if (existsSync(outPath)) {
  console.error(`\n✗ File already exists: content/soma_kernel/${filename}`);
  console.error('  Edit it directly or choose a different title.\n');
  process.exit(1);
}

// ─── Frontmatter template ─────────────────────────────────────────────────────
const statusDefaults = {
  kernel:       'ACTIVE',
  fiction:      'TRANSMISSION',
  research:     'DRAFT',
  transmission: 'TRANSMISSION',
};

const template = `---
id: ${id}
type: ${rawType}
date: ${today}
title: ${rawTitle}
subtitle:
status: ${statusDefaults[rawType]}
readTime:
tags: []
---

# ${rawTitle.toUpperCase()}

`;

// ─── Write ────────────────────────────────────────────────────────────────────
mkdirSync(CONTENT_DIR, { recursive: true });
writeFileSync(outPath, template, { encoding: 'utf8' });

console.log(`\n✓ Spawned: content/soma_kernel/${filename}`);
console.log(`  ID:     ${id}`);
console.log(`  Type:   ${rawType}`);
console.log(`  Status: ${statusDefaults[rawType]}\n`);
