const integerFormatter = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return integerFormatter.format(value);
}

export function formatRating(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function collegeName(code: string | null): string | null {
  if (!code) return null;

  const names: Record<string, string> = {
    MCAS: "Morrissey College of Arts & Sciences",
    CSOM: "Carroll School of Management",
    CSON: "Connell School of Nursing",
    LSOE: "Lynch School of Education & Human Development",
    LAW: "Boston College Law School",
    SSW: "School of Social Work",
    STM: "Clough School of Theology and Ministry",
    WCAS: "Woods College of Advancing Studies",
  };

  return names[code] ?? code;
}

export function cleanTitle(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/,\s*([A-Z]{3,5})$/, " · $1");
}

export function semesterSortValue(semester: string): number {
  const yearMatch = semester.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;
  const season = semester.toLowerCase().includes("fall")
    ? 3
    : semester.toLowerCase().includes("summer")
      ? 2
      : semester.toLowerCase().includes("spring")
        ? 1
        : 0;
  const midtermPenalty = semester.toLowerCase().includes("midterm") ? -0.1 : 0;
  return year * 10 + season + midtermPenalty;
}
