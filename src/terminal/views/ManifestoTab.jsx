import React from 'react';
import Mandala from './manifesto/Mandala';

const ManifestoTab = ({ systemArticles = {}, setArchitectThesis }) => {
  return (
    <div className="tab-fade-v2 w-full">
      <Mandala
        systemArticles={systemArticles}
        setArchitectThesis={setArchitectThesis}
      />
    </div>
  );
};

export default React.memo(ManifestoTab);
