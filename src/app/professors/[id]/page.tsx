import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentCard, MetricGrid, RatingBadge } from "@/components/cards";
import { ArrowIcon } from "@/components/icons";
import { Breadcrumbs, SectionHeading } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanTitle, formatCount, formatRating, initials } from "@/data/format";
import { getProfessorDetail } from "@/data/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) return { title: "Professor not found" };
  return { title: detail.professor.name, description: `Historical ratings, courses, and student comments for ${detail.professor.name} at Boston College.` };
}

export default async function ProfessorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProfessorDetail(id);
  if (!detail) notFound();
  const { professor, metrics, courses, comments } = detail;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-[var(--line)] bg-white py-8 sm:py-12">
          <div className="page-shell">
            <Breadcrumbs items={[{ label: "Professors", href: "/professors" }, { label: professor.name }]} />
            <div className="mt-7 flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
              <div className="flex max-w-3xl items-start gap-5">
                <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[var(--navy)] text-xl font-black text-[var(--gold)] sm:size-20 sm:text-2xl">{initials(professor.name)}</span>
                <div><p className="eyebrow text-[var(--gold-dark)]">Boston College professor</p><h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">{professor.name}</h1>{professor.titles.length ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{professor.titles.map(cleanTitle).filter(Boolean).join(" · ")}</p> : null}</div>
              </div>
              <RatingBadge value={professor.instructorOverall} label="instructor" large />
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
              <span className="rounded-full bg-[var(--wash)] px-3 py-2">{formatCount(professor.reviewCount)} historical evaluations</span>
              <span className="rounded-full bg-[var(--wash)] px-3 py-2">{courses.length} evaluated course{courses.length === 1 ? "" : "s"}</span>
              {professor.office ? <span className="rounded-full bg-[var(--wash)] px-3 py-2">Office: {professor.office}</span> : null}
              {professor.email ? <a className="rounded-full bg-[var(--wash)] px-3 py-2 hover:bg-[var(--gold-pale)]" href={`mailto:${professor.email}`}>{professor.email}</a> : null}
            </div>
          </div>
        </section>

        <div className="page-shell">
          <section className="py-12 sm:py-16"><SectionHeading eyebrow="Teaching experience" title="What the evaluations say" description="Averages use the original five-point historical evaluation scale across available courses and semesters." /><MetricGrid metrics={metrics} /></section>
          <section className="detail-section"><SectionHeading eyebrow="Course history" title={`Courses taught by ${professor.name.split(" ")[0]}`} description="Ratings are calculated from the evaluations connected to each course." />
            {courses.length ? <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">{courses.map((course, index) => <Link key={course.id} href={`/courses/${course.id}`} className={`group flex flex-col gap-4 p-5 transition hover:bg-[var(--gold-pale)]/45 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${index ? "border-t border-[var(--line)]" : ""}`}><div><p className="text-xs font-black uppercase tracking-[.13em] text-[var(--gold-dark)]">{course.code} · {course.subject}</p><h3 className="mt-1 font-bold text-[var(--navy)] group-hover:text-[var(--blue)]">{course.title}</h3><p className="mt-1 text-xs text-[var(--muted)]">{formatCount(course.reviewCount)} historical section evaluations</p></div><div className="flex items-center gap-6 text-sm"><div><span className="text-xs text-[var(--muted)]">Instructor</span><p className="font-black text-[var(--navy)]">{formatRating(course.instructorOverall)} / 5</p></div><div><span className="text-xs text-[var(--muted)]">Course</span><p className="font-black text-[var(--navy)]">{formatRating(course.courseOverall)} / 5</p></div><ArrowIcon className="size-4 text-[var(--muted)] transition-transform group-hover:translate-x-1" /></div></Link>)}</div> : <p className="rounded-2xl border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">No course relationships were available in the recovered evaluations.</p>}
          </section>
          {comments.length ? <section className="detail-section"><SectionHeading eyebrow="Student perspective" title="Historical comments" description="Recovered anonymous comments are shown as written and may reflect older course formats." /><div className="grid gap-4 lg:grid-cols-2">{comments.map((comment) => <CommentCard key={comment.id} comment={comment} context="professor" />)}</div></section> : null}
          {professor.education.length ? <section className="detail-section"><SectionHeading eyebrow="Faculty information" title="Education" /><ul className="grid gap-3 sm:grid-cols-2">{professor.education.map((item) => <li key={item} className="rounded-xl border border-[var(--line)] bg-white p-4 text-sm leading-6 text-[var(--ink-soft)]">{item}</li>)}</ul></section> : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
