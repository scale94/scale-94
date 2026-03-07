#!/usr/bin/env node
/**
 * _manifest-utils.js — Level 20: Immutable Runtime
 *
 * Shared helpers for CAS manifest management.
 * Each import script (kernel, academic, system) calls updateManifest()
 * to register its output hash. Scripts are fully independent — each
 * reads the current manifest, patches its key, and writes back atomically.
 *
 * Exports:
 *   KERNEL_DIR          — absolute path to public/kernel/
 *   readManifest()      — current manifest object (or {} if absent)
 *   updateManifest(obj) — merge obj into manifest, stamp generated UTC, atomic write
 *   purgeStaleFiles()   — delete old hash-named files for a given prefix
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { atomicWrite } from './_build-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT       = path.join(__dirname, '..');
export const KERNEL_DIR = path.join(ROOT, 'public', 'kernel');

const MANIFEST_PATH = path.join(KERNEL_DIR, 'manifest.json');

export function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { return {}; }
}

/**
 * Merge `updates` into the existing manifest and write atomically.
 * Always stamps `generated` with the current UTC ISO timestamp.
 */
export function updateManifest(updates) {
  if (!fs.existsSync(KERNEL_DIR)) fs.mkdirSync(KERNEL_DIR, { recursive: true });
  const current = readManifest();
  const next    = { ...current, ...updates, generated: new Date().toISOString() };
  atomicWrite(MANIFEST_PATH, JSON.stringify(next, null, 2) + '\n');
}

/**
 * Delete stale CAS data files matching `{prefix}.{8-hex}.{ext}`,
 * except the one we are about to write (keepHash).
 *
 * Example: purgeStaleFiles(KERNEL_DIR, 'articles', 'json', 'a1b2c3d4')
 *   deletes articles.xxxxxxxx.json files whose hash !== 'a1b2c3d4'.
 */
export function purgeStaleFiles(dir, prefix, ext, keepHash) {
  if (!fs.existsSync(dir)) return;
  const re = new RegExp(`^${prefix}\\.[a-f0-9]{8}\\.${ext}$`);
  for (const f of fs.readdirSync(dir)) {
    if (re.test(f) && f !== `${prefix}.${keepHash}.${ext}`) {
      fs.rmSync(path.join(dir, f));
    }
  }
}
