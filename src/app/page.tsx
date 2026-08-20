import Link from "next/link";
import { CourseCard, ProfessorCard } from "@/components/cards";
import { ArrowIcon, BookIcon, DatabaseIcon, PersonIcon } from "@/components/icons";
import { SearchBox } from "@/components/search-box";
import { SectionHeading } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCount } from "@/data/format";
import { getFeaturedCourses, getFeaturedProfessors, getSiteStats } from "@/data/queries";

export const revalidate = 3600;

export default async function Home() {
  const [stats, courses, professors] = await Promise.all([
    getSiteStats(),
    getFeaturedCourses(),
    getFeaturedProfessors(),
  ]);

  return (
    <>
      <SiteHeader showSearch={false} />
      <main>
        <section className="hero-grid relative overflow-hidden bg-[var(--navy)] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(219,180,90,0.22),transparent_30%),radial-gradient(circle_at_90%_75%,rgba(57,110,151,0.32),transparent_32%)]" />
          <div className="page-shell relative grid min-h-[38rem] items-center gap-12 py-20 lg:grid-cols-[1.25fr_0.75fr] lg:py-24">
            <div>
              <p className="eyebrow text-[var(--gold)]">The BC course guide is back</p>
              <h1 className="mt-5 max-w-4xl font-serif text-5xl font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Choose classes with <span className="text-[var(--gold)]">the full picture.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
                Search restored historical evaluations for thousands of Boston College courses and professors—now preserved in a reliable new home.
              </p>
              <div className="mt-9 max-w-3xl">
                <SearchBox />
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/48">
                <span>Try “ECON1101”</span>
                <span>“Computer Science”</span>
                <span>or a professor’s name</span>
              </div>
            </div>

            <aside className="hidden lg:block" aria-label="Restoration summary">
              <div className="relative ml-auto max-w-sm rounded-[2rem] border border-white/14 bg-white/[0.075] p-7 shadow-2xl shadow-black/20 backdrop-blur-sm">
                <div className="absolute -right-4 -top-4 grid size-14 place-items-center rounded-2xl bg-[var(--gold)] text-[var(--navy)] shadow-xl"><DatabaseIcon className="size-7" /></div>
                <p className="eyebrow text-[var(--gold)]">Preserved archive</p>
                <p className="mt-3 font-serif text-3xl font-bold">Real data, safely restored.</p>
                <p className="mt-4 text-sm leading-6 text-white/60">The useful course and professor records from the original EagleEval have been recovered, verified, and migrated.</p>
                <div className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/15 p-4"><p className="text-2xl font-black text-[var(--gold)]">{formatCount(stats.reviews)}</p><p className="mt-1 text-xs text-white/52">evaluations</p></div>
                  <div className="rounded-xl bg-black/15 p-4"><p className="text-2xl font-black text-[var(--gold)]">{formatCount(stats.comments)}</p><p className="mt-1 text-xs text-white/52">comments</p></div>
                </div>
                <Link href="/evaluations" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[var(--gold)]">Browse every evaluation <ArrowIcon className="size-4" /></Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-[var(--line)] bg-white">
          <div className="page-shell grid divide-y divide-[var(--line)] py-2 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {[
              { icon: BookIcon, value: stats.courses, label: "courses preserved" },
              { icon: PersonIcon, value: stats.professors, label: "professors indexed" },
              { icon: DatabaseIcon, value: stats.reviews, label: "historical evaluations" },
              { icon: ArrowIcon, value: stats.comments, label: "student comments" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-4 px-4 py-6 sm:px-6">
                <span className="icon-tile"><Icon className="size-5" /></span>
                <div><p className="text-2xl font-black tracking-tight text-[var(--navy)]">{formatCount(value)}</p><p className="text-xs text-[var(--muted)]">{label}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-shell py-18 sm:py-24">
          <SectionHeading eyebrow="Start with a course" title="The most evaluated courses" description="Popular courses with the deepest historical evaluation record." href="/courses" linkLabel="Browse all courses" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-[var(--wash)]">
          <div className="page-shell py-18 sm:py-24">
            <SectionHeading eyebrow="Know your options" title="Professors with broad evaluation history" description="Explore teaching feedback across courses and semesters." href="/professors" linkLabel="Browse all professors" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {professors.map((professor) => <ProfessorCard key={professor.id} professor={professor} />)}
            </div>
          </div>
        </section>

        <section className="page-shell py-18 sm:py-24">
          <div className="overflow-hidden rounded-[2rem] bg-[var(--navy)] px-7 py-10 text-white sm:px-12 sm:py-14 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <p className="eyebrow text-[var(--gold)]">Built to stay useful</p>
              <h2 className="mt-3 max-w-2xl font-serif text-3xl font-bold tracking-[-0.03em] sm:text-4xl">A student resource should outlast its first graduating class.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">Browse every recovered evaluation, then add your own ratings and comment without creating an account or attaching your identity.</p>
            </div>
            <Link href="/review" className="button-gold mt-7 shrink-0 lg:mt-0">Write an anonymous review <ArrowIcon className="size-4" /></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
