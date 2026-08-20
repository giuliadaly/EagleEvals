import type { Metadata } from "next";
import Link from "next/link";
import { CommentArchiveCard } from "@/components/cards";
import { Pagination } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getCommentsPage } from "@/data/queries";

export const metadata: Metadata = {
  title: "All written reviews",
  description: "Browse every public written EagleEval comment and new anonymous review.",
};

export default async function CommentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await getCommentsPage(params.q ?? "", Number(params.page ?? 1));
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-white py-10 sm:py-14">
          <div className="page-shell">
            <p className="eyebrow text-[var(--gold-dark)]">Student perspective</p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">All written reviews</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--ink-soft)]">Browse anonymous written reviews from BC students past and present. They are displayed as submitted and may describe course formats that have since changed.</p>
            <form className="mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row" role="search">
              <label className="sr-only" htmlFor="comment-search">Search written reviews</label>
              <input id="comment-search" name="q" defaultValue={result.query} className="form-control flex-1" placeholder="Course, professor, or words in a review" />
              <button className="button-primary" type="submit">Search comments</button>
            </form>
          </div>
        </section>
        <div className="page-shell py-10 sm:py-14">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]"><strong className="text-[var(--ink)]">{formatCount(result.total)}</strong> written review{result.total === 1 ? "" : "s"}{result.query ? ` matching “${result.query}”` : ""}</p>
            <div className="flex flex-wrap gap-3"><Link className="button-secondary" href="/evaluations">Numerical evaluations</Link><Link className="button-gold" href="/review">Write anonymous review</Link></div>
          </div>
          {result.items.length ? <div className="grid gap-5 lg:grid-cols-2">{result.items.map((comment) => <CommentArchiveCard key={comment.id} comment={comment} />)}</div> : <p className="rounded-2xl border border-[var(--line)] bg-white p-8 text-[var(--muted)]">No written reviews matched that search.</p>}
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/comments" query={result.query} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
