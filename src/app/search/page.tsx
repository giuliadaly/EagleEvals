import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard, ProfessorCard } from "@/components/cards";
import { SearchBox } from "@/components/search-box";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { searchCatalog } from "@/data/queries";

export const metadata: Metadata = { robots: { index: false, follow: true }, title: "Search", description: "Search EagleEvals courses, professors, ratings, and student reviews." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const normalized = q.trim().slice(0, 80);
  const results = normalized.length >= 2 ? await searchCatalog(normalized, 24) : { courses: [], professors: [] };
  const total = results.courses.length + results.professors.length;

  return (
    <>
      <SiteHeader showSearch={false} />
      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-[var(--navy)] py-14 text-white sm:py-18">
          <div className="page-shell">
            <p className="eyebrow text-[var(--gold)]">Search EagleEvals</p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-[-0.035em] sm:text-5xl">Find a course or professor</h1>
            <div className="mt-7 max-w-3xl"><SearchBox key={normalized} initialQuery={normalized} autoFocus={!normalized} /></div>
          </div>
        </section>
        <div className="page-shell py-12 sm:py-16">
          {!normalized ? (
            <div className="mx-auto max-w-xl py-14 text-center"><h2 className="font-serif text-3xl font-bold text-[var(--navy)]">What are you considering?</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Search by course code, course title, academic subject, or professor name.</p></div>
          ) : total === 0 ? (
            <div className="mx-auto max-w-xl py-14 text-center"><h2 className="font-serif text-3xl font-bold text-[var(--navy)]">No results for “{normalized}”</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Check the spelling, try a shorter phrase, or browse the full directories.</p><div className="mt-6 flex justify-center gap-3"><Link className="button-secondary" href="/courses">Courses</Link><Link className="button-secondary" href="/professors">Professors</Link></div></div>
          ) : (
            <div className="space-y-14">
              <p className="text-sm text-[var(--muted)]">Showing results for <strong className="text-[var(--ink)]">“{normalized}”</strong></p>
              {results.courses.length ? <section><h2 className="font-serif text-3xl font-bold text-[var(--navy)]">Courses <span className="font-sans text-base font-semibold text-[var(--muted)]">({results.courses.length})</span></h2><div className="catalog-list mt-6">{results.courses.map((course) => <CourseCard key={course.id} course={course} />)}</div></section> : null}
              {results.professors.length ? <section><h2 className="font-serif text-3xl font-bold text-[var(--navy)]">Professors <span className="font-sans text-base font-semibold text-[var(--muted)]">({results.professors.length})</span></h2><div className="catalog-list mt-6">{results.professors.map((professor) => <ProfessorCard key={professor.id} professor={professor} />)}</div></section> : null}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
