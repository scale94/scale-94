---
id: RUN-COMMAND-MANUAL
type: "kernel_doc"
date: "2026-03-10"
status: "RUNNING"
title: "RUN COMMAND MANUAL v1.0 // WASM KERNEL INTERFACE"
---

# RUN_COMMAND_MANUAL v1.0
## Direct Interface to Compiled Rust Simulations — scale_9.4 Terminal

> *"While `load` fetches lore from the content archive, `run` feeds floating-point parameters directly into compiled WebAssembly binaries. These are not documents. These are simulations."*

---

## 1. WHAT IS `run`?

The `run` command is the terminal's direct interface to the compiled Rust/WASM kernel registry. Unlike `load` — which fetches and streams Markdown articles from the content pipeline — `run` invokes compiled physics and economic simulations registered in the WASM module map.

Every kernel listed here is:
- Compiled from Rust source at `content/rust_kernels/src/lib.rs`
- Packaged via `wasm-pack --target web --release`
- Registered in `src/wasm/wasm.generated.js`
- Available immediately — no network fetch required

```
run <kernel> [args...]           # positional arguments
run <kernel> --flag value ...    # named flags
run <kernel> --help              # kernel-specific parameter reference
run --help                       # list all registered kernels
```

---

## 2. TARGET RESOLUTION

You do not need the exact internal ID. The parser runs a normalizeQuery pipeline — strip whitespace, lowercase, remove separators — then matches against:

1. **Exact ID** — `LEVIATHAN-CELLULAR-AUTOMATA`
2. **Alias exact** — `leviathan`, `vcache_burn`, `benchmark`
3. **Contains match** — `leviat` resolves to `leviathan`

All of the following are equivalent:
```
run LEVIATHAN-CELLULAR-AUTOMATA
run leviathan
run vcache_burn
run benchmark
run automata
```

---

## 3. ARGUMENT MODES

### Mode A — Positional
Arguments are assigned left-to-right to the Rust function signature. Trailing omissions fall back to registered defaults.

```
run daly 80 30 55000 11000 0.025 0.008 100
         ↑  ↑    ↑      ↑     ↑     ↑   ↑
         C  G  waste  absorb  dep  sub  yrs
```

### Mode B — Named Flags
Target specific parameters by name, leave the rest at default. Each kernel has an `argMap` that resolves flag names to positional indices.

```
run daly --consumption 40 --years 200
run ceei --agents 50 --inequality 0
run strangler --growth 0.35 --resistance 0.10
```

Flags are normalized — `--eco`, `--ecological`, `--ecoShare` all resolve to the same parameter.

---

## 4. GLOBAL DIAGNOSTICS

```
run --help
```

Outputs the full `RUN_MANIFEST` — every registered kernel, its aliases, and its parameter signature.

```
run <kernel> --help
```

Dumps the specific function signature: parameter names, default values, valid ranges, and all accepted flag aliases.

---

## 5. KERNEL REFERENCE

---

### 5.1 BIODIVERSITY — BiocoenosisKernel

**Aliases:** `biodiversity`, `biocoenosis`

**Description:** High-density biodiversity simulation. Models ecosystem population dynamics across multiple species trophic levels.

**Usage:**
```
run biodiversity
run biocoenosis
```

This kernel uses the struct-based boot pattern — no positional parameters. The simulation runs with internal defaults for species counts, interaction matrices, and succession dynamics.

---

### 5.2 FISH-SCALE — NecromanticEngine

**Aliases:** `fishscale`, `necromantic`, `fish`

**Description:** The Necromantic Engine — the original fish scale pattern generator. Entropic stasis simulation. Struct-based boot.

**Usage:**
```
run fishscale
run necromantic
run fish
```

No positional parameters. Runs with internal defaults.

---

### 5.3 BOSONIC — Bosonic Lattice Simulator

**Aliases:** `bosonic`, `bosonic_lattice`, `bosonickernel`, `lattice`

**Function:** `boot_bosonic_lattice(trust: f64, thermal: f64)`

