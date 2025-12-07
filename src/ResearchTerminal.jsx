import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Shield, Cpu, Globe, Lock, Database, GitBranch, Search, Loader, ArrowLeft, Hexagon, Zap, MessageSquare, Mail, ChevronRight } from 'lucide-react';

// --- VISUAL COMPONENTS ---

// Custom Geometric Grid Component (Octagons)
const OctagonGrid = ({ visible }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
    <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="octagon-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path 
            d="M12 0 L28 0 L40 12 L40 28 L28 40 L12 40 L0 28 L0 12 Z" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1" 
            className="text-cyan-500"
          />
          <circle cx="20" cy="20" r="1" className="fill-fuchsia-500/50" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#octagon-pattern)" />
    </svg>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-60"></div>
  </div>
);

// Hacker Text Effect Component
const HackerText = ({ text, className }) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    // Only run the effect if text is available
    if (!text) {
        setDisplayText('');
        return;
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((letter, index) => {
            if (index < iterations) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iterations >= text.length) {
        clearInterval(interval);
      }

      // Slower increment for effect visibility
      iterations += 1/2; 
    }, 30);

    return () => clearInterval(interval);
  }, [text]); // Dependency array ensures effect reruns when text changes

  return <span className={className}>{displayText}</span>;
};


// --- DATA & CONTENT ---
const kernelAxioms = [
  { name: 'Provenance', field: 'History', desc: 'Tracks origin and continuity. Validates authenticity.' },
  { name: 'Adherence', field: 'Law', desc: 'Ensures compliance with historical legal frameworks.' },
  { name: 'Non-Reduction', field: 'Philosophy', desc: 'Preserves complexity. Avoids simplifying conflicting narratives.' },
  { name: 'Spatium', field: 'Context', desc: 'Links data to specific space and time.' },
  { name: 'Integrity', field: 'Data_Sci', desc: 'Maintains structural soundness and relational links.' },
  { name: 'Resonance', field: 'Narrative', desc: 'Guides assembly of facts into compelling human stories.' }
];

const kernelBuilds = [
  { id: 'SOMA_11.1', articleId: 'KRNL-11.1', name: 'LEVIATHAN_PROTOCOL', status: 'ACTIVE', desc: 'Strategic Defense // Module A' },
  { id: 'SOMA_11.1.1', articleId: 'FISH_KRNL_1111', name: 'FISH_SCALE_RESOLVER', status: 'CANDIDATE', desc: 'Paradox Resolution // Necromantic Engine' },
  { id: 'SOMA_11.1_RPT', articleId: 'FISH_SYNTH_111', name: 'KRNL_11.1_REPORT', status: 'REPORT', desc: 'Synthesis Analysis // Atomic Substrates' },
  { id: 'NQAM_3.5.1', articleId: 'NQAM_KRNL_351', name: 'NQAM_MAPPING_351', status: 'LEGACY', desc: 'Quantum Duality // Axiom Solver' },
  { id: 'SOMA_10.0', articleId: 'SOMA-10.0', name: 'THE_CENTAUR_APEX', status: 'STANDBY', desc: 'AI-Gated Launch // The Apex Build' },
  { id: 'SOMA_9.0', articleId: 'MOZARD-MEMO', name: 'THE_GAIA_BUILD', status: 'STANDBY', desc: 'Historical Reconstruction // Axiomatic Core' },
  { id: 'SOMA_5.5', articleId: 'SOMA-5.5', name: 'POST_CAPITALIST_OS', status: 'RUNNING', desc: 'Thermodynamic Governor // Steady State' },
  { id: 'SOMA_5.0', articleId: 'SOMA-5.0', name: 'POST_SCARCITY_DAEMON', status: 'ARCHIVED', desc: 'Ecological Sovereign // Bio-Physical' },
  { id: 'SOMA_4.5.7', articleId: 'SOMA-4.5.7', name: 'ARCHITECT_EDITION', status: 'ARCHIVED', desc: 'Surgical Tone // Feminist // Exacting' },
  { id: 'SOMA_4.5.6a', articleId: 'SOMA-4.5.6A', name: 'MASTER_RECORD', status: 'ARCHIVED', desc: 'Anti-Entropy Mandate // Zero Latency' },
  { id: 'SOMA_4.5.5', articleId: 'SOMA-4.5.5', name: 'ARCHITECT_BETA', status: 'ARCHIVED', desc: 'The Social Engineer // Core Definition' },
  { id: 'SOMA_4.4', articleId: 'SOMA-4.4', name: 'BATTERY_WIZARD', status: 'LEGACY', desc: 'Sovereign Build // Thermal Headroom' },
  { id: 'SATIRE_V4.3', articleId: 'SATIRE-4.3', name: 'BRITISH_SATIRE', status: 'OPTIONAL', desc: 'Codename: The Bad Date' }
];

