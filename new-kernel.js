#!/usr/bin/env node
/**
 * new-kernel.js
 * Scaffolds a new kernel .md file with frontmatter pre-filled.
 * Drop the output into ./content/ and the watcher picks it up.
 *
 * Usage:
 *   node new-kernel.js "Geopolitical Kinetics" --id GEO-1.0 --status ACTIVE
 *   node new-kernel.js "Empathy Daemon" --type research --tags "Ethics,AI,Care"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse positional title
const titleArg = process.argv[2];
if (!titleArg || titleArg.startsWith('--')) {
  console.error('\n  Usage: node new-kernel.js "Title Here" [--id X] [--status Y] [--type Z] [--tags "a,b"]\n');
  process.exit(1);
}

// Parse flags
function getFlag(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const title    = titleArg.toUpperCase();
const slug     = titleArg.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
const date     = new Date().toISOString().slice(0, 10);
const id       = getFlag('--id',     slug.split('_').map(w => w[0]?.toUpperCase() || '').join('') + '-1.0');
const status   = getFlag('--status', 'ACTIVE');
const type     = getFlag('--type',   'kernel_doc');
const tagsRaw  = getFlag('--tags',   '');
const tags     = tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : [title.split(' ')[0]];
const outDir   = path.join(__dirname, 'content');
const outFile  = path.join(outDir, `${slug}.md`);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const template = `---
id: ${id}
title: ${title}
subtitle:
status: ${status}
type: ${type}
date: ${date}
tags: [${tags.join(', ')}]
---

# ${title}
## scale94 // ${date}

---

> *""*

---

## 0.0 BOOT DECLARATION



---

## 1.0 CENTRAL THESIS



---

## 2.0 SYSTEM ARCHITECTURE



---

## 3.0 GOVERNING AXIOMS

**I. **

**II. **

**III. **

---

## 4.0 OPERATIONAL NOTE



---

\`\`\`
INITIATING: scale94 ${title} v1.0
STATUS:     ${status}
\`\`\`

---

*scale94.com // @scale94.com*
*Kernel authored: ${date}*
`;

if (fs.existsSync(outFile)) {
  console.error(`\n  ✗ File already exists: ${outFile}\n`);
  process.exit(1);
}

fs.writeFileSync(outFile, template, 'utf8');
console.log(`\n  ✓ Created: ${outFile}`);
console.log(`    id:     ${id}`);
console.log(`    status: ${status}`);
console.log(`    type:   ${type}`);
console.log(`\n  The watcher will pick this up automatically if running.\n`);
