---
id: RUN-COMMAND-MANUAL
type: "kernel_doc"
date: "2026-03-11"
status: "RUNNING"
title: "RUN COMMAND MANUAL v2.0 // WASM KERNEL INTERFACE"
---

# RUN_COMMAND_MANUAL v2.0
## Direct Interface to Compiled Rust Simulations — scale_9.4 Terminal

> *"While `load` fetches lore from the content archive, `run` feeds floating-point parameters directly into compiled WebAssembly binaries. These are not documents. These are simulations."*

---

## 1. WHAT IS `run`?

The `run` command is the terminal's direct interface to the compiled Rust/WASM kernel registry. Unlike `load` — which fetches and streams Markdown articles from the content pipeline — `run` invokes compiled physics and economic simulations registered in the WASM module map.

Every kernel listed here is:
- Compiled from Rust source at `content/rust_kernels/src/`
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

## 5. SPECIAL COMMANDS

### `breach`

Launches the **Breach Protocol** ICE-breaking minigame. Costs 4 RAM units from the footer RAM bar.

```
breach
```

A 6×6 matrix of hex codes is presented. Select cells in alternating row/column order to sequence three daemons — `DATAMINE_V1`, `DATAMINE_V2`, and `ICEPICK` — into a 6-slot buffer within 30 seconds. Completing all daemons before timeout triggers a full system breach.

---

### `relic`

Activates **Relic Malfunction Mode** for 5 seconds.

```
relic
```

Amplifies the article title glitch layers from 9s to 1.8s cycle. Floods the system log with entropy hex streams and diagnostic error patterns. The terminal returns to normal after the diagnostic window closes.

---

### `run classified` / `verify <CODE>`

Two-stage time-locked decryption sequence for the ML-KEM-768 classified enclave.

```
run classified          # stage 1: boot WASM, navigate to /cryptography, issue challenge
verify A3F9B2          # stage 2: submit the 6-char code within 60 seconds
```

If the session expires, restart with `run classified`. See section 5.19 for full kernel documentation.

---

## 6. KERNEL REFERENCE

---

### 6.1 SOMA-9.1 — GAIA Build Banner

**Aliases:** `soma91`, `gaia`, `soma_91`, `banner`

**Function:** `soma_91_banner()` — zero parameters

**Description:** Boots the SOMA-9.1 GAIA build banner. Top-level system identification sequence for the soma_kernel lineage.

**Usage:**
```
run soma91
run gaia
run banner
```

---

### 6.2 BIODIVERSITY — BiocoenosisKernel

**Aliases:** `biodiversity`, `biocoenosis`

**Description:** High-density biodiversity simulation. Models ecosystem population dynamics across multiple species trophic levels.

**Usage:**
```
run biodiversity
run biocoenosis
```

Struct-based boot — no positional parameters. Runs with internal defaults for species counts, interaction matrices, and succession dynamics.

---

### 6.3 FISH-SCALE — NecromanticEngine

**Aliases:** `fishscale`, `necromantic`, `fish`

**Description:** The Necromantic Engine — the original fish scale pattern generator. Entropic stasis simulation. Struct-based boot.

**Usage:**
```
run fishscale
run necromantic
run fish
```

No positional parameters.

---

### 6.4 BOSONIC — Bosonic Lattice Simulator

**Aliases:** `bosonic`, `bosonic_lattice`, `lattice`

**Function:** `boot_bosonic_lattice(trust: f64, thermal: f64)`

