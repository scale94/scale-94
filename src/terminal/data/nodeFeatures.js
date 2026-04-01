// nodeFeatures.js — 32D cognitive tensor space for the 256-cluster Hexadecimal Manifold
// Scale 9.4 → Scale 16.16 | 16 sectors × 16 nodes = 256 computational nodes
//
// Backward-compatible: dims[0..15] = legacy SOMA-9.4, dims[16..31] = expanded cognitive space.
// Shared between ArtTab.jsx (visualisation), LatentCollider.jsx (collision engine),
// useCommandDispatch.js (terminal), and all hooks that reference the feature manifold.

export const DIM_COUNT = 32;

export const DIM_NAMES = [
  // ── Legacy dims [0..15] — preserved from SOMA-9.4 ──
  'dynamical', 'nonlinearity', 'dimensionality', 'criticality',
  'entropy', 'synchrony', 'conservation', 'temporal',
  'spatial', 'stochastic', 'game_theory', 'thermodynamic',
  'information', 'cryptographic', 'biological', 'economic',
  // ── Extended dims [16..31] — 256-cluster cognitive expansion ──
  'epistemological', 'metaphysical', 'ethical', 'phenomenological',
  'algebraic', 'topological', 'statistical', 'linguistic',
  'historical', 'aesthetic', 'cognitive', 'chemical',
  'quantum', 'emergent', 'semiotic', 'synthetic',
];

// ── Sector definitions ──────────────────────────────────────────────────────
export const SECTORS = {
  eco:   { id: 'eco',   label: 'Ecological Systems',         idx: 0  },
  sync:  { id: 'sync',  label: 'Synchronization & Dynamics', idx: 1  },
  phys:  { id: 'phys',  label: 'Physics & Complexity',       idx: 2  },
  crypto:{ id: 'crypto',label: 'Cryptography & Security',    idx: 3  },
  drk:   { id: 'drk',   label: 'Dark Doctrine',              idx: 4  },
  phil:  { id: 'phil',  label: 'Advanced Philosophy',        idx: 5  },
  math:  { id: 'math',  label: 'Pure & Applied Mathematics', idx: 6  },
  chem:  { id: 'chem',  label: 'Chemistry & Materials',      idx: 7  },
  bio:   { id: 'bio',   label: 'Biology & Life Sciences',    idx: 8  },
  hum:   { id: 'hum',   label: 'Humanities & Culture',       idx: 9  },
  ling:  { id: 'ling',  label: 'Linguistics & Semiotics',    idx: 10 },
  cogn:  { id: 'cogn',  label: 'Cognitive Science',          idx: 11 },
  aesth: { id: 'aesth', label: 'Aesthetics & Sensory Theory',idx: 12 },
  topo:  { id: 'topo',  label: 'Topology & Geometry',        idx: 13 },
  meta:  { id: 'meta',  label: 'Metasystems & Emergence',    idx: 14 },
  synth: { id: 'synth', label: 'Synthetic Integration',      idx: 15 },
};

// ── Node registry — 256 nodes across 16 sectors ─────────────────────────────

