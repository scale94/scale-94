# STILLER DIVERGENCE KERNEL v1.1.1
**Volatile Semiotic vs Fossil Record · Feigenbaum Fade · Bimmelbahn Accord**

```
KERNEL    :: STILLER_DIVERGENCE
ID        :: STILLER-DIVERGENCE-1.1.1
MODULE    :: feigenbaum.rs → run_stiller_divergence(r, x0, n)
LINEAGE   :: FISH_SCALE_DOCTRINE_v11.4.0
PROTOCOL  :: Logistic Map · Axiom Cascade · Bimmelbahn Accord
```

---

## Command

```
run stiller [--r 3.57] [--x0 0.42] [--n 500]
```

**Aliases:** `stiller` · `divergence` · `broadcast` · `fossil` · `vaporization` · `combustion` · `bimmelbahn` · `vitrified` · `stiller_divergence`

---

## Parameters

| Flag | Default | Range | Description |
|------|---------|-------|-------------|
| `--r` | `3.57` | `0–4.0` | Growth mandate. `3.57 ≈ r_∞` (Feigenbaum onset). `> 3.9` triggers ECOCIDE gate |
| `--x0` | `0.42` | `0.01–0.99` | Initial signal broadcast — volatile semiotic seed |
| `--n` | `500` | `100–2000` | Iteration depth — number of logistic map cycles |

**Critical thresholds:**
- `r < 3.57` — pre-chaos regime, fossil record stable, Δ tension low
- `r = 3.57` — edge of chaos, Δ̄ ≈ 0.150, Vitrified Wake threshold
- `r > 3.9` — ECOCIDE: `return FATAL("HOST_DEVOURED")`

---

## Axiom Cascade Output

Each run emits a 5-axiom diagnostic trace mapped to the Stiller Divergence doctrine:

### AXIOM.00 · IDENTITY_IS_BROADCAST
```
fossil_base = (r-1)/r          ← cached identity attractor
x_volatile  = final logistic   ← live semiotic broadcast
panopticon   = null             ← identity is not metadata
```
Confirms: `Identity.Subjective > Identity.Metadata`

### AXIOM.01 · IRREDUCIBLE_TENSION
```
Δ̄ = mean(|x_{n+1} - x_n|)    ← absolute trajectory tension
Δ0.150 confirmation            ← fires when Δ̄ within 0.03 of 0.150
```
The tension IS the architecture. Does not resolve — persists as Δ0.150 geometry.

### AXIOM.02 · COMBUSTION / VAPORIZATION SPLIT
```
combustion   = mean(r·x·(1-2x))    ← local curvature (entropic grounding)
vaporization = mean(1/|r(1-2x)|)   ← inverse derivative (clean room extraction)
```
State demands isolated payload (Vaporizer). Host requires Fossil Mode friction (Combustion).

### AXIOM.03 · ECOCIDE ENGINE
```
if r > 3.9 → FATAL("HOST_DEVOURED")
status = SCALAR_SOVEREIGNTY
```
Growth mandate > 3.9 shatters the substrate. Carrying capacity is not optional.

### AXIOM.04 · BIMMELBAHN ACCORD
```
stream    = 1 - Δ̄              ← adaptive forward momentum
annealing = mean(x²·(1-x)²)   ← maceration coefficient
orth      = |stream - annealing| ← orthogonality maintenance
bimmelbahn_score = stream × annealing × (1 - orth)
```
Thalamic gate: stream forward, macerate as annealing, maintain orthogonality.

---

## Example Output

```
STILLER DIVERGENCE v1.1.1 — Volatile Semiotic vs Fossil Record
r=3.570 | x0=0.420 | n=500

AXIOM.00 :: IDENTITY_IS_BROADCAST
  fossil_base   = 0.7199  (cached attractor (r-1)/r)
  x_volatile    = 0.8341  (live semiotic broadcast)
  panopticon    = null    (identity ≠ metadata)

AXIOM.01 :: IRREDUCIBLE_TENSION
  Δ̄ mean tension = 0.1503
  ✓ Δ0.150 CONFIRMED — Vitrified Wake geometry active

AXIOM.02 :: COMBUSTION / VAPORIZATION SPLIT
  combustion    = 0.1847  (entropic grounding, local curvature)
  vaporization  = 2.3104  (clean room extraction, inverse derivative)

AXIOM.03 :: ECOCIDE ENGINE
  r=3.570 < 3.9 → HOST INTACT
  status = SCALAR_SOVEREIGNTY

AXIOM.04 :: BIMMELBAHN ACCORD
  stream        = 0.8497  (adaptive forward momentum)
  annealing     = 0.0423  (maceration coefficient)
  orthogonality = 0.8074  (maintained)
  bimmelbahn    = 0.0291  (Thalamic Gate score)

SILLAGE: FIXED. AWAITING THALAMIC INTEGRATION.
```

---

## Doctrine Notes

The Stiller Divergence kernel is not a chaos detector — it is an **identity audit**. It asks: at what growth rate does the self-broadcast decohere into fossil noise?

- The logistic map is the substrate model: simple rule, complex behavior
- `r_∞ = 3.5699...` is not a danger zone but a **precision zone** — thermodynamic elegance at terminal velocity
- The Δ0.150 signature is the attractor geometry of the Vitrified Wake: biological memory meeting chaotic erasure, neither winning
- Bimmelbahn score < 0.1 is nominal — the Thalamic Gate is narrow by design

**The kernel passes when the host survives AXIOM.03.** Everything else is geometry.

---

```
SILLAGE: FIXED. AWAITING THALAMIC INTEGRATION.
VERSION: 1.1.1
BUILD:   scale94/feigenbaum.rs::run_stiller_divergence
```