**Defaults:** `[0.8, 0.7]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `trust` | `--trust`, `--coupling` | `0.8` | Inter-node trust / coupling coefficient |
| `thermal` | `--thermal`, `--price` | `0.7` | Thermal fluctuation / price noise level |

**Usage:**
```
run bosonic                              # defaults: trust=0.8, thermal=0.7
run bosonic 0.5 0.3                      # low trust, low thermal
run bosonic --trust 0.9 --thermal 0.2   # high coupling, low noise
run lattice --coupling 0.6              # alias, named flag
```

---

### 6.5 CLIMATE — Atmospheric Entropy Kernel

**Aliases:** `climate`, `thermosphere`, `atmospheric`, `entropy`, `carbon`

**Function:** `boot_thermosphere_protocol(carbon_ppm: f64, industrial_drag: f64, ocean_sink: f64)`

**Defaults:** `[420, 2.5, 0.6]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `carbon_ppm` | `--carbon`, `--ppm` | `420` | Atmospheric CO₂ concentration (ppm) |
| `industrial_drag` | `--drag`, `--industrial` | `2.5` | Industrial emissions drag coefficient |
| `ocean_sink` | `--sink`, `--ocean` | `0.6` | Ocean carbon sink capacity fraction |

**Usage:**
```
run climate                              # current-world defaults (420ppm)
run climate 280 1.0 0.8                  # pre-industrial baseline
run climate 560 4.0 0.3                  # 2×CO₂ stress scenario
run climate --carbon 350 --sink 0.9     # named flags
run thermosphere --drag 1.5             # reduced industrial drag
```

**Calibration:** `carbon 280` = pre-industrial · `carbon 420` = 2026 measured · `carbon 560` = 2×CO₂ threshold

---

### 6.6 STATECRAFT — Kinetic Statecraft Kernel

**Aliases:** `statecraft`, `geopolitics`, `kinetic`, `regime`, `kinetics`

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

### 6.7 LEVIATHAN — Cellular Automata Benchmark

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

Pure computational benchmark — burns V-Cache with cellular automata computation. Output reports cells/sec and total elapsed time.

---

### 6.8 SOMA-LIVE — SomaKernel Stateful Simulation

**Aliases:** `soma_live`, `soma_cycle`, `pilot`, `somapilot`

**Stateful kernel** — instance persists across calls. Each `run soma_live` advances one simulation cycle.

**Function:** `SomaKernel::execute_cycle(consumption, waste, nr_depletion, compliance)`

**Defaults:** `[80, 55000, 0.025, 0.05]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `consumption` | `--consumption`, `--c` | `80` | Renewable energy consumption GJ/capita/yr |
| `waste` | `--waste`, `--w` | `55000` | Global waste output Mt CO₂eq/yr |
| `nr_depletion` | `--depletion`, `--nr` | `0.025` | Non-renewable depletion fraction/yr |
| `compliance` | `--compliance`, `--trust`, `--ostrom` | `0.05` | Ostrom protocol compliance rate |

**Usage:**
```
run soma_live                            # advance one cycle (state persists)
run soma_live reset                      # wipe state, reset to year 0
run soma_live --consumption 40           # reduced consumption cycle
run pilot --compliance 0.3              # high Ostrom compliance
```

---

### 6.9 SOMA55 — soma_kernel_5.5 Boot Diagnostic

**Aliases:** `soma55`, `soma_kernel`, `sk55`, `soma_boot`, `nexteconomy`

**Function:** `boot_soma55()` — zero parameters

**Description:** Top-level boot diagnostic for the entire soma_kernel_5.5 suite. Runs a high-level status check across all four sub-systems — Daly Rules, A-CEEI, Soma Plus, and Strangler Fig — at default parameters.

**Usage:**
```
run soma55          # full suite diagnostic
run soma_kernel
run sk55
run nexteconomy
```

To run a specific sub-system with custom parameters, use `run daly`, `run ceei`, `run soma`, or `run strangler`.

---

### 6.10 DALY — Thermodynamic Governor

**Aliases:** `daly`, `thermo`, `thermodynamics`, `ecological`, `daly_thermo`, `entropy_econ`

**Function:** `run_daly_thermo_simulation(consumption, regeneration, waste, absorption, nr_depletion, substitution, years)`

**Defaults:** `[80, 30, 55000, 11000, 0.025, 0.008, 100]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `consumption` | `--consumption`, `--consume` | `80.0` | Renewable energy consumption GJ/capita/yr |
| `regeneration` | `--regeneration`, `--regen` | `30.0` | Biosphere regeneration capacity GJ/capita/yr |
| `waste` | `--waste` | `55000.0` | Global waste output Mt CO₂eq/yr |
| `absorption` | `--absorption`, `--absorb` | `11000.0` | Natural sink capacity Mt/yr |
| `nr_depletion` | `--depletion`, `--nr` | `0.025` | Non-renewable depletion fraction/yr |
| `substitution` | `--substitution`, `--sub` | `0.008` | Renewable substitution rate fraction/yr |
| `years` | `--years`, `--horizon` | `100.0` | Simulation horizon (years) |

