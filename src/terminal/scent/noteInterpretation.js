// Poetic note → kit materials (spec §6.9). Transcribed verbatim from
// docs/superpowers/research/scent-kit/note-mapping.draft.json, approved by the
// author 2026-11-27 (P1 sign-off). PERF_NOTES is not rewritten; every name in
// it has an entry here.
//
// NOTE_MATERIALS is buildBaseAccord's noteMaterials: parts are relative within
// the note and normalised there. They are perfumery judgement, not
// measurement. NOTE_RATIONALE carries each note's kind (direct /
// interpretation / stand-in) and why, for the dossier.
//
// Pure data: no React, DOM, GL, WASM or WebCrypto.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const NOTE_MATERIALS = deepFreeze({
  "Bergamot": [
    {
      "materialId": "bergamot_oil",
      "parts": 7
    },
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 2
    },
    {
      "materialId": "hedione",
      "parts": 1
    }
  ],
  "Neroli": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 5
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    }
  ],
  "Lemon Verbena": [
    {
      "materialId": "citral",
      "parts": 5
    },
    {
      "materialId": "bergamot_oil",
      "parts": 3
    },
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 2
    }
  ],
  "Yuzu": [
    {
      "materialId": "bergamot_oil",
      "parts": 5
    },
    {
      "materialId": "citral",
      "parts": 2
    },
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 2
    },
    {
      "materialId": "cardamom_oil",
      "parts": 1
    }
  ],
  "Pink Grapefruit": [
    {
      "materialId": "bergamot_oil",
      "parts": 5
    },
    {
      "materialId": "citral",
      "parts": 2
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 1
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 1
    },
    {
      "materialId": "decanal",
      "parts": 1
    }
  ],
  "Bitter Orange": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 4
    },
    {
      "materialId": "bergamot_oil",
      "parts": 4
    },
    {
      "materialId": "decanal",
      "parts": 1
    },
    {
      "materialId": "citral",
      "parts": 1
    }
  ],
  "Violet Leaf": [
    {
      "materialId": "methyl_octine_carbonate",
      "parts": 0.03
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 3
    },
    {
      "materialId": "beta_ionone",
      "parts": 2
    },
    {
      "materialId": "galbanum_oil",
      "parts": 2
    }
  ],
  "Aldehydes": [
    {
      "materialId": "decanal",
      "parts": 8
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    }
  ],
  "Green Tea": [
    {
      "materialId": "hedione",
      "parts": 5
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Cucumber Accord": [
    {
      "materialId": "cis_3_hexenol",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "calone",
      "parts": 2
    }
  ],
  "Water Lotus": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 3
    },
    {
      "materialId": "calone",
      "parts": 2
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 1
    }
  ],
  "Ozone": [
    {
      "materialId": "floralozone",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "calone",
      "parts": 2
    },
    {
      "materialId": "decanal",
      "parts": 1
    }
  ],
  "Black Pepper": [
    {
      "materialId": "black_pepper_oil",
      "parts": 10
    }
  ],
  "Cardamom": [
    {
      "materialId": "cardamom_oil",
      "parts": 10
    }
  ],
  "Ginger": [
    {
      "materialId": "cardamom_oil",
      "parts": 4
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 3
    },
    {
      "materialId": "citral",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 1
    }
  ],
  "Elemi": [
    {
      "materialId": "olibanum_oil",
      "parts": 4
    },
    {
      "materialId": "citral",
      "parts": 2
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 1
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Coriander Seed": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 5
    },
    {
      "materialId": "cardamom_oil",
      "parts": 3
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    }
  ],
  "Nutmeg": [
    {
      "materialId": "black_pepper_oil",
      "parts": 4
    },
    {
      "materialId": "cardamom_oil",
      "parts": 3
    },
    {
      "materialId": "olibanum_oil",
      "parts": 2
    },
    {
      "materialId": "eugenol",
      "parts": 1
    }
  ],
  "Petitgrain": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 10
    }
  ],
  "Neroli Bigarade": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 5
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    }
  ],
  "Peach Blossom": [
    {
      "materialId": "gamma_undecalactone",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Lychee Rose": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 4
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "geraniol",
      "parts": 2
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 1
    },
    {
      "materialId": "bergamot_oil",
      "parts": 1
    }
  ],
  "Osmanthus": [
    {
      "materialId": "beta_ionone",
      "parts": 4
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 2
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 1
    }
  ],
  "Tiare": [
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 2
    },
    {
      "materialId": "ylang_ylang_oil",
      "parts": 2
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    }
  ],
  "Juniper Berry": [
    {
      "materialId": "olibanum_oil",
      "parts": 3
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    }
  ],
  "Pink Pepper": [
    {
      "materialId": "black_pepper_oil",
      "parts": 5
    },
    {
      "materialId": "bergamot_oil",
      "parts": 3
    },
    {
      "materialId": "cardamom_oil",
      "parts": 2
    }
  ],
  "Carrot Seed": [
    {
      "materialId": "beta_ionone",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "galbanum_oil",
      "parts": 1
    }
  ],
  "Basil Grand Vert": [
    {
      "materialId": "cis_3_hexenol",
      "parts": 3
    },
    {
      "materialId": "cardamom_oil",
      "parts": 3
    },
    {
      "materialId": "eugenol",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    }
  ],
  "Artemisia": [
    {
      "materialId": "galbanum_oil",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "cardamom_oil",
      "parts": 2
    },
    {
      "materialId": "olibanum_oil",
      "parts": 2
    }
  ],
  "Cistus": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 8
    },
    {
      "materialId": "olibanum_oil",
      "parts": 2
    }
  ],
  "Marine Accord": [
    {
      "materialId": "calone",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "floralozone",
      "parts": 2
    },
    {
      "materialId": "ambrox",
      "parts": 1
    }
  ],
  "Sea Salt": [
    {
      "materialId": "ambrox",
      "parts": 3
    },
    {
      "materialId": "calone",
      "parts": 3
    },
    {
      "materialId": "iso_e_super",
      "parts": 2
    },
    {
      "materialId": "decanal",
      "parts": 2
    }
  ],
  "Calone": [
    {
      "materialId": "calone",
      "parts": 10
    }
  ],
  "Ozone Crystal": [
    {
      "materialId": "floralozone",
      "parts": 5
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "calone",
      "parts": 2
    }
  ],
  "Arctic Moss": [
    {
      "materialId": "evernyl",
      "parts": 4
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 2
    }
  ],
  "Dew Accord": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 1
    }
  ],
  "Aldehydic Musk": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 6
    },
    {
      "materialId": "decanal",
      "parts": 2
    },
    {
      "materialId": "iso_e_super",
      "parts": 2
    }
  ],
  "Ambrette Seed": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 7
    },
    {
      "materialId": "hedione",
      "parts": 2
    },
    {
      "materialId": "cardamom_oil",
      "parts": 1
    }
  ],
  "Orris Root": [
    {
      "materialId": "beta_ionone",
      "parts": 5
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 2
    }
  ],
  "Castoreum Tincture": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 4
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    }
  ],
  "Hyraceum": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 4
    },
    {
      "materialId": "indole",
      "parts": 2
    },
    {
      "materialId": "ambrox",
      "parts": 2
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    }
  ],
  "Galbanum": [
    {
      "materialId": "galbanum_oil",
      "parts": 10
    }
  ],
  "Elemi Resin": [
    {
      "materialId": "olibanum_oil",
      "parts": 4
    },
    {
      "materialId": "citral",
      "parts": 2
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 1
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Frankincense Essence": [
    {
      "materialId": "olibanum_oil",
      "parts": 10
    }
  ],
  "Labdanum Tincture": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 10
    }
  ],
  "Opoponax": [
    {
      "materialId": "olibanum_oil",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Benzoin": [
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 10
    }
  ],
  "Jasmine Sambac": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 3
    },
    {
      "materialId": "indole",
      "parts": 1
    },
    {
      "materialId": "ylang_ylang_oil",
      "parts": 1
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 1
    }
  ],
  "Orange Blossom Absolute": [
    {
      "materialId": "petitgrain_bigarade_oil",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 1
    }
  ],
  "Magnolia": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    },
    {
      "materialId": "citronellol",
      "parts": 2
    }
  ],
  "Mimosa": [
    {
      "materialId": "beta_ionone",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 1
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 1
    }
  ],
  "Cyclamen": [
    {
      "materialId": "hydroxycitronellal",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 1
    }
  ],
  "Heliotrope": [
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "vanillin",
      "parts": 3
    },
    {
      "materialId": "coumarin",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 2
    }
  ],
  "Iris": [
    {
      "materialId": "beta_ionone",
      "parts": 5
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 2
    }
  ],
  "Violet Absolute": [
    {
      "materialId": "beta_ionone",
      "parts": 5
    },
    {
      "materialId": "methyl_octine_carbonate",
      "parts": 0.03
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 2
    },
    {
      "materialId": "hedione",
      "parts": 1
    }
  ],
  "White Tea Accord": [
    {
      "materialId": "hedione",
      "parts": 5
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 2
    },
    {
      "materialId": "bergamot_oil",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Peony": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 4
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 1
    }
  ],
  "Lily of the Valley": [
    {
      "materialId": "hydroxycitronellal",
      "parts": 5
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "hedione",
      "parts": 1
    }
  ],
  "Muguet": [
    {
      "materialId": "hydroxycitronellal",
      "parts": 5
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "hedione",
      "parts": 1
    }
  ],
  "Rose Absolute": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 4
    },
    {
      "materialId": "citronellol",
      "parts": 3
    },
    {
      "materialId": "geraniol",
      "parts": 2
    },
    {
      "materialId": "eugenol",
      "parts": 1
    }
  ],
  "Cinnamon Bark": [
    {
      "materialId": "eugenol",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 3
    },
    {
      "materialId": "cardamom_oil",
      "parts": 2
    },
    {
      "materialId": "coumarin",
      "parts": 1
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Clove Bud": [
    {
      "materialId": "eugenol",
      "parts": 8
    },
    {
      "materialId": "black_pepper_oil",
      "parts": 1
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Saffron": [
    {
      "materialId": "beta_ionone",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    }
  ],
  "Oud Rose": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 3
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 1
    }
  ],
  "Pepper Heart": [
    {
      "materialId": "black_pepper_oil",
      "parts": 6
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "iso_e_super",
      "parts": 2
    }
  ],
  "Rose de Mai": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 5
    },
    {
      "materialId": "citronellol",
      "parts": 2
    },
    {
      "materialId": "geraniol",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Jasmine Absolute": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 4
    },
    {
      "materialId": "indole",
      "parts": 1
    },
    {
      "materialId": "ylang_ylang_oil",
      "parts": 1
    }
  ],
  "Ylang-Ylang Extra": [
    {
      "materialId": "ylang_ylang_oil",
      "parts": 10
    }
  ],
  "Iris Pallida": [
    {
      "materialId": "beta_ionone",
      "parts": 5
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "javanol",
      "parts": 1
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 1
    }
  ],
  "Tuberose": [
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "ylang_ylang_oil",
      "parts": 2
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 2
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 1
    },
    {
      "materialId": "indole",
      "parts": 1
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 1
    }
  ],
  "Gardenia": [
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 3
    },
    {
      "materialId": "gamma_undecalactone",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    },
    {
      "materialId": "cis_3_hexenol",
      "parts": 1
    }
  ],
  "Geranium Bourbon": [
    {
      "materialId": "citronellol",
      "parts": 5
    },
    {
      "materialId": "geraniol",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 1
    },
    {
      "materialId": "patchouli_oil",
      "parts": 1
    }
  ],
  "Vetiver Haiti": [
    {
      "materialId": "vetiver_oil",
      "parts": 10
    }
  ],
  "Cedarwood Atlas": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 10
    }
  ],
  "Sandalwood Mysore": [
    {
      "materialId": "javanol",
      "parts": 4
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 1
    }
  ],
  "Guaiac Wood": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "patchouli_oil",
      "parts": 3
    },
    {
      "materialId": "vetiver_oil",
      "parts": 3
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 1
    }
  ],
  "Birch": [
    {
      "materialId": "isobutyl_quinoline",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    }
  ],
  "Water Iris": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "beta_ionone",
      "parts": 4
    },
    {
      "materialId": "calone",
      "parts": 2
    }
  ],
  "Sea Lily Accord": [
    {
      "materialId": "hydroxycitronellal",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 3
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 2
    }
  ],
  "Blue Lotus": [
    {
      "materialId": "hedione",
      "parts": 4
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 3
    },
    {
      "materialId": "beta_ionone",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 1
    }
  ],
  "Aquatic Jasmine": [
    {
      "materialId": "hedione",
      "parts": 5
    },
    {
      "materialId": "benzyl_acetate",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 2
    },
    {
      "materialId": "indole",
      "parts": 1
    }
  ],
  "Kelp Extract": [
    {
      "materialId": "calone",
      "parts": 3
    },
    {
      "materialId": "evernyl",
      "parts": 3
    },
    {
      "materialId": "ambrox",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    }
  ],
  "Seaweed": [
    {
      "materialId": "calone",
      "parts": 3
    },
    {
      "materialId": "evernyl",
      "parts": 3
    },
    {
      "materialId": "ambrox",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    }
  ],
  "Honey Absolute": [
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Beeswax Absolute": [
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 2
    },
    {
      "materialId": "phenylethyl_alcohol",
      "parts": 2
    }
  ],
  "Civet Accord": [
    {
      "materialId": "indole",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 2
    }
  ],
  "Costus Root": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "vetiver_oil",
      "parts": 3
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 1
    }
  ],
  "Ambrette Heart": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 7
    },
    {
      "materialId": "hedione",
      "parts": 2
    },
    {
      "materialId": "cardamom_oil",
      "parts": 1
    }
  ],
  "Oakmoss": [
    {
      "materialId": "evernyl",
      "parts": 5
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 1
    }
  ],
  "Labdanum Absolute": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 8
    },
    {
      "materialId": "beta_ionone",
      "parts": 2
    }
  ],
  "Olibanum": [
    {
      "materialId": "olibanum_oil",
      "parts": 8
    },
    {
      "materialId": "beta_ionone",
      "parts": 2
    }
  ],
  "Myrrh Heart": [
    {
      "materialId": "olibanum_oil",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 1
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Benzoin Absolute": [
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 8
    },
    {
      "materialId": "hedione",
      "parts": 1
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Styrax Levant": [
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 1
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 1
    },
    {
      "materialId": "hedione",
      "parts": 1
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Tonka Bean": [
    {
      "materialId": "coumarin",
      "parts": 6
    },
    {
      "materialId": "vanillin",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    }
  ],
  "White Musk": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 4
    },
    {
      "materialId": "habanolide",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 2
    },
    {
      "materialId": "ambrox",
      "parts": 1
    }
  ],
  "Benzoin Siam": [
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 10
    }
  ],
  "Amber Accord": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 4
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 3
    },
    {
      "materialId": "ambrox",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Hedione HC": [
    {
      "materialId": "hedione",
      "parts": 10
    }
  ],
  "Cashmeran": [
    {
      "materialId": "cashmeran",
      "parts": 10
    }
  ],
  "White Cedar": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 6
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 1
    }
  ],
  "White Musk Crystal": [
    {
      "materialId": "habanolide",
      "parts": 5
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 3
    },
    {
      "materialId": "ambrox",
      "parts": 2
    }
  ],
  "Driftwood": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "ambrox",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 1
    },
    {
      "materialId": "vetiver_oil",
      "parts": 1
    }
  ],
  "Sandalwood": [
    {
      "materialId": "javanol",
      "parts": 4
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "habanolide",
      "parts": 1
    }
  ],
  "Ambroxide": [
    {
      "materialId": "ambrox",
      "parts": 10
    }
  ],
  "Black Oud": [
    {
      "materialId": "patchouli_oil",
      "parts": 3
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 1
    }
  ],
  "Tobacco Absolute": [
    {
      "materialId": "coumarin",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "beta_ionone",
      "parts": 1
    }
  ],
  "Labdanum": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 10
    }
  ],
  "Leather Accord": [
    {
      "materialId": "isobutyl_quinoline",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "iso_e_super",
      "parts": 2
    }
  ],
  "Dark Amber": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 4
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 3
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Castoreum": [
    {
      "materialId": "labdanum_resinoid",
      "parts": 4
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    }
  ],
  "Australian Sandalwood": [
    {
      "materialId": "javanol",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "iso_e_super",
      "parts": 3
    },
    {
      "materialId": "olibanum_oil",
      "parts": 1
    }
  ],
  "Vanilla Absolute": [
    {
      "materialId": "vanillin",
      "parts": 6
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 3
    },
    {
      "materialId": "coumarin",
      "parts": 1
    }
  ],
  "Muskmallow": [
    {
      "materialId": "ethylene_brassylate",
      "parts": 5
    },
    {
      "materialId": "habanolide",
      "parts": 3
    },
    {
      "materialId": "hedione",
      "parts": 2
    }
  ],
  "Tonka": [
    {
      "materialId": "coumarin",
      "parts": 6
    },
    {
      "materialId": "vanillin",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    }
  ],
  "Patchouli Heart": [
    {
      "materialId": "patchouli_oil",
      "parts": 10
    }
  ],
  "Oakmoss Absolute": [
    {
      "materialId": "evernyl",
      "parts": 5
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 1
    }
  ],
  "Vetiver Bourbon": [
    {
      "materialId": "vetiver_oil",
      "parts": 10
    }
  ],
  "Birch Tar": [
    {
      "materialId": "isobutyl_quinoline",
      "parts": 3
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 2
    }
  ],
  "Iso E Super": [
    {
      "materialId": "iso_e_super",
      "parts": 10
    }
  ],
  "Cedarwood": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 10
    }
  ],
  "Sea Amber": [
    {
      "materialId": "ambrox",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 2
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    }
  ],
  "Salt Cedar": [
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 4
    },
    {
      "materialId": "ambrox",
      "parts": 3
    },
    {
      "materialId": "iso_e_super",
      "parts": 2
    },
    {
      "materialId": "calone",
      "parts": 1
    }
  ],
  "Ambergris Tincture": [
    {
      "materialId": "ambrox",
      "parts": 6
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "habanolide",
      "parts": 2
    }
  ],
  "Musk Absolute": [
    {
      "materialId": "habanolide",
      "parts": 4
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 1
    },
    {
      "materialId": "indole",
      "parts": 1
    }
  ],
  "Civet Absolute": [
    {
      "materialId": "indole",
      "parts": 3
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "patchouli_oil",
      "parts": 2
    },
    {
      "materialId": "habanolide",
      "parts": 2
    }
  ],
  "Oud Kyara": [
    {
      "materialId": "patchouli_oil",
      "parts": 3
    },
    {
      "materialId": "javanol",
      "parts": 2
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 2
    },
    {
      "materialId": "isobutyl_quinoline",
      "parts": 1
    }
  ],
  "Deer Musk": [
    {
      "materialId": "habanolide",
      "parts": 5
    },
    {
      "materialId": "ethylene_brassylate",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 1
    }
  ],
  "Frankincense Hojari": [
    {
      "materialId": "olibanum_oil",
      "parts": 8
    },
    {
      "materialId": "citral",
      "parts": 1
    },
    {
      "materialId": "bergamot_oil",
      "parts": 1
    }
  ],
  "Myrrh Resinoid": [
    {
      "materialId": "olibanum_oil",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "cedarwood_atlas_oil",
      "parts": 1
    }
  ],
  "Opoponax Resin": [
    {
      "materialId": "olibanum_oil",
      "parts": 4
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 3
    },
    {
      "materialId": "benzoin_siam_resinoid",
      "parts": 2
    },
    {
      "materialId": "vanillin",
      "parts": 1
    }
  ],
  "Dark Patchouli": [
    {
      "materialId": "patchouli_oil",
      "parts": 7
    },
    {
      "materialId": "labdanum_resinoid",
      "parts": 2
    },
    {
      "materialId": "vetiver_oil",
      "parts": 1
    }
  ]
});

