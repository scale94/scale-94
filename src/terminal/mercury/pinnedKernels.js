// The five exhibition kernels the reading witness watches. Mirrors the pinned
// rule in KernelTab (fish-scale genome + every lore kernel), reduced to the set
// of their article IDs (which equal `selectedArticle.id` at read time).
export const FISH_SCALE_ARTICLE_ID = 'FISH-SCALE-KERNEL11.1.1';

export function pinnedKernelArticleIds(kernelBuilds = []) {
  const ids = new Set([FISH_SCALE_ARTICLE_ID]);
  for (const k of kernelBuilds) {
    if (k && k.lore && k.articleId) ids.add(k.articleId);
  }
  return [...ids];
}
