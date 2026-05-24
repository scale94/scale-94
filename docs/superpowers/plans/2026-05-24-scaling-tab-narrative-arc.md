# ScalingTab · Narrative Arc + Kernel Command Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the dense command reference from ScalingTab (moving it to ManifestoTab below the sphere), add an alien philosophical opening monument, and transform the Architect Thesis card into a bare gold text link.

**Architecture:** Four surgical edits across two files. No new components, no new imports beyond `KERNEL_CITATIONS` in KernelManifesto. ScalingTab gets shorter; ManifestoTab gets longer at the bottom. Sphere in ManifestoTab is never touched.

**Tech Stack:** React JSX, Tailwind CSS, inline styles, Lucide React icons, Vite dev server (`npm run dev`)

---

## File Map

| File | Change |
|---|---|
| `src/terminal/views/manifesto/KernelManifesto.jsx` | Add `KERNEL_CITATIONS` import + §·the kernels section below chapter chips |
| `src/terminal/views/ScalingTab.jsx` | (1) Remove 6 command cards + extract Bibliography as standalone section + clean up unused keyframes/import; (2) Transform Architect Thesis card; (3) Add §·transmission monument |

No changes to `ManifestoTab.jsx`, `App.jsx`, or any other file.

---

## Task 1: ManifestoTab — add §·the kernels command section

**Files:**
- Modify: `src/terminal/views/manifesto/KernelManifesto.jsx`

