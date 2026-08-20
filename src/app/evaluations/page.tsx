import type { Metadata } from "next";
import Link from "next/link";
import { EvaluationCard } from "@/components/cards";
import { Pagination } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getEvaluationsPage } from "@/data/queries";

export const metadata: Metadata = {
  title: "All evaluations",
  description: "Browse EagleEvals course and professor evaluation records and anonymous student reviews.",
};

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = Number(params.page ?? 1);
  const result = await getEvaluationsPage(query, page);
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-white py-10 sm:py-14">
          <div className="page-shell">
            <p className="eyebrow text-[var(--gold-dark)]">BC course history</p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">All evaluations</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)]">Browse 32,417 section-level numerical evaluations from BC students across courses, professors, and semesters. Written reviews also appear on their related course and professor pages.</p>
            <form className="mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row" role="search">
              <label className="sr-only" htmlFor="evaluation-search">Search evaluations</label>
              <input id="evaluation-search" name="q" defaultValue={result.query} className="form-control flex-1" placeholder="Course code, title, professor, or semester" />
              <button className="button-primary" type="submit">Search evaluations</button>
            </form>
          </div>
        </section>
        <div className="page-shell py-10 sm:py-14">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]"><strong className="text-[var(--ink)]">{formatCount(result.total)}</strong> public evaluation{result.total === 1 ? "" : "s"}{result.query ? ` matching “${result.query}”` : ""}</p>
            <div className="flex flex-wrap gap-3"><Link className="button-secondary" href="/comments">Browse written reviews</Link><Link className="button-gold" href="/review">Write anonymous review</Link></div>
          </div>
          {result.items.length ? <div className="grid gap-5">{result.items.map((evaluation) => <EvaluationCard key={evaluation.id} evaluation={evaluation} />)}</div> : <p className="rounded-2xl border border-[var(--line)] bg-white p-8 text-[var(--muted)]">No evaluations matched that search.</p>}
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/evaluations" query={result.query} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
