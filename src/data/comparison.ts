export function comparisonSelection(raw: string | string[] | undefined, eligible: string[]): { ids: string[]; error: string | null } {
  const requested = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
  if (!requested.length) return { ids: [], error: null };
  if (requested.length < 2 || requested.length > 3 || new Set(requested).size !== requested.length || requested.some(id => !eligible.includes(id))) {
    return { ids: [], error: "Choose two or three different professors with evaluations for this course." };
  }
  return { ids: requested, error: null };
}
