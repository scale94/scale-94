#!/usr/bin/env node
/**
 * watch-kernels.js
 * Watches a directory for new/modified .md files and automatically
 * runs the importer. Useful during active writing sessions.
 *
 * Usage:
 *   node watch-kernels.js              # watches ./content/
 *   node watch-kernels.js ./my-dir/   # watches custom dir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WATCH_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content');

if (!fs.existsSync(WATCH_DIR)) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  console.log(`  Created watch directory: ${WATCH_DIR}`);
}

// Track recently processed files to debounce rapid saves
const recentlyProcessed = new Map();
const DEBOUNCE_MS = 800;

console.log('\n╔══════════════════════════════════════════╗');
console.log('║         KERNEL WATCHER ONLINE            ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`\n  Watching: ${WATCH_DIR}`);
console.log('  Drop .md files here — they will be auto-integrated.\n');
console.log('  Press Ctrl+C to stop.\n');

fs.watch(WATCH_DIR, { persistent: true }, (eventType, filename) => {
  if (!filename || !filename.endsWith('.md')) return;

  const filePath = path.join(WATCH_DIR, filename);
  const now = Date.now();

  // Debounce: skip if processed within the last DEBOUNCE_MS
  const lastProcessed = recentlyProcessed.get(filename) || 0;
  if (now - lastProcessed < DEBOUNCE_MS) return;

  // Wait a tick for the file write to finish
  setTimeout(() => {
    if (!fs.existsSync(filePath)) return; // deleted, not added

    recentlyProcessed.set(filename, Date.now());
    console.log(`\n  [${new Date().toLocaleTimeString()}] Detected: ${filename}`);

    try {
      const result = execSync(
        `node "${path.join(__dirname, 'import-kernel.js')}" "${WATCH_DIR}"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      console.log(result);
    } catch (err) {
      console.error('  ✗ Import failed:');
      console.error(err.stdout || err.message);
    }
  }, 300);
});
