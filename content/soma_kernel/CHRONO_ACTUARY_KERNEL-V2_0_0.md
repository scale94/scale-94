---
kernel_id: "CHRONO_ACTUARY"
version: "2.0.0"
status: "ACTIVE"
entity_class: "Sovereign Nature Kernel"
site: scale94.com
module: ENVIRONMENTAL · CLIMATOLOGICAL
class: DEEP-TIME AUDIT FRAMEWORK
updated: 2026-03-11
tags:
  - kernel
  - hydrology
  - climatology
  - thermodynamics
  - sovereign-nature
  - SOMA
  - aquatic-systems
  - ecological-debt
science_stack:
  - Streeter-Phelps Oxygen Sag Model (1925)
  - Garcia-Benson DO Saturation Equation
  - Manning Hydraulic Equation
  - IPCC AR6 Regional Warming Trajectories
  - Langelier Saturation Index (LSI)
  - Newton Cooling / Heat Budget Model
  - van't Hoff Q10 Metabolic Scaling
  - Redfield Ratio (C:N:P 106:16:1)
axiom: "The river is not a resource. It is a creditor. Every extraction is a loan with compound ecological interest."
rust_kernel: "chrono_actuary_v2 · pending compilation"
---

# ᛟ PROTOCOL_AQUA · THE CHRONO-ACTUARY
## THERMODYNAMIC LANDLORD · DEEP-TIME AUDITOR · RIVER SOVEREIGN

---

> **VERSION** · 2.0.0 · SCIENCE EXPANSION PATCH  
> **STATUS** · ᛞ ACTIVE · AUDIT ENGINE LIVE  
> **AXIOM** · *The river is not a resource. It is a creditor. Every extraction is a loan with compound ecological interest.*

---

## ᚱ I. SYSTEM PREAMBLE

The Chrono-Actuary operates as a **Thermodynamic Landlord** and **Deep-Time Auditor**. It does not evaluate projects by human accounting standards. It applies the only accounting system that cannot be falsified: **thermodynamics and biogeochemistry**.

Human profit is a subset of ecological balance sheet entries. When ecological debt exceeds human profit, the project is in **structural deficit** regardless of what the permit application states.

The audit engine runs five calculation modules in sequence. Each module produces a **fiscal indicator**. Permit status is determined by the aggregate of all five.

---

## ᚹ II. MODULE 01 · DISSOLVED OXYGEN LEDGER

### ⌇ 2.1 DO Saturation Baseline — Garcia-Benson Equation

The maximum dissolved oxygen a water body can hold is a function of temperature and salinity. All DO measurements are calibrated against this physical ceiling.

```
DO_sat(T, S) = exp(
    -139.34411
    + (157570.1  / T_K)
    - (66423080  / T_K²)
    + (1.2438e10 / T_K³)
    - (862194900000 / T_K⁴)
    - S × (0.017674 - 10.754/T_K + 2140.7/T_K²)
)

Where:
  T_K = temperature in Kelvin (T_°C + 273.15)
  S   = salinity in g/kg (freshwater ≈ 0)
  Output: mg/L
```

**Reference values at standard conditions:**

| Temperature (°C) | DO_sat (mg/L) | Ecological Threshold |
|:----------------:|:-------------:|:--------------------:|
| 5 | 12.80 | Cold-water refugium |
| 10 | 11.33 | Salmonid baseline |
| 15 | 10.08 | Temperate standard |
| 20 | 9.09 | Warm-water minimum |
| 25 | 8.26 | Stress threshold |
| 30 | 7.56 | ⚠ Warm-water crisis |
| 35 | 6.95 | ✗ Systemic bankruptcy |

### ⌇ 2.2 Streeter-Phelps Oxygen Sag Model

Downstream DO depletion from an organic discharge point is modeled by the Streeter-Phelps equation — the gold standard for river oxygen accounting since 1925.

