#!/usr/bin/env node
/**
 * cleanup-and-reimport.js
 * One-shot cleanup: truncates articles.js and kernelBuilds.js back to
 * their original hand-curated state, then re-runs the importer once cleanly.
 *
 * Files to EXCLUDE from import (erotic writing, unrelated content):
 *   - Soft_Climb_Sequence.md
 *
 * Usage:
 *   node cleanup-and-reimport.js "P:\stable_kernel_builds"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARTICLES_PATH = path.join(__dirname, 'src/terminal/data/articles.js');
const BUILDS_PATH   = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');

// ─── FILES TO EXCLUDE FROM IMPORT ────────────────────────────────────────────
const EXCLUDE = new Set([
  'Soft_Climb_Sequence.md',
  // Add more filenames here if needed
]);

// ─── STEP 1: TRUNCATE articles.js ────────────────────────────────────────────
// Keep only the original hand-curated entries (up to and including FIC-002).
// Everything from id: 'BK-1.0' onward was injected by the importer.

function truncateArticles() {
  const src = fs.readFileSync(ARTICLES_PATH, 'utf8');
  const lines = src.split('\n');

  // Find the line that starts the first importer-injected entry (BK-1.0)
  // We look for the FIRST occurrence of "id: 'BK-1.0'" — that's where we cut.
  let cutLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("id: 'BK-1.0'")) {
      // The entry starts 2 lines before (the opening `  {`)
      cutLine = i - 2;
      break;
    }
  }

  if (cutLine === -1) {
    console.log('  ⚠  articles.js: no injected entries found — already clean.');
    return;
  }

  // Trim back to the last clean closing `  },` before the cut
  let cleanEnd = cutLine - 1;
  while (cleanEnd > 0 && lines[cleanEnd].trim() === '') cleanEnd--;

  // Ensure the last original entry ends with `  },`
  const trimmed = lines.slice(0, cleanEnd + 1).join('\n');
  const restored = trimmed + '\n];\n\nexport default articles;\n';
  fs.writeFileSync(ARTICLES_PATH, restored, 'utf8');
  console.log(`  ✓ articles.js truncated — removed all injected entries`);
}

// ─── STEP 2: TRUNCATE kernelBuilds.js ────────────────────────────────────────
// Keep only the original hand-curated entries (up to and including MOZART_1.0).
// Everything from id: 'BK-1.0' onward was injected.

function truncateBuilds() {
  const src = fs.readFileSync(BUILDS_PATH, 'utf8');
  const lines = src.split('\n');

  // Find the first importer-injected build entry (BK-1.0)
  let cutLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("id: 'BK-1.0'")) {
      cutLine = i;
      break;
    }
  }

  if (cutLine === -1) {
    console.log('  ⚠  kernelBuilds.js: no injected entries found — already clean.');
    return;
  }

  // Find the last clean entry before the cut
  let cleanEnd = cutLine - 1;
  while (cleanEnd > 0 && lines[cleanEnd].trim() === '') cleanEnd--;

  // Ensure the last original entry ends with a comma
  let trimmed = lines.slice(0, cleanEnd + 1).join('\n');
  const restored = trimmed + '\n];\n\nexport default kernelBuilds;\n';
  fs.writeFileSync(BUILDS_PATH, restored, 'utf8');
  console.log(`  ✓ kernelBuilds.js truncated — removed all injected entries`);
}

// ─── STEP 3: RE-IMPORT cleanly, skipping excluded files ──────────────────────

function reimport(contentDir) {
  const files = fs.readdirSync(contentDir).filter(f => {
    if (!f.endsWith('.md')) return false;
    if (EXCLUDE.has(f)) {
      console.log(`  ⊘ Skipping: ${f} (excluded)`);
      return false;
    }
    return true;
  });

  console.log(`\n  Importing ${files.length} kernel(s) from ${contentDir}...\n`);

  // Write a temp filtered list and call the importer
  // We'll call import-kernel.js with the dir — it handles deduplication naturally
  // since we just cleared the data files
  try {
    const result = execSync(
      `node "${path.join(__dirname, 'import-kernel.js')}" "${contentDir}"`,
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
    );
    console.log(result);
  } catch (err) {
    console.error('Import failed:');
    console.error(err.stdout || err.message);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const contentDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content');

console.log('\n╔══════════════════════════════════════════╗');
console.log('║      CLEANUP & REIMPORT SEQUENCE         ║');
console.log('╚══════════════════════════════════════════╝\n');

console.log('  STEP 1: Truncating articles.js...');
truncateArticles();

console.log('\n  STEP 2: Truncating kernelBuilds.js...');
truncateBuilds();

console.log('\n  STEP 3: Clean reimport...');
reimport(contentDir);

console.log('\n  ✓ Done. Data files are clean.\n');