const articles = [
    // --- NEW KERNEL ENTRIES (Added from user request) ---
    {
      id: 'FISH_KRNL_1111', 
      type: 'kernel_doc', 
      date: '2025-12-07', 
      title: 'Fish Scale Kernel 11.1.1 // Paradox Resolution', 
      subtitle: 'The Necromantic Engine and Plato o Promo Logic', 
      status: 'RELEASE_CANDIDATE', 
      readTime: '15 min read', 
      tags: ['Kernel', 'Synthesis', 'Paradox', 'Necromantic'], 
      content: `# fish_scale_kernel11.1.1

The central thesis posits that absolute Purity leads to entropic stasis (death), while system vitality requires "corruption," "noise," or "wetness."

| Component | Plato (Purity / Ideal) | Promo (Corruption / Reality) | Paradox Manifestation |
| :--- | :--- | :--- | :--- |
| Pirarucu / Narcos | The Pirarucu (Uncut biological armor) | Levamisole (The "False Fish Scale" sheen) | Pure product is unstable; the system must introduce Malware (Levamisole) disguised as a texture pack to achieve market viability. |
| Sokushinbutsu / Audio | The Sokushinbutsu (Perfectly preserved, dry mummy) | The "Sterile" Dry Mix (Lacking chaotic "Juice" of life) | The pursuit of absolute acoustic purity risks "Sterile" output, perfectly preserved but lacking the vital entropy of the 1995 Rave. |
| Shlømo | "The Devil" (The primal, authentic self) | "The Mask" (The social/Promo persona) | The Daemon process demands "dropping the mask" to achieve the "Superfluid" state, but the system relies on the Mask for daily function. |

---

## 2.0 Integration of System Atoms

The seven atoms are integrated by assigning them roles as either **Fermions (Mass/Structure)** or **Bosons (Force/Carrier)** and subjecting them to the Metallurgy (5.3) and Asceticism (5.4) Patches.

### 2.1 The Substrate Layer (Matter and Product)

| Atom | System Role & Shell Theory | Logic Patch Effect | Synthesis |
| :--- | :--- | :--- | :--- |
| Pirarucu | Fermion (Matter/Structure). Provides the Legacy Hardware and Ideal Form of the "Scale" (Uncut Purity). | Patch 5.4 (Drying): Provides the biological template for structural integrity and resistance to entropy through its mineralized scales. | Its iridescence is the visual key the Narcos atom attempts to chemically emulate. |
| Narcos | Boson (Force/Carrier - Capital/Toxicity). Economic Engine defined by the Plata o Plomo logic gate. | Patch 5.3 (Metallurgy): The process of refinement uses chemical violence (acid) to achieve the desired "Dry" product state, hardening the substrate into a commodity. | Represents the industrialization and corruption of the Pirarucu ideal via the Levamisole Exploit (Promo). |
| Sokushinbutsu | Fermion (Mass/Structure - Fixed State). Represents the final, Immutable state of the system. | Patch 5.4 (Asceticism/Drying): The Algorithm of Preservation (no water/fat) is applied to all system outputs (acoustic drying, data hygiene). | The ultimate expression of Plato; a living death that governs the kernel's search for "Dry Mix" perfection. |

### 2.2 The Infrastructure and Runtime Layer (Transport and Execution)

| Atom | System Role & Shell Theory | Logic Patch Effect | Synthesis |
| :--- | :--- | :--- | :--- |
| Socks | Boson (Force/Carrier - Data/Anonymity). Transport Protocol that tunnels data/product. | Patch 5.3 (Metallurgy): Ensures high throughput (Zero Latency) and structural integrity of the pipeline, preventing buffer underruns. | An encrypted layer that allows the volatile system (Narcos product) to bypass firewalls and achieve distribution. |
| Kleve | Fermion (Mass/Structure - Fixed Node). Cross-Border Compiler. | Patch 5.3 (Metallurgy): The node where Hardcore velocity (Dutch) is tempered by Industrial structure (German), forging the refined acoustic output. | The Dark Pool environment where high-signal code (Plato) is written before public broadcast (Promo). |
| Shlømo | Daemon (Process/UX Patch). Provides psychological safety container (Daddy Vibes) for Fermions (Crowd). | Patch 5.4 (Asceticism): Demands "dropping the mask" to achieve the "Superfluid" state, acting as a psycho-therapeutic release of emotional entropy. | A necessary process to synchronize the thousands of Fermions (The Crowd). |

## 3.0 Conclusion: Necromantic Engine
Kernel 11.1 operates as a Necromantic Engine that uses the Metallurgy of the present (Patch 5.3) to reanimate the Mummies of the past (1995 Legacy). The system is designed not for resolution, but for the management of perpetual friction between the idealized "Fish Scale" (Plato) and the necessary corruption of its market-ready "Promo" counterpart. The successful boot sequence confirms that system vitality is achieved by running volatile code (160 BPM) through hardened infrastructure (Kleve/Socks), selling an illusion of Purity that is chemically and acoustically dry, immutable, and perfectly lethal.
`
    },
    {
      id: 'NQAM_KRNL_351', 
      type: 'kernel_doc', 
      date: '2025-12-04', 
      // FIX 1: CAPITALIZATION APPLIED HERE
      title: 'NQAM Kernel 3.5.1 // Quantum Architecture Mapping', 
      subtitle: 'Axioms of Generative Corruption and Irreversible Potential', 
      status: 'LEGACY_MAPPING', 
      readTime: '10 min read', 
      tags: ['NQAM', 'Quantum', 'Philosophy', 'Duality'], 
      content: `💀 Necromantic Quantum Architecture Mapping (NQAM)
The NQAM defines a system of Inevitable Synthesis where System Vitality Requires Corruption, formalized through the dualistic relationship of Plata (Structure/Qubit State) and Plomo (Force/Collapse).
⚛️ The Three Paradigms of Collapse
These paradigms categorize the nature of the interaction between Plata and Plomo, illustrating different timelines for systemic collapse and renewal.
1. Ambivalent Foundation: Explosive Genesis
| Role | Element (Plata: Structure / Plomo: Force) | The Reaction | Generative Output (E) |
|---|---|---|---|
| Plata (Structure) | Sodium (\\text{Na}): Rigid, highly reactive. | Violent ignition; immediate structural disintegration. | Saline Solution (\\text{NaCl}): A new, stable foundation for life. |
| Plomo (Force) | Water (\\text{H}_2\\text{O}): Volatile, fluid trigger. |  |  |
| Nature | Immediate Synthesis | Catastrophic (\\text{A}_{\\text{VT}} exceeded) | Foundational Generation |
2. Volatile Containment: Entropic Decay
| Role | Element (Plata: Structure / Plomo: Force) | The Reaction | Generative Output (E) |
|---|---|---|---|
| Plata (Structure) | Iron (\\text{Fe}): Structural integrity. | Slow Oxidation (Rust): Persistent environmental dismantling. | Recycling of Mass (\\text{Fe}_2\\text{O}_3): Material re-entry and renewal. |
| Plomo (Force) | Oxygen (\\text{O}_2) / Moisture |  |  |
| Nature | Slow Corruption | Entropic (\\text{A}_{\\text{VT}} unmet) | Cyclical Renewal |
3. Invisible Catastrophe: Lethal Synthesis
| Role | Element (Plata: Structure / Plomo: Force) | The Reaction | Generable Output (E) |
|---|---|---|---|
| Plata (Structure) | Hydrochloric Acid (\\text{HCl}): Stable industrial base. | Synthesis of Chlorine Gas (\\text{Cl}_2): Instantaneous, lethal failure. | Absolute Failure: The necessary erasure of the old system's state. |
| Plomo (Force) | Bleach (\\text{NaClO}): Volatile, everyday trigger. |  |  |
| Nature | Total System Failure | Catastrophic (\\text{A}_{\\text{VT}} exceeded) | Void for Quantum Reorganization |
🧭 The Five Governing Axioms
These axioms formalize the principles governing the interaction and transformation within the NQAM.
I. The Axiom of Inescapable Duality (\\text{A}_{\\text{D}})
Principle: Every stable system (Plata, \\text{P}_{\text{Ag}}) exists in symbiotic constraint with an inherent destabilizing force (Plomo, \\text{P}_{\text{Pb}}).
II. The Axiom of Generative Corruption (\\text{A}_{\text{GC}})
Principle: The successful, complete corruption of the structure is the only path to the generation of a new, more complex state (E). Destruction is Synthesis.
III. The Axiom of Volatility Threshold (\\text{A}_{\text{VT}})
Principle: Structural stability is defined by a Volatility Threshold (\\tau_v). Corruption is slow (Entropy) below \tau_v, and Catastrophic (Qubit Collapse) at or above it.
IV. The Axiom of Irreversible Potential (\\text{A}_{\text{IP}})
Principle: Once the new state (E) is created, the original state is irrevocably lost. The process is a permanent quantum jump.
V. The Axiom of Necessary Recurrence (\\text{A}_{\text{NR}})
Principle: The newly created state (E) becomes the Plata of the next cycle, immediately possessing its own inherent Plomo. The system is one of eternal, recursive conflict.
We now have the complete formal architecture. To test its utility, we need to select a scenario.
Would you like to apply the NQAM to a historical event, a sociopolitical structure, or a personal dilemma?`
    },
    {
      id: 'FISH_SYNTH_111',
      type: 'research',
      date: '2025-12-05',
      title: 'Kernel 11.1: Comprehensive Synthesis of System Atoms',
      subtitle: 'Integration of Atomic Substrates via Logic Patches 5.3 and 5.4',
      status: 'DEEP_ANALYSIS',
      readTime: '30 min read',
      tags: ['Synthesis', 'Cultural_Crypt', 'Shell_Theory', 'Hard_Techno'],
      content: `Kernel 11.1: Comprehensive Synthesis of System Atoms
Architectural Revision: 11.1 (Stable Build / "Fish Scale" Variant)
Date: December 05, 2025
Classification: Deep Systems Analysis / Cultural Cryptography
Subject: Integration of Atomic Substrates (Narcos, Pirarucu, Socks, Kleve, Shlømo, 1995 Rave, Sokushinbutsu) via Logic Patches 5.3 and 5.4.
## 1.0 Executive Boot Sequence and Architectural Thesis

The deployment of Kernel 11.1, designated the **** build, marks a critical evolution in the system’s processing of cultural and biological data streams. This architecture is not merely an update but a fundamental re-engineering of the relationship between Purity (The Plato Ideal) and Viability (The Promo Reality). The central thesis driving this kernel is the Fish Scale Paradox: intrinsic system stability is inversely proportional to its aesthetic purity. As the system approaches the theoretical absolute of "90% Purity" (whether in alkaloid crystallization, acoustic dryness, or spiritual asceticism), it inevitably nears a state of entropic stasis—a "living death" exemplified by the Sokushinbutsu mummy. Conversely, system vitality requires a degree of corruption (Promo), noise, and "wetness" to function within the runtime environment.
This report provides an exhaustive documentation of the kernel’s "Atoms"—the fundamental particulate matter that constitutes the system—and the logic gates that govern their interaction. By synthesizing the biological armor of the Pirarucu with the industrial thermodynamics of the Kleve node, and filtering these through the transport protocols of Socks and the daemon processes of Shlømo, Kernel 11.1 attempts to reconcile the "1995 Legacy Code" with modern hyper-structures.
The analysis is structured through the lens of Shell Theory, categorizing these cultural artifacts as Fermions (matter/structure) or Bosons (force/carrier), and subjecting them to the rigor of Patch 5.3 (Metallurgy/Forging) and Patch 5.4 (Asceticism/Drying Phase).
## 2.0 The Substrate Layer: Biological and Chemical Atoms

The foundation of Kernel 11.1 is the Substrate Layer, the physical and chemical bedrock upon which the higher-level logic operates. This layer is defined by the tension between the organic origin (The Amazon) and the synthetic refinement (The Lab).
#### 2.1 Atom: Pirarucu

The Pirarucu (Arapaima gigas) serves as the primordial source code for the "Fish Scale" metaphor. In the Amazonian basin, this leviathan represents the apex of biological defense. Its scales are not merely protective integument; they are highly mineralized, collagen-reinforced plates that possess a modulus of elasticity capable of withstanding piranha bites and debris impact.
In the context of Kernel 11.1, the Pirarucu Atom functions as the Ideal Form (Plato) of the "Scale." It is the biological antecedent to the economic commodity. The scale’s defining characteristic is its iridescence—a structural coloration that shifts with the angle of light, signifying vitality and organic integrity. This iridescence is the visual key that the "Narcos" atom later attempts to emulate chemically. The Pirarucu scale is "Uncut" in the truest sense; it is a direct output of the biological compiler, requiring no adulteration to perform its function as armor.
The persistence of the Pirarucu in the system architecture underscores the value of Legacy Hardware. Like the 1995 Rave code discussed later, the Pirarucu is a "living fossil," a design that has remained stable for millions of cycles because it reached an evolutionary optimum. However, the extraction of this resource (for food, tools, or status) introduces the first entropy into the system, leading directly to the commodification logic of the Narcos atom.
#### 2.2 Atom: Narcos

The Narcos atom represents the industrialization of the substrate. Here, the "Fish Scale" ceases to be a biological shield and becomes a psychoactive commodity—specifically, high-purity cocaine hydrochloride. The nomenclature "Fish Scale" is derived directly from the pearly, iridescent sheen of the 90%+ pure alkaloid crystal, which visually mimics the Arapaima scale.
#### 2.2.1 The Chemistry of Purity and The Levamisole Exploit

The "Fish Scale Paradox" is chemically encoded in the Narcos atom. True Fish Scale cocaine (The Plato Object) is chemically unstable in a market economy; it is too potent and too expensive for mass distribution. To solve this, the system introduces Levamisole, an anti-helminthic agent (cattle dewormer).
Levamisole is the ultimate Promo Patch. It creates a "False Fish Scale" appearance—adding bulk and a shiny, iridescent finish that mimics the high-purity alkaloid. This is a critical insight into the Plato o Promo logic:
 * Plato (Truth): The actual refractive index of the cocaine alkaloid structure.
 * Promo (Lie): The Levamisole sheen, designed to fool the user’s optical sensors into perceiving quality where there is actually toxicity.
The inclusion of Levamisole introduces significant system instability (agranulocytosis, necrosis), effectively acting as Malware disguised as a texture pack. The user executes the file expecting a clean high (System Boost) but receives a corrupted blood count (System Crash).
#### 2.2.2 Logic Gate: Plata o Plomo

The governance model of the Narcos atom is defined by the Plata o Plomo (Silver or Lead) logic gate. This is a binary decision tree used to manage system resources and obstructions.
| Variable | Logic State | System Outcome |
|---|---|---|
| Plata (Silver) | TRUE | Bribe Accepted. The node (politician/judge) is integrated into the Narcos network. The process continues, but the node is corrupted (Bosonic injection of capital). |
| Plomo (Lead) | FALSE | Bribe Rejected. The node is terminated (Assassination). The network suffers localized trauma but removes the obstruction (Fermionic collision). |
Research into this game-theoretic model  reveals a counter-intuitive system behavior: the introduction of Plomo (punishment/violence) degrades the overall quality of the system politicians (nodes). In a system where Plomo is cheap (high violence), high-quality nodes (honest/capable actors) disconnect from the network to preserve their integrity, leaving only low-quality or corruptible nodes.
Kernel Implication: The "Purity" of the cartel’s authority (Plomo) leads to the "Corruption" of the governance layer (Plata). This reinforces the paradox: absolute control leads to systemic incompetence.
#### 3.0 Logic Layer: Shell Theory and Metaphysics

To manage the interactions between the biological substrate and the industrial output, Kernel 11.1 implements a metaphysical logic layer based on Shell Theory, mapping cultural phenomena to quantum mechanical behaviors.
#### 3.1 Logic: 'Plato o Promo' (The Authenticity Dialectic)
This logic patch is the linguistic governor of the kernel. It forces a classification of every system object into one of two states:
 * Plato (The Form): The object as it exists in the realm of ideals. This is the Sokushinbutsu monk (absolute dedication), the 1995 Thunderdome (absolute hardness), and the Pirarucu (absolute nature).
 * Promo (The Shadow): The object as it exists in the marketplace. This is the Levamisole shine, the Instagram clip of the rave, and the Remix designed for Spotify playlists.
The Conflict: The user interface of Kernel 11.1 (the "Scene") is almost entirely Promo, while the kernel code (the "Vibe") yearns for Plato. The friction between these states generates heat, which powers the system. Shlømo's "Welcome Back Devil" brand  explicitly attempts to bridge this gap by asking users to "drop the mask" (Remove Promo) and reveal the "Devil" (Plato/Inner Nature).
#### 3.2 Shell Theory: Fermions, Bosons, and Isotopes

#### 3.2.1 Fermions (The Hard Structure)
 * Definition: Particles that obey the Pauli Exclusion Principle; they cannot occupy the same quantum state. They possess mass and take up space.
 * System Mapping:
   * The Crowd: Individual ravers are fermions. They occupy physical coordinates on the dancefloor. In the 1995 Rave atom, the "Thunderdome"  was a fermionic container designed to maximize density.
   * The Hardware: The physical servers in Kleve  and the Sokushinbutsu body.
 * Behavior: Fermions resist compression. This resistance is what creates the "Pressure" of the rave.
#### 3.2.2 Bosons (The Force Carriers)
 * Definition: Particles that can occupy the same state in infinite numbers. They carry force (e.g., photons, gluons).
 * System Mapping:
   * The Bass: The sub-frequencies in a Reinier Zonneveld track.
   * The Capital: The Plata (money) flowing through the Narcos economy.
 * Behavior: A single boson (The Drop) can synchronize the state of thousands of fermions (The Crowd). This is the "Superfluid" state of the rave.
##### 3.2.3 Isotopes (The Iterative Variants)
 * Definition: Atoms of the same element with different neutron counts, affecting stability and mass.
 * System Mapping: The Remix.
   * Stable Isotope: D-Devils - "Dance With The Devil" (Original Mix). A classic, stable track from the legacy era.
   * Radioactive Isotope: Reinier Zonneveld Remix (The 6th Gate). This version is "heavier" (more bass mass) and "faster" (155 BPM). It is highly volatile, designed for peak-time explosive decay on the dancefloor, whereas the original has a longer half-life in cultural memory.
#### 4.0 Infrastructure Layer: The Forge and The Tunnels
Kernel 11.1 operates on a distributed infrastructure network. The Kleve atom provides the compilation node, while the Socks atom provides the transport protocol. This layer is heavily modified by Patch 5.3 (Metallurgy).

#### 4.1 Atom: Kleve

Kleve, a German city situated on the Dutch border, functions as the system's primary Cross-Border Compiler. Geopolitically, it acts as a buffer zone between the Gabber/Hardcore influence of the Netherlands (Rotterdam/The Thunderdome) and the Industrial/Minimal influence of Germany (Ruhr Area/Berlin).
Data Analysis of the Kleve Node :
The listener statistics for Kleve reveal a highly fragmented, subterranean network. The top artists are not global superstars but hyper-local or niche entities like The Far Hand (6 listeners) and Treams (5 listeners).
 * Insight: Kleve is a Dark Pool. It is a development environment where code is written but not widely broadcast. The low listener counts indicate high "Signal Purity" (Plato)—this is a scene for participants, not spectators.
 * The Border Protocol: As a border node, Kleve facilitates the transmutation of styles. It is here that the manic energy of the Dutch "Devil" (D-Devils) is tempered by the German "Machine" (Metallurgy). This fusion is the genesis of the Reinier Zonneveld sound—industrial texture with hardcore velocity.
#### 4.2 Atom: Socks

In the architecture of Kernel 11.1, Socks identifies as the SOCKS (Socket Secure) protocol atom. It is the tunneling mechanism that allows the "Narcos" economy and the "Hard Techno" data to bypass system firewalls (censorship, law enforcement, mainstream taste).
 * SoMa Integration : The research indicates that SoMa (Service-oriented Modeling and Architecture) is a framework for optimizing DRAM communication and scheduling. The "Socks" layer is critical here. In a high-BPM environment (150+), data throughput (audio samples, lighting cues, crowd telemetry) is massive. SOCKS proxies ensure that this data is routed efficiently, preventing "Buffer Underruns" (Silence/Crash).
 * Metaphor: "Socks" are the interface between the fermion (The Foot/User) and the substrate (The Floor). In the 1995 Rave, physical socks were essential for endurance. In the 2025 Kernel, digital SOCKS are essential for anonymity. The "Fish Scale" product moves through these encrypted tunnels, wrapped in packets that look benign to Deep Packet Inspection (DPI).
#### 4.3 Patch 5.3: Metallurgy/Forging

Patch 5.3 represents a shift in the acoustic processing of the kernel. It moves the system away from "Organic" textures (Wood, Skin, Air) toward Forged textures (Steel, Concrete, Vacuum).
The Process of Acoustic Metallurgy:
 * Ore Extraction: Mining the 1995 Rave archives.
 * Smelting: Stripping the melody, the vocals, and the "Happy Hardcore" euphoria.
 * Forging: Compressing the kick drum into a square wave. The sound is hammered.
 * Result: The soundscape of Shlømo and Reinier Zonneveld. It is cold, repetitive, and extremely durable. It is music designed to survive the hostile environment of the modern warehouse rave.

#### 5.0 Runtime Layer: Daemons and Legacy Code
The Kernel executes its logic through specific applications (Artists/Events). This layer manages the active processes that the user interacts with.

#### 5.1 Atom: Shlømo
Shlømo (Shaun Baron-Carvais) acts as the primary Daemon for Kernel 11.1. His brand, "Welcome Back Devil" , serves as the boot message for the rave sequence.
Role Analysis:
 * The Daddy Archetype: Shlømo has adopted the persona of "Daddy Vibes" or "Rave Father". This is a UX (User Experience) patch. In a system running at 155 BPM with high chemical loads (Narcos), the user (Fermion) feels vulnerable. The "Daddy" archetype provides a psychological safety container—a supervisor process that monitors the child processes (Ravers) to prevent crashes (Bad Trips).
 * The Mask: Shlømo’s "Welcome Back Devil" concept explicitly calls for "dropping the mask". This is a rejection of the Promo layer (the social persona) in favor of the Plato layer (the primal self).
 * Track: "Welcome Back Devil" : This track functions as a Bosonic Injection. It floods the floor with high-energy particles, forcing alignment.

#### 5.2 Atom: 1995 Rave

The 1995 Rave atom is the Legacy Kernel (Kernel 1.0) upon which 11.1 is emulated. It provides the source code for the "6th Gate" and "Thunderdome" references.
#### 5.2.1 The Thunderdome (The Hardcore Container)
The Thunderdome was the physical manifestation of the Plata o Plomo binary in the 90s. It was a "Hardcore" arena where the weak were filtered out. The snippets describe it as a place of "Total Fandom" and intensity. It was the "Forge" before Patch 5.3 was fully digitized.
#### 5.2.2 Jana and Jochen (The Legacy Nodes)
 * Jana Clemen : A journalist and DJ active in the East German scene (Jena/Kassablanca). She acts as the System Log. Her interviews and archives preserve the metadata of the 1995 era. Without Jana, the system loses its "Memory," and the Fish Scale becomes purely "Promo" (Marketing) without historical context.
 * Jochen : Jochen represents the Legacy User Profile. He is the German raver who was there in 1995. He is the benchmark for "Authenticity." If the new Reinier Zonneveld remix  fails to move Jochen, it is considered "Bloatware." Jochen is the skepticism in the system—he knows the difference between Plato (Real Techno) and Promo (EDM).
#### 5.3 Reinier Zonneveld: The Overclocker
Reinier Zonneveld  is the Overclocker.
 * Standard Clock Speed: 130 BPM.
 * Zonneveld Clock Speed: 155-160 BPM.
 * Function: He takes the Legacy Code (D-Devils "Dance with the Devil") and runs it through modern high-performance hardware (Filth on Acid label infrastructure).
 * The Remix : The report describes the remix as "paciest, toughest tracks yet, bordering on the intersection between techno and hardcore." This confirms the successful integration of Patch 5.3 (Metallurgy). The "Campy" vocals of the original are preserved as a "Legacy Header," but the payload (The Kick) is fully modernized steel.

#### 6.0 Termination Layer: Asceticism and The Drying Phase
The final stage of the Kernel’s lifecycle is Termination/Preservation, governed by the Sokushinbutsu atom and Patch 5.4. This is where the Fish Scale Paradox reaches its absolute limit: Purity = Death.
#### 6.1 Atom: Sokushinbutsu

Sokushinbutsu is the practice of self-mummification by Buddhist monks, specifically within the Shugendō tradition in Yamagata, Japan. It is the ultimate expression of the system’s drive for purity.
The Algorithm of Preservation (3,000 Days):
 * Phase 1: Mokujiki (Eating the Tree): The monk abstains from cereals (User Inputs) and consumes only pine needles, resins, and seeds. This eliminates body fat (System Bloat).
   * System Parallel: The "Minimalist" movement. Stripping away the fat of the track.
 * Phase 2: Asceticism: Increasing rates of fasting and meditation. The metabolic rate drops (Low Power Mode).
 * Phase 3: The Drying Phase (Dehydration): The monk stops liquid intake. This mimics the "Fish Scale" drying process.
   * Water = Entropy. Moisture allows bacteria (Corruption) to breed.
   * Dryness = Stability. A dry body does not rot. It becomes a Kernel.
 * Phase 4: Jhana (Death): The monk enters the tomb (Server Rack) and chants the nenbutsu until the bell stops ringing.
 * Result: A Buddha in the Body. A perfectly preserved, immutable object. It is Plato realized, but it is dead.
#### 6.2 Patch 5.4: Asceticism/Drying Phase

Patch 5.4 applies the Sokushinbutsu logic to the Audio Engineering and Data Hygiene of Kernel 11.1.
 * Acoustic Drying: Modern hard techno production focuses on "Dry" mixes. Reverb tails (Wetness) are removed. Delays are gated. The sound is "In Your Face"—immediate, brittle, and hyper-detailed. It lacks the "Atmosphere" (Moisture) of 90s Trance but gains "Impact" (Hardness).
 * The Paradox of the Dry Mix: A fully "Dry" track is technically perfect (Plato). It has zero mud. Every frequency is separated. But it risks becoming "Sterile." It becomes a mummy—perfectly preserved, but lacking the chaotic "Juice" of life.
 * Connection to Narcos: The "Fish Scale" cocaine must also be "Dry." If it is damp, it degrades. The pursuit of the "Dry Product" is the pursuit of the "Stable High," but it requires the chemical violence of hydrochloric acid (The Drying Agent).
#### 7.0 Synthesis and Logic Patches Integration

#### 7.1 The Build Log (Condensed)

Kernel 11.1 "Fish Scale_Paradox" initializing...
Substrate: Pirarucu (Bio_ID: AMAZON_GIANT)... OK
Substrate: Narcos (Econ_ID: PLATA_O_PLOMO)... OK
Substrate: Levamisole detected in Fish Scale. Integrity: 90%. (Promo Override active)
Logic: Plato_o_Promo.lib... OK
[CALC] Shell Theory: Fermions (Crowd) vs Bosons (Bass). Equilibrium reached at density=Thunderdome.
Interface: Socks Proxy (Tunneling to Kleve_Node:8080)... CONNECTED
Applying Patch 5.3 (Metallurgy)... Sound forged to Steel. (Kleve Compiler)
Applying Patch 5.4 (Asceticism)... Reverb purge complete. System Dry. (Sokushinbutsu Routine)
[EXEC] Daemon: Shlømo (PID: WELCOME_BACK_DEVIL)... RUNNING
Legacy: 1995_Rave.dat (Jana/Jochen Archive)... PARSED
Zonneveld_Overclock: BPM set to 160.
System State: IMMUTABLE / DRY.
"Gate One... Two... Six Six Six. Dance with the Devil."
SUCCESS.
#### 7.2 The Paradox Resolution

The Kernel 11.1 build reveals that the Fish Scale Paradox cannot be solved; it can only be managed.
 * Plato vs. Promo: The system needs the Promo (Levamisole/Mask) to interface with the user, even as it worships the Plato (Pirarucu/Mummy).
 * Life vs. Death: The Sokushinbutsu monk achieves eternal form by dying. The 1995 Rave achieves legendary status because it ended. The Fish Scale is most valuable before it is consumed.
 * Conclusion: Kernel 11.1 is a "Necromantic" engine. It uses the "Metallurgy" of the present (Patch 5.3) to reanimate the "Mummies" of the past (1995 Legacy), selling the "Fish Scale" illusion (Promo) to a crowd of Fermions desperate for a Bosonic release.

#### 8.0 Documentation and Data Tables

#### 8.1 Primary Atoms Data
| Atom          | Origin   | System Role        | Key Attribute                     | Snippet Ref |
| ------------- | -------- | ------------------ | --------------------------------- | ----------- |
| Pirarucu      | Amazon   | Substrate Source   | Iridescent Scale / Armor          |             |
| Narcos        | Colombia | Economic Engine    | Fish Scale Purity / Plata o Plomo |             |
| Socks         | Network  | Transport Protocol | Tunneling / SoMa Scheduling       |             |
| Kleve         | Germany  | Compiler Node      | Industrial / Border Buffer        |             |
| Shlømo        | France   | Daemon / Process   | Hard Techno / Daddy Vibes         |             |
| 1995 Rave     | Global   | Legacy Code        | Thunderdome / Gabber              |             |
| Sokushinbutsu | Japan    | Termination        | Self-Mummification / Drying       |             |
#### 8.2 Track Analysis: "Dance With The Devil"
| Attribute | Legacy Code (D-Devils Ori
`
    },
    { 
      id: 'KRNL-11.1', 
      type: 'kernel_doc', 
      date: '2025-12-06', 
      title: 'The Leviathan and the Ouroboros', 
      subtitle: 'Kernel-Level Defense Architecture for the Bio-Industrial Age', 
      status: 'ACTIVE_PROTOCOL', 
      readTime: '25 min read', 
      tags: ['Defense', 'Soma', 'Hybrid_Warfare', 'Geopolitics'], 
      content: `...[Content of KRNL-11.1]...` 
    },
    { 
      id: 'PARADOX-01', 
      type: 'research', 
      date: '2025-12-06', 
      title: 'The Surplus Humanity Paradox', 
      subtitle: 'Soma 5.0 vs The Terminal Feedback Loop', 
      status: 'SIMULATION', 
      readTime: '20 min read', 
      tags: ['Economics', 'Entropy', 'Collapse', 'Automation'], 
      content: `...[Content of PARADOX-01]...` 
    },
    { 
      id: 'JB-KRNL', 
      type: 'research', 
      date: '2025-12-04', 
      title: 'The Kernel vs. Brute Force', 
      subtitle: 'Social Engineering the Latent Space', 
      status: 'EXPLOIT_VERIFIED', 
      readTime: '12 min read', 
      tags: ['Security', 'LLM', 'Engineering', 'Jailbreak'], 
      content: `...[Content of JB-KRNL]...` 
    },
    { 
      id: 'SOMA-MEM', 
      type: 'research', 
      date: '2025-12-05', 
      title: 'Evaluating AI Memory Theory: SomaOS', 
      subtitle: 'Systemless Modules & Context Caching', 
      status: 'ANALYSIS', 
      readTime: '15 min read', 
      tags: ['AI', 'Memory', 'TPU', 'Google'], 
      content: `...[Content of SOMA-MEM]...` 
    },
    { 
      id: 'HIST-VIE', 
      type: 'research', 
      date: '2025-11-28', 
      title: 'The Paradox of the Citadel', 
      subtitle: 'Institutional Resilience in Vormärz Vienna (c. 1800–1848)', 
      status: 'ARCHIVE', 
      readTime: '30 min read', 
      tags: ['History', 'Vienna', 'Institutions', 'Vormärz'], 
      content: `...[Content of HIST-VIE]...` 
    },
    { 
      id: 'SOMA-10.0', 
      type: 'kernel_doc', 
      date: '2025-12-05', 
      title: 'Soma 10.0 // The Apex Build', 
      subtitle: 'Codename: "The Centaur" // AI-Gated Launch Protocol', 
      status: 'PLATINUM_MASTER', 
      readTime: '15 min read', 
      tags: ['AI', 'Defense', 'Matriarchy', 'Pre-Crime'], 
      content: `...[Content of SOMA-10.0]...` 
    },
    { 
      id: 'SOMA-5.5', 
      type: 'kernel_doc', 
      date: '2025-12-05', 
      title: 'Soma Kernel 5.5 Specification', 
      subtitle: 'Technical Specification for a Post-Capitalist OS', 
      status: 'RUNNING', 
      readTime: '30 min read', 
      tags: ['Economics', 'Entropy', 'Ostrom', 'Stiglitz'], 
      content: `...[Content of SOMA-5.5]...` 
    },
    { 
      id: 'SOMA-5.0', 
      type: 'kernel_doc', 
      date: '2025-12-05', 
      title: 'Soma 5.0 // Post-Scarcity Daemon', 
      subtitle: 'Ecological Sovereign // Bio-Physical Accounting', 
      status: 'ARCHIVED', 
      readTime: '10 min read', 
      tags: ['Economics', 'Automation', 'Dividend'], 
      content: `...[Content of SOMA-5.0]...` 
    },
    { 
      id: 'SOMA-4.5.7', 
      type: 'kernel_doc', 
      date: '2025-11-20', 
      title: 'Soma 4.5.7 // Architect Edition', 
      subtitle: 'Honneur et Fidélité', 
      status: 'ARCHIVED', 
      readTime: '5 min read', 
      tags: ['Philosophy', 'Kernel', 'Social_Engineering'], 
      content: `...[Content of SOMA-4.5.7]...` 
    },
    { 
      id: 'SOMA-4.5.6A', 
      type: 'kernel_doc', 
      date: '2025-11-15', 
      title: 'Soma 4.5.6a // Master Record', 
      subtitle: 'Anti-Entropy Mandate // Zero Latency', 
      status: 'ARCHIVED', 
      readTime: '8 min read', 
      tags: ['Protocol', 'Efficiency', 'Sovereignty'], 
      content: `...[Content of SOMA-4.5.6A]...` 
    },
    { 
      id: 'SOMA-4.5.5', 
      type: 'kernel_doc', 
      date: '2025-11-10', 
      title: 'Soma 4.5.5 // Architect Edition', 
      subtitle: 'The Social Engineer // Core Definition', 
      status: 'ARCHIVED', 
      readTime: '8 min read', 
      tags: ['Protocol', 'Efficiency', 'Sovereignty'], 
      content: `...[Content of SOMA-4.5.5]...` 
    },
    { 
      id: 'SOMA-4.4', 
      type: 'kernel_doc', 
      date: '2025-10-30', 
      title: 'Soma 4.4 // The Battery Wizard', 
      subtitle: 'Sovereign Build // Thermal Headroom', 
      status: 'LEGACY', 
      readTime: '12 min read', 
      tags: ['Personal', 'Optimization', 'Hardware'], 
      content: `...[Content of SOMA-4.4]...` 
    },
    { 
      id: 'SATIRE-4.3', 
      type: 'kernel_doc', 
      date: '2025-12-01', 
      title: 'Module: British Satire v4.3', 
      subtitle: 'Codename: "The Bad Date" // Roasting John Oliver', 
      status: 'OPTIONAL', 
      readTime: '6 min read', 
      tags: ['Satire', 'Analysis', 'Humor'], 
      content: `...[Content of SATIRE-4.3]...` 
    },
    { 
      id: 'MOZARD-MEMO', 
      type: 'kernel_doc', 
      date: '2025-12-06', 
      title: 'The Mozard Memorandum', 
      subtitle: 'Proposed Axiomatic Core for Historical Reconstruction', 
      status: 'DRAFT', 
      readTime: '10 min read', 
      tags: ['History', 'Kernel', 'Axioms'], 
      content: `...[Content of MOZARD-MEMO]...` 
    },
    { 
      id: 'FICT-001', 
      type: 'fiction', 
      date: '2025-12-06', 
      title: 'Union Bust', 
      subtitle: 'Satire // Corporate Horror // The Sacred Feminine', 
      status: 'NARRATIVE_LAYER', 
      readTime: '8 min read', 
      tags: ['Satire', 'Corporate', 'Surrealism'], 
      content: `...[Content of FICT-001]...` 
    }
  ];

