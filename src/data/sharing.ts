import type { Metadata } from "next";

export const SITE_ORIGIN = "https://eagleevals.com";

export function detailSharingMetadata(path: string, title: string, description: string): Metadata {
  const image = { url: `${SITE_ORIGIN}${path}/opengraph-image`, width: 1200, height: 630, alt: `${title} · EagleEvals` };
  return {
    title, description, alternates: { canonical: path },
    openGraph: { type: "website", siteName: "EagleEvals", title: `${title} · EagleEvals`, description, url: path, images: [image] },
    twitter: { card: "summary_large_image", title: `${title} · EagleEvals`, description, images: [image] },
  };
}

type SharePlatform = {
  share?: (data: { title: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function sharePage(title: string, url: string, platform: SharePlatform): Promise<"shared" | "copied" | "manual" | "cancelled"> {
  if (platform.share) {
    try { await platform.share({ title, url }); return "shared"; }
    catch (error) { if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "cancelled"; }
  }
  try {
    if (platform.clipboard) { await platform.clipboard.writeText(url); return "copied"; }
  } catch { /* A selectable link remains available if clipboard access is denied. */ }
  return "manual";
}
