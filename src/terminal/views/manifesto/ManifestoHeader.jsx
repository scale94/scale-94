export default function ManifestoHeader() {
  // Manifesto header — claim, not decoration
  return (
    <div className="mb-6">
      <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
        <span style={{ color: 'rgba(6,182,212,0.6)', fontSize: 14 }}>◉</span>
        § · THE SIXTEEN — COUNCIL COLLISION SYNTHESIS ENGINE · 16-DIMENSIONAL FEATURE SPACE
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
        eight read them and told the species how to survive. Arm a seat, fire a second,
        and the collision synthesizes what neither said alone.
      </p>
    </div>
  );
}
