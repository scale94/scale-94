// @vitest-environment node
// /api/transmute/order is called by anonymous browsers, so it has no caller
// authentication: these tests pin the server-side checks that protect it.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { sealForVault } from '../src/terminal/lib/vaultSeal.js';

const store = new Map();
const ttls = new Map();
vi.mock('@vercel/kv', () => ({
  kv: {
    get:    async k => store.get(k) ?? null,
    set:    async (k, v) => { store.set(k, v); },
    setnx:  async (k, v) => { if (!store.has(k)) store.set(k, v); },
    hset:   async (k, v) => { store.set(k, { ...(store.get(k) ?? {}), ...v }); },
    sadd:   async (k, v) => { store.set(k, [...(store.get(k) ?? []), v]); },
    incr:   async k => { const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n; },
    expire: async (k, s) => { ttls.set(k, s); },
  },
}));

// Secret set on purpose: a browser cannot sign, so an unsigned order must still pass.
process.env.TRANSMUTE_WEBHOOK_SECRET = 'stale-server-secret';
const { default: handler } = await import('../api/transmute/order.js');

const hashOf = n => n.toString(16).padStart(64, '0');

const order = (over = {}) => ({
  formulaId:        'floral-oud-1',
  formulaHash:      hashOf(1),
  encryptedPayload: 'x'.repeat(900) + '…',
  sovereignRatio:   100,
  g2tAmount:        10,
  tierSize:         '50ml',
  tierLabel:        '50 ml · SOVEREIGN',
  cardName:         'OCEANIC OUD',
  domainPair:       'FLORAL × OUD',
  noteBlock:        'TOP bergamot\nHEART jasmine\nBASE vetiver',
  physBlock:        'CONCENTRATION EDP',
  vaultBlock:       'SHA-256 …',
  contact:          { signal: '', email: '' },
  kernelHistory:    [{ id: 'FEIGENBAUM-CASCADE', alias: 'feig', t: 1 }],
  ...over,
});

async function post(body, { ip = '203.0.113.7' } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]);
  req.method = 'POST';
  req.headers = { 'x-forwarded-for': ip };
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  await handler(req, res);
  return res;
}

const savedOrder = res => store.get(`order:${res.body.orderId}`);

beforeEach(() => { store.clear(); ttls.clear(); });

