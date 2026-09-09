import type { MetadataRoute } from "next";
import { getCatalogPaths } from "@/data/queries";
import { browseSubjects } from "@/data/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["/", "/courses", "/professors", "/evaluations", "/comments", "/review", "/about", "/privacy", "/terms", ...browseSubjects.map(subject => `/courses?subject=${encodeURIComponent(subject)}`), ...await getCatalogPaths()];
  return pages.map(path => ({ url: `https://eagleevals.com${path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.7 }));
}
