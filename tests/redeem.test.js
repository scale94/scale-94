// @vitest-environment node
// jose's webapi subtly conflicts with jsdom's TextEncoder/Uint8Array shims.
// Running in node env avoids the instanceof mismatch.
import { describe, it, expect, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

const SECRET = 'test-secret-do-not-use-in-prod-' + 'x'.repeat(20);

async function issueToken({ discordId, hashPrefix, expIn = '24h', secret = SECRET }) {
  return new SignJWT({ discordId, hashPrefix })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expIn)
    .setIssuer('bot.collider.scale94')
    .setAudience('api.transmute.redeem')
    .sign(new TextEncoder().encode(secret));
}

function mockResponse() {
  const res = { _status: 200, _body: null, _headers: {} };
  res.status = c => { res._status = c; return res; };
  res.json   = b => { res._body = b; return res; };
  res.setHeader = (k, v) => { res._headers[k] = v; return res; };
  res.end = () => res;
  res.send = b => { res._body = b; return res; };
  return res;
}

const SAMPLE_CARD = {
  topNotes:   ['bergamot', 'neroli'],
  heartNotes: ['jasmine sambac', 'osmanthus'],
  baseNotes:  ['vetiver', 'oud'],
  dom: 'floral',
};

beforeEach(() => {
  process.env.DISCORD_SOVEREIGN_SECRET = SECRET;
});

describe('/api/transmute/redeem handler', () => {
  it('rejects non-POST methods', async () => {
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'GET' }, res);
    expect(res._status).toBe(405);
  });

  it('rejects requests with missing fields', async () => {
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: {} }, res);
    expect(res._status).toBe(400);
  });

  it('returns living note for a valid token + matching prefix', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(res._body.living.newNote).toBeTruthy();
  });

  it('rejects token whose prefix does not match accordHash', async () => {
    const accordHash = '11111111' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(403);
  });

  it('returns code:expired for expired tokens', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12', expIn: '-5s' });
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('expired');
  });

  it('returns code:invalid for tampered tokens', async () => {
    const accordHash = 'abcdef12' + '0'.repeat(56);
    const token = (await issueToken({ discordId: 'user-1', hashPrefix: 'abcdef12' })) + 'TAMPERED';
    const handler = (await import('../api/transmute/redeem.js')).default;
    const res = mockResponse();
    await handler({ method: 'POST', body: { token, accordHash, accordCard: SAMPLE_CARD } }, res);
    expect(res._status).toBe(401);
    expect(res._body.code).toBe('invalid');
  });
});