**Defaults:** `[0.8, 0.7]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `trust` | `--trust`, `--coupling` | `0.8` | Inter-node trust / coupling coefficient |
| `thermal` | `--thermal`, `--price` | `0.7` | Thermal fluctuation / price noise level |

**Usage:**
```
run bosonic                              # defaults: trust=0.8, thermal=0.7
run bosonic 0.5 0.3                     # low trust, low thermal
run bosonic --trust 0.9 --thermal 0.2   # high coupling, low noise
run lattice --coupling 0.6              # alias, named flag
```

---

### 5.4 CLIMATE — Atmospheric Entropy Kernel

**Aliases:** `climate`, `thermosphere`, `atmospheric`, `entropy`, `carbon`, `thermosphere_protocol`

**Function:** `boot_thermosphere_protocol(carbon_ppm: f64, industrial_drag: f64, ocean_sink: f64)`

**Defaults:** `[420, 2.5, 0.6]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `carbon_ppm` | `--carbon`, `--ppm`, `--carbonppm` | `420` | Atmospheric CO₂ concentration (ppm) |
| `industrial_drag` | `--drag`, `--industrial`, `--industrialdrag` | `2.5` | Industrial emissions drag coefficient |
| `ocean_sink` | `--sink`, `--ocean`, `--oceansink` | `0.6` | Ocean carbon sink capacity fraction |

**Usage:**
```
run climate                                  # current-world defaults (420ppm)
run climate 280 1.0 0.8                      # pre-industrial baseline
run climate 560 4.0 0.3                      # 2×CO₂ stress scenario
run climate --carbon 350 --sink 0.9          # named flags
run thermosphere --drag 1.5                  # reduced industrial drag
```

**Calibration:**
- `carbon 280` = pre-industrial baseline
- `carbon 420` = 2026 measured (default)
- `carbon 560` = 2×CO₂ threshold
- `drag 2.5` = current emissions trajectory
- `sink 0.6` = current ocean absorption capacity

---

### 5.5 STATECRAFT — Kinetic Statecraft Kernel

**Aliases:** `statecraft`, `geopolitics`, `kinetic`, `geopolitical`, `regime`, `kinetics`

**Function:** `boot_geopolitical_kinetics(sanction_pressure: f64, grid_resilience: f64, propaganda_strength: f64)`

**Defaults:** `[6, 0.4, 0.7]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `sanction_pressure` | `--sanction`, `--pressure` | `6` | Economic sanction intensity (1–10 scale) |
| `grid_resilience` | `--grid`, `--resilience` | `0.4` | Infrastructure / supply chain resilience |
| `propaganda_strength` | `--propaganda`, `--narrative` | `0.7` | Information warfare / narrative control |

**Usage:**
```
run statecraft                                        # default scenario
run statecraft 9 0.2 0.9                              # max pressure, weak grid, strong narrative
run statecraft --sanction 3 --resilience 0.8          # weak sanctions, resilient grid
run geopolitics --narrative 0.3 --pressure 8          # high pressure, weak narrative
```

---

### 5.6 LEVIATHAN — Cellular Automata Benchmark

**Aliases:** `leviathan`, `vcache_burn`, `vcache`, `benchmark`, `stress`, `automata`, `cellular`

**Function:** `boot_leviathan_benchmark(grid_size: f64, generations: f64)`

**Defaults:** `[100000, 100]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `grid_size` | `--size`, `--gridsize`, `--cells` | `100000` | Number of cells in the automata grid |
| `generations` | `--generations`, `--iters`, `--steps` | `100` | Number of simulation steps to run |

**Usage:**
```
run leviathan                                # default: 100k cells, 100 generations
run leviathan 500000 200                     # half-million cell stress test
run vcache_burn --cells 1000000 --steps 50   # V-Cache annihilation
run benchmark --size 50000                   # lighter diagnostic
```

This kernel is a pure computational benchmark — it burns V-Cache with cellular automata computation. The output reports cells/sec and total elapsed time.

---

### 5.7 DALY — Thermodynamic Governor

**Aliases:** `daly`, `thermo`, `thermodynamics`, `daly_rules`, `ecological`, `daly_thermo`, `entropy_econ`

**Function:** `run_daly_thermo_simulation(consumption, regeneration, waste, absorption, nr_depletion, substitution, years)`