export const NOTE_RATIONALE = deepFreeze({
  "Bergamot": {
    "kind": "direct",
    "why": "Bergamot oil FCF is in the kit."
  },
  "Neroli": {
    "kind": "interpretation",
    "why": "Neroli oil not in the kit; petitgrain (same tree, leaf) + rose alcohol + a trace of indole."
  },
  "Lemon Verbena": {
    "kind": "interpretation",
    "why": "Verbena oil/absolute is restricted (IFRA STD 083) and not in the kit; citral carries the lemon."
  },
  "Yuzu": {
    "kind": "interpretation",
    "why": "No yuzu oil in the kit."
  },
  "Pink Grapefruit": {
    "kind": "interpretation",
    "why": "Grapefruit oil expressed (STD 091, phototoxic) not in the kit."
  },
  "Bitter Orange": {
    "kind": "interpretation",
    "why": "Bitter orange peel oil (STD 088, phototoxic) not in the kit."
  },
  "Violet Leaf": {
    "kind": "interpretation",
    "why": "Violet leaf absolute not in the kit; its signature molecule, methyl octine carbonate, is."
  },
  "Aldehydes": {
    "kind": "interpretation",
    "why": "A family name, not one material; decanal stands for the aliphatic aldehydes."
  },
  "Green Tea": {
    "kind": "interpretation",
    "why": "Tea leaf absolute is restricted (STD 079) and not in the kit."
  },
  "Cucumber Accord": {
    "kind": "stand-in",
    "why": "Named accord; built from green + marine materials."
  },
  "Water Lotus": {
    "kind": "interpretation",
    "why": "No lotus extract in the kit."
  },
  "Ozone": {
    "kind": "stand-in",
    "why": "Ozone (O3) is excluded (§7.1); an ozonic aldehyde and a marine ketone suggest it."
  },
  "Black Pepper": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Cardamom": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Ginger": {
    "kind": "interpretation",
    "why": "Ginger oil not in the kit (IFRA Annex: 2.8% citral, 0.5% geraniol)."
  },
  "Elemi": {
    "kind": "interpretation",
    "why": "Elemi oil not in the kit (IFRA Annex: 0.4% methyl eugenol); incense + lemon + pepper, with a beta-ionone heart bridge."
  },
  "Coriander Seed": {
    "kind": "interpretation",
    "why": "Coriander oil is named as linalool-rich in IFRA's Linalool specification (STD 187); not in the kit."
  },
  "Nutmeg": {
    "kind": "interpretation",
    "why": "Nutmeg oil not in the kit; warm spice from pepper, cardamom and a trace of eugenol."
  },
  "Petitgrain": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Neroli Bigarade": {
    "kind": "interpretation",
    "why": "As Neroli."
  },
  "Peach Blossom": {
    "kind": "interpretation",
    "why": "gamma-Undecalactone is the classic peach molecule."
  },
  "Lychee Rose": {
    "kind": "interpretation",
    "why": "Rose alcohols with a fruity lactone."
  },
  "Osmanthus": {
    "kind": "interpretation",
    "why": "Osmanthus absolute not in the kit; ionone + apricot lactone."
  },
  "Tiare": {
    "kind": "interpretation",
    "why": "Tiare (Gardenia taitensis) not in the kit."
  },
  "Juniper Berry": {
    "kind": "interpretation",
    "why": "Juniper berry oil not in the kit."
  },
  "Pink Pepper": {
    "kind": "interpretation",
    "why": "Schinus oil not in the kit."
  },
  "Carrot Seed": {
    "kind": "interpretation",
    "why": "Carrot seed oil not in the kit."
  },
  "Basil Grand Vert": {
    "kind": "interpretation",
    "why": "Basil oils carry estragole (up to 81.87%, IFRA Annex; Estragole STD 099) or eugenol; not in the kit."
  },
  "Artemisia": {
    "kind": "interpretation",
    "why": "Artemisia/armoise oils carry up to ~57% thujone (IFRA Annex; Thujone STD 102); not in the kit."
  },
  "Cistus": {
    "kind": "direct",
    "why": "Labdanum resinoid is a Cistus ladaniferus extract."
  },
  "Marine Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Sea Salt": {
    "kind": "stand-in",
    "why": "Inorganic salts are excluded (§7.1); salinity suggested by ambroxide and marine ketone."
  },
  "Calone": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Ozone Crystal": {
    "kind": "stand-in",
    "why": "As Ozone."
  },
  "Arctic Moss": {
    "kind": "stand-in",
    "why": "Treemoss/oakmoss extracts are under restriction + specification (STD 080/067)."
  },
  "Dew Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Aldehydic Musk": {
    "kind": "stand-in",
    "why": "A style, not a material."
  },
  "Ambrette Seed": {
    "kind": "interpretation",
    "why": "Ambrette seed oil not in the kit; macrocyclic musk + a cardamom lift."
  },
  "Orris Root": {
    "kind": "interpretation",
    "why": "Orris butter/absolute not in the kit; ionone + OTNE + musk."
  },
  "Castoreum Tincture": {
    "kind": "stand-in",
    "why": "Animal-derived (beaver); excluded."
  },
  "Hyraceum": {
    "kind": "stand-in",
    "why": "Animal-derived (hyrax); excluded."
  },
  "Galbanum": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Elemi Resin": {
    "kind": "interpretation",
    "why": "As Elemi."
  },
  "Frankincense Essence": {
    "kind": "direct",
    "why": "Olibanum oil is frankincense oil."
  },
  "Labdanum Tincture": {
    "kind": "direct",
    "why": "Tincture rendered as the kit's labdanum resinoid."
  },
  "Opoponax": {
    "kind": "interpretation",
    "why": "Opoponax is restricted (STD 070, Cat 4 0.43%) and not in the kit."
  },
  "Benzoin": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Jasmine Sambac": {
    "kind": "interpretation",
    "why": "Jasmine sambac absolute is restricted (STD 050) and not in the kit."
  },
  "Orange Blossom Absolute": {
    "kind": "interpretation",
    "why": "Not in the kit."
  },
  "Magnolia": {
    "kind": "interpretation",
    "why": "Not in the kit."
  },
  "Mimosa": {
    "kind": "interpretation",
    "why": "Mimosa absolute not in the kit."
  },
  "Cyclamen": {
    "kind": "interpretation",
    "why": "Cyclamen aldehyde has its own IFRA standard (STD 025) and is not in the kit."
  },
  "Heliotrope": {
    "kind": "interpretation",
    "why": "Heliotropin not in the kit."
  },
  "Iris": {
    "kind": "interpretation",
    "why": "Orris not in the kit."
  },
  "Violet Absolute": {
    "kind": "interpretation",
    "why": "Violet leaf absolute not in the kit."
  },
  "White Tea Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Peony": {
    "kind": "interpretation",
    "why": "No peony extract."
  },
  "Lily of the Valley": {
    "kind": "interpretation",
    "why": "Muguet yields no usable extract; classic aldehyde-alcohol reconstruction."
  },
  "Muguet": {
    "kind": "interpretation",
    "why": "As Lily of the Valley."
  },
  "Rose Absolute": {
    "kind": "interpretation",
    "why": "Rose absolute not in the kit."
  },
  "Cinnamon Bark": {
    "kind": "interpretation",
    "why": "Cinnamon bark oil is ~75% cinnamic aldehyde (IFRA Annex; STD 018 Cat 4 0.25%); not in the kit."
  },
  "Clove Bud": {
    "kind": "interpretation",
    "why": "Clove bud oil is 82% eugenol (IFRA Annex); the kit uses eugenol itself."
  },
  "Saffron": {
    "kind": "interpretation",
    "why": "Saffron extract and safranal (STD 082) not in the kit; leathery-ionone interpretation."
  },
  "Oud Rose": {
    "kind": "stand-in",
    "why": "Oud (Aquilaria/Gyrinops agarwood) is excluded as CITES-listed (see sources.md: listing not confirmed from a fetched page)."
  },
  "Pepper Heart": {
    "kind": "interpretation",
    "why": "Black pepper in a woody heart."
  },
  "Rose de Mai": {
    "kind": "interpretation",
    "why": "Rose centifolia absolute not in the kit."
  },
  "Jasmine Absolute": {
    "kind": "interpretation",
    "why": "Jasmine grandiflorum absolute is restricted (STD 049) and not in the kit."
  },
  "Ylang-Ylang Extra": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Iris Pallida": {
    "kind": "interpretation",
    "why": "As Iris."
  },
  "Tuberose": {
    "kind": "interpretation",
    "why": "Tuberose absolute not in the kit."
  },
  "Gardenia": {
    "kind": "interpretation",
    "why": "Gardenia yields no commercial extract of note; classic reconstruction."
  },
  "Geranium Bourbon": {
    "kind": "interpretation",
    "why": "Geranium oil not in the kit (IFRA Annex: up to 17.7% geraniol, 33% l-citronellol)."
  },
  "Vetiver Haiti": {
    "kind": "direct",
    "why": "In the kit (origin not specified)."
  },
  "Cedarwood Atlas": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Sandalwood Mysore": {
    "kind": "stand-in",
    "why": "No Santalum in the kit (Santalum album CITES/IUCN status not confirmed this session); synthetic sandalwood."
  },
  "Guaiac Wood": {
    "kind": "interpretation",
    "why": "Guaiacwood oil not in the kit."
  },
  "Birch": {
    "kind": "stand-in",
    "why": "Crude birch pyrolysate is PROHIBITED; only rectified birch tar under a PAH specification (STD 114)."
  },
  "Water Iris": {
    "kind": "stand-in",
    "why": "Fantasy note."
  },
  "Sea Lily Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Blue Lotus": {
    "kind": "interpretation",
    "why": "Blue lotus absolute not in the kit."
  },
  "Aquatic Jasmine": {
    "kind": "stand-in",
    "why": "Fantasy note."
  },
  "Kelp Extract": {
    "kind": "stand-in",
    "why": "No algae extract in the kit; marine-mineral-moss interpretation."
  },
  "Seaweed": {
    "kind": "stand-in",
    "why": "As Kelp Extract."
  },
  "Honey Absolute": {
    "kind": "stand-in",
    "why": "Animal-derived (bee product); excluded."
  },
  "Beeswax Absolute": {
    "kind": "stand-in",
    "why": "Animal-derived (bee product); excluded."
  },
  "Civet Accord": {
    "kind": "stand-in",
    "why": "Civet is animal-derived; excluded."
  },
  "Costus Root": {
    "kind": "stand-in",
    "why": "Costus root oil, absolute and concrete are PROHIBITED (STD 124)."
  },
  "Ambrette Heart": {
    "kind": "interpretation",
    "why": "As Ambrette Seed."
  },
  "Oakmoss": {
    "kind": "stand-in",
    "why": "Oakmoss extracts are under restriction + specification (STD 067); Evernyl is the stand-in."
  },
  "Labdanum Absolute": {
    "kind": "interpretation",
    "why": "Rendered as the kit's labdanum resinoid, lifted by beta-ionone's dry orris-amber so the note carries a heart row."
  },
  "Olibanum": {
    "kind": "interpretation",
    "why": "The kit's olibanum oil, with beta-ionone as the dry heart bridge."
  },
  "Myrrh Heart": {
    "kind": "interpretation",
    "why": "Myrrh not in the kit; incense resins with a beta-ionone heart bridge."
  },
  "Benzoin Absolute": {
    "kind": "interpretation",
    "why": "Rendered as the kit's benzoin resinoid, with hedione's lift and beta-ionone as the heart bridge."
  },
  "Styrax Levant": {
    "kind": "stand-in",
    "why": "Crude styrax is prohibited; extracts restricted (STD 078). Not in the kit. Balsamic stand-in with a hedione / beta-ionone heart bridge."
  },
  "Tonka Bean": {
    "kind": "interpretation",
    "why": "Tonka absolute not in the kit; coumarin is its main odorant."
  },
  "White Musk": {
    "kind": "stand-in",
    "why": "A style, not a material."
  },
  "Benzoin Siam": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Amber Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Hedione HC": {
    "kind": "interpretation",
    "why": "Hedione HC (high-cis quality) not in the kit; standard Hedione."
  },
  "Cashmeran": {
    "kind": "direct",
    "why": "In the kit."
  },
  "White Cedar": {
    "kind": "interpretation",
    "why": "Thuja (cedar leaf) oil is ~55% alpha-thujone (IFRA Annex); Atlas cedar instead."
  },
  "White Musk Crystal": {
    "kind": "stand-in",
    "why": "A style, not a material."
  },
  "Driftwood": {
    "kind": "stand-in",
    "why": "Fantasy note."
  },
  "Sandalwood": {
    "kind": "stand-in",
    "why": "As Sandalwood Mysore."
  },
  "Ambroxide": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Black Oud": {
    "kind": "stand-in",
    "why": "Oud excluded (CITES, see Oud Rose)."
  },
  "Tobacco Absolute": {
    "kind": "interpretation",
    "why": "Tobacco absolute not in the kit."
  },
  "Labdanum": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Leather Accord": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Dark Amber": {
    "kind": "stand-in",
    "why": "Named accord."
  },
  "Castoreum": {
    "kind": "stand-in",
    "why": "Animal-derived (beaver); excluded."
  },
  "Australian Sandalwood": {
    "kind": "stand-in",
    "why": "No Santalum in the kit; synthetic sandalwood."
  },
  "Vanilla Absolute": {
    "kind": "interpretation",
    "why": "Vanilla absolute not in the kit."
  },
  "Muskmallow": {
    "kind": "interpretation",
    "why": "Musk mallow (ambrette, Abelmoschus moschatus) not in the kit; macrocyclic musks."
  },
  "Tonka": {
    "kind": "interpretation",
    "why": "As Tonka Bean."
  },
  "Patchouli Heart": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Oakmoss Absolute": {
    "kind": "stand-in",
    "why": "As Oakmoss."
  },
  "Vetiver Bourbon": {
    "kind": "direct",
    "why": "In the kit (origin not specified)."
  },
  "Birch Tar": {
    "kind": "stand-in",
    "why": "As Birch (STD 114)."
  },
  "Iso E Super": {
    "kind": "direct",
    "why": "In the kit."
  },
  "Cedarwood": {
    "kind": "direct",
    "why": "Rendered as Atlas cedarwood."
  },
  "Sea Amber": {
    "kind": "stand-in",
    "why": "Fantasy note."
  },
  "Salt Cedar": {
    "kind": "stand-in",
    "why": "Fantasy note (no salt, §7.1)."
  },
  "Ambergris Tincture": {
    "kind": "stand-in",
    "why": "Animal-derived (sperm whale); ambroxide is the established substitute."
  },
  "Musk Absolute": {
    "kind": "stand-in",
    "why": "Animal-derived; excluded."
  },
  "Civet Absolute": {
    "kind": "stand-in",
    "why": "Animal-derived; excluded."
  },
  "Oud Kyara": {
    "kind": "stand-in",
    "why": "Oud excluded (CITES, see Oud Rose)."
  },
  "Deer Musk": {
    "kind": "stand-in",
    "why": "Animal-derived (musk deer); synthetic macrocyclic musks, as §6 item 9 names."
  },
  "Frankincense Hojari": {
    "kind": "interpretation",
    "why": "Hojari is a Boswellia sacra grade; the kit's olibanum is Boswellia spp."
  },
  "Myrrh Resinoid": {
    "kind": "interpretation",
    "why": "As Myrrh Heart."
  },
  "Opoponax Resin": {
    "kind": "interpretation",
    "why": "As Opoponax."
  },
  "Dark Patchouli": {
    "kind": "interpretation",
    "why": "Patchouli deepened with resin."
  }
});
