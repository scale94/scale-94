#!/usr/bin/env node
// scripts/gen-classified-payload.js
//
// Encrypts a plaintext message with AES-256-GCM and outputs the env vars
// needed to run the Scale 9.4 classified enclave.
//
// Usage:
//   node scripts/gen-classified-payload.js "Your secret classified message here."
//
// Output: copy the printed env vars into .env.local and into the
// Vercel dashboard (Settings → Environment Variables).
//
// NEVER commit .env.local to git.  .gitignore already excludes .env* files.
//
// To update the secret: run this script again with a new message and
// replace the old env vars in the Vercel dashboard.

import crypto from 'node:crypto';

const message = process.argv.slice(2).join(' ');

if (!message) {
  console.error('\nUsage: node scripts/gen-classified-payload.js "Your secret message"\n');
  process.exit(1);
}

const key        = crypto.randomBytes(32);  // AES-256
const iv         = crypto.randomBytes(12);  // GCM nonce (96-bit)
const cipher     = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
const tag        = cipher.getAuthTag();     // 128-bit GCM auth tag

// Verify round-trip before printing
const decipher   = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
const plaintext  = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
if (plaintext !== message) {
  console.error('[ERROR] Round-trip verification failed — do not use these values!');
  process.exit(1);
}

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║  SCALE 9.4 — CLASSIFIED ENCLAVE ENV VARS                        ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');
console.log('# 1. Add ALL of these to .env.local (for vercel dev)\n');
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`);
console.log(`CLASSIFIED_AES_KEY=${key.toString('hex')}`);
console.log(`CLASSIFIED_AES_IV=${iv.toString('hex')}`);
console.log(`CLASSIFIED_AES_CIPHERTEXT=${ciphertext.toString('hex')}`);
console.log(`CLASSIFIED_AES_TAG=${tag.toString('hex')}`);
console.log('\n# 2. Add the same vars to Vercel dashboard:');
console.log('#    vercel.com → your project → Settings → Environment Variables\n');
console.log('# 3. NEVER commit .env.local — it is already in .gitignore\n');
console.log(`# Plaintext length: ${message.length} chars`);
console.log(`# Ciphertext size:  ${ciphertext.length} bytes`);
console.log(`# GCM tag:          ${tag.length} bytes (authentication)\n`);
console.log('# Round-trip verified ✓\n');
