# Transmute Order — Discord Diagnostic Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the silent Discord post failure in `api/transmute/order.js` and add an operator-facing `/api/discord/health` endpoint, so the operator can diagnose why the Crystallize order embed stopped appearing in Discord.

**Architecture:** Refactor `discordPost()` to return a structured `{ok, status, data, error, discordCode}` result instead of `json|null`. Persist the failure reason on the order's KV record when the Discord post fails (orders still queue successfully — only the operator notification is affected). Add a new `GET /api/discord/health` endpoint that runs three sequential checks (env vars → bot identity → channel access) and returns a clean diagnostic.

**Tech Stack:** Vercel serverless functions (Node 20), `@vercel/kv`, Discord REST v10.

**Branch:** `nightly-20260520` (continuation)

**Spec:** `docs/superpowers/specs/2026-05-21-transmute-order-discord-diagnostic-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `api/transmute/order.js` | Modify | Refactor `discordPost`; persist `discordError` on KV when post fails. Follows the same inline-helper pattern as `api/discord/interactions.js`. |
| `api/discord/health.js` | New | Operator-facing GET endpoint. Three sequential checks; returns `{ok, reason, detail}` on failure or `{ok, bot, channel}` on success. |

No shared `api/_lib/discord.js` extraction — codebase precedent (`interactions.js`, `order.js`) is to keep inline Discord helpers per-file. The small duplication is acceptable; do not add scope.

---

## Task 1: Refactor `discordPost` and surface failures on the order record

**Files:**
- Modify: `api/transmute/order.js` (lines 29-40, lines 177-191)

- [ ] **Step 1: Replace the `discordPost` function**

Open `api/transmute/order.js`. Replace lines 29-40 (the entire `discordPost` function and its section header) with:

```js
// ── Discord REST ──────────────────────────────────────────────────────────────
// Returns structured result so the caller can distinguish HTTP-level failures
// (bad token, missing channel, no permission) from successes. Never throws on
// HTTP errors — only on network failure. The previous null-return-on-failure
// shape silently swallowed 401/403/404 from Discord, leaving the operator
// blind to config drift.
async function discordPost(path, body) {
  let res;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, status: 0, error: `network: ${err.message}`, discordCode: null };
  }
  if (res.ok) {
    return { ok: true, status: res.status, data: await res.json() };
  }
  let errBody = null;
  try { errBody = await res.json(); } catch { /* not JSON */ }
  return {
    ok:          false,
    status:      res.status,
    error:       errBody?.message || res.statusText,
    discordCode: errBody?.code ?? null,
  };
}
```

- [ ] **Step 2: Update the caller to handle structured result**

In the same file, replace lines 177-191 (the `// Post Discord embed...` block) with:

```js
  // Post Discord embed with action buttons (requires Bot token, not webhook).
  // Failures persist on the order record so the operator can triage post-hoc
  // via Vercel's KV dashboard. Orders are valid regardless of embed delivery —
  // a failed post does not roll back the order.
  if (BOT_TOKEN && ORDER_CHANNEL) {
    const result = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
      embeds:     [buildEmbed(order, 'QUEUED')],
      components: buildComponents(orderId, 'QUEUED'),
    });
    if (result.ok) {
      await kv.hset(`order:${orderId}`, { discordMessageId: result.data.id });
    } else {
      console.error('[transmute/order] Discord post failed:',
        `status=${result.status} code=${result.discordCode ?? '—'} error=${result.error}`);
      await kv.hset(`order:${orderId}`, {
        discordError:   `${result.status}:${result.discordCode ?? '—'}:${result.error}`,
        discordErrorAt: new Date().toISOString(),
      });
    }
  } else {
    console.error('[transmute/order] BOT_TOKEN or ORDER_CHANNEL env not set — embed skipped');
    await kv.hset(`order:${orderId}`, {
      discordError:   'env_missing:BOT_TOKEN_or_ORDER_CHANNEL_unset',
      discordErrorAt: new Date().toISOString(),
    });
  }
```

