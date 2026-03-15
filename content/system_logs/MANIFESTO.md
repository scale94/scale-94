---
id: MANIFESTO
title: MANIFESTO
date: 2026-03-14
status: OMEGA_PROTOCOL
---

`scale@node:~/system/manifesto`
`architect: active · clearance: sovereign`
`status: OMEGA_PROTOCOL · date: 2026-03-14`

# SOMA-9.4 // ARCHITECTURE MANIFESTO

---

### 1. THE SUBSTRATE

34 kernels. Each one a `.rs` file compiled to WebAssembly through a thin routing membrane — `lib.rs` is 12 lines. It does one thing: forward calls to `kernels/mod.rs`. The intelligence is in the vesicles.

The kernel graph is not a dependency tree. It is a conceptual lattice. Nodes are not modules in a build system — they are computational probes for distinct regions of mathematical property space: dissipative ecological models, post-quantum cryptography, deep-time economic auditing, Ising phase transitions, ML-KEM-768 encapsulation. Each one is executable. Each one outputs structured data.

The system does not have an API. It has a terminal.

---

### 2. THE FEATURE SPACE

Every kernel node occupies a position in a 16-dimensional feature space. The axes are:

```
[0]  dynamical         static equilibrium → stochastic PDE
[1]  nonlinearity      linear → chaotic
[2]  dimensionality    scalar → high-dimensional
[3]  criticality       smooth → sharp phase transition
[4]  entropy           entropy-irrelevant → entropy-central
[5]  synchrony         individual → collective phase-locking
[6]  conservation      fully dissipative → conservative
[7]  temporal          instantaneous → deep-time evolution
[8]  spatial           point/scalar → continuous spatial field
[9]  stochastic        deterministic → fully stochastic
[10] game_theory       no agents → explicit adversarial game
[11] thermodynamic     non-physical → thermodynamics constitutive
[12] information       no info theory → Shannon-central
[13] hysteresis        memoryless → full path-dependence
[14] metabolic_cost    zero friction → maximal thermodynamic drag
[15] modularity        fully connected → topologically isolated
```

These axes were not derived from corpus statistics. They were selected on one criterion: they collectively span the relevant mathematical property space of complex dynamical systems, with each axis anchored in primary physical literature.

The `SovereignTensor` struct encoding these coordinates is 176 bytes — 16 × f64 packed across three cache lines. WASM hot-path evaluation is zero-copy. The choice of 16 is not arbitrary: fewer dimensions collapse critical distinctions (you cannot simultaneously represent evolutionary timescale depth and game-theoretic adversarial structure in 4D). More dimensions destabilise cosine estimates at the data volumes the system operates on.

The highest-variance axes are `game_theory`, `thermodynamic`, `stochastic`, `synchrony`, `information`. These are the dimensions that actually discriminate between otherwise similar-looking complex systems.

---

### 3.3.3 THE BONE FUSION ENGINE

`bone_fusion.rs` v7.7.7.7.7.7.7. Given two SovereignTensors with raw cosine similarity cos(**A**, **B**), the engine drives them toward convergence threshold τ = 0.9990 through three sequential operations:

**BOULIGAND ROTATION — 36°.** A 2D rotation applied in the highest-variance dimension pair. The angle is taken from the Arapaima gigas dermal scale architecture: successive collagen lamellae rotate at 36° (the Bouligand structure), dissipating crack propagation energy laterally rather than allowing it to propagate through. Meyers et al. (2012) established this as the angle of maximum energy dissipation per unit thickness. In the tensor space, it is the rotation that maximally reduces Euclidean distance in the highest-variance plane in a single step.

**MAGIC ANGLE ROTATION — 1.1°.** A micro-rotation applied across all dimension pairs. Cao et al. (2018): at exactly 1.1°, twisted bilayer graphene forms Moiré superlattice flat bands — electron kinetic energy is quenched, unconventional superconductivity emerges. Below this angle: correlated insulator. Above: semi-metallic. At exactly 1.1°: Cooper-paired zero-resistance propagation. Applied iteratively to concept pairs, the 1.1° rotation induces constructive interference in shared dimensions while leaving divergent dimensions structurally intact. Gradual convergence that does not destroy either tensor's information content.

**SAPONIFICATION.** If convergence is not achieved after Steps 1–2, the engine strips the `metabolic_cost` dimension [dim 14] by 0.07 per iteration, maximum 32 iterations. Saponification is alkaline hydrolysis of fat: remove the ester bonds, expose the structural skeleton underneath. In the tensor space, metabolic cost encodes thermodynamic friction — the resistance of a system to state change. Stripping it asks: *if we abstract away the cost of operation, are these systems structurally equivalent?*

