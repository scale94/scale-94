import ManifestoHeader from './ManifestoHeader';
import CouncilRing from './CouncilRing';
import KernelManual from './KernelManual';

// Section composition for the manifesto tab. Each section owns its own
// layout and typography so visual passes can land one section at a time.
export default function KernelManifesto() {
  return (
    <div className="w-full px-4 sm:px-8 pt-8 pb-16 max-w-6xl mx-auto">
      <ManifestoHeader />

      <CouncilRing />

      <KernelManual />
    </div>
  );
}