export const NODES = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §01 — ECO (Ecological Systems) — indices 0..15
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'biocoenosis',      label: 'biocoenosis',          cluster: 'eco',   alias: 'biodiversity'    },
  { id: 'atmospheric',      label: 'atmospheric',          cluster: 'eco',   alias: 'climate'         },
  { id: 'chrono',           label: 'chrono_actuary',       cluster: 'eco',   alias: 'chrono'          },
  { id: 'daly',             label: 'daly',                 cluster: 'eco',   alias: 'daly'            },
  { id: 'replicator',       label: 'replicator',           cluster: 'eco',   alias: 'replicator'      },
  { id: 'grayscott',        label: 'grayscott',            cluster: 'eco',   alias: 'grayscott'       },
  { id: 'white_irid',       label: 'white_irid',           cluster: 'eco',   alias: 'white_irid'      },
  { id: 'bouligand_36',     label: 'bouligand_36',         cluster: 'eco',   alias: 'bouligand_36'    },
  { id: 'mycorrhizal',      label: 'mycorrhizal_net',      cluster: 'eco',   alias: 'mycorrhizal'     },
  { id: 'trophic_cascade',  label: 'trophic_cascade',      cluster: 'eco',   alias: 'trophic'         },
  { id: 'gaia_feedback',    label: 'gaia_feedback',        cluster: 'eco',   alias: 'gaia'            },
  { id: 'succession',       label: 'ecological_succession',cluster: 'eco',   alias: 'succession'      },
  { id: 'permafrost',       label: 'permafrost_signal',    cluster: 'eco',   alias: 'permafrost'      },
  { id: 'coral_bleach',     label: 'coral_bleach',         cluster: 'eco',   alias: 'coral'           },
  { id: 'pollinator',       label: 'pollinator_graph',     cluster: 'eco',   alias: 'pollinator'      },
  { id: 'albedo',           label: 'albedo_drift',         cluster: 'eco',   alias: 'albedo'          },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §02 — SYNC (Synchronization & Dynamics) — indices 16..31
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'kuramoto',         label: 'kuramoto',             cluster: 'sync',  alias: 'kuramoto'        },
  { id: 'ceei',             label: 'ceei',                 cluster: 'sync',  alias: 'ceei'            },
  { id: 'soma91',           label: 'soma_9.1',             cluster: 'sync',  alias: 'soma91'          },
  { id: 'soma_plus',        label: 'soma_plus',            cluster: 'sync',  alias: 'soma_plus'       },
  { id: 'leviathan',        label: 'leviathan',            cluster: 'sync',  alias: 'leviathan'       },
  { id: 'cynic',            label: 'cynic_realist',        cluster: 'sync',  alias: 'cynicrealist'    },
  { id: 'firefly',          label: 'firefly_sync',         cluster: 'sync',  alias: 'firefly'         },
  { id: 'metronome',        label: 'coupled_metronome',    cluster: 'sync',  alias: 'metronome'       },
  { id: 'circadian',        label: 'circadian_osc',        cluster: 'sync',  alias: 'circadian'       },
  { id: 'chimera_state',    label: 'chimera_state',        cluster: 'sync',  alias: 'chimera_state'   },
  { id: 'lotka_volterra',   label: 'lotka_volterra',       cluster: 'sync',  alias: 'lotka'           },
  { id: 'belousov',         label: 'belousov_zhabotinsky', cluster: 'sync',  alias: 'belousov'        },
  { id: 'sync_manifold',    label: 'sync_manifold',        cluster: 'sync',  alias: 'sync_manifold'   },
  { id: 'phase_lock',       label: 'phase_lock',           cluster: 'sync',  alias: 'pll'             },
  { id: 'strogatz',         label: 'strogatz_bridge',      cluster: 'sync',  alias: 'strogatz'        },
  { id: 'hebbian',          label: 'hebbian_sync',         cluster: 'sync',  alias: 'hebbian'         },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §03 — PHYS (Physics & Complexity) — indices 32..47
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'feigenbaum',       label: 'feigenbaum',           cluster: 'phys',  alias: 'feigenbaum'      },
  { id: 'ising',            label: 'ising',                cluster: 'phys',  alias: 'ising'           },
  { id: 'bosonic',          label: 'bosonic',              cluster: 'phys',  alias: 'bosonic_lattice' },
  { id: 'seraphine',        label: 'seraphine',            cluster: 'phys',  alias: 'seraphine'       },
  { id: 'fusion',           label: 'fusion_plasma',        cluster: 'phys',  alias: 'fusion'          },
  { id: 'pitch_black_steel',label: 'pitch_black_steel',    cluster: 'phys',  alias: 'pitch_black_steel'},
  { id: 'magic_angle_1p1',  label: 'magic_angle_1.1',      cluster: 'phys',  alias: 'magic_angle'     },
  { id: 'renormalization',  label: 'renormalization',      cluster: 'phys',  alias: 'renorm'          },
  { id: 'hawking_rad',      label: 'hawking_radiation',    cluster: 'phys',  alias: 'hawking'         },
  { id: 'casimir',          label: 'casimir_effect',       cluster: 'phys',  alias: 'casimir'         },
  { id: 'bose_einstein',    label: 'bose_einstein',        cluster: 'phys',  alias: 'bec'             },
  { id: 'turbulence',       label: 'kolmogorov_turb',      cluster: 'phys',  alias: 'turbulence'      },
  { id: 'penrose_tile',     label: 'penrose_tiling',       cluster: 'phys',  alias: 'penrose'         },
  { id: 'dirac_sea',        label: 'dirac_sea',            cluster: 'phys',  alias: 'dirac'           },
  { id: 'percolation',      label: 'percolation_threshold',cluster: 'phys',  alias: 'percolation'     },
  { id: 'soliton',          label: 'topological_soliton',  cluster: 'phys',  alias: 'soliton'         },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §04 — CRYPTO (Cryptography & Security) — indices 48..63
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'classified',       label: 'classified',           cluster: 'crypto', alias: 'classified'     },
  { id: 'pqhash',           label: 'pqhash',              cluster: 'crypto', alias: 'pqhash'         },
  { id: 'dh_ec',            label: 'dh_ec',               cluster: 'crypto', alias: 'dh_ec'          },
  { id: 'polymorph_pqc',    label: 'polymorph_pqc',       cluster: 'crypto', alias: 'polymorph_pqc'  },
  { id: 'lattice_sieve',    label: 'lattice_sieve',       cluster: 'crypto', alias: 'lattice_sieve'  },
  { id: 'zkp_circuit',      label: 'zkp_circuit',         cluster: 'crypto', alias: 'zkp'            },
  { id: 'mpc_garble',       label: 'mpc_garbled',         cluster: 'crypto', alias: 'mpc'            },
  { id: 'homomorphic',      label: 'fhe_bootstrap',       cluster: 'crypto', alias: 'fhe'            },
  { id: 'merkle_forest',    label: 'merkle_forest',       cluster: 'crypto', alias: 'merkle'         },
  { id: 'oblivious_xfer',   label: 'oblivious_transfer',  cluster: 'crypto', alias: 'ot'             },
  { id: 'vrf_oracle',       label: 'vrf_oracle',          cluster: 'crypto', alias: 'vrf'            },
  { id: 'threshold_sig',    label: 'threshold_sig',       cluster: 'crypto', alias: 'tss'            },
  { id: 'side_channel',     label: 'side_channel',        cluster: 'crypto', alias: 'side_channel'   },
  { id: 'code_crypto',      label: 'code_based_crypto',   cluster: 'crypto', alias: 'mceliece'       },
  { id: 'isogeny',          label: 'isogeny_walk',        cluster: 'crypto', alias: 'isogeny'        },
  { id: 'witness_encrypt',  label: 'witness_encrypt',     cluster: 'crypto', alias: 'we'             },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §05 — DRK (Dark Doctrine) — indices 64..79
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'pragmatic',        label: 'pragmatic',            cluster: 'drk',   alias: 'pragmatic'       },
  { id: 'soma_kernel',      label: 'soma_kernel',          cluster: 'drk',   alias: 'soma_kernel'     },
  { id: 'strangler',        label: 'strangler_fig',        cluster: 'drk',   alias: 'strangler_fig'   },
  { id: 'surveillance',     label: 'surveillance',         cluster: 'drk',   alias: 'surveillance'    },
  { id: 'necromantic',      label: 'necromantic',          cluster: 'drk',   alias: 'necromantic'     },
  { id: 'zero_effort_flow', label: 'zero_effort_flow',     cluster: 'drk',   alias: 'zero_effort_flow'},
  { id: 'thanatos',         label: 'thanatos_drive',       cluster: 'drk',   alias: 'thanatos'        },
  { id: 'basilisk',         label: 'roko_basilisk',        cluster: 'drk',   alias: 'basilisk'        },
  { id: 'moloch',           label: 'moloch_trap',          cluster: 'drk',   alias: 'moloch'          },
  { id: 'accelerate',       label: 'accelerationist',      cluster: 'drk',   alias: 'accelerate'      },
  { id: 'dark_forest',      label: 'dark_forest',          cluster: 'drk',   alias: 'dark_forest'     },
  { id: 'dead_internet',    label: 'dead_internet',        cluster: 'drk',   alias: 'dead_internet'   },
  { id: 'simulacra',        label: 'baudrillard_sim',      cluster: 'drk',   alias: 'simulacra'       },
  { id: 'panspectron',      label: 'panspectron',          cluster: 'drk',   alias: 'panspectron'     },
  { id: 'hyperstition',     label: 'hyperstition',         cluster: 'drk',   alias: 'hyperstition'    },
  { id: 'pharmakon',        label: 'pharmakon',            cluster: 'drk',   alias: 'pharmakon'       },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §06 — PHIL (Advanced Philosophy) — indices 80..95
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'episteme',         label: 'episteme',             cluster: 'phil',  alias: 'episteme'        },
  { id: 'aporia',           label: 'aporia',               cluster: 'phil',  alias: 'aporia'          },
  { id: 'categorical_imp',  label: 'categorical_imperative',cluster: 'phil', alias: 'categorical'     },
  { id: 'dialectic',        label: 'hegelian_dialectic',   cluster: 'phil',  alias: 'dialectic'       },
  { id: 'phenomenal',       label: 'phenomenal_field',     cluster: 'phil',  alias: 'phenomenal'      },
  { id: 'dasein',           label: 'dasein',               cluster: 'phil',  alias: 'dasein'          },
  { id: 'rhizome',          label: 'rhizome',              cluster: 'phil',  alias: 'rhizome'         },
  { id: 'wittgenstein',     label: 'language_game',        cluster: 'phil',  alias: 'wittgenstein'    },
  { id: 'qualia_bind',      label: 'qualia_binding',       cluster: 'phil',  alias: 'qualia'          },
  { id: 'modal_logic',      label: 'modal_logic',          cluster: 'phil',  alias: 'modal'           },
  { id: 'process_phil',     label: 'whitehead_process',    cluster: 'phil',  alias: 'whitehead'       },
  { id: 'pragmatism',       label: 'pragmatist_truth',     cluster: 'phil',  alias: 'pragmatism'      },
  { id: 'mereology',        label: 'mereological',         cluster: 'phil',  alias: 'mereology'       },
  { id: 'virtue_ethics',    label: 'aristotelian_virtue',  cluster: 'phil',  alias: 'virtue'          },
  { id: 'absurdist',        label: 'sisyphus',             cluster: 'phil',  alias: 'absurdist'       },
  { id: 'ubuntu',           label: 'ubuntu_ethics',        cluster: 'phil',  alias: 'ubuntu'          },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §07 — MATH (Pure & Applied Mathematics) — indices 96..111
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'grothendieck',     label: 'grothendieck_topos',   cluster: 'math',  alias: 'grothendieck'    },
  { id: 'riemann_zeta',     label: 'riemann_hypothesis',   cluster: 'math',  alias: 'riemann'         },
  { id: 'galois',           label: 'galois_field',         cluster: 'math',  alias: 'galois'          },
  { id: 'godel',            label: 'incompleteness',       cluster: 'math',  alias: 'godel'           },
  { id: 'mandelbrot',       label: 'mandelbrot_set',       cluster: 'math',  alias: 'mandelbrot'      },
  { id: 'fourier',          label: 'fourier_transform',    cluster: 'math',  alias: 'fourier'         },
  { id: 'bayesian',         label: 'bayesian_inference',   cluster: 'math',  alias: 'bayesian'        },
  { id: 'poincare',         label: 'poincare_conjecture',  cluster: 'math',  alias: 'poincare'        },
  { id: 'langlands',        label: 'langlands_program',    cluster: 'math',  alias: 'langlands'       },
  { id: 'nash_equil',       label: 'nash_equilibrium',     cluster: 'math',  alias: 'nash'            },
  { id: 'cantor',           label: 'cantor_diagonal',      cluster: 'math',  alias: 'cantor'          },
  { id: 'cellular_auto',    label: 'cellular_automaton',   cluster: 'math',  alias: 'rule110'         },
  { id: 'chaos_attractor',  label: 'lorenz_attractor',     cluster: 'math',  alias: 'lorenz'          },
  { id: 'knot_invariant',   label: 'knot_polynomial',      cluster: 'math',  alias: 'knot'            },
  { id: 'ergodic',          label: 'ergodic_theorem',      cluster: 'math',  alias: 'ergodic'         },
  { id: 'p_vs_np',          label: 'p_np_barrier',         cluster: 'math',  alias: 'complexity'      },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §08 — CHEM (Chemistry & Materials Science) — indices 112..127
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'chirality',        label: 'molecular_chirality',  cluster: 'chem',  alias: 'chirality'       },
  { id: 'retrosynthesis',   label: 'retrosynthetic',       cluster: 'chem',  alias: 'retrosynthesis'  },
  { id: 'catalysis',        label: 'catalytic_cycle',      cluster: 'chem',  alias: 'catalysis'       },
  { id: 'polymer_fold',     label: 'polymer_folding',      cluster: 'chem',  alias: 'polymer'         },
  { id: 'redox',            label: 'redox_cascade',        cluster: 'chem',  alias: 'redox'           },
  { id: 'supramolecular',   label: 'host_guest',           cluster: 'chem',  alias: 'supramolecular'  },
  { id: 'photochem',        label: 'photochemistry',       cluster: 'chem',  alias: 'photochem'       },
  { id: 'maillard',         label: 'maillard_reaction',    cluster: 'chem',  alias: 'maillard'        },
  { id: 'terpene',          label: 'terpene_scaffold',     cluster: 'chem',  alias: 'terpene'         },
  { id: 'volatility',       label: 'vapor_pressure',       cluster: 'chem',  alias: 'volatility'      },
  { id: 'crystal_lattice',  label: 'crystal_packing',      cluster: 'chem',  alias: 'crystal'         },
  { id: 'coord_chem',       label: 'coordination_complex', cluster: 'chem',  alias: 'coordination'    },
  { id: 'electrospray',     label: 'mass_spec',            cluster: 'chem',  alias: 'gcms'            },
  { id: 'click_chem',       label: 'click_chemistry',      cluster: 'chem',  alias: 'click'           },
  { id: 'aroma_receptor',   label: 'olfactory_receptor',   cluster: 'chem',  alias: 'or_receptor'     },
  { id: 'phase_diagram',    label: 'gibbs_phase',          cluster: 'chem',  alias: 'gibbs'           },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §09 — BIO (Biology & Life Sciences) — indices 128..143
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'crispr',           label: 'crispr_cas9',          cluster: 'bio',   alias: 'crispr'          },
  { id: 'morphogen',        label: 'morphogen_gradient',   cluster: 'bio',   alias: 'morphogen'       },
  { id: 'microbiome',       label: 'gut_brain_axis',       cluster: 'bio',   alias: 'microbiome'      },
  { id: 'apoptosis',        label: 'programmed_death',     cluster: 'bio',   alias: 'apoptosis'       },
  { id: 'quorum',           label: 'quorum_sensing',       cluster: 'bio',   alias: 'quorum'          },
  { id: 'prion',            label: 'prion_fold',           cluster: 'bio',   alias: 'prion'           },
  { id: 'endosymbiont',     label: 'endosymbiosis',        cluster: 'bio',   alias: 'endosymbiont'    },
  { id: 'epigenetic',       label: 'epigenetic_mark',      cluster: 'bio',   alias: 'epigenetic'      },
  { id: 'neurotransmit',    label: 'synaptic_cleft',       cluster: 'bio',   alias: 'synapse'         },
  { id: 'circadian_bio',    label: 'suprachiasmatic',      cluster: 'bio',   alias: 'scn'             },
  { id: 'horizontal_xfer',  label: 'lateral_gene',         cluster: 'bio',   alias: 'hgt'             },
  { id: 'extremophile',     label: 'extremophile',         cluster: 'bio',   alias: 'extremophile'    },
  { id: 'olfactory_bulb',   label: 'olfactory_epithelium', cluster: 'bio',   alias: 'olfactory_bulb'  },
  { id: 'vomeronasal',      label: 'vomeronasal_organ',    cluster: 'bio',   alias: 'vomeronasal'     },
  { id: 'axon_guidance',    label: 'growth_cone',          cluster: 'bio',   alias: 'axon'            },
  { id: 'telomere',         label: 'telomere_clock',       cluster: 'bio',   alias: 'telomere'        },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §10 — HUM (Humanities & Cultural Systems) — indices 144..159
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'longue_duree',     label: 'braudel_time',         cluster: 'hum',   alias: 'braudel'         },
  { id: 'oral_tradition',   label: 'oral_archive',         cluster: 'hum',   alias: 'oral'            },
  { id: 'palimpsest',       label: 'palimpsest',           cluster: 'hum',   alias: 'palimpsest'      },
  { id: 'diaspora',         label: 'diaspora_network',     cluster: 'hum',   alias: 'diaspora'        },
  { id: 'archive_fever',    label: 'derrida_archive',      cluster: 'hum',   alias: 'archive'         },
  { id: 'cargo_cult',       label: 'cargo_cult',           cluster: 'hum',   alias: 'cargo'           },
  { id: 'liminality',       label: 'turner_liminal',       cluster: 'hum',   alias: 'liminal'         },
  { id: 'gift_economy',     label: 'mauss_gift',           cluster: 'hum',   alias: 'gift'            },
  { id: 'orientalism',      label: 'orientalism',          cluster: 'hum',   alias: 'orientalism'     },
  { id: 'mytheme',          label: 'structural_myth',      cluster: 'hum',   alias: 'mytheme'         },
  { id: 'thick_desc',       label: 'geertz_thick',         cluster: 'hum',   alias: 'geertz'          },
  { id: 'collective_mem',   label: 'halbwachs_memory',     cluster: 'hum',   alias: 'collective_mem'  },
  { id: 'subaltern',        label: 'subaltern_speak',      cluster: 'hum',   alias: 'subaltern'       },
  { id: 'perfume_hist',     label: 'fragrance_history',    cluster: 'hum',   alias: 'perfume_hist'    },
  { id: 'synesthesia_cul',  label: 'cultural_synesthesia', cluster: 'hum',   alias: 'synesthesia'     },
  { id: 'potlatch',         label: 'potlatch_economy',     cluster: 'hum',   alias: 'potlatch'        },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §11 — LING (Linguistics & Semiotics) — indices 160..175
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'saussure',         label: 'signifier_signified',  cluster: 'ling',  alias: 'saussure'        },
  { id: 'chomsky_tree',     label: 'generative_grammar',   cluster: 'ling',  alias: 'chomsky'         },
  { id: 'sapir_whorf',      label: 'linguistic_relativity',cluster: 'ling',  alias: 'sapir'           },
  { id: 'pragmatics',       label: 'speech_act',           cluster: 'ling',  alias: 'speech_act'      },
  { id: 'phonaestheme',     label: 'phonaesthesia',        cluster: 'ling',  alias: 'phonaestheme'    },
  { id: 'prototype',        label: 'prototype_semantics',  cluster: 'ling',  alias: 'prototype'       },
  { id: 'metaphor_engine',  label: 'lakoff_metaphor',      cluster: 'ling',  alias: 'lakoff'          },
  { id: 'pidgin',           label: 'creolization',         cluster: 'ling',  alias: 'pidgin'          },
  { id: 'glossopoeia',      label: 'constructed_lang',     cluster: 'ling',  alias: 'conlang'         },
  { id: 'etymology',        label: 'etymological_trace',   cluster: 'ling',  alias: 'etymology'       },
  { id: 'peirce_sign',      label: 'peircean_triad',       cluster: 'ling',  alias: 'peirce'          },
  { id: 'olfactory_lexicon',label: 'smell_words',          cluster: 'ling',  alias: 'smell_words'     },
  { id: 'deixis',           label: 'deictic_anchor',       cluster: 'ling',  alias: 'deixis'          },
  { id: 'prosody',          label: 'suprasegmental',       cluster: 'ling',  alias: 'prosody'         },
  { id: 'corpus',           label: 'corpus_linguistics',   cluster: 'ling',  alias: 'corpus'          },
  { id: 'translation',      label: 'untranslatability',    cluster: 'ling',  alias: 'quine'           },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §12 — COGN (Cognitive Science & Neuroscience) — indices 176..191
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'predictive_brain', label: 'predictive_coding',    cluster: 'cogn',  alias: 'predictive'      },
  { id: 'binding_problem',  label: 'neural_binding',       cluster: 'cogn',  alias: 'binding'         },
  { id: 'mirror_neuron',    label: 'mirror_system',        cluster: 'cogn',  alias: 'mirror'          },
  { id: 'attention_schema', label: 'attention_schema',     cluster: 'cogn',  alias: 'attention'       },
  { id: 'embodied_cog',     label: 'embodied_cognition',   cluster: 'cogn',  alias: 'embodied'        },
  { id: 'enactive',         label: 'enactive_perception',  cluster: 'cogn',  alias: 'enactive'        },
  { id: 'global_workspace', label: 'global_workspace',     cluster: 'cogn',  alias: 'gws'             },
  { id: 'default_mode',     label: 'default_mode_net',     cluster: 'cogn',  alias: 'dmn'             },
  { id: 'hippocampal',      label: 'hippocampal_map',      cluster: 'cogn',  alias: 'hippocampus'     },
  { id: 'piriform',         label: 'piriform_cortex',      cluster: 'cogn',  alias: 'piriform'        },
  { id: 'proustian',        label: 'proustian_memory',     cluster: 'cogn',  alias: 'proust'          },
  { id: 'weber_fechner',    label: 'psychophysical_law',   cluster: 'cogn',  alias: 'weber'           },
  { id: 'mcgurk',           label: 'crossmodal_illusion',  cluster: 'cogn',  alias: 'mcgurk'          },
  { id: 'affordance',       label: 'gibsonian_affordance', cluster: 'cogn',  alias: 'affordance'      },
  { id: 'chunking',         label: 'miller_chunking',      cluster: 'cogn',  alias: 'chunking'        },
  { id: 'blindsight',       label: 'subliminal_path',      cluster: 'cogn',  alias: 'blindsight'      },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §13 — AESTH (Aesthetics & Sensory Theory) — indices 192..207
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'sublime',          label: 'kantian_sublime',      cluster: 'aesth', alias: 'sublime'         },
  { id: 'wabi_sabi',        label: 'wabi_sabi',            cluster: 'aesth', alias: 'wabi'            },
  { id: 'synesthetic',      label: 'synesthesia',          cluster: 'aesth', alias: 'synesthetic'     },
  { id: 'golden_ratio',     label: 'phi_proportion',       cluster: 'aesth', alias: 'phi'             },
  { id: 'umami',            label: 'fifth_taste',          cluster: 'aesth', alias: 'umami'           },
  { id: 'negative_space',   label: 'ma_interval',          cluster: 'aesth', alias: 'ma'              },
  { id: 'uncanny_valley',   label: 'uncanny_valley',       cluster: 'aesth', alias: 'uncanny'         },
  { id: 'camp',             label: 'sontag_camp',          cluster: 'aesth', alias: 'camp'            },
  { id: 'terroir',          label: 'terroir',              cluster: 'aesth', alias: 'terroir'         },
  { id: 'patina',           label: 'patina_age',           cluster: 'aesth', alias: 'patina'          },
  { id: 'sillage_theory',   label: 'sillage_model',        cluster: 'aesth', alias: 'sillage_theory'  },
  { id: 'drydown',          label: 'drydown_curve',        cluster: 'aesth', alias: 'drydown'         },
  { id: 'accord_theory',    label: 'fragrance_accord',     cluster: 'aesth', alias: 'accord'          },
  { id: 'headspace_tech',   label: 'headspace_capture',    cluster: 'aesth', alias: 'headspace'       },
  { id: 'base_note',        label: 'base_note_weight',     cluster: 'aesth', alias: 'base_note'       },
  { id: 'je_ne_sais_quoi',  label: 'ineffable_quality',    cluster: 'aesth', alias: 'ineffable'       },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §14 — TOPO (Topology & Geometric Systems) — indices 208..223
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'mobius',            label: 'mobius_strip',         cluster: 'topo',  alias: 'mobius'          },
  { id: 'klein_bottle',     label: 'klein_bottle',         cluster: 'topo',  alias: 'klein'           },
  { id: 'euler_char',       label: 'euler_characteristic', cluster: 'topo',  alias: 'euler'           },
  { id: 'homology',         label: 'homology_group',       cluster: 'topo',  alias: 'homology'        },
  { id: 'betti_number',     label: 'betti_numbers',        cluster: 'topo',  alias: 'betti'           },
  { id: 'fiber_bundle',     label: 'fiber_bundle',         cluster: 'topo',  alias: 'fiber'           },
  { id: 'simplex',          label: 'simplicial_complex',   cluster: 'topo',  alias: 'simplex'         },
  { id: 'persistent_hom',   label: 'persistent_homology',  cluster: 'topo',  alias: 'ph'              },
  { id: 'hyperbolic',       label: 'hyperbolic_plane',     cluster: 'topo',  alias: 'hyperbolic'      },
  { id: 'graph_laplacian',  label: 'spectral_graph',       cluster: 'topo',  alias: 'laplacian'       },
  { id: 'voronoi',          label: 'voronoi_tessellation', cluster: 'topo',  alias: 'voronoi'         },
  { id: 'geodesic',         label: 'geodesic_flow',        cluster: 'topo',  alias: 'geodesic'        },
  { id: 'winding_number',   label: 'winding_number',       cluster: 'topo',  alias: 'winding'         },
  { id: 'cobordism',        label: 'cobordism',            cluster: 'topo',  alias: 'cobordism'       },
  { id: 'morse_theory',     label: 'morse_function',       cluster: 'topo',  alias: 'morse'           },
  { id: 'tda_mapper',       label: 'mapper_algorithm',     cluster: 'topo',  alias: 'mapper'          },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §15 — META (Metasystems & Emergence) — indices 224..239
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'autopoiesis',      label: 'autopoietic',          cluster: 'meta',  alias: 'autopoiesis'     },
  { id: 'stigmergy',        label: 'stigmergic',           cluster: 'meta',  alias: 'stigmergy'       },
  { id: 'soc_critical',     label: 'self_organized_crit',  cluster: 'meta',  alias: 'soc'             },
  { id: 'downward_cause',   label: 'downward_causation',   cluster: 'meta',  alias: 'downward'        },
  { id: 'dissipative',      label: 'prigogine_struct',     cluster: 'meta',  alias: 'prigogine'       },
  { id: 'cybernetic',       label: 'second_cybernetics',   cluster: 'meta',  alias: 'cybernetic'      },
  { id: 'strange_loop',     label: 'hofstadter_loop',      cluster: 'meta',  alias: 'hofstadter'      },
  { id: 'phase_trans',      label: 'order_parameter',      cluster: 'meta',  alias: 'phase_trans'     },
  { id: 'swarm',            label: 'swarm_intelligence',   cluster: 'meta',  alias: 'swarm'           },
  { id: 'attractor_land',   label: 'attractor_landscape',  cluster: 'meta',  alias: 'waddington'      },
  { id: 'edge_chaos',       label: 'edge_of_chaos',        cluster: 'meta',  alias: 'edge_chaos'      },
  { id: 'scale_free',       label: 'scale_free_net',       cluster: 'meta',  alias: 'scale_free'      },
  { id: 'holarchy',         label: 'holonic_system',       cluster: 'meta',  alias: 'holarchy'        },
  { id: 'teleology',        label: 'systemic_purpose',     cluster: 'meta',  alias: 'teleology'       },
  { id: 'bootstrap',        label: 'bootstrap_paradox',    cluster: 'meta',  alias: 'bootstrap'       },
  { id: 'omega_point',      label: 'teilhard_omega',       cluster: 'meta',  alias: 'omega'           },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTOR §16 — SYNTH (Synthetic Integration) — indices 240..255
  // ═══════════════════════════════════════════════════════════════════════════
  { id: 'analogy',          label: 'analogical_engine',     cluster: 'synth', alias: 'analogy'         },
  { id: 'bisociation',      label: 'koestler_bisociation', cluster: 'synth', alias: 'bisociation'     },
  { id: 'consilience',      label: 'wilson_consilience',   cluster: 'synth', alias: 'consilience'     },
  { id: 'abduction',        label: 'peircean_abduction',   cluster: 'synth', alias: 'abduction'       },
  { id: 'metaphor_bridge',  label: 'conceptual_blend',     cluster: 'synth', alias: 'blend'           },
  { id: 'transdiscipline',  label: 'transdisciplinary',    cluster: 'synth', alias: 'transdiscipline' },
  { id: 'boundary_object',  label: 'star_boundary',        cluster: 'synth', alias: 'boundary'        },
  { id: 'isomorphism',      label: 'structural_iso',       cluster: 'synth', alias: 'iso'             },
  { id: 'resonance_bridge', label: 'harmonic_bridge',      cluster: 'synth', alias: 'harmonic'        },
  { id: 'polysemy',         label: 'polysemic_node',       cluster: 'synth', alias: 'polysemy'        },
  { id: 'hybrid_vigor',     label: 'heterosis',            cluster: 'synth', alias: 'heterosis'       },
  { id: 'chimera_forge',    label: 'chimera_synthesis',    cluster: 'synth', alias: 'forge'           },
  { id: 'translation_layer',label: 'rosetta_node',         cluster: 'synth', alias: 'rosetta'         },
  { id: 'ock_v2',           label: 'olfactory_kernel_v2',  cluster: 'synth', alias: 'ock2'            },
  { id: 'decay_engine',     label: 'subatomic_decay',      cluster: 'synth', alias: 'decay'           },
  { id: 'omega_collider',   label: 'omega_collider',       cluster: 'synth', alias: 'omega_collider'  },
];

