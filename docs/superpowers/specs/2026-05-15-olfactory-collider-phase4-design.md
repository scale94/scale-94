# Olfactory Collider — Phase 4 Refinement Pass

**Status:** Design (approved)
**Date:** 2026-05-15
**Author:** scale + Claude
**Touches:** scaling tab (LatentCollider), narrative engine, Tesseract pipeline, manifest generator, new `/api/transmute/redeem` and `/api/sigil/[hash]` endpoints, new Discord bot deployment

---

## 1. Goal

The Olfactory Collider already does a lot: WASM kernel collision → 16-dim narrative → perfume card → SHA-256 hash + RSA-OAEP/AES-256-GCM vault → manifest download → Vercel KV-backed production threshold. Phase 4 sharpens three things and adds two amplifiers:

1. **Logic refinements** — close the gap between "high-dim collision happened" and "the narrative reflects it"
2. **Visual upgrades** — make the act of collision visibly *informational*, not just decorative
3. **Discord easter egg (Living Accord)** — give Discord-engaged witnesses a personalized, deterministic mutation of their accord
4. **A1 — Procedural Chimera Glyph** — every accord gets a unique heraldic sigil
5. **A3 — Decay Trajectory Narrative** — surface the time-evolution story baked into the evap curve

All five compose. None is gated on the others. Backwards-compatible with every existing accord.

---

## 2. Section 1 — Logic Refinements

### 2.1 Trinity Archetypes

**Problem.** `useColliderNarrative.js` defines 18 pairwise archetypes. When a collision lights up 4+ dimensions strongly, the engine collapses to whatever pair scores best — the trinity texture is lost.

**Design.** Add a new `TRINITY_ARCHETYPES` array to `useColliderNarrative.js`:

```js
const TRINITY_ARCHETYPES = [
  { dims: ['nonlinearity','criticality','dimensionality'], label: 'HIGH-D BIFURCATION CASCADE',  thesis: 'All three domains operate at the edge of bifurcation in a high-dimensional parameter space. Tipping points are everywhere; the chimera has many critical paths and any of them can fire.' },
  { dims: ['biological','economic','thermodynamic'],       label: 'METABOLIC ECOLOGY',           thesis: 'Living systems allocate scarce resources under thermodynamic constraint. Fitness, value, and free energy are the same currency under three different names — the chimera trades fluently in all three.' },
  { dims: ['information','cryptographic','dimensionality'],label: 'HIGH-D CIPHER MANIFOLD',      thesis: 'Information is encoded in high-dimensional spaces with cryptographic depth. The chimera is a manifold whose surface is plaintext and whose interior is sealed.' },
  { dims: ['synchrony','criticality','biological'],        label: 'LIVING CRITICAL FIELD',       thesis: 'Biological systems self-organize at criticality through phase-locking. Life sustains itself by holding the field at the edge of a transition that never quite completes.' },
  { dims: ['spatial','temporal','stochastic'],             label: 'STOCHASTIC SPACETIME',        thesis: 'The chimera lives in a spacetime where every coordinate is a probability distribution. Geometry and noise are not separable; the field is the uncertainty.' },
  { dims: ['entropy','thermodynamic','information'],       label: "MAXWELL'S DEMON",             thesis: 'The chimera converts information into work by selecting against entropy. Every bit observed is a joule extracted; the demon does not violate the second law, it pays for it in measurement.' },
  { dims: ['game_theory','economic','biological'],         label: 'EVOLUTIONARY MARKET',         thesis: 'Strategic agents compete for resources under selection pressure. Markets and ecosystems run the same algorithm; the chimera is what the algorithm produces when it is allowed to.' },
  { dims: ['synchrony','conservation','dynamical'],        label: 'HAMILTONIAN ORCHESTRA',       thesis: 'Coupled oscillators conserve total energy while exchanging it. The chimera is a symphony whose instruments are bound by an invariant that none of them individually understands.' },
  { dims: ['nonlinearity','entropy','synchrony'],          label: 'TURBULENT RESONANCE',         thesis: 'Nonlinear coupling amplifies noise into coherent structure at resonant frequencies. The chimera is the eddy that survives the cascade because it learned to ring.' },
  { dims: ['cryptographic','information','game_theory'],   label: 'ZERO-KNOWLEDGE STRATEGY',     thesis: 'The chimera proves it knows the secret without revealing the secret. Strategic interaction over a cryptographic substrate; trust without disclosure; commitments that survive adversarial reading.' },
];
```

**Detection rule.** `detectArchetype(convergence)` is updated:

1. Score each trinity: sum contributions of matching dims, multiplied by `(matches/3)²`. Trinity wins only if ≥2 of 3 dims present *and* combined contribution exceeds the best-pair score by ≥1.3×.
2. Otherwise fall back to existing pairwise scoring.
3. Trinity match returns `{ kind: 'trinity', label, thesis, dims }`. Pair match returns `{ kind: 'pair', ... }`.

