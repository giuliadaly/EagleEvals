import type { Metadata } from "next";

export const browseSubjects = ["English", "Economics", "Biology", "Psychology", "History", "Mathematics"];
export type DirectoryParams = { q?: string; page?: string; sort?: string; min?: string; subject?: string };

export function directoryMetadata(path: string, title: string, description: string, params: DirectoryParams): Metadata {
  const number = Number(params.page ?? 1);
  const page = Number.isFinite(number) && number >= 1 ? Math.floor(number) : 1;
  const subject = path === "/courses" ? (params.subject ?? "").trim().slice(0, 100) : "";
  const knownSubject = browseSubjects.includes(subject);
  const filtered = Boolean(params.q?.trim() || (params.sort && params.sort !== "evidence") || Number(params.min ?? 0) !== 0 || (subject && !knownSubject));
  const query = new URLSearchParams();
  if (knownSubject) query.set("subject", subject);
  if (page > 1) query.set("page", String(page));
  const canonical = `${path}${query.size ? `?${query}` : ""}`;
  const name = knownSubject ? `${subject} courses at Boston College` : title;
  const summary = knownSubject ? `Explore Boston College ${subject} courses, instructor ratings, and anonymous student reviews on EagleEvals.` : description;
  return {
    title: `${name}${page > 1 ? ` · Page ${page}` : ""}`,
    description: summary,
    ...(filtered ? { robots: { index: false, follow: true } } : { alternates: { canonical } }),
    openGraph: { type: "website", siteName: "EagleEvals", title: name, description: summary, url: filtered ? path : canonical, images: ["/eagleevals-logo-card.png"] },
    twitter: { card: "summary_large_image", title: name, description: summary, images: ["/eagleevals-logo-card.png"] },
  };
}

export function breadcrumbData(items: { label: string; href?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.label,
      ...(item.href ? { item: `https://eagleevals.com${item.href}` } : {}),
    })),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