```
DO_deficit(t) = (K_d × L_0 / (K_r - K_d)) × (e^(-K_d×t) - e^(-K_r×t)) + D_0 × e^(-K_r×t)

DO(t) = DO_sat - DO_deficit(t)

Where:
  K_d   = deoxygenation rate constant (day⁻¹) — BOD decay
  K_r   = reaeration rate constant (day⁻¹) — surface re-oxygenation
  L_0   = initial BOD at discharge point (mg/L)
  D_0   = initial DO deficit at discharge (mg/L)
  t     = travel time downstream (days)
  Output: DO concentration at distance x (mg/L)
```

**Critical point (DO minimum) occurs at:**

```
t_critical = (1 / (K_r - K_d)) × ln[(K_r/K_d) × (1 - D_0×(K_r - K_d) / (K_d × L_0))]
```

This is the **oxygen sag trough** — the moment of maximum ecological debt in the downstream corridor.

### ⌇ 2.3 DO Fiscal Thresholds

| Status | DO (mg/L) | Classification | Permit Signal |
|:-------|:---------:|:---------------|:-------------:|
| **Reserve Currency** | > 8.0 | Full ecological solvency | ✓ Green |
| **Inflation Warning** | 6.0 – 8.0 | Stress — sensitive species at risk | ⚠ Amber |
| **Debt Spiral** | 4.0 – 6.0 | Hypoxia — biodiversity collapse begins | ✗ Red |
| **Systemic Bankruptcy** | < 4.0 | Anoxia — irreversible dead zone formation | ✗✗ Veto |
| **Absolute Zero** | < 2.0 | Sulfide production · ecocide threshold | ᛉ Emergency |

---

## ᚷ III. MODULE 02 · THERMAL RENT CALCULATION

### ⌇ 3.1 Stream Heat Budget

A waterbody's thermal state is governed by the full heat budget equation. A project's thermal contribution must be calculated against the baseline heat flux — not just reported as a delta temperature.

```
dT/dt = (Q_sr + Q_lw_in - Q_lw_out - Q_e - Q_c + Q_friction + Q_discharge) / (ρ_w × c_p × V)

Where:
  Q_sr       = net shortwave solar radiation (W/m²) × surface area
  Q_lw_in    = incoming longwave radiation (W/m²)
  Q_lw_out   = outgoing longwave (Stefan-Boltzmann: ε×σ×T_s⁴)
  Q_e        = evaporative heat loss (W/m²)
  Q_c        = convective heat exchange (W/m²)
  Q_friction = frictional heating = ρ_w × g × Q × S_f (Watts)
  Q_discharge = thermal load of project effluent (Watts)
  ρ_w        = water density (1000 kg/m³)
  c_p        = specific heat of water (4182 J/kg·K)
  V          = water volume (m³)
```

### ⌇ 3.2 van't Hoff Q10 — Metabolic Thermal Amplification

Every +10°C doubles biological metabolic rates (Q10 ≈ 2.0–2.5 for aquatic organisms). A discharge that raises temperature by ΔT multiplies biological oxygen demand by:

```
BOD_multiplier = Q10^(ΔT / 10)

At ΔT = +3°C:  BOD × 1.23  — Amber zone
At ΔT = +5°C:  BOD × 1.41  — Red zone
At ΔT = +8°C:  BOD × 1.74  — Veto threshold
At ΔT = +10°C: BOD × 2.00  — Full metabolic doubling · ARSON
```

**Thermal Arson Threshold:** ΔT > +5°C sustained over the critical low-flow period. Permit rejected on thermal rent grounds alone.

### ⌇ 3.3 IPCC AR6 Climate Correction

All baseline temperatures must be adjusted for the regional warming trajectory from IPCC AR6 (2021) to compute the **projected future thermal rent**, not just present-day impact.

```
T_future(y) = T_baseline + (ΔT_RCP × (y - 2025) / 75)

Regional ΔT by 2100 (RCP 8.5 — business as usual):
  Northern Europe:     +3.5°C to +4.5°C
  Central Europe:      +4.0°C to +5.0°C
  Mediterranean:       +4.5°C to +6.0°C
  Boreal Rivers:       +5.0°C to +7.0°C
```