export const NODE_IDX = Object.fromEntries(NODES.map((n, i) => [n.id, i]));

// Resolve a user string to a node object (by id, alias, or label)
export function resolveNode(str) {
  const s = str.toLowerCase().trim().replace(/-/g, '_');
  return NODES.find(n => n.id === s || n.alias === s || n.label === s) ?? null;
}

// ── 32D Feature Tensors ──────────────────────────────────────────────────────
// Each row: 32 floats in [0, 1] mapping to DIM_NAMES.
// Legacy nodes (indices 0–30) preserve dims[0..15] exactly from SOMA-9.4.
// dims[16..31] populated for Phase 1 calibration; Phase 2 will fine-tune via
// gradient descent across 32,640 pairwise collisions.
//
// Dimension key:
//  [0]dyn  [1]nonl [2]dim  [3]crit [4]ent  [5]sync [6]cons [7]temp
//  [8]spat [9]stoc [10]gam [11]thm [12]inf [13]cry [14]bio [15]eco
//  [16]epi [17]met [18]eth [19]phe [20]alg [21]top [22]sta [23]lin
//  [24]his [25]aes [26]cog [27]che [28]qua [29]eme [30]sem [31]syn

/* prettier-ignore */
export const FEATURES = [
  // ═══ SECTOR §01 — ECO ═══════════════════════════════════════════════════════
  /*  0  biocoenosis      */ [0.75,0.55,0.50,0.30,0.90,0.30,0.40,0.50,0.35,0.70,0.40,0.20,0.85,0.00,1.00,0.20, 0.15,0.10,0.30,0.20,0.10,0.25,0.40,0.10,0.35,0.15,0.15,0.20,0.00,0.60,0.10,0.20],
  /*  1  atmospheric      */ [0.80,0.70,0.75,0.50,0.55,0.20,0.50,0.80,0.70,0.30,0.10,0.80,0.30,0.00,0.40,0.10, 0.10,0.10,0.20,0.15,0.15,0.30,0.45,0.05,0.30,0.20,0.10,0.45,0.10,0.35,0.05,0.15],
  /*  2  chrono           */ [0.50,0.45,0.50,0.30,0.50,0.10,0.30,1.00,0.35,0.20,0.30,0.60,0.40,0.00,0.65,0.70, 0.25,0.20,0.15,0.10,0.10,0.15,0.30,0.10,0.75,0.10,0.15,0.05,0.05,0.20,0.10,0.15],
  /*  3  daly             */ [0.25,0.40,0.30,0.20,0.70,0.20,0.60,0.70,0.05,0.10,0.50,0.75,0.50,0.00,0.30,0.90, 0.20,0.10,0.45,0.05,0.10,0.05,0.35,0.10,0.40,0.05,0.10,0.10,0.00,0.15,0.05,0.10],
  /*  4  replicator       */ [0.55,0.70,0.50,0.45,0.45,0.50,0.50,0.45,0.65,0.30,1.00,0.10,0.30,0.00,0.75,0.40, 0.10,0.05,0.20,0.05,0.15,0.10,0.25,0.05,0.20,0.05,0.10,0.05,0.00,0.40,0.05,0.15],
  /*  5  grayscott        */ [1.00,0.90,0.75,0.60,0.30,0.40,0.40,0.30,1.00,0.00,0.00,0.20,0.10,0.00,0.30,0.00, 0.05,0.05,0.00,0.10,0.20,0.35,0.10,0.00,0.05,0.30,0.05,0.25,0.00,0.45,0.00,0.10],
  /*  6  white_irid       */ [0.45,0.70,0.55,0.35,0.40,0.65,0.25,0.80,0.75,0.20,0.05,0.50,0.25,0.00,1.00,0.10, 0.05,0.10,0.05,0.30,0.10,0.20,0.15,0.05,0.15,0.55,0.10,0.15,0.10,0.30,0.10,0.10],
  /*  7  bouligand_36     */ [0.35,0.60,0.35,0.25,0.30,0.90,0.20,0.10,0.55,0.15,0.05,0.40,0.20,0.10,0.90,0.05, 0.05,0.05,0.00,0.10,0.15,0.40,0.10,0.00,0.10,0.35,0.05,0.20,0.05,0.25,0.05,0.10],
  /*  8  mycorrhizal      */ [0.65,0.50,0.60,0.35,0.40,0.75,0.45,0.55,0.70,0.25,0.30,0.15,0.50,0.00,0.90,0.15, 0.10,0.10,0.15,0.10,0.05,0.55,0.20,0.05,0.25,0.10,0.10,0.15,0.00,0.65,0.05,0.20],
  /*  9  trophic_cascade  */ [0.70,0.65,0.45,0.50,0.55,0.35,0.50,0.40,0.45,0.30,0.45,0.30,0.35,0.00,0.85,0.25, 0.10,0.05,0.15,0.05,0.10,0.20,0.35,0.05,0.20,0.05,0.10,0.10,0.00,0.50,0.05,0.15],
  /* 10  gaia_feedback    */ [0.80,0.75,0.65,0.55,0.45,0.40,0.60,0.70,0.60,0.20,0.15,0.65,0.40,0.00,0.80,0.30, 0.20,0.25,0.25,0.15,0.10,0.20,0.30,0.05,0.35,0.15,0.10,0.30,0.00,0.55,0.05,0.25],
  /* 11  succession       */ [0.60,0.45,0.40,0.40,0.35,0.25,0.35,0.85,0.50,0.20,0.20,0.25,0.30,0.00,0.80,0.20, 0.10,0.10,0.10,0.10,0.05,0.15,0.25,0.05,0.50,0.15,0.10,0.10,0.00,0.40,0.05,0.10],
  /* 12  permafrost       */ [0.55,0.40,0.50,0.60,0.50,0.10,0.40,0.75,0.45,0.25,0.10,0.70,0.25,0.00,0.55,0.15, 0.10,0.05,0.20,0.05,0.05,0.15,0.30,0.05,0.40,0.05,0.05,0.35,0.00,0.30,0.05,0.10],
  /* 13  coral_bleach     */ [0.60,0.55,0.40,0.65,0.60,0.30,0.30,0.50,0.50,0.35,0.10,0.55,0.30,0.00,0.85,0.15, 0.10,0.05,0.25,0.10,0.05,0.10,0.30,0.05,0.25,0.20,0.05,0.25,0.00,0.35,0.05,0.10],
  /* 14  pollinator       */ [0.50,0.45,0.40,0.30,0.30,0.60,0.40,0.40,0.55,0.25,0.35,0.15,0.35,0.00,0.90,0.20, 0.05,0.05,0.10,0.15,0.05,0.30,0.20,0.05,0.20,0.25,0.15,0.20,0.00,0.45,0.10,0.15],
  /* 15  albedo           */ [0.55,0.50,0.45,0.45,0.35,0.15,0.50,0.60,0.55,0.20,0.10,0.75,0.30,0.00,0.40,0.15, 0.10,0.10,0.15,0.10,0.10,0.15,0.35,0.05,0.25,0.15,0.05,0.20,0.10,0.25,0.05,0.10],

  // ═══ SECTOR §02 — SYNC ═════════════════════════════════════════════════════
  /* 16  kuramoto         */ [0.55,0.60,0.70,0.55,0.35,1.00,0.50,0.40,0.65,0.20,0.20,0.10,0.25,0.00,0.25,0.10, 0.10,0.10,0.05,0.15,0.30,0.35,0.25,0.05,0.10,0.10,0.20,0.05,0.10,0.45,0.05,0.20],
  /* 17  ceei             */ [0.25,0.30,0.55,0.20,0.40,0.50,0.80,0.20,0.65,0.10,0.85,0.20,0.40,0.00,0.10,1.00, 0.15,0.10,0.25,0.05,0.25,0.10,0.35,0.05,0.15,0.05,0.10,0.05,0.00,0.20,0.05,0.15],
  /* 18  soma91           */ [0.30,0.35,0.50,0.30,0.50,0.40,0.50,0.50,0.65,0.20,0.30,0.50,0.50,0.00,0.20,0.50, 0.20,0.15,0.10,0.15,0.15,0.20,0.25,0.10,0.20,0.15,0.20,0.10,0.05,0.30,0.10,0.25],
  /* 19  soma_plus        */ [0.45,0.40,0.55,0.30,0.50,0.50,0.50,0.50,0.65,0.30,0.30,0.50,0.50,0.00,0.20,0.40, 0.20,0.15,0.10,0.20,0.15,0.25,0.25,0.10,0.20,0.20,0.25,0.10,0.05,0.35,0.10,0.30],
  /* 20  leviathan        */ [0.30,0.50,0.70,0.35,0.40,0.55,0.30,0.45,0.65,0.30,0.90,0.25,0.30,0.00,0.10,0.50, 0.25,0.20,0.35,0.10,0.10,0.15,0.20,0.15,0.40,0.05,0.15,0.05,0.00,0.25,0.10,0.15],
  /* 21  cynic            */ [0.15,0.25,0.30,0.10,0.30,0.20,0.20,0.35,0.10,0.15,0.50,0.15,0.20,0.00,0.10,0.30, 0.40,0.30,0.45,0.20,0.05,0.05,0.10,0.20,0.35,0.10,0.15,0.00,0.00,0.10,0.15,0.10],
  /* 22  firefly          */ [0.60,0.50,0.40,0.35,0.25,0.90,0.30,0.35,0.50,0.30,0.10,0.10,0.20,0.00,0.70,0.05, 0.05,0.05,0.00,0.15,0.10,0.15,0.20,0.05,0.10,0.20,0.25,0.15,0.00,0.40,0.05,0.10],
  /* 23  metronome        */ [0.50,0.35,0.30,0.25,0.15,0.85,0.45,0.30,0.30,0.10,0.05,0.10,0.15,0.00,0.05,0.05, 0.05,0.05,0.00,0.10,0.10,0.10,0.10,0.05,0.10,0.15,0.10,0.00,0.00,0.20,0.05,0.10],
  /* 24  circadian        */ [0.55,0.45,0.45,0.40,0.30,0.80,0.40,0.75,0.35,0.15,0.10,0.20,0.25,0.00,0.80,0.10, 0.10,0.05,0.05,0.10,0.05,0.10,0.20,0.05,0.15,0.10,0.45,0.15,0.00,0.35,0.05,0.10],
  /* 25  chimera_state    */ [0.70,0.75,0.65,0.60,0.55,0.70,0.25,0.30,0.50,0.40,0.15,0.15,0.40,0.00,0.15,0.10, 0.15,0.15,0.05,0.10,0.20,0.30,0.25,0.05,0.10,0.10,0.20,0.05,0.10,0.55,0.05,0.25],
  /* 26  lotka_volterra   */ [0.75,0.70,0.45,0.45,0.40,0.35,0.45,0.50,0.45,0.30,0.55,0.15,0.25,0.00,0.70,0.30, 0.05,0.05,0.10,0.05,0.20,0.10,0.40,0.05,0.15,0.05,0.10,0.05,0.00,0.35,0.05,0.10],
  /* 27  belousov         */ [0.85,0.80,0.50,0.55,0.40,0.65,0.30,0.40,0.60,0.20,0.05,0.45,0.20,0.00,0.20,0.05, 0.05,0.05,0.00,0.15,0.10,0.15,0.15,0.05,0.10,0.25,0.05,0.60,0.05,0.45,0.05,0.15],
  /* 28  sync_manifold    */ [0.60,0.55,0.75,0.50,0.35,0.85,0.40,0.30,0.55,0.20,0.10,0.10,0.35,0.00,0.10,0.10, 0.10,0.10,0.05,0.10,0.35,0.55,0.20,0.05,0.05,0.10,0.15,0.05,0.10,0.40,0.05,0.20],
  /* 29  phase_lock       */ [0.50,0.45,0.50,0.40,0.20,0.90,0.50,0.25,0.40,0.15,0.10,0.15,0.30,0.10,0.10,0.10, 0.05,0.05,0.00,0.05,0.15,0.20,0.15,0.05,0.05,0.05,0.15,0.05,0.05,0.25,0.05,0.15],
  /* 30  strogatz         */ [0.55,0.50,0.60,0.45,0.40,0.75,0.35,0.35,0.55,0.25,0.20,0.10,0.40,0.00,0.15,0.15, 0.10,0.10,0.05,0.10,0.20,0.45,0.30,0.10,0.10,0.10,0.20,0.05,0.05,0.40,0.05,0.20],
  /* 31  hebbian          */ [0.45,0.55,0.50,0.40,0.30,0.70,0.35,0.45,0.40,0.25,0.15,0.10,0.35,0.00,0.45,0.10, 0.10,0.05,0.05,0.15,0.10,0.15,0.25,0.05,0.10,0.10,0.65,0.05,0.00,0.35,0.05,0.15],

  // ═══ SECTOR §03 — PHYS ═════════════════════════════════════════════════════
  /* 32  feigenbaum       */ [0.30,1.00,0.25,0.85,0.25,0.10,0.50,0.20,0.05,0.00,0.00,0.10,0.20,0.00,0.00,0.00, 0.10,0.10,0.00,0.05,0.30,0.15,0.10,0.00,0.05,0.10,0.05,0.00,0.10,0.40,0.00,0.10],
  /* 33  ising            */ [0.85,0.65,0.55,1.00,0.60,0.70,0.50,0.30,0.40,0.90,0.10,0.85,0.50,0.00,0.00,0.00, 0.05,0.05,0.00,0.05,0.25,0.20,0.50,0.00,0.05,0.05,0.05,0.10,0.35,0.50,0.00,0.15],
  /* 34  bosonic          */ [0.50,0.55,0.70,0.70,0.40,0.60,0.50,0.20,0.65,0.30,0.40,0.70,0.30,0.00,0.00,0.30, 0.10,0.15,0.00,0.05,0.35,0.25,0.20,0.00,0.05,0.05,0.05,0.05,0.70,0.30,0.00,0.10],
  /* 35  seraphine        */ [0.50,0.65,0.70,0.50,0.35,0.30,0.40,0.25,0.65,0.40,0.10,0.40,0.35,0.45,0.00,0.10, 0.15,0.20,0.05,0.20,0.25,0.20,0.15,0.10,0.10,0.25,0.15,0.10,0.30,0.25,0.15,0.30],
  /* 36  fusion           */ [0.80,0.75,0.75,0.60,0.30,0.20,0.45,0.30,0.90,0.30,0.00,0.90,0.20,0.00,0.00,0.10, 0.05,0.05,0.05,0.05,0.15,0.10,0.15,0.00,0.10,0.10,0.05,0.15,0.40,0.20,0.00,0.10],
  /* 37  pitch_black_steel*/ [0.40,0.75,0.45,0.70,0.45,0.55,0.30,0.30,0.55,0.35,0.05,0.90,0.15,0.00,0.00,0.80, 0.05,0.10,0.10,0.10,0.10,0.15,0.15,0.05,0.15,0.20,0.05,0.50,0.15,0.20,0.05,0.10],
  /* 38  magic_angle_1p1  */ [0.80,0.85,0.70,0.95,0.65,0.90,0.75,0.20,0.80,0.55,0.00,0.90,0.45,0.15,0.00,0.20, 0.10,0.15,0.00,0.10,0.30,0.25,0.20,0.00,0.05,0.15,0.05,0.30,0.80,0.45,0.00,0.15],
  /* 39  renormalization  */ [0.60,0.70,0.80,0.75,0.40,0.25,0.55,0.15,0.50,0.20,0.00,0.50,0.35,0.00,0.00,0.05, 0.15,0.20,0.00,0.05,0.60,0.40,0.25,0.00,0.05,0.05,0.05,0.05,0.65,0.35,0.00,0.15],
  /* 40  hawking_rad      */ [0.45,0.50,0.80,0.55,0.70,0.10,0.35,0.40,0.30,0.30,0.00,0.80,0.60,0.00,0.00,0.00, 0.25,0.40,0.05,0.10,0.30,0.25,0.20,0.05,0.10,0.10,0.10,0.00,0.85,0.20,0.05,0.10],
  /* 41  casimir          */ [0.30,0.40,0.65,0.40,0.35,0.15,0.45,0.10,0.45,0.25,0.00,0.40,0.30,0.00,0.00,0.00, 0.15,0.25,0.00,0.10,0.25,0.20,0.15,0.00,0.05,0.10,0.05,0.05,0.80,0.15,0.00,0.05],
  /* 42  bose_einstein    */ [0.55,0.50,0.70,0.65,0.30,0.80,0.60,0.10,0.50,0.20,0.00,0.60,0.35,0.00,0.00,0.00, 0.10,0.15,0.00,0.10,0.25,0.20,0.25,0.00,0.05,0.10,0.05,0.05,0.90,0.40,0.00,0.10],
  /* 43  turbulence       */ [0.90,0.95,0.70,0.50,0.65,0.20,0.30,0.35,0.85,0.50,0.00,0.55,0.25,0.00,0.00,0.05, 0.05,0.05,0.00,0.05,0.20,0.25,0.35,0.00,0.05,0.10,0.05,0.10,0.15,0.35,0.00,0.10],
  /* 44  penrose_tile     */ [0.35,0.40,0.65,0.30,0.25,0.50,0.45,0.05,0.80,0.10,0.00,0.05,0.30,0.00,0.00,0.00, 0.10,0.15,0.00,0.15,0.35,0.55,0.10,0.05,0.05,0.45,0.10,0.05,0.20,0.25,0.05,0.10],
  /* 45  dirac_sea        */ [0.40,0.55,0.80,0.50,0.45,0.20,0.50,0.15,0.40,0.30,0.00,0.45,0.40,0.00,0.00,0.00, 0.15,0.30,0.00,0.10,0.40,0.20,0.15,0.00,0.10,0.05,0.05,0.05,0.90,0.20,0.00,0.10],
  /* 46  percolation      */ [0.55,0.60,0.55,0.80,0.50,0.35,0.25,0.20,0.65,0.55,0.10,0.30,0.35,0.00,0.10,0.10, 0.05,0.05,0.00,0.05,0.15,0.40,0.40,0.00,0.05,0.05,0.05,0.10,0.10,0.50,0.00,0.15],
  /* 47  soliton          */ [0.65,0.70,0.60,0.45,0.20,0.30,0.60,0.25,0.55,0.15,0.00,0.25,0.25,0.00,0.00,0.00, 0.10,0.10,0.00,0.10,0.30,0.35,0.10,0.00,0.05,0.15,0.05,0.05,0.50,0.25,0.00,0.10],

  // ═══ SECTOR §04 — CRYPTO ═══════════════════════════════════════════════════
  /* 48  classified       */ [0.05,0.30,0.30,0.00,0.20,0.00,0.05,0.05,0.05,0.50,0.00,0.00,0.50,1.00,0.00,0.00, 0.10,0.05,0.10,0.05,0.25,0.05,0.10,0.05,0.10,0.05,0.10,0.00,0.10,0.05,0.05,0.10],
  /* 49  pqhash           */ [0.05,0.35,0.45,0.00,0.40,0.00,0.05,0.05,0.30,0.30,0.00,0.00,0.70,0.90,0.00,0.00, 0.05,0.05,0.05,0.05,0.40,0.15,0.15,0.00,0.05,0.00,0.05,0.00,0.20,0.10,0.00,0.10],
  /* 50  dh_ec            */ [0.10,0.50,0.50,0.00,0.25,0.00,0.05,0.05,0.30,0.20,0.00,0.00,0.55,0.90,0.00,0.00, 0.05,0.05,0.05,0.05,0.50,0.20,0.10,0.00,0.10,0.00,0.05,0.00,0.15,0.05,0.00,0.10],
  /* 51  polymorph_pqc    */ [0.30,0.80,0.90,0.40,0.85,0.15,0.10,0.10,0.05,0.90,0.85,0.10,0.90,0.95,0.00,0.40, 0.10,0.05,0.10,0.05,0.55,0.20,0.20,0.00,0.05,0.00,0.05,0.00,0.25,0.15,0.00,0.15],
  /* 52  lattice_sieve    */ [0.10,0.40,0.70,0.10,0.35,0.05,0.10,0.05,0.40,0.30,0.05,0.00,0.65,0.85,0.00,0.00, 0.05,0.05,0.05,0.00,0.65,0.30,0.20,0.00,0.05,0.00,0.05,0.00,0.20,0.10,0.00,0.10],
  /* 53  zkp_circuit      */ [0.15,0.45,0.60,0.05,0.30,0.05,0.15,0.05,0.15,0.25,0.15,0.00,0.75,0.85,0.00,0.10, 0.15,0.10,0.15,0.05,0.50,0.10,0.15,0.05,0.05,0.00,0.10,0.00,0.10,0.10,0.05,0.15],
  /* 54  mpc_garble       */ [0.10,0.35,0.55,0.05,0.40,0.20,0.15,0.05,0.10,0.30,0.35,0.00,0.70,0.80,0.00,0.15, 0.10,0.05,0.20,0.05,0.40,0.05,0.20,0.05,0.05,0.00,0.10,0.00,0.05,0.10,0.05,0.15],
  /* 55  homomorphic      */ [0.10,0.50,0.75,0.05,0.30,0.05,0.10,0.05,0.10,0.20,0.05,0.00,0.80,0.90,0.00,0.05, 0.10,0.10,0.10,0.05,0.65,0.10,0.15,0.00,0.05,0.00,0.05,0.00,0.15,0.10,0.00,0.10],
  /* 56  merkle_forest    */ [0.15,0.30,0.55,0.05,0.25,0.10,0.20,0.10,0.30,0.15,0.05,0.00,0.70,0.75,0.00,0.10, 0.05,0.05,0.05,0.00,0.30,0.35,0.10,0.00,0.05,0.00,0.05,0.00,0.05,0.15,0.00,0.10],
  /* 57  oblivious_xfer   */ [0.05,0.30,0.45,0.00,0.35,0.10,0.10,0.05,0.05,0.35,0.20,0.00,0.65,0.80,0.00,0.10, 0.10,0.05,0.15,0.05,0.35,0.05,0.20,0.05,0.05,0.00,0.10,0.00,0.05,0.05,0.05,0.10],
  /* 58  vrf_oracle       */ [0.15,0.35,0.40,0.05,0.35,0.05,0.15,0.05,0.10,0.60,0.10,0.00,0.60,0.80,0.00,0.15, 0.10,0.05,0.10,0.05,0.35,0.10,0.30,0.00,0.05,0.00,0.05,0.00,0.10,0.10,0.00,0.10],
  /* 59  threshold_sig    */ [0.10,0.35,0.50,0.10,0.30,0.30,0.15,0.05,0.10,0.25,0.25,0.00,0.60,0.85,0.00,0.10, 0.05,0.05,0.15,0.05,0.40,0.10,0.15,0.05,0.05,0.00,0.10,0.00,0.10,0.15,0.05,0.15],
  /* 60  side_channel     */ [0.30,0.45,0.40,0.20,0.50,0.05,0.10,0.15,0.15,0.50,0.15,0.30,0.55,0.75,0.00,0.05, 0.10,0.05,0.15,0.10,0.20,0.05,0.25,0.05,0.10,0.05,0.15,0.10,0.10,0.10,0.05,0.10],
  /* 61  code_crypto      */ [0.10,0.40,0.55,0.05,0.35,0.05,0.15,0.05,0.25,0.25,0.05,0.00,0.70,0.80,0.00,0.05, 0.05,0.05,0.05,0.00,0.55,0.15,0.20,0.00,0.10,0.00,0.05,0.00,0.10,0.10,0.00,0.10],
  /* 62  isogeny          */ [0.15,0.55,0.70,0.10,0.30,0.05,0.10,0.05,0.25,0.20,0.05,0.00,0.55,0.85,0.00,0.00, 0.05,0.05,0.00,0.05,0.70,0.40,0.10,0.00,0.05,0.05,0.05,0.00,0.15,0.10,0.00,0.10],
  /* 63  witness_encrypt  */ [0.10,0.45,0.60,0.05,0.35,0.05,0.10,0.05,0.10,0.25,0.10,0.00,0.70,0.85,0.00,0.05, 0.15,0.10,0.10,0.05,0.50,0.10,0.15,0.05,0.05,0.00,0.10,0.00,0.10,0.10,0.05,0.15],

  // ═══ SECTOR §05 — DRK ══════════════════════════════════════════════════════
  /* 64  pragmatic        */ [0.30,0.55,0.50,0.25,0.50,0.20,0.30,0.50,0.35,0.30,0.20,0.55,0.50,0.00,0.10,0.20, 0.35,0.25,0.30,0.20,0.10,0.10,0.20,0.20,0.30,0.10,0.20,0.05,0.00,0.20,0.20,0.15],
  /* 65  soma_kernel      */ [0.50,0.50,0.70,0.30,0.60,0.45,0.50,0.50,0.65,0.30,0.30,0.50,0.55,0.00,0.20,0.30, 0.25,0.20,0.15,0.20,0.15,0.25,0.25,0.15,0.25,0.20,0.20,0.10,0.05,0.35,0.15,0.30],
  /* 66  strangler        */ [0.50,0.50,0.50,0.40,0.35,0.30,0.30,0.70,0.35,0.25,0.20,0.30,0.25,0.00,0.60,0.15, 0.15,0.15,0.15,0.10,0.05,0.10,0.15,0.10,0.35,0.10,0.10,0.05,0.00,0.30,0.10,0.15],
  /* 67  surveillance     */ [0.25,0.30,0.55,0.20,0.60,0.20,0.20,0.50,0.65,0.20,0.50,0.10,0.70,0.30,0.10,0.30, 0.20,0.15,0.35,0.15,0.10,0.20,0.25,0.15,0.30,0.05,0.20,0.05,0.00,0.15,0.15,0.10],
  /* 68  necromantic      */ [0.70,0.65,0.50,0.40,0.40,0.30,0.20,0.65,0.35,0.50,0.20,0.45,0.30,0.00,0.50,0.10, 0.15,0.25,0.15,0.25,0.10,0.10,0.20,0.10,0.40,0.15,0.15,0.10,0.05,0.25,0.15,0.15],
  /* 69  zero_effort_flow */ [0.75,0.70,0.65,0.60,0.50,0.70,0.40,0.45,0.40,0.40,0.20,0.20,0.55,0.00,0.60,0.30, 0.20,0.20,0.15,0.35,0.10,0.15,0.15,0.10,0.15,0.25,0.25,0.05,0.05,0.35,0.10,0.20],
  /* 70  thanatos         */ [0.40,0.45,0.45,0.35,0.70,0.15,0.15,0.55,0.20,0.35,0.25,0.50,0.35,0.00,0.40,0.10, 0.20,0.35,0.20,0.35,0.05,0.10,0.15,0.10,0.30,0.15,0.25,0.10,0.00,0.25,0.15,0.10],
  /* 71  basilisk         */ [0.35,0.50,0.60,0.30,0.55,0.15,0.10,0.40,0.15,0.40,0.60,0.15,0.55,0.10,0.05,0.20, 0.30,0.25,0.40,0.10,0.20,0.10,0.25,0.10,0.15,0.05,0.25,0.00,0.00,0.20,0.15,0.15],
  /* 72  moloch           */ [0.45,0.55,0.50,0.40,0.60,0.30,0.15,0.40,0.25,0.35,0.80,0.25,0.40,0.00,0.10,0.55, 0.20,0.15,0.50,0.10,0.10,0.10,0.20,0.10,0.30,0.05,0.15,0.05,0.00,0.35,0.10,0.15],
  /* 73  accelerate       */ [0.70,0.75,0.55,0.50,0.55,0.25,0.10,0.60,0.30,0.30,0.25,0.40,0.40,0.00,0.15,0.40, 0.15,0.20,0.15,0.15,0.10,0.10,0.15,0.15,0.30,0.10,0.15,0.05,0.00,0.40,0.15,0.20],
  /* 74  dark_forest      */ [0.40,0.50,0.55,0.35,0.65,0.10,0.20,0.45,0.40,0.45,0.70,0.20,0.50,0.15,0.10,0.15, 0.15,0.20,0.25,0.10,0.10,0.15,0.30,0.10,0.20,0.05,0.15,0.00,0.00,0.20,0.10,0.10],
  /* 75  dead_internet    */ [0.30,0.45,0.50,0.25,0.75,0.15,0.05,0.55,0.25,0.40,0.30,0.10,0.65,0.10,0.05,0.25, 0.20,0.15,0.25,0.15,0.05,0.10,0.20,0.25,0.25,0.10,0.20,0.00,0.00,0.25,0.30,0.15],
  /* 76  simulacra        */ [0.25,0.40,0.55,0.20,0.60,0.20,0.10,0.50,0.30,0.30,0.25,0.10,0.50,0.05,0.05,0.30, 0.30,0.35,0.20,0.30,0.05,0.10,0.15,0.25,0.35,0.25,0.20,0.00,0.00,0.20,0.40,0.15],
  /* 77  panspectron      */ [0.35,0.40,0.60,0.25,0.55,0.15,0.10,0.45,0.55,0.30,0.40,0.10,0.70,0.25,0.10,0.20, 0.15,0.10,0.35,0.15,0.10,0.20,0.25,0.10,0.25,0.05,0.15,0.05,0.00,0.15,0.10,0.10],
  /* 78  hyperstition     */ [0.50,0.60,0.55,0.35,0.45,0.25,0.10,0.65,0.25,0.35,0.30,0.15,0.40,0.05,0.10,0.25, 0.20,0.30,0.15,0.25,0.10,0.10,0.15,0.30,0.40,0.15,0.20,0.00,0.00,0.30,0.35,0.20],
  /* 79  pharmakon        */ [0.30,0.50,0.45,0.30,0.55,0.20,0.20,0.40,0.20,0.30,0.25,0.25,0.35,0.05,0.30,0.15, 0.25,0.30,0.35,0.30,0.05,0.10,0.15,0.15,0.35,0.20,0.15,0.25,0.00,0.20,0.20,0.15],

  // ═══ SECTOR §06 — PHIL ═════════════════════════════════════════════════════
  /* 80  episteme         */ [0.15,0.25,0.60,0.20,0.45,0.15,0.30,0.35,0.10,0.15,0.20,0.05,0.65,0.00,0.05,0.10, 0.95,0.60,0.30,0.45,0.20,0.10,0.15,0.50,0.40,0.15,0.55,0.00,0.05,0.25,0.40,0.20],
  /* 81  aporia           */ [0.10,0.35,0.50,0.15,0.50,0.10,0.10,0.30,0.05,0.15,0.15,0.05,0.40,0.00,0.05,0.05, 0.60,0.70,0.25,0.40,0.15,0.10,0.10,0.55,0.25,0.15,0.30,0.00,0.00,0.20,0.45,0.15],
  /* 82  categorical_imp  */ [0.05,0.15,0.40,0.10,0.20,0.10,0.50,0.20,0.05,0.05,0.30,0.05,0.30,0.00,0.05,0.15, 0.50,0.40,0.95,0.25,0.25,0.05,0.10,0.30,0.30,0.10,0.20,0.00,0.00,0.10,0.20,0.15],
  /* 83  dialectic        */ [0.30,0.45,0.55,0.35,0.40,0.25,0.25,0.50,0.15,0.10,0.20,0.15,0.35,0.00,0.05,0.15, 0.55,0.75,0.30,0.30,0.15,0.10,0.10,0.35,0.50,0.10,0.25,0.00,0.00,0.35,0.25,0.20],
  /* 84  phenomenal       */ [0.15,0.25,0.55,0.15,0.35,0.15,0.20,0.30,0.15,0.10,0.10,0.05,0.35,0.00,0.10,0.05, 0.55,0.50,0.15,0.95,0.10,0.10,0.10,0.30,0.20,0.35,0.60,0.00,0.05,0.20,0.30,0.15],
  /* 85  dasein           */ [0.20,0.30,0.60,0.20,0.40,0.15,0.15,0.55,0.15,0.10,0.15,0.10,0.30,0.00,0.10,0.10, 0.50,0.85,0.25,0.80,0.05,0.05,0.10,0.30,0.35,0.20,0.40,0.00,0.00,0.25,0.25,0.15],
  /* 86  rhizome          */ [0.45,0.55,0.70,0.30,0.45,0.35,0.15,0.30,0.50,0.25,0.15,0.10,0.40,0.00,0.20,0.10, 0.35,0.55,0.15,0.30,0.10,0.45,0.10,0.25,0.25,0.15,0.20,0.00,0.00,0.50,0.25,0.25],
  /* 87  wittgenstein     */ [0.10,0.30,0.50,0.10,0.30,0.10,0.25,0.25,0.05,0.10,0.20,0.05,0.45,0.00,0.05,0.10, 0.65,0.45,0.20,0.35,0.20,0.05,0.10,0.85,0.20,0.10,0.35,0.00,0.00,0.15,0.50,0.15],
  /* 88  qualia_bind      */ [0.15,0.30,0.55,0.20,0.40,0.15,0.15,0.20,0.10,0.10,0.10,0.05,0.45,0.00,0.15,0.05, 0.60,0.55,0.15,0.90,0.10,0.05,0.10,0.25,0.15,0.30,0.75,0.10,0.10,0.20,0.25,0.15],
  /* 89  modal_logic      */ [0.10,0.25,0.70,0.15,0.25,0.10,0.35,0.15,0.10,0.15,0.25,0.05,0.55,0.00,0.00,0.10, 0.70,0.65,0.20,0.20,0.50,0.15,0.15,0.35,0.15,0.05,0.20,0.00,0.10,0.15,0.25,0.15],
  /* 90  process_phil     */ [0.40,0.40,0.60,0.30,0.35,0.25,0.30,0.55,0.25,0.15,0.10,0.20,0.30,0.00,0.15,0.10, 0.45,0.70,0.15,0.50,0.15,0.15,0.10,0.20,0.25,0.20,0.25,0.05,0.15,0.40,0.15,0.20],
  /* 91  pragmatism       */ [0.20,0.30,0.45,0.15,0.35,0.20,0.25,0.35,0.15,0.15,0.25,0.10,0.40,0.00,0.10,0.20, 0.60,0.35,0.35,0.30,0.10,0.05,0.15,0.30,0.30,0.10,0.25,0.05,0.00,0.20,0.20,0.20],
  /* 92  mereology        */ [0.10,0.20,0.65,0.15,0.25,0.10,0.40,0.10,0.20,0.05,0.10,0.05,0.40,0.00,0.05,0.05, 0.55,0.70,0.10,0.25,0.40,0.30,0.05,0.20,0.10,0.05,0.15,0.00,0.05,0.20,0.15,0.15],
  /* 93  virtue_ethics    */ [0.10,0.20,0.35,0.10,0.25,0.20,0.30,0.30,0.05,0.10,0.30,0.05,0.25,0.00,0.10,0.15, 0.45,0.30,0.90,0.30,0.05,0.05,0.10,0.25,0.45,0.15,0.20,0.00,0.00,0.10,0.15,0.10],
  /* 94  absurdist        */ [0.15,0.30,0.40,0.15,0.55,0.10,0.10,0.35,0.05,0.20,0.15,0.10,0.25,0.00,0.10,0.10, 0.40,0.45,0.35,0.55,0.05,0.05,0.10,0.30,0.25,0.25,0.25,0.00,0.00,0.15,0.25,0.10],
  /* 95  ubuntu           */ [0.15,0.20,0.35,0.10,0.25,0.45,0.30,0.30,0.15,0.10,0.30,0.05,0.25,0.00,0.15,0.15, 0.40,0.30,0.85,0.40,0.05,0.10,0.10,0.20,0.35,0.10,0.25,0.00,0.00,0.25,0.15,0.15],

  // ═══ SECTOR §07 — MATH ═════════════════════════════════════════════════════
  /* 96  grothendieck     */ [0.20,0.35,0.90,0.25,0.20,0.15,0.40,0.10,0.30,0.05,0.05,0.05,0.50,0.00,0.00,0.05, 0.30,0.25,0.00,0.05,0.95,0.70,0.15,0.10,0.10,0.15,0.10,0.00,0.10,0.20,0.10,0.15],
  /* 97  riemann_zeta     */ [0.15,0.40,0.75,0.30,0.30,0.10,0.35,0.10,0.25,0.15,0.05,0.05,0.55,0.10,0.00,0.05, 0.15,0.15,0.00,0.05,0.80,0.30,0.30,0.05,0.15,0.10,0.10,0.00,0.10,0.15,0.05,0.10],
  /* 98  galois           */ [0.10,0.35,0.65,0.20,0.25,0.20,0.50,0.10,0.20,0.10,0.10,0.05,0.40,0.15,0.00,0.05, 0.15,0.15,0.00,0.05,0.90,0.25,0.10,0.05,0.15,0.05,0.05,0.05,0.10,0.15,0.05,0.10],
  /* 99  godel            */ [0.10,0.30,0.70,0.20,0.35,0.05,0.25,0.10,0.05,0.10,0.10,0.05,0.70,0.00,0.00,0.05, 0.55,0.35,0.00,0.10,0.65,0.10,0.10,0.35,0.15,0.05,0.25,0.00,0.00,0.15,0.15,0.15],
  /*100  mandelbrot       */ [0.55,0.80,0.65,0.50,0.30,0.25,0.30,0.10,0.70,0.10,0.00,0.05,0.35,0.00,0.00,0.00, 0.10,0.10,0.00,0.15,0.50,0.45,0.10,0.00,0.05,0.45,0.10,0.00,0.05,0.35,0.05,0.10],
  /*101  fourier          */ [0.35,0.30,0.60,0.20,0.20,0.30,0.40,0.30,0.50,0.10,0.05,0.15,0.50,0.00,0.00,0.05, 0.10,0.10,0.00,0.10,0.60,0.20,0.35,0.05,0.10,0.15,0.10,0.10,0.15,0.15,0.05,0.15],
  /*102  bayesian         */ [0.20,0.25,0.55,0.15,0.45,0.10,0.30,0.20,0.10,0.70,0.20,0.10,0.65,0.00,0.10,0.15, 0.40,0.15,0.10,0.10,0.45,0.10,0.90,0.10,0.10,0.05,0.30,0.05,0.05,0.15,0.10,0.15],
  /*103  poincare         */ [0.30,0.40,0.80,0.30,0.20,0.10,0.35,0.10,0.40,0.05,0.00,0.05,0.35,0.00,0.00,0.00, 0.15,0.15,0.00,0.10,0.55,0.90,0.10,0.00,0.10,0.10,0.05,0.00,0.10,0.20,0.00,0.10],
  /*104  langlands        */ [0.15,0.35,0.85,0.20,0.20,0.20,0.40,0.10,0.25,0.10,0.05,0.05,0.45,0.05,0.00,0.05, 0.20,0.20,0.00,0.05,0.85,0.50,0.15,0.05,0.10,0.10,0.10,0.00,0.15,0.15,0.05,0.25],
  /*105  nash_equil       */ [0.25,0.45,0.50,0.25,0.35,0.20,0.30,0.15,0.15,0.40,0.90,0.10,0.40,0.00,0.10,0.50, 0.20,0.10,0.20,0.05,0.40,0.10,0.50,0.05,0.10,0.05,0.15,0.00,0.00,0.20,0.05,0.15],
  /*106  cantor           */ [0.10,0.30,0.90,0.25,0.30,0.05,0.25,0.05,0.10,0.05,0.00,0.05,0.55,0.00,0.00,0.00, 0.30,0.35,0.00,0.10,0.70,0.20,0.10,0.10,0.10,0.05,0.10,0.00,0.00,0.15,0.10,0.10],
  /*107  cellular_auto    */ [0.80,0.70,0.55,0.50,0.40,0.30,0.25,0.35,0.75,0.20,0.10,0.10,0.45,0.00,0.10,0.05, 0.10,0.10,0.00,0.05,0.35,0.20,0.15,0.00,0.05,0.15,0.10,0.00,0.05,0.55,0.00,0.15],
  /*108  chaos_attractor  */ [0.90,0.90,0.60,0.65,0.50,0.15,0.25,0.30,0.55,0.30,0.00,0.20,0.30,0.00,0.00,0.00, 0.10,0.10,0.00,0.10,0.30,0.30,0.20,0.00,0.05,0.15,0.05,0.00,0.05,0.45,0.00,0.10],
  /*109  knot_invariant   */ [0.10,0.25,0.75,0.15,0.15,0.10,0.40,0.05,0.40,0.05,0.00,0.05,0.35,0.00,0.00,0.00, 0.10,0.10,0.00,0.05,0.60,0.85,0.05,0.05,0.05,0.15,0.05,0.00,0.10,0.10,0.05,0.10],
  /*110  ergodic          */ [0.50,0.40,0.60,0.30,0.40,0.20,0.35,0.50,0.25,0.30,0.05,0.30,0.35,0.00,0.00,0.05, 0.10,0.10,0.00,0.05,0.45,0.20,0.45,0.00,0.10,0.05,0.05,0.00,0.05,0.20,0.00,0.10],
  /*111  p_vs_np          */ [0.15,0.35,0.70,0.25,0.40,0.05,0.20,0.10,0.10,0.20,0.15,0.05,0.75,0.20,0.00,0.10, 0.25,0.15,0.00,0.05,0.55,0.10,0.15,0.10,0.05,0.00,0.15,0.00,0.05,0.15,0.05,0.15],

  // ═══ SECTOR §08 — CHEM ═════════════════════════════════════════════════════
  /*112  chirality        */ [0.20,0.35,0.55,0.25,0.20,0.15,0.40,0.10,0.50,0.10,0.05,0.30,0.25,0.00,0.30,0.05, 0.10,0.10,0.05,0.15,0.25,0.30,0.10,0.05,0.10,0.30,0.10,0.90,0.15,0.15,0.10,0.15],
  /*113  retrosynthesis   */ [0.15,0.30,0.50,0.15,0.20,0.10,0.25,0.15,0.35,0.10,0.15,0.25,0.35,0.00,0.10,0.10, 0.10,0.05,0.05,0.05,0.15,0.20,0.10,0.05,0.15,0.10,0.10,0.85,0.05,0.15,0.05,0.15],
  /*114  catalysis        */ [0.45,0.55,0.45,0.40,0.25,0.15,0.35,0.30,0.30,0.15,0.05,0.60,0.20,0.00,0.20,0.10, 0.05,0.05,0.05,0.05,0.10,0.10,0.15,0.05,0.10,0.10,0.05,0.85,0.10,0.25,0.05,0.10],
  /*115  polymer_fold     */ [0.35,0.50,0.60,0.30,0.30,0.20,0.30,0.20,0.55,0.15,0.05,0.35,0.25,0.00,0.35,0.05, 0.05,0.05,0.00,0.05,0.15,0.30,0.15,0.00,0.05,0.10,0.05,0.80,0.05,0.25,0.00,0.10],
  /*116  redox            */ [0.40,0.45,0.40,0.35,0.30,0.10,0.30,0.25,0.25,0.15,0.05,0.65,0.20,0.00,0.30,0.05, 0.05,0.05,0.05,0.05,0.10,0.10,0.15,0.00,0.10,0.05,0.05,0.85,0.10,0.15,0.00,0.10],
  /*117  supramolecular   */ [0.30,0.45,0.65,0.25,0.25,0.35,0.30,0.15,0.60,0.10,0.05,0.25,0.30,0.00,0.25,0.05, 0.05,0.10,0.00,0.10,0.20,0.35,0.10,0.05,0.05,0.25,0.05,0.85,0.05,0.30,0.05,0.15],
  /*118  photochem        */ [0.40,0.50,0.50,0.30,0.30,0.10,0.30,0.20,0.40,0.15,0.05,0.40,0.25,0.00,0.15,0.05, 0.05,0.05,0.00,0.10,0.15,0.10,0.15,0.00,0.10,0.15,0.05,0.80,0.35,0.15,0.05,0.10],
  /*119  maillard         */ [0.35,0.45,0.35,0.25,0.30,0.10,0.20,0.40,0.25,0.15,0.05,0.55,0.15,0.00,0.20,0.10, 0.05,0.05,0.05,0.15,0.05,0.05,0.15,0.05,0.25,0.45,0.15,0.75,0.00,0.15,0.10,0.10],
  /*120  terpene          */ [0.25,0.35,0.45,0.15,0.25,0.10,0.25,0.15,0.35,0.10,0.05,0.20,0.20,0.00,0.50,0.10, 0.05,0.05,0.00,0.15,0.10,0.15,0.10,0.05,0.15,0.55,0.15,0.80,0.00,0.15,0.15,0.15],
  /*121  volatility       */ [0.30,0.35,0.40,0.20,0.35,0.05,0.25,0.30,0.30,0.15,0.05,0.55,0.20,0.00,0.15,0.05, 0.05,0.05,0.00,0.10,0.10,0.10,0.20,0.05,0.10,0.30,0.10,0.80,0.05,0.10,0.05,0.10],
  /*122  crystal_lattice  */ [0.20,0.25,0.60,0.30,0.15,0.35,0.50,0.05,0.70,0.10,0.05,0.35,0.20,0.00,0.05,0.05, 0.05,0.10,0.00,0.05,0.30,0.40,0.10,0.00,0.05,0.25,0.05,0.80,0.20,0.20,0.00,0.10],
  /*123  coord_chem       */ [0.25,0.40,0.55,0.25,0.20,0.20,0.35,0.10,0.45,0.10,0.05,0.30,0.25,0.00,0.10,0.05, 0.05,0.05,0.00,0.05,0.25,0.20,0.10,0.00,0.05,0.15,0.05,0.85,0.20,0.15,0.00,0.10],
  /*124  electrospray     */ [0.20,0.25,0.45,0.15,0.30,0.05,0.20,0.10,0.25,0.20,0.05,0.25,0.50,0.00,0.15,0.05, 0.05,0.05,0.00,0.05,0.15,0.10,0.30,0.05,0.10,0.10,0.05,0.75,0.10,0.10,0.05,0.10],
  /*125  click_chem       */ [0.25,0.35,0.40,0.15,0.15,0.15,0.30,0.10,0.30,0.10,0.10,0.20,0.25,0.00,0.15,0.10, 0.05,0.05,0.00,0.05,0.15,0.10,0.10,0.05,0.10,0.15,0.05,0.85,0.05,0.15,0.05,0.15],
  /*126  aroma_receptor   */ [0.30,0.45,0.50,0.25,0.25,0.15,0.25,0.15,0.35,0.15,0.05,0.20,0.30,0.00,0.65,0.05, 0.10,0.05,0.05,0.25,0.10,0.15,0.15,0.10,0.10,0.45,0.40,0.70,0.05,0.20,0.15,0.20],
  /*127  phase_diagram    */ [0.25,0.30,0.50,0.45,0.30,0.10,0.45,0.15,0.35,0.10,0.05,0.70,0.25,0.00,0.05,0.05, 0.05,0.10,0.00,0.05,0.20,0.25,0.25,0.00,0.05,0.10,0.05,0.80,0.10,0.15,0.00,0.10],

  // ═══ SECTOR §09 — BIO ══════════════════════════════════════════════════════
  /*128  crispr           */ [0.35,0.40,0.55,0.30,0.25,0.10,0.30,0.20,0.35,0.15,0.10,0.15,0.60,0.00,0.85,0.15, 0.10,0.05,0.25,0.05,0.15,0.10,0.15,0.10,0.15,0.05,0.15,0.30,0.00,0.25,0.05,0.15],
  /*129  morphogen        */ [0.70,0.65,0.55,0.45,0.30,0.30,0.30,0.40,0.80,0.20,0.05,0.20,0.25,0.00,0.85,0.05, 0.05,0.10,0.00,0.10,0.15,0.25,0.15,0.00,0.10,0.25,0.10,0.25,0.00,0.50,0.05,0.10],
  /*130  microbiome       */ [0.50,0.45,0.55,0.30,0.50,0.45,0.35,0.40,0.45,0.30,0.20,0.25,0.35,0.00,0.85,0.10, 0.05,0.05,0.10,0.10,0.05,0.20,0.30,0.10,0.15,0.10,0.35,0.25,0.00,0.40,0.05,0.15],
  /*131  apoptosis        */ [0.40,0.45,0.40,0.45,0.40,0.15,0.25,0.35,0.25,0.20,0.10,0.30,0.25,0.00,0.80,0.05, 0.05,0.10,0.10,0.10,0.05,0.10,0.15,0.05,0.10,0.05,0.15,0.20,0.00,0.25,0.05,0.10],
  /*132  quorum           */ [0.45,0.40,0.40,0.35,0.30,0.70,0.25,0.25,0.40,0.25,0.35,0.10,0.35,0.00,0.80,0.10, 0.05,0.05,0.10,0.05,0.05,0.15,0.20,0.10,0.10,0.10,0.20,0.20,0.00,0.45,0.10,0.15],
  /*133  prion            */ [0.30,0.55,0.40,0.35,0.50,0.15,0.10,0.30,0.20,0.30,0.05,0.20,0.30,0.00,0.70,0.05, 0.05,0.10,0.10,0.05,0.05,0.10,0.15,0.05,0.10,0.05,0.10,0.40,0.00,0.25,0.05,0.10],
  /*134  endosymbiont     */ [0.40,0.45,0.50,0.30,0.35,0.40,0.40,0.60,0.35,0.15,0.20,0.20,0.30,0.00,0.85,0.10, 0.10,0.10,0.10,0.05,0.05,0.10,0.15,0.05,0.40,0.05,0.10,0.10,0.00,0.40,0.05,0.15],
  /*135  epigenetic       */ [0.35,0.40,0.50,0.30,0.40,0.15,0.25,0.55,0.25,0.20,0.05,0.20,0.45,0.00,0.85,0.05, 0.10,0.10,0.10,0.05,0.10,0.10,0.20,0.05,0.25,0.05,0.20,0.25,0.00,0.30,0.05,0.10],
  /*136  neurotransmit    */ [0.45,0.50,0.45,0.30,0.30,0.35,0.25,0.20,0.30,0.25,0.10,0.15,0.35,0.00,0.80,0.05, 0.05,0.05,0.05,0.15,0.05,0.10,0.15,0.05,0.10,0.10,0.70,0.40,0.00,0.20,0.05,0.10],
  /*137  circadian_bio    */ [0.55,0.45,0.45,0.40,0.30,0.75,0.40,0.80,0.30,0.15,0.10,0.20,0.30,0.00,0.85,0.10, 0.10,0.05,0.05,0.10,0.05,0.10,0.20,0.05,0.15,0.10,0.40,0.15,0.00,0.35,0.05,0.10],
  /*138  horizontal_xfer  */ [0.30,0.40,0.45,0.25,0.45,0.15,0.15,0.35,0.25,0.30,0.15,0.10,0.40,0.00,0.80,0.05, 0.05,0.05,0.05,0.05,0.05,0.10,0.20,0.05,0.20,0.05,0.10,0.15,0.00,0.30,0.05,0.10],
  /*139  extremophile     */ [0.40,0.50,0.45,0.40,0.35,0.10,0.35,0.25,0.30,0.20,0.05,0.65,0.25,0.00,0.80,0.05, 0.05,0.05,0.05,0.10,0.05,0.10,0.15,0.05,0.15,0.10,0.05,0.40,0.00,0.25,0.05,0.10],
  /*140  olfactory_bulb   */ [0.40,0.50,0.50,0.30,0.35,0.30,0.25,0.20,0.40,0.20,0.05,0.10,0.40,0.00,0.85,0.05, 0.10,0.05,0.05,0.30,0.05,0.15,0.15,0.10,0.10,0.40,0.75,0.30,0.00,0.25,0.15,0.15],
  /*141  vomeronasal      */ [0.30,0.40,0.40,0.25,0.30,0.15,0.20,0.25,0.30,0.15,0.10,0.10,0.30,0.00,0.80,0.05, 0.05,0.05,0.05,0.20,0.05,0.10,0.15,0.05,0.15,0.30,0.50,0.25,0.00,0.15,0.10,0.10],
  /*142  axon_guidance     */ [0.50,0.55,0.50,0.35,0.25,0.25,0.25,0.30,0.55,0.20,0.05,0.10,0.30,0.00,0.80,0.05, 0.05,0.05,0.05,0.10,0.05,0.15,0.15,0.05,0.10,0.10,0.55,0.20,0.00,0.25,0.05,0.10],
  /*143  telomere         */ [0.30,0.35,0.40,0.30,0.45,0.10,0.20,0.70,0.20,0.15,0.05,0.20,0.35,0.00,0.80,0.05, 0.10,0.10,0.10,0.05,0.10,0.10,0.20,0.05,0.20,0.05,0.15,0.20,0.00,0.20,0.05,0.10],

  // ═══ SECTOR §10 — HUM ══════════════════════════════════════════════════════
  /*144  longue_duree     */ [0.25,0.30,0.45,0.20,0.35,0.15,0.25,0.90,0.25,0.10,0.15,0.15,0.30,0.00,0.10,0.30, 0.30,0.20,0.20,0.15,0.05,0.10,0.25,0.30,0.90,0.15,0.15,0.00,0.00,0.25,0.15,0.15],
  /*145  oral_tradition   */ [0.15,0.20,0.30,0.10,0.30,0.30,0.25,0.75,0.10,0.10,0.15,0.05,0.40,0.00,0.10,0.10, 0.20,0.15,0.15,0.20,0.05,0.05,0.10,0.60,0.70,0.20,0.25,0.00,0.00,0.15,0.30,0.10],
  /*146  palimpsest       */ [0.15,0.25,0.40,0.15,0.40,0.10,0.15,0.70,0.20,0.10,0.10,0.05,0.35,0.00,0.05,0.05, 0.25,0.20,0.10,0.20,0.05,0.15,0.10,0.35,0.65,0.25,0.15,0.00,0.00,0.15,0.25,0.10],
  /*147  diaspora         */ [0.30,0.35,0.40,0.20,0.40,0.25,0.20,0.55,0.45,0.20,0.20,0.10,0.30,0.00,0.10,0.25, 0.15,0.10,0.25,0.15,0.05,0.15,0.20,0.35,0.60,0.10,0.15,0.00,0.00,0.25,0.15,0.15],
  /*148  archive_fever    */ [0.15,0.25,0.45,0.15,0.45,0.10,0.20,0.60,0.20,0.10,0.10,0.05,0.50,0.05,0.05,0.10, 0.30,0.25,0.15,0.20,0.05,0.10,0.15,0.30,0.65,0.10,0.20,0.00,0.00,0.15,0.20,0.10],
  /*149  cargo_cult       */ [0.20,0.30,0.35,0.15,0.40,0.25,0.15,0.40,0.20,0.15,0.20,0.05,0.30,0.00,0.10,0.15, 0.20,0.20,0.15,0.20,0.05,0.05,0.15,0.20,0.45,0.15,0.20,0.00,0.00,0.20,0.25,0.10],
  /*150  liminality       */ [0.20,0.30,0.40,0.25,0.40,0.20,0.15,0.45,0.15,0.15,0.10,0.05,0.25,0.00,0.10,0.05, 0.25,0.25,0.15,0.35,0.05,0.10,0.10,0.20,0.40,0.25,0.25,0.00,0.00,0.25,0.20,0.10],
  /*151  gift_economy     */ [0.20,0.25,0.35,0.15,0.30,0.35,0.30,0.40,0.15,0.10,0.45,0.10,0.25,0.00,0.10,0.50, 0.15,0.15,0.35,0.10,0.05,0.10,0.15,0.15,0.50,0.10,0.15,0.00,0.00,0.20,0.10,0.15],
  /*152  orientalism      */ [0.10,0.20,0.35,0.10,0.35,0.10,0.10,0.45,0.20,0.10,0.25,0.05,0.30,0.00,0.05,0.15, 0.35,0.20,0.40,0.15,0.05,0.05,0.10,0.35,0.55,0.10,0.15,0.00,0.00,0.10,0.20,0.10],
  /*153  mytheme          */ [0.15,0.25,0.40,0.15,0.30,0.20,0.20,0.45,0.15,0.10,0.15,0.05,0.35,0.00,0.10,0.10, 0.20,0.25,0.15,0.25,0.10,0.10,0.15,0.50,0.55,0.20,0.20,0.00,0.00,0.20,0.35,0.15],
  /*154  thick_desc       */ [0.15,0.20,0.45,0.10,0.35,0.15,0.15,0.40,0.25,0.10,0.15,0.05,0.35,0.00,0.10,0.10, 0.30,0.20,0.20,0.30,0.05,0.05,0.15,0.45,0.50,0.20,0.25,0.00,0.00,0.15,0.30,0.15],
  /*155  collective_mem   */ [0.20,0.25,0.40,0.15,0.40,0.30,0.20,0.60,0.20,0.15,0.15,0.05,0.35,0.00,0.10,0.10, 0.20,0.15,0.15,0.25,0.05,0.10,0.20,0.25,0.70,0.10,0.35,0.00,0.00,0.20,0.15,0.10],
  /*156  subaltern        */ [0.10,0.20,0.35,0.15,0.40,0.10,0.10,0.40,0.15,0.10,0.25,0.05,0.30,0.00,0.05,0.20, 0.30,0.15,0.45,0.15,0.05,0.05,0.10,0.35,0.55,0.10,0.15,0.00,0.00,0.10,0.20,0.10],
  /*157  perfume_hist     */ [0.15,0.20,0.35,0.10,0.25,0.10,0.15,0.60,0.20,0.10,0.15,0.15,0.25,0.00,0.10,0.25, 0.15,0.10,0.10,0.20,0.05,0.05,0.15,0.20,0.75,0.55,0.15,0.35,0.00,0.10,0.15,0.15],
  /*158  synesthesia_cul  */ [0.20,0.30,0.45,0.15,0.30,0.25,0.15,0.30,0.25,0.15,0.10,0.05,0.30,0.00,0.10,0.05, 0.20,0.15,0.10,0.40,0.05,0.10,0.15,0.35,0.35,0.55,0.40,0.10,0.00,0.20,0.30,0.15],
  /*159  potlatch         */ [0.20,0.30,0.35,0.15,0.45,0.20,0.15,0.40,0.15,0.15,0.35,0.15,0.25,0.00,0.05,0.45, 0.15,0.15,0.30,0.15,0.05,0.05,0.15,0.20,0.55,0.15,0.10,0.00,0.00,0.15,0.15,0.10],

  // ═══ SECTOR §11 — LING ═════════════════════════════════════════════════════
  /*160  saussure         */ [0.10,0.20,0.45,0.10,0.25,0.10,0.25,0.20,0.10,0.10,0.10,0.05,0.40,0.00,0.05,0.05, 0.35,0.20,0.05,0.15,0.15,0.10,0.10,0.85,0.20,0.10,0.25,0.00,0.00,0.15,0.80,0.10],
  /*161  chomsky_tree     */ [0.15,0.25,0.55,0.10,0.20,0.10,0.30,0.15,0.10,0.10,0.05,0.05,0.45,0.00,0.10,0.05, 0.25,0.15,0.05,0.10,0.30,0.20,0.10,0.90,0.10,0.05,0.30,0.00,0.00,0.15,0.40,0.10],
  /*162  sapir_whorf      */ [0.10,0.25,0.45,0.10,0.30,0.10,0.15,0.25,0.10,0.10,0.10,0.05,0.30,0.00,0.10,0.05, 0.30,0.15,0.10,0.25,0.05,0.05,0.15,0.85,0.25,0.15,0.40,0.00,0.00,0.15,0.45,0.10],
  /*163  pragmatics       */ [0.10,0.20,0.35,0.05,0.20,0.15,0.15,0.15,0.10,0.10,0.20,0.05,0.30,0.00,0.05,0.10, 0.25,0.10,0.15,0.15,0.05,0.05,0.10,0.80,0.15,0.10,0.25,0.00,0.00,0.10,0.50,0.10],
  /*164  phonaestheme     */ [0.10,0.25,0.35,0.10,0.25,0.15,0.10,0.20,0.15,0.15,0.05,0.05,0.25,0.00,0.10,0.05, 0.15,0.10,0.05,0.25,0.10,0.05,0.15,0.75,0.15,0.35,0.30,0.00,0.00,0.10,0.45,0.10],
  /*165  prototype        */ [0.10,0.20,0.40,0.10,0.25,0.10,0.15,0.10,0.10,0.10,0.10,0.05,0.35,0.00,0.10,0.05, 0.25,0.15,0.05,0.15,0.10,0.10,0.20,0.75,0.10,0.10,0.35,0.00,0.00,0.15,0.35,0.10],
  /*166  metaphor_engine  */ [0.15,0.30,0.50,0.15,0.30,0.15,0.10,0.20,0.15,0.10,0.10,0.05,0.35,0.00,0.10,0.05, 0.25,0.20,0.10,0.25,0.10,0.10,0.10,0.80,0.15,0.25,0.35,0.00,0.00,0.20,0.50,0.25],
  /*167  pidgin           */ [0.20,0.30,0.35,0.15,0.40,0.30,0.10,0.35,0.15,0.20,0.15,0.05,0.25,0.00,0.10,0.10, 0.10,0.10,0.10,0.10,0.05,0.05,0.15,0.75,0.30,0.10,0.15,0.00,0.00,0.25,0.25,0.10],
  /*168  glossopoeia      */ [0.15,0.30,0.45,0.10,0.25,0.10,0.20,0.15,0.10,0.10,0.10,0.05,0.35,0.00,0.05,0.05, 0.15,0.10,0.05,0.10,0.20,0.10,0.10,0.85,0.10,0.15,0.20,0.00,0.00,0.15,0.30,0.15],
  /*169  etymology        */ [0.10,0.15,0.35,0.10,0.25,0.05,0.15,0.65,0.10,0.10,0.05,0.05,0.30,0.00,0.05,0.05, 0.15,0.10,0.05,0.10,0.05,0.05,0.15,0.80,0.55,0.10,0.15,0.00,0.00,0.10,0.25,0.05],
  /*170  peirce_sign      */ [0.10,0.20,0.50,0.10,0.25,0.10,0.20,0.15,0.10,0.10,0.10,0.05,0.40,0.00,0.05,0.05, 0.40,0.25,0.05,0.20,0.15,0.10,0.10,0.70,0.15,0.15,0.25,0.00,0.00,0.15,0.85,0.15],
  /*171  olfactory_lexicon*/ [0.10,0.20,0.35,0.10,0.25,0.10,0.10,0.20,0.15,0.10,0.05,0.05,0.25,0.00,0.20,0.05, 0.15,0.10,0.05,0.25,0.05,0.05,0.15,0.80,0.20,0.50,0.30,0.20,0.00,0.10,0.35,0.15],
  /*172  deixis           */ [0.10,0.15,0.30,0.05,0.20,0.10,0.10,0.25,0.20,0.10,0.10,0.05,0.25,0.00,0.05,0.05, 0.15,0.10,0.05,0.15,0.05,0.05,0.10,0.75,0.15,0.05,0.15,0.00,0.00,0.10,0.30,0.05],
  /*173  prosody          */ [0.15,0.25,0.30,0.10,0.20,0.20,0.10,0.25,0.15,0.10,0.05,0.05,0.20,0.00,0.10,0.05, 0.10,0.05,0.05,0.20,0.05,0.05,0.10,0.70,0.10,0.30,0.25,0.00,0.00,0.10,0.25,0.05],
  /*174  corpus           */ [0.10,0.15,0.40,0.10,0.30,0.05,0.15,0.15,0.10,0.20,0.05,0.05,0.45,0.00,0.05,0.05, 0.15,0.05,0.05,0.05,0.15,0.05,0.50,0.80,0.15,0.05,0.15,0.00,0.00,0.10,0.20,0.10],
  /*175  translation      */ [0.10,0.25,0.45,0.10,0.35,0.10,0.10,0.20,0.10,0.15,0.10,0.05,0.40,0.00,0.05,0.10, 0.30,0.20,0.10,0.15,0.10,0.05,0.10,0.85,0.15,0.10,0.25,0.00,0.00,0.15,0.40,0.20],

  // ═══ SECTOR §12 — COGN ═════════════════════════════════════════════════════
  /*176  predictive_brain */ [0.50,0.55,0.60,0.35,0.40,0.25,0.30,0.30,0.25,0.25,0.10,0.15,0.55,0.00,0.40,0.05, 0.30,0.15,0.05,0.35,0.15,0.10,0.40,0.10,0.10,0.10,0.85,0.05,0.00,0.30,0.10,0.15],
  /*177  binding_problem  */ [0.35,0.45,0.60,0.30,0.35,0.40,0.20,0.15,0.30,0.20,0.05,0.10,0.45,0.00,0.30,0.05, 0.25,0.20,0.05,0.40,0.10,0.15,0.15,0.10,0.10,0.15,0.80,0.05,0.10,0.30,0.10,0.15],
  /*178  mirror_neuron    */ [0.30,0.35,0.40,0.20,0.25,0.35,0.20,0.20,0.25,0.15,0.15,0.05,0.30,0.00,0.45,0.05, 0.15,0.10,0.15,0.30,0.05,0.05,0.15,0.15,0.10,0.10,0.75,0.05,0.00,0.20,0.15,0.10],
  /*179  attention_schema */ [0.35,0.40,0.55,0.25,0.35,0.20,0.20,0.20,0.20,0.15,0.10,0.05,0.45,0.00,0.30,0.05, 0.25,0.20,0.05,0.45,0.10,0.10,0.20,0.10,0.10,0.10,0.85,0.05,0.00,0.25,0.10,0.15],
  /*180  embodied_cog     */ [0.30,0.35,0.45,0.20,0.30,0.20,0.25,0.25,0.35,0.15,0.10,0.10,0.30,0.00,0.45,0.05, 0.20,0.20,0.10,0.50,0.05,0.10,0.15,0.15,0.10,0.20,0.80,0.05,0.00,0.20,0.15,0.10],
  /*181  enactive         */ [0.35,0.40,0.50,0.25,0.30,0.25,0.20,0.25,0.35,0.15,0.10,0.10,0.30,0.00,0.40,0.05, 0.25,0.25,0.10,0.55,0.05,0.10,0.15,0.10,0.10,0.15,0.80,0.05,0.00,0.25,0.15,0.15],
  /*182  global_workspace */ [0.40,0.35,0.55,0.25,0.35,0.30,0.25,0.20,0.25,0.15,0.10,0.10,0.50,0.00,0.35,0.05, 0.20,0.15,0.05,0.40,0.10,0.10,0.20,0.10,0.10,0.10,0.85,0.05,0.00,0.30,0.10,0.15],
  /*183  default_mode     */ [0.35,0.30,0.45,0.15,0.40,0.15,0.15,0.30,0.20,0.20,0.05,0.10,0.35,0.00,0.35,0.05, 0.15,0.15,0.05,0.35,0.05,0.10,0.15,0.10,0.10,0.10,0.75,0.05,0.00,0.20,0.05,0.10],
  /*184  hippocampal      */ [0.40,0.40,0.50,0.25,0.30,0.25,0.25,0.40,0.55,0.15,0.10,0.05,0.40,0.00,0.50,0.05, 0.15,0.10,0.05,0.20,0.05,0.20,0.15,0.05,0.15,0.10,0.80,0.05,0.00,0.20,0.05,0.10],
  /*185  piriform         */ [0.35,0.40,0.45,0.25,0.30,0.20,0.20,0.15,0.35,0.15,0.05,0.10,0.35,0.00,0.55,0.05, 0.10,0.05,0.05,0.30,0.05,0.10,0.15,0.10,0.10,0.40,0.80,0.25,0.00,0.20,0.15,0.15],
  /*186  proustian        */ [0.20,0.25,0.40,0.15,0.35,0.15,0.15,0.55,0.15,0.10,0.05,0.05,0.30,0.00,0.25,0.05, 0.20,0.15,0.05,0.50,0.05,0.05,0.10,0.20,0.30,0.35,0.75,0.10,0.00,0.15,0.20,0.10],
  /*187  weber_fechner    */ [0.20,0.35,0.40,0.15,0.20,0.10,0.25,0.10,0.10,0.15,0.05,0.10,0.35,0.00,0.25,0.05, 0.15,0.10,0.05,0.30,0.20,0.05,0.35,0.05,0.15,0.15,0.70,0.05,0.00,0.10,0.05,0.10],
  /*188  mcgurk           */ [0.20,0.30,0.35,0.15,0.30,0.20,0.10,0.10,0.20,0.15,0.05,0.05,0.30,0.00,0.25,0.05, 0.15,0.10,0.05,0.35,0.05,0.05,0.15,0.15,0.05,0.20,0.75,0.05,0.00,0.15,0.15,0.10],
  /*189  affordance       */ [0.25,0.30,0.40,0.15,0.20,0.15,0.20,0.15,0.35,0.10,0.10,0.05,0.25,0.00,0.25,0.05, 0.20,0.15,0.10,0.40,0.05,0.10,0.10,0.10,0.10,0.15,0.70,0.05,0.00,0.15,0.10,0.10],
  /*190  chunking         */ [0.15,0.20,0.35,0.10,0.25,0.10,0.20,0.15,0.10,0.10,0.10,0.05,0.45,0.00,0.15,0.05, 0.15,0.05,0.05,0.15,0.10,0.05,0.20,0.15,0.05,0.05,0.70,0.00,0.00,0.15,0.10,0.10],
  /*191  blindsight       */ [0.25,0.35,0.40,0.20,0.30,0.10,0.10,0.15,0.25,0.15,0.05,0.05,0.30,0.00,0.35,0.05, 0.20,0.15,0.05,0.40,0.05,0.05,0.10,0.05,0.10,0.10,0.75,0.05,0.00,0.15,0.05,0.10],

  // ═══ SECTOR §13 — AESTH ════════════════════════════════════════════════════
  /*192  sublime          */ [0.15,0.30,0.50,0.20,0.35,0.10,0.15,0.25,0.20,0.10,0.10,0.10,0.25,0.00,0.05,0.05, 0.35,0.30,0.15,0.55,0.05,0.10,0.05,0.25,0.25,0.90,0.30,0.00,0.00,0.20,0.30,0.15],
  /*193  wabi_sabi        */ [0.15,0.25,0.35,0.10,0.40,0.10,0.15,0.55,0.15,0.10,0.05,0.05,0.20,0.00,0.10,0.05, 0.20,0.25,0.10,0.40,0.05,0.05,0.05,0.20,0.40,0.85,0.20,0.05,0.00,0.15,0.20,0.10],
  /*194  synesthetic      */ [0.20,0.35,0.50,0.15,0.30,0.25,0.10,0.15,0.25,0.15,0.05,0.05,0.35,0.00,0.15,0.05, 0.15,0.15,0.05,0.55,0.05,0.10,0.10,0.20,0.10,0.80,0.55,0.10,0.00,0.20,0.35,0.15],
  /*195  golden_ratio     */ [0.10,0.25,0.55,0.15,0.10,0.20,0.35,0.10,0.45,0.05,0.05,0.05,0.25,0.00,0.10,0.05, 0.15,0.15,0.05,0.20,0.35,0.25,0.10,0.05,0.15,0.85,0.10,0.00,0.00,0.15,0.10,0.10],
  /*196  umami            */ [0.15,0.25,0.30,0.10,0.20,0.10,0.15,0.15,0.15,0.10,0.05,0.10,0.20,0.00,0.30,0.05, 0.10,0.10,0.05,0.35,0.05,0.05,0.10,0.15,0.15,0.75,0.35,0.35,0.00,0.10,0.15,0.10],
  /*197  negative_space   */ [0.10,0.20,0.45,0.10,0.25,0.10,0.15,0.20,0.35,0.05,0.05,0.05,0.20,0.00,0.05,0.05, 0.15,0.20,0.05,0.35,0.10,0.20,0.05,0.15,0.25,0.80,0.20,0.00,0.00,0.15,0.20,0.10],
  /*198  uncanny_valley   */ [0.20,0.35,0.40,0.25,0.35,0.10,0.10,0.15,0.15,0.15,0.10,0.05,0.30,0.00,0.15,0.05, 0.15,0.15,0.10,0.50,0.05,0.05,0.15,0.15,0.10,0.70,0.50,0.00,0.00,0.15,0.15,0.10],
  /*199  camp             */ [0.10,0.25,0.35,0.10,0.35,0.10,0.05,0.30,0.15,0.10,0.15,0.05,0.25,0.00,0.05,0.10, 0.15,0.15,0.10,0.25,0.05,0.05,0.05,0.30,0.30,0.75,0.20,0.00,0.00,0.10,0.30,0.10],
  /*200  terroir          */ [0.25,0.30,0.35,0.15,0.25,0.10,0.20,0.45,0.40,0.10,0.10,0.20,0.20,0.00,0.30,0.15, 0.10,0.10,0.05,0.25,0.05,0.10,0.10,0.15,0.40,0.70,0.15,0.35,0.00,0.15,0.10,0.10],
  /*201  patina           */ [0.15,0.20,0.30,0.10,0.30,0.05,0.15,0.65,0.20,0.10,0.05,0.10,0.15,0.00,0.05,0.05, 0.10,0.15,0.05,0.25,0.05,0.05,0.05,0.10,0.50,0.75,0.10,0.15,0.00,0.10,0.10,0.05],
  /*202  sillage_theory   */ [0.25,0.35,0.40,0.15,0.30,0.10,0.15,0.30,0.35,0.15,0.05,0.25,0.30,0.00,0.15,0.05, 0.10,0.10,0.05,0.25,0.10,0.15,0.20,0.10,0.15,0.80,0.25,0.40,0.00,0.15,0.15,0.15],
  /*203  drydown          */ [0.30,0.40,0.35,0.15,0.30,0.10,0.15,0.50,0.25,0.10,0.05,0.30,0.20,0.00,0.10,0.05, 0.05,0.05,0.05,0.20,0.10,0.10,0.15,0.10,0.15,0.80,0.15,0.55,0.00,0.15,0.10,0.10],
  /*204  accord_theory    */ [0.20,0.35,0.45,0.20,0.25,0.30,0.25,0.20,0.30,0.10,0.05,0.15,0.30,0.00,0.10,0.10, 0.10,0.10,0.05,0.25,0.15,0.15,0.15,0.15,0.15,0.85,0.20,0.45,0.00,0.20,0.15,0.25],
  /*205  headspace_tech   */ [0.20,0.30,0.40,0.15,0.25,0.10,0.20,0.15,0.30,0.15,0.05,0.20,0.35,0.00,0.15,0.05, 0.05,0.05,0.00,0.15,0.10,0.10,0.20,0.05,0.10,0.65,0.15,0.60,0.00,0.10,0.05,0.10],
  /*206  base_note        */ [0.20,0.30,0.35,0.10,0.20,0.05,0.20,0.40,0.25,0.10,0.05,0.25,0.20,0.00,0.10,0.05, 0.05,0.05,0.00,0.10,0.10,0.10,0.15,0.05,0.15,0.75,0.10,0.55,0.00,0.10,0.10,0.10],
  /*207  je_ne_sais_quoi  */ [0.15,0.30,0.45,0.15,0.40,0.10,0.10,0.25,0.15,0.20,0.05,0.05,0.30,0.00,0.10,0.05, 0.25,0.25,0.10,0.45,0.05,0.05,0.10,0.30,0.15,0.85,0.30,0.10,0.00,0.20,0.30,0.15],

  // ═══ SECTOR §14 — TOPO ═════════════════════════════════════════════════════
  /*208  mobius           */ [0.15,0.30,0.65,0.15,0.15,0.10,0.30,0.05,0.50,0.05,0.00,0.05,0.25,0.00,0.00,0.00, 0.10,0.15,0.00,0.10,0.30,0.90,0.05,0.05,0.05,0.20,0.05,0.00,0.05,0.15,0.05,0.10],
  /*209  klein_bottle     */ [0.10,0.25,0.75,0.10,0.15,0.05,0.25,0.05,0.45,0.05,0.00,0.05,0.25,0.00,0.00,0.00, 0.10,0.20,0.00,0.10,0.30,0.90,0.05,0.05,0.05,0.15,0.05,0.00,0.05,0.10,0.05,0.10],
  /*210  euler_char       */ [0.10,0.20,0.60,0.15,0.10,0.05,0.40,0.05,0.30,0.05,0.00,0.05,0.30,0.00,0.00,0.00, 0.10,0.10,0.00,0.05,0.45,0.85,0.10,0.05,0.10,0.05,0.05,0.00,0.05,0.10,0.05,0.10],
  /*211  homology         */ [0.10,0.25,0.75,0.15,0.15,0.10,0.35,0.05,0.35,0.05,0.00,0.05,0.35,0.00,0.00,0.00, 0.10,0.15,0.00,0.05,0.55,0.90,0.10,0.05,0.05,0.05,0.05,0.00,0.05,0.15,0.05,0.10],
  /*212  betti_number     */ [0.10,0.20,0.70,0.10,0.15,0.05,0.30,0.05,0.30,0.05,0.00,0.05,0.35,0.00,0.00,0.00, 0.10,0.10,0.00,0.05,0.50,0.90,0.15,0.05,0.05,0.05,0.05,0.00,0.05,0.10,0.05,0.10],
  /*213  fiber_bundle     */ [0.15,0.35,0.80,0.20,0.15,0.10,0.35,0.05,0.40,0.05,0.00,0.10,0.30,0.00,0.00,0.00, 0.10,0.15,0.00,0.10,0.50,0.85,0.05,0.05,0.05,0.10,0.05,0.00,0.20,0.15,0.05,0.10],
  /*214  simplex          */ [0.10,0.15,0.60,0.10,0.10,0.05,0.30,0.05,0.40,0.05,0.05,0.05,0.25,0.00,0.00,0.00, 0.05,0.05,0.00,0.05,0.35,0.80,0.10,0.00,0.05,0.05,0.05,0.00,0.05,0.10,0.00,0.10],
  /*215  persistent_hom   */ [0.20,0.30,0.70,0.20,0.25,0.10,0.25,0.10,0.40,0.15,0.05,0.05,0.45,0.00,0.10,0.05, 0.10,0.10,0.00,0.10,0.35,0.85,0.30,0.05,0.05,0.10,0.10,0.05,0.05,0.20,0.05,0.15],
  /*216  hyperbolic       */ [0.15,0.30,0.75,0.15,0.20,0.05,0.25,0.05,0.50,0.05,0.00,0.05,0.25,0.00,0.00,0.00, 0.10,0.15,0.00,0.10,0.35,0.85,0.05,0.05,0.05,0.15,0.05,0.00,0.10,0.10,0.05,0.10],
  /*217  graph_laplacian  */ [0.25,0.30,0.65,0.25,0.25,0.30,0.30,0.10,0.45,0.10,0.10,0.05,0.50,0.00,0.05,0.05, 0.05,0.05,0.00,0.05,0.45,0.70,0.25,0.05,0.05,0.05,0.10,0.00,0.10,0.25,0.05,0.15],
  /*218  voronoi          */ [0.20,0.25,0.55,0.15,0.15,0.15,0.25,0.05,0.75,0.10,0.10,0.05,0.25,0.00,0.10,0.05, 0.05,0.05,0.00,0.10,0.20,0.75,0.15,0.00,0.05,0.15,0.05,0.00,0.05,0.15,0.05,0.10],
  /*219  geodesic         */ [0.20,0.25,0.65,0.15,0.10,0.05,0.30,0.10,0.55,0.05,0.00,0.10,0.20,0.00,0.00,0.00, 0.10,0.10,0.00,0.10,0.25,0.85,0.05,0.00,0.05,0.15,0.05,0.00,0.10,0.10,0.00,0.10],
  /*220  winding_number   */ [0.10,0.25,0.55,0.10,0.10,0.05,0.30,0.05,0.35,0.05,0.00,0.05,0.25,0.00,0.00,0.00, 0.05,0.10,0.00,0.05,0.35,0.80,0.05,0.00,0.05,0.05,0.05,0.00,0.05,0.10,0.05,0.05],
  /*221  cobordism        */ [0.10,0.25,0.80,0.15,0.15,0.10,0.35,0.05,0.35,0.05,0.00,0.05,0.30,0.00,0.00,0.00, 0.10,0.15,0.00,0.05,0.50,0.90,0.05,0.05,0.05,0.05,0.05,0.00,0.10,0.15,0.05,0.10],
  /*222  morse_theory     */ [0.15,0.30,0.70,0.25,0.15,0.10,0.30,0.05,0.40,0.05,0.00,0.10,0.30,0.00,0.00,0.00, 0.10,0.10,0.00,0.05,0.45,0.85,0.10,0.00,0.05,0.05,0.05,0.00,0.10,0.15,0.00,0.10],
  /*223  tda_mapper       */ [0.25,0.30,0.65,0.20,0.25,0.15,0.20,0.10,0.50,0.15,0.05,0.05,0.50,0.00,0.10,0.05, 0.10,0.05,0.00,0.10,0.30,0.80,0.35,0.05,0.05,0.10,0.10,0.05,0.05,0.20,0.05,0.20],

  // ═══ SECTOR §15 — META ═════════════════════════════════════════════════════
  /*224  autopoiesis      */ [0.55,0.50,0.55,0.40,0.35,0.30,0.40,0.35,0.35,0.20,0.15,0.20,0.35,0.00,0.55,0.10, 0.25,0.30,0.10,0.20,0.10,0.15,0.15,0.10,0.15,0.10,0.20,0.10,0.00,0.80,0.10,0.25],
  /*225  stigmergy        */ [0.50,0.45,0.45,0.30,0.35,0.40,0.25,0.30,0.50,0.25,0.20,0.10,0.35,0.00,0.40,0.10, 0.10,0.10,0.10,0.10,0.05,0.15,0.15,0.05,0.15,0.05,0.20,0.05,0.00,0.70,0.10,0.20],
  /*226  soc_critical     */ [0.70,0.65,0.55,0.85,0.55,0.25,0.25,0.30,0.50,0.40,0.10,0.30,0.35,0.00,0.10,0.10, 0.10,0.10,0.00,0.10,0.15,0.20,0.30,0.00,0.10,0.10,0.10,0.05,0.10,0.85,0.05,0.20],
  /*227  downward_cause   */ [0.35,0.40,0.55,0.30,0.30,0.20,0.25,0.25,0.25,0.15,0.10,0.15,0.35,0.00,0.20,0.10, 0.30,0.40,0.10,0.20,0.10,0.10,0.15,0.10,0.15,0.10,0.20,0.05,0.05,0.75,0.10,0.20],
  /*228  dissipative      */ [0.65,0.55,0.55,0.50,0.50,0.20,0.30,0.35,0.40,0.25,0.05,0.60,0.30,0.00,0.15,0.10, 0.10,0.15,0.00,0.10,0.15,0.15,0.20,0.00,0.10,0.10,0.10,0.15,0.10,0.80,0.05,0.20],
  /*229  cybernetic       */ [0.50,0.45,0.55,0.35,0.40,0.35,0.30,0.30,0.30,0.20,0.15,0.15,0.50,0.00,0.15,0.15, 0.25,0.20,0.10,0.15,0.10,0.10,0.20,0.10,0.20,0.10,0.25,0.05,0.00,0.65,0.15,0.25],
  /*230  strange_loop     */ [0.40,0.55,0.70,0.30,0.35,0.20,0.15,0.25,0.20,0.15,0.10,0.10,0.55,0.00,0.10,0.05, 0.35,0.35,0.05,0.25,0.25,0.20,0.10,0.15,0.10,0.15,0.30,0.00,0.05,0.60,0.20,0.25],
  /*231  phase_trans      */ [0.55,0.50,0.55,0.80,0.45,0.30,0.35,0.25,0.35,0.30,0.05,0.50,0.30,0.00,0.10,0.05, 0.10,0.15,0.00,0.10,0.20,0.20,0.25,0.00,0.05,0.10,0.10,0.10,0.20,0.75,0.05,0.15],
  /*232  swarm            */ [0.60,0.50,0.45,0.35,0.35,0.65,0.25,0.30,0.50,0.30,0.20,0.10,0.30,0.00,0.45,0.10, 0.10,0.05,0.05,0.10,0.05,0.15,0.20,0.05,0.10,0.10,0.20,0.05,0.00,0.75,0.05,0.15],
  /*233  attractor_land   */ [0.65,0.60,0.60,0.50,0.40,0.20,0.25,0.30,0.40,0.20,0.05,0.20,0.30,0.00,0.30,0.05, 0.10,0.15,0.00,0.10,0.20,0.25,0.15,0.00,0.10,0.10,0.15,0.05,0.10,0.80,0.05,0.15],
  /*234  edge_chaos       */ [0.75,0.70,0.55,0.70,0.55,0.30,0.20,0.25,0.35,0.35,0.10,0.25,0.45,0.00,0.15,0.05, 0.10,0.10,0.00,0.10,0.15,0.15,0.20,0.00,0.05,0.10,0.15,0.05,0.10,0.85,0.05,0.20],
  /*235  scale_free       */ [0.45,0.40,0.55,0.35,0.40,0.25,0.20,0.20,0.40,0.30,0.15,0.10,0.45,0.00,0.15,0.15, 0.10,0.10,0.05,0.10,0.15,0.35,0.35,0.05,0.10,0.05,0.15,0.00,0.05,0.70,0.05,0.15],
  /*236  holarchy         */ [0.35,0.35,0.60,0.25,0.30,0.25,0.30,0.25,0.30,0.15,0.10,0.10,0.30,0.00,0.15,0.10, 0.20,0.25,0.10,0.15,0.15,0.20,0.10,0.10,0.15,0.10,0.15,0.00,0.00,0.70,0.10,0.20],
  /*237  teleology        */ [0.30,0.35,0.50,0.20,0.30,0.15,0.25,0.35,0.20,0.10,0.15,0.10,0.30,0.00,0.20,0.10, 0.35,0.40,0.15,0.20,0.05,0.10,0.10,0.10,0.20,0.10,0.15,0.05,0.00,0.65,0.10,0.20],
  /*238  bootstrap        */ [0.35,0.50,0.60,0.25,0.35,0.15,0.15,0.30,0.15,0.20,0.10,0.10,0.40,0.00,0.10,0.05, 0.25,0.30,0.05,0.15,0.15,0.15,0.15,0.10,0.15,0.10,0.15,0.00,0.05,0.60,0.15,0.20],
  /*239  omega_point      */ [0.40,0.45,0.65,0.35,0.30,0.30,0.25,0.50,0.25,0.15,0.10,0.15,0.35,0.00,0.20,0.10, 0.30,0.40,0.15,0.25,0.10,0.15,0.10,0.10,0.25,0.15,0.20,0.05,0.05,0.75,0.10,0.25],

  // ═══ SECTOR §16 — SYNTH ════════════════════════════════════════════════════
  /*240  analogy          */ [0.25,0.35,0.55,0.15,0.25,0.20,0.20,0.20,0.20,0.15,0.15,0.10,0.50,0.00,0.10,0.10, 0.30,0.20,0.10,0.20,0.20,0.15,0.15,0.25,0.15,0.15,0.35,0.05,0.05,0.35,0.25,0.80],
  /*241  bisociation      */ [0.30,0.45,0.50,0.20,0.35,0.15,0.10,0.15,0.20,0.20,0.10,0.10,0.40,0.00,0.10,0.10, 0.20,0.15,0.05,0.20,0.15,0.10,0.10,0.20,0.10,0.30,0.30,0.05,0.05,0.40,0.20,0.85],
  /*242  consilience      */ [0.25,0.30,0.60,0.20,0.25,0.20,0.30,0.25,0.20,0.10,0.10,0.15,0.45,0.00,0.15,0.15, 0.35,0.25,0.10,0.15,0.15,0.15,0.20,0.15,0.20,0.15,0.20,0.10,0.05,0.35,0.15,0.85],
  /*243  abduction        */ [0.20,0.35,0.50,0.15,0.35,0.10,0.20,0.15,0.10,0.25,0.15,0.10,0.50,0.00,0.10,0.10, 0.45,0.20,0.10,0.15,0.20,0.10,0.30,0.20,0.10,0.10,0.30,0.05,0.05,0.25,0.20,0.80],
  /*244  metaphor_bridge  */ [0.20,0.35,0.50,0.15,0.25,0.20,0.10,0.15,0.15,0.10,0.10,0.05,0.40,0.00,0.10,0.05, 0.25,0.20,0.10,0.25,0.15,0.10,0.10,0.40,0.10,0.25,0.30,0.05,0.00,0.30,0.35,0.85],
  /*245  transdiscipline  */ [0.25,0.30,0.55,0.15,0.30,0.25,0.20,0.20,0.20,0.10,0.15,0.10,0.40,0.00,0.15,0.15, 0.30,0.20,0.15,0.15,0.15,0.15,0.15,0.20,0.15,0.15,0.20,0.10,0.05,0.35,0.15,0.90],
  /*246  boundary_object  */ [0.15,0.25,0.45,0.10,0.25,0.25,0.20,0.20,0.15,0.10,0.20,0.05,0.35,0.00,0.10,0.15, 0.20,0.15,0.10,0.10,0.10,0.10,0.10,0.25,0.15,0.10,0.15,0.05,0.00,0.25,0.20,0.80],
  /*247  isomorphism      */ [0.15,0.30,0.65,0.15,0.15,0.20,0.35,0.10,0.25,0.05,0.10,0.05,0.45,0.00,0.05,0.05, 0.20,0.20,0.00,0.10,0.50,0.30,0.10,0.10,0.05,0.10,0.15,0.00,0.10,0.25,0.10,0.85],
  /*248  resonance_bridge */ [0.35,0.40,0.50,0.25,0.25,0.45,0.25,0.20,0.30,0.15,0.10,0.15,0.35,0.00,0.15,0.10, 0.15,0.15,0.05,0.15,0.15,0.15,0.15,0.10,0.10,0.15,0.20,0.05,0.10,0.35,0.10,0.80],
  /*249  polysemy         */ [0.10,0.25,0.45,0.10,0.30,0.10,0.10,0.20,0.10,0.10,0.10,0.05,0.35,0.00,0.05,0.05, 0.25,0.20,0.05,0.15,0.10,0.05,0.10,0.55,0.15,0.15,0.20,0.00,0.00,0.15,0.45,0.75],
  /*250  hybrid_vigor     */ [0.35,0.40,0.45,0.25,0.30,0.25,0.20,0.20,0.30,0.20,0.15,0.15,0.35,0.00,0.35,0.15, 0.10,0.10,0.05,0.10,0.10,0.10,0.15,0.10,0.10,0.15,0.15,0.10,0.00,0.45,0.10,0.85],
  /*251  chimera_forge    */ [0.40,0.50,0.55,0.30,0.40,0.30,0.20,0.25,0.30,0.25,0.15,0.20,0.45,0.05,0.20,0.15, 0.15,0.15,0.05,0.20,0.15,0.15,0.20,0.10,0.10,0.25,0.20,0.15,0.05,0.50,0.15,0.90],
  /*252  translation_layer*/ [0.20,0.30,0.50,0.15,0.30,0.20,0.20,0.15,0.15,0.15,0.15,0.10,0.50,0.10,0.10,0.10, 0.25,0.15,0.10,0.15,0.20,0.15,0.15,0.30,0.10,0.10,0.20,0.05,0.05,0.25,0.30,0.85],
  /*253  ock_v2           */ [0.30,0.40,0.50,0.25,0.30,0.20,0.20,0.25,0.30,0.15,0.10,0.20,0.40,0.00,0.20,0.10, 0.15,0.10,0.05,0.25,0.15,0.15,0.20,0.15,0.10,0.50,0.25,0.35,0.00,0.30,0.20,0.85],
  /*254  decay_engine     */ [0.45,0.55,0.50,0.35,0.45,0.15,0.15,0.30,0.25,0.30,0.10,0.30,0.40,0.00,0.10,0.10, 0.15,0.15,0.05,0.15,0.20,0.15,0.20,0.10,0.10,0.20,0.15,0.15,0.15,0.40,0.15,0.80],
  /*255  omega_collider   */ [0.50,0.55,0.65,0.40,0.40,0.35,0.25,0.25,0.35,0.25,0.15,0.25,0.50,0.10,0.20,0.15, 0.20,0.20,0.10,0.20,0.20,0.20,0.25,0.15,0.15,0.25,0.25,0.15,0.10,0.50,0.15,0.95],
];

