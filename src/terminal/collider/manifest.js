// Tesseract manifest generator (pure). Honesty rule (spec decision 13):
// anything that reads like a lab measurement is calculated from cited data or
// cut, so the invented concentration, wear time, evaporation split, loading,
// flash point, density, maceration and the fake encrypted formula are gone.
// Strength is set at the altar by the element (P3).
// What actually ran at crystallize (scent-aether P2, plan ruling 8): a statement,
// not a probability. Anything short of a real envelope says so.
export function sealLine(seal) {
  return seal?.state === 'sealed'
    ? 'ML-KEM-768 encapsulation + 32-byte chaos salt, both fresh per seal'
    : 'none — this card was not sealed';
}

export function generateManifestMarkdown(card, tesseract, result = null, narrative = null) {
  const { hash } = tesseract;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const domPair = card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × ');

  const noteLines = [
    `ᛏ TOP    ${card.topNotes.join(' · ')}`,
    `ᚺ HEART  ${card.heartNotes.join(' · ')}`,
    `ᛒ BASE   ${card.baseNotes.join(' · ')}`,
  ].join('\n');

  return `# ECO_Sx TRANSMUTATION MANIFEST

\`\`\`
COMPILED ${ts}
STATE    ◈ MANIFEST COMPILED
\`\`\`

---

## ACCORD · ${card.name}

\`\`\`
${noteLines}

STRENGTH     set at the altar by your element
NODE CLASS   ${card.nodeClass}
POLARITY     ${card.polLabel || 'MERIDIAN'}
OLFACTIVE    ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}
\`\`\`

---

## COLLISION MANIFOLD // RAW VECTOR MATRIX

\`\`\`
DOMAIN         ${domPair}
NODE PAIR      ${result?.nodeIdA ?? '—'} × ${result?.nodeIdB ?? '—'}
SHA-256        ${hash.slice(0, 32)}
               ${hash.slice(32)}
               deterministic — the same collision yields the same hash
SEAL           ${sealLine(tesseract?.seal)}
SPACE          ${result?.space ?? '—'} · OCK v1.1.0

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
`;
}