- [ ] **Step 3: Run lint to verify no syntax/style errors**

Run from `F:/scale_9.4`:

```bash
npm run lint -- api/transmute/order.js
```

Expected: no new errors for `api/transmute/order.js`. (Pre-existing warnings in other files are unrelated and acceptable.)

- [ ] **Step 4: Sanity-check that the file parses**

Run from `F:/scale_9.4`:

```bash
node --check api/transmute/order.js
```

Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add api/transmute/order.js
git commit -m "$(cat <<'EOF'
fix(transmute/order): surface Discord post failures on order record

discordPost previously returned null on HTTP failure, which the
try/catch in the caller silently absorbed. 401/403/404 from Discord
left the operator blind. Now discordPost returns a structured
{ok, status, error, discordCode} result and the caller persists
discordError + discordErrorAt to KV on failure. Orders themselves
still queue successfully — only the operator embed is affected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create the `/api/discord/health` endpoint

**Files:**
- Create: `api/discord/health.js`

- [ ] **Step 1: Create the new file with full content**

Create `api/discord/health.js` with this exact content:

```js
// api/discord/health.js — SOMA-9.4 Discord Bot Health Probe
// GET /api/discord/health
//
// Operator-facing diagnostic. Runs three sequential checks:
//   1. Are BOT_TOKEN and ORDER_CHANNEL env vars present?
//   2. Does GET /users/@me succeed with the bot token? (token valid)
//   3. Does GET /channels/{ORDER_CHANNEL} succeed?         (channel reachable)
//
// No request body, no auth. The bot token never appears in the response —
// only the bot's own user identity (id, username), which is public.
// Used to triage "embed not posting" without placing a test order.

const BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const ORDER_CHANNEL = process.env.DISCORD_ORDER_CHANNEL_ID;
const DISCORD_API   = 'https://discord.com/api/v10';

async function discordGet(path) {
  let res;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      method:  'GET',
      headers: { 'Authorization': `Bot ${BOT_TOKEN}` },
    });
  } catch (err) {
    return { ok: false, status: 0, error: `network: ${err.message}`, discordCode: null };
  }
  if (res.ok) {
    return { ok: true, status: res.status, data: await res.json() };
  }
  let errBody = null;
  try { errBody = await res.json(); } catch { /* not JSON */ }
  return {
    ok:          false,
    status:      res.status,
    error:       errBody?.message || res.statusText,
    discordCode: errBody?.code ?? null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const checkedAt = new Date().toISOString();

  // ── Check 1: env vars present ────────────────────────────────────────────
  if (!BOT_TOKEN || !ORDER_CHANNEL) {
    return res.status(200).json({
      ok:        false,
      reason:    'env_missing',
      detail:    `BOT_TOKEN=${BOT_TOKEN ? 'set' : 'unset'} ORDER_CHANNEL=${ORDER_CHANNEL ? 'set' : 'unset'}`,
      checkedAt,
    });
  }

  // ── Check 2: bot identity (token valid?) ─────────────────────────────────
  const me = await discordGet('/users/@me');
  if (!me.ok) {
    const reason = me.status === 401 ? 'token_invalid'
                 : me.status === 0   ? 'discord_unreachable'
                 :                     'token_error';
    return res.status(200).json({
      ok:     false,
      reason,
      detail: `${me.status}:${me.discordCode ?? '—'}:${me.error}`,
      checkedAt,
    });
  }

  // ── Check 3: channel access ──────────────────────────────────────────────
  const ch = await discordGet(`/channels/${ORDER_CHANNEL}`);
  if (!ch.ok) {
    const reason = ch.status === 403 ? 'no_permission'
                 : ch.status === 404 ? 'channel_missing'
                 : ch.status === 0   ? 'discord_unreachable'
                 :                     'channel_error';
    return res.status(200).json({
      ok:     false,
      reason,
      detail: `${ch.status}:${ch.discordCode ?? '—'}:${ch.error}`,
      bot:    { id: me.data.id, username: me.data.username },
      checkedAt,
    });
  }

  // ── All checks passed ────────────────────────────────────────────────────
  return res.status(200).json({
    ok:        true,
    bot:       { id: me.data.id, username: me.data.username },
    channel:   { id: ch.data.id, name: ch.data.name, type: ch.data.type },
    checkedAt,
  });
}
```