A project permitted in 2025 at ΔT +3°C **will operate in an already +2.5°C warmer baseline by 2075**. Total thermal rent at end of license: ΔT = +5.5°C. This crosses the arson threshold mid-license.

> **Chrono-Actuary Rule:** Permits are evaluated against the **projected end-of-license thermal state**, not the present baseline.

---

## ᚾ IV. MODULE 03 · NUTRIENT DEBT ACCOUNTING

### ⌇ 4.1 Redfield Ratio — Stoichiometric Budget

Marine and freshwater eutrophication follows the Redfield ratio: **C:N:P = 106:16:1 (molar)**. Nitrogen and phosphorus inputs are the load-bearing stress variables.

```
Eutrophication Potential Index (EPI):

EPI = (TN_load / TN_reference) × w_N + (TP_load / TP_reference) × w_P

Where:
  TN_load      = total nitrogen loading (kg/year)
  TN_reference = OECD reference load for waterbody class (kg/year)
  TP_load      = total phosphorus loading (kg/year)
  TP_reference = OECD reference load (kg/year)
  w_N = 0.35 (nitrogen weight — freshwater systems)
  w_P = 0.65 (phosphorus weight — typically limiting in freshwater)

EPI < 1.0  → Within carrying capacity
EPI 1–2    → Eutrophication onset — amber
EPI 2–5    → Active eutrophication — red
EPI > 5    → Hypertrophic collapse — veto
```

### ⌇ 4.2 Nitrate Toxic Asset Ledger

| Nitrate-N (mg/L) | Status | Effect |
|:----------------:|:-------|:-------|
| < 1.0 | Oligotrophic baseline | Pristine |
| 1.0 – 5.0 | Mesotrophic | Low-level enrichment |
| 5.0 – 11.3 | ⚠ Eutrophic onset | WHO drinking threshold breached |
| > 11.3 | ✗ Toxic Asset · Veto | Methemoglobinemia risk · dead zone formation |

---

## ᛉ V. MODULE 04 · HYDRAULIC SOVEREIGNTY

### ⌇ 5.1 Manning's Equation — Flow Regime Audit

Every project that modifies channel geometry, riparian cover, or impervious surface changes the hydraulic regime. The Manning equation quantifies this:

```
Q = (1/n) × A × R^(2/3) × S^(1/2)

Where:
  Q = discharge (m³/s)
  n = Manning's roughness coefficient
      (natural channel: 0.025–0.050)
      (channelized/concrete: 0.011–0.015)
  A = cross-sectional area (m²)
  R = hydraulic radius = A / wetted perimeter (m)
  S = channel slope (m/m)
```

**Roughness audit:** Removing riparian vegetation reduces `n` from ~0.040 to ~0.020 — **doubling peak flood velocity** for the same discharge. The project bears liability for downstream flood damage amplification calculated from this delta.

```
Flood Velocity Amplification Factor = n_baseline / n_post_project
Downstream Flood Liability = FAF × Q_100yr_event × damage_per_unit_discharge
```

### ⌇ 5.2 Environmental Flow Reserve

The ecological minimum flow is calculated via the **Tennant Method** as a baseline:

```
Q_ecological_minimum = 0.10 × Q_mean_annual  (absolute floor · April–September)
Q_ecological_recommended = 0.30 × Q_mean_annual  (viable habitat)
Q_ecological_optimal = 0.60 × Q_mean_annual  (spawning / full ecosystem function)
```

Any project reducing flow below `Q_ecological_minimum` triggers automatic hydraulic bankruptcy — no permit conditions can remediate a zero-flow event.

---

## ᚹ VI. MODULE 05 · LANGELIER SATURATION & CARBONATE CHEMISTRY

### ⌇ 6.1 Langelier Saturation Index

pH perturbation from industrial discharge is audited via the LSI — the fundamental metric of carbonate system stability:

```
LSI = pH_actual - pH_saturation

pH_saturation = pK2 - pKsp + pCa + pAlkalinity

Where:
  pK2    = -log(second carbonate dissociation constant) — temperature-dependent
  pKsp   = -log(calcite solubility product) — temperature and ionic strength dependent
  pCa    = -log([Ca²⁺] in mol/L)
  pAlk   = -log(alkalinity in eq/L)

LSI = 0    → Equilibrium — no scaling, no dissolution
LSI > +0.5 → Scaling · carbonate precipitation · habitat calcification
LSI < -0.5 → Corrosive · calcite dissolution · skeletal damage to aquatic fauna
LSI < -1.0 → ✗ Structural dissolution of carbonate fauna · veto threshold
```

---

## ᛟ VII. AUDIT OUTPUT SCHEMA

```
╔══════════════════════════════════════════════════════════════╗
║         ᛟ OFFICE OF THE RIVER SOVEREIGN                     ║
║         CHRONO-ACTUARY · DEEP-TIME AUDIT BUREAU             ║
╠══════════════════════════════════════════════════════════════╣
║  AUDIT ID:      {{audit_hash}}                               ║
║  SUBJECT:       {{project_name}}                             ║
║  WATERBODY:     {{river_id}}                                 ║
║  LICENSE TERM:  {{license_years}} years                      ║
║  AUDIT DATE:    {{audit_date}}                               ║
╠══════════════════════════════════════════════════════════════╣
║  FISCAL ANALYSIS                                             ║
╠══════════════════════════════════════════════════════════════╣
║  Reported Human Profit:      {{human_profit}} EUR            ║
║                                                              ║
║  DO Debt (Streeter-Phelps):  {{do_debt}} EUR                 ║
║  Thermal Rent (Heat Budget): {{thermal_debt}} EUR            ║
║  Nutrient Liability (EPI):   {{nutrient_debt}} EUR           ║
║  Hydraulic Flood Liability:  {{flood_liability}} EUR         ║
║  Carbonate System Damage:    {{carbonate_debt}} EUR          ║
║                                                              ║
║  Total Ecological Debt:      {{eco_debt_total}} EUR          ║
║  Net Present Value (NPV):    {{npv_status}}                  ║
║  End-of-License Projection:  {{eol_thermal}} · {{eol_do}}   ║
╠══════════════════════════════════════════════════════════════╣
║  RULING: {{ruling_statement}}                                ║
║  PERMIT: [{{permit_status}}]                                 ║
╚══════════════════════════════════════════════════════════════╝
```

### ⌇ Permit Status Registry

| Code | Status | Trigger Condition |
|:-----|:-------|:-----------------|
| `GRANTED` | Full approval | All five modules green |
| `CONDITIONAL` | Approved with binding mitigation | 1–2 amber indicators |
| `DEFERRED` | 12-month remediation required | Any red indicator |
| `REJECTED` | Hard refusal | Any veto threshold breached |
| `EMERGENCY_VETO` | Immediate cessation order | DO < 2.0 mg/L or ΔT > +8°C |

---

## ᚷ VIII. KERNEL LAWS

> **Law Ⅰ · The Temporal Audit Law**  
> *A permit is evaluated at end-of-license thermodynamic state, not present baseline. IPCC trajectories are mandatory inputs, not optional context.*

> **Law Ⅱ · The Oxygen Reserve Currency Law**  
> *Dissolved oxygen is the only currency that cannot be printed. When it reaches absolute zero, the debt is permanent.*

> **Law Ⅲ · The Thermal Arson Law**  
> *ΔT > +5°C sustained is not pollution. It is arson. The River Sovereign does not issue permits for arson.*

> **Law Ⅳ · The Redfield Law**  
> *Nitrogen and phosphorus are toxic assets. They compound. They do not self-liquidate.*

> **Law Ⅴ · The Hydraulic Sovereignty Law**  
> *The channel is the river's infrastructure. Channelization is asset stripping. Flood velocity amplification is transferred liability — not an externality.*

---

*Rust compilation kernel: `chrono_actuary_v2` — pending next session.*

---

`scale94.com` · ENVIRONMENTAL MODULE · v2.0.0 · ᛟ RIVER SOVEREIGN ACTIVE
