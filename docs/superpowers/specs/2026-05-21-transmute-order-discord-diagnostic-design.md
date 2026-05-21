# Transmute Order — Discord Diagnostic Fix

**Date:** 2026-05-21
**Branch:** `nightly-20260520` (continuation)
**Status:** Spec — pending user review
**Scope:** Part 1 of two — fix the silent Discord post failure and add an operability health endpoint. Part 2 (alien verdict in embed) is deferred to its own spec.

---

## Problem

When a user clicks **Register Interest** on the Crystallize accord card (Scaling tab → LatentCollider), the frontend POSTs to `/api/transmute/order`. The endpoint persists the order to Vercel KV and then posts a rich embed to a Discord channel via the Bot REST API.

Currently: orders arrive in KV, but the Discord embed never appears in the channel. The frontend gets a 201 success and the user sees the normal post-submit state, but the operator (Discord channel watcher) never sees the order.

## Root Cause

In `api/transmute/order.js`:

```js
async function discordPost(path, body) {
  const res = await fetch(`${DISCORD_API}${path}`, { ... });
  return res.ok ? res.json() : null;        // ← null on HTTP failure, no throw
}

try {
  const msg = await discordPost(...);
  if (msg?.id) await kv.hset(`order:${orderId}`, { discordMessageId: msg.id });
} catch (e) {
  console.error('[transmute/order] Discord post failed:', e.message);
  //  ↑ never fires — discordPost returns null, doesn't throw
}
```

When Discord rejects with 401 (invalid bot token), 403 (no Send Messages permission on channel), 404 (channel ID stale), or 50001 (missing access), `discordPost()` returns `null`. The `if (msg?.id)` check silently skips the KV update. The order endpoint returns 201. **No error surface anywhere.**

Likely actual causes (in descending probability):
1. `DISCORD_BOT_TOKEN` env var rotated/unset on Vercel
2. `DISCORD_ORDER_CHANNEL_ID` points to a channel the bot was removed from
3. Bot lost the Send Messages or Embed Links permission on the channel
4. Channel was deleted/archived

We cannot determine which from the symptom alone — the silent failure is the bug. The fix surfaces the real cause.

## Goals

1. **Fail loud.** When Discord rejects, the failure must be visible — in the KV record, in the API response, and in server logs.
2. **Operability.** A dedicated `GET /api/discord/health` endpoint returns a clean diagnostic (token valid? channel reachable? bot permissions OK?) so the operator can verify config without placing a test order.
3. **No frontend regression.** The user-facing Register Interest flow stays identical. Discord post failures do not affect order persistence — orders still queue in KV, the operator can backfill the embed later via re-trigger.

## Non-Goals

- Do not auto-retry Discord posts on transient failures (out of scope; current Discord API is reliable enough that this would mask real config issues)
- Do not refactor the embed structure or copy (deferred to Part 2 alien verdict spec)
- Do not change how orders are persisted to KV
- Do not change the frontend Crystallize accord flow

## Architecture

### Change 1 — `discordPost` returns structured result

```js
async function discordPost(path, body) {
  let res;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, status: 0, error: `network: ${err.message}` };
  }
  if (res.ok) return { ok: true, status: res.status, data: await res.json() };
  let body;
  try { body = await res.json(); } catch { body = null; }
  return {
    ok: false,
    status: res.status,
    error: body?.message || res.statusText,
    discordCode: body?.code ?? null,
  };
}
```

Callers handle both branches. Failures are logged with full context and persisted on the order record.

### Change 2 — Persist failure on the order record

When the Discord post fails, store `discordError` and `discordErrorAt` on the order in KV:

```js
if (BOT_TOKEN && ORDER_CHANNEL) {
  const result = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
    embeds: [buildEmbed(order, 'QUEUED')],
    components: buildComponents(orderId, 'QUEUED'),
  });
  if (result.ok) {
    await kv.hset(`order:${orderId}`, { discordMessageId: result.data.id });
  } else {
    console.error('[transmute/order] Discord post failed:', result);
    await kv.hset(`order:${orderId}`, {
      discordError:   `${result.status}:${result.discordCode ?? '—'}:${result.error}`,
      discordErrorAt: new Date().toISOString(),
    });
  }
} else {
  await kv.hset(`order:${orderId}`, {
    discordError: 'env_missing:BOT_TOKEN_or_ORDER_CHANNEL_unset',
  });
}
```