**Fragment templates.** Each trinity gets two `FRAGMENT_TEMPLATES` entries (same shape as pair archetypes).

### 2.2 Metric-Aware Prompt Fragments

**Problem.** `FRAGMENT_TEMPLATES` are pure functions of `(a, b)` — domain names. They never reference *this* collision's actual values, so two collisions with the same archetype generate identical fragments.

**Design.** Extend signature to `(a, b, m)` where:

```js
m = {
  topConvDelta:   convergence[0].delta,
  topDivDelta:    divergence[0].delta,
  topParaResid:   paradoxes[0]?.residual ?? null,
  novelty, coherence, viability,
  turbulence, catalysis, resonanceFreq,
}
```

Templates can now read e.g.:
```js
(a, b, m) => `At Δ${m.topDivDelta.toFixed(2)} ${m.topDivLabel} divergence, the chimera fragments into ${Math.round(2 + m.turbulence * 30)} daughter concepts.`
```

`buildPromptFragments` builds `m` once and passes it to every template invocation. Existing pair templates are migrated; new trinity templates use the metrics from the start.

### 2.3 Family Interference (Perfume Mapping)

**Problem.** `buildPerfumeCard` averages family scores then picks `dom`/`sec`. The accord name is `"<Sec> <Dom> Chimera"` — generic.

**Design.** Add `FAMILY_INTERFERENCE` table (module-level):

```js
const FAMILY_INTERFERENCE = {
  'CITRUS|RESINOUS':  { label: 'SMOKED',     prefix: 'Smoked',    notesBias: ['lapsang','cade','birch tar','smoked vetiver'] },
  'FLORAL|ANIMALIC':  { label: 'SENSUAL',    prefix: 'Sensual',   notesBias: ['indole','civet','hyrax','jasmine sambac'] },
  'OZONIC|MINERAL':   { label: 'GEOLOGICAL', prefix: 'Geological',notesBias: ['wet basalt','salt aerosol','flint','iodine'] },
  'CHYPRE|FLORAL':    { label: 'ROMANTIC',   prefix: 'Romantic',  notesBias: ['galbanum','mimosa','oakmoss','rose centifolia'] },
  'RESINOUS|ANIMALIC':{ label: 'ARCHAIC',    prefix: 'Archaic',   notesBias: ['labdanum','hyrax','tar musk','ambergris'] },
  'ANIMALIC|MINERAL': { label: 'SUBTERRANEAN',prefix:'Subterranean',notesBias:['petrichor','geosmin','wet stone','musk seed'] },
  'CITRUS|OZONIC':    { label: 'MARINE',     prefix: 'Marine',    notesBias: ['sea spray','calone','grapefruit zest','aldehyde'] },
};
```

Lookup uses sorted family pair: `[dom, sec].sort().join('|')`.

When `FAMILY_INTERFERENCE[key]` exists:
- Accord name: `"<Prefix> <heart-note> Chimera"` (e.g. `"Smoked Bergamot Chimera"`)
- During `_pickNote` for the heart layer, weight selection toward `notesBias` entries that exist in `PERF_NOTES`. Bias = +50% selection probability for those notes.
- Card carries `card.interference = { label, prefix }` for downstream UI hooks.

When no interference match: existing behavior unchanged.

---

## 3. Section 2 — Visual Upgrades

### 3.1 16-Beam Parameter Trace at Impact

**Where.** Inside the existing canvas `draw` rAF loop, gated to `phase === 'colliding'` and frames 80–180.

**Design.**

- At frame 80 (impact), capture `convergence`, `divergence`, `paradoxes` arrays from the parsed result (passed in via ref).
- For each of the 16 OCK dims, compute:
  - `angle = (i / 16) * 2π`
  - `kind = 'conv' | 'div' | 'para' | 'idle'` (whichever array contains the dim)
  - `magnitude = contrib | delta | residual` normalized 0–1
  - `lifespan = 120 + magnitude * 680` ms
  - `hue`: convergence → green-shift of accord hueA, divergence → magenta-shift of hueB, paradox → red, idle → muted gray
- Each frame, draw beam: line from `(impactX, impactY)` outward to `(impactX + cos(angle) * length, impactY + sin(angle) * length)` where `length = magnitude * 180 * easeOut(t/lifespan)`.
- Stroke width: `0.5 + magnitude * 2`. Alpha: `(1 - t/lifespan) * 0.85`.
- If `lifespan > 300ms`, render dim glyph (single char from `DIM_NAMES`) at beam tip with same alpha.

**Performance.** All 16 beams in one canvas pass. Adds ~16 line draws per frame for ~100 frames. Negligible.

