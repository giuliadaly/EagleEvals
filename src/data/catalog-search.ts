export function normalizeCatalogQuery(value: string): string {
  return value.slice(0, 160).normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ").slice(0, 80);
}

// Both search suggestions and directory filters use the same matching rules.
// $1 is normalized text; $2 is that text with spaces removed.
export function catalogMatch(kind: "course" | "professor"): string {
  const text = kind === "course" ? "code || ' ' || title || ' ' || subject" : "name";
  const normalized = `regexp_replace(lower(${text}), '[^[:alnum:]]+', ' ', 'g')`;
  const compact = kind === "course"
    ? "regexp_replace(lower(code), '[^[:alnum:]]', '', 'g')"
    : "regexp_replace(lower(name), '[^[:alnum:]]', '', 'g')";
  const fuzzy = kind === "course" ? "title || ' ' || subject" : "name";
  return `(${normalized} LIKE '%' || lower($1) || '%'
    OR ${compact} LIKE '%' || lower($2) || '%'
    OR (length($1) >= 4 AND word_similarity(lower($1), lower(${fuzzy})) >= 0.5))`;
}

export function catalogSearchSql(kind: "course" | "professor"): string {
  const label = kind === "course" ? "code" : "name";
  const compact = `regexp_replace(lower(${label}), '[^[:alnum:]]', '', 'g')`;
  return `SELECT * FROM ${kind === "course" ? "course_summaries" : "professor_summaries"}
    WHERE ${catalogMatch(kind)}
    ORDER BY CASE WHEN ${compact} = lower($2) THEN 0
      WHEN ${compact} LIKE lower($2) || '%' THEN 1
      WHEN lower(${kind === "course" ? "title" : "name"}) LIKE '%' || lower($1) || '%' THEN 2 ELSE 3 END,
      word_similarity(lower($1), lower(${kind === "course" ? "title || ' ' || subject" : "name"})) DESC,
      review_count DESC, ${label} ASC, id ASC
    LIMIT $3`;
}
