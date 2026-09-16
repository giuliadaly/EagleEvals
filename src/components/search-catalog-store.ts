import { indexQuickCatalog, withQuickEvidence, type QuickCatalogIndex, type QuickEvidence, type QuickResults } from "@/data/quick-search";

let catalogRequest: Promise<QuickResults> | undefined;
let catalogRequestedAt = 0;
let evidenceRequest: Promise<QuickEvidence> | undefined;
let generation = 0;
const listeners = new Set<(index: QuickCatalogIndex) => void>();

function loadCatalog() {
  if (!catalogRequest || Date.now() - catalogRequestedAt > 86_400_000) {
    catalogRequestedAt = Date.now();
    catalogRequest = fetch("/api/search/catalog/v2")
      .then(response => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json() as Promise<QuickResults>;
      })
      .catch(error => { catalogRequest = undefined; throw error; });
  }
  return catalogRequest;
}

export function subscribeToCatalog(listener: (index: QuickCatalogIndex) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function prepareSearchCatalog() {
  return indexQuickCatalog(await loadCatalog());
}

export function refreshSearchEvidence(afterWrite = true) {
  // A pre-submission request must never overwrite the post-submission counts.
  if (afterWrite) { generation++; evidenceRequest = undefined; }
  if (evidenceRequest) return;
  const currentGeneration = generation;
  evidenceRequest = fetch("/api/search/evidence", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Review counts unavailable");
      return response.json() as Promise<QuickEvidence>;
    });
  const request = evidenceRequest;
  void Promise.all([loadCatalog(), request])
    .then(([catalog, evidence]) => {
      if (currentGeneration !== generation) return;
      const index = indexQuickCatalog(withQuickEvidence(catalog, evidence));
      for (const listener of listeners) listener(index);
    })
    .catch(() => { /* Names remain searchable when counts are unavailable. */ })
    .finally(() => { if (evidenceRequest === request) evidenceRequest = undefined; });
}
