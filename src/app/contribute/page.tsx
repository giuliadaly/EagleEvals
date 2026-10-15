import type { Metadata } from "next";
import { ReviewCampaign } from "@/components/review-campaign";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Pass a little advice on", description: "Help the next Boston College student with two overall ratings and a short anonymous review. Older classes count too.",
  alternates: { canonical: "/contribute" },
};

export default function ContributePage() {
  return <><SiteHeader /><main className="flex-1"><ReviewCampaign /></main><SiteFooter /></>;
}