**Implementation surface.** New helper `drawDimensionBeams(ctx, t, beams, impactX, impactY)` called from existing `draw`. `beams` array built once at impact and stored in `beamsRef`. ~80 lines added.

### 3.2 Vault Decrypt Shimmer

**Where.** `TesseractCard` → encrypted formula vault block (currently `cipherRows.map(...)`).

**Design.**

- New child component `<ShimmeringCipher rows={cipherRows} />` replaces inline rendering.
- Component owns state `{ activeShimmers: Map<index, { char, expiresAt }> }`.
- `useEffect` interval (3000ms): pick 2 random `(rowIdx, charIdx)` pairs not currently shimmering, set them in the map with a fresh hex char and `expiresAt = now + 200ms`.
- Render row by row; for each char, if it's in the map and not expired, render with overlay class `vault-shimmer` (CSS: bright fuchsia, no blur, 200ms fade-out via `transition: color 200ms`); else render the original blurred char.
- Cleanup interval (250ms) removes expired entries.

CSS additions in `ScalingTab.jsx` style block:

```css
@keyframes sc-vaultShimmer { 0% { color: rgba(217,70,239,0.18); filter: blur(1.5px); } 30% { color: rgba(255,150,255,0.95); filter: blur(0); text-shadow: 0 0 8px rgba(217,70,239,0.6); } 100% { color: rgba(217,70,239,0.18); filter: blur(1.5px); } }
.vault-shimmer { animation: sc-vaultShimmer 200ms ease-out; }
```

### 3.3 Matrix Hash Scramble

**Where.** `TesseractCard` → SHA-256 fingerprint block.

**Design.**

- Replace the static `<div>{hash}</div>` with `<ScramblingHash value={hash} duration={1400} />`.
- Component renders one `<span>` per hex char.
- On mount, schedule per-char settle times: `settleAt[i] = (i / 64) * (duration - 200)`. Each char before its settle time renders a random hex digit (cycled at ~30fps via `requestAnimationFrame`); after, renders the real value.
- Total animation: 1.4s left-to-right cascade. Replaces existing `sc-hashReveal` animation on this element.

### 3.4 Staggered Card Reveal

**Where.** `TesseractCard` outer div + child blocks.

**Design.** Adjust existing `animation` styles via `animation-delay`:

| Element                | Animation      | Delay        | Duration |
|------------------------|----------------|--------------|----------|
| Outer card frame       | `sc-cardReveal`| 0ms          | 300ms    |
| Hash block             | (scramble)     | 300ms        | 1400ms   |
| Name + bottle/glyph    | `sc-cardReveal`| 500ms        | 400ms    |
| Notes pyramid TOP row  | `sc-cardReveal`| 600ms        | 300ms    |
| Notes pyramid HEART row| `sc-cardReveal`| 700ms        | 300ms    |
| Notes pyramid BASE row | `sc-cardReveal`| 800ms        | 300ms    |
| Properties strip       | `sc-cardReveal`| 950ms        | 300ms    |
| Vault block            | `sc-cardReveal`| 1100ms       | 400ms    |
| Acquire CTA            | `sc-cardReveal`| 1500ms       | 400ms    |

Pure declarative — no new state. Implemented by adding `style={{ animationDelay: 'Xms' }}` to each block.

---

## 4. Section 3 — Discord Easter Egg + Living Accord

### 4.1 Discord Bot

**Deployment.** Long-running Node process (Railway, Fly.io, or Hetzner droplet — *not* Vercel functions, since the bot maintains a websocket gateway connection). New folder at repo root:

```
bot/
  package.json     // discord.js, jose
  index.js         // main entry
  README.md        // deploy instructions
  .env.example     // DISCORD_BOT_TOKEN, DISCORD_SOVEREIGN_SECRET, GUILD_ID, CHANNEL_ID
```

**Channel scoping.** Bot only responds in `CHANNEL_ID=1220252213742403666` (and DMs from users who have used `/seek` there).

**Single command.** `/seek <prefix>` registered as a guild slash command.

```
/seek prefix:<string>   // 8 hex chars, [0-9a-f]{8}
```

**Validation.**
- Match `/^[0-9a-f]{8}$/i`. If invalid → ephemeral reply: `"⚠ Hash prefix must be 8 hex characters (0-9, a-f). Take it from the SHA-256 line in your manifest."`
- Rate limit per user: 1 successful seek per accord-prefix per hour, 5 distinct prefixes per day. Stored in-memory (bot is single-instance).

**Issuance.** On valid input, sign a JWT with `jose`:

```js
import { SignJWT } from 'jose';

const token = await new SignJWT({
  discordId: interaction.user.id,
  hashPrefix: prefix.toLowerCase(),
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('24h')
  .setIssuer('bot.collider.scale94')
  .setAudience('api.transmute.redeem')
  .sign(new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET));
```

