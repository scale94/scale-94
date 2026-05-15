# scale94 Collider Bot

Discord bot for the Olfactory Collider's Living Accord easter egg. Listens for `/seek <prefix>` in a single channel, signs a JWT bound to (discordId, accordHashPrefix), DMs the user the sovereign key.

## Setup

1. Create an application in the Discord Developer Portal.
2. Enable the **bot** feature, copy the bot token.
3. Add the bot to your guild with the `bot` and `applications.commands` scopes.
4. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_BOT_TOKEN` — bot token
   - `DISCORD_APP_ID` — application ID
   - `GUILD_ID` — server (guild) ID
   - `CHANNEL_ID` — channel where `/seek` is allowed (default: scale94 channel)
   - `DISCORD_SOVEREIGN_SECRET` — must match the value set on the Vercel deployment for `/api/transmute/redeem`
5. Register the slash command (one-time, or whenever shape changes):

   ```bash
   npm run register
   ```

6. Start the bot:

   ```bash
   npm start
   ```

## Deployment

Recommended: **Railway** or **Fly.io**. The bot maintains a long-lived websocket connection to Discord, so Vercel serverless is not suitable. A small Hetzner droplet also works.

Set the same env vars in your platform's secret store.

## Rate Limits

Per-user limits are tracked **in-memory**:
- 1 successful `/seek` per accord-prefix per hour
- 5 distinct prefixes per day

**Limitation:** when the container restarts (deploys, autoscaling, periodic recycles), the in-memory counters reset. A determined user could refresh limits by waiting for a deploy. For an easter-egg flow this is acceptable — the harm ceiling is "user gets a few extra free `/seek` calls" and the protection against accidental token harvesting still works for the 99% case.

If abuse appears in practice, swap the in-memory `Map` for an Upstash Redis store keyed by `discordId:date`. Same code shape, no architectural changes.

## Token Format

Issued as `HS256` JWT with claims:

```
{ discordId, hashPrefix, iat, exp: iat + 24h, iss: 'bot.collider.scale94', aud: 'api.transmute.redeem' }
```

Verified server-side by `/api/transmute/redeem` using the shared `DISCORD_SOVEREIGN_SECRET`.
