"use client";

import { useEffect, useMemo, useState } from "react";
import { EMPTY_RESULTS, filterQuickCatalog, indexQuickCatalog, quickSearchText, type QuickCatalogIndex, type QuickResults } from "@/data/quick-search";

let catalogRequest: Promise<QuickCatalogIndex> | undefined;
let catalogRequestedAt = 0;

function loadCatalog() {
  if (!catalogRequest || Date.now() - catalogRequestedAt > 300_000) {
    catalogRequestedAt = Date.now();
    catalogRequest = fetch("/api/search/catalog")
      .then(response => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json() as Promise<QuickResults>;
      })
      .then(indexQuickCatalog)
      .catch(error => { catalogRequest = undefined; throw error; });
  }
  return catalogRequest;
}

export function useCatalogSearch(rawQuery: string, enabled = true, kind?: "course" | "professor") {
  const query = quickSearchText(rawQuery.slice(0, 160)).slice(0, 80);
  const [catalog, setCatalog] = useState<QuickCatalogIndex | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [remote, setRemote] = useState<{ query: string; results: QuickResults; failed: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    // One shared public catalog download, prepared before the first keystroke.
    loadCatalog().then(index => { if (active) setCatalog(index); })
      .catch(() => { if (active) setCatalogFailed(true); });
    return () => { active = false; };
  }, []);

  const local = useMemo(() => catalog && enabled ? filterQuickCatalog(catalog, query) : EMPTY_RESULTS, [catalog, enabled, query]);
  const hasLocal = kind === "course" ? local.courses.length > 0 : kind === "professor" ? local.professors.length > 0 : local.courses.length + local.professors.length > 0;
  const needsRemote = enabled && !!query && !hasLocal && (!!catalog || catalogFailed);

  useEffect(() => {
    if (!needsRemote) return;
    const controller = new AbortController();
    // Only typo/no-match searches (or catalog failure) need a server round trip.
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Search unavailable");
        return response.json() as Promise<QuickResults>;
      })
      .then(results => { if (!controller.signal.aborted) setRemote({ query, results, failed: false }); })
      .catch(() => { if (!controller.signal.aborted) setRemote({ query, results: EMPTY_RESULTS, failed: true }); });
    return () => controller.abort();
  }, [query, needsRemote]);

  const currentRemote = remote?.query === query ? remote : null;
  return {
    results: !enabled || !query ? EMPTY_RESULTS : hasLocal ? local : currentRemote?.results ?? EMPTY_RESULTS,
    loading: enabled && !!query && ((!catalog && !catalogFailed) || (needsRemote && !currentRemote)),
    failed: needsRemote && !!currentRemote?.failed,
  };
}