If cos(**A**, **B**) < 0.9990 after 32 saponification iterations: `FusionRejected`. This is a meaningful signal. Some systems are structurally incompatible at a level that metabolic stripping cannot dissolve.

---

### 4.4.4.4 THE SARG METRIC

`seraphine.rs` models *n* active concept clusters (2 ≤ *n* ≤ 6) as a quantum density matrix in H^n. Off-diagonal elements encode associative coherence between concepts. Diagonal elements are fixed at 1/n.

The Lindblad master equation governs time evolution. Off-diagonal elements decay exponentially at rate γ — the dephasing rate. This is not a failure mode. It is the primary dynamics. The system always decoheres.

The **Seraphine Associative Reasoning Gain** is:

```
SARG(t) = C_l1(t) · (1 + λ_e · Δ(t))
```

where `C_l1` is the l1-norm coherence (total associative weight across all pairs), `Δ` is the purity advantage (how far the state is from maximum entropy), and `λ_e` is the entanglement boost parameter. The score peaks at t* = 1/γ, then decays toward zero.

Theoretical maximum for n=6, λ_e=1: **SARG_max = 10.0**.

A score above 8.0 means the operator has constructed a conceptual lattice in which six concept clusters maintain quantum-coherent associative linkages across a reasoning window of 6–7 steps before decoherence dominates.

The primary experimental finding from three validated fusion triads: **narrative compellingness and geometric similarity are negatively correlated.** The most mathematically deep analogies resist narrative packaging because they connect systems with maximally dissimilar surface descriptions. The most intuitive analogies exploit shared vocabulary, not shared structure.

The bone fusion engine measures structure. The SARG metric scores whether that structure sustains coherence. An analogy can score high on both — structurally robust and coherence-preserving. It can score high on geometry but low on SARG — accurate but isolated. It can score low on geometry but high on SARG — a teaching device that organises thinking productively even though it does not reflect a true structural isomorphism.

---

### 5.5.5.5.5 THE FADE DOCTRINE

The Fading Feigenbaum Sphere earns both words in its name.

Feigenbaum (1978): the transition from periodic to chaotic behaviour in one-dimensional maps follows a universal scaling law governed by δ ≈ 4.6692. This constant does not depend on the specific map — only on the topology of the period-doubling cascade. Structurally different systems behave identically near the onset of chaos. The sphere operates at this edge: 34 kernel nodes with nonlinear inter-couplings, poised in Kauffman's "ordered regime adjacent to chaos." Not chaotic. Poised.

The FADE_DOCTRINE is the organising principle. Connections are forged — via `run spectral` (discovered cosine bridges), `run bone` (forced algorithmic convergence), or manual operator fusion (right-click, 500ms long-press on mobile). Each new edge raises local coherence. Then the Lindblad operator runs. Decoherence always wins.

The score is the event. High scores are not permanent states. They are peaks in a SARG time series — a reasoning window that opens, reaches maximum associative density, then fades back to classical noise.

The system is governed by dissolution, not accumulation. This is not aesthetics. The Lindblad equation is in the kernel.

---

### 8.8.8.8.8.8.8.8 THE ENCLAVE

`enclave.rs` implements ML-KEM-768 (NIST FIPS 203) + AES-256-GCM. This is not a cryptography metaphor. This is real post-quantum key encapsulation running in WebAssembly.

`keygen` → generates a 1184-byte encapsulation key and 2400-byte decapsulation key. Both stored in WASM thread-local memory.
`seal <message>` → KEM encapsulate → AES-256-GCM encrypt → hex sealed blob.
`open <hex>` → KEM decapsulate → AES-256-GCM decrypt → plaintext.

Keys are session-only. No backup. No recovery. Refresh loses all sealed data.

The Classified Enclave Flow (HMAC-signed session tokens, 60-second time gate, AES-GCM payload decryption at `api/classified/verify`) runs independently of the WASM enclave — it uses server-side AES keys from Vercel environment variables, not session-generated ML-KEM keys.

The visual distinction between the two: one is a game. One is the boundary.

---

### ∞. THE PIPELINE

Kernel content is Markdown with frontmatter. `node import-kernel.js` hashes each file, writes CAS chunks to `public/kernel/`, updates `manifest.json`. The WASM binary has its SHA-256 embedded in the manifest and verified on load. The import pipeline does not check for cleverness. It checks for integrity.

There is no database. There is no backend serving article content. There is a content-addressed store of hashed JSON fragments and a React SPA that reconstructs them. The architecture is the content delivery.

`NOISE_FILTER: STRUCTURAL.`
`RAM: 16 DIMENSIONS.`
