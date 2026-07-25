import { describe, it, expect } from 'vitest';
import { pinnedKernelArticleIds, FISH_SCALE_ARTICLE_ID } from '../pinnedKernels';

describe('pinnedKernelArticleIds', () => {
  it('always includes the fish-scale genome', () => {
    expect(pinnedKernelArticleIds([])).toEqual([FISH_SCALE_ARTICLE_ID]);
  });
  it('adds every lore kernel with an articleId', () => {
    const builds = [
      { lore: true, articleId: 'HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0' },
      { lore: true, articleId: 'BLACK-HOLE-TAXONOMY-KERNEL-1.0.0' },
      { lore: false, articleId: 'SOME-NON-LORE-KERNEL' },
      { lore: true },                       // no articleId → skipped
    ];
    const ids = pinnedKernelArticleIds(builds);
    expect(ids).toContain(FISH_SCALE_ARTICLE_ID);
    expect(ids).toContain('HUDELSCHUBLADE-ROUTING-KERNEL-1.0.0');
    expect(ids).toContain('BLACK-HOLE-TAXONOMY-KERNEL-1.0.0');
    expect(ids).not.toContain('SOME-NON-LORE-KERNEL');
    expect(ids.length).toBe(3);
  });
  it('dedupes if a lore build repeats the fish-scale id', () => {
    const ids = pinnedKernelArticleIds([{ lore: true, articleId: FISH_SCALE_ARTICLE_ID }]);
    expect(ids).toEqual([FISH_SCALE_ARTICLE_ID]);
  });
});