The endpoint still returns 201 with `{ orderId, status: 'QUEUED' }`. The error is operator-facing, not user-facing — orders that fail to post to Discord are still valid orders.

### Change 3 — New `/api/discord/health` endpoint

`api/discord/health.js`:

```
GET /api/discord/health
```

Checks (in order):
1. Are env vars present? (`BOT_TOKEN`, `ORDER_CHANNEL`)
2. Does `GET /users/@me` succeed with the bot token? (token valid)
3. Does `GET /channels/{ORDER_CHANNEL}` succeed? (channel exists, bot can see it)
4. Does the channel have `name` and `type` fields? (sanity check)

Response shapes:

```json
{
  "ok": true,
  "bot": { "id": "...", "username": "..." },
  "channel": { "id": "...", "name": "...", "type": 0 },
  "checkedAt": "2026-05-21T..."
}
```

```json
{
  "ok": false,
  "reason": "token_invalid" | "channel_missing" | "no_permission" | "env_missing" | "discord_unreachable",
  "detail": "401: 0: 401: Unauthorized",
  "checkedAt": "2026-05-21T..."
}
```

No request body, no auth (the bot token isn't returned — just its identity once verified). This endpoint is public but reveals nothing sensitive.

### Change 4 — (intentionally omitted)

Originally considered: surface `discordError` on the public `/api/transmute/status` endpoint. Dropped — that endpoint is called by `useOrderStatus` for user-facing fulfillment polling and should not carry operator diagnostics. The operator inspects failed orders via Vercel's KV dashboard; the persisted `discordError` field is enough for that workflow.

## Files Affected

| File | Change |
|---|---|
| `api/transmute/order.js` | Refactor `discordPost`, persist `discordError` on failure, log full context |
| `api/discord/health.js` | **NEW** — health check endpoint |

No frontend changes required. No new dependencies. No env var changes.

## Testing

**Local (manual):**
1. Set `DISCORD_BOT_TOKEN=invalid` in `.env.local`, run `npm run dev`, hit `/api/discord/health` → expect `{ok: false, reason: 'token_invalid'}`
2. Set correct token + bogus channel ID → expect `{ok: false, reason: 'channel_missing'}`
3. Set both correctly → expect `{ok: true, bot: {...}, channel: {...}}`
4. Place a test order with invalid token → verify order persists in KV with `discordError` field set, endpoint still returns 201

**Production verification (after deploy):**
1. Hit `https://scale94.com/api/discord/health` — should immediately reveal which of the 4 likely causes is actually happening
2. Fix the underlying config issue (rotate token / re-add bot to channel / fix channel ID)
3. Place a test order, verify embed posts and `discordMessageId` is set on the order record

**No automated tests added.** This is a serverless endpoint with external service deps; integration testing requires real Discord credentials and would run against the real channel. Manual verification via `health` endpoint is sufficient for this art-project context.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `health` endpoint becomes an attack surface (rapid Discord API calls) | No request body, no params, simple GET — natural rate limit from Vercel's free tier (cold start ~1s). If abused, add IP rate limit later. |
| `discordError` field leaks bot token in error message | Discord error responses contain `code` and `message`, never echo the auth header. Tested empirically — no token leak possible. |
| Health endpoint masks transient Discord outages as "broken" | The operator reads the detail field; transient 5xx errors are obvious (`detail: "503: ..."`). Not auto-corrected — outages are real. |
| Reusing `health` from other parts of the site accidentally hits it constantly | The endpoint is internal — only meant to be hit manually by the operator. No frontend integration. Caching not needed at this scale. |

## Success Criteria

1. After deploy, hitting `/api/discord/health` returns a clear ok/not-ok with a specific reason
2. The actual underlying cause of "no embed posts" is identified within 1 minute of hitting the health endpoint
3. Once the underlying cause is fixed (token rotated, bot re-added, channel ID corrected), placing a Register Interest order results in an embed appearing in the Discord channel
4. If a future Discord failure occurs, the order's KV record contains `discordError` and `discordErrorAt` so the operator can see exactly when and why it broke

## Out of Scope (Part 2 spec)

The alien verdict feature is deferred to a separate spec — it requires:
- Frontend kernel-run history tracking
- New phrase-pool composer module
- New embed field
- Spec + plan + implementation cycle of its own

Part 2 will be written and approved separately after Part 1 ships and the embed is verified working.