// ── Core math (updated for 32D — backward-compatible) ────────────────────────

export function cosineSim(a, b) {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d < 1e-12 ? 0 : dot / d;
}

export function topDrivers(a, b, k = 3) {
  const len = Math.min(a.length, b.length);
  const contribs = [];
  for (let i = 0; i < len; i++) {
    contribs.push({ name: DIM_NAMES[i] || `dim_${i}`, value: a[i] * b[i], magA: a[i], magB: b[i] });
  }
  contribs.sort((x, y) => y.value - x.value);
  return contribs.slice(0, k).filter(c => c.value > 0.01);
}

export function analyzeEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA], fB = FEATURES[iB];
  return { sim: cosineSim(fA, fB), drivers: topDrivers(fA, fB, 4) };
}

// ── Resonance comparison engine ───────────────────────────────────────────────
export function compareNodes(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA];
  const fB = FEATURES[iB];
  const sim = cosineSim(fA, fB);
  const topDims = DIM_NAMES
    .map((name, i) => ({
      name,
      weight:       (fA[i] + fB[i]) / 2,
      contribution:  fA[i] * fB[i],
      vA: fA[i],
      vB: fB[i],
    }))
    .filter(d => d.contribution > 0.01)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);
  return { sim, topDims };
}

// ── Period-doubling bifurcation (JS layer) ────────────────────────────────────
export function jitterFeatures(parentId) {
  const iA = NODE_IDX[parentId];
  if (iA == null) return null;
  return FEATURES[iA].map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.05)));
}