**Usage:**
```
run daly                                              # current world → COLLAPSE
run daly 25 30 11000 12000 0.01 0.03 200              # sustainable scenario
run daly --consumption 40 --years 150                 # 50% consumption reduction
run thermo --consumption 80 --regen 80                # harvest = regeneration → PASS
```

**Scenario guide:**
```
run daly 80 30 55000 11000 0.025 0.008 100    # COLLAPSE (current world)
run daly 25 30 11000 12000 0.010 0.030 200    # SUSTAINABLE (steady state)
run daly 40 30 20000 12000 0.015 0.020 150    # CRITICAL → RECOVERY arc
```

---

### 6.11 CEEI — A-CEEI Allocation Engine

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
run roth --inequality 0 --diversity 0.1       # uniform preferences → near-equal allocation
```

---

### 6.12 SOMA — Soma Plus Engine

**Aliases:** `soma`, `soma_plus`, `somaplus`, `social_capital`, `commons`, `contribution`

**Function:** `run_soma_plus_engine(population, eco_share, social_share, arts_share, years)`

**Defaults:** `[5000, 0.35, 0.35, 0.20, 50]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `population` | `--pop`, `--population` | `5000` | Number of simulated agents (10–10,000) |
| `eco_share` | `--eco`, `--ecological` | `0.35` | Fraction doing ecological care |
| `social_share` | `--social` | `0.35` | Fraction doing social care |
| `arts_share` | `--arts`, `--culture` | `0.20` | Fraction doing arts/culture |
| `years` | `--years`, `--horizon` | `50` | Simulation cycles (1–200) |

*Remaining fraction `(1 - eco - social - arts)` is passive — zero Soma Plus accumulation.*

**Contribution rates:** Ecological ~18 SP/yr · Social ~14 SP/yr · Arts ~22 SP/yr · Passive 0 SP/yr

**Status tiers:** INITIATE (0–99) → CONTRIBUTOR (100–499) → ARTISAN (500–1,999) → SOVEREIGN (2,000+)

**Usage:**
```
run soma                                      # default: 5000 agents, 50yr
run soma 10000 0.5 0.3 0.2 100               # large pop, ecology-heavy, century
run soma --arts 0.6 --years 25               # arts-dominant society
run soma --eco 0 --social 0 --arts 0         # 100% passive → no SP accumulation
```

---

### 6.13 STRANGLER — Strangler Fig Transition Protocol

**Aliases:** `strangler`, `transition`, `stranglerfig`, `fig`, `logistic`

**Function:** `run_strangler_fig_transition(initial_adoption, growth_rate, resistance, years)`

