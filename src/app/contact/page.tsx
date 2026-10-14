import type { Metadata } from "next";
import { AnonymousReportForm } from "@/components/anonymous-report-form";
import { Breadcrumbs } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getReportReference } from "@/data/report-target";

export const metadata: Metadata = { title: "Contact & corrections", alternates: { canonical: "/contact" },
  description: "Report a review, request a correction, or share a site issue anonymously.", robots: { index: false, follow: true } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ review?: string; course?: string; professor?: string }> }) {
  const params = await searchParams;
  let reference = null;
  let unavailable = false;
  try { reference = await getReportReference(params); } catch { unavailable = true; }
  const requested = Boolean(params.review || params.course || params.professor);
  return <><SiteHeader /><main className="flex-1">
    <section className="page-intro"><div className="page-shell max-w-4xl">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact & corrections" }]} />
      <p className="eyebrow mt-8 text-[var(--gold-dark)]">A little help keeping things useful</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Something look wrong?</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--ink-soft)]">Flag a review, suggest a correction, or tell us about a problem. It stays private and anonymous.</p>
    </div></section>
    <section className="page-shell max-w-4xl py-10 sm:py-14">
      {requested && !reference ? <p role="alert" className="mb-6 max-w-2xl rounded bg-[var(--rose-pale)] p-4 text-sm leading-6 text-[var(--rose)]">{unavailable ? "We could not load that review or page. Please refresh before reporting it." : "That review or page could not be found. You can still tell us about a general issue below."}</p> : null}
      {unavailable && requested ? null : <AnonymousReportForm key={`${reference?.kind ?? "site"}:${reference?.id ?? ""}`} reference={reference} />}
    </section>
  </main><SiteFooter /></>;
}
