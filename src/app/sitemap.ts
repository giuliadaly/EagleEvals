import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/courses", "/professors", "/evaluations", "/comments", "/review", "/search", "/about", "/privacy", "/terms"];
  return pages.map((path) => ({ url: `https://eagleevals.com${path}`, lastModified: new Date("2026-08-19"), changeFrequency: path === "" || path === "/evaluations" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 }));
}