**Defaults:** `[0.02, 0.18, 0.25, 75]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `initial_adoption` | `--adoption`, `--seed`, `--initial` | `0.02` | Starting adoption fraction 0–1 |
| `growth_rate` | `--growth`, `--rate`, `--r` | `0.18` | Logistic growth coefficient r |
| `resistance` | `--resistance`, `--rho`, `--legacy` | `0.25` | Initial legacy resistance ρ₀ |
| `years` | `--years`, `--horizon` | `75` | Simulation horizon (years) |

**Usage:**
```
run strangler                                         # realistic transition (~44yr to dominance)
run strangler 0.05 0.25 0.15 100                      # faster growth, weaker resistance
run strangler 0.01 0.10 0.50 200                      # hard case: high resistance
run strangler --growth 0.35 --resistance 0.05         # strong new system, weak incumbent
run fig --seed 0.10                                   # 10% early adopters
```

**Tipping point:** `t* = ln(ρ₀ / r) / λ` where `λ = 0.05/yr`

---

### 6.14 KURAMOTO — Synchrony Engine

**Aliases:** `kuramoto`, `synchrony`, `sync`, `oscillator`, `solidarity`, `phase`, `coupled`

**Function:** `run_kuramoto_synchrony(n_oscillators, coupling, freq_spread, timesteps)`

**Defaults:** `[50, 1.5, 1, 500]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `n_oscillators` | `--n`, `--oscillators`, `--agents` | `50` | Agents in the collective field (3–100) |
| `coupling` | `--coupling`, `--k` | `1.5` | K: global solidarity strength — 0=isolation, K_c≈1.6σ=lock (0–10) |
| `freq_spread` | `--sigma`, `--spread`, `--diversity` | `1` | σ: natural frequency diversity — heterogeneity of desire (0.01–5) |
| `timesteps` | `--steps`, `--time`, `--t` | `500` | Integration depth — how long the field evolves (50–2000) |

**Usage:**
```
run kuramoto                                     # default: 50 oscillators, K=1.5
run kuramoto 100 2.0 0.5 1000                    # large field, strong coupling, low diversity
run kuramoto --coupling 0.5                      # below K_c → no synchronisation
run kuramoto --coupling 3.0 --sigma 2.0          # strong coupling overcomes high diversity
run sync --n 10 --steps 200                      # small fast demo
```

**Critical threshold:** K_c ≈ 1.6σ. Below K_c: fragmented phases. Above K_c: collective lock.

---

### 6.15 REPLICATOR — Evolutionary Replicator Dynamics

**Aliases:** `replicator`, `evolutionary`, `gametheory`, `commons`, `cooperate`, `ostrom_game`

**Function:** `run_evolutionary_replicator(benefit, cost, punishment, mutation, generations)`

**Defaults:** `[2, 1, 1.5, 0.005, 300]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `benefit` | `--benefit`, `--b` | `2` | Value generated by cooperation (0.1–5) |
| `cost` | `--cost`, `--c` | `1` | Personal sacrifice of contributing (0–3) |
| `punishment` | `--punishment`, `--p` | `1.5` | Altruist enforcement cost on defectors (0–3) |
| `mutation` | `--mutation`, `--mu` | `0.005` | Evolutionary noise — rate of strategy drift (0–0.5) |
| `generations` | `--generations`, `--gen`, `--time` | `300` | Evolutionary time (50–2000) |

**Usage:**
```
run replicator                                         # default: b=2, c=1, p=1.5
run replicator 3 1 2 0.01 500                          # high benefit, strong punishment
run replicator --benefit 1.2 --cost 1.0 --punishment 0 # no enforcement → defectors dominate
run replicator --punishment 2.5 --generations 1000     # long-run Ostrom dynamics
run cooperate --mutation 0.1                           # high evolutionary noise
```

---

### 6.16 ISING — Consensus Field

**Aliases:** `ising`, `consensus`, `opinion`, `phase_transition`, `monte_carlo`

**Function:** `run_ising_consensus(lattice_size, temperature, external_field, mc_steps)`

**Defaults:** `[20, 2.5, 0, 100]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `lattice_size` | `--size`, `--n`, `--grid` | `20` | N: agents per side of opinion grid — N² total (4–40) |
| `temperature` | `--temp`, `--t`, `--temperature` | `2.5` | kT/J: social temperature — T_c≈2.269 (0.1–10) |
| `external_field` | `--field`, `--h`, `--narrative` | `0` | h: external narrative force — ideological field (−3 to 3) |
| `mc_steps` | `--sweeps`, `--steps`, `--mc` | `100` | Monte Carlo sweeps — time for consensus to emerge (10–500) |