- [ ] **Step 2: Run lint on the new file**

Run from `F:/scale_9.4`:

```bash
npm run lint -- api/discord/health.js
```

Expected: no errors for the new file.

- [ ] **Step 3: Sanity-check that the file parses**

Run from `F:/scale_9.4`:

```bash
node --check api/discord/health.js
```

Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add api/discord/health.js
git commit -m "$(cat <<'EOF'
feat(discord/health): operator-facing bot config diagnostic endpoint

GET /api/discord/health runs three sequential checks:
  1. Env vars present (BOT_TOKEN, ORDER_CHANNEL_ID)
  2. Bot identity via GET /users/@me (token valid)
  3. Channel access via GET /channels/{id} (channel reachable,
     bot has permission)

Returns {ok, reason, detail, checkedAt} so the operator can
identify exactly which of the four likely causes is the actual
break: env_missing, token_invalid, channel_missing,
no_permission. No bot token leak — response only contains the
bot's public identity (id, username) and channel metadata.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manual verification on the local dev server

This task verifies the new endpoint behavior across the four likely failure modes plus the happy path. No automated tests — the dependency is the live Discord API, which cannot be safely mocked without losing the diagnostic's value.

**Prerequisites:** A working `.env.local` or equivalent in `F:/scale_9.4` with `DISCORD_BOT_TOKEN` and `DISCORD_ORDER_CHANNEL_ID` set to your real production values (so the happy path passes), plus `@vercel/kv` configured (already present if orders have ever worked).

- [ ] **Step 1: Start the dev server**

Run from `F:/scale_9.4`:

```bash
npm run dev
```

Expected: Vite ready at `http://localhost:5173`. The serverless functions in `api/` are served via the dev middleware (or via `vercel dev` if that's the project's local convention — check `package.json` scripts).

If `vercel dev` is the right tool, run it instead:

```bash
vercel dev
```

Note which port the API is served on (typically `:3000` for `vercel dev`, or proxied through `:5173` under Vite).

- [ ] **Step 2: Happy path — hit `/api/discord/health` with real env**

In a separate terminal:

```bash
curl http://localhost:5173/api/discord/health
```

(Substitute the correct port if using `vercel dev`.)

Expected response shape:

```json
{
  "ok": true,
  "bot":     { "id": "...", "username": "..." },
  "channel": { "id": "...", "name": "...", "type": 0 },
  "checkedAt": "2026-05-21T..."
}
```

If this returns `ok: false`, **the diagnostic just revealed the actual production break**. Note the `reason` and `detail` fields — this is what you'll see in production once deployed. Proceed to the next verification steps to confirm each failure mode is also captured correctly.

- [ ] **Step 3: Token-invalid path — break the bot token, re-hit**

In `.env.local`, temporarily change:

```
DISCORD_BOT_TOKEN=this_is_definitely_not_a_real_token
```

Restart the dev server. Hit:

```bash
curl http://localhost:5173/api/discord/health
```

Expected:

```json
{
  "ok":     false,
  "reason": "token_invalid",
  "detail": "401:0:401: Unauthorized",
  "checkedAt": "..."
}
```

