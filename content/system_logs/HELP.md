---
id: HELP
title: SYSTEM COMMAND REFERENCE
subtitle: Terminal Interface v9.4 — Command Documentation
date: 2026-03-11
---

## NAVIGATION

* **home** / **kernel** / **system** — Return to the Kernel module browser.
* **scent** / **saponification** / **scaling** / **services** — Open the Saponification chamber.
* **transmission** — Open the Signal/Fiction archive.
* **manifesto** / **about** — Display the Architect Identity Protocol.
* **privacy** — Display the Privacy Protocol.
* **thesis** — Load the ARCHITECT_THESIS log.
* **cryptography** / **classified** / **pqc** / **mlkem** — Open the Post-Quantum Cryptography enclave.
* **surveillance** / **panopticon** / **legislation** — Open the Surveillance Index.

## WASM KERNEL EXECUTION

* **run \<kernel\>** — Execute a compiled Rust/WASM simulation kernel by name or alias.
* **run \<kernel\> \[args...\]** — Pass positional arguments to the kernel function.
* **run \<kernel\> --flag value** — Pass named flags. Flags are normalized — partial names accepted.
* **run \<kernel\> --help** — Print the kernel's full parameter reference.
* **run --help** — List all 19 registered kernels with aliases and signatures.

**Common kernels:**
```
run soma55           run daly             run ceei
run soma             run strangler        run bosonic
run climate          run statecraft       run leviathan
run kuramoto         run replicator       run ising
run feigenbaum       run grayscott        run surveillance
run classified       run biodiversity     run fishscale
run soma_live
```

## CLASSIFIED ENCLAVE

* **run classified** — Boot the ML-KEM-768 WASM kernel and initiate a time-locked decryption session. Navigates to `/cryptography` and issues a 60-second challenge code.
* **verify \<CODE\>** — Submit the 6-character challenge response. Must be entered within 60 seconds.

## SPECIAL OPERATIONS

* **breach** — Launch the Breach Protocol ICE-breaking minigame. Costs 4 RAM units.
* **relic** — Activate Relic Malfunction Mode. Amplifies glitch layers and floods the system log with diagnostic entropy for 5 seconds.

## KERNEL OPERATIONS

* **load \[term\]** — Fuzzy-search and load a kernel module. Supports partial ID, name, or title. Autocomplete activates after `load `.
* **list** — Print all registered kernel modules to the system log.
* **search \[term\]** — Apply a live filter to the kernel index. Matches ID, name, desc, and **tags** from the associative index.

## TERMINAL

* **clear** — Clear the system log.
* **help** — Display this reference.
* **exit** — Disconnect terminal interface.

## KEYBOARD SHORTCUTS

* **↑ / ↓** — Navigate command history or autocomplete dropdown.
* **Tab** — Accept top autocomplete suggestion.
* **Esc** — Dismiss autocomplete dropdown.

## NEURAL LINKS

Articles may contain <button class="neural-link text-cyan-400 underline underline-offset-2 hover:text-cyan-200 cursor-pointer bg-transparent border-none font-mono text-xs font-bold" data-cmd="RUN-COMMAND-MANUAL">RUN-COMMAND-MANUAL</button> inline kernel links. Clicking one fires the full kernel load sequence for that ID — identical to typing `load <id>` in the terminal.