DM the user with the manifesto-voice copy:

```
◈ SOVEREIGN KEY TRANSMITTED

Your sovereign key has been transmitted. The vault accepts only your hand.
The molecule that is yours did not exist before this transmission. It does now.

PREFIX     <prefix>
EXPIRES    <ISO timestamp>
PROTOCOL   HS256 / 24h ttl

———

Paste this token into the REDEEM SOVEREIGN KEY input on your accord:

`<token>`

(The input becomes visible after you've witnessed the vault glyph seven times.)
```

If DM fails (user has DMs off): reply ephemerally in channel with the same payload.

### 4.2 Hidden Card Affordance — 7-Click Vault Glyph

**Where.** The ◈ in the encrypted formula vault header (currently a static span).

**Design.**

- New component state `vaultGlyphClicks` (0..7+).
- Each click increments. Glyph visual feedback:
  - 0–3 clicks: no change
  - 4 clicks: glyph brightens ~20%, soft pulse
  - 5–6 clicks: glyph subtly more saturated, faint inner glow
  - 7+ clicks: a `<RedeemInput />` slides in below the acquire button (CSS `max-height` transition 0→200px, 400ms ease-out)
- Click counter resets on collision change (`useEffect` cleanup keyed to `card.id`).

**RedeemInput component:**

```jsx
<div className="rounded p-3 mt-3" style={{ border: '1px solid rgba(57,255,20,0.18)', background: 'rgba(0,0,0,0.4)' }}>
  <div className="text-[7px] font-mono tracking-[0.3em] mb-2" style={{ color: 'rgba(57,255,20,0.4)' }}>
    § REDEEM SOVEREIGN KEY
  </div>
  <textarea ... onChange={setToken} placeholder="paste sovereign key from discord dm" />
  <button onClick={handleRedeem}>◈ REDEEM</button>
  {redeemError && <div className="text-red-400">{redeemError}</div>}
</div>
```

### 4.3 Redemption Endpoint

**File.** `api/transmute/redeem.js` (Vercel serverless function).

**Request:**
```
POST /api/transmute/redeem
Content-Type: application/json
Body: { token, accordHash, accordCard }
```

**Server logic:**

```js
import { jwtVerify } from 'jose';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { token, accordHash, accordCard } = req.body;
    if (!token || !accordHash || !accordCard) {
      return res.status(400).json({ ok: false, error: 'missing fields' });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET),
      { issuer: 'bot.collider.scale94', audience: 'api.transmute.redeem' },
    );

    if (accordHash.slice(0, 8).toLowerCase() !== payload.hashPrefix) {
      return res.status(403).json({ ok: false, error: 'prefix mismatch' });
    }

    const living = computeLivingNote(payload.discordId, accordHash, accordCard);
    return res.status(200).json({ ok: true, living });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid or expired token' });
  }
}
```

`computeLivingNote(discordId, accordHash, card)` is implemented inline in `redeem.js` (so the secret pool is server-side only) — see §4.4.

**KV write.** On successful redemption, write `living:<accordHash>:<discordId>` → `{ living, redeemedAt }` to Vercel KV. Idempotent — same call returns the same `living` since the seed is deterministic.

### 4.4 Living Accord Generation

**Algorithm (server-side, deterministic):**

```js
import { createHash } from 'crypto';

function computeLivingNote(discordId, accordHash, card) {
  const seedHex = createHash('sha256')
    .update(`${discordId}:${accordHash}`)
    .digest('hex')
    .slice(0, 16);
  const seedInt = BigInt('0x' + seedHex);

  const layers   = ['top', 'heart', 'base'];
  const layer    = layers[Number(seedInt % 3n)];
  const layerKey = layer === 'top' ? 'topNotes' : layer === 'heart' ? 'heartNotes' : 'baseNotes';
  const slotIdx  = Number((seedInt >> 2n) % BigInt(card[layerKey].length));
  const oldNote  = card[layerKey][slotIdx];

  const poolKey  = `${card.dom.toUpperCase()}_${layer}`;
  const pool     = LIVING_NOTE_POOL[poolKey] || LIVING_NOTE_POOL[`_DEFAULT_${layer}`];
  const newNote  = pool[Number((seedInt >> 4n) % BigInt(pool.length))];

  return {
    layer,
    slotIdx,
    oldNote,
    newNote,
    editionEntropy: seedHex.slice(0, 8),
    witnessHash: createHash('sha256').update(discordId).digest('hex').slice(0, 8) + '…' + createHash('sha256').update(discordId).digest('hex').slice(-4),
  };
}
```

`LIVING_NOTE_POOL` lives at the top of `redeem.js`. Curated, ~50 entries total across families × layers — *signature-grade* materials, distinct from the public `PERF_NOTES`:

