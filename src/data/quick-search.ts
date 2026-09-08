export type QuickCourse = { id: string; code: string; title: string; subject: string; commentCount: number; reviewCount?: number };
export type QuickProfessor = { id: string; name: string; title: string | null; commentCount: number; reviewCount?: number };
export type QuickResults = { courses: QuickCourse[]; professors: QuickProfessor[] };

export const EMPTY_RESULTS: QuickResults = { courses: [], professors: [] };

// Keep the normalization browser-safe and consistent with catalog-search.ts.
export function quickSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

type SearchEntry<T> = { item: T; text: string; label: string; compact: string; title: string; count: number };

export function indexQuickCatalog(catalog: QuickResults) {
  return {
    courses: catalog.courses.map(item => ({ item, text: quickSearchText(`${item.code} ${item.title} ${item.subject}`),
      label: item.code, compact: quickSearchText(item.code).replace(/ /g, ""), title: quickSearchText(item.title), count: item.reviewCount ?? 0 })),
    professors: catalog.professors.map(item => ({ item, text: quickSearchText(item.name),
      label: item.name, compact: quickSearchText(item.name).replace(/ /g, ""), title: quickSearchText(item.name), count: item.reviewCount ?? 0 })),
  };
}

export type QuickCatalogIndex = ReturnType<typeof indexQuickCatalog>;

export function filterQuickCatalog(index: QuickCatalogIndex, rawQuery: string, limit = 6): QuickResults {
  const query = quickSearchText(rawQuery.slice(0, 160)).slice(0, 80);
  if (!query) return EMPTY_RESULTS;
  const compact = query.replace(/ /g, "");
  function find<T>(entries: SearchEntry<T>[]): T[] {
    return entries.filter(entry => entry.text.includes(query) || entry.compact.includes(compact))
      .map(entry => ({ entry, rank: entry.compact === compact ? 0 : entry.compact.startsWith(compact) ? 1 : entry.title.includes(query) ? 2 : 3 }))
      .sort((a, b) => a.rank - b.rank || b.entry.count - a.entry.count || a.entry.label.localeCompare(b.entry.label))
      .slice(0, limit).map(({ entry }) => entry.item);
  }
  return { courses: find(index.courses), professors: find(index.professors) };
}
