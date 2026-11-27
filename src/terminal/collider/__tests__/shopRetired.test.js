// shopRetired.test.js — structural pin: the perfume shop is gone from the
// client. Reads source text with fs; no rendering.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const VIEW = 'src/terminal/views/LatentCollider.jsx';
const MANIFEST = 'src/terminal/collider/manifest.js';

const FORBIDDEN_IN_VIEW = [
  'fetch(', '/api/transmute', 'sealForVault', 'TESSERACT_PUB_KEY_B64', 'TIERS',
  'PRODUCTION_THRESHOLD', 'handleAcquire', 'RedeemInput', 'ContactForm',
  'FulfillmentBadge', 'ck_ids', 'living:', 'scale0097', 'onRegister',
  'kernelRunHistoryRef',
];

const DELETED_FILES = [
  'src/terminal/lib/vaultSeal.js',
  'src/terminal/hooks/useOrderStatus.js',
  'src/terminal/hooks/useProductionThreshold.js',
];

describe('shop retired from the client', () => {
  it('LatentCollider.jsx carries no shop code', () => {
    const src = read(VIEW);
    const hits = FORBIDDEN_IN_VIEW.filter((s) => src.includes(s));
    expect(hits).toEqual([]);
  });

  it('shop modules are deleted', () => {
    const present = DELETED_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)));
    expect(present).toEqual([]);
  });

  it('manifest.js has no living signature', () => {
    const src = read(MANIFEST);
    expect(['LIVING SIGNATURE', 'HS256'].filter((s) => src.includes(s))).toEqual([]);
  });

  it('the manifest download survives', () => {
    const src = read(VIEW);
    expect(src).toContain('generateManifestMarkdown(');
    expect(src).toContain('text/markdown');
  });
});