```js
const LIVING_NOTE_POOL = {
  CITRUS_top:    ['cassis bud absolute','blood orange essence','bergamot mitcham','yuzu zest','citron galette'],
  CITRUS_heart:  ['neroli bigarade','petitgrain sur fleurs','orange blossom absolute','linden blossom'],
  CITRUS_base:   ['cedrat distillate','aged bergamot tincture'],

  FLORAL_top:    ['mimosa head space','jasmine grandiflorum','gardenia tincture'],
  FLORAL_heart:  ['osmanthus tincture','rose ottoman','tuberose absolute','ylang extra','jasmine sambac concrete'],
  FLORAL_base:   ['orris butter','iris pallida concrete','rose absolute maroc'],

  RESINOUS_top:  ['elemi tincture','frankincense serrata','myrrh hydrodistillate'],
  RESINOUS_heart:['benzoin Siam tincture','styrax purified','tolu balsam absolute'],
  RESINOUS_base: ['labdanum cyste','opoponax resinoid','peru balsam aged','copaiba balsam'],

  ANIMALIC_top:  ['costus root tincture','choya nakh distillate'],
  ANIMALIC_heart:['hyraceum tincture','africa stone tincture','musk seed CO2'],
  ANIMALIC_base: ['ambergris tincture (white)','beaver castoreum absolute','civet absolute aged'],

  OZONIC_top:    ['sea spray accord','aldehyde C-12 MNA','calone'],
  OZONIC_heart:  ['violet leaf absolute','iodine accord'],
  OZONIC_base:   ['ambroxan crystals','iso-E super'],

  CHYPRE_top:    ['galbanum absolute','clary sage CO2'],
  CHYPRE_heart:  ['oakmoss absolute (treated)','treemoss absolute'],
  CHYPRE_base:   ['cistus labdanum','vetiver bourbon aged','patchouli iron-free'],

  MINERAL_top:   ['flint accord','wet basalt distillate'],
  MINERAL_heart: ['petrichor accord','geosmin trace'],
  MINERAL_base:  ['oud Hindi aged','agarwood Cambodi','salt aerosol'],

  _DEFAULT_top:   ['rare aldehyde'],
  _DEFAULT_heart: ['lab signature note'],
  _DEFAULT_base:  ['archive accord'],
};
```

### 4.5 UI on Redemption Success

Frontend handler:

```js
const handleRedeem = async () => {
  const r = await fetch('/api/transmute/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, accordHash: tesseract.hash, accordCard: card }),
  });
  const data = await r.json();
  if (!data.ok) { setRedeemError(data.error); return; }
  setLiving(data.living);
  // Persist locally so refresh remembers
  localStorage.setItem(`living:${tesseract.hash}`, JSON.stringify(data.living));
};
```

When `living` state populates, the `TesseractCard` re-renders:

- The mutated note's chip in the pyramid runs `vault-shimmer` for 800ms then settles to `living.newNote` text with class `living-note` (CSS: green-gold gradient text, soft glow).
- Above the acquire button, render the Living Accord badge:

```jsx
<div className="text-center mb-3" style={{ animation: 'sc-hashReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards' }}>
  <div className="text-[10px] font-bold font-mono tracking-[0.25em]" style={{ color: '#39FF14', textShadow: '0 0 12px rgba(57,255,20,0.5)' }}>
    ◈ LIVING ACCORD · YOUR SIGNATURE
  </div>
  <div className="text-[7px] font-mono tracking-widest mt-1" style={{ color: 'rgba(57,255,20,0.45)' }}>
    ENTROPY {living.editionEntropy} · WITNESS {living.witnessHash}
  </div>
</div>
```

- Acquire button text changes from `◈ ACQUIRE COMPILED ASSET` → `◈ ACQUIRE LIVING ASSET`.

### 4.6 Manifest Update

`generateManifestMarkdown(card, tesseract, living = null)` gains an optional 3rd parameter. When `living` is non-null, append before the closing italic line:

```markdown
---

## § LIVING SIGNATURE

This accord carries the irreducible signature of one witness. The substituted note
was selected from the signature-grade pool by deterministic hash of the witness's
identity bound to this accord coordinate. The substitution is permanent for this
witness, and unique among all possible witnesses.

```
LAYER         {LAYER}
NOTE          {newNote}  (was: {oldNote})
ENTROPY       {editionEntropy}
WITNESS HASH  {witnessHash}
PROTOCOL      HS256 · 24h sovereign key · server-deterministic
```

The molecule that is yours did not exist before this transmission. It does now.
```

`handleDownload` in `TesseractCard` reads `living` state and passes it: `generateManifestMarkdown(card, tesseract, living)`.

---