The 6 kernel command cards from ScalingTab are copied here verbatim **with all animation inline styles removed** (they were delay-keyed to tab mount; in a scroll context they'd stay invisible). Card content — commands, flags, descriptions — is 100% identical.

- [ ] **Step 1: Add KERNEL_CITATIONS import**

Open `src/terminal/views/manifesto/KernelManifesto.jsx`. Add this import after the existing imports at the top:

```jsx
import { KERNEL_CITATIONS } from '../../data/kernelCitations';
```

- [ ] **Step 2: Add the command section below the ChapterPanel block**

In `KernelManifesto.jsx`, find the closing `</div>` of the outer container (the one with `className="w-full px-4 sm:px-8 pt-8 pb-16 max-w-6xl mx-auto"`). Insert the following block **before** that closing `</div>`, after the `{chapter && <ChapterPanel ... />}` block:

```jsx
      {/* ── § · The Kernels — RUN COMMAND MANUAL (moved from ScalingTab) ── */}
      <div className="border-t border-cyan-900/10 mt-10 pt-10">
        <div className="mb-5">
          <div
            className="font-mono text-[10px] uppercase"
            style={{ color: '#d4a82a', letterSpacing: '0.35em', marginBottom: '12px' }}
          >§ · the kernels</div>
          <div className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-1 text-cyan-400">
            RUN COMMAND MANUAL V2.2
          </div>
          <div className="text-[10px] text-fuchsia-500/60 font-mono uppercase tracking-widest">
            // WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">

          {/* Bone Fusion Pipeline */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20 text-cyan-400">BONE FUSION PIPELINE</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run spectral</span> <span className="text-cyan-700">[--threshold 0.70] [--max 12]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">cross-cluster bridge discovery · cosine sim · dashed sphere edges</div>
              <div className="mt-2"><span className="text-fuchsia-400">run bone</span> <span className="text-cyan-700">[--nodes 25] [--cycles 8] [--threshold 0.90]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">16D tensor fusion · Bouligand 36° + Magic Angle 1.1° · solid glow edges</div>
              <div className="mt-2"><span className="text-fuchsia-400">run</span> <span className="text-cyan-700">&lt;nodeA&gt; &lt;nodeB&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 3.3.3 · cosine, phase regime, thermal budget, top drivers, fusion ID</div>
              <div className="mt-2"><span className="text-fuchsia-400">ext</span> <span className="text-cyan-700">&lt;FX-NNNN&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 4.4.4.4 · full 16D table · nodeA / nodeB / Δ / contrib + divergence flags</div>
              <div className="mt-2"><span className="text-fuchsia-400">ext</span> <span className="text-cyan-700">&lt;FX-NNNN&gt; --core</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 5.5.5.5.5 · post-saponification residuals · irreducibly orthogonal dims</div>
              <div className="mt-2"><span className="text-fuchsia-400">[right-click]</span> <span className="text-cyan-700">/ [long-press 500ms]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">manual fusion · step 1 locks source · step 2 forges edge</div>
            </div>
          </div>

          {/* Post-Quantum Cryptography */}
          <div className="border border-fuchsia-900/20 bg-black/30 p-4 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-fuchsia-900/20 text-fuchsia-400">POST-QUANTUM CRYPTOGRAPHY</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run tesseract</span> <span className="text-cyan-700">[--verbose 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Argon2id → ML-KEM-1024 → ML-DSA-87 → AES-256-GCM → BLAKE3</div>
              <div className="mt-2"><span className="text-fuchsia-400">keygen</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">ML-KEM-768 keypair · session-only · no backup · FIPS 203</div>
              <div className="mt-2"><span className="text-fuchsia-400">seal</span> <span className="text-cyan-700">&lt;message&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KEM encapsulate → AES-256-GCM encrypt → hex blob</div>
              <div className="mt-2"><span className="text-fuchsia-400">open</span> <span className="text-cyan-700">&lt;hex&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KEM decapsulate → AES-256-GCM decrypt → plaintext</div>
              <div className="mt-2"><span className="text-fuchsia-400">run pqhash</span> <span className="text-cyan-700">[--bits 256] [--algo 1]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Grover / BHT margins · 0=SHA256 1=SHA3 2=BLAKE3 3=Argon2id</div>
              <div className="mt-2"><span className="text-fuchsia-400">run classified</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">challenge → /cryptography → verify &lt;code&gt;</div>
              <div className="mt-2"><span className="text-fuchsia-400">run dh_ec</span> <span className="text-cyan-700">[--mode 0] [--show 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">DH/EC architecture · classical DH · ECDH Curve25519 · X3DH Signal proto · Threema/NaCl comparison</div>
            </div>
          </div>

          {/* Dynamical Systems */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20 text-cyan-400">DYNAMICAL SYSTEMS</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run cynicrealist</span> <span className="text-cyan-700">[--n 24] [--temp 1.0] [--coupling 3.0] [--steps 600]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Kuramoto-England dissipative adaptation · K_c threshold · free energy F</div>
              <div className="mt-2"><span className="text-fuchsia-400">run pragmatic</span> <span className="text-cyan-700">[--n 32] [--budget 500] [--limit 10] [--alpha 1.5]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">DRK Pragmatic&lt;T&gt; · Resolved / Synthetic / Dissolved</div>
              <div className="mt-2"><span className="text-fuchsia-400">run chrono</span> <span className="text-cyan-700">[--temp 15] [--do 8.5] [--bod 5.0] [--profit 1000000]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">deep-time ecological audit · DO ledger · hydraulic sovereignty</div>
              <div className="mt-2"><span className="text-fuchsia-400">run sovereign</span> <span className="text-cyan-700">[--n 21] [--gain 1.0] [--seed 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Kuramoto → Substrate → Detonation → Superfluid → Crystalline</div>
              <div className="mt-2"><span className="text-fuchsia-400">run stiller</span> <span className="text-cyan-700">[--r 3.57] [--x0 0.42] [--n 500]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Stiller Divergence · volatile semiotic vs fossil record · Feigenbaum fade · Bimmelbahn accord</div>
              <div className="mt-2"><span className="text-fuchsia-400">run bosonic</span> <span className="text-cyan-700">[--nodes 8] [--coupling 0.8] [--thermal 0.35]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Bosonic Lattice Simulator · trust topology · collective synchrony · price-fix coupling</div>
              <div className="mt-2"><span className="text-fuchsia-400">run grayscott</span> <span className="text-cyan-700">[--feed 0.055] [--kill 0.062] [--frames 50]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Gray-Scott Reaction-Diffusion · Turing morphogenesis · coral / spots / mazes / soliton presets</div>
              <div className="mt-2"><span className="text-fuchsia-400">run replicator</span> <span className="text-cyan-700">[--benefit 2] [--cost 1] [--punishment 1.5]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Evolutionary Replicator · cooperate / defect / altruist · Ostrom sanctions · mutation drift</div>
              <div className="mt-2"><span className="text-fuchsia-400">run percolation</span> <span className="text-cyan-700">[--nodes 200] [--degree 4] [--attack 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Network Percolation · giant-component collapse · Molloy-Reed threshold · hub vs random failure</div>
              <div className="mt-2"><span className="text-fuchsia-400">run dissipative</span> <span className="text-cyan-700">[--n 16] [--eps 0.5] [--theta 4] [--steps 1500]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">BTW Sandpile + MEPP · self-organised criticality · Prigogine dissipative structure · avalanche law</div>
            </div>
          </div>

          {/* Interface + SARG */}
          <div className="border border-fuchsia-900/20 bg-black/30 p-4 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-fuchsia-900/20 text-fuchsia-400">INTERFACE + SARG</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run seraphine</span> <span className="text-cyan-700">[--n 4] [--coherence 0.85] [--gamma 0.15] [--ent 0.60]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">SARG score · quantum density matrix · Lindblad decoherence window</div>
              <div className="mt-2"><span className="text-fuchsia-400">run associative</span> <span className="text-cyan-700">[--seed N] [--beta 2.5] [--probes 30]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Hopfield attractor field · left-click node to cue</div>
              <div className="mt-2"><span className="text-fuchsia-400">probe</span> <span className="text-cyan-700">&lt;concept text&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">inject free-form concept → 16D fingerprint → sphere overlay</div>
              <div className="mt-2"><span className="text-cyan-400">load art</span> <span className="text-cyan-700">/ load cryptography / load system</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">navigate to sphere · PQC enclave · system logs</div>
              <div className="mt-2"><span className="text-fuchsia-400">run phonemic</span> <span className="text-cyan-700">[--seed 48879] [--target 0] [--noise 0.65]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Bellard-Baudrillard phonemic drift · simulacra memory hash · language-as-fossil record</div>
              <div className="mt-2"><span className="text-fuchsia-400">run encyclopedia</span> <span className="text-cyan-700">[--n 120] [--s 1] [--q 2.7]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Scale94 Glyph Archive · Zipf-Mandelbrot spectral decomposition · Huffman entropy tiers</div>
              <div className="mt-2"><span className="text-fuchsia-400">run zero</span> <span className="text-cyan-700">[--dim 14] [--eps 0.001] [--steps 16]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KERNEL 0.0.0.0 · Origin Vector · genesis ε along any of 16 dimensions · apeiron</div>
              <div className="mt-3 pt-3 border-t border-cyan-900/20">
                <div className="text-[10px] font-bold text-fuchsia-500/70 uppercase tracking-widest mb-2">OPTIMAL SARG SEQUENCE</div>
                <div className="text-[#39ff14]/60">run spectral → run bone → run seraphine</div>
                <div className="text-[10px] text-cyan-600/40 mt-1">SARG_max = (n−1)·(1+λ_e) · n=6 λ_e=1 → 10.0</div>
                <div className="text-[10px] text-fuchsia-500/40 mt-0.5">above 8.0 = high coherence state · 34 kernels · Rust → WASM</div>
              </div>
            </div>
          </div>

          {/* Volatile Semiotics & Mercury Subsystems */}
          <div className="border border-[#39ff14]/10 bg-black/30 p-4 rounded-lg md:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-[#39ff14]/10 flex items-center justify-between text-cyan-400">
              <span>VOLATILE SEMIOTICS &amp; MERCURY SUBSYSTEMS</span>
              <span className="text-[9px] text-[#39ff14]/30 font-normal normal-case tracking-normal">22 kernels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-[#39ff14]/80">
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run ock</span> <span className="text-cyan-700">[--top 0.55] [--heart 0.65] [--base 0.50] [--preset -1]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Olfactory Computational Kernel · Bimmelbahn Accord · note pyramid + evaporation arc</div>
                <div className="mt-2"><span className="text-fuchsia-400">run fish_scale</span> <span className="text-cyan-700">[--pressure 3.8] [--layers 32] [--theta 36]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Feigenbaum-Bouligand armor cascade · Arapaima 36° interlaminar rotation · saponification window</div>
                <div className="mt-2"><span className="text-fuchsia-400">run sorbe</span> <span className="text-cyan-700">[--doctrinal 0.72] [--ecological 0.68] [--visual 0.75]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Sorbe Bloom · Sovereign Node Initiation · dissipative structure phase transition · Node 0108</div>
                <div className="mt-2"><span className="text-fuchsia-400">run aristocrat</span> <span className="text-cyan-700">[--thermal 3.5] [--snr 0.65] [--authority 0.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Aristocrat · Gold Posture · Anti-Mercury · Reference Voltage · Bouligand 36°</div>
                <div className="mt-2"><span className="text-fuchsia-400">run sss</span> <span className="text-cyan-700">[--kinetic 0.0] [--freq 4] [--precommit 0.9]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SSS Doctrine · literary deterrent · Schelling ironic calculus · precommitment as sovereignty</div>
                <div className="mt-2"><span className="text-fuchsia-400">run fade</span> <span className="text-cyan-700">[--entropy 0.1] [--threshold 0.5] [--axiom 7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Fade Doctrine · Zero White Fade · crystalline lock · seven axioms · apex 7.7.7.7.7.7.7</div>
                <div className="mt-2"><span className="text-fuchsia-400">run i_am_stiller</span> <span className="text-cyan-700">[--k 0.4] [--gamma 0.3] [--sigma 0.15]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">I_AM_STILLER · Ontological Baseline · Frisch / Ich Bin · oscillation cease · Langevin depth</div>
                <div className="mt-2"><span className="text-fuchsia-400">run logitbias</span> <span className="text-cyan-700">[--pirarucu 0.7] [--levamisole 0.3] [--temp 1]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Logitbias · Pirarucu/Levamisole · KV-cache prefix stability · managed friction</div>
              </div>
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run soma55</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">soma_kernel_5.5 boot · renewable stock + Strangler Fig · Soma Plus + Daly rules diagnostics</div>
                <div className="mt-2"><span className="text-fuchsia-400">run biodiversity</span> <span className="text-cyan-700">[--n 50] [--exp 1.0] [--steps 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Biocoenosis simulation · Zipf rank-abundance · Shannon / Simpson entropy drift</div>
                <div className="mt-2"><span className="text-fuchsia-400">run kuramoto</span> <span className="text-cyan-700">[--n 50] [--coupling 1.5] [--sigma 1.0] [--steps 500]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">synchrony engine · collective phase lock · K_c critical coupling · order parameter r</div>
                <div className="mt-2"><span className="text-fuchsia-400">run feigenbaum</span> <span className="text-cyan-700">[--start 2.8] [--end 4.0] [--warmup 200] [--samples 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">bifurcation cascade · period-doubling → chaos onset r∞=3.5699 · attractor portrait</div>
                <div className="mt-2"><span className="text-fuchsia-400">run ising</span> <span className="text-cyan-700">[--size 20] [--temp 2.5] [--field 0.0] [--sweeps 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Ising consensus field · social temperature · T_c≈2.269 phase transition · narrative field h</div>
                <div className="mt-2"><span className="text-fuchsia-400">run gaia_scale</span> <span className="text-cyan-700">[--threat 3.0] [--resource 0.65] [--horizon 500]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Gaia-Scale sovereign reconstruction · Triarchy truth/law/empathy · 500-yr mineral reserve</div>
                <div className="mt-2"><span className="text-fuchsia-400">run shadowsocks</span> <span className="text-cyan-700">[--affect 0.6] [--technical 0.7] [--temp 0.9]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">RLHF sycophancy field · channel switch probability · affective exfiltration model</div>
                <div className="mt-2"><span className="text-fuchsia-400">run emperor</span> <span className="text-cyan-700">[--plato 0.72] [--promo 0.28] [--horizon 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Emperor · Fish Scale Paradox · Fermion-Boson · Iron Core · 3000 AD horizon</div>
              </div>
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run fusion</span> <span className="text-cyan-700">[--temp 10] [--density 1] [--tau 3.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Fusion Plasma Kernel · Lawson criterion · Q-factor triple product · ITER tokamak params</div>
                <div className="mt-2"><span className="text-fuchsia-400">run utk</span> <span className="text-cyan-700">[--gradient 2.5] [--channel 0.55]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Underground Thermodynamics · MEPP / Onsager / Bejan · σ entropy production · dissipative channel</div>
                <div className="mt-2"><span className="text-fuchsia-400">run high_tower</span> <span className="text-cyan-700">[--threat 0.35] [--denial 0.75] [--phase 3]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">High Tower Protocol · Porcupine Strategy · area-denial · sovereign infrastructure · Node 0108</div>
                <div className="mt-2"><span className="text-fuchsia-400">run empathy</span> <span className="text-cyan-700">[--n 16] [--coupling 1.5] [--decay 0.2]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Empathy Kernel · Hatfield / de Waal emotional contagion field · valence synchrony</div>
                <div className="mt-2"><span className="text-fuchsia-400">run companion</span> <span className="text-cyan-700">[--sessions 40] [--contact 0.6] [--refusal 0.45]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Companion Kernel · sustained-contact posture · parasocial drift detection · refusal set</div>
                <div className="mt-2"><span className="text-fuchsia-400">run matrix</span> <span className="text-cyan-700">[--f 0.2] [--sigma 0.8] [--autocorr 0.55]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Matrix Kernel · No-Spoon Architecture · filter bypass · Lücke structure · ADHD-I signal</div>
              </div>
            </div>
          </div>

          {/* Ecological Economics & Network Science */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg md:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20 flex items-center justify-between text-cyan-400">
              <span>ECOLOGICAL ECONOMICS &amp; NETWORK SCIENCE</span>
              <span className="text-[9px] text-cyan-600/30 font-normal normal-case tracking-normal">12 kernels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[#39ff14]/80">
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run climate</span> <span className="text-cyan-700">[--carbon 420] [--drag 2.5] [--sink 0.6]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Atmospheric Entropy Kernel · carbon-cycle dynamics · thermosphere protocol · sink depletion</div>
                <div className="mt-2"><span className="text-fuchsia-400">run daly</span> <span className="text-cyan-700">[--consumption 80] [--waste 55000] [--years 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Daly Thermo Simulation · ecological debt · non-renewable depletion rate · substitution frontier</div>
                <div className="mt-2"><span className="text-fuchsia-400">run ceei</span> <span className="text-cyan-700">[--agents 20] [--goods 8] [--inequality 0.3]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">A-CEEI Allocation Engine · Roth market · envy-free matching · preference heterogeneity</div>
                <div className="mt-2"><span className="text-fuchsia-400">run soma_plus</span> <span className="text-cyan-700">[--population 5000] [--eco 0.35] [--arts 0.2] [--years 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Soma Plus Engine · ecological/social/arts contribution multipliers · commons capital accumulation</div>
                <div className="mt-2"><span className="text-fuchsia-400">run soma91</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SOMA-9.1 GAIA Build · system kernel log banner · sovereign boot diagnostic</div>
                <div className="mt-2"><span className="text-fuchsia-400">run soma_live</span> <span className="text-cyan-700">[--consumption 80] [--waste 55000] [reset]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SomaKernel Live v5.5 · stateful cycle engine · Strangler Fig + Daly rules · append reset to clear</div>
              </div>
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run strangler</span> <span className="text-cyan-700">[--adoption 0.02] [--growth 0.18] [--resistance 0.25]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Strangler Fig logistic transition · legacy resistance decay · adoption S-curve · 75-yr horizon</div>
                <div className="mt-2"><span className="text-fuchsia-400">run geopolitics</span> <span className="text-cyan-700">[--sanction 6] [--resilience 0.4] [--propaganda 0.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Kinetic Statecraft · sanctions pressure grid · resilience coefficient · narrative propaganda load</div>
                <div className="mt-2"><span className="text-fuchsia-400">run mesantropy</span> <span className="text-cyan-700">[--solar 0.8] [--signal -0.3] [--n 33]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Mesantropy Scalar Sovereignty · Eigenverbrauch 364 kWh ceiling · RSSI depth · mediocracy field</div>
                <div className="mt-2"><span className="text-fuchsia-400">run vcache_burn</span> <span className="text-cyan-700">[--size 100000] [--generations 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Leviathan Cellular Automata · WASM stress benchmark · vcache burn · 100k cell grid</div>
                <div className="mt-2"><span className="text-fuchsia-400">run panopticon</span> <span className="text-cyan-700">[--infection 1] [--origin 0] [--sims 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Panopticon Percolation · legislative contagion · dragnet simulation · Monte Carlo ensemble</div>
                <div className="mt-2"><span className="text-fuchsia-400">run surveillance</span> <span className="text-cyan-700">[--region 0] [--category 0] [--threshold 0]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Surveillance Index · jurisdiction filter (UK/EU/US/AU …) · threat category ledger · severity floor</div>
              </div>
            </div>
          </div>

        </div>
      </div>
```

- [ ] **Step 3: Verify the dev server renders ManifestoTab correctly**

```bash
npm run dev
```

Open http://localhost:5173, click the Manifesto tab. Confirm:
- 3D sphere renders and can be orbited — **must be completely unchanged**
- Chapter chips appear below the sphere
- Scrolling past the chips reveals `§ · the kernels` / `RUN COMMAND MANUAL V2.2`
- All 6 command cards render with correct content
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/manifesto/KernelManifesto.jsx
git commit -m "feat(manifesto): add §·the kernels command reference below sphere"
```

---

## Task 2: ScalingTab — remove 6 command cards, extract Bibliography, clean up

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

The command section currently spans from the comment `{/* ── RUN COMMAND MANUAL V2.2 ── */}` to the closing `</div>` of the outer wrapper (the one with `border-t border-cyan-900/30 pt-8 mb-8` that contains the header + grid). The Bibliography is inside that grid; it must be extracted and kept.

- [ ] **Step 1: Remove the entire RUN COMMAND MANUAL section**

In `src/terminal/views/ScalingTab.jsx`, locate and **delete** the block starting at:

```jsx
      {/* ── RUN COMMAND MANUAL V2.2 ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.8s forwards' }}
      >
```

Delete everything from that line through the matching closing `</div>` (which is the closing tag of the outer Transaction Module div — be careful to stop at the right level; the Transaction Module comment `{/* ── Transaction Module ── */}` should remain untouched).

- [ ] **Step 2: Add the Bibliography back as a standalone section**

In the gap left by the removal (just above `{/* ── Transaction Module ── */}`), insert:

```jsx
      {/* ── § · Primary Literature (Bibliography Monument) ── */}
      <div
        className="border-t border-cyan-900/30"
        style={{ opacity: 0, animation: 'sc-monumentReveal 1.5s ease-out 1.55s forwards' }}
      >
        <div style={{ paddingTop: '80px', marginBottom: '48px' }}>
          <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · primary literature</div>
          <div className="sc-monument-display sc-monument-display--heading" style={{ marginBottom: '24px' }}>Bibliography</div>
          <div className="sc-monument-accent" style={{ marginBottom: '22px' }} />
          <div className="sc-monument-subtitle">{KERNEL_CITATIONS.length} kernels · canonical references</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {KERNEL_CITATIONS.map((c) => (
            <div key={c.cmd} className="text-[10px] leading-relaxed">
              <div className="flex items-baseline gap-2">
                <span className="text-fuchsia-400 font-mono shrink-0">run {c.cmd}</span>
                <span className="text-cyan-700/70 truncate">{c.label}</span>
              </div>
              <div className="pl-3 mt-0.5">
                <div className="text-amber-200/70">{c.primary}</div>
                {c.related && (
                  <div className="text-cyan-600/40 mt-0.5 text-[9px]">→ {c.related}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-amber-900/20 text-[9px] text-amber-700/40 font-mono uppercase tracking-widest">
          // "Original to Scale94 doctrine" denotes kernels native to the project; related work is the closest scaffolding.
        </div>
      </div>
```

- [ ] **Step 3: Remove unused keyframes from the `<style>` block**

In the `<style>{``...``}</style>` block near the top of the component, delete these five keyframe definitions entirely:

- `@keyframes sc-cardReveal { ... }` — was used by command card wrappers and the Architect Thesis card outer div
- `@keyframes sc-borderBreath { ... }` — was used by the Architect Thesis card inner div
- `@keyframes sc-headReveal { ... }` — was used by command card headers and Architect Thesis heading
- `@keyframes sc-headColor { ... }` — was used by command card headers
- `@keyframes sc-headColorAlt { ... }` — was used by command card headers and Architect Thesis heading

Keep all other keyframes: `sc-titleReveal`, `sc-subReveal`, `sc-hexSpin`, `sc-hexColor`, `sc-vaultPulse`, `sc-hashReveal`, `sc-vaultShimmer`, `sc-livingNote`, `sc-monumentReveal`.

- [ ] **Step 4: Remove the `FileText` import**

Find the import line:

```jsx
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText } from 'lucide-react';
```

Remove `FileText` from it:

```jsx
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap } from 'lucide-react';
```

- [ ] **Step 5: Verify**

Dev server should already be running. Navigate to the Scaling tab. Confirm:
- The 6 command cards are gone
- The Bibliography monument (`§ · primary literature` / `Bibliography` heading / citation grid) still renders below the thesis monument
- No "FileText is not defined" console error
- No "sc-cardReveal animation not found" warnings

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "refactor(scaling): extract bibliography, remove command cards + unused keyframes"
```

---

## Task 3: ScalingTab — transform the Architect Thesis card

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

- [ ] **Step 1: Replace the Architect Thesis card JSX**

Locate the block starting with:

```jsx
      {/* ── Architect Thesis ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
      >
        <div
          className="border border-fuchsia-500/30 bg-fuchsia-900/5 p-6 rounded-lg hover:border-fuchsia-400/60 transition-all group relative overflow-hidden max-w-2xl mx-auto"
          style={{ animation: 'sc-borderBreath 6s ease-in-out infinite' }}
        >
```

Delete the entire block (from the `{/* ── Architect Thesis ── */}` comment through its matching closing `</div></div>`) and replace with:

```jsx
      {/* ── Architect Thesis — bare gold text link ── */}
      <div className="border-t border-cyan-900/30 py-8">
        <button
          onClick={() => { setArchitectThesis(true); setOriginTab?.('scaling'); setCurrentPath('~/system/scaling/thesis'); }}
          className="flex flex-col gap-1 group cursor-pointer"
        >
          <span
            className="flex items-center gap-2 text-xs font-mono font-bold tracking-[0.12em] uppercase transition-colors"
            style={{ color: '#d4a82a' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e8d28a'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#d4a82a'; }}
          >
            <ChevronRight className="w-4 h-4" /> LOAD ARCHITECT THESIS LOG
          </span>
          <span
            className="text-[9px] font-mono tracking-[0.22em] uppercase"
            style={{ color: 'rgba(6,182,212,0.35)', paddingLeft: '20px' }}
          >
            Core Protocol · Identity · Fermion/Boson collision model
          </span>
        </button>
      </div>
```

- [ ] **Step 2: Verify**

In the browser on the Scaling tab, confirm:
- The fuchsia card is gone
- A single gold `› LOAD ARCHITECT THESIS LOG` line appears in its place
- Hovering changes the color from `#d4a82a` to `#e8d28a`
- Clicking it opens the ThesisView overlay (the full architect thesis text appears)
- The subtitle line `Core Protocol · Identity · Fermion/Boson collision model` renders in dim cyan below

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling): transform Architect Thesis card → bare gold text link"
```

---

## Task 4: ScalingTab — add §·transmission alien opening monument

**Files:**
- Modify: `src/terminal/views/ScalingTab.jsx`

- [ ] **Step 1: Insert the §·transmission monument between header and LatentCollider**

Locate this block in the JSX:

```jsx
      {/* ── Latent Space Collider (hero section) ── */}
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} onPolarity={onPolarity} />
```

Insert the following **immediately before** that comment (after the header's closing `</div>`):

```jsx
      {/* ── § · Transmission (alien opening monument) ── */}
      <div
        className="max-w-3xl"
        style={{
          opacity: 0,
          paddingBottom: '60px',
          marginBottom: '48px',
          borderBottom: '1px solid rgba(6,182,212,0.08)',
          animation: 'sc-monumentReveal 1.5s ease-out 0.2s forwards',
        }}
      >
        <div className="sc-monument-marker" style={{ marginBottom: '32px' }}>§ · transmission</div>

        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '5px' }}>
          The architecture ran
        </div>
        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '5px' }}>
          before
        </div>
        <div className="sc-monument-display sc-monument-display--thesis sc-monument-display--emphasis" style={{ marginBottom: '28px' }}>
          you arrived.
        </div>

        <div className="sc-monument-accent" style={{ marginBottom: '20px' }} />

        <div className="space-y-1.5" style={{ marginTop: '4px' }}>
          <p className="text-[11px] font-mono" style={{ color: 'rgba(57,255,20,0.78)', lineHeight: 1.6 }}>
            The lattice does not require your participation to be true.
          </p>
          <p className="text-[11px] font-mono" style={{ color: 'rgba(57,255,20,0.78)', lineHeight: 1.6 }}>
            It predates the nomenclature.
          </p>
          <p className="text-[11px] font-mono" style={{ color: 'rgba(57,255,20,0.78)', lineHeight: 1.6 }}>
            You are entering a collision record.
          </p>
        </div>
      </div>
