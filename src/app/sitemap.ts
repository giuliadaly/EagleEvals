import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/courses", "/professors", "/search", "/about", "/privacy", "/terms"];
  return pages.map((path) => ({ url: `https://eagleevals.com${path}`, lastModified: new Date("2026-08-13"), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 }));
}
