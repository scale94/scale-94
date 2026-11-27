// Tesseract manifest generator (pure; moved verbatim from LatentCollider.jsx).
export function generateManifestMarkdown(card, tesseract, living = null, result = null, narrative = null) {
  const { hash, encryptedFormula } = tesseract;
  const { specificGravity, flashPoint, macDays, dilutionRatio, ciphertext } = encryptedFormula;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const evapT = (card.evap[0] * 100).toFixed(0);
  const evapH = (card.evap[1] * 100).toFixed(0);
  const evapB = (card.evap[2] * 100).toFixed(0);
  const loadingPct = (dilutionRatio * 100).toFixed(1);

  const domPair = card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × ');

  const noteLines = [
    `ᛏ TOP    ${card.topNotes.join(' · ')}`,
    `ᚺ HEART  ${card.heartNotes.join(' · ')}`,
    `ᛒ BASE   ${card.baseNotes.join(' · ')}`,
  ].join('\n');

  const cRows = [];
  const ct = ciphertext || '';
  for (let i = 0; i < Math.min(ct.length, 512); i += 64) cRows.push(ct.slice(i, i + 64));
  if (ct.length > 512) cRows.push(`… [${ct.length - 512} chars omitted]`);

  return `# ECO_Sx TRANSMUTATION MANIFEST

\`\`\`
VAULT    ${hash}
COMPILED ${ts}
STATE    ◈ MANIFEST COMPILED
\`\`\`

---

## ACCORD · ${card.name}

\`\`\`
${noteLines}

CONC         ${card.conc} · ${card.concPct}
LONGEVITY    ${card.longevity}
NODE CLASS   ${card.nodeClass}
POLARITY     ${card.polLabel || 'MERIDIAN'}
OLFACTIVE    ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}
EVAP CURVE   TOP ${evapT}% / HEART ${evapH}% / BASE ${evapB}%
LOADING      ${loadingPct}%
FLASH POINT  ${flashPoint}°C
SG           ${specificGravity} g/ml
MACERATION   ${macDays} days
\`\`\`

---

## COLLISION MANIFOLD // RAW VECTOR MATRIX

\`\`\`
DOMAIN         ${domPair}
NODE PAIR      ${result?.nodeIdA ?? '—'} × ${result?.nodeIdB ?? '—'}
HASH           ${hash.slice(0, 32)}
               ${hash.slice(32)}
SPACE          1536-dimensional · OCK v1.1.0
P(RECOLL)      < 10⁻⁷⁷

COS(θ)         ${result?.cosine != null ? result.cosine.toFixed(4) : '—'}
θ              ${result?.angle != null ? result.angle.toFixed(1) + '°' : '—'}
SPHERE SIM     ${result?.sphereSim != null ? result.sphereSim.toFixed(4) : '—'}
NOVELTY        ${result?.novelty != null ? (result.novelty * 100).toFixed(0) + '%' : '—'}  (‖P⊥‖ = ${result?.projNorm != null ? result.projNorm.toFixed(3) : '—'})
COHERENCE      ${result?.coherence != null ? result.coherence.toFixed(4) : '—'}  (H = ${result?.entropy != null ? result.entropy.toFixed(3) : '—'})
POST-SAPON.    ${result?.postSaponificationSim != null ? result.postSaponificationSim.toFixed(4) : '—'}  (32 iter · 7% decay)
VIABILITY      ${result?.vClass ?? '—'}  (${result?.viability != null ? result.viability.toFixed(4) : '—'})
ARCHETYPE      ${narrative?.archetype ?? '—'}${narrative?.archetypeSigma != null ? `  [σ ≈ ${narrative.archetypeSigma.toFixed(2)}]` : ''}
\`\`\`

---

## FISH SCALE GEOMETRY // DIMENSIONAL MATRIX

\`\`\`
EVAP CURVE     TOP ${evapT}% / HEART ${evapH}% / BASE ${evapB}%
\`\`\`

### CONVERGENCE AXES — shared conceptual DNA
\`\`\`
${(result?.convergence || []).map(d => `${d.name.toUpperCase().padEnd(16)} contrib=${d.contrib.toFixed(3)}  vA=${d.vA.toFixed(3)}  vB=${d.vB.toFixed(3)}`).join('\n') || '—'}
\`\`\`

### DIVERGENCE AXES — maximum orthogonality
\`\`\`
${(result?.divergence || []).map(d => `${d.name.toUpperCase().padEnd(16)} Δ=${d.delta.toFixed(3)}  vA=${d.vA.toFixed(3)}  vB=${d.vB.toFixed(3)}`).join('\n') || '—'}
\`\`\`

### IRREDUCIBLE PARADOXES — survive 32× saponification
\`\`\`
${(result?.paradoxes || []).map(p => `${p.name.toUpperCase().padEnd(16)} residual=${p.residual.toFixed(3)}  original_Δ=${p.original.toFixed(3)}`).join('\n') || '—'}
\`\`\`

### PERIOD-3 SANCTUARIES — transient order pockets in chaos
\`\`\`
${(narrative?.sanctuaries || []).map(s => `center=${s.center.toFixed(3)}  width=${s.width.toFixed(3)}  size=${s.size}  members=[${s.members.join(', ')}]`).join('\n') || '— none detected —'}
\`\`\`

### CLUSTER METRICS
\`\`\`
INTERFERENCE   ${narrative?.meta?.interference != null ? narrative.meta.interference.toFixed(3) : '—'}  (sparsity × curvature)
CATALYSIS      ${narrative?.meta?.catalysis != null ? narrative.meta.catalysis.toFixed(3) : '—'}  (volatility × curvature)
RESONANCE      ${narrative?.meta?.resonanceFreq != null ? narrative.meta.resonanceFreq.toFixed(3) : '—'}  (density harmonic mean)
TURBULENCE     ${narrative?.meta?.turbulence != null ? narrative.meta.turbulence.toFixed(4) : '—'}  (volΔ × interference)
\`\`\`

### SUBATOMIC DECAY ARC — Feigenbaum bifurcation cascade (δ=4.669 · α=2.503)
\`\`\`
${(narrative?.decayArc || []).map(ph => `${ph.time.padEnd(12)} ${ph.glyph} ${ph.shell.padEnd(10)} ${ph.regime}\n${''.padEnd(13)} ${ph.patch}\n${''.padEnd(13)} notes=[${ph.notes.join(', ')}]`).join('\n\n') || '—'}
\`\`\`

---

## ENCRYPTED FORMULA

\`\`\`
CIPHER  AES-256-GCM · RSA-OAEP-2048
BLAKE3  INTEGRITY BOUND

${cRows.join('\n')}
\`\`\`
${living ? `
---

## § LIVING SIGNATURE

This accord carries the irreducible signature of one witness. The substituted note
was selected from the signature-grade pool by deterministic hash of the witness's
identity bound to this accord coordinate. The substitution is permanent for this
witness, and unique among all possible witnesses.

\`\`\`
LAYER         ${living.layer.toUpperCase()}
NOTE          ${living.newNote}  (was: ${living.oldNote})
ENTROPY       ${living.editionEntropy}
WITNESS HASH  ${living.witnessHash}
PROTOCOL      HS256 · 24h sovereign key · server-deterministic
\`\`\`

The molecule that is yours did not exist before this transmission. It does now.
` : ''}`;
}
