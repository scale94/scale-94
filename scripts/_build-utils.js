#!/usr/bin/env node
/**
 * _build-utils.js — Level 17: Hardened State
 *
 * Shared build utilities for import-kernel.js and import-system.js.
 *   atomicWrite  — write to .tmp then fs.renameSync (crash-safe)
 *   fileHash     — SHA-1 hex digest of a string
 *   loadCache    — read .import-cache.json → object (or {} if absent/invalid)
 *   saveCache    — atomicWrite .import-cache.json
 *   CACHE_PATH   — absolute path to the cache file
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_PATH = path.join(__dirname, '..', '.import-cache.json');

/**
 * Write `content` to `destPath` atomically:
 * write → .tmp, then rename → destPath.
 * Cleans up .tmp on failure.
 */
export function atomicWrite(destPath, content) {
  const tmp = destPath + '.tmp';
  try {
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, destPath);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * SHA-1 hex digest of a UTF-8 string.
 * Stable fingerprint for import cache invalidation.
 */
export function fileHash(content) {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

/**
 * SHA-256 hex digest, first `len` characters.
 * Used to generate CAS filenames: articles.{sha256Prefix}.json
 * Default len=8 gives 2^32 collision resistance — sufficient for a build corpus.
 */
export function sha256Prefix(content, len = 8) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex').slice(0, len);
}

/**
 * Load the import cache from disk.
 * Returns {} if the file doesn't exist or is malformed JSON.
 */
export function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}

/**
 * Persist the import cache atomically.
 */
export function saveCache(cache) {
  atomicWrite(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}
