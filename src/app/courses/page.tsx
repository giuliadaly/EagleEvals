import type { Metadata } from "next";
import { CourseCard } from "@/components/cards";
import { SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getCoursesPage } from "@/data/queries";

export const metadata: Metadata = { title: "Courses", description: "Browse restored historical evaluations for Boston College courses." };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const data = await getCoursesPage(params.q ?? "", Number(params.page ?? 1));
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-white py-12 sm:py-16">
          <div className="page-shell">
            <p className="eyebrow text-[var(--gold-dark)]">Course directory</p>
            <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div><h1 className="font-serif text-4xl font-bold tracking-[-0.035em] text-[var(--navy)] sm:text-5xl">Browse courses</h1><p className="mt-3 text-sm text-[var(--muted)]">{formatCount(data.total)} courses in the recovered archive</p></div>
              <form role="search" className="relative w-full sm:max-w-sm">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
                <label htmlFor="course-filter" className="sr-only">Filter courses</label>
                <input id="course-filter" name="q" defaultValue={data.query} placeholder="Filter code, title, or subject" className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--cream)] pl-11 pr-4 text-sm outline-none focus:border-[var(--gold-dark)] focus:ring-4 focus:ring-[var(--gold)]/18" />
              </form>
            </div>
          </div>
        </section>
        <div className="page-shell py-12">
          {data.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <div className="py-20 text-center"><h2 className="font-serif text-3xl font-bold text-[var(--navy)]">No courses found</h2><p className="mt-2 text-sm text-[var(--muted)]">Try a shorter course code, title, or subject.</p></div>}
          <Pagination page={data.page} totalPages={data.totalPages} basePath="/courses" query={data.query} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