describe('/api/transmute/order', () => {
  it('accepts an unsigned order of the shape the browser sends', async () => {
    const res = await post(order());
    expect(res.statusCode).toBe(201);
    expect(savedOrder(res).cardName).toBe('OCEANIC OUD');
  });

  it.each([
    ['50ml', 100, 10,  '50 ml · SOVEREIGN'],
    ['10ml', 25,  2.5, '10 ml · DISCOVERY'],
  ])('prices %s on the server, ignoring the client figures', async (tierSize, price, g2t, label) => {
    const res = await post(order({ tierSize, sovereignRatio: 1, g2tAmount: 9999, tierLabel: 'FREE' }));
    expect(savedOrder(res)).toMatchObject({ sovereignRatio: price, g2tAmount: g2t, tierLabel: label });
  });

  it.each([
    ['an unknown tier',               order({ tierSize: '500ml' })],
    ['a prototype key as the tier',   order({ tierSize: 'toString' })],
    ['a missing hash',                order({ formulaHash: undefined })],
    ['a non-SHA-256 hash',            order({ formulaHash: '—' })],
    ['a non-string text field',       order({ cardName: { a: 1 } })],
    ['an over-long Discord block',    order({ noteBlock: 'n'.repeat(1001) })],
    ['an over-long sealed payload',   order({ encryptedPayload: 'x'.repeat(8193) })],
    ['an over-long contact value',    order({ contact: { email: 'e'.repeat(255) } })],
    ['a non-array kernel history',    order({ kernelHistory: 'FEIGENBAUM-CASCADE' })],
    ['a too-long kernel history',     order({ kernelHistory: Array(31).fill({ id: 'a' }) })],
    ['a history entry without an id', order({ kernelHistory: [null] })],
    ['a JSON array',                  []],
    ['JSON null',                     'null'],
    ['malformed JSON',                '{nope'],
  ])('rejects %s with 400 and stores nothing', async (_name, body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(store.size).toBe(0);
  });

  it('rejects an oversized body with 413', async () => {
    const res = await post(order({ padding: 'p'.repeat(20_000) }));
    expect(res.statusCode).toBe(413);
    expect(store.size).toBe(0);
  });

  it('strips backticks so text cannot break out of the Discord code block', async () => {
    const res = await post(order({ noteBlock: '```\n[click](https://evil.example)' }));
    expect(savedOrder(res).noteBlock).not.toContain('`');
  });

  it('allows 5 requests per address per hour, then answers 429', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await post(order({ formulaHash: hashOf(i) }))).statusCode).toBe(201);
    }
    const res = await post(order({ formulaHash: hashOf(6) }));
    expect(res.statusCode).toBe(429);
    expect(store.has(`order:hash:${hashOf(6)}`)).toBe(false);
    expect([...ttls.values()]).toContain(3600);
  });

  it('does not store the raw address', async () => {
    await post(order());
    expect([...store.keys()].join(' ')).not.toContain('203.0.113.7');
  });

  it('caps new orders at 200 a day across all addresses', async () => {
    for (let i = 1; i <= 200; i++) {
      await post(order({ formulaHash: hashOf(i) }), { ip: `198.51.100.${i}` });
    }
    const res = await post(order({ formulaHash: hashOf(201) }), { ip: '192.0.2.1' });
    expect(res.statusCode).toBe(429);
    expect(store.has(`order:hash:${hashOf(201)}`)).toBe(false);
  });

  it('still answers 409 for a duplicate hash', async () => {
    await post(order());
    expect((await post(order())).statusCode).toBe(409);
  });
});

describe('vault payload', () => {
  const { subtle } = globalThis.crypto;
  const bytes = b64 => Buffer.from(b64, 'base64');

  async function open(sealed, privateKey) {
    const { k, iv, p } = JSON.parse(sealed);
    const raw = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, bytes(k));
    const aes = await subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, aes, bytes(p));
    return new TextDecoder().decode(plain);
  }

  it('stores a full-length sealed formula that decrypts back intact', async () => {
    const { publicKey, privateKey } = await subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']);
    // The 9 longest note names in CAS_REGISTRY give 2,051 bytes of formula; go past that.
    const formula = JSON.stringify({ ciphertext: 'ab'.repeat(900), casEntries: 'n'.repeat(1200), tail: 'END' });

    const sealed = await sealForVault(formula, publicKey);
    // The rest of the order at the sizes a busy session sends, in the same 16 KB body.
    const res = await post(order({
      encryptedPayload: sealed,
      noteBlock:  'ᛏ'.repeat(600),
      physBlock:  '·'.repeat(600),
      vaultBlock: '◈'.repeat(600),
      kernelHistory: Array(30).fill({ id: 'UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0', alias: 'underground_thermo', t: 1795000000000 }),
    }));

    expect(res.statusCode).toBe(201);
    expect(savedOrder(res).encryptedPayload).toBe(sealed);
    expect(await open(savedOrder(res).encryptedPayload, privateKey)).toBe(formula);
  });

  it('is not cut by the client before it is sent', () => {
    const view = readFileSync('src/terminal/views/LatentCollider.jsx', 'utf8');
    expect(view).not.toMatch(/encryptedPayload\s*\.\s*(slice|substring|substr)\s*\(/);
    expect(view).toMatch(/^\s*encryptedPayload,\r?$/m);
  });
});

describe('client bundle', () => {
  const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(join(dir, e.name));
    return /\.(jsx?|tsx?)$/.test(e.name) ? [join(dir, e.name)] : [];
  });

  // Vite inlines every VITE_* value into the public bundle.
  it('reads no VITE_ variable named as a secret', () => {
    const offenders = files('src').filter(f =>
      /import\.meta\.env\.VITE_\w*SECRET/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