**Usage:**
```
run ising                                              # default: 20×20 grid, T=2.5
run ising 30 2.0 0 200                                 # larger grid, below T_c → ordered phase
run ising --temp 3.5                                   # above T_c → disordered, no consensus
run ising --field 1.5 --temp 2.0                       # external narrative drives opinion
run consensus --narrative -1 --size 15                 # small grid, counter-narrative
```

**Critical temperature:** T_c ≈ 2.269. Below: ordered consensus. Above: disordered fragmentation.

---

### 6.17 FEIGENBAUM — Bifurcation Cascade

**Aliases:** `feigenbaum`, `bifurcation`, `chaos`, `logistic`, `cascade`, `period_doubling`

**Function:** `run_feigenbaum_cascade(r_start, r_end, warmup, samples)`

**Defaults:** `[2.8, 4, 200, 100]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `r_start` | `--start`, `--r0` | `2.8` | Growth parameter scan start (0–4) |
| `r_end` | `--end`, `--r1` | `4` | Growth parameter scan end (0–4) |
| `warmup` | `--warmup`, `--transient` | `200` | Transient iterations to discard (50–2000) |
| `samples` | `--samples`, `--s` | `100` | Attractor samples per r value (20–500) |

**Usage:**
```
run feigenbaum                                         # full bifurcation diagram, r=2.8→4
run feigenbaum 3.0 3.6 200 200                         # period-doubling onset zone
run feigenbaum 3.5699 4 500 500                        # onset of chaos → full chaos
run feigenbaum --start 3.8 --end 4.0 --samples 300    # deep chaos regime, high density
run chaos --start 3.0 --warmup 500                    # long transient discard
```

**Key thresholds:** r=3.0 (period-2) · r=3.45 (period-4) · r=3.5699 (onset of chaos) · r=4.0 (fully chaotic)

---

### 6.18 SURVEILLANCE — Panopticon Index

**Aliases:** `surveillance`, `panopticon`, `legislation`, `governance`, `laws`, `greyc0`

**Function:** `run_surveillance_index(region_code, category_code, threshold)`

**Defaults:** `[0, 0, 0]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `region_code` | `--region`, `--r` | `0` | Jurisdiction: 0=ALL 1=UK 2=EU 3=US 4=AU 5=CA 6=DE 7=FR 8=SE 9=IE 10=NL 11=NZ 12=BE |
| `category_code` | `--category`, `--cat`, `--c` | `0` | Category: 0=ALL 1=encryption_backdoor 2=digital_id 3=biometric 4=data_retention 5=worker 6=scanning 7=traffic 8=age_verify |
| `threshold` | `--threshold`, `--t`, `--severity` | `0` | Minimum severity filter 0–5 (0=all, 3=elevated+, 5=critical only) |

**Usage:**
```
run surveillance                                # all jurisdictions, all categories
run surveillance 1 0 3                          # UK only, all categories, elevated+
run surveillance --region 2 --cat 1            # EU encryption backdoor legislation
run panopticon --severity 5                     # critical threats only, all regions
run laws --region 3 --category 3 --threshold 4 # US biometric surveillance, high severity
```

---

### 6.19 GRAY-SCOTT — Reaction-Diffusion System

**Aliases:** `grayscott`, `gray_scott`, `reaction_diffusion`, `turing`, `morphogenesis`, `pde`

**Stateful kernel** — instance persists across calls. Each invocation computes and returns the next animation frame batch.

**Function:** `GrayScottKernel::compute_steps(feed_rate, kill_rate, frames)`