**Defaults:** `[80, 30, 55000, 11000, 0.025, 0.008, 100]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `consumption` | `--consumption`, `--consume` | `80.0` | Renewable energy consumption GJ/capita/yr |
| `regeneration` | `--regeneration`, `--regen` | `30.0` | Biosphere regeneration capacity GJ/capita/yr |
| `waste` | `--waste` | `55000.0` | Global waste output Mt CO₂eq/yr |
| `absorption` | `--absorption`, `--absorb` | `11000.0` | Natural sink capacity Mt/yr |
| `nr_depletion` | `--depletion`, `--nr`, `--nrdepletion` | `0.025` | Non-renewable depletion fraction/yr |
| `substitution` | `--substitution`, `--sub` | `0.008` | Renewable substitution rate fraction/yr |
| `years` | `--years`, `--horizon` | `100.0` | Simulation horizon (years) |

**Usage:**
```
run daly                                              # current world → COLLAPSE
run daly 25 30 11000 12000 0.01 0.03 200              # sustainable scenario
run daly --consumption 40 --years 150                 # 50% consumption reduction
run daly --sub 0.05 --depletion 0.01                  # accelerated transition
run thermo --consumption 80 --regen 80                # harvest = regeneration → PASS
```

**Interpretation:**
- Default parameters (current world) produce `COLLAPSE` — this is the diagnostic
- Set `consumption ≤ regeneration` for Daly Rule 1 to PASS
- Set `waste ≤ absorption` for Daly Rule 2 to PASS
- Set `substitution ≥ depletion` for Daly Rule 3 to PASS
- All three PASS = `SUSTAINABLE` outcome

**Scenario guide:**
```
run daly 80 30 55000 11000 0.025 0.008 100    # COLLAPSE (current world)
run daly 25 30 11000 12000 0.010 0.030 200    # SUSTAINABLE (steady state)
run daly 40 30 20000 12000 0.015 0.020 150    # CRITICAL → RECOVERY arc
```

---

### 5.8 CEEI — A-CEEI Allocation Engine

**Aliases:** `ceei`, `allocation`, `matching`, `market`, `roth`, `preference`, `aceei`

**Function:** `run_ceei_allocation_engine(agents, goods, inequality, diversity)`

**Defaults:** `[20, 8, 0.3, 0.7]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `agents` | `--agents`, `--n` | `20` | Number of allocation participants (2–50) |
| `goods` | `--goods`, `--m` | `8` | Number of distinct resources (2–20) |
| `inequality` | `--inequality`, `--gini`, `--ineq` | `0.3` | Budget spread 0–1 (0 = perfectly equal) |
| `diversity` | `--diversity`, `--div`, `--pref` | `0.7` | Preference heterogeneity 0–1 |

**Usage:**
```
run ceei                                      # default: 20 agents, 8 goods
run ceei 50 12 0.0 0.9                        # max diversity, equal incomes
run ceei --inequality 0                       # pure CEEI (equal budgets)
run ceei --agents 30 --goods 15              # larger market
run roth --inequality 0 --diversity 0.1      # uniform preferences, equal budgets → near-equal allocation
```

**Key experiments:**
- `--inequality 0` → perfectly equal budgets → minimum envy → CEEI guarantee
- `--diversity 0.1` → near-uniform preferences → prices converge to uniform
- `--diversity 0.9` → high heterogeneity → efficient preference-based separation
- `--inequality 1.0` → maximum budget spread → `ENVY_PRESENT` outcome

---

### 5.9 SOMA — Soma Plus Engine

**Aliases:** `soma`, `soma_plus`, `somaplus`, `social_capital`, `commons`, `status`, `contribution`

**Function:** `run_soma_plus_engine(population, eco_share, social_share, arts_share, years)`

