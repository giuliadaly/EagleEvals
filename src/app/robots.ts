import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [
    { userAgent: "*", allow: "/", disallow: "/api/" },
    { userAgent: ["meta-externalagent", "Amazonbot", "Panscient", "panscient.com", "MJ12bot"], disallow: "/" },
  ], sitemap: "https://eagleevals.com/sitemap.xml" };
}
