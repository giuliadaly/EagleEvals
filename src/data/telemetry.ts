// Only low-cardinality event properties belong here. Never accept form values,
// search text, course/professor IDs, review IDs, or arbitrary error messages.
export type ProductEvent =
  | { name: "review_started" }
  | { name: "review_submitted"; duration: "under_1_min" | "1_to_2_min" | "2_to_5_min" | "5_plus_min" }
  | { name: "review_error"; reason: "validation" | "selection" | "duplicate" | "server" | "network" }
  | { name: "search_results"; outcome: "matches" | "empty" | "unavailable" }
  | { name: "search_opened"; kind: "course" | "professor" }
  | { name: "search_submitted" };

const publicPaths = new Set(["/", "/courses", "/professors", "/comments", "/evaluations", "/search", "/review", "/about", "/privacy", "/terms"]);

export function telemetryUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (!publicPaths.has(url.pathname) && !/^\/(courses|professors)\/[a-f0-9]{24}(\/compare)?$/.test(url.pathname)) return null;
    // Keep useful public page paths, but strip all search/prefill/UTM values.
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

export function redactTelemetry<T extends { url: string }>(event: T): T | null {
  const url = telemetryUrl(event.url);
  return url ? { ...event, url } : null;
}

export function reviewDuration(milliseconds: number): Extract<ProductEvent, { name: "review_submitted" }>["duration"] {
  if (milliseconds < 60_000) return "under_1_min";
  if (milliseconds < 120_000) return "1_to_2_min";
  if (milliseconds < 300_000) return "2_to_5_min";
  return "5_plus_min";
}

export function productEventData(event: ProductEvent): Record<string, string> | undefined {
  // Construct each payload explicitly so unexpected runtime fields are dropped.
  switch (event.name) {
    case "review_submitted": return { duration: event.duration };
    case "review_error": return { reason: event.reason };
    case "search_results": return { outcome: event.outcome };
    case "search_opened": return { kind: event.kind };
    default: return undefined;
  }
}