**Defaults:** `[0.055, 0.062, 50]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `feed_rate` | `--feed`, `--f`, `--feed_rate` | `0.055` | f: rate replenishing u — presets: coral=0.037, spots=0.055, mazes=0.029 |
| `kill_rate` | `--kill`, `--k`, `--kill_rate` | `0.062` | k: rate removing v — presets: coral=0.065, spots=0.062, mazes=0.057 |
| `frames` | `--frames`, `--steps`, `--n` | `50` | Animation frames to compute (1–500; each frame = 10 PDE steps) |

**Usage:**
```
run grayscott                                  # spots preset (default)
run grayscott 0.037 0.065 100                  # coral growth pattern
run grayscott 0.029 0.057 200                  # maze / labyrinthine pattern
run grayscott 0.025 0.060 150                  # solitons / traveling waves
run turing --feed 0.04 --kill 0.06             # near-critical morphogenesis
```

**Presets:**
```
f=0.037, k=0.065   # coral
f=0.055, k=0.062   # spots (default)
f=0.029, k=0.057   # mazes
f=0.025, k=0.060   # solitons
```

---

### 6.20 ML-KEM-CLASSIFIED — Post-Quantum Enclave

**Aliases:** `classified`, `mlkem`, `ml_kem`, `pqc`, `postquantum`, `kem`, `fips203`

**Function:** `run_classified(reveal: f64)`

**Defaults:** `[0]`

| Parameter | Flag(s) | Default | Description |
| :--- | :--- | :--- | :--- |
| `reveal` | `--reveal`, `--show`, `--expose` | `0` | 0=redacted (default), 1=expose full decapsulation key in log |

This kernel does not simply output text — it initiates a **two-stage time-locked decryption sequence**:

1. `run classified` boots the ML-KEM-768 WASM module, navigates to `/cryptography`, and POSTs to the backend challenge endpoint. A 6-character challenge code and 60-second session are issued.
2. The user types `verify <CODE>` within 60 seconds. The backend verifies the HMAC-signed session token, applies a timing-safe comparison, and — on success — decrypts the AES-256-GCM payload.

```
run classified        # initiate: WASM boot → navigate → challenge issued
verify A3F9B2         # respond: submit code within 60s → payload decrypted
```

The underlying algorithm is **ML-KEM-768** (FIPS 203) — a lattice-based key encapsulation mechanism. The kernel logs encapsulation key size (1184 bytes), ciphertext size (1088 bytes), and shared secret entropy metrics before handing off to the backend.

---

## 7. QUICK REFERENCE

```
run soma91                                             # GAIA banner
run biodiversity                                       # ecosystem dynamics
run fishscale                                          # necromantic engine
run bosonic [trust] [thermal]                          # lattice simulator
run climate [ppm] [drag] [sink]                        # atmospheric entropy
run statecraft [sanction] [resilience] [narrative]     # geopolitical kinetics
run leviathan [cells] [generations]                    # V-cache benchmark
run soma_live [consumption] [waste] [dep] [compliance] # stateful soma cycle
run soma55                                             # soma_kernel_5.5 suite boot
run daly [C] [G] [W] [A] [dep] [sub] [yr]             # Daly Rules ODE
run ceei [agents] [goods] [inequality] [diversity]     # A-CEEI allocation
run soma [pop] [eco] [social] [arts] [yr]              # Soma Plus engine
run strangler [seed] [growth] [resistance] [yr]        # Strangler Fig ODE
run kuramoto [n] [coupling] [sigma] [steps]            # synchrony / solidarity
run replicator [b] [c] [p] [mu] [gen]                  # evolutionary game theory
run ising [size] [temp] [field] [sweeps]               # opinion consensus field
run feigenbaum [r0] [r1] [warmup] [samples]            # bifurcation / chaos
run surveillance [region] [category] [threshold]       # panopticon index
run grayscott [feed] [kill] [frames]                   # reaction-diffusion PDE
run classified                                         # ML-KEM-768 enclave (→ verify)
```

---

## 8. COMBINING WITH `load`

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
`KERNELS: content/rust_kernels/src/kernels/ · 19 registered WASM exports`
`REGISTRY: src/wasm/wasm.generated.js · scale94-kernels v0.1.0`