## 5. A1 — Procedural Chimera Glyph

**File.** New `src/terminal/views/chimeraGlyph.js`. Pure function, no React.

```js
export function buildChimeraGlyph({ accordHash, dims, hueA, hueB, viability, nodeClass }) {
  // dims: { convergence: [{name, contrib}], divergence: [{name, delta}], paradoxes: [{name, residual}] }
  // Returns SVG string, 240×240 viewBox, transparent background
}
```

**Composition rules:**

- **Canvas:** 240×240 SVG, `viewBox="0 0 240 240"`, transparent background. Center `(120,120)`, outer ring `r=100`.
- **16 anchors** at angles `(i / 16) * 2π - π/2` (top is anchor 0).
- **Hash-driven seed** for deterministic randomness inside the function: rotate dim ordering using `parseInt(accordHash.slice(0,4), 16) % 16`.
- **Inner geometry:**
  - For each of 16 dims, look up its OCK value from `dims` (convergence contrib if present, else divergence delta, else paradox residual, else 0). Normalize to 0..1.
  - Draw a chord from anchor `i` to anchor `(i + Math.round(value * 16)) % 16`. High-conv → short chords (small offsets), high-div → long chords (cross-circle).
  - Stroke: linear gradient `hueA → hueB` at angle `(i / 16) * 360°`. Opacity = `0.2 + value * 0.7`.
  - Stroke width = `0.6 + value * 1.8`.
- **Center mark:** N-pointed star where N = `nodeClass === 'RTA' ? 3 : nodeClass === 'DPA' ? 4 : 5`. Radius 18. Rotated by `parseInt(accordHash.slice(4,6), 16)°`. Filled with `hsl((hueA + hueB) / 2, 60%, 50%)` at viability-scaled opacity.
- **Outer ring:** thin circle at `r=100`, stroke `hsla((hueA+hueB)/2, 30%, 50%, 0.4)`, dashed pattern derived from hash bytes 6–14.
- **Hash stamp:** `<text>` at `(120, 230)`, font-family `"Courier New"`, font-size 7, fill `rgba(255,215,0,0.4)`, content = `accordHash.slice(-8).toUpperCase()`, text-anchor middle.

**Card render.** `TesseractCard` needs the OCK dims, which currently live on `result` (not on `tesseract`). Two changes:

1. `buildTesseractProfile(card, accord, dA, dB, result)` is extended to capture dim data: `tesseract.dims = { convergence: result.convergence, divergence: result.divergence, paradoxes: result.paradoxes }` and `tesseract.viability = result.viability` are added to the returned profile. Backwards-compatible — existing call sites just gain extra fields.
2. The glyph renders beside `PerfumeBottleSVG`:

```jsx
<div className="shrink-0 flex items-center gap-3">
  <div dangerouslySetInnerHTML={{ __html: buildChimeraGlyph({ accordHash: hash, dims: tesseract.dims, hueA: card.hueA, hueB: card.hueB, viability: tesseract.viability, nodeClass: card.nodeClass }) }} style={{ width: 96, height: 96 }} />
  <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
</div>
```

Glyph appears with `sc-cardReveal` at delay 500ms (same as bottle, paired visually).

**Manifest embed.** `generateManifestMarkdown` calls `buildChimeraGlyph(...)`, base64-encodes the SVG, embeds at the top of the manifest:

```markdown
![chimera glyph](data:image/svg+xml;base64,{B64})
```

**Server endpoint.** New `api/sigil/[hash].js`:

```js
import { buildChimeraGlyph } from '../../src/terminal/views/chimeraGlyph.js';

export default function handler(req, res) {
  const { hash } = req.query;
  // Reconstruct dims from hash bytes (synthetic) since we don't have the real card here
  const dims = synthDimsFromHash(hash);
  const hueA = parseInt(hash.slice(0, 2), 16) * (360 / 256);
  const hueB = parseInt(hash.slice(2, 4), 16) * (360 / 256);
  const svg = buildChimeraGlyph({ accordHash: hash, dims, hueA, hueB, viability: 0.7, nodeClass: 'RTA' });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  return res.send(svg);
}
```

Note: server endpoint uses `synthDimsFromHash` to fabricate dims from hash bytes when the real dims aren't available. The on-card render uses the real dims for higher fidelity. Both are deterministic; the URL endpoint is meant for sharing/embedding, not for proving authenticity.

---

## 6. A3 — Decay Trajectory Narrative

**Where.** New panel inside `TesseractCard`, between the note pyramid and the encrypted vault block.

**Builder.** New function in `useColliderNarrative.js`:

