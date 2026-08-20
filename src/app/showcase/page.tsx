import type { Metadata } from "next";
import ShowcaseClient from "./showcase-client";

export const metadata: Metadata = {
  title: "Redesign Showcases",
  description: "Three responsive EagleEvals interface directions for course registration decisions.",
  robots: { index: false, follow: false },
};

export default async function ShowcasePage({ searchParams }: { searchParams: Promise<{ concept?: string }> }) {
  const { concept } = await searchParams;
  const initialConcept = concept === "desk" || concept === "guide" ? concept : "stack";
  return <ShowcaseClient initialConcept={initialConcept} />;
}
