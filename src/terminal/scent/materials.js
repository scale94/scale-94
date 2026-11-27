// The /SCENT kit (spec §7.1): 38 materials, 57 bottles.
// Transcribed verbatim from docs/superpowers/research/scent-kit/materials.draft.json,
// approved by the author 2026-11-27 (P1 sign-off). Every value is cited in the
// row's own `sources` (and in that folder's sources.md). No chemistry value
// here was typed from memory: change the research file, re-run its check.mjs,
// and transcribe again.
//
// Pure data: no React, DOM, GL, WASM or WebCrypto.

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const MATERIALS = deepFreeze([
  {
    "id": "bergamot_oil",
    "name": "Bergamot oil FCF, furocoumarin-free (Citrus aurantium subsp. bergamia)",
    "cas": "89957-91-5",
    "layer": "top",
    "role": "citrus-floral opening; furocoumarin-free (FCF) quality, so phototoxicity does not set its ceiling",
    "physicalState": "liquid",
    "stocks": [
      1,
      0.1
    ],
    "ifraCat4MaxPct": 300,
    "ifraCat4MaxPctBasis": "derived: STD 089 Cat 4 bergapten 0.0015% in the finished product ÷ supplier bergaptene 0.0005% in the oil = 300% of the bottle, so it never binds; the citral it carries binds first (STD 021, summed across rows). Without a CoA stating bergapten, STD 087's 0.40% applies instead.",
    "stockBasis": "ordinary liquid, neat; plus a 10% stock for small doses.",
    "ifraConstituents": [
      {
        "cas": "5392-40-5",
        "name": "Citral",
        "pctInMaterial": 1.5,
        "source": "Madar IFRA statement for Bergamot Sicilian FCF",
        "standard": "Citral",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_021.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.6
      },
      {
        "cas": "106-22-9",
        "name": "Citronellol",
        "pctInMaterial": 0.03,
        "source": "Madar IFRA statement for Bergamot Sicilian FCF",
        "standard": "Citronellol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_022.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 12
      },
      {
        "cas": "106-24-1",
        "name": "Geraniol",
        "pctInMaterial": 0.04,
        "source": "IFRA 51st Annex, Bergamot oil expressed (kept as a conservative carry-over; the FCF statement lists none)",
        "annexNcsName": "Bergamot oil expressed",
        "standard": "Geraniol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_037.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 4.7
      }
    ],
    "flags": [
      "STD 087 (Bergamot oil expressed) lists CAS 89957-91-5 too and says: \"If the level of furocoumarins is unknown, the restriction level specified in this IFRA Standard applies\" (0.40%). The derived ceiling holds only with the FCF CoA.",
      "STD 089: the sum of all furocoumarin-containing ingredients, as % of their limits, must not exceed 100. Bergamot FCF is the kit's only one.",
      "52nd Amendment (notification expected Jan 2027): the standalone bergamot standard is withdrawn for an FC-content standard. Escardó reports total furocoumarins < 1 ppm; re-derive the ceiling when the new limit is published.",
      "Limonene 45% / linalool 15% (Madar IFRA statement): in scope of the IFRA Limonene and Linalool SPECIFICATIONS (STD 186/187). Author decision A: kept, bought to the peroxide-value spec."
    ],
    "sources": {
      "casSource": {
        "name": "Madar Corporation FCF dossier (CAS No. 89957-91-5, EINECS 289-612-9); also listed in IFRA STD 087's CAS field; Escardó lists EINECS CAS 89957-91-5 (TSCA 8007-75-8, 68648-33-9)",
        "url": "https://files.finqu.com/merchant/13426/bergamot-sicilian-all-docs.pdf",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Citrus oils and other furocoumarins containing essential oils",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_089.pdf",
        "accessed": "2026-11-27",
        "fallback": {
          "standard": "Bergamot oil expressed",
          "amendment": "49",
          "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_087.pdf",
          "cat4MaxPct": 0.4
        }
      }
    },
    "furocoumarins": {
      "bergaptenePctInMaterial": 0.0005,
      "source": {
        "name": "Madar Corporation, Bergamot Sicilian Essential Oil FCF — IFRA statement (\"Bergaptene 0.0005\" % level in product)",
        "url": "https://files.finqu.com/merchant/13426/bergamot-sicilian-all-docs.pdf",
        "accessed": "2026-11-27"
      },
      "corroboration": {
        "name": "Escardó, Bergamot oil bergaptene free technical sheet: \"Furocoumarin: < 1 ppm\"; \"Restricted by IFRA. Due to the Citral not to the furocoumarins.\"",
        "url": "https://escardo.eu/wp-content/uploads/2019/10/11BergamotOil.pdf",
        "accessed": "2026-11-27"
      }
    },
    "purchaseSpec": "Bergamot FCF with a certificate of analysis stating bergapten ≤ 5 ppm (0.0005%). Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "petitgrain_bigarade_oil",
    "name": "Petitgrain bigarade oil (Citrus aurantium ssp. amara, leaf)",
    "cas": "8014-17-3",
    "layer": "top",
    "role": "green-bitter citrus leaf; neroli and orange-blossom backbone",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": 8.5,
    "ifraCat4MaxPctBasis": "derived from constituent: 2-Hexenal Cat 4 0.0077% / 0.09% in oil = 8.56%, rounded down to 8.5",
    "stockBasis": "ordinary liquid, safe to handle neat (locked decision 9)",
    "ifraConstituents": [
      {
        "cas": "106-24-1",
        "name": "Geraniol",
        "pctInMaterial": 2.4,
        "annexNcsName": "Petitgrain bigarade oil",
        "standard": "Geraniol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_037.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 4.7
      },
      {
        "cas": "5392-40-5",
        "name": "Citral",
        "pctInMaterial": 0.65,
        "annexNcsName": "Petitgrain bigarade oil",
        "standard": "Citral",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_021.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.6
      },
      {
        "cas": "505-57-7",
        "name": "2-Hexenal",
        "pctInMaterial": 0.09,
        "annexNcsName": "Petitgrain bigarade oil",
        "standard": "2-Hexenal",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_039.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 0.0077
      },
      {
        "cas": "106-23-0",
        "name": "Citronellal",
        "pctInMaterial": 0.05,
        "annexNcsName": "Petitgrain bigarade oil",
        "standard": "Citronellal",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_206.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.49
      }
    ],
    "flags": [
      "CAS 8014-17-3 is shared in the IFRA Annex by 'Petitgrain bigarade oil', 'Petitgrain oil, Paraguay' and 'Petitgrain mandarin oil'. Buy the bigarade quality; Paraguay carries 2.77% geraniol, mandarin carries 50.13% methyl N-methylanthranilate (STD 094).",
      "Possibly in scope of the IFRA Linalool SPECIFICATION (STD 187). Linalool content not verified this session. Author decision A: kept, bought to the peroxide-value spec (IFRA STD 186/187)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135317653 (Petitgrain oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135317653",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8014-17-3 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; its constituents fall under the standards listed in ifraConstituents (IFRA Annex)."
      }
    },
    "purchaseSpec": "Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "citral",
    "name": "Citral (geranial + neral)",
    "cas": "5392-40-5",
    "layer": "top",
    "role": "sharp lemon; lemon verbena, yuzu, ginger and elemi interpretations",
    "physicalState": "liquid",
    "stocks": [
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": 0.6,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "Cat 4 cap 0.60% x 7.00 g = 0.042 g neat, below 0.05 g, so no neat stock; 1% step for traces.",
    "ifraConstituents": [],
    "flags": [
      "Citral is also contributed by bergamot, petitgrain, cardamom and ylang rows: the engine must sum citral across rows against 0.60%."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 638011 (Citral); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/638011",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Citral",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_021.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "decanal",
    "name": "Decanal (aldehyde C-10)",
    "cas": "112-31-2",
    "layer": "top",
    "role": "waxy orange-peel aldehyde; the 'Aldehydes' note",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "high-impact material: 10% stock (locked decision 9). Classing it high-impact is a perfumery judgement, not a cited value.",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 8175 (Decanal); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/8175",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 112-31-2 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "calone",
    "name": "Methyl benzodioxepinone (Calone)",
    "cas": "28940-11-6",
    "layer": "top",
    "role": "watermelon-sea-spray marine note",
    "physicalState": "solid",
    "stocks": [
      1,
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (51st)",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; 10% / 1% ethanol stocks below that.",
    "solubility": {
      "ethanol": "\"SOLUBLE IN ETHANOL: 1 g IN 5 mL ETHANOL 95%\" (Ventós), about 20% w/w",
      "supports10pctStock": true
    },
    "ifraConstituents": [],
    "flags": [
      "52nd Amendment: 'Methyl benzodioxepinone' CAS 28940-11-6 is on the list of 37 NEW restriction standards (End of Consultation letter, 31 Aug 2026). MAC not yet published."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 120101 (Methyl benzodioxepinone); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/120101",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 28940-11-6 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      },
      "solubilitySource": {
        "name": "Ventós specification sheet, Watermelon Ketone (Calone 1951)",
        "url": "https://www.ventos.com/fr/?option=com_evsa&task=documentacion.mostrar&codi=001_BUZYYCJ5GY_3161",
        "accessed": "2026-11-27"
      }
    },
    "physicalStateSource": {
      "name": "Ventós specification sheet, Watermelon Ketone (Calone 1951), CAS 28940-11-6: \"CRYSTALLINE POWDER\", \"WHITE\"",
      "url": "https://www.ventos.com/fr/?option=com_evsa&task=documentacion.mostrar&codi=001_BUZYYCJ5GY_3161",
      "accessed": "2026-11-27"
    }
  },
  {
    "id": "floralozone",
    "name": "3-(4-Ethylphenyl)-2,2-dimethylpropanal (Floralozone)",
    "cas": "67634-15-5",
    "layer": "top",
    "role": "ozonic, airy-green; the stand-in for 'Ozone'",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "high-impact: 10% (perfumery judgement).",
    "ifraConstituents": [],
    "flags": [
      "Not the same substance as p-Ethylbenzaldehyde (CAS 4748-78-1, restricted, STD 034). Physical state 'liquid' is assumed, not sourced; it does not matter for the table because no solubility is required for liquids, but confirm with the supplier sheet."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 105513 (Ethyl 2,2-dimethylhydrocinnamal); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/105513",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 67634-15-5 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "black_pepper_oil",
    "name": "Black pepper oil (Piper nigrum)",
    "cas": "8006-82-4",
    "layer": "top",
    "role": "dry spice-sparkle; pepper, pink pepper, nutmeg interpretations",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "No entry for black pepper oil in the IFRA 51st Annex (searched).",
      "Possibly in scope of the IFRA Limonene SPECIFICATION (STD 186). Composition not verified this session. Author decision A: kept, bought to the peroxide-value spec (IFRA STD 186/187)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135333140 (Black pepper oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135333140",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8006-82-4 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    },
    "purchaseSpec": "Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "cardamom_oil",
    "name": "Cardamom seed oil (Elettaria cardamomum)",
    "cas": "8000-66-6",
    "layer": "top",
    "role": "cool camphor-citrus spice",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 120%, not binding)",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [
      {
        "cas": "106-24-1",
        "name": "Geraniol",
        "pctInMaterial": 1,
        "annexNcsName": "Cardamom seed oil",
        "standard": "Geraniol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_037.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 4.7
      },
      {
        "cas": "5392-40-5",
        "name": "Citral",
        "pctInMaterial": 0.5,
        "annexNcsName": "Cardamom seed oil",
        "standard": "Citral",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_021.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.6
      }
    ],
    "flags": [
      "Possibly in scope of the IFRA Linalool / Limonene SPECIFICATIONS (STD 186/187). Composition not verified. Author decision A: kept, bought to the peroxide-value spec (IFRA STD 186/187)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 17397543 (Cardamom oil (NF)); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/17397543",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8000-66-6 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituents per IFRA Annex."
      }
    },
    "purchaseSpec": "Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "galbanum_oil",
    "name": "Galbanum oil (Ferula spp.)",
    "cas": "8023-91-4",
    "layer": "top",
    "role": "sharp green resin; violet-leaf and vert accents",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 2400%, not binding)",
    "stockBasis": "high-impact: 10% (perfumery judgement).",
    "ifraConstituents": [
      {
        "cas": "106-02-5",
        "name": "Cyclopentadecanolide",
        "pctInMaterial": 0.1,
        "annexNcsName": "Galbanum oil",
        "standard": "Cyclopentadecanolide",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_026.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 2.4
      }
    ],
    "flags": [
      "The CAS in perfumeCard.js CAS_REGISTRY for 'Galbanum' (9000-72-0) is not the galbanum-oil CAS used by IFRA and PubChem (8023-91-4). Out of scope here; noted for P1."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135281852 (Galbanum oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135281852",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8023-91-4 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituent per IFRA Annex."
      }
    }
  },
  {
    "id": "cis_3_hexenol",
    "name": "cis-3-Hexenol (leaf alcohol)",
    "cas": "928-96-1",
    "layer": "top",
    "role": "cut grass; green tea, cucumber, dew",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "high-impact: 10% (perfumery judgement).",
    "ifraConstituents": [],
    "flags": [
      "52nd Amendment adds standards for the related esters cis-3-hexenyl acetate/propionate/salicylate, not for the alcohol itself."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 5281167 (3-Hexenol); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/5281167",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 928-96-1 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "methyl_octine_carbonate",
    "name": "Methyl 2-nonynoate (methyl octine carbonate)",
    "cas": "111-80-8",
    "layer": "top",
    "role": "violet-leaf cucumber; the violet-leaf note itself",
    "physicalState": "liquid",
    "stocks": [
      0.001
    ],
    "ifraCat4MaxPct": 0.01,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "Cap 0.010% x 7.00 g = 0.0007 g neat. A 0.1% stock (author decision C) weighs 0.05-0.70 g at 7.00 g (0.05-1.00 g at 10.00 g) under the cap; a 1% stock would leave only 0.05-0.07 g.",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 8137 (Methyl 2-nonynoate); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/8137",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Methyl octine carbonate",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_064.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "hedione",
    "name": "Methyl dihydrojasmonate (Hedione)",
    "cas": "24851-98-7",
    "layer": "heart",
    "role": "transparent jasmine-air; the kit's diffusive floral carrier",
    "physicalState": "liquid",
    "stocks": [
      1,
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat; plus a 10% stock (author decision C) so a 4% AIR cologne at 7.00 g can weigh it under 0.71% neat (0.05 g floor).",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 102861 (Hedione); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/102861",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 24851-98-7 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "phenylethyl_alcohol",
    "name": "2-Phenylethanol (phenylethyl alcohol)",
    "cas": "60-12-8",
    "layer": "heart",
    "role": "soft rose petal; rose, peony, lotus",
    "physicalState": "liquid",
    "stocks": [
      1,
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (51st)",
    "stockBasis": "ordinary liquid, neat; plus a 10% stock (author decision C) so a 4% AIR cologne at 7.00 g can weigh it under 0.71% neat (0.05 g floor).",
    "ifraConstituents": [],
    "flags": [
      "52nd Amendment: 'Phenethyl alcohol' CAS 60-12-8 is on the list of NEW restriction standards (End of Consultation letter). MAC not yet published; re-check in Jan 2027."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 6054 (2-Phenylethanol); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/6054",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 60-12-8 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "citronellol",
    "name": "Citronellol",
    "cas": "106-22-9",
    "layer": "heart",
    "role": "fresh rose-geranium",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": 12,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "52nd Amendment: Citronellol is among the 15 REVISED restriction standards; new MAC not yet published."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 8842 (Citronellol); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/8842",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Citronellol",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_022.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "geraniol",
    "name": "Geraniol",
    "cas": "106-24-1",
    "layer": "heart",
    "role": "rosy-citrus floral; rose and geranium",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": 4.7,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "Also contributed by bergamot, petitgrain, cardamom and ylang rows: sum geraniol across rows against 4.7%."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 637566 (Geraniol); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/637566",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Geraniol",
        "amendment": "51",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_037.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "benzyl_acetate",
    "name": "Benzyl acetate",
    "cas": "140-11-4",
    "layer": "heart",
    "role": "fruity jasmine body",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 8785 (Benzyl acetate); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/8785",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 140-11-4 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "indole",
    "name": "Indole",
    "cas": "120-72-9",
    "layer": "heart",
    "role": "narcotic-animalic white-flower depth; civet and hyraceum stand-in",
    "physicalState": "solid",
    "physicalStateSource": {
      "name": "PubChem CID 798, Melting Point: 52 °C (Merck Index), 52.5 °C (PhysProp)",
      "url": "https://pubchem.ncbi.nlm.nih.gov/compound/798",
      "accessed": "2026-11-27"
    },
    "stocks": [
      1,
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; 10% / 1% ethanol stocks below that (10% confirmed by the cited solubility).",
    "solubility": {
      "ethanol": "1 g in 2 mL of 70% alcohol (Fenaroli via PubChem); 'Soluble (in ethanol)' (JECFA via PubChem)",
      "supports10pctStock": true
    },
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 798 (Indole); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/798",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 120-72-9 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      },
      "solubilitySource": {
        "name": "PubChem CID 798, Solubility section (Fenaroli's Handbook of Flavor Ingredients; JECFA)",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/798#section=Solubility",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "beta_ionone",
    "name": "beta-Ionone",
    "cas": "14901-07-6",
    "layer": "heart",
    "role": "violet-orris-woody; iris, violet, osmanthus",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "Not covered by the 'Methyl ionone, mixed isomers' standard (STD 063), which lists other CAS numbers."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 26955 (4-(2,6,6-Trimethyl-1-cyclohexen-1-yl)-3-buten-2-one); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/26955",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 14901-07-6 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "gamma_undecalactone",
    "name": "gamma-Undecalactone (aldehyde C-14 'peach')",
    "cas": "104-67-6",
    "layer": "heart",
    "role": "creamy peach skin; peach blossom, osmanthus, gardenia",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "high-impact: 10% (perfumery judgement).",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 7714 (Gamma-undecalactone); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/7714",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 104-67-6 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "hydroxycitronellal",
    "name": "Hydroxycitronellal",
    "cas": "107-75-5",
    "layer": "heart",
    "role": "dewy lily-of-the-valley; muguet, cyclamen, sea lily",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": 2.1,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 7888 (Hydroxycitronellal); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/7888",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Hydroxycitronellal",
        "amendment": "51",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_043.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "eugenol",
    "name": "Eugenol",
    "cas": "97-53-0",
    "layer": "heart",
    "role": "clove-carnation spice",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": 2.5,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "high-impact: 10% (perfumery judgement).",
    "ifraConstituents": [],
    "flags": [
      "Also contributed by the ylang row (0.34%): sum eugenol across rows against 2.5%."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 3314 (Eugenol); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/3314",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Eugenol",
        "amendment": "51",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_035.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "ylang_ylang_oil",
    "name": "Ylang ylang oil, extra (Cananga odorata)",
    "cas": "8006-81-3",
    "layer": "heart",
    "role": "custard-banana narcotic floral; tiare, tuberose",
    "physicalState": "liquid",
    "stocks": [
      0.1
    ],
    "ifraCat4MaxPct": 0.73,
    "ifraCat4MaxPctBasis": "own standard (constituent-derived ceilings all higher; lowest is isoeugenol 0.11/0.99% = 11.1%)",
    "stockBasis": "Cap 0.73% x 7.00 g = 0.051 g neat, which leaves essentially no neat window; 10% stock.",
    "ifraConstituents": [
      {
        "cas": "120-51-4",
        "name": "Benzyl benzoate",
        "pctInMaterial": 5.73,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Benzyl benzoate",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_009.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 4.8
      },
      {
        "cas": "118-58-1",
        "name": "Benzyl salicylate",
        "pctInMaterial": 3.35,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Benzyl salicylate",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_011.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 7.3
      },
      {
        "cas": "4602-84-0",
        "name": "Farnesol",
        "pctInMaterial": 1.36,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Farnesol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_036.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.2
      },
      {
        "cas": "97-54-1",
        "name": "Isoeugenol",
        "pctInMaterial": 0.99,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Isoeugenol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_048.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.11
      },
      {
        "cas": "106-24-1",
        "name": "Geraniol",
        "pctInMaterial": 0.64,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Geraniol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_037.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 4.7
      },
      {
        "cas": "97-53-0",
        "name": "Eugenol",
        "pctInMaterial": 0.34,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Eugenol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_035.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 2.5
      },
      {
        "cas": "100-51-6",
        "name": "Benzyl alcohol",
        "pctInMaterial": 0.24,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Benzyl alcohol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_008.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 2.5
      },
      {
        "cas": "93-29-8",
        "name": "Isoeugenyl acetate",
        "pctInMaterial": 0.12,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Isoeugenyl acetate",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_255.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 0.99
      },
      {
        "cas": "140-29-4",
        "name": "Benzyl cyanide",
        "pctInMaterial": 0.02,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Benzyl cyanide",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_112.pdf",
        "standardAmendment": "38",
        "standardCat4MaxPct": 0.01,
        "standardCat4Basis": "STD 112 notebox: natural contributions authorised while benzyl cyanide in the finished product ≤ 0.01% (100 ppm)"
      },
      {
        "cas": "140-67-0",
        "name": "Estragole",
        "pctInMaterial": 0.02,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Estragole",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_099.pdf",
        "standardAmendment": "51",
        "standardCat4MaxPct": 0.014
      },
      {
        "cas": "5392-40-5",
        "name": "Citral",
        "pctInMaterial": 0.01,
        "annexNcsName": "Ylang, Ylang oil extra",
        "standard": "Citral",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_021.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.6
      }
    ],
    "flags": [
      "Contains traces (0.02%) of Benzyl cyanide. STD 112 (Amendment 38) prohibits it as an ingredient, but its notebox authorises natural sources \"as long as the level of Benzyl cyanide in the finished product does not exceed 0.01% (100 ppm)\". At the 0.73% cap ylang brings at most 0.000146% (1.46 ppm), about 68x under. Carried as a constituent row.",
      "Ylang is linalool-bearing; IFRA Linalool SPECIFICATION scope not verified. Author decision A: kept, bought to the peroxide-value spec (IFRA STD 186/187)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135323667 (Ylang ylang oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135323667",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Ylang ylang extracts",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_084.pdf",
        "accessed": "2026-11-27"
      }
    },
    "purchaseSpec": "Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "iso_e_super",
    "name": "OTNE (Iso E Super)",
    "cas": "54464-57-2",
    "layer": "base",
    "role": "velvety cedar-amber halo; orris and woody extension",
    "physicalState": "liquid",
    "stocks": [
      1,
      0.1
    ],
    "ifraCat4MaxPct": 20,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "ordinary liquid, neat; plus a 10% stock (author decision C) so a 4% AIR cologne at 7.00 g can weigh it under 0.71% neat (0.05 g floor).",
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 108242 (1-(1,2,3,4,5,6,7,8-Octahydro-2,3,8,8-tetramethyl-2-naphthalenyl)ethanone); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/108242",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "1-(1,2,3,4,5,6,7,8 Octahydro-2,3,8,8-tetramethyl-2-naphthalenyl)ethan-1-one (OTNE)",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_068.pdf",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "cedarwood_atlas_oil",
    "name": "Cedarwood oil, Atlas (Cedrus atlantica)",
    "cas": "8023-85-6",
    "layer": "base",
    "role": "dry pencil-shaving wood; cedar, driftwood, salt cedar",
    "physicalState": "liquid",
    "stocks": [
      1,
      0.1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 100%, not binding)",
    "stockBasis": "ordinary liquid, neat; plus a 10% stock (author decision C) so a 4% AIR cologne at 7.00 g can weigh it under 0.71% neat (0.05 g floor).",
    "ifraConstituents": [
      {
        "cas": "469-61-4",
        "name": "alpha-Cedrene",
        "pctInMaterial": 1.5,
        "annexNcsName": "Cedarwood oil, Atlas",
        "standard": "Cedrene",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_197.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.5
      },
      {
        "cas": "475-20-7",
        "name": "Longifolene",
        "pctInMaterial": 0.6,
        "annexNcsName": "Cedarwood oil, Atlas",
        "standard": "Longifolene",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_199.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.5
      }
    ],
    "flags": [
      "Chosen over Virginian cedarwood (CAS 8000-27-9, the CAS in CAS_REGISTRY), which the IFRA Annex lists at 24.3% alpha- + 5.9% beta-cedrene: that oil's own ceiling would be 1.5/0.302 = 4.97%.",
      "PubChem lists 92201-55-3 as another Atlas CAS; IFRA Annex gives 8023-85-6 as principal."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135350485 (Cedarwood oil atlas); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135350485",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8023-85-6 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituents per IFRA Annex."
      }
    }
  },
  {
    "id": "vetiver_oil",
    "name": "Vetiver oil (Chrysopogon zizanioides)",
    "cas": "8016-96-4",
    "layer": "base",
    "role": "earthy-smoky root; vetiver, oakmoss and seaweed stand-ins",
    "physicalState": "liquid (viscous)",
    "stocks": [
      0.5
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 500%, not binding)",
    "stockBasis": "viscous base: 50% in ethanol (locked decision 9). Viscosity is a perfumery judgement, not a cited value.",
    "ifraConstituents": [
      {
        "cas": "469-61-4",
        "name": "alpha-Cedrene",
        "pctInMaterial": 0.2,
        "annexNcsName": "Vetiver oil (all origins)",
        "standard": "Cedrene",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_197.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.5
      },
      {
        "cas": "546-28-1",
        "name": "beta-Cedrene",
        "pctInMaterial": 0.1,
        "annexNcsName": "Vetiver oil (all origins)",
        "standard": "Cedrene",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_197.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.5
      }
    ],
    "flags": [
      "Not Acetylated vetiver oil (STD 002, restricted; the 52nd Amendment adds an antioxidant specification to it)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135327561 (Vetiver oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135327561",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8016-96-4 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituents per IFRA Annex."
      }
    }
  },
  {
    "id": "patchouli_oil",
    "name": "Patchouli oil (Pogostemon cablin)",
    "cas": "8014-09-3",
    "layer": "base",
    "role": "dark earth-camphor; patchouli and the oud stand-ins",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "No entry for patchouli in the IFRA 51st Annex (searched)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135316842 (Patchouli oil); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135316842",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8014-09-3 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "javanol",
    "name": "Javanol (Givaudan)",
    "cas": "198404-98-7",
    "layer": "base",
    "role": "creamy sandalwood; every sandalwood note (no real Santalum in the kit)",
    "physicalState": "liquid (viscous)",
    "stocks": [
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "high-impact: Givaudan states it 'can also be used at very low dosage (below 0.1%)'; 10% / 1%.",
    "ifraConstituents": [],
    "flags": [
      "CAS from Givaudan's own product page; PubChem has no compound record for this CAS (lookup returned 404)."
    ],
    "sources": {
      "casSource": {
        "name": "Givaudan, Javanol product data sheet (Giv code 8754013), 'CAS no. 198404-98-7'",
        "url": "https://www.givaudan.com/print/1314536",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 198404-98-7 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "ambrox",
    "name": "(-)-Ambroxide (Ambrox / Ambrofix / Ambroxan)",
    "cas": "6790-58-5",
    "layer": "base",
    "role": "dry mineral amber; the ambergris and sea-salt stand-in",
    "physicalState": "solid",
    "physicalStateSource": {
      "name": "Givaudan Ambrofix data sheet: 'Appearance White Crystals'; Symrise Ambroxide Cryst. sheet: 'whitish to white crystals'; Ventós Ambroxan Natural Biotech (CAS 6790-58-5): \"CRYSTALLINE POWDER\", melting point 75-78 °C",
      "url": "https://www.givaudan.com/print/1314081",
      "accessed": "2026-11-27"
    },
    "stocks": [
      1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; a 1% ethanol stock below that (author ruling: no 10% stock until a quantitative 10% solubility source is found).",
    "solubility": {
      "ethanol": "\"SOLUBLE IN ETHANOL\" (Ventós specification sheet, Ambroxan Natural Biotech), qualitative only. Read conservatively by the USP descriptive terms (\"Soluble\" = 1 part in 10-30 parts solvent, i.e. at least about 3%), it supports the 1% stock; it does not confirm 10%.",
      "supports10pctStock": false,
      "supports1pctStock": true
    },
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 10857465 ((-)-Ambroxide); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/10857465",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 6790-58-5 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      },
      "solubilitySource": {
        "name": "Ventós specification sheet, Ambroxan Natural Biotech; interpreted with USP 32–NF 27 General Notices 5.30 Description and Solubility: \"Soluble\" = from 10 to 30 parts of solvent for 1 part of solute",
        "url": "https://www.ventos.com/index.php/fr/?option=com_evsa&task=documentacion.mostrar&codi=001_IWXG4VBSUP_10451",
        "accessed": "2026-11-27",
        "termsSource": {
          "name": "USP 32–NF 27 General Notices 5.30 Description and Solubility: \"Soluble\" = from 10 to 30 parts of solvent for 1 part of solute",
          "url": "https://www.drugfuture.com/Pharmacopoeia/USP32/pub/data/v32270/usp32nf27s0_uspgens6.html",
          "accessed": "2026-11-27"
        }
      }
    }
  },
  {
    "id": "cashmeran",
    "name": "DPMI (Cashmeran)",
    "cas": "33704-61-9",
    "layer": "base",
    "role": "musky-woody 'cashmere' warmth",
    "physicalState": "solid",
    "stocks": [
      1,
      0.01
    ],
    "ifraCat4MaxPct": 3.8,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; a 1% ethanol stock below that (author ruling: no 10% stock until a quantitative 10% solubility source is found).",
    "solubility": {
      "ethanol": "\"SOLUBLE IN ETHANOL\" (Ventós specification sheet, Cashmeran IFF), qualitative only. Read conservatively by the USP descriptive terms (\"Soluble\" = 1 part in 10-30 parts solvent, i.e. at least about 3%), it supports the 1% stock; it does not confirm 10%.",
      "supports10pctStock": false,
      "supports1pctStock": true
    },
    "ifraConstituents": [],
    "flags": [
      "Low-melting (ca. 27 °C): may be liquid on a warm day. Ventós: \"MANUFACTURER RECOMMENDS HEATING AT 65°C MAXIMUM\" — warm the closed bottle, never near the ethanol."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 92292 ((+-)-Cashmeran); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/92292",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "6,7-Dihydro-1,1,2,3,3-pentamethyl-4(5H)-indanone (DPMI)",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_028.pdf",
        "accessed": "2026-11-27"
      },
      "solubilitySource": {
        "name": "Ventós specification sheet, Cashmeran IFF; interpreted with USP 32–NF 27 General Notices 5.30 Description and Solubility: \"Soluble\" = from 10 to 30 parts of solvent for 1 part of solute",
        "url": "https://www.ventos.com/index.php/en/?option=com_evsa&task=documentacion.mostrar&codi=001_Y95HYUZSFL_3057",
        "accessed": "2026-11-27",
        "termsSource": {
          "name": "USP 32–NF 27 General Notices 5.30 Description and Solubility: \"Soluble\" = from 10 to 30 parts of solvent for 1 part of solute",
          "url": "https://www.drugfuture.com/Pharmacopoeia/USP32/pub/data/v32270/usp32nf27s0_uspgens6.html",
          "accessed": "2026-11-27"
        }
      }
    },
    "physicalStateSource": {
      "name": "Ventós specification sheet, Cashmeran IFF, CAS 33704-61-9: \"CLEAR MOBILE LIQUID/SOLID\", melting point \"CA. 27\" °C (low-melting solid)",
      "url": "https://www.ventos.com/index.php/en/?option=com_evsa&task=documentacion.mostrar&codi=001_Y95HYUZSFL_3057",
      "accessed": "2026-11-27"
    }
  },
  {
    "id": "ethylene_brassylate",
    "name": "Ethylene brassylate",
    "cas": "105-95-3",
    "layer": "base",
    "role": "sweet macrocyclic musk; white musk, ambrette, deer-musk stand-in",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "Physical state 'liquid' assumed, not sourced (see open questions)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 61014 (Ethylene brassylate); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/61014",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 105-95-3 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "habanolide",
    "name": "(12E)-Oxacyclohexadecen-2-one (Habanolide)",
    "cas": "111879-80-2",
    "layer": "base",
    "role": "clean metallic macrocyclic musk; second musk so musk notes are not one molecule",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [],
    "flags": [
      "52nd Amendment: a standard for Oxacyclohexadecen-2-one (CAS 34902-57-3) was proposed and then WITHDRAWN (End of Consultation letter section 3.8). Confirm the commercial Habanolide CAS (111879-80-2 vs 34902-57-3) with the supplier.",
      "Physical state 'liquid' assumed, not sourced."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 9856149 (Oxacyclohexadecen-2-one, (12E)-); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/9856149",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 111879-80-2 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "coumarin",
    "name": "Coumarin",
    "cas": "91-64-5",
    "layer": "base",
    "role": "tonka hay-almond; tonka, tobacco, heliotrope",
    "physicalState": "solid",
    "physicalStateSource": {
      "name": "PubChem CID 323, Melting Point 71 °C (CRC Handbook)",
      "url": "https://pubchem.ncbi.nlm.nih.gov/compound/323",
      "accessed": "2026-11-27"
    },
    "stocks": [
      1,
      0.01
    ],
    "ifraCat4MaxPct": 1.5,
    "ifraCat4MaxPctBasis": "own standard",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; a 1% ethanol stock below that. No 10% stock: measured saturation is 9.8% w/w at 20 °C and 3.4% at 10 °C.",
    "solubility": {
      "ethanol": "Measured in pure ethanol: mole fraction 0.007102 at 278.15 K, 0.01096 at 283.15 K, 0.03308 at 293.15 K (Huang et al., Fluid Phase Equilib. 2015, 394, 148-155, via NIST ThermoML) = about 2.2% w/w at 5 °C, 3.4% at 10 °C, 9.8% at 20 °C (converted with M = 146.14 and 46.07 g/mol). A 10% stock would crystallise below about 20 °C; the 1% stock stays dissolved down to 5 °C. CRC: \"Soluble in ethanol\".",
      "supports10pctStock": false,
      "supports1pctStock": true
    },
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 323 (Coumarin); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/323",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": "Coumarin",
        "amendment": "49",
        "inForceSet": "51st Amendment (current until the 52nd is notified)",
        "url": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_023.pdf",
        "accessed": "2026-11-27"
      },
      "solubilitySource": {
        "name": "Huang, Wang, Hao, Ouyang, Gao, Bao, Wang, Yin, \"Determination and correlation of solubility and solution thermodynamics of coumarin in different pure solvents\", Fluid Phase Equilib. 2015, 394, 148-155, DOI 10.1016/j.fluid.2015.03.022 (NIST ThermoML data set, ethanol block)",
        "url": "https://trc.nist.gov/ThermoML/10.1016/j.fluid.2015.03.022.html",
        "accessed": "2026-11-27",
        "secondary": {
          "name": "PubChem CID 323, Solubility section (CRC Handbook, 83rd ed.)",
          "url": "https://pubchem.ncbi.nlm.nih.gov/compound/323#section=Solubility",
          "accessed": "2026-11-27"
        }
      }
    }
  },
  {
    "id": "vanillin",
    "name": "Vanillin",
    "cas": "121-33-5",
    "layer": "base",
    "role": "vanilla; vanilla absolute, beeswax, amber",
    "physicalState": "solid",
    "physicalStateSource": {
      "name": "PubChem CID 1183, Melting Point 81-83 °C (Merck Index)",
      "url": "https://pubchem.ncbi.nlm.nih.gov/compound/1183",
      "accessed": "2026-11-27"
    },
    "stocks": [
      1,
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; 10% / 1% ethanol stocks below that (10% confirmed by the cited solubility).",
    "solubility": {
      "ethanol": "'in ethanol is 1:2 vanillin:ethanol' (Merck Index via PubChem); 'soluble in 2 parts 95% alcohol' (Sax via PubChem)",
      "supports10pctStock": true
    },
    "ifraConstituents": [],
    "flags": [],
    "sources": {
      "casSource": {
        "name": "PubChem CID 1183 (Vanillin); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/1183",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 121-33-5 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      },
      "solubilitySource": {
        "name": "PubChem CID 1183, Solubility section (Merck Index; Sax's Dangerous Properties)",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/1183#section=Solubility",
        "accessed": "2026-11-27"
      }
    }
  },
  {
    "id": "benzoin_siam_resinoid",
    "name": "Benzoin resinoid, Siam (Styrax tonkinensis)",
    "cas": "84012-39-5",
    "layer": "base",
    "role": "balsamic vanilla resin; benzoin, styrax and honey stand-ins",
    "physicalState": "viscous resinoid",
    "stocks": [
      0.5
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 110% via isoeugenol 0.11/0.1%, not binding alone)",
    "stockBasis": "viscous base: 50% in ethanol (locked decision 9).",
    "ifraConstituents": [
      {
        "cas": "103-41-3",
        "name": "Benzyl cinnamate",
        "pctInMaterial": 0.36,
        "annexNcsName": "Benzoin resinoid, Siam",
        "standard": "Benzyl cinnamate",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_010.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 2
      },
      {
        "cas": "104-54-1",
        "name": "Cinnamic alcohol",
        "pctInMaterial": 0.36,
        "annexNcsName": "Benzoin resinoid, Siam",
        "standard": "Cinnamic alcohol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_017.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.2
      },
      {
        "cas": "120-51-4",
        "name": "Benzyl benzoate",
        "pctInMaterial": 0.25,
        "annexNcsName": "Benzoin resinoid, Siam",
        "standard": "Benzyl benzoate",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_009.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 4.8
      },
      {
        "cas": "97-54-1",
        "name": "Isoeugenol",
        "pctInMaterial": 0.1,
        "annexNcsName": "Benzoin resinoid, Siam",
        "standard": "Isoeugenol",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_048.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.11
      },
      {
        "cas": "104-55-2",
        "name": "Cinnamic aldehyde",
        "pctInMaterial": 0.01,
        "annexNcsName": "Benzoin resinoid, Siam",
        "standard": "Cinnamic aldehyde",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_018.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.25
      }
    ],
    "flags": [
      "Resinoids are often sold pre-dissolved in DEP/BB/DPG; the kit needs an ethanol-only 50% stock (decision 9). Supplier must confirm a solvent-free resinoid. Not Styrax (STD 078) and not Peru balsam (STD 071).",
      "CAS_REGISTRY uses 9000-73-1 for 'Benzoin Siam'; IFRA Annex and PubChem tie Siam benzoin to 84012-39-5."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135321545 (Siam benzoin); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135321545",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 84012-39-5 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituents per IFRA Annex."
      }
    }
  },
  {
    "id": "labdanum_resinoid",
    "name": "Labdanum resinoid (Cistus ladaniferus)",
    "cas": "89997-74-0",
    "layer": "base",
    "role": "leathery amber resin; amber, leather, the animalic stand-ins",
    "physicalState": "viscous resinoid",
    "stocks": [
      0.5
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 833%, not binding)",
    "stockBasis": "viscous base: 50% in ethanol.",
    "ifraConstituents": [
      {
        "cas": "100-52-7",
        "name": "Benzaldehyde",
        "pctInMaterial": 0.03,
        "annexNcsName": "Labdanum resinoid",
        "standard": "Benzaldehyde",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_007.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 0.25
      }
    ],
    "flags": [
      "The IFRA Annex lists several labdanum/cistus qualities with different constituent loads (cistus oil: methyl eugenol, eugenol, carvone, benzaldehyde 0.9%). The resinoid is the lightest; buy that quality."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135358317 (Cistus ladaniferus, ext.); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135358317",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 89997-74-0 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituent per IFRA Annex."
      }
    }
  },
  {
    "id": "olibanum_oil",
    "name": "Olibanum oil (frankincense, Boswellia spp.)",
    "cas": "8016-36-2",
    "layer": "base",
    "role": "peppery-citrus incense; frankincense, elemi, myrrh interpretations",
    "physicalState": "liquid",
    "stocks": [
      1
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted (constituent-derived ceiling 280% via thujone, not binding)",
    "stockBasis": "ordinary liquid, neat.",
    "ifraConstituents": [
      {
        "cas": "471-15-8",
        "name": "beta-Thujone",
        "pctInMaterial": 0.4,
        "annexNcsName": "Olibanum oil",
        "standard": "Thujone",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_102.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.4
      },
      {
        "cas": "546-80-5",
        "name": "alpha-Thujone",
        "pctInMaterial": 0.1,
        "annexNcsName": "Olibanum oil",
        "standard": "Thujone",
        "standardUrl": "https://d3t14p1xronwr0.cloudfront.net/docs/standards/IFRA_STD_102.pdf",
        "standardAmendment": "49",
        "standardCat4MaxPct": 1.4
      }
    ],
    "flags": [
      "Possibly in scope of the IFRA Limonene SPECIFICATION (STD 186). Composition not verified. Author decision A: kept, bought to the peroxide-value spec (IFRA STD 186/187). Layer is arguable (top-heart incense, base-weighted here)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem SID 135343542 (Olibanum (substance record also titled 'Olibanum oil' in other SIDs)); retrieved via PubChem xref RN lookup of this CAS",
        "url": "https://pubchem.ncbi.nlm.nih.gov/substance/135343542",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 8016-36-2 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27).",
        "note": "No own standard; constituents per IFRA Annex."
      }
    },
    "purchaseSpec": "Buy with a supplier certificate of analysis stating an IFRA-compliant peroxide value (< 20 mmol/L)."
  },
  {
    "id": "isobutyl_quinoline",
    "name": "6-sec-Butylquinoline (sold as 'isobutyl quinoleine')",
    "cas": "65442-31-1",
    "layer": "base",
    "role": "bitter green-leather; leather, birch-tar, castoreum, oud and saffron stand-ins",
    "physicalState": "liquid",
    "stocks": [
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "very high-impact: 10% / 1% (perfumery judgement).",
    "ifraConstituents": [],
    "flags": [
      "PubChem's record title is 6-(sec-butyl)quinoline with synonym 'isobutylquinoleine'; true 6-isobutylquinoline is a different CID (109640). Confirm what the supplier sells. Not Quinoline (CAS 91-22-5, PROHIBITED, STD 178) and not the tetrahydroquinolines (STD 215/216)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 103401 (6-(sec-Butyl)quinoline); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/103401",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 65442-31-1 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      }
    }
  },
  {
    "id": "evernyl",
    "name": "Methyl 2,4-dihydroxy-3,6-dimethylbenzoate (Evernyl / Veramoss)",
    "cas": "4707-47-5",
    "layer": "base",
    "role": "the oakmoss stand-in (real oakmoss is under a restriction + purity specification)",
    "physicalState": "solid",
    "stocks": [
      1,
      0.1,
      0.01
    ],
    "ifraCat4MaxPct": null,
    "ifraCat4MaxPctBasis": "unrestricted",
    "stockBasis": "solid: weighed directly as crystals (stock 1.0) when the dose is ≥ 0.05 g on the 0.01 g scale; 10% / 1% ethanol stocks below that (10% confirmed by the measured solubility).",
    "solubility": {
      "ethanol": "Measured in pure ethanol: mole fraction 0.0781 at 283.15 K, 0.0938 at 293.15 K (Chen et al., J. Chem. Eng. Data 2017, 62, 292-302, via NIST ThermoML) = about 26.5% w/w at 10 °C and 30.6% w/w at 20 °C (converted with M = 196.20 and 46.07 g/mol). Ventós: \"SOLUBLE IN ETHANOL\".",
      "supports10pctStock": true
    },
    "ifraConstituents": [],
    "flags": [
      "Distinct from the prohibited 2,4-Dihydroxy-3-methylbenzaldehyde (STD 131) and from Oakmoss extracts (STD 067)."
    ],
    "sources": {
      "casSource": {
        "name": "PubChem CID 78435 (Atraric Acid (methyl 2,4-dihydroxy-3,6-dimethylbenzoate)); CAS listed among the record's synonyms",
        "url": "https://pubchem.ncbi.nlm.nih.gov/compound/78435",
        "accessed": "2026-11-27"
      },
      "ifraSource": {
        "standard": null,
        "unrestricted": true,
        "amendment": "51st",
        "url": "https://ifrafragrance.org/standards-library",
        "accessed": "2026-11-27",
        "evidence": "CAS 4707-47-5 appears in no Standard of the IFRA Standards Library (all 263 standards scraped, and the full text of every standard PDF searched, on 2026-11-27)."
      },
      "solubilitySource": {
        "name": "Chen, Ge, Pu, He, Xi, \"Solubility and Thermodynamic Behavior of Veramoss in Different Pure Solvents and {Ethanol + Water} Mixtures from T = 283.15 to 333.15 K\", J. Chem. Eng. Data 2017, 62(1), 292-302, DOI 10.1021/acs.jced.6b00646 (NIST ThermoML data set, ethanol block)",
        "url": "https://trc.nist.gov/ThermoML/10.1021/acs.jced.6b00646.html",
        "accessed": "2026-11-27"
      }
    },
    "physicalStateSource": {
      "name": "Ventós specification sheet, Veramoss IFF (Evernyl), CAS 4707-47-5: \"CRYSTALLINE SOLID\", \"WHITE TO PALE YELLOW\"",
      "url": "https://www.ventos.com/fr/?option=com_evsa&task=documentacion.mostrar&codi=001_EBM2CWXTY9_7663",
      "accessed": "2026-11-27"
    }
  }
]);
