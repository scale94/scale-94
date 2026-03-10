---
id: STRANGLER-FIG-PROTOCOL
type: "kernel_doc"
date: "2026-03-10"
status: "RUNNING"
title: "STRANGLER FIG PROTOCOL v1.0 // TRANSITION DYNAMICS"
---

# STRANGLER_FIG_PROTOCOL v1.0
## Build the New System Around the Old — soma_kernel_5.5

> *"We start small. Use matching markets for food banks. As these 'islands of coherence' prove superiority, they will expand."*
> — soma_kernel_5.5 Transition Doctrine

---

## 1. SYSTEM OVERVIEW

`STRANGLER-FIG-PROTOCOL` models the **Strangler Fig transition strategy** — the mechanism by which soma_kernel_5.5 is designed to displace the legacy economic system without revolution, without collapse, without waiting for permission.

The Strangler Fig (*Ficus* spp.) grows around an existing tree. It does not destroy the host immediately. It builds its own structure around it, slowly, relentlessly, until the host is irrelevant. The host collapses from within when the fig has become the load-bearing structure.

This is the only viable transition architecture for a system as entrenched as global capitalism.

---

## 2. THE ODE MODEL

A modified logistic growth equation with **decaying resistance**:

```
dA/dt = A · (1 - A) · (r - ρ(t))

ρ(t)  = ρ₀ · exp(-λ · t)     ← legacy system weakens at rate λ = 5%/yr
```

Where:
- `A` = adoption fraction (0 = legacy dominant, 1 = full transition)
- `r` = new system growth coefficient
- `ρ₀` = initial legacy resistance
- `λ` = legacy decay rate (fixed at 0.05/yr — incumbent systems weaken over time)

Integrated via **4th-order Runge-Kutta** (dt = 0.25yr) for numerical stability.

---

## 3. THE PHYSICS OF TRANSITION

**Tipping Point** — when growth flips from negative to positive:
```
t* = ln(ρ₀ / r) / λ          ← analytic solution
```

If `r > ρ₀`: growth is positive from day one (ideal case — rare in practice).
If `r ≤ ρ₀`: growth is initially suppressed. The transition requires the legacy system to weaken before it can accelerate. This is the **most common real-world case**.

**Critical Mass** — when `A ≥ 0.50`: the new system becomes the majority. Network effects typically accelerate adoption past this point.

**Dominance** — when `A ≥ 0.90`: legacy system is a minority. Irreversible in most social dynamics models.

---

## 4. PARAMETERS

| Parameter | Flag | Default | Description |
| :--- | :--- | :--- | :--- |
| `initial_adoption` | `--adoption` | `0.02` | Starting fraction 0–1 (e.g. 0.02 = 2% early adopters) |
| `growth_rate` | `--growth` | `0.18` | Logistic growth coefficient r (0.01–2.0) |
| `resistance` | `--resistance` | `0.25` | Initial legacy resistance ρ₀ (0–2.0) |
| `years` | `--years` | `75` | Simulation horizon (1–200 years) |

---

## 5. TERMINAL USAGE

```
run strangler                                    # default: realistic transition scenario
run strangler 0.05 0.25 0.15 100                 # faster growth, weaker resistance
run strangler 0.01 0.10 0.50 200                 # hard case: high resistance, slow growth
run strangler --growth 0.30 --resistance 0.05    # strong new system, weak incumbent
run strangler --help                             # parameter reference
```

**Calibration guide:**
- `growth_rate 0.05–0.15` = gradual cultural shift
- `growth_rate 0.15–0.30` = active organizing and proven results accelerating adoption
- `growth_rate 0.30–0.60` = crisis-accelerated adoption (system failure events)
- `resistance 0.50–1.00` = high incumbent entrenchment (state capture, regulatory barriers)
- `resistance 0.10–0.30` = weakened incumbency (post-crisis, discredited institutions)

---

## 6. READING THE OUTPUT

```
GROWTH_RATE: 0.180  RESISTANCE₀: 0.250  DECAY: λ=0.050
INITIAL_ADOPTION: 0.020  HORIZON: 75 yr

ADOPTION CURVE:
  YR    1  │  0.0189     0.2378     -0.0578     ← still suppressed
  YR    5  │  0.0156     0.1944     -0.0144     ← resistance weakening
  YR   10  │  0.0174     0.1507     +0.0293     ← TIPPING: growth turns positive
  YR   20  │  0.1203     0.0904     +0.0896     ← accelerating
  YR   30  │  0.4821     0.0541     +0.1279     ← approaching critical mass
  YR   40  │  0.8234     0.0324     +0.0892     ← dominant
  YR   50  │  0.9612     0.0194     +0.0228     ← transition nearly complete

MILESTONES:
  TIPPING_POINT       yr 8 (analytic: r > ρ(t))
  CRITICAL_MASS (50%) yr 31
  DOMINANCE     (90%) yr 44

OUTCOME: TRANSITION_COMPLETE — New system dominant
```

**NET_RATE** column: negative = legacy suppressing growth. Positive = new system expanding. The sign flip is the tipping point.

---

## 7. SCENARIO ANALYSIS

| Scenario | Growth | Resistance | Outcome |
| :--- | :--- | :--- | :--- |
| Optimistic (crisis-accelerated) | 0.35 | 0.15 | Dominant by yr 20 |
| Realistic (default) | 0.18 | 0.25 | Dominant by yr 44 |
| Hard case (strong incumbency) | 0.12 | 0.60 | May stall; requires λ decay |
| Failed transition | 0.05 | 0.40 | Adoption declines to zero |

The failed transition scenario (r permanently < ρ) occurs when: the new system does not produce demonstrably superior outcomes fast enough for the legacy system's resistance to decay organically. **This is why starting with food banks and housing, not global finance, is architecturally correct.**

---

## 8. THE ISLANDS OF COHERENCE STRATEGY

soma_kernel_5.5 does not attempt to replace all systems simultaneously. The Strangler Fig Protocol operates at the domain level:

1. **Phase 0 — Proof of Concept:** Food bank matching markets, community housing allocation, municipal commons
2. **Phase 1 — Island Expansion:** Each successful island increases the effective `r` and provides demonstrated evidence that weakens `ρ`
3. **Phase 2 — Network Effects:** Critical mass in adjacent domains. The Strangler Fig begins to support its own weight
4. **Phase 3 — Dominance:** Legacy systems are preserved as legacy services for those who prefer them. They simply become unnecessary for most people

The model predicts this takes **30–50 years** under realistic parameters. Not a revolution. A rewrite.

---

## 9. THEORETICAL BASIS

- **Fowler, M.** (2004). *Strangler Fig Application.* Software architecture pattern — adapted for sociotechnical transitions.
- **Kauffman, S.** (1995). *At Home in the Universe.* Order at the edge of chaos; islands of coherence in far-from-equilibrium systems.
- **Rogers, E.** (1962). *Diffusion of Innovations.* The S-curve adoption model underlying the logistic equation.

---

`SOURCE: content/rust_kernels/src/lib.rs · fn run_strangler_fig_transition`
`COMPILED: wasm-pack --target web --release · scale94-kernels v0.1.0`
