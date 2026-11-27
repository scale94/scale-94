// honesty.test.js — structural pins, read from source text with fs (no
// rendering):
//   1. the perfume shop is gone from the client;
//   2. nothing that reads like a lab measurement survives unless it is
//      calculated from cited data (spec decision 13). The fake vault payload
//      (encrypted formula, CAS registry, SG / flash point / maceration) and the
//      fake precision copy are cut from the card model, the manifest and the
//      /SCENT view.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const VIEW = 'src/terminal/views/LatentCollider.jsx';
const MANIFEST = 'src/terminal/collider/manifest.js';
const CARD = 'src/terminal/collider/perfumeCard.js';

// Strings that read like a lab measurement, a cryptographic claim or fake
// precision. None may appear in the card model, the manifest or the view.
const DISHONEST = [
  '10⁻⁷⁷', 'RSA-OAEP', 'INTEGRITY BOUND',
  'FLASH POINT', 'MACERATION', 'EVAP CURVE', 'LONGEVITY',
  'specificGravity', 'CAS_REGISTRY', 'buildEncryptedFormula', 'publicProfile',
  '1536-dimensional', '1536-D',
  'physical synthesis', 'SOMA SHOP', 'ShimmeringCipher',
];

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
    // 'TIERS' pins the shop's tier table; the Task 5 copy 'VOLATILITY TIERS'
    // (the evaporation block's honest header) is the one allowed use.
    const src = read(VIEW).replaceAll('VOLATILITY TIERS', '');
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

  it('the shop server side is deleted', () => {
    const present = ['api/transmute', 'api/discord/interactions.js', 'api/_alien/composeVerdict.js', 'bot']
      .filter((f) => fs.existsSync(path.join(ROOT, f)));
    expect(present).toEqual([]);
  });

  it('.env.example carries no shop variables', () => {
    const src = read('.env.example');
    expect(['DISCORD_', 'KV_REST_API', 'RATE_LIMIT_SALT', 'SOVEREIGN'].filter((s) => src.includes(s))).toEqual([]);
  });
});

describe('honesty sweep: no fake lab measurement', () => {
  it('manifest.js carries none of the dishonest strings', () => {
    const src = read(MANIFEST);
    expect(DISHONEST.filter((s) => src.includes(s))).toEqual([]);
  });

  it('perfumeCard.js carries none of the dishonest strings', () => {
    const src = read(CARD);
    expect(DISHONEST.filter((s) => src.includes(s))).toEqual([]);
  });

  it('LatentCollider.jsx carries none of the dishonest strings', () => {
    const src = read(VIEW);
    expect(DISHONEST.filter((s) => src.includes(s))).toEqual([]);
  });

  it('LatentCollider.jsx names volatility tiers and the JS-path space', () => {
    const src = read(VIEW);
    expect(src).toContain('VOLATILITY TIERS');
    expect(src).toContain("'32-D feature tensor'");
  });

  it('the card model no longer builds a vault payload', async () => {
    const card = await import('../perfumeCard.js');
    expect(['CAS_REGISTRY', 'buildEncryptedFormula'].filter((k) => k in card)).toEqual([]);
  });
});

describe('P0 carry-over: dead code removed', () => {
  it('App.jsx and useCommandDispatch.js carry no kernelRunHistoryRef', () => {
    const hits = ['src/terminal/App.jsx', 'src/terminal/hooks/useCommandDispatch.js']
      .filter((f) => read(f).includes('kernelRunHistoryRef'));
    expect(hits).toEqual([]);
  });

  it('package.json no longer depends on @upstash/redis', () => {
    expect(read('package.json')).not.toContain('@upstash/redis');
  });
});
