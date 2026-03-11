---
id: FUSION-PLASMA-KERNEL-1.0
type: "kernel_doc"
date: "2026-03-11"
status: "ACTIVE"
title: "FUSION PLASMA KERNEL · 1.0.0 · PLASMA SOVEREIGNTY AUDIT"
---

# ᛟ FUSION PLASMA KERNEL · 1.0.0
## THERMODYNAMIC AUDIT · LAWSON CRITERION · Q-FACTOR LEDGER

---

> **VERSION** · 1.0.0 · BOSCH-HALE REACTIVITY · IPB98(y,2) CONFINEMENT SCALING
> **STATUS** · ᛞ ACTIVE · PLASMA SOVEREIGNTY AUDIT LIVE
> **AXIOM** · *The plasma does not negotiate. The Lawson criterion is the only permit authority that matters. Every confinement second below ignition threshold is a thermodynamic debt the machine cannot repay from within.*

---

## ᚱ I. SYSTEM PREAMBLE

The Fusion Plasma Kernel operates as a **Plasma Sovereignty Auditor**. It does not evaluate fusion reactor proposals by engineering optimism or project milestone schedules. It applies the only accounting system that cannot be falsified: **plasma physics and thermodynamics**.

A fusion reactor is a machine attempting to borrow energy from a star. The loan terms are set by the Lawson criterion, enforced by the Troyon limit, and collected by the Greenwald density threshold. The kernel audits all five dimensions of the energy balance and issues a sovereignty ruling.

The default parameters model the **ITER Q=10 operating point**: the first reactor-class machine designed to demonstrate net energy gain. Running `run fusion` at defaults situates the audit at the boundary where the Lawson criterion becomes achievable — and shows exactly which modules are in surplus and which are in deficit.

---

## ᚹ II. MODULE 01 · LAWSON TRIPLE PRODUCT

### ⌇ 2.1 The Lawson Criterion

The fundamental ignition threshold for D-T fusion, derived by John D. Lawson (1957):

```
n × T × τ_E ≥ 5 × 10²¹   keV·s/m³

Where:
  n     = electron density (m⁻³)
  T     = ion temperature (keV)
  τ_E   = energy confinement time (s)
  5×10²¹ = D-T ignition threshold (keV·s/m³)
```

The triple product is the single most important figure of merit in fusion research. All three variables must be optimised simultaneously. Improving one at the cost of another does not increase the product.

### ⌇ 2.2 Triple Product Audit Thresholds

| Status | nTτ (keV·s/m³) | Classification | Ruling |
|:-------|:--------------:|:---------------|:------:|
| **IGNITION_THRESHOLD_EXCEEDED** | ≥ 5×10²¹ | Ignition — self-sustaining burn | ✓ Green |
| **IGNITION_APPROACH** | ≥ 1.5×10²¹ | Reactor-class — Q ≥ 10 accessible | ⚠ Amber |
| **SCIENTIFIC_REGION** | ≥ 3×10²⁰ | Experimental regime — JET/DIII-D | ✗ Red |
| **BELOW_BREAKEVEN** | < 3×10²⁰ | Pre-reactor — energy audit fails | ✗✗ Veto |

**Historical milestones:**
- JET 1997 (record at the time): nTτ ≈ 8.7×10²⁰ → SCIENTIFIC_REGION
- NIF 2022 ignition shot: nTτ ≈ 1.5×10²¹ → IGNITION_APPROACH (ICF geometry)
- ITER design target: nTτ ≈ 3×10²¹ → IGNITION_APPROACH
- Power plant requirement: nTτ > 5×10²¹ → IGNITION_THRESHOLD_EXCEEDED

---

## ᚷ III. MODULE 02 · FUSION POWER & Q-FACTOR

### ⌇ 3.1 D-T Reactivity — Bosch-Hale Parameterisation

The Maxwell-averaged D-T fusion reactivity `<σv>` is the central quantity of fusion power calculations. Every MW of fusion power statement reduces to this function:

```
P_fusion = n_D × n_T × <σv>(T) × E_DT × V_plasma

<σv>(T) — Bosch & Hale, Nuclear Fusion 32(4), 611–631 (1992)

Gamow-peak parameterisation:
  θ   = T / (1 − T(C₂ + T(C₄ + TC₆)) / (1 + T(C₃ + T(C₅ + TC₇))))
  ξ   = (B_G² / 4θ)^(1/3)
  <σv> = C₁ × θ × √(ξ / (m_r·c² × T³)) × exp(−3ξ)   [m³/s]

D-T coefficients (Table IV):
  B_G   = 34.3827 keV^(1/2)     C₁ = 1.17302×10⁻⁹ cm³/s
  m_r·c² = 1,124,656 keV        C₂ = 1.51361×10⁻²
  C₃ = 7.51886×10⁻²             C₄ = 4.60643×10⁻³
  C₅ = 1.35000×10⁻²             C₆ = −1.06750×10⁻⁴
  C₇ = 1.36600×10⁻⁵
```

**Reactivity reference values:**