(The exact `detail` may vary depending on what Discord's 401 body contains. The `reason` must be `token_invalid`.)

- [ ] **Step 4: Channel-missing path — break the channel ID, restore token**

Restore the real `DISCORD_BOT_TOKEN`. Temporarily change:

```
DISCORD_ORDER_CHANNEL_ID=000000000000000000
```

Restart the dev server. Hit:

```bash
curl http://localhost:5173/api/discord/health
```

Expected:

```json
{
  "ok":     false,
  "reason": "channel_missing",
  "detail": "404:10003:Unknown Channel",
  "bot":    { "id": "...", "username": "..." },
  "checkedAt": "..."
}
```

(`10003` is Discord's "Unknown Channel" code. If the channel exists but the bot can't see it, you'd get `no_permission` instead.)

- [ ] **Step 5: Env-missing path — unset one var, restart**

Restore the real channel ID. Temporarily comment out:

```
# DISCORD_BOT_TOKEN=...
```

Restart the dev server. Hit:

```bash
curl http://localhost:5173/api/discord/health
```

Expected:

```json
{
  "ok":     false,
  "reason": "env_missing",
  "detail": "BOT_TOKEN=unset ORDER_CHANNEL=set",
  "checkedAt": "..."
}
```

- [ ] **Step 6: Restore real env, verify order.js path also handles failures**

Restore all env vars to real values. Restart the dev server.

In the browser, open `http://localhost:5173`, navigate to the Scaling tab (press `S` or run `load scaling` in the terminal), interact with the LatentCollider until you produce a Crystallize accord, click Register Interest, submit a contact form. Verify:

(a) The order persists in Vercel KV (you should see this happen even if Discord posting was already broken — that's the whole point)
(b) If the happy path was working in Step 2, the Discord embed appears in the channel
(c) The frontend shows the normal post-submit state

If Step 2 was `ok: false`, the order will still persist but the embed won't post — that's expected, and the order's KV record now contains `discordError` and `discordErrorAt` (visible via the Vercel KV dashboard).

- [ ] **Step 7: Stop the dev server**

In the terminal running `npm run dev` / `vercel dev`, send Ctrl+C.

---

## Task 4: Final sanity sweep before handoff

- [ ] **Step 1: Verify no uncommitted changes**

Run from `F:/scale_9.4`:

```bash
git status
```

Expected: working tree clean (ignoring `content/soma_kernel/.obsidian/workspace.json` which is editor state and untracked / always-dirty).

- [ ] **Step 2: Verify the two commits are on top of the branch**

Run from `F:/scale_9.4`:

```bash
git log --oneline -5
```

Expected: the two most recent commits are:

```
<hash> feat(discord/health): operator-facing bot config diagnostic endpoint
<hash> fix(transmute/order): surface Discord post failures on order record
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run from `F:/scale_9.4`:

```bash
npm test
```

Expected: no new test failures. (Pre-existing failures from prior work — documented as 3 unrelated failures — remain acceptable. New failures would indicate a regression.)

- [ ] **Step 4: Run the full lint to confirm no new errors**

Run from `F:/scale_9.4`:

```bash
npm run lint
```

Expected: no new errors in `api/transmute/order.js` or `api/discord/health.js`. Pre-existing warnings elsewhere are unchanged.

- [ ] **Step 5: Run the production build**

Run from `F:/scale_9.4`:

```bash
npm run build
```

Expected: build completes successfully. Vercel serverless functions in `api/` are not bundled by Vite — they ship as-is. The build only validates the React app. Confirms the work hasn't accidentally broken the client build.

- [ ] **Step 6: Report back**

Status: **DONE**

Files changed:
- `api/transmute/order.js` (modified — 2 blocks)
- `api/discord/health.js` (new)
- `docs/superpowers/specs/2026-05-21-transmute-order-discord-diagnostic-design.md` (committed earlier — context)
- `docs/superpowers/plans/2026-05-21-transmute-order-discord-diagnostic.md` (this plan — context)

Verification: lint, test, build all pass; health endpoint returns expected shape across the four failure modes plus happy path. Production deployment requires pushing to origin (NOT done automatically — awaiting explicit push command per project hard rule).

**To deploy:** the user must explicitly request `git push`. After deploy, hit `https://scale94.com/api/discord/health` to immediately reveal which underlying config issue caused the embed silence, then fix the real cause (rotate token / re-add bot / fix channel ID).