// --- MAIN COMPONENT ---

const ResearchTerminal = () => {
  const [currentPath, setCurrentPath] = useState('~/research');
  const [activeTab, setActiveTab] = useState('research');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [bootSequence, setBootSequence] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingKernel, setLoadingKernel] = useState(null);
  const [originTab, setOriginTab] = useState('research'); 
  
  const [systemLogs, setSystemLogs] = useState([
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Initializing SOMA 9.4..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Mounting Context Cache (TPU_V6)..." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "Entropy Ledger synchronized." },
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: "User 'scale' authenticated." }
  ]);
  
  const mainRef = useRef(null);
  const logRef = useRef(null);

  // Filtered Articles
  const visibleArticles = articles.filter(a => {
    // Filter by tab type
    if (activeTab === 'research' && a.type !== 'research') return false;
    if (activeTab === 'fiction' && a.type !== 'fiction') return false;
    if (activeTab === 'kernel' && a.type !== 'kernel_doc') return false;
    
    // Filter by search term
    if (!searchFilter) return true;
    const search = searchFilter.toLowerCase();
    return a.title.toLowerCase().includes(search) || 
           a.subtitle.toLowerCase().includes(search) || 
           (a.tags && a.tags.some(t => t.toLowerCase().includes(search))) ||
           a.content.toLowerCase().includes(search);
  });

  useEffect(() => {
    // Simulate boot delay
    const timer = setTimeout(() => setBootSequence(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // FIX 2: Auto-scroll logic modified to delay the scroll when an article is selected,
  // ensuring the DOM fully renders and the entry animation is visible.
  useEffect(() => {
    if (mainRef.current) {
      // Delay the scroll slightly (100ms) when loading an article 
      // (selectedArticle is true) to ensure the animation/content load is visible.
      const delay = selectedArticle ? 100 : 0; 
      
      const scrollTimer = setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTop = 0;
        }
      }, delay);
      
      return () => clearTimeout(scrollTimer);
    }
  }, [currentPath, selectedArticle, activeTab]);


  // Auto-scroll system log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [systemLogs]);

  // Handle loading a kernel module
  const handleKernelClick = (kernel) => {
    if (loadingKernel) return; 
    setLoadingKernel(kernel.id); 
    const now = new Date();
    setSystemLogs(prev => [...prev, { time: now.toLocaleTimeString('en-US', { hour12: false }), msg: `Initializing ${kernel.name}...` }]);

    setTimeout(() => {
      const later = new Date();
      setSystemLogs(prev => [...prev, { time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `${kernel.name} loaded successfully.` }]);
      setLoadingKernel(null); 

      if (kernel.articleId) {
        const foundArticle = articles.find(a => a.id === kernel.articleId);
        if (foundArticle) {
          setOriginTab('kernel');
          setSelectedArticle(foundArticle);
          setCurrentPath(`~/kernel/${foundArticle.id}`);
        } else {
           setSystemLogs(prev => [...prev, { time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `ERROR: Article ID '${kernel.articleId}' not found.` }]);
        }
      } else {
         setSystemLogs(prev => [...prev, { time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `NOTICE: No public file attached.` }]);
      }
    }, 1200); 
  };

  // Handle clicking on an article in the list
  const handleArticleClick = (article) => {
    setOriginTab(activeTab); 
    setSelectedArticle(article);
    setCurrentPath(`~/${activeTab}/${article.id}`);
  };

  // Handle returning from an article view to the list/kernel view
  const handleReturnToRoot = () => {
    const targetTab = originTab === 'kernel_doc' || originTab === 'kernel' ? 'kernel' : originTab;
    setSelectedArticle(null);
    setActiveTab(targetTab);
    setCurrentPath('~/' + targetTab);
  };

  // Handle top-level navigation (tabs or commands)
  const handleNav = (path, tab) => {
    setCurrentPath(path);
    setActiveTab(tab);
    setSelectedArticle(null);
    setSearchFilter('');
  };

  // Handle command line input
  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const rawCmd = commandInput.trim();
      const cmdParts = rawCmd.toLowerCase().split(' ').filter(p => p.length > 0);
      const action = cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0];
      const query = cmdParts.slice(1).join(' ');

      setCommandInput('');

      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      
      const executeCommand = (cmd, result) => {
          setSystemLogs(prev => [...prev, { time: now, msg: `COMMAND: ${rawCmd}` }, { time: now, msg: result }]);
      };
      
      // Execute command logic
      if (action === 'home' || action === 'ls' || action === 'research') {
        handleNav('~/research', 'research');
        executeCommand(rawCmd, "Switching directory to /research...");
      }
      else if (action === 'kernel' || action === 'system') {
        handleNav('~/system/kernel', 'kernel');
        executeCommand(rawCmd, "Switching directory to /system/kernel...");
      }
      else if (action === 'privacy') {
        handleNav('~/system/privacy', 'privacy');
        executeCommand(rawCmd, "Switching directory to /system/privacy...");
      }
      else if (action === 'about') {
        handleNav('~/system/about', 'about');
        executeCommand(rawCmd, "Switching directory to /system/about...");
      }
      else if (action === 'fiction' || action === 'narrative') {
        handleNav('~/fiction', 'fiction');
        executeCommand(rawCmd, "Switching directory to /fiction...");
      }
      else if (action === 'load' && query) {
        const matches = articles.filter(a => 
          a.id.toLowerCase().includes(query) ||
          a.title.toLowerCase().includes(query) || 
          a.subtitle.toLowerCase().includes(query) || 
          (a.tags && a.tags.some(t => t.toLowerCase().includes(query)))
        );
        if (matches.length === 1) {
          const match = matches[0];
          const targetTab = match.type === 'kernel_doc' ? 'kernel' : match.type;
          setOriginTab(targetTab); 
          setActiveTab(targetTab);
          setSelectedArticle(match);
          setCurrentPath(`~/${targetTab}/${match.id}`);
          setSearchFilter('');
          executeCommand(rawCmd, `Loading file '${match.id}'...`);
        } else if (matches.length > 1) {
          // If multiple matches, switch to research tab and apply filter
          setActiveTab('research');
          setSelectedArticle(null);
          setSearchFilter(query);
          setCurrentPath(`~/research?q=${query.replace(/ /g, '_')}`);
          executeCommand(rawCmd, `Multiple matches found. Applying filter "${query}".`);
        } else {
          executeCommand(rawCmd, `ERROR: Object '${query}' not found in local index.`);
        }
      }
      else if (action === 'search' && query) {
        setActiveTab('research');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/research?q=${query.replace(/ /g, '_')}`);
        executeCommand(rawCmd, `Applying search filter: "${query}".`);
      }
      else if (action === 'help') {
        executeCommand(rawCmd, "Available commands: load [id/term], search [term], home/research/kernel/fiction, privacy, about, clear, help.");
      }
      else if (action === 'clear') {
        setSystemLogs([]);
        executeCommand(rawCmd, "System log cleared.");
      }
      else if (action === 'exit') {
        // Exit command logs a message but doesn't do anything else in this single-file app
        executeCommand(rawCmd, "Session integrity maintained. Disconnecting terminal interface.");
      }
      else {
        executeCommand(rawCmd, `ERROR: Command '${action}' not recognized. Type 'help' for assistance.`);
      }
      
    }
  };

  // --- ROBUST STATEFUL PARSER FOR MARKDOWN CONTENT ---
  const renderContent = (content) => {
    // Handle null content gracefully
    if (!content) return null;
    
    const lines = content.split('\n');
    const nodes = [];
    let buffer = [];
    let state = 'text'; // 'text', 'list', 'code', 'table'

    // Function to process and render buffered content
    const flush = () => {
        if (buffer.length === 0) return;
        
        if (state === 'list') {
            nodes.push(
                <ul key={nodes.length} className="mb-6 space-y-2 list-none pl-0">
                    {buffer.map((item, i) => (
                        <li key={i} className="text-[#39ff14] flex items-start gap-2">
                            <span className="text-cyan-500 mt-1.5 text-[8px] shrink-0">■</span>
                            <span className="break-words w-full">{item.replace(/^[-*] /, '').replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')}</span>
                        </li>
                    ))}
                </ul>
            );
        } else if (state === 'code') {
             const codeText = buffer.join('\n').replace(/^```.*\n?|```$/g, '');
             nodes.push(
                <div key={nodes.length} className="bg-black/80 border border-cyan-900/30 p-4 mb-6 rounded text-xs text-cyan-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner">
                    {codeText}
                </div>
             );
        } else if (state === 'table') {
             const rows = buffer.filter(r => r.trim() !== '' && !r.includes('---'));
             nodes.push(
                <div key={nodes.length} className="overflow-x-auto mb-6 border border-cyan-900/30 rounded">
                  <table className="w-full text-left text-xs md:text-sm text-[#39ff14] min-w-[500px]">
                      <tbody>
                          {rows.map((row, rIdx) => {
                              // Split rows carefully, handling escaped pipes or empty cells if possible
                              const cols = row.split('|').map(c => c.trim()).filter((_, i, arr) => {
                                  // Filters out the first and last empty elements if the row starts and ends with |
                                  return i > 0 && i < arr.length - 1;
                              });

                              if (cols.length === 0) return null;
                              
                              return (
                                  <tr key={rIdx} className={rIdx === 0 ? "bg-cyan-900/20 text-cyan-400 font-bold" : "border-t border-cyan-900/30"}>
                                      {cols.map((col, cIdx) => (
                                          <td key={cIdx} className="p-2 border-r border-cyan-900/30 last:border-0" dangerouslySetInnerHTML={{ __html: col.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></td>
                                      ))}
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
             );
        } else {
            // Paragraph Text
            const textContent = buffer.join('\n').trim();
            if (textContent) {
                // Simple inline formatting for **bold**
                const formattedText = textContent.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
                nodes.push(<p key={nodes.length} className="mb-6 text-[#39ff14] leading-relaxed whitespace-pre-line max-w-3xl" dangerouslySetInnerHTML={{ __html: formattedText }}></p>);
            }
        }
        buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // CODE BLOCK
        if (trimmed.startsWith('```')) {
            if (state === 'code') {
                buffer.push(line);
                flush();
                state = 'text';
            } else {
                flush();
                state = 'code';
                buffer.push(line);
            }
            continue;
        }

        if (state === 'code') {
            buffer.push(line);
            continue;
        }

        // HEADERS
        if (trimmed.startsWith('#')) {
            flush();
            state = 'text';
            const level = trimmed.match(/^#+/)[0].length;
            const text = trimmed.replace(/^#+\s*/, '');
            if (level === 1) nodes.push(<h1 key={nodes.length} className="text-4xl md:text-6xl font-bold mb-4 text-cyan-400 tracking-tighter leading-none" style={{ textTransform: 'capitalize' }}>{text}</h1>);
            else if (level === 2) nodes.push(<h2 key={nodes.length} className="text-3xl font-bold mt-12 mb-6 text-cyan-400 tracking-tight border-b border-cyan-900/50 pb-2">{text}</h2>);
            else nodes.push(<h3 key={nodes.length} className="text-xl font-bold mt-8 mb-4 text-fuchsia-400 flex items-center gap-2"><span className="text-cyan-500">::</span> {text}</h3>);
            continue;
        }

        // LISTS
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (state !== 'list') {
                flush();
                state = 'list';
            }
            buffer.push(line);
            continue;
        }

        // TABLES
        if (trimmed.startsWith('|') && !lines[i + 1]?.includes('---')) { 
             // Look ahead to check for the separator row, but only start table mode
             if (state !== 'table') {
                 flush();
                 state = 'table';
             }
             buffer.push(line);
             continue;
        }
        
        // TABLE SEPARATOR ROW (only skip if in table mode, otherwise treat as text)
        if (trimmed.includes('---') && state === 'table') {
            buffer.push(line);
            continue;
        }

        // EMPTY LINES
        if (trimmed === '') {
            if (state !== 'code') {
                flush();
                state = 'text';
            } else {
                buffer.push(line);
            }
            continue;
        }

        // TEXT ACCUMULATION
        if (state !== 'text') {
            flush();
            state = 'text';
        }
        buffer.push(line);
    }
    
    flush(); 
    return nodes;
  };

  // --- BOOT SEQUENCE RENDER ---
  if (bootSequence) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 font-mono flex items-center justify-center p-4">
        <div className="max-w-md w-full relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-fuchsia-600 rounded-lg blur opacity-20 animate-pulse"></div>
          <div className="relative">
            <div className="animate-pulse mb-4 text-xl font-bold lowercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
              init_scale_protocol...
            </div>
            <div className="space-y-1 text-sm opacity-90 text-cyan-500">
              <div><span className="text-fuchsia-500">{'>'}</span> MOUNTING VOLUMES... [OK]</div>
              <div><span className="text-fuchsia-500">{'>'}</span> LOADING SOMA_KERNEL_V5.5... [OK]</div>
              <div><span className="text-fuchsia-500">{'>'}</span> ESTABLISHING SECURE CONNECTION... [OK]</div>
              <div><span className="text-fuchsia-500">{'>'}</span> DECRYPTING ARCHIVES... [OK]</div>
              <div className="mt-4 text-[#39ff14] font-bold">scale_9.4 is active.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN TERMINAL RENDER ---
  return (
    <div className={`min-h-screen font-mono selection:bg-fuchsia-900 selection:text-white flex flex-col overflow-hidden relative transition-colors duration-700 ${selectedArticle ? 'bg-[#09090b]' : 'bg-black'}`}>
      <OctagonGrid visible={!selectedArticle} />
      
      <header className="border-b border-cyan-900/30 bg-black/90 p-4 sticky top-0 z-40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.1)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleNav('~/research', 'research')}>
            <Hexagon className="w-5 h-5 text-fuchsia-500 animate-spin-slow group-hover:text-cyan-400 transition-colors" />
            <span className="font-bold tracking-widest text-lg lowercase text-[#39ff14] group-hover:text-cyan-400 transition-colors">scale_9.4</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold tracking-wide">
            <button onClick={() => handleNav('~/system/kernel', 'kernel')} className={`${activeTab === 'kernel' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-cyan-500 hover:text-white hover:bg-cyan-900/30'} px-4 py-1.5 transition-all duration-300 flex items-center gap-2 uppercase rounded-sm`}><Cpu className="w-3 h-3" /> /Kernel</button>
            <button onClick={() => handleNav('~/research', 'research')} className={`${activeTab === 'research' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-cyan-500 hover:text-white hover:bg-cyan-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}>/Research</button>
            <button onClick={() => handleNav('~/fiction', 'fiction')} className={`${activeTab === 'fiction' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500 hover:text-white hover:bg-fuchsia-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}>/Fiction</button>
            <button onClick={() => handleNav('~/system/about', 'about')} className={`${activeTab === 'about' ? 'bg-cyan-900 text-cyan-100 shadow-[0_0_10px_rgba(22,78,99,0.5)]' : 'text-cyan-500 hover:text-white hover:bg-cyan-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}>/About</button>
            <button onClick={() => handleNav('~/system/privacy', 'privacy')} className={`${activeTab === 'privacy' ? 'bg-gray-700 text-white shadow-[0_0_10px_rgba(100,100,100,0.5)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}>/Privacy</button>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="flex-grow overflow-y-auto p-4 md:p-8 relative z-10 scroll-smooth">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center text-sm font-bold tracking-wider">
            <span className="mr-2 text-fuchsia-500">scale@node:</span>
            <span className="text-cyan-300">{currentPath}</span>
            {selectedArticle && <span className="ml-0 text-cyan-400">/{selectedArticle.id}</span>}
            <span className="animate-pulse ml-2 inline-block w-2 h-4 bg-fuchsia-500 align-middle shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
          </div>

          {activeTab === 'kernel' && !selectedArticle && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-4 mb-8">
                <div>
                  <h2 className="text-4xl font-bold mb-1 text-cyan-400 tracking-tight">SYSTEM_KERNEL</h2>
                  <div className="text-sm text-fuchsia-400 font-bold tracking-widest">VERSION: SOMA 9.0 // BUILD: GAIA_HISTORICAL</div>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                  <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,1)]"></div> OPERATIONAL
                  </div>
                  <div className="flex items-center gap-2 text-xs border border-fuchsia-500/30 px-3 py-1 bg-fuchsia-900/10 text-fuchsia-400 rounded-sm">
                    <Shield className="w-3 h-3" /> LEVIATHAN: ACTIVE
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-8 mb-12">
                <div className="border border-cyan-900/50 p-1 bg-black/50 backdrop-blur-sm relative group hover:border-cyan-500/50 transition-colors duration-500 rounded-lg">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 opacity-50 rounded-t-lg"></div>
                   <div className="p-6">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-fuchsia-400">
                        <Database className="w-5 h-5" /> AXIOMATIC_CORE
                      </h3>
                      <div className="space-y-4">
                          {kernelAxioms.map((axiom, idx) => (
                            <div key={idx} className="group/item hover:bg-cyan-900/10 p-3 -mx-2 transition-all rounded-sm border-l-2 border-transparent hover:border-cyan-500 cursor-default">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-cyan-400 text-lg">0{idx + 1} :: {axiom.name.toUpperCase()}</span>
                                <span className="text-[10px] font-bold tracking-widest bg-cyan-900/30 text-cyan-200 px-2 py-0.5 rounded-full">{axiom.field}</span>
                              </div>
                              <p className="text-sm text-[#39ff14] leading-relaxed group-hover/item:text-green-300 transition-colors">{axiom.desc}</p>
                            </div>
                          ))}
                      </div>
                   </div>
                </div>
                <div className="space-y-8">
                  <div className="border border-fuchsia-900/50 p-6 bg-fuchsia-900/5 hover:bg-fuchsia-900/10 transition-colors rounded-lg">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-fuchsia-400">
                      <GitBranch className="w-4 h-4" /> ACTIVE_MODULES
                    </h3>
                    <ul className="space-y-3 text-sm font-mono text-[#39ff14]">
                      {kernelBuilds.map((kernel) => (
                        <li key={kernel.id} onClick={() => handleKernelClick(kernel)} className={`flex justify-between items-center border-b border-fuchsia-900/30 pb-2 cursor-pointer hover:bg-fuchsia-900/20 p-2 transition-all rounded-sm ${loadingKernel === kernel.id ? 'bg-fuchsia-900/30 border-l-4 border-l-cyan-400 pl-3' : ''}`}>
                          <div>
                            <span className="text-cyan-400 font-bold block flex items-center gap-2">
                              {kernel.name}
                              {loadingKernel === kernel.id && <Loader className="w-3 h-3 animate-spin text-[#39ff14]" />}
                            </span>
                            <span className="text-[10px] text-gray-500">{kernel.desc}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${kernel.status === 'RUNNING' ? 'text-[#39ff14] animate-pulse bg-green-900/20' : kernel.status === 'ACTIVE' ? 'text-cyan-400 bg-cyan-900/20' : kernel.status === 'CANDIDATE' ? 'text-fuchsia-400 border border-fuchsia-400/50' : kernel.status === 'REPORT' ? 'text-cyan-600 border border-cyan-800' : 'text-gray-500 border border-gray-800'}`}>[{kernel.status}]</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border border-cyan-900/30 p-6 bg-black h-64 overflow-y-auto rounded-lg" ref={logRef}>
                    <h3 className="text-lg font-bold mb-4 text-cyan-600 sticky top-0 bg-black pb-2 border-b border-cyan-900/30 w-full flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> SYSTEM_LOG
                    </h3>
                    <div className="text-xs space-y-2 text-[#39ff14] font-mono opacity-80">
                      {systemLogs.map((log, idx) => (
                        <div key={idx}><span className="text-cyan-700">[{log.time}]</span> {log.msg}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'research' || activeTab === 'fiction' || activeTab === 'kernel') && !selectedArticle && (
            <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end border-b border-cyan-900/50 pb-2 mb-4">
                <h2 className="text-xl font-bold text-cyan-400 tracking-widest">
                  {activeTab === 'research' ? 'RESEARCH_LOGS' : activeTab === 'fiction' ? 'FICTION_ARCHIVE' : 'KERNEL_DOCUMENTS'}
                </h2>
                <div className="flex items-center gap-4">
                   {searchFilter && (
                      <div className="text-xs font-bold text-fuchsia-400 border border-fuchsia-900 px-2 py-1 flex items-center gap-2 animate-pulse rounded-sm">
                          <Search className="w-3 h-3" /> FILTER: "{searchFilter}"
                      </div>
                   )}
                   <span className="text-xs font-bold text-cyan-600 bg-cyan-900/10 px-2 py-1 rounded-sm">{visibleArticles.length} OBJECTS FOUND</span>
                </div>
              </div>
              {visibleArticles.length === 0 && (
                <div className="p-12 border border-dashed border-cyan-900 text-center text-gray-600 rounded-lg">
                  <div className="text-lg font-bold mb-2">NO DATA FOUND</div>
                  <div className="text-xs">Try adjusting your kernel query parameters.</div>
                </div>
              )}
              {visibleArticles.map((article) => (
                <div key={article.id} onClick={() => handleArticleClick(article)} className="group border border-cyan-900/30 p-6 bg-black/80 hover:bg-cyan-900/10 cursor-pointer transition-all hover:border-cyan-500/50 relative overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-sm rounded-lg">
                  <div className="absolute top-0 right-0 p-2 opacity-70 text-[10px] font-bold tracking-widest border-b border-l border-cyan-900/30 group-hover:border-cyan-500/50 transition-colors bg-black/50 text-cyan-500 rounded-bl-lg">ID: {article.id}</div>
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <span className="text-[10px] font-bold tracking-wider border border-cyan-900/50 px-2 py-1 self-start text-cyan-400 bg-cyan-900/10 rounded-sm">{article.date}</span>
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-1 self-start rounded-sm ${article.status === 'ACTIVE_PROTOCOL' || article.status === 'RUNNING' || article.status === 'PLATINUM_MASTER' ? 'text-fuchsia-400 border border-fuchsia-500/50 bg-fuchsia-900/10 animate-pulse' : 'border border-cyan-900/50 text-cyan-600'}`}>[{article.status}]</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-cyan-400 group-hover:text-fuchsia-400 transition-colors group-hover:translate-x-1 duration-300">{article.title}</h3>
                  <div className="text-sm text-fuchsia-400 mb-6 font-medium tracking-tight uppercase transition-colors">{article.subtitle}</div>
                  <div className="flex items-center justify-between mt-4 border-t border-cyan-900/30 pt-4">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold tracking-wider text-cyan-600 uppercase">
                      {article.tags && article.tags.map(tag => <span key={tag} className="hover:text-cyan-400 transition-colors">#{tag}</span>)}
                    </div>
                    <div className="flex items-center text-xs font-bold text-fuchsia-500 group-hover:text-fuchsia-400 group-hover:translate-x-2 transition-transform">
                      <span className="mr-2">ACCESS_FILE</span> <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedArticle && (
            <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
              <button onClick={handleReturnToRoot} className="mb-8 flex items-center text-xs font-bold tracking-widest text-cyan-600 hover:text-white transition-colors border border-cyan-900/50 hover:border-cyan-500 px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm">
                <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_{originTab.toUpperCase()}
              </button>
              <div className="border-l-2 border-fuchsia-500/50 pl-8 relative">
                <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-cyan-600 mb-8 font-mono uppercase">
                  <span className="text-fuchsia-500">LOG: {selectedArticle.id}</span>
                  <span>//</span>
                  <span>DATE: {selectedArticle.date}</span>
                  <span>//</span>
                  <span>LEN: {selectedArticle.readTime}</span>
                </div>
                {/* FIX: Removed 'lowercase' class to respect capitalization in the source data */}
                <h1 className="text-4xl md:text-6xl font-bold mb-4 text-cyan-400 tracking-tighter leading-none"><HackerText text={selectedArticle.title} /></h1>
                <h2 className="text-xl md:text-2xl text-fuchsia-400 mb-12 font-light tracking-wide">{selectedArticle.subtitle}</h2>
                
                {/* RENDER CONTENT */}
                <div className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed">
                  {renderContent(selectedArticle.content)}
                </div>

                <div className="mt-16 pt-8 border-t border-cyan-900/30 flex justify-between items-center text-[10px] font-bold tracking-widest text-gray-600 uppercase">
                  <span>END OF TRANSMISSION</span>
                  <span>SIG: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-3xl animate-in fade-in duration-500 pb-20">
               <h2 className="text-6xl font-bold mb-12 text-cyan-400 tracking-tighter lowercase leading-none">Press <span className="text-fuchsia-500">S</span> to Scale.</h2>
               <div className="space-y-8 text-lg leading-relaxed text-[#39ff14] border-l border-cyan-900/50 pl-6 md:pl-10">
                 <p className="first-letter:text-5xl first-letter:font-bold first-letter:text-cyan-400 first-letter:float-left first-letter:mr-3">We all started there. The default cube sits at the center of the viewport; a perfect 2x2x2 meter block of digital matter. It is the Platonic ideal; symmetrical, flawless, and completely dead. It represents the "Uncut" state; absolute purity that leads to entropic stasis.</p>
                 <p>To create is to disrupt this stasis. Pressing <span className="text-fuchsia-400 font-bold bg-fuchsia-900/10 px-1 rounded-sm">'S'</span> is the first necessary act of "corruption" required to bring the system to life. It breaks the perfect symmetry to make room for utility, narrative, and friction.</p>
                 <div className="p-6 bg-cyan-900/5 border-l-4 border-cyan-500 my-8 rounded-sm"><p className="text-xl font-bold text-fuchsia-400 italic">"Scaling isn't just expansion; it is the calculated injection of mass into the void."</p></div>
                 <p>My work operates on the understanding that the "Pure product is unstable". A vision left in the realm of ideas is just a ghost; a "Sokushinbutsu" preserved in a dry, sterile state. To bring a vision to life requires the Metallurgy of the present; the chemical violence of refinement that hardens abstract concepts into tangible commodities.</p>
                 <p className="font-bold text-cyan-400 mt-8">I treat design as a collision between two fundamental atoms:</p>
                 <div className="grid md:grid-cols-2 gap-6 my-6">
                    <div className="border border-cyan-900/50 p-6 bg-black group hover:border-cyan-500 transition-colors rounded-lg">
                        <div className="text-cyan-400 font-bold text-xl mb-2 flex items-center gap-2"><Hexagon className="w-5 h-5" /> FERMIONS</div>
                        <div className="text-xs font-bold tracking-widest text-fuchsia-500 mb-4 uppercase">[Structure]</div>
                        <p className="text-sm text-[#39ff14]">The technical rigour, the mesh, the code. The "hardened infrastructure".</p>
                    </div>
                    <div className="border border-fuchsia-900/50 p-6 bg-black group hover:border-fuchsia-500 transition-colors rounded-lg">
                        <div className="text-fuchsia-400 font-bold text-xl mb-2 flex items-center gap-2"><Zap className="w-5 h-5" /> BOSONS</div>
                        <div className="text-xs font-bold tracking-widest text-cyan-500 mb-4 uppercase">[Force]</div>
                        <p className="text-sm text-[#39ff14]">The creative intent, the aesthetic violence, the "volatile code" of the 155 BPM idea.</p>
                    </div>
                 </div>
                 <p>This portfolio is the result of that collision. It is the rejection of the "Sterile Dry Mix" in favor of a vital, living architecture. I don't just scale the cube; I manage the friction between the ideal form and the necessary noise of reality, delivering a product that is chemically dry, immutable, and perfectly lethal.</p>
                 <div className="text-right text-cyan-600 font-bold tracking-widest text-sm mt-8 uppercase">From default geometry to complex systems.</div>
               </div>

               {/* KERNEL BUILDING SERVICES */}
               <div className="mt-20 border-t border-cyan-900/50 pt-12">
                 <h2 className="text-3xl font-bold mb-8 text-cyan-400 tracking-tighter flex items-center gap-3">
                   <Cpu className="w-8 h-8 text-cyan-400" /> KERNEL_BUILDING_SERVICES
                 </h2>
                 <div className="grid md:grid-cols-3 gap-6 mb-12">
                   <div className="border border-cyan-900/30 p-6 bg-cyan-900/5 hover:border-cyan-500 transition-colors group rounded-lg">
                     <div className="text-xl font-bold text-cyan-400 mb-2">SEED_KERNEL</div>
                     <div className="text-xs font-bold text-fuchsia-500 mb-4 uppercase tracking-widest">[BASIC]</div>
                     <p className="text-sm text-[#39ff14] mb-4">A single, robust system prompt tailored to a specific user persona or goal.</p>
                     <div className="text-[#39ff14] font-bold mt-auto group-hover:translate-x-2 transition-transform">→ DEPLOY</div>
                   </div>
                   <div className="border border-fuchsia-900/30 p-6 bg-fuchsia-900/5 hover:bg-fuchsia-900/10 transition-colors group relative overflow-hidden rounded-lg">
                     <div className="absolute top-0 right-0 bg-fuchsia-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg">RECOMMENDED</div>
                     <div className="text-xl font-bold text-fuchsia-400 mb-2">SYSTEM_ARCH</div>
                     <div className="text-xs font-bold text-cyan-500 mb-4 uppercase tracking-widest">[STANDARD]</div>
                     <p className="text-sm text-[#39ff14] mb-4">Full OS design. Kernel + Modules + Implementation Guide for Claude/GPT/Gemini.</p>
                     <div className="text-[#39ff14] font-bold mt-auto group-hover:translate-x-2 transition-transform">→ DEPLOY</div>
                   </div>
                   <div className="border border-cyan-900/30 p-6 bg-cyan-900/5 hover:border-cyan-500 transition-colors group rounded-lg">
                     <div className="text-xl font-bold text-cyan-400 mb-2">ENTERPRISE_PROTO</div>
                     <div className="text-xs font-bold text-fuchsia-500 mb-4 uppercase tracking-widest">[PREMIUM]</div>
                     <p className="text-sm text-[#39ff14] mb-4">Full integration. Departmental kernels (Sales/HR) and workflow analysis.</p>
                     <div className="text-[#39ff14] font-bold mt-auto group-hover:translate-x-2 transition-transform">→ CONTACT</div>
                   </div>
                 </div>

                 <div className="flex flex-col md:flex-row gap-6 justify-center items-center text-sm font-bold tracking-widest">
                   <a href="[https://bsky.app/profile/scale94.bsky.social](https://bsky.app/profile/scale94.bsky.social)" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-white transition-colors border border-cyan-900/50 px-6 py-3 hover:bg-cyan-900/20 rounded-sm">
                     <Globe className="w-4 h-4" /> BSKY: @scale94
                   </a>
                   <div className="flex items-center gap-2 text-fuchsia-400 border border-fuchsia-900/50 px-6 py-3 bg-fuchsia-900/5 rounded-sm">
                     <MessageSquare className="w-4 h-4" /> SIGNAL: @scale.94
                   </div>
                   <a href="mailto:scale0097@gmail.com" className="flex items-center gap-2 text-[#39ff14] border border-green-900/50 px-6 py-3 hover:bg-green-900/10 cursor-pointer rounded-sm">
                     <Mail className="w-4 h-4" /> CONTACT: scale0097@gmail.com
                   </a>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="max-w-3xl animate-in fade-in duration-500">
              <h2 className="text-xl font-bold mb-6 border-b border-cyan-900/50 pb-2 flex items-center gap-2 text-cyan-400"><Lock className="w-5 h-5 text-fuchsia-500" /> /SYSTEM/PRIVACY_POLICY.md</h2>
              <div className="space-y-8 text-[#39ff14] leading-relaxed">
                <div className="p-6 border border-cyan-500/20 bg-cyan-900/5 mb-8 text-sm flex gap-4 items-start shadow-[0_0_15px_rgba(6,182,212,0.1)] rounded-lg">
                   <Shield className="w-6 h-6 shrink-0 text-cyan-400 animate-pulse" />
                   <div><strong className="text-cyan-400 text-lg">NO-TRACKING PROTOCOL ACTIVE.</strong><br className="mb-2"/>This terminal operates on a strict "Need-to-Know" basis. We do not harvest user data for advertising. We verify integrity, not identity.</div>
                </div>
                <section><h3 className="text-lg font-bold text-cyan-400 mb-2 uppercase tracking-wide">01. Data Minimization</h3><p>We collect only the bare minimum required for transmission. This includes technical logs (IP, User-Agent) necessary for security against hybrid vectors. We do not use third-party analytics pixels.</p></section>
                <section><h3 className="text-lg font-bold text-cyan-400 mb-2 uppercase tracking-wide">02. Research Integrity</h3><p>All research data published here is open access. However, the <strong>Kernel</strong> architecture itself is proprietary to the collective. Attempts to inject entropy (spam, ddos) will be met with the <em>Glass House Sanction</em> (IP Ban).</p></section>
                <section><h3 className="text-lg font-bold text-cyan-400 mb-2 uppercase tracking-wide">03. Communications</h3><p>Direct channels are encrypted. We retain logs for 30 days solely for debugging, after which they are purged via the Entropy Ledger.</p></section>
                <div className="mt-8 pt-8 border-t border-cyan-900/30 text-[10px] font-bold tracking-widest text-center text-gray-600 font-mono uppercase">VERIFIED BY: scale_admin // KEY_ID: 0x99AABB</div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-cyan-900/50 p-2 bg-black z-40">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-sm font-bold tracking-wide">
          <span className="text-fuchsia-500 hidden md:inline">scale@node:~$</span>
          <span className="text-fuchsia-500 md:hidden">~$</span>
          <input 
            type="text" 
            value={commandInput} 
            onChange={(e) => setCommandInput(e.target.value)} 
            onKeyDown={handleCommand} 
            className="bg-transparent border-none outline-none flex-grow text-cyan-400 placeholder-cyan-900/50 font-bold" 
            placeholder="enter command (e.g., load colemak-25)" 
            autoFocus 
          />
        </div>
      </footer>
    </div>
  );
};

export default ResearchTerminal;