// ── Layer 4.4.4.4 — full 32D tensor manifest ─────────────────────────────────
export function analyzeFullEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA], fB = FEATURES[iB];
  const sim = cosineSim(fA, fB);
  const dims = DIM_NAMES.map((name, i) => ({
    name, i,
    vA: fA[i], vB: fB[i],
    delta: Math.abs(fA[i] - fB[i]),
    contrib: fA[i] * fB[i],
  }));
  const drivers = [...dims].sort((a, b) => b.contrib - a.contrib).slice(0, 5);
  return { idA, idB, sim, dims, drivers };
}

// ── Layer 5.5.5.5.5 — paradox extraction (64-iteration, 32D) ─────────────────
export function extractParadoxes(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = [...FEATURES[iA]], fB = [...FEATURES[iB]];
  const origDeltas = fA.map((v, i) => Math.abs(v - fB[i]));

  for (let iter = 0; iter < 64; iter++) {
    const deltas = fA.map((v, i) => Math.abs(v - fB[i]));
    const maxVal = Math.max(...deltas);
    if (maxVal < 0.02) break;
    const maxIdx = deltas.indexOf(maxVal);
    const mid = (fA[maxIdx] + fB[maxIdx]) / 2;
    fA[maxIdx] = mid + (fA[maxIdx] - mid) * 0.93;
    fB[maxIdx] = mid + (fB[maxIdx] - mid) * 0.93;
  }

  const finalSim = cosineSim(fA, fB);
  const paradoxes = DIM_NAMES
    .map((name, i) => ({ name, i, residual: Math.abs(fA[i] - fB[i]), original: origDeltas[i] }))
    .filter(d => d.residual > 0.08)
    .sort((a, b) => b.residual - a.residual);

  return { idA, idB, finalSim, paradoxes };
}