| T_i (keV) | <σv> (m³/s) | Context |
|:---------:|:-----------:|:--------|
| 5 | ~1.8×10⁻²³ | Below ITER operating range |
| 10 | ~1.1×10⁻²² | ITER Q=10 design point |
| 15 | ~2.7×10⁻²² | Near peak engineering point |
| 20 | ~4.3×10⁻²² | Above ITER, pilot plant range |
| 64 | ~8.8×10⁻²² | Global D-T reactivity maximum |

### ⌇ 3.2 Q-Factor Ledger

```
Q = P_fusion / P_external

Q < 1     → PLASMA_DEFICIT   — machine consumes more than it produces
Q = 1     → Scientific Breakeven (P_fusion = P_ext)
Q = 10    → ITER design target — threshold for "reactor-relevant" operation
Q → ∞     → Ignition — self-sustaining alpha heating, external power off
```

**Fuel dilution correction:** In a D-T plasma with He-4 ash fraction f_He, the deuterium and tritium densities are diluted. The fusion power is reduced by a factor of [(1−f_He)/(2(1+f_He))]² relative to a pure DT plasma. At f_He = 10%, fusion power drops by ~30%.

**Bremsstrahlung radiation loss:**
```
P_brem/vol = 5.34×10⁻³⁷ × Z_eff × n_e² × √T_keV   [W/m³]

Z_eff = (1 + 3·f_He) / (1 + f_He)
```

---

## ᚾ IV. MODULE 03 · PLASMA STABILITY LEDGER

### ⌇ 4.1 Normalised Beta — Troyon Limit

Magnetohydrodynamic stability requires the plasma pressure to remain below the magnetic confinement pressure. The normalised beta parameter:

```
β_N = β_t[%] × a[m] × B_T[T] / I_p[MA]

Where:
  β_t = 2μ₀ × (2n·kT) / B² = total toroidal beta (dimensionless)
  a   = minor radius (m)
  B_T = toroidal field (T)
  I_p = plasma current (MA)

Troyon-Sykes-Wesson limit:
  β_N ≤ 2.8  — standard operating limit
  β_N ≤ 3.5  — advanced scenarios with active stabilisation
  β_N > 3.5  — disruption — field topology collapses — EMERGENCY
```

A disruption is not a soft failure mode. It deposits the entire plasma energy (~400 MJ in ITER) onto the first wall in milliseconds. The Troyon limit is a hard structural boundary.

### ⌇ 4.2 Greenwald Density Limit

Maximum plasma density before density-driven disruption:

```
n_G = I_p / (π × a²)   [10²⁰ m⁻³]   (I_p in MA, a in m)

f_G = n_e / n_G   (Greenwald fraction)

f_G < 0.70  → GREENWALD_CLEAR
f_G < 0.85  → GREENWALD_ELEVATED — caution
f_G ≥ 0.85  → GREENWALD_LIMIT_WARNING — disruption risk
f_G ≥ 1.0   → GREENWALD_DISRUPTION — ᛉ EMERGENCY
```

---

## ᛉ V. MODULE 04 · CONFINEMENT AUDIT

### ⌇ 5.1 IPB98(y,2) Empirical Scaling Law

The energy confinement time cannot be computed from first principles for turbulent fusion plasmas. The ITER Physics Basis (1999) empirical scaling law — derived from multi-machine databases — predicts confinement:

```
τ_E^IPB98 = 0.0562 × I_p^0.93 × B_T^0.15 × n₁₉^0.41 × P^(−0.69)
                   × R^1.97 × ε^0.58 × κ^0.78 × M^0.19

Where:
  I_p  = plasma current (MA)
  B_T  = toroidal magnetic field (T)
  n₁₉  = line-averaged electron density (10¹⁹ m⁻³)
  P    = total loss power = P_alpha + P_external (MW)
  R    = major radius (m)
  ε    = a/R = inverse aspect ratio
  κ    = plasma elongation
  M    = average ion mass (amu) — D-T: 2.5 amu → M^0.19 = 1.190
```

**H-factor audit:**
```
H₉₈ = τ_E_actual / τ_E_IPB98

H < 0.6   → CONFINEMENT_COLLAPSE — severe degradation
H < 0.8   → CONFINEMENT_DEGRADED — sub-standard
H ≈ 1.0   → CONFINEMENT_NOMINAL — IPB98 baseline
H > 1.2   → CONFINEMENT_ENHANCED — H-mode, ITBs (verify assumptions)
H > 1.5   → CONFINEMENT_IMPLAUSIBLE — input data suspect
```

ITER requires H ≥ 1.0 to achieve Q=10. Standard H-mode operation achieves H ≈ 1.0–1.1.

---

## ᚹ VI. MODULE 05 · FUEL PURITY & NEUTRON WALL LOADING

### ⌇ 6.1 Helium Ash Dilution

Alpha particles produced by D-T fusion thermalise in the plasma and accumulate as helium-4 ash. Without exhaust through the divertor, ash dilutes the fuel:

```
f_He = n_He / n_i   (helium fraction of total ion density)

Fusion power dilution factor = [(1−f_He) / (2(1+f_He))]²

f_He < 0.05  → FUEL_PURE
f_He < 0.10  → ASH_ELEVATED — exhaust systems stressed
f_He < 0.20  → ASH_ACCUMULATION — fuel crisis — divertor failure
f_He ≥ 0.20  → ASH_CATASTROPHE — plasma quench imminent — ✗✗ VETO
```

### ⌇ 6.2 Neutron Wall Loading

In D-T fusion, 80.1% of the fusion energy is carried by 14.1 MeV neutrons — uncharged, unconfined by the magnetic field, deposited in the first wall and blanket:

```
P_neutron = P_fusion × (14.1 / 17.6)   [W]

Wall loading = P_neutron / A_wall   [MW/m²]

A_wall ≈ 4π² × R × a × √((1+κ²)/2)   (elongated torus surface)

< 0.5 MW/m²  → WALL_WITHIN_SPEC — current materials adequate
0.5–1.0      → WALL_ENGINEERING_LIMIT — ITER design territory (~0.57 MW/m²)
1.0–2.0      → WALL_STRESS_ZONE — materials R&D required
> 2.0 MW/m²  → WALL_MATERIAL_FAILURE — ᛉ EMERGENCY
```

Material integrity under neutron bombardment is the central materials science challenge of fusion energy. The 14.1 MeV neutrons displace lattice atoms and transmute structural materials on a timescale that determines reactor service life.

---

## ᛟ VII. PLASMA SOVEREIGNTY RULING REGISTRY

| Code | Status | Trigger |
|:-----|:-------|:--------|
| `IGNITION_NOMINAL` | Full sovereignty — all five modules clear, Q ≥ 10 | Triple product ≥ 5×10²¹, all modules ✓ |
| `SCIENTIFIC_BREAKEVEN_ACHIEVED` | Q ≥ 1 confirmed | Q-factor ≥ 1.0, no veto indicators |
| `PLASMA_GAIN_REGISTERED` | Positive gain regime | Q ≥ 0.1, operating point viable |
| `OPERATING_POINT_DEFERRED` | Confinement or power deficit | Any red indicator |
| `IGNITION_REJECTED` | Hard refusal | Beta > Troyon limit or Greenwald breached |
| `PLASMA_QUENCH_ORDER` | Immediate shutdown | β_N > 3.5 or n > n_Greenwald |

---

## ᚷ VIII. KERNEL LAWS

> **Law Ⅰ · The Lawson Sovereignty Law**
> *The plasma does not negotiate. The triple product nTτ is the only currency that purchases ignition. No project schedule can defer a thermodynamic debt.*

> **Law Ⅱ · The Troyon Disruption Law**
> *β_N > 3.5 is not an operating point. It is a structural failure. The magnetic field cannot contain pressure it was not dimensioned for. The disruption is not a risk — it is a consequence.*

> **Law Ⅲ · The Helium Ash Law**
> *The product of the reaction becomes the enemy of the reaction. Helium accumulation above 10% is not a pollution problem — it is the reactor quenching itself. The divertor is not optional.*

> **Law Ⅳ · The Confinement Audit Law**
> *τ_E actual must be validated against IPB98(y,2) empirical scaling. An H-factor claim above 1.5 is not a confinement achievement — it is a measurement error or an implausible input assumption.*

> **Law Ⅴ · The Neutron Wall Law**
> *The neutrons carry the bill. 80% of D-T fusion energy deposits in the structural material. Wall loading above 2 MW/m² is not an engineering challenge — it is material failure on a known timescale.*

---

## ⌇ DEFAULT PARAMETERS — ITER Q=10 OPERATING POINT

```
run fusion
→ temp_kev=10.0  density=1.0  tau_e=3.7  b_field=5.3
  major_radius=6.2  minor_radius=2.0  plasma_current=15.0
  input_power=50.0  elongation=1.7  helium_fraction=0.05

Expected output: Q ≈ 10-14, nTτ ≈ 3.7×10²¹, H ≈ 1.0
RULING: SCIENTIFIC_BREAKEVEN_ACHIEVED / PLASMA_SOVEREIGNTY_NOMINAL
```

**High-performance scenario (pilot plant class):**
```
run fusion --temp 15 --density 1.2 --tau 5.0 --field 6.5 --r 7.0 --a 2.2 --ip 17 --power 40 --kappa 1.9 --he 0.03
→ Q >> 10, nTτ > 5×10²¹
RULING: IGNITION_NOMINAL
```

**Disruption scenario:**
```
run fusion --density 1.5 --ip 10 --a 1.5
→ f_G > 1.0 → PLASMA_QUENCH_ORDER
```

---

*Rust compilation kernel: `fusion_plasma_v1` — compiled on dev/fusion-plasma-kernel branch.*

---

`scale94.com` · PHYSICS MODULE · v1.0.0 · ᛟ PLASMA SOVEREIGNTY ACTIVE
