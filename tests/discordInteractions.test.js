// @vitest-environment node
// /api/discord/interactions is public: the Ed25519 signature is its only
// authentication, so nothing may be parsed or changed before it verifies.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Readable } from 'node:stream';

const store = new Map();
const pending = [];

vi.mock('@vercel/kv', () => ({
  kv: {
    // Yields first, so two clicks can both read the old state.
    hgetall: async k => { const v = store.get(k); await null; return v ? { ...v } : null; },
    hset:    async (k, v) => { store.set(k, { ...(store.get(k) ?? {}), ...v }); },
    incr:    async k => { const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n; },
    set:     async (k, v, opts) => {
      if (opts?.nx && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    },
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: p => { pending.push(p); } }));

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// Discord shows the raw 32-byte key as hex: the tail of the SPKI encoding.
const PUBLIC_HEX = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');

const { default: handler } = await import('../api/discord/interactions.js');

const now = () => Math.floor(Date.now() / 1000);
const PING = JSON.stringify({ type: 1 });

async function post(raw, {
  signed = true, timestamp = String(now()), signedBody = raw, headers, method = 'POST',
} = {}) {
  const req = Readable.from([Buffer.from(raw)]);
  req.method = method;
  req.headers = headers ?? (signed ? {
    'x-signature-timestamp': timestamp,
    'x-signature-ed25519': sign(null, Buffer.from(timestamp + signedBody), privateKey).toString('hex'),
  } : {});
  const res = { statusCode: 200, body: null };
  res.status = c => { res.statusCode = c; return res; };
  res.json = b => { res.body = b; return res; };
  res.send = b => { res.body = b; return res; };
  res.end = () => res;
  await handler(req, res);
  return res;
}

beforeEach(() => {
  store.clear();
  pending.length = 0;
  process.env.DISCORD_APPLICATION_PUBLIC_KEY = PUBLIC_HEX;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '' })));
});

describe('/api/discord/interactions', () => {
  it('answers a signed PING', async () => {
    const res = await post(PING);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: 1 });
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
  ])('refuses everything while the public key is %s', async (_name, value) => {
    if (value === undefined) delete process.env.DISCORD_APPLICATION_PUBLIC_KEY;
    else process.env.DISCORD_APPLICATION_PUBLIC_KEY = value;
    const click = JSON.stringify({ type: 3, data: { custom_id: 'tm:shp:abc' } });
    for (const res of [await post(PING), await post(click, { signed: false })]) {
      expect(res.statusCode).toBe(500);
    }
    expect(pending).toHaveLength(0);
  });

  it.each([
    ['an unsigned PING',        PING,   { signed: false }],
    ['unsigned malformed JSON', '{nope', { signed: false }],
    ['unsigned empty body',     '',     { signed: false }],
    ['a body that was altered', PING,   { signedBody: '{"type":3}' }],
    ['a garbage signature',     PING,   { headers: { 'x-signature-timestamp': String(now()), 'x-signature-ed25519': 'zz' } }],
    ['a stale timestamp',       PING,   { timestamp: String(now() - 600) }],
    ['a future timestamp',      PING,   { timestamp: String(now() + 600) }],
    ['a non-numeric timestamp', PING,   { timestamp: 'soon' }],
  ])('answers 401 to %s', async (_name, raw, opts) => {
    expect((await post(raw, opts)).statusCode).toBe(401);
  });

  it.each([
    ['malformed JSON', '{nope'],
    ['JSON null',      'null'],
    ['a JSON array',   '[]'],
  ])('answers 400 to correctly signed %s', async (_name, raw) => {
    expect((await post(raw)).statusCode).toBe(400);
  });

  it('answers 413 to an oversized body', async () => {
    const raw = JSON.stringify({ type: 1, pad: 'p'.repeat(70_000) });
    expect((await post(raw)).statusCode).toBe(413);
  });

  it('answers 405 to GET', async () => {
    expect((await post('', { method: 'GET' })).statusCode).toBe(405);
  });

  it('counts a shipped order once when two clicks arrive together', async () => {
    store.set('order:abc', { id: 'abc', fulfillmentState: 'MACERATING' });
    const click = JSON.stringify({ type: 3, data: { custom_id: 'tm:shp:abc' }, token: 't', application_id: 'a' });
    await Promise.all([post(click), post(click)]);
    await Promise.all(pending);
    expect(store.get('order:abc').fulfillmentState).toBe('SHIPPED');
    expect(store.get('threshold:current')).toBe(1);
  });
});
