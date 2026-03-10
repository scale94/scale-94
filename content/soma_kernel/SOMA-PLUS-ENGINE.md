---
id: SOMA-PLUS-ENGINE
type: "kernel_doc"
date: "2026-03-10"
status: "RUNNING"
title: "SOMA PLUS ENGINE v1.0 // SOCIAL CAPITAL ACCUMULATION"
---

## Status Is Earned Through the Commons — soma_kernel_5.5

> *"If robots do the work, what do humans do? soma_kernel_5.5 answers: Survival is guaranteed; status is earned."*

---

## 1. SYSTEM OVERVIEW

`SOMA-PLUS-ENGINE` models the accumulation of **Soma Plus** — the social capital currency of soma_kernel_5.5's post-scarcity economy.

In a world where material survival is guaranteed by automation and commons-based allocation, status can no longer be anchored to wealth or labor-market participation. It must be earned by **contributing to things that matter**. Soma Plus is the accounting system for that contribution.

It is not money. It cannot buy food (guaranteed). It buys **recognition, access to advanced resources, and social standing**. It decays without active contribution — there is no passive accumulation. You must remain engaged with the commons to maintain status.

---

## 2. CONTRIBUTION TYPES

| Type | Rate (SP/yr) | Description |
| :--- | :--- | :--- |
| **Ecological Care** | ~18 SP/yr | Reforesting, biodiversity monitoring, watershed restoration |
| **Social Care** | ~14 SP/yr | Child-rearing, elderly care, education, community health |
| **Arts & Culture** | ~22 SP/yr | Highest multiplier — cultural production is the apex contribution |
| **Passive** | 0 SP/yr | Survival guaranteed; Soma Plus requires active commons engagement |

Arts receive the highest multiplier because soma_kernel_5.5 treats **cultural production as the highest form of commons contribution** — it is the output that can only exist in a post-scarcity society.

---

## 3. STATUS TIERS

| Tier | SP Threshold | Rights & Recognition |
| :--- | :--- | :--- |
| **INITIATE** | 0 – 99 | Survival guaranteed. Basic commons access. |
| **CONTRIBUTOR** | 100 – 499 | Priority allocation in preference markets. Community voice. |
| **ARTISAN** | 500 – 1,999 | Access to advanced tools, materials, and networks. |
| **SOVEREIGN** | 2,000+ | Full cultural sovereignty. Node-level governance rights. |

---

## 4. THE SIMULATION MODEL

Each agent accumulates Soma Plus each cycle:
```
SP(t+1) = SP(t) · (1 - decay) + contribution_rate
decay   = 0.02  (2% per cycle — entropy of social capital)
```

Agents are stochastically assigned contribution types at initialization (seeded from parameters for deterministic output). The passive fraction (`1 - eco - social - arts`) contributes 0 SP.

Tier distribution is tracked at each snapshot year. The engine reports the Gini coefficient of the SP distribution — even with diverse contribution rates, the 2% decay acts as a natural equalizer preventing permanent aristocracy of Soma Plus.

---

## 5. PARAMETERS

| Parameter | Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `population` | `--pop` | `5000` | Number of agents (10–10,000) |
| `eco_share` | `--eco` | `0.35` | Fraction doing ecological care (0–1) |
| `social_share` | `--social` | `0.35` | Fraction doing social care (0–1) |
| `arts_share` | `--arts` | `0.20` | Fraction doing arts/culture (0–1) |
| `years` | `--years` | `50` | Simulation cycles (1–200) |

The remaining fraction `(1 - eco - social - arts)` is passive population.

---

## 6. TERMINAL USAGE

```
run soma                                  # default: 5000 agents, 50yr, mixed contributions
run soma 10000 0.5 0.3 0.2 100            # large pop, ecology-heavy, century simulation
run soma --arts 0.6 --years 25            # arts-dominant society, short horizon
run soma --pop 1000 --eco 0.8             # ecological commons economy
run soma --help                           # parameter reference
```

---

## 7. READING THE OUTPUT

```
CONTRIBUTION_MIX:
  ECOLOGICAL 35.0% | SOCIAL 35.0% | ARTS 20.0% | PASSIVE 10.0%

TIER EVOLUTION:
  YR    1  │ INITIATE: 5000  CONTRIBUTOR: 0  ARTISAN: 0  SOVEREIGN: 0  MEAN: 8.1
  YR    5  │ INITIATE: 3241  CONTRIBUTOR: 1759  ARTISAN: 0  SOVEREIGN: 0  MEAN: 52.4
  YR   25  │ INITIATE: 812   CONTRIBUTOR: 2341  ARTISAN: 1847  SOVEREIGN: 0  MEAN: 384.1
  YR   50  │ INITIATE: 621   CONTRIBUTOR: 1284  ARTISAN: 2891  SOVEREIGN: 204  MEAN: 612.7

FINAL DISTRIBUTION:
  MEAN_SP            612.7
  GINI_COEFFICIENT   0.3241     ← modest inequality, natural from contribution variance
  CONTRIBUTING_AGENTS  90.0%
```

The **Gini coefficient** of Soma Plus is typically 0.25–0.45 — lower than current wealth Ginis (0.8+), higher than perfectly equal (0.0). The 2% decay prevents SP accumulation into permanent dynasties.

---

## 8. DESIGN PRINCIPLES

**Why decay?** Without decay, early contributors accumulate status permanently without ongoing participation. The decay rate ensures status must be continuously renewed through active commons engagement — it cannot be inherited or banked indefinitely.

**Why Arts > Ecology > Social in rate?** Cultural production is the rarest and most irreplaceable contribution. Ecological care is essential but scalable. Social care is critical but more evenly distributed. The differential rates guide optimal commons contribution allocation.

**Why passive survival guarantee?** Removing survival from the status competition is the architectural prerequisite for everything else. If survival is contingent on participation, Soma Plus becomes coercive. With survival guaranteed, Soma Plus becomes genuinely voluntary status.

---

## 9. THEORETICAL BASIS

- **Sen, A.** (1999). *Development as Freedom.* The Substantive Freedoms framework.
- **Ostrom, E.** (1990). *Governing the Commons.* Nobel Prize 2009. Community self-management.
- **Graeber, D.** (2018). *Bullshit Jobs.* On the uncoupling of labor from meaning.

---

`SOURCE: content/rust_kernels/src/lib.rs · fn run_soma_plus_engine`
`COMPILED: wasm-pack --target web --release · scale94-kernels v0.1.0`
