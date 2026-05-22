import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import KernelSphere from './KernelSphere';
import ChapterPanel from './ChapterPanel';
import { MANIFESTO_CHAPTERS } from '../../data/manifestoChapters';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function KernelManifesto() {
  // TODO(phase-b): emit('edge', 'manifesto_opened', { chapter })
  const [chapter, setChapter] = useState(null);
  const chapterIndex = chapter
    ? MANIFESTO_CHAPTERS.findIndex(c => c.id === chapter.id)
    : -1;

  return (
    <div className="w-full px-4 sm:px-8 pt-8 pb-16 max-w-6xl mx-auto">
      {/* Manifesto header — claim, not decoration */}
      <div className="mb-6">
        <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <span style={{ color: 'rgba(6,182,212,0.6)', fontSize: 14 }}>◉</span>
          THE LATTICE · 272 KERNELS · 16-DIMENSIONAL FEATURE SPACE
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
          Every kernel is a position in 16-D feature space. The clusters were not arranged for you.
          They emerged from primary literature. Click a node to read the chapter that explains its region.
        </p>
      </div>

      {/* The sphere — 3D PCA projection */}
      <div
        style={{
          height: isMobile ? 420 : 580,
          width: '100%',
          touchAction: 'none',
          background: '#04040a',
          border: '1px solid rgba(120,140,200,0.12)',
          borderRadius: 4,
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 7.5], fov: 45 }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
          style={{ background: '#04040a' }}
        >
          <Suspense fallback={null}>
            <KernelSphere onChapterSelect={setChapter} />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={4}
              maxDistance={12}
              enablePan={false}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Chapter index hint */}
      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-mono">
        {MANIFESTO_CHAPTERS.map((c, i) => {
          const hue = (i * 60) % 360;
          return (
            <button
              key={c.id}
              onClick={() => setChapter(c)}
              className="px-2.5 py-1 border rounded-sm transition-colors hover:bg-zinc-200/5"
              style={{
                borderColor: `hsla(${hue}, 70%, 60%, 0.3)`,
                color: `hsla(${hue}, 70%, 70%, 0.85)`,
                cursor: 'pointer',
              }}
            >
              {c.number} {c.title}
            </button>
          );
        })}
      </div>

      {chapter && (
        <ChapterPanel
          chapter={chapter}
          chapterIndex={chapterIndex >= 0 ? chapterIndex : 0}
          onClose={() => setChapter(null)}
        />
      )}
    </div>
  );
}
