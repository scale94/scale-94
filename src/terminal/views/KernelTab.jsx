import React from 'react';
import ReliquaryView from '../quintessence/ReliquaryView';

// The reliquary (spec §5) replaced the legacy system_kernel relic content.
// The tab that was built to hold master prompts now holds the visitor's one
// compiled kernel — see docs/superpowers/specs/2026-07-09-*-design.md.
const KernelTab = () => <ReliquaryView />;

export default React.memo(KernelTab);