**Defaults:** `[5000, 0.35, 0.35, 0.20, 50]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `population` | `--pop`, `--population` | `5000` | Number of simulated agents (10–10,000) |
| `eco_share` | `--eco`, `--ecological`, `--ecoShare` | `0.35` | Fraction doing ecological care |
| `social_share` | `--social`, `--socialShare` | `0.35` | Fraction doing social care |
| `arts_share` | `--arts`, `--artsShare`, `--culture` | `0.20` | Fraction doing arts/culture |
| `years` | `--years`, `--horizon` | `50` | Simulation cycles (1–200) |

*Remaining fraction `(1 - eco - social - arts)` is passive population — zero Soma Plus accumulation.*

**Usage:**
```
run soma                                      # default: 5000 agents, 50yr
run soma 10000 0.5 0.3 0.2 100               # large pop, ecology-heavy, century
run soma --arts 0.6 --years 25               # arts-dominant society
run soma --pop 1000 --eco 0.8                # ecological commons economy
run soma --eco 0 --social 0 --arts 0         # 100% passive → no SP accumulation
```

**Contribution rates (SP/yr):**
- Ecological: ~18 SP/yr
- Social: ~14 SP/yr
- Arts/Culture: ~22 SP/yr (highest multiplier)
- Passive: 0 SP/yr

**Status tiers:** INITIATE (0–99) → CONTRIBUTOR (100–499) → ARTISAN (500–1,999) → SOVEREIGN (2,000+)

---

### 5.10 STRANGLER — Strangler Fig Transition Protocol

**Aliases:** `strangler`, `transition`, `stranglerfig`, `fig`, `logistic`

**Function:** `run_strangler_fig_transition(initial_adoption, growth_rate, resistance, years)`

**Defaults:** `[0.02, 0.18, 0.25, 75]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `initial_adoption` | `--adoption`, `--seed`, `--initial` | `0.02` | Starting adoption fraction 0–1 (0.02 = 2%) |
| `growth_rate` | `--growth`, `--rate`, `--r` | `0.18` | Logistic growth coefficient r |
| `resistance` | `--resistance`, `--rho`, `--legacy` | `0.25` | Initial legacy resistance ρ₀ |
| `years` | `--years`, `--horizon` | `75` | Simulation horizon (years) |

**Usage:**
```
run strangler                                         # realistic transition (~44yr to dominance)
run strangler 0.05 0.25 0.15 100                      # faster growth, weaker resistance
run strangler 0.01 0.10 0.50 200                      # hard case: high resistance
run strangler --growth 0.35 --resistance 0.05         # strong new system, weak incumbent
run strangler --growth 0.05 --resistance 0.40         # failed transition scenario
run fig --seed 0.10                                   # 10% early adopters
```

**Scenario calibration:**
```
growth_rate 0.05–0.15   = gradual cultural shift
growth_rate 0.15–0.30   = active organizing + proven results
growth_rate 0.30–0.60   = crisis-accelerated adoption
resistance  0.10–0.30   = weakened incumbency (post-crisis)
resistance  0.50–1.00   = high entrenchment (state capture)
```

**Tipping point (analytic):** `t* = ln(ρ₀ / r) / λ` where `λ = 0.05/yr` (fixed decay rate)

If `growth_rate > resistance`: positive growth from day one (rare). If `growth_rate ≤ resistance`: suppressed until legacy system decays enough.

---

## 6. QUICK REFERENCE

```
run biodiversity                                       # ecosystem dynamics
run fishscale                                          # necromantic engine
run bosonic [trust] [thermal]                          # lattice simulator
run climate [ppm] [drag] [sink]                        # atmospheric entropy
run statecraft [sanction] [resilience] [narrative]     # geopolitical kinetics
run leviathan [cells] [generations]                    # V-cache benchmark
run daly [C] [G] [W] [A] [dep] [sub] [yr]             # Daly Rules ODE
run ceei [agents] [goods] [inequality] [diversity]     # A-CEEI allocation
run soma [pop] [eco] [social] [arts] [yr]              # Soma Plus engine
run strangler [seed] [growth] [resistance] [yr]        # Strangler Fig ODE
```

---

## 7. COMBINING WITH `load`

`run` and `load` operate on different layers of the same system.

- `load daly` → fetches the article `DALY-THERMO-SIMULATION.md` from the content archive — lore and documentation
- `run daly` → invokes the compiled Rust function `run_daly_thermo_simulation()` — live simulation

To understand a kernel before running it: `load <alias>` first, then `run <alias>` with custom parameters.

```
load strangler            # read the Strangler Fig Protocol article
run strangler             # run the default simulation
run strangler --growth 0.35 --resistance 0.05   # stress-test optimistic scenario
```

---

`SOURCE: content/soma_kernel/RUN-COMMAND-MANUAL.md`
`KERNELS: content/rust_kernels/src/lib.rs · 10 registered WASM exports`
`REGISTRY: src/wasm/wasm.generated.js · scale94-kernels v0.1.0`
