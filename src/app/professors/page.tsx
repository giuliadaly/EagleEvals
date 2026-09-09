import type { Metadata } from "next";
import { directoryMetadata, type DirectoryParams } from "@/data/seo";
import { ProfessorCard } from "@/components/cards";
import { SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getProfessorsPage } from "@/data/queries";

export async function generateMetadata({ searchParams }: { searchParams: Promise<DirectoryParams> }): Promise<Metadata> {
  return directoryMetadata("/professors", "Boston College professor reviews", "Find Boston College professor ratings, courses taught, and anonymous student reviews.", await searchParams);
}

export default async function ProfessorsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; min?: string }> }) {
  const params = await searchParams;
  const sort = ["rating", "course", "comments", "name"].includes(params.sort ?? "") ? params.sort! : "evidence";
  const min = [4, 4.5].includes(Number(params.min)) ? Number(params.min) : 0;
  const data = await getProfessorsPage(params.q ?? "", Number(params.page ?? 1), sort, min);
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="page-intro">
          <div className="page-shell">
            <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-[-0.035em] text-[var(--ink)] sm:text-5xl">Who’s teaching?</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">{formatCount(data.total)} matching professors · a little context before the first class</p>
            <form role="search" className="directory-filters">
              <label className="relative"><span className="form-label">Professor name</span><SearchIcon className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-[var(--muted)]" /><input name="q" defaultValue={data.query} placeholder="Search by name" className="form-control with-search-icon" /></label>
              <label><span className="form-label">Order by</span><select name="sort" defaultValue={sort} className="form-control"><option value="evidence">Most ratings</option><option value="comments">Most written reviews</option><option value="rating">Highest instructor rating</option><option value="course">Highest course rating</option><option value="name">Name A–Z</option></select></label>
              <label><span className="form-label">Minimum rating</span><select name="min" defaultValue={String(min)} className="form-control"><option value="0">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label>
              <button className="button-primary" type="submit">Apply filters</button>
            </form>
          </div>
        </section>
        <div className="page-shell py-12">
          {data.items.length ? <div className="catalog-list">{data.items.map((professor) => <ProfessorCard key={professor.id} professor={professor} />)}</div> : <div className="py-20 text-center"><h2 className="font-serif text-3xl font-semibold text-[var(--ink)]">No professors match those filters</h2><p className="mt-2 text-sm text-[var(--muted)]">Lower the rating threshold or try a shorter name.</p></div>}
          <Pagination page={data.page} totalPages={data.totalPages} basePath="/professors" query={data.query} params={{ sort, min: min ? String(min) : undefined }} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
