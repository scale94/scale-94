import CouncilRing from './CouncilRing';

export default function KernelManifesto() {
  return (
    <div className="w-full px-4 sm:px-8 pt-8 pb-16 max-w-6xl mx-auto">
      {/* Manifesto header — claim, not decoration */}
      <div className="mb-6">
        <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <span style={{ color: 'rgba(6,182,212,0.6)', fontSize: 14 }}>◉</span>
          § · THE SIXTEEN · 16 MINDS · 16-DIMENSIONAL FEATURE SPACE
        </div>
        <h1
          className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight mb-3 text-transparent bg-clip-text"
          style={{
            backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
          }}
        >
          The most compelling analogy<br />
          has the weakest geometry.
        </h1>
        <p className="text-sm text-fuchsia-400/70 max-w-2xl leading-relaxed font-mono">
          Sixteen minds, one per axis of the feature space. Eight built the instruments;
          eight read them and told the species how to survive. The answers were never
          missing. Click a seat in the safe operating space to read what it saw.
        </p>
      </div>

      <CouncilRing />

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
            {'// WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL'}
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
    </div>
  );
}
