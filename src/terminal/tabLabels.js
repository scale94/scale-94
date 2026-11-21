// src/terminal/tabLabels.js — display names for internal tab ids.
// Several tabs were renamed after their ids were baked into App routing,
// NAV_TINTS and observatory payloads. The ids stay; anything a person READS
// goes through tabLabel() so a renamed tab never leaks its old name.
export const TAB_LABELS = {
  manifesto: 'accretion',
  scaling: 'scent',
  art: 'chaos',
};

export function tabLabel(id) {
  return TAB_LABELS[id] ?? id;
}

// Observation Matrix filter chip -> internal tab id its empty state links to.
// ALL has no home and MERCURY is the tab you are already on: neither navigates.
export const CATEGORY_TABS = {
  TRANSMISSIONS: 'transmission',
  ESSENCES:      'scaling',        // the /SCENT collider
  CIPHERS:       'cryptography',
  GAZE:          'lunar',
  EDGE:          'manifesto',      // /ACCRETION
};
