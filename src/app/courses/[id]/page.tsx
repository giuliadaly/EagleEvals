import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentCard, MetricGrid, RatingBadge } from "@/components/cards";
import { ArrowIcon } from "@/components/icons";
import { Breadcrumbs, SectionHeading } from "@/components/page-parts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cleanTitle, collegeName, formatCount, formatRating } from "@/data/format";
import { getCourseDetail } from "@/data/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCourseDetail(id);
  if (!detail) return { title: "Course not found" };
  return { title: `${detail.course.code}: ${detail.course.title}`, description: `Historical ratings, workload, instructors, and student comments for ${detail.course.code} ${detail.course.title}.` };
}

export default async function CourseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; min?: string }> }) {
  const { id } = await params;
  const filters = await searchParams;
  const detail = await getCourseDetail(id);
  if (!detail) notFound();
  const { course, metrics, estimatedWeeklyHours, instructors, comments, semesters } = detail;
  const sort = ["rating", "course", "name"].includes(filters.sort ?? "") ? filters.sort! : "evidence";
  const min = [4, 4.5].includes(Number(filters.min)) ? Number(filters.min) : 0;
  const visibleInstructors = instructors
    .filter((instructor) => min === 0 || (instructor.instructorOverall ?? 0) >= min)
    .sort((a, b) => {
      if (sort === "rating") return (b.instructorOverall ?? -1) - (a.instructorOverall ?? -1) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
      if (sort === "course") return (b.courseOverall ?? -1) - (a.courseOverall ?? -1) || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.reviewCount - a.reviewCount || a.name.localeCompare(b.name);
    });
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="page-intro">
          <div className="page-shell">
            <Breadcrumbs items={[{ label: "Courses", href: "/courses" }, { label: course.code }]} />
            <div className="mt-7 flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow text-[var(--gold-dark)]">{course.code} · {course.subject}</p>
                <h1 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-[-0.04em] text-[var(--navy)] sm:text-5xl">{course.title}</h1>
                {collegeName(course.college) ? <p className="mt-3 text-sm font-semibold text-[var(--muted)]">{collegeName(course.college)}</p> : null}
                <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">{course.description || "No course description is currently available."}</p>
              </div>
              <RatingBadge value={course.courseOverall} label="course" large />
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
              <span className="rounded-full bg-[var(--wash)] px-3 py-2">{formatCount(course.reviewCount)} historical evaluations</span>
              <span className="rounded-full bg-[var(--wash)] px-3 py-2">{instructors.length} evaluated instructor{instructors.length === 1 ? "" : "s"}</span>
              {course.commentCount ? <span className="rounded-full bg-[var(--wash)] px-3 py-2">{formatCount(course.commentCount)} student comment{course.commentCount === 1 ? "" : "s"}</span> : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-3"><Link className="button-primary" href={`/evaluations?q=${encodeURIComponent(course.code)}`}>Browse all evaluations</Link><Link className="button-gold" href={`/review?course=${course.id}`}>Write anonymous review</Link></div>
          </div>
        </section>

        <div className="page-shell">
          <section className="py-12 sm:py-16">
            <SectionHeading eyebrow="Course experience" title="What the evaluations say" description="Averages use the original five-point historical evaluation scale." />
            <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
              <MetricGrid metrics={metrics} />
              <div className="rounded-2xl bg-[var(--navy)] p-6 text-white">
                <p className="eyebrow text-[var(--gold)]">Weekly effort</p>
                <p className="mt-5 text-5xl font-black tracking-[-0.05em]">{estimatedWeeklyHours === null ? "—" : `~${estimatedWeeklyHours}`}</p>
                <p className="mt-1 text-sm font-bold text-white/85">hours per week</p>
                <p className="mt-5 text-xs leading-5 text-white/52">Estimated from the original workload response buckets. Individual sections may differ.</p>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <SectionHeading eyebrow="Instructor options" title={`Who taught ${course.code}`} description="Ratings below reflect the evaluations connected to this course." />
            <form className="mb-6 grid gap-3 rounded-[.75rem] border border-[var(--line-strong)] bg-[var(--paper-ledger)] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label><span className="form-label">Order instructors</span><select className="form-control" name="sort" defaultValue={sort}><option value="evidence">Most evaluations</option><option value="rating">Highest instructor rating</option><option value="course">Highest course rating</option><option value="name">Name A–Z</option></select></label>
              <label><span className="form-label">Minimum instructor rating</span><select className="form-control" name="min" defaultValue={String(min)}><option value="0">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label>
              <button className="button-primary" type="submit">Apply filters</button>
            </form>
            {visibleInstructors.length ? <div className="overflow-hidden rounded-[.375rem] border border-[var(--line-strong)] bg-[var(--paper-raised)]">
              {visibleInstructors.map((instructor, index) => (
                <Link key={instructor.id} href={`/professors/${instructor.id}`} className={`group flex flex-col gap-4 p-5 transition hover:bg-[var(--gold-pale)]/45 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${index ? "border-t border-[var(--line)]" : ""}`}>
                  <div><h3 className="font-bold text-[var(--navy)] group-hover:text-[var(--blue)]">{instructor.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{cleanTitle(instructor.titles[0]) ?? `${formatCount(instructor.reviewCount)} evaluations for this course`}</p></div>
                  <div className="flex items-center gap-6 text-sm"><div><span className="text-xs text-[var(--muted)]">Instructor</span><p className="font-black text-[var(--navy)]">{formatRating(instructor.instructorOverall)} / 5</p></div><div><span className="text-xs text-[var(--muted)]">Course</span><p className="font-black text-[var(--navy)]">{formatRating(instructor.courseOverall)} / 5</p></div><ArrowIcon className="size-4 text-[var(--muted)] transition-transform group-hover:translate-x-1" /></div>
                </Link>
              ))}
            </div> : <p className="border-block border-[var(--line)] py-6 text-sm text-[var(--muted)]">No instructors match those filters.</p>}
          </section>

          {comments.length ? <section className="detail-section"><SectionHeading eyebrow="Student perspective" title="Written reviews" description="Anonymous comments from BC students past and present are shown as submitted and may reflect different course formats." href={`/comments?q=${encodeURIComponent(course.code)}`} linkLabel="Browse all matching comments" /><div className="grid gap-4 lg:grid-cols-2">{comments.map((comment) => <CommentCard key={comment.id} comment={comment} context="course" />)}</div></section> : null}

          {semesters.length ? <section className="detail-section"><SectionHeading eyebrow="Across time" title="Evaluation history" description="Available section-level results across semesters." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{semesters.slice(0, 12).map((semester) => <div key={semester.semester} className="rounded-xl border border-[var(--line)] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold text-[var(--navy)]">{semester.semester}</p><span className="text-xs text-[var(--muted)]">{semester.reviewCount} section{semester.reviewCount === 1 ? "" : "s"}</span></div><div className="mt-3 flex gap-5 text-xs text-[var(--muted)]"><span>Course <strong className="text-[var(--ink)]">{formatRating(semester.courseOverall)}</strong></span><span>Instructor <strong className="text-[var(--ink)]">{formatRating(semester.instructorOverall)}</strong></span></div></div>)}</div></section> : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
