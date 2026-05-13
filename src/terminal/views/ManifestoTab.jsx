import React from 'react';
import KernelManifesto from './manifesto/KernelManifesto';

const ManifestoTab = () => {
  return (
    <div className="tab-fade-v2 w-full">
      <KernelManifesto />
    </div>
  );
};

export default React.memo(ManifestoTab);