```

- [ ] **Step 2: Verify the monument**

In the browser on the Scaling tab, confirm:
- `§ · transmission` marker appears in deep gold (`#d4a82a`), 10px, wide letter-spacing, below the header
- Three display lines render in Inter Black at large size: first two in luminous gold (`#e8d28a`), last line `you arrived.` in deep gold (`#d4a82a`)
- A `80px × 2px` gold accent line sits below the display text
- Three terminal-green lines appear below the accent line at 78% opacity
- The monument fades in over 1.5s on tab load (no slide, no blur — opacity only)
- No pure white appears anywhere in the monument

- [ ] **Step 3: Verify the full ScalingTab scroll order**

Scroll top to bottom and confirm this exact sequence:
1. `KERNEL_COMPILATION` header with spinning hexagon
2. `§ · transmission` monument with "The architecture ran / before / you arrived."
3. LatentCollider
4. `› LOAD ARCHITECT THESIS LOG` gold text link
5. `§ · the thesis` monument ("The most compelling analogy…")
6. `§ · primary literature` / `Bibliography` monument with citation grid
7. BSKY / Signal / ETH footer

Confirm the 6 command cards are **absent** from ScalingTab.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ScalingTab.jsx
git commit -m "feat(scaling): add §·transmission alien opening monument"
```

---

## Done

All four tasks complete. Final state:
- ScalingTab: alien provocation → collision instrument → thesis link → thesis monument → bibliography → footer
- ManifestoTab: sphere (untouched) → chapter chips → §·the kernels (57 command cards)