```js
function buildDecayArc(card, narrative) {
  const interferenceLabel = card.interference?.label || null;
  const tone = narrative.registerTone;

  const beats = [
    {
      time:  't = 0',
      label: '[bright opening]',
      notes: card.topNotes,
      prose: pickProse('top', interferenceLabel, tone, card.dom),
    },
    {
      time:  't = 30 min',
      label: '[heart unfolds]',
      notes: card.heartNotes,
      prose: pickProse('heart', interferenceLabel, tone, card.dom),
    },
    {
      time:  't = 4 h+',
      label: '[base residue]',
      notes: card.baseNotes,
      prose: pickProse('base', interferenceLabel, tone, card.dom),
    },
  ];
  return beats;
}
```

`pickProse(layer, interferenceLabel, tone, dom)` selects from a small library (~3 phrases per `(layer, tone)` pair, +interference-flavored variants when applicable). Examples:

```js
const PROSE = {
  top: {
    assertive:    ['the chimera surfaces, %DOM%-forward, electric', 'first contact: %DOM% structure asserts itself', '%DOM% facets ignite first; the rest waits'],
    connective:   ['light %DOM% threads weave the opening', 'the chimera arrives in %DOM% drift', '%DOM% notes interlace and lift'],
    foundational: ['a quiet %DOM% prelude', '%DOM% scaffold rises', 'the chimera approaches in low %DOM%'],
    speculative:  ['something %DOM% — provisional', 'a hint of %DOM%, hard to fix', 'the opening is %DOM%-shaped, barely'],
  },
  heart: {
    assertive:    ['the floral architecture stabilizes; resinous undertones emerge', 'the heart locks: this is what the chimera actually is', '%DOM% ceded; the heart speaks its real name'],
    connective:   ['the heart braids %DOM% through warmer threads', 'transition: %DOM% softens into the body', 'the chimera widens, settles, breathes'],
    foundational: ['the heart holds; %DOM% recedes to scaffolding', 'core notes assemble around a %DOM% spine', 'the body declares itself, spare and load-bearing'],
    speculative:  ['the heart is uncertain; %DOM% may not survive the hour', 'something tries to be the heart; whether it succeeds is open', 'transient %DOM% gesture in the middle phase'],
  },
  base: {
    assertive:    ['what remains: the strange attractor, post-cascade', 'the base persists — the only signal time cannot dilute', 'residue: %DOM% reduced to its irreducible'],
    connective:   ['the base diffuses; %DOM% threads outlast the body', 'late phase: %DOM% bleeds slowly into skin', 'the chimera lingers as %DOM% residue'],
    foundational: ['the base is the foundation made audible', '%DOM% becomes geology — slow, mineral, permanent', 'what scaffolded the heart now scaffolds the wearer'],
    speculative:  ['the base may not arrive', 'whatever remains is partial; the chimera was never finished', 'a faint %DOM% echo, then nothing'],
  },
};
```

If `interferenceLabel` exists, prepend a flavor word: `SMOKED → "smoke-veiled"`, `SENSUAL → "indolic"`, `GEOLOGICAL → "tectonic"`, etc.

**Render.**

