---
id: CEEI-SIM-KERNEL-1.0.0
type: "kernel_doc"
date: "2026-03-10"
status: "RUNNING"
title: "A-CEEI ALLOCATION ENGINE v1.0 // PREFERENCE-BASED MARKETS"
---

## The End of the Price Tag — soma_kernel_5.5

> *"You cannot simply choose what you want; you must also be chosen."*
> — Alvin Roth, Nobel Laureate in Economics (2012)

---

## 1. SYSTEM OVERVIEW

`CEEI-ALLOCATION-ENGINE` implements a simplified **Approximate Competitive Equilibrium from Equal Incomes** — the allocation mechanism at the heart of soma_kernel_5.5's resource distribution layer.

The core premise: in a post-price economy, goods are allocated not by who can pay the most, but by whose preferences align best with available supply. Each agent receives an **equal budget** (equal income constraint), and the system finds a price vector where demand clears supply — the Walrasian Equilibrium.

The result is mathematically **envy-free** and **Pareto-efficient** under the right conditions. No billionaire can outbid you for food. You simply express what you value.

---

## 2. THE MECHANISM

### 2.1 Setup
- **N agents** each receive equal budget B = 1.0
- **M goods** with fixed aggregate supply `S_j = total_budget / M`
- Each agent has a **preference profile** `w_ij` (utility weights summing to 1)
- Inequality parameter shifts budget distribution; diversity parameter spreads preferences

### 2.2 Walrasian Tâtonnement
The price adjustment algorithm used in classical general equilibrium theory:

```
For each iteration (max 200):
  1. Each agent maximises log-linear utility:
     x*_ij = w_ij · B_i / p_j          ← Cobb-Douglas optimal demand

  2. Compute excess demand:
     e_j = Σ_i x*_ij - S_j

  3. Adjust prices toward equilibrium:
     p_j ← max(0.01, p_j + α · e_j / S_j)

  4. Check convergence: max|e_j| < 0.001 → stop
```

### 2.3 Envy-Freeness
After equilibrium, the system measures **envy**:
```
envy_i = max over k≠i of: max(0, U_i(allocation_k) - U_i(allocation_i))
```
Perfect envy-freeness: `max_envy = 0`. Approximate: `max_envy < 0.01`.

---

## 3. PARAMETERS

| Parameter | Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `agents` | `--agents` | `20` | Number of allocation participants (2–50) |
| `goods` | `--goods` | `8` | Number of distinct goods/resources (2–20) |
| `inequality` | `--inequality` | `0.3` | Budget spread 0–1 (0 = perfectly equal incomes) |
| `diversity` | `--diversity` | `0.7` | Preference heterogeneity 0–1 (0 = uniform wants) |

---

## 4. TERMINAL USAGE

```
run ceei                             # default: 20 agents, 8 goods, moderate inequality
run ceei 50 12 0.0 0.9               # max diversity, equal incomes
run ceei --agents 30 --inequality 0  # pure CEEI (equal incomes)
run ceei --help                      # parameter reference
```

**Set `inequality = 0`** to simulate the soma_kernel_5.5 ideal: perfectly equal starting budgets. Watch envy-freeness approach zero. This is what Roth's mechanism guarantees.

**Set `diversity = 0.1`** for near-uniform preferences — prices converge to uniform and allocation becomes nearly equal shares.

---

## 5. READING THE OUTPUT

```
EQUILIBRIUM_PRICES:
   p0=1.234 p1=0.891 p2=1.456 ...

ALLOCATION_METRICS:
  ENVY_STATUS         APPROX_EF           ← Approximately envy-free
  MAX_ENVY_INDEX      0.003421            ← Very low residual envy
  PARETO_EFFICIENCY   0.9874              ← Near-optimal
  GINI_COEFFICIENT    0.1823              ← Low inequality of outcomes
  MEAN_UTILITY        0.4231
  UTILITY_RANGE       [0.3102, 0.5441]
```

**ENVY_STATUS** levels:
- `ENVY-FREE` — max_envy < 0.01 (mechanism guarantee achieved)
- `APPROX_EF` — max_envy < 0.1 (acceptable approximation)
- `ENVY_PRESENT` — high inequality inputs produce residual envy

**GINI_COEFFICIENT** measures the inequality of utility outcomes. Even with moderate budget inequality (Gini input), the preference-matching often produces more equal utility outcomes than raw wealth-based allocation.

---

## 6. WHY THIS MATTERS

**The current system:** You buy what you can afford. The wealthy outbid everyone. The outcome is allocation based on Exchange Value, not use value or preference.

**The soma_kernel_5.5 system:** You express preferences. Equal budgets compete in a mathematical market. The outcome is envy-free — no one would prefer someone else's bundle given their own preferences.

This is the algorithmic implementation of Roth's insight: **matching markets outperform price markets when preference matters more than wealth**.

Applied targets: food banks, housing allocation, school choice, organ donation, public resource commons.

---

## 7. THEORETICAL BASIS

- **Budish, E.** (2011). *The Combinatorial Assignment Problem: Approximate Competitive Equilibrium from Equal Incomes.* Journal of Political Economy.
- **Roth, A. & Sotomayor, M.** (1990). *Two-Sided Matching: A Study in Game-Theoretic Modeling and Analysis.*
- **Arrow, K. & Debreu, G.** (1954). *Existence of an Equilibrium for a Competitive Economy.* Econometrica.

---

`SOURCE: content/rust_kernels/src/lib.rs · fn run_ceei_allocation_engine`
`COMPILED: wasm-pack --target web --release · scale94-kernels v0.1.0`
