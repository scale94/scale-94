---
id: DALY-THERMO-SIMULATION
type: "kernel_doc"
date: "2026-03-10"
status: "RUNNING"
title: "DALY THERMO SIMULATION v1.0 // THERMODYNAMIC GOVERNOR"
---

# DALY_THERMO_SIMULATION v1.0
## The Hard Constraints Engine — soma_kernel_5.5

> *"Economics is a subsystem of the biosphere. You cannot negotiate with physics."*
> — Herman Daly, Nobel Prize–adjacent ecological economist

---

## 1. SYSTEM OVERVIEW

`DALY-THERMO-SIMULATION` is the thermodynamic core of soma_kernel_5.5. It integrates three coupled differential equations over a configurable time horizon, enforcing the **Daly Rules** — the hard ecological constraints that define the boundary between a sustainable economy and civilizational collapse.

This is not a metaphor. These are physics.

---

## 2. THE THREE DALY RULES

| Rule | Constraint | Condition | Status Check |
| :--- | :--- | :--- | :--- |
| **Rule 1 · Renewable** | Harvest ≤ Regeneration | Consumption / Regeneration ≤ 1.0× | PASS / BREACH |
| **Rule 2 · Pollution** | Waste ≤ Absorption | Waste / Absorption Capacity ≤ 1.0× | PASS / BREACH |
| **Rule 3 · Non-Renewable** | Depletion ≤ Substitution | Depletion Rate / Sub Rate ≤ 1.0× | PASS / BREACH |

When any rule is breached, entropy accumulates. Entropy accumulation drives the **Fragmentation Index** — the probability that societal coherence begins to dissolve.

---

## 3. THE SIMULATION ENGINE

Three ODEs integrated annually via Euler method:

**Renewable Stock R(t)**
```
R(t+1) = R(t) + (G_eff - C) / G₀
G_eff  = G₀ · R(t) · (1 - P(t) · 0.15)   ← pollution degrades regeneration
```

**Pollution Stock P(t)**
```
P(t+1) = P(t) + (W - A_eff) / A₀
A_eff  = A₀ · (1 - saturation)            ← absorption degrades under load
```

**Non-Renewable NR(t)**
```
NR(t+1) = clamp(NR(t) + S - D, 0, 2.0)
```

**Entropy Production σ(t)** — Clausius–Duhem inequality:
```
σ(t) = (C/G) · ln(C/G)    when C > G  (thermodynamic dissipation from overshoot)
σ(t) = 0                   when C ≤ G  (no irreversible entropy production)
```

**Fragmentation Index F(t)**
```
F(t) = 1 - exp(-H(t) · 0.08)            H = cumulative entropy
```
When F > 0.5: **CRITICAL** phase. When R ≤ 0.05 or P ≥ 8.0: **COLLAPSE**.

---

## 4. PARAMETERS

| Parameter | Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `consumption` | `--consumption` | `80.0` | Renewable energy consumption GJ/capita/yr (global avg ~80) |
| `regeneration` | `--regeneration` | `30.0` | Biosphere regeneration capacity GJ/capita/yr (~30) |
| `waste` | `--waste` | `55000.0` | Global waste output Mt CO₂eq/yr (~55,000) |
| `absorption` | `--absorption` | `11000.0` | Natural sink capacity Mt/yr (~11,000) |
| `nr_depletion` | `--depletion` | `0.025` | Non-renewable depletion fraction/yr |
| `substitution` | `--sub` | `0.008` | Renewable substitution rate fraction/yr |
| `years` | `--years` | `100.0` | Simulation horizon (1–500 years) |

---

## 5. TERMINAL USAGE

```
run daly                                          # default: current-world parameters (COLLAPSE)
run daly 25 30 11000 12000 0.01 0.03 200          # sustainable scenario
run daly --consumption 40 --years 150             # named flags
run daly --help                                   # parameter reference
```

**Current world defaults deliberately produce COLLAPSE** — consumption is ~2.7× regeneration capacity, waste is 5× absorption. This is the diagnostic. The parameters are the prescription.

---

## 6. READING THE OUTPUT

```
HORIZON: 100 yr  |  STATUS: COLLAPSE
DALY RULES AUDIT:
  Rule 1 (Renewable)   Harvest/Regen = 2.667×  [BREACH]
  Rule 2 (Pollution)   Waste/Absorb  = 5.000×  [BREACH]
  Rule 3 (Non-renew)   Dep/Sub ratio = 3.125×  [BREACH]
SIMULATION TRACE:
  YR   10  │ R_STOCK: 0.8521   P_STOCK: 0.1102   NR: 0.8750   H: 0.2841
  YR   25  │ R_STOCK: 0.6143   P_STOCK: 0.3821   ...
TIPPING_POINT:  yr 31
COLLAPSE_YEAR:  yr 67
```

Key metrics: `FRAGMENTATION_IDX` is the probability of societal dissolution. `ECOLOGICAL_DEBT` is the percentage of baseline resource stock already consumed past recovery.

---

## 7. THEORETICAL BASIS

- **Daly, H.** (1990). *Toward some operational principles of sustainable development.* Ecological Economics.
- **Prigogine, I.** (1967). *Introduction to Thermodynamics of Irreversible Processes.* Entropy production framework.
- **Steffen, W. et al.** (2015). *Planetary boundaries: Guiding human development on a changing planet.* Science.

---

`SOURCE: content/rust_kernels/src/lib.rs · fn run_daly_thermo_simulation`
`COMPILED: wasm-pack --target web --release · scale94-kernels v0.1.0`