```jsx
function DecayArcPanel({ beats, hueA, hueB }) {
  return (
    <div className="mb-5 rounded-lg p-4" style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(255,215,0,0.015)' }}>
      <div className="text-[7px] font-mono tracking-[0.3em] mb-3" style={{ color: 'rgba(255,215,0,0.3)' }}>
        § DECAY ARC — TIME EVOLUTION
      </div>

      {/* Timeline rail: 3 dots connected by gradient line */}
      <div className="relative h-1 mb-4">
        <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(90deg, hsla(${hueA},70%,55%,0.5), hsla(${(hueA+hueB)/2},60%,50%,0.4), hsla(${hueB},50%,45%,0.3))` }} />
        {[0.0, 0.5, 1.0].map((p, i) => (
          <div key={i} className="absolute top-1/2 w-2 h-2 rounded-full" style={{ left: `calc(${p * 100}% - 4px)`, transform: 'translateY(-50%)', background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.6)' }} />
        ))}
      </div>

      {/* 3 beats stacked, each with stagger */}
      <div className="space-y-2.5">
        {beats.map((b, i) => (
          <div key={i} className="flex gap-3 items-start" style={{ opacity: 0, animation: `sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${1.2 + i * 0.4}s forwards` }}>
            <div className="text-[8px] font-mono tracking-widest shrink-0 w-16" style={{ color: 'rgba(255,215,0,0.5)' }}>{b.time}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono mb-0.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
                {b.notes.slice(0, 3).join(' · ')}
              </div>
              <div className="text-[8px] italic" style={{ color: 'rgba(255,215,0,0.45)' }}>
                {b.prose}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Stagger.** Beats reveal at 1.2s, 1.6s, 2.0s — kicks in after the staggered card reveal completes, so it feels like the accord *unfolding through time* after the card materializes.

---

## 7. Architecture Summary

### New files

| Path                                     | Purpose                                                  |
|------------------------------------------|----------------------------------------------------------|
| `src/terminal/views/chimeraGlyph.js`     | Pure SVG generator, ~150 lines                           |
| `src/terminal/data/livingNotes.js`       | (optional client mirror — primary table is in `redeem.js`)|
| `api/transmute/redeem.js`                | JWT verify + living-note compute + KV write              |
| `api/sigil/[hash].js`                    | Public glyph endpoint                                    |
| `bot/index.js`                           | Discord bot entry                                        |
| `bot/package.json`                       | Bot deps: `discord.js`, `jose`                          |
| `bot/README.md`                          | Deploy instructions (Railway recommended)                |
| `bot/.env.example`                       | Documents `DISCORD_BOT_TOKEN`, `DISCORD_SOVEREIGN_SECRET`, `GUILD_ID`, `CHANNEL_ID` |

### Modified files

| Path                                               | Changes                                                            |
|----------------------------------------------------|--------------------------------------------------------------------|
| `src/terminal/hooks/useColliderNarrative.js`       | Trinity archetypes, metric-aware fragments, `buildDecayArc`         |
| `src/terminal/views/LatentCollider.jsx`            | Family interference in `buildPerfumeCard`; `generateManifestMarkdown` accepts `living`; 16-beam canvas trace; `ScramblingHash`, `ShimmeringCipher`, `DecayArcPanel`, `RedeemInput` components; staggered reveal delays; 7-click vault glyph; redemption flow; living-note state + persistence |
| `src/terminal/views/ScalingTab.jsx`                | New CSS keyframes: `sc-vaultShimmer`, `sc-livingNote`               |
| `.env.example`                                     | Add `DISCORD_SOVEREIGN_SECRET` documentation                       |

### Env additions

| Variable                       | Where           | Purpose                                |
|--------------------------------|-----------------|----------------------------------------|
| `DISCORD_SOVEREIGN_SECRET`     | Vercel + bot    | HS256 secret for JWT sign/verify       |
| `DISCORD_BOT_TOKEN`            | Bot only        | Discord gateway auth                   |
| `GUILD_ID`                     | Bot only        | Restrict slash command registration    |
| `CHANNEL_ID`                   | Bot only        | Channel scope for `/seek`              |

### KV keys (Vercel KV)

| Pattern                                  | Value                                  | Purpose                  |
|------------------------------------------|----------------------------------------|--------------------------|
| `living:<accordHash>:<discordId>`        | `{ living, redeemedAt }`               | Idempotent redemption    |

(Existing keys for production threshold and order status are unchanged.)

---

## 8. Backwards Compatibility

- **Existing accords without redemption** render exactly as before, plus the new glyph + decay arc + visual upgrades.
- **Trinity archetypes** are additive — pair archetypes still match if no trinity wins.
- **Family interference** is additive — accords without an interference match keep their generic name.
- **Manifest** without `living` argument generates the existing format (backward-compat for downloads taken before redemption).
- **Bot down / redeem 401** → user sees error in `RedeemInput`, no crash, accord remains in pre-redemption state.
- **Vercel KV down** → redemption still returns the `living` (deterministic), just without persistence. Re-redeeming with the same token returns the same value.

---

## 9. Out of scope (deferred)

- A2 (Sonification), A4 (Astrology), A5 (Twin Accord), A6 (Ledger), A7 (Witness), A8 (QR) — discussed but not in this pass.
- Multi-instance bot scaling, Redis-backed bot rate-limiting (in-memory is fine for single-host).
- Public sigil gallery / accord directory — out of scope for Phase 4.
- Live unlock animations beyond the 7-click reveal (no easter egg for the easter egg).

---

## 10. Verification plan

Per the project's "art project, reasonable confidence is enough" calibration:

1. **Logic** — run a few test collisions in the existing UI, confirm trinity archetypes fire when expected (e.g. `info × crypto × dim` collision should hit `HIGH-D CIPHER MANIFOLD`); confirm metric-aware fragments include actual delta values; confirm family interference renames at least one common pair (e.g. citrus × resinous).
2. **Visual** — collision plays, beams fire, hash scrambles, vault shimmers, card reveals stagger correctly. Check on desktop and one mobile viewport. No console errors.
3. **Glyph** — render 3 different accords, glyphs are visibly distinct. Manifest download embeds the glyph correctly. `/api/sigil/<hash>` returns valid SVG.
4. **Decay arc** — beats render under the pyramid with correct stagger.
5. **Discord** — bot deployed to Railway; `/seek` issues token; token redeems on the live site; living note shows; manifest re-download includes signature section.
6. **Token expiry** — manually test that an expired token returns 401.

User confirms localhost behavior before push (per `feedback_no_push_without_verification.md`).