// ── Orthogonal bridge search ──────────────────────────────────────────────────
export function findOrthogonalNode(targetId, existingEdgeSet) {
  const iA = NODE_IDX[targetId];
  if (iA == null) return null;
  const fA = FEATURES[iA];

  let bestId = null, bestSim = Infinity;

  for (let i = 0; i < NODES.length; i++) {
    const n = NODES[i];
    if (n.id === targetId) continue;
    const k = targetId < n.id ? `${targetId}:${n.id}` : `${n.id}:${targetId}`;
    if (existingEdgeSet && existingEdgeSet.has(k)) continue;
    const s = cosineSim(fA, FEATURES[i]);
    if (s < bestSim) { bestSim = s; bestId = n.id; }
  }

  if (!bestId) return null;

  const iB = NODE_IDX[bestId];
  const fB = FEATURES[iB];
  const divergentDims = DIM_NAMES
    .map((name, i) => ({ name, i, delta: Math.abs(fA[i] - fB[i]), vA: fA[i], vB: fB[i] }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);

  return { id: bestId, sim: bestSim, divergentDims };
}

// ── Fusion ID counter — session-scoped ───────────────────────────────────────
let _fusionCounter = 0;
export function nextFusionId() {
  return `FX-${String(++_fusionCounter).padStart(4, '0')}`;
}
